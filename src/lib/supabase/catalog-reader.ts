import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicDatabase } from "./database.types";

type Table = "regions" | "seasons" | "organizations" | "team_seasons";
const columns: Record<Table, string> = {
  regions: "id,slug,name,publication_status",
  seasons: "id,year,name,publication_status",
  organizations: "id,slug,name,short_name,logo_url,publication_status",
  team_seasons: "id,organization_id,season_id,region_id,partner_status,publication_status",
};

/** Small anonymous lookup used only to set the team route's HTTP status. */
export async function hasPublicOrganization(client: SupabaseClient<PublicDatabase>, slug: string) {
  const { data, error } = await client.from("organizations").select("id")
    .eq("slug", slug).eq("publication_status", "published").limit(1)
    .abortSignal(AbortSignal.timeout(15_000));
  if (error || !data) throw new Error("Leitura pública indisponível.");
  return data.length > 0;
}

export async function readPublicCatalogRows(client: SupabaseClient<PublicDatabase>) {
  const signal = AbortSignal.timeout(15_000);
  async function readTable(table: Table) {
    const rows: unknown[] = [];
    for (;;) {
      const { data, error, count } = await client.from(table).select(columns[table], { count: "exact" })
        .eq("publication_status", "published").order("id").range(rows.length, rows.length + 499).abortSignal(signal);
      if (error || !data || count === null) throw new Error("Leitura pública indisponível.");
      if (data.length === 0 && rows.length < count) throw new Error("Leitura pública incompleta.");
      rows.push(...data);
      if (rows.length >= count) return rows;
    }
  }
  const [regions, seasons, organizations, team_seasons] = await Promise.all([
    readTable("regions"), readTable("seasons"), readTable("organizations"), readTable("team_seasons"),
  ]);
  return { regions, seasons, organizations, team_seasons };
}
