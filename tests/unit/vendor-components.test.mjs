import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadVendorComponents,
  vendorMappings,
} from "../../tooling/lib/vendor-components.mjs";

const components = Object.freeze([
  Object.freeze({
    id: "skillstead",
    repository: "https://github.com/kyungseo/skillstead",
    installedTag: "svg-infographic/v0.9.0",
    commit: "6e5b850f66716af9eb3c6a79f60e4f8ff5716dee",
    treeRoot: "svg-infographic/0.9.0",
    destinationRoot: "skills/svg-infographic",
  }),
  Object.freeze({
    id: "archify",
    repository: "https://github.com/tt-a1i/archify",
    installedTag: "v2.13.0",
    commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3",
    treeRoot: "archify/2.13.0",
    destinationRoot: "skills/archify",
  }),
  Object.freeze({
    id: "im-not-ai",
    repository: "https://github.com/epoko77-ai/im-not-ai",
    installedTag: "v2.3.0",
    commit: "82137e858763dadb99561f194c5c00465735017b",
    treeRoot: "humanize-korean/v2.3.0",
    destinationRoot: "skills/humanize-korean",
  }),
]);

function vendorLock(component) {
  return {
    schemaVersion: 1,
    upstream: {
      repository: component.repository,
      tag: component.installedTag,
      commit: component.commit,
      releasedAt: "2026-08-15T00:00:00.000Z",
      skillPath: component.destinationRoot,
    },
    license: { spdx: "MIT", path: "LICENSE", sha256: "0".repeat(64) },
    tree: { root: component.treeRoot, files: [] },
  };
}

async function fixture(t, mutate = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), "vendor-components-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const component of components) {
    const lockPath = path.join(root, "shared", "vendor", component.id, "vendor.lock.json");
    await mkdir(path.dirname(lockPath), { recursive: true });
    await writeFile(lockPath, `${JSON.stringify(vendorLock(component))}\n`);
    await mkdir(path.join(root, "shared", "vendor", component.id, ...component.treeRoot.split("/")), { recursive: true });
  }
  await mutate(root);
  return root;
}

test("vendor locks produce exact installed component records and package mappings", async (t) => {
  const repoRoot = await fixture(t);

  assert.deepEqual(loadVendorComponents({ repoRoot }), components.map((component) => ({
    id: component.id,
    repository: component.repository,
    installedTag: component.installedTag,
    commit: component.commit,
    sourceRoot: `shared/vendor/${component.id}/${component.treeRoot}`,
    destinationRoot: component.destinationRoot,
  })));
  assert.deepEqual(vendorMappings({ repoRoot }), {
    vendor: [["shared/vendor/skillstead/svg-infographic/0.9.0", "skills/svg-infographic"]],
    archify: [["shared/vendor/archify/archify/2.13.0", "skills/archify"]],
    "im-not-ai": [["shared/vendor/im-not-ai/humanize-korean/v2.3.0", "skills/humanize-korean"]],
  });
});

test("Archify mapping follows a stable 2.14 lock tree without source rewrites", async (t) => {
  const repoRoot = await fixture(t, async (root) => {
    const lockPath = path.join(root, "shared/vendor/archify/vendor.lock.json");
    const lock = vendorLock({ ...components[1], installedTag: "v2.14.0", treeRoot: "archify/2.14.0" });
    await writeFile(lockPath, `${JSON.stringify(lock)}\n`);
    await mkdir(path.join(root, "shared/vendor/archify/archify/2.14.0"), { recursive: true });
  });

  assert.deepEqual(
    vendorMappings({ repoRoot }).archify,
    [["shared/vendor/archify/archify/2.14.0", "skills/archify"]],
  );
});

test("vendor lock rejects a tree root outside its vendor directory before copying", async (t) => {
  const repoRoot = await fixture(t, async (root) => {
    const lockPath = path.join(root, "shared/vendor/archify/vendor.lock.json");
    const lock = vendorLock(components[1]);
    lock.tree.root = "../../outside";
    await writeFile(lockPath, `${JSON.stringify(lock)}\n`);
  });

  assert.throws(
    () => loadVendorComponents({ repoRoot }),
    (error) => error?.code === "VENDOR_COMPONENT_TREE_ROOT_INVALID" && error.message === "archify tree root must be contained",
  );
});
