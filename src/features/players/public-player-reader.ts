import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicDatabase } from "../../lib/supabase/database.types";
import { readPublicCatalogRows } from "../../lib/supabase/catalog-reader.ts";
import { mapPublicCatalog } from "../organizations/public-catalog-model.ts";
import { getPlayerProfile } from "./player-profile-model.ts";
import { externalLinkSchema, playerLinkLabels, playerRoles } from "../admin/player-model.ts";
import { logoUrlSchema } from "../admin/organization-model.ts";
import type { Player, PlayerMembership } from "../../types/player";

type Client = SupabaseClient<PublicDatabase>;
const columns = "id,nickname,name,slug,nationality,role,photo_url,links,publication_status,updated_at" as const;
const playerRow = z.object({
  id: z.uuid(), nickname: z.string().min(1).max(80), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().nullable(), nationality: z.string().nullable(), role: z.enum(playerRoles).nullable(),
  photo_url: logoUrlSchema.nullable(), publication_status: z.literal("published"),
  links: z.object({ website: externalLinkSchema.optional(), x: externalLinkSchema.optional(), twitch: externalLinkSchema.optional(), vlr: externalLinkSchema.optional() }).strict(),
});
const membershipRows = z.array(z.object({ id: z.uuid(), player_id: z.uuid(), team_season_id: z.uuid(), role: z.enum(playerRoles).nullable().optional(), role_is_explicit: z.boolean().optional(), status: z.enum(["starter", "reserve", "inactive", "coach"]), start_date: z.string(), end_date: z.string().nullable(), publication_status: z.literal("published") }));

/** Anonymous RLS protects both aliases and their current player. Private-only aliases stay 404. */
export async function resolvePublicPlayer(client: Client, slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return null;
  const signal = AbortSignal.timeout(15_000);
  const current = await client.from("players").select(columns).eq("slug", slug).eq("publication_status", "published").limit(1).abortSignal(signal);
  if (current.error || !current.data) throw new Error("Perfil indisponível.");
  if (current.data[0]) return playerRow.parse(current.data[0]);
  const history = await client.from("player_slug_history").select("player_id").eq("slug", slug).eq("was_published", true).limit(1).abortSignal(signal);
  if (history.error || !history.data) throw new Error("Histórico de URL indisponível.");
  if (!history.data[0]) return null;
  const playerId = z.uuid().parse(history.data[0].player_id);
  const result = await client.from("players").select(columns).eq("id", playerId).eq("publication_status", "published").limit(1).abortSignal(signal);
  if (result.error || !result.data) throw new Error("Perfil indisponível.");
  return result.data[0] ? playerRow.parse(result.data[0]) : null;
}

export async function readPublicPlayerProfile(client: Client, row: NonNullable<Awaited<ReturnType<typeof resolvePublicPlayer>>>) {
  const player: Player = {
    id: row.id, slug: row.slug, nickname: row.nickname, publicationStatus: "published",
    ...(row.name ? { name: row.name } : {}), ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    ...(row.nationality ? { nationality: row.nationality } : {}), ...(row.role ? { role: row.role } : {}),
    links: Object.entries(row.links).filter(([, url]) => url).map(([key, url]) => ({ label: playerLinkLabels[key as keyof typeof playerLinkLabels], url: url! })),
  };
  const rows: unknown[] = [];
  const signal = AbortSignal.timeout(15_000);
  for (;;) {
    const { data, error, count } = await client.from("roster_memberships")
      .select("id,player_id,team_season_id,status,role,role_is_explicit,start_date,end_date,publication_status", { count: "exact" })
      .eq("player_id", row.id).eq("publication_status", "published").order("id")
      .range(rows.length, rows.length + 499).abortSignal(signal);
    if (error || !data || count === null || (!data.length && rows.length < count)) throw new Error("Carreira indisponível.");
    rows.push(...data);
    if (rows.length >= count) break;
  }
  if (!rows.length) return getPlayerProfile([player], [], { regions: [], seasons: [], organizations: [], teamSeasons: [] }, row.slug, new Date().toISOString().slice(0, 10))!;
  const rawCatalog = await readPublicCatalogRows(client);
  const catalog = mapPublicCatalog(rawCatalog);
  const teams = z.array(z.object({ id: z.uuid(), organization_id: z.uuid(), season_id: z.uuid() })).parse(rawCatalog.team_seasons);
  const memberships: PlayerMembership[] = membershipRows.parse(rows).map((membership) => {
    const team = teams.find((entry) => entry.id === membership.team_season_id);
    if (!team || membership.player_id !== row.id) throw new Error("Referência de carreira indisponível.");
    return { id: membership.id, playerId: row.id, organizationId: team.organization_id, seasonId: team.season_id,
      role: (membership.role_is_explicit ? membership.role : row.role) ?? undefined, status: membership.status, startDate: membership.start_date, ...(membership.end_date ? { endDate: membership.end_date } : {}), publicationStatus: "published" };
  });
  return getPlayerProfile([player], memberships, catalog, row.slug, new Date().toISOString().slice(0, 10))!;
}
