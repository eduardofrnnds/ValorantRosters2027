import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";
import { currentRoster } from "../src/features/admin/roster-draft-model.ts";
import { publishRosterDraft } from "../src/features/admin/roster-draft-data.ts";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";

let db, nextYear = 3100;
const admin = randomUUID(), member = randomUUID();
before(async () => {
  ({ db } = await createTestDatabase());
  await db.query("insert into auth.users(id) values($1),($2)", [admin,member]);
  await db.query("insert into public.admin_users(user_id,is_active) values($1,true)", [admin]);
});
after(async () => db?.close());
const rows = async (table) => (await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map(({ row }) => row);
const run = (user, fn, name = "authenticated") => db.transaction(async (tx) => {
  await tx.exec(`set local role ${name}`);
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
  return fn(tx);
});
const rpc = (name, input, user = admin, role) => run(user, async (tx) => (await tx.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(input)])).rows[0].result, role);
const publish = (input, user, role) => rpc("admin_publish_roster_draft",input,user,role);
const state = async () => Object.fromEntries(await Promise.all(["players","roster_memberships","roster_changes","roster_drafts","team_seasons","audit_logs"].map(async (table) => [table, await rows(table)])));
async function fixture() {
  const region = (await db.query("insert into public.regions(slug,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id", [`r-${randomUUID()}`])).rows[0].id;
  const season = (await db.query("insert into public.seasons(year,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id", [nextYear++])).rows[0].id;
  const teams = [];
  for (let i=0;i<2;i++) {
    const org = (await db.query("insert into public.organizations(slug,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id", [`o-${randomUUID()}`])).rows[0].id;
    teams.push((await db.query("insert into public.team_seasons(organization_id,season_id,region_id,partner_status,publication_status,published_at) values($1,$2,$3,'partner','published',now()) returning id", [org,season,region])).rows[0].id);
  }
  const players = [];
  for (let i=0;i<4;i++) players.push((await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values($1,'Fixture','flex','published',now()) returning id", [`p-${randomUUID()}`])).rows[0].id);
  for (const player of players.slice(0,3)) await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2027-01-01','published',now())", [player,teams[0]]);
  const base = currentRoster(await rows("roster_memberships"), await rows("players"), teams[0], "2027-01-15");
  const input = { id: randomUUID(), team_season_id: teams[0], expected_updated_at: "", base_revision: 0, payload: { version: 1, effective_on: "2027-01-15", base_members: base, members: [
    { player_id: players[0],status: "reserve",role: "controller" },
    { player_id: players[2],status: "starter",role: "flex" },
    { player_id: players[3],status: "coach",role: null },
  ] } };
  await rpc("admin_save_roster_draft", input);
  const draft = (await rows("roster_drafts")).find((row) => row.id===input.id);
  return { input, players, teams, draft, confirmation: { id: draft.id, expected_updated_at: draft.updated_at, source_url: "https://example.org/announcement", confirm: "publish" } };
}

test("publicação atômica preserva vínculos, função, auditoria e metadados; replay não duplica", async () => {
  const f = await fixture(), before = await state();
  const result = await publish(f.confirmation);
  assert.deepEqual(result,{ id:f.draft.id,team_season_id:f.teams[0],already_published:false });
  const after = await state(), memberships = after.roster_memberships.filter((row) => row.team_season_id===f.teams[0]);
  assert.equal(memberships.length,5);
  const unchanged = f.input.payload.base_members.find((row) => row.player_id===f.players[2]);
  assert.deepEqual(after.roster_memberships.find((row) => row.id===unchanged.id),before.roster_memberships.find((row) => row.id===unchanged.id));
  for (const player of f.players.slice(0,2)) assert.equal(memberships.find((row) => row.player_id===player && row.start_date==="2027-01-01").end_date,"2027-01-14");
  const replacement = memberships.find((row) => row.player_id===f.players[0] && row.start_date==="2027-01-15");
  assert.equal(replacement.status,"reserve"); assert.equal(replacement.role,"controller"); assert.equal(replacement.role_is_explicit,true);
  const changes = after.roster_changes.filter((row) => row.draft_id===f.draft.id);
  assert.equal(changes.length,3); assert.deepEqual(changes.map((row) => row.change_type).sort(),["joined","left","status_changed"]);
  for (const change of changes) { assert.equal(change.published_by,admin); assert.equal(change.source_url,f.confirmation.source_url); assert.equal(change.occurred_on,"2027-01-15"); assert.ok(change.published_at); assert.ok(change.after_snapshot); }
  const altered = changes.find((row) => row.change_type==="status_changed");
  assert.equal(altered.before_snapshot.id,f.input.payload.base_members.find((row) => row.player_id===f.players[0]).id);
  assert.equal(altered.after_snapshot.id,replacement.id);
  assert.equal(altered.before_snapshot.effective_role,"flex"); assert.equal(altered.after_snapshot.effective_role,"controller");
  assert.deepEqual(after.players,before.players);
  assert.equal(after.team_seasons.find((row) => row.id===f.teams[0]).roster_revision,1);
  const saved = after.roster_drafts.find((row) => row.id===f.draft.id);
  assert.equal(saved.status,"published"); assert.equal(saved.published_by,admin); assert.deepEqual(saved.payload,f.draft.payload);
  assert.ok(after.audit_logs.some((row) => row.table_name==="roster_changes" && row.actor_id===admin));
  assert.equal((await publish(f.confirmation)).already_published,true);
  assert.deepEqual(await state(),after);
  await assert.rejects(publish({ ...f.confirmation,source_url:"https://example.org/changed" }),{ code:"40001" });
  await assert.rejects(db.query("update public.roster_drafts set status='draft',published_at=null where id=$1",[f.draft.id]),{ code:"23514" });
  const publicRows = await run(null, async (tx) => (await tx.query("select id from public.roster_memberships where team_season_id=$1",[f.teams[0]])).rows,"anon");
  assert.equal(publicRows.length,5);
  const current = currentRoster(memberships,after.players,f.teams[0],"2027-01-15");
  assert.equal(current.length,3); assert.equal(current.find((row) => row.player_id===f.players[3]).role,null);
  assert.equal(currentRoster(memberships,after.players,f.teams[0],"2027-01-14").find((row) => row.player_id===f.players[0]).role,"flex");
});

test("falha depois de inserir mudanças desfaz vínculos, revisão, rascunho e auditoria", async () => {
  const f = await fixture(), before = await state();
  await db.exec(`create function public.fail_publication_test() returns trigger language plpgsql as $$ begin raise exception 'Injected failure'; end; $$;
    create trigger fail_publication_test before update on public.team_seasons for each row execute function public.fail_publication_test();`);
  try { await assert.rejects(publish(f.confirmation),/Injected failure/); assert.deepEqual(await state(),before); }
  finally { await db.exec("drop trigger fail_publication_test on public.team_seasons; drop function public.fail_publication_test()"); }
  assert.equal((await publish(f.confirmation)).already_published,false);
});

test("confirmação, fonte e autorização são obrigatórias dentro da RPC", async () => {
  const f = await fixture(), before = await state();
  for (const input of [{ ...f.confirmation,confirm:undefined },{ ...f.confirmation,confirm:"false" },{ ...f.confirmation,source_url:"javascript:alert(1)" },{ ...f.confirmation,source_url:"https://user:pass@example.org" }]) await assert.rejects(publish(input),{ code:"22023" });
  await assert.rejects(publish(f.confirmation,member),{ code:"42501" });
  await assert.rejects(publish(f.confirmation,null,"anon"),{ code:"42501" });
  await db.query("update public.admin_users set is_active=false where user_id=$1",[admin]);
  try { await assert.rejects(publish(f.confirmation),{ code:"42501" }); }
  finally { await db.query("update public.admin_users set is_active=true where user_id=$1",[admin]); }
  // Admin allowlist updates have their own audit records; roster state stays intact.
  const after = await state(); delete before.audit_logs; delete after.audit_logs; assert.deepEqual(after,before);
});

test("edição concorrente, revisão e snapshot desatualizados bloqueiam publicação", async () => {
  for (const kind of ["draft","revision","snapshot"]) {
    const f = await fixture();
    if (kind==="draft") await rpc("admin_save_roster_draft",{ ...f.input,expected_updated_at:f.draft.updated_at });
    if (kind==="revision") await db.query("update public.team_seasons set roster_revision=1 where id=$1",[f.teams[0]]);
    if (kind==="snapshot") await db.query("update public.roster_memberships set status='inactive' where team_season_id=$1 and player_id=$2",[f.teams[0],f.players[0]]);
    const before = await state(); await assert.rejects(publish(f.confirmation),{ code:"40001" }); assert.deepEqual(await state(),before);
  }
});

test("perfil, participação ou região privados após salvar impedem publicação", async () => {
  for (const kind of ["players","team_seasons","regions"]) {
    const f = await fixture();
    const id = kind==="players" ? f.players[3] : kind==="team_seasons" ? f.teams[0] : (await rows("team_seasons")).find((row) => row.id===f.teams[0]).region_id;
    await db.query(`update public.${kind} set publication_status='draft',published_at=null where id=$1`,[id]);
    const before = await state(); await assert.rejects(publish(f.confirmation),{ code:"P0001" }); assert.deepEqual(await state(),before);
  }
});

test("conflitos futuros de titular ou de vínculo na mesma equipe são revalidados", async () => {
  for (const otherTeam of [true,false]) {
    const f = await fixture();
    const proposal = { ...f.input,expected_updated_at:f.draft.updated_at,payload:{ ...f.input.payload,members:[...f.input.payload.members.filter((row) => row.player_id!==f.players[3]),{ player_id:f.players[3],status:"starter",role:"flex" }] } };
    await rpc("admin_save_roster_draft",proposal);
    f.confirmation.expected_updated_at=(await rows("roster_drafts")).find((row) => row.id===f.draft.id).updated_at;
    await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2027-02-01','published',now())",[f.players[3],f.teams[otherTeam?1:0]]);
    const before = await state(); await assert.rejects(publish(f.confirmation),{ code:"P0001" }); assert.deepEqual(await state(),before);
  }
});

test("encerramento no mesmo dia de início é bloqueado; fim já agendado é preservado", async () => {
  for (const sameDay of [true,false]) {
    const f = await fixture();
    await db.query(sameDay ? "update public.roster_memberships set start_date='2027-01-15' where team_season_id=$1 and player_id=$2" : "update public.roster_memberships set end_date='2027-01-31' where team_season_id=$1 and player_id=$2",[f.teams[0],f.players[0]]);
    const base = currentRoster(await rows("roster_memberships"),await rows("players"),f.teams[0],"2027-01-15");
    // Deliberately import a fresh saved draft baseline, simulating archive/new draft.
    await db.query("update public.roster_drafts set status='archived' where id=$1",[f.draft.id]);
    const id=randomUUID(); await rpc("admin_save_roster_draft",{ ...f.input,id,payload:{ ...f.input.payload,base_members:base } });
    const confirmation={ ...f.confirmation,id,expected_updated_at:(await rows("roster_drafts")).find((row) => row.id===id).updated_at };
    if (sameDay) { const before=await state(); await assert.rejects(publish(confirmation),{ code:"P0001" }); assert.deepEqual(await state(),before); }
    else { await publish(confirmation); assert.equal((await rows("roster_memberships")).find((row) => row.player_id===f.players[0] && row.start_date==="2027-01-15").end_date,"2027-01-31"); }
  }
});

test("rascunho arquivado, formato inválido e proposta sem mudanças não publicam", async () => {
  for (const kind of ["archived","invalid","empty"]) {
    const f=await fixture();
    if(kind==="archived") await db.query("update public.roster_drafts set status='archived' where id=$1",[f.draft.id]);
    if(kind==="invalid") await db.query("update public.roster_drafts set payload='{}'::jsonb where id=$1",[f.draft.id]);
    if(kind==="empty") await rpc("admin_save_roster_draft",{ ...f.input,expected_updated_at:f.draft.updated_at,payload:{ ...f.input.payload,members:f.input.payload.base_members.map(({player_id,status,role})=>({player_id,status,role})) } });
    f.confirmation.expected_updated_at=(await rows("roster_drafts")).find((row)=>row.id===f.draft.id).updated_at;
    const before=await state(); await assert.rejects(publish(f.confirmation),{ code:kind==="archived" ? "40001" : "22023" }); assert.deepEqual(await state(),before);
  }
});

test("SDK valida confirmação e não interpreta resposta incompleta como sucesso", async (t) => {
  const input={ id:randomUUID(),expected_updated_at:new Date().toISOString(),source_url:"",confirm:"publish" },team=randomUUID(); let calls=0,mode="ok";
  t.mock.method(globalThis,"fetch",async (url,init)=>{
    calls++; assert.match(String(url),/\/rpc\/admin_publish_roster_draft$/); assert.equal(new Headers(init.headers).get("authorization"),"Bearer isolated-token");
    assert.deepEqual(JSON.parse(init.body),{input});
    return mode==="denied" ? new Response(JSON.stringify({code:"42501"}),{status:403}) : new Response(JSON.stringify(mode==="ok" ? {id:input.id,team_season_id:team,already_published:false} : {}));
  });
  const client=createAdminAuthClient({url:"https://test.supabase.co",key:"sb_publishable_test"},"isolated-token");
  assert.equal((await publishRosterDraft(client,{...input,confirm:undefined})).status,"invalid"); assert.equal(calls,0);
  assert.equal((await publishRosterDraft(client,input)).status,"saved");
  mode="bad"; assert.equal((await publishRosterDraft(client,input)).status,"unavailable");
  mode="denied"; assert.equal((await publishRosterDraft(client,input)).status,"denied");
});
