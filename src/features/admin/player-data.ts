import type { createAdminAuthClient } from "./auth-model";
import { mutationError, type EditorStatus } from "./organization-model.ts";
import { playerSchema, playerPayload, type PlayerRow, type PlayerAlias } from "./player-model.ts";

export const playerColumns = "id,nickname,name,slug,nationality,role,photo_url,links,publication_status,updated_at" as const;
type Client = ReturnType<typeof createAdminAuthClient>;
export async function readAdminPlayers(client: Client) {
  const rows: PlayerRow[] = [];
  const signal = AbortSignal.timeout(15_000);
  for (;;) {
    const { data, error, count } = await client.from("players").select(playerColumns, { count: "exact" }).order("id")
      .range(rows.length, rows.length + 499).abortSignal(signal);
    if (error || !data || count === null || (!data.length && rows.length < count)) throw new Error("Jogadores indisponíveis.");
    rows.push(...data);
    if (rows.length >= count) return rows;
  }
}
export async function readPlayerAliases(client: Client, id: string) {
  const rows: PlayerAlias[] = [];
  const signal = AbortSignal.timeout(15_000);
  for (;;) {
    const { data, error, count } = await client.from("player_slug_history").select("id,player_id,slug,was_published,retired_at", { count: "exact" })
      .eq("player_id", id).order("id").range(rows.length, rows.length + 499).abortSignal(signal);
    if (error || !data || count === null || (!data.length && rows.length < count)) throw new Error("Histórico indisponível.");
    rows.push(...data);
    if (rows.length >= count) return rows;
  }
}
export async function savePlayerRecord(client: Client, input: unknown): Promise<{ status: EditorStatus; id?: string }> {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const { data, error } = await client.rpc("admin_save_player", { payload: playerPayload(parsed.data) });
    if (error) return { status: mutationError(error.code) };
    return data === parsed.data.id ? { status: "saved", id: data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
}
