import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadProductContract } from "../../../tooling/lib/product-contract.mjs";
import { collectProductInventory } from "../../../tooling/lib/user-guides.mjs";

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
  "apply-document-quality-profile",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
  "polish-game-design-writing",
  "humanize-korean",
  "archify",
  "retrieve-approved-design-memory",
  "capture-game-design-memory",
  "maintain-game-design-memory",
  "analyze-game-design-references",
  "maintain-game-design-glossary",
];
const directSkillIds = skillIds.slice(0, 15);
const installedSkillIds = [...directSkillIds, "analyze-game-design-references", "archify", "capture-game-design-memory", "humanize-korean", "maintain-game-design-glossary", "maintain-game-design-memory", "retrieve-approved-design-memory", "svg-infographic"].sort();

const roleIds = [
  "lead-game-designer",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
  "combat-encounter-reviewer",
  "level-puzzle-reviewer",
  "document-quality-editor",
  "game-design-writing-editor",
];
const imageSpecialistIds = ["art-brief-director", "visual-asset-reviewer"];

const profileIds = ["live-service-rpg", "mobile", "pc-console"];

const plannedPaths = {
  skills: skillIds.map((skillId) => `skills/${skillId}/SKILL.md`),
  roles: roleIds.map((roleId) => `agents/${roleId}.md`),
  imageSpecialists: imageSpecialistIds.map((roleId) => `agents/${roleId}.md`),
  profiles: [
    "references/profiles/universal-core.json",
    "references/profiles/live-service-rpg.json",
    "references/profiles/mobile.json",
    "references/profiles/pc-console.json",
  ],
  references: [
    "skills/orchestrate-game-design-project/references/intake.md",
    "skills/orchestrate-game-design-project/references/workflow.md",
    "skills/orchestrate-game-design-project/references/completion-gates.md",
    "references/methods/vision.md",
    "references/methods/system-specification.md",
    "references/methods/content-specification.md",
    "references/methods/player-experience.md",
    "references/methods/economy-liveops.md",
    "references/methods/production.md",
    "assets/templates/game-design-review/content.md",
    "references/visualization-presets.json",
    "references/export-recipes.md",
    "references/shared/reference-intelligence/references/evidence-policy.md",
    "references/shared/reference-intelligence/references/reference-analysis-flow.md",
    "references/shared/reference-intelligence/schema/reference-analysis.schema.json",
    "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
    "references/shared/reference-intelligence/schema/glossary-receipt.schema.json",
  ],
};

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
    conditionalReviewers: [
      {
        role: "combat-encounter-reviewer",
        triggerIntents: ["combat", "boss", "encounter"],
        reviewers: ["combat-encounter-reviewer"],
      },
      {
        role: "level-puzzle-reviewer",
        triggerIntents: ["puzzle", "level design", "secret route", "soft lock", "reset", "retry"],
        reviewers: ["level-puzzle-reviewer"],
      },
    ],
  },
  "player-experience": {
    skill: "design-player-experience",
    reference: "references/methods/player-experience.md",
    artifactType: "ui-ux-flow-state",
  },
  economy: {
    skill: "design-game-economy-and-liveops",
    reference: "references/methods/economy-liveops.md",
    artifactType: "economy-balance",
  },
  liveops: {
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
    artifactType: "canonical-artifact",
    outputArtifacts: ["svg-assets", "png-2x-assets", "diagram-index"],
  },
  export: {
    skill: "export-game-design-documents",
    reference: "references/export-recipes.md",
    artifactType: "canonical-artifact",
    outputArtifacts: ["requested-md", "requested-pdf", "requested-docx", "requested-pptx", "qa-manifest"],
  },
  "reference-game-analysis": {
    skill: "analyze-game-design-references",
    reference: "references/shared/reference-intelligence/references/reference-analysis-flow.md",
    artifactType: "reference-system-analysis",
    outputTypes: ["reference-system-analysis", "reference-comparison", "design-transfer-decision"],
  },
  "project-glossary-maintenance": {
    skill: "maintain-game-design-glossary",
    reference: "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
    artifactType: "game-design-glossary",
    outputTypes: ["game-design-glossary", "terminology-findings", "glossary-receipt"],
  },
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(pluginRoot, relativePath), "utf8"));
}

function assertRepoManifestContract(manifest) {
  const allowedTopLevel = ["author", "description", "interface", "name", "skills", "version"];
  assert.deepEqual(Object.keys(manifest).sort(), allowedTopLevel);
  assert.match(manifest.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  assert.match(manifest.version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
  assert.ok(manifest.description.trim());
  assert.ok(manifest.author.name.trim());
  assert.equal(manifest.skills, "./skills/");
  for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "category"]) {
    assert.ok(manifest.interface[field].trim(), `interface.${field}`);
  }
  assert.ok(Array.isArray(manifest.interface.capabilities));
  assert.ok(Array.isArray(manifest.interface.defaultPrompt));
  assert.ok(manifest.interface.defaultPrompt.length > 0 && manifest.interface.defaultPrompt.length <= 3);
  for (const field of ["shortDescription", "longDescription"]) {
    assert.match(manifest.interface[field], /[가-힣]/u, `interface.${field} must be Korean-first`);
  }
  for (const prompt of manifest.interface.defaultPrompt) {
    assert.match(prompt, /[가-힣]/u, "interface.defaultPrompt must be Korean-first");
    assert.ok(prompt.length <= 128, "interface.defaultPrompt is bounded");
  }
}

test("Studio product selects the complete shared contract and 49-document corpus", async () => {
  const product = await loadProductContract({ repoRoot, productName: "game-design-studio" });

  assert.deepEqual(product, {
    schemaVersion: 1,
    name: "game-design-studio",
    displayName: "Game Design Studio",
    description: "Professional game design, review, visualization, and export workflows.",
    sharedModules: ["knowledge", "templates", "responsible-design", "export", "vendor", "archify", "im-not-ai", "document-quality", "image-assets", "memory", "reference-intelligence"],
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
  assert.equal(new Set(routing.skillIds).size, 22);
  assert.deepEqual(routing.roleIds, roleIds);
  assert.deepEqual(routing.imageSpecialistIds, imageSpecialistIds);
  assert.equal(new Set(routing.roleIds).size, 10);
  assert.deepEqual(routing.profileIds, profileIds);
  assert.deepEqual(routing.rolePriority, roleIds);
  assert.equal(routing.unknownIntentFallback, "orchestrate-game-design-project");
  assert.deepEqual(routing.plannedPaths, plannedPaths);
});

test("Studio keeps the 15-direct and 23-installed skill inventory contract", async () => {
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");

  assert.equal(directSkillIds.length, 15, "Studio has exactly 15 direct product skills");
  assert.deepEqual(inventory.skillIds, installedSkillIds);
  assert.equal(inventory.skillIds.length, 23, "Studio installs the 15 direct skills plus eight shared skills");
});

test("Studio orchestrator accepts ordinary natural-language requests without explicit skill names", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/orchestrate-game-design-project/SKILL.md"), "utf8");
  for (const phrase of [
    "Users do not need to name a skill or case ID",
    "Route a clear single-domain request directly to its specialist skill",
    "Route mixed, cross-domain, or unclear requests through this orchestrator",
    "Honor an explicit user-selected skill",
    "Report the selected skills, selected review roles, artifact paths, and remaining decisions",
    "Automatic route selection is not automatic approval",
  ]) assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
});

test("Every Studio route is deterministic and points at its planned artifact source", async () => {
  const routing = await readJson("references/routing.json");
  assert.equal(routing.schemaVersion, 1);
  assert.equal(routing.routes.length, 13);

  const routes = new Map(routing.routes.map((route) => [route.id, route]));
  assert.deepEqual([...routes.keys()], Object.keys(routeContract));

  for (const [routeId, expected] of Object.entries(routeContract)) {
    const route = routes.get(routeId);
    const expectedKeys = [
      "artifactType",
      "completionGates",
      ...(expected.conditionalReviewers ? ["conditionalReviewers"] : []),
      "defaultReviewers",
      "eligibleProfiles",
      "id",
      "maxReviewers",
      "references",
      "requiredInputs",
      "skill",
      "triggerIntents",
      ...(expected.outputArtifacts ? ["outputArtifacts"] : []),
      ...(expected.outputTypes ? ["outputTypes"] : []),
    ].sort();
    assert.deepEqual(Object.keys(route).sort(), expectedKeys);
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
    assert.ok(route.references.every((reference) => plannedPaths.references.includes(reference)), `${routeId}: allowlisted references`);
    if (expected.conditionalReviewers) {
      assert.deepEqual(route.conditionalReviewers, expected.conditionalReviewers);
    }
    if (expected.outputArtifacts) assert.deepEqual(route.outputArtifacts, expected.outputArtifacts);
    if (expected.outputTypes) assert.deepEqual(route.outputTypes, expected.outputTypes);
    assert.ok(route.completionGates.length > 0, `${routeId}: completionGates`);
  }
});

test("Studio content reviewer selection uses priority slots and rejects ineligible conditional roles", async () => {
  const routing = await readJson("references/routing.json");
  const contentRoute = routing.routes.find(({ id }) => id === "content");
  const validatorPath = path.join(
    pluginRoot,
    "skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs",
  );
  const { selectRouteReviewers, validateReviewerSelection } = await import(
    `${pathToFileURL(validatorPath).href}?selection=${Date.now()}-${Math.random()}`,
  );
  const bossAndPuzzle = ["boss", "puzzle"];
  const expected = [
    "content-narrative-designer",
    "lead-game-designer",
    "combat-encounter-reviewer",
  ];

  assert.deepEqual(selectRouteReviewers(contentRoute, bossAndPuzzle, routing.rolePriority), expected);
  assert.equal(validateReviewerSelection({
    routes: [contentRoute],
    intents: bossAndPuzzle,
    roleIds: expected,
    rolePriority: routing.rolePriority,
    knownRoleIds: routing.roleIds,
  }), true);
  assert.equal(validateReviewerSelection({
    routes: [contentRoute],
    intents: ["boss"],
    roleIds: ["content-narrative-designer", "lead-game-designer", "level-puzzle-reviewer"],
    rolePriority: routing.rolePriority,
    knownRoleIds: routing.roleIds,
  }), false, "irrelevant conditional role is rejected");
  assert.equal(validateReviewerSelection({
    routes: [contentRoute],
    intents: bossAndPuzzle,
    roleIds: ["content-narrative-designer", "lead-game-designer", "combat-encounter-reviewer", "level-puzzle-reviewer"],
    rolePriority: routing.rolePriority,
    knownRoleIds: routing.roleIds,
  }), false, "four-role mutation is rejected");
  assert.equal(validateReviewerSelection({
    routes: [contentRoute],
    intents: bossAndPuzzle,
    roleIds: ["content-narrative-designer", "lead-game-designer", "level-puzzle-reviewer"],
    rolePriority: routing.rolePriority,
    knownRoleIds: routing.roleIds,
  }), false, "unselected conditional role is rejected");
});

test("Studio trigger phrases are globally unique so routing never depends on a guess", async () => {
  const routing = await readJson("references/routing.json");
  const owners = new Map();

  for (const route of routing.routes) {
    for (const trigger of route.triggerIntents) {
      const normalized = trigger.normalize("NFC").trim().toLocaleLowerCase("en-US");
      assert.equal(owners.has(normalized), false, `${JSON.stringify(trigger)} is shared by ${owners.get(normalized)} and ${route.id}`);
      owners.set(normalized, route.id);
    }
  }

  assert.equal(owners.get("launch readiness"), "review");
});

test("Economy and LiveOps are separate route variants with domain-specific inputs and gates", async () => {
  const routing = await readJson("references/routing.json");
  const routes = new Map(routing.routes.map((route) => [route.id, route]));
  const economy = routes.get("economy");
  const liveops = routes.get("liveops");

  assert.equal(economy.skill, "design-game-economy-and-liveops");
  assert.equal(economy.artifactType, "economy-balance");
  assert.deepEqual(economy.requiredInputs, [
    "business model",
    "currencies",
    "progression target",
    "target inventory",
    "real-price policy",
  ]);
  assert.deepEqual(economy.completionGates, [
    "sources-sinks-and-inflation-defined",
    "price-probability-and-pity-transparent",
    "target-inventory-and-progression-time-defined",
  ]);

  assert.equal(liveops.skill, "design-game-economy-and-liveops");
  assert.equal(liveops.artifactType, "liveops-experiment-event");
  assert.deepEqual(liveops.requiredInputs, [
    "event goal",
    "experiment hypothesis",
    "control",
    "sample and duration",
    "protection metrics",
  ]);
  assert.deepEqual(liveops.completionGates, [
    "hypothesis-control-and-single-variable-defined",
    "success-and-protection-metrics-defined",
    "stop-and-rollback-defined",
  ]);
});

test("Visualization and export preserve the canonical input and declare their real outputs", async () => {
  const routing = await readJson("references/routing.json");
  const routes = new Map(routing.routes.map((route) => [route.id, route]));
  const visualization = routes.get("visualization");
  const exportRoute = routes.get("export");

  assert.ok(visualization.requiredInputs.includes("valid canonical artifact"));
  assert.equal(visualization.artifactType, "canonical-artifact");
  assert.deepEqual(visualization.outputArtifacts, ["svg-assets", "png-2x-assets", "diagram-index"]);
  assert.ok(visualization.completionGates.includes("canonical-artifact-preserved-on-failure"));

  assert.ok(exportRoute.requiredInputs.includes("valid canonical artifact"));
  assert.equal(exportRoute.artifactType, "canonical-artifact");
  assert.deepEqual(exportRoute.outputArtifacts, [
    "requested-md",
    "requested-pdf",
    "requested-docx",
    "requested-pptx",
    "qa-manifest",
  ]);
  assert.ok(exportRoute.completionGates.includes("canonical-artifact-preserved-on-failure"));
});

test("Every planned future path is normalized, relative, unique, and exact", async () => {
  const routing = await readJson("references/routing.json");

  for (const [kind, paths] of Object.entries(routing.plannedPaths)) {
    assert.equal(new Set(paths).size, paths.length, `${kind}: duplicate path`);
    for (const futurePath of paths) {
      assert.equal(path.posix.normalize(futurePath), futurePath, `${kind}: normalized path`);
      assert.equal(path.posix.isAbsolute(futurePath), false, `${kind}: relative path`);
      assert.equal(futurePath.split("/").includes(".."), false, `${kind}: parent traversal`);
    }
  }

  const routedReferences = [...new Set(routing.routes.flatMap((route) => route.references))];
  assert.deepEqual(routedReferences, plannedPaths.references);
});

test("Studio manifest passes the portable repo contract and official validator when available", async () => {
  const manifest = await readJson(".codex-plugin/plugin.json");
  assertRepoManifestContract(manifest);
  assert.equal(manifest.name, "game-design-studio");
  assert.equal(Object.hasOwn(manifest, "hooks"), false);
  assert.equal(manifest.interface.logo, "./assets/product-mark.svg");
  assert.equal(manifest.interface.composerIcon, "./assets/product-mark.svg");

  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const officialValidator = path.join(
    codexHome,
    "skills/.system/plugin-creator/scripts/validate_plugin.py",
  );
  if (existsSync(officialValidator)) {
    const validation = spawnSync("python3", [officialValidator, pluginRoot], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(validation.status, 0, validation.stdout + validation.stderr);
  }
});

test("Studio scaffold includes an accessible product mark and overview", async () => {
  const mark = await readFile(path.join(pluginRoot, "assets/product-mark.svg"), "utf8");
  assert.match(mark, /<svg\b[^>]*role="img"/u);
  assert.match(mark, /<title\b/u);
  assert.doesNotMatch(mark, /<(?:script|foreignObject)\b/iu);
  await access(path.join(pluginRoot, "references/product-overview.md"));
});
