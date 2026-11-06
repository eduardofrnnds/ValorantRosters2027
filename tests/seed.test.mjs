import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawnSync } from "node:child_process";
import { createTestDatabase } from "./helpers/database.mjs";
import { buildSeedSql } from "../scripts/lib/seed-vct-2027.mjs";
import { databaseOptions } from "../scripts/seed-vct-2027.mjs";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";
import { mapPublicCatalog } from "../src/features/organizations/public-catalog-model.ts";

let db;
before(async () => { ({ db } = await createTestDatabase()); });
after(async () => { await db?.close(); });
const seed = (tx) => tx.exec(buildSeedSql());
const tables = ["regions", "seasons", "organizations", "team_seasons", "audit_logs"];
async function snapshot(tx) {
  return Object.fromEntries(await Promise.all(tables.map(async (table) => [table, (await tx.query(`select * from public.${table} order by id`)).rows])));
}

test("seed duas vezes preserva IDs/timestamps/auditoria e publica exatamente 4/1/32/32 via RLS", async () => {
  await db.transaction(async (tx) => {
    await seed(tx);
    const first = await snapshot(tx);
    assert.deepEqual(tables.map((table) => first[table].length), [4, 1, 32, 32, 69]);
    await seed(tx);
    assert.deepEqual(await snapshot(tx), first);
    for (const table of ["players", "roster_memberships", "roster_changes", "roster_drafts", "admin_users"]) {
      assert.equal((await tx.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0);
    }
    await tx.exec("set local role anon");
    const rows = {};
    for (const table of tables.slice(0, 4)) rows[table] = (await tx.query(`select * from public.${table}`)).rows;
    const mapped = mapPublicCatalog(rows);
    assert.deepEqual(mapped.seasons, vct2027.seasons);
    assert.deepEqual([...mapped.organizations].sort((a, b) => a.id.localeCompare(b.id)), [...vct2027.organizations].sort((a, b) => a.id.localeCompare(b.id)));
    assert.deepEqual([...mapped.teamSeasons].sort((a, b) => a.organizationId.localeCompare(b.organizationId)), [...vct2027.teamSeasons].sort((a, b) => a.organizationId.localeCompare(b.organizationId)));
    for (const region of mapped.regions) assert.equal(mapped.teamSeasons.filter((entry) => entry.regionId === region.id).length, 8);
    await tx.rollback();
  });
});

test("reexecução preserva edições, rascunhos, qualificatórias, visitantes e outra temporada", async () => {
  await db.transaction(async (tx) => {
    await seed(tx);
    const org = vct2027.organizations[0].id;
    await tx.query("update public.organizations set name = 'Nome editado', slug = 'nome-editado', publication_status = 'draft', published_at = null where id = $1", [org]);
    await tx.query("update public.team_seasons set partner_status = 'qualifier', roster_revision = 9 where organization_id = $1", [org]);
    await tx.exec(`
      insert into public.seasons (year, name) values (2028, '2028');
      insert into public.organizations (slug, name) values ('extra-test', 'Extra');
      insert into public.team_seasons (organization_id, season_id, region_id, partner_status)
        select o.id, s.id, r.id, 'visitor' from public.organizations o, public.seasons s, public.regions r
        where o.slug = 'extra-test' and r.slug = 'americas';
    `);
    const before = await snapshot(tx);
    await seed(tx);
    assert.deepEqual(await snapshot(tx), before);
    await tx.rollback();
  });
});

test("seed reutiliza UUID de região existente sem republicar rascunho", async () => {
  await db.transaction(async (tx) => {
    const { rows: [region] } = await tx.query("insert into public.regions (slug, name) values ('americas', 'Américas editadas') returning *");
    await seed(tx);
    assert.deepEqual((await tx.query("select * from public.regions where slug = 'americas'")).rows[0], region);
    assert.equal((await tx.query("select count(*)::int as n from public.team_seasons where region_id = $1", [region.id])).rows[0].n, 8);
    await tx.exec("set local role anon");
    assert.equal((await tx.query("select count(*)::int as n from public.team_seasons")).rows[0].n, 24);
    await tx.rollback();
  });
});

test("conflitos de identidade revertem todo o seed, inclusive auditoria", async () => {
  for (const conflict of [
    "insert into public.seasons (year, name) values (2027, 'Outra identidade')",
    `insert into public.organizations (slug, name) values ('${vct2027.organizations[0].slug}', 'Outra identidade')`,
  ]) {
    await db.exec("begin");
    try {
      await db.exec(conflict);
      const before = await snapshot(db);
      await db.exec("savepoint seed_attempt");
      await assert.rejects(seed(db), { code: "23505" });
      await db.exec("rollback to savepoint seed_attempt");
      assert.deepEqual(await snapshot(db), before);
    } finally { await db.exec("rollback"); }
  }
});

test("conexão do seed exige URL privada e TLS verificado em host remoto", () => {
  assert.throws(() => databaseOptions(""), /Defina DATABASE_URL/);
  for (const url of ["not-a-url", "https://test/db", "postgres://host/db", "postgres://u:p@host/db?sslmode=disable", "postgres://u:p@host/db?sslmode=require", "postgres://u:p@host/db?password=secret"]) {
    assert.throws(() => databaseOptions(url));
  }
  assert.deepEqual(databaseOptions("postgres://u:p@db.example.com/db?sslmode=verify-full").options.ssl, { rejectUnauthorized: true });
  assert.equal(databaseOptions("postgres://u:p@127.0.0.1/db").options.ssl, false);
  const run = spawnSync(process.execPath, ["scripts/seed-vct-2027.mjs"], { env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8", windowsHide: true });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Defina DATABASE_URL/);
  assert.doesNotMatch(run.stdout, /confirmado/);
});
