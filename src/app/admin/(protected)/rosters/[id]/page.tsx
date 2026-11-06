import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/features/admin/organization-forms";
import { getRosterData } from "@/features/admin/roster-draft-server";
import { currentRoster, draftDate, draftPayloadSchema, baseMember, type SaveDraftInput } from "@/features/admin/roster-draft-model";
import { RosterDraftEditor } from "@/features/admin/roster-draft-editor";
import { ArchiveDraftForm, DraftNotice, RostersUnavailable, teamLabel } from "@/features/admin/roster-draft-ui";

export const metadata = { title: "Rascunho de elenco | Administração" };
export default async function RosterDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; draft?: string; status?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const data = await getRosterData();
  if (!data) return <RostersUnavailable />;
  const team = data.team_seasons.find((entry) => entry.id === id);
  if (!team) return <><h1 className="text-2xl font-semibold">Participação não encontrada</h1><Link href="/admin/rosters" className="mt-4 inline-flex min-h-12 items-center underline">Voltar aos elencos</Link></>;
  const draft = query.draft ? data.drafts.find((entry) => entry.id === query.draft && entry.team_season_id === id)
    : data.drafts.filter((entry) => entry.team_season_id === id && entry.status === "draft").sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const parsed = draft ? draftPayloadSchema.safeParse(draft.payload) : null;
  const date = parsed?.success ? parsed.data.effective_on : typeof query.date === "string" ? query.date : new Date().toISOString().slice(0, 10);
  const validDate = draftDate.safeParse(date).success;
  const baseline = validDate ? currentRoster(data.memberships, data.players, id, date) : [];
  const stale = Boolean(draft?.status === "draft" && parsed?.success && (draft.base_revision !== team.roster_revision || JSON.stringify(baseMember.array().parse(baseline)) !== JSON.stringify(parsed.data.base_members)));
  const invalid = Boolean(draft && !parsed?.success) || Boolean(query.draft && !draft) || !validDate;
  const readOnly = Boolean(team.archived_at || (draft && draft.status !== "draft") || stale);
  const initial: SaveDraftInput = {
    id: draft?.id ?? randomUUID(), team_season_id: id, expected_updated_at: draft?.updated_at ?? "", base_revision: draft?.base_revision ?? team.roster_revision,
    payload: parsed?.success ? parsed.data : { version: 1, effective_on: date, base_members: baseline, members: baseline.map(({ player_id, status, role }) => ({ player_id, status, role })) },
  };
  return <><header className="mb-6"><Link href="/admin/rosters" className="mb-3 inline-flex min-h-12 items-center text-sm underline">Voltar aos elencos</Link><h1 className="break-words text-2xl font-semibold sm:text-3xl">{teamLabel(data, id)}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{draft ? "Rascunho de elenco" : "Novo rascunho"} · edição privada; publicação exige revisão e confirmação.</p></header><DraftNotice status={query.status} />
    {!draft && <form method="get" action={`/admin/rosters/${id}`} className="mb-6 flex flex-wrap items-end gap-3"><Field label="Data de referência das mudanças" name="date" type="date" required defaultValue={date} /><Button type="submit" variant="outline">Carregar base nesta data</Button></form>}
    <p className="mb-6 text-sm leading-6 text-muted-foreground">A base considera vínculos publicados ativos na data escolhida, com o último dia incluído. A data fica fixa após salvar; a revisão de publicação confirma as datas de entradas, alterações e saídas.</p>
    {invalid ? <p role="alert" className="rounded-md border border-border p-5 text-sm">Data inválida, rascunho não encontrado ou formato anterior incompatível com este editor. Os dados existentes foram preservados. Rascunhos antigos abertos podem ser arquivados abaixo antes de criar um novo.</p> : <>
      {readOnly && <p role="alert" className="mb-5 rounded-md border border-border p-4 text-sm">Somente leitura: {stale ? "a base publicada mudou. Arquive este rascunho e crie outro a partir da base atual." : team.archived_at ? "a participação está arquivada." : "este rascunho já foi arquivado ou publicado."}</p>}
      <RosterDraftEditor key={`${initial.id}:${draft?.updated_at ?? date}`} initial={initial} data={data} readOnly={readOnly} />
    </>}
    {draft?.status === "published" && <section className="mt-8 rounded-lg border border-border p-5 text-sm leading-7"><h2 className="text-lg font-semibold">Publicação registrada</h2><p>Data: {draft.published_at} · Autor: {draft.published_by}</p>{draft.publication_source_url && <a href={draft.publication_source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center underline">Consultar fonte</a>}<p>A proposta salva e o histórico dos vínculos foram preservados.</p></section>}
    {draft?.status === "draft" && !readOnly && !invalid && <section className="mt-8 rounded-lg border border-border p-5"><h2 className="text-lg font-semibold">Publicar elenco</h2><p className="my-3 text-sm leading-6 text-muted-foreground">Salve suas alterações antes de continuar. A próxima tela revisa somente a última versão salva.</p><Button asChild><Link href={`/admin/rosters/${id}/publish?draft=${draft.id}`}>Revisar publicação</Link></Button></section>}
    {draft?.status === "draft" && <section className="mt-8 rounded-lg border border-border p-5"><h2 className="mb-3 text-lg font-semibold">Encerrar este rascunho</h2><ArchiveDraftForm draft={draft} /></section>}
  </>;
}
