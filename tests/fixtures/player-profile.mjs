import { vct2027 } from "../../src/features/organizations/data/vct-2027.ts";

// Synthetic identities for isolated tests only. Never imported by src/.
export const testDate = "2027-06-15";
export const testPlayer = {
  id: "test-player-stable-id", slug: "perfil-isolado-de-teste", nickname: "Perfil de teste",
  name: "Identidade sintética para teste", nationality: "Brasil", role: "controller", publicationStatus: "published",
};
export const testMembership = {
  id: "test-membership-current", playerId: testPlayer.id,
  organizationId: vct2027.organizations[0].id, seasonId: vct2027.seasons[0].id,
  status: "starter", startDate: "2027-04-01", publicationStatus: "published",
};
export const testPastMembership = {
  ...testMembership, id: "test-membership-past", organizationId: vct2027.organizations[1].id,
  status: "reserve", startDate: "2027-01-01", endDate: "2027-03-31",
};
