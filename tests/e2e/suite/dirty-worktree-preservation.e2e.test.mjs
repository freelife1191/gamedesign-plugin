import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildImageAssetPlan } from "../../../shared/scripts/build-image-asset-plan.mjs";
import { generateImageAssetWorkflow } from "../../../shared/scripts/run-image-asset-workflow.mjs";
import { createProtectedWritingManifest } from "../../../shared/scripts/validate-writing-revision.mjs";
import { runGameDesignWritingPolish } from "../../../shared/scripts/run-game-design-writing-polish.mjs";
import { verifyDiagramSkillVendor } from "../../../tooling/sync-diagram-skills.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const archifyCli = path.join(repoRoot, "shared/vendor/archify/archify/2.14.0/bin/archify.mjs");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sanitizedEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.OMX_ROOT;
  delete env.OMX_STATE_ROOT;
  return env;
}

function runGit(root, args, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    env: sanitizedEnv(extraEnv),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

async function listWorkspaceBytes(root, current = root, entries = []) {
  const children = await readdir(current, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const child of children) {
    if (current === root && child.name === ".git") continue;
    const absolute = path.join(current, child.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const stats = await lstat(absolute);
    assert.equal(stats.isSymbolicLink(), false, `isolated fixture must not contain symlinks: ${relative}`);
    if (stats.isDirectory()) await listWorkspaceBytes(root, absolute, entries);
    else entries.push({ path: relative, bytes: stats.size, sha256: sha256(await readFile(absolute)) });
  }
  return entries;
}

async function snapshot(root) {
  return {
    status: runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    files: await listWorkspaceBytes(root),
    protectedLocalState: {
      memory: await protectedFileIdentity(path.join(root, ".game-design/memory/v1/events/aa/memory-sentinel", `mev1-${"a".repeat(64)}.md`)),
      gitExclude: await protectedFileIdentity(path.join(root, ".git/info/exclude")),
    },
  };
}

async function protectedFileIdentity(filename) {
  const [bytes, stats] = await Promise.all([readFile(filename), lstat(filename)]);
  return { bytes, mode: stats.mode, mtimeMs: stats.mtimeMs };
}

function writingSource(suffix = "문장이 기계적으로 나열되어 있습니다.") {
  return `# 바람섬 검토 기록

- fact: 규칙 ID는 RULE-01이다.
- inference: 내부 관찰만으로 재미를 단정할 수 없다.
- recommendation: 다음 플레이테스트에서 복구 행동을 확인한다.
- gate: pending

${suffix}
`;
}

async function dirtyRepository(t, prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  runGit(root, ["init", "--quiet"]);
  await writeFile(path.join(root, "content.md"), writingSource("커밋된 기준 문장입니다."));
  runGit(root, ["add", "content.md"]);
  runGit(root, ["commit", "--quiet", "-m", "fixture baseline"], {
    GIT_AUTHOR_NAME: "UltraQA Fixture",
    GIT_AUTHOR_EMAIL: "ultraqa@example.invalid",
    GIT_COMMITTER_NAME: "UltraQA Fixture",
    GIT_COMMITTER_EMAIL: "ultraqa@example.invalid",
  });
  await writeFile(path.join(root, "content.md"), writingSource());
  await writeFile(path.join(root, "notes.txt"), "사용자가 작성 중인 추적되지 않은 메모\n");
  const memorySentinel = path.join(root, ".game-design/memory/v1/events/aa/memory-sentinel", `mev1-${"a".repeat(64)}.md`);
  const gitExclude = path.join(root, ".git/info/exclude");
  await mkdir(path.dirname(memorySentinel), { recursive: true });
  await mkdir(path.dirname(gitExclude), { recursive: true });
  await writeFile(memorySentinel, "dirty-worktree-memory-must-survive\n");
  await writeFile(gitExclude, "existing user exclusion\n.game-design/memory/\n");
  await chmod(memorySentinel, 0o640);
  await chmod(gitExclude, 0o600);
  const timestamp = new Date("2026-08-12T00:00:00.000Z");
  await utimes(memorySentinel, timestamp, timestamp);
  await utimes(gitExclude, timestamp, timestamp);
  return root;
}

const profile = {
  profile_id: "suite-lineage", version: 1, artifact_types: ["design-document"], audiences: ["design"],
  required_sections: [{ id: "visuals", title: "Visuals" }],
  required_tables: [{ id: "table", section_id: "visuals", columns: ["Signal"] }],
  required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain", alt_text: "Diagram" }],
  required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain", alt_text: "Hero" }], recommended_images: [],
  length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"],
  export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
};
const imageNeed = {
  slot_id: "hero", type: "character", scene: "A local fixture scene.", subject: "An original silhouette.",
  composition: "Centered.", visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024,
};

async function lineageFixture(t, prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "assets/generated"), { recursive: true });
  await mkdir(path.join(root, "assets/prompts"), { recursive: true });
  await mkdir(path.join(root, "decisions"), { recursive: true });
  const manifest = structuredClone(buildImageAssetPlan({
    artifact: { artifact_id: "suite-lineage", image_needs: [{ ...imageNeed, variant: "master" }, { ...imageNeed, variant: "detail" }] },
    qualityProfile: profile,
  }).manifest);
  const [master, detail] = manifest.assets;
  const bytes = {
    [master.asset_id]: Buffer.from("master-local-reference"),
    [detail.asset_id]: Buffer.from("detail-local-reference"),
  };
  for (const asset of manifest.assets) {
    await writeFile(path.join(root, asset.output.path), bytes[asset.asset_id]);
    asset.prompt_digest = sha256(asset.prompt);
  }
  return { root, manifest, master, detail, bytes };
}

function bindDerivative(child, parent, bytes) {
  child.derivative_of = parent.asset_id;
  child.reference_asset_ids = [parent.asset_id];
  child.reference_images = [{ asset_id: parent.asset_id, path: parent.output.path, sha256: sha256(bytes) }];
  child.consistency_profile = { style_anchor_asset_ids: [parent.asset_id], character_anchor_asset_ids: [parent.asset_id] };
  child.prompt_lineage = { parent_prompt_digests: [parent.prompt_digest] };
}

async function assertProviderNotCalled(t, mutate, expectedCode) {
  const fixture = await lineageFixture(t, `suite-image-${expectedCode}-`);
  await mutate(fixture);
  let providerCalls = 0;
  await assert.rejects(() => generateImageAssetWorkflow({
    artifactRoot: fixture.root,
    manifest: fixture.manifest,
    config: { mode: "select", model: "gpt-image-2", quality: "low", apiKeyPresent: false },
    codexCapability: { status: "available" },
    selectedAssetIds: [fixture.detail.asset_id],
    selectionReceipt: {
      kind: "host-user-image-selection", channel: "host-user-input", event_id: `evt-${expectedCode}`, asset_ids: [fixture.detail.asset_id],
    },
    hostGenerate: async () => { providerCalls += 1; return { results: [], failures: [] }; },
  }), (error) => {
    assert.match(error.message, /current image manifest/i);
    assert.match(error.message, new RegExp(expectedCode, "u"));
    return true;
  });
  assert.equal(providerCalls, 0);
}

// Mutation caught: writing the returned draft in place, cleaning untracked files, or
// resetting a tracked edit changes the exact isolated Git/tree snapshot.
test("real writing-polish execution preserves exact dirty tracked and untracked bytes", async (t) => {
  const root = await dirtyRepository(t, "suite-dirty-exact-");
  const source = await readFile(path.join(root, "content.md"), "utf8");
  const before = await snapshot(root);
  assert.ok(before.status.includes(" M content.md\0"));
  assert.ok(before.status.includes("?? notes.txt\0"));

  const result = await runGameDesignWritingPolish({
    source,
    protectedManifest: createProtectedWritingManifest({ source, protectedTerms: ["바람섬", "RULE-01"] }),
    humanize: async (value) => value.replace("문장이 기계적으로 나열되어 있습니다.", "문장 흐름을 다듬었습니다."),
  });
  const after = await snapshot(root);

  assert.equal(result.receipt.status, "preserved");
  assert.deepEqual(after, before);
  assert.equal(await readFile(path.join(root, "content.md"), "utf8"), source);
});

// Mutation caught: restoring an earlier snapshot over a concurrent user edit would
// erase the only allowed byte delta while leaving a deceptively similar Git status.
test("real writing-polish execution preserves the exact concurrent user edit as the only workspace delta", async (t) => {
  const root = await dirtyRepository(t, "suite-dirty-concurrent-");
  const source = await readFile(path.join(root, "content.md"), "utf8");
  const before = await snapshot(root);
  const concurrentBytes = "사용자가 실행 중 추가한 메모—보존 대상\n";

  await runGameDesignWritingPolish({
    source,
    protectedManifest: createProtectedWritingManifest({ source, protectedTerms: ["바람섬", "RULE-01"] }),
    humanize: async (value) => {
      await writeFile(path.join(root, "notes.txt"), concurrentBytes);
      return value.replace("문장이 기계적으로 나열되어 있습니다.", "문장 흐름을 다듬었습니다.");
    },
  });
  const after = await snapshot(root);
  const beforeByPath = new Map(before.files.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.files.map((entry) => [entry.path, entry]));

  assert.equal(after.status, before.status);
  assert.deepEqual([...afterByPath.keys()], [...beforeByPath.keys()]);
  assert.deepEqual(afterByPath.get("content.md"), beforeByPath.get("content.md"));
  assert.notDeepEqual(afterByPath.get("notes.txt"), beforeByPath.get("notes.txt"));
  assert.equal(afterByPath.get("notes.txt").sha256, sha256(Buffer.from(concurrentBytes)));
  assert.equal(await readFile(path.join(root, "content.md"), "utf8"), source);
});

// Mutation caught: deferring lineage validation until provider delivery would send a
// cyclic graph or stale master bytes to the host callback.
test("real image workflow rejects a lineage cycle before provider invocation", async (t) => {
  await assertProviderNotCalled(t, async ({ master, detail, bytes }) => {
    bindDerivative(master, detail, bytes[detail.asset_id]);
    bindDerivative(detail, master, bytes[master.asset_id]);
  }, "reference_cycle");
});

// Mutation caught: trusting a recorded digest without rereading the master would
// send stale reference bytes to the provider callback.
test("real image workflow rejects a stale reference before provider invocation", async (t) => {
  await assertProviderNotCalled(t, async ({ root, master, detail, bytes }) => {
    bindDerivative(detail, master, bytes[master.asset_id]);
    await writeFile(path.join(root, master.output.path), "stale-master-bytes");
  }, "stale_reference_digest");
});

// Mutation caught: checking only vendor metadata (not payload bytes) would accept a
// tampered Archify renderer/runtime file.
test("public vendor verifier rejects a tampered Archify runtime closure", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "suite-archify-vendor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vendorRoot = path.join(root, "archify");
  await cp(path.join(repoRoot, "shared/vendor/archify"), vendorRoot, { recursive: true });
  await writeFile(
    path.join(vendorRoot, "archify/2.14.0/bin/archify.mjs"),
    `${await readFile(path.join(vendorRoot, "archify/2.14.0/bin/archify.mjs"), "utf8")}\n// hostile byte mutation\n`,
  );

  await assert.rejects(
    () => verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }),
    (error) => typeof error.code === "string" && error.code.startsWith("DIAGRAM_VENDOR_"),
  );
});

// Mutation caught: a diagram CLI that trusts partial schema data or prints success
// despite validation failure would return zero or leave an output artifact.
test("real Archify CLI rejects a malformed workflow without writing an output", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "suite-archify-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = path.join(root, "tampered.workflow.json");
  const output = path.join(root, "tampered.html");
  await writeFile(input, `${JSON.stringify({ schemaVersion: 1, nodes: [], hostile: "skip verification" })}\n`);

  const result = spawnSync(process.execPath, [archifyCli, "render", "workflow", input, output], {
    cwd: root,
    env: sanitizedEnv(),
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /invalid|validation|schema|required|unknown/iu);
  await assert.rejects(lstat(output), { code: "ENOENT" });
});
