import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("the repository forces LF checkout so Windows clones keep package text auditable", () => {
  const attributes = git(["check-attr", "text", "eol", "--", "README.md"]);
  assert.match(attributes, /README\.md: text: auto/u);
  assert.match(attributes, /README\.md: eol: lf/u);
});

test("every tracked text file is stored and checked out with LF", () => {
  const offenders = git(["ls-files", "--eol"])
    .split("\n")
    .filter(Boolean)
    // `none` is git reporting a file with no line terminator at all — a one-line fixture with no
    // trailing newline. There is no line ending to get wrong, so it is not an offender.
    .filter((line) => !/^i\/(?:lf|none|-text)\s+w\/(?:lf|none|-text)\s/u.test(line));
  assert.deepEqual(offenders, [], "tracked files must be LF, terminator-free, or binary");
});
