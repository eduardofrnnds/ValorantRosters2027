import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createTestDatabase } from "../tests/helpers/database.mjs";
import { buildSeedSql } from "./lib/seed-vct-2027.mjs";
import { organizationHttpChecks, organizationBrowserChecks } from "./lib/verify-organizations.mjs";
import { playerHttpChecks, playerBrowserChecks } from "./lib/verify-players-admin.mjs";
import { draftHttpChecks, draftBrowserChecks } from "./lib/verify-roster-drafts.mjs";

// Isolated Auth/PostgREST doubles + real PostgreSQL RLS. No production accounts.
const base = "http://127.0.0.1:3020";
import { publicationHttpChecks, publicationBrowserChecks } from "./lib/verify-roster-publication.mjs";

import { transferHttpChecks, transferBrowserChecks } from "./lib/verify-manual-transfers.mjs";

const artifacts = process.env.ADMIN_ARTIFACTS ?? "artifacts/task-17/admin";
const adminPaths = ["/admin", "/admin/organizations", "/admin/players", "/admin/rosters", "/admin/transfers"];
const key = "sb_publishable_admin_test";
const cookieName = "vct-admin-access";
const password = `isolated-${randomUUID()}`;
const users = Object.fromEntries(["admin", "member", "disabled"].map((name) => [name, {
  id: randomUUID(), email: `${name}@example.test`, aud: "authenticated", role: "authenticated",
  created_at: new Date().toISOString(), app_metadata: {}, user_metadata: { role: "admin", is_admin: true },
}]));
const sessions = new Map();
const report = [];
let db, api, server;
let failure = "";
let authCalls = 0;
let dbCalls = 0;
let logoutCalls = 0;
let countCalls = 0;

function issue(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, exp, session_id: randomUUID() })).toString("base64url")}.${Buffer.from(randomUUID()).toString("base64url")}`;
  sessions.set(token, { user, exp });
  return { access_token: token, refresh_token: `unused-${randomUUID()}`, token_type: "bearer", expires_in: 3600, expires_at: exp, user };
}
function json(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}
async function start(configured) {
  const env = { ...process.env,
    SUPABASE_ORGANIZATION_LOGOS_BUCKET: "",
    SUPABASE_PLAYER_PHOTOS_BUCKET: "",
    NEXT_PUBLIC_SUPABASE_URL: configured ? `http://127.0.0.1:${api.address().port}` : "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured ? key : "", DATABASE_URL: "PRIVATE_TASK10_SENTINEL",
  };
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3020"], { env, windowsHide: true, stdio: "inherit" });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Next encerrou antes de ficar pronto.");
    try { if ((await fetch(`${base}/admin/login`)).status === 200) return; } catch { /* Startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Timeout iniciando Next.");
}
async function stop() {
  if (server && server.exitCode === null) { const done = once(server, "exit"); server.kill(); await done; }
  server = undefined;
}
async function request(path, options = {}) {
  const response = await fetch(base + path, { redirect: "manual", ...options });
  const html = await response.text();
  assert.ok(!html.includes(password));
  assert.ok(!html.includes("PRIVATE_TASK10_SENTINEL"));
  assert.match(response.headers.get("cache-control"), /no-store/);
  return { response, html, location: response.headers.get("location"), cookie: response.headers.get("set-cookie") };
}
const post = (path, body, cookie, origin = base) => request(path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body });
const credentials = (name, pass = password) => new URLSearchParams({ email: users[name].email, password: pass }).toString();
const cookiePair = (value) => value.split(";")[0];
function metric(html, key, count) {
  const card = html.match(new RegExp(`data-metric="${key}"[\\s\\S]*?data-count-value=""[\\s\\S]*?</p>`))?.[0];
  assert.ok(card, `Card ${key} not found`);
  if (count === null) {
    assert.match(card, /data-count-state="unavailable"/);
    assert.doesNotMatch(card, /data-count-value="">0<\/p>/);
  } else {
    assert.match(card, /data-count-state="ready"/);
    assert.ok(card.includes(`data-count-value="">${count.toLocaleString("pt-BR")}</p>`), `${key} expected ${count}`);
  }
}

try {
  await mkdir(artifacts, { recursive: true });
  ({ db } = await createTestDatabase());
  for (const user of Object.values(users)) await db.query("insert into auth.users(id) values($1)", [user.id]);
  for (const name of ["admin", "disabled"]) await db.query("insert into public.admin_users(user_id, is_active) values($1,$2)", [users[name].id, name === "admin"]);
  api = createServer(async (incoming, response) => {
    try {
      assert.equal(incoming.headers.apikey, key);
      const url = new URL(incoming.url, "http://localhost");
      const token = incoming.headers.authorization?.replace(/^Bearer /, "");
      const session = sessions.get(token);
      if (url.pathname.startsWith("/auth/v1/")) authCalls++;
      if (failure === "auth" && url.pathname.startsWith("/auth/v1/")) return json(response, { message: "isolated outage" }, 503);
      if (url.pathname === "/auth/v1/token") {
        assert.equal(incoming.method, "POST");
        assert.equal(url.searchParams.get("grant_type"), "password");
        let body = "";
        for await (const chunk of incoming) body += chunk;
        const data = JSON.parse(body);
        const user = Object.values(users).find((entry) => entry.email === data.email);
        if (!user || data.password !== password) return json(response, { error_code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
        return json(response, issue(user));
      }
      const publicTimeline = incoming.method === "POST" && url.pathname === "/rest/v1/rpc/read_roster_timeline" && token === key;
      const publicRead = publicTimeline || incoming.method === "GET" && token === key && ["regions", "seasons", "organizations", "team_seasons", "players", "player_slug_history", "roster_memberships"].includes(url.pathname.replace("/rest/v1/", ""));
      if (!publicRead && (!session || session.exp <= Date.now() / 1000)) return json(response, { msg: "Invalid JWT" }, 401);
      if (url.pathname === "/auth/v1/user") {
        assert.equal(incoming.method, "GET");
        return json(response, session.user);
      }
      if (url.pathname === "/auth/v1/logout") {
        assert.equal(incoming.method, "POST");
        assert.equal(url.searchParams.get("scope"), "local");
        logoutCalls++;
        sessions.delete(token);
        response.writeHead(204); response.end(); return;
      }
      const table = url.pathname.replace("/rest/v1/", "");
      if (incoming.method === "GET" && ["regions", "seasons", "organizations", "team_seasons", "players", "player_slug_history", "roster_memberships", "roster_drafts"].includes(table)) {
        if (failure === "catalog") return json(response, { message: "isolated catalog outage" }, 503);
        const allowed = new Set(["id", "name", "slug", "short_name", "logo_url", "publication_status", "updated_at", "year", "organization_id", "season_id", "region_id", "partner_status", "archived_at", "nickname", "nationality", "role", "photo_url", "links", "player_id", "was_published", "retired_at", "team_season_id", "status", "start_date", "end_date", "roster_revision", "base_revision", "payload", "created_by", "role_is_explicit", "published_at", "published_by", "publication_source_url"]);
        const selected = url.searchParams.get("select").split(",");
        assert.ok(selected.every((column) => allowed.has(column)));
        const values = [], conditions = [];
        for (const field of ["id", "slug", "publication_status", "player_id", "was_published", "organization_id", "season_id", "team_season_id"]) {
          const value = url.searchParams.get(field);
          if (value?.startsWith("in.(") && field === "id") {
            const ids = value.slice(4, -1).split(","); assert.ok(ids.every((id) => /^[0-9a-f-]{36}$/.test(id)));
            values.push(ids); conditions.push(`id=any($${values.length}::uuid[])`);
          } else if (value) { assert.ok(value.startsWith("eq.")); values.push(value.slice(3)); conditions.push(`${field}=$${values.length}`); }
        }
        const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
        const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 500);
        assert.ok(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 500);
        const result = await db.transaction(async (tx) => {
          await tx.exec(`set local role ${publicRead ? "anon" : "authenticated"}`);
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [publicRead ? "" : session.user.id]);
          const count = (await tx.query(`select count(*)::int as n from public.${table}${where}`, values)).rows[0].n;
          const rows = (await tx.query(`select to_jsonb(r) as row from (select ${selected.join(",")} from public.${table}${where} order by id limit ${limit} offset ${offset}) r`, values)).rows.map((entry) => entry.row);
          return { count, rows };
        });
        response.setHeader("Content-Range", `${offset}-${offset + result.rows.length - 1}/${result.count}`);
        return json(response, result.rows);
      }
      if (incoming.method === "POST" && table.startsWith("rpc/")) {
        const rpc = table.slice(4);
        assert.ok(["admin_save_organization", "admin_save_team_season", "admin_save_season", "admin_save_player", "admin_save_roster_draft", "admin_publish_roster_draft", "admin_archive_roster_draft", "admin_transfer_player", "read_roster_timeline"].includes(rpc));
        let body = ""; for await (const chunk of incoming) body += chunk;
        const parameters = JSON.parse(body);
        if (rpc === "read_roster_timeline" && failure === "timeline") return json(response, {message: "isolated timeline outage"}, 503);
        try {
          const id = await db.transaction(async (tx) => {
            await tx.exec(`set local role ${publicTimeline ? "anon" : "authenticated"}`);
            await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [publicTimeline ? "" : session.user.id]);
            if (rpc === "read_roster_timeline") return (await tx.query("select public.read_roster_timeline($1::jsonb) as result", [JSON.stringify(parameters.filters)])).rows[0].result;
            if (rpc === "admin_archive_roster_draft") return (await tx.query("select public.admin_archive_roster_draft($1,$2::timestamptz) as id", [parameters.draft_id, parameters.expected_updated_at])).rows[0].id;
            return (await tx.query(`select public.${rpc}($1::jsonb) as id`, [JSON.stringify(["admin_save_roster_draft", "admin_publish_roster_draft", "admin_transfer_player"].includes(rpc) ? parameters.input : parameters.payload)])).rows[0].id;
          });
          return json(response, id);
        } catch (error) { return json(response, { code: error.code, message: "isolated constraint error" }, 400); }
      }
      if (["organizations", "players", "roster_memberships", "roster_changes", "roster_drafts"].includes(table)) {
        assert.equal(incoming.method, "HEAD");
        assert.equal(incoming.headers.prefer, "count=exact");
        assert.equal(url.searchParams.get("select"), "id");
        assert.equal(url.searchParams.get("limit"), null);
        countCalls++;
        if (failure === "counts" || failure === `count:${table}`) return json(response, { message: "isolated count outage" }, 503);
        let where = "";
        if (table === "roster_drafts") {
          assert.equal(url.searchParams.get("status"), "eq.draft");
          where = " where status = 'draft'";
        }
        if (url.searchParams.has("change_type")) {
          assert.equal(table, "roster_changes");
          assert.equal(url.searchParams.get("change_type"), "eq.transferred");
          where = " where change_type = 'transferred'";
        }
        const count = await db.transaction(async (tx) => {
          await tx.exec("set local role authenticated");
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [session.user.id]);
          return (await tx.query(`select count(*)::int as count from public.${table}${where}`)).rows[0].count;
        });
        response.writeHead(200, { "Content-Range": `*/${count}` });
        response.end(); return;
      }
      assert.equal(url.pathname, "/rest/v1/admin_users");
      assert.equal(incoming.method, "GET");
      dbCalls++;
      if (failure === "database") return json(response, { message: "isolated DB outage" }, 503);
      assert.equal(url.searchParams.get("user_id"), `eq.${session.user.id}`);
      assert.equal(url.searchParams.get("is_active"), "eq.true");
      const rows = await db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [session.user.id]);
        return (await tx.query("select user_id, is_active from public.admin_users where user_id=$1 and is_active", [session.user.id])).rows;
      });
      json(response, rows);
    } catch { json(response, { message: "Test adapter failed" }, 500); }
  });
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", resolve); });

  await start(false);
  for (const path of [...adminPaths, "/admin/audit"]) {
    const result = await request(path);
    assert.equal(result.response.status, 303);
    assert.equal(new URL(result.location, base).pathname, "/admin/login");
    assert.ok(!result.html.includes("data-metric="));
  }
  const unavailable = await request("/admin/login");
  assert.equal(unavailable.response.status, 200);
  assert.match(unavailable.html, /<fieldset disabled/);
  assert.match(unavailable.html, /indisponível/);
  assert.match((await post("/admin/auth/login", credentials("admin"))).location, /status=unavailable/);
  assert.equal(authCalls, 0);
  assert.equal(countCalls, 0);
  report.push("Unconfigured: login disabled, protected routes blocked, no upstream requests");
  await writeFile(`${artifacts}/login-unconfigured.html`, unavailable.html);
  await stop();

  await start(true);
  const login = await request("/admin/login");
  assert.equal(login.response.status, 200);
  assert.ok(!login.html.includes("<fieldset disabled"));
  assert.match(login.html, /name="password"/);
  assert.match(login.html, /name="email"/);
  assert.match(login.html, /name="robots" content="noindex, nofollow"/);
  assert.match(login.html, /action="\/admin\/auth\/login" method="post"/);
  for (const status of ["__proto__", "constructor", "%3Cscript%3E"]) assert.equal((await request(`/admin/login?status=${status}`)).response.status, 200);
  await writeFile(`${artifacts}/login-configured.html`, login.html);
  const beforeCSRF = authCalls;
  for (const path of ["/admin/auth/login", "/admin/auth/logout"]) {
    assert.equal((await request(path)).response.status, 405);
    for (const origin of ["https://evil.example", ""]) assert.equal((await post(path, credentials("admin"), undefined, origin)).response.status, 403);
  }
  assert.equal(authCalls, beforeCSRF);
  assert.match((await post("/admin/auth/login", "email=bad&password=x")).location, /status=invalid/);
  assert.match((await post("/admin/auth/login", "email=x&password=" + "x".repeat(17000))).location, /status=invalid/);
  assert.match((await post("/admin/auth/login", credentials("admin", "wrong"))).location, /status=denied/);
  for (const name of ["member", "disabled"]) {
    const result = await post("/admin/auth/login", credentials(name));
    assert.match(result.location, /status=denied/);
    assert.match(result.cookie, /Max-Age=0/i);
    // Even a real Auth token does not authorize entry when the allowlist denies it.
    const issued = issue(users[name]);
    const beforeCounts = countCalls;
    for (const path of adminPaths) assert.equal((await request(path, { headers: { Cookie: `${cookieName}=${issued.access_token}` } })).response.status, 303);
    assert.equal(countCalls, beforeCounts);
  }
  const signedIn = await post("/admin/auth/login", credentials("admin") + "&next=https%3A%2F%2Fevil.example");
  assert.equal(signedIn.response.status, 303);
  assert.equal(new URL(signedIn.location, base).href, `${base}/admin`);
  for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=strict/i, /Path=\/admin/i, /Max-Age=[1-9]\d*/i]) assert.match(signedIn.cookie, attribute);
  assert.ok(!signedIn.cookie.includes("refresh"));
  const cookie = cookiePair(signedIn.cookie);
  const admin = await request("/admin", { headers: { Cookie: cookie } });
  assert.equal(admin.response.status, 200);
  assert.match(admin.html, /<h1[^>]*>Dashboard<\/h1>/);
  for (const key of ["organizations", "players", "changes", "drafts"]) metric(admin.html, key, 0);
  assert.match(admin.html, /Sem dados cadastrados/);
  assert.match(admin.html, /action="\/admin\/auth\/logout" method="post"/);
  assert.ok(!admin.html.includes(cookie.split("=")[1]));
  for (const match of admin.html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const source = await (await fetch(new URL(match[1], base))).text();
    assert.ok(!source.includes(cookie.split("=")[1]));
    assert.ok(!source.includes("PRIVATE_TASK10_SENTINEL"));
  }
  await writeFile(`${artifacts}/admin-authorized.html`, admin.html);
  let rsc = await request("/admin?_rsc=isolated", { headers: { RSC: "1", Cookie: cookie } });
  if (rsc.response.status === 307) {
    // Next 16 canonicalizes the RSC cache-key query before rendering.
    const canonical = new URL(rsc.location, base);
    assert.equal(canonical.pathname, "/admin");
    rsc = await request(canonical.pathname + canonical.search, { headers: { RSC: "1", Cookie: cookie } });
  }
  assert.equal(rsc.response.status, 200);
  assert.match(rsc.html, /Dashboard/);
  assert.equal((await request("/admin?_rsc=isolated", { headers: { RSC: "1" } })).response.status, 303);
  const forged = cookie.slice(0, -4) + "fake";
  assert.equal((await request("/admin", { headers: { Cookie: forged } })).response.status, 303);
  assert.equal((await request("/admin", { headers: { Cookie: cookie, "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" } })).response.status, 200);
  const bypassAttempt = await request("/admin", { headers: { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" } });
  assert.equal(new URL(bypassAttempt.location, base).pathname, "/admin/login");
  assert.ok(!bypassAttempt.html.includes("data-metric="));
  assert.equal((await post("/admin", "", undefined)).response.status, 303);
  // Real SQL fixtures stay isolated in memory; no application CRUD is introduced.
  await db.exec(buildSeedSql());
  await db.exec("insert into public.organizations(slug,name) values ('isolated-draft-org','Isolated draft org')");
  const player = (await db.query("insert into public.players(slug,nickname,publication_status,published_at) values ('isolated-player','Isolated player','published',now()) returning id")).rows[0].id;
  await db.exec("insert into public.players(slug,nickname) values ('isolated-draft-player','Isolated draft player')");
  const teams = (await db.query("select id from public.team_seasons order by id limit 2")).rows;
  const from = (await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date,end_date) values($1,$2,'starter','2027-01-01','2027-01-31') returning id", [player, teams[0].id])).rows[0].id;
  const to = (await db.query("insert into public.roster_memberships(player_id,team_season_id,status,start_date) values($1,$2,'starter','2027-02-01') returning id", [player, teams[1].id])).rows[0].id;
  await db.query("insert into public.roster_changes(player_id,to_membership_id,change_type,occurred_on,summary) values($1,$2,'joined','2027-01-01','Isolated join')", [player, from]);
  await db.query("insert into public.roster_changes(player_id,from_membership_id,to_membership_id,change_type,occurred_on,summary) values($1,$2,$3,'transferred','2027-02-01','Isolated transfer')", [player, from, to]);
  for (const status of ["draft", "draft", "published", "archived"]) await db.query("insert into public.roster_drafts(team_season_id,created_by,status,published_at) values($1,$2,$3,$4)", [teams[0].id, users.admin.id, status, status === "published" ? new Date().toISOString() : null]);
  const auditCount = async () => (await db.query("select count(*)::int as count from public.audit_logs")).rows[0].count;
  const auditBefore = await auditCount();
  const expected = { organizations: 33, players: 2, changes: 2, drafts: 2, memberships: 2, transfers: 1 };
  for (const [index, path] of adminPaths.entries()) {
    const result = await request(path, { headers: { Cookie: cookie } });
    assert.equal(result.response.status, 200);
    const keys = index === 0 ? ["organizations", "players", "changes", "drafts"] : index === 4 ? ["transfers", "changes"] : [];
    if (index === 1) assert.ok(result.html.replace(/<!--[\s\S]*?-->/g, "").includes("33 no cadastro"), "Organization list total");
    if (index === 2) assert.ok(result.html.replace(/<!--[\s\S]*?-->/g, "").includes("2 no cadastro"), "Player list total");
    for (const key of keys) metric(result.html, key, expected[key]);
    assert.match(result.html, new RegExp(`aria-current="page"[^>]*href="${path}"`));
    assert.match(result.html, /Menu administrativo/);
    assert.equal((result.html.match(/<main[\s>]/g) ?? []).length, 1);
    await writeFile(`${artifacts}/${index === 0 ? "dashboard-populated" : path.split("/").at(-1)}.html`, result.html);
  }
  assert.equal(await auditCount(), auditBefore, "Read-only dashboard must not write to the database");
  await db.exec("insert into public.organizations(slug,name) values ('isolated-added-org','Isolated added org'); update public.roster_drafts set status='archived' where id=(select id from public.roster_drafts where status='draft' limit 1)");
  const refreshed = await request("/admin", { headers: { Cookie: cookie } });
  metric(refreshed.html, "organizations", 34);
  metric(refreshed.html, "drafts", 1);
  failure = "count:players";
  const partial = await request("/admin", { headers: { Cookie: cookie } });
  metric(partial.html, "organizations", 34);
  metric(partial.html, "players", null);
  metric(partial.html, "changes", 2);
  assert.match(partial.html, /Algumas contagens/);
  await writeFile(`${artifacts}/dashboard-partial-error.html`, partial.html);
  failure = "counts";
  const failed = await request("/admin", { headers: { Cookie: cookie } });
  for (const key of ["organizations", "players", "changes", "drafts"]) metric(failed.html, key, null);
  assert.match(failed.html, /Contagens indisponíveis/);
  assert.doesNotMatch(failed.html, /Sem dados/);
  await writeFile(`${artifacts}/dashboard-error.html`, failed.html);
  failure = "";
  report.push("Dashboard: exact HEAD counts from real SQL/RLS; zero, populated, draft/published/archived, historical memberships, partial/total outage and fresh counts");
  report.push("All four section links return protected summaries; active navigation; one main landmark; read-only requests preserve audit log");
  await organizationHttpChecks({ db, request, post, cookie, artifacts, base });
  report.push("Organizations: native POST create/edit/publish/archive/restore, season management, stale edits, duplicate slug, CSRF and public visibility verified with real SQL/RLS");
  await playerHttpChecks({ db, request, post, cookie, artifacts, base });
  report.push("Players: create/edit/search/publish, same UUID on updates, replay rejection, unique generated slugs, public aliases/redirects, private aliases hidden, history preserved");
  const draftFixture = await draftHttpChecks({ db, request, post, cookie, artifacts, base });
  report.push("Drafts: authenticated save/edit/archive with preview, stale-base rejection, starter conflicts and unchanged public memberships/profiles/rosters");
  const publicationFixture = await publicationHttpChecks({ db, request, post, cookie, artifacts, base, excludeTeam: draftFixture.teamId });
  report.push("Publication: review/confirmation, atomic changes, career preservation, public update, source/author and idempotent replay verified");
  const transferFixture = await transferHttpChecks({ db, request, post, cookie, artifacts, base, setFailure: (value) => { failure = value; } });
  report.push("Transfers: transactional native publication, public feed/filters/timelines, preserved career, source/note, idempotent replay and outage states verified");
  // Deactivation must affect the same still-valid token, without logging in again.
  await db.query("update public.admin_users set is_active=false where user_id=$1", [users.admin.id]);
  const revoked = await request("/admin", { headers: { Cookie: cookie } });
  assert.equal(revoked.response.status, 303);
  assert.ok(!revoked.html.includes("data-metric="));
  const beforeRevokedCounts = countCalls;
  for (const path of adminPaths.slice(1)) assert.equal((await request(path, { headers: { Cookie: cookie } })).response.status, 303);
  assert.equal(countCalls, beforeRevokedCounts);
  await db.query("update public.admin_users set is_active=true where user_id=$1", [users.admin.id]);
  for (const mode of ["database", "auth"]) {
    failure = mode;
    assert.match((await request("/admin", { headers: { Cookie: cookie } })).location, /status=unavailable/);
  }
  failure = "";
  const expired = issue(users.admin);
  sessions.get(expired.access_token).exp = 0;
  assert.equal((await request("/admin", { headers: { Cookie: `${cookieName}=${expired.access_token}` } })).response.status, 303);
  const signedOut = await post("/admin/auth/logout", "", cookie);
  assert.match(signedOut.location, /status=signed-out/);
  assert.match(signedOut.cookie, /Max-Age=0/);
  assert.equal((await request("/admin", { headers: { Cookie: cookie } })).response.status, 303);
  failure = "auth";
  const localSignout = await post("/admin/auth/logout", "", `${cookieName}=${issue(users.admin).access_token}`);
  assert.match(localSignout.location, /status=local-signout/);
  assert.match(localSignout.cookie, /Max-Age=0/);
  report.push("Configured: HTML form, same-origin POST, invalid/oversized input, generic errors, no open redirect");
  report.push("Auth + PostgreSQL RLS: active admin allowed; member/disabled/forged/expired denied; revocation immediate");
  report.push("Protected SSR/RSC, no-store, HttpOnly/Secure/SameSite cookies, no token in HTML");
  report.push("Auth/DB outages deny access; POST logout clears cookie and requests local-scope revocation");
  await writeFile(`${artifacts}/results.json`, JSON.stringify({ checks: report, authCalls, dbCalls, countCalls, logoutCalls, infrastructure: "Auth/PostgREST test doubles, real PostgreSQL/PGlite and Next production server; no real Supabase", browser: "HTTP only" }, null, 2) + "\n");
  console.log("Admin aprovado por HTTP: login/logout, sessão protegida, RSC, CSRF, RLS, revogação e falhas fechadas.");
  if (process.argv.includes("--browser")) {
    failure = "";
    let browser;
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chromium"), headless: true });
      const checks = [];
      for (const width of [320, 390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${base}/admin/login`);
        await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
        const violations = await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id));
        assert.deepEqual(violations, []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${artifacts}/login-${width}.png`, fullPage: true });
        await page.getByLabel("E-mail", { exact: true }).fill(users.admin.email);
        await page.getByLabel("Senha", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Entrar", exact: true }).click();
        await page.waitForURL(`${base}/admin`);
        assert.ok(await page.getByRole("heading", { name: "Dashboard", exact: true }).isVisible());
        await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
        assert.deepEqual(await page.evaluate(async () => (await window.axe.run()).violations.map(({ id }) => id)), []);
        const nav = page.getByRole("navigation", { name: width < 1024 ? "Menu administrativo mobile" : "Navegação administrativa", exact: true });
        if (width < 1024) await page.getByText("Menu administrativo", { exact: true }).click();
        for (const [path, title] of [["/admin/organizations", "Organizações"], ["/admin/players", "Jogadores"], ["/admin/rosters", "Elencos"], ["/admin/transfers", "Transferências"]]) {
          await nav.getByRole("link", { name: title, exact: true }).click();
          await page.waitForURL(`${base}${path}`);
          assert.ok(await page.getByRole("heading", { name: title, exact: true }).first().isVisible());
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          if (width < 1024) await page.getByText("Menu administrativo", { exact: true }).click();
        }
        await nav.getByRole("link", { name: "Visão geral", exact: true }).click();
        await page.waitForURL(`${base}/admin`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${artifacts}/admin-${width}.png`, fullPage: true });
        await organizationBrowserChecks({ page, width, artifacts, base });
        await playerBrowserChecks({ page, width, artifacts, base });
        await draftBrowserChecks({ page, width, artifacts, base, ...draftFixture });
        await publicationBrowserChecks({ page, width, artifacts, base, ...publicationFixture });
        await transferBrowserChecks({ page, width, artifacts, base, ...transferFixture });
        await page.getByRole("button", { name: "Sair", exact: true }).click();
        await page.waitForURL(`${base}/admin/login?status=signed-out`);
        checks.push({ width, login: "passed", logout: "passed", overflow: false, axeLoginViolations: 0 });
        await context.close();
      }
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${base}/admin/login`);
      await page.getByLabel("E-mail", { exact: true }).fill(users.admin.email);
      await page.getByLabel("Senha", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL(`${base}/admin`);
      await organizationBrowserChecks({ page, width: 1280, artifacts, base, withoutJavaScript: true });
      await playerBrowserChecks({ page, width: 1280, artifacts, base, withoutJavaScript: true });
      await page.getByRole("button", { name: "Sair", exact: true }).click();
      await page.waitForURL(`${base}/admin/login?status=signed-out`);
      await context.close();
      await writeFile(`${artifacts}/browser.json`, JSON.stringify({ browser: browser.version(), checks, withoutJavaScript: "login/logout passed" }, null, 2) + "\n");
      console.log("Navegador aprovado: login/logout em quatro larguras, axe e fluxo sem JavaScript.");
    } catch (error) {
      if (!error.message.includes("spawn EPERM")) throw error;
      await writeFile(`${artifacts}/browser.json`, JSON.stringify({ status: "blocked", reason: "Browser launch: spawn EPERM; no browser checks completed" }, null, 2) + "\n");
      console.log("Navegador bloqueado pelo ambiente: spawn EPERM. Validação HTTP preservada.");
    } finally { await browser?.close(); }
  }
} finally {
  await stop();
  if (api) { api.closeAllConnections(); await new Promise((resolve) => api.close(resolve)); }
  await db?.close();
}
