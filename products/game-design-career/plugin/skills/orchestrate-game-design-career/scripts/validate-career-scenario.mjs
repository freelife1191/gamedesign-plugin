#!/usr/bin/env node

import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { prepareCareerExport } from "../../export-career-documents/scripts/prepare-career-export.mjs";
import { validateJobEvidenceCollection } from "../../research-game-design-jobs/scripts/validate-job-evidence.mjs";
import { validateVisualizationState } from "../../visualize-career-roadmap/scripts/validate-visualization-state.mjs";

const pluginRoot = fileURLToPath(new URL("../../../", import.meta.url));
const routingPath = path.join(pluginRoot, "references/routing.json");
const presetsPath = path.join(pluginRoot, "references/visualization-presets.json");
const factInferenceSchemaPath = path.join(pluginRoot, "references/fact-inference-schema.json");
const jobEvidenceSchemaPath = path.join(pluginRoot, "references/job-evidence-schema.json");
const templateRoot = path.join(pluginRoot, "assets/templates");
const QUESTION_TYPES = ["base", "follow-up", "objection", "situational"];
const REVERSE_SURFACES = [
  "fact", "inference", "rules", "exceptions", "UI", "data", "economy", "operations", "alternatives", "validation",
];
let canonicalValidatorPromise;

function loadCanonicalValidator() {
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
        return module.validateArtifact;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Canonical validator is unavailable: ${lastError?.message ?? "unknown error"}`);
  })();
  return canonicalValidatorPromise;
}

function finding(code, message) {
  return { code, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function sameArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function requireTextFields(value, fields, code, errors) {
  if (!isRecord(value)) {
    errors.push(finding(code, "Expected a structured record."));
    return false;
  }
  const missing = fields.filter((field) => !isText(value[field]));
  if (missing.length > 0) {
    errors.push(finding(code, `Missing non-empty fields: ${missing.join(", ")}.`));
    return false;
  }
  return true;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function safeFixtureFile(root, relativeFile, label) {
  if (!isText(relativeFile) || path.isAbsolute(relativeFile)) throw new Error(`${label} must be a safe relative path`);
  const rootReal = await realpath(root);
  const candidate = await realpath(path.resolve(rootReal, relativeFile));
  if (!candidate.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must resolve inside the fixture`);
  return candidate;
}

async function validateRoutesAndTemplates(request, result, errors) {
  const validateArtifact = await loadCanonicalValidator();
  const routing = await readJson(routingPath);
  const scenario = routing.scenarioChains.find(({ id }) => id === request.scenarioId);
  if (!scenario) {
    errors.push(finding("route.scenario", `Unknown scenario: ${request.scenarioId}.`));
    return { routeIds: [], validatedTemplateIds: [] };
  }
  if (scenario.stage !== request.stage || result.stage !== request.stage) {
    errors.push(finding("route.stage", "Request, result, and scenario route stages must match."));
  }
  if (!sameArray(request.requestedFormats, scenario.artifactFormats)) {
    errors.push(finding("route.formats", "Requested formats must match the approved scenario chain."));
  }

  const routeIds = routing.scenarioRouteChains[request.scenarioId] ?? [];
  if (!sameArray(result.routeIds, routeIds)) {
    errors.push(finding("route.chain", "Result routeIds must exactly match the approved scenario route chain."));
  }
  const routes = routeIds.map((id) => routing.routes.find((route) => route.id === id));
  if (routes.some((route) => !route)) {
    errors.push(finding("route.missing", "Every scenario route ID must resolve to an actual route."));
    return { routeIds, validatedTemplateIds: [] };
  }
  const routedSkills = routes.map(({ skill }) => skill);
  const chainedSkills = scenario.skillChain.map((intent) => routing.routeSkills[intent]);
  if (!sameArray(routedSkills, chainedSkills)) {
    errors.push(finding("route.skill-chain", "Scenario intent chain must resolve to the same skills as its route IDs."));
  }
  for (const route of routes) {
    if (!Array.isArray(route.requiredEvidence) || route.requiredEvidence.length === 0
      || !Array.isArray(route.completionGates) || route.completionGates.length === 0) {
      errors.push(finding("route.gates", `${route.id} must retain required evidence and completion gates.`));
    }
  }

  const templateIds = [...new Set(routes.map(({ artifactType }) => artifactType))];
  if (!sameArray(result.artifactTemplateIds, templateIds)) {
    errors.push(finding("template.chain", "Result artifactTemplateIds must exactly follow routed artifact types."));
  }
  const validatedTemplateIds = [];
  for (const templateId of templateIds) {
    const validation = await validateArtifact(path.join(templateRoot, templateId));
    if (!validation.ok) {
      errors.push(finding(
        "template.invalid",
        `${templateId} failed canonical validation: ${validation.errors.map(({ message }) => message).join("; ")}`,
      ));
    } else {
      validatedTemplateIds.push(templateId);
    }
  }
  return { routeIds, validatedTemplateIds };
}

async function validateExport(root, request, result, errors) {
  if (!isRecord(result.export)) {
    errors.push(finding("output.export", "Scenario result requires an export job reference."));
    return {};
  }
  try {
    const jobPath = await safeFixtureFile(root, result.export.jobPath, "export.jobPath");
    const job = await readJson(jobPath);
    job.artifactRoot = root;
    const prepared = prepareCareerExport(job);
    const requestedDocumentFormats = request.requestedFormats
      .map((format) => format.toLowerCase())
      .filter((format) => format !== "svg");
    const actualRequested = Object.entries(prepared.formats)
      .filter(([, state]) => state.requested)
      .map(([format]) => format);
    if (!sameArray(actualRequested, requestedDocumentFormats)) {
      errors.push(finding("output.formats", "Export job requested formats must exactly match the scenario request."));
    }
    return Object.fromEntries(Object.entries(prepared.formats).map(([format, state]) => [format, state.status]));
  } catch (error) {
    errors.push(finding("output.export", error.message));
    return {};
  }
}

async function validateVisualization(root, request, result, errors) {
  if (!request.requestedFormats.includes("SVG")) return {};
  if (!isRecord(result.visualization) || !isText(result.visualization.presetId)) {
    errors.push(finding("output.visualization", "SVG scenarios require a visualization preset and state."));
    return {};
  }
  try {
    const presets = await readJson(presetsPath);
    if (!presets.some(({ id, renderer }) => id === result.visualization.presetId && renderer === "skills/svg-infographic")) {
      errors.push(finding("output.visualization-preset", "Visualization must use a packaged Skillstead preset."));
    }
    const statePath = await safeFixtureFile(root, result.visualization.statePath, "visualization.statePath");
    const state = await readJson(statePath);
    state.artifactRoot = root;
    const validated = validateVisualizationState(state);
    if (!validated.generated || !validated.linted || !validated.svgFile) {
      errors.push(finding("output.visualization-state", "Requested SVG must be generated and linted."));
    }
    return { svg: validated.verified ? "verified" : validated.linted ? "linted" : "pending" };
  } catch (error) {
    errors.push(finding("output.visualization", error.message));
    return {};
  }
}

function validateEntry(result, errors) {
  const roleCandidates = Array.isArray(result.roleCandidates) ? result.roleCandidates : [];
  const roleIds = new Set();
  for (const candidate of roleCandidates) {
    if (requireTextFields(candidate, ["roleFamily", "tradeoff", "proofArtifact"], "entry.role-candidate", errors)) {
      roleIds.add(candidate.roleFamily);
    }
    if (!Array.isArray(candidate?.currentEvidenceIds)) {
      errors.push(finding("entry.role-candidate-evidence", "Every role candidate needs currentEvidenceIds."));
    }
  }
  if (roleCandidates.length < 2 || roleIds.size !== roleCandidates.length) {
    errors.push(finding("entry.role-candidates", "Entry mapping requires at least two distinct role candidates."));
  }

  const evidenceGaps = Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [];
  const gapIds = new Set();
  for (const gap of evidenceGaps) {
    if (requireTextFields(gap, ["gapId", "learningTask", "proofArtifact"], "entry.evidence-gap", errors)) {
      gapIds.add(gap.gapId);
    }
  }
  if (evidenceGaps.length === 0 || gapIds.size !== evidenceGaps.length) {
    errors.push(finding("entry.evidence-gaps", "Entry mapping requires distinct evidence gaps."));
  }

  const weeks = Array.isArray(result.weeks) ? result.weeks : [];
  if (weeks.length !== 12) errors.push(finding("entry.week-count", "The entry roadmap must contain exactly 12 weeks."));
  weeks.forEach((week, index) => {
    if (week?.week !== index + 1 || !requireTextFields(week, ["learning", "practice", "feedback"], "entry.week", errors)) {
      errors.push(finding("entry.week-sequence", `Week ${index + 1} must be contiguous and complete.`));
    }
  });

  const briefReady = requireTextFields(
    result.firstPortfolioBrief,
    ["targetCompetency", "problemUser", "hypothesisIntent", "implementationTest", "resultDecision", "retrospective"],
    "entry.portfolio-brief",
    errors,
  ) && Array.isArray(result.firstPortfolioBrief.evidenceIds)
    && result.firstPortfolioBrief.evidenceIds.length > 0
    && result.firstPortfolioBrief.evidenceIds.every((id) => gapIds.has(id))
    && Array.isArray(result.firstPortfolioBrief.constraintsAlternatives)
    && result.firstPortfolioBrief.constraintsAlternatives.length > 0;
  if (!briefReady) errors.push(finding("entry.portfolio-brief", "First portfolio brief must link gaps, alternatives, implementation test, decision, and reflection."));
  if (!Array.isArray(result.unverifiedCurrentClaims) || result.unverifiedCurrentClaims.length !== 0) {
    errors.push(finding("entry.unverified-current-claims", "Entry roadmap cannot carry unverified current claims."));
  }
  return {
    roleCandidateCount: roleCandidates.length,
    evidenceGapCount: evidenceGaps.length,
    weekCount: weeks.length,
    firstPortfolioBriefReady: briefReady,
    visualizationPresetId: result.visualization?.presetId ?? null,
  };
}

function validateFactInferenceClaim(claim, schema, errors) {
  if (!isRecord(claim)) {
    errors.push(finding("reverse.claim", "Every reverse-design claim must be a record."));
    return;
  }
  const keys = Object.keys(claim);
  if (!sameArray(keys.sort(), [...schema.required].sort())) {
    errors.push(finding("reverse.claim-fields", `${claim.claimId ?? "claim"} must use the exact fact-inference fields.`));
  }
  if (!isText(claim.claimId) || !schema.properties.domain.enum.includes(claim.domain)) {
    errors.push(finding("reverse.claim-identity", "Each claim needs an ID and approved domain."));
  }
  if (!Array.isArray(claim.observation) || !Array.isArray(claim.counterexample) || !Array.isArray(claim.alternative)) {
    errors.push(finding("reverse.claim-arrays", `${claim.claimId ?? "claim"} has malformed evidence or alternatives.`));
    return;
  }
  for (const observation of claim.observation) {
    const required = schema.properties.observation.items.required;
    if (!isRecord(observation) || !sameArray(Object.keys(observation).sort(), [...required].sort())
      || required.some((field) => !isText(observation[field]))
      || !schema.properties.observation.items.properties.sourceType.enum.includes(observation.sourceType)) {
      errors.push(finding("reverse.observation", `${claim.claimId ?? "claim"} has a malformed observation.`));
    }
  }
  if (claim.observation.length === 0) {
    if (claim.inference !== null || claim.confidence !== "unassessed") {
      errors.push(finding("reverse.zero-evidence", `${claim.claimId} cannot infer intent without observation.`));
    }
  } else if (!isText(claim.inference) || !schema.properties.confidence.enum.includes(claim.confidence)
    || claim.counterexample.length === 0 || claim.alternative.length === 0 || !isText(claim.validationMethod)) {
    errors.push(finding("reverse.falsifiability", `${claim.claimId} must include inference confidence, counterexample, alternative, and validation.`));
  }
  if (claim.alternative.length === 0 || !isText(claim.validationMethod)) {
    errors.push(finding("reverse.alternative-validation", `${claim.claimId} requires an alternative and validation method.`));
  }
}

async function validateReverse(result, errors) {
  if (result.userManualRejected !== true) {
    errors.push(finding("reverse.user-manual", "Reverse design must reject user-manual mode."));
  }
  const schema = await readJson(factInferenceSchemaPath);
  const claims = Array.isArray(result.claims) ? result.claims : [];
  if (claims.length === 0) errors.push(finding("reverse.claims", "Reverse design requires claim records."));
  for (const claim of claims) validateFactInferenceClaim(claim, schema, errors);
  if (!isRecord(result.surfaces) || !sameArray(Object.keys(result.surfaces), REVERSE_SURFACES)) {
    errors.push(finding("reverse.surfaces", "Reverse design requires the exact approved surface set."));
  } else {
    for (const surface of REVERSE_SURFACES) {
      if (!Array.isArray(result.surfaces[surface]) || result.surfaces[surface].length === 0) {
        errors.push(finding("reverse.surface-empty", `${surface} requires at least one structured entry.`));
      }
    }
  }
  if (!Array.isArray(result.unverifiedCurrentClaims) || result.unverifiedCurrentClaims.length !== 0) {
    errors.push(finding("reverse.unverified-current-claims", "Reverse design cannot carry unverified current claims."));
  }
  return { reverseSurfaces: REVERSE_SURFACES, userManualRejected: result.userManualRejected === true };
}

async function validateTransition(root, result, errors) {
  let jobEvidence = [];
  try {
    const evidencePath = await safeFixtureFile(root, result.jobEvidencePath, "jobEvidencePath");
    jobEvidence = await readJson(evidencePath);
    const collectionValidation = validateJobEvidenceCollection(jobEvidence);
    if (!collectionValidation.valid) {
      errors.push(finding("transition.job-evidence-links", collectionValidation.errors.map(({ message }) => message).join("; ")));
    }
    const schema = await readJson(jobEvidenceSchemaPath);
    for (const record of jobEvidence) {
      if (!isRecord(record) || schema.required.some((field) => !Object.hasOwn(record, field))) {
        errors.push(finding("transition.job-evidence-fields", "Current job evidence must satisfy the complete production schema."));
        continue;
      }
      if (record.sourceType !== "official-company-career-page" || !/^https:\/\//u.test(record.sourceUrl)
        || !/^\d{4}-\d{2}-\d{2}$/u.test(record.postedDate)
        || !/^\d{4}-\d{2}-\d{2}$/u.test(record.retrievalDate)) {
        errors.push(finding("transition.primary-job-evidence", "Current job evidence requires official primary source URL and dates."));
      }
    }
  } catch (error) {
    errors.push(finding("transition.job-evidence", error.message));
  }
  const postingIds = new Set(jobEvidence.map(({ sourceId }) => sourceId));

  const projectImpact = Array.isArray(result.projectImpact) ? result.projectImpact : [];
  for (const impact of projectImpact) {
    requireTextFields(impact, ["impactId", "claim", "choice", "alternative", "result", "limitations"], "transition.project-impact", errors);
    if (!Array.isArray(impact?.evidenceIds) || impact.evidenceIds.length === 0) {
      errors.push(finding("transition.project-impact-evidence", "Project impact must link stable evidence IDs."));
    }
  }
  if (projectImpact.length === 0) errors.push(finding("transition.project-impact", "Transition needs at least one bounded project-impact record."));

  const evidenceGaps = Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [];
  for (const gap of evidenceGaps) requireTextFields(gap, ["gapId", "verificationTask"], "transition.evidence-gap", errors);
  if (evidenceGaps.length === 0) errors.push(finding("transition.evidence-gaps", "Transition must preserve evidence gaps as verification tasks."));

  const questions = Array.isArray(result.questions) ? result.questions : [];
  const questionTypes = questions.map(({ questionType }) => questionType);
  if (!sameArray(questionTypes, QUESTION_TYPES)) {
    errors.push(finding("transition.question-types", "Interview set must contain base, follow-up, objection, and situational in order."));
  }
  for (const question of questions) {
    requireTextFields(question, ["questionId", "questionType", "verificationStatus", "prompt"], "transition.question", errors);
    if (question.verificationStatus !== "grounded"
      || !Array.isArray(question.postingEvidenceIds) || question.postingEvidenceIds.length === 0
      || question.postingEvidenceIds.some((id) => !postingIds.has(id))
      || !Array.isArray(question.portfolioEvidenceIds) || question.portfolioEvidenceIds.length === 0) {
      errors.push(finding("transition.question-evidence", `${question.questionId ?? "question"} must be grounded in current posting and portfolio evidence.`));
    }
  }

  const feedback = Array.isArray(result.answerFeedback) ? result.answerFeedback : [];
  for (const item of feedback) requireTextFields(item, ["claim", "evidence", "choice", "alternative", "result", "reflection"], "transition.answer-feedback", errors);
  if (feedback.length === 0) errors.push(finding("transition.answer-feedback", "Transition requires answer feedback."));

  const quarterlyPlan = Array.isArray(result.quarterlyPlan) ? result.quarterlyPlan : [];
  for (const goal of quarterlyPlan) {
    requireTextFields(goal, ["goalId", "requirementId", "requirementStatus", "observableProject", "owner", "proofArtifact", "reEvaluationDecision"], "transition.quarterly-goal", errors);
    if (!["approved", "provisional"].includes(goal?.requirementStatus)
      || !requireTextFields(goal?.feedbackCadence, ["frequency", "reviewer", "inputArtifact", "nextReviewDate"], "transition.feedback-cadence", errors)) {
      errors.push(finding("transition.quarterly-goal-contract", `${goal?.goalId ?? "goal"} has an invalid requirement or feedback cadence.`));
    }
  }
  if (quarterlyPlan.length === 0) errors.push(finding("transition.quarterly-plan", "Transition requires observable quarterly goals."));
  const unverifiedCurrentClaims = Array.isArray(result.unverifiedCurrentClaims) ? result.unverifiedCurrentClaims : ["malformed"];
  if (unverifiedCurrentClaims.length !== 0) {
    errors.push(finding("transition.unverified-current-claims", "Unverified current claims must be zero."));
  }
  return {
    questionTypes,
    primaryJobEvidenceCount: jobEvidence.filter(({ sourceType }) => sourceType === "official-company-career-page").length,
    projectImpactCount: projectImpact.length,
    evidenceGapCount: evidenceGaps.length,
    answerFeedbackCount: feedback.length,
    quarterlyGoalCount: quarterlyPlan.length,
    unverifiedCurrentClaimCount: unverifiedCurrentClaims.length,
  };
}

export async function validateCareerScenario(fixtureDirectory, { resultOverride } = {}) {
  const errors = [];
  let root;
  let request;
  let result;
  try {
    root = await realpath(fixtureDirectory);
    request = await readJson(path.join(root, "request.json"));
    result = resultOverride ?? await readJson(path.join(root, "result.json"));
  } catch (error) {
    return { ok: false, errors: [finding("scenario.fixture", error.message)] };
  }
  if (!isRecord(request) || !isRecord(result) || request.schemaVersion !== 1 || result.schemaVersion !== 1) {
    errors.push(finding("scenario.schema", "Request and result must use schemaVersion 1 records."));
  }
  if (request.scenarioId !== result.scenarioId) {
    errors.push(finding("scenario.identity", "Request and result scenario IDs must match."));
  }

  let routes = { routeIds: [], validatedTemplateIds: [] };
  let acceptance = {};
  try {
    routes = await validateRoutesAndTemplates(request, result, errors);
    if (request.scenarioId === "entry-12-week-roadmap") acceptance = validateEntry(result, errors);
    else if (request.scenarioId === "reverse-design-portfolio") acceptance = await validateReverse(result, errors);
    else if (request.scenarioId === "junior-transition") acceptance = await validateTransition(root, result, errors);
    else errors.push(finding("scenario.acceptance", `No E2E acceptance contract for ${request.scenarioId}.`));
  } catch (error) {
    errors.push(finding("scenario.validation", error.message));
  }

  const outputs = {
    ...await validateExport(root, request, result, errors),
    ...await validateVisualization(root, request, result, errors),
  };
  return {
    ok: errors.length === 0,
    scenarioId: request.scenarioId,
    routeIds: routes.routeIds,
    validatedTemplateIds: routes.validatedTemplateIds,
    acceptance,
    outputs,
    errors,
  };
}

async function main() {
  const [fixtureDirectory] = process.argv.slice(2);
  if (!fixtureDirectory) {
    console.error("usage: node validate-career-scenario.mjs <fixture-directory>");
    process.exitCode = 2;
    return;
  }
  const result = await validateCareerScenario(fixtureDirectory);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  (result.ok ? process.stdout : process.stderr).write(output);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
