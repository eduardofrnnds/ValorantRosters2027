/** Read projection maintained against migrations. Full generated types belong to integration tooling. */
import type { PlayerRow, PlayerAlias } from "../../features/admin/player-model";
import type { TimelineFilters, TimelineData } from "../../features/transfers/timeline-model";
type PublishedRow = { id: string; publication_status: "draft" | "published" };
type ReadTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };

export type PublicDatabase = {
  public: {
    Tables: {
      regions: ReadTable<PublishedRow & { slug: string; name: string }>;
      seasons: ReadTable<PublishedRow & { year: number; name: string }>;
      organizations: ReadTable<PublishedRow & { slug: string; name: string; short_name: string | null; logo_url: string | null }>;
      team_seasons: ReadTable<PublishedRow & { organization_id: string; season_id: string; region_id: string; partner_status: "partner" | "qualifier" | "visitor" }>;
      players: ReadTable<PlayerRow>;
      player_slug_history: ReadTable<PlayerAlias>;
      roster_memberships: ReadTable<PublishedRow & { player_id: string; team_season_id: string; status: "starter" | "reserve" | "inactive" | "coach"; role: PlayerRow["role"]; role_is_explicit: boolean; start_date: string; end_date: string | null }>;
    };
    Views: Record<string, never>;
    Functions: { read_roster_timeline: { Args: { filters: TimelineFilters }; Returns: TimelineData } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
