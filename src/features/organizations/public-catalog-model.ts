import { z } from "zod";
import type { VctCatalog } from "../../types/vct";
import { validateCatalog } from "./validate-catalog.ts";

const publicRow = { id: z.uuid(), publication_status: z.literal("published") };
const name = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const regionSlug = z.enum(["americas", "emea", "china", "pacific"]);
const asset = z.string().refine((value) => /^\/(?!\/)/.test(value) || /^https?:\/\//.test(value));
const rowsSchema = z.object({
  regions: z.array(z.object({ ...publicRow, slug: regionSlug, name })),
  seasons: z.array(z.object({ ...publicRow, year: z.number().int().min(2000).max(9999), name })),
  organizations: z.array(z.object({ ...publicRow, slug, name, short_name: name.nullable(), logo_url: asset.nullable() })),
  team_seasons: z.array(z.object({ ...publicRow, organization_id: z.uuid(), season_id: z.uuid(), region_id: z.uuid(), partner_status: z.enum(["partner", "qualifier", "visitor"]) })),
});

/** Validate untrusted API data, then map database region UUIDs to existing domain slugs. */
export function mapPublicCatalog(input: unknown): VctCatalog {
  const rows = rowsSchema.parse(input);
  const regionsById = new Map(rows.regions.map((region) => [region.id, region.slug]));
  if (regionsById.size !== rows.regions.length) throw new Error("Região duplicada.");
  const catalog: VctCatalog = {
    regions: rows.regions.map((region) => ({ id: region.slug, slug: region.slug, name: region.name })),
    seasons: rows.seasons.map(({ id, year, name }) => ({ id, year, name })),
    organizations: rows.organizations.map(({ id, slug, name, short_name, logo_url }) => ({
      id, slug, name, ...(short_name ? { shortName: short_name } : {}), ...(logo_url ? { logoUrl: logo_url } : {}),
    })),
    teamSeasons: rows.team_seasons.map((row) => {
      const regionId = regionsById.get(row.region_id);
      if (!regionId) throw new Error("Participação sem região publicada.");
      return { organizationId: row.organization_id, seasonId: row.season_id, regionId, partnerStatus: row.partner_status };
    }),
  };
  if (validateCatalog(catalog).length) throw new Error("Catálogo público inconsistente.");
  const regionOrder = ["americas", "emea", "china", "pacific"];
  return { ...catalog, regions: [...catalog.regions].sort((a, b) => regionOrder.indexOf(a.id) - regionOrder.indexOf(b.id)) };
}

export type PublicCatalogResult =
  | { status: "ready"; source: "local" | "supabase"; catalog: VctCatalog }
  | { status: "empty" | "unavailable"; source: "supabase" };

/** Remote errors/empty results never silently switch back to the seed. */
export async function loadPublicCatalog(options: {
  configured: boolean;
  readRemote: () => Promise<unknown>;
  localCatalog: VctCatalog;
  year: number;
}): Promise<PublicCatalogResult> {
  if (!options.configured) return { status: "ready", source: "local", catalog: options.localCatalog };
  try {
    const catalog = mapPublicCatalog(await options.readRemote());
    if (!catalog.seasons.some(({ year }) => year === options.year)) return { status: "empty", source: "supabase" };
    return { status: "ready", source: "supabase", catalog };
  } catch {
    return { status: "unavailable", source: "supabase" };
  }
}
