import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function organizationHttpChecks({ db, request, post, cookie, artifacts, base }) {
  const getRow = async (table, id) => (await db.query(`select to_jsonb(r) as row from public.${table} r where id=$1`, [id])).rows[0]?.row;
  const get = (path) => request(path, { headers: { Cookie: cookie } });
  const save = (form) => post("/admin/manage", new URLSearchParams(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value ?? ""]))).toString(), cookie);
  const publicPage = async (path) => { const response = await fetch(base + path); return { status: response.status, html: await response.text() }; };
  const auditCount = async () => (await db.query("select count(*)::int as n from public.audit_logs")).rows[0].n;
  const season = (await db.query("select id from public.seasons where year=2027")).rows[0].id;
  const region = (await db.query("select id from public.regions where slug='americas'")).rows[0].id;
  for (const path of ["/admin/organizations/new", "/admin/organizations/seasons"]) {
    assert.equal((await request(path)).response.status, 303);
    const result = await get(path);
    assert.equal(result.response.status, 200);
    assert.match(result.html, /action="\/admin\/manage"/);
    await writeFile(`${artifacts}/${path.endsWith("new") ? "organization-new" : "seasons"}.html`, result.html);
  }
  assert.equal((await get(`/admin/organizations/00000000-0000-4000-8000-000000000000`)).html.includes("Organização não encontrada"), true);
  const before = await auditCount();
  for (const path of ["/admin/manage", "/admin/organizations/logo"]) {
    assert.equal((await get(path)).response.status, 405);
    assert.equal((await post(path, "kind=organization", cookie, "https://evil.test")).response.status, 403);
    assert.equal((await post(path, "kind=organization", cookie, "")).response.status, 403);
    assert.equal((await post(path, "kind=organization")).response.status, 303);
  }
  assert.match((await save({ kind: "organization", name: "" })).location, /status=invalid/);
  assert.match((await post("/admin/manage", "id=a&id=b", cookie)).location, /status=invalid/);
  assert.equal(await auditCount(), before);

  const input = { kind: "organization", name: "Equipe extra integração", slug: "isolated-extra-integration", short_name: "EX", logo_url: "", publication_status: "draft", season_id: season, region_id: region, partner_status: "qualifier" };
  const created = await save(input);
  assert.match(created.location, /^\/admin\/organizations\/[0-9a-f-]{36}\?status=saved$/);
  const id = created.location.split("/").at(-1).split("?")[0];
  assert.equal((await publicPage(`/team/${input.slug}`)).status, 404);
  const edit = await get(`/admin/organizations/${id}`);
  assert.match(edit.html, /name="expected_updated_at"/);
  assert.match(edit.html, /Upload indisponível/);
  assert.match(edit.html, /aria-current="page"[^>]*href="\/admin\/organizations"/);
  await writeFile(`${artifacts}/organization-edit-draft.html`, edit.html);
  assert.match((await save(input)).location, /status=duplicate/);
  assert.ok((await get("/admin/organizations?q=extra%20integracao")).html.replace(/<!--[\s\S]*?-->/g, "").includes("1 organização encontrada"), "Search normalizes accents");
  assert.match((await get("/admin/organizations?q=does-not-exist")).html, /Nenhuma organização corresponde/);
  let org = await getRow("organizations", id);
  const publish = { ...org, kind: "organization", expected_updated_at: org.updated_at, publication_status: "published" };
  assert.match((await save(publish)).location, /status=saved/);
  assert.match((await save({ ...publish, name: "Stale value" })).location, /status=conflict/);
  let team = (await db.query("select to_jsonb(t) as row from public.team_seasons t where organization_id=$1", [id])).rows[0].row;
  assert.match((await save({ ...team, kind: "participation", expected_updated_at: team.updated_at, state: "published" })).location, /status=saved/);
  assert.equal((await publicPage(`/team/${input.slug}`)).status, 200);
  let publicRegion = await publicPage("/americas");
  assert.match(publicRegion.html, /Equipe extra integração/);
  assert.equal((await db.query("select count(*)::int as n from public.team_seasons where region_id=$1 and season_id=$2", [region, season])).rows[0].n, 9);
  await writeFile(`${artifacts}/public-extra-organization.html`, publicRegion.html);

  org = await getRow("organizations", id);
  assert.match((await save({ ...org, kind: "organization", expected_updated_at: org.updated_at, slug: "isolated-renamed-integration", name: "Equipe renomeada integração" })).location, /status=saved/);
  assert.equal((await publicPage(`/team/${input.slug}`)).status, 404);
  assert.equal((await publicPage("/team/isolated-renamed-integration")).status, 200);
  team = await getRow("team_seasons", team.id);
  assert.match((await save({ ...team, kind: "participation", expected_updated_at: team.updated_at, state: "archived" })).location, /status=saved/);
  assert.doesNotMatch((await publicPage("/americas")).html, /Equipe renomeada integração/);
  const archived = await getRow("team_seasons", team.id);
  assert.ok(archived.archived_at);
  assert.match((await save({ ...archived, kind: "participation", expected_updated_at: archived.updated_at, state: "published" })).location, /status=saved/);
  assert.match((await publicPage("/americas")).html, /Equipe renomeada integração/);
  assert.match((await save({ kind: "season", year: "2028", name: "Temporada integração", publication_status: "published" })).location, /status=saved/);
  const nextSeason = (await db.query("select to_jsonb(s) as row from public.seasons s where year=2028")).rows[0].row;
  assert.match((await save({ ...nextSeason, kind: "season", expected_updated_at: nextSeason.updated_at, name: "Temporada editada" })).location, /status=saved/);
  assert.match((await save({ kind: "participation", organization_id: id, season_id: nextSeason.id, region_id: region, partner_status: "visitor", state: "published" })).location, /status=saved/);
  assert.equal((await db.query("select count(*)::int as n from public.team_seasons where organization_id=$1", [id])).rows[0].n, 2);
  assert.match((await post("/admin/organizations/logo", "", cookie)).location, /status=upload/);
  await writeFile(`${artifacts}/organization-http.json`, JSON.stringify({ checks: ["CSRF/method/anonymous denial", "native create/edit/duplicate/search", "draft private, published ninth team public", "rename preserves UUID", "archive/restore", "stale edit refused", "create/edit season and second participation", "Storage disabled explicitly"], infrastructure: "Next production + Supabase SDK + Auth/PostgREST doubles + real SQL/RLS" }, null, 2) + "\n");
}

export async function organizationBrowserChecks({ page, width, artifacts, base, withoutJavaScript = false }) {
  const suffix = withoutJavaScript ? "no-js" : String(width);
  const capture = async (name) => {
    if (!withoutJavaScript) {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${name} at ${width}`);
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), [], `axe: ${name}`);
    }
    await page.screenshot({ path: `${artifacts}/${name}-${suffix}.png`, fullPage: true });
  };
  await page.goto(`${base}/admin/organizations`);
  await capture("organizations");
  await page.getByRole("link", { name: "Nova organização", exact: true }).click();
  await page.waitForURL(`${base}/admin/organizations/new`);
  await page.getByLabel("Nome da organização", { exact: true }).fill(`Equipe navegador ${suffix}`);
  await page.getByLabel("Slug — endereço do perfil", { exact: true }).fill(`isolated-browser-${suffix}`);
  await page.getByLabel("Região", { exact: true }).selectOption({ label: "Americas" });
  await capture("organization-new");
  await page.getByRole("button", { name: "Criar organização e participação" }).click();
  await page.waitForURL(/\/admin\/organizations\/[0-9a-f-]{36}\?status=saved/);
  await page.getByLabel("Nome da organização", { exact: true }).fill(`Equipe editada ${suffix}`);
  await page.getByRole("button", { name: "Salvar organização", exact: true }).click();
  await page.getByRole("heading", { name: `Equipe editada ${suffix}`, exact: true }).waitFor();
  // A second save on the same page must use the new optimistic-lock version.
  await page.getByLabel("Nome da organização", { exact: true }).fill(`Equipe final ${suffix}`);
  await page.getByRole("button", { name: "Salvar organização", exact: true }).click();
  await page.getByRole("heading", { name: `Equipe final ${suffix}`, exact: true }).waitFor();
  if (!withoutJavaScript) {
    await page.getByLabel("Slug — endereço do perfil", { exact: true }).fill("isolated-renamed-integration");
    await page.getByRole("button", { name: "Salvar organização", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "já está cadastrado" }).waitFor();
    assert.equal(await page.getByLabel("Nome da organização", { exact: true }).inputValue(), `Equipe final ${suffix}`);
    await page.getByLabel("Slug — endereço do perfil", { exact: true }).fill(`isolated-browser-${suffix}`);
    await page.getByLabel("Nome da organização", { exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.name), "short_name");
  }
  await page.locator("summary").filter({ hasText: "2027" }).click();
  await page.getByLabel("Estado da participação").selectOption("archived");
  await page.getByRole("button", { name: "Salvar participação", exact: true }).click();
  await page.locator("summary").filter({ hasText: "Arquivada" }).waitFor();
  await capture("organization-edit");
  await page.goto(`${base}/admin/organizations/seasons`);
  await capture("seasons");
}
