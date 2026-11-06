import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";
import { transferSchema } from "../src/features/admin/transfer-model.ts";
import { transferPlayer } from "../src/features/admin/transfer-data.ts";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";
import { createPublicSupabaseClient } from "../src/lib/supabase/public-client.ts";
import { readRosterTimeline } from "../src/features/transfers/timeline-reader.ts";
import { timelineResultSchema, parseTimelineQuery, timelineHref } from "../src/features/transfers/timeline-model.ts";

let db, year=3300;
const admin=randomUUID(),member=randomUUID();
before(async()=>{
  ({db}=await createTestDatabase());
  await db.query("insert into auth.users(id) values($1),($2)",[admin,member]);
  await db.query("insert into public.admin_users(user_id,is_active) values($1,true)",[admin]);
});
after(async()=>db?.close());
const rows=async(table,schema="public")=>(await db.query(`select to_jsonb(t) as row from ${schema}.${table} t order by id`)).rows.map(({row})=>row);
const run=(user,fn,name="authenticated")=>db.transaction(async tx=>{
  await tx.exec(`set local role ${name}`); await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user??""]); return fn(tx);
});
const transfer=(input,user=admin,name)=>run(user,async tx=>(await tx.query("select public.admin_transfer_player($1::jsonb) as result",[JSON.stringify(input)])).rows[0].result,name);
const timeline=(filters={},user=null,name="anon")=>run(user,async tx=>(await tx.query("select public.read_roster_timeline($1::jsonb) as result",[JSON.stringify(filters)])).rows[0].result,name);
const state=async()=>({...Object.fromEntries(await Promise.all(["players","roster_memberships","roster_changes","team_seasons","roster_drafts","audit_logs"].map(async table=>[table,await rows(table)]))),requests:await rows("roster_transfer_requests","private")});
async function fixture() {
  const regions=[],teams=[],orgs=[];
  const season=(await db.query("insert into public.seasons(year,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id",[year++])).rows[0].id;
  for(let i=0;i<3;i++) {
    const slug=`r-${randomUUID()}`;
    const region=(await db.query("insert into public.regions(slug,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id",[slug])).rows[0].id;
    regions.push({id:region,slug});
    const org=(await db.query("insert into public.organizations(slug,name,publication_status,published_at) values($1,'Fixture','published',now()) returning id",[`o-${randomUUID()}`])).rows[0].id; orgs.push(org);
    teams.push((await db.query("insert into public.team_seasons(organization_id,season_id,region_id,partner_status,publication_status,published_at) values($1,$2,$3,'partner','published',now()) returning id",[org,season,region])).rows[0].id);
  }
  const player=(await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values($1,'Fixture','sentinel','published',now()) returning id",[`p-${randomUUID()}`])).rows[0].id;
  const membership=(await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2027-01-01','published',now()) returning id",[player,teams[0]])).rows[0].id;
  const origin=(await rows("roster_memberships")).find(row=>row.id===membership);
  const input={id:randomUUID(),from_membership_id:membership,to_team_season_id:teams[1],expected_membership_updated_at:origin.updated_at,expected_from_revision:0,expected_to_revision:0,effective_on:"2027-01-15",status:"starter",note:"Registro manual de teste",source_url:"https://example.org/announcement",confirm:"transfer"};
  return {input,teams,orgs,regions,player,origin,season};
}

test("A → B mantém jogador, fecha origem, cria destino e publica evento/auditoria juntos; replay é idempotente",async()=>{
  const f=await fixture(),before=await state(),result=await transfer(f.input),after=await state();
  assert.equal(result.id,f.input.id); assert.equal(result.already_published,false);
  assert.deepEqual(after.players,before.players);
  const old=after.roster_memberships.find(row=>row.id===f.origin.id),next=after.roster_memberships.find(row=>row.player_id===f.player&&row.team_season_id===f.teams[1]);
  assert.equal(old.end_date,"2027-01-14"); assert.equal(old.start_date,"2027-01-01"); assert.equal(old.role,"sentinel");
  assert.equal(next.start_date,"2027-01-15"); assert.equal(next.player_id,f.player); assert.equal(next.role,"sentinel"); assert.equal(next.role_is_explicit,true);
  const event=after.roster_changes.find(row=>row.id===result.change_id);
  assert.equal(event.from_membership_id,old.id); assert.equal(event.to_membership_id,next.id); assert.equal(event.change_type,"transferred"); assert.equal(event.published_by,admin); assert.equal(event.note,f.input.note); assert.equal(event.source_url,f.input.source_url);
  assert.equal(event.before_snapshot.id,old.id); assert.equal(event.after_snapshot.id,next.id); assert.equal(event.before_snapshot.effective_role,"sentinel");
  for(const id of f.teams.slice(0,2)) assert.equal(after.team_seasons.find(row=>row.id===id).roster_revision,1);
  assert.equal(after.team_seasons.find(row=>row.id===f.teams[2]).roster_revision,0);
  assert.ok(after.audit_logs.some(row=>row.table_name==="roster_changes"&&row.record_id===event.id&&row.actor_id===admin));
  assert.equal((await transfer(f.input)).already_published,true); assert.deepEqual(await state(),after);
  await assert.rejects(transfer({...f.input,note:"Outro pedido"}),{code:"40001"});
  const publicFeed=await timeline({player_id:f.player}); assert.equal(publicFeed.total,1); assert.equal(publicFeed.events[0].from.organization_id,f.orgs[0]); assert.equal(publicFeed.events[0].to.organization_id,f.orgs[1]);
  assert.ok(timelineResultSchema.safeParse(publicFeed).success);
});

test("retorno B → A preserva as duas passagens anteriores e um único perfil",async()=>{
  const f=await fixture(); await transfer(f.input);
  const current=(await rows("roster_memberships")).find(row=>row.player_id===f.player&&row.team_season_id===f.teams[1]);
  await transfer({...f.input,id:randomUUID(),from_membership_id:current.id,to_team_season_id:f.teams[0],expected_membership_updated_at:current.updated_at,expected_from_revision:1,expected_to_revision:1,effective_on:"2027-02-01",status:"reserve"});
  const memberships=(await rows("roster_memberships")).filter(row=>row.player_id===f.player).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  assert.equal(memberships.length,3); assert.deepEqual(memberships.map(row=>row.end_date),["2027-01-14","2027-01-31",null]);
  assert.equal(memberships[2].team_season_id,f.teams[0]); assert.equal(memberships[2].status,"reserve");
  assert.equal((await rows("players")).filter(row=>row.id===f.player).length,1);
  const feed=await timeline({player_id:f.player}); assert.equal(feed.total,2); assert.equal(feed.events[0].date,"2027-02-01");
});

test("falha ao atualizar revisões reverte origem, destino, evento, pedido e auditoria",async()=>{
  const f=await fixture(),before=await state();
  await db.exec("create function public.fail_transfer_test() returns trigger language plpgsql as $$ begin raise exception 'Injected transfer failure'; end; $$; create trigger fail_transfer_test before update on public.team_seasons for each row execute function public.fail_transfer_test()");
  try { await assert.rejects(transfer(f.input),/Injected transfer failure/); assert.deepEqual(await state(),before); }
  finally { await db.exec("drop trigger fail_transfer_test on public.team_seasons; drop function public.fail_transfer_test()"); }
  assert.equal((await transfer(f.input)).already_published,false);
});

test("RPC exige admin ativo e confirmação; pedidos privados não ficam acessíveis ao público",async()=>{
  const f=await fixture(),before=await state();
  await assert.rejects(transfer(f.input,member),{code:"42501"}); await assert.rejects(transfer(f.input,null,"anon"),{code:"42501"});
  for(const input of [{...f.input,confirm:""},{...f.input,source_url:"javascript:alert(1)"},{...f.input,note:"x".repeat(1001)}]) await assert.rejects(transfer(input),{code:"22023"});
  assert.deepEqual(await state(),before);
  await db.query("update public.admin_users set is_active=false where user_id=$1",[admin]);
  try { await assert.rejects(transfer(f.input),{code:"42501"}); }
  finally { await db.query("update public.admin_users set is_active=true where user_id=$1",[admin]); }
  await transfer(f.input);
  await assert.rejects(run(null,tx=>tx.query("select * from private.roster_transfer_requests"),"anon"),{code:"42501"});
  assert.deepEqual(await run(member,async tx=>(await tx.query("select * from private.roster_transfer_requests")).rows),[]);
  await assert.rejects(run(admin,tx=>tx.query("delete from private.roster_transfer_requests")),{code:"42501"});
  const feed=JSON.stringify(await timeline({player_id:f.player})); assert.ok(!feed.includes(admin)); assert.ok(!feed.includes("expected_")); assert.ok(!feed.includes("before_snapshot"));
});

test("versões de origem, destino e vínculo são revalidadas, inclusive nova tentativa com outro UUID",async()=>{
  for(const key of ["expected_from_revision","expected_to_revision","expected_membership_updated_at"]) {
    const f=await fixture(),before=await state();
    await assert.rejects(transfer({...f.input,[key]:key.endsWith("updated_at")?"2026-01-01T00:00:00Z":99}),{code:"40001"}); assert.deepEqual(await state(),before);
  }
  const f=await fixture(); await transfer(f.input); const after=await state();
  await assert.rejects(transfer({...f.input,id:randomUUID()}),{code:"40001"}); assert.deepEqual(await state(),after);
});

test("destino igual, outra temporada ou dependência privada bloqueia sem alterações parciais",async()=>{
  for(const kind of ["same","season","team","region","player","organization"]) {
    const f=await fixture();
    if(kind==="same") f.input.to_team_season_id=f.teams[0];
    if(kind==="season") { const other=await fixture(); f.input.to_team_season_id=other.teams[0]; }
    if(kind==="team") await db.query("update public.team_seasons set publication_status='draft',published_at=null,archived_at=now() where id=$1",[f.teams[1]]);
    if(kind==="region") await db.query("update public.regions set publication_status='draft',published_at=null where id=$1",[f.regions[1].id]);
    if(kind==="player") await db.query("update public.players set publication_status='draft',published_at=null where id=$1",[f.player]);
    if(kind==="organization") await db.query("update public.organizations set publication_status='draft',published_at=null where id=$1",[f.orgs[0]]);
    const before=await state(); await assert.rejects(transfer(f.input),{code:"P0001"}); assert.deepEqual(await state(),before);
  }
});

test("datas rejeitam período inválido e preservam término previamente agendado",async()=>{
  const f=await fixture();
  for(const date of ["2027-01-01","2026-12-31"]) await assert.rejects(transfer({...f.input,effective_on:date}),{code:"P0001"});
  await db.query("update public.roster_memberships set end_date='2027-01-31' where id=$1",[f.origin.id]);
  f.input.expected_membership_updated_at=(await rows("roster_memberships")).find(row=>row.id===f.origin.id).updated_at;
  await assert.rejects(transfer({...f.input,effective_on:"2027-02-01"}),{code:"P0001"});
  await transfer(f.input);
  const next=(await rows("roster_memberships")).find(row=>row.player_id===f.player&&row.team_season_id===f.teams[1]); assert.equal(next.end_date,"2027-01-31");
  const active=async date=>(await db.query("select team_season_id from public.roster_memberships where player_id=$1 and start_date<=$2::date and (end_date is null or end_date>=$2::date)",[f.player,date])).rows.map(row=>row.team_season_id);
  assert.deepEqual(await active("2027-01-14"),[f.teams[0]]); assert.deepEqual(await active("2027-01-15"),[f.teams[1]]); assert.deepEqual(await active("2027-02-01"),[]);
});

test("intervalo futuro no destino e titular futuro em terceira equipe bloqueiam transferência",async()=>{
  for(const destination of [true,false]) {
    const f=await fixture();
    await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,$3,'2027-03-01','published',now())",[f.player,f.teams[destination?1:2],destination?"reserve":"starter"]);
    const before=await state(); await assert.rejects(transfer(f.input),{code:"P0001"}); assert.deepEqual(await state(),before);
  }
});

test("rascunhos abertos nas equipes e disputa de titular em outro rascunho exigem resolução",async()=>{
  for(const index of [0,1,2]) {
    const f=await fixture();
    await db.query("insert into public.roster_drafts(team_season_id,created_by,payload) values($1,$2,$3::jsonb)",[f.teams[index],admin,JSON.stringify(index===2?{version:1,members:[{player_id:f.player,status:"starter"}]}:{})]);
    const before=await state(); await assert.rejects(transfer(f.input),{code:"P0001"}); assert.deepEqual(await state(),before);
  }
});

test("timeline aplica RLS, filtros inclusivos nas duas pontas, paginação e ordenação estável",async()=>{
  const f=await fixture(); await transfer(f.input);
  for(const region of f.regions.slice(0,2)) assert.equal((await timeline({player_id:f.player,region:region.slug})).total,1);
  for(const id of f.orgs.slice(0,2)) {
    const org=(await rows("organizations")).find(row=>row.id===id);
    assert.equal((await timeline({player_id:f.player,team:org.slug})).total,1);
    assert.equal((await timeline({organization_id:id})).total,1);
  }
  assert.equal((await timeline({player_id:f.player,from:"2027-01-15",to:"2027-01-15",kind:"transferred"})).total,1);
  assert.equal((await timeline({player_id:f.player,to:"2027-01-14"})).total,0);
  assert.equal((await timeline({player_id:f.player,kind:"joined"})).total,0);
  const destination=(await rows("roster_memberships")).find(row=>row.player_id===f.player&&row.team_season_id===f.teams[1]);
  await db.query("insert into public.roster_changes(player_id,to_membership_id,change_type,occurred_on,summary,publication_status,published_at) values($1,$2,'corrected','2027-01-15','Outro evento','published',now()),($1,$2,'corrected','2027-01-15','PRIVATE_SENTINEL','draft',null)",[f.player,destination.id]);
  const first=await timeline({player_id:f.player,page_size:1}),second=await timeline({player_id:f.player,page_size:1,page:2});
  assert.equal(first.total,2); assert.equal(second.total,2); assert.notEqual(first.events[0].id,second.events[0].id); assert.ok(first.events[0].id>second.events[0].id);
  assert.equal((await timeline({player_id:f.player,page:3,page_size:1})).events.length,0);
  assert.deepEqual(await timeline({player_id:f.player},admin,"authenticated"),await timeline({player_id:f.player}));
  await db.query("update public.organizations set publication_status='draft',published_at=null where id=$1",[f.orgs[1]]);
  assert.equal((await timeline({player_id:f.player})).total,0);
  for(const filters of [{page:0},{page_size:51},{from:"2027-02-01",to:"2027-01-01"}]) await assert.rejects(timeline(filters),{code:"22023"});
});

test("modelos e SDKs validam entradas e resultado; leitura pública não usa token administrativo",async(t)=>{
  assert.equal(parseTimelineQuery({from:"2027-02-01",to:"2027-01-01"}).success,false);
  assert.equal(parseTimelineQuery({region:["americas","emea"]}).success,false);
  assert.equal(parseTimelineQuery({page:"0"}).success,false);
  assert.equal(parseTimelineQuery({kind:"all"}).data.kind,undefined);
  assert.equal(timelineHref({region:"americas",team:"team-a",kind:"transferred"},2),"/transfers?region=americas&team=team-a&kind=transferred&page=2");
  const f=await fixture(),data=await timeline({player_id:f.player}); let calls=0,mode="ok";
  assert.equal(transferSchema.safeParse({...f.input,confirm:undefined}).success,false);
  t.mock.method(globalThis,"fetch",async(url,init)=>{
    calls++; const publicRead=String(url).endsWith("read_roster_timeline");
    assert.equal(new Headers(init.headers).get("authorization"),publicRead?"Bearer sb_publishable_test":"Bearer isolated-token");
    if(mode==="error") return new Response(JSON.stringify({code:"42501"}),{status:403});
    return new Response(JSON.stringify(publicRead ? mode==="bad"?{total:1,events:[]}:data : mode==="bad"?{}:{id:f.input.id,change_id:randomUUID(),already_published:false}));
  });
  const config={url:"https://test.supabase.co",key:"sb_publishable_test"},adminClient=createAdminAuthClient(config,"isolated-token"),publicClient=createPublicSupabaseClient(config);
  assert.equal((await transferPlayer(adminClient,{})).status,"invalid"); assert.equal(calls,0);
  assert.equal((await transferPlayer(adminClient,f.input)).status,"saved"); assert.deepEqual(await readRosterTimeline(publicClient,{}),data);
  mode="bad"; assert.equal((await transferPlayer(adminClient,f.input)).status,"unavailable"); await assert.rejects(readRosterTimeline(publicClient,{}),/incompleto/);
  mode="error"; assert.equal((await transferPlayer(adminClient,f.input)).status,"denied"); await assert.rejects(readRosterTimeline(publicClient,{}),/indisponível/);
});
