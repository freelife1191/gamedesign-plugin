import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadProductContract } from "../../../tooling/lib/product-contract.mjs";
import { collectProductInventory } from "../../../tooling/lib/user-guides.mjs";

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
  "apply-document-quality-profile",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
  "polish-game-design-writing",
  "humanize-korean",
  "archify",
];
const directSkillIds = skillIds.slice(0, 15);
const installedSkillIds = [...directSkillIds, "archify", "humanize-korean", "svg-infographic"].sort();

const roleIds = [
  "career-strategist",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
  "document-quality-editor",
  "game-design-writing-editor",
];
const imageSpecialistIds = ["art-brief-director", "visual-asset-reviewer"];

const stages = ["entry", "new-hire", "junior-growth", "transition"];

test("Career orchestrator accepts ordinary natural-language requests without explicit skill names", async () => {
  const skill = await readFile(
    path.join(productRoot, "plugin/skills/orchestrate-game-design-career/SKILL.md"),
    "utf8",
  );
  for (const phrase of [
    "Users do not need to name a skill or case ID",
    "Route a clear single-output request directly to its specialist skill",
    "Route mixed, multi-stage, or unclear requests through this orchestrator",
    "Honor an explicit user-selected skill",
    "Report the selected skills, selected review roles, artifact paths, and remaining decisions",
    "Automatic route selection is not automatic approval",
  ]) assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
});

const scenarioChains = [
  {
    id: "entry-12-week-roadmap",
    stage: "entry",
    asOfDate: "2026-08-04",
    skillChain: ["map-career-role-and-skill-gaps", "visualize-career-roadmap", "export-career-artifact"],
    artifactFormats: ["SVG", "PDF"],
  },
  {
    id: "new-graduate-system-design",
    stage: "new-hire",
    asOfDate: "2026-08-05",
    skillChain: [
      "research-current-game-design-jobs",
      "map-career-role-and-skill-gaps",
      "build-game-design-portfolio",
      "review-game-design-portfolio",
    ],
    artifactFormats: ["MD"],
  },
  {
    id: "reverse-design-portfolio",
    stage: "new-hire",
    asOfDate: "2026-08-06",
    skillChain: ["reverse-design-a-game", "export-career-artifact"],
    artifactFormats: ["MD", "DOCX", "PPTX"],
  },
  {
    id: "junior-project-impact",
    stage: "junior-growth",
    asOfDate: "2026-08-07",
    skillChain: ["plan-junior-growth", "visualize-career-roadmap", "export-career-artifact"],
    artifactFormats: ["MD", "SVG", "PDF"],
  },
  {
    id: "junior-transition",
    stage: "transition",
    asOfDate: "2026-08-08",
    skillChain: [
      "research-current-game-design-jobs",
      "practice-game-design-interview",
      "plan-junior-growth",
      "visualize-career-roadmap",
      "export-career-artifact",
    ],
    artifactFormats: ["MD", "PDF"],
  },
  {
    id: "unclear-stage-role-map",
    stage: "unclear",
    asOfDate: "2026-08-09",
    skillChain: ["orchestrate-game-design-career", "map-career-role-and-skill-gaps"],
    artifactFormats: ["MD"],
  },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(productRoot, relativePath), "utf8"));
}

test("Career product selects the complete shared contract and source corpus", async () => {
  const product = await loadProductContract({ repoRoot, productName: "game-design-career" });

  assert.equal(product.name, "game-design-career");
  assert.deepEqual(product.sharedModules, ["knowledge", "templates", "responsible-design", "export", "vendor", "archify", "im-not-ai", "document-quality", "image-assets"]);
  assert.equal(product.sharedRuntime, true);
  assert.deepEqual(product.sourceRoots, ["plugin"]);
  assert.deepEqual(product.sourceDocumentCategories, ["career", "fun-intent", "systems", "content", "feedback"]);
});

test("Career routing enumerates exactly the approved skills, roles, and stages", async () => {
  const routing = await readJson("plugin/references/routing.json");

  assert.deepEqual(routing.skillIds, skillIds);
  assert.deepEqual(routing.roleIds, roleIds);
  assert.deepEqual(routing.imageSpecialistIds, imageSpecialistIds);
  assert.deepEqual(routing.stages, stages);
  assert.equal(new Set(routing.skillIds).size, 17);
  assert.equal(new Set(routing.roleIds).size, 8);
});

test("Career keeps the 15-direct and 18-installed skill inventory contract", async () => {
  const inventory = await collectProductInventory(repoRoot, "game-design-career");

  assert.equal(directSkillIds.length, 15, "Career has exactly 15 direct product skills");
  assert.deepEqual(inventory.skillIds, installedSkillIds);
  assert.equal(inventory.skillIds.length, 18, "Career installs the 15 direct skills plus three bundled skills");
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
    assert.match(route.currentResearchTrigger, /primary (?:source|evidence)/i, `${route.id}: primary-source trigger`);
    assert.match(route.currentResearchTrigger, /retrieval date/i, `${route.id}: retrieval-date trigger`);
    assert.equal(typeof route.artifactType, "string", `${route.id}: artifact type`);
    assert.ok(route.completionGates.length > 0, `${route.id}: completion gates`);
  }
});

test("Approved scenarios declare ordered route chains, formats, and complete stage coverage", async () => {
  const routing = await readJson("plugin/references/routing.json");

  assert.deepEqual(routing.scenarioChains, scenarioChains);
  assert.deepEqual(routing.scenarioRouteChains, {
    "entry-12-week-roadmap": ["entry-role-map", "entry-competency-visualization", "entry-roadmap-export"],
    "new-graduate-system-design": [
      "new-hire-job-research",
      "new-hire-role-map",
      "new-hire-portfolio-build",
      "new-hire-portfolio-review",
    ],
    "reverse-design-portfolio": ["new-hire-reverse-design", "new-hire-reverse-design-export"],
    "junior-project-impact": ["junior-growth-plan", "junior-growth-visualization", "junior-growth-export"],
    "junior-transition": [
      "transition-job-research",
      "transition-interview-practice",
      "transition-growth-plan",
      "transition-readiness-visualization",
      "transition-export",
    ],
    "unclear-stage-role-map": [],
  });
  assert.deepEqual(routing.stageCoverage, {
    entry: ["entry-12-week-roadmap"],
    "new-hire": ["new-graduate-system-design", "reverse-design-portfolio"],
    "junior-growth": ["junior-project-impact"],
    transition: ["junior-transition"],
    unclear: ["unclear-stage-role-map"],
  });
});

test("Scenario route aliases resolve only to the approved ten skills", async () => {
  const routing = await readJson("plugin/references/routing.json");

  assert.deepEqual(routing.routeSkills, {
    "orchestrate-game-design-career": "orchestrate-game-design-career",
    "map-career-role-and-skill-gaps": "map-game-design-career",
    "research-current-game-design-jobs": "research-game-design-jobs",
    "build-game-design-portfolio": "build-game-design-portfolio",
    "reverse-design-a-game": "reverse-engineer-game-design",
    "practice-game-design-interview": "practice-game-design-interview",
    "review-game-design-portfolio": "review-game-design-portfolio",
    "plan-junior-growth": "plan-junior-growth",
    "visualize-career-roadmap": "visualize-career-roadmap",
    "export-career-artifact": "export-career-documents",
  });
  const usedAliases = new Set((routing.scenarioChains ?? []).flatMap(({ skillChain }) => skillChain));
  assert.deepEqual(new Set(Object.keys(routing.routeSkills)), usedAliases);
  assert.ok(Object.values(routing.routeSkills).every((skill) => skillIds.includes(skill)));

  const routesById = new Map(routing.routes.map((route) => [route.id, route]));
  for (const scenario of routing.scenarioChains.filter(({ stage }) => stage !== "unclear")) {
    const routeChain = routing.scenarioRouteChains[scenario.id].map((routeId) => routesById.get(routeId));
    assert.deepEqual(routeChain.map(({ stage }) => stage), scenario.skillChain.map(() => scenario.stage));
    assert.deepEqual(
      routeChain.map(({ skill }) => skill),
      scenario.skillChain.map((alias) => routing.routeSkills[alias]),
    );
  }
});

test("An unclear stage yields a role map and provisional paths without a single-career claim", async () => {
  const { unclearStage } = await readJson("plugin/references/routing.json");

  assert.equal(unclearStage.skill, "map-game-design-career");
  assert.deepEqual(unclearStage.skillChain, ["orchestrate-game-design-career", "map-career-role-and-skill-gaps"]);
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
