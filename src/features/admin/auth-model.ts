import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PublicSupabaseConfig } from "../../lib/supabase/config";
import type { OrganizationRow, SeasonRow, RegionRow, TeamSeasonRow, OrganizationInput, SeasonInput, TeamSeasonInput } from "./organization-model";
import type { PlayerRow, PlayerAlias, PlayerPayload } from "./player-model";
import type { MembershipRow, DraftRow, SaveDraftInput } from "./roster-draft-model";
import type { PublishDraftInput } from "./roster-publication-model";
import type { TransferInput } from "./transfer-model";

type ReadTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };
type CountRow = { id: string; publication_status: "draft" | "published" };

type AdminDatabase = {
  public: {
    Tables: {
      organizations: ReadTable<OrganizationRow>;
      seasons: ReadTable<SeasonRow>;
      regions: ReadTable<RegionRow>;
      team_seasons: ReadTable<TeamSeasonRow>;
      players: ReadTable<PlayerRow>;
      player_slug_history: ReadTable<PlayerAlias>;
      roster_memberships: ReadTable<MembershipRow>;
      roster_changes: ReadTable<CountRow & { change_type: "joined" | "left" | "transferred" | "status_changed" | "corrected" }>;
      roster_drafts: ReadTable<DraftRow>;
      admin_users: {
        Row: { user_id: string; is_active: boolean };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_transfer_player: { Args: { input: TransferInput }; Returns: { id: string; change_id: string; already_published: boolean } };
      admin_save_organization: { Args: { payload: OrganizationInput }; Returns: string };
      admin_save_team_season: { Args: { payload: TeamSeasonInput }; Returns: string };
      admin_save_season: { Args: { payload: SeasonInput }; Returns: string };
      admin_save_player: { Args: { payload: PlayerPayload }; Returns: string };
      admin_save_roster_draft: { Args: { input: SaveDraftInput }; Returns: string };
      admin_publish_roster_draft: { Args: { input: PublishDraftInput }; Returns: { id: string; team_season_id: string; already_published: boolean } };
      admin_archive_roster_draft: { Args: { draft_id: string; expected_updated_at: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const ADMIN_COOKIE = "vct-admin-access";
export const ADMIN_COOKIE_PATH = "/admin";
export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  // A login accepts the existing password, without trimming or inventing new rules.
  password: z.string().min(1).max(1024),
});

export type AdminAccess =
  | { status: "authorized"; userId: string }
  | { status: "anonymous" | "denied" | "unavailable" };

export function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.length <= 3500
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/** Per-request client. Only the public project key and user's bearer token are used. */
export function createAdminAuthClient(config: PublicSupabaseConfig, token?: string) {
  return createClient<AdminDatabase>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => fetch(input, {
        ...init, cache: "no-store",
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
      }),
    },
  });
}

/** Never trusts a decoded JWT, cookie user object, user_metadata or getSession(). */
export async function verifyAdminAccess(config: PublicSupabaseConfig, token: unknown): Promise<AdminAccess> {
  if (!isAccessToken(token)) return { status: "anonymous" };
  try {
    const client = createAdminAuthClient(config, token);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error) return { status: error.status === 401 || error.status === 403 ? "anonymous" : "unavailable" };
    if (!user || !z.uuid().safeParse(user.id).success || user.is_anonymous) return { status: "anonymous" };
    const { data, error: permissionError } = await client.from("admin_users")
      .select("user_id,is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (permissionError) return { status: "unavailable" };
    if (!data || data.user_id !== user.id || data.is_active !== true) return { status: "denied" };
    return { status: "authorized", userId: user.id };
  } catch {
    return { status: "unavailable" };
  }
}

export type LoginResult =
  | { status: "authorized"; token: string; maxAge: number }
  | { status: "invalid" | "denied" | "unavailable" };

export async function loginAdmin(config: PublicSupabaseConfig, input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const client = createAdminAuthClient(config);
  try {
    const { data, error } = await client.auth.signInWithPassword(parsed.data);
    if (error || !data.session) {
      return { status: error?.status && error.status >= 500 ? "unavailable" : "denied" };
    }
    const session = data.session;
    const maxAge = Math.min(3600, Math.floor((session.expires_at ?? 0) - Date.now() / 1000));
    const access = await verifyAdminAccess(config, session.access_token);
    if (access.status !== "authorized" || !isAccessToken(session.access_token) || !Number.isFinite(maxAge) || maxAge <= 0) {
      await client.auth.signOut({ scope: "local" });
      return { status: access.status === "unavailable" ? "unavailable" : "denied" };
    }
    // Never store or return refresh_token. This server-only session expires and
    // requires login again; there is no custom refresh protocol or localStorage.
    return { status: "authorized", token: session.access_token, maxAge };
  } catch {
    return { status: "unavailable" };
  }
}

export async function logoutAdmin(config: PublicSupabaseConfig, token: unknown) {
  if (!isAccessToken(token)) return true;
  try {
    // This SDK method calls /auth/v1/logout with the user's JWT, not service_role.
    const { error } = await createAdminAuthClient(config).auth.admin.signOut(token, "local");
    return !error || error.status === 401 || error.status === 403 || error.status === 404;
  } catch { return false; }
}

/** A mutation must invoke this fresh check itself; layout checks do not protect POSTs. */
export async function runAdminOperation<T>(
  config: PublicSupabaseConfig,
  token: unknown,
  operation: (context: { userId: string; client: ReturnType<typeof createAdminAuthClient> }) => Promise<T>,
): Promise<T> {
  const access = await verifyAdminAccess(config, token);
  if (access.status !== "authorized" || !isAccessToken(token)) throw new Error("Acesso administrativo negado.");
  return operation({ userId: access.userId, client: createAdminAuthClient(config, token) });
}
