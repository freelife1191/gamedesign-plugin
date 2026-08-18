import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FORMAT_RESULT_FILES, SKIPPABLE_STAGES, runSuite } from "../../tooling/validate-suite.mjs";

const expectedStages = [
  "reference drift",
  "evidence audit",
  "vendor hash",
  "update manifest",
  "unit tests",
  "contract tests",
  "product tests",
  "clean build drift",
  "official plugin validators",
  "skill quick validators",
  "isolation smoke",
  "diagram render drift",
  "format smoke",
];

test("suite runs the exact stage order and treats wholly absent Task 11 as incomplete", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-"));
  const calls = [];
  try {
    const result = await runSuite({
      repoRoot: root,
      release: false,
      runCommand: async (stage) => {
        calls.push(stage.name);
        return { status: 0, signal: null };
      },
    });
    assert.deepEqual(calls, expectedStages.slice(0, -1));
    assert.equal(result.ok, true);
    assert.equal(result.releaseReady, false);
    assert.equal(result.formatStatus, "UNAVAILABLE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release suite requires the committed update manifest generator check", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-manifest-"));
  let manifestStage;
  try {
    await runSuite({
      repoRoot: root,
      runCommand: async (stage) => {
        if (stage.name === "update manifest") manifestStage = stage;
        return { status: 0, signal: null };
      },
    });
    assert.deepEqual(manifestStage.command.slice(1), ["tooling/generate-update-manifest.mjs", "--check"]);
    assert.equal(manifestStage.rerun, "node tooling/generate-update-manifest.mjs --check");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release mode fails when Task 11 is unavailable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-release-"));
  try {
    const result = await runSuite({ repoRoot: root, release: true, runCommand: async () => ({ status: 0, signal: null }) });
    assert.equal(result.ok, false);
    assert.equal(result.formatStatus, "UNAVAILABLE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("suite stops on first failure and reports the exact rerun command", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-fail-"));
  const calls = [];
  try {
    const result = await runSuite({
      repoRoot: root,
      runCommand: async (stage) => {
        calls.push(stage.name);
        return stage.name === "contract tests" ? { status: 7, signal: null } : { status: 0, signal: null };
      },
    });
    assert.deepEqual(calls, expectedStages.slice(0, expectedStages.indexOf("contract tests") + 1));
    assert.equal(result.ok, false);
    assert.equal(result.rerun, "npm run test:contracts");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("spawn errors, signals, and null statuses fail closed", async () => {
  for (const outcome of [
    { error: new Error("spawn failed"), status: null, signal: null },
    { status: null, signal: "SIGTERM" },
    { status: null, signal: null },
  ]) {
    const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-process-"));
    try {
      const result = await runSuite({ repoRoot: root, runCommand: async () => outcome });
      assert.equal(result.ok, false);
      assert.equal(result.failedStage, "reference drift");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("partial Task 11 output is a hard failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-partial-"));
  try {
    const target = path.join(root, FORMAT_RESULT_FILES[0]);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "partial\n");
    const result = await runSuite({ repoRoot: root, runCommand: async () => ({ status: 0, signal: null }) });
    assert.equal(result.ok, false);
    assert.equal(result.failedStage, "format smoke");
    assert.equal(result.formatStatus, "FAIL");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("complete Task 11 delegates readiness to the full format regression gate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-format-"));
  let formatStage;
  try {
    for (const relative of FORMAT_RESULT_FILES) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "complete\n");
    }
    const result = await runSuite({
      repoRoot: root,
      runCommand: async (stage) => {
        if (stage.name === "format smoke") formatStage = stage;
        return { status: 0, signal: null };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.releaseReady, true);
    assert.equal(result.formatStatus, "PASS");
    assert.deepEqual(formatStage.command.slice(1), ["tests/formats/run-format-gate.mjs"]);
    assert.equal(formatStage.rerun, "npm run test:formats");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skippable stages are a closed set and a skip is never reported as a pass", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-skip-"));
  const ran = [];
  try {
    const result = await runSuite({
      repoRoot: root,
      skip: [...SKIPPABLE_STAGES],
      runCommand: async (stage) => {
        ran.push(stage.name);
        return { status: 0, signal: null };
      },
    });
    assert.deepEqual([...SKIPPABLE_STAGES], [
      "official plugin validators",
      "skill quick validators",
      "diagram render drift",
      "format smoke",
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.releaseReady, false);
    assert.equal(result.formatStatus, "SKIPPED");
    assert.deepEqual(result.skipped, [...SKIPPABLE_STAGES]);
    for (const skipped of result.skipped) assert.equal(ran.includes(skipped), false);
    assert.deepEqual(ran, expectedStages.filter((stage) => !SKIPPABLE_STAGES.includes(stage)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unknown skip name is refused rather than silently ignored", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-skip-"));
  try {
    await assert.rejects(
      () => runSuite({ repoRoot: root, skip: ["unit tests"], runCommand: async () => ({ status: 0, signal: null }) }),
      /not skippable/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release mode refuses to run with any stage skipped", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-skip-"));
  try {
    await assert.rejects(
      () => runSuite({ repoRoot: root, release: true, skip: ["format smoke"], runCommand: async () => ({ status: 0, signal: null }) }),
      /release runs every stage/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the isolation smoke inherits the official validator's skip rather than failing for the same reason", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "validate-suite-inherit-"));
  const commands = new Map();
  try {
    await runSuite({
      repoRoot: root,
      skip: ["official plugin validators"],
      runCommand: async (stage) => {
        commands.set(stage.name, stage.command);
        return { status: 0, signal: null };
      },
    });
    assert.equal(commands.get("isolation smoke").at(-1), "--allow-missing-official-validator");

    commands.clear();
    await runSuite({
      repoRoot: root,
      runCommand: async (stage) => {
        commands.set(stage.name, stage.command);
        return { status: 0, signal: null };
      },
    });
    assert.equal(
      commands.get("isolation smoke").includes("--allow-missing-official-validator"),
      false,
      "a run that validates for real must not be told the validator may be missing",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
