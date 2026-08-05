import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reviewImageAssetWorkflow, runImageAssetWorkflow } from "../../../shared/scripts/run-image-asset-workflow.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");

const profile = {
  profile_id: "workflow-test", version: 1, artifact_types: ["design-document"], audiences: ["design"],
  required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "table", section_id: "visuals", columns: ["Signal"] }],
  required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain", alt_text: "Diagram" }],
  required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain", alt_text: "Hero" }], recommended_images: [],
  length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"],
  export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
};
const artifact = { artifact_id: "workflow-test", image_needs: [{
  slot_id: "hero", type: "character", scene: "A clear scene.", subject: "A safe silhouette.", composition: "Centered.",
  visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024,
}] };

function png() {
  const buffer = Buffer.alloc(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  buffer.writeUInt32BE(1024, 16);
  buffer.writeUInt32BE(1024, 20);
  buffer.set([8, 6, 0, 0, 0], 24);
  return buffer;
}

async function workflowRoot(t, prefix) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "assets", "prompts"), { recursive: true });
  await mkdir(path.join(root, "decisions"));
  return root;
}

test("Studio plan-image-assets makes a profile-preflight plan and hands Skillstead evidence to visual QA", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/plan-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: plan-image-assets\ndescription: Use when /u);
  assert.match(skill, /image-assets\.yml/u);
  assert.match(skill, /assets\/prompts\/image-prompts\.md/u);
  assert.match(skill, /assets\/prompts\/image-prompts\.json/u);
  assert.match(skill, /apply-document-quality-profile/u);
  assert.match(skill, /required_images|recommended_images/u);
  assert.match(skill, /build-image-asset-plan\.mjs/u);
  assert.match(skill, /compile-image-prompts\.mjs/u);
  assert.match(skill, /stable asset ID|stable asset_id/u);
  assert.match(skill, /explicit (?:asset )?count/u);
  assert.match(skill, /placeholder/u);
  assert.match(skill, /Skillstead/u);
  assert.match(skill, /<title>|title\/desc/u);
  assert.match(skill, /2× PNG|@2x`? PNG/u);
  assert.match(skill, /lint|render|QA/u);
  assert.doesNotMatch(skill, /OpenAI|Codex image generation/u);
});

test("Studio generate-image-assets routes by actual configuration without inventing host evidence", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/generate-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: generate-image-assets\ndescription: Use when /u);
  assert.match(skill, /validate-image-config\.mjs/u);
  assert.match(skill, /capability-probe\.mjs/u);
  assert.match(skill, /selectGenerationJobs/u);
  assert.match(skill, /stable asset IDs?/u);
  assert.match(skill, /OPENAI_API_KEY/u);
  assert.match(skill, /generate-openai-images\.mjs/u);
  assert.match(skill, /OpenAI only|only.*OpenAI/is);
  assert.match(skill, /no.*Codex fallback|never.*fallback/is);
  assert.match(skill, /host image capability/u);
  assert.match(skill, /prompts.*placeholders/is);
  assert.match(skill, /prompt-only/u);
  assert.match(skill, /select.*explicit.*stable/is);
  assert.match(skill, /do not.*model.*quality|must not.*model.*quality/is);
  assert.match(skill, /concept-draft/u);
});

test("Studio review-image-assets requires named human evidence for ordered lifecycle transitions", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/review-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: review-image-assets\ndescription: Use when /u);
  assert.match(skill, /validate-image-assets\.mjs/u);
  assert.match(skill, /applyImageReviewTransition/u);
  assert.match(skill, /stable asset ID/u);
  assert.match(skill, /named human/u);
  assert.match(skill, /actual user.*decision|user.*decision evidence/is);
  assert.match(skill, /concept-draft.*document-approved.*production-candidate/is);
  assert.match(skill, /rights|provenance/is);
  assert.match(skill, /artifact-local evidence|evidence.*artifact/is);
  assert.match(skill, /recommend/u);
  assert.match(skill, /not.*approve|cannot.*approve/is);
  assert.match(skill, /final derivative.*document-approved|document-approved.*final derivative/is);
});

test("Studio routing and specialist roles expose the image workflow without approval authority", async () => {
  const [routingText, orchestrator, artDirector, reviewer] = await Promise.all([
    readFile(path.join(pluginRoot, "references/routing.json"), "utf8"),
    readFile(path.join(pluginRoot, "skills/orchestrate-game-design-project/SKILL.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/art-brief-director.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/visual-asset-reviewer.md"), "utf8"),
  ]);
  const routing = JSON.parse(routingText);

  assert.ok(routing.skillIds.includes("plan-image-assets"));
  assert.ok(routing.skillIds.includes("generate-image-assets"));
  assert.ok(routing.skillIds.includes("review-image-assets"));
  assert.ok(routing.imageSpecialistIds.includes("art-brief-director"));
  assert.ok(routing.imageSpecialistIds.includes("visual-asset-reviewer"));
  assert.ok(routing.plannedPaths.skills.includes("skills/plan-image-assets/SKILL.md"));
  assert.ok(routing.plannedPaths.imageSpecialists.includes("agents/visual-asset-reviewer.md"));
  assert.match(orchestrator, /apply-document-quality-profile.*plan-image-assets/is);
  assert.match(orchestrator, /generate-image-assets.*review-image-assets/is);
  assert.match(artDirector, /purpose.*readability.*prompt.*variant/is);
  assert.match(reviewer, /visual.*accessibility.*rights.*placement/is);
  assert.match(artDirector, /recommend/is);
  assert.match(reviewer, /recommend/is);
  assert.match(`${artDirector}\n${reviewer}`, /not.*approve|cannot.*approve/is);
});

test("Studio executes selected OpenAI workflow into artifact-local prompts, manifest, and selection provenance", async (t) => {
  const root = await workflowRoot(t, "studio-image-workflow-");
  let calls = 0;
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKey: "secret-never-written", apiKeyPresent: true },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-studio-openai", asset_ids: ["hero"] },
    codexCapability: { status: "available" }, now: () => "2026-08-06T00:00:00.000Z", sleepFn: async () => {},
    fetchFn: async () => {
      calls += 1;
      const body = Buffer.from(JSON.stringify({ data: [{ b64_json: png().toString("base64") }] }));
      return { status: 200, headers: { get: (name) => name === "content-length" ? String(body.length) : "req-studio" }, body: { async *[Symbol.asyncIterator]() { yield body; } } };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result.selection, { mode: "select", asset_ids: ["hero"], source: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-studio-openai", asset_ids: ["hero"] } });
  assert.equal(result.manifest.assets[0].generation_state, "generated");
  assert.equal(result.manifest.assets[0].approval_state, "concept-draft");
  assert.equal(JSON.parse(await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).assets[0].generation_state, "generated");
  assert.match(await readFile(path.join(root, "assets/prompts/image-prompts.md"), "utf8"), /Expected count: 1/u);
  assert.equal((await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).includes("secret-never-written"), false);
});

test("Studio review requires an artifact-local host-user receipt rather than an agent decision", async (t) => {
  const root = await workflowRoot(t, "studio-image-review-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "visual.md"), "Named visual review evidence.\n");
  const receipt = {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-studio-1" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "Minji Kim",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/visual.md"],
    evidence_digests: [{ path: "evidence/visual.md", sha256: createHash("sha256").update("Named visual review evidence.\n").digest("hex") }],
  };
  const reviewed = await reviewImageAssetWorkflow({
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "Minji Kim",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/visual.md"], decisionReceipt: receipt,
  });
  assert.equal(reviewed.reviewedAsset.approval_state, "document-approved");
  receipt.capture.channel = "agent-generated";
  await assert.rejects(() => reviewImageAssetWorkflow({
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "Minji Kim",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/visual.md"], decisionReceipt: receipt,
  }), /receipt/i);
});
