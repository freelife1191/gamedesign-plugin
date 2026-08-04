import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadProductContract } from "../../../tooling/lib/product-contract.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const productRoot = path.join(repoRoot, "products/game-design-studio");
const pluginRoot = path.join(productRoot, "plugin");

const skillIds = [
  "orchestrate-game-design-project",
  "define-game-vision",
  "design-game-systems",
  "design-game-content",
  "design-player-experience",
  "design-game-economy-and-liveops",
  "plan-game-production",
  "review-game-design",
  "visualize-game-design",
  "export-game-design-documents",
];

const roleIds = [
  "lead-game-designer",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
];

const profileIds = ["live-service-rpg", "mobile", "pc-console"];

const routeContract = {
  "project-orchestration": {
    skill: "orchestrate-game-design-project",
    reference: "skills/orchestrate-game-design-project/references/workflow.md",
    artifactType: "game-design-brief",
  },
  vision: {
    skill: "define-game-vision",
    reference: "references/methods/vision.md",
    artifactType: "vision-pillars",
  },
  systems: {
    skill: "design-game-systems",
    reference: "references/methods/system-specification.md",
    artifactType: "system-specification",
  },
  content: {
    skill: "design-game-content",
    reference: "references/methods/content-specification.md",
    artifactType: "narrative-quest-npc",
  },
  "player-experience": {
    skill: "design-player-experience",
    reference: "references/methods/player-experience.md",
    artifactType: "ui-ux-flow-state",
  },
  "economy-liveops": {
    skill: "design-game-economy-and-liveops",
    reference: "references/methods/economy-liveops.md",
    artifactType: "liveops-experiment-event",
  },
  production: {
    skill: "plan-game-production",
    reference: "references/methods/production.md",
    artifactType: "production-scope-risk",
  },
  review: {
    skill: "review-game-design",
    reference: "assets/templates/game-design-review/content.md",
    artifactType: "game-design-review",
  },
  visualization: {
    skill: "visualize-game-design",
    reference: "references/visualization-presets.json",
    artifactType: "decision-change-log",
  },
  export: {
    skill: "export-game-design-documents",
    reference: "references/export-recipes.md",
    artifactType: "decision-change-log",
  },
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(pluginRoot, relativePath), "utf8"));
}

test("Studio product selects the complete shared contract and 49-document corpus", async () => {
  const product = await loadProductContract({ repoRoot, productName: "game-design-studio" });

  assert.deepEqual(product, {
    schemaVersion: 1,
    name: "game-design-studio",
    displayName: "Game Design Studio",
    description: "Professional game design, review, visualization, and export workflows.",
    sharedModules: ["knowledge", "templates", "responsible-design", "export", "vendor"],
    sharedRuntime: true,
    sourceRoots: ["plugin"],
    sourceDocumentCategories: ["career", "fun-intent", "systems", "content", "feedback"],
  });

  const referenceIndex = JSON.parse(
    await readFile(path.join(repoRoot, "shared/knowledge/reference-index.json"), "utf8"),
  );
  const selectedDocuments = referenceIndex.documents.filter(({ category }) =>
    product.sourceDocumentCategories.includes(category),
  );
  assert.equal(selectedDocuments.length, 49);
});

test("Studio routing enumerates the planned skills, roles, and composable profiles", async () => {
  const routing = await readJson("references/routing.json");

  assert.deepEqual(routing.skillIds, skillIds);
  assert.equal(new Set(routing.skillIds).size, 10);
  assert.deepEqual(routing.roleIds, roleIds);
  assert.equal(new Set(routing.roleIds).size, 6);
  assert.deepEqual(routing.profileIds, profileIds);
  assert.deepEqual(routing.rolePriority, roleIds);
  assert.equal(routing.unknownIntentFallback, "orchestrate-game-design-project");
});

test("Every Studio route is deterministic and points at its planned artifact source", async () => {
  const routing = await readJson("references/routing.json");
  assert.equal(routing.schemaVersion, 1);
  assert.equal(routing.routes.length, 10);

  const routes = new Map(routing.routes.map((route) => [route.id, route]));
  assert.deepEqual([...routes.keys()], Object.keys(routeContract));

  for (const [routeId, expected] of Object.entries(routeContract)) {
    const route = routes.get(routeId);
    assert.deepEqual(Object.keys(route).sort(), [
      "artifactType",
      "completionGates",
      "defaultReviewers",
      "eligibleProfiles",
      "id",
      "maxReviewers",
      "references",
      "requiredInputs",
      "skill",
      "triggerIntents",
    ]);
    assert.deepEqual(
      { skill: route.skill, artifactType: route.artifactType },
      { skill: expected.skill, artifactType: expected.artifactType },
    );
    assert.ok(route.triggerIntents.length > 0, `${routeId}: triggerIntents`);
    assert.ok(route.requiredInputs.length > 0, `${routeId}: requiredInputs`);
    assert.deepEqual(route.eligibleProfiles, profileIds, `${routeId}: eligibleProfiles`);
    assert.ok(route.defaultReviewers.length > 0, `${routeId}: defaultReviewers`);
    assert.ok(route.defaultReviewers.every((roleId) => roleIds.includes(roleId)), `${routeId}: known reviewers`);
    assert.equal(route.maxReviewers, 3, `${routeId}: maxReviewers`);
    assert.ok(route.defaultReviewers.length <= route.maxReviewers, `${routeId}: reviewer limit`);
    assert.ok(route.references.includes(expected.reference), `${routeId}: planned reference`);
    assert.ok(route.references.every((reference) => !path.isAbsolute(reference)), `${routeId}: relative references`);
    assert.ok(route.completionGates.length > 0, `${routeId}: completionGates`);
  }
});

test("Studio manifest passes the local official validator without hooks", async () => {
  const manifest = await readJson(".codex-plugin/plugin.json");
  assert.equal(manifest.name, "game-design-studio");
  assert.equal(Object.hasOwn(manifest, "hooks"), false);
  assert.equal(manifest.interface.logo, "./assets/product-mark.svg");
  assert.equal(manifest.interface.composerIcon, "./assets/product-mark.svg");

  const validation = spawnSync(
    "python3",
    [
      "/Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py",
      pluginRoot,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(validation.status, 0, validation.stdout + validation.stderr);
});

test("Studio scaffold includes an accessible product mark and overview", async () => {
  const mark = await readFile(path.join(pluginRoot, "assets/product-mark.svg"), "utf8");
  assert.match(mark, /<svg\b[^>]*role="img"/u);
  assert.match(mark, /<title\b/u);
  assert.doesNotMatch(mark, /<(?:script|foreignObject)\b/iu);
  await access(path.join(pluginRoot, "references/product-overview.md"));
});
