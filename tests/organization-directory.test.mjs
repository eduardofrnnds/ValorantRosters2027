import assert from "node:assert/strict";
import { test } from "node:test";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { filterOrganizations, getRegionOrganizations, partnerStatusLabels } from "../src/features/organizations/directory-model.ts";

test("cada região lista exatamente suas oito organizações do catálogo", () => {
  for (const region of vct2027.regions) {
    const listings = getRegionOrganizations(vct2027, region.id, 2027);
    assert.equal(listings.length, 8);
    assert.ok(listings.every(({ partnerStatus }) => partnerStatus === "partner"));
    const expectedIds = vct2027.teamSeasons.filter(({ regionId }) => regionId === region.id).map(({ organizationId }) => organizationId).sort();
    assert.deepEqual(listings.map(({ id }) => id).sort(), expectedIds);
  }
});

test("busca ignora caixa, acentos e espaços externos e encontra nomes compostos", () => {
  const americas = getRegionOrganizations(vct2027, "americas", 2027);
  assert.deepEqual(filterOrganizations(americas, "  kRu  ").map(({ name }) => name), ["KRÜ Esports"]);
  assert.deepEqual(filterOrganizations(americas, "LEVIATAN").map(({ name }) => name), ["Leviatán"]);
  assert.deepEqual(filterOrganizations(americas, "thieves 100").map(({ name }) => name), ["100 Thieves"]);
  assert.equal(filterOrganizations(americas, "  \t ").length, 8);
});

test("busca usa sigla opcional e slug sem modificar a identidade", () => {
  const entries = getRegionOrganizations(vct2027, "pacific", 2027);
  const copy = entries.map((entry) => entry.slug === "rex-regum-qeon" ? { ...entry, shortName: "SIGLA-TESTE" } : entry);
  assert.equal(filterOrganizations(copy, "sigla-teste")[0].id, entries.find(({ slug }) => slug === "rex-regum-qeon").id);
  assert.deepEqual(filterOrganizations(entries, "gen-g").map(({ name }) => name), ["Gen.G"]);
});

test("ordenação A–Z/Z–A é alfabética e não altera o array de entrada", () => {
  const entries = getRegionOrganizations(vct2027, "americas", 2027).reverse();
  const original = structuredClone(entries);
  const expected = ["100 Thieves", "G2 Esports", "KRÜ Esports", "Leviatán", "LOUD", "MIBR", "NRG", "Sentinels"];
  assert.deepEqual(filterOrganizations(entries).map(({ name }) => name), expected);
  assert.deepEqual(filterOrganizations(entries, "", "desc").map(({ name }) => name), [...expected].reverse());
  assert.deepEqual(entries, original);
});

test("listagem inclui categorias extras e mais de oito equipes", () => {
  const catalog = structuredClone(vct2027);
  const [qualifier, visitor] = catalog.teamSeasons.filter(({ regionId }) => regionId === "emea");
  Object.assign(qualifier, { regionId: "americas", partnerStatus: "qualifier" });
  Object.assign(visitor, { regionId: "americas", partnerStatus: "visitor" });
  const entries = getRegionOrganizations(catalog, "americas", 2027);
  assert.equal(entries.length, 10);
  assert.equal(filterOrganizations(entries).length, 10);
  assert.deepEqual(new Set(entries.map(({ partnerStatus }) => partnerStatus)), new Set(["partner", "qualifier", "visitor"]));
  assert.deepEqual(partnerStatusLabels, { partner: "Parceira", qualifier: "Qualificatória", visitor: "Visitante" });
});

test("listagem respeita a temporada e não duplica identidades", () => {
  const catalog = structuredClone(vct2027);
  catalog.seasons.push({ id: "test-2028", name: "Teste", year: 2028 });
  catalog.teamSeasons.push({ ...catalog.teamSeasons[0], seasonId: "test-2028", partnerStatus: "visitor" });
  catalog.teamSeasons.push({ ...catalog.teamSeasons[0] });
  assert.equal(getRegionOrganizations(catalog, "americas", 2027).length, 8);
  const entries = getRegionOrganizations(catalog, "americas", 2028);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].partnerStatus, "visitor");
});

test("lista vazia e busca sem resultado não inventam equipes", () => {
  assert.deepEqual(getRegionOrganizations({ ...vct2027, teamSeasons: [] }, "china", 2027), []);
  assert.deepEqual(filterOrganizations([]), []);
  assert.deepEqual(filterOrganizations(getRegionOrganizations(vct2027, "china", 2027), "nenhuma-equipe-xyz"), []);
  assert.deepEqual(filterOrganizations(getRegionOrganizations(vct2027, "china", 2027), "LOUD"), []);
});

test("referências quebradas e temporada ausente geram erro explícito", () => {
  assert.throws(() => getRegionOrganizations(vct2027, "americas", 2099), /Temporada não cadastrada/);
  assert.throws(() => getRegionOrganizations({ ...vct2027, organizations: [] }, "americas", 2027), /Organização inexistente/);
});
