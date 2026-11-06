import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.mjs";

let db;
before(async () => { ({ db } = await createTestDatabase()); });
after(async () => { await db?.close(); });

async function fixture(tx) {
  const admin = randomUUID(), other = randomUUID(), member = randomUUID();
  for (const id of [admin, other, member]) await tx.query("insert into auth.users(id) values($1)", [id]);
  for (const id of [admin, other]) await tx.query("insert into public.admin_users(user_id) values($1)", [id]);
  return { admin, other, member };
}
async function role(tx, id) {
  await tx.exec("set local role authenticated");
  await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
}

test("admin só lê sua autorização ativa; usuário comum não lê allowlist nem se promove", async () => {
  await db.transaction(async (tx) => {
    const f = await fixture(tx);
    await role(tx, f.admin);
    assert.deepEqual((await tx.query("select user_id from public.admin_users")).rows, [{ user_id: f.admin }]);
    await role(tx, f.member);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: f.member, user_metadata: { role: "admin", is_admin: true } })]);
    assert.equal((await tx.query("select * from public.admin_users")).rows.length, 0);
    assert.equal((await tx.query("select private.is_admin() as allowed")).rows[0].allowed, false);
    await tx.exec("savepoint denied");
    await assert.rejects(tx.query("insert into public.admin_users(user_id) values($1)", [f.member]), { code: "42501" });
    await tx.exec("rollback to savepoint denied");
    await tx.rollback();
  });
});

test("políticas restritivas impedem leitura privada e escrita mesmo com política permissiva adicional", async () => {
  await db.transaction(async (tx) => {
    const f = await fixture(tx);
    await tx.exec(`
      create policy accidental_read on public.audit_logs for select to authenticated using (true);
      create policy accidental_admin_list on public.admin_users for select to authenticated using (true);
      create policy accidental_insert on public.organizations for insert to authenticated with check (true);
      create policy accidental_update on public.organizations for update to authenticated using (true) with check (true);
      insert into public.organizations(slug, name, publication_status, published_at) values ('test', 'Original', 'published', now());
    `);
    await role(tx, f.member);
    assert.equal((await tx.query("select * from public.audit_logs")).rows.length, 0);
    assert.equal((await tx.query("select * from public.admin_users")).rows.length, 0);
    assert.equal((await tx.query("update public.organizations set name = 'Forged' returning id")).rows.length, 0);
    await tx.exec("savepoint denied");
    await assert.rejects(tx.exec("insert into public.organizations(slug,name) values ('forged','Forged')"), { code: "42501" });
    await tx.exec("rollback to savepoint denied");
    await role(tx, f.admin);
    assert.ok((await tx.query("select * from public.audit_logs")).rows.length > 0);
    assert.equal((await tx.query("select user_id from public.admin_users")).rows.length, 1);
    assert.equal((await tx.query("update public.organizations set name = 'Authorized' returning id")).rows.length, 1);
    await tx.rollback();
  });
});

test("desativação retira allowlist, dados privados e escrita na próxima consulta", async () => {
  await db.transaction(async (tx) => {
    const f = await fixture(tx);
    await role(tx, f.admin);
    assert.equal((await tx.query("select * from public.admin_users")).rows.length, 1);
    await tx.exec("reset role");
    await tx.query("update public.admin_users set is_active = false where user_id = $1", [f.admin]);
    await role(tx, f.admin);
    assert.equal((await tx.query("select * from public.admin_users")).rows.length, 0);
    assert.equal((await tx.query("select * from public.audit_logs")).rows.length, 0);
    await tx.exec("savepoint denied");
    await assert.rejects(tx.exec("insert into public.organizations(slug,name) values ('disabled','Disabled')"), { code: "42501" });
    await tx.exec("rollback to savepoint denied");
    await tx.rollback();
  });
});
