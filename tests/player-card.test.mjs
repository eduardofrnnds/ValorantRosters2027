import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Node strips TypeScript but not TSX. Compile this one real component in memory
// using the project's TypeScript dependency, without adding a public fixture route.
const sourceURL = new URL("../src/features/rosters/player-card.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceURL, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const componentModule = { exports: {} };
new Function("require", "module", "exports", compiled)(createRequire(sourceURL), componentModule, componentModule.exports);

test("PlayerCard real renderiza link pelo slug e escapa o nickname", () => {
  const player = { id: "unit-test-id", slug: "unit-test-player", nickname: "<Teste isolado>", role: "controller" };
  const html = renderToStaticMarkup(createElement(componentModule.exports.PlayerCard, { player }));
  assert.ok(html.includes('href="/player/unit-test-player"'));
  assert.ok(html.includes('aria-label="Ver perfil de &lt;Teste isolado&gt;"'));
  assert.ok(html.includes("&lt;Teste isolado&gt;</h3>"));
  assert.ok(!html.includes("<Teste isolado>"));
  assert.ok(!html.includes("unit-test-id"));
  assert.ok(html.includes("Controlador"));
});
