import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { DEFAULT_SEASON_YEAR } from "@/features/organizations/data/vct-2027";
import { getPublicCatalog } from "@/features/organizations/public-catalog";
import { CatalogState, LocalCatalogNotice } from "@/features/organizations/catalog-state";
import { LogoPlaceholder } from "@/components/logo-placeholder";
import { getTeamProfile } from "@/features/organizations/team-profile-model";
import { partnerStatusLabels } from "@/features/organizations/directory-model";
import { getPublishedRosterGroups, rosterSections } from "@/features/rosters/roster-model";
import { getPublishedTeamRoster } from "@/features/rosters/public-roster-server";
import { RosterSection } from "@/features/rosters/roster-section";
import { TeamHistory } from "@/features/organizations/team-history";
import OrganizationNotFound from "./not-found";

type TeamPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicCatalog();
  if (result.status !== "ready") return { title: "Catálogo | VCT Roster Tracker", robots: { index: false } };
  const organization = result.catalog.organizations.find((entry) => entry.slug === slug);
  if (!organization) return { title: "Organização não encontrada | VCT Roster Tracker", robots: { index: false } };
  return {
    title: `${organization.name} | VCT Roster Tracker`,
    description: `Perfil de ${organization.name} na temporada ${DEFAULT_SEASON_YEAR}: equipe, elenco publicado e histórico no VCT Roster Tracker.`,
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { slug } = await params;
  const result = await getPublicCatalog();
  if (result.status !== "ready") return <CatalogState status={result.status} />;
  const profile = getTeamProfile(result.catalog, slug, DEFAULT_SEASON_YEAR);
  if (!profile) return <OrganizationNotFound />;
  const { organization, season, participation, region } = profile;
  const roster = await getPublishedTeamRoster(organization.id, season.id);
  const groups = roster.status === "ready" ? getPublishedRosterGroups(roster.entries, organization.id, season.id) : [];

  return (
    <Container className="pb-14 sm:pb-20">
      <LocalCatalogNotice source={result.source} />
      <div className="pt-6 sm:pt-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={region ? `/${region.slug}` : "/#regioes"}><ArrowLeft aria-hidden="true" />{region ? `Voltar para ${region.name}` : "Voltar às regiões"}</Link>
        </Button>
      </div>
      <header className="py-8 sm:py-10">
        <p className="mb-6 font-mono text-xs tracking-[0.16em] text-primary uppercase">VCT / Temporada {season.year}</p>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
          <LogoPlaceholder name={organization.name} src={organization.logoUrl} size="lg" className="sm:size-24" />
          <div className="min-w-0">
            <h1 className="text-4xl leading-tight font-bold tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">{organization.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
              {region ? (
                <Link href={`/${region.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-sm hover:text-foreground"><MapPin aria-hidden="true" className="size-4" />{region.name}</Link>
              ) : <span>Região não informada nesta temporada</span>}
              {participation && <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs">{partnerStatusLabels[participation.partnerStatus]}</span>}
            </div>
          </div>
        </div>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-muted-foreground">Elenco e trajetória da organização. Aqui você encontra apenas informações publicadas neste site.</p>
      </header>

      <nav aria-label="Seções da organização" className="mb-8 flex flex-wrap gap-x-2 border-y border-border py-2 sm:gap-x-5">
        {rosterSections.map(({ id, title }) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-muted-foreground hover:text-foreground">{title}</a>)}
        <a href="#historico" className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-muted-foreground hover:text-foreground">Histórico</a>
      </nav>
      {roster.status === "unavailable" ? <p role="alert" className="rounded-lg border border-border bg-card p-6 text-sm">Elenco indisponível. Não foi possível consultar os vínculos publicados; tente novamente em instantes.</p> : <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {groups.map((group) => <RosterSection key={group.id} group={group} />)}
      </div>}
      <TeamHistory organizationId={organization.id} slug={organization.slug} />
    </Container>
  );
}
