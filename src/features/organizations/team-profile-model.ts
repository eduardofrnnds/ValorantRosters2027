import type { VctCatalog } from "@/types/vct";

export function getTeamProfile(catalog: VctCatalog, slug: string, year: number) {
  const organization = catalog.organizations.find((entry) => entry.slug === slug);
  if (!organization) return undefined;
  const season = catalog.seasons.find((entry) => entry.year === year);
  if (!season) throw new Error(`Temporada não cadastrada: ${year}`);
  const participation = catalog.teamSeasons.find((entry) => entry.organizationId === organization.id && entry.seasonId === season.id);
  const region = participation ? catalog.regions.find((entry) => entry.id === participation.regionId) : undefined;
  if (participation && !region) throw new Error(`Região inexistente: ${participation.regionId}`);

  return { organization, season, participation, region };
}
