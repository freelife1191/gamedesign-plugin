import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveArchifyInstallation } from "../../shared/scripts/capability-probe.mjs";
import { hostArchifyDestination, resolveVendoredArchify, stageHostArchify } from "../../tooling/stage-host-archify.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("the staged copy is the version the vendor lock pins, resolved from the lock rather than a listing", async () => {
  const lockVersion = (await resolveVendoredArchify(repoRoot)).version;
  assert.match(lockVersion, /^\d+\.\d+\.\d+$/u);
  assert.equal((await resolveVendoredArchify(repoRoot)).source, path.join(repoRoot, "shared/vendor/archify/archify", lockVersion));
});

test("staging the vendored copy makes the host resolver report an available CLI", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "stage-host-archify-"));
  try {
    // Prove the destination is genuinely empty first, so "available" below cannot come from the
    // developer's own installation leaking in through a default.
    const destination = hostArchifyDestination({}, home);
    assert.equal(destination, path.join(home, ".agents", "skills", "archify"));
    assert.equal((await resolveArchifyInstallation({}, { home })).status, "unavailable");

    const staged = await stageHostArchify({ repoRoot, destination });
    assert.equal(staged.destination, destination);
    assert.ok(staged.files > 0, "staging must copy files");

    const installation = await resolveArchifyInstallation({}, { home });
    assert.equal(installation.status, "available", "the vendored copy must satisfy the same resolver the contracts use");
    assert.equal(installation.version, staged.version);
    assert.equal(typeof installation.cli?.realpath, "string");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("staging twice is idempotent and leaves no remnant of the earlier copy", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "stage-host-archify-"));
  try {
    const destination = hostArchifyDestination({}, home);
    const first = await stageHostArchify({ repoRoot, destination });
    const second = await stageHostArchify({ repoRoot, destination });
    assert.deepEqual(second, first);
    assert.equal((await resolveArchifyInstallation({}, { home })).status, "available");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
