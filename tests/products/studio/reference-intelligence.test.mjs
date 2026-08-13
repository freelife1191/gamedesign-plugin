import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";
import { loadBundledReferenceCatalog } from "../../../shared/scripts/lib/system-atlas.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");
const analysisWorkflow = ["reference-brief", "role-based-reference-set", "evidence-registry", "system-atlas", "inventory-without-evaluation", "system-maps-and-loops", "priority", "deep-dives", "cross-game-comparison", "adopt-adapt-reject-hold", "verification-queue", "glossary-candidates"];

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
  await mkdir(path.join(installed, "skills", skillId), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), path.join(installed, "skills", skillId, "SKILL.md"));
  return {
    source: path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"),
    installed: path.join(installed, "skills", skillId, "SKILL.md"),
  };
}

async function loadAnalysisRuntime(skillPath, contract, layout) {
  const declaration = contract.layouts?.[layout];
  assert.ok(declaration, `${layout}: declared skill layout`);
  const root = layout === "installed" ? path.resolve(path.dirname(skillPath), "../..") : path.resolve(path.dirname(skillPath), "../../..");
  const runtime = path.resolve(path.dirname(skillPath), declaration.runtime);
  assert.ok(runtime.startsWith(`${root}${path.sep}`), `${layout}: runtime remains inside canonical root`);
  await access(runtime);
  for (const reference of [...declaration.references, ...declaration.templates, ...declaration.schemas]) await access(path.resolve(path.dirname(skillPath), reference));
  const [analysis, validator] = await Promise.all([
    import(`${pathToFileURL(runtime).href}?layout=${layout}-${Date.now()}-${Math.random()}`),
    import(pathToFileURL(path.join(path.dirname(runtime), "validate-reference-intelligence.mjs")).href),
  ]);
  return { analysis, runtime, validator };
}

function analysisInput(atlas) {
  return {
    brief: { analysisId: "pressure-analysis", objective: "Test a safe reference workflow.", decisionQuestions: ["Which loop is evidenced?"] },
    referenceSet: [
      { referenceId: "ref-alpha", label: "Alpha", role: "direct-competitor", availability: "available", limitation: null },
      { referenceId: "ref-beta", label: "Beta", role: "core-system-exemplar", availability: "available", limitation: null },
      { referenceId: "ref-gamma", label: "Gamma", role: "operations-monetization-comparator", availability: "unavailable", limitation: "Offline official source is unavailable." },
    ],
    referenceContexts: [
      { contextId: "ctx-alpha-v1", referenceId: "ref-alpha", version: "1", platform: "pc" },
      { contextId: "ctx-beta-v1", referenceId: "ref-beta", version: "1", platform: "pc" },
      { contextId: "ctx-gamma-v1", referenceId: "ref-gamma", version: "1", platform: "pc" },
    ],
    atlas: { atlas },
    evidence: [
      { evidenceId: "ev-alpha", referenceId: "ref-alpha", contextId: "ctx-alpha-v1", systemIds: ["core-play"], sourceType: "direct-play", claimKind: "observation", claim: "The player completes a loop.", availability: "available", limitation: null, verificationQuestion: null },
      { evidenceId: "ev-beta-community", referenceId: "ref-beta", contextId: "ctx-beta-v1", systemIds: ["core-play"], sourceType: "community", claimKind: "observation", claim: "Community material suggests a loop question.", availability: "available", limitation: null, verificationQuestion: null },
      { evidenceId: "ev-gamma-offline", referenceId: "ref-gamma", contextId: "ctx-gamma-v1", systemIds: ["core-play"], sourceType: "official-site", claimKind: "observation", claim: "Official offer evidence is unavailable.", availability: "unavailable", limitation: "Offline official source is unavailable.", verificationQuestion: "Which official page can verify the offer?" },
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
  const bundled = await loadBundledReferenceCatalog({ moduleRoot: path.join(repoRoot, "shared/reference-intelligence") });
  const installed = await loadAnalysisRuntime(layouts.installed, contract, "installed");
  assert.deepEqual(await readFile(source.runtime), await readFile(installed.runtime), "both fixed runtime candidates are byte-identical");
  assert.deepEqual(
    await readFile(path.resolve(path.dirname(layouts.source), contract.layouts.source.references[0])),
    await readFile(path.resolve(path.dirname(layouts.installed), contract.layouts.installed.references[0])),
    "both fixed evidence-policy candidates are byte-identical",
  );
  for (const [layout, skillPath, loaded] of [["source", layouts.source, source], ["installed", layouts.installed, installed]]) {
    const analysis = loaded.analysis.buildReferenceAnalysis(analysisInput(bundled.atlas));
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

test("Studio writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const contract = readWritingContract(await readFile(path.join(pluginRoot, "skills/polish-game-design-writing/SKILL.md"), "utf8"));
  assert.deepEqual(contract.optionalInputs, ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"]);
  assert.equal(contract.terminologyBehavior, "validate-and-report"); assert.equal(contract.autoReplace, false); assert.equal(contract.approvalMutation, false);
  assert.deepEqual(contract.languageRoutes, { ko: "humanize-korean-then-human-review", "en-US": "english-consistency-findings-then-human-review", "en-GB": "english-consistency-findings-then-human-review" });
});
