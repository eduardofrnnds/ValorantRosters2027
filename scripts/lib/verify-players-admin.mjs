import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

export async function playerHttpChecks({ db, request, post, cookie, artifacts, base }) {
  const get = (path) => request(path, { headers: { Cookie: cookie } });
  const row = async (id) => (await db.query("select to_jsonb(p) as row from public.players p where id=$1", [id])).rows[0]?.row;
  const save = (input) => post("/admin/players/save", new URLSearchParams(Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? ""]))).toString(), cookie);
  const edit = (current, changes) => save({ ...current, ...current.links, expected_updated_at: current.updated_at, ...changes });
  const publicRequest = async (slug) => {
    const response = await fetch(`${base}/player/${slug}`, { redirect: "manual" });
    return { status: response.status, location: response.headers.get("location"), html: await response.text(), cache: response.headers.get("cache-control") };
  };
  for (const path of ["/admin/players/new", "/admin/players/00000000-0000-4000-8000-000000000000"]) assert.equal((await request(path)).response.status, 303);
  for (const path of ["/admin/players/save", "/admin/players/photo"]) {
    assert.equal((await get(path)).response.status, 405);
    for (const origin of ["", "https://evil.test"]) assert.equal((await post(path, "nickname=invalid", cookie, origin)).response.status, 403);
    assert.equal((await post(path, "nickname=invalid")).response.status, 303);
  }
  const fresh = await get("/admin/players/new");
  assert.match(fresh.html, /action="\/admin\/players\/save"/);
  assert.match(fresh.html, /name="id" value="[0-9a-f-]{36}"/);
  await writeFile(`${artifacts}/player-new.html`, fresh.html);
  assert.match((await save({ nickname: "" })).location, /status=invalid/);
  const id = randomUUID();
  const input = { id, nickname: "Águia integração", name: "Nome isolado", slug: "", nationality: "Brasil", role: "flex", photo_url: "", website: "https://example.test", publication_status: "draft" };
  assert.match((await save(input)).location, new RegExp(`/admin/players/${id}\\?status=saved`));
  assert.match((await save(input)).location, /status=duplicate/);
  let current = await row(id);
  assert.equal(current.slug, "aguia-integracao");
  assert.equal((await publicRequest(current.slug)).status, 404);
  assert.ok((await get("/admin/players?q=aguia")).html.replace(/<!--[\s\S]*?-->/g, "").includes("1 perfis encontrados"));
  assert.match((await get("/admin/players?q=none-existing")).html, /Nenhum jogador corresponde/);
  assert.match((await edit(current, { slug: "first-public-player", publication_status: "published" })).location, /status=saved/);
  assert.match((await edit(current, { nickname: "Lost edit" })).location, /status=conflict/);
  assert.equal((await publicRequest("aguia-integracao")).status, 404, "Private-only alias stays hidden");
  const published = await publicRequest("first-public-player");
  assert.equal(published.status, 200);
  assert.match(published.html, /Águia integração/);
  assert.match(published.html, /Nenhum vínculo atual publicado/);
  assert.match(published.html, /href="https:\/\/example.test"/);
  assert.ok(!published.html.includes("vct-admin-access"));
  await writeFile(`${artifacts}/player-published.html`, published.html);

  // Real historical membership remains through profile edits; no transfer endpoint exists.
  const team = (await db.query("select id from public.team_seasons where publication_status='published' limit 1")).rows[0].id;
  const membership = (await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,end_date,publication_status,published_at) values($1,$2,'starter','2025-01-01','2025-02-01','published',now()) returning id", [id, team])).rows[0].id;
  current = await row(id);
  assert.match((await edit(current, { nickname: "Nickname novo", slug: "second-public-player", photo_url: "/images/fixture-test.png" })).location, /status=saved/);
  const redirect = await publicRequest("first-public-player");
  assert.equal(redirect.status, 307);
  assert.equal(new URL(redirect.location, base).pathname, "/player/second-public-player");
  assert.match(redirect.cache, /no-store/);
  const profile = await publicRequest("second-public-player");
  assert.equal(profile.status, 200);
  assert.match(profile.html, /Nickname novo/);
  assert.match(profile.html, /2025-01-01/);
  assert.equal((await db.query("select player_id from public.roster_memberships where id=$1", [membership])).rows[0].player_id, id);
  await writeFile(`${artifacts}/player-with-history.html`, profile.html);
  const duplicate = { ...input, id: randomUUID(), slug: "first-public-player" };
  assert.match((await save(duplicate)).location, /status=duplicate/);
  const sameNickname = { ...input, id: randomUUID(), nickname: "Nickname novo", slug: "" };
  assert.match((await save(sameNickname)).location, /status=saved/);
  assert.equal((await row(sameNickname.id)).slug, "nickname-novo");
  current = await row(id);
  assert.match((await edit(current, { publication_status: "draft" })).location, /status=saved/);
  assert.equal((await publicRequest("first-public-player")).status, 404);
  assert.equal((await publicRequest("second-public-player")).status, 404);
  current = await row(id);
  assert.match((await edit(current, { publication_status: "published", slug: "first-public-player" })).location, /status=saved/);
  assert.equal((await publicRequest("first-public-player")).status, 200);
  assert.equal(new URL((await publicRequest("second-public-player")).location, base).pathname, "/player/first-public-player");
  assert.match((await post("/admin/players/photo", "", cookie)).location, /status=upload/);
  const editPage = await get(`/admin/players/${id}`);
  assert.match(editPage.html, /Endereços reservados/);
  assert.match(editPage.html, /Anterior privado/);
  await writeFile(`${artifacts}/player-edit.html`, editPage.html);
  await writeFile(`${artifacts}/players-http.json`, JSON.stringify({ checks: ["CSRF/method/auth denial", "create/search/edit with UUID", "replay rejected", "generated slug", "published profile and links", "public aliases 307 no-store", "private aliases 404", "unpublish hides aliases", "history survives rename", "return to own slug", "Storage disabled explicitly"], infrastructure: "Next production + SDK + isolated Auth/PostgREST + SQL/RLS" }, null, 2) + "\n");
}

export async function playerBrowserChecks({ page, width, artifacts, base, withoutJavaScript = false }) {
  const suffix = withoutJavaScript ? "no-js" : String(width);
  const capture = async (name) => {
    if (!withoutJavaScript) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Player overflow: ${name}`);
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
    }
    await page.screenshot({ path: `${artifacts}/${name}-${suffix}.png`, fullPage: true });
  };
  await page.goto(`${base}/admin/players`);
  await capture("players");
  await page.getByRole("link", { name: "Novo jogador", exact: true }).click();
  await page.getByLabel("Nickname", { exact: true }).fill(`Navegador ${suffix}`);
  await page.getByLabel("Visibilidade", { exact: true }).selectOption("published");
  await capture("player-new");
  await page.getByRole("button", { name: "Criar jogador", exact: true }).click();
  await page.waitForURL(/\/admin\/players\/[0-9a-f-]{36}\?status=saved/);
  await page.getByLabel("Nickname", { exact: true }).fill(`Novo nickname ${suffix}`);
  await page.getByRole("button", { name: "Salvar jogador", exact: true }).click();
  await page.getByRole("heading", { name: `Novo nickname ${suffix}`, exact: true }).waitFor();
  await page.getByLabel("Slug — endereço do perfil", { exact: true }).fill(`renamed-browser-${suffix}`);
  await page.getByRole("button", { name: "Salvar jogador", exact: true }).click();
  await page.getByRole("link", { name: "Abrir perfil público", exact: true }).waitFor();
  await capture("player-edit");
  await page.getByRole("link", { name: "Abrir perfil público", exact: true }).click();
  await page.waitForURL(`${base}/player/renamed-browser-${suffix}`);
  await capture("player-public");
  await page.goto(`${base}/player/navegador-${suffix}`);
  await page.waitForURL(`${base}/player/renamed-browser-${suffix}`);
  await page.goto(`${base}/admin`);
}
