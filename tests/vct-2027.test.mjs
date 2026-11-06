import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_SEASON_YEAR, vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { validateCatalog } from "../src/features/organizations/validate-catalog.ts";

test("o catálogo inicial tem referências, IDs e slugs válidos", () => {
  assert.deepEqual(validateCatalog(vct2027), []);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for (const entry of [...vct2027.organizations, ...vct2027.seasons]) {
    assert.match(entry.id, uuid);
  }
});

test("o seed contém quatro regiões, temporada 2027 e somente 32 parceiras", () => {
  assert.deepEqual(vct2027.regions.map(({ id }) => id).sort(), ["americas", "china", "emea", "pacific"]);
  assert.equal(DEFAULT_SEASON_YEAR, 2027);
  assert.equal(vct2027.seasons.length, 1);
  assert.equal(vct2027.seasons[0].year, 2027);
  assert.equal(vct2027.organizations.length, 32);
  assert.equal(vct2027.teamSeasons.length, 32);
  assert.equal(new Set(vct2027.teamSeasons.map(({ organizationId }) => organizationId)).size, 32);
  for (const participation of vct2027.teamSeasons) {
    assert.equal(participation.partnerStatus, "partner");
    assert.equal(participation.seasonId, vct2027.seasons[0].id);
  }
});

// Compare against the user's approved list, independently of the fixture itself.
const plan = readFileSync(new URL("../PLANO_VCT_ROSTER_TRACKER_2027.txt", import.meta.url), "utf8");
for (const regionId of ["americas", "emea", "china", "pacific"]) {
  test(`${regionId}: exatamente as oito organizações enumeradas no plano`, () => {
    const section = plan.match(new RegExp(`${regionId.toUpperCase()} \\(8\\):\\s*([\\s\\S]*?)\\.(?:\\r?\\n|$)`));
    assert.ok(section, `Lista ausente no plano: ${regionId}`);
    const expected = section[1].replace(/\r?\n/g, " ").split(";")
      .map((name) => name.trim().replace(/ \(RRQ\)$/, "")).sort();
    const memberships = vct2027.teamSeasons.filter((entry) => entry.regionId === regionId);
    assert.equal(memberships.length, 8);
    const actual = memberships.map(({ organizationId }) => vct2027.organizations.find(({ id }) => id === organizationId).name).sort();
    assert.deepEqual(actual, expected);
  });
}

test("rejeita ID e slug de organização duplicados", () => {
  const catalog = structuredClone(vct2027);
  catalog.organizations[1].id = catalog.organizations[0].id;
  catalog.organizations[1].slug = catalog.organizations[0].slug;
  const errors = validateCatalog(catalog);
  assert.ok(errors.some((error) => error.startsWith("Organização: ID duplicado")));
  assert.ok(errors.some((error) => error.startsWith("Organização: slug duplicado")));
});

test("rejeita slug inválido, nome vazio e ano inválido", () => {
  const catalog = structuredClone(vct2027);
  catalog.organizations[0].slug = "Nome Com Espaços";
  catalog.organizations[0].name = " ";
  catalog.seasons[0].year = 2027.5;
  const errors = validateCatalog(catalog);
  assert.ok(errors.some((error) => error.includes("slug inválido")));
  assert.ok(errors.some((error) => error.includes("nome vazio")));
  assert.ok(errors.some((error) => error.includes("Ano da temporada inválido")));
});

test("rejeita referências ausentes e categoria desconhecida", () => {
  const catalog = structuredClone(vct2027);
  Object.assign(catalog.teamSeasons[0], {
    organizationId: "missing-organization", seasonId: "missing-season",
    regionId: "missing-region", partnerStatus: "unknown",
  });
  const errors = validateCatalog(catalog);
  for (const message of ["Organização inexistente", "Temporada inexistente", "Região inexistente", "Categoria inválida"]) {
    assert.ok(errors.some((error) => error.startsWith(message)));
  }
});

test("rejeita a mesma organização duas vezes na mesma temporada, inclusive em regiões diferentes", () => {
  const catalog = structuredClone(vct2027);
  catalog.teamSeasons.push({ ...catalog.teamSeasons[0], regionId: "china" });
  assert.ok(validateCatalog(catalog).some((error) => error.startsWith("Participação duplicada")));
});

test("o modelo aceita mais de oito participações por região, qualifier e visitor", () => {
  // Hypothetical assignments only in this isolated test copy; never added to the seed.
  const catalog = structuredClone(vct2027);
  const [qualifier, visitor] = catalog.teamSeasons.filter((entry) => entry.regionId === "emea");
  Object.assign(qualifier, { regionId: "americas", partnerStatus: "qualifier" });
  Object.assign(visitor, { regionId: "americas", partnerStatus: "visitor" });
  assert.equal(catalog.teamSeasons.filter((entry) => entry.regionId === "americas").length, 10);
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(vct2027.teamSeasons.filter((entry) => entry.regionId === "americas").length, 8);
});

test("a mesma identidade suporta renomeação e categorias distintas por temporada", () => {
  const catalog = structuredClone(vct2027);
  const organizationId = catalog.organizations[0].id;
  catalog.organizations[0].slug = "slug-alterado-no-teste";
  catalog.seasons.push({ id: "test-season-2028", name: "Temporada de teste", year: 2028 });
  catalog.teamSeasons.push({ organizationId, seasonId: "test-season-2028", regionId: "americas", partnerStatus: "qualifier" });
  assert.deepEqual(validateCatalog(catalog), []);
  assert.deepEqual(catalog.teamSeasons.filter((entry) => entry.organizationId === organizationId).map(({ partnerStatus }) => partnerStatus), ["partner", "qualifier"]);
});
