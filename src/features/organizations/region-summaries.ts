import type { Region, VctCatalog } from "@/types/vct";

export interface RegionSummary extends Region {
  readonly partnerCount: number;
}

/** Counts only partner organizations in the requested season, never all participants. */
export function getRegionSummaries(catalog: VctCatalog, year: number): RegionSummary[] {
  const season = catalog.seasons.find((entry) => entry.year === year);
  if (!season) throw new Error(`Temporada não cadastrada: ${year}`);

  return catalog.regions.map((region) => ({
    ...region,
    partnerCount: new Set(catalog.teamSeasons
      .filter((entry) => entry.seasonId === season.id && entry.regionId === region.id && entry.partnerStatus === "partner")
      .map((entry) => entry.organizationId)).size,
  }));
}
