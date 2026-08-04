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
const RESULT_KEYS = {
  "entry-12-week-roadmap": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "routeIds", "artifactTemplateIds", "evidenceRegistry",
    "roleCandidates", "evidenceGaps", "weeks", "firstPortfolioBrief", "visualization", "export",
    "unverifiedCurrentClaims",
  ],
  "reverse-design-portfolio": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "routeIds", "artifactTemplateIds", "userManualRejected",
    "analysisScope", "claims", "surfaces", "export", "unverifiedCurrentClaims",
  ],
  "junior-transition": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "routeIds", "artifactTemplateIds", "jobEvidencePath",
    "portfolioEvidenceRegistry", "targetRequirements", "projectImpact", "evidenceGaps", "questions",
    "answerFeedback", "quarterlyPlan", "export", "unverifiedCurrentClaims",
  ],
};
const REQUEST_KEYS = {
  "entry-12-week-roadmap": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "availableHoursPerWeek", "constraints", "requestedFormats",
  ],
  "reverse-design-portfolio": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "gameEvidenceScope", "requestedFormats",
  ],
  "junior-transition": [
    "schemaVersion", "scenarioId", "stage", "asOfDate", "targetRole", "region", "requestedFormats",
  ],
};
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

function uniqueTextArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isText)
    && new Set(value).size === value.length;
}

function requireExactKeys(value, keys, code, errors, label) {
  if (!isRecord(value)) {
    errors.push(finding(code, `${label} must be a plain record.`));
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameArray(actual, expected)) {
    errors.push(finding(code, `${label} must use exact keys: ${expected.join(", ")}.`));
    return false;
  }
  return true;
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

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "object") return isRecord(value);
  if (type === "array") return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf())
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3]);
}

function validateSchemaValue(value, schema, location, errors, code = "job.schema") {
  if (schema.anyOf) {
    const matches = schema.anyOf.some((candidate) => {
      const candidateErrors = [];
      validateSchemaValue(value, candidate, location, candidateErrors, code);
      return candidateErrors.length === 0;
    });
    if (!matches) {
      errors.push(finding(code, `${location} must satisfy at least one allowed schema.`));
      return;
    }
  }
  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => matchesType(value, type))) {
      errors.push(finding(code, `${location} must have type ${allowedTypes.join(" or ")}.`));
      return;
    }
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) errors.push(finding(code, `${location} must equal its required constant.`));
  if (value === null) return;
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(finding(code, `${location} must be one of the approved enum values.`));
  }
  if (typeof value === "string") {
    const minimum = Math.max(schema.minLength ?? 0, 1);
    if (value.trim().length < minimum) errors.push(finding(code, `${location} must be non-empty.`));
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) {
      errors.push(finding(code, `${location} does not match its required pattern.`));
    }
    if (schema.format === "date" && !validCalendarDate(value)) {
      errors.push(finding(code, `${location} must be an actual ISO calendar date.`));
    }
    if (schema.format === "uri") {
      try {
        const url = new URL(value);
        if (!url.protocol) throw new Error("missing protocol");
      } catch {
        errors.push(finding(code, `${location} must be an absolute URI.`));
      }
    }
  }
  if (Number.isInteger(value) && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(finding(code, `${location} must be at least ${schema.minimum}.`));
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(finding(code, `${location} requires at least ${schema.minItems} items.`));
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(finding(code, `${location} allows at most ${schema.maxItems} items.`));
    }
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
      errors.push(finding(code, `${location} items must be unique.`));
    }
    if (schema.items) value.forEach((item, index) => validateSchemaValue(item, schema.items, `${location}[${index}]`, errors, code));
  }
  if (isRecord(value)) {
    const properties = schema.properties ?? {};
    for (const field of schema.required ?? []) {
      if (!Object.hasOwn(value, field)) errors.push(finding(code, `${location}.${field} is required.`));
    }
    if (schema.additionalProperties === false) {
      for (const field of Object.keys(value)) {
        if (!Object.hasOwn(properties, field)) errors.push(finding(code, `${location}.${field} is not allowed.`));
      }
    }
    for (const [field, child] of Object.entries(value)) {
      if (properties[field]) validateSchemaValue(child, properties[field], `${location}.${field}`, errors, code);
    }
  }
  for (const clause of schema.allOf ?? []) validateSchemaValue(value, clause, location, errors, code);
  if (schema.if) {
    const conditionErrors = [];
    validateSchemaValue(value, schema.if, location, conditionErrors, code);
    if (conditionErrors.length === 0 && schema.then) validateSchemaValue(value, schema.then, location, errors, code);
    if (conditionErrors.length > 0 && schema.else) validateSchemaValue(value, schema.else, location, errors, code);
  }
}

export async function validateJobEvidenceRecords(records, asOfDate) {
  const errors = [];
  if (!Array.isArray(records) || Object.getPrototypeOf(records) !== Array.prototype) {
    return { valid: false, errors: [finding("job.schema", "Job evidence must be a plain array.")] };
  }
  const schema = await readJson(jobEvidenceSchemaPath);
  records.forEach((record, index) => validateSchemaValue(record, schema, `$[${index}]`, errors));
  const collection = asOfDate === undefined
    ? validateJobEvidenceCollection(records)
    : validateJobEvidenceCollection(records, { asOfDate });
  errors.push(...collection.errors.map((error) => finding(`job.collection.${error.code}`, error.message)));
  return { valid: errors.length === 0, errors };
}

async function validateRoutesAndTemplates(request, result, errors) {
  const validateArtifact = await loadCanonicalValidator();
  const routing = await readJson(routingPath);
  const scenario = routing.scenarioChains.find(({ id }) => id === request.scenarioId);
  if (!scenario) {
    errors.push(finding("route.scenario", `Unknown scenario: ${request.scenarioId}.`));
    return { routeIds: [], validatedTemplateIds: [], asOfDate: undefined };
  }
  if (!validCalendarDate(scenario.asOfDate)
    || request.asOfDate !== scenario.asOfDate
    || result.asOfDate !== scenario.asOfDate) {
    errors.push(finding(
      "route.as-of-date",
      "Request and result asOfDate must exactly match the trusted scenario snapshot.",
    ));
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
    return { routeIds, validatedTemplateIds: [], asOfDate: scenario.asOfDate };
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
  return { routeIds, validatedTemplateIds, asOfDate: scenario.asOfDate };
}

async function validateExport(root, request, result, errors) {
  if (!isRecord(result.export)) {
    errors.push(finding("output.export", "Scenario result requires an export job reference."));
    return {};
  }
  try {
    const jobPath = await safeFixtureFile(root, result.export.jobPath, "export.jobPath");
    const job = await readJson(jobPath);
    if (!Array.isArray(result.artifactTemplateIds) || !result.artifactTemplateIds.includes(job.artifactId)) {
      throw new Error("Export artifactId must reference one routed canonical artifact template.");
    }
    job.artifactRoot = path.join(templateRoot, job.artifactId);
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
  const evidenceRegistry = Array.isArray(result.evidenceRegistry) ? result.evidenceRegistry : [];
  const evidenceIds = new Set();
  for (const evidence of evidenceRegistry) {
    if (requireExactKeys(
      evidence,
      ["evidenceId", "kind", "source", "limitations"],
      "entry.evidence-registry",
      errors,
      "Entry evidence record",
    ) && requireTextFields(
      evidence,
      ["evidenceId", "kind", "source", "limitations"],
      "entry.evidence-registry",
      errors,
    )) {
      if (evidenceIds.has(evidence.evidenceId)) errors.push(finding("entry.evidence-registry", `Duplicate evidenceId: ${evidence.evidenceId}.`));
      evidenceIds.add(evidence.evidenceId);
    }
  }
  if (evidenceRegistry.length === 0) errors.push(finding("entry.evidence-registry", "Entry requires a declared evidence registry."));

  const roleCandidates = Array.isArray(result.roleCandidates) ? result.roleCandidates : [];
  const roleIds = new Set();
  for (const candidate of roleCandidates) {
    const exact = requireExactKeys(
      candidate,
      ["roleFamily", "tradeoff", "currentEvidenceIds", "proofArtifact"],
      "entry.role-candidate-keys",
      errors,
      "Entry role candidate",
    );
    if (exact && requireTextFields(candidate, ["roleFamily", "tradeoff", "proofArtifact"], "entry.role-candidate", errors)) {
      roleIds.add(candidate.roleFamily);
    }
    if (!uniqueTextArray(candidate?.currentEvidenceIds)
      || candidate.currentEvidenceIds.some((id) => !evidenceIds.has(id))) {
      errors.push(finding("entry.role-candidate-evidence", "Every role candidate needs nonempty unique currentEvidenceIds from the declared registry."));
    }
  }
  if (roleCandidates.length < 2 || roleIds.size !== roleCandidates.length) {
    errors.push(finding("entry.role-candidates", "Entry mapping requires at least two distinct role candidates."));
  }

  const evidenceGaps = Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [];
  const gapIds = new Set();
  for (const gap of evidenceGaps) {
    const exact = requireExactKeys(
      gap,
      ["gapId", "learningTask", "proofArtifact"],
      "entry.evidence-gap",
      errors,
      "Entry evidence gap",
    );
    if (exact && requireTextFields(gap, ["gapId", "learningTask", "proofArtifact"], "entry.evidence-gap", errors)) {
      gapIds.add(gap.gapId);
    }
  }
  if (evidenceGaps.length === 0 || gapIds.size !== evidenceGaps.length) {
    errors.push(finding("entry.evidence-gaps", "Entry mapping requires distinct evidence gaps."));
  }

  const weeks = Array.isArray(result.weeks) ? result.weeks : [];
  if (weeks.length !== 12) errors.push(finding("entry.week-count", "The entry roadmap must contain exactly 12 weeks."));
  weeks.forEach((week, index) => {
    const exact = requireExactKeys(week, ["week", "learning", "practice", "feedback"], "entry.week", errors, "Roadmap week");
    if (!exact || week?.week !== index + 1 || !requireTextFields(week, ["learning", "practice", "feedback"], "entry.week", errors)) {
      errors.push(finding("entry.week-sequence", `Week ${index + 1} must be contiguous and complete.`));
    }
  });

  const briefReady = requireExactKeys(
    result.firstPortfolioBrief,
    ["targetCompetency", "problemUser", "evidenceIds", "hypothesisIntent", "constraintsAlternatives", "implementationTest", "resultDecision", "retrospective"],
    "entry.portfolio-brief",
    errors,
    "First portfolio brief",
  ) && requireTextFields(
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
  requireExactKeys(result.visualization, ["presetId", "statePath"], "entry.visualization", errors, "Entry visualization reference");
  requireExactKeys(result.export, ["jobPath"], "entry.export", errors, "Entry export reference");
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
  validateSchemaValue(claim, schema, `claims.${claim.claimId ?? "unknown"}`, errors, "reverse.claim-schema");
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

function validateReverseAnalysisScope(value, errors) {
  const outerKeys = [
    "game", "buildVersion", "platform", "region", "accountOrPlayerState", "observationDate",
    "sourceAccess", "limitations",
  ];
  const sourceKeys = [
    "sourceAddress", "sourceType", "scope", "buildVersion", "platform", "region",
    "accountOrPlayerState", "observationDate", "accessMethod", "limitations",
  ];
  const outerExact = requireExactKeys(value, outerKeys, "reverse.analysis-scope", errors, "Reverse analysis scope");
  const outerFields = outerExact && requireTextFields(
    value,
    ["game", "buildVersion", "platform", "region", "accountOrPlayerState", "observationDate", "limitations"],
    "reverse.analysis-scope",
    errors,
  );
  if (!outerFields) return new Map();
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(value.buildVersion)
    || !/^[A-Z]{2}(?:-[A-Z0-9]+)?$/u.test(value.region)
    || !validCalendarDate(value.observationDate)) {
    errors.push(finding("reverse.analysis-scope", "Build version, region, and observation date must use valid bounded values."));
  }
  if (!Array.isArray(value.sourceAccess) || Object.getPrototypeOf(value.sourceAccess) !== Array.prototype
    || value.sourceAccess.length === 0) {
    errors.push(finding("reverse.analysis-scope", "sourceAccess must be a nonempty plain array."));
    return new Map();
  }

  const byAddress = new Map();
  const generalization = /\b(?:all|any)\s+(?:versions?|builds?|regions?|platforms?)\b|cross-version/iu;
  for (const source of value.sourceAccess) {
    const exact = requireExactKeys(source, sourceKeys, "reverse.analysis-scope", errors, "Reverse source access record");
    const fields = exact && requireTextFields(source, sourceKeys, "reverse.analysis-scope", errors);
    if (!fields) continue;
    if (byAddress.has(source.sourceAddress)) {
      errors.push(finding("reverse.analysis-scope", `Duplicate sourceAddress: ${source.sourceAddress}.`));
    }
    if (!["observed-behavior", "cited-material"].includes(source.sourceType)
      || !validCalendarDate(source.observationDate)
      || generalization.test(source.scope)) {
      errors.push(finding("reverse.analysis-scope", `${source.sourceAddress} has an invalid source type, date, or generalized scope.`));
    }
    for (const field of ["buildVersion", "platform", "region", "accountOrPlayerState", "observationDate"]) {
      if (source[field] !== value[field]) {
        errors.push(finding("reverse.analysis-scope", `${source.sourceAddress} crosses the declared ${field} boundary.`));
      }
    }
    byAddress.set(source.sourceAddress, source);
  }
  return byAddress;
}

function validateReverseObservationScopes(claims, sourceByAddress, errors) {
  const usedAddresses = new Set();
  const generalization = /\b(?:all|any)\s+(?:versions?|builds?|regions?|platforms?)\b|cross-version/iu;
  for (const claim of claims) {
    for (const observation of Array.isArray(claim?.observation) ? claim.observation : []) {
      const source = sourceByAddress.get(observation?.sourceAddress);
      if (!source
        || source.sourceType !== observation.sourceType
        || source.scope !== observation.scope
        || generalization.test(observation.scope)) {
        errors.push(finding(
          "reverse.observation-scope",
          `${claim?.claimId ?? "claim"} observation must exactly match one declared source address, type, and bounded scope.`,
        ));
      } else {
        usedAddresses.add(observation.sourceAddress);
      }
    }
  }
  for (const address of sourceByAddress.keys()) {
    if (!usedAddresses.has(address)) errors.push(finding("reverse.observation-scope", `Declared source ${address} is not referenced by an observation.`));
  }
}

async function validateReverse(result, errors) {
  if (result.userManualRejected !== true) {
    errors.push(finding("reverse.user-manual", "Reverse design must reject user-manual mode."));
  }
  const sourceByAddress = validateReverseAnalysisScope(result.analysisScope, errors);
  const schema = await readJson(factInferenceSchemaPath);
  const claims = Array.isArray(result.claims) ? result.claims : [];
  if (claims.length === 0) errors.push(finding("reverse.claims", "Reverse design requires claim records."));
  const claimById = new Map();
  for (const claim of claims) {
    validateFactInferenceClaim(claim, schema, errors);
    if (isText(claim?.claimId)) {
      if (claimById.has(claim.claimId)) errors.push(finding("reverse.claim-id", `Duplicate claimId: ${claim.claimId}.`));
      else claimById.set(claim.claimId, claim);
    }
  }
  validateReverseObservationScopes(claims, sourceByAddress, errors);
  if (!isRecord(result.surfaces)
    || !sameArray(Object.keys(result.surfaces).sort(), [...REVERSE_SURFACES].sort())) {
    errors.push(finding("reverse.surfaces", "Reverse design requires the exact approved surface set."));
  } else {
    const surfaceAccepts = {
      fact: (claim) => claim.observation.length > 0,
      inference: (claim) => isText(claim.inference),
      rules: (claim) => claim.domain === "rules",
      exceptions: (claim) => claim.domain === "rules" && claim.counterexample.length > 0,
      UI: (claim) => claim.domain === "UI",
      data: (claim) => claim.domain === "data",
      economy: (claim) => ["data", "operations"].includes(claim.domain),
      operations: (claim) => claim.domain === "operations",
      alternatives: (claim) => claim.alternative.length > 0,
      validation: (claim) => isText(claim.validationMethod),
    };
    for (const surface of REVERSE_SURFACES) {
      const references = result.surfaces[surface];
      if (!uniqueTextArray(references)) {
        errors.push(finding("reverse.surface-empty", `${surface} requires at least one structured entry.`));
        continue;
      }
      for (const claimId of references) {
        const claim = claimById.get(claimId);
        if (!claim) {
          errors.push(finding("reverse.surface-reference", `${surface} references unknown claimId ${claimId}.`));
        } else if (!surfaceAccepts[surface](claim)) {
          errors.push(finding("reverse.surface-semantics", `${surface} cannot reference claimId ${claimId} with its current evidence/domain state.`));
        }
      }
    }
  }
  requireExactKeys(result.export, ["jobPath"], "reverse.export", errors, "Reverse export reference");
  if (!Array.isArray(result.unverifiedCurrentClaims) || result.unverifiedCurrentClaims.length !== 0) {
    errors.push(finding("reverse.unverified-current-claims", "Reverse design cannot carry unverified current claims."));
  }
  return { reverseSurfaces: REVERSE_SURFACES, userManualRejected: result.userManualRejected === true };
}

async function validateTransition(root, result, errors, asOfDate) {
  let jobEvidence = [];
  try {
    const evidencePath = await safeFixtureFile(root, result.jobEvidencePath, "jobEvidencePath");
    jobEvidence = await readJson(evidencePath);
    const validation = await validateJobEvidenceRecords(jobEvidence, asOfDate);
    if (!validation.valid) {
      errors.push(finding("transition.job-evidence-schema", validation.errors.map(({ message }) => message).join("; ")));
    }
    if (!Array.isArray(jobEvidence)) jobEvidence = [];
    for (const record of Array.isArray(jobEvidence) ? jobEvidence : []) {
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
  const postingById = new Map(jobEvidence.map((posting) => [posting.sourceId, posting]));

  const portfolioEvidence = Array.isArray(result.portfolioEvidenceRegistry) ? result.portfolioEvidenceRegistry : [];
  const portfolioEvidenceIds = new Set();
  for (const record of portfolioEvidence) {
    const exact = requireExactKeys(
      record,
      ["evidenceId", "source", "owner", "limitations"],
      "transition.portfolio-evidence",
      errors,
      "Portfolio evidence record",
    );
    if (exact && requireTextFields(record, ["evidenceId", "source", "owner", "limitations"], "transition.portfolio-evidence", errors)) {
      if (portfolioEvidenceIds.has(record.evidenceId)) errors.push(finding("transition.portfolio-evidence", `Duplicate portfolio evidenceId: ${record.evidenceId}.`));
      portfolioEvidenceIds.add(record.evidenceId);
    }
  }
  if (portfolioEvidence.length === 0) errors.push(finding("transition.portfolio-evidence", "Transition requires a declared portfolio evidence registry."));
  for (const posting of jobEvidence) {
    if (Array.isArray(posting?.applicantEvidence)
      && posting.applicantEvidence.some((id) => !portfolioEvidenceIds.has(id))) {
      errors.push(finding("transition.job-applicant-evidence", `${posting.sourceId} references undeclared applicant evidence.`));
    }
  }

  const targetRequirements = Array.isArray(result.targetRequirements) ? result.targetRequirements : [];
  const requirementById = new Map();
  for (const requirement of targetRequirements) {
    const exact = requireExactKeys(
      requirement,
      ["requirementId", "postingEvidenceId", "sourceField", "sourceIndex", "statement", "status"],
      "transition.target-requirement",
      errors,
      "Target requirement",
    );
    const fields = exact && requireTextFields(
      requirement,
      ["requirementId", "postingEvidenceId", "sourceField", "statement", "status"],
      "transition.target-requirement",
      errors,
    );
    if (fields) {
      const posting = postingById.get(requirement.postingEvidenceId);
      const allowedSourceFields = ["responsibilities", "requiredSkills", "preferredSkills"];
      const source = allowedSourceFields.includes(requirement.sourceField)
        ? posting?.[requirement.sourceField]
        : undefined;
      const sourceBound = Number.isInteger(requirement.sourceIndex)
        && requirement.sourceIndex >= 0
        && Array.isArray(source)
        && requirement.sourceIndex < source.length
        && source[requirement.sourceIndex] === requirement.statement;
      if (!sourceBound) {
        errors.push(finding(
          "transition.target-requirement-source",
          `${requirement.requirementId} statement must exactly reproduce its referenced posting field item.`,
        ));
      }
      if (requirementById.has(requirement.requirementId)
        || !postingIds.has(requirement.postingEvidenceId)
        || !["approved", "provisional"].includes(requirement.status)) {
        errors.push(finding("transition.target-requirement", `${requirement.requirementId} must be unique and bound to an actual posting with an approved status.`));
      } else if (sourceBound) {
        requirementById.set(requirement.requirementId, requirement);
      }
    }
  }
  if (targetRequirements.length === 0) errors.push(finding("transition.target-requirement", "Transition requires declared target requirements."));

  const projectImpact = Array.isArray(result.projectImpact) ? result.projectImpact : [];
  const impactIds = new Set();
  for (const impact of projectImpact) {
    const exact = requireExactKeys(
      impact,
      ["impactId", "claim", "evidenceIds", "choice", "alternative", "result", "limitations"],
      "transition.project-impact",
      errors,
      "Project impact",
    );
    if (exact && requireTextFields(impact, ["impactId", "claim", "choice", "alternative", "result", "limitations"], "transition.project-impact", errors)) {
      if (impactIds.has(impact.impactId)) errors.push(finding("transition.project-impact", `Duplicate impactId: ${impact.impactId}.`));
      impactIds.add(impact.impactId);
    }
    if (!uniqueTextArray(impact?.evidenceIds)
      || impact.evidenceIds.some((id) => !portfolioEvidenceIds.has(id))) {
      errors.push(finding("transition.project-impact-evidence", "Project impact must link unique IDs from the declared portfolio evidence registry."));
    }
  }
  if (projectImpact.length === 0) errors.push(finding("transition.project-impact", "Transition needs at least one bounded project-impact record."));

  const evidenceGaps = Array.isArray(result.evidenceGaps) ? result.evidenceGaps : [];
  const gapIds = new Set();
  for (const gap of evidenceGaps) {
    const exact = requireExactKeys(gap, ["gapId", "verificationTask"], "transition.evidence-gap", errors, "Transition evidence gap");
    if (exact && requireTextFields(gap, ["gapId", "verificationTask"], "transition.evidence-gap", errors)) {
      if (gapIds.has(gap.gapId)) errors.push(finding("transition.evidence-gap", `Duplicate gapId: ${gap.gapId}.`));
      gapIds.add(gap.gapId);
    }
  }
  if (evidenceGaps.length === 0) errors.push(finding("transition.evidence-gaps", "Transition must preserve evidence gaps as verification tasks."));

  const questions = Array.isArray(result.questions) ? result.questions : [];
  const questionTypes = questions.map(({ questionType }) => questionType);
  const questionIds = new Set();
  if (!sameArray(questionTypes, QUESTION_TYPES)) {
    errors.push(finding("transition.question-types", "Interview set must contain base, follow-up, objection, and situational in order."));
  }
  for (const question of questions) {
    const exact = requireExactKeys(
      question,
      ["questionId", "questionType", "postingEvidenceIds", "portfolioEvidenceIds", "verificationStatus", "prompt"],
      "transition.question",
      errors,
      "Interview question",
    );
    if (exact && requireTextFields(question, ["questionId", "questionType", "verificationStatus", "prompt"], "transition.question", errors)) {
      if (questionIds.has(question.questionId)) errors.push(finding("transition.question", `Duplicate questionId: ${question.questionId}.`));
      questionIds.add(question.questionId);
    }
    if (question.verificationStatus !== "grounded"
      || !uniqueTextArray(question.postingEvidenceIds)
      || question.postingEvidenceIds.some((id) => !postingIds.has(id))
      || !uniqueTextArray(question.portfolioEvidenceIds)
      || question.portfolioEvidenceIds.some((id) => !portfolioEvidenceIds.has(id))) {
      errors.push(finding("transition.question-evidence", `${question.questionId ?? "question"} must be grounded in current posting and portfolio evidence.`));
    }
  }

  const feedback = Array.isArray(result.answerFeedback) ? result.answerFeedback : [];
  for (const item of feedback) {
    requireExactKeys(item, ["claim", "evidence", "choice", "alternative", "result", "reflection"], "transition.answer-feedback", errors, "Answer feedback");
    requireTextFields(item, ["claim", "evidence", "choice", "alternative", "result", "reflection"], "transition.answer-feedback", errors);
  }
  if (feedback.length === 0) errors.push(finding("transition.answer-feedback", "Transition requires answer feedback."));

  const quarterlyPlan = Array.isArray(result.quarterlyPlan) ? result.quarterlyPlan : [];
  const goalIds = new Set();
  for (const goal of quarterlyPlan) {
    const exact = requireExactKeys(
      goal,
      ["goalId", "requirementId", "requirementStatus", "observableProject", "owner", "feedbackCadence", "proofArtifact", "reEvaluationDecision"],
      "transition.quarterly-goal",
      errors,
      "Quarterly goal",
    );
    const fields = exact && requireTextFields(goal, ["goalId", "requirementId", "requirementStatus", "observableProject", "owner", "proofArtifact", "reEvaluationDecision"], "transition.quarterly-goal", errors);
    const cadence = requireExactKeys(
      goal?.feedbackCadence,
      ["frequency", "reviewer", "inputArtifact", "nextReviewDate"],
      "transition.feedback-cadence",
      errors,
      "Quarterly feedback cadence",
    ) && requireTextFields(goal?.feedbackCadence, ["frequency", "reviewer", "inputArtifact", "nextReviewDate"], "transition.feedback-cadence", errors);
    const requirement = requirementById.get(goal?.requirementId);
    if (fields && goalIds.has(goal.goalId)) errors.push(finding("transition.quarterly-goal", `Duplicate goalId: ${goal.goalId}.`));
    if (fields) goalIds.add(goal.goalId);
    if (!requirement || requirement.status !== goal?.requirementStatus) {
      errors.push(finding("transition.quarterly-requirement", `${goal?.goalId ?? "goal"} must bind to a declared requirement and matching status.`));
    }
    if (!cadence) {
      errors.push(finding("transition.quarterly-goal-contract", `${goal?.goalId ?? "goal"} has an invalid requirement or feedback cadence.`));
    }
  }
  if (quarterlyPlan.length === 0) errors.push(finding("transition.quarterly-plan", "Transition requires observable quarterly goals."));
  const unverifiedCurrentClaims = Array.isArray(result.unverifiedCurrentClaims) ? result.unverifiedCurrentClaims : ["malformed"];
  if (unverifiedCurrentClaims.length !== 0) {
    errors.push(finding("transition.unverified-current-claims", "Unverified current claims must be zero."));
  }
  requireExactKeys(result.export, ["jobPath"], "transition.export", errors, "Transition export reference");
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
  const allowedResultKeys = RESULT_KEYS[request?.scenarioId];
  const allowedRequestKeys = REQUEST_KEYS[request?.scenarioId];
  if (allowedRequestKeys && isRecord(request)) {
    requireExactKeys(request, allowedRequestKeys, "scenario.request-keys", errors, `${request.scenarioId} request`);
  }
  if (allowedResultKeys && isRecord(result)) {
    requireExactKeys(result, allowedResultKeys, "scenario.result-keys", errors, `${request.scenarioId} result`);
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
    else if (request.scenarioId === "junior-transition") acceptance = await validateTransition(root, result, errors, routes.asOfDate);
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
    asOfDate: routes.asOfDate,
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
