import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createAdminAuthClient } from "../src/features/admin/auth-model.ts";
import { readAdminMetrics } from "../src/features/admin/dashboard-reader.ts";
import { dashboardKeys, adminSections } from "../src/features/admin/dashboard-model.ts";
import { loadComponent } from "./helpers/load-component.mjs";

const config = { url: "https://isolated-test.supabase.co", key: "sb_publishable_test" };
const token = "isolated-user-token";
const { MetricCards, MetricsNotice, AdminShortcuts } = loadComponent(new URL("../src/features/admin/dashboard.tsx", import.meta.url));
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

test("contagens usam HEAD exato com token do admin, sem limite de listagem, e filtros de rascunho/transferência", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(init.method, "HEAD");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal);
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(new Headers(init.headers).get("prefer"), "count=exact");
    assert.equal(url.searchParams.get("select"), "id");
    assert.equal(url.searchParams.get("limit"), null);
    return new Response(null, { headers: { "Content-Range": "*/12001" } });
  });
  const keys = [...dashboardKeys, "memberships", "transfers"];
  const result = await readAdminMetrics(createAdminAuthClient(config, token), keys);
  for (const key of keys) assert.deepEqual(result[key], { status: "ready", count: 12001 });
  assert.equal(calls.length, 6);
  assert.deepEqual(calls.map((url) => [url.pathname, url.searchParams.get("status"), url.searchParams.get("change_type")]), [
    ["/rest/v1/organizations", null, null], ["/rest/v1/players", null, null],
    ["/rest/v1/roster_changes", null, null], ["/rest/v1/roster_drafts", "eq.draft", null],
    ["/rest/v1/roster_memberships", null, null], ["/rest/v1/roster_changes", null, "eq.transferred"],
  ]);
});

test("zero é válido; falhas parciais, ausência de total e total inválido ficam indisponíveis", async (t) => {
  let mode = "http";
  t.mock.method(globalThis, "fetch", async (input) => {
    if (new URL(input).pathname.endsWith("organizations")) return new Response(null, { headers: { "Content-Range": "*/0" } });
    if (mode === "network") throw new Error("private upstream details");
    if (mode === "http") return new Response(null, { status: 403 });
    return new Response(null, { headers: mode === "missing" ? {} : { "Content-Range": `*/${mode}` } });
  });
  for (mode of ["http", "network", "missing", "NaN", "-1", "9007199254740992"]) {
    const result = await readAdminMetrics(createAdminAuthClient(config, token), ["organizations", "players"]);
    assert.deepEqual(result, { organizations: { status: "ready", count: 0 }, players: { status: "unavailable" } });
    assert.ok(!JSON.stringify(result).includes("private"));
  }
});

test("cards distinguem vazio, erro e números grandes; atalhos apontam para as quatro áreas", () => {
  const metrics = { organizations: { status: "ready", count: 12001 }, players: { status: "ready", count: 0 }, changes: { status: "unavailable" }, drafts: { status: "ready", count: 3 } };
  const html = render(MetricCards, { keys: dashboardKeys, metrics });
  assert.match(html, />12\.001<\/p>/);
  assert.match(html, /data-count-value="">0<\/p>/);
  assert.match(html, /Sem dados/);
  assert.match(html, /aria-label="Contagem indisponível"/);
  assert.match(html, /href="\/admin\/rosters#rascunhos"/);
  assert.match(render(MetricsNotice, { keys: dashboardKeys, metrics }), /Algumas contagens estão indisponíveis/);
  assert.match(render(MetricsNotice, { keys: dashboardKeys, metrics: {} }), /Contagens indisponíveis/);
  assert.doesNotMatch(render(MetricsNotice, { keys: dashboardKeys, metrics: {} }), /Sem dados/);
  const zero = Object.fromEntries(dashboardKeys.map((key) => [key, { status: "ready", count: 0 }]));
  assert.match(render(MetricsNotice, { keys: dashboardKeys, metrics: zero }), /Sem dados cadastrados/);
  const shortcuts = render(AdminShortcuts);
  for (const section of adminSections) assert.ok(shortcuts.includes(`href="${section.href}"`));
});
