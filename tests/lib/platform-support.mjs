import { execFileSync, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { posixPermissionBitsMeaningful } from "../../shared/scripts/lib/platform-file-hardening.mjs";

// The suite's own POSIX assumptions, gathered into one place so each is named rather than discovered as
// a failure on a Windows runner. Three of them are the same shape: the test needs a capability the host
// platform decides, and the POSIX spelling of it silently produces the wrong thing on Windows instead of
// producing an error. A hardcoded /bin/sh is not there. A file with a shebang exists, passes an X_OK
// check — Windows grants X_OK to anything readable — and then fails to spawn, so the failure surfaces
// inside the code under test rather than at the fixture that caused it. `chmod` returns success and
// changes nothing, so an assertion about the mode it wrote is asserting about a number Windows synthesises
// from a single read-only attribute.
//
// The rule this file follows: never weaken an assertion to make it pass, and never let a platform skip
// go unnamed. What a platform cannot express is skipped with the reason attached; everything the
// assertion was really about still runs on every platform.

// `posixPermissionBitsMeaningful` is the shipped primitive that decides this for the products; the tests
// ask the same question through the same allowlist so the two can never drift apart.
export const PERMISSION_BITS_MEANINGFUL = posixPermissionBitsMeaningful();

// Several tests use a real POSIX shell as an ORACLE: they need to know what `sh` resolves a hostile
// shell word to before they can assert that the auditor rejects that same word. The assertion under test
// is platform-independent; only the oracle is not. So the oracle becomes optional and the assertion never
// does — see `posixShellFirstWord`.
export const POSIX_SHELL = process.platform === "win32" ? null : "/bin/sh";

export const NO_POSIX_SHELL_REASON = "no POSIX shell on this platform to act as the word-splitting oracle";

// Runs the word through a real `sh` and returns what `sh` makes of it, or null where no POSIX shell
// exists. Null means "this host cannot answer", never "the word resolved to nothing" — callers must
// branch on it rather than compare against it.
export function posixShellFirstWord(shellWord) {
  if (POSIX_SHELL === null) return null;
  const resolved = spawnSync(POSIX_SHELL, ["-c", `set -- ${shellWord}; printf '%s' "$1"`], { encoding: "utf8", shell: false });
  if (resolved.error) throw resolved.error;
  if (resolved.status !== 0) throw new Error(`POSIX shell oracle failed for ${JSON.stringify(shellWord)}: ${resolved.stderr}`);
  return resolved.stdout;
}

// Runs a POSIX shell script and returns the completed process, or null where no POSIX shell exists.
export function runPosixShell(script, options = {}) {
  if (POSIX_SHELL === null) return null;
  return spawnSync(POSIX_SHELL, ["-c", script], { encoding: "utf8", shell: false, ...options });
}

// Bash specifically, for the two READMEs that document a bash recipe and the tests that run it to prove
// the recipe works. `bash -n` is a syntax check with no POSIX-shell equivalent, so these callers need
// bash rather than any shell.
export const POSIX_BASH = process.platform === "win32" ? null : "/bin/bash";

export const NO_POSIX_BASH_REASON = "the documented recipe is a bash command line and this platform has no bash to run it in";

// Runs a bash command line and returns the completed process, or null where no bash exists. Callers
// assert on the README's TEXT unconditionally and only put the EXECUTION behind this, so what is skipped
// on Windows is proof that the recipe runs, never proof that the README says the right thing.
export function runBash(argv, options = {}) {
  if (POSIX_BASH === null) return null;
  return spawnSync(POSIX_BASH, argv, { encoding: "utf8", shell: false, ...options });
}

// A FIFO is a POSIX filesystem entity, and the point of the test that makes one is that the packager
// refuses to walk into an entry that is neither a file nor a directory. Windows has no entry of that shape
// that Node can create, so the case has nothing to build and nothing to assert — which is different from
// the case passing.
export const FIFO_SUPPORTED = process.platform !== "win32";

export function createFifo(target) {
  if (!FIFO_SUPPORTED) return false;
  execFileSync("/usr/bin/mkfifo", [target], { shell: false });
  return true;
}

const CMD_LAUNCHER = (target) => `@echo off\r\nnode "%~dp0${target}" %*\r\n`;

// Writes a program the code under test can spawn by path, in whatever form this platform can actually
// execute. The body is JavaScript in both cases, so the fabricated program has ONE behaviour rather than
// a POSIX one and a Windows one that drift. On POSIX that is a single file with a Node shebang and the
// executable bit; on Windows it is the same JavaScript plus a .cmd launcher beside it, because Windows
// resolves an executable by extension and does not read shebangs at all.
//
// Returns the path to spawn. On Windows that path ends in .cmd, which is why callers must use the return
// value rather than rebuilding the path themselves.
export async function writeSpawnableProgram(directory, name, body) {
  if (process.platform === "win32") {
    const scriptName = `${name}.mjs`;
    await writeFile(path.join(directory, scriptName), body.endsWith("\n") ? body : `${body}\n`);
    const launcher = path.join(directory, `${name}.cmd`);
    await writeFile(launcher, CMD_LAUNCHER(scriptName));
    return launcher;
  }
  const target = path.join(directory, name);
  await writeFile(target, `#!/usr/bin/env node\n${body.endsWith("\n") ? body : `${body}\n`}`);
  await chmod(target, 0o755);
  return target;
}

// The counterpart to `writeSpawnableProgram`, for code under test that takes its spawner as a seam. On
// POSIX the fabricated program is spawned exactly the way the product spawns a real one. On Windows a
// file becomes a process only by being a PE binary, and a test cannot fabricate one of those, so the
// JavaScript body is handed to the Node already running instead. Everything else the code under test does
// to the candidate — realpath, lstat, the X_OK check, parsing what it prints, resolving a symlink alias
// to it — runs against the real file on both platforms. What stands in on Windows is the operating
// system's file-to-process step alone, which is not what any of these tests are about.
export const spawnProgramSync = process.platform === "win32"
  ? (command, args, options) => {
    const script = command.endsWith(".cmd") ? `${command.slice(0, -".cmd".length)}.mjs` : command;
    return spawnSync(process.execPath, [script, ...args], { ...options, shell: false });
  }
  : spawnSync;

// A file that exists and is not runnable. POSIX expresses that by clearing the executable bit; Windows
// cannot express it at all, because X_OK there is satisfied by anything readable. Returns null on the
// platforms that cannot, so the caller skips rather than asserts something the platform never promised.
export async function writeNonExecutableProgram(directory, name, body) {
  if (!PERMISSION_BITS_MEANINGFUL) return null;
  const target = path.join(directory, name);
  await writeFile(target, body);
  await chmod(target, 0o644);
  return target;
}

// Every temporary root in the suite goes through here. `/tmp` is not a path on Windows, and `os.tmpdir()`
// is the same directory on POSIX, so there is never a reason to name `/tmp` directly. macOS keeps its own
// exception: `os.tmpdir()` there is a long per-user path under /var/folders, and a handful of tests need a
// short prefix because what they are testing is a length or a first path segment.
export async function temporaryDirectory(prefix, { shortOnDarwin = false } = {}) {
  const base = shortOnDarwin && process.platform === "darwin" ? "/tmp" : tmpdir();
  return mkdtemp(path.join(base, prefix));
}

// The environment keys a spawned child needs before it can start at all. The POSIX set is small. On
// Windows a process started without the system root cannot resolve the DLLs node.exe itself links
// against, without PATHEXT a program name never becomes a file name, and without the profile
// directory os.homedir() answers nothing — so a harness that hands a child only the POSIX set gets a
// child that dies before it reaches the thing under test. Both lists are allowlists: a key absent from
// the parent is still absent from the child.
export const CHILD_ENVIRONMENT_KEYS = Object.freeze(process.platform === "win32"
  ? ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME", "SystemRoot", "SYSTEMROOT", "windir", "PATHEXT", "USERPROFILE", "COMSPEC"]
  : ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME"]);

// Whether this platform will rename a directory that something still holds open inside it. POSIX will:
// a rename moves the name and open handles keep pointing at the same inode, which is exactly what a
// hostile mid-build swap looks like. Windows refuses with EBUSY, so a test that has to swap a
// directory out from under a running build cannot stage its scenario there at all — the swap fails
// before the code under test ever sees it. Probed rather than assumed, so the answer comes from the
// filesystem the run is actually on.
export const DIRECTORY_RENAME_WITH_OPEN_HANDLE = (() => {
  const root = mkdtempSync(path.join(tmpdir(), "rename-open-handle-"));
  let descriptor = null;
  try {
    const occupied = path.join(root, "occupied");
    mkdirSync(occupied);
    const inside = path.join(occupied, "held");
    writeFileSync(inside, "held\n");
    descriptor = openSync(inside, "r");
    renameSync(occupied, path.join(root, "moved"));
    return true;
  } catch {
    return false;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    rmSync(root, { recursive: true, force: true });
  }
})();

export const NO_DIRECTORY_RENAME_WITH_OPEN_HANDLE_REASON =
  "this platform refuses to rename a directory that has an open handle inside it, so the mid-build swap this case has to stage fails before the code under test can answer it";

// Whether a child can be handed an extra inherited descriptor by number. A POSIX process inherits a
// numbered descriptor table, so fd 3 in the parent is fd 3 in the child and a tamper can deliberately
// leak an evidence pipe into a grandchild. Windows inherits HANDLEs rather than fd numbers and libuv
// carries no fourth stdio entry there, so the leak cannot be staged at all — the grandchild never
// starts, and the case fails for a reason that has nothing to do with what it tests.
export const INHERITED_EXTRA_DESCRIPTORS = process.platform !== "win32";
export const NO_INHERITED_EXTRA_DESCRIPTORS_REASON =
  "this platform inherits handles rather than numbered descriptors, so an evidence descriptor cannot be leaked into a grandchild for the cleanup to have to bound";

// How much slack a child-process deadline needs on this host. Windows spawns processes and starts Node
// several times slower than the POSIX runners, so a deadline tuned on Linux stops measuring "did this
// finish in time" and starts measuring "is this Windows". What the mutation harnesses assert is that
// cleanup is bounded, not that the bound is fifteen seconds; the bound scales with the host and the
// assertion does not move.
export const CHILD_DEADLINE_SCALE = process.platform === "win32" ? 3 : 1;
