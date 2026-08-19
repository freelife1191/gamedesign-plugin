import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { minimalEnvironment } from "../../tooling/isolation-smoke.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// The offline gate ran on Linux alone for one release because the tests and tooling had grown POSIX
// assumptions nobody had counted. Fixing them once buys nothing on its own: the next hardcoded shell path,
// or the next temporary root under a directory Windows does not have, gets written the same way, and the
// Windows half of the lane goes red for a reason that reads like a platform bug rather than a habit. This
// file is what keeps them out.
//
// Each rule below names its allowlist inline, and the allowlist is exact paths, never a prefix or a glob.
// A new file that needs an exemption has to be added here by hand, which is the point — the diff that adds
// it is where the reason gets written down.

const SEARCH_ROOTS = ["tests", "tooling"];

// tests/formats is the format gate: it drives macOS Quick Look and a headless Chromium, `validate-suite`
// records it as SKIPPED on every CI platform including Linux, and its fixtures are shell scripts wrapping
// tools that exist on one operating system. Making it portable would mean porting a macOS-only lane to a
// host that cannot run it, so it is excluded here rather than pretended about. `npm test` walks the whole
// tests tree and therefore still cannot be run end to end on Windows; the shards the offline gate runs can.
const EXCLUDED_DIRECTORIES = new Set([path.join("tests", "formats")]);

const RULES = Object.freeze([
  {
    name: "a POSIX shell named by absolute path",
    pattern: /["'`]\/bin\/(?:sh|bash|zsh|dash|echo|sleep)["'`]/u,
    reason: "Windows has no /bin. Route the call through tests/lib/platform-support.mjs, which returns null "
      + "where no POSIX shell exists so the caller can skip that half by name.",
    allow: new Set([
      // The helper is where the decision lives.
      path.join("tests", "lib", "platform-support.mjs"),
      // findTrustedShells already treats every candidate as optional and returns an empty list when none
      // resolve, which is the correct answer on Windows rather than a failure.
      path.join("tooling", "marketplace-smoke.mjs"),
    ]),
  },
  {
    name: "a binary named by absolute /usr/bin path",
    pattern: /["'`]\/usr\/bin\/[a-z]/u,
    reason: "Windows has no /usr/bin. Put the capability behind tests/lib/platform-support.mjs so the "
      + "platforms that lack it decline the case instead of failing to spawn.",
    allow: new Set([
      path.join("tests", "lib", "platform-support.mjs"),
      // discoverPython walks a candidate list and lstats each one, so a path that does not exist on this
      // host is skipped rather than spawned. The Windows candidate would be a different list, and adding
      // one is a real change; what matters here is that the POSIX entries cannot fail the run.
      path.join("tooling", "isolation-smoke.mjs"),
    ]),
  },
  {
    name: "a temporary root under a hardcoded /tmp",
    pattern: /mkdtemp\(\s*["'`]\/(?:private\/)?tmp/u,
    reason: "/tmp is not a path on Windows and is the same directory as os.tmpdir() on POSIX. Use "
      + "temporaryDirectory() from tests/lib/platform-support.mjs, whose shortOnDarwin option covers the "
      + "one case that genuinely wants the short macOS path.",
    allow: new Set([
      // Guarded by an lstat of the directory that is allowed to fail: the case exists only to exercise a
      // symlink as the very first path segment, which no other host has.
      path.join("tests", "unit", "quality-profile-review-round5.test.mjs"),
    ]),
  },
  {
    name: "a package-manager launcher spawned as a program",
    pattern: /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\(\s*["'`](?:npm|npx|yarn|pnpm)["'`]/u,
    reason: "On Windows these are .cmd shims, and Node refuses to spawn a .cmd without a shell. Spawn the "
      + "script the launcher would have run — process.execPath plus the .mjs — and assert the package.json "
      + "line separately if the wiring is part of the claim.",
    allow: new Set(),
  },
  {
    name: "a raw no-follow or directory open constant",
    pattern: /\bO_(?:NOFOLLOW|DIRECTORY)\b/u,
    reason: "Windows defines neither, and `flags | undefined` is `flags` — so naming the constant does not "
      + "fail, it silently drops the guarantee. Go through shared/scripts/lib/platform-file-hardening.mjs, "
      + "which names win32 as the one exempt platform and keeps every other host failing closed.",
    allow: new Set([
      // The suite that asserts no shipped module names them has to name them to do so.
      path.join("tests", "unit", "platform-file-hardening.test.mjs"),
      // These two read the flag the loader actually passed to their injected open, on the platform the
      // test is running on. They assert about a value the primitive produced rather than producing one,
      // so they carry the same win32 gate the primitive does.
      path.join("tests", "unit", "image-config.test.mjs"),
      path.join("tests", "unit", "workspace-env.test.mjs"),
    ]),
  },
]);

async function sourceFiles() {
  const files = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name, "en"))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(repoRoot, absolute);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || EXCLUDED_DIRECTORIES.has(relative)) continue;
        await walk(absolute);
      } else if (entry.isFile() && /\.(?:mjs|cjs|js)$/u.test(entry.name)) {
        files.push(relative);
      }
    }
  }
  for (const root of SEARCH_ROOTS) await walk(path.join(repoRoot, root));
  return files;
}

test("no test or tool reintroduces a POSIX assumption the Windows lane cannot run", async () => {
  const files = await sourceFiles();
  assert.ok(files.length > 200, `the walk must actually find the tree, found ${files.length}`);

  const violations = [];
  for (const relative of files) {
    const source = await readFile(path.join(repoRoot, relative), "utf8");
    const lines = source.split("\n");
    for (const rule of RULES) {
      if (rule.allow.has(relative)) continue;
      for (let index = 0; index < lines.length; index += 1) {
        if (rule.pattern.test(lines[index])) violations.push(`${relative}:${index + 1}: ${rule.name} — ${rule.reason}`);
      }
    }
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

// An allowlist entry for a file that no longer exists reads as "this exemption is still needed" while
// protecting nothing, and the next person to add an exemption copies it.
test("every named exemption still points at a file that exists and still needs it", async () => {
  const files = new Set(await sourceFiles());
  for (const rule of RULES) {
    for (const relative of rule.allow) {
      assert.ok(files.has(relative), `${relative} is exempted from "${rule.name}" but is not in the searched tree`);
      const source = await readFile(path.join(repoRoot, relative), "utf8");
      assert.ok(
        source.split("\n").some((line) => rule.pattern.test(line)),
        `${relative} is exempted from "${rule.name}" but no longer matches it; drop the exemption`,
      );
    }
  }
});

// The source gate above catches assumptions that are visible in the text. This one is not: the isolation
// smoke hands each package a deliberately minimal environment, and "minimal" is a different set on each
// platform. Naming the POSIX set on Windows leaves out System32, which means nothing starts at all — a
// failure that reads as a broken package rather than as a wrong environment. The function takes the
// platform as an argument precisely so this can be asserted from anywhere.
test("the isolation smoke gives each package the smallest environment that platform can still start in", () => {
  const inputs = { root: "/scratch/root", home: "/scratch/home", codexHome: "/scratch/codex" };

  const posix = minimalEnvironment({ ...inputs, platform: "linux", hostEnv: {} });
  assert.deepEqual(Object.keys(posix).sort(), ["CODEX_HOME", "HOME", "PATH", "TMPDIR"]);
  assert.equal(posix.TMPDIR, inputs.root, "POSIX temp is $TMPDIR");
  assert.ok(posix.PATH.split(path.delimiter).includes("/usr/bin"));

  const windows = minimalEnvironment({ ...inputs, platform: "win32", hostEnv: { SystemRoot: "W:\\Windows" } });
  assert.deepEqual(
    Object.keys(windows).sort(),
    ["CODEX_HOME", "HOME", "PATH", "PATHEXT", "SystemRoot", "TEMP", "TMP", "TMPDIR", "USERPROFILE"],
  );
  // %USERPROFILE% is what os.homedir() reads there, and the C runtime reads %TMP%, not $TMPDIR — both are
  // set, and TMPDIR is kept alongside them so a POSIX-shaped reader inside a package still finds it.
  assert.equal(windows.USERPROFILE, inputs.home);
  assert.equal(windows.TMP, inputs.root);
  assert.equal(windows.TEMP, inputs.root);
  const entries = windows.PATH.split(";");
  assert.ok(entries.includes("W:\\Windows\\System32"), `System32 must be on PATH, got ${windows.PATH}`);
  assert.equal(entries[0], path.dirname(process.execPath), "the Node under test still comes first");
  // The separator is the target platform's. Reading it from the host would produce a colon-joined PATH
  // here and the assertion above would pass for the wrong reason.
  assert.doesNotMatch(windows.PATH.replace(/^[A-Za-z]:|;[A-Za-z]:/gu, ""), /:/u);

  // A host that does not say where Windows is still gets a startable environment rather than an empty one.
  assert.match(minimalEnvironment({ ...inputs, platform: "win32", hostEnv: {} }).PATH, /C:\\Windows\\System32/u);
});
