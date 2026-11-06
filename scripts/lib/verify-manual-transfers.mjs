import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function transferHttpChecks({ db, request, post, cookie, artifacts, base, setFailure }) {
  const rows=async(table)=>(await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map(({row})=>row);
  const candidates=(await db.query("select t.id,t.season_id,t.region_id,o.slug,r.slug as region from public.team_seasons t join public.organizations o on o.id=t.organization_id join public.regions r on r.id=t.region_id where t.publication_status='published' and o.publication_status='published' and t.season_id=(select id from public.seasons where year=2027) and not exists(select 1 from public.roster_drafts d where d.team_season_id=t.id and d.status='draft') and not exists(select 1 from public.roster_memberships m where m.team_season_id=t.id) order by t.id")).rows;
  const from=candidates[0],to=candidates.find(team=>team.id!==from.id&&team.season_id===from.season_id&&team.region_id!==from.region_id);
  assert.ok(to);
  const player=(await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values('transfer-fixture','Transferência isolada','initiator','published',now()) returning id")).rows[0].id;
  const membership=(await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2025-01-01','published',now()) returning id",[player,from.id])).rows[0].id;
  const date=new Date().toISOString().slice(0,10),reviewPath=`/admin/transfers?origin=${membership}&destination=${to.id}&date=${date}`;
  const get=(path)=>request(path,{headers:{Cookie:cookie}});
  assert.equal((await request(reviewPath)).response.status,303);
  const review=await get(reviewPath); assert.match(review.html,/Confirmar transferência/); assert.match(review.html,/Observação pública/);
  const input={};
  for(const match of review.html.matchAll(/<input\b[^>]*>/g)) {
    const tag=match[0]; if(!tag.includes('type="hidden"')) continue;
    const name=tag.match(/name="([^"]+)"/)?.[1],value=tag.match(/value="([^"]*)"/)?.[1];
    if(name&&value!==undefined) input[name]=value;
  }
  Object.assign(input,{status:"starter",note:"Nota pública <isolada>",source_url:"https://example.org/manual-transfer",confirm:"transfer"});
  assert.ok(input.id&&input.expected_membership_updated_at);
  const snapshot=async()=>({players:await rows("players"),memberships:await rows("roster_memberships"),teams:await rows("team_seasons"),events:await rows("roster_changes")});
  const before=await snapshot();
  const publicBefore=await request(`/transfers?player_id=${player}`); assert.match(publicBefore.html,/Nenhum registro publicado para estes filtros/);
  assert.equal((await get("/admin/transfers/publish")).response.status,405);
  for(const origin of ["","https://evil.test"]) assert.equal((await post("/admin/transfers/publish",new URLSearchParams(input).toString(),cookie,origin)).response.status,403);
  assert.equal((await post("/admin/transfers/publish",new URLSearchParams(input).toString())).response.status,303);
  assert.match((await post("/admin/transfers/publish",new URLSearchParams({...input,confirm:""}).toString(),cookie)).location,/status=invalid/);
  assert.match((await post("/admin/transfers/publish",new URLSearchParams({...input,expected_to_revision:"999"}).toString(),cookie)).location,/status=conflict/);
  assert.deepEqual(await snapshot(),before);
  const published=await post("/admin/transfers/publish",new URLSearchParams(input).toString(),cookie); assert.match(published.location,/status=saved/);
  const after=await snapshot(); assert.deepEqual(after.players,before.players);
  assert.equal(after.memberships.length,before.memberships.length+1); assert.equal(after.events.length,before.events.length+1);
  const event=after.events.find(row=>row.player_id===player); assert.equal(event.change_type,"transferred"); assert.equal(event.note,input.note); assert.ok(event.published_by);
  const originPage=await request(`/team/${from.slug}`),destinationPage=await request(`/team/${to.slug}`),career=await request("/player/transfer-fixture"),feed=await request(`/transfers?player_id=${player}`);
  assert.doesNotMatch(originPage.html.split('id="historico"')[0],/Transferência isolada/);
  assert.match(destinationPage.html.split('id="historico"')[0],/Transferência isolada/);
  for(const page of [originPage,destinationPage,career,feed]) {
    assert.match(page.html,/Nota pública &lt;isolada&gt;/); assert.ok(page.html.includes(`change-${event.id}`));
    assert.match(page.html,/https:\/\/example.org\/manual-transfer/); assert.ok(!page.html.includes(event.published_by));
  }
  assert.match(career.html,/2025/); assert.match(career.html,/Iniciador/);
  for(const region of [from.region,to.region]) assert.match((await request(`/transfers?player_id=${player}&region=${region}&from=${date}&to=${date}`)).html,/Nota pública &lt;isolada&gt;/);
  for(const team of [from.slug,to.slug]) assert.match((await request(`/transfers?team=${team}`)).html,/Nota pública &lt;isolada&gt;/);
  assert.match((await request(`/transfers?player_id=${player}&to=2020-01-01`)).html,/Nenhum registro publicado para estes filtros/);
  assert.match((await request("/transfers?from=2028-01-01&to=2027-01-01")).html,/Filtros inválidos/);
  const audit=await rows("audit_logs");
  const replay=await request("/admin/transfers/publish",{method:"POST",headers:{Cookie:cookie,Origin:base,Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(input).toString()});
  assert.equal(replay.response.status,200); assert.match(JSON.parse(replay.html).destination,/already-published/); assert.deepEqual(await rows("audit_logs"),audit);
  setFailure("timeline");
  try { assert.match((await request("/transfers")).html,/Histórico indisponível/); }
  finally { setFailure(""); }
  const home=await request("/"); assert.match(home.html,/Nota pública &lt;isolada&gt;/);
  for(const [name,page] of Object.entries({review,origin:originPage,destination:destinationPage,career,feed,home})) await writeFile(`${artifacts}/transfer-${name}.html`,page.html);
  await writeFile(`${artifacts}/transfers-http.json`,JSON.stringify({checks:["native GET review and explicit POST confirmation","auth/origin/missing confirmation/stale version rejected without writes","origin and destination update together","same player UUID and prior career retained","event/source/note/author persisted","JSON replay adds no records","public feed, both team timelines, player timeline and home update","region/team/inclusive dates and invalid/empty filters","timeline outage is distinct from empty","public markup escapes note and omits actor IDs"],infrastructure:"Next production + SDK + isolated Auth/PostgREST + real SQL/RLS; no remote Supabase"},null,2)+"\n");
  const next=after.memberships.find(row=>row.player_id===player&&row.team_season_id===to.id),tomorrow=new Date(`${date}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  return {playerId:player,reviewPath:`/admin/transfers?origin=${next.id}&destination=${from.id}&date=${tomorrow.toISOString().slice(0,10)}`};
}

export async function transferBrowserChecks({page,width,artifacts,base,reviewPath,playerId}) {
  for(const [name,path] of [["review",reviewPath],["feed",`/transfers?player_id=${playerId}`]]) {
    await page.goto(`${base}${path}`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
    assert.deepEqual(await page.evaluate(async()=>(await window.axe.run()).violations.map(({id})=>id)),[]);
    await page.screenshot({path:`${artifacts}/transfer-${name}-${width}.png`,fullPage:true});
  }
  if(width===1440) {
    await page.goto(`${base}${reviewPath}`);
    await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:"Confirmar e publicar transferência",exact:true}).click();
    await page.waitForURL(/\/admin\/transfers\?status=saved$/);
    await page.getByRole("status").filter({hasText:"Transferência publicada"}).waitFor();
  }
  await page.goto(`${base}/admin`);
}
