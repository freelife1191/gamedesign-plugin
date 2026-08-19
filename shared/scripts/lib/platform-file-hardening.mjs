// Two of this suite's filesystem hardening primitives are POSIX-shaped, and Windows supplies neither.
// Both modules used to answer that in the wrong way: `load-workspace-env` refused to run at all, and
// `safe-memory-store` wrote `constants.O_NOFOLLOW ?? 0`, which degrades silently on every platform
// rather than on the one platform that needs it. This module is the single place that decides, by
// platform, which guarantee is available — so the degradation is named, allowlisted, and testable.
import { constants } from "node:fs";
import { open } from "node:fs/promises";

// Allowlists, not fallbacks. A POSIX host that somehow lacks one of these constants is a broken host,
// and the call still fails closed there; only the platform documented as never having it is exempt.
const PLATFORMS_WITHOUT_NO_FOLLOW = new Set(["win32"]);
const PLATFORMS_WITHOUT_DIRECTORY_SYNC = new Set(["win32"]);
const PLATFORMS_WITHOUT_POSIX_PERMISSION_BITS = new Set(["win32"]);
const PLATFORMS_WITHOUT_DIRECTORY_HANDLES = new Set(["win32"]);

// `O_NOFOLLOW` makes `open` fail when the last path component is a symlink. Node documents it as
// unavailable on Windows and exposes no equivalent — `FILE_FLAG_OPEN_REPARSE_POINT` is not reachable
// from `fs.open` — so on Windows the flag contributes nothing and must contribute zero.
//
// What still holds there is the check the callers already perform: every open in this suite is
// bracketed by an `lstat` before it and, after it, a comparison of `handle.stat()` against a fresh
// `lstat` of the same path. A path swapped to a symlink between the two is caught by that second
// `lstat` reporting a symlink, and a path swapped to a different regular file is caught by the
// dev/ino comparison — the same comparison that catches it on POSIX, where `O_NOFOLLOW` never
// covered that case either. Both run before the caller reads a byte.
//
// So Windows loses the atomicity, not the detection: a substituted symlink is opened and then
// rejected instead of never being opened, and no byte of the attacker's target reaches the caller.
// The residual is a transient handle on a path an attacker chose, which is why this is an exemption
// for one named platform rather than a general relaxation.
export function noFollowOpenFlag({ platform = process.platform, fsConstants = constants } = {}) {
  const flag = fsConstants?.O_NOFOLLOW;
  if (Number.isInteger(flag)) return flag;
  if (!PLATFORMS_WITHOUT_NO_FOLLOW.has(platform)) throw new Error("Secure no-follow file opening is unavailable.");
  return 0;
}

export function directorySyncSupported(platform = process.platform) {
  return !PLATFORMS_WITHOUT_DIRECTORY_SYNC.has(platform);
}

// `fsync` on a directory is what makes a rename or a link durable on POSIX. Windows has no user-mode
// equivalent: `fs.open` cannot return a directory handle, and `FlushFileBuffers` on a volume handle
// requires administrator rights. Attempting it is what returns `EPERM` and takes the design memory
// store down on Windows.
//
// Skipping it there does not drop the guarantee, it moves who provides it. NTFS journals metadata
// operations in `$LogFile` and replays them at mount, so the directory entry this call was protecting
// is recovered by the filesystem. The committed bytes were already durable before the entry existed —
// the caller `fsync`s the claim file itself, and only then links it into place.
//
// Everywhere else the sync stays mandatory: an `EPERM` from a POSIX directory sync is a real failure
// and still propagates.
export async function syncDirectory(candidate, { platform = process.platform, openFn = open } = {}) {
  if (!directorySyncSupported(platform)) return { synced: false, reason: "platform_unsupported" };
  const handle = await openFn(candidate, constants.O_RDONLY | noFollowOpenFlag({ platform }));
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { synced: true };
}

// `Stats.mode` on Windows is synthesized from a single read-only attribute rather than carrying POSIX
// permission bits: a readable file reports the same mode whatever its ACL says. Testing that number for
// group or other access answers a question it cannot answer — it fires on every file, and there is no
// action to take in response, because `chmod` is a no-op there and Node exposes no ACL API. So the
// check is declined rather than guessed at, which does mean a Windows user gets no permission signal
// from this suite at all; the alternative was a warning that is wrong every time it appears.
export function posixPermissionBitsMeaningful(platform = process.platform) {
  return !PLATFORMS_WITHOUT_POSIX_PERMISSION_BITS.has(platform);
}

// `O_DIRECTORY` plus a `fs.open` on a directory is how a POSIX reader pins a directory's identity for
// the whole of a `readdir`: the handle keeps naming the same inode even if the path is swapped
// underneath. Windows has neither half — the constant is undefined, and libuv opens files without
// `FILE_FLAG_BACKUP_SEMANTICS`, so `fs.open` on a directory fails outright rather than returning a
// handle. Naming the constant anyway is the silent-degradation trap again: `flags | undefined` is
// `flags`, so the open proceeds without the guarantee and then fails on the directory instead.
//
// What holds without the handle is the same fallback as everywhere else in this file: the callers
// already `lstat` the path before the read and again after it, and compare dev/ino/mtime across the
// pair. A directory swapped mid-read is caught by that comparison and the read is discarded. The
// atomicity is what is lost, not the detection.
export function directoryHandleSupported(platform = process.platform) {
  return !PLATFORMS_WITHOUT_DIRECTORY_HANDLES.has(platform);
}

// Opens a directory for identity pinning, or returns null where the platform cannot. Callers must treat
// null as "pin by path instead", never as an error and never as success — a caller that ignores it would
// dereference null and fail loudly, which is the intended shape.
export async function openDirectoryHandle(candidate, { platform = process.platform, openFn = open, fsConstants = constants } = {}) {
  if (!directoryHandleSupported(platform)) return null;
  const directoryFlag = fsConstants?.O_DIRECTORY;
  if (!Number.isInteger(directoryFlag)) throw new Error("Secure directory opening is unavailable.");
  return openFn(candidate, fsConstants.O_RDONLY | directoryFlag | noFollowOpenFlag({ platform, fsConstants }));
}
