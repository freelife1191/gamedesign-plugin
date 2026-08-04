import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "missing YAML frontmatter");
  return match[1].split("\n").map((line) => line.split(/:\s+/u, 2)[0]);
}

function tableFirstColumn(markdown, heading) {
  const section = markdown.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "u"));
  assert.ok(section, `missing section: ${heading}`);
  return section[1]
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
}

function tableContract(markdown, heading, field) {
  const section = markdown.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "u"));
  assert.ok(section, `missing section: ${heading}`);
  const row = section[1]
    .split("\n")
    .find((line) => line.startsWith(`| \`${field}\` |`));
  assert.ok(row, `missing ${field} in ${heading}`);
  return row.split("|")[2].trim();
}

function inlineCodes(text) {
  return [...text.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function assertQuestionRecord(record) {
  const allowedStatuses = ["grounded", "role-general", "blocked"];
  assert.ok(allowedStatuses.includes(record.verificationStatus), "unknown verificationStatus");
  assert.ok(Array.isArray(record.postingEvidenceIds), "postingEvidenceIds must be an array");
  assert.ok(Array.isArray(record.portfolioEvidenceIds), "portfolioEvidenceIds must be an array");
  if (record.verificationStatus === "grounded") {
    assert.ok(record.postingEvidenceIds.length > 0, "grounded question needs posting evidence");
    assert.ok(record.portfolioEvidenceIds.length > 0, "grounded question needs portfolio evidence");
  }
  if (record.verificationStatus === "role-general") {
    assert.equal(record.postingEvidenceIds.length, 0, "role-general question cannot cite a posting");
  }
}

function assertFindingFixture(record) {
  const states = ["not-observed", "no-defect", "defect-observed"];
  const findingTypes = [
    "contradiction",
    "unsupported-certainty",
    "duplication",
    "unclear-scope",
    "missing-sources",
    "none",
  ];
  assert.ok(states.includes(record.observationState), "unknown observationState");
  assert.ok(findingTypes.includes(record.findingType), "unknown findingType");
  if (record.findingType === "none") {
    assert.equal(record.observationState, "no-defect", "none is valid only for no-defect");
  }
  if (record.observationState === "not-observed") {
    assert.deepEqual(record.evidenceIds, []);
    assert.equal(record.score, "not-scored");
  }
  if (record.score !== "not-scored") {
    assert.ok(record.sectionIds.length > 0, "numeric score needs section evidence");
    assert.ok(record.evidenceIds.length > 0, "numeric score needs evidence IDs");
  }
}

function assertQuarterlyGoalFixture(record) {
  const required = [
    "goalId",
    "requirementId",
    "requirementStatus",
    "observableProject",
    "owner",
    "feedbackCadence",
    "proofArtifact",
    "reEvaluationDecision",
  ];
  for (const field of required) assert.ok(record[field], `missing ${field}`);
  assert.ok(["approved", "provisional"].includes(record.requirementStatus));
  for (const field of ["frequency", "reviewer", "inputArtifact", "nextReviewDate"]) {
    assert.ok(record.feedbackCadence[field], `missing feedbackCadence.${field}`);
  }
}

function assertInterviewContract(method, skill) {
  assert.deepEqual(tableFirstColumn(method, "Question record"), [
    "questionId",
    "questionType",
    "postingEvidenceIds",
    "portfolioEvidenceIds",
    "prompt",
    "verificationStatus",
  ]);
  assert.deepEqual(tableFirstColumn(method, "Answer-feedback record"), [
    "claim",
    "evidence",
    "choice",
    "alternative",
    "result",
    "reflection",
  ]);
  assert.equal(
    tableContract(method, "Question record", "questionType"),
    "Exactly one of `base`, `follow-up`, `objection`, or `situational`.",
  );
  assert.match(
    tableContract(method, "Question record", "portfolioEvidenceIds"),
    /^Stable portfolio evidence IDs\b/u,
  );
  assert.doesNotMatch(
    tableContract(method, "Question record", "portfolioEvidenceIds"),
    /optional/iu,
  );
  assert.deepEqual(
    inlineCodes(tableContract(method, "Question record", "verificationStatus")),
    ["grounded", "role-general", "blocked"],
  );
  assert.match(
    tableContract(method, "Question record", "postingEvidenceIds"),
    /empty only for a labeled role-general question/iu,
  );
  assert.match(method, /postingEvidenceIds.*portfolioEvidenceIds/isu);
  assert.match(method, /When a posting is absent, every posting-specific claim is blocked\./u);
  assert.match(method, /verification task|honest-answer pattern/iu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/methods\/interview\.md`/u);
  assert.match(skill, /posting-specific claim.*blocked/isu);
}

function assertPortfolioReviewContract(method, skill) {
  assert.deepEqual(tableFirstColumn(method, "Five review axes"), [
    "problem-framing",
    "design-reasoning",
    "implementation-specificity",
    "evidence-quality",
    "communication-inspectability",
  ]);
  assert.deepEqual(tableFirstColumn(method, "Finding types"), [
    "contradiction",
    "unsupported-certainty",
    "duplication",
    "unclear-scope",
    "missing-sources",
  ]);
  assert.deepEqual(tableFirstColumn(method, "Observation state"), [
    "not-observed",
    "no-defect",
    "defect-observed",
  ]);
  assert.deepEqual(tableFirstColumn(method, "Finding record"), [
    "findingId",
    "axisId",
    "findingType",
    "observationState",
    "sectionIds",
    "evidenceIds",
    "score",
    "impact",
    "minimumRepair",
  ]);
  assert.match(
    tableContract(method, "Finding record", "findingType"),
    /`none` only for an evidence-backed no-defect record/iu,
  );
  assert.match(
    tableContract(method, "Finding record", "score"),
    /`not-scored` when support is insufficient/iu,
  );
  assert.match(method, /score.*only.*sectionIds.*evidenceIds/isu);
  assert.match(method, /not-observed.*must not.*no-defect/isu);
  assert.match(method, /Do not average `not-scored` as zero\./u);
  assert.match(method, /highest-impact.*minimumRepair/isu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/methods\/five-axis-review\.md`/u);
}

function assertGrowthContract(method, skill) {
  assert.deepEqual(tableFirstColumn(method, "Quarterly goal record"), [
    "goalId",
    "requirementId",
    "requirementStatus",
    "observableProject",
    "owner",
    "feedbackCadence",
    "proofArtifact",
    "reEvaluationDecision",
  ]);
  assert.deepEqual(tableFirstColumn(method, "Requirement status"), ["approved", "provisional"]);
  assert.match(
    tableContract(method, "Quarterly goal record", "owner"),
    /^Person responsible for execution and evidence capture\.$/u,
  );
  assert.doesNotMatch(tableContract(method, "Quarterly goal record", "owner"), /optional/iu);
  const cadence = tableContract(method, "Quarterly goal record", "feedbackCadence");
  for (const component of ["frequency", "reviewer", "input artifact", "next review date"]) {
    assert.match(cadence, new RegExp(`\\b${component}\\b`, "iu"));
  }
  assert.match(method, /approved target-role requirement/iu);
  assert.match(method, /no approved.*requirementId.*provisional/isu);
  assert.match(method, /project event.*evidence/isu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/methods\/junior-growth\.md`/u);
}

test("interview: stable posting and portfolio evidence IDs ground all four question types", async () => {
  const method = await read("references/methods/interview.md");
  const skill = await read("skills/practice-game-design-interview/SKILL.md");
  assertInterviewContract(method, skill);
});

test("interview: mutation guard rejects missing question, evidence, and absent-posting gates", async () => {
  const method = await read("references/methods/interview.md");
  const skill = await read("skills/practice-game-design-interview/SKILL.md");
  const mutations = [
    [method.replace("`situational`", "`general`"), skill],
    [method.replace("| `postingEvidenceIds` |", "| `postingSources` |"), skill],
    [method.replace("| `reflection` |", "| `summary` |"), skill],
    [
      method.replace(
        "When a posting is absent, every posting-specific claim is blocked.",
        "When a posting is absent, posting-specific claims may proceed.",
      ),
      skill,
    ],
  ];
  for (const [index, [mutatedMethod, mutatedSkill]] of mutations.entries()) {
    assert.throws(
      () => assertInterviewContract(mutatedMethod, mutatedSkill),
      undefined,
      `interview mutation ${index + 1} survived`,
    );
  }
});

test("interview: negative fixtures enforce exact verification transitions", () => {
  const grounded = {
    verificationStatus: "grounded",
    postingEvidenceIds: ["POST-1"],
    portfolioEvidenceIds: ["PORT-1"],
  };
  assert.doesNotThrow(() => assertQuestionRecord(grounded));
  assert.throws(() => assertQuestionRecord({ ...grounded, verificationStatus: "inferred" }));
  assert.throws(() => assertQuestionRecord({ ...grounded, postingEvidenceIds: [] }));
  assert.throws(() => assertQuestionRecord({ ...grounded, portfolioEvidenceIds: [] }));
  assert.throws(() => assertQuestionRecord({
    ...grounded,
    verificationStatus: "role-general",
  }));
});

test("portfolio review: exact axes, finding types, states, and evidence-scored records", async () => {
  const method = await read("references/methods/five-axis-review.md");
  const skill = await read("skills/review-game-design-portfolio/SKILL.md");
  assertPortfolioReviewContract(method, skill);
});

test("portfolio review: negative fixtures distinguish unknown observation from clean evidence", async () => {
  const method = await read("references/methods/five-axis-review.md");
  const notObserved = { observationState: "not-observed", evidenceIds: [] };
  const noDefect = { observationState: "no-defect", evidenceIds: ["E-017"] };

  assert.match(method, /`not-observed`.*evidenceIds.*empty/isu);
  assert.match(method, /`no-defect`.*evidenceIds.*non-empty/isu);
  assert.notDeepEqual(notObserved, noDefect);
});

test("portfolio review: negative fixtures enforce finding and score state transitions", () => {
  const noDefect = {
    observationState: "no-defect",
    findingType: "none",
    sectionIds: ["SEC-1"],
    evidenceIds: ["E-1"],
    score: 4,
  };
  assert.doesNotThrow(() => assertFindingFixture(noDefect));
  assert.throws(() => assertFindingFixture({ ...noDefect, observationState: "defect-observed" }));
  assert.throws(() => assertFindingFixture({
    ...noDefect,
    observationState: "not-observed",
    evidenceIds: [],
    score: 0,
  }));
  assert.throws(() => assertFindingFixture({ ...noDefect, sectionIds: [] }));
});

test("portfolio review: mutation guard rejects axis, finding, state, and score drift", async () => {
  const method = await read("references/methods/five-axis-review.md");
  const skill = await read("skills/review-game-design-portfolio/SKILL.md");
  const mutations = [
    method.replace("| `evidence-quality` |", "| `visual-polish` |"),
    method.replace("| `missing-sources` |", "| `minor-style` |"),
    method.replace("| `not-observed` |", "| `unknown` |"),
    method.replace("| `evidenceIds` |", "| `notes` |"),
  ];
  for (const mutatedMethod of mutations) {
    assert.throws(() => assertPortfolioReviewContract(mutatedMethod, skill));
  }
});

test("growth: every quarterly goal is requirement-bound or explicitly provisional", async () => {
  const method = await read("references/methods/junior-growth.md");
  const skill = await read("skills/plan-junior-growth/SKILL.md");
  assertGrowthContract(method, skill);
});

test("growth: mutation guard rejects unbound and unobservable quarterly goals", async () => {
  const method = await read("references/methods/junior-growth.md");
  const skill = await read("skills/plan-junior-growth/SKILL.md");
  const mutations = [
    method.replace("| `requirementId` |", "| `roleArea` |"),
    method.replace("| `requirementStatus` |", "| `status` |"),
    method.replace("| `proofArtifact` |", "| `progressNote` |"),
    method.replace("| `reEvaluationDecision` |", "| `retrospective` |"),
  ];
  for (const mutatedMethod of mutations) {
    assert.throws(() => assertGrowthContract(mutatedMethod, skill));
  }
});

test("growth: negative fixtures require owner and complete feedback cadence", () => {
  const goal = {
    goalId: "GOAL-1",
    requirementId: "REQ-1",
    requirementStatus: "approved",
    observableProject: "Inspect one systems handoff",
    owner: "candidate",
    feedbackCadence: {
      frequency: "weekly",
      reviewer: "mentor",
      inputArtifact: "HANDOFF-1",
      nextReviewDate: "2026-08-11",
    },
    proofArtifact: "PORT-12",
    reEvaluationDecision: "continue",
  };
  assert.doesNotThrow(() => assertQuarterlyGoalFixture(goal));
  assert.throws(() => assertQuarterlyGoalFixture({ ...goal, owner: "" }));
  for (const field of ["reviewer", "inputArtifact", "nextReviewDate"]) {
    const feedbackCadence = { ...goal.feedbackCadence };
    delete feedbackCadence[field];
    assert.throws(() => assertQuarterlyGoalFixture({ ...goal, feedbackCadence }));
  }
});

test("all development skills preserve trigger-only metadata and anti-fabrication", async () => {
  const skillNames = [
    "practice-game-design-interview",
    "review-game-design-portfolio",
    "plan-junior-growth",
  ];
  for (const name of skillNames) {
    const skill = await read(`skills/${name}/SKILL.md`);
    const openai = await read(`skills/${name}/agents/openai.yaml`);
    assert.deepEqual(frontmatter(skill), ["name", "description"]);
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\ndescription: Use when[^\\n]+\\n---\\n`, "u"));
    assert.match(openai, new RegExp(`default_prompt: "[^"]*\\$${name}[^"]*"`, "u"));
    assert.match(skill, /Do not invent.*team size.*revenue.*retention.*personal ownership.*implementation.*result/isu);
    assert.match(skill, /verification task|honest-answer pattern/iu);
    assert.doesNotMatch(`${skill}\n${openai}`, /TODO/iu);
  }
});

test("semantic mutation guard rejects weakened development contracts", async () => {
  const interviewMethod = await read("references/methods/interview.md");
  const interviewSkill = await read("skills/practice-game-design-interview/SKILL.md");
  const reviewMethod = await read("references/methods/five-axis-review.md");
  const reviewSkill = await read("skills/review-game-design-portfolio/SKILL.md");
  const growthMethod = await read("references/methods/junior-growth.md");
  const growthSkill = await read("skills/plan-junior-growth/SKILL.md");
  const mutations = [
    [
      "interview inferred verification status",
      () => assertInterviewContract(
        interviewMethod.replace(
          "`grounded`, `role-general`, or `blocked`",
          "`grounded`, `role-general`, `inferred`, or `blocked`",
        ),
        interviewSkill,
      ),
    ],
    [
      "interview optional portfolio evidence IDs",
      () => assertInterviewContract(
        interviewMethod.replace(
          "Stable portfolio evidence IDs the candidate may inspect and use.",
          "Optional portfolio evidence IDs the candidate may inspect and use.",
        ),
        interviewSkill,
      ),
    ],
    [
      "growth optional owner",
      () => assertGrowthContract(
        growthMethod.replace(
          "Person responsible for execution and evidence capture.",
          "Optional person responsible for execution and evidence capture.",
        ),
        growthSkill,
      ),
    ],
    [
      "growth cadence omits review structure",
      () => assertGrowthContract(
        growthMethod.replace(
          "Recurring review frequency, reviewer, input artifact, and next review date.",
          "Recurring review frequency.",
        ),
        growthSkill,
      ),
    ],
    [
      "portfolio none finding type widened",
      () => assertPortfolioReviewContract(
        reviewMethod.replace(
          "One approved finding type, or `none` only for an evidence-backed no-defect record.",
          "One approved finding type, or `none` for any record.",
        ),
        reviewSkill,
      ),
    ],
    [
      "portfolio not-scored averaged as zero",
      () => assertPortfolioReviewContract(
        reviewMethod.replace(
          "Do not average `not-scored` as zero.",
          "Average `not-scored` as zero.",
        ),
        reviewSkill,
      ),
    ],
  ];

  for (const [label, assertMutation] of mutations) {
    assert.throws(assertMutation, undefined, `${label} mutation survived`);
  }
});
