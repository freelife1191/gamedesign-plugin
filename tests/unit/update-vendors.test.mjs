import assert from "node:assert/strict";
import test from "node:test";

import { REGENERATION, advisoryLines, outdatedIds, parseUpdateVendorsArgs, updateVendors } from "../../tooling/update-vendors.mjs";

const CURRENT = Object.freeze({
  schemaVersion: 1,
  status: "current",
  components: [
    { id: "skillstead", status: "current", installedTag: "svg-infographic/v0.9.0", latestTag: "svg-infographic/v0.9.0", updateAvailable: false },
    { id: "archify", status: "current", installedTag: "v2.14.0", latestTag: "v2.14.0", updateAvailable: false },
    { id: "im-not-ai", status: "current", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false },
  ],
});

const OUTDATED = Object.freeze({
  schemaVersion: 1,
  status: "outdated",
  components: [
    { id: "skillstead", status: "current", installedTag: "svg-infographic/v0.9.0", latestTag: "svg-infographic/v0.9.0", updateAvailable: false },
    { id: "archify", status: "outdated", installedTag: "v2.14.0", latestTag: "v2.15.0", updateAvailable: true },
    { id: "im-not-ai", status: "outdated", installedTag: "v2.3.0", latestTag: "v2.3.2", updateAvailable: true },
  ],
});

const UNKNOWN = Object.freeze({
  schemaVersion: 1,
  status: "unknown",
  components: [
    { id: "skillstead", status: "unknown", installedTag: null, latestTag: null, updateAvailable: false },
    { id: "archify", status: "current", installedTag: "v2.14.0", latestTag: "v2.14.0", updateAvailable: false },
    { id: "im-not-ai", status: "current", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false },
  ],
});

function recorder() {
  const chunks = [];
  return { write: (message) => chunks.push(message), text: () => chunks.join("") };
}

function refuseToRun() {
  return updateVendors({
    check: async () => OUTDATED,
    writeStdout: () => undefined,
    interactive: true,
    ask: async () => {
      throw new Error("the run must not reach the question");
    },
  });
}

test("the advisory names every component, what is installed, and what is available", () => {
  const lines = advisoryLines(OUTDATED);
  assert.match(lines[0], /업데이트가 있습니다/u);
  assert.ok(lines.some((line) => line.includes("archify: v2.14.0 → v2.15.0")), lines.join("\n"));
  assert.ok(lines.some((line) => line.includes("im-not-ai: v2.3.0 → v2.3.2")), lines.join("\n"));
  assert.ok(lines.some((line) => line.includes("skillstead: svg-infographic/v0.9.0 (최신)")), lines.join("\n"));
  assert.deepEqual(outdatedIds(OUTDATED), ["archify", "im-not-ai"]);
});

test("a current suite reports current and asks nothing", async () => {
  const stdout = recorder();
  const result = await updateVendors({
    check: async () => CURRENT,
    writeStdout: stdout.write,
    interactive: true,
    ask: async () => {
      throw new Error("nothing to update, so nothing to ask");
    },
  });
  assert.deepEqual(result, { status: "current", applied: [] });
  assert.match(stdout.text(), /모두 최신입니다/u);
});

test("an unresolved check changes nothing and says so", async () => {
  const stdout = recorder();
  const result = await updateVendors({
    check: async () => UNKNOWN,
    writeStdout: stdout.write,
    interactive: true,
    ask: async () => {
      throw new Error("an unresolved check must never reach the question");
    },
  });
  assert.deepEqual(result, { status: "unknown", applied: [] });
  assert.match(stdout.text(), /확인하지 못했습니다/u);
  assert.match(stdout.text(), /skillstead/u);
});

test("answering no leaves the installation untouched", async () => {
  const stdout = recorder();
  const asked = [];
  const result = await updateVendors({
    check: async () => OUTDATED,
    writeStdout: stdout.write,
    interactive: true,
    ask: async ({ prompt }) => {
      asked.push(prompt);
      return false;
    },
  });
  assert.deepEqual(result, { status: "declined", applied: [], reason: "answered-no" });
  assert.equal(asked.length, 1);
  assert.match(asked[0], /업데이트를 진행할까요\? \[y\/N\]/u);
  assert.match(stdout.text(), /업데이트하지 않았습니다/u);
});

// The upgrade rewrites vendored third-party code. A cron job, a CI step, or a piped invocation has
// nobody to answer for that, so the run stops rather than deciding on an absent person's behalf.
test("a run with nobody to ask stops instead of applying", async () => {
  const stdout = recorder();
  const result = await updateVendors({
    check: async () => OUTDATED,
    writeStdout: stdout.write,
    interactive: false,
    ask: async () => {
      throw new Error("a non-interactive run must never reach the question");
    },
  });
  assert.deepEqual(result, { status: "declined", applied: [], reason: "non-interactive" });
  assert.match(stdout.text(), /승인 없이는 적용하지 않습니다/u);
});

test("--report only reports, even with a terminal to answer on", async () => {
  const stdout = recorder();
  const result = await updateVendors({
    check: async () => OUTDATED,
    reportOnly: true,
    writeStdout: stdout.write,
    interactive: true,
    ask: async () => {
      throw new Error("--report must never reach the question");
    },
  });
  assert.deepEqual(result, { status: "outdated", applied: [] });
  assert.match(stdout.text(), /npm run validate:release/u);
});

test("the question is the only path to an apply", async () => {
  await assert.rejects(refuseToRun, /must not reach the question/u);
});

test("the argument parser accepts only the three documented flags", () => {
  assert.deepEqual(parseUpdateVendorsArgs([]), { assumeYes: false, reportOnly: false, validate: false, from: null });
  assert.deepEqual(parseUpdateVendorsArgs(["--yes", "--validate"]), { assumeYes: true, reportOnly: false, validate: true, from: null });
  assert.deepEqual(parseUpdateVendorsArgs(["--report", "--from", "out.json"]), { assumeYes: false, reportOnly: true, validate: false, from: "out.json" });
  assert.throws(() => parseUpdateVendorsArgs(["--force"]), /Usage/u);
  assert.throws(() => parseUpdateVendorsArgs(["--report", "--yes"]), /cannot be combined/u);
  assert.throws(() => parseUpdateVendorsArgs(["--from"]), /--from needs the path/u);
  // A rendered file is evidence someone else gathered. It may report, and it may not authorize an apply.
  assert.throws(() => parseUpdateVendorsArgs(["--from", "out.json"]), /only for --report/u);
});

// The catalog decides about the packaged mirrors, so it can only be written once the snapshots that
// contain them exist. Getting this order wrong leaves the catalog one release behind, which the
// release gate then reports as drift with no obvious cause.
test("regeneration rewrites the documents, then the packages, then the catalog", () => {
  assert.deepEqual(REGENERATION.map(({ argv }) => argv[0]), [
    "tooling/sync-vendor-references.mjs",
    "tooling/generate-update-manifest.mjs",
    "tooling/build-snapshots.mjs",
    "tooling/sync-vendor-catalog-entries.mjs",
  ]);
});
