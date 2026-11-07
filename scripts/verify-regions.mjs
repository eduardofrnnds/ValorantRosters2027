import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { vct2027, DEFAULT_SEASON_YEAR } from "../src/features/organizations/data/vct-2027.ts";
import { localRosterEntries } from "../src/features/rosters/data/local-roster.ts";

const require = createRequire(import.meta.url);
const baseURL = process.env.UI_BASE_URL ?? "http://127.0.0.1:3010";
const artifacts = `${process.env.UI_ARTIFACT_ROOT ?? "artifacts/task-07"}/regions`;
const seasonId = vct2027.seasons.find(({ year }) => year === DEFAULT_SEASON_YEAR).id;
const browser = await chromium.launch({
  headless: true,
  ...((process.env.PLAYWRIGHT_CHANNEL || process.platform === "win32") ? { channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" } : {}),
});
const report = [];
await mkdir(artifacts, { recursive: true });

async function auditAccessibility(page) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  });
  assert.deepEqual(violations, []);
}

try {
  for (const width of [320, 390, 768, 1440]) {
    for (const region of vct2027.regions) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      const response = await page.goto(`${baseURL}/${region.slug}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      const members = vct2027.teamSeasons.filter((entry) => entry.seasonId === seasonId && entry.regionId === region.id);
      const expected = members.map(({ organizationId }) => vct2027.organizations.find(({ id }) => id === organizationId));
      expected.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }));
      assert.equal(await page.locator("h1").textContent(), region.name);
      assert.equal(await page.locator("main").count(), 1);
      assert.equal(await page.getByRole("navigation", { name: "Regiões do VCT" }).locator('[aria-current="page"]').textContent(), region.name);
      assert.deepEqual(await page.locator("#organization-results h3").allTextContents(), expected.map(({ name }) => name));
      assert.equal(await page.locator("#organization-results").getByText("Parceira", { exact: true }).count(), expected.length);
      assert.equal(await page.locator("#organization-results").getByRole("img", { name: /^Logo de / }).count(), expected.length);
      assert.equal(await page.locator("#organization-results article").count(), expected.length);
      for (const organization of expected) {
        const card = page.locator(`article[aria-labelledby="team-${organization.id}"]`);
        const roster = localRosterEntries.filter((entry) => entry.organizationId === organization.id);
        if (!roster.length) assert.ok(await card.getByText("Roster ainda não publicado para esta temporada.", { exact: true }).isVisible());
        for (const { player } of roster) assert.ok(await card.getByText(player.nickname, { exact: true }).isVisible());
      }
      assert.equal(await page.locator("#organization-results img").evaluateAll(async (images) => {
        await Promise.all(images.map((image) => { image.loading = "eager"; return image.decode(); }));
        return images.every((image) => image.naturalWidth > 0);
      }), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").textContent(), "Pular para o conteúdo");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(":focus").getAttribute("id"), "conteudo");
      const search = page.getByRole("searchbox", { name: "Buscar equipe" });
      await search.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "organization-search");
      assert.equal(await search.evaluate((el) => getComputedStyle(el).outlineStyle), "solid");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").getAttribute("id"), "organization-order");

      await page.getByRole("combobox", { name: "Ordenar" }).selectOption("desc");
      assert.deepEqual(await page.locator("#organization-results h3").allTextContents(), expected.map(({ name }) => name).reverse());
      await page.getByRole("combobox", { name: "Ordenar" }).selectOption("asc");

      const target = region.id === "americas" ? expected.find(({ slug }) => slug === "kru-esports") : expected[0];
      await search.fill(`  ${target.name.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()}  `);
      await page.waitForFunction(() => document.querySelectorAll("#organization-results > ul > li").length === 1);
      assert.deepEqual(await page.locator("#organization-results h3").allTextContents(), [target.name]);
      assert.match(await page.getByRole("status").textContent(), /^1 de 8 equipes encontradas$/);
      await search.fill("zzzz-sem-correspondencia");
      await page.getByRole("heading", { name: "Nenhuma equipe encontrada.", exact: true }).waitFor();
      assert.equal(await page.locator("#organization-results > ul > li").count(), 0);
      await auditAccessibility(page);
      if (region.id === "americas" && width === 390) await page.screenshot({ path: `${artifacts}/empty-390.png`, fullPage: true });
      await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
      assert.equal(await search.inputValue(), "");
      assert.equal(await page.locator(":focus").getAttribute("id"), "organization-search");
      assert.equal(await page.locator("#organization-results > ul > li").count(), expected.length);

      for (const control of await page.locator('input, select, main a').all()) {
        assert.ok((await control.boundingBox()).height >= 44, "Touch target below 44px");
      }
      await search.blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await auditAccessibility(page);
      if ([390, 1440].includes(width) || region.id === "americas") {
        await page.screenshot({ path: `${artifacts}/${region.slug}-${width}.png`, fullPage: true });
      }

      const firstCard = page.locator(`#organization-results a[href="/team/${expected[0].slug}"]`);
      await firstCard.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`**/team/${expected[0].slug}`);
      await page.getByRole("heading", { level: 1, name: expected[0].name, exact: true }).waitFor();
      await page.getByRole("link", { name: `Voltar para ${region.name}`, exact: true }).click();
      await page.waitForURL(`**/${region.slug}`);
      await page.getByRole("searchbox", { name: "Buscar equipe" }).waitFor();

      // Changing region resets both controls instead of carrying a stale search.
      await page.getByRole("searchbox", { name: "Buscar equipe" }).fill("zzzz");
      await page.getByRole("combobox", { name: "Ordenar" }).selectOption("desc");
      const nextRegion = vct2027.regions[(vct2027.regions.indexOf(region) + 1) % vct2027.regions.length];
      await page.getByRole("navigation", { name: "Regiões do VCT" }).getByRole("link", { name: nextRegion.name, exact: true }).click();
      await page.waitForURL(`**/${nextRegion.slug}`);
      await page.getByRole("heading", { level: 1, name: nextRegion.name, exact: true }).waitFor();
      assert.equal(await page.getByRole("searchbox", { name: "Buscar equipe" }).inputValue(), "");
      assert.equal(await page.getByRole("combobox", { name: "Ordenar" }).inputValue(), "asc");
      assert.deepEqual(errors, []);
      report.push({ width, region: region.id, organizations: expected.length, search: "passed", sort: "passed", clearAndEmpty: "passed", navigation: "passed", keyboard: "passed", axeViolations: 0, browserErrors: errors });
      await page.close();
    }
  }

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await touch.goto(`${baseURL}/americas`, { waitUntil: "networkidle" });
  await touch.getByRole("searchbox", { name: "Buscar equipe" }).fill("leviatan");
  await touch.getByRole("link", { name: "Ver Leviatán — Parceira", exact: true }).tap();
  await touch.waitForURL("**/team/leviatan");
  await touch.getByRole("link", { name: "Voltar para Americas" }).tap();
  await touch.waitForURL("**/americas");
  assert.equal(await touch.locator("#organization-results a").first().evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  await touch.close();

  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(`${baseURL}/pacific`);
  assert.equal(await noJS.locator("#organization-results > ul > li").count(), 8);
  assert.equal(await noJS.getByRole("searchbox", { name: "Buscar equipe" }).isVisible(), false);
  await noJS.locator('#organization-results a[href="/team/gen-g"]').click();
  await noJS.waitForURL("**/team/gen-g");
  assert.ok(await noJS.getByRole("heading", { level: 1, name: "Gen.G" }).isVisible());

  for (const organization of vct2027.organizations) {
    const response = await noJS.request.get(`${baseURL}/team/${organization.slug}`);
    assert.equal(response.status(), 200);
    assert.ok((await response.text()).includes(organization.name));
  }
  for (const path of ["/regiao-inexistente", "/team/equipe-inexistente"]) {
    assert.equal((await noJS.request.get(`${baseURL}${path}`)).status(), 404);
  }
  await noJS.close();

  await writeFile(`${artifacts}/results.json`, JSON.stringify({ browser: browser.version(), checks: report, touchReducedMotion: "passed", withoutJavaScript: "passed", teamDestinations: 32, notFound: "passed" }, null, 2) + "\n");
  console.log("Regiões aprovadas: quatro regiões em quatro larguras; busca, ordenação, estados vazios, teclado, axe, toque, 32 destinos de equipes e 404.");
} finally {
  await browser.close();
}
