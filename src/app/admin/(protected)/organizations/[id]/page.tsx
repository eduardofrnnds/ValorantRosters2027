import Link from "next/link";
import { getOrganizationData } from "@/features/admin/organization-server";
import { EditorHeading, EditorNotice, EditorUnavailable, OrganizationForm, ParticipationForm } from "@/features/admin/organization-forms";
import { LogoUploadForm } from "@/features/admin/organization-logo-form";

export const metadata = { title: "Editar organização | Administração" };
export default async function EditOrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const { status } = await searchParams;
  const data = await getOrganizationData();
  if (!data) return <EditorUnavailable />;
  const row = data.organizations.find((organization) => organization.id === id);
  if (!row) return <EditorHeading title="Organização não encontrada" description="O registro não existe ou não está disponível para esta sessão." />;
  const participations = data.team_seasons.filter((team) => team.organization_id === id)
    .sort((a, b) => (data.seasons.find((season) => season.id === b.season_id)?.year ?? 0) - (data.seasons.find((season) => season.id === a.season_id)?.year ?? 0));
  const remaining = { ...data, seasons: data.seasons.filter((season) => !participations.some((team) => team.season_id === season.id)) };
  return <><EditorHeading title={row.name} description="Edite a identidade da organização e gerencie cada participação separadamente. As alterações são registradas no histórico de auditoria." /><EditorNotice status={status} />
    <section aria-label="Identidade" className="rounded-lg border border-border bg-card p-5 sm:p-6"><OrganizationForm data={data} row={row} />{row.publication_status === "published" && <Link href={`/team/${row.slug}`} className="mt-4 inline-flex min-h-12 items-center text-sm underline">Abrir perfil público</Link>}</section>
    <LogoUploadForm row={row} enabled={process.env.SUPABASE_ORGANIZATION_LOGOS_BUCKET === "organization-logos"} />
    <section className="mt-8"><h2 className="mb-4 text-xl font-semibold">Participações e histórico</h2><div className="space-y-4">{participations.map((team) => <details key={team.id} className="rounded-lg border border-border bg-card"><summary className="min-h-12 cursor-pointer p-5 font-medium">{data.seasons.find((season) => season.id === team.season_id)?.year} · {data.regions.find((region) => region.id === team.region_id)?.name} · {team.archived_at ? "Arquivada" : team.publication_status === "published" ? "Publicada" : "Rascunho"}</summary><div className="border-t border-border p-5"><ParticipationForm data={data} organizationId={id} row={team} /></div></details>)}</div>
    {remaining.seasons.length > 0 ? <details className="mt-4 rounded-lg border border-dashed border-border"><summary className="min-h-12 cursor-pointer p-5 font-medium">Adicionar participação em outra temporada</summary><div className="border-t border-border p-5"><ParticipationForm data={remaining} organizationId={id} /></div></details> : <p className="mt-5 text-sm text-muted-foreground">Todas as temporadas cadastradas já têm uma participação. <Link className="underline" href="/admin/organizations/seasons">Gerenciar temporadas</Link>.</p>}</section>
  </>;
}
