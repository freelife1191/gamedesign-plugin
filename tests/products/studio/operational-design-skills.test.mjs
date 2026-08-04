import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const gateRegistryPath = path.join(repoRoot, "shared/responsible-design/gates.json");
const relativeGateRegistry = "../../../../../shared/responsible-design/gates.json";
const currentPracticePath = "../../../../../shared/knowledge/trends/2026-current-practices.md";
const currentRegisterPath = "../../../../../shared/knowledge/trends/source-register.json";

const contracts = {
  "design-player-experience": {
    method: "player-experience.md",
    reviewers: ["ux-accessibility-reviewer", "lead-game-designer"],
    methodFields: [
      "information priority",
      "interaction and ui states",
      "first five minutes",
      "first success",
      "tutorial skip and revisit",
      "input",
      "performance",
      "cross-platform",
      "accessibility",
    ],
    methodMeaning: {
      "information priority": "Now, next, and on-demand information mapped to player decisions",
      "interaction and ui states": "Entry, focus, enabled, disabled, loading, success, error, recovery, and exit states",
      "first five minutes": "Observable sequence from launch through the first meaningful choice",
      "first success": "Action, feedback, reward, understanding check, and continuation",
      "tutorial skip and revisit": "Skip effect, safe defaults, contextual reminder, replay path, and persistence",
      input: "Critical actions, mappings, remapping, hold/toggle choice, alternatives, and conflicts",
      performance: "Measured latency, frame pacing, loading, readability impact, target status, and owner",
      "cross-platform": "Platform, screen, safe area, input, session, account, and entitlement differences",
      accessibility: "Modalities, alternatives, critical-task test results, limitations, and owner",
    },
    blockers: ["inaccessible-critical-action", "unverified-current-accessibility"],
    blockerMeaning: {
      "inaccessible-critical-action": "A critical path has no usable alternative modality, input, feedback, or recovery",
      "unverified-current-accessibility": "A current accessibility or platform threshold lacks fresh authoritative evidence and task testing",
    },
    outputFields: [
      "information priority",
      "interaction and ui states",
      "first five minutes",
      "first success",
      "tutorial skip and revisit",
      "input",
      "performance",
      "cross-platform",
      "accessibility",
      "assumptions",
      "evidence",
      "validation gates",
      "hard no-go conditions",
      "review findings",
      "owners",
    ],
  },
  "design-game-economy-and-liveops": {
    method: "economy-liveops.md",
    reviewers: ["system-economy-designer", "liveops-data-designer", "ux-accessibility-reviewer"],
    methodFields: [
      "sources",
      "sinks",
      "target inventory",
      "progression time",
      "inflation",
      "real price",
      "probability",
      "pity",
      "hypothesis",
      "control",
      "single variable",
      "sample",
      "duration",
      "success metrics",
      "guardrail metrics",
      "stop criteria",
      "rollback plan",
    ],
    methodMeaning: {
      sources: "Currency or item, amount, trigger, cadence, cohort, cap, provenance, and owner",
      sinks: "Cost, purpose, trigger, cadence, eligibility, refund behavior, and owner",
      "target inventory": "Cohort and timepoint target with observed baseline and acceptable range",
      "progression time": "Goal, player segment, measured path, variance, friction, and validation status",
      inflation: "Supply-demand indicators, concentration, velocity, thresholds, response, and owner",
      "real price": "Regional money conversion, tax/fee context, display, expiry, refund, and evidence",
      probability: "Exact odds, pool, eligibility, disclosure surface, version, and evidence",
      pity: "Counter scope, reset, carryover, guarantee, disclosure, and edge cases",
      hypothesis: "Causal statement, target population, expected change, and falsifier",
      control: "Eligibility, allocation, contamination protections, and baseline",
      "single variable": "Precisely isolated treatment and conflicting experiment check",
      sample: "Unit, power or precision basis, exclusions, and representativeness limits",
      duration: "Start, stop, seasonality, ramp, observation window, and rationale",
      "success metrics": "Primary outcome, baseline, direction, threshold status, and owner",
      "guardrail metrics": "Harm, spend, access, reliability, support, fairness, and privacy signals",
      "stop criteria": "Automatic and human stop triggers, monitoring cadence, and authority",
      "rollback plan": "Tested mechanism, recovery time, data repair, player remedy, and owner",
    },
    blockers: [
      "missing-real-price",
      "missing-probability",
      "missing-rollback",
      "unsafe-liveops-experiment",
      "missing-ai-ugc-rights-consent",
    ],
    blockerMeaning: {
      "missing-real-price": "Paid value or multi-step currency conversion lacks a verified real-money price and disclosure path",
      "missing-probability": "Randomized reward odds, pool, eligibility, or material consequences are unknown or undisclosed",
      "missing-rollback": "The changed configuration, state, data, or player remedy cannot be restored through a tested plan",
      "unsafe-liveops-experiment": "Hypothesis, control, isolated variable, guardrails, treatment boundary, stop authority, or owner is missing",
      "missing-ai-ugc-rights-consent": "AI or UGC lacks provenance, rights or consent, required human approval, moderation, or appeal evidence",
    },
    outputFields: [
      "sources",
      "sinks",
      "target inventory",
      "progression time",
      "inflation",
      "real price",
      "probability",
      "pity",
      "hypothesis",
      "control",
      "single variable",
      "sample",
      "duration",
      "success metrics",
      "guardrail metrics",
      "stop criteria",
      "rollback plan",
      "rights and consent",
      "assumptions",
      "evidence",
      "gates",
      "review findings",
      "owners",
    ],
  },
  "plan-game-production": {
    method: "production.md",
    reviewers: ["production-feasibility-critic", "lead-game-designer"],
    methodFields: [
      "core-loop contribution",
      "effort",
      "dependencies",
      "maintenance burden",
      "licensing risk",
      "outsource risk",
      "prototype hypothesis",
      "milestone",
      "owner",
      "definition of done",
      "kill criterion",
      "moscow scope",
    ],
    methodMeaning: {
      "core-loop contribution": "Scope item, player action, target-experience link, expected learning, and non-goal",
      effort: "Observable units, disciplines, throughput evidence, range, assumptions, confidence, and owner",
      dependencies: "Upstream, downstream, external, sequencing, availability, fallback, and owner",
      "maintenance burden": "Recurring operations, content, support, moderation, data, platform, and deprecation cost",
      "licensing risk": "Asset, technology, data, territory, term, restriction, renewal, evidence, and approver",
      "outsource risk": "Deliverable, vendor dependency, acceptance, security, rights, rework, handoff, and contingency",
      "prototype hypothesis": "Riskiest falsifiable belief, cheapest valid prototype, observation, and decision rule",
      milestone: "Intended maturity, evidence gate, entry criteria, exit criteria, date status, and dependencies",
      owner: "Accountable role, decision authority, review cadence, escalation, and backup",
      "definition of done": "Observable behavior, quality evidence, integration, documentation, and accepted limitations",
      "kill criterion": "Failure signal, observation window, decision owner, stop action, salvage, and communication",
      "moscow scope": "Must, Should, Could, Won't item with rationale, dependency, evidence, and approver",
    },
    blockers: ["missing-target-experience", "missing-prototype-evidence", "unsupported-large-estimate"],
    blockerMeaning: {
      "missing-target-experience": "A large commitment has no stated, approved, and traceable target experience",
      "missing-prototype-evidence": "The riskiest player or technology hypothesis has no fit-for-purpose prototype result and decision record",
      "unsupported-large-estimate": "Staffing, schedule, procurement, outsource, licensing, platform, or release commitment relies on invented or unvalidated estimates",
    },
    outputFields: [
      "core-loop contribution",
      "effort",
      "dependencies",
      "maintenance burden",
      "licensing risk",
      "outsource risk",
      "prototype hypothesis",
      "milestone",
      "owner",
      "definition of done",
      "kill criterion",
      "moscow scope",
      "assumptions",
      "evidence",
      "validation gates",
      "review findings",
      "decisions",
      "blockers",
    ],
  },
};

async function readSkill(skillId, relativePath = "SKILL.md") {
  return readFile(path.join(pluginRoot, "skills", skillId, relativePath), "utf8");
}

async function readMethod(filename) {
  return readFile(path.join(pluginRoot, "references/methods", filename), "utf8");
}

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: section missing`);
  const remainder = markdown.slice(start + marker.length);
  const end = remainder.indexOf("\n## ");
  return end === -1 ? remainder : remainder.slice(0, end);
}

function parseTwoColumnTable(markdownTable, headers, label) {
  const rows = markdownTable
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  assert.ok(rows.length >= 3, `${label}: table rows`);
  assert.deepEqual(rows[0], headers, `${label}: headers`);
  assert.ok(rows[1].every((cell) => /^:?-{3,}:?$/u.test(cell)), `${label}: separators`);
  assert.ok(rows.slice(2).every((row) => row.length === 2 && row[0] && row[1]), `${label}: two populated columns`);
  return new Map(rows.slice(2).map(([key, meaning]) => [
    key.toLocaleLowerCase("en-US"),
    meaning.toLocaleLowerCase("en-US"),
  ]));
}

function normalizeMeaning(value) {
  return value
    .normalize("NFC")
    .replace(/`+/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function assertSemanticContract(actual, expected, label) {
  const normalizedActual = Object.fromEntries(
    [...actual].map(([key, meaning]) => [key, normalizeMeaning(meaning)]),
  );
  const normalizedExpected = Object.fromEntries(
    Object.entries(expected).map(([key, meaning]) => [key, normalizeMeaning(meaning)]),
  );
  assert.deepEqual(normalizedActual, normalizedExpected, `${label}: exact canonical meanings`);
}

function parseStableFields(outputContract, label) {
  const match = outputContract.match(/\bwith stable sections for ([^.]+)\./iu);
  assert.ok(match, `${label}: stable field declaration`);
  return match[1]
    .replace(/, and /iu, ", ")
    .split(",")
    .map((field) => field.trim().toLocaleLowerCase("en-US"));
}

function extractLifecycleValues(gatePolicy, label) {
  const sentence = gatePolicy.match(/Advance lifecycle only through[^.]+\./iu)?.[0];
  assert.ok(sentence, `${label}: lifecycle sentence`);
  return [...sentence.matchAll(/`([^`]+)`/gu)].map(([, value]) => value);
}

test("operational skills use minimal trigger-only metadata and generated interfaces", async () => {
  for (const skillId of Object.keys(contracts)) {
    const [skill, openai] = await Promise.all([readSkill(skillId), readSkill(skillId, "agents/openai.yaml")]);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];

    assert.ok(frontmatter, `${skillId}: frontmatter`);
    assert.deepEqual(frontmatter.split("\n").map((line) => line.split(":", 1)[0]), ["name", "description"]);
    assert.match(frontmatter, new RegExp(`^name: ${skillId}$`, "mu"));
    assert.match(frontmatter, /^description: Use when /mu);
    assert.doesNotMatch(frontmatter, /workflow|step|produce|output|review/iu);
    assert.match(openai, /display_name: "[^"]+"/u);
    assert.match(openai, /short_description: "[^"]{25,64}"/u);
    assert.match(openai, new RegExp(`default_prompt: "Use \\$${skillId} `, "u"));
  }
});

test("every operational skill owns its workflow, output, review, and gate contract", async () => {
  for (const [skillId, contract] of Object.entries(contracts)) {
    const skill = await readSkill(skillId);
    for (const heading of [
      "Triggers",
      "Non-triggers",
      "Required input",
      "Assumption policy",
      "Workflow",
      "Output contract",
      "Responsible-design gates",
      "Role reviewers",
      "Completion checks",
    ]) section(skill, heading);

    assert.match(section(skill, "Workflow"), new RegExp(`\.\./\.\./references/methods/${contract.method.replaceAll(".", "\\.")}`, "u"));
    assert.deepEqual(
      parseStableFields(section(skill, "Output contract"), `${skillId}: output contract`),
      contract.outputFields,
    );
    for (const reviewer of contract.reviewers) assert.match(section(skill, "Role reviewers"), new RegExp(`\\b${reviewer}\\b`, "u"));
    for (const blocker of contract.blockers) assert.match(section(skill, "Completion checks"), new RegExp(`\\b${blocker}\\b`, "u"));
  }
});

test("method schemas preserve the exact operational design fields", async () => {
  for (const [skillId, contract] of Object.entries(contracts)) {
    const method = await readMethod(contract.method);
    const fields = parseTwoColumnTable(
      section(method, "Output schema"),
      ["Field", "Required content"],
      `${skillId}: schema`,
    );
    const blockers = parseTwoColumnTable(
      section(method, "Hard No-Go conditions"),
      ["Blocker ID", "Blocking condition"],
      `${skillId}: blockers`,
    );
    assert.deepEqual([...fields.keys()], contract.methodFields);
    assert.deepEqual([...blockers.keys()], contract.blockers);
    assertSemanticContract(fields, contract.methodMeaning, `${skillId}: schema meaning`);
    assertSemanticContract(blockers, contract.blockerMeaning, `${skillId}: blocker meaning`);

    const presentationOnly = (rows) => new Map([...rows].map(([key, meaning]) => [
      key,
      `  \`${meaning.toLocaleUpperCase("en-US").replaceAll(", ", ",   ")}\`  `,
    ]));
    assertSemanticContract(presentationOnly(fields), contract.methodMeaning, `${skillId}: formatted schema meaning`);
    assertSemanticContract(presentationOnly(blockers), contract.blockerMeaning, `${skillId}: formatted blocker meaning`);
  }
});

test("contract parsers detect row, meaning, output-field, and lifecycle mutations", async () => {
  const registry = JSON.parse(await readFile(gateRegistryPath, "utf8"));

  for (const [skillId, contract] of Object.entries(contracts)) {
    const method = await readMethod(contract.method);
    for (const field of contract.methodFields) {
      const mutated = method
        .split("\n")
        .filter((line) => !line.toLocaleLowerCase("en-US").startsWith(`| ${field} |`))
        .join("\n");
      assert.notDeepEqual(
        [...parseTwoColumnTable(
          section(mutated, "Output schema"),
          ["Field", "Required content"],
          `${skillId}: deleted ${field}`,
        ).keys()],
        contract.methodFields,
      );
    }
    for (const blocker of contract.blockers) {
      const mutated = method
        .split("\n")
        .filter((line) => !line.toLocaleLowerCase("en-US").startsWith(`| ${blocker} |`))
        .join("\n");
      assert.notDeepEqual(
        [...parseTwoColumnTable(
          section(mutated, "Hard No-Go conditions"),
          ["Blocker ID", "Blocking condition"],
          `${skillId}: deleted ${blocker}`,
        ).keys()],
        contract.blockers,
      );
    }

    for (const [heading, expectedMeaning, headers] of [
      ["Output schema", contract.methodMeaning, ["Field", "Required content"]],
      ["Hard No-Go conditions", contract.blockerMeaning, ["Blocker ID", "Blocking condition"]],
    ]) {
      const weakened = section(method, heading)
        .split("\n")
        .map((line) => /^\| (?!Field \||Blocker ID \||--- \|)[^|]+ \|/u.test(line)
          ? line.replace(/^(\| [^|]+ \|) [^\n]* \|$/u, "$1 weakened |")
          : line)
        .join("\n");
      const parsed = parseTwoColumnTable(weakened, headers, `${skillId}: weakened ${heading}`);
      assert.throws(() => assertSemanticContract(parsed, expectedMeaning, `${skillId}: weakened ${heading}`));
    }

    const skill = await readSkill(skillId);
    const output = section(skill, "Output contract");
    assert.throws(() => parseStableFields("\n", `${skillId}: empty output`), /stable field declaration/u);
    for (const field of contract.outputFields) {
      const withoutField = output.replace(new RegExp(`(?:, and |, )?${field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "iu"), "");
      assert.notDeepEqual(
        parseStableFields(withoutField, `${skillId}: deleted output ${field}`),
        contract.outputFields,
      );
    }

    const expandedLifecycle = method.replace("`blocked`, or `approved`.", "`blocked`, `approved`, or `waived`.");
    assert.notDeepEqual(
      extractLifecycleValues(section(expandedLifecycle, "Responsible-design gates"), `${skillId}: added waived`),
      registry.allowed_states,
    );
  }
});

test("unsupported quantitative claims stay provisional until five-part evidence exists", async () => {
  for (const { method } of Object.values(contracts)) {
    const policy = section(await readMethod(method), "Estimate and claim policy");
    for (const field of ["source", "assumption", "confidence", "owner", "validation gate"]) {
      assert.match(policy, new RegExp(`\\b${field}\\b`, "iu"), `${method}: ${field}`);
    }
    assert.match(policy, /(?:unsupported|missing)[^\n]*(?:provisional|blocked|no-go)/iu, method);
    assert.match(policy, /invented[^\n]*(?:approved|committed)[^\n]*(?:forbidden|not allowed|must not)/iu, method);
  }
});

test("time-sensitive claims route through the shared Current layer and evidence record", async () => {
  const expectedTopics = ["platform policy", "monetization", "regulation", "ai rights", "accessibility"];
  for (const { method } of Object.values(contracts)) {
    const current = section(await readMethod(method), "Current evidence routing");
    assert.match(current, new RegExp(currentPracticePath.replaceAll(".", "\\."), "u"), `${method}: current practices`);
    assert.match(current, new RegExp(currentRegisterPath.replaceAll(".", "\\."), "u"), `${method}: source register`);
    for (const topic of expectedTopics) assert.match(current, new RegExp(`\\b${topic}\\b`, "iu"), `${method}: ${topic}`);
    for (const field of ["claimId", "sourceIds", "verifiedAt", "reviewAfter", "regionScope", "limitations"]) {
      assert.match(current, new RegExp(`\\b${field}\\b`, "u"), `${method}: ${field}`);
    }
    assert.match(current, /expired[^\n]*(?:pending|blocked)|reviewAfter[^\n]*(?:pending|blocked)/iu, method);
  }
});

test("player experience blocks inaccessible actions and invented current thresholds", async () => {
  const method = await readMethod("player-experience.md");
  const policy = section(method, "Experience validation policy");
  for (const claim of ["onboarding percentage", "response time", "device target", "accessibility threshold", "platform threshold"]) {
    assert.match(policy, new RegExp(`\\b${claim}\\b`, "iu"), claim);
  }
  assert.match(policy, /critical action[^\n]*accessible alternative[^\n]*(?:No-Go|blocked)/iu);
});

test("economy and LiveOps cannot manufacture approval from missing commercial or protection data", async () => {
  const method = await readMethod("economy-liveops.md");
  const policy = section(method, "Economy and experiment approval policy");
  for (const claim of ["price ladder", "draw probability", "pity rule", "sample size", "legal policy", "rollback plan", "guardrail metric"]) {
    assert.match(policy, new RegExp(`\\b${claim}\\b`, "iu"), claim);
  }
  assert.match(policy, /missing[^\n]*(?:real price|probability|rollback|guardrail)[^\n]*(?:hard No-Go|blocked)/iu);
  assert.match(policy, /(?:AI|UGC)[^\n]*(?:rights|consent)[^\n]*(?:hard No-Go|blocked)/iu);
});

test("production commitments require target experience, prototype evidence, and evidenced estimates", async () => {
  const method = await readMethod("production.md");
  const policy = section(method, "Commitment policy");
  for (const claim of ["participant count", "schedule", "person-week", "performance target", "network target", "success rate"]) {
    assert.match(policy, new RegExp(`\\b${claim}\\b`, "iu"), claim);
  }
  assert.match(policy, /large commitment[^\n]*target experience[^\n]*prototype evidence[^\n]*(?:hard No-Go|blocked)/iu);
  assert.match(policy, /concept draft[^\n]*(?:allowed|continue)[^\n]*(?:approval|commitment)[^\n]*(?:blocked|forbidden|not allowed)/iu);
});

test("all operational skills and methods use the exact canonical gate lifecycle", async () => {
  const registry = JSON.parse(await readFile(gateRegistryPath, "utf8"));
  const gateIds = registry.gates.map(({ id }) => id);
  for (const [skillId, { method }] of Object.entries(contracts)) {
    for (const [label, markdown] of [[`${skillId}: skill`, await readSkill(skillId)], [`${skillId}: method`, await readMethod(method)]]) {
      const gates = section(markdown, "Responsible-design gates");
      assert.match(gates, new RegExp(relativeGateRegistry.replaceAll(".", "\\."), "u"), `${label}: registry`);
      assert.match(gates, /applicability_questions/iu, `${label}: applicability`);
      assert.match(gates, /evidence_fields/iu, `${label}: evidence`);
      for (const gateId of gateIds) assert.match(gates, new RegExp(`\\b${gateId}\\b`, "u"), `${label}: ${gateId}`);
      assert.deepEqual(extractLifecycleValues(gates, label), registry.allowed_states, `${label}: lifecycle`);
    }
  }
});

test("operational skill files contain no generated placeholders", async () => {
  for (const [skillId, { method }] of Object.entries(contracts)) {
    for (const text of await Promise.all([readSkill(skillId), readSkill(skillId, "agents/openai.yaml"), readMethod(method)])) {
      assert.doesNotMatch(text, /TODO|PLACEHOLDER|\[TODO/iu, skillId);
    }
  }
});
