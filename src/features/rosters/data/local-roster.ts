import type { RosterEntry } from "../roster-model";
import { vlrSnapshot } from "./vlr-snapshot.ts";
import { vct2027, DEFAULT_SEASON_YEAR } from "../../organizations/data/vct-2027.ts";

const seasonId = vct2027.seasons.find((season) => season.year === DEFAULT_SEASON_YEAR)!.id;
// Current rosters observed on VLR, shown in the 2027 partner directory.
// This is not a declaration that the 2027 lineups are finalized.
export const localRosterEntries: readonly RosterEntry[] = vlrSnapshot.teams.flatMap((team) => team.members.map((member): RosterEntry => ({
  organizationId: team.organizationId, seasonId, status: member.status, publicationStatus: "published",
  player: { id: member.id, slug: member.slug, nickname: member.nickname, photoUrl: member.photoUrl, role: member.status === "coach" ? "coach" : undefined },
})));
