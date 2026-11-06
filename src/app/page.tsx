import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { RegionCard } from "@/features/home/region-card";
import { RecentChanges } from "@/features/home/recent-changes";
import { DEFAULT_SEASON_YEAR } from "@/features/organizations/data/vct-2027";
import { getRegionSummaries } from "@/features/organizations/region-summaries";
import { getPublicCatalog } from "@/features/organizations/public-catalog";
import { CatalogState, LocalCatalogNotice } from "@/features/organizations/catalog-state";

export default async function HomePage() {
  const result = await getPublicCatalog();
  if (result.status !== "ready") return <CatalogState status={result.status} />;
  const regions = getRegionSummaries(result.catalog, DEFAULT_SEASON_YEAR);
  const partnerCount = regions.reduce((total, region) => total + region.partnerCount, 0);

  return (
    <Container>
      <LocalCatalogNotice source={result.source} />
      <section aria-labelledby="home-titulo" className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:gap-16 lg:py-20">
        <div>
          <p className="mb-7 flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-primary" />
            <span className="text-muted-foreground">Temporada <span className="text-foreground">{DEFAULT_SEASON_YEAR}</span></span>
          </p>
          <h1 id="home-titulo" className="text-5xl leading-[0.98] font-bold tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            VCT Roster<br /><span className="text-primary">Tracker.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            O cenário competitivo, região por região.
            Equipes, elencos e os próximos capítulos do VALORANT.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button asChild>
              <a href="#regioes">Explorar regiões <ArrowDown aria-hidden="true" /></a>
            </Button>
            <p className="text-xs leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">{partnerCount}</span> equipes parceiras
              <span aria-hidden="true" className="mx-2">/</span>
              <span className="sr-only"> em </span>
              <span className="font-semibold text-foreground">{regions.length}</span> regiões
            </p>
          </div>
        </div>
        <div aria-hidden="true" className="relative hidden min-h-80 items-center justify-center border-y border-border lg:flex">
          <svg viewBox="0 0 320 320" className="absolute size-72 text-border" fill="none">
            <circle cx="160" cy="160" r="132" stroke="currentColor" />
            <ellipse cx="160" cy="160" rx="72" ry="132" stroke="currentColor" />
            <ellipse cx="160" cy="160" rx="132" ry="48" stroke="currentColor" />
            <path d="M28 160h264M160 28v264" stroke="currentColor" />
            <circle cx="160" cy="28" r="4" fill="var(--primary)" />
            <circle cx="292" cy="160" r="4" fill="var(--primary)" />
          </svg>
          <span className="relative bg-background px-4 text-7xl font-bold tracking-[-0.06em]">{DEFAULT_SEASON_YEAR}</span>
          <span className="absolute right-0 bottom-4 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Uma nova temporada</span>
        </div>
      </section>

      <section id="regioes" aria-labelledby="regioes-titulo" className="scroll-mt-8 pb-12 sm:pb-16">
        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="regioes-titulo" className="text-2xl font-semibold tracking-tight sm:text-3xl">Escolha sua região</h2>
          <p className="text-sm text-muted-foreground">Um cenário global. Cada região, sua história.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {regions.map((region, index) => <RegionCard key={region.id} region={region} index={index} />)}
        </div>
      </section>
      <RecentChanges />
    </Container>
  );
}
