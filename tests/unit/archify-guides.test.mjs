import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildArchifyGuides,
  buildArchifyWorkflowSpec,
  collectArchifyWorkflows,
  validateArchifyReceipt,
} from "../../tooling/lib/archify-guides.mjs";
import { loadPromptTemplateCatalog } from "../../tooling/lib/prompt-template-catalog.mjs";

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
    optional_outputs: ["decision receipt"],
    extended_outputs: ["evidence summary"],
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

async function treeBytes(root) {
  const result = new Map();
  async function walk(directory, relative = "") {
    for (const item of await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true })) {
      const next = relative ? `${relative}/${item.name}` : item.name;
      const target = path.join(directory, item.name);
      if (item.isDirectory()) await walk(target, next);
      else result.set(next, await readFile(target));
    }
  }
  await walk(root);
  return result;
}

function receipt(specification, artifact, { warnings = 0, checks = 9 } = {}) {
  return JSON.stringify({
    command: "deliver", type: "workflow",
    validation: { checksPassed: checks, checkCount: checks, errors: 0, warnings, compositionProfile: "showcase", compositionStatus: "pass" },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  });
}

function validationReceipt({ warnings = 0, checks = 9 } = {}) {
  return JSON.stringify({
    command: "validate", type: "workflow",
    checks: Array.from({ length: checks }, (_, index) => ({ name: `check-${index}`, ok: true })),
    composition: { profile: "showcase", status: "pass", summary: { errors: 0, warnings } },
  });
}

function fakeCli(calls, { warnings = 0, checks = 9, exitCode = 0, nondeterministic = false, includePaths = false } = {}) {
  let sequence = 0;
  return async (args) => {
    calls.push(args);
    if (exitCode !== 0) return { code: exitCode, stdout: "", stderr: "failed" };
    const command = args[0];
    const specification = await readFile(args[2], "utf8");
    if (command === "validate") return { code: 0, stdout: validationReceipt({ warnings, checks }), stderr: "" };
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
  assert.equal(workflow.nodes.find((node) => node.id === "skill").label, "순서 스킬 체인");
  assert.equal(workflow.edges.find((edge) => edge.id === "resume-skill").label, undefined);
  assert.match(workflow.cards.find((card) => card.title === "순서 스킬 체인").items.join("\n"), /define-game-vision → review-game-design/u);
  assert.deepEqual(
    Object.fromEntries(workflow.nodes.map((node) => [node.id, [node.lane, node.col]])),
    {
      input: ["input-lane", 0], skill: ["execution-lane", 1], artifact: ["execution-lane", 3],
      review: ["review-lane", 4], result: ["result-lane", 5], hold: ["review-lane", 2], resume: ["result-lane", 0],
    },
  );
  for (const left of workflow.nodes) for (const right of workflow.nodes) {
    if (left.id < right.id && left.lane === right.lane) assert.ok(Math.abs(left.col - right.col) >= 2);
  }
});

const normalized = (value) => String(value).replace(/\s+/gu, "");
const visibleWorkflowText = (workflow) => normalized([
  ...workflow.nodes.flatMap((node) => [node.label, node.sublabel]),
  ...workflow.edges.map((edge) => edge.label),
  ...(workflow.cards ?? []).flatMap((card) => [card.title, ...card.items]),
].filter(Boolean).join("\n"));

test("production 50 workflow projections visibly preserve every catalog semantic and resume to active work", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const catalog = await loadPromptTemplateCatalog({ repoRoot });
  const workflows = collectArchifyWorkflows(catalog);
  assert.equal(workflows.length, 50);
  for (const entries of workflows) {
    const workflow = buildArchifyWorkflowSpec(entries);
    assert.ok(Array.isArray(workflow.cards) && workflow.cards.length >= 4, `${entries[0].id} needs visible semantic cards`);
    const visible = visibleWorkflowText(workflow);
    for (const entry of entries) {
      for (const value of [
        ...entry.required_inputs, ...entry.skill_chain, ...entry.specialist_roles,
        ...entry.intermediate_artifacts, ...entry.minimum_outputs, ...entry.optional_outputs,
        ...entry.extended_outputs, entry.human_review_boundary, ...entry.hold_conditions, entry.resume_prompt,
      ]) assert.ok(visible.includes(normalized(value)), `${entry.id} semantic text missing: ${value}`);
    }
    const hold = workflow.nodes.find((node) => node.id === "hold");
    const resume = workflow.nodes.find((node) => node.id === "resume");
    assert.ok(hold && resume);
    assert.ok(workflow.edges.some((edge) => edge.from === hold.id && edge.to === resume.id));
    assert.ok(workflow.edges.some((edge) => edge.from === resume.id && workflow.mainPath.includes(edge.to)));
  }
});

test("receipt validation accepts canonical Archify showcase JSON", () => {
  const specification = "spec";
  const artifact = "html";
  assert.doesNotThrow(() => validateArchifyReceipt({
    command: "validate", type: "workflow",
    checks: Array.from({ length: 9 }, (_, index) => ({ name: `check-${index}`, ok: true })),
    composition: { profile: "showcase", status: "pass", summary: { errors: 0, warnings: 0 } },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  }, { specification, artifact }));
  assert.doesNotThrow(() => validateArchifyReceipt({
    command: "deliver", type: "workflow", validation: { checksPassed: 9, checkCount: 9, errors: 0, warnings: 0, compositionProfile: "showcase", compositionStatus: "pass" },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) },
    artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  }, { specification, artifact }));
});

test("validate and deliver receipts fail closed on false, duplicate, or wrong-quality records", () => {
  const specification = "spec";
  const artifact = "html";
  const validation = {
    command: "validate", type: "workflow", composition: { profile: "showcase", status: "pass", summary: { errors: 0, warnings: 0 } },
    checks: Array.from({ length: 9 }, (_, index) => ({ name: `check-${index}`, ok: true })),
  };
  assert.doesNotThrow(() => validateArchifyReceipt(validation));
  for (const mutation of [
    { ...validation, checks: validation.checks.map((check, index) => index === 0 ? { ...check, ok: false } : check) },
    { ...validation, checks: validation.checks.map((check, index) => index === 8 ? { ...check, name: "check-0" } : check) },
    { ...validation, command: "deliver" },
    { ...validation, composition: { ...validation.composition, profile: "standard" } },
  ]) assert.throws(() => validateArchifyReceipt(mutation), /check|command|showcase/u);
  assert.throws(() => validateArchifyReceipt({
    command: "deliver", type: "workflow", validation: { checksPassed: 9, checkCount: 9, errors: 0, warnings: 0, compositionProfile: "standard" },
    specification: { sha256: digest(specification), bytes: Buffer.byteLength(specification) }, artifact: { sha256: digest(artifact), bytes: Buffer.byteLength(artifact) },
  }, { specification, artifact }), /showcase/u);
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

test("transaction failure hooks restore the exact trusted tree and preserve absence", async (t) => {
  for (const phase of ["backup", "publish", "after-publish", "temp-cleanup", "backup-cleanup"]) {
    await t.test(phase, async (t) => {
      const repoRoot = await repo(t);
      const catalog = { entries: skillEntries() };
      await buildArchifyGuides({ repoRoot, __testCatalog: catalog, runCli: fakeCli([]) });
      const output = path.join(repoRoot, "guides/assets/archify");
      const trusted = await treeBytes(output);
      const hooks = {
        beforeRename: ({ phase: current }) => { if (phase === current) throw new Error(`${phase} failure`); },
        afterPublish: () => { if (phase === "after-publish") throw new Error(`${phase} failure`); },
        beforeTempCleanup: () => { if (phase === "temp-cleanup") throw new Error(`${phase} failure`); },
        beforeBackupCleanup: () => { if (phase === "backup-cleanup") throw new Error(`${phase} failure`); },
      };
      await assert.rejects(() => buildArchifyGuides({ repoRoot, __testCatalog: catalog, runCli: fakeCli([]), __testHooks: hooks }), /failure/u);
      assert.deepEqual(await treeBytes(output), trusted);
    });
  }
  const repoRoot = await repo(t);
  await assert.rejects(() => buildArchifyGuides({ repoRoot, __testCatalog: { entries: skillEntries() }, runCli: fakeCli([]), __testHooks: { afterPublish: () => { throw new Error("absent failure"); } } }), /absent failure/u);
  await assert.rejects(() => lstat(path.join(repoRoot, "guides/assets/archify/manifest.json")), { code: "ENOENT" });
});
