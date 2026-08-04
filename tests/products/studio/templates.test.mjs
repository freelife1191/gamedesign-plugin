import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { parseRestrictedYaml, validateArtifact } from "../../../shared/scripts/validate-artifact.mjs";
import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateRoot = path.join(repoRoot, "products/game-design-studio/plugin/assets/templates");
const temporaryDirs = [];

const templateIds = [
  "game-design-brief",
  "vision-pillars",
  "core-motivation-loop",
  "system-specification",
  "rule-exception-matrix",
  "ui-ux-flow-state",
  "data-schema-table-contract",
  "narrative-quest-npc",
  "character-skill-combat-monster",
  "economy-balance",
  "liveops-experiment-event",
  "accessibility-platform-matrix",
  "production-scope-risk",
  "game-design-review",
  "decision-change-log",
];

const requiredFiles = [
  "assets/README.md",
  "content.md",
  "decisions/README.md",
  "evidence.yml",
  "export-manifest.yml",
];

const approvedContentHashes = {
  "accessibility-platform-matrix": "3adbf68658f7abf56074aea607708723863ced3e529373bc800d0e8dc2cb89ee",
  "character-skill-combat-monster": "009e06742aa8ef1b4ddb245a4c31f5853c742a2d8df6c4a5fa1d819d3f7b48f1",
  "core-motivation-loop": "ec7c7b35bbe1bdfea429808403be9e24868c8d307d7cb6d8517a11349fbe04d2",
  "data-schema-table-contract": "2727983332f51f181bbe0deed56d96a4e06a88599ff962821f8eb20196d5e0ef",
  "decision-change-log": "d7ac34c536d5dd67bcc259c9446b5a88b85fdccceab218b80e088dd0031e1ef4",
  "economy-balance": "d24d92a7c999fafa15d5a4eb7c48a85bcfd2934b7c443562478030324570a0ab",
  "game-design-brief": "f418f40100f7d8dc6b118f14e2efb6b14f8018896ea9486a5ef843082fe77a18",
  "game-design-review": "9f18f04fd32556c19b70a4a1235cd59062f89a8d31a41b0198b9c07b374adae8",
  "liveops-experiment-event": "bad175ae9d3188b8dd8fd40d23c27127c319b10351e15a79519db23303215c10",
  "narrative-quest-npc": "8f4518c8c2ae5e4efb70821c621778d2b324d93b688d83ccf769aa671308159f",
  "production-scope-risk": "1e4c681a922d6231a08d3eebb4119aa94b387d2c9aef330be3550380d570c7e4",
  "rule-exception-matrix": "e857bb7fdcf646c0a256ff01a3839d39dd6e754532971c279b82d17a3f37b0e8",
  "system-specification": "598481b6d56be23e30549b02672045674c096f87595ac236df8213947f8bb450",
  "ui-ux-flow-state": "16c9ea67d0d742eb4283fa0b248d9fc942de2ddbc12c45295f6fc6a1c611024f",
  "vision-pillars": "2deee04d2b0cae6306ed87f7767b57497b8f898203b33cf58010480b8d92b25a",
};

const contracts = {
  "game-design-brief": {
    fields: ["target-player", "experience-intent", "platform", "genre", "business-model", "core-loop", "scope", "non-goals", "success-metric", "owner"],
    sections: [
      ["Brief Contract", "brief-contract", "Define the target player, experience intent, desired emotion, platform, genre, business model, online mode, core loop, scope, non-goals, success metric, constraints, and owner before approval."],
      ["Release Boundary", "release-boundary", "A concept may remain provisional. Do not approve production commitment while target experience, prototype evidence, owner, or success criteria are missing."],
    ],
  },
  "vision-pillars": {
    fields: ["pillar-id", "player-promise", "design-rule", "anti-pillar", "evidence-id", "success-signal", "owner"],
    sections: [
      ["Vision and Pillars", "vision-and-pillars", "Connect each pillar-id to a target-player promise, desired emotion, core fun, meaningful choice, design rule, anti-pillar, evidence-id, success signal, and owner."],
      ["Unsupported Fun Boundary", "unsupported-fun-boundary", "Fun adjectives are hypotheses, not evidence. Keep assumptions visible and require an observable player behavior or test before approval."],
    ],
  },
  "core-motivation-loop": {
    fields: ["loop-step", "player-input", "system-response", "feedback", "reward", "motivation-need", "meaningful-choice", "failure-recovery", "metric"],
    sections: [
      ["Loop Contract", "loop-contract", "Trace trigger, player input, system response, feedback, reward, motivation need, meaningful choice, repetition, failure, recovery, and measurable outcome for every loop-step."],
      ["Compulsion Safety", "compulsion-safety", "Do not use obscured odds, coercive urgency, loss framing, or infinite escalation as a substitute for meaningful choice. Record stop conditions and player protection metrics."],
    ],
  },
  "system-specification": {
    fields: ["rule-id", "input", "precondition", "state-transition", "output", "feedback", "precedence", "exception", "failure-recovery", "data-runtime-mapping"],
    sections: [
      ["System Contract", "system-contract", "For every rule-id specify input, precondition, rule, state transition, output, feedback, exception, priority, concurrency, failure, recovery, abuse case, UI state, and owner."],
      ["Precedence and Runtime Mapping", "precedence-and-runtime-mapping", "Resolve rule precedence explicitly. Map each design field to its data source, table or schema key, runtime consumer, authority, synchronization rule, validation method, and rollback path."],
    ],
  },
  "rule-exception-matrix": {
    fields: ["rule-id", "priority", "condition", "exception-id", "concurrency", "authority", "failure", "recovery", "test-case"],
    sections: [
      ["Rule and Exception Order", "rule-and-exception-order", "Give every rule-id and exception-id a deterministic priority, condition, authority, concurrency behavior, conflict resolution, failure state, recovery action, and test-case."],
      ["Conflict Boundary", "conflict-boundary", "Never resolve contradictory rules by document order or unstated intuition. Unresolved precedence blocks implementation approval and becomes a decision record."],
    ],
  },
  "ui-ux-flow-state": {
    fields: ["state-id", "entry-condition", "information-priority", "critical-action", "input", "loading-empty-error", "exit-condition", "accessibility", "telemetry"],
    sections: [
      ["Flow and State Contract", "flow-and-state-contract", "For each state-id record entry condition, information priority, critical action, input, focus order, loading, empty, error, offline, interruption, recovery, exit condition, and telemetry."],
      ["Access to Critical Actions", "access-to-critical-actions", "A critical action requires keyboard or controller reachability, visible focus, readable status beyond color alone, scalable text, captions where audio conveys meaning, and an accessible recovery path."],
    ],
  },
  "data-schema-table-contract": {
    fields: ["field-id", "table", "primary-key", "foreign-key", "type-range", "default-null", "design-meaning", "runtime-consumer", "authority-sync", "migration-validation"],
    sections: [
      ["Schema Contract", "schema-contract", "For each field-id record table, primary key, foreign key, type and range, default and null policy, design meaning, source of truth, runtime consumer, authority and synchronization, migration, validation, and rollback."],
      ["Design to Runtime Boundary", "design-to-runtime-boundary", "A label without an exact table or schema key is not a runtime mapping. Schema changes require compatibility, ownership, migration, observability, and rollback evidence."],
    ],
  },
  "narrative-quest-npc": {
    fields: ["content-id", "player-purpose", "entry-condition", "choice-consequence", "quest-state", "npc-state", "telegraph", "reward", "repeatability", "rights-consent"],
    sections: [
      ["Narrative Content Contract", "narrative-content-contract", "Connect each content-id to player purpose, system inputs, production resources, entry condition, choice and consequence, quest state, NPC state, telegraph, outcome, reward, repeatability, and owner."],
      ["AI and UGC Rights Boundary", "ai-and-ugc-rights-boundary", "When AI-generated, performer-derived, or user-generated material is used, record source, creator or contributor, attribution, use purpose, rights or consent, privacy, moderation, approver, and revocation path before release."],
    ],
  },
  "character-skill-combat-monster": {
    fields: ["entity-id", "combat-role", "player-strategy", "input-timing", "state-rule", "telegraph", "counterplay", "failure-recovery", "data-key", "balance-test"],
    sections: [
      ["Combat Content Contract", "combat-content-contract", "For every entity-id connect combat role, player strategy, input timing, state rule, telegraph, counterplay, output, reward, failure, recovery, data key, production cost, and balance test."],
      ["Fairness and Readability", "fairness-and-readability", "Critical threats require perceivable telegraphs, consistent rule precedence, accessible cues beyond color or audio alone, bounded randomness, and a testable counterplay window."],
    ],
  },
  "economy-balance": {
    fields: ["resource-id", "source", "sink", "target-inventory", "progression-time", "real-price", "probability", "pity", "inflation-risk", "rollback"],
    sections: [
      ["Economy Contract", "economy-contract", "For every resource-id record source, sink, target inventory, progression time, exchange rule, segmentation limit, inflation risk, exploit risk, telemetry, owner, and review cadence."],
      ["Price Probability and Recovery Gate", "price-probability-and-recovery-gate", "Release approval is blocked until real-price presentation, probability disclosure, pity or guarantee behavior, purchase confirmation, refund boundary, anomaly detection, stop condition, and rollback are explicit and current-policy evidence is linked."],
    ],
  },
  "liveops-experiment-event": {
    fields: ["experiment-id", "hypothesis", "control", "single-variable", "sample", "duration", "success", "guardrail", "stop-condition", "rollback"],
    sections: [
      ["Experiment Contract", "experiment-contract", "Every experiment-id requires one falsifiable hypothesis, a control, one changed variable, eligible sample, exclusions, duration, success metric, guardrail metric, analysis owner, and decision rule."],
      ["Protection and Rollback Gate", "protection-and-rollback-gate", "Do not launch without consent or policy basis where required, player protection metrics, stop condition, rollback owner, recovery procedure, contamination check, and a plan for inconclusive results."],
    ],
  },
  "accessibility-platform-matrix": {
    fields: ["platform", "critical-action", "input-method", "focus-navigation", "visual-alternative", "audio-alternative", "text-scale", "performance", "offline-interruption", "verification"],
    sections: [
      ["Platform Access Matrix", "platform-access-matrix", "For every platform and critical action record input method, remapping, focus navigation, visual alternative, audio alternative, text scale, motion or haptic option, performance budget, safe area, offline or interruption behavior, and verification."],
      ["Accessibility Completion Gate", "accessibility-completion-gate", "A critical action is not complete when a required state, cue, input path, recovery path, or equivalent sensory alternative is missing or unverified on a supported platform."],
    ],
  },
  "production-scope-risk": {
    fields: ["scope-id", "core-loop-contribution", "moscow", "effort", "dependency", "maintenance", "rights-outsource-risk", "prototype-hypothesis", "definition-of-done", "kill-criterion"],
    sections: [
      ["Scope and Risk Contract", "scope-and-risk-contract", "For each scope-id record core-loop contribution, MoSCoW class, effort, dependency, maintenance burden, licensing or outsource risk, prototype hypothesis, milestone, owner, definition of done, and kill-criterion."],
      ["Commitment Gate", "commitment-gate", "Do not approve a large commitment without target-experience evidence, prototype result, capacity evidence, named owner, measurable definition of done, kill criterion, contingency, and reopen condition."],
    ],
  },
  "game-design-review": {
    fields: ["finding-id", "severity", "evidence-id", "impact", "section-id", "minimal-fix", "role", "status", "decision-id"],
    sections: [
      ["Review Finding Contract", "review-finding-contract", "Every finding-id carries severity, evidence-id, observed impact, affected stable section-id, minimal-fix, reviewer role, status, and decision-id for unresolved disagreement."],
      ["Review Boundary", "review-boundary", "Reviewers report bounded findings and minimum repairs; they do not rewrite the whole artifact, invent evidence, silently choose between conflicting assumptions, or grant approval."],
    ],
  },
  "decision-change-log": {
    fields: ["decision-id", "date", "owner", "status", "context", "alternatives", "evidence-ids", "rationale", "approver", "reopen-condition"],
    sections: [
      ["Decision Contract", "decision-contract", "Every decision-id records date, owner, status, context, alternatives, evidence IDs, rationale, consequences, approver, approval date, and reopen condition."],
      ["Change Traceability", "change-traceability", "Every material change links the affected stable section IDs, previous decision, new evidence, compatibility or migration impact, rollback path, and next review date."],
    ],
  },
};

const commonClauses = [
  "An assumption is not an approved fact.",
  "Automation cannot grant approval, rights, or consent.",
  "Current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner.",
  "Third-party, AI-generated, performer-derived, or user-generated material requires source, creator or contributor, attribution, use purpose, rights or consent, privacy, approver, and revocation status.",
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

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "content must start with frontmatter");
  return parseRestrictedYaml(match[1], "content.md frontmatter");
}

function assertTemplateContract(templateId, content, evidence, manifest) {
  assert.equal(
    createHash("sha256").update(content, "utf8").digest("hex"),
    approvedContentHashes[templateId],
    `${templateId}: approved content seed bytes`,
  );
  const metadata = parseFrontmatter(content);
  assert.equal(metadata.artifact_id, templateId);
  assert.match(content, /^# .+ \{#[a-z0-9-]+\}$/mu);
  assert.match(content, /## Working Record \{#working-record\}/u);
  assert.match(content, /## Assumptions and Boundaries \{#assumptions-and-boundaries\}/u);
  assert.match(content, /## Owners and Approvals \{#owners-and-approvals\}/u);
  assert.match(content, /## Evidence and Freshness \{#evidence-and-freshness\}/u);
  assert.match(content, /## Applicable Safety Gates \{#applicable-safety-gates\}/u);
  assert.match(content, /## Output Story Hints \{#output-story-hints\}/u);
  assert.match(content, /## Change History \{#change-history\}/u);
  assert.doesNotMatch(content, /\b(?:TODO|TBD|lorem ipsum|fill this|placeholder)\b/iu);

  for (const [heading, id, meaning] of contracts[templateId].sections) {
    assert.equal(semanticSection(content, heading, id), meaning, `${templateId}: ${id}`);
  }
  for (const clause of commonClauses) assert.ok(content.includes(clause), `${templateId}: ${clause}`);

  const actualFields = content
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
  assert.deepEqual(actualFields, contracts[templateId].fields, `${templateId}: exact working fields`);

  assert.equal(evidence.version, 1);
  assert.equal(evidence.claims[0].id, `claim-${templateId}`);
  assert.equal(evidence.claims[0].source.locator, "content.md");
  assert.equal(manifest.artifact_id, templateId);
  assert.equal(metadata.artifact_id, manifest.artifact_id);
  assert.deepEqual(Object.keys(manifest.formats).sort(), ["docx", "md", "pdf", "pptx"]);
  assert.ok(manifest.formats.pptx.audience.trim());
  assert.ok(manifest.formats.pptx.purpose.trim());
  assert.ok(manifest.formats.pptx.slide_outline.length >= 3);
}

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
  const target = await mkdtemp(path.join(os.tmpdir(), `studio-template-${templateId}-`));
  temporaryDirs.push(target);
  await cp(path.join(templateRoot, templateId), target, { recursive: true });
  return target;
}

async function replaceIn(root, relativePath, before, after) {
  const file = path.join(root, relativePath);
  const source = await readFile(file, "utf8");
  assert.ok(source.includes(before));
  await writeFile(file, source.replace(before, after), "utf8");
}

function errors(result) {
  return result.errors.map(({ message }) => message).join("\n");
}

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("exactly 15 approved Studio templates ship as complete five-file seeds", async () => {
  assert.deepEqual((await readdir(templateRoot)).sort(), [...templateIds].sort());
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    assert.deepEqual(await filesBelow(root), requiredFiles);
    for (const relativePath of requiredFiles) {
      assert.equal((await lstat(path.join(root, relativePath))).isFile(), true);
      assert.ok((await readFile(path.join(root, relativePath), "utf8")).trim());
    }
  }
});

test("every seed validates through the production Canonical Artifact validator", async () => {
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    const result = await validateArtifact(root, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);
    assertTemplateContract(
      templateId,
      await readFile(path.join(root, "content.md"), "utf8"),
      parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8")),
      parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8")),
    );
  }
});

test("clean product build preserves every template byte-for-byte", async () => {
  assert.deepEqual(Object.keys(approvedContentHashes).sort(), [...templateIds].sort());
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-template-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const hashes = {};
  for (const templateId of templateIds) {
    for (const relativeFile of requiredFiles) {
      const source = await readFile(path.join(templateRoot, templateId, relativeFile));
      const built = await readFile(path.join(build.outputDir, "assets/templates", templateId, relativeFile));
      assert.deepEqual(built, source, `${templateId}/${relativeFile}`);
      hashes[`${templateId}/${relativeFile}`] = createHash("sha256").update(source).digest("hex");
      if (relativeFile === "content.md") assert.equal(hashes[`${templateId}/${relativeFile}`], approvedContentHashes[templateId]);
    }
  }
  assert.equal(Object.keys(hashes).length, 75);
  assert.equal(new Set(Object.values(hashes)).size > 30, true, "seeds must not be generic copies");
});

test("semantic direction and artifact identity cannot be diluted or contradicted", async () => {
  const cases = [
    ["system-specification", "Resolve rule precedence explicitly.", "Rule precedence may remain implicit."],
    ["economy-balance", "Release approval is blocked until", "Release approval is allowed before"],
    ["liveops-experiment-event", "Do not launch without", "Launch is allowed without"],
    ["ui-ux-flow-state", "A critical action requires", "A critical action does not require"],
    ["production-scope-risk", "Do not approve a large commitment without", "Approve a large commitment without"],
    ["narrative-quest-npc", "record source, creator or contributor", "assume source, creator, and contributor rights"],
  ];
  for (const [templateId, before, after] of cases) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = content.replace(before, after);
    assert.notEqual(mutated, content);
    assert.throws(() => assertTemplateContract(templateId, mutated, evidence, manifest));
  }

  const templateId = "game-design-brief";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const spoofed = content.replace("artifact_id: game-design-brief", "artifact_id: vision-pillars")
    .concat("\nExpected artifact identity: game-design-brief\n");
  assert.throws(() => assertTemplateContract(templateId, spoofed, evidence, manifest));

  const economyId = "economy-balance";
  const economyRoot = path.join(templateRoot, economyId);
  const economy = await readFile(path.join(economyRoot, "content.md"), "utf8");
  const economyEvidence = parseRestrictedYaml(await readFile(path.join(economyRoot, "evidence.yml"), "utf8"));
  const economyManifest = parseRestrictedYaml(await readFile(path.join(economyRoot, "export-manifest.yml"), "utf8"));
  const contradiction = `${economy}\n## Unsafe Exception {#unsafe-exception}\n\nReal-price, probability, pity, stop, and rollback details may be omitted before release.\n`;
  assert.throws(() => assertTemplateContract(economyId, contradiction, economyEvidence, economyManifest));
});

test("generic tokens cannot replace exact type semantics", async () => {
  const templateId = "liveops-experiment-event";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const generic = content.replace(
    contracts[templateId].sections[0][2],
    "hypothesis control single-variable sample duration success guardrail stop-condition rollback.",
  );
  assert.throws(() => assertTemplateContract(templateId, generic, evidence, manifest));
});

test("production validation rejects unsafe YAML, traversal, missing assets, and symlink assets", async () => {
  const unsafeYaml = await temporaryTemplate("game-design-brief");
  await replaceIn(unsafeYaml, "evidence.yml", "version: 1", "__proto__: poisoned\nversion: 1");
  let result = await validateArtifact(unsafeYaml);
  assert.equal(result.ok, false);
  assert.match(errors(result), /unsafe mapping key/i);

  for (const unsafePath of ["../outside.svg", "assets/../../outside.svg", "/tmp/outside.svg"]) {
    const fixture = await temporaryTemplate("vision-pillars");
    await replaceIn(fixture, "content.md", "No diagram is approved in this seed.", `![Vision map](${unsafePath})`);
    result = await validateArtifact(fixture);
    assert.equal(result.ok, false);
    assert.match(errors(result), /relative local asset|inside assets/i);
  }

  const missing = await temporaryTemplate("core-motivation-loop");
  await replaceIn(missing, "content.md", "No diagram is approved in this seed.", "![Loop](assets/missing.svg)");
  result = await validateArtifact(missing);
  assert.equal(result.ok, false);
  assert.match(errors(result), /does not exist/i);

  const linked = await temporaryTemplate("system-specification");
  const outside = path.join(linked, "..", "outside.svg");
  await writeFile(outside, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  await symlink(outside, path.join(linked, "assets/linked.svg"));
  await replaceIn(linked, "content.md", "No diagram is approved in this seed.", "![System](assets/linked.svg)");
  result = await validateArtifact(linked);
  assert.equal(result.ok, false);
  assert.match(errors(result), /does not exist/i);
});
