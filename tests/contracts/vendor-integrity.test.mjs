import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import * as vendorModule from "../../tooling/vendor-skillstead.mjs";

const repoRoot = path.resolve(new URL("../../", import.meta.url).pathname);
const vendorRoot = path.join(repoRoot, "shared/vendor/skillstead");
const packageRoot = path.join(vendorRoot, "svg-infographic/0.8.3");
const verifier = path.join(repoRoot, "tooling/verify-vendor-hash.mjs");
const vendorCommand = path.join(repoRoot, "tooling/vendor-skillstead.mjs");

const expectedFiles = [
  ["CHANGELOG.md", "794ca707fdc1647975030c97b171c31f1ae14b526483286696cfaf3d35e8329e", 2684],
  ["LICENSE.txt", "4739c79c8017b90a46ab26f8972fd4ac56c9ea459b89bf9671359b462f62a4a6", 11344],
  ["README.ko.md", "d981158c3087cc3f853004178a9a27505c74da9bb8bd4716caf04fa510e4ddaa", 16590],
  ["README.md", "ee63d45454d3147fbf14a927a28a74f9a3fe545e549b12dadc6c0867a65cdc51", 14103],
  ["SKILL.md", "6d5a2d278ca0aaa045b636d7a5faf83e825908ba7a28dac09faa6c01e442f2f1", 22012],
  ["references/archetypes.md", "f0c8de46fb2a25fdd13de021c22c0390f40b760af6224120d2f16957f216605f", 11548],
  ["references/authoring.md", "2b8239cd836a7753cab5c67840c631347b58b4806848bbffe2e0653d214b6317", 20718],
  ["references/sketch.md", "887c33236665d3e7645b3bedaff564a7326542c1de1b4ecc6497a007c7aa8403", 8431],
  ["scripts/check-svg.mjs", "3990a96078ce8c0c4692213820ce72fc228a1b827459792d5ccc45932f5f9a41", 41219],
  ["scripts/check-svg.test.mjs", "a3f73ff0ccd03189fbd8eb4dc45fd8ec72cf02024afbca9eada3c713d953c808", 14481],
  ["scripts/fixtures/curve-head-unverified.svg", "48894c6edc6671feb2133164030802f9dc4ee47d5ad13957a6889a2ab9e44c7b", 642],
  ["scripts/fixtures/dangling-ref.svg", "c65a722af8c8dfdb1b94d8968d1b11cf3935c9d6f7906f8bf111573daf2491f1", 380],
  ["scripts/fixtures/exponent-coords.svg", "066233a756d23b2d7021e969f505676e43ca0119265d86093c96cd5e8281e87e", 933],
  ["scripts/fixtures/exponent-markerwidth.svg", "a5d05eaba46a060ad4b929a2eb054eeb3444044617420401af39afefcd3484f2", 924],
  ["scripts/fixtures/filtered-css-override-unsafe.svg", "1493957ad14af00d2344461c5b0608df33b1d92fc3dc367c583748356f48b152", 823],
  ["scripts/fixtures/filtered-curved-connector.svg", "20cb5ad8a7c6ec6b0cf82c069080fcc016f337e6bc67c2b91174142ca7cf38c3", 778],
  ["scripts/fixtures/filtered-horizontal-connectors.svg", "706dc9ea02819d827fd5ea5d34b8e8a05ce2369e226db0ee72d18665aba30526", 771],
  ["scripts/fixtures/filtered-safe-userspace.svg", "e8b295c695f646b937b0809deb07286343c435ad4fea2363ba5c99ddb3c5cb2e", 793],
  ["scripts/fixtures/filtered-unpainted-strokes.svg", "ad175d5a0c815757cf34193885797012985bd9ab707a58043cfff8827b61c9f4", 534],
  ["scripts/fixtures/filtered-unresolved-strokewidth.svg", "8020447852a9b81e7bbe40c218a6f417a0ce125b5879aa449bb90a9f44f8f377", 596],
  ["scripts/fixtures/filtered-userspace-calc-region.svg", "6d3f4a0f717b1a70f000a615a7987336e19cb638c4cd5d60b0e37681647e1dfa", 613],
  ["scripts/fixtures/filtered-userspace-negative-region.svg", "03bdf95dfdc862650f63d6ebf7f189ed618c9bbd4d531fa432803b2aebcd7419", 606],
  ["scripts/fixtures/filtered-userspace-percent-zero-region.svg", "3b4e3c55d60266fc68916d0ef7f2dbc81147273e757bb72cd267883fe4e50a07", 606],
  ["scripts/fixtures/filtered-userspace-zero-region.svg", "45e9503872b09fbdabcb8f6a0fa85baa872241e72a9f4e455c32d4a497c13a82", 605],
  ["scripts/fixtures/filtered-vertical-connectors.svg", "2decf3c1429a12edf4fd1ddd10702926d10642dfb9b218948545371a48a49ed4", 771],
  ["scripts/fixtures/filtered-zero-strokewidth.svg", "2244bd9cee9e22588a3746d287349b9068080d2b4eb730311896ff0ca1bf25a2", 769],
  ["scripts/fixtures/huge-viewport-small-glyph.svg", "dbb331b91ca32a50ee8240e0f9c1e86e0c9686eb76429746766994f82325b52b", 923],
  ["scripts/fixtures/inline-style-oversized.svg", "4cadf4265f6c5ce3700a7ddf673b736066cbf5ff9ae8a0a24cf3a3cebb517a02", 602],
  ["scripts/fixtures/korean-overflow.svg", "b40f230844438345595c9730cf0794371edb0f4e8ceb34b2a4897a87aea34cfa", 344],
  ["scripts/fixtures/latin-overflow.svg", "655ff0cb3e4802db3b6d0d64a55fcc45abb5a0baed0fda81ac5b61d7d796f318", 336],
  ["scripts/fixtures/missing-marker-units.svg", "1ecf88c9b6dc3701736f3ff9a1b912e94ff0a1dc1234b4f824e561a03d8c880e", 526],
  ["scripts/fixtures/mixed-known-unknown.svg", "8ca65bdec0443da6b13ea075a0abab4e0f7df48e4043e05e244b72617e25d906", 895],
  ["scripts/fixtures/multi-stroke-all-clean.svg", "e160b3cb55d83f2221da9aedf8fc1df7ebe6614e76d255336dca3f4cd34d8daa", 878],
  ["scripts/fixtures/multi-stroke-thin-violation.svg", "6d4aa0d3d820579475f52556122cf3e25ae91bee6ed4f843a3a2bba6160b6bf6", 884],
  ["scripts/fixtures/oversized-head.svg", "3f32fb831221b2c659699fb7ef5d77869b92bb32bd0b412dc5cc17d73b7c3a55", 577],
  ["scripts/fixtures/oversized-visible-head.svg", "780ffe2f9396e5942909fef3b6324223639b34816d271fbbdab7108d40428534", 926],
  ["scripts/fixtures/par-slice.svg", "c8308ae0402541b7e0c5fd5aaae4931b0f772ee942736535db38f4788310e914", 965],
  ["scripts/fixtures/relative-path-oversized.svg", "bbc65e2c09641d414fee3ca17030b7823fafbb8e76056e2a069c0c92f837bc6a", 636],
  ["scripts/fixtures/split-css-rules.svg", "f2f302614b414224dee8bc54027e08999689664863a8471b619301ff1601bcfd", 655],
  ["scripts/fixtures/undersized-head.svg", "355ff911fda9ec5bb9c7b18bcc42495141891a00d14d0ca84016fadc0158e60d", 920],
  ["scripts/fixtures/unknown-stroke-ref.svg", "bad76753e4db73d47ba3db15c1ca8a054038139c5dfac25f1bf8eb83cc17db16", 933],
  ["scripts/fixtures/unproven-extreme-viewport.svg", "078726a7018f40ac748bba74929bb9b9b425bb11df92a154bafe2fd3b61d34de", 921],
  ["scripts/fixtures/unused-css-rule.svg", "370b7ed3b8166b926d12c121c57853683ef7bc25b09eb87d9ac704fe8d4e2cb5", 977],
  ["scripts/fixtures/valid.svg", "c6602e579d74b4cf84adf94510dd199afe7eec543aa91aa9562a00d0db8cd53d", 928],
  ["scripts/fixtures/warning-transform.svg", "d8640a11bcb7f0f237b9b329f04afe863f30092270f66ee1624972aa9ec435f6", 346],
  ["scripts/render.mjs", "5f2d6f43c1c6ee43e4c52c9bdf02053297e13ca3315ea16652741f3fe85e3d8e", 19876],
  ["scripts/render.sh", "1515fbab7fb6ec2b7a76e50055e8c9160a4c8bb974487e48d25c7259f70ade35", 2162],
  ["scripts/render.test.mjs", "40f3150dd8902527e6e7945366ad717e70b2bc7fb84e39b11f7a63fbe7b3fcb1", 17368],
].map(([path, sha256, size]) => ({ path, sha256, size }));

function run(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], { cwd: repoRoot, encoding: "utf8" });
}

test("Skillstead svg-infographic 0.8.3 is pinned byte-for-byte with attribution", async () => {
  const lock = JSON.parse(await readFile(path.join(vendorRoot, "vendor.lock.json"), "utf8"));
  assert.deepEqual(lock.package, {
    name: "svg-infographic",
    version: "0.8.3",
    upstream: "https://github.com/kyungseo/skillstead",
    license: "Apache-2.0",
    copyright: "Copyright 2026 Kyungseo Park",
  });
  assert.deepEqual(lock.files, expectedFiles);

  for (const required of ["SKILL.md", "LICENSE.txt", "scripts/check-svg.mjs", "scripts/render.mjs"]) {
    assert.ok(expectedFiles.some((file) => file.path === required), `missing required file from lock: ${required}`);
  }

  const notices = await readFile(path.join(vendorRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  for (const value of [
    "https://github.com/kyungseo/skillstead",
    "0.8.3",
    "Apache-2.0",
    "Copyright 2026 Kyungseo Park",
  ]) {
    assert.match(notices, new RegExp(value.replaceAll(".", "\\.")));
  }

  const result = run(verifier);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /verified 48 files/);
});

test("hash verifier rejects missing, added, and modified vendored files", async (t) => {
  for (const mutation of ["missing", "added", "modified"]) {
    await t.test(mutation, async () => {
      const scratch = await mkdtemp(path.join(tmpdir(), "skillstead-vendor-"));
      try {
        await mkdir(path.join(scratch, "shared/vendor"), { recursive: true });
        await cp(vendorRoot, path.join(scratch, "shared/vendor/skillstead"), { recursive: true });
        const target = path.join(scratch, "shared/vendor/skillstead/svg-infographic/0.8.3/SKILL.md");
        if (mutation === "missing") await rm(target);
        if (mutation === "added") await writeFile(path.join(packageRoot.replace(repoRoot, scratch), "EXTRA.txt"), "extra\n");
        if (mutation === "modified") await writeFile(target, "modified\n");

        const result = run(verifier, ["--root", scratch]);
        assert.notEqual(result.status, 0, `${mutation} mutation unexpectedly passed`);
        assert.match(result.stderr, new RegExp(mutation === "added" ? "unexpected" : mutation));
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    });
  }
});

test("vendor command is check-only unless the exact guarded update arguments are supplied", () => {
  const check = run(vendorCommand);
  assert.equal(check.status, 0, check.stderr || check.stdout);

  for (const args of [
    ["--update-from", "/tmp/source"],
    ["--version", "0.8.3"],
    ["--update-from", "/tmp/source", "--version", "0.8.4"],
  ]) {
    const rejected = run(vendorCommand, args);
    assert.notEqual(rejected.status, 0, `unsafe arguments unexpectedly passed: ${args.join(" ")}`);
  }
});

async function writeSource(source, { omit = [] } = {}) {
  const files = new Map([
    ["SKILL.md", "---\nmetadata:\n  version: 0.8.3\n---\n\n# staged skill\n"],
    ["LICENSE.txt", "Apache-2.0 test fixture\n"],
    ["scripts/check-svg.mjs", "export const check = true;\n"],
    ["scripts/render.mjs", "export const render = true;\n"],
    ["snapshot.txt", "captured generation\n"],
  ]);
  for (const [relativePath, contents] of files) {
    if (omit.includes(relativePath)) continue;
    const destination = path.join(source, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
}

async function treeSnapshot(root) {
  const snapshot = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath, relativePath);
      else snapshot.push([relativePath, (await readFile(entryPath)).toString("hex")]);
    }
  }
  await visit(root);
  return snapshot;
}

async function createUpdateFixture(options) {
  const scratch = await mkdtemp(path.join(tmpdir(), "skillstead-update-"));
  await mkdir(path.join(scratch, "shared/vendor"), { recursive: true });
  await cp(vendorRoot, path.join(scratch, "shared/vendor/skillstead"), { recursive: true });
  const source = path.join(scratch, "source");
  await writeSource(source, options);
  return { scratch, source, vendor: path.join(scratch, "shared/vendor/skillstead") };
}

async function assertGenerationPreserved(fixture, before) {
  assert.deepEqual(await treeSnapshot(fixture.vendor), before);
  const verification = run(verifier, ["--root", fixture.scratch]);
  assert.equal(verification.status, 0, verification.stderr || verification.stdout);
  const siblings = await readdir(path.dirname(fixture.vendor));
  assert.deepEqual(
    siblings.filter(
      (name) => name.startsWith(".skillstead-update-") || name.startsWith(".skillstead-cleanup-"),
    ),
    [],
  );
}

async function assertBootstrapRolledBack(fixture) {
  await assert.rejects(fs.lstat(fixture.vendor), { code: "ENOENT" });
  const siblings = await readdir(path.dirname(fixture.vendor));
  assert.deepEqual(
    siblings.filter(
      (name) => name.startsWith(".skillstead-update-") || name.startsWith(".skillstead-cleanup-"),
    ),
    [],
  );
}

test("guarded update preserves the prior generation on preflight, write, and install rename failures", async (t) => {
  assert.equal(typeof vendorModule.updateVendor, "function", "updateVendor must expose the transactional seam");
  for (const failure of ["preflight", "write", "rename"]) {
    await t.test(failure, async () => {
      const fixture = await createUpdateFixture(
        failure === "preflight" ? { omit: ["scripts/render.mjs"] } : undefined,
      );
      const before = await treeSnapshot(fixture.vendor);
      let injectedRename = false;
      const injectedFs = {
        ...fs,
        async rename(from, to) {
          if (failure === "rename" && !injectedRename && path.basename(from) === "next") {
            injectedRename = true;
            throw new Error("injected install rename failure");
          }
          return fs.rename(from, to);
        },
        async writeFile(destination, contents) {
          if (failure === "write" && path.basename(destination) === "vendor.lock.json") {
            throw new Error("injected staging write failure");
          }
          return fs.writeFile(destination, contents);
        },
      };
      try {
        await assert.rejects(
          vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
          new RegExp(failure === "preflight" ? "missing required" : `injected .*${failure}`),
        );
        await assertGenerationPreserved(fixture, before);
      } finally {
        await rm(fixture.scratch, { recursive: true, force: true });
      }
    });
  }
});

test("source mutation after capture aborts without replacing the prior generation", async () => {
  assert.equal(typeof vendorModule.updateVendor, "function", "updateVendor must expose the transactional seam");
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", {
        hooks: {
          async afterSnapshot() {
            await writeFile(path.join(fixture.source, "snapshot.txt"), "changed after capture\n");
          },
        },
      }),
      /source changed during update/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("successful update installs tree, lock, and notices from one staged snapshot", async () => {
  assert.equal(typeof vendorModule.updateVendor, "function", "updateVendor must expose the transactional seam");
  const fixture = await createUpdateFixture();
  try {
    await vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3");
    const installedRoot = path.join(fixture.vendor, "svg-infographic/0.8.3");
    assert.equal(await readFile(path.join(installedRoot, "snapshot.txt"), "utf8"), "captured generation\n");
    const lock = JSON.parse(await readFile(path.join(fixture.vendor, "vendor.lock.json"), "utf8"));
    assert.deepEqual(lock.files.map(({ path }) => path), [
      "LICENSE.txt",
      "SKILL.md",
      "scripts/check-svg.mjs",
      "scripts/render.mjs",
      "snapshot.txt",
    ]);
    const verification = run(verifier, ["--root", fixture.scratch]);
    assert.equal(verification.status, 0, verification.stderr || verification.stdout);
    assert.match(await readFile(path.join(fixture.vendor, "THIRD_PARTY_NOTICES.md"), "utf8"), /Version: 0\.8\.3/);
    const siblings = await readdir(path.dirname(fixture.vendor));
    assert.deepEqual(
      siblings.filter(
        (name) => name.startsWith(".skillstead-update-") || name.startsWith(".skillstead-cleanup-"),
      ),
      [],
    );
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("successful update bootstraps an absent vendor generation", async () => {
  const fixture = await createUpdateFixture();
  try {
    await rm(fixture.vendor, { recursive: true, force: true });
    await vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3");
    const verification = run(verifier, ["--root", fixture.scratch]);
    assert.equal(verification.status, 0, verification.stderr || verification.stdout);
    assert.match(verification.stdout, /verified 5 files/);
    const siblings = await readdir(path.dirname(fixture.vendor));
    assert.deepEqual(
      siblings.filter(
        (name) => name.startsWith(".skillstead-update-") || name.startsWith(".skillstead-cleanup-"),
      ),
      [],
    );
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("bootstrap tombstone rename failure removes the uncommitted installed generation", async () => {
  const fixture = await createUpdateFixture();
  await rm(fixture.vendor, { recursive: true, force: true });
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected bootstrap tombstone rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    let rejection;
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      (error) => {
        rejection = error;
        return true;
      },
    );
    assert.match(rejection.message, /injected bootstrap tombstone rename failure/);
    assert.notEqual(rejection.committed, true);
    await assertBootstrapRolledBack(fixture);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("bootstrap rollback retries a transient live-generation isolation failure", async () => {
  const fixture = await createUpdateFixture();
  await rm(fixture.vendor, { recursive: true, force: true });
  let isolationFailed = false;
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected bootstrap tombstone rename failure");
      }
      if (
        !isolationFailed
        && from === fixture.vendor
        && path.basename(path.dirname(to)).startsWith(".skillstead-update-")
      ) {
        isolationFailed = true;
        throw new Error("injected transient bootstrap isolation failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      /injected bootstrap tombstone rename failure/,
    );
    await assertBootstrapRolledBack(fixture);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("bootstrap rollback retries a transient workspace cleanup failure", async () => {
  const fixture = await createUpdateFixture();
  await rm(fixture.vendor, { recursive: true, force: true });
  let cleanupFailed = false;
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected bootstrap tombstone rename failure");
      }
      return fs.rename(from, to);
    },
    async rm(target, options) {
      if (!cleanupFailed && path.basename(target).startsWith(".skillstead-update-")) {
        cleanupFailed = true;
        throw new Error("injected transient bootstrap cleanup failure");
      }
      return fs.rm(target, options);
    },
  };
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      /injected bootstrap tombstone rename failure/,
    );
    await assertBootstrapRolledBack(fixture);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("permanent bootstrap isolation failure reports the uncommitted live generation and workspace", async () => {
  const fixture = await createUpdateFixture();
  await rm(fixture.vendor, { recursive: true, force: true });
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected bootstrap tombstone rename failure");
      }
      if (
        from === fixture.vendor
        && path.basename(path.dirname(to)).startsWith(".skillstead-update-")
      ) {
        throw new Error("injected permanent bootstrap isolation failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    let rejection;
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      (error) => {
        rejection = error;
        return true;
      },
    );
    assert.notEqual(rejection.committed, true);
    const workspaces = (await readdir(path.dirname(fixture.vendor)))
      .filter((name) => name.startsWith(".skillstead-update-"));
    assert.equal(workspaces.length, 1, "one bootstrap recovery workspace must remain");
    const workspace = path.join(path.dirname(fixture.vendor), workspaces[0]);
    assert.match(rejection.message, /uncommitted installed generation/i);
    assert.match(rejection.message, new RegExp(fixture.vendor.replaceAll("/", "\\/")));
    assert.match(rejection.message, new RegExp(`recovery.*${workspace.replaceAll("/", "\\/")}`, "i"));
    assert.equal(rejection.recoveryPath, workspace);
    const verification = run(verifier, ["--root", fixture.scratch]);
    assert.equal(verification.status, 0, verification.stderr || verification.stdout);
    assert.match(verification.stdout, /verified 5 files/);
    const cleanupResidue = (await readdir(path.dirname(fixture.vendor)))
      .filter((name) => name.startsWith(".skillstead-cleanup-"));
    assert.deepEqual(cleanupResidue, []);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("tombstone rename failure rolls back instead of reporting a committed update", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected tombstone rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      /injected tombstone rename failure/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("tombstone rename failure retries a transient rollback failure", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  let restoreFailed = false;
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected tombstone rename failure");
      }
      if (!restoreFailed && path.basename(from) === "previous" && path.basename(to) === "skillstead") {
        restoreFailed = true;
        throw new Error("injected transient rollback rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      /injected tombstone rename failure/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("permanent rollback failure after tombstone rename failure preserves recovery data", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (
        path.basename(from).startsWith(".skillstead-update-")
        && path.basename(to).startsWith(".skillstead-cleanup-")
      ) {
        throw new Error("injected tombstone rename failure");
      }
      if (path.basename(from) === "previous" && path.basename(to) === "skillstead") {
        throw new Error("injected permanent rollback rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    let rejection;
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      (error) => {
        rejection = error;
        return true;
      },
    );
    assert.notEqual(rejection.committed, true);
    const workspaces = (await readdir(path.dirname(fixture.vendor)))
      .filter((name) => name.startsWith(".skillstead-update-"));
    assert.equal(workspaces.length, 1, "one recovery workspace must remain");
    const recovery = path.join(path.dirname(fixture.vendor), workspaces[0], "previous");
    assert.match(rejection.message, new RegExp(`recovery.*${recovery.replaceAll("/", "\\/")}`, "i"));
    assert.deepEqual(await treeSnapshot(recovery), before);
    const cleanupResidue = (await readdir(path.dirname(fixture.vendor)))
      .filter((name) => name.startsWith(".skillstead-cleanup-"));
    assert.deepEqual(cleanupResidue, []);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("transient rollback rename failure is retried before the old generation is restored", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  let installFailed = false;
  let restoreFailed = false;
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (!installFailed && path.basename(from) === "next") {
        installFailed = true;
        throw new Error("injected install rename failure");
      }
      if (!restoreFailed && path.basename(from) === "previous" && path.basename(to) === "skillstead") {
        restoreFailed = true;
        throw new Error("injected transient rollback rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      /injected install rename failure/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("permanent rollback failure preserves the recovery generation and reports its path", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  let installFailed = false;
  const injectedFs = {
    ...fs,
    async rename(from, to) {
      if (!installFailed && path.basename(from) === "next") {
        installFailed = true;
        throw new Error("injected install rename failure");
      }
      if (path.basename(from) === "previous" && path.basename(to) === "skillstead") {
        throw new Error("injected permanent rollback rename failure");
      }
      return fs.rename(from, to);
    },
  };
  try {
    let rejection;
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", { fs: injectedFs }),
      (error) => {
        rejection = error;
        return true;
      },
    );
    const workspaces = (await readdir(path.dirname(fixture.vendor)))
      .filter((name) => name.startsWith(".skillstead-update-"));
    assert.equal(workspaces.length, 1, "one recovery workspace must remain");
    const recovery = path.join(path.dirname(fixture.vendor), workspaces[0], "previous");
    assert.match(rejection.message, new RegExp(`recovery.*${recovery.replaceAll("/", "\\/")}`, "i"));
    assert.deepEqual(await treeSnapshot(recovery), before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("staged mutation in beforeInstall is rejected before the live generation moves", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", {
        hooks: {
          async beforeInstall({ stagedVendorRoot }) {
            await writeFile(
              path.join(stagedVendorRoot, "svg-infographic/0.8.3/snapshot.txt"),
              "mutated staged bytes\n",
            );
          },
        },
      }),
      /modified vendored file/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("installed-root verification failure rolls back to the verified prior generation", async () => {
  const fixture = await createUpdateFixture();
  const before = await treeSnapshot(fixture.vendor);
  try {
    await assert.rejects(
      vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3", {
        hooks: {
          async afterInstall({ vendorRoot: installedRoot }) {
            await writeFile(
              path.join(installedRoot, "svg-infographic/0.8.3/snapshot.txt"),
              "mutated installed bytes\n",
            );
          },
        },
      }),
      /modified vendored file/,
    );
    await assertGenerationPreserved(fixture, before);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});

test("partial post-commit cleanup failure keeps the verified install and reports only a cleanup tombstone", async () => {
  const fixture = await createUpdateFixture();
  let cleanupFailed = false;
  const injectedFs = {
    ...fs,
    async rm(target, options) {
      if (!cleanupFailed && path.basename(target).startsWith(".skillstead-")) {
        cleanupFailed = true;
        await fs.rm(
          path.join(target, "previous/svg-infographic/0.8.3/SKILL.md"),
          { force: true },
        );
        throw new Error("injected partial tombstone cleanup failure");
      }
      return fs.rm(target, options);
    },
  };
  try {
    const result = await vendorModule.updateVendor(
      fixture.scratch,
      fixture.source,
      "0.8.3",
      { fs: injectedFs },
    );
    assert.equal(result.committed, true);
    assert.equal(typeof result.cleanupPending, "string");
    assert.equal(path.basename(result.cleanupPending).startsWith(".skillstead-cleanup-"), true);
    assert.deepEqual(result.warnings.map(({ code }) => code), ["VENDOR_CLEANUP_PENDING"]);
    assert.match(result.warnings[0].message, /cleanup pending/);
    assert.doesNotMatch(result.warnings[0].message, /recovery/i);
    assert.equal(result.warnings[0].path, result.cleanupPending);

    const verification = run(verifier, ["--root", fixture.scratch]);
    assert.equal(verification.status, 0, verification.stderr || verification.stdout);
    assert.match(verification.stdout, /verified 5 files/);
    assert.equal((await fs.lstat(result.cleanupPending)).isDirectory(), true);

    const nextUpdate = await vendorModule.updateVendor(fixture.scratch, fixture.source, "0.8.3");
    assert.deepEqual(nextUpdate, { committed: true, cleanupPending: null, warnings: [] });
    const nextVerification = run(verifier, ["--root", fixture.scratch]);
    assert.equal(nextVerification.status, 0, nextVerification.stderr || nextVerification.stdout);
    assert.equal((await fs.lstat(result.cleanupPending)).isDirectory(), true);
  } finally {
    await rm(fixture.scratch, { recursive: true, force: true });
  }
});
