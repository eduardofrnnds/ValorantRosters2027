import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getRosterData } from "@/features/admin/roster-draft-server";
import { draftPayloadSchema, rosterDiff } from "@/features/admin/roster-draft-model";
import { publicationMessages } from "@/features/admin/roster-publication-model";
import { RostersUnavailable, teamLabel } from "@/features/admin/roster-draft-ui";
import { EditorForm } from "@/features/admin/editor-form";
import { Field } from "@/features/admin/organization-forms";
import { membershipStatusLabels, playerRoleLabels, formatCareerDate } from "@/features/players/player-profile-model";

export const metadata = { title: "Revisar publicação | Administração" };
export default async function PublishRosterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> }) {
  const { id } = await params, query = await searchParams;
  const data = await getRosterData();
  if (!data) return <RostersUnavailable />;
  const draft = data.drafts.find((entry) => entry.id === query.draft && entry.team_season_id === id);
  const parsed = draftPayloadSchema.safeParse(draft?.payload);
  if (!draft || draft.status !== "draft" || !parsed.success) return <><h1 className="text-2xl font-semibold">Rascunho indisponível para publicação</h1><Link className="inline-flex min-h-12 items-center underline" href="/admin/rosters">Voltar aos elencos</Link></>;
  const payload = parsed.data, diff = rosterDiff(payload.base_members, payload.members);
  const count = diff.added.length + diff.removed.length + diff.changed.length;
  const previous = new Date(`${payload.effective_on}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
  const endDate = previous.toISOString().slice(0, 10);
  const name = (playerId: string) => data.players.find((player) => player.id === playerId)?.nickname ?? "Perfil indisponível";
  const describe = (entry: typeof payload.members[number]) => `${membershipStatusLabels[entry.status]} · ${entry.role ? playerRoleLabels[entry.role] : "Função não informada"}`;
  return <>
    <Link href={`/admin/rosters/${id}?draft=${draft.id}`} className="mb-4 inline-flex min-h-12 items-center underline">Voltar ao rascunho</Link>
    <h1 className="text-2xl font-semibold">Revisar publicação</h1>
    <p className="mt-3 break-words text-lg">{teamLabel(data, id)}</p>
    <p className="mt-4 text-sm leading-7 text-muted-foreground">Esta revisão usa a última versão salva. Mudanças não salvas no editor não estão incluídas. O banco verificará novamente permissões, versão e conflitos ao confirmar.</p>
    <div className="my-6 rounded-lg border border-border bg-card p-5 text-sm leading-7">
      <p>Vigência: <strong>{formatCareerDate(payload.effective_on)}</strong>. Entradas e novos status ou funções começam nesta data.</p>
      <p>Vínculos substituídos ou removidos terminam em <strong>{formatCareerDate(endDate)}</strong>, com esse dia incluído. Não é possível encerrar um vínculo no dia em que começou.</p>
      <p>Datas futuras só mudam o elenco exibido quando chegam. Um término já agendado será mantido no vínculo substituto; outros vínculos futuros são preservados e podem bloquear sobreposições.</p>
    </div>
    <section aria-labelledby="publication-diff" className="mb-8"><h2 id="publication-diff" className="text-xl font-semibold">{count} mudanças salvas</h2>
      {count ? <ul className="mt-4 space-y-3 text-sm leading-6">
        {diff.added.map((entry) => <li key={entry.player_id} className="break-words rounded-md border border-border p-4"><strong>Entrada: {name(entry.player_id)}</strong><p>{describe(entry)}</p></li>)}
        {diff.removed.map((entry) => <li key={entry.player_id} className="break-words rounded-md border border-border p-4"><strong>Saída: {name(entry.player_id)}</strong><p>{describe(entry)}</p></li>)}
        {diff.changed.map(({ before, after }) => <li key={after.player_id} className="break-words rounded-md border border-border p-4"><strong>Alteração: {name(after.player_id)}</strong><p>Antes: {describe(before)}</p><p>Depois: {describe(after)}</p></li>)}
      </ul> : <p className="mt-4 text-sm">Não há alterações para publicar.</p>}
    </section>
    {count > 0 && <EditorForm action="/admin/rosters/publish" messages={publicationMessages}>
      <input type="hidden" name="id" value={draft.id} /><input type="hidden" name="expected_updated_at" value={draft.updated_at} />
      <Field label="Fonte da informação (opcional, HTTPS)" name="source_url" type="url" maxLength={2048} placeholder="https://…" />
      <label className="flex min-h-12 items-start gap-3 py-3 text-sm leading-6"><input type="checkbox" required name="confirm" value="publish" className="mt-1 size-4 shrink-0 accent-primary" />Confirmo publicar estas mudanças e suas datas, preservando o histórico anterior.</label>
      <Button type="submit" className="whitespace-normal">Confirmar e publicar elenco</Button>
    </EditorForm>}
  </>;
}
