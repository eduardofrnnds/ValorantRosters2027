import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditorForm } from "./editor-form";
import { draftMessages, type DraftRow } from "./roster-draft-model";
import type { RosterData } from "./roster-draft-data";
import { publicationMessages } from "./roster-publication-model";

export function teamLabel(data: RosterData, id: string) {
  const team = data.team_seasons.find((candidate) => candidate.id === id);
  return team ? `${data.organizations.find((org) => org.id === team.organization_id)?.name ?? "Organização"} · ${data.seasons.find((season) => season.id === team.season_id)?.year}` : "Participação indisponível";
}
export function RostersUnavailable() {
  return <div role="alert" className="rounded-lg border border-border bg-card p-6"><h1 className="text-2xl font-semibold">Elencos indisponíveis</h1><p className="mt-3 text-sm text-muted-foreground">Verifique a conexão e as migrations antes de tentar novamente.</p><Link href="/admin/rosters" className="mt-4 inline-flex min-h-12 items-center text-sm underline">Voltar aos elencos</Link></div>;
}
export function DraftNotice({ status }: { status?: string }) {
  if (status === "published" || status === "already-published" || status === "published-cache-pending") return <p role="status" className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">{status === "already-published" ? "Esta publicação já havia sido concluída. Nenhuma mudança foi duplicada." : status === "published-cache-pending" ? "Elenco publicado. A atualização do cache não foi confirmada; recarregue a página pública." : publicationMessages.saved}</p>;
  if (status?.startsWith("publish-") && Object.hasOwn(publicationMessages, status.slice(8))) return <p role="alert" className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">{publicationMessages[status.slice(8) as keyof typeof publicationMessages]}</p>;
  if (status === "archived") return <p role="status" className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">Rascunho arquivado. O elenco público permanece inalterado.</p>;
  if (!status || !Object.hasOwn(draftMessages, status)) return null;
  return <p role={status === "saved" ? "status" : "alert"} className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">{draftMessages[status as keyof typeof draftMessages]}</p>;
}
export function ArchiveDraftForm({ draft }: { draft: DraftRow }) {
  return <EditorForm action="/admin/rosters/archive" messages={draftMessages}>
    <input type="hidden" name="id" value={draft.id} /><input type="hidden" name="expected_updated_at" value={draft.updated_at} />
    <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" required className="size-4 accent-primary" />Confirmo arquivar este rascunho, preservando seu histórico.</label>
    <Button type="submit" variant="outline" className="whitespace-normal">Arquivar rascunho</Button>
  </EditorForm>;
}
