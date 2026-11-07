import type { Organization, Season } from "./vct";
import type { RosterStatus } from "../features/rosters/roster-model";

export type PlayerRole = "duelist" | "initiator" | "controller" | "sentinel" | "flex" | "coach";

/** ID persists through changes to nickname and slug. Unknown facts stay absent. */
export interface Player {
  readonly id: string;
  readonly slug: string;
  readonly nickname: string;
  readonly name?: string;
  readonly photoUrl?: string;
  readonly nationality?: string;
  readonly role?: PlayerRole;
  readonly links?: readonly { readonly label: string; readonly url: string }[];
  readonly publicationStatus: "draft" | "published";
  /** A dated source observation, not a contract start or a career event. */
  readonly rosterObservation?: {
    readonly organizationId: string;
    readonly status: RosterStatus;
    readonly checkedAt: string;
    readonly sourceUrl: string;
  };
}

/** Local career view contract, not a database schema. Dates are ISO YYYY-MM-DD. */
export interface PlayerMembership {
  readonly id: string;
  readonly playerId: Player["id"];
  readonly organizationId: Organization["id"];
  readonly seasonId: Season["id"];
  readonly status: RosterStatus;
  readonly role?: PlayerRole;
  readonly startDate: string;
  /** Inclusive last day of affiliation; absent means no published end date. */
  readonly endDate?: string;
  readonly publicationStatus: "draft" | "published";
}
