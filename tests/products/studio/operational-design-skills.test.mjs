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
    blockers: ["inaccessible-critical-action", "unverified-current-accessibility"],
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
    blockers: [
      "missing-real-price",
      "missing-probability",
      "missing-rollback",
      "unsafe-liveops-experiment",
      "missing-ai-ugc-rights-consent",
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
    blockers: ["missing-target-experience", "missing-prototype-evidence", "unsupported-large-estimate"],
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

function parseFirstColumn(markdownTable, header, label) {
  const rows = markdownTable
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

  assert.ok(rows.length >= 3, `${label}: table rows`);
  assert.equal(rows[0][0], header, `${label}: first-column header`);
  assert.match(rows[1][0], /^:?-{3,}:?$/u, `${label}: separator`);
  assert.ok(rows.slice(2).every((row) => row.length === 2 && row[0] && row[1]), `${label}: two populated columns`);
  return rows.slice(2).map(([value]) => value.toLocaleLowerCase("en-US"));
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
    for (const reviewer of contract.reviewers) assert.match(section(skill, "Role reviewers"), new RegExp(`\\b${reviewer}\\b`, "u"));
    for (const blocker of contract.blockers) assert.match(section(skill, "Completion checks"), new RegExp(`\\b${blocker}\\b`, "u"));
  }
});

test("method schemas preserve the exact operational design fields", async () => {
  for (const [skillId, contract] of Object.entries(contracts)) {
    const method = await readMethod(contract.method);
    assert.deepEqual(
      parseFirstColumn(section(method, "Output schema"), "Field", `${skillId}: schema`),
      contract.methodFields,
    );
    assert.deepEqual(
      parseFirstColumn(section(method, "Hard No-Go conditions"), "Blocker ID", `${skillId}: blockers`),
      contract.blockers,
    );
  }
});

test("contract parsers detect row deletion and lifecycle expansion mutations", async () => {
  const registry = JSON.parse(await readFile(gateRegistryPath, "utf8"));

  for (const [skillId, contract] of Object.entries(contracts)) {
    const method = await readMethod(contract.method);
    for (const field of contract.methodFields) {
      const mutated = method
        .split("\n")
        .filter((line) => !line.toLocaleLowerCase("en-US").startsWith(`| ${field} |`))
        .join("\n");
      assert.notDeepEqual(
        parseFirstColumn(section(mutated, "Output schema"), "Field", `${skillId}: deleted ${field}`),
        contract.methodFields,
      );
    }
    for (const blocker of contract.blockers) {
      const mutated = method
        .split("\n")
        .filter((line) => !line.toLocaleLowerCase("en-US").startsWith(`| ${blocker} |`))
        .join("\n");
      assert.notDeepEqual(
        parseFirstColumn(section(mutated, "Hard No-Go conditions"), "Blocker ID", `${skillId}: deleted ${blocker}`),
        contract.blockers,
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
