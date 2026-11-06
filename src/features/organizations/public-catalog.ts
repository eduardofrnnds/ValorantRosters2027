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
    return await loadPublicCatalog({
      configured: client !== null, localCatalog: vct2027, year: DEFAULT_SEASON_YEAR,
      readRemote: () => readPublicCatalogRows(client!),
    });
  } catch {
    return { status: "unavailable", source: "supabase" };
  }
});
