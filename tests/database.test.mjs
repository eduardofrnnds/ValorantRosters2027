import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createTestDatabase } from "./helpers/database.mjs";

let db;
const tables = ["regions", "seasons", "organizations", "team_seasons", "players", "player_slug_history", "roster_memberships", "roster_drafts", "roster_changes", "admin_users", "audit_logs"];
const published = { publication_status: "published", published_at: "2026-11-04T12:00:00Z" };
before(async () => { ({ db } = await createTestDatabase()); });
after(async () => { await db?.close(); });

async function insert(table, values) {
  const columns = Object.keys(values);
  const { rows } = await db.query(`insert into ${table} (${columns.join(",")}) values (${columns.map((_, i) => `$${i + 1}`).join(",")}) returning *`, Object.values(values));
  return rows[0];
}
async function count(table) { return Number((await db.query(`select count(*) as count from public.${table}`)).rows[0].count); }
async function role(name, userId = "") {
  assert.ok(["anon", "authenticated", "service_role", "postgres"].includes(name));
  await db.exec(`set local role ${name}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}
async function rejects(sql, parameters, code) {
  await db.exec("savepoint rejected_statement");
  try { await assert.rejects(db.query(sql, parameters), (error) => (Array.isArray(code) ? code : [code]).includes(error.code)); }
  finally { await db.exec("rollback to savepoint rejected_statement; release savepoint rejected_statement"); }
}
async function fixture() {
  const admin = randomUUID(), member = randomUUID(), disabled = randomUUID();
  for (const id of [admin, member, disabled]) await insert("auth.users", { id });
  await insert("public.admin_users", { user_id: admin });
  await insert("public.admin_users", { user_id: disabled, is_active: false });
  const region = await insert("public.regions", { slug: "test-region", name: "Região de teste", ...published });
  const season = await insert("public.seasons", { year: 2027, name: "Temporada de teste", ...published });
  const nextSeason = await insert("public.seasons", { year: 2028, name: "Outra temporada de teste", ...published });
  const org = await insert("public.organizations", { slug: "test-org", name: "Organização de teste", ...published });
  const otherOrg = await insert("public.organizations", { slug: "test-other-org", name: "Outra organização de teste", ...published });
  const hiddenOrg = await insert("public.organizations", { slug: "private-org", name: "Organização em rascunho" });
  const team = await insert("public.team_seasons", { organization_id: org.id, season_id: season.id, region_id: region.id, partner_status: "partner", ...published });
  const otherTeam = await insert("public.team_seasons", { organization_id: otherOrg.id, season_id: season.id, region_id: region.id, partner_status: "visitor", ...published });
  const hiddenTeam = await insert("public.team_seasons", { organization_id: hiddenOrg.id, season_id: season.id, region_id: region.id, partner_status: "qualifier", ...published });
  const player = await insert("public.players", { slug: "test-player", nickname: "Identidade de teste", ...published });
  const draftPlayer = await insert("public.players", { slug: "private-player", nickname: "Rascunho privado" });
  const membership = await insert("public.roster_memberships", { player_id: player.id, team_season_id: team.id, status: "starter", start_date: "2027-01-01", ...published });
  const draftMembership = await insert("public.roster_memberships", { player_id: player.id, team_season_id: otherTeam.id, status: "reserve", start_date: "2027-01-01" });
  await insert("public.roster_memberships", { player_id: draftPlayer.id, team_season_id: team.id, status: "inactive", start_date: "2027-01-01", ...published });
  await insert("public.roster_memberships", { player_id: player.id, team_season_id: hiddenTeam.id, status: "coach", start_date: "2027-01-01", ...published });
  const draft = await insert("public.roster_drafts", { team_season_id: team.id, created_by: admin, payload: { privateNote: "Somente teste privado" } });
  const change = await insert("public.roster_changes", { player_id: player.id, to_membership_id: membership.id, change_type: "joined", occurred_on: "2027-01-01", summary: "Evento de teste", ...published });
  await insert("public.roster_changes", { player_id: player.id, to_membership_id: draftMembership.id, change_type: "joined", occurred_on: "2027-01-01", summary: "Evento com vínculo privado", ...published });
  return { admin, member, disabled, region, season, nextSeason, org, otherOrg, hiddenOrg, team, otherTeam, hiddenTeam, player, draftPlayer, membership, draftMembership, draft, change };
}
async function scenario(fn) {
  await db.exec("begin");
  try { await fn(await fixture()); }
  finally { await db.exec("rollback"); }
}

test("migrations executam em PostgreSQL vazio, criam 11 tabelas com UUID/RLS e não fazem seed", async (t) => {
  t.diagnostic((await db.query("select version()")).rows[0].version);
  const { rows } = await db.query("select relname, relrowsecurity from pg_class join pg_namespace n on n.oid = relnamespace where n.nspname = 'public' and relkind = 'r'");
  assert.deepEqual(rows.map(({ relname }) => relname).sort(), [...tables].sort());
  assert.ok(rows.every(({ relrowsecurity }) => relrowsecurity));
  for (const table of tables) {
    assert.equal(await count(table), 0);
    const pk = table === "admin_users" ? "user_id" : "id";
    assert.equal((await db.query("select data_type from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2", [table, pk])).rows[0].data_type, "uuid");
  }
});

test("mais de oito equipes, categorias diferentes por temporada e referências obrigatórias", () => scenario(async (f) => {
  for (let index = 0; index < 9; index++) {
    const org = await insert("public.organizations", { slug: `extra-${index}`, name: `Extra de teste ${index}`, ...published });
    await insert("public.team_seasons", { organization_id: org.id, season_id: f.season.id, region_id: f.region.id, partner_status: index % 2 ? "qualifier" : "visitor", ...published });
  }
  assert.equal(await count("team_seasons"), 12);
  await insert("public.team_seasons", { organization_id: f.org.id, season_id: f.nextSeason.id, region_id: f.region.id, partner_status: "visitor", ...published });
  await rejects("insert into public.team_seasons (organization_id,season_id,region_id,partner_status) values ($1,$2,$3,'partner')", [f.org.id, f.season.id, f.region.id], "23505");
  await rejects("insert into public.team_seasons (organization_id,season_id,region_id,partner_status) values ($1,$2,$3,'partner')", [randomUUID(), f.season.id, f.region.id], "23503");
  await rejects("update public.team_seasons set partner_status = 'starter' where id = $1", [f.team.id], "22P02");
  await rejects("update public.roster_memberships set status = 'partner' where id = $1", [f.membership.id], "22P02");
}));

test("constraints rejeitam datas, publicação incompleta, JSON inválido e eventos de outro jogador", () => scenario(async (f) => {
  await rejects("update public.roster_memberships set end_date = '2026-12-31' where id = $1", [f.membership.id], "23514");
  await rejects("update public.roster_memberships set start_date = 'infinity' where id = $1", [f.membership.id], "23514");
  await rejects("update public.players set published_at = null where id = $1", [f.player.id], "23514");
  await rejects("update public.players set nickname = '   ' where id = $1", [f.player.id], "23514");
  await rejects("update public.roster_drafts set payload = '[]' where id = $1", [f.draft.id], "23514");
  await rejects("update public.roster_changes set player_id = $1 where id = $2", [f.draftPlayer.id, f.change.id], "23503");
  await rejects("update public.roster_changes set to_membership_id = null where id = $1", [f.change.id], "23514");
  await rejects("insert into public.seasons(year,name) values (2027,'Duplicada')", [], "23505");
}));

test("renomeação mantém UUID e vínculos, reserva aliases e permite voltar ao próprio slug", () => scenario(async (f) => {
  await db.query("update public.players set nickname = 'Renomeado', slug = 'test-renamed' where id = $1", [f.player.id]);
  const history = (await db.query("select * from public.player_slug_history where player_id = $1 order by created_at", [f.player.id])).rows;
  assert.equal(history.length, 2);
  assert.ok(history[0].retired_at);
  assert.equal(history[1].retired_at, null);
  assert.equal((await db.query("select player_id from public.roster_memberships where id = $1", [f.membership.id])).rows[0].player_id, f.player.id);
  await rejects("insert into public.players(slug,nickname) values ('test-player','Outra identidade')", [], "23505");
  await db.query("update public.players set slug = 'test-player' where id = $1", [f.player.id]);
  assert.equal((await db.query("select slug from public.player_slug_history where player_id = $1 and retired_at is null", [f.player.id])).rows[0].slug, "test-player");
  await insert("public.players", { slug: "same-nickname", nickname: "Renomeado" });
  await rejects("update public.players set id = $1 where id = $2", [randomUUID(), f.player.id], "23514");
}));

test("slug que nunca foi publicado não vaza quando outro slug da identidade é publicado", () => scenario(async (f) => {
  await db.query("update public.players set slug = 'published-later', publication_status = 'published', published_at = now() where id = $1", [f.draftPlayer.id]);
  await role("anon");
  const slugs = (await db.query("select slug from public.player_slug_history where player_id = $1", [f.draftPlayer.id])).rows.map(({ slug }) => slug);
  assert.deepEqual(slugs, ["published-later"]);
}));

test("histórico exige fechar/inserir vínculos e preserva retornos e temporadas", () => scenario(async (f) => {
  await rejects("update public.roster_memberships set team_season_id = $1 where id = $2", [f.otherTeam.id, f.membership.id], "23514");
  await rejects("update public.roster_memberships set player_id = $1 where id = $2", [f.draftPlayer.id, f.membership.id], "23514");
  await rejects("update public.team_seasons set organization_id = $1 where id = $2", [f.hiddenOrg.id, f.team.id], "23514");
  await db.query("update public.roster_memberships set end_date = '2027-02-28' where id = $1", [f.membership.id]);
  const next = await insert("public.roster_memberships", { player_id: f.player.id, team_season_id: f.otherTeam.id, status: "starter", start_date: "2027-03-01", end_date: "2027-06-30", ...published });
  await insert("public.roster_memberships", { player_id: f.player.id, team_season_id: f.team.id, status: "starter", start_date: "2027-07-01", ...published });
  await insert("public.roster_changes", { player_id: f.player.id, from_membership_id: f.membership.id, to_membership_id: next.id, change_type: "transferred", occurred_on: "2027-03-01", summary: "Transferência isolada de teste", ...published });
  // PostgreSQL versions report RESTRICT as restrict_violation or foreign_key_violation.
  await rejects("delete from public.players where id = $1", [f.player.id], ["23001", "23503"]);
  await rejects("delete from public.team_seasons where id = $1", [f.team.id], ["23001", "23503"]);
  await rejects("delete from public.roster_memberships where id = $1", [f.membership.id], ["23001", "23503"]);
}));

for (const access of ["anon", "member", "disabled"]) {
  test(`${access}: somente publicações visíveis, inclusive dependências; sem escrita ou autopromoção`, () => scenario(async (f) => {
    await role(access === "anon" ? "anon" : "authenticated", access === "anon" ? "" : f[access]);
    assert.equal(await count("players"), 1);
    assert.equal(await count("organizations"), 2);
    assert.equal(await count("team_seasons"), 2);
    assert.equal(await count("roster_memberships"), 1);
    assert.equal(await count("roster_changes"), 1);
    assert.equal(await count("player_slug_history"), 1);
    for (const table of ["roster_drafts", "admin_users", "audit_logs"]) {
      if (access === "anon") await rejects(`select * from public.${table}`, [], "42501");
      else assert.equal(await count(table), 0);
    }
    await rejects("insert into public.players(slug,nickname) values ('attack','Não autorizado')", [], "42501");
    await rejects("insert into public.admin_users(user_id) values ($1)", [f.member], "42501");
    await rejects("delete from public.players where id = $1", [f.player.id], "42501");
    if (access === "anon") await rejects("update public.players set nickname = 'Ataque' where id = $1", [f.player.id], "42501");
    else assert.equal((await db.query("update public.players set nickname = 'Ataque' where id = $1 returning id", [f.player.id])).rows.length, 0);
  }));
}

test("despublicar pais oculta vínculos e feed público sem apagar o histórico", () => scenario(async (f) => {
  await db.query("update public.regions set publication_status = 'draft', published_at = null where id = $1", [f.region.id]);
  await role("anon");
  for (const table of ["team_seasons", "roster_memberships", "roster_changes"]) assert.equal(await count(table), 0);
  await role("postgres");
  assert.equal(await count("roster_memberships"), 4);
}));

test("admin ativo acessa rascunhos e edita, sem gerir admins ou forjar/apagar auditoria", () => scenario(async (f) => {
  await role("authenticated", f.admin);
  assert.equal(await count("players"), 2);
  assert.equal(await count("roster_drafts"), 1);
  assert.ok(await count("audit_logs") > 0);
  await db.query("update public.players set nickname = 'Alteração auditada', created_at = '2000-01-01', updated_at = '2000-01-01' where id = $1", [f.player.id]);
  const player = (await db.query("select * from public.players where id = $1", [f.player.id])).rows[0];
  assert.deepEqual(player.created_at, f.player.created_at);
  assert.ok(new Date(player.updated_at) > new Date(f.player.updated_at));
  const log = (await db.query("select * from public.audit_logs where record_id = $1 and operation = 'UPDATE' order by created_at desc limit 1", [f.player.id])).rows[0];
  assert.equal(log.actor_id, f.admin);
  assert.equal(log.db_role, "authenticated");
  assert.equal(log.old_record.nickname, f.player.nickname);
  assert.equal(log.new_record.nickname, "Alteração auditada");
  await rejects("update public.admin_users set is_active = true where user_id = $1", [f.disabled], "42501");
  await rejects("delete from public.roster_memberships where id = $1", [f.membership.id], "42501");
  await rejects("update public.player_slug_history set slug = 'forged' where player_id = $1", [f.player.id], "42501");
  await rejects("insert into public.audit_logs(db_role,table_name,record_id,operation,new_record) values ('fake','players',$1,'INSERT','{}')", [f.player.id], "42501");
  await rejects("delete from public.audit_logs", [], "42501");
  await rejects("truncate public.audit_logs", [], "42501");
}));

test("revogação de admin tem efeito sem renovar sessão e usuário nulo não é admin", () => scenario(async (f) => {
  await db.query("update public.admin_users set is_active = false where user_id = $1", [f.admin]);
  await role("authenticated", f.admin);
  assert.equal((await db.query("select private.is_admin() as allowed")).rows[0].allowed, false);
  assert.equal(await count("roster_drafts"), 0);
  await role("authenticated");
  assert.equal((await db.query("select private.is_admin() as allowed")).rows[0].allowed, false);
}));

test("rascunho mantém autor/base e seu estado published continua privado", () => scenario(async (f) => {
  await role("authenticated", f.admin);
  const ownDraft = await insert("public.roster_drafts", { team_season_id: f.team.id });
  assert.equal(ownDraft.created_by, f.admin);
  await rejects("insert into public.roster_drafts(team_season_id,created_by) values ($1,$2)", [f.team.id, f.member], "42501");
  await rejects("update public.roster_drafts set created_by = $1 where id = $2", [f.member, ownDraft.id], "23514");
  await rejects("update public.roster_drafts set base_revision = 3 where id = $1", [ownDraft.id], "23514");
  await db.query("update public.roster_drafts set status = 'published', published_at = now() where id = $1", [ownDraft.id]);
  await role("authenticated", f.member);
  assert.equal(await count("roster_drafts"), 0);
}));

test("auditoria é imutável, transacional e registra provisioning confiável", () => scenario(async (f) => {
  await role("service_role");
  await db.query("update public.admin_users set is_active = true where user_id = $1", [f.disabled]);
  const log = (await db.query("select * from public.audit_logs where record_id = $1 and operation = 'UPDATE'", [f.disabled])).rows[0];
  assert.equal(log.actor_id, null);
  assert.equal(log.db_role, "service_role");
  await role("postgres");
  await rejects("update public.audit_logs set db_role = 'forged'", [], "23514");
  await rejects("delete from public.audit_logs", [], "23514");
  await rejects("truncate public.audit_logs", [], "23514");
  const beforeCount = await count("audit_logs");
  await db.exec("savepoint rolled_back_change");
  await db.query("update public.players set nickname = 'Rollback' where id = $1", [f.player.id]);
  assert.equal(await count("audit_logs"), beforeCount + 1);
  await db.exec("rollback to savepoint rolled_back_change; release savepoint rolled_back_change");
  assert.equal(await count("audit_logs"), beforeCount);
}));

test("helpers privilegiados têm search_path fixo e não são executáveis pelo público", async () => {
  const rows = (await db.query("select proname, proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and prosecdef")).rows;
  assert.equal(rows.length, 4);
  assert.ok(rows.every(({ proconfig }) => proconfig.some((setting) => setting.startsWith("search_path="))));
  assert.equal((await db.query("select has_function_privilege('anon','private.is_admin()','EXECUTE') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('anon','private.lock_active_admin()','EXECUTE') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('authenticated','private.lock_active_admin()','EXECUTE') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select has_function_privilege('authenticated','private.audit_row_change()','EXECUTE') as allowed")).rows[0].allowed, false);
});
