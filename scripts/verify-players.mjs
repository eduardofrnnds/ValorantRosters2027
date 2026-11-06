import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { localPlayers, localPlayerMemberships } from "../src/features/players/data/local-players.ts";
import { getPlayerProfile } from "../src/features/players/player-profile-model.ts";
import { testDate, testPlayer, testMembership, testPastMembership } from "../tests/fixtures/player-profile.mjs";
import { loadComponent } from "../tests/helpers/load-component.mjs";

const require = createRequire(import.meta.url);
const baseURL = process.env.UI_BASE_URL ?? "http://127.0.0.1:3010";
const artifacts = `${process.env.UI_ARTIFACT_ROOT ?? "artifacts/task-07"}/players`;
const { PlayerProfile } = loadComponent(new URL("../src/features/players/player-profile.tsx", import.meta.url));
const { SiteHeader } = loadComponent(new URL("../src/components/layout/site-header.tsx", import.meta.url));
const { SiteFooter } = loadComponent(new URL("../src/components/layout/site-footer.tsx", import.meta.url));
const browser = await chromium.launch({ headless: true,
  ...((process.env.PLAYWRIGHT_CHANNEL || process.platform === "win32") ? { channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" } : {}),
});
const report = [];
await mkdir(artifacts, { recursive: true });

async function audit(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] },
  })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })));
  assert.deepEqual(violations, []);
}

function fixtureHTML(profile, styles) {
  const html = renderToStaticMarkup(createElement(Fragment, null,
    createElement(SiteHeader),
    createElement("main", { id: "conteudo", tabIndex: -1, className: "flex flex-1 flex-col" },
      createElement("p", { className: "px-5 py-3 text-sm text-muted-foreground" }, "Cenário isolado de teste — não publicado"),
      createElement(PlayerProfile, { profile })),
    createElement(SiteFooter)));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Perfil — teste isolado</title>${styles}</head><body class="flex min-h-dvh flex-col">${html}</body></html>`;
}

try {
  assert.deepEqual(localPlayers, []);
  assert.deepEqual(localPlayerMemberships, []);
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    const response = await page.goto(`${baseURL}/player/jogador-inexistente`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 404);
    assert.equal(await page.locator("h1").textContent(), "Jogador não encontrado");
    assert.ok(await page.locator('meta[name="robots"][content*="noindex"]').count() > 0);
    assert.equal(await page.locator('a[href^="/player/"]').count(), 0);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(), "Pular para o conteúdo");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "conteudo");
    await audit(page);
    await page.screenshot({ path: `${artifacts}/not-found-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "Voltar às regiões", exact: true }).click();
    await page.waitForURL(/\/#regioes$/);
    assert.equal((await page.request.get(`${baseURL}/player/${testPlayer.slug}`)).status(), 404);
    report.push({ width, kind: "public-route", http: 404, noindex: true, keyboard: "passed", recovery: "passed", axeViolations: 0 });

    // Render the actual component with production CSS, outside Next routes/data.
    // This checks SSR layout/links; it does not claim to test profile hydration.
    const styles = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => link.outerHTML).join(""));
    assert.ok(styles.includes(".css"));
    const cases = [
      { name: "empty", player: { id: testPlayer.id, slug: testPlayer.slug, nickname: testPlayer.nickname, publicationStatus: "published" }, memberships: [] },
      { name: "career", player: testPlayer, memberships: [testMembership, testPastMembership] },
      { name: "long-name", player: { ...testPlayer, nickname: "Teste".repeat(18), name: "Nome de teste ".repeat(9) }, memberships: [testMembership] },
    ];
    for (const scenario of cases) {
      const profile = getPlayerProfile([scenario.player], scenario.memberships, vct2027, scenario.player.slug, testDate);
      await page.setContent(fixtureHTML(profile, styles), { waitUntil: "networkidle" });
      assert.equal(await page.locator("main").count(), 1);
      assert.equal(await page.locator("h1").textContent(), scenario.player.nickname);
      assert.ok(await page.getByRole("img", { name: `${scenario.player.nickname} — foto indisponível`, exact: true }).isVisible());
      assert.equal(await page.locator('#equipe-atual a[href^="/team/"]').count(), profile.currentMemberships.length);
      assert.equal(await page.locator('#historico-carreira a[href^="/team/"]').count(), profile.pastMemberships.length);
      if (scenario.name === "empty") {
        assert.ok(await page.getByText("Nenhum vínculo atual publicado.", { exact: true }).isVisible());
        assert.ok(await page.getByText("Nenhum histórico publicado.", { exact: true }).isVisible());
        assert.equal(await page.getByText("Não informada", { exact: true }).count(), 2);
      }
      for (const id of ["equipe-atual", "historico-carreira"]) {
        const anchor = page.locator(`nav[aria-label="Seções do jogador"] a[href="#${id}"]`);
        assert.ok((await anchor.boundingBox()).height >= 44);
        await anchor.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        assert.equal(await anchor.evaluate((el) => getComputedStyle(el).outlineStyle), "solid");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(":focus").getAttribute("id"), id);
      }
      await page.locator(":focus").blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await audit(page);
      if (scenario.name !== "long-name" || width === 320) await page.screenshot({ path: `${artifacts}/fixture-${scenario.name}-${width}.png`, fullPage: true });
      if (scenario.name === "career") {
        await page.locator('#equipe-atual a[href^="/team/"]').click();
        await page.waitForURL(`**/team/${profile.currentMemberships[0].organization.slug}`);
        assert.equal(await page.locator("h1").textContent(), profile.currentMemberships[0].organization.name);
      }
      report.push({ width, kind: "isolated-SSR-component", scenario: scenario.name, anchorsKeyboard: "passed", overflow: false, axeViolations: 0 });
    }
    assert.deepEqual(runtimeErrors, []);
    await page.close();
  }
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  assert.equal((await noJS.goto(`${baseURL}/player/sem-cadastro`)).status(), 404);
  assert.ok(await noJS.getByRole("heading", { name: "Jogador não encontrado" }).isVisible());
  await noJS.getByRole("link", { name: "Voltar às regiões", exact: true }).click();
  await noJS.waitForURL(/\/#regioes$/);
  await noJS.close();

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await touch.goto(`${baseURL}/player/sem-cadastro`);
  assert.equal(await touch.locator("footer a").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  await touch.getByRole("link", { name: "Voltar às regiões", exact: true }).tap();
  await touch.waitForURL(/\/#regioes$/);
  await touch.close();

  await writeFile(`${artifacts}/results.json`, JSON.stringify({ browser: browser.version(), publicPlayers: 0, publicMemberships: 0, report, withoutJavaScript: "404/recovery passed", touchReducedMotion: "404/recovery passed", limitation: "Populated/empty profiles tested as isolated SSR components, not published player routes or hydrated photo failures." }, null, 2) + "\n");
  console.log("Jogadores aprovados: cadastro vazio, 404 público e recuperação; componente real isolado em quatro larguras, campos ausentes, carreira, nomes longos, teclado e axe.");
} finally {
  await browser.close();
}
