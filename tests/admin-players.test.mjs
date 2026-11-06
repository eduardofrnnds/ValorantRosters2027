import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";
import { playerSchema, playerPayload, playerFormValues, slugFromNickname, filterPlayers } from "../src/features/admin/player-model.ts";
import { savePlayerRecord, readAdminPlayers } from "../src/features/admin/player-data.ts";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";
import { createPublicSupabaseClient } from "../src/lib/supabase/public-client.ts";
import { resolvePublicPlayer, readPublicPlayerProfile } from "../src/features/players/public-player-reader.ts";

let db;
const admin = randomUUID(), member = randomUUID(), disabled = randomUUID();
before(async () => {
  ({ db } = await createTestDatabase());
  for (const id of [admin, member, disabled]) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into public.admin_users(user_id,is_active) values($1,true),($2,false)", [admin, disabled]);
});
after(async () => db?.close());
const newInput = (extra = {}) => playerSchema.parse({ id: randomUUID(), nickname: "Jogador de teste", publication_status: "draft", ...extra });
const save = (input, user = admin, role = "authenticated") => db.transaction(async (tx) => {
  await tx.exec(`set local role ${role}`);
  await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
  return (await tx.query("select public.admin_save_player($1::jsonb) as id", [JSON.stringify(playerPayload(input))])).rows[0].id;
});
const row = async (id) => (await db.query("select to_jsonb(p) as row from public.players p where id=$1", [id])).rows[0]?.row;
const publicAliases = (id) => db.transaction(async (tx) => {
  await tx.exec("set local role anon");
  return (await tx.query("select slug from public.player_slug_history where player_id=$1 order by slug", [id])).rows.map((entry) => entry.slug);
});

test("schema valida perfil, slugs e links; geração normaliza nickname sem usá-lo como ID", () => {
  const input = newInput({ nickname: " Águia #1 " });
  assert.equal(slugFromNickname(input.nickname), "aguia-1");
  assert.equal(slugFromNickname("中文"), "jogador");
  assert.equal(slugFromNickname("a".repeat(100)).length, 80);
  for (const extra of [{ nickname: " " }, { slug: "Nick inválido" }, { id: "nickname" }, { role: "starter" }, { website: "javascript:alert(1)" }, { x: "https://user:pass@example.test" }, { photo_url: "data:image/png;base64,a" }]) assert.equal(playerSchema.safeParse({ ...input, ...extra }).success, false);
  assert.equal(playerSchema.safeParse({ ...input, expected_updated_at: new Date().toISOString() }).success, false);
  assert.deepEqual(playerPayload(newInput({ website: "https://example.test" })).links, { website: "https://example.test" });
  assert.equal(filterPlayers([{ id: "a", nickname: "Águia", slug: "aguia", nationality: "Brasil" }], "aguia").length, 1);
});

test("slugs automáticos são únicos mesmo com nickname igual e replay não duplica identidade", async () => {
  const one = newInput({ nickname: "Mesmo nickname" });
  const two = newInput({ nickname: "Mesmo nickname" });
  assert.equal(await save(one), one.id);
  assert.equal(await save(two), two.id);
  assert.equal((await row(one.id)).slug, "mesmo-nickname");
  assert.equal((await row(two.id)).slug, "mesmo-nickname-2");
  await assert.rejects(save(one), { code: "23505" });
  assert.equal((await db.query("select count(*)::int as n from public.players where nickname='Mesmo nickname'")).rows[0].n, 2);
});

test("edição mantém ID e vínculos; nome/nickname/foto/links não criam outro jogador", async () => {
  const input = newInput({ slug: "stable-player", publication_status: "published" });
  await save(input);
  const region = (await db.query("insert into public.regions(slug,name) values('test-region','Região isolada') returning id")).rows[0].id;
  const season = (await db.query("insert into public.seasons(year,name) values(2027,'Temporada isolada') returning id")).rows[0].id;
  const org = (await db.query("insert into public.organizations(slug,name) values('test-org','Org isolada') returning id")).rows[0].id;
  const team = (await db.query("insert into public.team_seasons(organization_id,season_id,region_id,partner_status) values($1,$2,$3,'partner') returning id", [org, season, region])).rows[0].id;
  const membership = (await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date) values($1,$2,'starter','2027-01-01') returning id", [input.id, team])).rows[0].id;
  const old = await row(input.id);
  const edited = playerSchema.parse({ ...playerFormValues(old), nickname: "Novo nick", name: "Nome confirmado", nationality: "Brasil", role: "flex", photo_url: "/foto.png", website: "https://example.test" });
  assert.equal(await save(edited), input.id);
  assert.equal((await row(input.id)).nickname, "Novo nick");
  assert.equal((await row(input.id)).links.website, "https://example.test");
  assert.equal((await db.query("select player_id from public.roster_memberships where id=$1", [membership])).rows[0].player_id, input.id);
  await db.query("update public.roster_memberships set end_date='2027-02-01' where id=$1", [membership]);
  assert.ok(await row(input.id));
  await assert.rejects(save({ ...edited, nickname: "Stale nickname" }), { code: "40001" });
  assert.equal((await row(input.id)).nickname, "Novo nick");
});

test("aliases públicos são reservados, privados não vazam e retornar ao próprio slug é permitido", async () => {
  const input = newInput({ slug: "private-only-slug" });
  await save(input);
  let current = await row(input.id);
  await save(playerSchema.parse({ ...playerFormValues(current), slug: "first-public-slug", publication_status: "published" }));
  current = await row(input.id);
  await save(playerSchema.parse({ ...playerFormValues(current), slug: "second-public-slug" }));
  assert.deepEqual(await publicAliases(input.id), ["first-public-slug", "second-public-slug"]);
  for (const slug of ["private-only-slug", "first-public-slug", "second-public-slug"]) await assert.rejects(save(newInput({ slug })), { code: "23505" });
  current = await row(input.id);
  await save(playerSchema.parse({ ...playerFormValues(current), slug: "first-public-slug" }));
  assert.equal((await row(input.id)).slug, "first-public-slug");
  current = await row(input.id);
  await save(playerSchema.parse({ ...playerFormValues(current), publication_status: "draft" }));
  assert.deepEqual(await publicAliases(input.id), []);
});

test("slug ocupado por histórico força sufixo e conflito faz rollback de perfil e auditoria", async () => {
  const input = newInput({ nickname: "Reserved auto", slug: "reserved-auto", publication_status: "published" });
  await save(input);
  let current = await row(input.id);
  await save(playerSchema.parse({ ...playerFormValues(current), slug: "moved-auto" }));
  const fresh = newInput({ nickname: "Reserved auto" });
  await save(fresh);
  assert.equal((await row(fresh.id)).slug, "reserved-auto-2");
  const before = (await db.query("select count(*)::int as n from public.audit_logs")).rows[0].n;
  current = await row(input.id);
  await assert.rejects(save(playerSchema.parse({ ...playerFormValues(current), slug: "reserved-auto-2", nickname: "Never saved" })), { code: "23505" });
  assert.equal((await row(input.id)).nickname, input.nickname);
  assert.equal((await db.query("select count(*)::int as n from public.audit_logs")).rows[0].n, before);
});

test("RPC e RLS bloqueiam anônimo, usuário comum e admin desativado; sem DELETE", async () => {
  for (const user of [member, disabled]) await assert.rejects(save(newInput(), user), { code: "42501" });
  await assert.rejects(save(newInput(), null, "anon"), { code: "42501" });
  await assert.rejects(db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
    await tx.exec("delete from public.players");
  }), { code: "42501" });
});

test("SDK envia RPC com JWT, valida antes de gravar e não confirma resposta desconhecida", async (t) => {
  const input = newInput(); let calls = 0, fail = false;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls++; assert.match(String(url), /\/rpc\/admin_save_player$/);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer isolated-token");
    assert.equal(JSON.parse(init.body).payload.slug_base, "jogador-de-teste");
    return new Response(JSON.stringify(fail ? { code: "23505" } : input.id), { status: fail ? 400 : 200 });
  });
  const client = createAdminAuthClient({ url: "https://test.supabase.co", key: "sb_publishable_test" }, "isolated-token");
  assert.equal((await savePlayerRecord(client, {})).status, "invalid"); assert.equal(calls, 0);
  assert.deepEqual(await savePlayerRecord(client, input), { status: "saved", id: input.id });
  fail = true; assert.equal((await savePlayerRecord(client, input)).status, "duplicate");
});

test("leitura administrativa completa todas as páginas; ausência de registros difere de falha", async (t) => {
  let fail = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (fail) return new Response("{}", { status: 503 });
    const offset = Number(new URL(url).searchParams.get("offset") ?? 0);
    return new Response(JSON.stringify([{ id: String(offset) }]), { headers: { "Content-Range": `${offset}-${offset}/3` } });
  });
  const client = createAdminAuthClient({ url: "https://test.supabase.co", key: "sb_publishable_test" }, "isolated-token");
  assert.equal((await readAdminPlayers(client)).length, 3);
  fail = true; await assert.rejects(readAdminPlayers(client), /indisponíveis/);
});

test("resolução pública usa alias publicado, alvo atual e nunca um token administrativo", async (t) => {
  const id = randomUUID(); let hidden = false;
  const fixture = { id, nickname: "Fixture", slug: "current-slug", name: null, nationality: null, role: null, photo_url: null, links: {}, publication_status: "published" };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sb_publishable_test");
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("player_slug_history")) {
      assert.equal(parsed.searchParams.get("was_published"), "eq.true");
      return new Response(JSON.stringify(hidden ? [] : [{ player_id: id }]));
    }
    assert.equal(parsed.searchParams.get("publication_status"), "eq.published");
    return new Response(JSON.stringify(parsed.searchParams.get("id") ? [fixture] : []));
  });
  const client = createPublicSupabaseClient({ url: "https://test.supabase.co", key: "sb_publishable_test" });
  assert.equal((await resolvePublicPlayer(client, "old-slug")).slug, "current-slug");
  hidden = true; assert.equal(await resolvePublicPlayer(client, "private-slug"), null);
  assert.equal(await resolvePublicPlayer(client, "../../unsafe"), null);
});

test("perfil público sem vínculos não inventa equipe; erros de carreira não viram vazio", async (t) => {
  const id = randomUUID(); let fail = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.ok(String(url).includes("roster_memberships"));
    assert.equal(new URL(url).searchParams.get("player_id"), `eq.${id}`);
    return new Response(JSON.stringify(fail ? {} : []), { status: fail ? 503 : 200, headers: { "Content-Range": "*/0" } });
  });
  const client = createPublicSupabaseClient({ url: "https://test.supabase.co", key: "sb_publishable_test" });
  const fixture = { id, nickname: "Fixture", slug: "fixture", name: null, nationality: null, role: null, photo_url: null, links: { website: "https://example.test" }, publication_status: "published" };
  const profile = await readPublicPlayerProfile(client, fixture);
  assert.deepEqual(profile.currentMemberships, []); assert.deepEqual(profile.pastMemberships, []);
  assert.deepEqual(profile.player.links, [{ label: "Site", url: "https://example.test" }]);
  fail = true; await assert.rejects(readPublicPlayerProfile(client, fixture), /indisponível/);
});
