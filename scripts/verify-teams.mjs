import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { DEFAULT_SEASON_YEAR, vct2027 } from "../src/features/organizations/data/vct-2027.ts";

const require = createRequire(import.meta.url);
const baseURL = process.env.UI_BASE_URL ?? "http://127.0.0.1:3010";
const artifacts = `${process.env.UI_ARTIFACT_ROOT ?? "artifacts/task-07"}/teams`;
const seasonId = vct2027.seasons.find(({ year }) => year === DEFAULT_SEASON_YEAR).id;
const sections = [
  ["titulares", "Titulares", "Nenhum titular publicado para esta temporada."],
  ["reservas", "Reservas", "Nenhum reserva publicado para esta temporada."],
  ["inativos", "Inativos", "Nenhum jogador inativo publicado para esta temporada."],
  ["tecnicos", "Técnicos", "Nenhum técnico publicado para esta temporada."],
  ["historico", "Histórico", "Nenhum registro publicado no histórico."],
];
const representatives = ["kru-esports", "team-vitality", "bilibili-gaming", "rex-regum-qeon"];
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
    for (const slug of representatives) {
      const organization = vct2027.organizations.find((entry) => entry.slug === slug);
      const participation = vct2027.teamSeasons.find((entry) => entry.organizationId === organization.id && entry.seasonId === seasonId);
      const region = vct2027.regions.find((entry) => entry.id === participation.regionId);
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      const response = await page.goto(`${baseURL}/team/${slug}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      assert.equal(await page.locator("main").count(), 1);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("h1").textContent(), organization.name);
      assert.equal(await page.title(), `${organization.name} | VCT Roster Tracker`);
      assert.ok(await page.getByRole("img", { name: `${organization.name} — logo indisponível`, exact: true }).isVisible());
      assert.equal(await page.getByRole("link", { name: region.name, exact: true }).getAttribute("href"), `/${region.slug}`);
      assert.ok((await page.locator("main header").textContent()).includes(`Temporada ${DEFAULT_SEASON_YEAR}`));
      assert.ok(await page.locator("main header").getByText("Parceira", { exact: true }).isVisible());
      assert.equal(await page.locator('a[href^="/player/"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").textContent(), "Pular para o conteúdo");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(":focus").getAttribute("id"), "conteudo");

      for (const [index, [id, title, message]] of sections.entries()) {
        assert.ok(await page.locator(`#${id}`).getByRole("heading", { level: 2, name: title, exact: true }).isVisible());
        assert.ok(await page.locator(`#${id}`).getByText(message, { exact: true }).isVisible());
        const link = page.getByRole("navigation", { name: "Seções da organização" }).getByRole("link", { name: title, exact: true });
        assert.ok((await link.boundingBox()).height >= 44);
        if (index === 0) {
          await link.focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          assert.equal(await page.locator(":focus").getAttribute("href"), `#${id}`);
          assert.equal(await link.evaluate((el) => getComputedStyle(el).outlineStyle), "solid");
          await page.keyboard.press("Enter");
        } else {
          await link.click();
        }
        await page.waitForURL(`**#${id}`);
        assert.equal(await page.locator(":focus").getAttribute("id"), id);
      }

      await page.locator(":focus").blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await auditAccessibility(page);
      if ([390, 1440].includes(width) || slug === "kru-esports") await page.screenshot({ path: `${artifacts}/${slug}-${width}.png`, fullPage: true });

      await page.getByRole("link", { name: `Voltar para ${region.name}`, exact: true }).click();
      await page.waitForURL(`**/${region.slug}`);
      await page.locator(`#organization-results a[href="/team/${slug}"]`).click();
      await page.waitForURL(`**/team/${slug}`);
      await page.getByRole("heading", { level: 1, name: organization.name, exact: true }).waitFor();
      assert.deepEqual(errors, []);
      report.push({ width, slug, identity: "passed", emptySections: 5, playerLinks: 0, anchorsKeyboard: "passed", navigation: "passed", overflow: false, axeViolations: 0, browserErrors: errors });
      await page.close();
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await page.goto(`${baseURL}/team/leviatan`, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "Seções da organização" }).getByRole("link", { name: "Histórico", exact: true }).tap();
  await page.waitForURL("**#historico");
  assert.equal(await page.locator("footer a").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");

  // All 32 actual pages must contain the five sections and no invented player links.
  for (const organization of vct2027.organizations) {
    const response = await page.request.get(`${baseURL}/team/${organization.slug}`);
    assert.equal(response.status(), 200);
    const html = await response.text();
    assert.ok(html.includes(organization.name));
    for (const [id, , message] of sections) {
      assert.ok(html.includes(`id="${id}-titulo"`));
      assert.ok(html.includes(message));
    }
    assert.ok(!/href="\/player\//.test(html));
  }
  const notFound = await page.goto(`${baseURL}/team/equipe-inexistente`, { waitUntil: "networkidle" });
  assert.equal(notFound.status(), 404);
  assert.ok(await page.getByRole("heading", { level: 1, name: "Organização não encontrada" }).isVisible());
  assert.ok(await page.locator('meta[name="robots"][content*="noindex"]').count() > 0);
  await auditAccessibility(page);
  await page.screenshot({ path: `${artifacts}/not-found-390.png`, fullPage: true });
  await page.getByRole("link", { name: "Voltar às regiões", exact: true }).tap();
  await page.waitForURL(/\/#regioes$/);
  await page.close();

  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(`${baseURL}/team/loud`);
  assert.equal(await noJS.locator('main section').count(), 5);
  await noJS.getByRole("navigation", { name: "Seções da organização" }).getByRole("link", { name: "Reservas", exact: true }).click();
  await noJS.waitForURL("**#reservas");
  await noJS.getByRole("link", { name: "Voltar para Americas" }).click();
  await noJS.waitForURL("**/americas");
  await noJS.close();

  await writeFile(`${artifacts}/results.json`, JSON.stringify({ browser: browser.version(), profilesCheckedByHTTP: 32, viewports: report, touchReducedMotion: "passed", withoutJavaScript: "passed", notFound: "404 with recovery link and noindex" }, null, 2) + "\n");
  console.log("Perfis aprovados: 32 organizações, cinco seções vazias, metadados, quatro larguras, teclado, axe, retorno à região, toque, HTML sem JS e 404.");
} finally {
  await browser.close();
}
