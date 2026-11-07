import type { Player, PlayerMembership } from "../../../types/player";
import { vlrSnapshot } from "../../rosters/data/vlr-snapshot.ts";

// Public VLR identities; stable source IDs survive nickname changes.
export const localPlayers: readonly Player[] = vlrSnapshot.teams.flatMap((team) => team.members.map((member): Player => ({
  id: member.id, slug: member.slug, nickname: member.nickname, name: member.name,
  nationality: member.nationality, photoUrl: member.photoUrl,
  role: member.status === "coach" ? "coach" : undefined,
  links: [{ label: "VLR.gg", url: member.sourceUrl }],
  publicationStatus: "published",
  rosterObservation: { organizationId: team.organizationId, status: member.status, checkedAt: vlrSnapshot.checkedAt, sourceUrl: team.sourceUrl },
})));
// The source snapshot supplies no contract dates or transfer history.
export const localPlayerMemberships: readonly PlayerMembership[] = [];
