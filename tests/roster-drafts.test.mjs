import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";
import { currentRoster, rosterDiff, starterConflicts, saveDraftSchema } from "../src/features/admin/roster-draft-model.ts";
import { saveRosterDraft, archiveRosterDraft } from "../src/features/admin/roster-draft-data.ts";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";
import { createPublicSupabaseClient } from "../src/lib/supabase/public-client.ts";
import { readPublishedTeamRoster } from "../src/features/rosters/public-roster-reader.ts";

let db;
const admin = randomUUID(), member = randomUUID(), disabled = randomUUID();
before(async () => {
  ({ db } = await createTestDatabase());
  for (const id of [admin, member, disabled]) await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query("insert into public.admin_users(user_id,is_active) values($1,true),($2,false)", [admin, disabled]);
});
after(async () => db?.close());
const role = (user, fn, name = "authenticated") => db.transaction(async (tx) => {
  await tx.exec(`set local role ${name}`);
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
  return fn(tx);
});
const save = (input, user = admin, name) => role(user, async (tx) => (await tx.query("select public.admin_save_roster_draft($1::jsonb) as id", [JSON.stringify(input)])).rows[0].id, name);
const archive = (row, user = admin) => role(user, async (tx) => (await tx.query("select public.admin_archive_roster_draft($1,$2::timestamptz) as id", [row.id, row.updated_at])).rows[0].id);
const rows = async (table) => (await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map((entry) => entry.row);
const draftRow = async (id) => (await rows("roster_drafts")).find((entry) => entry.id === id);
async function fixture() {
  const suffix = randomUUID();
  const region = (await db.query("insert into public.regions(slug,name,publication_status,published_at) values($1,'Região isolada','published',now()) returning id", [`r-${suffix}`])).rows[0].id;
  const year = 3000 + (await rows("seasons")).length;
  const season = (await db.query("insert into public.seasons(year,name,publication_status,published_at) values($1,'Temporada isolada','published',now()) returning id", [year])).rows[0].id;
  const teams = [];
  for (const index of [0,1]) {
    const org = (await db.query("insert into public.organizations(slug,name,publication_status,published_at) values($1,'Organização isolada','published',now()) returning id", [`org-${suffix}-${index}`])).rows[0].id;
    teams.push((await db.query("insert into public.team_seasons(organization_id,season_id,region_id,partner_status,publication_status,published_at) values($1,$2,$3,'partner','published',now()) returning id", [org, season, region])).rows[0].id);
  }
  const players = [];
  for (const index of [0,1,2]) players.push((await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values($1,'Fixture','flex','published',now()) returning id", [`p-${suffix}-${index}`])).rows[0].id);
  for (const index of [0,1]) await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2027-01-01','published',now())", [players[index], teams[index]]);
  const input = await inputFor(teams[0]);
  return { input, players, teams, season };
}
async function inputFor(teamId) {
  const memberships = await rows("roster_memberships"), players = await rows("players");
  const base = currentRoster(memberships, players, teamId, "2027-01-15");
  return { id: randomUUID(), team_season_id: teamId, expected_updated_at: "", base_revision: 0,
    payload: { version: 1, effective_on: "2027-01-15", base_members: base, members: base.map(({ player_id,status,role }) => ({ player_id,status,role })) } };
}
const publicState = async () => ({ memberships: await rows("roster_memberships"), players: await rows("players"), teams: await rows("team_seasons"), changes: await rows("roster_changes") });

test("base do editor coincide com snapshot SQL, respeita datas inclusivas e ignora privados", async () => {
  const f = await fixture();
  const sql = await role(admin, async (tx) => (await tx.query("select private.roster_snapshot($1,$2::date) as snapshot", [f.teams[0], "2027-01-15"])).rows[0].snapshot);
  assert.deepEqual(f.input.payload.base_members, sql);
  const memberships = await rows("roster_memberships"), players = await rows("players");
  const relevant = memberships.find((entry) => entry.team_season_id === f.teams[0]);
  assert.equal(currentRoster([{ ...relevant, end_date: "2027-01-15" }], players, f.teams[0], "2027-01-15").length, 1);
  assert.equal(currentRoster([{ ...relevant, end_date: "2027-01-14" }], players, f.teams[0], "2027-01-15").length, 0);
  assert.equal(currentRoster([{ ...relevant, publication_status: "draft" }], players, f.teams[0], "2027-01-15").length, 0);
});

test("salvar entradas/status/função/saídas altera apenas rascunho e auditoria", async () => {
  const f = await fixture();
  const before = await publicState();
  f.input.payload.members = [{ player_id: f.players[2], status: "coach", role: "coach" }];
  assert.equal(await save(f.input), f.input.id);
  assert.deepEqual(await publicState(), before);
  let draft = await draftRow(f.input.id);
  assert.equal(draft.created_by, admin); assert.equal(draft.status, "draft");
  assert.equal(draft.payload.members[0].status, "coach");
  const diff = rosterDiff(draft.payload.base_members, draft.payload.members);
  assert.equal(diff.added.length, 1); assert.equal(diff.removed.length, 1);
  const updated = { ...f.input, expected_updated_at: draft.updated_at, payload: { ...draft.payload, members: [{ player_id: f.players[0], status: "reserve", role: "sentinel" }] } };
  await save(updated);
  draft = await draftRow(f.input.id);
  assert.equal(rosterDiff(draft.payload.base_members, draft.payload.members).changed.length, 1);
  assert.deepEqual(await publicState(), before);
  const logs = (await rows("audit_logs")).filter((entry) => entry.record_id === draft.id);
  assert.ok(logs.length === 2 && logs.every((entry) => entry.actor_id === admin && entry.table_name === "roster_drafts"));
});

test("Zod e SQL rejeitam duplicados, desconhecidos e snapshot falsificado", async () => {
  const f = await fixture();
  const duplicate = { ...f.input, payload: { ...f.input.payload, members: [f.input.payload.members[0], f.input.payload.members[0]] } };
  assert.equal(saveDraftSchema.safeParse(duplicate).success, false);
  await assert.rejects(save(duplicate), { code: "23514" });
  await assert.rejects(save({ ...f.input, payload: { ...f.input.payload, members: [{ player_id: randomUUID(), status: "starter", role: null }] } }), { code: "23503" });
  await assert.rejects(save({ ...f.input, payload: { ...f.input.payload, base_members: [] } }), { code: "40001" });
  assert.equal(await draftRow(f.input.id), undefined);
});

test("titular publicado em outra equipe bloqueia proposta; reserva não implica transferência", async () => {
  const f = await fixture();
  const member = { player_id: f.players[1], status: "starter", role: "flex" };
  const conflicting = { ...f.input, payload: { ...f.input.payload, members: [member] } };
  await assert.rejects(save(conflicting), { code: "P0001" });
  const conflicts = starterConflicts({ members: [member], teamId: f.teams[0], seasonId: f.season, date: "2027-01-15", teams: await rows("team_seasons"), memberships: await rows("roster_memberships"), drafts: [] });
  assert.equal(conflicts[0].teamId, f.teams[1]);
  const before = await publicState();
  await save({ ...f.input, payload: { ...f.input.payload, members: [{ ...member, status: "reserve" }] } });
  assert.deepEqual(await publicState(), before);
});

test("outro rascunho aberto disputa titular na temporada; arquivar libera a proposta", async () => {
  const f = await fixture();
  f.input.payload.members = [{ player_id: f.players[2], status: "starter", role: null }];
  await save(f.input);
  const second = await inputFor(f.teams[1]);
  second.payload.members = f.input.payload.members;
  await assert.rejects(save(second), { code: "P0001" });
  const current = await draftRow(f.input.id);
  await archive(current);
  assert.equal((await draftRow(f.input.id)).status, "archived");
  await save(second);
  assert.equal((await draftRow(second.id)).status, "draft");
});

test("versão do rascunho e revisão/snapshot publicados impedem sobrescrita", async () => {
  const f = await fixture();
  await save(f.input);
  let current = await draftRow(f.input.id);
  const update = { ...f.input, expected_updated_at: current.updated_at };
  await save(update);
  await assert.rejects(save(update), { code: "40001" });
  current = await draftRow(f.input.id);
  await db.query("update public.roster_memberships set status='reserve' where team_season_id=$1", [f.teams[0]]);
  await assert.rejects(save({ ...f.input, expected_updated_at: current.updated_at }), { code: "40001" });
  await db.query("update public.team_seasons set roster_revision=1 where id=$1", [f.teams[0]]);
  await assert.rejects(save({ ...f.input, expected_updated_at: current.updated_at }), { code: "40001" });
});

test("data/base/autor ficam fixos; arquivamento mantém payload e reenvio não duplica", async () => {
  const f = await fixture();
  await save(f.input);
  await assert.rejects(save(f.input), { code: "23505" });
  const current = await draftRow(f.input.id);
  await assert.rejects(save({ ...f.input, expected_updated_at: current.updated_at, payload: { ...f.input.payload, effective_on: "2027-01-16" } }), { code: "40001" });
  await archive(current);
  assert.deepEqual((await draftRow(current.id)).payload, current.payload);
  await assert.rejects(archive(current), { code: "40001" });
  await assert.rejects(save({ ...f.input, expected_updated_at: current.updated_at }), { code: "40001" });
  assert.equal(await save({ ...f.input, id: randomUUID() }) !== f.input.id, true);
});

test("participação arquivada e rascunho antigo aberto exigem revisão", async () => {
  const f = await fixture();
  await db.query("insert into public.roster_drafts(team_season_id,created_by) values($1,$2)", [f.teams[0], admin]);
  await assert.rejects(save(f.input), { code: "23505" });
  await db.query("update public.team_seasons set publication_status='draft',published_at=null,archived_at=now() where id=$1", [f.teams[1]]);
  await assert.rejects(save(await inputFor(f.teams[1])), { code: "P0001" });
});

test("RLS/servidor negam escrita/leitura privada a não admin e nenhum status publicado é aceito", async () => {
  const f = await fixture();
  for (const user of [member, disabled]) await assert.rejects(save(f.input, user), { code: "42501" });
  await assert.rejects(save(f.input, null, "anon"), { code: "42501" });
  await save(f.input);
  const privateRows = await role(member, async (tx) => (await tx.query("select id from public.roster_drafts")).rows);
  assert.deepEqual(privateRows, []);
  await assert.rejects(archive(await draftRow(f.input.id), member), { code: "42501" });
  assert.equal(saveDraftSchema.safeParse({ ...f.input, status: "published" }).success, false);
});

test("SDK de rascunho usa JWT e só confirma identidade; valida antes de escrever", async (t) => {
  const id = randomUUID(); let calls = 0;
  const input = { id, team_season_id: randomUUID(), expected_updated_at: "", base_revision: 0, payload: { version: 1, effective_on: "2027-01-15", base_members: [], members: [] } };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls++; assert.equal(new Headers(init.headers).get("authorization"), "Bearer isolated-token");
    assert.match(String(url), /\/rpc\/admin_(save|archive)_roster_draft$/);
    return new Response(JSON.stringify(id));
  });
  const client = createAdminAuthClient({ url: "https://test.supabase.co", key: "sb_publishable_test" }, "isolated-token");
  assert.equal((await saveRosterDraft(client, {})).status, "invalid"); assert.equal(calls, 0);
  assert.deepEqual(await saveRosterDraft(client, input), { status: "saved", id });
  assert.equal((await archiveRosterDraft(client, { id, expected_updated_at: new Date().toISOString() })).status, "saved");
});

test("elenco público consulta somente vínculos/perfis publicados e exclui encerrados/futuros", async (t) => {
  const org = randomUUID(), season = randomUUID(), team = randomUUID(), player = randomUUID();
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const parsed = new URL(url);
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer sb_publishable_test");
    assert.equal(parsed.searchParams.get("publication_status"), "eq.published");
    assert.ok(!parsed.pathname.includes("draft"));
    let data;
    if (parsed.pathname.endsWith("team_seasons")) data = [{ id: team }];
    else if (parsed.pathname.endsWith("roster_memberships")) data = [
      { player_id: player, status: "starter", role: "controller", role_is_explicit: true, start_date: "2027-01-01", end_date: null, publication_status: "published" },
      { player_id: randomUUID(), status: "starter", start_date: "2027-02-01", end_date: null, publication_status: "published" },
      { player_id: randomUUID(), status: "reserve", start_date: "2026-01-01", end_date: "2026-12-31", publication_status: "published" },
    ];
    else data = [{ id: player, nickname: "Fixture", slug: "fixture", role: "flex", publication_status: "published" }];
    return new Response(JSON.stringify(data), { headers: { "Content-Range": `0-${data.length-1}/${data.length}` } });
  });
  const client = createPublicSupabaseClient({ url: "https://test.supabase.co", key: "sb_publishable_test" });
  const roster = await readPublishedTeamRoster(client, org, season, "2027-01-15");
  assert.equal(roster.length, 1); assert.equal(roster[0].player.id, player); assert.equal(roster[0].status, "starter");
  assert.equal(roster[0].player.role, "controller");
});
