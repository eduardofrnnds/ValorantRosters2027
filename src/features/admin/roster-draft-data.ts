import { z } from "zod";
import type { createAdminAuthClient } from "./auth-model";
import { readOrganizationData } from "./organization-data.ts";
import { readAdminPlayers } from "./player-data.ts";
import { mutationError, type EditorStatus } from "./organization-model.ts";
import { saveDraftSchema, type DraftRow, type MembershipRow } from "./roster-draft-model.ts";
import { publishDraftSchema, publicationResultSchema } from "./roster-publication-model.ts";

type Client = ReturnType<typeof createAdminAuthClient>;
const columns = {
  roster_memberships: "id,player_id,team_season_id,status,role,role_is_explicit,start_date,end_date,publication_status,updated_at",
  roster_drafts: "id,team_season_id,created_by,status,base_revision,payload,updated_at,published_at,published_by,publication_source_url",
} as const;
export async function readRosterData(client: Client) {
  const signal = AbortSignal.timeout(15_000);
  async function read<K extends keyof typeof columns>(table: K) {
    const rows: unknown[] = [];
    for (;;) {
      const { data, error, count } = await client.from(table).select(columns[table], { count: "exact" }).order("id").range(rows.length, rows.length + 499).abortSignal(signal);
      if (error || !data || count === null || (!data.length && rows.length < count)) throw new Error("Elencos indisponíveis.");
      rows.push(...data);
      if (rows.length >= count) return rows;
    }
  }
  const [catalog, players, memberships, drafts] = await Promise.all([readOrganizationData(client), readAdminPlayers(client), read("roster_memberships"), read("roster_drafts")]);
  return { ...catalog, players, memberships: memberships as MembershipRow[], drafts: drafts as DraftRow[] };
}
export type RosterData = Awaited<ReturnType<typeof readRosterData>>;

export async function publishRosterDraft(client: Client, input: unknown): Promise<{ status: EditorStatus; publication?: z.infer<typeof publicationResultSchema> }> {
  const parsed = publishDraftSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const { data, error } = await client.rpc("admin_publish_roster_draft", { input: parsed.data });
    if (error) return { status: mutationError(error.code) };
    const result = publicationResultSchema.safeParse(data);
    return result.success && result.data.id === parsed.data.id ? { status: "saved", publication: result.data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}

export async function saveRosterDraft(client: Client, input: unknown): Promise<{ status: EditorStatus; id?: string }> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const { data, error } = await client.rpc("admin_save_roster_draft", { input: parsed.data });
    if (error) return { status: mutationError(error.code) };
    return data === parsed.data.id ? { status: "saved", id: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
export async function archiveRosterDraft(client: Client, input: unknown): Promise<{ status: EditorStatus; id?: string }> {
  const parsed = z.object({ id: z.uuid(), expected_updated_at: z.iso.datetime({ offset: true }) }).safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const { data, error } = await client.rpc("admin_archive_roster_draft", { draft_id: parsed.data.id, expected_updated_at: parsed.data.expected_updated_at });
    if (error) return { status: mutationError(error.code) };
    return data === parsed.data.id ? { status: "saved", id: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
