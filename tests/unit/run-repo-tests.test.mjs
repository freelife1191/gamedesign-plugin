import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

async function writeTest(root, relativePath, marker) {
  const target = path.join(root, relativePath);
  const markerPath = path.join(root, `${marker}.ran`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `import { writeFileSync } from "node:fs"; import test from "node:test"; writeFileSync(${JSON.stringify(markerPath)}, "ran\\n"); test("${marker}", () => {});\n`);
}

async function writeExclusiveTest(root, relativePath, marker, lockPath) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, [
    'import { existsSync, unlinkSync, writeFileSync } from "node:fs";',
    'import test from "node:test";',
    `const lockPath = ${JSON.stringify(lockPath)};`,
    `test(${JSON.stringify(marker)}, () => {`,
    '  if (existsSync(lockPath)) throw new Error("exclusive fixture resource is already in use");',
    '  writeFileSync(lockPath, "locked\\n");',
    '  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); } finally { unlinkSync(lockPath); }',
    '});',
    '',
  ].join("\n"));
}

test("npm test runs only canonical nested tests and excludes copied plugin tests", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "repo-test-runner-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await writeTest(fixture, "tests/top.test.mjs", "CANONICAL_TOP");
  await writeTest(fixture, "tests/nested/deep.test.mjs", "CANONICAL_NESTED");
  await writeTest(fixture, "plugins/game-design-career/skills/vendor/scripts/copied.test.mjs", "COPIED_PLUGIN");

  // `npm test` is the command a person types, and what it resolves to is a line in package.json — so that
  // line is asserted directly and then the runner it names is spawned directly. Going through the npm
  // launcher would add nothing to the claim and would make the test unrunnable on Windows, where npm is a
  // .cmd shim that Node refuses to spawn without a shell.
  const scripts = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")).scripts;
  assert.equal(scripts.test, "node tooling/run-repo-tests.mjs", "npm test must be exactly the runner this test then runs");

  const result = spawnSync(process.execPath, [path.join(repoRoot, "tooling/run-repo-tests.mjs"), "--repo-root", fixture], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  await lstat(path.join(fixture, "CANONICAL_TOP.ran"));
  await lstat(path.join(fixture, "CANONICAL_NESTED.ran"));
  assert.equal(await lstat(path.join(fixture, "COPIED_PLUGIN.ran")).then(() => true, (error) => error.code !== "ENOENT"), false);
});

test("repo test runner rejects symlinks inside the canonical tests tree", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "repo-test-runner-symlink-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await writeTest(fixture, "outside.test.mjs", "OUTSIDE");
  await mkdir(path.join(fixture, "tests"), { recursive: true });
  await symlink(path.join(fixture, "outside.test.mjs"), path.join(fixture, "tests/copied.test.mjs"));

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "tooling/run-repo-tests.mjs"),
    "--repo-root", fixture,
  ], { encoding: "utf8" });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /symlink/i);
  assert.doesNotMatch(result.stdout, /OUTSIDE/u);
});

test("repo test runner serializes canonical fixture files that share an exclusive resource", async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), "repo-test-runner-concurrency-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const lockPath = path.join(fixture, "exclusive.lock");
  await Promise.all([
    writeExclusiveTest(fixture, "tests/first.test.mjs", "FIRST_EXCLUSIVE", lockPath),
    writeExclusiveTest(fixture, "tests/second.test.mjs", "SECOND_EXCLUSIVE", lockPath),
    writeExclusiveTest(fixture, "tests/nested/third.test.mjs", "THIRD_EXCLUSIVE", lockPath),
  ]);

  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "tooling/run-repo-tests.mjs"),
    "--repo-root", fixture,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(await lstat(lockPath).then(() => true, (error) => error.code !== "ENOENT"), false);
});
