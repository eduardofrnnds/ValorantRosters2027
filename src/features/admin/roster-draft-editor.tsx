"use client";

import { useState, useSyncExternalStore, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "./organization-forms";
import { playerRoleLabels, membershipStatusLabels } from "@/features/players/player-profile-model";
import { playerRoles } from "./player-model";
import { draftMessages, rosterStatuses, rosterDiff, starterConflicts, saveDraftSchema, type SaveDraftInput, type DraftMember } from "./roster-draft-model";
import type { RosterData } from "./roster-draft-data";

const subscribe = () => () => {};
export function RosterDraftEditor({ initial, data, readOnly = false }: { initial: SaveDraftInput; data: RosterData; readOnly?: boolean }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [members, setMembers] = useState(initial.payload.members);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const team = data.team_seasons.find((entry) => entry.id === initial.team_season_id)!;
  const conflicts = starterConflicts({ members, teamId: team.id, seasonId: team.season_id, date: initial.payload.effective_on, teams: data.team_seasons, memberships: data.memberships, drafts: data.drafts });
  const diff = rosterDiff(initial.payload.base_members, members);
  const dirty = JSON.stringify(members) !== JSON.stringify(initial.payload.members);
  const name = (id: string) => data.players.find((player) => player.id === id)?.nickname ?? "Jogador indisponível";
  const teamName = (id: string) => data.organizations.find((org) => org.id === data.team_seasons.find((entry) => entry.id === id)?.organization_id)?.name ?? "Outra equipe";
  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);
  function change(id: string, values: Partial<DraftMember>) {
    setMembers((current) => current.map((member) => member.player_id === id ? { ...member, ...values } : member));
    setMessage("");
  }
  async function save() {
    const input = { ...initial, payload: { ...initial.payload, members } };
    if (!saveDraftSchema.safeParse(input).success || conflicts.length) { setMessage(conflicts.length ? draftMessages.reference : draftMessages.invalid); return; }
    setPending(true); setMessage("");
    try {
      const response = await fetch("/admin/rosters/save", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(input) });
      if (response.redirected) { router.push("/admin/login?status=required"); return; }
      const result = await response.json() as { status: keyof typeof draftMessages };
      if (result.status === "saved") {
        setSaved(true); router.push(`/admin/rosters/${team.id}?status=saved`); router.refresh();
      } else setMessage(Object.hasOwn(draftMessages, result.status) ? draftMessages[result.status] : draftMessages.unavailable);
    } catch { setMessage(draftMessages.unavailable); }
    setPending(false);
  }
  const normalized = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const available = data.players.filter((player) => !members.some((entry) => entry.player_id === player.id) && `${player.nickname} ${player.slug}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized));
  return <>
    <noscript><p className="mb-4 rounded-md border border-border p-4 text-sm">Ative JavaScript para editar o rascunho. A leitura do cadastro e o arquivamento continuam disponíveis.</p></noscript>
    <fieldset disabled={!ready || pending || saved || readOnly} className="min-w-0 space-y-6 disabled:opacity-60">
      <legend className="mb-4 text-lg font-semibold">Elenco proposto</legend>
      <div className="rounded-lg border border-border bg-card p-5"><h2 className="mb-4 font-semibold">Adicionar jogador cadastrado</h2><div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium"><span>Buscar jogador</span><input type="search" className={inputClass} value={search} onChange={(event) => { setSearch(event.target.value); setSelected(""); }} /></label>
        <label className="block min-w-0 space-y-2 text-sm font-medium"><span>Jogador</span><select className={inputClass} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Selecione</option>{available.map((player) => <option value={player.id} key={player.id}>{player.nickname} / {player.slug}{player.publication_status === "draft" ? " (perfil privado)" : ""}</option>)}</select></label>
      </div><Button type="button" className="mt-4" variant="outline" disabled={!selected || members.length >= 200} onClick={() => {
        const player = data.players.find((entry) => entry.id === selected);
        if (!player || members.some((entry) => entry.player_id === player.id)) return;
        setMembers([...members, { player_id: player.id, status: "reserve", role: player.role }]); setSelected(""); setMessage("");
      }}>Adicionar ao rascunho</Button><p className="mt-3 text-sm text-muted-foreground">Novas entradas começam como reserva. Perfis privados podem ser preparados, mas precisam ser publicados antes do elenco.</p></div>
      {rosterStatuses.map((status) => <section key={status} className="rounded-lg border border-border bg-card p-4 sm:p-5"><h2 className="mb-4 text-lg font-semibold">{{ starter: "Titulares", reserve: "Reservas", inactive: "Inativos", coach: "Técnicos" }[status]}</h2>
        {members.filter((entry) => entry.status === status).length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogador neste grupo.</p>}
        <ul className="space-y-4">{members.filter((entry) => entry.status === status).map((entry) => <li key={entry.player_id} className="min-w-0 rounded-md border border-border p-4"><h3 className="mb-4 break-words font-medium">{name(entry.player_id)}</h3><div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm"><span>Status de {name(entry.player_id)}</span><select className={inputClass} value={entry.status} onChange={(event) => change(entry.player_id, { status: event.target.value as DraftMember["status"] })}>{rosterStatuses.map((value) => <option key={value} value={value}>{membershipStatusLabels[value]}</option>)}</select></label>
          <label className="block space-y-2 text-sm"><span>Função de {name(entry.player_id)}</span><select className={inputClass} value={entry.role ?? ""} onChange={(event) => change(entry.player_id, { role: event.target.value ? event.target.value as DraftMember["role"] : null })}><option value="">Não informada</option>{playerRoles.map((value) => <option key={value} value={value}>{playerRoleLabels[value]}</option>)}</select></label>
        </div><Button type="button" variant="ghost" className="mt-3 whitespace-normal" onClick={() => { setMembers(members.filter((member) => member.player_id !== entry.player_id)); setMessage(""); }}>{initial.payload.base_members.some((member) => member.player_id === entry.player_id) ? "Preparar saída" : "Remover proposta"}</Button></li>)}</ul>
      </section>)}
      <section aria-label="Prévia das alterações" className="rounded-lg border border-border bg-secondary p-5"><h2 className="text-lg font-semibold">Prévia das alterações</h2><p className="mt-2 text-sm text-muted-foreground">Referência: {initial.payload.effective_on}. As funções propostas ficam somente neste rascunho.</p>
        {!diff.added.length && !diff.removed.length && !diff.changed.length ? <p className="mt-4 text-sm">Nenhuma alteração em relação à base.</p> : <ul className="mt-4 space-y-3 text-sm">
          {diff.added.map((entry) => <li key={`add-${entry.player_id}`}>Entrada: {name(entry.player_id)} · {membershipStatusLabels[entry.status]} · {entry.role ? playerRoleLabels[entry.role] : "Função não informada"}</li>)}
          {diff.removed.map((entry) => <li key={`remove-${entry.player_id}`}>Saída proposta: {name(entry.player_id)}. O vínculo publicado permanece.</li>)}
          {diff.changed.map(({ before, after }) => <li key={`change-${after.player_id}`}>Alteração: {name(after.player_id)} · {membershipStatusLabels[before.status]} → {membershipStatusLabels[after.status]} · {before.role ? playerRoleLabels[before.role] : "Não informada"} → {after.role ? playerRoleLabels[after.role] : "Não informada"}</li>)}
        </ul>}
      </section>
      {conflicts.length > 0 && <div role="alert" className="rounded-md border border-primary/40 p-4"><h2 className="font-semibold">Conflito de titular</h2><ul className="mt-3 space-y-2 text-sm">{conflicts.map((conflict, index) => <li key={index}>{name(conflict.playerId)} já está proposto ou vinculado como titular em {teamName(conflict.teamId)} ({conflict.source}).</li>)}</ul></div>}
      <p className="text-sm leading-6 text-muted-foreground">Salvar não publica entradas, funções ou saídas. A base publicada continua visível. Rascunhos de outras equipes com titular conflitante bloqueiam a gravação, mesmo com datas diferentes.</p>
      {!readOnly && <Button type="button" onClick={save} disabled={conflicts.length > 0 || pending || saved}>{pending ? "Salvando…" : "Salvar rascunho"}</Button>}
    </fieldset>
    {message && <p role="alert" className="mt-4 rounded-md border border-primary/40 p-4 text-sm">{message}</p>}
    {saved && <p role="status" className="mt-4 text-sm">{draftMessages.saved}</p>}
  </>;
}
