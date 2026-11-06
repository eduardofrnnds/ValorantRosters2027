import type { Organization, PartnerStatus, RegionId, VctCatalog } from "@/types/vct";

export interface OrganizationListing extends Organization {
  readonly partnerStatus: PartnerStatus;
}

export type OrganizationOrder = "asc" | "desc";

export const partnerStatusLabels: Record<PartnerStatus, string> = {
  partner: "Parceira",
  qualifier: "Qualificatória",
  visitor: "Visitante",
};

/** Resolve all participants in this region/season; no category or quantity cap. */
export function getRegionOrganizations(catalog: VctCatalog, regionId: RegionId, year: number): OrganizationListing[] {
  const season = catalog.seasons.find((entry) => entry.year === year);
  if (!season) throw new Error(`Temporada não cadastrada: ${year}`);
  const organizations = new Map(catalog.organizations.map((entry) => [entry.id, entry]));
  const listings = new Map<string, OrganizationListing>();

  for (const entry of catalog.teamSeasons) {
    if (entry.regionId !== regionId || entry.seasonId !== season.id) continue;
    const organization = organizations.get(entry.organizationId);
    if (!organization) throw new Error(`Organização inexistente: ${entry.organizationId}`);
    listings.set(organization.id, { ...organization, partnerStatus: entry.partnerStatus });
  }

  return [...listings.values()];
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

const alphabetical = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function filterOrganizations(
  organizations: readonly OrganizationListing[],
  query = "",
  order: OrganizationOrder = "asc",
): OrganizationListing[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);

  return organizations.filter((organization) => {
    const searchable = normalizeSearch(`${organization.name} ${organization.shortName ?? ""} ${organization.slug}`);
    return terms.every((term) => searchable.includes(term));
  }).sort((first, second) => {
    const comparison = alphabetical.compare(first.name, second.name)
      || alphabetical.compare(first.slug, second.slug)
      || first.id.localeCompare(second.id);
    return order === "desc" ? -comparison : comparison;
  });
}
