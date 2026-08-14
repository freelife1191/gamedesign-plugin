import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");
const analysisWorkflow = ["reference-brief", "role-based-reference-set", "evidence-registry", "system-atlas", "inventory-without-evaluation", "system-maps-and-loops", "priority", "deep-dives", "cross-game-comparison", "adopt-adapt-reject-hold", "verification-queue", "glossary-candidates"];
const analysisLayouts = {
  installed: {
    runtimes: ["../../scripts/analyze-game-design-references.mjs"],
    references: ["../../references/shared/reference-intelligence/references/evidence-policy.md", "../../references/shared/reference-intelligence/references/reference-analysis-flow.md"],
    templates: ["../../references/shared/reference-intelligence/templates/analysis-priority.md", "../../references/shared/reference-intelligence/templates/atlas-selection.json", "../../references/shared/reference-intelligence/templates/brief.json", "../../references/shared/reference-intelligence/templates/brief.md", "../../references/shared/reference-intelligence/templates/comparison-matrix.md", "../../references/shared/reference-intelligence/templates/evidence-register.yml", "../../references/shared/reference-intelligence/templates/reference-set.yml", "../../references/shared/reference-intelligence/templates/system-inventory.json", "../../references/shared/reference-intelligence/templates/transfer-decisions.md", "../../references/shared/reference-intelligence/templates/verification-queue.md"],
    schemas: ["../../references/shared/reference-intelligence/schema/reference-analysis.schema.json"],
    catalogs: ["../../references/shared/reference-intelligence/catalog/overlays/business-model.json", "../../references/shared/reference-intelligence/catalog/overlays/genre.json", "../../references/shared/reference-intelligence/catalog/overlays/platform.json", "../../references/shared/reference-intelligence/catalog/overlays/play-mode.json", "../../references/shared/reference-intelligence/catalog/source-register.json", "../../references/shared/reference-intelligence/catalog/system-atlas.json"],
  },
  source: {
    runtimes: ["../../../scripts/analyze-game-design-references.mjs"],
    references: ["../../references/evidence-policy.md", "../../references/reference-analysis-flow.md"],
    templates: ["../../templates/analysis-priority.md", "../../templates/atlas-selection.json", "../../templates/brief.json", "../../templates/brief.md", "../../templates/comparison-matrix.md", "../../templates/evidence-register.yml", "../../templates/reference-set.yml", "../../templates/system-inventory.json", "../../templates/transfer-decisions.md", "../../templates/verification-queue.md"],
    schemas: ["../../schema/reference-analysis.schema.json"],
    catalogs: ["../../catalog/overlays/business-model.json", "../../catalog/overlays/genre.json", "../../catalog/overlays/platform.json", "../../catalog/overlays/play-mode.json", "../../catalog/source-register.json", "../../catalog/system-atlas.json"],
  },
};

async function readRouting() { return JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8")); }
async function readSkill(skillId) { return readFile(path.join(skillRoot, skillId, "SKILL.md"), "utf8"); }
function readContract(skill) {
  const match = skill.match(/<!-- reference-intelligence-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- reference-intelligence-contract:end -->/u);
  assert.ok(match, "reference-intelligence contract");
  return JSON.parse(match[1]);
}
function readWritingContract(skill) {
  const match = skill.match(/<!-- game-design-writing-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- game-design-writing-contract:end -->/u);
  assert.ok(match, "game-design-writing contract");
  return JSON.parse(match[1]);
}
async function readProfile(profileId) { return JSON.parse(await readFile(path.join(repoRoot, "shared/document-quality/profiles/studio", `${profileId}.json`), "utf8")); }

async function createLayouts(t, skillId) {
  const root = await mkdtemp(path.join(tmpdir(), "reference-skill-layout-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceShared = path.join(root, "source", "shared");
  const installed = path.join(root, "installed");
  await cp(path.join(repoRoot, "shared"), sourceShared, { recursive: true });
  await cp(path.join(sourceShared, "scripts"), path.join(installed, "scripts"), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence"), path.join(installed, "references/shared/reference-intelligence"), { recursive: true });
  await mkdir(path.join(installed, ".codex-plugin"), { recursive: true });
  await writeFile(path.join(installed, ".codex-plugin/plugin.json"), JSON.stringify({ name: "reference-intelligence-fixture", version: "1.0.0", description: "fixture", author: { name: "fixture" }, skills: "./skills/", interface: { displayName: "fixture", shortDescription: "fixture", longDescription: "fixture", developerName: "fixture", category: "Productivity", capabilities: ["Write"], defaultPrompt: ["fixture"] } }));
  await mkdir(path.join(installed, "skills", skillId), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), path.join(installed, "skills", skillId, "SKILL.md"));
  return {
    source: await realpath(path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md")),
    installed: await realpath(path.join(installed, "skills", skillId, "SKILL.md")),
  };
}

function layoutEntries(declaration) {
  return [["runtimes", declaration.runtimes], ["references", declaration.references], ["templates", declaration.templates], ["schemas", declaration.schemas], ["catalogs", declaration.catalogs]].flatMap(([category, values]) => values.map((value) => [category, value]));
}

function invalidLayout() { throw new Error("reference-skill layout invalid"); }

function sameIdentity(left, right) { return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode; }

async function canonicalRoot(rawRoot) {
  const lexical = path.resolve(rawRoot); const parts = lexical.slice(path.parse(lexical).root.length).split(path.sep).filter(Boolean);
  let cursor = path.parse(lexical).root; const snapshots = [];
  const capture = async () => { const info = await lstat(cursor).catch(() => invalidLayout()); if (info.isSymbolicLink() || !info.isDirectory()) invalidLayout(); snapshots.push([cursor, info]); };
  await capture(); for (const part of parts) { cursor = path.join(cursor, part); await capture(); }
  const root = await realpath(lexical).catch(() => invalidLayout());
  if (path.normalize(root) !== path.normalize(lexical)) invalidLayout();
  const snapshot = await lstat(root); if (snapshot.isSymbolicLink() || !snapshot.isDirectory()) invalidLayout();
  return { root, snapshot, snapshots };
}

async function recheckRoot({ root, snapshot, snapshots }) { for (const [target, before] of snapshots) { const after = await lstat(target).catch(() => invalidLayout()); if (!sameIdentity(before, after) || after.isSymbolicLink() || !after.isDirectory()) invalidLayout(); } const after = await lstat(root).catch(() => invalidLayout()); if (!sameIdentity(snapshot, after) || after.isSymbolicLink() || !after.isDirectory()) invalidLayout(); }

async function stableRegular(root, target) {
  const relative = path.relative(root, target);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes("..")) invalidLayout();
  let cursor = root;
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part);
    const info = await lstat(cursor).catch(() => invalidLayout());
    if (info.isSymbolicLink() || (cursor === target ? !info.isFile() : !info.isDirectory())) invalidLayout();
  }
  const before = await lstat(target); const bytes = await readFile(target); const after = await lstat(target);
  if (!sameIdentity(before, after) || before.size !== after.size) invalidLayout();
  return bytes;
}

async function consumeAnalysisLayout(skillPath, contract, layout) {
  if (layout !== "source" && layout !== "installed") invalidLayout();
  if (JSON.stringify(contract.layouts) !== JSON.stringify(analysisLayouts)) invalidLayout();
  const declaration = analysisLayouts[layout];
  const rootState = await canonicalRoot(layout === "installed" ? path.resolve(path.dirname(skillPath), "../..") : path.resolve(path.dirname(skillPath), "../../../.."));
  const { root } = rootState;
  const expectedSkill = layout === "installed" ? path.join(root, "skills/analyze-game-design-references/SKILL.md") : path.join(root, "shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md");
  if (path.resolve(skillPath) !== expectedSkill) invalidLayout();
  await stableRegular(root, expectedSkill);
  if (layout === "installed") {
    const manifest = await stableRegular(root, path.join(root, ".codex-plugin/plugin.json"));
    try { if (JSON.parse(manifest).name !== "reference-intelligence-fixture") invalidLayout(); } catch { invalidLayout(); }
  }
  const files = [];
  for (const [category, declared] of layoutEntries(declaration)) {
    if (path.isAbsolute(declared)) invalidLayout();
    const target = path.resolve(path.dirname(skillPath), declared);
    const expected = path.resolve(path.dirname(expectedSkill), declared);
    if (target !== expected || !target.startsWith(`${root}${path.sep}`)) invalidLayout();
    files.push([category, declared, await stableRegular(root, target)]);
  }
  await recheckRoot(rootState);
  const runtime = path.resolve(path.dirname(skillPath), declaration.runtimes[0]);
  return { root, runtime, files, referenceRoot: await realpath(layout === "installed" ? path.join(root, "references/shared/reference-intelligence") : path.join(root, "shared/reference-intelligence")) };
}

async function loadAnalysisRuntime(skillPath, contract, layout, counterpartFiles = null) {
  const consumed = await consumeAnalysisLayout(skillPath, contract, layout);
  if (counterpartFiles && !counterpartFiles.every(([category, , bytes], index) => category === consumed.files[index]?.[0] && Buffer.compare(bytes, consumed.files[index][2]) === 0)) invalidLayout();
  const [analysis, validator] = await Promise.all([
    import(`${pathToFileURL(consumed.runtime).href}?layout=${layout}-${Date.now()}-${Math.random()}`),
    import(pathToFileURL(path.join(path.dirname(consumed.runtime), "validate-reference-intelligence.mjs")).href),
  ]);
  const catalog = await import(`${pathToFileURL(path.join(path.dirname(consumed.runtime), "lib/system-atlas.mjs")).href}?layout=${layout}-${Date.now()}-${Math.random()}`);
  const bundled = await catalog.loadBundledReferenceCatalog({ moduleRoot: consumed.referenceRoot });
  return { ...consumed, analysis, validator, bundled };
}

function analysisInput(atlas) {
  const provenance = { build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/loop.png" }, screen: "loop", action: "complete", result: "choice", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null };
  return {
    brief: { analysisId: "pressure-analysis", objective: "Test a safe reference workflow.", decisionQuestions: ["question-loop"], playerExperiencePromise: "Choices stay legible.", differentiationHypotheses: ["choice-first"], genreHypotheses: ["action-rpg"], platformHypotheses: ["pc"], businessModelHypotheses: ["premium"], researchScope: ["observable-loop"], exclusionScope: ["private-metrics"], constraints: { time: "two-hours", materials: ["local-notes"], languages: ["ko"], regions: ["kr"] }, forbiddenConclusions: ["revenue-causality"], completionCriteria: ["human-review"], humanReviewer: "Lead Designer" },
    referenceSet: [
      { referenceId: "ref-alpha", label: "Alpha", role: "direct-competitor", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null },
      { referenceId: "ref-beta", label: "Beta", role: "core-system-exemplar", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null },
      { referenceId: "ref-gamma", label: "Gamma", role: "operations-monetization-comparator", decisionQuestionIds: ["question-loop"], availability: "unavailable", limitation: "Offline official source is unavailable." },
    ],
    referenceContexts: [
      { contextId: "ctx-alpha-v1", referenceId: "ref-alpha", version: "1", platform: "pc" },
      { contextId: "ctx-beta-v1", referenceId: "ref-beta", version: "1", platform: "pc" },
      { contextId: "ctx-gamma-v1", referenceId: "ref-gamma", version: "1", platform: "pc" },
    ],
    atlas: { atlas },
    evidence: [
      { evidenceId: "ev-alpha", referenceId: "ref-alpha", contextId: "ctx-alpha-v1", systemIds: ["core-play"], sourceType: "direct-play", claimKind: "observation", claim: "The player completes a loop.", availability: "available", limitation: null, verificationQuestion: null, ...provenance },
      { evidenceId: "ev-beta-community", referenceId: "ref-beta", contextId: "ctx-beta-v1", systemIds: ["core-play"], sourceType: "community", claimKind: "observation", claim: "Community material suggests a loop question.", availability: "available", limitation: null, verificationQuestion: null, ...provenance },
      { evidenceId: "ev-gamma-offline", referenceId: "ref-gamma", contextId: "ctx-gamma-v1", systemIds: ["core-play"], sourceType: "official-site", claimKind: "observation", claim: "Official offer evidence is unavailable.", availability: "unavailable", limitation: "Offline official source is unavailable.", verificationQuestion: "Which official page can verify the offer?", ...provenance },
    ],
    claims: [],
    edges: [{ mapId: "map-core-play", systemId: "core-play", nodes: [{ nodeId: "input", kind: "input", label: "Input" }, { nodeId: "output", kind: "output", label: "Output" }, { nodeId: "process", kind: "process", label: "Process" }], connections: [{ connectionId: "input-process", fromNodeId: "input", toNodeId: "process", connectedSystemIds: ["core-play"] }, { connectionId: "process-output", fromNodeId: "process", toNodeId: "output", connectedSystemIds: ["core-play"] }] }],
    loops: [], projectConstraints: ["ten-minute-session"], priorities: { "core-play": { relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 3, differentiationPotential: 4, evidenceStrength: 5, uncertainty: 2, researchCost: 2 } },
  };
}

test("Studio routes reference analysis through common evidence and pending transfer", async () => {
  const routing = await readRouting();
  assert.equal(routing.skillIds.includes("analyze-game-design-references"), true);
  assert.equal(routing.skillIds.includes("maintain-game-design-glossary"), true);
  assert.deepEqual(routing.referenceIntelligenceWorkflow.transferState, "pending-review");
  assert.deepEqual(routing.referenceIntelligenceWorkflow.outputs, ["reference-system-analysis", "reference-comparison", "design-transfer-decision"]);
});

test("analysis skill declares the complete, canonical source and installed boundaries", async () => {
  const contract = readContract(await readSkill("analyze-game-design-references"));
  assert.deepEqual(contract.layouts, analysisLayouts);
});

test("Studio projects exact routes, review ownership, and quality profiles", async () => {
  const routing = await readRouting();
  const routes = routing.routes.filter(({ id }) => ["reference-game-analysis", "project-glossary-maintenance"].includes(id));
  assert.deepEqual(routes.map(({ id, skill, outputTypes }) => ({ id, skill, outputTypes })), [
    { id: "reference-game-analysis", skill: "analyze-game-design-references", outputTypes: ["reference-system-analysis", "reference-comparison", "design-transfer-decision"] },
    { id: "project-glossary-maintenance", skill: "maintain-game-design-glossary", outputTypes: ["game-design-glossary", "terminology-findings", "glossary-receipt"] },
  ]);
  assert.deepEqual(routing.directUseReviewOwners.filter(({ skill }) => skill === "analyze-game-design-references" || skill === "maintain-game-design-glossary"), [{ skill: "analyze-game-design-references", owners: ["lead-game-designer"], conditionalOwners: [] }, { skill: "maintain-game-design-glossary", owners: ["document-quality-editor"], conditionalOwners: [] }]);
  assert.deepEqual(routing.referenceIntelligenceWorkflow.profileIds, ["reference-system-analysis", "reference-comparison", "design-transfer-decision"]);
  for (const profileId of routing.referenceIntelligenceWorkflow.profileIds) {
    const profile = await readProfile(profileId);
    assert.equal(profile.profile_id, profileId); assert.equal(profile.version, 1);
    assert.deepEqual(validateQualityProfile(profile, { sourceName: profileId }), { ok: true, errors: [] });
  }
});

test("rushed Studio analysis executes the declared source and installed public runtime layouts", async (t) => {
  const contract = readContract(await readSkill("analyze-game-design-references"));
  assert.deepEqual(contract.workflow, analysisWorkflow);
  assert.throws(() => {
    const rushed = { ...contract, workflow: contract.workflow.filter((stage) => stage !== "inventory-without-evaluation") };
    assert.deepEqual(rushed.workflow, analysisWorkflow);
  }, /deep/i, "a rushed skip cannot remove inventory from the consumer contract");
  const layouts = await createLayouts(t, "analyze-game-design-references");
  const source = await loadAnalysisRuntime(layouts.source, contract, "source");
  const installed = await loadAnalysisRuntime(layouts.installed, contract, "installed", source.files);
  assert.deepEqual(source.files.map(([category, , bytes]) => [category, bytes]), installed.files.map(([category, , bytes]) => [category, bytes]), "canonical counterparts are byte-identical across every declared boundary");
  for (const [layout, skillPath, loaded] of [["source", layouts.source, source], ["installed", layouts.installed, installed]]) {
    const analysis = loaded.analysis.buildReferenceAnalysis(analysisInput(loaded.bundled.atlas));
    assert.equal(loaded.validator.validateReferenceAnalysis(analysis).ok, true, `${layout}: closed validator accepts runtime output`);
    assert.ok(analysis.evidence.some(({ evidenceId }) => evidenceId === "ev-beta-community"));
    assert.ok(analysis.verificationQueue.some(({ evidenceIds }) => evidenceIds.includes("ev-gamma-offline")));
    assert.ok(analysis.transferDecisions.every(({ reviewState, validationState }) => reviewState === "pending-review" && validationState === "not-run"));
    const root = await mkdtemp(path.join(tmpdir(), `reference-analysis-${layout}-`)); t.after(() => rm(root, { recursive: true, force: true }));
    const written = await loaded.analysis.writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis });
    assert.ok(written.files.includes("reference-intelligence/system-inventory.json"));
    assert.ok((await readdir(path.join(root, "reference-intelligence"))).includes("system-inventory.json"));
    assert.equal((await readdir(root)).includes("canonical-artifact"), false, `${layout}: no Canonical Artifact mutation`);
    assert.ok(skillPath.includes(layout === "source" ? "source" : "installed"));
  }
});

test("analysis consumer rejects partial installed, escaped, and non-regular identities before runtime output", async (t) => {
  const contract = readContract(await readSkill("analyze-game-design-references"));
  const layouts = await createLayouts(t, "analyze-game-design-references");
  const source = await loadAnalysisRuntime(layouts.source, contract, "source");
  const fixtureRoot = path.resolve(path.dirname(layouts.installed), "../..");
  const sourceDecoy = layouts.source;
  const expectInvalid = async () => assert.rejects(() => loadAnalysisRuntime(layouts.installed, contract, "installed", source.files), /reference-skill layout invalid/u);
  for (const [category, declared] of [...contract.layouts.installed.runtimes.map((value) => ["runtimes", value]), ...contract.layouts.installed.references.map((value) => ["references", value]), ...contract.layouts.installed.templates.map((value) => ["templates", value]), ...contract.layouts.installed.schemas.map((value) => ["schemas", value]), ...contract.layouts.installed.catalogs.map((value) => ["catalogs", value])]) {
    const target = path.resolve(path.dirname(layouts.installed), declared); const bytes = await readFile(target);
    await unlink(target); await expectInvalid(); await writeFile(target, bytes);
    await writeFile(target, Buffer.concat([bytes, Buffer.from("\n ")])); await expectInvalid(); await writeFile(target, bytes);
    assert.ok(category);
  }
  const malformed = structuredClone(contract); malformed.layouts.installed.runtimes[0] = "/tmp/not-a-runtime.mjs";
  await assert.rejects(() => loadAnalysisRuntime(layouts.installed, malformed, "installed"), /reference-skill layout invalid/u);
  malformed.layouts.installed.runtimes[0] = "../../../escape.mjs";
  await assert.rejects(() => loadAnalysisRuntime(layouts.installed, malformed, "installed"), /reference-skill layout invalid/u);
  const manifest = path.join(fixtureRoot, ".codex-plugin/plugin.json"); const originalManifest = await readFile(manifest);
  await writeFile(manifest, JSON.stringify({ name: "wrong" })); await expectInvalid(); await writeFile(manifest, originalManifest);
  const target = path.resolve(path.dirname(layouts.installed), contract.layouts.installed.references[0]); const bytes = await readFile(target);
  await unlink(target); await symlink(sourceDecoy, target); await expectInvalid(); await unlink(target); await writeFile(target, bytes);
  await unlink(target); await mkdir(target); await expectInvalid(); await rm(target, { recursive: true }); await writeFile(target, bytes);
  await unlink(target); execFileSync("mkfifo", [target]); await expectInvalid(); await rm(target, { force: true }); await writeFile(target, bytes);
  await assert.rejects(() => loadAnalysisRuntime(path.join(fixtureRoot, "skills/not-the-skill/SKILL.md"), contract, "installed", source.files), /reference-skill layout invalid/u);
  const ambiguous = structuredClone(contract); ambiguous.layouts.source = structuredClone(ambiguous.layouts.installed);
  await assert.rejects(() => loadAnalysisRuntime(layouts.installed, ambiguous, "installed", source.files), /reference-skill layout invalid/u);
  const referenceRoot = path.join(fixtureRoot, "references"); const moved = `${referenceRoot}-real`; await rm(moved, { recursive: true, force: true }); await cp(referenceRoot, moved, { recursive: true }); await rm(referenceRoot, { recursive: true, force: true }); await symlink(moved, referenceRoot, "dir"); await expectInvalid();
});

test("Studio writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const contract = readWritingContract(await readFile(path.join(pluginRoot, "skills/polish-game-design-writing/SKILL.md"), "utf8"));
  assert.deepEqual(contract.optionalInputs, ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"]);
  assert.equal(contract.terminologyBehavior, "validate-and-report"); assert.equal(contract.autoReplace, false); assert.equal(contract.approvalMutation, false);
  assert.deepEqual(contract.languageRoutes, { ko: "humanize-korean-then-human-review", "en-US": "english-consistency-findings-then-human-review", "en-GB": "english-consistency-findings-then-human-review" });
});
