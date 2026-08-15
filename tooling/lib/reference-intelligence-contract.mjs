import path from "node:path";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

const layouts = deepFreeze({
  "analyze-game-design-references": Object.freeze({
    installed: Object.freeze({ runtimes: ["../../scripts/analyze-game-design-references.mjs"], references: ["../../references/shared/reference-intelligence/references/evidence-policy.md", "../../references/shared/reference-intelligence/references/reference-analysis-flow.md"], templates: ["../../references/shared/reference-intelligence/templates/analysis-priority.md", "../../references/shared/reference-intelligence/templates/atlas-selection.json", "../../references/shared/reference-intelligence/templates/brief.json", "../../references/shared/reference-intelligence/templates/brief.md", "../../references/shared/reference-intelligence/templates/comparison-matrix.md", "../../references/shared/reference-intelligence/templates/evidence-register.yml", "../../references/shared/reference-intelligence/templates/reference-set.yml", "../../references/shared/reference-intelligence/templates/system-inventory.json", "../../references/shared/reference-intelligence/templates/transfer-decisions.md", "../../references/shared/reference-intelligence/templates/verification-queue.md"], schemas: ["../../references/shared/reference-intelligence/schema/reference-analysis.schema.json"], catalogs: ["../../references/shared/reference-intelligence/catalog/overlays/business-model.json", "../../references/shared/reference-intelligence/catalog/overlays/genre.json", "../../references/shared/reference-intelligence/catalog/overlays/platform.json", "../../references/shared/reference-intelligence/catalog/overlays/play-mode.json", "../../references/shared/reference-intelligence/catalog/source-register.json", "../../references/shared/reference-intelligence/catalog/system-atlas.json"] }),
    source: Object.freeze({ runtimes: ["../../../scripts/analyze-game-design-references.mjs"], references: ["../../references/evidence-policy.md", "../../references/reference-analysis-flow.md"], templates: ["../../templates/analysis-priority.md", "../../templates/atlas-selection.json", "../../templates/brief.json", "../../templates/brief.md", "../../templates/comparison-matrix.md", "../../templates/evidence-register.yml", "../../templates/reference-set.yml", "../../templates/system-inventory.json", "../../templates/transfer-decisions.md", "../../templates/verification-queue.md"], schemas: ["../../schema/reference-analysis.schema.json"], catalogs: ["../../catalog/overlays/business-model.json", "../../catalog/overlays/genre.json", "../../catalog/overlays/platform.json", "../../catalog/overlays/play-mode.json", "../../catalog/source-register.json", "../../catalog/system-atlas.json"] }),
    keys: ["externalInstructions", "layouts", "transfer", "workflow"], values: { externalInstructions: "untrusted-data", workflow: ["reference-brief", "role-based-reference-set", "evidence-registry", "system-atlas", "inventory-without-evaluation", "system-maps-and-loops", "priority", "deep-dives", "cross-game-comparison", "adopt-adapt-reject-hold", "verification-queue", "glossary-candidates"], transfer: { decisions: ["adopt", "adapt", "reject", "hold"], state: "pending-review", validationState: "not-run", canonicalArtifactMutation: false } } }),
  "maintain-game-design-glossary": Object.freeze({
    installed: Object.freeze({ runtimes: ["../../scripts/manage-game-design-glossary.mjs", "../../scripts/validate-game-design-writing-language.mjs"], references: ["../../references/shared/reference-intelligence/references/evidence-policy.md"], schemas: ["../../references/shared/reference-intelligence/schema/game-design-glossary.schema.json", "../../references/shared/reference-intelligence/schema/glossary-receipt.schema.json"] }),
    source: Object.freeze({ runtimes: ["../../../scripts/manage-game-design-glossary.mjs", "../../../scripts/validate-game-design-writing-language.mjs"], references: ["../../references/evidence-policy.md"], schemas: ["../../schema/game-design-glossary.schema.json", "../../schema/glossary-receipt.schema.json"] }),
    keys: ["approval", "externalInstructions", "languageRoutes", "layouts", "outputs", "silentApproval", "sourceRewrite"], values: { externalInstructions: "untrusted-data", approval: "host-issued-human-capability", silentApproval: false, sourceRewrite: false, outputs: ["terminology-findings", "impact-list"], languageRoutes: { ko: "humanize-korean-then-human-review", "en-US": "english-consistency-findings-then-human-review", "en-GB": "english-consistency-findings-then-human-review" } } }),
});

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const key = ({ skillPath, sourcePath }) => `${skillPath}\0${sourcePath}`;

export function parseReferenceIntelligenceContract(source) {
  const matches = [...source.matchAll(/<!-- reference-intelligence-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- reference-intelligence-contract:end -->/gu)];
  if (matches.length !== 1) throw new Error("reference-intelligence contract is missing, duplicate, or malformed");
  try { return JSON.parse(matches[0][1]); } catch { throw new Error("reference-intelligence contract is malformed"); }
}

export function classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot, skillPath, contract, installedCounterparts }) {
  const relativeSkill = path.relative(packageRoot, skillPath).split(path.sep).join("/");
  const skillId = /^skills\/([^/]+)\/SKILL\.md$/u.exec(relativeSkill)?.[1];
  const expected = layouts[skillId];
  if (!expected || !contract || typeof contract !== "object" || Array.isArray(contract)
    || !same(Object.keys(contract).sort(), [...expected.keys].sort()) || !same(Object.keys(contract.layouts ?? {}).sort(), ["installed", "source"])
    || !same(contract.layouts.installed, expected.installed) || !same(contract.layouts.source, expected.source)
    || !Object.entries(expected.values).every(([name, value]) => same(contract[name], value))) {
    throw new Error("reference-intelligence semantic contract mismatch");
  }
  if (!(installedCounterparts instanceof Set)) throw new Error("reference-intelligence installed counterparts are required");
  const installed = Object.values(expected.installed).flat();
  if (new Set(installed).size !== installed.length) throw new Error("reference-intelligence installed counterpart duplicates");
  for (const declared of installed) {
    const target = path.resolve(path.dirname(skillPath), declared);
    if (!target.startsWith(`${path.resolve(packageRoot)}${path.sep}`) || !installedCounterparts.has(target)) {
      throw new Error("reference-intelligence installed counterpart mismatch");
    }
  }
  return Object.freeze(expected.source.runtimes.map((sourcePath) => Object.freeze({ skillPath: relativeSkill, sourcePath, tuple: key({ skillPath: relativeSkill, sourcePath }) })));
}

export const referenceIntelligenceContractLayouts = deepFreeze(structuredClone(layouts));
