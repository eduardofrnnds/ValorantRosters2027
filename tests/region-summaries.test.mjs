import assert from "node:assert/strict";
import { test } from "node:test";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { getRegionSummaries } from "../src/features/organizations/region-summaries.ts";

test("home resume as quatro regiões com os totais do catálogo", () => {
  const summaries = getRegionSummaries(vct2027, 2027);
  assert.deepEqual(summaries.map(({ slug, partnerCount }) => [slug, partnerCount]), [
    ["americas", 8], ["emea", 8], ["china", 8], ["pacific", 8],
  ]);
});

test("contagens acompanham o catálogo e excluem qualifiers, visitors e outras temporadas", () => {
  const catalog = structuredClone(vct2027);
  const americas = catalog.teamSeasons.filter(({ regionId }) => regionId === "americas");
  americas[0].partnerStatus = "qualifier";
  americas[1].partnerStatus = "visitor";
  catalog.seasons.push({ id: "test-2028", name: "Teste", year: 2028 });
  catalog.teamSeasons.push({ ...americas[0], partnerStatus: "partner", seasonId: "test-2028" });
  assert.equal(getRegionSummaries(catalog, 2027).find(({ id }) => id === "americas").partnerCount, 6);
  assert.equal(getRegionSummaries(catalog, 2028).find(({ id }) => id === "americas").partnerCount, 1);
});

test("a contagem não limita parceiras a oito nem infla organizações duplicadas", () => {
  const catalog = structuredClone(vct2027);
  catalog.teamSeasons.find(({ regionId }) => regionId === "emea").regionId = "americas";
  catalog.teamSeasons.push({ ...catalog.teamSeasons[0] });
  assert.equal(getRegionSummaries(catalog, 2027).find(({ id }) => id === "americas").partnerCount, 9);
});

test("região sem parceiras retorna zero e temporada ausente é sinalizada", () => {
  const catalog = { ...vct2027, teamSeasons: [] };
  assert.ok(getRegionSummaries(catalog, 2027).every(({ partnerCount }) => partnerCount === 0));
  assert.throws(() => getRegionSummaries(catalog, 2099), /Temporada não cadastrada/);
});
