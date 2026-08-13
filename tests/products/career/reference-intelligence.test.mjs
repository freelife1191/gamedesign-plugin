import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");

async function readRouting() { return JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8")); }
async function readSkill(product, skillId) { return readFile(path.join(product === "shared" ? skillRoot : path.join(pluginRoot, "skills"), skillId, "SKILL.md"), "utf8"); }
function readContract(skill) { const match = skill.match(/<!-- reference-intelligence-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- reference-intelligence-contract:end -->/u); assert.ok(match, "reference-intelligence contract"); return JSON.parse(match[1]); }
function readWritingContract(skill) { const match = skill.match(/<!-- game-design-writing-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- game-design-writing-contract:end -->/u); assert.ok(match, "game-design-writing contract"); return JSON.parse(match[1]); }

async function createLayouts(t, skillId) {
  const root = await mkdtemp(path.join(tmpdir(), "glossary-skill-layout-")); t.after(() => rm(root, { recursive: true, force: true }));
  const sourceShared = path.join(root, "source", "shared"); const installed = path.join(root, "installed");
  await cp(path.join(repoRoot, "shared"), sourceShared, { recursive: true });
  await cp(path.join(sourceShared, "scripts"), path.join(installed, "scripts"), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence"), path.join(installed, "references/shared/reference-intelligence"), { recursive: true });
  await mkdir(path.join(installed, "skills", skillId), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), path.join(installed, "skills", skillId, "SKILL.md"));
  return { source: path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), installed: path.join(installed, "skills", skillId, "SKILL.md") };
}

async function loadGlossaryRuntime(skillPath, contract, layout) {
  const declaration = contract.layouts?.[layout]; assert.ok(declaration, `${layout}: declared skill layout`);
  const root = layout === "installed" ? path.resolve(path.dirname(skillPath), "../..") : path.resolve(path.dirname(skillPath), "../../..");
  const runtime = path.resolve(path.dirname(skillPath), declaration.runtime);
  assert.ok(runtime.startsWith(`${root}${path.sep}`), `${layout}: runtime remains inside canonical root`);
  for (const reference of [...declaration.references, ...declaration.schemas]) assert.ok(path.resolve(path.dirname(skillPath), reference).startsWith(`${root}${path.sep}`));
  const [api, validator, capabilities] = await Promise.all([
    import(`${pathToFileURL(runtime).href}?layout=${layout}-${Date.now()}-${Math.random()}`),
    import(pathToFileURL(path.join(path.dirname(runtime), "validate-reference-intelligence.mjs")).href),
    import(pathToFileURL(path.join(path.dirname(runtime), "lib/game-design-glossary-capabilities.mjs")).href),
  ]);
  return { api, validator, capabilities };
}

function term(overrides = {}) { return { termId: "TERM-PLAYER-POWER", koPreferred: "플레이어 파워", enPreferred: "Player Power", definition: "A measure of player strength.", scope: "combat", contexts: ["combat"], abbreviations: [], allowedVariants: [], forbiddenTerms: ["전투력"], deprecatedTerms: [], untranslatedExpressions: [], grammar: { ko: "명사", en: "noun" }, examples: [], confusedConceptIds: [], decisionIds: [], evidenceIds: [], state: "proposed", approver: null, replacementTermId: null, version: 1, changedAt: "2026-08-01T00:00:00.000Z", ...overrides }; }
function glossary() { return { schemaVersion: 1, scope: "shared", version: 1, terms: [term()] }; }

test("Career reuses common analysis without changing fact-inference rules", async () => {
  const skill = await readSkill("game-design-career", "reverse-engineer-game-design"); assert.match(skill, /analyze-game-design-references/u); assert.match(skill, /fact-inference-schema\.json/u);
});

test("Career projects common skills without approval authority", async () => {
  const routing = await readRouting();
  for (const skillId of ["analyze-game-design-references", "maintain-game-design-glossary"]) {
    assert.ok(routing.skillIds.includes(skillId)); assert.ok(routing.plannedPaths.skills.includes(`skills/${skillId}/SKILL.md`));
    const owner = routing.directUseReviewOwners.find((item) => item.skill === skillId); assert.ok(owner, `${skillId}: review owner`);
    assert.ok(owner.owners.every((role) => ["reverse-design-critic", "evidence-auditor", "document-quality-editor"].includes(role))); assert.doesNotMatch(JSON.stringify(owner), /approv(?:e|al)/iu);
  }
  assert.deepEqual(routing.referenceIntelligenceWorkflow.outputs, ["reverse-design-document", "game-analysis-report"]); assert.equal(routing.referenceIntelligenceWorkflow.transferState, "pending-review");
});

test("rushed glossary rewrite executes source and installed public runtimes without source mutation", async (t) => {
  const contract = readContract(await readSkill("shared", "maintain-game-design-glossary"));
  const layouts = await createLayouts(t, "maintain-game-design-glossary");
  const sourceRuntime = path.resolve(path.dirname(layouts.source), contract.layouts.source.runtime);
  const installedRuntime = path.resolve(path.dirname(layouts.installed), contract.layouts.installed.runtime);
  assert.deepEqual(await readFile(sourceRuntime), await readFile(installedRuntime), "both fixed runtime candidates are byte-identical");
  assert.deepEqual(
    await readFile(path.resolve(path.dirname(layouts.source), contract.layouts.source.references[0])),
    await readFile(path.resolve(path.dirname(layouts.installed), contract.layouts.installed.references[0])),
    "both fixed evidence-policy candidates are byte-identical",
  );
  for (const [layout, skillPath] of Object.entries(layouts)) {
    const { api, validator, capabilities } = await loadGlossaryRuntime(skillPath, contract, layout);
    const original = path.join(path.dirname(skillPath), `original-${layout}.md`); const source = "플레이어 파워와 신규 용어"; await writeFile(original, source); const before = await readFile(original);
    const shared = glossary(); const issued = capabilities.issueGlossaryHumanDecision({ action: "approve", termIds: ["TERM-PLAYER-POWER"], actor: "Lead Designer", eventId: `approve-${layout}`, glossarySha256: validator.sha256Canonical(shared), glossaryVersion: 1, changedAt: "2026-08-01T00:00:00.000Z" });
    assert.throws(() => api.applyGlossaryDecision({ glossary: shared, receipt: structuredClone(issued.receipt), capability: issued.capability }), /glossary/i, `${layout}: copied receipt fails`);
    assert.throws(() => api.applyGlossaryDecision({ glossary: shared, receipt: issued.receipt, capability: {} }), /glossary/i, `${layout}: forged capability fails`);
    assert.throws(() => api.applyGlossaryDecision({ glossary: shared, receipt: issued.receipt }), /glossary/i, `${layout}: missing capability fails`);
    const candidates = api.extractGlossaryCandidates({ documents: [{ documentId: "combat-v1", text: source }], effectiveGlossary: { ...shared, scope: "effective", terms: [term({ state: "approved", approver: "Lead Designer", decisionIds: ["prior-decision"] })] } });
    assert.ok(candidates.every(({ state }) => state === "proposed")); assert.deepEqual(await readFile(original), before, `${layout}: candidate extraction preserves bytes`);
    const approved = api.applyGlossaryDecision({ glossary: shared, ...issued }); assert.equal(approved.terms[0].state, "approved", `${layout}: only live human decision approves`);
    const effective = { ...approved, scope: "effective" }; const receipt = api.createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
    const findings = api.validateDocumentTerminology({ text: source, language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
    assert.equal(findings.revisedText, undefined); assert.deepEqual(await readFile(original), before, `${layout}: writing projection neither approves nor rewrites`);
  }
});

test("Career writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const contract = readWritingContract(await readSkill("game-design-career", "polish-game-design-writing"));
  assert.deepEqual(contract.optionalInputs, ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"]); assert.equal(contract.terminologyBehavior, "validate-and-report"); assert.equal(contract.autoReplace, false); assert.equal(contract.approvalMutation, false);
  assert.deepEqual(contract.languageRoutes, { ko: "humanize-korean-then-human-review", "en-US": "english-consistency-findings-then-human-review", "en-GB": "english-consistency-findings-then-human-review" });
});
