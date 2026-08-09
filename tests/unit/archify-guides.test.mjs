import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildArchifyGuides,
  buildArchifyWorkflowSpec,
  validateArchifyReceipt,
} from "../../tooling/lib/archify-guides.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");

function entry({ id = "studio:define-game-vision:beginner", kind = "skill-template", product = "studio", skill = "define-game-vision", level = "beginner" } = {}) {
  return {
    id, kind, product, skill, level,
    title: "검증 가능한 게임 비전 흐름",
    required_inputs: ["공개 가능한 플레이어 목표"],
    skill_chain: [skill, "review-game-design"],
    specialist_roles: ["lead-game-designer"],
    intermediate_artifacts: ["vision-pillars"],
    minimum_outputs: ["game-design-brief"],
    human_review_boundary: "design owner가 결과를 승인 또는 보류한다.",
    hold_conditions: ["근거가 없으면 보류"],
    resume_prompt: "보존한 근거로 재개한다.",
  };
}

function skillEntries() {
  return ["beginner", "standard", "advanced"].map((level) => entry({ id: `studio:define-game-vision:${level}`, level }));
}

async function repo(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "archify-guides-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "guides", "assets", "archify"), { recursive: true });
  return root;
}

function receipt(specification, artifact, { warnings = 0, checks = 9 } = {}) {
  return JSON.stringify({
    validation: { artifactChecks: Array.from({ length: checks }, (_, index) => ({ id: `check-${index}` })), errors: [], warnings: Array.from({ length: warnings }, () => ({ code: "warning" })) },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  });
}

function fakeCli(calls, { warnings = 0, checks = 9, exitCode = 0, nondeterministic = false, includePaths = false } = {}) {
  let sequence = 0;
  return async (args) => {
    calls.push(args);
    if (exitCode !== 0) return { code: exitCode, stdout: "", stderr: "failed" };
    const command = args[0];
    const specification = await readFile(args[2], "utf8");
    if (command === "validate") return { code: 0, stdout: receipt(specification, "validate", { warnings, checks }), stderr: "" };
    const html = `<!doctype html><title>flow-${nondeterministic ? sequence++ : "stable"}</title>`;
    await writeFile(args[3], html);
    const delivered = JSON.parse(receipt(specification, html, { warnings, checks }));
    if (includePaths) Object.assign(delivered, { input: args[2], output: args[3] });
    return { code: 0, stdout: JSON.stringify(delivered), stderr: "" };
  };
}

test("workflow projection is bounded and keeps the required showcase contract", () => {
  const workflow = buildArchifyWorkflowSpec(skillEntries());
  assert.equal(workflow.schema_version, 1);
  assert.equal(workflow.diagram_type, "workflow");
  assert.equal(workflow.meta.visual_preset, "editorial");
  assert.equal(workflow.meta.quality_profile, "showcase");
  assert.equal(workflow.meta.animation, "none");
  assert.deepEqual(workflow.meta.viewBox, [960, 900]);
  assert.deepEqual(workflow.meta.views.map((view) => view.id), ["beginner", "standard", "advanced"]);
  assert.equal(workflow.nodes.length <= 12, true);
  assert.equal(workflow.mainPath.length >= 2, true);
  for (const view of workflow.meta.views) for (const focus of view.focus) assert.ok(workflow.nodes.some((node) => node.id === focus));
  assert.equal(workflow.nodes.find((node) => node.id === "skill").sublabel, "2개 스킬");
  assert.equal(workflow.nodes.find((node) => node.id === "review").sublabel, "1개 전문 역할");
  assert.deepEqual(
    Object.fromEntries(workflow.nodes.map((node) => [node.id, [node.lane, node.col]])),
    {
      input: ["input-lane", 0], skill: ["execution-lane", 1], artifact: ["execution-lane", 3],
      review: ["review-lane", 4], result: ["result-lane", 5], resume: ["result-lane", 2],
    },
  );
  for (const left of workflow.nodes) for (const right of workflow.nodes) {
    if (left.id < right.id && left.lane === right.lane) assert.ok(Math.abs(left.col - right.col) >= 2);
  }
});

test("receipt validation accepts canonical Archify showcase JSON", () => {
  const specification = "spec";
  const artifact = "html";
  assert.doesNotThrow(() => validateArchifyReceipt({
    checks: Array.from({ length: 9 }, (_, index) => ({ name: `check-${index}`, ok: true })),
    composition: { summary: { errors: 0, warnings: 0 } },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  }, { specification, artifact }));
  assert.doesNotThrow(() => validateArchifyReceipt({
    validation: { checksPassed: 9, checkCount: 9, errors: 0, warnings: 0 },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  }, { specification, artifact }));
});

test("builder uses exact canonical CLI arguments and persists only a verified 9/9 receipt", async (t) => {
  const repoRoot = await repo(t);
  const calls = [];
  const result = await buildArchifyGuides({ repoRoot, __testCatalog: { entries: skillEntries() }, runCli: fakeCli(calls) });
  assert.deepEqual(result, { workflows: 1, checked: false });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 2), ["validate", "workflow"]);
  assert.deepEqual(calls[0].slice(-3), ["--quality", "showcase", "--json"]);
  assert.deepEqual(calls[1].slice(0, 2), ["deliver", "workflow"]);
  assert.deepEqual(calls[1].slice(-3), ["--quality", "showcase", "--json"]);
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/archify/manifest.json"), "utf8"));
  assert.equal(manifest.workflows.length, 1);
  const flow = manifest.workflows[0];
  const [specification, artifact, savedReceipt] = await Promise.all([
    readFile(path.join(repoRoot, flow.spec), "utf8"), readFile(path.join(repoRoot, flow.html), "utf8"), readFile(path.join(repoRoot, flow.receipt), "utf8"),
  ]);
  assert.doesNotThrow(() => validateArchifyReceipt(JSON.parse(savedReceipt), { specification, artifact }));
});

test("fail-closed builder rejects CLI, showcase and digest failures without publication", async (t) => {
  for (const [label, options, match] of [
    ["nonzero", { exitCode: 2 }, /Archify validate failed/u],
    ["warning", { warnings: 1 }, /warnings/u],
    ["basic", { checks: 4 }, /9 artifact checks/u],
  ]) {
    await t.test(label, async (t) => {
      const repoRoot = await repo(t);
      await assert.rejects(() => buildArchifyGuides({ repoRoot, __testCatalog: { entries: skillEntries() }, runCli: fakeCli([], options) }), match);
      await assert.rejects(() => lstat(path.join(repoRoot, "guides/assets/archify/manifest.json")), { code: "ENOENT" });
    });
  }
  assert.throws(() => validateArchifyReceipt(JSON.parse(receipt("spec", "html")), { specification: "changed", artifact: "html" }), /digest mismatch/u);
});

test("check detects drift and symlink outputs; repeated delivery bytes are deterministic", async (t) => {
  const repoRoot = await repo(t);
  const catalog = { entries: skillEntries() };
  const calls = [];
  await buildArchifyGuides({ repoRoot, __testCatalog: catalog, runCli: fakeCli(calls) });
  await buildArchifyGuides({ repoRoot, __testCatalog: catalog, check: true, runCli: fakeCli([]) });
  const manifestPath = path.join(repoRoot, "guides/assets/archify/manifest.json");
  await writeFile(manifestPath, "drift\n");
  await assert.rejects(() => buildArchifyGuides({ repoRoot, __testCatalog: catalog, check: true, runCli: fakeCli([]) }), /drift/u);
  await rm(manifestPath);
  await symlink(path.join(repoRoot, "outside.json"), manifestPath);
  await assert.rejects(() => buildArchifyGuides({ repoRoot, __testCatalog: catalog, runCli: fakeCli([]) }), /symlink/u);
});

test("receipt persists stable repository-relative source and artifact paths", async (t) => {
  const repoRoot = await repo(t);
  const catalog = { entries: skillEntries() };
  await buildArchifyGuides({ repoRoot, __testCatalog: catalog, runCli: fakeCli([], { includePaths: true }) });
  const receiptPath = path.join(repoRoot, "guides/assets/archify/studio/define-game-vision/receipt.json");
  const saved = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(saved.input, "guides/assets/archify/studio/define-game-vision/flow.json");
  assert.equal(saved.output, "guides/assets/archify/studio/define-game-vision/flow.html");
  await buildArchifyGuides({ repoRoot, __testCatalog: catalog, check: true, runCli: fakeCli([], { includePaths: true }) });
});
