import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { MUTATIONS, launchMutationEvidence } from "../fixtures/cutscene/cutscene-mutation-harness.mjs";
import { INHERITED_EXTRA_DESCRIPTORS, NO_INHERITED_EXTRA_DESCRIPTORS_REASON, CHILD_DEADLINE_SCALE } from "../lib/platform-support.mjs";

// This oracle is intentionally independent from the child harness. A worker
// can only prove itself when this parent-owned map catches a changed code/path.
const expected = {
  "approval-authority": { code: "cutscene.approval_capability_invalid", path: "/capability" },
  "approval-binding": { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" },
  "reference-binding": { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" },
  "stage-selection": { code: "cutscene.selected_asset_ids_invalid", path: "/selectedAssetIds" },
  "cost-cap": { code: "cutscene.maximum_possible_cost_exceeded", path: "/cutsceneWorkflow/waves/0/estimate/maximumUsd" },
  "retry-reserve": { code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/1/attempts/3" },
  "mode-boundary": { code: "cutscene.mode_generation_forbidden", path: "/mode" },
  "usage-completeness": { code: "cutscene.usage_input_mismatch", path: "/inputTokens" },
  "continuity-wave-splice": { code: "cutscene.waves_stale", path: "/waves" },
  "continuity-unrelated-manifest": { code: "cutscene.manifest_stale", path: "/manifest" },
  "continuity-receipt-stale": { code: "cutscene.continuity_manifest_stale", path: "/continuityReceipt/manifestSha256" },
};

test("eleven cutscene mutations emit one exact, bounded dedicated-FD record", { timeout: 60_000 * CHILD_DEADLINE_SCALE }, async () => {
  assert.deepEqual(MUTATIONS, Object.keys(expected));
  for (const name of MUTATIONS) {
    const result = await launchMutationEvidence(name);
    assert.equal(result.code, 0, name);
    assert.deepEqual(result.evidence, { name, ...expected[name], providerCalls: 0, writeObserved: false, protocol: "fd-json-v1" });
    assert.match(result.output.stdout, /ignored TAP-like success text/, name);
    assert.match(result.output.stderr, /ignored stderr text/, name);
  }
});

for (const [tamper, reason] of [
  ["inside-wrapper-unrelated-error", "test-exit"], ["forged-stdout-stderr", "evidence-line-count"], ["missing-evidence", "evidence-line-count"], ["duplicate-evidence", "evidence-line-count"], ["partial-evidence", "evidence-line-count"], ["oversize-evidence", "evidence-limit"], ["oversize-output", "output-limit"], ["misleading-output", "evidence-line-count"], ["wrong-env", "evidence-line-count"],
]) test(`dedicated-FD harness fails closed for ${tamper}`, { timeout: 15_000 * CHILD_DEADLINE_SCALE }, async () => {
  await assert.rejects(() => launchMutationEvidence("approval-authority", { tamper }), { reason });
});

function processExists(pid) { try { process.kill(pid, 0); return true; } catch (error) { if (error?.code === "ESRCH") return false; throw error; } }
async function exited(pid) { const deadline = Date.now() + 2_000; while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20)); return !processExists(pid); }
for (const tamper of ["timeout-orphan", "unclosed-evidence-fd"]) test(`process-tree cleanup bounds ${tamper}`, { timeout: 15_000 * CHILD_DEADLINE_SCALE, skip: tamper === "unclosed-evidence-fd" && !INHERITED_EXTRA_DESCRIPTORS ? NO_INHERITED_EXTRA_DESCRIPTORS_REASON : false }, async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "cutscene-mutation-orphan-")); const pidPath = path.join(temporary, "pid"); let pid;
  t.after(async () => { if (pid && processExists(pid)) process.kill(pid, "SIGKILL"); await rm(temporary, { recursive: true, force: true }); });
  await assert.rejects(() => launchMutationEvidence("approval-authority", { tamper, orphanPidPath: pidPath }), { reason: "test-timeout" });
  pid = Number((await readFile(pidPath, "utf8")).trim()); assert.equal(await exited(pid), true, `orphan ${pid} survived cleanup`);
});

test("launcher strips caller NODE_OPTIONS and NODE_PATH injection", { timeout: 15_000 * CHILD_DEADLINE_SCALE }, async () => {
  const priorOptions = process.env.NODE_OPTIONS; const priorPath = process.env.NODE_PATH;
  process.env.NODE_OPTIONS = "--trace-warnings"; process.env.NODE_PATH = "/forged/node-path";
  try { const result = await launchMutationEvidence("approval-authority"); assert.deepEqual(result.evidence, { name: "approval-authority", ...expected["approval-authority"], providerCalls: 0, writeObserved: false, protocol: "fd-json-v1" }); }
  finally { if (priorOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = priorOptions; if (priorPath === undefined) delete process.env.NODE_PATH; else process.env.NODE_PATH = priorPath; }
});
