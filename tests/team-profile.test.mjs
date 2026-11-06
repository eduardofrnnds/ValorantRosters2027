import assert from "node:assert/strict";
import { test } from "node:test";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { getTeamProfile } from "../src/features/organizations/team-profile-model.ts";
import { getPublishedRosterGroups } from "../src/features/rosters/roster-model.ts";
import { localRosterEntries } from "../src/features/rosters/data/local-roster.ts";

test("as 32 organizações resolvem nome, região, temporada e categoria pelos IDs", () => {
  for (const organization of vct2027.organizations) {
    const profile = getTeamProfile(vct2027, organization.slug, 2027);
    assert.equal(profile.organization, organization);
    assert.equal(profile.season.year, 2027);
    assert.equal(profile.participation.organizationId, organization.id);
    assert.equal(profile.participation.seasonId, profile.season.id);
    assert.equal(profile.participation.partnerStatus, "partner");
    assert.equal(profile.region.id, profile.participation.regionId);
  }
});

test("organização desconhecida é distinguida de erros de configuração", () => {
  assert.equal(getTeamProfile(vct2027, "slug-inexistente", 2027), undefined);
  assert.throws(() => getTeamProfile(vct2027, "loud", 2099), /Temporada não cadastrada/);
  assert.throws(() => getTeamProfile({ ...vct2027, regions: [] }, "loud", 2027), /Região inexistente/);
});

test("participação ausente não inventa região ou categoria", () => {
  const profile = getTeamProfile({ ...vct2027, teamSeasons: [] }, "loud", 2027);
  assert.equal(profile.organization.name, "LOUD");
  assert.equal(profile.region, undefined);
  assert.equal(profile.participation, undefined);
});

test("o perfil mantém vínculos por ID após mudar o slug e respeita outra temporada", () => {
  const catalog = structuredClone(vct2027);
  const organization = catalog.organizations[0];
  organization.slug = "slug-alterado-no-teste";
  catalog.seasons.push({ id: "season-test-2028", year: 2028, name: "Teste" });
  catalog.teamSeasons.push({ organizationId: organization.id, seasonId: "season-test-2028", regionId: "china", partnerStatus: "visitor" });
  const current = getTeamProfile(catalog, organization.slug, 2027);
  const later = getTeamProfile(catalog, organization.slug, 2028);
  assert.equal(current.region.id, "americas");
  assert.equal(current.participation.partnerStatus, "partner");
  assert.equal(later.organization.id, current.organization.id);
  assert.equal(later.region.id, "china");
  assert.equal(later.participation.partnerStatus, "visitor");
});

test("o catálogo de elencos permanece vazio nas 32 organizações", () => {
  assert.deepEqual(localRosterEntries, []);
  for (const organization of vct2027.organizations) {
    const groups = getPublishedRosterGroups(localRosterEntries, organization.id, vct2027.seasons[0].id);
    assert.deepEqual(groups.map(({ title }) => title), ["Titulares", "Reservas", "Inativos", "Técnicos"]);
    assert.ok(groups.every(({ players }) => players.length === 0));
  }
});

test("grupos públicos excluem rascunhos, outras organizações e outras temporadas", () => {
  // Isolated test objects only: these never enter the application data source.
  const entry = (status, overrides = {}) => ({
    organizationId: "org-test", seasonId: "season-test", status, publicationStatus: "published",
    player: { id: `test-${status}`, slug: `test-${status}`, nickname: `Teste ${status}` }, ...overrides,
  });
  const entries = [
    entry("starter"), entry("reserve"), entry("inactive"), entry("coach"),
    entry("starter", { publicationStatus: "draft", player: { id: "private", slug: "private", nickname: "PRIVATE-DRAFT" } }),
    entry("reserve", { organizationId: "other-org" }),
    entry("coach", { seasonId: "other-season" }),
  ];
  const original = structuredClone(entries);
  const groups = getPublishedRosterGroups(entries, "org-test", "season-test");
  assert.deepEqual(groups.map(({ players }) => players.length), [1, 1, 1, 1]);
  assert.ok(!JSON.stringify(groups).includes("PRIVATE-DRAFT"));
  assert.deepEqual(groups.map(({ players }) => players[0].id), ["test-starter", "test-reserve", "test-inactive", "test-coach"]);
  assert.deepEqual(entries, original);
});

test("cartões são ordenados pelo nickname mantendo o ID independente", () => {
  const entries = ["Zulu", "Álfa"].map((nickname, index) => ({
    organizationId: "org-test", seasonId: "season-test", status: "starter", publicationStatus: "published",
    player: { id: `id-${index}`, slug: `slug-${index}`, nickname },
  }));
  const players = getPublishedRosterGroups(entries, "org-test", "season-test")[0].players;
  assert.deepEqual(players.map(({ nickname }) => nickname), ["Álfa", "Zulu"]);
  assert.deepEqual(players.map(({ id }) => id), ["id-1", "id-0"]);
});
