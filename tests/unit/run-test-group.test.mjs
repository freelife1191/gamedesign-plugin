import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_TEST_TIMEOUT_MS } from "../../tooling/run-test-group.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// A hung test used to look exactly like a slow one: silence, until CI killed the job an hour later with
// nothing naming the test. The ceiling only applies to tests that declare no timeout of their own, so it
// does not shorten anything the suite legitimately does — it just makes a hang say what it was.
test("the group runner gives every undeclared test a ceiling, so a hang names itself", async () => {
  const source = await readFile(path.join(repoRoot, "tooling/run-test-group.mjs"), "utf8");
  assert.match(source, /"--test",\s*`--test-timeout=\$\{DEFAULT_TEST_TIMEOUT_MS\}`/u);
  assert.ok(DEFAULT_TEST_TIMEOUT_MS >= 120_000, "the ceiling must clear the slowest declared test budget in the suite");
  assert.ok(DEFAULT_TEST_TIMEOUT_MS <= 600_000, "a ceiling above ten minutes stops being a diagnosis and becomes another silence");
});
