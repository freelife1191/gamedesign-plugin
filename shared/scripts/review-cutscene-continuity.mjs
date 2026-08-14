import {
  assertCutsceneContinuityGate,
  cutsceneContinuityManifestSha256,
  cutsceneDocumentSha256,
  validateCutsceneVisualPlan,
} from "./validate-cutscene-visual-preproduction.mjs";
import { isRfc3339DateTime } from "./lib/rfc3339.mjs";
import { assertCutscenePlanManifestBinding } from "./plan-cutscene-visual-preproduction.mjs";

const VISUAL_KINDS = new Set(["expression", "blocking", "character-state", "costume", "prop-state", "environment-state", "lighting", "screen-direction"]);
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const stable = (value) => typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(value);
const record = (value) => typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]*$/u.test(value);

function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { return plain(value) && Reflect.ownKeys(value).every((key) => typeof key === "string" && keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key)); }
function masterAssetIds(plan, manifest) {
  const masters = new Set(plan.cutsceneWorkflow.waves.slice(0, 2).flatMap((wave) => wave.assetIds));
  const actual = new Set(manifest.assets.map((asset) => asset.asset_id));
  return new Set([...masters].filter((id) => actual.has(id)));
}

export function reviewCutsceneContinuity({ plan, manifest, observations, reviewedAt } = {}) {
  if (!validateCutsceneVisualPlan(plan).ok || !plain(manifest) || !Array.isArray(manifest.assets)) throw new TypeError("A valid plan and manifest are required.");
  assertCutscenePlanManifestBinding({ plan, manifest });
  if (!Array.isArray(observations) || !isRfc3339DateTime(reviewedAt)) throw new TypeError("Canonical observations and reviewedAt are required.");
  const sourceMasters = masterAssetIds(plan, manifest);
  const shotIndex = new Map(plan.shots.map(({ shotId }, index) => [shotId, index]));
  const storyboard = plan.cutsceneWorkflow.waves[3].assetIds;
  const seen = new Set();
  const findings = observations.map((observation, index) => {
    if (!exact(observation, ["shotId", "finding", "sourceMasterIds"]) || !record(observation.shotId) || !shotIndex.has(observation.shotId)
      || !exact(observation.finding, ["kind", "blocking"]) || !VISUAL_KINDS.has(observation.finding.kind) || typeof observation.finding.blocking !== "boolean"
      || !Array.isArray(observation.sourceMasterIds) || observation.sourceMasterIds.length === 0 || !observation.sourceMasterIds.every(stable)) throw new TypeError(`Invalid continuity observation at index ${index}.`);
    const sourceMasterIds = [...new Set(observation.sourceMasterIds)].sort(compare);
    if (sourceMasterIds.length !== observation.sourceMasterIds.length || sourceMasterIds.some((id) => !sourceMasters.has(id))) throw new TypeError(`Invalid continuity source master at index ${index}.`);
    const shotPosition = shotIndex.get(observation.shotId);
    const finding = {
      findingId: `continuity-${observation.shotId.toLowerCase()}-${observation.finding.kind}`,
      code: `continuity.${observation.finding.kind}`,
      path: `/shots/${shotPosition}`,
      sourceMasterIds,
      affectedAssetIds: [storyboard[shotPosition]],
      blocking: observation.finding.blocking,
    };
    const identity = JSON.stringify(finding);
    if (seen.has(identity)) throw new TypeError(`Duplicate continuity observation at index ${index}.`);
    seen.add(identity);
    return finding;
  }).sort((left, right) => compare(left.findingId, right.findingId));
  const blockingFindingIds = findings.filter((finding) => finding.blocking).map((finding) => finding.findingId).sort(compare);
  return { schemaVersion: 1, cutsceneId: plan.cutsceneId, planSha256: cutsceneDocumentSha256(plan), manifestSha256: cutsceneContinuityManifestSha256(manifest), reviewedAt, findings, blockingFindingIds };
}

export { assertCutsceneContinuityGate, cutsceneContinuityManifestSha256 };
