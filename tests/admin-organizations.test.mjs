import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";
import { organizationSchema, seasonSchema, teamSeasonSchema, filterOrganizations, logoUrlSchema } from "../src/features/admin/organization-model.ts";
import { saveOrganizationRecord, readOrganizationData } from "../src/features/admin/organization-data.ts";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";
import { readAdminForm, readBoundedBody } from "../src/features/admin/http-security.ts";
import { logoFileType, LOGO_MAX_BYTES } from "../src/features/admin/organization-logo.ts";

let db;
const admin = randomUUID(), member = randomUUID(), disabled = randomUUID();
before(async () => {
  ({ db } = await createTestDatabase());
  for (const id of [admin, member, disabled]) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into public.admin_users(user_id,is_active) values($1,true),($2,false)", [admin, disabled]);
});
after(async () => db?.close());
async function asRole(role, id, operation) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ""]);
    return operation(tx);
  });
}
const rpc = (name, payload, user = admin, role = "authenticated") => asRole(role, user, async (tx) =>
  (await tx.query(`select public.${name}($1::jsonb) as id`, [JSON.stringify(payload)])).rows[0].id);
const row = async (table, id) => (await db.query(`select to_jsonb(t) as row from public.${table} t where id=$1`, [id])).rows[0]?.row;
const visible = (table, id) => asRole("anon", null, async (tx) => (await tx.query(`select id from public.${table} where id=$1`, [id])).rows.length);
async function fixture() {
  const suffix = randomUUID();
  const region = (await db.query("insert into public.regions(slug,name,publication_status,published_at) values($1,'Região isolada','published',now()) returning id", [`r-${suffix}`])).rows[0].id;
  const year = 3000 + (await db.query("select count(*)::int as n from public.seasons")).rows[0].n;
  const season = await rpc("admin_save_season", { year, name: `Temporada ${year}`, publication_status: "published" });
  const input = { name: "Equipe de teste", slug: `test-${suffix}`, short_name: "T", logo_url: "", publication_status: "published", season_id: season, region_id: region, partner_status: "qualifier" };
  return { input, region, season };
}

test("Zod valida criação/edição, slugs, categorias, URLs e versão obrigatória", () => {
  const input = { name: " Equipe ", slug: "uma-equipe", publication_status: "draft", season_id: randomUUID(), region_id: randomUUID() };
  assert.equal(organizationSchema.parse(input).name, "Equipe");
  for (const extra of [{ slug: "Nome inválido" }, { name: " " }, { season_id: "" }, { partner_status: "starter" }, { id: randomUUID() }, { logo_url: "javascript:alert(1)" }]) {
    assert.equal(organizationSchema.safeParse({ ...input, ...extra }).success, false);
  }
  for (const value of ["//evil.test/logo", "/\\evil.test", "https://user:pass@host/logo", "data:image/png;base64,a", "/../logo.png"]) assert.equal(logoUrlSchema.safeParse(value).success, false);
  for (const value of ["", "/images/logo.svg", "https://example.test/logo.png"]) assert.equal(logoUrlSchema.safeParse(value).success, true);
  assert.equal(seasonSchema.safeParse({ year: 1999, name: "Season", publication_status: "draft" }).success, false);
  assert.equal(teamSeasonSchema.safeParse({ organization_id: randomUUID(), season_id: randomUUID(), region_id: randomUUID(), partner_status: "visitor", state: "archived" }).success, true);
});

test("formulários rejeitam parâmetros duplicados e corpo acima do limite real", async () => {
  const req = (body) => new Request("https://example.test/admin/manage", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": "1" }, body });
  assert.deepEqual(await readAdminForm(req("name=Equipe&kind=organization")), { name: "Equipe", kind: "organization" });
  assert.equal(await readAdminForm(req("id=a&id=b")), null);
  assert.equal(await readAdminForm(req("x=" + "a".repeat(17000))), null);
  assert.equal(await readBoundedBody(req("12345"), 4), null);
});

test("logo verifica tamanho, assinatura e MIME; busca ignora acentos sem modificar dados", () => {
  const png = new Uint8Array(32); png.set([137,80,78,71,13,10,26,10]);
  assert.equal(logoFileType(png, "image/png"), "png");
  assert.equal(logoFileType(png, "image/jpeg"), null);
  assert.equal(logoFileType(new Uint8Array(LOGO_MAX_BYTES + 1), "image/png"), null);
  assert.equal(logoFileType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml"), null);
  const rows = [{ id: "a", name: "Águia", slug: "aguia", short_name: "AG" }, { id: "b", name: "Equipe", slug: "equipe" }];
  assert.equal(filterOrganizations(rows, " AGUIA ")[0].id, "a");
  assert.equal(filterOrganizations(rows, "AG")[0].id, "a");
  assert.equal(rows.length, 2);
});

test("organização e participação são atômicas; FK/slug/visibilidade inválidos não deixam cadastro parcial", async () => {
  const { input } = await fixture();
  const before = (await db.query("select count(*)::int as n from public.organizations")).rows[0].n;
  await assert.rejects(rpc("admin_save_organization", { ...input, region_id: randomUUID(), publication_status: "draft" }), { code: "23503" });
  assert.equal((await db.query("select count(*)::int as n from public.organizations")).rows[0].n, before);
  const id = await rpc("admin_save_organization", input);
  assert.equal(await visible("organizations", id), 1);
  await assert.rejects(rpc("admin_save_organization", input), { code: "23505" });
  assert.equal((await db.query("select count(*)::int as n from public.organizations")).rows[0].n, before + 1);
  const season = await row("seasons", input.season_id);
  await rpc("admin_save_season", { ...season, expected_updated_at: season.updated_at, publication_status: "draft" });
  await assert.rejects(rpc("admin_save_organization", { ...input, slug: `private-${randomUUID()}` }), { code: "P0001" });
});

test("publicar, renomear, arquivar e restaurar preservam IDs/vínculos e auditam o administrador", async () => {
  const { input } = await fixture();
  const id = await rpc("admin_save_organization", { ...input, publication_status: "draft" });
  let org = await row("organizations", id);
  let team = (await db.query("select to_jsonb(t) as row from public.team_seasons t where organization_id=$1", [id])).rows[0].row;
  assert.equal(await visible("organizations", id), 0);
  await rpc("admin_save_organization", { ...org, logo_url: "", expected_updated_at: org.updated_at, publication_status: "published" });
  await rpc("admin_save_team_season", { ...team, expected_updated_at: team.updated_at, state: "published" });
  team = await row("team_seasons", team.id);
  const player = (await db.query("insert into public.players(slug,nickname,publication_status,published_at) values($1,'Fixture','published',now()) returning id", [`p-${randomUUID()}`])).rows[0].id;
  const membership = (await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2027-01-01','published',now()) returning id", [player, team.id])).rows[0].id;
  assert.equal(await visible("roster_memberships", membership), 1);
  org = await row("organizations", id);
  assert.equal(await rpc("admin_save_organization", { ...org, expected_updated_at: org.updated_at, slug: `renamed-${randomUUID()}` }), id);
  await rpc("admin_save_team_season", { ...team, expected_updated_at: team.updated_at, state: "archived" });
  const archived = await row("team_seasons", team.id);
  assert.ok(archived.archived_at);
  assert.equal(archived.publication_status, "draft");
  assert.equal(await visible("team_seasons", team.id), 0);
  assert.equal(await visible("roster_memberships", membership), 0);
  assert.equal((await row("roster_memberships", membership)).team_season_id, team.id);
  await rpc("admin_save_team_season", { ...archived, expected_updated_at: archived.updated_at, state: "published" });
  assert.equal(await visible("roster_memberships", membership), 1);
  assert.equal((await row("team_seasons", team.id)).archived_at, null);
  const logs = (await db.query("select actor_id, old_record, new_record from public.audit_logs where table_name='team_seasons' and record_id=$1 and operation='UPDATE'", [team.id])).rows;
  assert.ok(logs.some((log) => log.new_record.archived_at && log.actor_id === admin));
});

test("edições obsoletas falham sem sobrescrever; identidade da participação e ano ficam fixos", async () => {
  const { input, season } = await fixture();
  const id = await rpc("admin_save_organization", input);
  const org = await row("organizations", id);
  await rpc("admin_save_organization", { ...org, expected_updated_at: org.updated_at, name: "Nome novo" });
  await assert.rejects(rpc("admin_save_organization", { ...org, expected_updated_at: org.updated_at, name: "Perdido" }), { code: "40001" });
  assert.equal((await row("organizations", id)).name, "Nome novo");
  const s = await row("seasons", season);
  await assert.rejects(rpc("admin_save_season", { ...s, expected_updated_at: s.updated_at, year: s.year + 1 }), { code: "23514" });
  const team = (await db.query("select to_jsonb(t) as row from public.team_seasons t where organization_id=$1", [id])).rows[0].row;
  await assert.rejects(rpc("admin_save_team_season", { ...team, expected_updated_at: team.updated_at, organization_id: randomUUID(), state: "draft" }), { code: "23514" });
  await rpc("admin_save_team_season", { ...team, expected_updated_at: team.updated_at, state: "draft" });
  await assert.rejects(rpc("admin_save_team_season", { ...team, expected_updated_at: team.updated_at, state: "published" }), { code: "40001" });
});

test("RPCs negam anônimo, membro e administrador desativado mesmo fora da interface", async () => {
  const { input } = await fixture();
  for (const user of [member, disabled]) {
    await assert.rejects(rpc("admin_save_organization", input, user), { code: "42501" });
    await assert.rejects(rpc("admin_save_season", { year: 9999, name: "Negado", publication_status: "published" }, user), { code: "42501" });
    await assert.rejects(rpc("admin_save_team_season", {}, user), { code: "42501" });
  }
  await assert.rejects(rpc("admin_save_organization", input, null, "anon"), { code: "42501" });
});

test("mais de oito participações e múltiplas temporadas não duplicam a organização", async () => {
  const { input } = await fixture();
  let id;
  for (let i = 0; i < 9; i++) id = await rpc("admin_save_organization", { ...input, slug: `${input.slug}-${i}`, partner_status: i % 2 ? "visitor" : "qualifier" });
  assert.equal((await db.query("select count(*)::int as n from public.team_seasons where season_id=$1", [input.season_id])).rows[0].n, 9);
  const { season } = await fixture();
  await rpc("admin_save_team_season", { organization_id: id, season_id: season, region_id: input.region_id, partner_status: "partner", state: "published" });
  assert.equal((await db.query("select count(*)::int as n from public.team_seasons where organization_id=$1", [id])).rows[0].n, 2);
  await assert.rejects(rpc("admin_save_team_season", { organization_id: id, season_id: season, region_id: input.region_id, partner_status: "partner", state: "published" }), { code: "23505" });
});

test("SDK envia RPC com JWT e só confirma UUID; traduz conflito e falha de rede", async (t) => {
  const input = { name: "Test", slug: "test", publication_status: "draft", season_id: randomUUID(), region_id: randomUUID() };
  const id = randomUUID(); let mode = "ok";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(String(url), /\/rest\/v1\/rpc\/admin_save_organization$/);
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer isolated-token");
    assert.equal(JSON.parse(init.body).payload.name, "Test");
    if (mode === "network") throw new Error("private error");
    return new Response(JSON.stringify(mode === "ok" ? id : { code: "40001" }), { status: mode === "ok" ? 200 : 400 });
  });
  const client = createAdminAuthClient({ url: "https://test.supabase.co", key: "sb_publishable_test" }, "isolated-token");
  assert.deepEqual(await saveOrganizationRecord(client, "organization", input), { status: "saved", id });
  mode = "conflict"; assert.equal((await saveOrganizationRecord(client, "organization", input)).status, "conflict");
  mode = "network"; assert.equal((await saveOrganizationRecord(client, "organization", input)).status, "unavailable");
});

test("leitura administrativa pagina sem teto e falha explicitamente quando incompleta", async (t) => {
  let incomplete = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset") ?? 0);
    const org = parsed.pathname.endsWith("organizations");
    const data = org && (!incomplete || offset === 0) ? [{ id: `row-${offset}`, name: "Test" }] : [];
    return new Response(JSON.stringify(data), { headers: { "Content-Range": `${offset}-${offset}/${org ? 3 : 0}` } });
  });
  const client = createAdminAuthClient({ url: "https://test.supabase.co", key: "sb_publishable_test" }, "isolated-token");
  assert.equal((await readOrganizationData(client)).organizations.length, 3);
  incomplete = true;
  await assert.rejects(readOrganizationData(client), /indisponível/);
});
