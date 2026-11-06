import { getOrganizationData } from "@/features/admin/organization-server";
import { EditorHeading, EditorNotice, EditorUnavailable, SeasonForm } from "@/features/admin/organization-forms";

export const metadata = { title: "Temporadas | Administração" };
export default async function SeasonsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const data = await getOrganizationData();
  const { status } = await searchParams;
  return <><EditorHeading title="Temporadas" description="Crie temporadas e controle sua visibilidade. As participações permanecem ligadas ao mesmo ano e ID." /><EditorNotice status={status} />{!data ? <EditorUnavailable /> : <>
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Nova temporada</h2><SeasonForm /></section>
    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">Temporadas cadastradas</h2>{data.seasons.length === 0 && <p className="text-sm text-muted-foreground">Sem temporadas cadastradas.</p>}<div className="space-y-4">{data.seasons.map((season) => <details key={season.id} className="rounded-lg border border-border bg-card"><summary className="min-h-12 cursor-pointer break-words p-5 font-medium">{season.year} — {season.name} · {season.publication_status === "published" ? "Publicada" : "Rascunho"}</summary><div className="border-t border-border p-5"><SeasonForm row={season} /></div></details>)}</div></section>
  </>}</>;
}
