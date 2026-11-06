import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { currentRoster } from "../../src/features/admin/roster-draft-model.ts";

export async function draftHttpChecks({ db, request, post, cookie, artifacts, base }) {
  const rows = async (table) => (await db.query(`select to_jsonb(t) as row from public.${table} t order by id`)).rows.map((entry) => entry.row);
  const snapshot = async () => ({ players: await rows("players"), memberships: await rows("roster_memberships"), teams: await rows("team_seasons"), changes: await rows("roster_changes") });
  const get = (path) => request(path, { headers: { Cookie: cookie } });
  const save = async (input, origin = base, auth = cookie) => {
    const response = await request("/admin/rosters/save", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}), ...(auth ? { Cookie: auth } : {}) }, body: JSON.stringify(input) });
    return { ...response, result: response.response.status === 303 ? null : JSON.parse(response.html) };
  };
  const team = (await db.query("select t.id,t.organization_id,t.season_id,o.slug from public.team_seasons t join public.organizations o on o.id=t.organization_id where t.publication_status='published' and not exists(select 1 from public.roster_drafts d where d.team_season_id=t.id and d.status='draft') and t.season_id=(select id from public.seasons where year=2027) order by t.id limit 1")).rows[0];
  const other = (await db.query("select id from public.team_seasons where season_id=$1 and id<>$2 order by id limit 1", [team.season_id, team.id])).rows[0].id;
  const playerIds = [];
  for (const [index, nick] of ["Titular publicado isolado", "Reserva proposta isolada", "Titular outra equipe isolado"].entries()) playerIds.push((await db.query("insert into public.players(slug,nickname,role,publication_status,published_at) values($1,$2,'flex','published',now()) returning id", [`draft-fixture-${index}`, nick])).rows[0].id);
  for (const [player, teamId] of [[playerIds[0], team.id], [playerIds[2], other]]) await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,publication_status,published_at) values($1,$2,'starter','2025-01-01','published',now())", [player, teamId]);
  const date = new Date().toISOString().slice(0, 10);
  const baseline = currentRoster(await rows("roster_memberships"), await rows("players"), team.id, date);
  const input = { id: randomUUID(), team_season_id: team.id, expected_updated_at: "", base_revision: 0, payload: { version: 1, effective_on: date, base_members: baseline, members: [{ player_id: playerIds[1], status: "reserve", role: "controller" }] } };
  assert.equal((await request(`/admin/rosters/${team.id}`)).response.status, 303);
  assert.equal((await save(input, base, "")).response.status, 303);
  for (const origin of ["", "https://evil.test"]) assert.equal((await save(input, origin)).response.status, 403);
  assert.equal((await get("/admin/rosters/save")).response.status, 405);
  const editor = await get(`/admin/rosters/${team.id}`);
  assert.match(editor.html, /Prévia das alterações/); assert.match(editor.html, /Titulares/); assert.match(editor.html, /Salvar rascunho/);
  await writeFile(`${artifacts}/draft-new.html`, editor.html);
  const publicTeamBefore = await (await fetch(`${base}/team/${team.slug}`)).text();
  assert.match(publicTeamBefore, /Titular publicado isolado/);
  assert.doesNotMatch(publicTeamBefore, /Reserva proposta isolada/);
  const before = await snapshot();
  assert.equal((await save(input)).result.status, "saved");
  assert.equal((await save(input)).result.status, "duplicate");
  let draft = (await rows("roster_drafts")).find((entry) => entry.id === input.id);
  let page = await get(`/admin/rosters/${team.id}`);
  assert.match(page.html, /Saída proposta/); assert.match(page.html, /Entrada:/);
  await writeFile(`${artifacts}/draft-preview.html`, page.html);
  const modified = { ...input, expected_updated_at: draft.updated_at, payload: { ...input.payload, members: [{ player_id: playerIds[0], status: "inactive", role: "sentinel" }, input.payload.members[0]] } };
  assert.equal((await save(modified)).result.status, "saved");
  assert.equal((await save(modified)).result.status, "conflict");
  draft = (await rows("roster_drafts")).find((entry) => entry.id === input.id);
  const conflict = { ...modified, expected_updated_at: draft.updated_at, payload: { ...modified.payload, members: [{ player_id: playerIds[2], status: "starter", role: null }] } };
  assert.equal((await save(conflict)).result.status, "reference");
  assert.deepEqual(await snapshot(), before);
  const publicTeamAfter = await (await fetch(`${base}/team/${team.slug}`)).text();
  assert.match(publicTeamAfter, /Titular publicado isolado/);
  assert.doesNotMatch(publicTeamAfter, /Reserva proposta isolada/);
  assert.doesNotMatch(publicTeamAfter, /Prévia das alterações|Saída proposta/);
  const publicPlayer = await (await fetch(`${base}/player/draft-fixture-0`)).text();
  assert.match(publicPlayer, /Titular/); assert.match(publicPlayer, /Flex/);
  await writeFile(`${artifacts}/public-roster-unchanged.html`, publicTeamAfter);
  const archived = await post("/admin/rosters/archive", new URLSearchParams({ id: draft.id, expected_updated_at: draft.updated_at }).toString(), cookie);
  assert.match(archived.location, /status=archived/);
  assert.equal((await rows("roster_drafts")).find((entry) => entry.id === draft.id).status, "archived");
  page = await get(`/admin/rosters/${team.id}?draft=${draft.id}`);
  assert.match(page.html, /Somente leitura/);
  assert.deepEqual(await snapshot(), before);
  await writeFile(`${artifacts}/drafts-http.json`, JSON.stringify({ checks: ["same-origin/auth guards", "editor and preview", "private save/edit/archive", "duplicate/stale edit blocked", "starter conflict blocked", "players/memberships/team revision/changes unchanged", "team and player public pages preserve published roster", "archived draft read-only"], infrastructure: "Next production + SDK + Auth/PostgREST doubles + real SQL/RLS" }, null, 2) + "\n");
  return { teamId: team.id, proposedNickname: "Reserva proposta isolada" };
}

export async function draftBrowserChecks({ page, width, artifacts, base, teamId, proposedNickname }) {
  await page.goto(`${base}/admin/rosters/${teamId}`);
  await page.getByLabel("Buscar jogador", { exact: true }).fill(proposedNickname);
  await page.getByLabel("Jogador", { exact: true }).selectOption({ label: `${proposedNickname} / draft-fixture-1` });
  await page.getByRole("button", { name: "Adicionar ao rascunho", exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.waitForURL(`${base}/admin/rosters/${teamId}?status=saved`);
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).waitFor({ state: "visible" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
  await page.screenshot({ path: `${artifacts}/draft-editor-${width}.png`, fullPage: true });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Arquivar rascunho", exact: true }).click();
  await page.waitForURL(/\/admin\/rosters\?status=archived/);
  await page.goto(`${base}/admin`);
}
