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
  // The floor is set by the slowest whole file rather than the slowest assertion, because node --test
  // reports each file as a test and so applies the ceiling to the file's total runtime. The cap keeps the
  // ceiling well under the workflow lane's own limit, so a hang is reported by name instead of taking the
  // job down with it.
  assert.ok(DEFAULT_TEST_TIMEOUT_MS >= 600_000, "the ceiling must clear the slowest whole file under runner contention, not just the slowest assertion");
  assert.ok(DEFAULT_TEST_TIMEOUT_MS <= 1_800_000, "a ceiling at half the lane's own limit stops being a diagnosis and becomes another silence");
});
