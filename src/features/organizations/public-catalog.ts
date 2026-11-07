import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { DEFAULT_SEASON_YEAR, vct2027 } from "./data/vct-2027";
import { createServerPublicClient } from "@/lib/supabase/server";
import { readPublicCatalogRows } from "@/lib/supabase/catalog-reader";
import { loadPublicCatalog, type PublicCatalogResult } from "./public-catalog-model";

/** Request-scoped deduplication for page/metadata. No cross-request catalog cache. */
export const getPublicCatalog = cache(async (): Promise<PublicCatalogResult> => {
  // Resolve the source on every request, including local mode. A build made
  // without credentials must not permanently cache the local snapshot when the
  // server later receives configuration. No database reads happen during builds.
  await connection();
  try {
    const client = createServerPublicClient();
    const result = await loadPublicCatalog({
      configured: client !== null, localCatalog: vct2027, year: DEFAULT_SEASON_YEAR,
      readRemote: () => readPublicCatalogRows(client!),
    });
    if (result.status !== "ready") return result;
    const bundledLogos = new Map(vct2027.organizations.map(({ id, logoUrl }) => [id, logoUrl]));
    return {
      ...result,
      catalog: {
        ...result.catalog,
        organizations: result.catalog.organizations.map((organization) => ({
          ...organization,
          logoUrl: organization.logoUrl ?? bundledLogos.get(organization.id),
        })),
      },
    };
  } catch {
    return { status: "unavailable", source: "supabase" };
  }
});
