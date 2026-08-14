import assert from "node:assert/strict";
import test from "node:test";

import { scanJavaScriptImports } from "../../tooling/lib/js-import-scanner.mjs";

test("scanner returns each static form and literal dynamic import once", () => {
  const result = scanJavaScriptImports(`
    import value from "./value.mjs" with { type: "javascript" };
    import "./side-effect.mjs";
    export { value } from "./exported.mjs";
    export * from "./all.mjs";
    await import('./dynamic.mjs', { with: { type: 'json' } });
    await import(\`./template.mjs\`);
  `);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.specifiers.map(({ specifier, kind }) => [specifier, kind]), [
    ["./value.mjs", "static"], ["./side-effect.mjs", "static"], ["./exported.mjs", "export"],
    ["./all.mjs", "export"], ["./dynamic.mjs", "dynamic"], ["./template.mjs", "dynamic"],
  ]);
});

test("scanner ignores comments and strings but rejects nonliteral dynamic imports", () => {
  const result = scanJavaScriptImports(`
    // import('./comment.mjs')
    const text = "export * from './string.mjs'";
    const template = \`import('./template-text.mjs')\`;
    const path = './runtime.mjs';
    import(path);
  `);
  assert.deepEqual(result.specifiers, []);
  assert.deepEqual(result.errors.map(({ code }) => code), ["dynamic-import-nonliteral"]);
});

test("scanner recursively scans JavaScript expressions inside template literals", () => {
  const result = scanJavaScriptImports("const text = `x ${await import(\"./hidden.mjs\")} ${() => import(`./nested.mjs`)} ${({ pattern: /import(foo)/, nested: { closing: \"}\" } }).pattern} ${import(path)} y`; const regex = /import(foo)/;");
  assert.deepEqual(result.specifiers.map(({ specifier }) => specifier), ["./hidden.mjs", "./nested.mjs"]);
  assert.deepEqual(result.errors.map(({ code }) => code), ["dynamic-import-nonliteral"]);
});

test("scanner treats regexes after control statements as literals without bypassing division imports", () => {
  const result = scanJavaScriptImports(`
    if (ready) /import(foo)/.test(text);
    while (ready) /import(foo)/.test(text);
    if (ready) {} /import(foo)/.test(text);
    const quotient = total / import(path);
  `);
  assert.deepEqual(result.specifiers, []);
  assert.deepEqual(result.errors.map(({ code }) => code), ["dynamic-import-nonliteral"]);
});
