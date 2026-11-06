import { playerRoles } from "../admin/player-model.ts";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicDatabase } from "../../lib/supabase/database.types";
import type { RosterEntry } from "./roster-model";

export async function readPublishedTeamRoster(client: SupabaseClient<PublicDatabase>, organizationId: string, seasonId: string, date: string): Promise<RosterEntry[]> {
  const signal = AbortSignal.timeout(15_000);
  const team = await client.from("team_seasons").select("id").eq("organization_id", organizationId).eq("season_id", seasonId).eq("publication_status", "published").limit(1).abortSignal(signal);
  if (team.error || !team.data) throw new Error("Elenco indisponível.");
  if (!team.data.length) return [];
  const rows: unknown[] = [];
  for (;;) {
    const { data, error, count } = await client.from("roster_memberships")
      .select("id,player_id,status,role,role_is_explicit,start_date,end_date,publication_status", { count: "exact" })
      .eq("team_season_id", team.data[0].id).eq("publication_status", "published").order("id").range(rows.length, rows.length + 499).abortSignal(signal);
    if (error || !data || count === null || (!data.length && rows.length < count)) throw new Error("Elenco indisponível.");
    rows.push(...data);
    if (rows.length >= count) break;
  }
  const memberships = z.array(z.object({ role: z.enum(playerRoles).nullable().optional(), role_is_explicit: z.boolean().optional(), player_id: z.uuid(), status: z.enum(["starter", "reserve", "inactive", "coach"]), publication_status: z.literal("published"), start_date: z.iso.date(), end_date: z.iso.date().nullable() })).parse(rows)
    .filter((entry) => entry.start_date <= date && (!entry.end_date || entry.end_date >= date));
  if (!memberships.length) return [];
  if (new Set(memberships.map((entry) => entry.player_id)).size !== memberships.length) throw new Error("Vínculos ativos duplicados.");
  const players: unknown[] = [];
  for (;;) {
    const { data, error, count } = await client.from("players").select("id,nickname,slug,role,publication_status", { count: "exact" })
      .in("id", memberships.map((entry) => entry.player_id)).eq("publication_status", "published").order("id").range(players.length, players.length + 499).abortSignal(signal);
    if (error || !data || count === null || (!data.length && players.length < count)) throw new Error("Jogadores indisponíveis.");
    players.push(...data);
    if (players.length >= count) break;
  }
  const profiles = z.array(z.object({ role: z.enum(playerRoles).nullable().optional(), id: z.uuid(), nickname: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), publication_status: z.literal("published") })).parse(players);
  return memberships.map((entry) => {
    const player = profiles.find((profile) => profile.id === entry.player_id);
    if (!player) throw new Error("Perfil publicado indisponível.");
    return { organizationId, seasonId, status: entry.status, publicationStatus: "published", player: { id: player.id, nickname: player.nickname, slug: player.slug, role: (entry.role_is_explicit ? entry.role : player.role) ?? undefined } };
  });
}
