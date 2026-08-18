import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SKIPPABLE_STAGES } from "../../tooling/validate-suite.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowPath = path.join(repoRoot, ".github/workflows/ci.yml");

// A workflow file is easy to weaken by hand and nothing downstream notices: a deleted matrix entry or a
// widened permission still produces a green check. These assertions are the only thing standing between
// "CI is green" and "CI still runs what the spec says it runs".
test("CI runs both lanes on both operating systems with read-only credentials", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^on:$/mu, "CI must be event-driven, not schedule-only");
  assert.match(workflow, /^  pull_request:$/mu);
  assert.match(workflow, /^  push:$/mu);
  assert.match(workflow, /^permissions:\n  contents: read$/mu, "the workflow must not be able to write to the repository");

  const checkouts = (workflow.match(/actions\/checkout@/gu) ?? []).length;
  assert.equal(checkouts, 2, "each lane checks out exactly once");
  assert.equal(
    (workflow.match(/persist-credentials: false/gu) ?? []).length,
    checkouts,
    "every checkout must drop the credential it would otherwise leave on disk",
  );

  for (const lane of ["offline-gate", "install-gate"]) {
    assert.match(workflow, new RegExp(`^  ${lane}:$`, "mu"), `the ${lane} lane must exist`);
  }
  for (const runner of ["ubuntu-latest", "windows-latest"]) {
    assert.equal(
      (workflow.match(new RegExp(runner, "gu")) ?? []).length,
      2,
      `${runner} must appear once per lane matrix`,
    );
  }
});

test("the offline lane names every stage it skips, and skips only what CI genuinely cannot run", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  const skipped = [...workflow.matchAll(/--skip "([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(
    skipped,
    [...SKIPPABLE_STAGES],
    "the workflow's skip list and the tool's skippable set must be the same closed set",
  );
  assert.match(workflow, /run locally before release/u, "the workflow must say out loud that a skipped stage is still owed");
});

test("the install lane fails rather than skips when codex is missing, and needs no credential", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /install-roundtrip\.mjs --require-codex/u);
  assert.match(workflow, /--codex \.codex-cli\/node_modules\/@openai\/codex\/bin\/codex\.js/u,
    "the gate must run the JavaScript entry point, not a launcher that Windows ships as a .cmd shim");
  assert.match(workflow, /npm install --no-save[^\n]*--prefix \.codex-cli @openai\/codex/u);
  assert.doesNotMatch(workflow, /npm install -g/u, "a global install leaves only a launcher whose path differs per platform");
  assert.doesNotMatch(
    workflow,
    /OPENAI_API_KEY|CODEX_API_KEY|secrets\./u,
    "the install gate calls no model, so it must not read or carry a credential",
  );
});

test("the offline lane stages the vendored Archify rather than weakening the contracts that need it", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /node tooling\/stage-host-archify\.mjs/u);
  // Staging must come before the suite, or the contracts run against a resolver that still sees nothing.
  assert.ok(
    workflow.indexOf("stage-host-archify.mjs") < workflow.indexOf("validate-suite.mjs"),
    "the CLI has to be in place before the stage that resolves it",
  );
});

test("a hung lane fails within the hour and a superseded run is cancelled", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /^concurrency:\n  group: [^\n]+\n  cancel-in-progress: true$/mu);
  const limits = [...workflow.matchAll(/^    timeout-minutes: (\d+)$/gmu)].map((match) => Number(match[1]));
  assert.equal(limits.length, 2, "every lane needs its own ceiling");
  for (const limit of limits) assert.ok(limit > 0 && limit <= 60, `a lane ceiling of ${limit} minutes is not a ceiling`);
});
