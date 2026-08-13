import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");
const glossaryLayouts = {
  installed: {
    runtime: "../../scripts/manage-game-design-glossary.mjs",
    references: ["../../references/shared/reference-intelligence/references/evidence-policy.md"],
    schemas: ["../../references/shared/reference-intelligence/schema/game-design-glossary.schema.json", "../../references/shared/reference-intelligence/schema/glossary-receipt.schema.json"],
  },
  source: {
    runtime: "../../../scripts/manage-game-design-glossary.mjs",
    references: ["../../references/evidence-policy.md"],
    schemas: ["../../schema/game-design-glossary.schema.json", "../../schema/glossary-receipt.schema.json"],
  },
};

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
  await mkdir(path.join(installed, ".codex-plugin"), { recursive: true });
  await writeFile(path.join(installed, ".codex-plugin/plugin.json"), JSON.stringify({ name: "reference-intelligence-fixture", version: "1.0.0", description: "fixture", author: { name: "fixture" }, skills: "./skills/", interface: { displayName: "fixture", shortDescription: "fixture", longDescription: "fixture", developerName: "fixture", category: "Productivity", capabilities: ["Write"], defaultPrompt: ["fixture"] } }));
  await mkdir(path.join(installed, "skills", skillId), { recursive: true });
  await cp(path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), path.join(installed, "skills", skillId, "SKILL.md"));
  return { source: path.join(sourceShared, "reference-intelligence/skills", skillId, "SKILL.md"), installed: path.join(installed, "skills", skillId, "SKILL.md") };
}

function invalidLayout() { throw new Error("reference-skill layout invalid"); }
async function stableRegular(root, target) {
  const relative = path.relative(root, target);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes("..")) invalidLayout();
  let cursor = root;
  for (const part of relative.split(path.sep)) { cursor = path.join(cursor, part); const info = await lstat(cursor).catch(() => invalidLayout()); if (info.isSymbolicLink() || (cursor === target ? !info.isFile() : !info.isDirectory())) invalidLayout(); }
  const before = await lstat(target); const bytes = await readFile(target); const after = await lstat(target);
  if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.size !== after.size) invalidLayout();
  return bytes;
}

async function loadGlossaryRuntime(skillPath, contract, layout, counterpartFiles = null) {
  if (JSON.stringify(contract.layouts) !== JSON.stringify(glossaryLayouts) || !["source", "installed"].includes(layout)) invalidLayout();
  const declaration = glossaryLayouts[layout];
  const root = layout === "installed" ? path.resolve(path.dirname(skillPath), "../..") : path.resolve(path.dirname(skillPath), "../../../..");
  const expectedSkill = layout === "installed" ? path.join(root, "skills/maintain-game-design-glossary/SKILL.md") : path.join(root, "shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md");
  if (path.resolve(skillPath) !== expectedSkill) invalidLayout();
  await stableRegular(root, expectedSkill);
  if (layout === "installed") { const manifest = await stableRegular(root, path.join(root, ".codex-plugin/plugin.json")); try { if (JSON.parse(manifest).name !== "reference-intelligence-fixture") invalidLayout(); } catch { invalidLayout(); } }
  const runtime = path.resolve(path.dirname(skillPath), declaration.runtime);
  const files = [];
  for (const [category, declared] of [["runtime", declaration.runtime], ...declaration.references.map((value) => ["references", value]), ...declaration.schemas.map((value) => ["schemas", value])]) {
    if (path.isAbsolute(declared)) invalidLayout(); const target = path.resolve(path.dirname(skillPath), declared);
    if (target !== path.resolve(path.dirname(expectedSkill), declared) || !target.startsWith(`${root}${path.sep}`)) invalidLayout(); files.push([category, declared, await stableRegular(root, target)]);
  }
  if (counterpartFiles && !counterpartFiles.every(([category, , bytes], index) => category === files[index]?.[0] && Buffer.compare(bytes, files[index][2]) === 0)) invalidLayout();
  const [api, validator, capabilities] = await Promise.all([
    import(`${pathToFileURL(runtime).href}?layout=${layout}-${Date.now()}-${Math.random()}`),
    import(pathToFileURL(path.join(path.dirname(runtime), "validate-reference-intelligence.mjs")).href),
    import(pathToFileURL(path.join(path.dirname(runtime), "lib/game-design-glossary-capabilities.mjs")).href),
  ]);
  return { api, validator, capabilities, files };
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

test("glossary skill declares the complete, canonical source and installed boundaries", async () => {
  const contract = readContract(await readSkill("shared", "maintain-game-design-glossary"));
  assert.deepEqual(contract.layouts, glossaryLayouts);
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
  const sourceFiles = (await loadGlossaryRuntime(layouts.source, contract, "source")).files;
  for (const [layout, skillPath] of Object.entries(layouts)) {
    const { api, validator, capabilities } = await loadGlossaryRuntime(skillPath, contract, layout, layout === "installed" ? sourceFiles : null);
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

test("glossary consumer rejects partial installed identities instead of rescuing them from source", async (t) => {
  const contract = readContract(await readSkill("shared", "maintain-game-design-glossary"));
  const layouts = await createLayouts(t, "maintain-game-design-glossary");
  const sourceFiles = (await loadGlossaryRuntime(layouts.source, contract, "source")).files;
  const expectInvalid = async () => assert.rejects(() => loadGlossaryRuntime(layouts.installed, contract, "installed", sourceFiles), /reference-skill layout invalid/u);
  for (const declared of [contract.layouts.installed.runtime, ...contract.layouts.installed.references, ...contract.layouts.installed.schemas]) {
    const target = path.resolve(path.dirname(layouts.installed), declared); const bytes = await readFile(target);
    await unlink(target); await expectInvalid(); await writeFile(target, bytes);
    await writeFile(target, Buffer.concat([bytes, Buffer.from("\n ")])); await expectInvalid(); await writeFile(target, bytes);
  }
  const fixtureRoot = path.resolve(path.dirname(layouts.installed), "../.."); const manifest = path.join(fixtureRoot, ".codex-plugin/plugin.json"); const manifestBytes = await readFile(manifest);
  await writeFile(manifest, JSON.stringify({ name: "wrong" })); await expectInvalid(); await writeFile(manifest, manifestBytes);
  const target = path.resolve(path.dirname(layouts.installed), contract.layouts.installed.schemas[0]); const bytes = await readFile(target);
  await unlink(target); await symlink(layouts.source, target); await expectInvalid();
  const malformed = structuredClone(contract); malformed.layouts.installed.runtime = "/tmp/escape.mjs"; await assert.rejects(() => loadGlossaryRuntime(layouts.installed, malformed, "installed"), /reference-skill layout invalid/u);
  malformed.layouts.installed.runtime = "../../../escape.mjs"; await assert.rejects(() => loadGlossaryRuntime(layouts.installed, malformed, "installed"), /reference-skill layout invalid/u);
  await unlink(target); await writeFile(target, bytes);
});

test("Career writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const contract = readWritingContract(await readSkill("game-design-career", "polish-game-design-writing"));
  assert.deepEqual(contract.optionalInputs, ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"]); assert.equal(contract.terminologyBehavior, "validate-and-report"); assert.equal(contract.autoReplace, false); assert.equal(contract.approvalMutation, false);
  assert.deepEqual(contract.languageRoutes, { ko: "humanize-korean-then-human-review", "en-US": "english-consistency-findings-then-human-review", "en-GB": "english-consistency-findings-then-human-review" });
});
