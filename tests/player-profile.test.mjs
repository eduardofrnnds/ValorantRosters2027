import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { localPlayers, localPlayerMemberships } from "../src/features/players/data/local-players.ts";
import { formatCareerDate, getPlayerProfile, getPublishedPlayer } from "../src/features/players/player-profile-model.ts";
import { testDate, testPlayer, testMembership, testPastMembership } from "./fixtures/player-profile.mjs";
import { loadComponent } from "./helpers/load-component.mjs";

const { PlayerProfile } = loadComponent(new URL("../src/features/players/player-profile.tsx", import.meta.url));
const query = (memberships = [], players = [testPlayer], slug = testPlayer.slug, date = testDate, catalog = vct2027) =>
  getPlayerProfile(players, memberships, catalog, slug, date);

test("cadastro VLR fornece perfis sem fabricar datas de contratos", () => {
  assert.ok(localPlayers.length > 0);
  assert.deepEqual(localPlayerMemberships, []);
  assert.equal(query([], localPlayers), undefined);
  assert.equal(query([], [testPlayer], "inexistente"), undefined);
  const player = localPlayers[0];
  const profile = query([], localPlayers, player.slug);
  assert.ok(profile.observedTeam);
  assert.ok(player.rosterObservation.sourceUrl.startsWith("https://www.vlr.gg/team/"));
  assert.deepEqual(profile.currentMemberships, []);
  assert.deepEqual(profile.pastMemberships, []);
});

test("rascunhos de jogador não são encontrados nem com vínculos publicados", () => {
  const draft = { ...testPlayer, publicationStatus: "draft" };
  assert.equal(getPublishedPlayer([draft], draft.slug), undefined);
  assert.equal(query([testMembership], [draft]), undefined);
});

test("perfil sem vínculos mantém estados vazios", () => {
  const profile = query();
  assert.equal(profile.player.id, testPlayer.id);
  assert.deepEqual(profile.currentMemberships, []);
  assert.deepEqual(profile.pastMemberships, []);
});

test("separa equipe atual e histórico por datas inclusivas e não infere vínculos futuros", () => {
  const current = { ...testMembership, startDate: testDate, endDate: testDate };
  const future = { ...testMembership, id: "future", startDate: "2027-06-16" };
  const profile = query([testPastMembership, future, current]);
  assert.deepEqual(profile.currentMemberships.map(({ id }) => id), [current.id]);
  assert.deepEqual(profile.pastMemberships.map(({ id }) => id), [testPastMembership.id]);
  assert.equal(query([current], [testPlayer], testPlayer.slug, "2027-06-16").pastMemberships.length, 1);
});

test("exclui rascunhos e vínculos de outras identidades antes de resolver referências", () => {
  const profile = query([
    testMembership,
    { ...testMembership, id: "PRIVATE-DRAFT", organizationId: "missing", publicationStatus: "draft" },
    { ...testMembership, id: "OTHER-PLAYER", organizationId: "missing", playerId: "other-id" },
  ]);
  assert.equal(profile.currentMemberships.length, 1);
  assert.ok(!JSON.stringify(profile).includes("PRIVATE-DRAFT"));
  assert.ok(!JSON.stringify(profile).includes("OTHER-PLAYER"));
});

test("renomear nickname e slug mantém carreira por ID; nickname igual não mistura jogadores", () => {
  const renamed = { ...testPlayer, nickname: "Outro apelido", slug: "outro-slug" };
  assert.equal(query([testMembership], [renamed], renamed.slug).currentMemberships.length, 1);
  assert.equal(query([testMembership], [renamed]), undefined);
  const another = { ...testPlayer, id: "different-id", slug: "different-slug" };
  assert.equal(query([testMembership], [testPlayer, another], another.slug).currentMemberships.length, 0);
});

test("carreira preserva passagens em temporadas anteriores, ordena sem mutação e permite retorno à equipe", () => {
  const previousSeason = { id: "previous-season", year: 2026, name: "VCT 2026" };
  const older = { ...testMembership, id: "older", seasonId: previousSeason.id, startDate: "2026-01-01", endDate: "2026-12-31" };
  const entries = [older, testMembership, testPastMembership];
  const snapshot = structuredClone(entries);
  const profile = query(entries, [testPlayer], testPlayer.slug, testDate, { ...vct2027, seasons: [...vct2027.seasons, previousSeason] });
  assert.deepEqual(profile.pastMemberships.map(({ id }) => id), [testPastMembership.id, older.id]);
  assert.equal(profile.pastMemberships[1].season.year, 2026);
  assert.equal(profile.currentMemberships[0].organization.id, profile.pastMemberships[1].organization.id);
  assert.deepEqual(entries, snapshot);
});

test("referências e datas inválidas falham explicitamente; datas são formatadas em UTC", () => {
  assert.throws(() => query([{ ...testMembership, organizationId: "missing" }]), /referência ausente/);
  assert.throws(() => query([{ ...testMembership, seasonId: "missing" }]), /referência ausente/);
  assert.throws(() => query([{ ...testMembership, startDate: "2027-02-30" }]), /Data de vínculo inválida/);
  assert.throws(() => query([{ ...testMembership, endDate: "2027-01-01" }]), /anterior ao início/);
  assert.throws(() => query([], [testPlayer], testPlayer.slug, "invalid"), /Data de vínculo inválida/);
  assert.equal(formatCareerDate("2027-01-01"), "01/01/2027");
});

test("componente real mostra campos ausentes, foto genérica e vazios sem declarar jogador sem equipe", () => {
  const minimal = { id: testPlayer.id, slug: testPlayer.slug, nickname: "<Teste isolado>", publicationStatus: "published" };
  const html = renderToStaticMarkup(createElement(PlayerProfile, { profile: query([], [minimal]) }));
  assert.ok(html.includes("&lt;Teste isolado&gt;</h1>"));
  assert.ok(html.includes("foto indisponível"));
  assert.equal((html.match(/Não informada/g) || []).length, 2);
  assert.ok(html.includes("Nenhum vínculo atual publicado."));
  assert.ok(html.includes("Nenhum histórico publicado."));
  assert.ok(!html.includes('href="/team/'));
  assert.ok(!html.includes("Sem equipe"));
});

test("componente real exibe identidade, foto, função, links e períodos publicados", () => {
  const player = { ...testPlayer, photoUrl: "/test-only-photo.png" };
  const profile = query([testMembership, testPastMembership], [player]);
  const html = renderToStaticMarkup(createElement(PlayerProfile, { profile }));
  for (const text of [player.name, "Brasil", "Controlador", "Titular", "Reserva", "01/04/2027", "31/03/2027", "até o presente"]) assert.ok(html.includes(text));
  assert.ok(html.includes(`alt="Foto de ${player.nickname}"`));
  for (const entry of [...profile.currentMemberships, ...profile.pastMemberships]) assert.ok(html.includes(`href="/team/${entry.organization.slug}"`));
  assert.ok(!html.includes("Nenhum histórico publicado."));
  assert.ok(!html.includes(player.id));
});
