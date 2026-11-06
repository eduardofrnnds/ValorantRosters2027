import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { DEFAULT_SEASON_YEAR } from "@/features/organizations/data/vct-2027";
import { getPublicCatalog } from "@/features/organizations/public-catalog";
import { CatalogState, LocalCatalogNotice } from "@/features/organizations/catalog-state";
import { getRegionOrganizations } from "@/features/organizations/directory-model";
import { OrganizationDirectory } from "@/features/organizations/organization-directory";
import { cn } from "@/lib/utils";

type RegionPageProps = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: RegionPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const result = await getPublicCatalog();
  if (result.status !== "ready") return { title: "Catálogo | VCT Roster Tracker", robots: { index: false } };
  const region = result.catalog.regions.find((entry) => entry.slug === slug);
  if (!region) return { title: "Região não encontrada | VCT Roster Tracker", robots: { index: false } };
  return {
    title: `${region.name} | VCT Roster Tracker`,
    description: `Explore as organizações de ${region.name} na temporada ${DEFAULT_SEASON_YEAR} do VCT. Busque equipes e navegue por seus perfis.`,
  };
}

export default async function RegionPage({ params }: RegionPageProps) {
  const { region: slug } = await params;
  const result = await getPublicCatalog();
  if (result.status !== "ready") return <CatalogState status={result.status} />;
  const region = result.catalog.regions.find((entry) => entry.slug === slug);
  if (!region) notFound();
  const organizations = getRegionOrganizations(result.catalog, region.id, DEFAULT_SEASON_YEAR);

  return (
    <Container>
      <LocalCatalogNotice source={result.source} />
      <div className="pt-6 sm:pt-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/#regioes"><ArrowLeft aria-hidden="true" />Voltar às regiões</Link>
        </Button>
      </div>
      <header className="flex flex-col gap-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:py-10">
        <div>
          <p className="mb-4 font-mono text-xs tracking-[0.16em] text-primary uppercase">VCT / Temporada {DEFAULT_SEASON_YEAR}</p>
          <h1 className="text-5xl font-bold tracking-[-0.04em] sm:text-6xl">{region.name}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Encontre as organizações da temporada e acompanhe seus próximos capítulos.</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground"><span className="font-mono text-xl font-semibold text-foreground">{organizations.length}</span> {organizations.length === 1 ? "equipe na região" : "equipes na região"}</p>
      </header>
      <nav aria-label="Regiões do VCT" className="mb-8 flex flex-wrap gap-x-2 border-b border-border sm:gap-x-6">
        {result.catalog.regions.map((entry) => (
          <Link
            key={entry.id}
            href={`/${entry.slug}`}
            aria-current={entry.id === region.id ? "page" : undefined}
            className={cn("inline-flex min-h-12 items-center border-b-2 border-transparent px-2 text-sm font-medium transition-colors hover:text-foreground", entry.id === region.id ? "border-primary text-foreground" : "text-muted-foreground")}
          >{entry.name}</Link>
        ))}
      </nav>
      <OrganizationDirectory key={region.id} organizations={organizations} />
    </Container>
  );
}
