import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
    ["dot-segment vendor CLI", "SKILL.md", "node skills/svg-infographic/./scripts/render.mjs in.svg out.png\n", /raw vendor CLI/u],
    ["parent-segment vendor CLI", "SKILL.md", "node skills/svg-infographic/tmp/../scripts/check-svg.mjs out.svg\n", /raw vendor CLI/u],
    ["repeated-separator vendor CLI", "SKILL.md", "node skills//svg-infographic///scripts/render.mjs in.svg out.png\n", /raw vendor CLI/u],
    ["percent-encoded vendor CLI", "SKILL.md", "node skills/svg-infographic/%73cripts/render.mjs in.svg out.png\n", /raw vendor CLI/u],
    ["unicode-separator vendor CLI", "SKILL.md", "node skills∕svg-infographic∕scripts∕render.mjs in.svg out.png\n", /raw vendor CLI/u],
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

test("tree audit rejects POSIX-shell-equivalent raw vendor commands after quote and escape concatenation", async (t) => {
  const shellWords = [
    'skills/svg-"infographic"/scripts/render.mjs',
    "'skills/svg-infographic/'\"scripts\"/check-svg.mjs",
    "skills/svg-infographic/scripts/render\\.mjs",
    "skills/svg-infographic/scripts/\\\nrender.mjs",
  ];
  for (const shellWord of shellWords) {
    await t.test(JSON.stringify(shellWord), async (t) => {
      const resolved = spawnSync("/bin/sh", ["-c", `set -- ${shellWord}; printf '%s' "$1"`], { encoding: "utf8" });
      assert.equal(resolved.status, 0, resolved.stderr);
      assert.match(resolved.stdout, /^skills\/svg-infographic\/scripts\/(?:check-svg|render)\.mjs$/u);
      const root = await fixture(t, "SKILL.md", `node ${shellWord} input.svg output.png\n`);
      await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI/u);
    });
  }
});

test("tree audit conservatively rejects recursive percent and Windows command concatenation while allowing wrappers", async (t) => {
  const attacks = [
    "node skills/svg-infographic/%25252573cripts/render.mjs input.svg output.png\n",
    "node skills^/svg-infographic^/scripts^/render^.mjs input.svg output.png\n",
    'node "skills/svg-""infographic/scripts/render.mjs" input.svg output.png\n',
    "node\tskills/svg-infographic/scripts/\\\ncheck-svg.mjs\toutput.svg\n",
  ];
  for (const contents of attacks) {
    const root = await fixture(t, "SKILL.md", contents);
    await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI/u);
  }

  const wrapperRoot = await fixture(
    t,
    "SKILL.md",
    "node skills/visualize-game-design/scripts/run-skillstead.mjs input.svg output.png\n",
  );
  assert.equal((await auditTree({ root: wrapperRoot, packageName: "game-design-studio" })).files, 1);
});

test("tree audit applies POSIX backslash escaping to every non-newline character", async (t) => {
  const shellWords = [
    "skills/svg-\\infographic/scripts/render.mjs",
    "skills/\\svg-infographic/\\scripts/\\check-svg.mjs",
  ];
  for (const shellWord of shellWords) {
    const resolved = spawnSync("/bin/sh", ["-c", `set -- ${shellWord}; printf '%s' "$1"`], { encoding: "utf8" });
    assert.equal(resolved.status, 0, resolved.stderr);
    assert.match(resolved.stdout, /^skills\/svg-infographic\/scripts\/(?:check-svg|render)\.mjs$/u);
    const root = await fixture(t, "SKILL.md", `node ${shellWord} input.svg output.png\n`);
    await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI/u);
  }
});

test("tree audit fails closed on unclosed shell quotes and deeply encoded vendor paths", async (t) => {
  const malformed = await fixture(t, "SKILL.md", "node 'skills/svg-infographic/scripts/render.mjs input.svg\n");
  await assert.rejects(() => auditTree({ root: malformed, packageName: "game-design-studio" }), /malformed shell quoting/i);

  for (const depth of [9, 33]) {
    const encodedScripts = `%${"25".repeat(depth - 1)}73cripts`;
    const encodedSlash = `%${"25".repeat(depth - 1)}2F`;
    for (const command of [
      `node skills/svg-infographic/${encodedScripts}/render.mjs input.svg output.png\n`,
      `node skills${encodedSlash}svg-infographic${encodedSlash}scripts${encodedSlash}render.mjs input.svg output.png\n`,
    ]) {
      const root = await fixture(t, "SKILL.md", command);
      await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI|encoded shell path/i);
    }
  }
});
