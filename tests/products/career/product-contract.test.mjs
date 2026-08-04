import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadProductContract } from "../../../tooling/lib/product-contract.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const productRoot = path.join(repoRoot, "products/game-design-career");

const skillIds = [
  "orchestrate-game-design-career",
  "map-game-design-career",
  "research-game-design-jobs",
  "build-game-design-portfolio",
  "reverse-engineer-game-design",
  "practice-game-design-interview",
  "review-game-design-portfolio",
  "plan-junior-growth",
  "visualize-career-roadmap",
  "export-career-documents",
];

const roleIds = [
  "career-strategist",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
];

const stages = ["entry", "new-hire", "junior-growth", "transition"];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(productRoot, relativePath), "utf8"));
}

test("Career product selects the complete shared contract and source corpus", async () => {
  const product = await loadProductContract({ repoRoot, productName: "game-design-career" });

  assert.equal(product.name, "game-design-career");
  assert.deepEqual(product.sharedModules, ["knowledge", "templates", "responsible-design", "export", "vendor"]);
  assert.equal(product.sharedRuntime, true);
  assert.deepEqual(product.sourceRoots, ["plugin"]);
  assert.deepEqual(product.sourceDocumentCategories, ["career", "fun-intent", "systems", "content", "feedback"]);
});

test("Career routing enumerates exactly the approved skills, roles, and stages", async () => {
  const routing = await readJson("plugin/references/routing.json");

  assert.deepEqual(routing.skillIds, skillIds);
  assert.deepEqual(routing.roleIds, roleIds);
  assert.deepEqual(routing.stages, stages);
  assert.equal(new Set(routing.skillIds).size, 10);
  assert.equal(new Set(routing.roleIds).size, 6);
});

test("Every route declares deterministic evidence and completion decisions", async () => {
  const routing = await readJson("plugin/references/routing.json");

  assert.ok(Array.isArray(routing.routes) && routing.routes.length > 0);
  assert.equal(new Set(routing.routes.map(({ id }) => id)).size, routing.routes.length);
  for (const route of routing.routes) {
    assert.equal(typeof route.id, "string", "route id");
    assert.ok(stages.includes(route.stage), `${route.id}: approved stage`);
    assert.equal(typeof route.intent, "string", `${route.id}: intent`);
    assert.ok(route.requiredEvidence.length > 0, `${route.id}: required evidence`);
    assert.ok(skillIds.includes(route.skill), `${route.id}: approved skill`);
    assert.ok(route.roles.length > 0 && route.roles.length <= 3, `${route.id}: bounded roles`);
    assert.ok(route.roles.every((role) => roleIds.includes(role)), `${route.id}: approved roles`);
    assert.equal(typeof route.currentResearchTrigger, "string", `${route.id}: current research trigger`);
    assert.match(route.currentResearchTrigger, /current|fresh|dated|time-sensitive/i, `${route.id}: freshness trigger`);
    assert.equal(typeof route.artifactType, "string", `${route.id}: artifact type`);
    assert.ok(route.completionGates.length > 0, `${route.id}: completion gates`);
  }
});

test("An unclear stage yields a role map and provisional paths without a single-career claim", async () => {
  const { unclearStage } = await readJson("plugin/references/routing.json");

  assert.equal(unclearStage.skill, "map-game-design-career");
  assert.equal(unclearStage.artifactType, "game-design-role-map");
  assert.equal(unclearStage.provisionalPaths, true);
  assert.equal(unclearStage.declareSingleCorrectCareer, false);
  assert.ok(unclearStage.roles.includes("career-strategist"));
  assert.ok(unclearStage.completionGates.includes("multiple-paths-with-tradeoffs"));
});

test("Plugin manifest stays within the supported local schema and omits hooks", async () => {
  const manifest = await readJson("plugin/.codex-plugin/plugin.json");
  const allowedKeys = new Set(["name", "version", "description", "author", "skills", "interface"]);

  assert.ok(Object.keys(manifest).every((key) => allowedKeys.has(key)));
  assert.deepEqual(Object.keys(manifest).sort(), ["author", "description", "interface", "name", "skills", "version"]);
  assert.equal(manifest.name, "game-design-career");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/u);
  assert.equal(manifest.skills, "./skills/");
  assert.equal(Object.hasOwn(manifest, "hooks"), false);
  assert.equal(typeof manifest.author.name, "string");
  assert.equal(manifest.interface.displayName, "Game Design Career");
  assert.equal(typeof manifest.interface.shortDescription, "string");
  assert.equal(typeof manifest.interface.longDescription, "string");
  assert.equal(typeof manifest.interface.defaultPrompt, "string");
});

test("Product mark is a simple accessible vector", async () => {
  const svg = await readFile(path.join(productRoot, "plugin/assets/product-mark.svg"), "utf8");

  assert.match(svg, /<svg[^>]*role="img"/u);
  assert.match(svg, /aria-labelledby="product-mark-title"/u);
  assert.match(svg, /<title id="product-mark-title">[^<]+<\/title>/u);
  assert.match(svg, /viewBox="0 0 64 64"/u);
  assert.doesNotMatch(svg, /<text\b/u);
  assert.doesNotMatch(svg, /<script\b/u);
});
