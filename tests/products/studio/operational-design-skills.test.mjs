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
      "information priority": ["now", "player decisions"],
      "interaction and ui states": ["entry", "recovery", "exit states"],
      "first five minutes": ["launch", "meaningful choice"],
      "first success": ["action", "understanding check", "continuation"],
      "tutorial skip and revisit": ["skip effect", "replay path", "persistence"],
      input: ["critical actions", "remapping", "conflicts"],
      performance: ["latency", "frame pacing", "readability impact", "owner"],
      "cross-platform": ["platform", "screen", "input", "entitlement differences"],
      accessibility: ["modalities", "critical-task test results", "limitations", "owner"],
    },
    blockers: ["inaccessible-critical-action", "unverified-current-accessibility"],
    blockerMeaning: {
      "inaccessible-critical-action": ["critical path", "no usable alternative", "feedback", "recovery"],
      "unverified-current-accessibility": ["current accessibility", "fresh authoritative evidence", "task testing"],
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
      sources: ["currency or item", "trigger", "cadence", "owner"],
      sinks: ["cost", "purpose", "refund behavior", "owner"],
      "target inventory": ["cohort", "timepoint target", "observed baseline", "acceptable range"],
      "progression time": ["goal", "measured path", "variance", "validation status"],
      inflation: ["supply-demand indicators", "velocity", "response", "owner"],
      "real price": ["regional money conversion", "display", "refund", "evidence"],
      probability: ["exact odds", "pool", "eligibility", "disclosure surface", "version", "evidence"],
      pity: ["counter scope", "reset", "carryover", "guarantee", "edge cases"],
      hypothesis: ["causal statement", "target population", "falsifier"],
      control: ["eligibility", "allocation", "contamination protections", "baseline"],
      "single variable": ["isolated treatment", "conflicting experiment"],
      sample: ["power or precision basis", "exclusions", "representativeness limits"],
      duration: ["start", "stop", "seasonality", "observation window", "rationale"],
      "success metrics": ["primary outcome", "baseline", "threshold status", "owner"],
      "guardrail metrics": ["harm", "spend", "access", "reliability", "fairness", "privacy"],
      "stop criteria": ["automatic and human stop triggers", "monitoring cadence", "authority"],
      "rollback plan": ["tested mechanism", "recovery time", "data repair", "player remedy", "owner"],
    },
    blockers: [
      "missing-real-price",
      "missing-probability",
      "missing-rollback",
      "unsafe-liveops-experiment",
      "missing-ai-ugc-rights-consent",
    ],
    blockerMeaning: {
      "missing-real-price": ["paid value", "verified real-money price", "disclosure path"],
      "missing-probability": ["randomized reward odds", "unknown or undisclosed"],
      "missing-rollback": ["cannot be restored", "tested plan"],
      "unsafe-liveops-experiment": ["hypothesis", "control", "isolated variable", "guardrails", "owner", "missing"],
      "missing-ai-ugc-rights-consent": ["provenance", "rights or consent", "human approval", "moderation", "appeal evidence"],
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
      "core-loop contribution": ["scope item", "player action", "target-experience link", "non-goal"],
      effort: ["observable units", "throughput evidence", "range", "confidence", "owner"],
      dependencies: ["upstream", "downstream", "sequencing", "fallback", "owner"],
      "maintenance burden": ["recurring operations", "support", "moderation", "deprecation cost"],
      "licensing risk": ["asset", "territory", "term", "restriction", "renewal", "approver"],
      "outsource risk": ["deliverable", "vendor dependency", "acceptance", "rights", "contingency"],
      "prototype hypothesis": ["riskiest falsifiable belief", "cheapest valid prototype", "observation", "decision rule"],
      milestone: ["intended maturity", "evidence gate", "entry criteria", "exit criteria", "dependencies"],
      owner: ["accountable role", "decision authority", "escalation", "backup"],
      "definition of done": ["observable behavior", "quality evidence", "integration", "accepted limitations"],
      "kill criterion": ["failure signal", "observation window", "decision owner", "stop action", "salvage"],
      "moscow scope": ["must", "should", "could", "won't item", "rationale", "evidence", "approver"],
    },
    blockers: ["missing-target-experience", "missing-prototype-evidence", "unsupported-large-estimate"],
    blockerMeaning: {
      "missing-target-experience": ["large commitment", "no stated", "approved", "traceable target experience"],
      "missing-prototype-evidence": ["riskiest player or technology hypothesis", "no fit-for-purpose prototype result", "decision record"],
      "unsupported-large-estimate": ["commitment", "invented or unvalidated estimates"],
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

function assertSemanticContract(actual, expected, label) {
  assert.deepEqual([...actual.keys()], Object.keys(expected), `${label}: keys`);
  for (const [key, requiredTokens] of Object.entries(expected)) {
    const meaning = actual.get(key);
    for (const token of requiredTokens) assert.ok(meaning.includes(token), `${label}: ${key} requires ${token}`);
    assert.doesNotMatch(
      meaning,
      /\b(?:weakened|optional|ignore|ignored|omit|unnecessary|not required|must not validate|no evidence needed)\b/iu,
      `${label}: ${key} contradictory meaning`,
    );
  }
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
      assert.throws(
        () => assertSemanticContract(parsed, expectedMeaning, `${skillId}: weakened ${heading}`),
        /requires|contradictory meaning/u,
      );
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
