import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { currentRoster } from "../../src/features/admin/roster-draft-model.ts";

export async function publicationHttpChecks({ db, request, post, cookie, artifacts, base, excludeTeam }) {
  const rows = async (table) => (await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map(({ row }) => row);
  const get = (path) => request(path, { headers: { Cookie: cookie } });
  const team = (await db.query("select t.id,t.roster_revision,o.slug from public.team_seasons t join public.organizations o on o.id=t.organization_id where t.publication_status='published' and o.publication_status='published' and t.season_id=(select id from public.seasons where year=2027) and t.id<>$1 and not exists(select 1 from public.roster_drafts d where d.team_season_id=t.id and d.status='draft') and not exists(select 1 from public.roster_memberships m where m.team_season_id=t.id) order by t.id limit 1", [excludeTeam])).rows[0];
  const players = [];
  for (const [index,nickname] of ["Saída publicação isolada","Entrada publicação isolada"].entries()) players.push((await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values($1,$2,'flex','published',now()) returning id",[`publication-fixture-${index}`,nickname])).rows[0].id);
  await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2025-01-01','published',now())",[players[0],team.id]);
  const today = new Date().toISOString().slice(0,10);
  const input = { id: randomUUID(),team_season_id:team.id,expected_updated_at:"",base_revision:team.roster_revision,payload:{version:1,effective_on:today,base_members:currentRoster(await rows("roster_memberships"),await rows("players"),team.id,today),members:[{player_id:players[1],status:"starter",role:"controller"}]} };
  const save = async (input) => JSON.parse((await request("/admin/rosters/save",{method:"POST",headers:{Origin:base,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify(input)})).html);
  assert.equal((await save(input)).status,"saved");
  const draft = (await rows("roster_drafts")).find((row)=>row.id===input.id);
  const confirmation={ id:draft.id,expected_updated_at:draft.updated_at,source_url:"https://example.org/manual-source",confirm:"publish" };
  const reviewPath=`/admin/rosters/${team.id}/publish?draft=${draft.id}`;
  assert.equal((await request(reviewPath)).response.status,303);
  const review=await get(reviewPath); assert.match(review.html,/Revisar publicação/); assert.match(review.html,/Confirmar e publicar elenco/);
  assert.match(review.html,/name="confirm"/); assert.match(review.html,/Fonte da informação/);
  await writeFile(`${artifacts}/publication-review.html`,review.html);
  const publicBefore=await request(`/team/${team.slug}`); assert.match(publicBefore.html,/Saída publicação isolada/); assert.doesNotMatch(publicBefore.html,/Entrada publicação isolada/);
  assert.equal((await request("/admin/rosters/publish",{method:"POST",headers:{Cookie:cookie,Origin:"https://evil.test"}})).response.status,403);
  assert.equal((await request("/admin/rosters/publish",{method:"POST",headers:{Cookie:cookie}})).response.status,403);
  assert.equal((await post("/admin/rosters/publish",new URLSearchParams(confirmation).toString())).response.status,303);
  assert.equal((await get("/admin/rosters/publish")).response.status,405);
  const unconfirmed=await post("/admin/rosters/publish",new URLSearchParams({...confirmation,confirm:""}).toString(),cookie);
  assert.match(unconfirmed.location,/publish-invalid/);
  assert.equal((await rows("roster_drafts")).find((row)=>row.id===draft.id).status,"draft");
  const published=await post("/admin/rosters/publish",new URLSearchParams(confirmation).toString(),cookie);
  assert.match(published.location,/status=published$/);
  const after=await request(`/team/${team.slug}`); assert.match(after.html,/Entrada publicação isolada/); assert.match(after.html,/Controlador/); assert.doesNotMatch(after.html.split('id="historico"')[0],/Saída publicação isolada/);
  const profile=await request("/player/publication-fixture-0"); assert.match(profile.html,/Nenhum vínculo atual publicado/); assert.match(profile.html,/2025/); assert.match(profile.html,/Flex/);
  const saved=await get(published.location); assert.match(saved.html,/Publicação registrada/); assert.match(saved.html,/Somente leitura/); assert.doesNotMatch(saved.html,/a base publicada mudou/);
  await writeFile(`${artifacts}/publication-complete.html`,saved.html);
  await writeFile(`${artifacts}/publication-public-team.html`,after.html);
  await writeFile(`${artifacts}/publication-public-career.html`,profile.html);
  const history=(await rows("roster_changes")).filter((row)=>row.draft_id===draft.id); assert.equal(history.length,2); assert.ok(history.every((row)=>row.source_url===confirmation.source_url && row.published_by));
  const audit=await rows("audit_logs");
  const retry=await request("/admin/rosters/publish",{method:"POST",headers:{Origin:base,Cookie:cookie,Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(confirmation).toString()});
  assert.equal(retry.response.status,200); assert.match(JSON.parse(retry.html).destination,/already-published/);
  assert.deepEqual(await rows("audit_logs"),audit);
  const date=new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+1); const tomorrow=date.toISOString().slice(0,10);
  const next={ ...input,id:randomUUID(),base_revision:input.base_revision+1,payload:{version:1,effective_on:tomorrow,base_members:currentRoster(await rows("roster_memberships"),await rows("players"),team.id,tomorrow),members:[{player_id:players[1],status:"reserve",role:"controller"}]} };
  assert.equal((await save(next)).status,"saved");
  await writeFile(`${artifacts}/publication-http.json`,JSON.stringify({checks:["review renders saved diff and explicit confirmation","unauthenticated/cross-origin/missing confirmation rejected","native form publishes atomically","public roster changes after confirmation","past membership and role retained in career","source/author/change records persisted","JSON replay idempotent without extra audit","published draft is read-only"],infrastructure:"Next production + SDK + Auth/PostgREST doubles + real SQL/RLS; no remote Supabase"},null,2)+"\n");
  return { reviewPath:`/admin/rosters/${team.id}/publish?draft=${next.id}` };
}

export async function publicationBrowserChecks({page,width,artifacts,base,reviewPath}) {
  await page.goto(`${base}${reviewPath}`);
  await page.getByRole("heading",{name:"Revisar publicação",exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.addScriptTag({path:"node_modules/axe-core/axe.min.js"});
  assert.deepEqual(await page.evaluate(async()=>(await window.axe.run()).violations.map(({id})=>id)),[]);
  await page.screenshot({path:`${artifacts}/publication-review-${width}.png`,fullPage:true});
  if(width===1440) {
    await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:"Confirmar e publicar elenco",exact:true}).click();
    await page.waitForURL(/status=published$/);
    await page.getByRole("heading",{name:"Publicação registrada",exact:true}).waitFor();
  }
  await page.goto(`${base}/admin`);
}
