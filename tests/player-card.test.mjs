import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadComponent } from "./helpers/load-component.mjs";

const sourceURL = new URL("../src/features/rosters/player-card.tsx", import.meta.url);
const { PlayerCard } = loadComponent(sourceURL);

test("PlayerCard real renderiza link pelo slug e escapa o nickname", () => {
  const player = { id: "unit-test-id", slug: "unit-test-player", nickname: "<Teste isolado>", role: "controller" };
  const html = renderToStaticMarkup(createElement(PlayerCard, { player }));
  assert.ok(html.includes('href="/player/unit-test-player"'));
  assert.ok(html.includes('aria-label="Ver perfil de &lt;Teste isolado&gt;"'));
  assert.ok(html.includes("&lt;Teste isolado&gt;</h3>"));
  assert.ok(!html.includes("<Teste isolado>"));
  assert.ok(!html.includes("unit-test-id"));
  assert.ok(html.includes("Controlador"));
});
