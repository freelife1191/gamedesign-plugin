#!/usr/bin/env node

import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { prepareStudioExportJob } from "../../export-game-design-documents/scripts/prepare-studio-export.mjs";
import { composeProfiles } from "./compose-profiles.mjs";

const pluginRoot = fileURLToPath(new URL("../../../", import.meta.url));
const routingPath = path.join(pluginRoot, "references/routing.json");
const presetsPath = path.join(pluginRoot, "references/visualization-presets.json");
const templateIntegrityPath = path.join(pluginRoot, "references/template-content-integrity.json");
const templateRoot = path.join(pluginRoot, "assets/templates");
const workflowPath = path.join(pluginRoot, "skills/orchestrate-game-design-project/references/workflow.md");
const RESULT_KEYS = [
  "schemaVersion", "scenarioId", "routeIds", "roleIds", "templateIds", "evidenceRegistry",
  "responsibleGates", "outputManifestPath", "domain",
];
const REQUEST_KEYS = [
  "schemaVersion", "scenarioId", "intents", "profileIds", "requestedFormats", "reviewMode",
  "visualizationPath",
];
const SCENARIOS = Object.freeze({
  "live-service-rpg-economy": {
    routes: ["economy", "liveops", "export"],
    profiles: ["live-service-rpg"],
    roles: ["system-economy-designer", "ux-accessibility-reviewer", "liveops-data-designer"],
    templates: ["economy-balance", "liveops-experiment-event"],
    gates: ["economy-transparency", "liveops-experiment"],
    recipeId: "liveops-plan",
    exportTemplateId: "liveops-experiment-event",
    approvalSnapshotFile: "approval-snapshot.json",
    approvalSnapshotSha256: "6392b97464cdafd58fcab3882f88d8f9401fd7f56bb318358c8f71a1ed2f16d1",
    requiredProfileSections: ["liveops-calendar-and-rollback", "economy-sources-sinks-and-inflation"],
  },
  "mobile-onboarding-liveops": {
    routes: ["player-experience", "liveops", "visualization", "export"],
    profiles: ["mobile"],
    roles: ["system-economy-designer", "ux-accessibility-reviewer", "liveops-data-designer"],
    templates: ["ui-ux-flow-state", "liveops-experiment-event"],
    gates: ["accessibility", "liveops-experiment"],
    recipeId: "liveops-plan",
    exportTemplateId: "liveops-experiment-event",
    approvalSnapshotFile: "approval-snapshot.json",
    approvalSnapshotSha256: "02e27946eb7047c299f969f438a968412ce320edba2f73cb5c88d0148de61cb5",
    requiredProfileSections: ["touch-input-and-device-matrix", "short-session-and-interruption-recovery"],
  },
  "pc-console-ai-npc": {
    routes: ["content", "systems", "review", "export"],
    profiles: ["pc-console"],
    roles: ["content-narrative-designer", "ux-accessibility-reviewer", "production-feasibility-critic"],
    templates: ["narrative-quest-npc", "system-specification", "game-design-review"],
    gates: ["ai-rights-human-approval", "ai-npc-safety"],
    recipeId: "content-spec",
    exportTemplateId: "narrative-quest-npc",
    approvalSnapshotFile: "approval-snapshot.json",
    approvalSnapshotSha256: "50e9c5ab008f599bfcdc56178de0947527767e30978901c7ee10fc0e5d7c0569",
    requiredProfileSections: ["controller-and-keyboard-mouse-input", "platform-certification-and-entitlements"],
  },
});
const APPROVED_TEMPLATE_IDS = [...new Set(Object.values(SCENARIOS).flatMap(({ templates }) => templates))].sort();
let canonicalValidatorPromise;
let gateRegistryPromise;

function finding(code, message) {
  return { code, message };
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function exactKeys(value, expected) {
  return isRecord(value) && sameArray(Object.keys(value).sort(), [...expected].sort());
}

function exactTextRecord(value, keys) {
  return exactKeys(value, keys) && keys.every((key) => isText(value[key]));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hasExactKeys(value, keys, code, errors, label) {
  if (exactKeys(value, keys)) return true;
  errors.push(finding(code, `${label} must use exact keys: ${[...keys].sort().join(", ")}.`));
  return false;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function assertPlainFile(file, root, label) {
  const rootReal = await realpath(root);
  const resolved = path.resolve(rootReal, file);
  const relative = path.relative(rootReal, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must resolve inside the scenario fixture.`);
  }
  let cursor = rootReal;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) throw new Error(`${label} must not traverse a symlink.`);
  }
  const stat = await lstat(resolved);
  if (!stat.isFile()) throw new Error(`${label} must be a file.`);
  const canonical = await realpath(resolved);
  if (!canonical.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must remain inside the scenario fixture.`);
  return canonical;
}

async function readScenarioFile(root, file, label) {
  return readJson(await assertPlainFile(file, root, label));
}

async function loadCanonicalValidator() {
  canonicalValidatorPromise ??= (async () => {
    const candidates = [
      new URL("../../../scripts/validate-artifact.mjs", import.meta.url),
      new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),
    ];
    let lastError;
    for (const candidate of candidates) {
      try {
        const module = await import(candidate.href);
        if (typeof module.validateArtifact !== "function") throw new Error("validateArtifact export is missing");
        return { validateArtifact: module.validateArtifact, validatorPath: fileURLToPath(candidate) };
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Canonical validator unavailable: ${lastError?.message ?? "unknown error"}`);
  })();
  return canonicalValidatorPromise;
}

async function loadGateRegistry() {
  gateRegistryPromise ??= (async () => {
    const candidates = [
      path.join(pluginRoot, "references/shared/responsible-design/gates.json"),
      path.resolve(pluginRoot, "../../../shared/responsible-design/gates.json"),
    ];
    let lastError;
    for (const candidate of candidates) {
      try {
        return await readJson(candidate);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Responsible-design gate registry unavailable: ${lastError?.message ?? "unknown error"}`);
  })();
  return gateRegistryPromise;
}

export async function validateTemplateContentIntegrity(templateId, sourceOverride) {
  const integrity = await readJson(templateIntegrityPath);
  if (!exactKeys(integrity, ["schemaVersion", "algorithm", "contentHashes"])
    || integrity.schemaVersion !== 1 || integrity.algorithm !== "sha256" || !isRecord(integrity.contentHashes)
    || !sameArray(Object.keys(integrity.contentHashes).sort(), APPROVED_TEMPLATE_IDS)) {
    return { valid: false, error: "Packaged template integrity registry is invalid." };
  }
  const expected = integrity.contentHashes[templateId];
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/u.test(expected)) {
    return { valid: false, error: `No approved content hash exists for ${templateId}.` };
  }
  const source = sourceOverride === undefined
    ? await readFile(path.join(templateRoot, templateId, "content.md"))
    : Buffer.from(sourceOverride);
  const actual = sha256(source);
  return { valid: actual === expected, expected, actual };
}

export function validateExportTemplateContract({ recipeId, exportTemplateId, templates }) {
  const recipeTemplates = {
    "liveops-plan": "liveops-experiment-event",
    "content-spec": "narrative-quest-npc",
  };
  const expected = recipeTemplates[recipeId];
  return expected !== undefined
    && exportTemplateId === expected
    && Array.isArray(templates)
    && templates.includes(exportTemplateId);
}

function extractReviewPolicy(markdown) {
  const match = markdown.match(/<!-- review-policy:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- review-policy:end -->/u);
  if (!match) throw new Error("review-policy contract is missing");
  return JSON.parse(match[1]);
}

function validateRequest(request, errors) {
  if (!hasExactKeys(request, REQUEST_KEYS, "scenario.request-keys", errors, "Scenario request")) return null;
  if (request.schemaVersion !== 1 || !isText(request.scenarioId)
    || !Array.isArray(request.intents) || request.intents.length === 0 || !request.intents.every(isText)
    || !Array.isArray(request.profileIds) || !request.profileIds.every(isText)
    || !Array.isArray(request.requestedFormats) || request.requestedFormats.length === 0 || !request.requestedFormats.every(isText)
    || (request.scenarioId === "mobile-onboarding-liveops" ? !isText(request.visualizationPath) : request.visualizationPath !== null)
    || request.reviewMode !== "sequential-fallback") {
    errors.push(finding("scenario.request-schema", "Scenario request has invalid field values."));
    return null;
  }
  const scenario = SCENARIOS[request.scenarioId] ?? null;
  if (scenario && !validateExportTemplateContract(scenario)) {
    errors.push(finding("output.export-template", "Scenario export template does not match its recipe contract."));
    return null;
  }
  return scenario;
}

async function validateRoutingProfilesAndRoles(request, result, scenario, errors) {
  const routing = await readJson(routingPath);
  const routes = request.intents.map((intent) => routing.routes.find(({ triggerIntents }) => triggerIntents.includes(intent)));
  if (routes.some((route) => !route)) {
    errors.push(finding("route.intent", "Every intent must resolve through routing.json."));
    return { routeIds: [], skillIds: [], profileIds: [], roleIds: [] };
  }
  const routeIds = routes.map(({ id }) => id);
  const skillIds = routes.map(({ skill }) => skill);
  if (!sameArray(routeIds, scenario.routes) || !sameArray(result.routeIds, routeIds)) {
    errors.push(finding("route.chain", "Result routes must exactly match routes resolved from actual trigger intents."));
  }
  for (const route of routes) {
    if (!Array.isArray(route.requiredInputs) || route.requiredInputs.length === 0
      || !Array.isArray(route.completionGates) || route.completionGates.length === 0
      || route.maxReviewers !== 3) {
      errors.push(finding("route.contract", `${route.id} is missing its professional routing contract.`));
    }
  }
  for (const skillId of new Set(skillIds)) {
    try {
      const skillPath = path.join(pluginRoot, "skills", skillId, "SKILL.md");
      const [stat, source] = await Promise.all([lstat(skillPath), readFile(skillPath, "utf8")]);
      if (!stat.isFile() || stat.isSymbolicLink() || !source.startsWith(`---\nname: ${skillId}\n`)) {
        throw new Error("identity mismatch");
      }
    } catch (error) {
      errors.push(finding("route.skill", `Routed skill ${skillId} is unavailable or invalid: ${error.message}.`));
    }
  }

  if (!sameArray(request.profileIds, scenario.profiles)) errors.push(finding("profile.selection", "Scenario profile selection changed."));
  let composed = { profiles: [], requiredSections: [], gates: [], roles: [] };
  try {
    composed = composeProfiles(request.profileIds);
  } catch (error) {
    errors.push(finding("profile.composition", error.message));
  }
  for (const section of scenario.requiredProfileSections) {
    if (!composed.requiredSections.includes(section)) errors.push(finding("profile.section", `Missing composed profile section: ${section}.`));
  }
  for (const gateId of scenario.gates) {
    if (!composed.gates.includes(gateId) && gateId !== "ai-rights-human-approval" && gateId !== "ai-npc-safety") {
      errors.push(finding("profile.gate", `Composed profiles are missing responsible gate: ${gateId}.`));
    }
  }

  const allowedRoles = new Set(routes.flatMap(({ defaultReviewers }) => defaultReviewers));
  const rolePriority = routing.rolePriority;
  const canonicalRoles = [...scenario.roles].sort((left, right) => rolePriority.indexOf(left) - rolePriority.indexOf(right));
  if (!sameArray(result.roleIds, canonicalRoles)
    || !Array.isArray(result.roleIds)
    || result.roleIds.length > 3
    || result.roleIds.some((roleId) => !routing.roleIds.includes(roleId) || !allowedRoles.has(roleId))) {
    errors.push(finding("review.roles", "Review roles must be eligible, unique, capped at three, and ordered by registry priority."));
  }
  for (const roleId of canonicalRoles) {
    try {
      const rolePath = path.join(pluginRoot, "agents", `${roleId}.md`);
      const [stat, source] = await Promise.all([lstat(rolePath), readFile(rolePath, "utf8")]);
      if (!stat.isFile() || stat.isSymbolicLink() || !source.startsWith(`# ${roleId}\n`)) throw new Error("identity mismatch");
    } catch (error) {
      errors.push(finding("review.role-file", `Review role ${roleId} is unavailable or invalid: ${error.message}.`));
    }
  }
  const workflow = await readFile(workflowPath, "utf8");
  const policy = extractReviewPolicy(workflow);
  if (policy.fallback.when !== "host-without-subagents" || policy.fallback.order !== "rolePriority"
    || policy.fallback.preserveRolesAndQuestions !== true || policy.fallback.envelopeList !== "selectedReviews") {
    errors.push(finding("review.fallback", "Packaged sequential fallback contract is invalid."));
  }
  return { routeIds, skillIds, profileIds: composed.profiles, roleIds: canonicalRoles };
}

async function validateTemplates(result, scenario, errors) {
  if (!sameArray(result.templateIds, scenario.templates)) {
    errors.push(finding("template.chain", "Scenario templates must exactly match the approved professional workflow."));
  }
  const { validateArtifact } = await loadCanonicalValidator();
  const validatedTemplateIds = [];
  for (const templateId of scenario.templates) {
    const artifactRoot = path.join(templateRoot, templateId);
    const [validation, integrity] = await Promise.all([
      validateArtifact(artifactRoot),
      validateTemplateContentIntegrity(templateId),
    ]);
    if (!validation.ok) {
      errors.push(finding("template.invalid", `${templateId}: ${validation.errors.map(({ message }) => message).join("; ")}`));
      continue;
    }
    if (!integrity.valid) {
      errors.push(finding("template.integrity", `${templateId} content does not match the Task 8 approved SHA-256.`));
      continue;
    }
    validatedTemplateIds.push(templateId);
  }
  return validatedTemplateIds;
}

async function validateEvidenceAndGates(result, trustedSnapshot, scenario, errors) {
  const snapshotKeys = [
    "schemaVersion", "scenarioId", "decisionId", "approvalDate", "evidenceRegistry", "responsibleGates",
  ];
  if (!exactKeys(trustedSnapshot, snapshotKeys)
    || trustedSnapshot.schemaVersion !== 1
    || trustedSnapshot.scenarioId !== result.scenarioId
    || !isText(trustedSnapshot.decisionId)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(trustedSnapshot.approvalDate)
    || !Array.isArray(trustedSnapshot.evidenceRegistry)
    || !Array.isArray(trustedSnapshot.responsibleGates)) {
    errors.push(finding("approval.snapshot-schema", "Trusted approval snapshot has an invalid exact schema."));
    return;
  }
  if (!isDeepStrictEqual(result.evidenceRegistry, trustedSnapshot.evidenceRegistry)) {
    errors.push(finding("approval.evidence-mismatch", "Result evidence must deep-exact match the trusted approval snapshot."));
  }
  if (!isDeepStrictEqual(result.responsibleGates, trustedSnapshot.responsibleGates)) {
    errors.push(finding("approval.gate-mismatch", "Result gates must deep-exact match the trusted approval snapshot."));
  }
  const gateRegistry = await loadGateRegistry().catch((error) => {
    errors.push(finding("gate.registry", error.message));
    return null;
  });
  if (!gateRegistry) return;

  if (!sameArray(
    trustedSnapshot.responsibleGates.map((gate) => isRecord(gate) ? gate.gateId : undefined),
    scenario.gates,
  )) {
    errors.push(finding("gate.selection", "Trusted gate order and identity must exactly cover the scenario."));
  }
  const evidenceById = new Map();
  for (const evidence of trustedSnapshot.evidenceRegistry) {
    const fields = [
      "evidenceId", "gateId", "field", "kind", "subject", "assertion", "source", "limitation", "decisionId",
    ];
    if (!exactTextRecord(evidence, fields)) {
      errors.push(finding("evidence.schema", "Trusted evidence requires exact gate, field, kind, subject, assertion, source, limitation, and decision linkage."));
      continue;
    }
    if (evidenceById.has(evidence.evidenceId)) errors.push(finding("evidence.id", "Trusted evidence IDs must be unique."));
    evidenceById.set(evidence.evidenceId, evidence);
  }

  const mappedIds = new Set();
  for (const gate of trustedSnapshot.responsibleGates) {
    const gateKeys = [
      "gateId", "status", "blocker", "approver", "evidenceIds", "evidenceFields", "decisionId", "approvalDate",
    ];
    if (!hasExactKeys(gate, gateKeys, "gate.schema", errors, "Trusted gate")) continue;
    const registered = gateRegistry.gates?.find(({ id }) => id === gate.gateId);
    if (!registered || !sameArray(registered.allowed_states, gateRegistry.allowed_states)) {
      errors.push(finding("gate.registry", `${gate.gateId} is not a valid packaged responsible-design gate.`));
      continue;
    }
    const expectedFields = registered.evidence_fields;
    if (gate.status !== "approved" || !registered.allowed_states.includes(gate.status)
      || gate.blocker !== null || gate.approver !== registered.approver
      || gate.decisionId !== trustedSnapshot.decisionId || gate.approvalDate !== trustedSnapshot.approvalDate
      || !exactKeys(gate.evidenceFields, expectedFields)
      || !sameArray(gate.evidenceIds, expectedFields.map((field) => gate.evidenceFields?.[field]))) {
      errors.push(finding("gate.state", `${gate.gateId} must bind the registry approver and every evidence field to the trusted decision.`));
      continue;
    }
    for (const field of expectedFields) {
      const evidenceId = gate.evidenceFields[field];
      const evidence = evidenceById.get(evidenceId);
      if (!evidence
        || mappedIds.has(evidenceId)
        || evidence.gateId !== gate.gateId
        || evidence.field !== field
        || evidence.kind !== "approval-evidence"
        || evidence.subject !== `${gate.gateId}.${field}`
        || evidence.assertion !== "satisfied"
        || evidence.decisionId !== trustedSnapshot.decisionId
        || evidence.source !== `trusted-record://${result.scenarioId}/${gate.gateId}/${field}`
        || evidence.limitation !== "approved scenario scope only") {
        errors.push(finding("gate.evidence", `${gate.gateId}.${field} is not bound to exact positive trusted evidence.`));
      } else {
        mappedIds.add(evidenceId);
      }
    }
  }
  if (mappedIds.size !== evidenceById.size) {
    errors.push(finding("evidence.unrelated", "Every trusted evidence record must map exactly once to a required gate field."));
  }
}

function validateEconomy(domain, evidenceIds, errors) {
  if (!exactKeys(domain, ["economy", "rollback", "experiment"])) {
    errors.push(finding("economy.schema", "Economy domain must use the exact contract."));
    return {};
  }
  if (!exactKeys(domain.economy, ["resourceId", "source", "sink", "targetInventory", "inflationRisk", "realPricePolicy", "probabilityPolicy"])
    || !["resourceId", "source", "sink", "inflationRisk", "realPricePolicy", "probabilityPolicy"].every((field) => isText(domain.economy[field]))
    || !Number.isFinite(domain.economy.targetInventory) || domain.economy.targetInventory < 0) {
    errors.push(finding("economy.contract", "Economy source, sink, inventory, inflation, price, and probability fields are required."));
  }
  const rollback = domain.rollback;
  if (!exactKeys(rollback, ["enabled", "trigger", "mode", "action", "owner", "recovery", "evidenceIds"])
    || rollback.enabled !== true || rollback.trigger !== "guardrail-breach"
    || rollback.mode !== "automatic-on-threshold" || rollback.action !== "restore-last-known-good-config"
    || !isText(rollback.owner) || rollback.recovery !== "reconcile-ledger-and-notify"
    || !Array.isArray(rollback.evidenceIds) || rollback.evidenceIds.length === 0
    || rollback.evidenceIds.some((id) => !evidenceIds.has(id))) {
    errors.push(finding("economy.rollback", "Economy rollback must be enabled, executable, owned, recoverable, and evidence-linked."));
  }
  if (!exactTextRecord(domain.experiment, ["experimentId", "hypothesis", "control", "singleVariable", "guardrail", "stopCondition"])) {
    errors.push(finding("economy.experiment", "Economy experiment contract is incomplete."));
  }
  return { economyRollbackReady: !errors.some(({ code }) => code === "economy.rollback") };
}

function validateMobile(domain, errors) {
  if (!exactKeys(domain, ["onboarding", "liveops", "visualizationPresetId"])) {
    errors.push(finding("mobile.schema", "Mobile domain must use the exact contract."));
    return {};
  }
  if (!exactTextRecord(domain.onboarding, ["criticalAction", "touchPath", "skip", "revisit", "interruptionRecovery", "accessibilityAlternative"])) {
    errors.push(finding("mobile.onboarding", "Mobile onboarding must define accessible skip, revisit, and interruption recovery."));
  }
  const liveops = domain.liveops;
  if (!exactKeys(liveops, ["experimentId", "hypothesis", "control", "singleVariable", "guardrail", "stopCondition", "rollback"])
    || !["experimentId", "hypothesis", "control", "singleVariable", "stopCondition", "rollback"].every((field) => isText(liveops?.[field]))
    || !exactKeys(liveops?.guardrail, ["metric", "direction", "threshold"])
    || !isText(liveops?.guardrail?.metric) || liveops?.guardrail?.direction !== "must-not-increase"
    || !Number.isFinite(liveops?.guardrail?.threshold) || liveops.guardrail.threshold <= 0
    || liveops.stopCondition !== "guardrail-threshold-breach"
    || liveops.rollback !== "disable-experiment-and-restore-control") {
    errors.push(finding("liveops.guardrail", "LiveOps requires a positive, protective guardrail plus stop and rollback behavior."));
  }
  return {
    liveopsGuardrailReady: !errors.some(({ code }) => code === "liveops.guardrail"),
    visualizationPresetId: domain.visualizationPresetId,
  };
}

function validateAiNpc(domain, errors) {
  if (!exactKeys(domain, ["npc", "rightsConsent"])) {
    errors.push(finding("ai.schema", "AI NPC domain must use the exact contract."));
    return {};
  }
  const npc = domain.npc;
  if (!exactKeys(npc, ["contentId", "playerPurpose", "choiceConsequence", "questState", "npcState", "fallback", "killSwitch"])) {
    errors.push(finding("ai.npc-schema", "AI NPC must define content state, fallback, and kill switch."));
  }
  const fallbackReady = exactTextRecord(npc?.fallback, ["mode", "trigger", "owner"])
    && npc.fallback.mode === "authored-safe-dialogue"
    && npc.fallback.trigger === "model-or-policy-failure";
  if (!fallbackReady) errors.push(finding("ai.fallback", "AI NPC requires an owned authored safe-dialogue fallback."));
  const killSwitchReady = exactKeys(npc?.killSwitch, ["enabled", "scope", "owner", "recovery"])
    && npc.killSwitch.enabled === true && npc.killSwitch.scope === "all-generative-responses"
    && isText(npc.killSwitch.owner) && npc.killSwitch.recovery === "authored-safe-dialogue";
  if (!killSwitchReady) errors.push(finding("ai.kill-switch", "AI NPC requires an enabled, owned, recoverable kill switch."));
  const rightsFields = ["source", "creator", "attribution", "usePurpose", "rightsStatus", "consentStatus", "privacy", "moderation", "approver", "revocationPath"];
  const rightsReady = exactTextRecord(domain.rightsConsent, rightsFields)
    && domain.rightsConsent.rightsStatus === "granted"
    && domain.rightsConsent.consentStatus === "documented"
    && domain.rightsConsent.privacy === "no-player-personal-data"
    && domain.rightsConsent.moderation === "pre-and-post-generation-filters"
    && domain.rightsConsent.approver === "rights-and-legal-owner"
    && domain.rightsConsent.revocationPath === "disable-source-and-rebuild-index";
  if (!rightsReady) errors.push(finding("ai.rights-consent", "AI NPC requires explicit source, rights, consent, privacy, moderation, approval, and revocation."));
  return { aiRightsConsentReady: rightsReady, aiFallbackReady: fallbackReady, aiKillSwitchReady: killSwitchReady };
}

async function loadSkillsteadLinter() {
  const packagedRuntime = await lstat(path.join(pluginRoot, "scripts/validate-artifact.mjs"))
    .then((stat) => stat.isFile())
    .catch(() => false);
  if (packagedRuntime) {
    return assertPlainFile("skills/svg-infographic/scripts/check-svg.mjs", pluginRoot, "Skillstead linter");
  }
  const repoRoot = path.resolve(pluginRoot, "../../..");
  return assertPlainFile(
    "shared/vendor/skillstead/svg-infographic/0.8.3/scripts/check-svg.mjs",
    repoRoot,
    "Skillstead linter",
  );
}

async function validateVisualization(root, request, result, errors) {
  if (result.scenarioId !== "mobile-onboarding-liveops") return null;
  const presets = await readJson(presetsPath);
  const preset = presets.presets?.find(({ id }) => id === result.domain?.visualizationPresetId);
  if (!preset || presets.skillstead?.packagePath !== "skills/svg-infographic"
    || preset.svgLint?.command !== "node skills/svg-infographic/scripts/check-svg.mjs <svg-path>") {
    errors.push(finding("visualization.preset", "Mobile workflow must route through a packaged Skillstead preset and linter."));
  }
  try {
    const [svgPath, linterPath] = await Promise.all([
      assertPlainFile(request.visualizationPath, root, "visualizationPath"),
      loadSkillsteadLinter(),
    ]);
    const execution = spawnSync(process.execPath, [linterPath, svgPath], { encoding: "utf8" });
    const log = `${execution.stdout ?? ""}${execution.stderr ?? ""}`.trim();
    if (execution.status !== 0 || execution.error) {
      throw new Error(execution.error?.message || log || `exit ${execution.status}`);
    }
    const [svgBytes, linterBytes] = await Promise.all([readFile(svgPath), readFile(linterPath)]);
    return {
      path: request.visualizationPath,
      svgDigest: sha256(svgBytes),
      linterDigest: sha256(linterBytes),
      exitCode: execution.status,
      log,
    };
  } catch (error) {
    errors.push(finding("visualization.lint", `Skillstead lint failed closed: ${error.message}.`));
    return null;
  }
}

async function validateOutput(root, request, result, scenario, errors) {
  let manifest;
  try {
    manifest = await readScenarioFile(root, result.outputManifestPath, "outputManifestPath");
  } catch (error) {
    errors.push(finding("output.manifest", error.message));
    return {};
  }
  if (!exactKeys(manifest, ["schemaVersion", "requestedFormats", "canonicalArtifactPreserved"])
    || manifest.schemaVersion !== 1 || !sameArray(manifest.requestedFormats, request.requestedFormats)
    || manifest.canonicalArtifactPreserved !== true) {
    errors.push(finding("output.manifest", "Output manifest must exactly preserve the canonical artifact and requested formats."));
    return {};
  }
  const temporaryOutput = await mkdtemp(path.join(os.tmpdir(), "studio-scenario-export-"));
  try {
    const { validatorPath } = await loadCanonicalValidator();
    const presentation = request.requestedFormats.includes("pptx") ? {
      audience: "game design review team",
      purpose: "Decide the scenario release boundary",
      slideOutline: [
        { id: "player-problem", title: "Player problem", message: "Define the intended change", purpose: "Set context" },
        { id: "decision-evidence", title: "Decision evidence", message: "Compare decision and evidence", purpose: "Support review" },
      ],
    } : undefined;
    const prepared = await prepareStudioExportJob({
      requestedFormats: request.requestedFormats,
      recipeId: scenario.recipeId,
      artifactDir: path.join(templateRoot, scenario.exportTemplateId),
      outputDir: temporaryOutput,
      validatorPath,
      capabilities: {},
      ...(presentation ? { presentation } : {}),
    });
    const actualRequested = Object.entries(prepared.formats).filter(([, state]) => state.requested).map(([format]) => format);
    if (!sameArray(actualRequested, request.requestedFormats) || prepared.artifactPreservation.canonicalArtifactMutated !== false) {
      errors.push(finding("output.preparation", "Actual export preparation changed formats or canonical preservation."));
    }
    return Object.fromEntries(Object.entries(prepared.formats).map(([format, state]) => [format, state.status]));
  } catch (error) {
    errors.push(finding("output.preparation", error.message));
    return {};
  } finally {
    await rm(temporaryOutput, { recursive: true, force: true });
  }
}

export async function validateStudioScenario(root, options = {}) {
  const errors = [];
  let request;
  let result;
  try {
    const rootStat = await lstat(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("Scenario root must be a real directory.");
    request = options.requestOverride === undefined
      ? await readScenarioFile(root, "request.json", "request.json")
      : structuredClone(options.requestOverride);
    result = options.resultOverride === undefined
      ? await readScenarioFile(root, "result.json", "result.json")
      : structuredClone(options.resultOverride);
  } catch (error) {
    return { ok: false, errors: [finding("scenario.files", error.message)] };
  }
  if (!isRecord(request)) return { ok: false, errors: [finding("scenario.request-schema", "Scenario request must be a plain record.")] };
  if (!isRecord(result)) return { ok: false, errors: [finding("scenario.schema", "Scenario result must be a plain record.")] };
  hasExactKeys(result, RESULT_KEYS, "scenario.result-keys", errors, "Scenario result");
  if (result.schemaVersion !== 1 || result.scenarioId !== request.scenarioId || !isRecord(result.domain)) {
    errors.push(finding("scenario.schema", "Scenario result identity and domain are invalid."));
  }
  const scenario = validateRequest(request, errors);
  if (!scenario) {
    errors.push(finding("scenario.id", "Unknown or invalid professional scenario."));
    return { ok: false, scenarioId: request.scenarioId, errors };
  }
  let trustedSnapshot;
  try {
    const snapshotPath = await assertPlainFile(scenario.approvalSnapshotFile, root, "approval snapshot");
    const snapshotBytes = await readFile(snapshotPath);
    if (sha256(snapshotBytes) !== scenario.approvalSnapshotSha256) {
      errors.push(finding("approval.snapshot-integrity", "Canonical approval snapshot bytes do not match the scenario registry SHA-256."));
      return { ok: false, scenarioId: request.scenarioId, errors };
    }
    trustedSnapshot = JSON.parse(snapshotBytes.toString("utf8"));
  } catch (error) {
    errors.push(finding("approval.snapshot-file", error.message));
    return { ok: false, scenarioId: request.scenarioId, errors };
  }
  const routing = await validateRoutingProfilesAndRoles(request, result, scenario, errors);
  const validatedTemplateIds = await validateTemplates(result, scenario, errors);
  await validateEvidenceAndGates(result, trustedSnapshot, scenario, errors);
  const evidenceIds = new Set(Array.isArray(result.evidenceRegistry)
    ? result.evidenceRegistry.filter(isRecord).map(({ evidenceId }) => evidenceId)
    : []);
  let acceptance = {};
  if (result.scenarioId === "live-service-rpg-economy") acceptance = validateEconomy(result.domain, evidenceIds, errors);
  if (result.scenarioId === "mobile-onboarding-liveops") acceptance = validateMobile(result.domain, errors);
  if (result.scenarioId === "pc-console-ai-npc") acceptance = validateAiNpc(result.domain, errors);
  const visualizationEvidence = await validateVisualization(root, request, result, errors);
  const outputs = await validateOutput(root, request, result, scenario, errors);
  return {
    ok: errors.length === 0,
    scenarioId: request.scenarioId,
    routeIds: routing.routeIds,
    skillIds: routing.skillIds,
    profileIds: routing.profileIds,
    roleIds: routing.roleIds,
    validatedTemplateIds,
    acceptance,
    outputs,
    visualizationEvidence,
    fallback: { mode: "sequential", order: routing.roleIds, preservesRolesAndQuestions: true },
    errors,
  };
}

async function directInvocation() {
  if (!process.argv[1]) return false;
  try {
    return await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (await directInvocation()) {
  const root = process.argv[2];
  if (!root || process.argv.length !== 3) {
    process.stderr.write("Usage: node validate-studio-scenario.mjs <scenario-directory>\n");
    process.exitCode = 2;
  } else {
    const validation = await validateStudioScenario(root);
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    if (!validation.ok) process.exitCode = 1;
  }
}
