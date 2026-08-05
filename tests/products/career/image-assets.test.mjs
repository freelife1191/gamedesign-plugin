import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateImageAssetWorkflow,
  planImageAssetWorkflow as planImageAssetWorkflowBase,
  reviewImageAssetWorkflow,
  runConfiguredImageAssetWorkflow,
  runImageAssetWorkflow as runImageAssetWorkflowBase,
} from "../../../shared/scripts/run-image-asset-workflow.mjs";

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
const patternNames = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
const injectedPatternCatalog = Object.fromEntries(await Promise.all(patternNames.map(async (name) => [
  name,
  JSON.parse(await readFile(path.join(repoRoot, "shared/image-assets/prompt-patterns", `${name}.json`), "utf8")),
])));
const planImageAssetWorkflow = (options) => planImageAssetWorkflowBase({ ...options, patternCatalog: options?.patternCatalog ?? injectedPatternCatalog });
const runImageAssetWorkflow = (options) => runImageAssetWorkflowBase({ ...options, patternCatalog: options?.patternCatalog ?? injectedPatternCatalog });

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

test("Career source workflow requires an explicitly injected prompt catalog", async (t) => {
  const root = await workflowRoot(t, "career-packaged-catalog-");

  await assert.rejects(() => planImageAssetWorkflowBase({ artifactRoot: root, artifact, qualityProfile: profile }), /ENOENT|prompt-patterns/u);
});

test("Career replanning preserves active disposition when canonical compiled prompts are unchanged", async (t) => {
  const root = await workflowRoot(t, "career-replan-prompts-");
  const first = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  const second = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile, existingManifest: first.manifest });
  assert.equal(second.manifest.assets[0].planning.disposition, "active");
  assert.equal(second.manifest.assets[0].prompt, first.manifest.assets[0].prompt);
  assert.equal(second.manifest.assets[0].prompt_digest, first.manifest.assets[0].prompt_digest);
});

test("Career replanning requires review when the prior compiled prompt binding differs", async (t) => {
  const root = await workflowRoot(t, "career-replan-prompt-change-");
  const first = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  const changed = structuredClone(first.manifest);
  changed.assets[0].prompt = "Purpose and medium: changed compiled prompt.";
  changed.assets[0].prompt_digest = createHash("sha256").update(changed.assets[0].prompt).digest("hex");
  const next = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile, existingManifest: changed });
  assert.equal(next.manifest.assets[0].planning.disposition, "replan-review-required");
});

test("Career generate-image-assets uses stable user choices and the configured provider truthfully", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/generate-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: generate-image-assets\ndescription: Use when /u);
  assert.match(skill, /runConfiguredImageAssetWorkflow/u);
  assert.match(skill, /toPublicImageConfig/u);
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
  assert.ok(routing.imageSpecialistIds.includes("art-brief-director"));
  assert.ok(routing.imageSpecialistIds.includes("visual-asset-reviewer"));
  assert.match(orchestrator, /apply-document-quality-profile.*plan-image-assets/is);
  assert.match(orchestrator, /generate-image-assets.*review-image-assets/is);
  assert.match(artDirector, /purpose.*readability.*prompt.*variant/is);
  assert.match(reviewer, /visual.*accessibility.*rights.*placement/is);
  assert.match(artDirector, /recommend/is);
  assert.match(reviewer, /recommend/is);
  assert.match(`${artDirector}\n${reviewer}`, /not.*approve|cannot.*approve/is);
});

test("Career executes a selected host workflow with truthful unreported applied provenance", async (t) => {
  const root = await workflowRoot(t, "career-image-workflow-");
  let hostCalls = 0;
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-career-host", asset_ids: ["hero"] }, codexCapability: { status: "available" },
    hostGenerate: async (input) => {
      assert.deepEqual(Object.keys(input), ["jobs"]);
      const { jobs } = input;
      hostCalls += 1;
      assert.deepEqual(jobs.map(({ asset_id }) => asset_id), ["hero"]);
      assert.doesNotMatch(jobs[0].prompt, /Prompt package required/u);
      const bytes = png();
      assert.equal(Object.hasOwn(jobs[0].output, "path"), false);
      return { results: [{ asset_id: "hero", generation_state: "generated", bytes, provenance: {
        provider: "codex-host", prompt_digest: createHash("sha256").update(jobs[0].prompt).digest("hex"),
      } }], failures: [] };
    },
  });

  assert.equal(hostCalls, 1);
  assert.deepEqual(result.selection, { mode: "select", asset_ids: ["hero"], source: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-career-host", asset_ids: ["hero"] } });
  assert.deepEqual(result.manifest.assets[0].provider, {
    name: "codex-host", requested_model: "gpt-image-2", requested_quality: "low", applied_model: null, applied_quality: null,
  });
  const currentReceipt = result.manifest.assets[0].generation_receipts.at(-1);
  assert.match(currentReceipt.path, /^assets\/receipts\/image-generation-hero-[A-Za-z0-9._-]+\.json$/u);
  const generationReceipt = JSON.parse(await readFile(path.join(root, currentReceipt.path), "utf8"));
  assert.deepEqual(Object.keys(generationReceipt).sort(), [
    "applied_model", "applied_quality", "asset_id", "attempt_id", "failure_reason", "generated_at", "kind", "output_digest", "prompt_digest",
    "provider", "request_id", "requested_model", "requested_quality", "reservation_path", "reservation_sha256", "schema_version",
  ]);
  assert.equal(generationReceipt.provider, "codex-host");
  assert.equal(generationReceipt.output_digest, createHash("sha256").update(png()).digest("hex"));
  assert.equal(generationReceipt.failure_reason, null);
  assert.equal(JSON.stringify(generationReceipt).includes("A safe silhouette."), false);
  const reservation = JSON.parse(await readFile(path.join(root, generationReceipt.reservation_path), "utf8"));
  assert.deepEqual(reservation.asset_ids, ["hero"]);
  assert.deepEqual(reservation.prompt_digests, [createHash("sha256").update(result.manifest.assets[0].prompt).digest("hex")]);
  assert.equal(JSON.stringify(reservation).includes(result.manifest.assets[0].prompt), false);
  assert.equal(JSON.stringify(reservation).includes(root), false);
  const promptPackage = JSON.parse(await readFile(path.join(root, "assets/prompts/image-prompts.json"), "utf8"));
  const promptMarkdown = await readFile(path.join(root, "assets/prompts/image-prompts.md"), "utf8");
  const persistedManifest = JSON.parse(await readFile(path.join(root, "assets/image-assets.yml"), "utf8"));
  assert.equal(promptPackage.prompts[0].prompt, result.manifest.assets[0].prompt);
  assert.equal(promptPackage.prompts[0].prompt_digest, result.manifest.assets[0].prompt_digest);
  assert.ok(promptMarkdown.includes(result.manifest.assets[0].prompt));
  assert.equal(persistedManifest.assets[0].prompt, result.manifest.assets[0].prompt);
  assert.equal(persistedManifest.assets[0].prompt_digest, result.manifest.assets[0].prompt_digest);
  assert.equal(generationReceipt.prompt_digest, result.manifest.assets[0].prompt_digest);
  assert.equal(reservation.prompt_digests[0], result.manifest.assets[0].prompt_digest);
  assert.equal(Buffer.isBuffer(result.providerResult.results[0]?.bytes), false);
  assert.equal(Object.hasOwn(result.providerResult.results[0] ?? {}, "bytes"), false);
  assert.doesNotMatch(result.manifest.assets[0].prompt, /Prompt package required/u);
  assert.equal(JSON.parse(await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).assets[0].generation_state, "generated");
});

test("Career configured workflow keeps the private OpenAI key internal while routing the compiled prompt", async (t) => {
  const root = await workflowRoot(t, "career-configured-openai-");
  const secret = "configured-openai-secret";
  await writeFile(path.join(root, ".env"), `IMAGE_GEN_MODE=select\nOPENAI_API_KEY=${secret}\n`);
  let observed;
  const result = await runConfiguredImageAssetWorkflow({
    workspaceRoot: await realpath(root), env: {}, artifactRoot: root, artifact, qualityProfile: profile, patternCatalog: injectedPatternCatalog,
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-configured-openai", asset_ids: ["hero"] },
    sleepFn: async () => {},
    fetchFn: async (_url, options) => {
      observed = options;
      const body = Buffer.from(JSON.stringify({ data: [{ b64_json: png().toString("base64") }] }));
      return { status: 200, headers: { get: (name) => name === "content-length" ? String(body.length) : "request-configured-openai" }, body: { async *[Symbol.asyncIterator]() { yield body; } } };
    },
  });
  assert.equal(observed.headers.Authorization, `Bearer ${secret}`);
  assert.equal(JSON.parse(observed.body).prompt, result.manifest.assets[0].prompt);
  assert.equal(result.config.apiKeyPresent, true);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal((await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).includes(secret), false);
  assert.equal((await readFile(path.join(root, result.manifest.assets[0].generation_receipts.at(-1).path), "utf8")).includes(secret), false);
});

test("Career public-only OpenAI configuration fails before any provider call", async (t) => {
  const root = await workflowRoot(t, "career-public-openai-");
  let calls = 0;
  await assert.rejects(() => runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile, config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: true },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-public-openai", asset_ids: ["hero"] },
    generateOpenAIImagesFn: async () => { calls += 1; return { results: [], failures: [] }; },
  }), /API key/i);
  assert.equal(calls, 0);
});

test("Career host generation preflights final outputs and exposes no final path", async (t) => {
  const root = await workflowRoot(t, "career-host-staging-");
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  await mkdir(path.join(root, "assets", "generated"), { recursive: true });
  const finalPath = path.join(root, planned.manifest.assets[0].output.path);
  await writeFile(finalPath, "sentinel\n");
  let hostCalls = 0;
  await assert.rejects(() => generateImageAssetWorkflow({
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, selectedAssetIds: ["hero"],
    selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-host-staging", asset_ids: ["hero"] },
    codexCapability: { status: "available" },
    hostGenerate: async ({ jobs }) => {
      hostCalls += 1;
      assert.equal(Object.hasOwn(jobs[0].output, "path"), false);
      return { results: [], failures: [] };
    },
  }), /output|exists|unsafe/i);
  assert.equal(hostCalls, 0);
  assert.equal(await readFile(finalPath, "utf8"), "sentinel\n");
});

test("Career host generation rejects a symlinked final destination before the callback", async (t) => {
  const root = await workflowRoot(t, "career-host-symlink-");
  const outside = await workflowRoot(t, "career-host-symlink-outside-");
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  await mkdir(path.join(root, "assets", "generated"), { recursive: true });
  const outsideTarget = path.join(outside, "sentinel.png");
  await writeFile(outsideTarget, "outside-sentinel\n");
  await symlink(outsideTarget, path.join(root, planned.manifest.assets[0].output.path));
  let hostCalls = 0;
  await assert.rejects(() => generateImageAssetWorkflow({
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, selectedAssetIds: ["hero"],
    selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-host-symlink", asset_ids: ["hero"] },
    codexCapability: { status: "available" }, hostGenerate: async () => { hostCalls += 1; return { results: [], failures: [] }; },
  }), /output|unsafe|staging/i);
  assert.equal(hostCalls, 0);
  assert.equal(await readFile(outsideTarget, "utf8"), "outside-sentinel\n");
});

test("Career requires closed host-user selection evidence before invoking a selected host provider", async (t) => {
  const root = await workflowRoot(t, "career-selection-receipt-");
  let hostCalls = 0;
  for (const selectionReceipt of [
    undefined,
    { kind: "host-user-image-selection", channel: "agent-generated", event_id: "evt-1", asset_ids: ["hero"] },
    { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-1", asset_ids: [] },
    { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-1", asset_ids: ["hero", "hero"] },
    { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-1", asset_ids: ["other"] },
  ]) {
    await assert.rejects(() => runImageAssetWorkflow({
      artifactRoot: root, artifact, qualityProfile: profile,
      config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
      selectedAssetIds: ["hero"], selectionReceipt, codexCapability: { status: "available" },
      hostGenerate: async () => {
        hostCalls += 1;
        return { results: [{ asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } }], failures: [] };
      },
    }), /selection/i);
  }
  assert.equal(hostCalls, 0);
});

test("Career reserves a selection event before one of two concurrent host providers can run", async (t) => {
  const root = await workflowRoot(t, "career-selection-replay-");
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  const selectionReceipt = { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-replay", asset_ids: ["hero"] };
  let hostCalls = 0;
  const invoke = () => generateImageAssetWorkflow({
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, selectedAssetIds: ["hero"], selectionReceipt,
    codexCapability: { status: "available" }, hostGenerate: async () => {
      hostCalls += 1;
      return { results: [], failures: [] };
    },
  });
  const settled = await Promise.allSettled([invoke(), invoke()]);
  assert.ok(settled.some(({ status }) => status === "rejected"));
  assert.equal(hostCalls, 1);
});

test("Career retains an attempted selection receipt after a host failure and never replays it", async (t) => {
  const root = await workflowRoot(t, "career-selection-attempt-");
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  const selectionReceipt = { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-attempted", asset_ids: ["hero"] };
  let hostCalls = 0;
  const invoke = () => generateImageAssetWorkflow({
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, selectedAssetIds: ["hero"], selectionReceipt,
    codexCapability: { status: "available" }, hostGenerate: async () => {
      hostCalls += 1;
      throw new Error("host unavailable");
    },
  });
  const failed = await invoke();
  assert.equal(failed.manifest.assets[0].generation_state, "generation-failed");
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "assets", "prompts", "image-generation-selection-evt-attempted.json"), "utf8")), {
    mode: "select", asset_ids: ["hero"], source: selectionReceipt,
  });
  await assert.rejects(invoke(), /already exists/i);
  assert.equal(hostCalls, 1);
});

test("Career records every omitted host job as an explicit failed decision", async (t) => {
  const root = await workflowRoot(t, "career-host-omitted-");
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-omitted", asset_ids: ["hero"] },
    codexCapability: { status: "available" }, hostGenerate: async () => ({ results: [], failures: [] }),
  });
  assert.equal(result.manifest.assets[0].generation_state, "generation-failed");
  assert.equal(result.manifest.assets[0].provider.name, "codex-host");
});

test("Career rejects host failure records that inject a generated state", async (t) => {
  const root = await workflowRoot(t, "career-host-failure-state-");
  await assert.rejects(() => runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-failure-state", asset_ids: ["hero"] },
    codexCapability: { status: "available" }, hostGenerate: async () => ({
      results: [], failures: [{ asset_id: "hero", generation_state: "generated", reason: "forged-success" }],
    }),
  }), /failure/i);
});

test("Career never writes workflow files through symlinked artifact roots, ancestors, or targets", async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), "career-workflow-write-"));
  const outside = await mkdtemp(path.join(tmpdir(), "career-workflow-outside-"));
  t.after(() => Promise.all([rm(parent, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  const root = path.join(parent, "artifact");
  await mkdir(root);
  const run = () => planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });

  await writeFile(path.join(outside, "image-assets.yml"), "outside-root-sentinel\n");
  await symlink(outside, path.join(root, "assets"));
  await assert.rejects(run(), /unsafe|symlink/i);
  assert.equal(await readFile(path.join(outside, "image-assets.yml"), "utf8"), "outside-root-sentinel\n");
  await rm(path.join(root, "assets"));

  await mkdir(path.join(root, "assets", "prompts"), { recursive: true });
  await writeFile(path.join(outside, "target.txt"), "outside-target-sentinel\n");
  await symlink(path.join(outside, "target.txt"), path.join(root, "assets", "image-assets.yml"));
  await assert.rejects(run(), /unsafe|symlink/i);
  assert.equal(await readFile(path.join(outside, "target.txt"), "utf8"), "outside-target-sentinel\n");
});

test("Career does not publish a corrupt host PNG", async (t) => {
  const root = await workflowRoot(t, "career-host-output-");
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-host-output", asset_ids: ["hero"] },
    codexCapability: { status: "available" },
    hostGenerate: async ({ jobs }) => ({ results: [{ asset_id: "hero", generation_state: "generated", bytes: Buffer.from("not-a-png"),
      provenance: { provider: "codex-host", prompt_digest: createHash("sha256").update(jobs[0].prompt).digest("hex") } }], failures: [] }),
  });
  assert.equal(result.manifest.assets[0].generation_state, "qa-failed");
  assert.equal(result.manifest.assets[0].provider.name, "codex-host");
  await assert.rejects(readFile(path.join(root, "assets/generated/hero.png")));
});

test("Career marks corrupt or mismatched-prompt host outputs as QA failures", async (t) => {
  for (const [name, resultFor] of [
    ["corrupt", () => ({ bytes: Buffer.from("not-a-png"), prompt_digest: undefined })],
    ["wrong prompt", () => ({ bytes: png(), prompt_digest: "0".repeat(64) })],
  ]) {
    const root = await workflowRoot(t, `career-host-${name}-`);
    const result = await runImageAssetWorkflow({
      artifactRoot: root, artifact, qualityProfile: profile,
      config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
      selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: `evt-${name.replace(" ", "-")}`, asset_ids: ["hero"] },
      codexCapability: { status: "available" },
      hostGenerate: async ({ jobs }) => {
        const job = jobs[0];
        const fixture = resultFor(job);
        return { results: [{ asset_id: job.asset_id, generation_state: "generated", bytes: fixture.bytes, provenance: {
          provider: "codex-host", prompt_digest: fixture.prompt_digest ?? createHash("sha256").update(job.prompt).digest("hex"),
        } }], failures: [] };
      },
    });
    assert.equal(result.manifest.assets[0].generation_state, "qa-failed", name);
  }
});

test("Career review accepts only a host-supplied receipt object, not an arbitrary disk receipt", async (t) => {
  const root = await workflowRoot(t, "career-receipt-boundary-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "evidence"));
  await writeFile(path.join(root, "evidence", "review.md"), "Human evidence.\n");
  await writeFile(path.join(root, "decisions", "image-review-evt-disk.json"), JSON.stringify({
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-disk" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "Minji Kim",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/review.md"],
    evidence_digests: [{ path: "evidence/review.md", sha256: createHash("sha256").update("Human evidence.\n").digest("hex") }],
  }));
  await assert.rejects(() => reviewImageAssetWorkflow({
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "Minji Kim",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/review.md"],
  }), /receipt/i);
});

test("Career rejects malformed host generation results before updating the manifest", async (t) => {
  const root = await workflowRoot(t, "career-host-result-");
  const invalidResults = [
    { results: [], failures: [], extra: true },
    { results: [{ asset_id: "unknown", generation_state: "generated", provenance: { provider: "codex-host" } }], failures: [] },
    { results: [{ asset_id: "hero", generation_state: "generated", bytes: png(), provenance: { provider: "codex-host", prompt_digest: "0".repeat(64) }, unexpected: true }], failures: [] },
    { results: [
      { asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } },
      { asset_id: "hero", generation_state: "generated", provenance: { provider: "codex-host" } },
    ], failures: [] },
    { results: [{ asset_id: "hero", generation_state: "generated" }], failures: [] },
  ];
  for (const [index, hostResult] of invalidResults.entries()) {
    await assert.rejects(() => runImageAssetWorkflow({
      artifactRoot: root, artifact, qualityProfile: profile,
      config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
      selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: `evt-malformed-${index}`, asset_ids: ["hero"] }, codexCapability: { status: "available" },
      hostGenerate: async () => hostResult,
    }), /Host generation/i);
  }
});

test("Career rejects timestamp-only, nonexistent, and specialist-authored review evidence", async (t) => {
  const root = await workflowRoot(t, "career-image-review-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  const receipt = {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-career-1" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "Jae Park",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/missing.md"],
  };
  const input = {
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "Jae Park",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/missing.md"], decisionReceipt: receipt,
  };
  await assert.rejects(() => reviewImageAssetWorkflow(input), /receipt/i);
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "missing.md"), "Evidence.\n");
  receipt.capture.channel = "specialist-agent";
  await assert.rejects(() => reviewImageAssetWorkflow(input), /receipt/i);
});

test("Career rejects product specialist IDs as user decision reviewers", async (t) => {
  const root = await workflowRoot(t, "career-agent-review-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "review.md"), "Human evidence.\n");
  const decisionReceipt = {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-agent-review" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "visual-asset-reviewer",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/review.md"],
    evidence_digests: [{ path: "evidence/review.md", sha256: createHash("sha256").update("Human evidence.\n").digest("hex") }],
  };
  await assert.rejects(() => reviewImageAssetWorkflow({
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "visual-asset-reviewer",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/review.md"], decisionReceipt,
  }), /reviewer|human/i);
});

test("Career canonicalizes reviewer input before rejecting specialist aliases", async (t) => {
  const root = await workflowRoot(t, "career-reviewer-canonical-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "evidence"));
  await writeFile(path.join(root, "evidence", "review.md"), "Human evidence.\n");
  for (const [index, reviewer] of [
    " visual-asset-reviewer ", "VISUAL-ASSET-REVIEWER", " Art-Brief-Director ", "visual_asset_reviewer", "Visual Asset Reviewer", "VISUALASSETREVIEWER",
    "visual‐asset‐reviewer", "visual∕asset∕reviewer", "visual／asset／reviewer", "visual＿asset＿reviewer",
  ].entries()) {
    const decisionReceipt = {
      schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: `evt-reviewer-${index}` },
      asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer,
      decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/review.md"],
      evidence_digests: [{ path: "evidence/review.md", sha256: createHash("sha256").update("Human evidence.\n").digest("hex") }],
    };
    await assert.rejects(() => reviewImageAssetWorkflow({
      artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer,
      reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/review.md"], decisionReceipt,
    }), /reviewer|human/i);
  }
});

test("Career host results accept only closed safe provenance and preserve actual applied settings", async (t) => {
  const root = await workflowRoot(t, "career-host-closed-result-");
  const secret = "host-result-secret-never-persist";
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  const options = {
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-closed-host", asset_ids: ["hero"] },
    codexCapability: { status: "available" },
  };
  await assert.rejects(() => generateImageAssetWorkflow({ ...options, hostGenerate: async () => ({
    results: [], failures: [{ asset_id: "hero", generation_state: "generation-failed", reason: "host-reported-failure", provenance: { provider: "codex-host" }, secret }],
  }) }), /Host generation/i);
  assert.equal(JSON.stringify(await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).includes(secret), false);

  const root2 = await workflowRoot(t, "career-host-applied-");
  const next = await runImageAssetWorkflow({
    artifactRoot: root2, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-applied-host", asset_ids: ["hero"] }, codexCapability: { status: "available" },
    hostGenerate: async ({ jobs }) => {
      const job = jobs[0]; const bytes = png();
      return { results: [{ asset_id: job.asset_id, generation_state: "generated", bytes, provenance: {
        provider: "codex-host", prompt_digest: createHash("sha256").update(job.prompt).digest("hex"),
        applied_model: "host-image-v3", applied_quality: "high",
      } }], failures: [] };
    },
  });
  assert.deepEqual(next.manifest.assets[0].provider, { name: "codex-host", requested_model: "gpt-image-2", requested_quality: "low", applied_model: "host-image-v3", applied_quality: "high" });
});

test("Career records a redacted failure manifest when a selected host callback throws", async (t) => {
  const root = await workflowRoot(t, "career-host-throw-");
  const secret = "throw-secret-never-persist";
  const result = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    selectedAssetIds: ["hero"], selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-host-throw", asset_ids: ["hero"] }, codexCapability: { status: "available" },
    hostGenerate: async () => { throw new Error(secret); },
  });
  assert.equal(result.manifest.assets[0].generation_state, "generation-failed");
  assert.deepEqual(result.manifest.assets[0].provider, { name: "codex-host", requested_model: "gpt-image-2", requested_quality: "low", applied_model: null, applied_quality: null });
  const failureReceipt = JSON.parse(await readFile(path.join(root, result.manifest.assets[0].generation_receipts.at(-1).path), "utf8"));
  assert.equal(failureReceipt.failure_reason, "host-callback-failed");
  assert.match(failureReceipt.failure_reason, /^[a-z][a-z0-9-]{0,127}$/u);
  assert.equal(failureReceipt.prompt_digest, createHash("sha256").update(result.manifest.assets[0].prompt).digest("hex"));
  assert.equal(failureReceipt.output_digest, null);
  assert.equal(JSON.stringify(failureReceipt).includes(secret), false);
  assert.equal(JSON.stringify(failureReceipt).includes(result.manifest.assets[0].prompt), false);
  assert.equal(JSON.stringify(failureReceipt).includes(root), false);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal((await readFile(path.join(root, "assets/image-assets.yml"), "utf8")).includes(secret), false);
});

test("Career appends immutable retry attempts and leaves OpenAI failure applied settings unreported", async (t) => {
  const root = await workflowRoot(t, "career-openai-retry-");
  const config = { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: true, apiKey: "test-only-key" };
  let openAiCalls = 0;
  const openAiFailure = async ({ jobs }) => { openAiCalls += 1; return { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-failed", reason: "provider-request-failed" })) }; };
  const first = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile, config, selectedAssetIds: ["hero"],
    selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-openai-first", asset_ids: ["hero"] },
    generateOpenAIImagesFn: openAiFailure, attemptIdFactory: () => "attempt-openai-1",
  });
  assert.deepEqual(first.manifest.assets[0].provider, { name: "openai", requested_model: "gpt-image-2", requested_quality: "low", applied_model: null, applied_quality: null });
  const firstReceipt = JSON.parse(await readFile(path.join(root, first.manifest.assets[0].generation_receipts[0].path), "utf8"));
  assert.equal(firstReceipt.applied_model, null);
  assert.equal(firstReceipt.applied_quality, null);

  const second = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile, existingManifest: first.manifest, config, selectedAssetIds: ["hero"],
    selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-openai-second", asset_ids: ["hero"] },
    generateOpenAIImagesFn: openAiFailure, attemptIdFactory: () => "attempt-openai-2",
  });
  assert.deepEqual(second.manifest.assets[0].generation_receipts.map(({ attempt_id }) => attempt_id), ["attempt-openai-1", "attempt-openai-2"]);
  await assert.rejects(() => runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile, existingManifest: first.manifest, config, selectedAssetIds: ["hero"],
    selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-openai-replay", asset_ids: ["hero"] },
    generateOpenAIImagesFn: openAiFailure, attemptIdFactory: () => "attempt-openai-1",
  }), /already exists/i);
  assert.equal(openAiCalls, 2);
});

test("Career permits only one concurrent writer for the same immutable attempt ID", async (t) => {
  const root = await workflowRoot(t, "career-attempt-race-");
  const planned = await planImageAssetWorkflow({ artifactRoot: root, artifact, qualityProfile: profile });
  let providerCalls = 0;
  const options = {
    artifactRoot: root, manifest: planned.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, selectedAssetIds: ["hero"],
    codexCapability: { status: "available" }, attemptIdFactory: () => "attempt-race",
    hostGenerate: async ({ jobs }) => {
      providerCalls += 1;
      return { results: [{ asset_id: "hero", generation_state: "generated", bytes: png(), provenance: {
        provider: "codex-host", prompt_digest: createHash("sha256").update(jobs[0].prompt).digest("hex"),
      } }], failures: [] };
    },
  };
  const attempts = await Promise.allSettled([
    generateImageAssetWorkflow({ ...options, selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-attempt-race-1", asset_ids: ["hero"] } }),
    generateImageAssetWorkflow({ ...options, selectionReceipt: { kind: "host-user-image-selection", channel: "host-user-input", event_id: "evt-attempt-race-2", asset_ids: ["hero"] } }),
  ]);
  assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(attempts.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(providerCalls, 1);
  assert.equal((await readFile(path.join(root, "assets/generated/hero.png"))).equals(png()), true);
  assert.match(attempts.find(({ status }) => status === "rejected").reason.message, /already exists|unsafe/i);
});

test("Career stores the canonical form of a human reviewer", async (t) => {
  const root = await workflowRoot(t, "career-reviewer-human-");
  const { manifest } = await runImageAssetWorkflow({
    artifactRoot: root, artifact, qualityProfile: profile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: false }, codexCapability: { status: "unavailable" },
  });
  await mkdir(path.join(root, "evidence"));
  await writeFile(path.join(root, "evidence", "review.md"), "Human evidence.\n");
  const decisionReceipt = {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: "evt-human-canonical" },
    asset_id: "hero", from_state: "concept-draft", target_state: "document-approved", decision: "approved", reviewer: "Minji Kim",
    decided_at: "2026-08-06T00:00:00Z", rights_decision: "approved", evidence_paths: ["evidence/review.md"],
    evidence_digests: [{ path: "evidence/review.md", sha256: createHash("sha256").update("Human evidence.\n").digest("hex") }],
  };
  const reviewed = await reviewImageAssetWorkflow({
    artifactRoot: root, manifest, assetId: "hero", targetState: "document-approved", reviewer: "  Minji Kim  ",
    reviewedAt: "2026-08-06T00:00:00Z", rightsDecision: "approved", evidencePaths: ["evidence/review.md"], decisionReceipt,
  });
  assert.equal(reviewed.reviewedAsset.reviews.at(-1).reviewer, "Minji Kim");
  assert.equal(JSON.parse(await readFile(path.join(root, reviewed.decisionReceiptPath), "utf8")).reviewer, "Minji Kim");
});
