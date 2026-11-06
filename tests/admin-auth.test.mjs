import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { verifyAdminAccess, loginAdmin, logoutAdmin, runAdminOperation, loginSchema, isAccessToken } from "../src/features/admin/auth-model.ts";
import { isSameOriginPost, readLoginForm } from "../src/features/admin/http-security.ts";

const config = { url: "https://isolated-test.supabase.co", key: "sb_publishable_test" };
const id = randomUUID();
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.isolated`;
const user = { id, email: "admin@example.test", aud: "authenticated", role: "authenticated", created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

test("sem token válido não consulta Auth; cookies de usuário/claims não concedem acesso", async () => {
  for (const value of [undefined, "", "forged", JSON.stringify({ user, role: "admin" }), "x".repeat(4000)]) {
    assert.equal(isAccessToken(value), false);
    assert.deepEqual(await verifyAdminAccess(config, value), { status: "anonymous" });
  }
});

test("Auth confirmado + allowlist atual são necessários; falhas, revogação e metadados não concedem acesso", async (t) => {
  let kind = "admin";
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    calls.push(url.pathname);
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal);
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${token}`);
    if (url.pathname === "/auth/v1/user") {
      if (kind === "forged") return json({ msg: "Invalid JWT" }, 401);
      if (kind === "offline") throw new Error("upstream secret must not escape");
      return json({ ...user, user_metadata: { role: "admin", is_admin: true } });
    }
    assert.equal(url.pathname, "/rest/v1/admin_users");
    assert.equal(url.searchParams.get("user_id"), `eq.${id}`);
    assert.equal(url.searchParams.get("is_active"), "eq.true");
    if (kind === "db-error") return json({ message: "private database error" }, 403);
    return json(kind === "admin" ? [{ user_id: id, is_active: true }] : kind === "different-id" ? [{ user_id: randomUUID(), is_active: true }] : []);
  });
  assert.deepEqual(await verifyAdminAccess(config, token), { status: "authorized", userId: id });
  for (const value of ["member", "disabled", "different-id"]) {
    kind = value;
    assert.deepEqual(await verifyAdminAccess(config, token), { status: "denied" });
  }
  kind = "forged";
  calls.length = 0;
  assert.deepEqual(await verifyAdminAccess(config, token), { status: "anonymous" });
  assert.deepEqual(calls, ["/auth/v1/user"]);
  for (const value of ["offline", "db-error"]) {
    kind = value;
    assert.deepEqual(await verifyAdminAccess(config, token), { status: "unavailable" });
  }
});

test("login valida entradas, mantém senha intacta e só retorna token após autorização", async (t) => {
  const password = "  password kept intact  ";
  let allowed = true;
  let logoutCalls = 0;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    if (url.pathname === "/auth/v1/token") {
      assert.equal(url.searchParams.get("grant_type"), "password");
      const credentials = JSON.parse(init.body);
      assert.equal(credentials.email, "admin@example.test");
      assert.equal(credentials.password, password);
      return json({ access_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "NEVER_RETURN_REFRESH", user });
    }
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") { logoutCalls++; assert.equal(url.searchParams.get("scope"), "local"); return new Response(null, { status: 204 }); }
    return json(allowed ? [{ user_id: id, is_active: true }] : []);
  });
  assert.equal(loginSchema.safeParse({ email: "bad", password: "x" }).success, false);
  assert.deepEqual(await loginAdmin(config, { email: "bad", password: "" }), { status: "invalid" });
  const result = await loginAdmin(config, { email: " admin@example.test ", password });
  assert.equal(result.status, "authorized");
  assert.equal(result.token, token);
  assert.ok(result.maxAge > 0 && result.maxAge <= 3600);
  assert.ok(!JSON.stringify(result).includes("NEVER_RETURN_REFRESH"));
  allowed = false;
  assert.deepEqual(await loginAdmin(config, { email: "admin@example.test", password }), { status: "denied" });
  assert.equal(logoutCalls, 1);
  assert.equal(await logoutAdmin(config, token), true);
  assert.equal(logoutCalls, 2);
});

test("operação de escrita revalida autorização antes de chamar callback, inclusive após revogação", async (t) => {
  let allowed = true;
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (input) => new URL(input).pathname === "/auth/v1/user" ? json(user) : json(allowed ? [{ user_id: id, is_active: true }] : []));
  const operation = async ({ userId }) => { assert.equal(userId, id); writes++; return "saved"; };
  assert.equal(await runAdminOperation(config, token, operation), "saved");
  allowed = false;
  await assert.rejects(runAdminOperation(config, token, operation), /negado/);
  await assert.rejects(runAdminOperation(config, undefined, operation), /negado/);
  assert.equal(writes, 1);
});

test("POSTs exigem mesma origem; corpo limitado e campos duplicados são rejeitados", async () => {
  const request = (body, headers = {}) => new Request("https://site.example/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://site.example", ...headers }, body });
  assert.equal(isSameOriginPost(request("")), true);
  assert.equal(isSameOriginPost(new Request("https://internal.example/admin/auth/login", { method: "POST", headers: { Host: "site.example", Origin: "https://site.example" } })), true);
  assert.equal(isSameOriginPost(request("", { Host: "site.example", Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" })), false);
  for (const origin of ["https://evil.example", "null", "http://site.example", "https://site.example.evil.example"]) assert.equal(isSameOriginPost(request("", { Origin: origin })), false);
  assert.equal(isSameOriginPost(new Request("https://site.example/admin/auth/logout", { method: "POST" })), false);
  assert.equal(isSameOriginPost(new Request("https://site.example/admin/auth/logout")), false);
  assert.deepEqual(await readLoginForm(request("email=admin%40example.test&password=+kept+")), { email: "admin@example.test", password: " kept " });
  assert.equal(await readLoginForm(request("email=a&email=b&password=x")), null);
  assert.equal(await readLoginForm(request("email=a&password=x", { "Content-Type": "application/json" })), null);
  assert.equal(await readLoginForm(request("password=" + "x".repeat(17_000))), null);
});
