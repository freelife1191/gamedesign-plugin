import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditTree } from "../../tooling/lib/tree-audit.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const productNames = ["game-design-career", "game-design-studio"];

async function fixture(t, relativePath, bytes) {
  const root = await mkdtemp(path.join(tmpdir(), "tree-audit-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return root;
}

test("each generated plugin is UTF-8, self-contained, and free of sibling or host paths", async () => {
  for (const packageName of productNames) {
    const result = await auditTree({
      root: path.join(repoRoot, "plugins", packageName),
      packageName,
      siblingNames: productNames.filter((name) => name !== packageName),
      forbiddenAbsolutePaths: [repoRoot, path.dirname(repoRoot), homedir()],
    });
    assert.ok(result.files > 100, `${packageName}: unexpectedly small snapshot`);
    assert.equal(result.files, result.utf8Files);
    assert.equal(result.symlinks, 0);
  }
});

test("tree audit rejects invalid UTF-8, symlinks, escape links, sibling names, host paths, repo fallbacks, and raw vendor CLIs", async (t) => {
  const cases = [
    ["invalid UTF-8", "bad.txt", Buffer.from([0xc3, 0x28]), /UTF-8/u],
    ["escape link", "README.md", "[outside](../../outside.md)\n", /escapes package root/u],
    ["sibling package", "README.md", "load game-design-career\n", /sibling package/u],
    ["repo absolute", "config.json", `${repoRoot}/shared/scripts/check.mjs\n`, /forbidden absolute path/u],
    ["host absolute", "config.json", `${homedir()}/private/tool.mjs\n`, /forbidden absolute path/u],
    ["repo-only shared fallback", "script.mjs", "new URL('../../../../shared/scripts/check.mjs', import.meta.url)\n", /repo-only shared fallback/u],
    ["raw packaged vendor CLI", "SKILL.md", "node skills/svg-infographic/scripts/render.mjs in.svg out.png\n", /raw vendor CLI/u],
    ["raw host vendor CLI", "SKILL.md", "node .claude/skills/svg-infographic/scripts/render.mjs in.svg out.png\n", /raw vendor CLI/u],
  ];
  for (const [name, relativePath, contents, expected] of cases) {
    await t.test(name, async (t) => {
      const root = await fixture(t, relativePath, contents);
      await assert.rejects(() => auditTree({
        root,
        packageName: "game-design-studio",
        siblingNames: ["game-design-career"],
        forbiddenAbsolutePaths: [repoRoot, homedir()],
      }), expected);
    });
  }

  await t.test("symlink", async (t) => {
    const root = await fixture(t, "target.txt", "inside\n");
    await symlink(path.join(root, "target.txt"), path.join(root, "link.txt"));
    await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /symlink/u);
  });
});

test("immutable vendored Skillstead documentation remains auditable while product files must use wrappers", async (t) => {
  const root = await fixture(t, "skills/svg-infographic/SKILL.md", "node .claude/skills/svg-infographic/scripts/render.mjs in.svg out.png\n");
  await writeFile(path.join(root, "README.md"), "Use the product wrapper.\n");
  const result = await auditTree({ root, packageName: "game-design-studio" });
  assert.equal(result.files, 2);
});
