import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getOrganizationData } from "@/features/admin/organization-server";
import { filterOrganizations } from "@/features/admin/organization-model";
import { EditorNotice, EditorUnavailable, Field } from "@/features/admin/organization-forms";

export const metadata = { title: "Organizações | Administração" };
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const data = await getOrganizationData();
  const query = typeof params.q === "string" ? params.q.slice(0, 160) : "";
  const rows = data ? filterOrganizations(data.organizations, query) : [];
  return <>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold sm:text-3xl">Organizações</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Gerencie as identidades das equipes e suas participações por temporada. Rascunhos e participações arquivadas permanecem privados.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/organizations/seasons">Temporadas</Link></Button><Button asChild><Link href="/admin/organizations/new">Nova organização</Link></Button></div></header>
    <EditorNotice status={params.status} />
    {!data ? <EditorUnavailable /> : <>
      <form method="get" action="/admin/organizations" className="mb-6 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="Buscar por nome, sigla ou slug" name="q" defaultValue={query} maxLength={160} type="search" /></div><Button type="submit" variant="secondary">Buscar</Button>{query && <Link className="inline-flex min-h-12 items-center text-sm underline" href="/admin/organizations">Limpar</Link>}</form>
      <p className="mb-4 text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "organização encontrada" : "organizações encontradas"} · {data.organizations.length} no cadastro</p>
      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">{query ? "Nenhuma organização corresponde à busca." : "Sem dados. Cadastre a primeira organização."}</p> :
        <ul className="space-y-3">{rows.map((row) => {
          const teams = data.team_seasons.filter((team) => team.organization_id === row.id);
          return <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5"><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{row.name} {row.short_name && <span className="text-sm font-normal text-muted-foreground">({row.short_name})</span>}</h2><p className="mt-1 break-all text-xs text-muted-foreground">/{row.slug} · {row.publication_status === "published" ? "Publicado" : "Rascunho"}</p><p className="mt-2 text-sm text-muted-foreground">{teams.length} participações · {teams.filter((team) => team.archived_at).length} arquivadas</p></div><Button asChild variant="outline"><Link href={`/admin/organizations/${row.id}`} aria-label={`Editar ${row.name}`}>Editar</Link></Button></li>;
        })}</ul>}
    </>}
  </>;
}
