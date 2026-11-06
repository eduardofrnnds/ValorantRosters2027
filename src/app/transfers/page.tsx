import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { getPublicCatalog } from "@/features/organizations/public-catalog";
import { CatalogState, LocalCatalogNotice } from "@/features/organizations/catalog-state";
import { getRosterTimeline } from "@/features/transfers/timeline-server";
import { Timeline } from "@/features/transfers/timeline";
import { changeLabels, parseTimelineQuery, timelineHref } from "@/features/transfers/timeline-model";

export const metadata = { title: "Transferências e mudanças | VCT Roster Tracker", description: "Histórico publicado de transferências e mudanças de elenco, com filtros por região, equipe e data." };
const control = "min-h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-base";
export default async function TransfersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams, parsed = parseTimelineQuery(query);
  const catalog = await getPublicCatalog();
  if (catalog.status !== "ready") return <CatalogState status={catalog.status} />;
  const filters = parsed.success ? parsed.data : undefined;
  const result = filters ? await getRosterTimeline(filters) : null;
  const organizations = [...catalog.catalog.organizations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return <Container className="py-10 sm:py-14"><LocalCatalogNotice source={catalog.source} />
    <h1 className="text-3xl font-semibold sm:text-4xl">Transferências e mudanças</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Registros publicados manualmente, com passagens preservadas. A data indica a vigência da mudança; movimentos futuros aparecem identificados.</p>
    <form action="/transfers" method="get" className="my-8 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-2 text-sm"><span>Região de origem ou destino</span><select name="region" className={control} defaultValue={filters?.region ?? ""}><option value="">Todas as regiões</option>{catalog.catalog.regions.map((region) => <option key={region.id} value={region.slug}>{region.name}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span>Equipe de origem ou destino</span><select name="team" className={control} defaultValue={filters?.team ?? ""}><option value="">Todas as equipes</option>{organizations.map((org) => <option key={org.id} value={org.slug}>{org.name}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span>Tipo de movimento</span><select name="kind" className={control} defaultValue={filters ? filters.kind ?? "all" : "transferred"}><option value="all">Todas as mudanças</option>{Object.entries(changeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span>De</span><input name="from" type="date" className={control} defaultValue={filters?.from} /></label>
      <label className="space-y-2 text-sm"><span>Até</span><input name="to" type="date" className={control} defaultValue={filters?.to} /></label>
      {filters?.player_id && <><input type="hidden" name="player_id" value={filters.player_id} /><p className="self-center text-sm text-muted-foreground">Filtro de jogador ativo.</p></>}
      <div className="flex flex-wrap items-end gap-3"><Button type="submit">Filtrar histórico</Button><Link href="/transfers" className="inline-flex min-h-12 items-center text-sm underline">Limpar filtros</Link></div>
    </form>
    {!parsed.success && <p role="alert" className="rounded-lg border border-border p-5 text-sm">Filtros inválidos. Confira as datas, a página e os valores da busca ou limpe os filtros.</p>}
    {result && <><p className="mb-4 text-sm text-muted-foreground">{result.status === "ready" ? `${result.data.total} registros encontrados` : "Não foi possível carregar os registros."}</p><Timeline result={result} empty="Nenhum registro publicado para estes filtros." /></>}
    {result?.status === "ready" && filters && (filters.page > 1 || result.data.total > filters.page_size) && <nav aria-label="Paginação do histórico" className="mt-6 flex flex-wrap items-center gap-5 text-sm">
      {filters.page > 1 && <Link href={timelineHref(filters, filters.page - 1)} className="inline-flex min-h-12 items-center underline">Página anterior</Link>}
      <span>Página {filters.page} de {Math.max(1, Math.ceil(result.data.total / filters.page_size))}</span>
      {filters.page * filters.page_size < result.data.total && filters.page < 10000 && <Link href={timelineHref(filters, filters.page + 1)} className="inline-flex min-h-12 items-center underline">Próxima página</Link>}
    </nav>}
  </Container>;
}
