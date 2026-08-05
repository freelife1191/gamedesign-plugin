import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reviewImageAssetWorkflow, runImageAssetWorkflow } from "../../../shared/scripts/run-image-asset-workflow.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

const profile = {
  profile_id: "career-workflow-test", version: 1, artifact_types: ["design-document"], audiences: ["design"],
  required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "table", section_id: "visuals", columns: ["Signal"] }],
  required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain", alt_text: "Diagram" }],
  required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain", alt_text: "Hero" }], recommended_images: [],
  length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"],
  export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
};
const artifact = { artifact_id: "career-workflow-test", image_needs: [{
  slot_id: "hero", type: "character", scene: "A clear scene.", subject: "A safe silhouette.", composition: "Centered.",
  visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024,
}] };

test("Career plan-image-assets preserves profile slots, count evidence, and Skillstead QA handoff", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/plan-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: plan-image-assets\ndescription: Use when /u);
  assert.match(skill, /apply-document-quality-profile/u);
  assert.match(skill, /required_images|recommended_images/u);
  assert.match(skill, /image-assets\.yml/u);
  assert.match(skill, /image-prompts\.md/u);
  assert.match(skill, /image-prompts\.json/u);
  assert.match(skill, /build-image-asset-plan\.mjs/u);
  assert.match(skill, /compile-image-prompts\.mjs/u);
  assert.match(skill, /stable asset ID|stable asset_id/u);
  assert.match(skill, /explicit (?:asset )?count/u);
  assert.match(skill, /placeholder/u);
  assert.match(skill, /character.*NPC.*monster\/boss.*skill\/VFX.*environment.*item.*UI.*story.*key art.*document.*Skillstead/is);
  assert.match(skill, /SVG.*authority|editable SVG/u);
  assert.match(skill, /title.*desc|<title>.*<desc>/is);
  assert.match(skill, /lint.*render.*QA/is);
  assert.doesNotMatch(skill, /OpenAI|Codex image generation/u);
});

test("Career generate-image-assets uses stable user choices and the configured provider truthfully", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/generate-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: generate-image-assets\ndescription: Use when /u);
  assert.match(skill, /validate-image-config\.mjs/u);
  assert.match(skill, /capability-probe\.mjs/u);
  assert.match(skill, /selectGenerationJobs/u);
  assert.match(skill, /stable asset IDs?/u);
  assert.match(skill, /OPENAI_API_KEY/u);
  assert.match(skill, /generate-openai-images\.mjs/u);
  assert.match(skill, /OpenAI only|only.*OpenAI/is);
  assert.match(skill, /never.*Codex fallback|no.*Codex fallback/is);
  assert.match(skill, /host image capability/u);
  assert.match(skill, /prompts.*placeholders/is);
  assert.match(skill, /prompt-only/u);
  assert.match(skill, /select.*explicit.*stable/is);
  assert.match(skill, /do not.*model.*quality|must not.*model.*quality/is);
  assert.match(skill, /concept-draft/u);
});

test("Career review-image-assets keeps approval with named humans and blocks unapproved derivatives", async () => {
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

test("Career routing and specialist roles expose image workflows without self-approval", async () => {
  const [routingText, orchestrator, artDirector, reviewer] = await Promise.all([
    readFile(path.join(pluginRoot, "references/routing.json"), "utf8"),
    readFile(path.join(pluginRoot, "skills/orchestrate-game-design-career/SKILL.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/art-brief-director.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/visual-asset-reviewer.md"), "utf8"),
  ]);
  const routing = JSON.parse(routingText);

  assert.ok(routing.skillIds.includes("plan-image-assets"));
  assert.ok(routing.skillIds.includes("generate-image-assets"));
  assert.ok(routing.skillIds.includes("review-image-assets"));
  assert.ok(routing.roleIds.includes("art-brief-director"));
  assert.ok(routing.roleIds.includes("visual-asset-reviewer"));
  assert.match(orchestrator, /apply-document-quality-profile.*plan-image-assets/is);
  assert.match(orchestrator, /generate-image-assets.*review-image-assets/is);
  assert.match(artDirector, /purpose.*readability.*prompt.*variant/is);
  assert.match(reviewer, /visual.*accessibility.*rights.*placement/is);
  assert.match(artDirector, /recommend/is);
  assert.match(reviewer, /recommend/is);
  assert.match(`${artDirector}\n${reviewer}`, /not.*approve|cannot.*approve/is);
});

test("Career executes a selected host workflow with truthful unreported applied provenance", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "career-image-workflow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let hostCalls = 0;
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionSource: "user-explicit", codexCapability: { status: "available" },
    hostGenerate: async ({ jobs }) => {
      hostCalls += 1;
      assert.deepEqual(jobs.map(({ asset_id }) => asset_id), ["hero"]);
      return { results: [{ asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } }], failures: [] };
    },
  });

  assert.equal(hostCalls, 1);
  assert.deepEqual(result.selection, { mode: "select", asset_ids: ["hero"], source: "user-explicit" });
  assert.deepEqual(result.manifest.assets[0].provider, {
    name: "codex-host", requested_model: "gpt-image-2", requested_quality: "low", applied_model: null, applied_quality: null,
  });
  assert.equal(JSON.parse(await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).assets[0].generation_state, "generated");
});

test("Career rejects malformed host generation results before updating the manifest", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "career-host-result-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const invalidResults = [
    { results: [], failures: [], extra: true },
    { results: [{ asset_id: "unknown", generation_state: "generated", provenance: { provider: "codex-host" } }], failures: [] },
    { results: [
      { asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } },
      { asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } },
    ], failures: [] },
    { results: [{ asset_id: "hero", generation_state: "generated" }], failures: [] },
  ];
  for (const hostResult of invalidResults) {
    await assert.rejects(() => runImageAssetWorkflow({
      artifactRoot: root, artifact, qualityProfile: profile,
      config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
      selectedAssetIds: ["hero"], selectionSource: "user-explicit", codexCapability: { status: "available" },
      hostGenerate: async () => hostResult,
    }), /Host generation/i);
  }
});

test("Career rejects timestamp-only, nonexistent, and specialist-authored review evidence", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "career-image-review-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "decisions"), { recursive: true });
  const receiptPath = "decisions/user-image-decision.json";
  const receipt = {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-career-1" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "Jae Park",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/missing.md"],
  };
  await writeFile(path.join(root, receiptPath), `${JSON.stringify(receipt)}\n`);
  const input = {
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "Jae Park",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/missing.md"], decisionReceiptPath: receiptPath,
  };
  await assert.rejects(() => reviewImageAssetWorkflow(input), /receipt/i);
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "missing.md"), "Evidence.\n");
  receipt.capture.channel = "specialist-agent";
  await writeFile(path.join(root, receiptPath), `${JSON.stringify(receipt)}\n`);
  await assert.rejects(() => reviewImageAssetWorkflow(input), /receipt/i);
});
