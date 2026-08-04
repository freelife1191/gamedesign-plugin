import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CORE_FILES = [
  "design-intent-and-fun.md",
  "system-design.md",
  "content-design.md",
  "player-experience.md",
  "production-and-feedback.md",
  "career-and-portfolio.md",
  "evidence-and-freshness.md",
];
const CLAIM_TYPES = ["evergreen", "contextual", "time-sensitive"];
const BASIS_TYPES = ["source-fact", "synthesis", "current-external-claim"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value) {
  if (!nonEmpty(value) || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function parseClaims(markdown, relativePath, errors) {
  const claims = [];
  const blocks = markdown.matchAll(/```claim\s*\n([\s\S]*?)\n```/g);
  for (const [index, match] of [...blocks].entries()) {
    try {
      claims.push({ ...JSON.parse(match[1]), file: relativePath });
    } catch (error) {
      errors.push(`${relativePath}: claim block ${index + 1} is not valid JSON (${error.message})`);
    }
  }
  if (claims.length === 0) errors.push(`${relativePath}: no claim blocks found`);
  return claims;
}

export async function auditEvidence({ repoRoot }) {
  const errors = [];
  const coreDirectory = path.join(repoRoot, "shared/knowledge/core");
  const trendsPath = path.join(repoRoot, "shared/knowledge/trends/2026-current-practices.md");
  const registerPath = path.join(repoRoot, "shared/knowledge/trends/source-register.json");
  const indexPath = path.join(repoRoot, "shared/knowledge/reference-index.json");

  let index;
  let register;
  try {
    index = JSON.parse(await readFile(indexPath, "utf8"));
  } catch (error) {
    return { errors: [`reference index cannot be read: ${error.message}`], claims: [], counts: {} };
  }
  try {
    register = JSON.parse(await readFile(registerPath, "utf8"));
  } catch (error) {
    return { errors: [`source register cannot be read: ${error.message}`], claims: [], counts: {} };
  }

  const documents = [];
  for (const filename of CORE_FILES) {
    const relativePath = `shared/knowledge/core/${filename}`;
    try {
      documents.push([relativePath, await readFile(path.join(coreDirectory, filename), "utf8")]);
    } catch (error) {
      errors.push(`${relativePath}: cannot be read (${error.message})`);
    }
  }
  try {
    documents.push(["shared/knowledge/trends/2026-current-practices.md", await readFile(trendsPath, "utf8")]);
  } catch (error) {
    errors.push(`shared/knowledge/trends/2026-current-practices.md: cannot be read (${error.message})`);
  }

  return auditEvidenceData({ documents, index, register, initialErrors: errors });
}

export function auditEvidenceData({ documents, index, register, initialErrors = [] }) {
  const errors = [...initialErrors];
  const claims = documents.flatMap(([relativePath, markdown]) => parseClaims(markdown, relativePath, errors));
  const localIds = new Set(index.documents?.map(({ id }) => id) ?? []);
  const externalSources = Array.isArray(register.sources) ? register.sources : [];
  const externalIds = new Set(externalSources.map(({ id }) => id));
  const claimIds = new Set();

  if (register.retrievedAt !== "2026-08-04") errors.push("source register: retrievedAt must be 2026-08-04");
  if (externalIds.size !== externalSources.length) errors.push("source register: source IDs must be unique");

  for (const claim of claims) {
    const label = `${claim.file}: ${claim.id ?? "<missing-id>"}`;
    if (!nonEmpty(claim.id) || !/^(CORE|CUR)-[A-Z0-9-]+$/.test(claim.id)) errors.push(`${label}: invalid stable claim ID`);
    if (claimIds.has(claim.id)) errors.push(`${label}: duplicate claim ID`);
    claimIds.add(claim.id);
    if (!CLAIM_TYPES.includes(claim.type)) errors.push(`${label}: invalid claim type`);
    if (!BASIS_TYPES.includes(claim.basis)) errors.push(`${label}: invalid basis`);
    for (const field of ["guidance", "applicability"]) {
      if (!nonEmpty(claim[field])) errors.push(`${label}: ${field} is required`);
    }
    if (!Array.isArray(claim.counterexamples) || claim.counterexamples.length === 0 || claim.counterexamples.some((item) => !nonEmpty(item))) {
      errors.push(`${label}: counterexamples must be a non-empty string array`);
    }
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      errors.push(`${label}: sourceIds must be non-empty`);
    } else {
      for (const sourceId of claim.sourceIds) {
        if (!localIds.has(sourceId) && !externalIds.has(sourceId)) errors.push(`${label}: orphan source ID ${sourceId}`);
      }
    }
    if (claim.type === "contextual" && !nonEmpty(claim.limitations)) errors.push(`${label}: contextual claim requires limitations`);
    if (claim.type === "time-sensitive") {
      if (claim.basis !== "current-external-claim") errors.push(`${label}: time-sensitive claim must use current-external-claim basis`);
      if (!validDate(claim.verifiedAt)) errors.push(`${label}: verifiedAt must be a valid date`);
      if (!validDate(claim.reviewAfter)) errors.push(`${label}: reviewAfter must be a valid date`);
      if (validDate(claim.verifiedAt) && validDate(claim.reviewAfter) && claim.reviewAfter <= claim.verifiedAt) {
        errors.push(`${label}: reviewAfter must be later than verifiedAt`);
      }
      if (!nonEmpty(claim.regionScope)) errors.push(`${label}: time-sensitive claim requires regionScope`);
      if (!nonEmpty(claim.limitations)) errors.push(`${label}: time-sensitive claim requires limitations`);
      if (!Array.isArray(claim.primaryUrls) || claim.primaryUrls.length === 0 || claim.primaryUrls.some((url) => !/^https:\/\//.test(url))) {
        errors.push(`${label}: time-sensitive claim requires official HTTPS primaryUrls`);
      }
      if (!claim.sourceIds?.some((sourceId) => externalIds.has(sourceId))) errors.push(`${label}: time-sensitive claim requires an external registered source`);
    }

    const claimExternalIds = new Set(claim.sourceIds?.filter((sourceId) => externalIds.has(sourceId)) ?? []);
    const reverseExternalIds = new Set(externalSources.filter(({ claimIds }) => claimIds?.includes(claim.id)).map(({ id }) => id));
    if (!sameSet(claimExternalIds, reverseExternalIds)) {
      errors.push(`${label}: external source mappings differ`);
    }
    if (claimExternalIds.size > 0) {
      const registeredUrls = new Set(externalSources.filter(({ id }) => claimExternalIds.has(id)).map(({ url }) => url));
      const claimUrls = new Set(claim.primaryUrls ?? []);
      if (!sameSet(registeredUrls, claimUrls)) errors.push(`${label}: external source URLs differ`);
    }
  }

  for (const source of externalSources) {
    const label = `source register: ${source.id ?? "<missing-id>"}`;
    for (const field of ["id", "title", "publisher", "url", "retrievedAt", "regionScope", "limitations"]) {
      if (!nonEmpty(source[field])) errors.push(`${label}: ${field} is required`);
    }
    if (source.primary !== true) errors.push(`${label}: source must be marked primary`);
    if (!/^https:\/\//.test(source.url ?? "")) errors.push(`${label}: url must be HTTPS`);
    if (source.retrievedAt !== "2026-08-04") errors.push(`${label}: retrievedAt must be 2026-08-04`);
    if (source.publishedOrUpdatedAt !== null && !validDate(source.publishedOrUpdatedAt)) {
      errors.push(`${label}: publishedOrUpdatedAt must be a date or null`);
    }
    if (!Array.isArray(source.claimIds) || source.claimIds.length === 0) errors.push(`${label}: claimIds must be non-empty`);
    for (const claimId of source.claimIds ?? []) {
      const claim = claims.find(({ id }) => id === claimId);
      if (!claim || !claim.sourceIds?.includes(source.id)) errors.push(`${label}: orphan claim mapping ${claimId}`);
      if (claim && !claim.primaryUrls?.includes(source.url)) errors.push(`${label}: claim ${claimId} does not include the registered primary URL`);
    }
  }

  const counts = Object.fromEntries(CLAIM_TYPES.map((type) => [type, claims.filter((claim) => claim.type === type).length]));
  return { errors, claims, counts, localSourceCount: localIds.size, externalSourceCount: externalIds.size };
}

function printResult(result) {
  if (result.errors.length > 0) {
    console.error("Evidence audit: FAIL");
    for (const error of result.errors) console.error(`- ${error}`);
    return;
  }
  console.log("Evidence audit: PASS");
  console.log(`claims: ${result.claims.length}`);
  for (const type of CLAIM_TYPES) console.log(`${type}: ${result.counts[type]}`);
  console.log(`local sources: ${result.localSourceCount}`);
  console.log(`external sources: ${result.externalSourceCount}`);
  console.log("orphan source IDs: 0");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await auditEvidence({ repoRoot });
  printResult(result);
  if (process.argv.includes("--check") && result.errors.length > 0) process.exitCode = 1;
}
