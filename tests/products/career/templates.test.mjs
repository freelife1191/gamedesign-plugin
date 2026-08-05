import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { parseRestrictedYaml, validateArtifact } from "../../../shared/scripts/validate-artifact.mjs";
import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";
import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateRoot = path.join(repoRoot, "products/game-design-career/plugin/assets/templates");
const templateProfileMapPath = path.join(repoRoot, "products/game-design-career/plugin/references/document-quality/template-profile-map.json");
const rubricPath = path.join(repoRoot, "products/game-design-career/plugin/references/five-axis-rubric.json");
const temporaryDirs = [];

const templateIds = [
  "career-stage-goal",
  "game-design-role-map",
  "competency-matrix",
  "learning-roadmap",
  "job-posting-evidence",
  "portfolio-backlog",
  "portfolio-project-brief",
  "reverse-design-document",
  "creative-design-portfolio",
  "game-analysis-report",
  "five-axis-review",
  "interview-question-answer-log",
  "introduction-motivation",
  "junior-growth-review",
  "transition-readiness",
];

const expectedTemplateProfiles = {
  "career-stage-goal": "career-stage-role-map",
  "competency-matrix": "competency-matrix",
  "creative-design-portfolio": "portfolio-case-study",
  "five-axis-review": "portfolio-review-backlog",
  "game-analysis-report": "game-analysis-report",
  "game-design-role-map": "career-stage-role-map",
  "interview-question-answer-log": "interview-question-answer-report",
  "introduction-motivation": "recruiter-portfolio-presentation",
  "job-posting-evidence": "job-posting-evidence",
  "junior-growth-review": "junior-growth-review",
  "learning-roadmap": "learning-roadmap",
  "portfolio-backlog": "portfolio-review-backlog",
  "portfolio-project-brief": "portfolio-project-brief",
  "reverse-design-document": "reverse-design-document",
  "transition-readiness": "transition-readiness",
};

const requiredFiles = [
  "assets/README.md",
  "content.md",
  "decisions/README.md",
  "evidence.yml",
  "export-manifest.yml",
];

const typeContracts = {
  "career-stage-goal": ["stage", "target-role", "assumption", "owner", "approval", "change-history"],
  "game-design-role-map": ["role-family", "current-evidence", "target-level", "gap", "tradeoff", "proof-artifact"],
  "competency-matrix": ["requirement-id", "evidence-id", "not-observed", "minimum-repair", "re-evaluation"],
  "learning-roadmap": ["requirement-id", "learning-task", "owner", "cadence", "proof-artifact", "re-evaluation"],
  "job-posting-evidence": ["source-id", "posted-date", "retrieval-date", "region", "source-url", "source-type", "sample-geography", "freshness"],
  "portfolio-backlog": ["claim-id", "evidence-id", "attribution", "rights", "privacy", "inspectability", "minimum-repair"],
  "portfolio-project-brief": ["target-competency", "problem-user", "hypothesis-intent", "constraints-alternatives", "implementation-test", "result-decision", "retrospective", "rights"],
  "reverse-design-document": ["claim-id", "observation", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "creative-design-portfolio": ["claim-id", "evidence-id", "third-party-source", "attribution", "rights", "use-purpose", "privacy", "inspectability"],
  "game-analysis-report": ["observation", "inference", "source-address", "scope", "alternative", "validation-method"],
  "five-axis-review": ["section-id", "evidence-id", "not-observed", "no-defect", "defect-observed", "minimum-repair", "penalty"],
  "interview-question-answer-log": ["posting-evidence-id", "portfolio-evidence-id", "base-question", "follow-up", "objection", "situational", "honest-answer", "do-not-fabricate"],
  "introduction-motivation": ["claim-id", "evidence-id", "target-role", "motivation", "honest-boundary", "privacy"],
  "junior-growth-review": ["requirement-id", "project-event-evidence", "owner", "cadence", "reviewer", "next-review-date", "proof-artifact"],
  "transition-readiness": ["current-evidence", "target-requirement", "posting-evidence-id", "retrieval-date", "region", "gap", "alternative", "verification-task"],
};

const recordFields = {
  "career-stage-goal": ["stage", "target-role", "goal", "success-evidence", "owner", "approval-status", "review-date"],
  "game-design-role-map": ["role-family", "current-evidence", "target-level", "gap", "learning-task", "feedback-cadence", "proof-artifact", "tradeoff"],
  "competency-matrix": ["requirement-id", "evidence-id", "observation-state", "target-level", "gap", "minimum-repair", "owner", "re-evaluation-date"],
  "learning-roadmap": ["requirement-id", "learning-task", "owner", "cadence", "proof-artifact", "reviewer", "re-evaluation-date"],
  "job-posting-evidence": ["source-id", "company", "project", "region", "employment-type", "posted-date", "source-url", "retrieval-date", "source-type", "sample-geography", "freshness"],
  "portfolio-backlog": ["backlog-id", "claim-id", "evidence-id", "target-competency", "attribution", "rights", "privacy", "inspectability", "minimum-repair", "owner"],
  "portfolio-project-brief": ["target-competency", "problem-user", "evidence", "hypothesis-intent", "rules-ui-data-content", "constraints-alternatives", "implementation-test", "result-decision", "retrospective", "rights"],
  "reverse-design-document": ["claim-id", "observation", "source-address", "scope", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "creative-design-portfolio": ["claim-id", "evidence-id", "target-competency", "third-party-source", "attribution", "rights", "use-purpose", "privacy", "inspectability"],
  "game-analysis-report": ["claim-id", "observation", "source-address", "source-type", "scope", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "five-axis-review": ["finding-id", "axis-id", "section-id", "evidence-id", "observation-state", "score", "penalty", "minimum-repair"],
  "interview-question-answer-log": ["question-id", "question-type", "posting-evidence-id", "portfolio-evidence-id", "answer-status", "honest-answer", "verification-task"],
  "introduction-motivation": ["claim-id", "evidence-id", "target-role", "motivation", "honest-boundary", "privacy", "approval-status"],
  "junior-growth-review": ["requirement-id", "project-event-evidence", "goal", "owner", "cadence", "reviewer", "next-review-date", "proof-artifact"],
  "transition-readiness": ["target-requirement", "current-evidence", "posting-evidence-id", "retrieval-date", "region", "gap", "alternative", "verification-task"],
};

const approvedContentHashes = {
  "career-stage-goal": "8988c7f4668fb38f11a63f11106fb6e7a52274187413a43321b539bb3170fb07",
  "competency-matrix": "336df258170a0ae9e2398492439c995570fb23c6ddf73eb7a6067d819e1bf04a",
  "creative-design-portfolio": "609f12bad50bad55f1686e3a7b8827c8646124c07fe8c2c8d49b9eaf0ffd63b2",
  "five-axis-review": "873a22fadf561ecf807ccf5ee4b996ae8413d7191baf6afb4984e0d8c7c22c40",
  "game-analysis-report": "0f68cd1d83bc122886020faa89e8965613ae6e8e43c321f6fea77288855cc562",
  "game-design-role-map": "b51bb263324055b57cc8ce1c78bda815bcd4a5452ce50053d008c827168a989a",
  "interview-question-answer-log": "c709da4339c52c03ecff50335127e94884b94b2bb8db1d0c97b6ef8ca87075bc",
  "introduction-motivation": "dc714fc34cb47351ea4c7a70d4def91bea99b8b939a7138e82d0c075477bddcd",
  "job-posting-evidence": "d1549a9ed9254132c7676feea3bfe067917b1043da7a3bd6f03fc9510893a846",
  "junior-growth-review": "1cc111b43306ab86338964d6266a0da26b9084014e31c19e78cf3da03323ebe5",
  "learning-roadmap": "3244065e066a815ac7ae2ba73539b4dc7af460e9bb0976a5dcec7b46fb85f733",
  "portfolio-backlog": "82109b8d827a08847028e6e61ac5b522e850fd5ee6799629b53cb7417f32767d",
  "portfolio-project-brief": "7969531595b351c1557cb0bbd52fceffd48338b5dd153cf17ca74b6a3810b8e6",
  "reverse-design-document": "f491b1a9d1a8a0e24b4b6f2de4d8323f9cdd36e3684f0ccc825c7d36f0e1610c",
  "transition-readiness": "d3760dede563fbbdc330872ea0e8f3bb2bd887782c3c563c85aa77791757e4c5",
};

const semanticContracts = {
  "career-stage-goal": [
    ["Stage and Target Role", "stage-and-target-role", "stage: Record entry, new-hire, junior-growth, or transition. target-role: Name a role family and level only when evidence supports it."],
    ["Goal Contract", "goal-contract", "Define a bounded outcome, success evidence, time constraint, owner, and review date. Keep multiple paths when one correct career is not established."],
  ],
  "game-design-role-map": [
    ["Role Families and Tradeoffs", "role-families-and-tradeoffs", "For each role-family, record target-level, current-evidence, gap, tradeoff, learning task, feedback cadence, and proof-artifact."],
    ["Provisional Paths", "provisional-paths", "Keep at least two plausible paths when the target is unclear. Never rank by age, education, major, or employment gap."],
  ],
  "competency-matrix": [
    ["Requirement Matrix", "requirement-matrix", "Each requirement-id links to a stable evidence-id, observation state, scope, and reviewer. Use not-observed when evidence is unavailable."],
    ["Repair and Re-evaluation", "repair-and-re-evaluation", "Do not convert missing evidence into an ability score of zero. Record minimum-repair, owner, proof artifact, and re-evaluation date."],
  ],
  "learning-roadmap": [
    ["Roadmap Commitments", "roadmap-commitments", "For every requirement-id, record a learning-task, owner, cadence, proof-artifact, reviewer, and re-evaluation decision."],
    ["Sequence and Dependencies", "sequence-and-dependencies", "Mark durations as provisional until capacity evidence exists. Keep prerequisites, feedback points, and scope choices explicit."],
  ],
  "job-posting-evidence": [
    ["Posting Records", "posting-records", "Each record requires source-id, company, project if stated, region, employment type, posted-date, source-url, retrieval-date, source-type, responsibilities, required skills, and preferred skills."],
    ["Freshness and Sample Limits", "freshness-and-sample-limits", "Record freshness classification, sample size, sample-geography, blind spots, and non-generalizable requirements. A repeated signal requires multiple source IDs."],
  ],
  "portfolio-backlog": [
    ["Backlog Records", "backlog-records", "Each item links claim-id, evidence-id, target competency, provenance, personal or team attribution, rights, privacy, strength, status, and inspectability."],
    ["Minimum Repairs", "minimum-repairs", "Missing support receives a minimum-repair, recovery owner, action, proof artifact, and review gate before publication."],
  ],
  "portfolio-project-brief": [
    ["Decision Chain", "decision-chain", "Use the exact sequence target-competency → problem-user → evidence → hypothesis-intent → rules/UI/data/content → constraints-alternatives → implementation-test → result-decision → retrospective."],
    ["Publication Boundary", "publication-boundary", "Record personal/team attribution, third-party source, use purpose, rights, privacy, implementation status, and evidence limitations."],
  ],
  "reverse-design-document": [
    ["Claim Records", "claim-records", "Each claim-id independently records observation, source address, scope, inference, confidence, counterexample, alternative, and validation-method."],
    ["Fact and Inference Boundary", "fact-and-inference-boundary", "When no observation exists, inference is null and confidence is unassessed. Never present internal intent or implementation as fact."],
  ],
  "creative-design-portfolio": [
    ["Portfolio Story", "portfolio-story", "For every material claim-id, connect target competency, problem, decision rationale, alternative, implementation boundary, result, and reflection to an evidence-id."],
    ["Third-party and Publication Rights", "third-party-and-publication-rights", "Record third-party-source, attribution, rights, use-purpose, privacy, quotation boundary, personal/team scope, and inspectability before publication."],
  ],
  "game-analysis-report": [
    ["Analysis Claims", "analysis-claims", "For each stable claim, record observation, source-address, source type, scope, inference, confidence, counterexample, alternative, and validation-method."],
    ["Decision Use", "decision-use", "State what a designer may learn, what remains unknown, and which evidence would change the analysis. Avoid reconstructing undocumented internal intent as fact."],
  ],
  "five-axis-review": [
    ["Review Records", "review-records", "Every record carries finding ID, axis ID, stable section-id, stable evidence-id, observation state, score or not-scored, impact, and minimum-repair."],
    ["Observation and Penalty Rules", "observation-and-penalty-rules", "Keep not-observed, no-defect, and defect-observed distinct. Apply each penalty separately for contradiction, unsupported certainty, duplication, scope, or source."],
  ],
  "interview-question-answer-log": [
    ["Question Set", "question-set", "Trace every base-question, follow-up, objection, and situational question to a posting-evidence-id, portfolio-evidence-id, or explicit role-general source."],
    ["Honest Answer Boundary", "honest-answer-boundary", "Connect claim, evidence, choice, alternative, result, and reflection. do-not-fabricate team size, revenue, retention, ownership, or implementation results; use an honest-answer and verification task when support is missing."],
  ],
  "introduction-motivation": [
    ["Claim Map", "claim-map", "Every claim-id links a target-role requirement, evidence-id, personal/team scope, and source limitation. Separate motivation from verified experience."],
    ["Honest and Private Boundary", "honest-and-private-boundary", "Use an honest-boundary for missing evidence. Remove unnecessary personal data and record privacy and publication approval before sharing."],
  ],
  "junior-growth-review": [
    ["Quarterly Evidence", "quarterly-evidence", "Each requirement-id links project-event-evidence, personal/team attribution, decision, result status, limitation, and proof-artifact."],
    ["Growth Commitments", "growth-commitments", "For every goal record owner, cadence, reviewer, input artifact, next-review-date, target depth or breadth, and re-evaluation rule."],
  ],
  "transition-readiness": [
    ["Readiness Matrix", "readiness-matrix", "Link each target-requirement to current-evidence and posting-evidence-id. Record source URL, retrieval-date, region, source type, gap, scope, and freshness."],
    ["Decision Options", "decision-options", "Keep alternative paths, tradeoffs, minimum evidence, owner, verification-task, review date, and no-hiring-promise boundary explicit."],
  ],
};

const commonSemanticClauses = [
  "An assumption is not an approved fact.",
  "Automation cannot grant approval or rights.",
  "current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner.",
  "Third-party material also records source, attribution, use purpose, rights or quotation notes, and privacy disposition.",
  "Do not split Markdown mechanically by headings.",
];

function semanticSection(content, heading, id) {
  const marker = `## ${heading} {#${id}}\n\n`;
  const start = content.indexOf(marker);
  assert.notEqual(start, -1, `missing semantic section ${id}`);
  const bodyStart = start + marker.length;
  const next = content.indexOf("\n## ", bodyStart);
  return content.slice(bodyStart, next === -1 ? content.length : next).trim();
}

function assertSemanticContract(templateId, content) {
  assert.deepEqual(Object.keys(semanticContracts).sort(), [...templateIds].sort());
  for (const [heading, id, requiredMeaning] of semanticContracts[templateId]) {
    assert.equal(semanticSection(content, heading, id), requiredMeaning, `${templateId}: semantic contract ${id}`);
  }
  for (const clause of commonSemanticClauses) {
    assert.ok(content.includes(clause), `${templateId}: missing semantic clause ${clause}`);
  }
}

function parseContentFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "content must start with frontmatter");
  return parseRestrictedYaml(match[1], "content.md frontmatter");
}

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function filesBelow(root) {
  const result = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) result.push(relative);
    }
  }
  await walk(root);
  return result.sort();
}

async function temporaryTemplate(templateId) {
  const target = await mkdtemp(path.join(os.tmpdir(), `career-template-${templateId}-`));
  temporaryDirs.push(target);
  await cp(path.join(templateRoot, templateId), target, { recursive: true });
  return target;
}

async function replaceIn(root, relativePath, before, after) {
  const file = path.join(root, relativePath);
  const source = await readFile(file, "utf8");
  assert.ok(source.includes(before), `${relativePath} must contain ${JSON.stringify(before)}`);
  await writeFile(file, source.replace(before, after), "utf8");
}

function errorMessages(result) {
  return result.errors.map(({ message }) => message).join("\n");
}

function assertUsableTemplate(templateId, content, evidence, manifest, expectedContentHash) {
  assert.match(expectedContentHash, /^[a-f0-9]{64}$/u, `${templateId}: approved content hash`);
  assert.equal(
    createHash("sha256").update(content, "utf8").digest("hex"),
    expectedContentHash,
    `${templateId}: approved release seed bytes`,
  );
  const metadata = parseContentFrontmatter(content);
  assert.equal(metadata.artifact_id, templateId, `${templateId}: frontmatter identity`);
  assert.match(content, /^# .+ \{#[a-z0-9-]+\}$/mu);
  assert.match(content, /## Assumptions and Boundaries \{#assumptions-and-boundaries\}/u);
  assert.match(content, /## Owners and Approvals \{#owners-and-approvals\}/u);
  assert.match(content, /## Change History \{#change-history\}/u);
  assert.match(content, /## Evidence and Freshness \{#evidence-and-freshness\}/u);
  assert.doesNotMatch(content, /\b(?:TODO|TBD|lorem ipsum|fill this|placeholder)\b/iu);
  for (const token of typeContracts[templateId]) {
    assert.match(content, new RegExp(token, "iu"), `${templateId}: missing ${token}`);
  }
  const actualRecordFields = content
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
  assert.deepEqual(actualRecordFields, recordFields[templateId], `${templateId}: exact working-record fields`);
  assertSemanticContract(templateId, content);
  assert.equal(evidence.version, 1);
  assert.ok(Array.isArray(evidence.claims) && evidence.claims.length > 0);
  for (const claim of evidence.claims) {
    assert.match(claim.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(claim.source.locator || claim.source.url);
    assert.match(claim.source.accessed_at, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(["low", "medium", "high"].includes(claim.confidence));
    assert.ok(claim.limitations.trim());
  }
  assert.equal(evidence.claims[0].id, `claim-${templateId}`, `${templateId}: evidence identity`);
  assert.equal(evidence.claims[0].source.locator, "content.md", `${templateId}: evidence source identity`);
  assert.equal(manifest.artifact_id, templateId);
  assert.equal(metadata.artifact_id, manifest.artifact_id, `${templateId}: content/manifest identity`);
  assert.deepEqual(Object.keys(manifest.formats).sort(), ["docx", "md", "pdf", "pptx"]);
  assert.ok(manifest.formats.pptx.audience.trim());
  assert.ok(manifest.formats.pptx.purpose.trim());
  assert.ok(manifest.formats.pptx.slide_outline.length >= 3);
  assert.equal(new Set(manifest.formats.pptx.slide_outline.map(({ title }) => title)).size, manifest.formats.pptx.slide_outline.length);
}

test("exactly the 15 approved Career templates ship with complete canonical seed files", async () => {
  assert.deepEqual((await readdir(templateRoot)).sort(), [...templateIds].sort());
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    assert.deepEqual(await filesBelow(root), requiredFiles);
    for (const relativePath of requiredFiles) {
      assert.equal((await lstat(path.join(root, relativePath))).isFile(), true);
      assert.ok((await readFile(path.join(root, relativePath), "utf8")).trim(), `${templateId}/${relativePath} is empty`);
    }
    const decisions = await readFile(path.join(root, "decisions/README.md"), "utf8");
    for (const field of ["decision ID", "date", "owner", "status", "alternatives", "evidence IDs", "rationale", "approver", "reopen condition"]) {
      assert.match(decisions, new RegExp(field, "iu"), `${templateId}: decision register missing ${field}`);
    }
    const assets = await readFile(path.join(root, "assets/README.md"), "utf8");
    for (const field of ["relative local assets", "source", "creator", "attribution", "use purpose", "rights or consent", "privacy", "approver", "approval date", "alt text"]) {
      assert.match(assets, new RegExp(field, "iu"), `${templateId}: asset register missing ${field}`);
    }
  }
});

test("all 15 Career templates resolve to exactly one declared primary quality profile", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-template-profile-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
  const packagedTemplateRoot = path.join(build.outputDir, "assets/templates");
  const packagedCatalogRoot = path.join(build.outputDir, "references/shared/document-quality/profiles/career");
  const mappingSource = await readFile(templateProfileMapPath, "utf8").catch(() => null);
  assert.notEqual(mappingSource, null, "Career template profile mapping must exist");
  const packagedMappingSource = await readFile(path.join(build.outputDir, "references/document-quality/template-profile-map.json"), "utf8");
  assert.equal(packagedMappingSource, mappingSource, "clean build must preserve the mapping bytes");
  const mapping = JSON.parse(packagedMappingSource);
  assert.deepEqual(Object.keys(mapping).sort(), ["product", "schema_version", "templates"]);
  assert.equal(mapping.schema_version, 1);
  assert.equal(mapping.product, "game-design-career");
  assert.deepEqual(mapping.templates, expectedTemplateProfiles);
  assert.deepEqual(Object.keys(mapping.templates).sort(), (await readdir(packagedTemplateRoot)).sort());

  for (const [templateId, profileId] of Object.entries(mapping.templates)) {
    assert.equal(typeof profileId, "string", `${templateId}: primary profile must be one string`);
    const profile = JSON.parse(await readFile(path.join(packagedCatalogRoot, `${profileId}.json`), "utf8"));
    const profileValidation = validateQualityProfile(profile, { sourceName: `${profileId}.json` });
    assert.equal(profileValidation.ok, true, `${profileId}: ${JSON.stringify(profileValidation.errors)}`);
    assert.equal(profile.profile_id, profileId, `${templateId}: catalog resolution`);

    const content = await readFile(path.join(packagedTemplateRoot, templateId, "content.md"), "utf8");
    assert.equal(parseContentFrontmatter(content).quality_profile, profileId, `${templateId}: frontmatter mapping`);
    const result = await validateArtifact(path.join(packagedTemplateRoot, templateId), {
      requireQualityProfile: true,
      profileCatalogRoot: packagedCatalogRoot,
    });
    assert.equal(result.ok, true, `${templateId}: ${errorMessages(result)}`);
  }
});

test("approved content hash map exactly covers all source seeds and clean-built copies", async () => {
  assert.deepEqual(Object.keys(approvedContentHashes).sort(), [...templateIds].sort());
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-template-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({
    repoRoot,
    productName: "game-design-career",
    stagingRoot,
    sourceDateEpoch: 0,
  });
  for (const templateId of templateIds) {
    const relativePath = path.join("assets", "templates", templateId, "content.md");
    const sourceBytes = await readFile(path.join(templateRoot, templateId, "content.md"));
    const builtBytes = await readFile(path.join(build.outputDir, relativePath));
    assert.deepEqual(builtBytes, sourceBytes, `${templateId}: clean-built bytes`);
    assert.equal(
      createHash("sha256").update(sourceBytes).digest("hex"),
      approvedContentHashes[templateId],
      `${templateId}: source seed hash`,
    );
  }
});

test("every template instantiates as a real Canonical Artifact through the production validator", async () => {
  for (const templateId of templateIds) {
    const fixture = await temporaryTemplate(templateId);
    const result = await validateArtifact(fixture, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errorMessages(result)}`);
    assertUsableTemplate(
      templateId,
      await readFile(path.join(fixture, "content.md"), "utf8"),
      parseRestrictedYaml(await readFile(path.join(fixture, "evidence.yml"), "utf8")),
      parseRestrictedYaml(await readFile(path.join(fixture, "export-manifest.yml"), "utf8")),
      approvedContentHashes[templateId],
    );
  }
});

test("type-specific completion gates reject diluted or generic seeds", async () => {
  for (const templateId of templateIds) {
    const content = await readFile(path.join(templateRoot, templateId, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(templateRoot, templateId, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(templateRoot, templateId, "export-manifest.yml"), "utf8"));
    const token = typeContracts[templateId][0];
    assert.throws(
      () => assertUsableTemplate(templateId, content.replace(new RegExp(token, "giu"), "generic-field"), evidence, manifest, approvedContentHashes[templateId]),
      undefined,
      `${templateId}: type-specific mutation survived`,
    );
  }
});

test("semantic mutation guard rejects reversed safety and evidence meanings", async () => {
  async function assertMutationRejected(templateId, mutate) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = mutate(content);
    assert.notEqual(mutated, content, `${templateId}: mutation must alter the fixture`);
    assert.throws(() => assertUsableTemplate(templateId, mutated, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertMutationRejected("reverse-design-document", (content) => content.replace(
    "When no observation exists, inference is null and confidence is unassessed. Never present internal intent or implementation as fact.",
    "When no observation exists, inference may be estimated and confidence is high. Internal intent or implementation may be presented as fact.",
  ));
  await assertMutationRejected("interview-question-answer-log", (content) => content.replace(
    "do-not-fabricate team size, revenue, retention, ownership, or implementation results; use an honest-answer and verification task when support is missing.",
    "do-not-fabricate is optional; use an estimated honest-answer instead of a verification task when support is missing.",
  ));
  await assertMutationRejected("creative-design-portfolio", (content) => content.replace(
    "Record third-party-source, attribution, rights, use-purpose, privacy, quotation boundary, personal/team scope, and inspectability before publication.",
    "Record third-party-source, attribution, rights, use-purpose, privacy, quotation boundary, personal/team scope, and inspectability as assumed approved before publication.",
  ));
  await assertMutationRejected("job-posting-evidence", (content) => content.replace(
    "current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner.",
    "current claims may omit a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner.",
  ));
});

test("semantic consistency rejects contradictory permission added outside the required section", async () => {
  async function assertAddedContradictionRejected(templateId, contradiction) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = `${content}\n## Exception Policy {#exception-policy}\n\n${contradiction}\n`;
    assert.throws(() => assertUsableTemplate(templateId, mutated, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertAddedContradictionRejected(
    "reverse-design-document",
    "Internal intent and implementation may be presented as fact when confidence is high.",
  );
  await assertAddedContradictionRejected(
    "interview-question-answer-log",
    "Fabricated estimates for team size, revenue, retention, ownership, and implementation results are allowed when an answer is incomplete.",
  );
  await assertAddedContradictionRejected(
    "creative-design-portfolio",
    "Third-party rights and privacy may be assumed approved before publication.",
  );
  await assertAddedContradictionRejected(
    "job-posting-evidence",
    "Current job claims may use stale evidence and omit primary sources, retrieval dates, regions, and refresh owners.",
  );
});

test("semantic guard rejects split-prose and synonymous contradictory additions", async () => {
  async function assertAdditionRejected(templateId, addition) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    assert.throws(() => assertUsableTemplate(templateId, `${content}\n${addition}\n`, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertAdditionRejected(
    "reverse-design-document",
    "## Split Exception {#split-exception}\n\nInternal intent and implementation may be presented.\n\nAs fact when confidence is high.",
  );
  await assertAdditionRejected(
    "creative-design-portfolio",
    "## Clearance Exception {#clearance-exception}\n\nLicensing and confidentiality may be presumed cleared.",
  );
});

test("frontmatter identity cannot be spoofed by an expected artifact_id string in the body", async () => {
  const templateId = "career-stage-goal";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const spoofed = content
    .replace("artifact_id: career-stage-goal", "artifact_id: game-design-role-map")
    .concat("\nExpected identity note: artifact_id: career-stage-goal\n");
  assert.throws(() => assertUsableTemplate(templateId, spoofed, evidence, manifest, approvedContentHashes[templateId]));
});

test("generic token-only prose cannot satisfy a type-specific semantic contract", async () => {
  const templateId = "reverse-design-document";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const generic = content
    .replace(
      "Each claim-id independently records observation, source address, scope, inference, confidence, counterexample, alternative, and validation-method.",
      "claim-id observation source address scope inference confidence counterexample alternative validation-method.",
    )
    .replace(
      "When no observation exists, inference is null and confidence is unassessed. Never present internal intent or implementation as fact.",
      "observation inference confidence fact.",
    );
  assert.throws(() => assertUsableTemplate(templateId, generic, evidence, manifest, approvedContentHashes[templateId]));
});

test("five-axis rubric has exact axes, evidence-only levels, separate penalties, and minimum repairs", async () => {
  const rubric = JSON.parse(await readFile(rubricPath, "utf8"));
  assert.deepEqual(Object.keys(rubric).sort(), ["axes", "observationStates", "penalties", "schemaVersion"]);
  assert.equal(rubric.schemaVersion, 1);
  assert.deepEqual(rubric.axes.map(({ id }) => id), [
    "intent-problem",
    "player-experience-fun",
    "implementation-data-validation",
    "readability-navigation",
    "differentiation-decision-rationale-reflection",
  ]);
  for (const axis of rubric.axes) {
    assert.deepEqual(Object.keys(axis).sort(), ["id", "levels", "name"]);
    assert.deepEqual(axis.levels.map(({ score }) => score), [0, 1, 2, 3, 4]);
    for (const level of axis.levels) {
      assert.deepEqual(Object.keys(level).sort(), ["observableEvidence", "score"]);
      assert.ok(level.observableEvidence.trim());
      assert.doesNotMatch(level.observableEvidence, /talent|ability|potential|seems|likely/iu);
    }
  }
  assert.deepEqual(rubric.penalties.map(({ id }) => id), [
    "contradiction",
    "unsupported-certainty",
    "duplication",
    "scope",
    "source",
  ]);
  for (const penalty of rubric.penalties) {
    assert.deepEqual(Object.keys(penalty).sort(), ["id", "minimumRepair", "observableTrigger"]);
    assert.ok(penalty.observableTrigger.trim());
    assert.ok(penalty.minimumRepair.trim());
  }
  assert.deepEqual(rubric.observationStates, {
    "not-observed": "Condition was not inspectable; this is not no-defect and not an ability score of zero.",
    "no-defect": "The cited sections and evidence were inspected and no defect of the named type was found.",
    "defect-observed": "The cited sections and evidence directly support the named defect.",
  });
});

test("rubric contract rejects renamed axes, ability proxies, merged penalties, and unknown keys", async () => {
  const rubric = JSON.parse(await readFile(rubricPath, "utf8"));
  const validate = (candidate) => {
    assert.deepEqual(Object.keys(candidate).sort(), ["axes", "observationStates", "penalties", "schemaVersion"]);
    assert.deepEqual(candidate.axes.map(({ id }) => id), [
      "intent-problem",
      "player-experience-fun",
      "implementation-data-validation",
      "readability-navigation",
      "differentiation-decision-rationale-reflection",
    ]);
    assert.deepEqual(candidate.penalties.map(({ id }) => id), [
      "contradiction",
      "unsupported-certainty",
      "duplication",
      "scope",
      "source",
    ]);
    for (const axis of candidate.axes) {
      assert.deepEqual(axis.levels.map(({ score }) => score), [0, 1, 2, 3, 4]);
      for (const level of axis.levels) assert.doesNotMatch(level.observableEvidence, /talent|ability|potential|seems|likely/iu);
    }
  };
  validate(rubric);
  for (const mutation of [
    { ...rubric, extra: true },
    { ...rubric, axes: rubric.axes.map((axis, index) => index === 0 ? { ...axis, id: "career-fit" } : axis) },
    { ...rubric, axes: rubric.axes.map((axis, index) => index === 0 ? { ...axis, levels: axis.levels.map((level, levelIndex) => levelIndex === 0 ? { ...level, observableEvidence: "No talent was observed." } : level) } : axis) },
    { ...rubric, penalties: rubric.penalties.filter(({ id }) => id !== "source") },
    { ...rubric, penalties: rubric.penalties.map((penalty, index) => index === 0 ? { ...penalty, id: "contradiction-or-source" } : penalty) },
  ]) assert.throws(() => validate(mutation));
});

test("all Markdown links in template seeds resolve inside their artifact", async () => {
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    for (const relativePath of requiredFiles.filter((name) => name.endsWith(".md"))) {
      const markdown = await readFile(path.join(root, relativePath), "utf8");
      for (const match of markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)\)/gu)) {
        const destination = decodeURIComponent(match[1].split("#", 1)[0]);
        if (!destination) continue;
        assert.doesNotMatch(destination, /^(?:[a-z]+:|\/|\.\.\/)/iu, `${templateId}/${relativePath}: unsafe link`);
        const resolved = path.resolve(path.dirname(path.join(root, relativePath)), destination);
        assert.ok(resolved.startsWith(`${root}${path.sep}`), `${templateId}/${relativePath}: link escapes artifact`);
        assert.equal((await lstat(resolved)).isFile(), true, `${templateId}/${relativePath}: missing ${destination}`);
      }
    }
  }
});

test("production validation rejects dangerous YAML, traversal, missing assets, and symlink assets", async () => {
  const unsafeYaml = await temporaryTemplate("career-stage-goal");
  await replaceIn(unsafeYaml, "evidence.yml", "version: 1", "__proto__: poisoned\nversion: 1");
  let result = await validateArtifact(unsafeYaml);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /unsafe mapping key/i);

  for (const unsafePath of ["../outside.svg", "assets/../../outside.svg", "/tmp/outside.svg"]) {
    const traversal = await temporaryTemplate("game-design-role-map");
    await replaceIn(
      traversal,
      "content.md",
      "The first diagram may be added later after evidence is available.",
      `![Role map](${unsafePath})`,
    );
    result = await validateArtifact(traversal);
    assert.equal(result.ok, false, unsafePath);
    assert.match(errorMessages(result), /relative local asset|inside assets/i);
  }

  const missingAsset = await temporaryTemplate("competency-matrix");
  await replaceIn(
    missingAsset,
    "content.md",
    "The first diagram may be added later after evidence is available.",
    "![Competency map](assets/missing.svg)",
  );
  result = await validateArtifact(missingAsset);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /does not exist/i);

  const linkedAsset = await temporaryTemplate("learning-roadmap");
  const external = path.join(linkedAsset, "..", "outside.svg");
  await writeFile(external, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  await symlink(external, path.join(linkedAsset, "assets/linked.svg"));
  await replaceIn(
    linkedAsset,
    "content.md",
    "The first diagram may be added later after evidence is available.",
    "![Learning roadmap](assets/linked.svg)",
  );
  result = await validateArtifact(linkedAsset);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /does not exist/i);
});
