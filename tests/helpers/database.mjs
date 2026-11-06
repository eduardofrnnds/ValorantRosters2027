import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const migrationDirectory = new URL("../../supabase/migrations/", import.meta.url);

export async function createTestDatabase() {
  const db = new PGlite();
  // Test-only Supabase contract: no accounts, passwords, tokens, or network.
  // The real platform provides auth.users/auth.uid() and these roles itself.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  const migrations = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
  try {
    for (const filename of migrations) await db.exec(await readFile(new URL(filename, migrationDirectory), "utf8"));
    return { db, migrations };
  } catch (error) {
    await db.close();
    throw error;
  }
}
