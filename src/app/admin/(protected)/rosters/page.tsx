import Link from "next/link";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/features/admin/organization-forms";
import { getRosterData } from "@/features/admin/roster-draft-server";
import { DraftNotice, RostersUnavailable, teamLabel } from "@/features/admin/roster-draft-ui";

export const metadata = { title: "Elencos | Administração" };
export default async function RostersPage({ searchParams }: { searchParams: Promise<{ season?: string; region?: string; status?: string }> }) {
  const params = await searchParams;
  const data = await getRosterData();
  if (!data) return <RostersUnavailable />;
  const seasonId = typeof params.season === "string" ? params.season : data.seasons.find((season) => season.year === 2027)?.id ?? data.seasons[0]?.id ?? "";
  const regionId = typeof params.region === "string" ? params.region : "";
  const selectedTeams = data.team_seasons.filter((team) => team.season_id === seasonId && (!regionId || team.region_id === regionId));
  const teams = selectedTeams.filter((team) => !team.archived_at)
    .sort((a, b) => teamLabel(data, a.id).localeCompare(teamLabel(data, b.id), "pt-BR"));
  const drafts = data.drafts.filter((draft) => selectedTeams.some((team) => team.id === draft.team_season_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return <><header className="mb-6"><h1 className="text-2xl font-semibold sm:text-3xl">Elencos</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Escolha a temporada, filtre a região e abra a equipe. As alterações são preparadas em rascunhos privados.</p></header><DraftNotice status={params.status} />
    <form action="/admin/rosters" method="get" className="mb-6 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
      <label className="block min-w-0 space-y-2 text-sm font-medium"><span>Temporada</span><select className={inputClass} name="season" defaultValue={seasonId}>{data.seasons.map((season) => <option value={season.id} key={season.id}>{season.year} — {season.name}</option>)}</select></label>
      <label className="block min-w-0 space-y-2 text-sm font-medium"><span>Região</span><select className={inputClass} name="region" defaultValue={regionId}><option value="">Todas as regiões</option>{data.regions.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}</select></label><Button type="submit" variant="secondary">Filtrar</Button>
    </form>
    <section><h2 className="mb-4 text-lg font-semibold">Equipes nesta seleção</h2>{teams.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhuma participação ativa nesta seleção.</p> : <ul className="grid gap-4 md:grid-cols-2">{teams.map((team) => <li key={team.id} className="min-w-0 rounded-lg border border-border bg-card p-5"><h3 className="break-words font-semibold">{teamLabel(data, team.id)}</h3><p className="mt-2 text-sm text-muted-foreground">{data.regions.find((region) => region.id === team.region_id)?.name} · {data.drafts.filter((draft) => draft.team_season_id === team.id && draft.status === "draft").length} rascunhos abertos</p><Button asChild variant="outline" className="mt-4"><Link href={`/admin/rosters/${team.id}`}>Abrir editor</Link></Button></li>)}</ul>}</section>
    <section id="rascunhos" className="mt-8"><h2 className="mb-4 text-xl font-semibold">Rascunhos e histórico</h2>{drafts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum rascunho nesta seleção.</p> : <ul className="space-y-3">{drafts.map((draft) => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border p-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{teamLabel(data, draft.team_season_id)}</p><p className="mt-2 text-xs text-muted-foreground">{draft.status === "draft" ? "Aberto" : draft.status === "archived" ? "Arquivado" : "Publicado"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(draft.updated_at))} UTC</p></div><Link className="inline-flex min-h-12 items-center text-sm underline" href={`/admin/rosters/${draft.team_season_id}?draft=${draft.id}`}>{draft.status === "draft" ? "Revisar rascunho" : "Consultar histórico"}</Link></li>)}</ul>}</section>
  </>;
}
