import type { createAdminAuthClient } from "./auth-model";
import { mutationError, organizationSchema, seasonSchema, teamSeasonSchema, type EditorStatus, type OrganizationData } from "./organization-model.ts";

type Client = ReturnType<typeof createAdminAuthClient>;
const columns = {
  organizations: "id,name,slug,short_name,logo_url,publication_status,updated_at",
  seasons: "id,year,name,publication_status,updated_at",
  regions: "id,name,publication_status",
  team_seasons: "id,organization_id,season_id,region_id,partner_status,publication_status,archived_at,updated_at,roster_revision",
} as const;

export async function readOrganizationData(client: Client): Promise<OrganizationData> {
  const signal = AbortSignal.timeout(15_000);
  async function read<K extends keyof typeof columns>(table: K): Promise<OrganizationData[K]> {
    const rows: unknown[] = [];
    for (;;) {
      const { data, error, count } = await client.from(table).select(columns[table], { count: "exact" })
        .order("id").range(rows.length, rows.length + 499).abortSignal(signal);
      if (error || !data || count === null || (data.length === 0 && rows.length < count)) throw new Error("Cadastro indisponível.");
      rows.push(...data);
      if (rows.length >= count) return rows as OrganizationData[K];
    }
  }
  const [organizations, seasons, regions, team_seasons] = await Promise.all([
    read("organizations"), read("seasons"), read("regions"), read("team_seasons"),
  ]);
  return { organizations, seasons: seasons.sort((a, b) => b.year - a.year), regions, team_seasons };
}

export async function saveOrganizationRecord(client: Client, kind: string, input: unknown): Promise<{ status: EditorStatus; id?: string }> {
  const schema = kind === "organization" ? organizationSchema : kind === "participation" ? teamSeasonSchema : kind === "season" ? seasonSchema : null;
  if (!schema || !schema.safeParse(input).success) return { status: "invalid" };
  try {
    const result = kind === "organization"
      ? await client.rpc("admin_save_organization", { payload: organizationSchema.parse(input) })
      : kind === "participation"
        ? await client.rpc("admin_save_team_season", { payload: teamSeasonSchema.parse(input) })
        : await client.rpc("admin_save_season", { payload: seasonSchema.parse(input) });
    if (result.error) return { status: mutationError(result.error.code) };
    if (typeof result.data !== "string" || !/^[0-9a-f-]{36}$/i.test(result.data)) return { status: "unavailable" };
    return { status: "saved", id: result.data };
  } catch { return { status: "unavailable" }; }
}
