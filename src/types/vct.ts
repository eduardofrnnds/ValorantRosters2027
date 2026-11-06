export type RegionId = "americas" | "emea" | "china" | "pacific";

export interface Region {
  readonly id: RegionId;
  readonly slug: RegionId;
  readonly name: string;
}

export interface Season {
  readonly id: string;
  readonly year: number;
  readonly name: string;
}

/** Category of an organization's participation in a particular season. */
export type PartnerStatus = "partner" | "qualifier" | "visitor";

/** Stable identity: region and partnership belong to TeamSeason, not here. */
export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly shortName?: string;
  readonly logoUrl?: string;
}

export interface TeamSeason {
  readonly organizationId: Organization["id"];
  readonly seasonId: Season["id"];
  readonly regionId: RegionId;
  readonly partnerStatus: PartnerStatus;
}

export interface VctCatalog {
  readonly regions: readonly Region[];
  readonly seasons: readonly Season[];
  readonly organizations: readonly Organization[];
  readonly teamSeasons: readonly TeamSeason[];
}
