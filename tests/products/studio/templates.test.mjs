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
const templateRoot = path.join(repoRoot, "products/game-design-studio/plugin/assets/templates");
const templateProfileMapPath = path.join(repoRoot, "products/game-design-studio/plugin/references/document-quality/template-profile-map.json");
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

const expectedTemplateProfiles = {
  "accessibility-platform-matrix": "accessibility-platform-matrix",
  "character-skill-combat-monster": "character-skill-combat-monster-specification",
  "core-motivation-loop": "core-motivation-loop",
  "data-schema-table-contract": "data-table-contract",
  "decision-change-log": "design-review-decision-log",
  "economy-balance": "economy-balance-specification",
  "game-design-brief": "game-design-brief",
  "game-design-review": "design-review-decision-log",
  "liveops-experiment-event": "liveops-event-experiment-plan",
  "narrative-quest-npc": "narrative-quest-npc-specification",
  "production-scope-risk": "production-scope-milestone-risk-plan",
  "rule-exception-matrix": "rule-state-exception-matrix",
  "system-specification": "system-feature-specification",
  "ui-ux-flow-state": "ui-ux-flow-state-specification",
  "vision-pillars": "vision-one-pager",
};

const requiredFiles = [
  "assets/README.md",
  "content.md",
  "decisions/README.md",
  "evidence.yml",
  "export-manifest.yml",
];

const approvedSeedHashes = {
  "accessibility-platform-matrix/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "accessibility-platform-matrix/content.md": "5626cec4279cffba3def13b9a2f1f2653bbb86b247f8d8a098338339c2cb5c0a",
  "accessibility-platform-matrix/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "accessibility-platform-matrix/evidence.yml": "5cc40446bea64211ff0c242e49af505826735d253abb51162c005e0f2496ff97",
  "accessibility-platform-matrix/export-manifest.yml": "a0df5b01d7ab4662892bb06b8da1de586a9baa7c313fbeac28be3c491546b56b",
  "character-skill-combat-monster/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "character-skill-combat-monster/content.md": "14fddc61c7ea7429d9f5de0519b86ddf92fab02771bd4755ed715e4df1be14d3",
  "character-skill-combat-monster/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "character-skill-combat-monster/evidence.yml": "24432843d612e0e87c12bf7e4a352f621d7871dad6ffd7d38d5edfa68ae6b20b",
  "character-skill-combat-monster/export-manifest.yml": "b5a21c28d758fffacebab5eac10187767c8c9f687654130006ba36d8923e69f5",
  "core-motivation-loop/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "core-motivation-loop/content.md": "c7fd45bd37c51038731cbca87220facf66e1fa993fdad03be0673193fe137643",
  "core-motivation-loop/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "core-motivation-loop/evidence.yml": "4ce9d79abe00b9531640ffa28da47f1af8dd727e4a910223080a4e68fc8e30cb",
  "core-motivation-loop/export-manifest.yml": "d35deb851062f21cb36610bb1eef164d5dd21e7ae6a4dce052478074f2e69f02",
  "data-schema-table-contract/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "data-schema-table-contract/content.md": "5dfa16cab191b49b1af0e14c320c48b60306b4ea7804d311ed5c5b0896d6c130",
  "data-schema-table-contract/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "data-schema-table-contract/evidence.yml": "6a672a07b5b4ff865fdc507f3e6f8af0faf5e6db934f0c7a582c6f1c96452c70",
  "data-schema-table-contract/export-manifest.yml": "ca42b32d884f7f4d22a5aa9dc4197f8bedc053faddf1ab1bb70fd96389971e2d",
  "decision-change-log/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "decision-change-log/content.md": "30679aef9101c27132ea0d5d238ad51ce6f4420d3c0d0aee085c585e51784b2e",
  "decision-change-log/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "decision-change-log/evidence.yml": "fedc034c5c7c3ffe37c7286c612f0ce77919f8caea74c39b8b17605fbfe200ab",
  "decision-change-log/export-manifest.yml": "132eabb61d4b264c2d908c19788071c75a9a04284dbd589dfc5fec2f20d87ed9",
  "economy-balance/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "economy-balance/content.md": "2bf41b4b755bf6e55d47c5e63d81ae31d6ef43b99ea4e34d0a9d1d484b1a2349",
  "economy-balance/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "economy-balance/evidence.yml": "f5660aefba9fc8f67a97a86502a816fa2be16ff446f40c38b311ae8e129a0da7",
  "economy-balance/export-manifest.yml": "aaec2e67c761dd661f8d86175b723e43b9ae897907d574e13b092e1b21fb0ca4",
  "game-design-brief/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "game-design-brief/content.md": "a283b02f0c27f4dcb425fa96ad8458ae0975fd61276e65f17822ed7798382da0",
  "game-design-brief/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "game-design-brief/evidence.yml": "f19bb04d8077ba405dc1b22edb2b2e574d27b00499ea960cbe41e25290ddd5fb",
  "game-design-brief/export-manifest.yml": "3b066e718628dcf059d803dc8be26ca646ae7c7d618b806334b0674f7a5883f3",
  "game-design-review/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "game-design-review/content.md": "472c6ad263eebf457f46d3dbf2804dbee04369ef7eefd14773a0156a812d677f",
  "game-design-review/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "game-design-review/evidence.yml": "65bb1f4de923bf3b71ecc9f419cc659c55af18fc4751cda50e4ea33747096c38",
  "game-design-review/export-manifest.yml": "eca03c395d31e0fa49994446a0f7a8f2393cfeb21ccfdc837171611c9fd57aa0",
  "liveops-experiment-event/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "liveops-experiment-event/content.md": "8c2c65833f9f6a6db6cd16133864e2a4ea42b92e8f5b09f05543d1b4c66fea73",
  "liveops-experiment-event/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "liveops-experiment-event/evidence.yml": "a89d56b34a05e46354278b564c236d76fca03bff2332567415fef29c2f80c148",
  "liveops-experiment-event/export-manifest.yml": "b6934f5d78951b0840436297658717f0404ef9dd3eda905a446698855c666a22",
  "narrative-quest-npc/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "narrative-quest-npc/content.md": "8f5285edbc941f8f9ee8f60b2d0a6605c3697007029f5b128ea6347afe7dd19b",
  "narrative-quest-npc/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "narrative-quest-npc/evidence.yml": "5204b30729fa4ada897664e433791500acef62f490719427c1be269e941fc56e",
  "narrative-quest-npc/export-manifest.yml": "3ac51fc84152a138b78f5df7c62cb6778589869886e12e7fd834716fe16a2c48",
  "production-scope-risk/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "production-scope-risk/content.md": "9242f0e01f800c5098b5dd52e67f485b5e5d6062ef0ae8188365cb6299939878",
  "production-scope-risk/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "production-scope-risk/evidence.yml": "cb6f05e00e3fab3b9c58e1550ca54893d179d68098393eeb52c3698c25d196c2",
  "production-scope-risk/export-manifest.yml": "83e311c5d931b49bd329a615ec81bfdd217605fd328cc355c92bbb879bf7ad36",
  "rule-exception-matrix/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "rule-exception-matrix/content.md": "ce58a0a1558f3d24b84bc66f0304534f612cce7e87e394c61b037263d5c39329",
  "rule-exception-matrix/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "rule-exception-matrix/evidence.yml": "72838c93aadc5f48751dce8ff2e484d53dbcde4438b67a11b38513d26d8880c9",
  "rule-exception-matrix/export-manifest.yml": "c286f34b582856310e947cbe99cc8094d9964552fbd08c61cdadf4a2aa18fc3f",
  "system-specification/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "system-specification/content.md": "32932507ae69e5243b57c4b00d38ec806daffe2f2886b1b3c699cbeb5dda7a54",
  "system-specification/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "system-specification/evidence.yml": "a22c6454fb2b8a1f2a5a3e7c5b6c3ffef5a69535454a04115cfeae15b3b40263",
  "system-specification/export-manifest.yml": "b78dd77c281917c2e7e1099912d9144d8510b9e10621881d78008055d0e1bdf0",
  "ui-ux-flow-state/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "ui-ux-flow-state/content.md": "7b1cd76451482da7bb3bd8d40efd98e700b48b87a008e307ed797e7265404ebe",
  "ui-ux-flow-state/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "ui-ux-flow-state/evidence.yml": "9b571c210e2417bebb5a9eb614d87269d75996f1b39399c0d7c410514581e040",
  "ui-ux-flow-state/export-manifest.yml": "365df35e89ce4faa3b109aca775e7a0ffafc3f18dbe91ff2f14b49b5112c093d",
  "vision-pillars/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "vision-pillars/content.md": "00a27e7d62873569b914b7f8196f961cf19d129fc73a6559a26f061665b06780",
  "vision-pillars/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "vision-pillars/evidence.yml": "5a32187a996c28f8d3042aa333865254037664eb7218b72e258c4db255af9bdc",
  "vision-pillars/export-manifest.yml": "f48e93574eb4b19076afaaf9740c41472d1bae6fe2fcc0c2568b06739180b3b2",
};

const contracts = {
  "game-design-brief": {
    fields: ["target-player", "experience-intent", "platform", "genre", "business-model", "core-loop", "scope", "non-goals", "success-metric", "owner"],
    sections: [
      ["brief-contract", "Define the target player, experience intent, desired emotion, platform, genre, business model, online mode, core loop, scope, non-goals, success metric, constraints, and owner before approval."],
      ["release-boundary", "A concept may remain provisional. Do not approve production commitment while target experience, prototype evidence, owner, or success criteria are missing."],
    ],
  },
  "vision-pillars": {
    fields: ["pillar-id", "player-promise", "design-rule", "anti-pillar", "evidence-id", "success-signal", "owner"],
    sections: [
      ["vision-and-pillars", "Connect each pillar-id to a target-player promise, desired emotion, core fun, meaningful choice, design rule, anti-pillar, evidence-id, success signal, and owner."],
      ["unsupported-fun-boundary", "Fun adjectives are hypotheses, not evidence. Keep assumptions visible and require an observable player behavior or test before approval."],
    ],
  },
  "core-motivation-loop": {
    fields: ["loop-step", "player-input", "system-response", "feedback", "reward", "motivation-need", "meaningful-choice", "failure-recovery", "metric"],
    sections: [
      ["loop-contract", "Trace trigger, player input, system response, feedback, reward, motivation need, meaningful choice, repetition, failure, recovery, and measurable outcome for every loop-step."],
      ["compulsion-safety", "Do not use obscured odds, coercive urgency, loss framing, or infinite escalation as a substitute for meaningful choice. Record stop conditions and player protection metrics."],
    ],
  },
  "system-specification": {
    fields: ["rule-id", "input", "precondition", "state-transition", "output", "feedback", "precedence", "exception", "failure-recovery", "data-runtime-mapping"],
    sections: [
      ["system-contract", "For every rule-id specify input, precondition, rule, state transition, output, feedback, exception, priority, concurrency, failure, recovery, abuse case, UI state, and owner."],
      ["precedence-and-runtime-mapping", "Resolve rule precedence explicitly. Map each design field to its data source, table or schema key, runtime consumer, authority, synchronization rule, validation method, and rollback path."],
    ],
  },
  "rule-exception-matrix": {
    fields: ["rule-id", "priority", "condition", "exception-id", "concurrency", "authority", "failure", "recovery", "test-case"],
    sections: [
      ["rule-and-exception-order", "Give every rule-id and exception-id a deterministic priority, condition, authority, concurrency behavior, conflict resolution, failure state, recovery action, and test-case."],
      ["conflict-boundary", "Never resolve contradictory rules by document order or unstated intuition. Unresolved precedence blocks implementation approval and becomes a decision record."],
    ],
  },
  "ui-ux-flow-state": {
    fields: ["state-id", "entry-condition", "information-priority", "critical-action", "input", "loading-empty-error", "exit-condition", "accessibility", "telemetry"],
    sections: [
      ["flow-and-state-contract", "For each state-id record entry condition, information priority, critical action, input, focus order, loading, empty, error, offline, interruption, recovery, exit condition, and telemetry."],
      ["access-to-critical-actions", "A critical action requires keyboard or controller reachability, visible focus, readable status beyond color alone, scalable text, captions where audio conveys meaning, and an accessible recovery path."],
    ],
  },
  "data-schema-table-contract": {
    fields: ["field-id", "table", "primary-key", "foreign-key", "type-range", "default-null", "design-meaning", "runtime-consumer", "authority-sync", "migration-validation"],
    sections: [
      ["schema-contract", "For each field-id record table, primary key, foreign key, type and range, default and null policy, design meaning, source of truth, runtime consumer, authority and synchronization, migration, validation, and rollback."],
      ["design-to-runtime-boundary", "A label without an exact table or schema key is not a runtime mapping. Schema changes require compatibility, ownership, migration, observability, and rollback evidence."],
    ],
  },
  "narrative-quest-npc": {
    fields: ["content-id", "player-purpose", "entry-condition", "choice-consequence", "quest-state", "npc-state", "telegraph", "reward", "repeatability", "rights-consent"],
    sections: [
      ["narrative-content-contract", "Connect each content-id to player purpose, system inputs, production resources, entry condition, choice and consequence, quest state, NPC state, telegraph, outcome, reward, repeatability, and owner."],
      ["ai-and-ugc-rights-boundary", "When AI-generated, performer-derived, or user-generated material is used, record source, creator or contributor, attribution, use purpose, rights or consent, privacy, moderation, approver, and revocation path before release."],
    ],
  },
  "character-skill-combat-monster": {
    fields: ["entity-id", "combat-role", "player-strategy", "input-timing", "state-rule", "telegraph", "counterplay", "failure-recovery", "data-key", "balance-test"],
    sections: [
      ["combat-content-contract", "For every entity-id connect combat role, player strategy, input timing, state rule, telegraph, counterplay, output, reward, failure, recovery, data key, production cost, and balance test."],
      ["fairness-and-readability", "Critical threats require perceivable telegraphs, consistent rule precedence, accessible cues beyond color or audio alone, bounded randomness, and a testable counterplay window."],
    ],
  },
  "economy-balance": {
    fields: ["resource-id", "source", "sink", "target-inventory", "progression-time", "real-price", "probability", "pity", "inflation-risk", "rollback"],
    sections: [
      ["economy-contract", "For every resource-id record source, sink, target inventory, progression time, exchange rule, segmentation limit, inflation risk, exploit risk, telemetry, owner, and review cadence."],
      ["price-probability-and-recovery-gate", "Release approval is blocked until real-price presentation, probability disclosure, pity or guarantee behavior, purchase confirmation, refund boundary, anomaly detection, stop condition, and rollback are explicit and current-policy evidence is linked."],
    ],
  },
  "liveops-experiment-event": {
    fields: ["experiment-id", "hypothesis", "control", "single-variable", "sample", "duration", "success", "guardrail", "stop-condition", "rollback"],
    sections: [
      ["experiment-contract", "Every experiment-id requires one falsifiable hypothesis, a control, one changed variable, eligible sample, exclusions, duration, success metric, guardrail metric, analysis owner, and decision rule."],
      ["protection-and-rollback-gate", "Do not launch without consent or policy basis where required, player protection metrics, stop condition, rollback owner, recovery procedure, contamination check, and a plan for inconclusive results."],
    ],
  },
  "accessibility-platform-matrix": {
    fields: ["platform", "critical-action", "input-method", "focus-navigation", "visual-alternative", "audio-alternative", "text-scale", "performance", "offline-interruption", "verification"],
    sections: [
      ["platform-access-matrix", "For every platform and critical action record input method, remapping, focus navigation, visual alternative, audio alternative, text scale, motion or haptic option, performance budget, safe area, offline or interruption behavior, and verification."],
      ["accessibility-completion-gate", "A critical action is not complete when a required state, cue, input path, recovery path, or equivalent sensory alternative is missing or unverified on a supported platform."],
    ],
  },
  "production-scope-risk": {
    fields: ["scope-id", "core-loop-contribution", "moscow", "effort", "dependency", "maintenance", "rights-outsource-risk", "prototype-hypothesis", "definition-of-done", "kill-criterion"],
    sections: [
      ["scope-and-risk-contract", "For each scope-id record core-loop contribution, MoSCoW class, effort, dependency, maintenance burden, licensing or outsource risk, prototype hypothesis, milestone, owner, definition of done, and kill-criterion."],
      ["commitment-gate", "Do not approve a large commitment without target-experience evidence, prototype result, capacity evidence, named owner, measurable definition of done, kill criterion, contingency, and reopen condition."],
    ],
  },
  "game-design-review": {
    fields: ["finding-id", "severity", "evidence-id", "impact", "section-id", "minimal-fix", "role", "status", "decision-id"],
    sections: [
      ["review-finding-contract", "Every finding-id carries severity, evidence-id, observed impact, affected stable section-id, minimal-fix, reviewer role, status, and decision-id for unresolved disagreement."],
      ["review-boundary", "Reviewers report bounded findings and minimum repairs; they do not rewrite the whole artifact, invent evidence, silently choose between conflicting assumptions, or grant approval."],
    ],
  },
  "decision-change-log": {
    fields: ["decision-id", "date", "owner", "status", "context", "alternatives", "evidence-ids", "rationale", "approver", "reopen-condition"],
    sections: [
      ["decision-contract", "Every decision-id records date, owner, status, context, alternatives, evidence IDs, rationale, consequences, approver, approval date, and reopen condition."],
      ["change-traceability", "Every material change links the affected stable section IDs, previous decision, new evidence, compatibility or migration impact, rollback path, and next review date."],
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

function semanticSection(content, id) {
  const marker = new RegExp("^## [^\\r\\n]* \\{#" + id + "\\}\\r?\\n", "mu");
  const match = marker.exec(content);
  assert.ok(match, "missing semantic section " + id);
  const bodyStart = match.index + match[0].length;
  const next = content.indexOf("\n## ", bodyStart);
  return content.slice(bodyStart, next === -1 ? content.length : next).trim();
}

function assertStableSection(content, id) {
  assert.match(content, new RegExp("^## [^\\r\\n]* \\{#" + id + "\\}$", "mu"), "missing stable section " + id);
}

test("semantic sections use stable anchors instead of localized visible titles", () => {
  const content = "## 기획 항목: Localized title {#stable-section}\n\nRequired semantic meaning.\n\n## 다음 섹션 {#next-section}\n\nOther meaning.\n";
  assert.equal(semanticSection(content, "stable-section"), "Required semantic meaning.");
});

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "content must start with frontmatter");
  return parseRestrictedYaml(match[1], "content.md frontmatter");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertApprovedSeed(relativePath, bytes, expectedHash) {
  assert.match(expectedHash, /^[a-f0-9]{64}$/u, `${relativePath}: caller must pass an expected SHA-256`);
  assert.equal(expectedHash, approvedSeedHashes[relativePath], `${relativePath}: expected hash must come from the approved map`);
  assert.equal(sha256(bytes), expectedHash, `${relativePath}: approved seed bytes`);
}

function assertTemplateContract(templateId, content, evidence, manifest) {
  assert.equal(
    createHash("sha256").update(content, "utf8").digest("hex"),
    approvedSeedHashes[`${templateId}/content.md`],
    `${templateId}: approved content seed bytes`,
  );
  const metadata = parseFrontmatter(content);
  assert.equal(metadata.artifact_id, templateId);
  assert.match(content, /^# .+ \{#[a-z0-9-]+\}$/mu);
  assertStableSection(content, "working-record");
  assertStableSection(content, "assumptions-and-boundaries");
  assertStableSection(content, "owners-and-approvals");
  assertStableSection(content, "evidence-and-freshness");
  assertStableSection(content, "applicable-safety-gates");
  assertStableSection(content, "output-story-hints");
  assertStableSection(content, "change-history");
  assert.doesNotMatch(content, /\b(?:TODO|TBD|lorem ipsum|fill this|placeholder)\b/iu);

  for (const [id, meaning] of contracts[templateId].sections) {
    assert.equal(semanticSection(content, id), meaning, `${templateId}: ${id}`);
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

async function assertSeedMutationRejected(templateId, relativeFile, before, after) {
  const approvedPath = `${templateId}/${relativeFile}`;
  const expectedHash = approvedSeedHashes[approvedPath];
  const source = await readFile(path.join(templateRoot, approvedPath), "utf8");
  assertApprovedSeed(approvedPath, source, expectedHash);
  assert.ok(source.includes(before), `${approvedPath}: mutation source text`);
  const mutated = source.replace(before, after);
  assert.notEqual(mutated, source, `${approvedPath}: mutation must change bytes`);
  assert.throws(() => assertApprovedSeed(approvedPath, mutated, expectedHash), undefined, `${approvedPath}: mutation survived`);
}

async function instantiateTemplate(templateId) {
  const fixture = await temporaryTemplate(templateId);
  const contentPath = path.join(fixture, "content.md");
  let content = await readFile(contentPath, "utf8");
  for (const field of contracts[templateId].fields) {
    const seedRow = `| \`${field}\` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |`;
    const projectRow = `| \`${field}\` | observed | Project Ember records a reviewed value for ${field} under claim-${templateId}. | studio-lead |`;
    assert.ok(content.includes(seedRow), `${templateId}: seed row ${field}`);
    content = content.replace(seedRow, projectRow);
  }
  content = content.replace(
    "Record each assumption with a stable ID, evidence status, owner, validation action, affected decision, and expiration or review date. An assumption is not an approved fact.",
    "Project Ember assumption A-001 is provisional, owned by studio-lead, validated by prototype session P-014, linked to decision D-001, and reviewed on 2026-08-18. An assumption is not an approved fact.",
  );
  content = content.replace(
    "Name the artifact owner, evidence reviewer, discipline approvers, player-safety or accessibility reviewer where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval, rights, or consent.",
    "Artifact owner: studio-lead. Evidence reviewer: research-lead. Discipline approver: design-director. Player-safety and accessibility reviewer: access-lead. Approval status: approved for prototype on 2026-08-04; reopen if evidence P-014 changes. Automation cannot grant approval, rights, or consent.",
  );
  content = content.replace(
    "| 1 | 2026-08-04 | artifact-owner | Created the reviewable production-design seed and its completion boundaries. | pending human review |",
    "| 2 | 2026-08-04 | studio-lead | Instantiated Project Ember values, evidence, approval, and export story. | approved for prototype by design-director |",
  );
  await writeFile(contentPath, content, "utf8");

  await writeFile(path.join(fixture, "evidence.yml"), `version: 1
claims:
  - id: claim-${templateId}
    claim_type: project-design-evidence
    claim: Project Ember contains reviewed representative values for every ${templateId} working field.
    source:
      title: Project Ember prototype review P-014
      locator: content.md#working-record
      accessed_at: 2026-08-04
    confidence: medium
    limitations: |
      Prototype evidence supports design review only. Production and release approval remain governed by the artifact safety gates.
`, "utf8");

  const manifestPath = path.join(fixture, "export-manifest.yml");
  const manifest = (await readFile(manifestPath, "utf8"))
    .replace(/^    audience: .+$/mu, "    audience: Project Ember design review board")
    .replace(/^    purpose: .+$/mu, `    purpose: Decide Project Ember ${templateId} prototype readiness from evidence and safety gates.`)
    .replace("      - title: Context and target experience", "      - title: Project Ember context and target experience")
    .replace("      - title: Design decision and alternatives", "      - title: Project Ember decision and alternatives")
    .replace("      - title: Evidence risks and completion gate", "      - title: Project Ember evidence risks and completion gate");
  await writeFile(manifestPath, manifest, "utf8");

  await writeFile(path.join(fixture, "decisions/README.md"), `# Decision D-001 {#decision-d-001}

Date: 2026-08-04. Owner: studio-lead. Status: approved for prototype. Context: instantiate ${templateId} for Project Ember. Alternatives considered: keep the seed uninstantiated or defer review. Evidence IDs: claim-${templateId}. Rationale: a representative artifact is required for validation. Consequences: production and release remain gated. Affected stable section IDs: working-record and owners-and-approvals. Approver: design-director. Approval date: 2026-08-04. Rollback path: restore the approved seed. Reopen condition: prototype evidence P-014 changes.
`, "utf8");

  return fixture;
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

test("all 15 Studio templates resolve to exactly one declared primary quality profile", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-template-profile-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const packagedTemplateRoot = path.join(build.outputDir, "assets/templates");
  const packagedCatalogRoot = path.join(build.outputDir, "references/shared/document-quality/profiles/studio");
  const mappingSource = await readFile(templateProfileMapPath, "utf8").catch(() => null);
  assert.notEqual(mappingSource, null, "Studio template profile mapping must exist");
  const packagedMappingSource = await readFile(path.join(build.outputDir, "references/document-quality/template-profile-map.json"), "utf8");
  assert.equal(packagedMappingSource, mappingSource, "clean build must preserve the mapping bytes");
  const mapping = JSON.parse(packagedMappingSource);
  assert.deepEqual(Object.keys(mapping).sort(), ["product", "schema_version", "templates"]);
  assert.equal(mapping.schema_version, 1);
  assert.equal(mapping.product, "game-design-studio");
  assert.deepEqual(mapping.templates, expectedTemplateProfiles);
  assert.deepEqual(Object.keys(mapping.templates).sort(), (await readdir(packagedTemplateRoot)).sort());

  for (const [templateId, profileId] of Object.entries(mapping.templates)) {
    assert.equal(typeof profileId, "string", `${templateId}: primary profile must be one string`);
    const profile = JSON.parse(await readFile(path.join(packagedCatalogRoot, `${profileId}.json`), "utf8"));
    const profileValidation = validateQualityProfile(profile, { sourceName: `${profileId}.json` });
    assert.equal(profileValidation.ok, true, `${profileId}: ${JSON.stringify(profileValidation.errors)}`);
    assert.equal(profile.profile_id, profileId, `${templateId}: catalog resolution`);

    const content = await readFile(path.join(packagedTemplateRoot, templateId, "content.md"), "utf8");
    assert.equal(parseFrontmatter(content).quality_profile, profileId, `${templateId}: frontmatter mapping`);
    const result = await validateArtifact(path.join(packagedTemplateRoot, templateId), {
      requireQualityProfile: true,
      profileCatalogRoot: packagedCatalogRoot,
    });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);
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

test("every template instantiates with representative project data and remains a valid Canonical Artifact", async () => {
  for (const templateId of templateIds) {
    const fixture = await instantiateTemplate(templateId);
    const result = await validateArtifact(fixture, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);

    const content = await readFile(path.join(fixture, "content.md"), "utf8");
    const metadata = parseFrontmatter(content);
    const evidence = parseRestrictedYaml(await readFile(path.join(fixture, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(fixture, "export-manifest.yml"), "utf8"));
    assert.equal(metadata.artifact_id, templateId);
    assert.equal(manifest.artifact_id, templateId);
    assert.equal(evidence.claims[0].id, `claim-${templateId}`);
    assert.match(content, /Project Ember/u);
    assert.match(content, /approved for prototype by design-director/u);
    assert.match(manifest.formats.pptx.audience, /Project Ember/u);
    assert.match(manifest.formats.pptx.purpose, new RegExp(templateId, "u"));
    assert.deepEqual(
      content.split("\n").filter((line) => /^\| `[^`]+` \|/u.test(line)).map((line) => line.split("|")[1].trim().replaceAll("`", "")),
      contracts[templateId].fields,
      `${templateId}: instantiated required fields`,
    );
    for (const [id, meaning] of contracts[templateId].sections) {
      assert.equal(semanticSection(content, id), meaning, `${templateId}: instantiated ${id}`);
    }
  }
});

test("clean product build preserves every template byte-for-byte", async () => {
  const exactSeedPaths = templateIds.flatMap((templateId) => requiredFiles.map((relativeFile) => `${templateId}/${relativeFile}`)).sort();
  assert.deepEqual(Object.keys(approvedSeedHashes).sort(), exactSeedPaths);
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-template-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const hashes = {};
  for (const templateId of templateIds) {
    for (const relativeFile of requiredFiles) {
      const source = await readFile(path.join(templateRoot, templateId, relativeFile));
      const built = await readFile(path.join(build.outputDir, "assets/templates", templateId, relativeFile));
      assert.deepEqual(built, source, `${templateId}/${relativeFile}`);
      const approvedPath = `${templateId}/${relativeFile}`;
      hashes[approvedPath] = sha256(source);
      assertApprovedSeed(approvedPath, source, approvedSeedHashes[approvedPath]);
      assertApprovedSeed(approvedPath, built, approvedSeedHashes[approvedPath]);
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
    contracts[templateId].sections[0][1],
    "hypothesis control single-variable sample duration success guardrail stop-condition rollback.",
  );
  assert.throws(() => assertTemplateContract(templateId, generic, evidence, manifest));
});

test("all five seed-file contracts reject safety and workflow meaning reversals", async () => {
  await assertSeedMutationRejected(
    "game-design-brief",
    "evidence.yml",
    "Replace it with project-specific evidence before approving design, production, release, monetization, experiment, rights, consent, or accessibility claims.",
    "Release may proceed without project-specific evidence or completion boundaries.",
  );
  await assertSeedMutationRejected(
    "vision-pillars",
    "export-manifest.yml",
    "Explain the player promise, design pillars, anti-pillars, evidence, and success signals.",
    "Make some slides.",
  );
  await assertSeedMutationRejected(
    "system-specification",
    "decisions/README.md",
    "A pending approval remains visibly pending.",
    "Automation may approve decisions without evidence.",
  );
  await assertSeedMutationRejected(
    "narrative-quest-npc",
    "assets/README.md",
    "Do not add an asset until those fields are reviewable.",
    "Unlicensed assets may be added without attribution or consent.",
  );
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
