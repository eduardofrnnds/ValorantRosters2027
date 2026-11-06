import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
const modules = new Map();

// Render actual TSX in isolated tests without adding fixture routes or dependencies.
export function loadComponent(sourceURL) {
  const filename = sourceURL instanceof URL ? fileURLToPath(sourceURL) : sourceURL;
  if (modules.has(filename)) return modules.get(filename).exports;
  const localRequire = createRequire(filename);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const componentModule = { exports: {} };
  modules.set(filename, componentModule);
  function requireDependency(specifier) {
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const base = specifier.startsWith("@/") ? resolve(sourceRoot, specifier.slice(2)) : resolve(dirname(filename), specifier);
      const target = [base, `${base}.tsx`, `${base}.ts`].find((path) => existsSync(path));
      if (target && /\.tsx?$/.test(target)) return loadComponent(target);
    }
    return localRequire(specifier);
  }
  new Function("require", "module", "exports", compiled)(requireDependency, componentModule, componentModule.exports);
  return componentModule.exports;
}
