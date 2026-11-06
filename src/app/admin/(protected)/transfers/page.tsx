import { randomUUID } from "node:crypto";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { getRosterData } from "@/features/admin/roster-draft-server";
import { teamLabel, RostersUnavailable } from "@/features/admin/roster-draft-ui";
import { Field, inputClass } from "@/features/admin/organization-forms";
import { EditorForm } from "@/features/admin/editor-form";
import { transferMessages } from "@/features/admin/transfer-model";
import { getAdminMetrics } from "@/features/admin/dashboard-server";
import { DashboardHeading, MetricCards, MetricsNotice } from "@/features/admin/dashboard";
import { formatCareerDate, membershipStatusLabels, playerRoleLabels } from "@/features/players/player-profile-model";

export const metadata = { title: "Transferências | Administração" };
export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ origin?: string; destination?: string; date?: string; status?: string }> }) {
  const query = await searchParams;
  const [data, metrics] = await Promise.all([getRosterData(), getAdminMetrics(["transfers", "changes"])]);
  const status = typeof query.status === "string" ? query.status : "";
  const notice = status === "already-published" ? "Esta transferência já foi publicada. Nenhum registro foi duplicado." : status === "cache-pending" ? "Transferência publicada. A atualização do cache não foi confirmada; recarregue as páginas públicas." : Object.hasOwn(transferMessages, status) ? transferMessages[status as keyof typeof transferMessages] : null;
  if (!data) return <RostersUnavailable />;
  const publicTeams = data.team_seasons.filter((team) => team.publication_status === "published" && !team.archived_at
    && data.organizations.some((org) => org.id === team.organization_id && org.publication_status === "published")
    && data.seasons.some((season) => season.id === team.season_id && season.publication_status === "published")
    && data.regions.some((region) => region.id === team.region_id && region.publication_status === "published"));
  const memberships = data.memberships.filter((entry) => entry.publication_status === "published" && publicTeams.some((team) => team.id === entry.team_season_id) && data.players.some((player) => player.id === entry.player_id && player.publication_status === "published"));
  const origin = memberships.find((entry) => entry.id === query.origin);
  const fromTeam = publicTeams.find((entry) => entry.id === origin?.team_season_id);
  const toTeam = publicTeams.find((entry) => entry.id === query.destination);
  const date = typeof query.date === "string" ? query.date : new Date().toISOString().slice(0, 10);
  const validDate = z.iso.date().safeParse(date).success;
  const validReview = origin && fromTeam && toTeam && fromTeam.id !== toTeam.id && fromTeam.season_id === toTeam.season_id && validDate && origin.start_date < date && (!origin.end_date || origin.end_date >= date);
  const hasDraft = data.drafts.some((draft) => draft.status === "draft" && [fromTeam?.id, toTeam?.id].includes(draft.team_season_id));
  const player = data.players.find((entry) => entry.id === origin?.player_id);
  const role = origin?.role_is_explicit ? origin.role : player?.role;
  const previous = validDate ? new Date(`${date}T00:00:00Z`) : null; previous?.setUTCDate(previous.getUTCDate() - 1);
  return <>
    <DashboardHeading title="Transferências" description="Prepare uma transferência manual e confirme a atualização conjunta dos dois elencos." href="/admin/transfers" />
    <MetricsNotice keys={["transfers", "changes"]} metrics={metrics} /><MetricCards keys={["transfers", "changes"]} metrics={metrics} links={false} />
    {notice && <p role={["saved", "already-published", "cache-pending"].includes(status) ? "status" : "alert"} className="mt-6 rounded-lg border border-border p-4 text-sm">{notice}</p>}
    <Link href="/transfers" className="my-5 inline-flex min-h-12 items-center underline">Consultar histórico público</Link>
    <section className="rounded-lg border border-border p-5"><h2 className="mb-4 text-xl font-semibold">Preparar transferência</h2>
      <form action="/admin/transfers" method="get" className="space-y-5">
        <label className="block space-y-2 text-sm font-medium"><span>Jogador e vínculo de origem</span><select name="origin" required className={inputClass} defaultValue={origin?.id ?? ""}><option value="" disabled>Selecione um vínculo publicado</option>{memberships.map((entry) => <option key={entry.id} value={entry.id}>{data.players.find((player) => player.id === entry.player_id)?.nickname} — {teamLabel(data, entry.team_season_id)} — {entry.start_date}{entry.end_date ? ` até ${entry.end_date}` : " em aberto"}</option>)}</select></label>
        <label className="block space-y-2 text-sm font-medium"><span>Equipe de destino</span><select name="destination" required className={inputClass} defaultValue={toTeam?.id ?? ""}><option value="" disabled>Selecione outra equipe da mesma temporada</option>{publicTeams.map((team) => <option key={team.id} value={team.id}>{teamLabel(data, team.id)}</option>)}</select></label>
        <Field label="Data de início no destino" name="date" type="date" required defaultValue={date} />
        <Button type="submit" disabled={!memberships.length}>Revisar transferência</Button>
        {!memberships.length && <p className="text-sm text-muted-foreground">Nenhum vínculo publicado disponível. Publique um elenco antes de preparar uma transferência.</p>}
      </form>
    </section>
    {(query.origin || query.destination) && !validReview && <p role="alert" className="mt-6 rounded-lg border border-border p-4 text-sm">Selecione um vínculo ativo na data, com início anterior a ela, e outra equipe publicada da mesma temporada.</p>}
    {validReview && <section className="mt-8 rounded-lg border border-border p-5"><h2 className="text-xl font-semibold">Confirmar transferência</h2>
      <dl className="my-5 space-y-3 break-words text-sm leading-6"><div><dt className="text-muted-foreground">Jogador</dt><dd>{player?.nickname}</dd></div><div><dt className="text-muted-foreground">Origem</dt><dd>{teamLabel(data, fromTeam.id)} · {membershipStatusLabels[origin.status]} · último dia {formatCareerDate(previous!.toISOString().slice(0, 10))}</dd></div><div><dt className="text-muted-foreground">Destino</dt><dd>{teamLabel(data, toTeam.id)} · início {formatCareerDate(date)}{origin.end_date ? ` · término mantido em ${formatCareerDate(origin.end_date)}` : " · sem término definido"}</dd></div><div><dt className="text-muted-foreground">Função preservada</dt><dd>{role ? playerRoleLabels[role] : "Não informada"}</dd></div></dl>
      <p className="mb-5 text-sm leading-6 text-muted-foreground">A confirmação publica o movimento e sua observação. O mesmo jogador será mantido, com a passagem anterior preservada. Datas futuras só alteram os elencos exibidos quando chegam. Versões, permissões e conflitos serão conferidos novamente.</p>
      {hasDraft ? <p role="alert" className="text-sm">Há rascunho aberto na origem ou no destino. Publique ou arquive esses rascunhos em <Link href="/admin/rosters" className="underline">Elencos</Link> e revise novamente.</p> : <EditorForm key={`${origin.updated_at}:${toTeam.id}:${toTeam.roster_revision}:${date}`} action="/admin/transfers/publish" messages={transferMessages}>
        <input type="hidden" name="id" value={randomUUID()} /><input type="hidden" name="from_membership_id" value={origin.id} /><input type="hidden" name="to_team_season_id" value={toTeam.id} /><input type="hidden" name="expected_membership_updated_at" value={origin.updated_at} /><input type="hidden" name="expected_from_revision" value={fromTeam.roster_revision} /><input type="hidden" name="expected_to_revision" value={toTeam.roster_revision} /><input type="hidden" name="effective_on" value={date} />
        <label className="block space-y-2 text-sm font-medium"><span>Status no destino</span><select name="status" required className={inputClass} defaultValue={origin.status}>{Object.entries(membershipStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block space-y-2 text-sm font-medium"><span>Observação pública (opcional)</span><textarea name="note" maxLength={1000} rows={3} className={inputClass} /></label>
        <Field label="Fonte (opcional, HTTPS)" name="source_url" type="url" maxLength={2048} />
        <label className="flex min-h-12 items-start gap-3 py-3 text-sm leading-6"><input type="checkbox" required name="confirm" value="transfer" className="mt-1 size-4 shrink-0 accent-primary" />Confirmo transferir este jogador, com as equipes, datas, status e observação acima.</label>
        <Button type="submit" className="whitespace-normal">Confirmar e publicar transferência</Button>
      </EditorForm>}
    </section>}
  </>;
}
