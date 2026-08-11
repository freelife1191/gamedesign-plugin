import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const validArtifact = path.join(repoRoot, "tests/fixtures/artifacts/valid");
const stopHookUrl = pathToFileURL(path.join(repoRoot, "plugins/game-design-studio/scripts/stop-artifact-review.mjs"));
const imageRuntimeUrl = pathToFileURL(path.join(repoRoot, "plugins/game-design-studio/scripts/generate-openai-images.mjs"));

function sentinel(relativePath = "artifact") {
  return `<!-- game-design-plugin:artifact ${JSON.stringify({ path: relativePath, formats: ["md"] })} -->`;
}

function stopInput(workspace, overrides = {}) {
  return {
    session_id: "suite-interruption-session",
    transcript_path: "/redacted/transcript.jsonl",
    permission_mode: "default",
    hook_event_name: "Stop",
    cwd: workspace,
    turn_id: "suite-interruption-turn",
    stop_hook_active: false,
    last_assistant_message: `검토 대기 중입니다.\n${sentinel()}`,
    ...overrides,
  };
}

async function workspaceWithInvalidArtifact(t) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "suite-stop-review-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(validArtifact, path.join(workspace, "artifact"), { recursive: true });
  await rm(path.join(workspace, "artifact/evidence.yml"));
  return workspace;
}

function sanitizedEnv() {
  const env = { ...process.env };
  delete env.OMX_ROOT;
  delete env.OMX_STATE_ROOT;
  return env;
}

async function runBoundedNode(args, { cwd, timeoutMs = 250 } = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: sanitizedEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, timeoutMs);
  const completion = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  return { ...completion, stdout, stderr, timedOut, pid: child.pid };
}

function classifyHarnessEvidence(result) {
  if (result.timedOut || result.signal || result.code !== 0) return { ok: false, reason: "process-failure" };
  if (/\b(?:skip(?:ped)?|partial|fail(?:ed|ure)?)\b/iu.test(`${result.stdout}\n${result.stderr}`)) {
    return { ok: false, reason: "incomplete-evidence" };
  }
  return /^ULTRAQA COMPLETE: [^\n]+$/mu.test(result.stdout)
    ? { ok: true, reason: "complete" }
    : { ok: false, reason: "completion-marker-missing" };
}

async function applyLifecycleCommand(stateFile, command, now) {
  // Harness-only evidence: the repository has a Stop hook but no public generic
  // continue/cancel/resume state machine. This fixture must not be reported as
  // product lifecycle coverage.
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  const stale = Date.parse(now) - Date.parse(state.updatedAt) > 60_000;
  if (command === "cancel" || command === "stop" || command === "abort") {
    const next = { ...state, status: "cancelled", updatedAt: now, completed: false };
    await writeFile(stateFile, `${JSON.stringify(next)}\n`);
    return { status: "cancelled", completed: false };
  }
  if (command !== "continue") return { status: "rejected", completed: false };
  if (state.status === "cancelled") return { status: "fresh-run-required", completed: false };
  if (stale) return { status: "stale-state-rejected", completed: false };
  return { status: "resumable", completed: false };
}

// Mutation caught: returning passed/complete after a first corrective request or
// looping forever on repeated Stop events would violate the executable hook result.
test("installed Stop hook bounds repeated continue, stop, and abort wording without false completion", async (t) => {
  const workspace = await workspaceWithInvalidArtifact(t);
  const { reviewStopEvent } = await import(`${stopHookUrl.href}?suite-stop=${Date.now()}-${Math.random()}`);

  for (const wording of ["continue", "continue", "stop", "abort"]) {
    const result = await reviewStopEvent(stopInput(workspace, { last_assistant_message: wording }));
    assert.deepEqual(result, { continue: true, status: "ignored", warnings: [] }, wording);
  }

  const first = await reviewStopEvent(stopInput(workspace));
  const second = await reviewStopEvent(stopInput(workspace, { stop_hook_active: true }));
  const third = await reviewStopEvent(stopInput(workspace, { stop_hook_active: true }));
  assert.equal(first.decision, "block");
  assert.equal(first.status, "corrective-pass-requested");
  assert.equal(second.status, "invalid-after-corrective-pass");
  assert.equal(third.status, "invalid-after-corrective-pass");
  assert.equal("decision" in second, false);
  assert.equal("decision" in third, false);
  assert.equal(first.validation.ok, false);
});

// Harness mutation caught: treating stale/cancelled state as resumable would turn a
// cancelled run into a false success. This is explicitly harness evidence, not a
// claim that the product exposes a generic lifecycle state API.
test("isolated lifecycle harness rejects stale resume and requires a fresh run after cancel", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "suite-lifecycle-harness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stateFile = path.join(root, "state.json");
  await writeFile(stateFile, `${JSON.stringify({ status: "in-progress", updatedAt: "2026-08-11T00:00:00.000Z", completed: false })}\n`);

  const first = await applyLifecycleCommand(stateFile, "continue", "2026-08-11T00:02:00.000Z");
  const second = await applyLifecycleCommand(stateFile, "continue", "2026-08-11T00:02:01.000Z");
  const cancelled = await applyLifecycleCommand(stateFile, "cancel", "2026-08-11T00:02:02.000Z");
  const resumed = await applyLifecycleCommand(stateFile, "continue", "2026-08-11T00:02:03.000Z");

  assert.deepEqual(first, { status: "stale-state-rejected", completed: false });
  assert.deepEqual(second, { status: "stale-state-rejected", completed: false });
  assert.deepEqual(cancelled, { status: "cancelled", completed: false });
  assert.deepEqual(resumed, { status: "fresh-run-required", completed: false });
  assert.equal(JSON.parse(await readFile(stateFile, "utf8")).completed, false);
});

// Mutation caught: clearing the provider timeout after headers (rather than after
// body completion) would hang forever or publish a partial image.
test("installed image reader times out a hung body and leaves no partial output", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "suite-hung-reader-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { generateOpenAIImages } = await import(`${imageRuntimeUrl.href}?suite-reader=${Date.now()}-${Math.random()}`);
  let calls = 0;
  let cancels = 0;
  const startedAt = Date.now();
  const result = await generateOpenAIImages({
    jobs: [{
      asset_id: "hung-reader",
      prompt: "Local no-network timeout fixture.",
      output: { path: "assets/generated/hung-reader.png", width: 1024, height: 1024, format: "png" },
    }],
    apiKey: "local-test-key",
    model: "gpt-image-2",
    quality: "low",
    stagingRoot: root,
    requestTimeoutMs: 10,
    fetchFn: async () => {
      calls += 1;
      return {
        status: 200,
        headers: { get: () => null },
        body: { getReader() { return {
          read() { return new Promise(() => {}); },
          cancel() { cancels += 1; },
          releaseLock() {},
        }; } },
      };
    },
    sleepFn: async () => assert.fail("hung body must not retry"),
  });

  assert.equal(Date.now() - startedAt < 500, true);
  assert.equal(calls, 1);
  assert.equal(cancels, 1);
  assert.deepEqual(result.failures, [{ asset_id: "hung-reader", generation_state: "generation-failed", reason: "provider-timeout", attempts: 1 }]);
  await assert.rejects(lstat(path.join(root, "assets/generated/hung-reader.png")), { code: "ENOENT" });
});

// Harness mutation caught: trusting stdout alone would accept SUCCESS+exit 1,
// skipped tests, partial logs, or a killed child as green evidence.
test("bounded isolated child harness kills hangs and rejects misleading success output", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "suite-bounded-child-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = {
    exitOne: "console.log('ULTRAQA COMPLETE: SUCCESS'); process.exitCode = 1;\n",
    skipped: "console.log('ULTRAQA COMPLETE: skipped 1');\n",
    partial: "console.log('ULTRAQA COMPLETE: partial log');\n",
    hung: "console.log('ULTRAQA COMPLETE: SUCCESS'); setInterval(() => {}, 1000);\n",
    complete: "console.log('ULTRAQA COMPLETE: 4 scenarios passed');\n",
  };
  const files = {};
  for (const [name, source] of Object.entries(scripts)) {
    files[name] = path.join(root, `${name}.mjs`);
    await writeFile(files[name], source);
  }

  const exitOne = await runBoundedNode([files.exitOne], { cwd: root });
  const skipped = await runBoundedNode([files.skipped], { cwd: root });
  const partial = await runBoundedNode([files.partial], { cwd: root });
  const hung = await runBoundedNode([files.hung], { cwd: root, timeoutMs: 100 });
  const complete = await runBoundedNode([files.complete], { cwd: root });

  assert.deepEqual(classifyHarnessEvidence(exitOne), { ok: false, reason: "process-failure" });
  assert.deepEqual(classifyHarnessEvidence(skipped), { ok: false, reason: "incomplete-evidence" });
  assert.deepEqual(classifyHarnessEvidence(partial), { ok: false, reason: "incomplete-evidence" });
  assert.deepEqual(classifyHarnessEvidence(hung), { ok: false, reason: "process-failure" });
  assert.equal(hung.timedOut, true);
  assert.equal(hung.signal, "SIGKILL");
  assert.deepEqual(classifyHarnessEvidence(complete), { ok: true, reason: "complete" });
});
