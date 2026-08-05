import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildProduct } from "../../tooling/lib/build-product.mjs";
import * as copyTree from "../../tooling/lib/copy-tree.mjs";

const fixtureRoot = new URL("../fixtures/minimal-product/", import.meta.url);

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

async function createRepo(t, mutate = async () => {}) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "build-product-test-"));
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const repoRoot = path.join(temporaryRoot, "repo");
  const stagingRoot = path.join(temporaryRoot, "staging");
  const contract = JSON.parse(await readFile(new URL("product.json", fixtureRoot), "utf8"));
  const manifest = await readFile(new URL("plugin/.codex-plugin/plugin.json", fixtureRoot));

  await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
  await writeText(repoRoot, "products/minimal-product/plugin/.codex-plugin/plugin.json", manifest);
  await writeJson(path.join(repoRoot, "shared/knowledge/reference-index.json"), {
    schemaVersion: 1,
    documents: [
      { id: "guide-one", sourcePath: "docs/guides/one.md", category: "guides" },
      { id: "guide-two", sourcePath: "docs/guides/two.md", category: "guides" },
    ],
  });
  await writeText(repoRoot, "shared/knowledge/topic.md", "shared knowledge\n");
  await writeText(repoRoot, "shared/templates/template.txt", "template\n");
  await writeText(repoRoot, "shared/responsible-design/safety.md", "safety\n");
  await writeText(repoRoot, "shared/export/export.md", "export\n");
  await writeText(repoRoot, "shared/vendor/skillstead/svg-infographic/0.8.3/SKILL.md", "vendor\n");
  await writeText(repoRoot, "shared/hooks/runtime.mjs", "export default {};\n");
  await writeText(repoRoot, "shared/scripts/check.mjs", "export default true;\n");
  await writeText(repoRoot, "docs/guides/one.md", "one\n");
  await writeText(repoRoot, "docs/guides/two.md", "two\n");

  await mutate({ contract, repoRoot, stagingRoot });
  return { repoRoot, stagingRoot };
}

async function hasSymlink(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) return true;
    if (entry.isDirectory() && await hasSymlink(path.join(root, entry.name))) return true;
  }
  return false;
}

test("shared content is mapped before the product overlay without emitting symlinks", async (t) => {
  const fixture = await createRepo(t);
  const result = await buildProduct({ ...fixture, productName: "minimal-product" });

  assert.deepEqual(result.sources, ["shared", "product"]);
  assert.deepEqual(result.files, [
    ".codex-plugin/plugin.json",
    "assets/shared/templates/template.txt",
    "hooks/runtime.mjs",
    "references/shared/export/export.md",
    "references/shared/knowledge/reference-index.json",
    "references/shared/knowledge/topic.md",
    "references/shared/responsible-design/safety.md",
    "scripts/check.mjs",
    "skills/svg-infographic/SKILL.md",
  ]);
  assert.equal(await hasSymlink(result.outputDir), false);
});

test("document-quality is copied deterministically and rejects collisions and symlinks", async (t) => {
  await t.test("byte-identical deterministic copy", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sharedModules.push("document-quality");
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      await writeText(repoRoot, "shared/document-quality/schema/profile.json", "{\"stable\":true}\n");
    });
    const result = await buildProduct({ ...fixture, productName: "minimal-product" });
    const destination = "references/shared/document-quality/schema/profile.json";
    assert.ok(result.files.includes(destination));
    assert.deepEqual(
      await readFile(path.join(result.outputDir, destination)),
      await readFile(path.join(fixture.repoRoot, "shared/document-quality/schema/profile.json")),
    );
  });

  await t.test("content collision", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sharedModules.push("document-quality");
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      await writeText(repoRoot, "shared/document-quality/collision.txt", "shared\n");
      await writeText(repoRoot, "products/minimal-product/plugin/references/shared/document-quality/collision.txt", "product\n");
    });
    await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), /content collision/i);
  });

  await t.test("source symlink", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sharedModules.push("document-quality");
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      await mkdir(path.join(repoRoot, "shared/document-quality"), { recursive: true });
      await symlink("../export/export.md", path.join(repoRoot, "shared/document-quality/export-link.md"));
    });
    await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), /symlink/i);
  });
});

test("different bytes targeting one package path are rejected", async (t) => {
  const fixture = await createRepo(t, async ({ repoRoot }) => {
    await writeText(repoRoot, "products/minimal-product/plugin/hooks/runtime.mjs", "different\n");
  });

  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /content collision/i,
  );
});

test("unsafe product source roots are rejected", async (t) => {
  const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
    contract.sourceRoots = ["../escape"];
    await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
  });

  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /unsafe path/i,
  );
});

test("contracts reject unknown keys, invalid names, and disabled shared runtime", async (t) => {
  const cases = [
    ["unknown top-level key", (contract) => { contract.extra = true; }, /unknown product key/i],
    ["invalid plugin name", (contract) => { contract.name = "Invalid_Name"; }, /invalid plugin name/i],
    ["shared runtime disabled", (contract) => { contract.sharedRuntime = false; }, /sharedRuntime.*true/i],
  ];

  for (const [name, change, expected] of cases) {
    await t.test(name, async (t) => {
      const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
        change(contract);
        await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      });
      await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), expected);
    });
  }
});

test("source roots reject missing, absolute, NUL, and NFC-duplicate paths", async (t) => {
  const cases = [
    ["missing", ["missing"], /missing source root/i],
    ["absolute", ["/plugin"], /unsafe path/i],
    ["NUL", ["plugin\0tail"], /unsafe path/i],
    ["NFC duplicate", ["café", "cafe\u0301"], /duplicate normalized path/i],
  ];

  for (const [name, sourceRoots, expected] of cases) {
    await t.test(name, async (t) => {
      const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
        contract.sourceRoots = sourceRoots;
        await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      });
      await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), expected);
    });
  }
});

test("symlinks in declared trees are rejected", async (t) => {
  const fixture = await createRepo(t, async ({ repoRoot }) => {
    await symlink(
      path.join(repoRoot, "shared/templates/template.txt"),
      path.join(repoRoot, "products/minimal-product/plugin/template-link.txt"),
    );
  });

  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /symlink/i,
  );
});

test("collectTree records directories in the NFC collision registry before recursion", async (t) => {
  const fixture = await createRepo(t, async ({ repoRoot }) => {
    await writeText(repoRoot, "products/minimal-product/plugin/café/one.txt", "one\n");
  });
  const registry = copyTree.createNormalizedPathRegistry("product fixture");
  await copyTree.collectTree(path.join(fixture.repoRoot, "products/minimal-product/plugin"), {
    label: "product fixture",
    registry,
  });

  assert.throws(
    () => registry.record("cafe\u0301", "café", "directory"),
    /duplicate normalized path/i,
  );
});

test("symlinked ancestors of declared trees are rejected", async (t) => {
  const fixture = await createRepo(t, async ({ repoRoot }) => {
    await rename(path.join(repoRoot, "shared"), path.join(repoRoot, "shared-real"));
    await symlink(path.join(repoRoot, "shared-real"), path.join(repoRoot, "shared"));
  });

  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /symlink/i,
  );
});

test("a symlinked reference index ancestor is rejected when knowledge is not packaged", async (t) => {
  const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
    contract.sharedModules = ["templates", "responsible-design", "export", "vendor"];
    contract.sourceDocuments = ["guide-one"];
    await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
    await rename(path.join(repoRoot, "shared/knowledge"), path.join(repoRoot, "shared/knowledge-real"));
    await symlink(path.join(repoRoot, "shared/knowledge-real"), path.join(repoRoot, "shared/knowledge"));
  });

  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /symlink.*reference index/i,
  );
});

test("source document IDs and categories resolve only through the reference index", async (t) => {
  await t.test("selected document ID", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sourceDocuments = ["guide-one"];
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
    });
    const result = await buildProduct({ ...fixture, productName: "minimal-product" });
    assert.equal(await readFile(path.join(result.outputDir, "references/source/docs/guides/one.md"), "utf8"), "one\n");
    assert.equal(result.files.includes("references/source/docs/guides/two.md"), false);
  });

  await t.test("selected category", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      delete contract.sourceDocuments;
      contract.sourceDocumentCategories = ["guides"];
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
    });
    const result = await buildProduct({ ...fixture, productName: "minimal-product" });
    assert.equal(result.files.includes("references/source/docs/guides/one.md"), true);
    assert.equal(result.files.includes("references/source/docs/guides/two.md"), true);
  });

  await t.test("missing ID", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sourceDocuments = ["unknown"];
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
    });
    await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), /missing source id/i);
  });

  await t.test("ambiguous ID", async (t) => {
    const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
      contract.sourceDocuments = ["guide-one"];
      await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
      await writeJson(path.join(repoRoot, "shared/knowledge/reference-index.json"), {
        documents: [
          { id: "guide-one", sourcePath: "docs/guides/one.md", category: "guides" },
          { id: "guide-one", sourcePath: "docs/guides/two.md", category: "guides" },
        ],
      });
    });
    await assert.rejects(() => buildProduct({ ...fixture, productName: "minimal-product" }), /ambiguous source id/i);
  });
});

test("non-canonical reference index shapes are rejected", async (t) => {
  const fixture = await createRepo(t, async ({ contract, repoRoot }) => {
    contract.sourceDocuments = ["guide-one"];
    await writeJson(path.join(repoRoot, "products/minimal-product/product.json"), contract);
    await writeJson(path.join(repoRoot, "shared/knowledge/reference-index.json"), {
      entries: [{ id: "guide-one", sourcePath: "docs/guides/one.md", category: "guides" }],
    });
  });
  await assert.rejects(
    () => buildProduct({ ...fixture, productName: "minimal-product" }),
    /reference index.*documents/i,
  );
});

test("clean builds have stable lexical files, hashes, bytes, and mtimes", async (t) => {
  const firstFixture = await createRepo(t);
  const secondFixture = await createRepo(t);
  const sourceDateEpoch = 946684800;
  const first = await buildProduct({ ...firstFixture, productName: "minimal-product", sourceDateEpoch });
  const second = await buildProduct({ ...secondFixture, productName: "minimal-product", sourceDateEpoch });

  assert.deepEqual(first.files, [...first.files].sort());
  assert.deepEqual(first.files, second.files);
  assert.equal(first.sha256, second.sha256);
  for (const relativePath of first.files) {
    assert.deepEqual(
      await readFile(path.join(first.outputDir, relativePath)),
      await readFile(path.join(second.outputDir, relativePath)),
    );
    assert.equal(Math.floor((await stat(path.join(first.outputDir, relativePath))).mtimeMs / 1000), sourceDateEpoch);
    assert.equal((await lstat(path.join(first.outputDir, relativePath))).isSymbolicLink(), false);
  }
});

test("destructive or overlapping staging destinations are rejected before source bytes change", async (t) => {
  await t.test("source product overlap", async (t) => {
    const fixture = await createRepo(t);
    const sentinel = path.join(fixture.repoRoot, "products/minimal-product/product.json");
    const before = await readFile(sentinel);
    const error = await buildProduct({
      repoRoot: fixture.repoRoot,
      productName: "minimal-product",
      stagingRoot: path.join(fixture.repoRoot, "products"),
    }).then(() => undefined, (caught) => caught);

    assert.match(String(error?.message), /staging|destination|source|overlap/i);
    assert.deepEqual(await readFile(sentinel), before);
  });

  await t.test("non-empty destination", async (t) => {
    const fixture = await createRepo(t);
    const sentinel = path.join(fixture.stagingRoot, "minimal-product/IRREPLACEABLE/product.json");
    await writeText(fixture.stagingRoot, "minimal-product/IRREPLACEABLE/product.json", "do not delete\n");
    const before = await readFile(sentinel);
    const error = await buildProduct({ ...fixture, productName: "minimal-product" })
      .then(() => undefined, (caught) => caught);

    assert.match(String(error?.message), /non-empty|empty|destination/i);
    assert.deepEqual(await readFile(sentinel), before);
  });

  await t.test("symlinked staging ancestor", async (t) => {
    const fixture = await createRepo(t);
    const outside = path.join(path.dirname(fixture.stagingRoot), "outside");
    const sentinel = path.join(outside, "minimal-product/IRREPLACEABLE/product.json");
    await writeText(outside, "minimal-product/IRREPLACEABLE/product.json", "external bytes\n");
    await symlink(outside, fixture.stagingRoot);
    const before = await readFile(sentinel);
    const error = await buildProduct({ ...fixture, productName: "minimal-product" })
      .then(() => undefined, (caught) => caught);

    assert.match(String(error?.message), /symlink|staging|ancestor/i);
    assert.deepEqual(await readFile(sentinel), before);
  });

  for (const [name, stagingRoot] of [["filesystem root", path.parse(tmpdir()).root], ["home directory", homedir()]]) {
    await t.test(name, async (t) => {
      const fixture = await createRepo(t);
      await assert.rejects(
        () => buildProduct({ ...fixture, productName: "minimal-product", stagingRoot }),
        /root|home|staging/i,
      );
    });
  }
});
