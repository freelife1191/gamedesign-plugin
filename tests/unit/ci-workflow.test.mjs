import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { SKIPPABLE_STAGES, STAGE_SHARDS } from "../../tooling/validate-suite.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowPath = path.join(repoRoot, ".github/workflows/ci.yml");

// A workflow file is easy to weaken by hand and nothing downstream notices: a deleted matrix entry or a
// widened permission still produces a green check. These assertions are the only thing standing between
// "CI is green" and "CI still runs what the spec says it runs".
test("CI runs both lanes on read-only credentials it does not leave behind", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^on:$/mu, "CI must be event-driven, not schedule-only");
  assert.match(workflow, /^  pull_request:$/mu);
  assert.match(workflow, /^  push:$/mu);
  assert.match(workflow, /^permissions:\n  contents: read$/mu, "the workflow must not be able to write to the repository");

  const checkouts = (workflow.match(/actions\/checkout@/gu) ?? []).length;
  assert.equal(checkouts, 3, "each lane checks out exactly once");
  assert.equal(
    (workflow.match(/persist-credentials: false/gu) ?? []).length,
    checkouts,
    "every checkout must drop the credential it would otherwise leave on disk",
  );

  for (const lane of ["offline-gate", "windows-hardening-gate", "install-gate"]) {
    assert.match(workflow, new RegExp(`^  ${lane}:$`, "mu"), `the ${lane} lane must exist`);
  }
});

// Each lane runs on the operating systems where its result means something, and the two lanes do not agree
// on what that set is. Asserting a single global runner count would hide exactly the distinction this
// section of CI exists to make, so the assertions below read each lane's own matrix.
function laneBody(workflow, lane) {
  const start = workflow.indexOf(`  ${lane}:\n`);
  assert.notEqual(start, -1, `the ${lane} lane must exist`);
  const rest = workflow.slice(start + lane.length + 4);
  const end = rest.search(/^  [a-z][a-z-]*:$/mu);
  return end === -1 ? rest : rest.slice(0, end);
}

// Reads one matrix axis by name. The offline lane now matrices over two of them at the same indent, so a
// helper that collected every ten-space list item would silently merge the runners with the shard names.
function matrixAxis(workflow, lane, axis) {
  const lines = laneBody(workflow, lane).split("\n");
  const first = lines.findIndex((line) => line === `        ${axis}:`);
  assert.notEqual(first, -1, `the ${lane} lane must matrix over ${axis}`);
  const values = [];
  for (const line of lines.slice(first + 1)) {
    const match = /^ {10}- (\S+)$/u.exec(line);
    if (!match) break;
    values.push(match[1]);
  }
  return values;
}

test("the install lane covers Windows, because proving the Windows byte contract is what it is for", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.deepEqual(matrixAxis(workflow, "install-gate", "os"), ["ubuntu-latest", "windows-latest"]);
});

test("the offline lane runs on Windows too, and says in the file what that took", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.deepEqual(
    matrixAxis(workflow, "offline-gate", "os"),
    ["ubuntu-latest", "windows-latest"],
    "dropping Windows from this lane is a real decision, not a way to make a red run green",
  );
  // A lane that came back after being removed has to carry the reason it came back, or the next person to
  // see it red will remove it again for the reason that no longer applies.
  assert.match(workflow, /POSIX assumptions in the tests and tooling/u, "the file must name what used to keep Windows out of this lane");
  assert.match(
    workflow,
    /platform-file-hardening\.mjs/u,
    "and must say where the two shipped defects were resolved, so the stale reason is not carried forward",
  );
  assert.match(
    workflow,
    /tests\/lib\/platform-support\.mjs/u,
    "and must say where the test-side assumptions were resolved, which is the half that gated this lane",
  );
  assert.match(workflow, /architecture\/plugin-suite\.md/u, "and must point at where the full finding list lives");
});

// The narrow lane exists so that the shipped platform exemptions have Windows evidence that does not
// depend on the whole offline suite being Windows-clean. If it ever collapses into the broad lane it stops
// being that, so its separateness is asserted rather than assumed.
test("the shipped platform exemptions have their own Windows lane, outside the offline gate", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const body = laneBody(workflow, "windows-hardening-gate");
  assert.match(body, /^    runs-on: windows-latest$/mu, "the point of the lane is the operating system it runs on");
  assert.doesNotMatch(body, /strategy:|matrix:/u, "one job, so there is no matrix entry to drop it from");
  assert.match(
    body,
    /node --test tests\/unit\/platform-file-hardening\.test\.mjs/u,
    "the raw runner over the one file, so no stage accounting can turn a miss into a skip",
  );
  assert.doesNotMatch(body, /--skip "/u, "nothing in this lane may be skipped");
});

test("the offline lane's shards are the tool's partition, so no stage falls between two jobs", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.deepEqual(matrixAxis(workflow, "offline-gate", "shard"), Object.keys(STAGE_SHARDS));
  assert.match(workflow, /--shard \$\{\{ matrix\.shard \}\}/u, "the lane has to pass the shard it was given");
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
    workflow.indexOf("stage-host-archify.mjs") < workflow.indexOf("node tooling/validate-suite.mjs"),
    "the CLI has to be in place before the stage that resolves it",
  );
});

test("a hung lane fails within the hour and a superseded run is cancelled", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /^concurrency:\n  group: [^\n]+\n  cancel-in-progress: true$/mu);
  const limits = [...workflow.matchAll(/^    timeout-minutes: (\d+)$/gmu)].map((match) => Number(match[1]));
  assert.equal(limits.length, 3, "every lane needs its own ceiling");
  for (const limit of limits) assert.ok(limit > 0 && limit <= 60, `a lane ceiling of ${limit} minutes is not a ceiling`);
});
