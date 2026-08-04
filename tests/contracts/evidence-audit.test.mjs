import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);

test("evidence audit accepts only complete claims with resolvable source IDs", () => {
  const result = spawnSync(process.execPath, ["tooling/audit-evidence.mjs", "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Evidence audit: PASS/);
  assert.match(result.stdout, /orphan source IDs: 0/);
  assert.match(result.stdout, /evergreen: \d+/);
  assert.match(result.stdout, /contextual: \d+/);
  assert.match(result.stdout, /time-sensitive: \d+/);
});
