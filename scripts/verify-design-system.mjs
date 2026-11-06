import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { DEFAULT_SEASON_YEAR, vct2027 } from "../src/features/organizations/data/vct-2027.ts";

const require = createRequire(import.meta.url);
const baseURL = process.env.UI_BASE_URL ?? "http://127.0.0.1:3010";
const artifactDirectory = `${process.env.UI_ARTIFACT_ROOT ?? "artifacts/task-07"}/home`;
const seasonId = vct2027.seasons.find(({ year }) => year === DEFAULT_SEASON_YEAR).id;
await mkdir(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...((process.env.PLAYWRIGHT_CHANNEL || process.platform === "win32")
    ? { channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" }
    : {}),
});
const report = [];

try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const response = await page.goto(baseURL, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("main").count(), 1);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("html").getAttribute("lang"), "pt-BR");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);

    // Real keyboard navigation: the skip link must become visible and move focus.
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").textContent(), "Pular para o conteúdo");
    const skipBox = await page.locator(":focus").boundingBox();
    assert.ok(skipBox.width > 100 && skipBox.y >= 0);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "conteudo");

    await page.getByRole("link", { name: "Explorar regiões", exact: true }).click();
    await page.waitForURL(/#regioes$/);
    await page.getByRole("navigation").getByRole("link", { name: "Mudanças", exact: true }).click();
    await page.waitForURL(/#mudancas$/);
    assert.ok(await page.getByText("Nenhuma mudança publicada por aqui ainda.", { exact: true }).isVisible());
    await page.getByRole("link", { name: "Sobre o projeto" }).click();
    await page.waitForURL(/#sobre$/);
    await page.getByRole("link", { name: "Voltar ao topo" }).click();
    await page.waitForURL(/#topo$/);
    for (const link of await page.locator("header a, footer a").all()) {
      const box = await link.boundingBox();
      assert.ok(box.height >= 44, "Touch target smaller than 44px");
    }

    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const accessibility = await page.evaluate(async () => {
      const { violations } = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] },
      });
      return violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
    });
    assert.deepEqual(accessibility, [], `Accessibility violations at ${width}px`);
    await page.locator("footer a").blur();
    await page.screenshot({ path: `${artifactDirectory}/${width}.png`, fullPage: true });

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".magic-card-glow").evaluateAll((els) => els.length > 0 && els.every((el) => getComputedStyle(el).display === "none")), true);
    assert.equal(await page.locator("footer a").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");

    assert.equal(await page.locator("#regioes a").count(), 4);
    for (const [index, region] of vct2027.regions.entries()) {
      const count = vct2027.teamSeasons.filter((entry) => entry.seasonId === seasonId && entry.regionId === region.id && entry.partnerStatus === "partner").length;
      const link = page.locator(`#regioes a[href="/${region.slug}"]`);
      assert.ok((await link.textContent()).includes(`${count} equipes parceiras`));
      if (index === 0) {
        await link.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(":focus").getAttribute("href"), `/${region.slug}`);
        assert.equal(await link.evaluate((el) => getComputedStyle(el).outlineStyle), "solid");
        await page.keyboard.press("Enter");
      } else {
        await link.click();
      }
      await page.waitForURL(`**/${region.slug}`);
      await page.getByRole("heading", { level: 1, name: region.name, exact: true }).waitFor();
      assert.equal((await page.request.get(`${baseURL}/${region.slug}`)).status(), 200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (index === 0 && [390, 1440].includes(width)) {
        await page.screenshot({ path: `${artifactDirectory}/region-${width}.png`, fullPage: true });
      }
      await page.getByRole("link", { name: "Voltar às regiões" }).click();
      await page.waitForURL(/\/#regioes$/);
      await page.locator("#regioes").waitFor();
    }

    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    report.push({ width, overflow: false, keyboard: "passed", anchors: "passed", touchTargets: "passed", axeViolations: 0, reducedMotion: "passed", regionNavigation: "4 routes and return links passed", partnerCounts: "matched catalog", recentChanges: "empty", browserErrors: errors });
    await page.close();
  }

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await touch.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(await touch.locator(".magic-card-glow").evaluateAll((els) => els.length > 0 && els.every((el) => getComputedStyle(el).display === "none")), true);
  await touch.locator('#regioes a[href="/pacific"]').tap();
  await touch.waitForURL("**/pacific");
  await touch.getByRole("link", { name: "Voltar às regiões" }).tap();
  await touch.waitForURL(/\/#regioes$/);
  await touch.close();

  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(baseURL);
  assert.ok(await noJS.getByRole("heading", { level: 1 }).isVisible());
  assert.ok(await noJS.getByRole("link", { name: "Sobre o projeto" }).isVisible());
  assert.equal(await noJS.locator("#regioes a").count(), 4);
  await noJS.locator('#regioes a[href="/americas"]').click();
  await noJS.waitForURL("**/americas");
  assert.ok(await noJS.getByRole("heading", { level: 1, name: "Americas" }).isVisible());
  assert.equal((await noJS.request.get(`${baseURL}/regiao-inexistente`)).status(), 404);
  await noJS.close();

  await writeFile(`${artifactDirectory}/results.json`, JSON.stringify({ browser: browser.version(), baseURL, viewports: report, touch: "passed", withoutJavaScript: "passed" }, null, 2) + "\n");
  console.log("Home aprovada em 320, 390, 768 e 1440px; quatro regiões, contagens, estado vazio, teclado, axe, toque, movimento reduzido, HTML sem JS e 404 verificados.");
} finally {
  await browser.close();
}
