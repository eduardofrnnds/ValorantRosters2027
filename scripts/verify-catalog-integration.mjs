import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createTestDatabase } from "../tests/helpers/database.mjs";
import { buildSeedSql } from "./lib/seed-vct-2027.mjs";

// This HTTP adapter is a test double for PostgREST, backed by real PostgreSQL/RLS.
// It is never imported by the app and does not validate Supabase infrastructure.
const remote = process.argv.includes("--remote");
const httpOnly = process.argv.includes("--http-only");
const skipBuild = process.argv.includes("--skip-build");
const artifacts = process.env.UI_ARTIFACT_ROOT ?? "artifacts/task-17/public";
const base = "http://127.0.0.1:3019";
const publicKey = "sb_publishable_isolated_test";
const privateMarker = "PRIVATE_DATABASE_SENTINEL_TASK09";
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", DATABASE_URL: privateMarker, UI_BASE_URL: base, UI_ARTIFACT_ROOT: artifacts };
let db, api, server, browser;
let mode = "ready";
let reads = 0;
const methods = new Set();
const paths = ["/", "/americas", "/team/100-thieves"];

async function run(args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `Falha em ${args.join(" ")}`);
}
async function ready() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Servidor encerrou antes de ficar pronto.");
    try { if ((await fetch(base)).ok) return; } catch { /* Startup only. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timeout ao iniciar servidor isolado.");
}
async function htmlAt(path, status = 200) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(!html.includes(privateMarker));
  return html;
}
async function verifyHTTP() {
  if (!remote) {
    const { vct2027 } = await import("../src/features/organizations/data/vct-2027.ts");
    assert.match(await htmlAt("/"), /32<\/span> equipes parceiras/);
    for (const region of vct2027.regions) assert.match(await htmlAt(`/${region.slug}`), /Elencos atuais do/);
    for (const org of vct2027.organizations) assert.ok((await htmlAt(`/team/${org.slug}`)).includes(org.name));
    assert.match(await htmlAt("/transfers"), /Nenhum registro publicado para estes filtros/);
    const missing = await htmlAt("/team/sem-cadastro", 404);
    assert.match(missing, /<h1[^>]*>Organização não encontrada<\/h1>/);
    await htmlAt("/regiao-inexistente", 404);
    assert.match(await htmlAt("/player/sem-cadastro", 404), /<h1/);
  } else {
    for (const path of paths) assert.ok(!(await htmlAt(path)).includes("Somente leitura"));
    await db.query("update public.organizations set name = '100 Thieves — teste de integração' where slug = '100-thieves'");
    const profile = await htmlAt("/team/100-thieves");
    assert.match(profile, /<h1[^>]*>100 Thieves — teste de integração<\/h1>/);
    assert.match(profile, /<title>100 Thieves — teste de integração/);
    assert.match(await htmlAt("/americas"), /100 Thieves — teste de integração/);
    await db.exec("update public.team_seasons set publication_status = 'draft', published_at = null where organization_id = (select id from public.organizations where slug = '100-thieves')");
    assert.match(await htmlAt("/"), /31<\/span> equipes parceiras/);
    assert.ok(!(await htmlAt("/americas")).includes('href="/team/100-thieves"'));
    assert.match(await htmlAt("/team/sem-cadastro", 404), /<h1[^>]*>Organização não encontrada<\/h1>/);
    await htmlAt("/regiao-inexistente", 404);
    await db.exec("update public.seasons set publication_status = 'draft', published_at = null where year = 2027");
    for (const path of paths) assert.match(await htmlAt(path), /<h1[^>]*>Nenhuma temporada publicada<\/h1>/);
    mode = "offline";
    for (const path of paths) {
      const html = await htmlAt(path, path.startsWith("/team/") ? 503 : 200);
      assert.match(html, /<h1[^>]*>Dados indisponíveis<\/h1>/);
      assert.match(html, /href="\/"[^>]*>Voltar ao início/);
      assert.ok(!html.includes("Somente leitura"));
    }
    for (const match of profile.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      assert.ok(!(await (await fetch(new URL(match[1], base))).text()).includes(privateMarker));
    }
    await writeFile(`${artifacts}/integration/remote-team.html`, profile);
    assert.deepEqual([...methods].sort(), ["GET", "POST"]);
  }
  await writeFile(`${artifacts}/integration/${remote ? "remote" : "local"}-http.json`, JSON.stringify({ mode: remote ? "isolated PostgreSQL + HTTP test adapter" : "local read only", build: remote && !skipBuild ? "configured build with no API reads" : "existing production build", checks: remote ? ["GET pagination/RLS", "fresh name and metadata", "fresh counts", "404 with HTML", "empty season", "outage without fallback", "HTML recovery without JS", "private sentinel absent"] : ["home", "4 regions", "32 teams", "404 with HTML", "player 404"], browser: "not run (HTTP only)", reads }, null, 2) + "\n");
  console.log(`HTTP aprovado: ${remote ? "integração isolada, publicação, vazio e indisponibilidade" : "catálogo local e 404"}.`);
}
try {
  await mkdir(`${artifacts}/integration`, { recursive: true });
  if (remote) {
    ({ db } = await createTestDatabase());
    await db.transaction((tx) => tx.exec(buildSeedSql()));
    await db.transaction((tx) => tx.exec(buildSeedSql()));
    api = createServer(async (request, response) => {
      try {
        methods.add(request.method);
        assert.equal(request.headers.apikey, publicKey);
        const url = new URL(request.url, "http://localhost");
        if (request.method === "POST" && url.pathname === "/rest/v1/rpc/read_roster_timeline") {
          reads++;
          let body = ""; for await (const chunk of request) body += chunk;
          const parameters = JSON.parse(body);
          const result = await db.transaction(async tx => {
            await tx.exec("set local role anon");
            return (await tx.query("select public.read_roster_timeline($1::jsonb) as result", [JSON.stringify(parameters.filters)])).rows[0].result;
          });
          response.writeHead(mode === "offline" ? 503 : 200, {"Content-Type":"application/json"});
          response.end(JSON.stringify(mode === "offline" ? {message:"Isolated outage"} : result)); return;
        }
        assert.equal(request.method, "GET");
        const table = url.pathname.split("/").at(-1);
        assert.ok(["regions", "seasons", "organizations", "team_seasons", "roster_memberships", "players"].includes(table));
        assert.equal(url.searchParams.get("publication_status"), "eq.published");
        reads++;
        if (mode === "offline") {
          response.writeHead(503, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ message: "Isolated outage" }));
          return;
        }
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 7);
        const result = await db.transaction(async (tx) => {
          await tx.exec("set local role anon");
          const conditions = ["publication_status = 'published'"], values = [];
          for (const field of ["slug", "organization_id", "season_id", "team_season_id", "player_id", "id"]) {
            const value = url.searchParams.get(field);
            if (!value) continue;
            if (field === "id" && value.startsWith("in.(")) {
              const ids = value.slice(4, -1).split(","); assert.ok(ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
              values.push(ids); conditions.push(`id=any($${values.length}::uuid[])`);
            } else { assert.ok(value.startsWith("eq.")); values.push(value.slice(3)); conditions.push(`${field}=$${values.length}`); }
          }
          const { rows } = await tx.query(`select * from public.${table} where ${conditions.join(" and ")} order by id`, values);
          return rows;
        });
        const page = result.slice(offset, offset + limit);
        response.writeHead(200, { "Content-Type": "application/json", "Content-Range": `${offset}-${offset + page.length - 1}/${result.length}` });
        response.end(JSON.stringify(page));
      } catch {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: "Test adapter failed" }));
      }
    });
    await new Promise((resolve, reject) => { api.once("error", reject); api.listen(54329, "127.0.0.1", resolve); });
    env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${api.address().port}`;
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
    if (!skipBuild) await run(["node_modules/next/dist/bin/next", "build"]);
    assert.equal(reads, 0, "Build configurado não consulta o banco");
  }
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3019"], { env, stdio: "inherit", windowsHide: true });
  await ready();
  if (httpOnly) {
    await verifyHTTP();
  } else if (!remote) {
    for (const script of ["verify-design-system", "verify-regions", "verify-teams", "verify-players"]) await run([`scripts/${script}.mjs`]);
  } else {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chromium"), headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const path of paths) {
      assert.equal((await page.goto(base + path)).status(), 200);
      assert.equal(await page.getByText("Somente leitura · catálogo local de 2027.").count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await db.query("update public.organizations set name = '100 Thieves — teste de integração' where slug = '100-thieves'");
    await page.goto(`${base}/team/100-thieves`);
    assert.equal(await page.locator("h1").textContent(), "100 Thieves — teste de integração");
    assert.match(await page.title(), /teste de integração/);
    await page.screenshot({ path: `${artifacts}/integration/remote-team-390.png`, fullPage: true });
    await page.goto(`${base}/americas`);
    assert.equal(await page.getByRole("link", { name: /100 Thieves — teste de integração/ }).count(), 1);
    await db.exec("update public.team_seasons set publication_status = 'draft', published_at = null where organization_id = (select id from public.organizations where slug = '100-thieves')");
    await page.goto(base);
    assert.match(await page.locator("main").innerText(), /31 equipes parceiras/);
    await page.goto(`${base}/americas`);
    assert.equal(await page.locator('a[href="/team/100-thieves"]').count(), 0);
    for (const path of ["/team/sem-cadastro", "/regiao-inexistente"]) {
      assert.equal((await page.goto(base + path)).status(), 404);
    }
    await db.exec("update public.seasons set publication_status = 'draft', published_at = null where year = 2027");
    for (const path of paths) {
      await page.goto(base + path);
      assert.equal(await page.locator("h1").textContent(), "Nenhuma temporada publicada");
    }
    await page.screenshot({ path: `${artifacts}/integration/remote-empty-390.png`, fullPage: true });
    mode = "offline";
    for (const path of paths) {
      await page.goto(base + path);
      assert.equal(await page.locator("h1").textContent(), "Dados indisponíveis");
      assert.equal(await page.locator('a[href="/team/100-thieves"]').count(), 0);
    }
    await page.screenshot({ path: `${artifacts}/integration/remote-offline-390.png`, fullPage: true });
    const noJS = await browser.newPage({ javaScriptEnabled: false });
    await noJS.goto(base);
    assert.equal(await noJS.locator("h1").textContent(), "Dados indisponíveis");
    assert.ok(await noJS.getByRole("link", { name: "Voltar ao início", exact: true }).isVisible());
    // Inspect the rendered HTML and JS actually served to the browser for a private marker.
    const html = await page.content();
    assert.ok(!html.includes(privateMarker));
    for (const src of await page.locator("script[src]").evaluateAll((nodes) => nodes.map((node) => node.src))) {
      assert.ok(!(await (await fetch(src)).text()).includes(privateMarker));
    }
    assert.deepEqual([...methods].sort(), ["GET", "POST"]);
    await writeFile(`${artifacts}/integration/results.json`, JSON.stringify({ database: "PostgreSQL/PGlite, migrations + seed twice", transport: "Isolated PostgREST test double; no real Supabase", build: skipBuild ? "existing production build" : "configured build with no API reads", browser: browser.version(), checks: ["anonymous GET with pagination", "remote name in profile/metadata/region", "fresh count after unpublishing", "404", "empty season", "outage without local fallback", "no-JS recovery", "private sentinel absent from delivered HTML/JS"], reads }, null, 2) + "\n");
    console.log("Integração isolada aprovada: leitura remota, atualização, RLS, vazio, indisponibilidade e credencial privada ausente do HTML/JS.");
  }
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; }
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)); }
  await db?.close();
}
