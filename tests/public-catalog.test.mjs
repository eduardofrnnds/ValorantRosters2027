import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { parsePublicSupabaseConfig } from "../src/lib/supabase/config.ts";
import { hasPublicOrganization, readPublicCatalogRows } from "../src/lib/supabase/catalog-reader.ts";
import { loadPublicCatalog, mapPublicCatalog } from "../src/features/organizations/public-catalog-model.ts";
import { vct2027 } from "../src/features/organizations/data/vct-2027.ts";

const published = { publication_status: "published" };
function fixture() {
  const regions = vct2027.regions.map((region) => ({ ...region, id: randomUUID(), ...published }));
  return {
    regions,
    seasons: vct2027.seasons.map((season) => ({ ...season, ...published })),
    organizations: vct2027.organizations.map((org) => ({ ...org, short_name: null, logo_url: null, ...published })),
    team_seasons: vct2027.teamSeasons.map((team) => ({ id: randomUUID(), organization_id: team.organizationId, season_id: team.seasonId, region_id: regions.find((r) => r.slug === team.regionId).id, partner_status: team.partnerStatus, ...published })),
  };
}
const load = (configured, readRemote) => loadPublicCatalog({ configured, readRemote, localCatalog: vct2027, year: 2027 });

test("consulta de status de equipe filtra slug/publicação e distingue ausência de falha", async () => {
  for (const [body, status, expected] of [[[{ id: randomUUID() }], 200, true], [[], 200, false], [{ message: "denied" }, 403, null]]) {
    const client = createClient("https://test.supabase.co", "sb_publishable_test", { auth: { persistSession: false }, global: { fetch: async (input) => {
      const url = new URL(input);
      assert.equal(url.searchParams.get("slug"), "eq.100-thieves");
      assert.equal(url.searchParams.get("publication_status"), "eq.published");
      assert.equal(url.searchParams.get("limit"), "1");
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    } } });
    if (expected === null) await assert.rejects(hasPublicOrganization(client, "100-thieves"));
    else assert.equal(await hasPublicOrganization(client, "100-thieves"), expected);
  }
});

test("configuração ausente permite leitura local; parcial, URL insegura e chave privilegiada são rejeitadas", () => {
  assert.equal(parsePublicSupabaseConfig("", ""), null);
  const jwt = (role) => `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig`;
  assert.equal(parsePublicSupabaseConfig("https://test.supabase.co", jwt("anon")).key, jwt("anon"));
  assert.equal(parsePublicSupabaseConfig("http://127.0.0.1:54321", "sb_publishable_test").url, "http://127.0.0.1:54321");
  for (const [url, key] of [
    ["https://test.supabase.co", ""], ["", "sb_publishable_test"],
    ["https://test.supabase.co", "sb_secret_private"], ["https://test.supabase.co", jwt("service_role")],
    ["https://test.supabase.co", "garbage"], ["http://test.supabase.co", "sb_publishable_test"],
    ["https://user:password@test.supabase.co", "sb_publishable_test"], ["https://test.supabase.co/path", "sb_publishable_test"],
  ]) assert.throws(() => parsePublicSupabaseConfig(url, key));
});

test("fallback é exclusivamente sem configuração; vazio, erro e dados inválidos não usam snapshot", async () => {
  assert.deepEqual(await load(false, () => { throw new Error("Não deve consultar"); }), { status: "ready", source: "local", catalog: vct2027 });
  assert.deepEqual(await load(true, async () => ({ regions: [], seasons: [], organizations: [], team_seasons: [] })), { status: "empty", source: "supabase" });
  for (const read of [async () => { throw new Error("offline"); }, async () => ({ bad: true })]) {
    assert.deepEqual(await load(true, read), { status: "unavailable", source: "supabase" });
  }
  const rows = fixture();
  rows.organizations[0].name = "Nome recebido do banco";
  const result = await load(true, async () => rows);
  assert.equal(result.source, "supabase");
  assert.equal(result.catalog.organizations[0].name, "Nome recebido do banco");
});

test("mapeamento mantém identidades, aceita equipes extras e rejeita rascunhos/referências quebradas", () => {
  const rows = fixture();
  const extra = { ...rows.organizations[0], id: randomUUID(), slug: "extra", name: "Extra" };
  rows.organizations.push(extra);
  rows.team_seasons.push({ ...rows.team_seasons[0], id: randomUUID(), organization_id: extra.id, partner_status: "visitor" });
  const mapped = mapPublicCatalog(rows);
  assert.equal(mapped.teamSeasons.length, 33);
  assert.equal(mapped.teamSeasons.at(-1).partnerStatus, "visitor");
  assert.equal(mapped.teamSeasons[0].regionId, "americas");
  assert.equal(mapped.organizations[0].id, vct2027.organizations[0].id);
  for (const mutate of [
    (data) => { data.organizations[0].publication_status = "draft"; },
    (data) => { data.team_seasons[0].region_id = randomUUID(); },
    (data) => { data.team_seasons[0].organization_id = randomUUID(); },
    (data) => { data.regions.push(data.regions[0]); },
    (data) => { data.organizations[0].logo_url = "javascript:alert(1)"; },
  ]) { const invalid = fixture(); mutate(invalid); assert.throws(() => mapPublicCatalog(invalid)); }
});

test("cliente Supabase real pagina abaixo do limite solicitado e só consulta publicações", async () => {
  const rows = fixture();
  const calls = [];
  const client = createClient("https://test.supabase.co", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      const table = url.pathname.split("/").at(-1);
      const offset = Number(url.searchParams.get("offset"));
      calls.push({ table, offset });
      assert.equal(init.method, "GET");
      assert.equal(url.searchParams.get("publication_status"), "eq.published");
      assert.equal(url.searchParams.get("order"), "id.asc");
      const page = rows[table].slice(offset, offset + 3);
      return new Response(JSON.stringify(page), { status: 200, headers: { "Content-Type": "application/json", "Content-Range": `${offset}-${offset + page.length - 1}/${rows[table].length}` } });
    } },
  });
  assert.deepEqual(await readPublicCatalogRows(client), rows);
  assert.equal(calls.filter(({ table }) => table === "organizations").length, 11);
});

test("erros HTTP e páginas incompletas são tratados como indisponibilidade", async () => {
  for (const response of [
    () => new Response(JSON.stringify({ message: "denied" }), { status: 403 }),
    () => new Response("[]", { headers: { "Content-Range": "*/12" } }),
    () => new Response("[]"),
  ]) {
    const client = createClient("https://test.supabase.co", "sb_publishable_test", { auth: { persistSession: false }, global: { fetch: async () => response() } });
    await assert.rejects(readPublicCatalogRows(client), /Leitura pública/);
  }
});
