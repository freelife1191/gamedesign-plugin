import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MAX_PACKAGE_PATH_LENGTH, assertPackagePath, auditTree } from "../../tooling/lib/tree-audit.mjs";
import { packagedBinaryFiles, vendorDestinationRoots } from "../../tooling/lib/vendor-components.mjs";
import { posixShellFirstWord } from "../lib/platform-support.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const productNames = ["game-design-career", "game-design-studio"];
const inactiveReferenceSourceRuntimeTuples = new Set([
  "skills/analyze-game-design-references/SKILL.md\0../../../scripts/analyze-game-design-references.mjs",
  "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/manage-game-design-glossary.mjs",
  "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/validate-game-design-writing-language.mjs",
]);

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
    const binaryFiles = packagedBinaryFiles({ repoRoot, productName: packageName });
    const result = await auditTree({
      root: path.join(repoRoot, "plugins", packageName),
      packageName,
      siblingNames: productNames.filter((name) => name !== packageName),
      forbiddenAbsolutePaths: [repoRoot, path.dirname(repoRoot), homedir()],
      inactiveRelativeReferenceTuples: inactiveReferenceSourceRuntimeTuples,
      binaryFiles,
      vendorRoots: vendorDestinationRoots({ repoRoot, productName: packageName }),
    });
    assert.ok(result.files > 100, `${packageName}: unexpectedly small snapshot`);
    assert.equal(result.files, result.utf8Files + result.binaryFiles);
    assert.equal(result.binaryFiles, binaryFiles.size);
    assert.equal(result.symlinks, 0);
    assert.deepEqual(result.usedInactiveRelativeReferenceTuples, [...inactiveReferenceSourceRuntimeTuples].sort());
  }
});

test("tree audit rejects invalid UTF-8, symlinks, escape links, sibling names, host paths, repo fallbacks, and raw vendor CLIs", async (t) => {
  const cases = [
    ["invalid UTF-8", "bad.txt", Buffer.from([0xc3, 0x28]), /UTF-8/u],
    ["BOM in Markdown", "SKILL.md", Buffer.from("\uFEFF---\nname: demo\n---\n", "utf8"), /UTF-8 BOM/u],
    ["BOM in JSON", "plugin.json", Buffer.from("\uFEFF{}\n", "utf8"), /UTF-8 BOM/u],
    ["CRLF line ending", "README.md", "line one\r\nline two\n", /must use LF/u],
    ["lone CR", "README.md", "line one\rline two\n", /must use LF/u],
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

test("tree audit permits only the update policy's exact product IDs and rejects an injected sibling import", async (t) => {
  const root = await fixture(
    t,
    "references/shared/updates/update-policy.json",
    await readFile(path.join(repoRoot, "shared/updates/update-policy.json")),
  );
  const evaluatorPath = path.join(root, "scripts/lib/update-advisory.mjs");
  const evaluator = await readFile(path.join(repoRoot, "shared/scripts/lib/update-advisory.mjs"));
  await mkdir(path.dirname(evaluatorPath), { recursive: true });
  await writeFile(evaluatorPath, evaluator);

  await assert.doesNotReject(() => auditTree({
    root,
    packageName: "game-design-studio",
    siblingNames: ["game-design-career"],
  }));

  await writeFile(evaluatorPath, `${evaluator}\nimport sibling from "game-design-career";\n`);
  await assert.rejects(() => auditTree({
    root,
    packageName: "game-design-studio",
    siblingNames: ["game-design-career"],
  }), /sibling package/u);
});

test("tree audit permits only the shared plugin inspector's exact product IDs and rejects an injected sibling import", async (t) => {
  const inspector = await readFile(path.join(repoRoot, "shared/scripts/inspect-game-design-plugin-updates.mjs"));
  const root = await fixture(t, "scripts/inspect-game-design-plugin-updates.mjs", inspector);
  const inspectorPath = path.join(root, "scripts/inspect-game-design-plugin-updates.mjs");

  for (const [packageName, siblingName] of [
    ["game-design-studio", "game-design-career"],
    ["game-design-career", "game-design-studio"],
  ]) {
    await assert.doesNotReject(() => auditTree({
      root,
      packageName,
      siblingNames: [siblingName],
    }));
  }

  await writeFile(inspectorPath, `${inspector}\nimport sibling from "game-design-career";\n`);
  await assert.rejects(() => auditTree({
    root,
    packageName: "game-design-studio",
    siblingNames: ["game-design-career"],
  }), /sibling package/u);
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
      // The shell is the oracle, not the subject: it establishes that this hostile word really does
      // resolve to the vendor path before the audit is asked to reject it. A host with no POSIX shell
      // cannot answer that, and the rejection below is what the test is actually for, so the oracle is
      // the only part that stands down.
      const resolved = posixShellFirstWord(shellWord);
      if (resolved !== null) assert.match(resolved, /^skills\/svg-infographic\/scripts\/(?:check-svg|render)\.mjs$/u);
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
    const resolved = posixShellFirstWord(shellWord);
    if (resolved !== null) assert.match(resolved, /^skills\/svg-infographic\/scripts\/(?:check-svg|render)\.mjs$/u);
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

test("tree audit tokenizes adjacent POSIX operators and decodes the vendor prefix before filtering", async (t) => {
  for (const operator of ["|", "||", "&&", "&", ";", "<", ">", "(", ")"]) {
    const root = await fixture(
      t,
      "SKILL.md",
      `echo safe${operator}node skills/svg-infographic/scripts/render.mjs input.svg output.png\n`,
    );
    await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI/u);
  }

  for (const encodedPrefix of [
    "%73vg-infographic",
    `%${"25".repeat(32)}73vg-infographic`,
  ]) {
    const root = await fixture(
      t,
      "SKILL.md",
      `node skills/${encodedPrefix}/scripts/check-svg.mjs output.svg\n`,
    );
    await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI|encoded shell path/i);
  }
});

test("malformed percent text cannot mask a Windows raw vendor CLI on the same line", async (t) => {
  const root = await fixture(
    t,
    "SKILL.md",
    String.raw`echo malformed%ZZ&&node skills\svg-infographic\scripts\render.mjs input.svg output.png` + "\n",
  );
  await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /raw vendor CLI|encoded shell path/i);
});

test("package paths that collide after NFC and case folding are rejected", () => {
  const nfc = "references/한글.md".normalize("NFC");
  const nfd = "references/한글.md".normalize("NFD");
  assert.notEqual(nfc, nfd, "fixture must use distinct code point sequences");

  const unicodeSeen = new Map();
  assert.equal(assertPackagePath(nfc, unicodeSeen), nfc);
  assert.throws(() => assertPackagePath(nfd, unicodeSeen), /collides with/u);

  const caseSeen = new Map();
  assert.equal(assertPackagePath("skills/demo/SKILL.md", caseSeen), "skills/demo/SKILL.md");
  assert.throws(() => assertPackagePath("skills/demo/Skill.md", caseSeen), /collides with/u);

  const distinctSeen = new Map();
  assert.equal(assertPackagePath("a/one.md", distinctSeen), "a/one.md");
  assert.equal(assertPackagePath("a/two.md", distinctSeen), "a/two.md");
  assert.equal(distinctSeen.size, 2);
});

// String.prototype.toLowerCase() is ECMAScript simple case mapping, which is narrower than the
// caseless-compare tables NTFS and APFS actually use. Each pair below was written to a real APFS
// directory and collapsed to a single entry there, so a tree carrying both on a case-sensitive
// checkout would silently lose one file when a macOS or Windows user installs it. Folding through
// toUpperCase() first reaches those mappings; the final NFC pass re-composes anything the
// round trip decomposed. Turkish dotted capital I is the control: the filesystem keeps `İ.md` and
// `i.md` apart, so the gate must keep them apart too rather than over-rejecting.
test("package paths that collide on real case-insensitive filesystems are rejected", () => {
  const collidingPairs = [
    ["long s", "references/S.md", "references/ſ.md"],
    ["final sigma", "references/Σ.md", "references/ς.md"],
    ["lowercase sigma", "references/σ.md", "references/ς.md"],
    ["eszett", "references/straße.md", "references/STRASSE.md"],
    ["fi ligature", "references/ﬁle.md", "references/file.md"],
  ];
  for (const [label, first, second] of collidingPairs) {
    const seen = new Map();
    assert.equal(assertPackagePath(first, seen), first, `${label} first path must be accepted`);
    assert.throws(() => assertPackagePath(second, seen), /collides with/u, `${label} must be rejected`);
  }

  const dottedSeen = new Map();
  assert.equal(assertPackagePath("references/İ.md", dottedSeen), "references/İ.md");
  assert.equal(assertPackagePath("references/i.md", dottedSeen), "references/i.md");
  assert.equal(dottedSeen.size, 2, "paths the filesystem keeps distinct must stay distinct");
});

test("package paths stay inside the length budget", async (t) => {
  assert.equal(MAX_PACKAGE_PATH_LENGTH, 150);

  const atBudget = `${"a".repeat(74)}/${"b".repeat(75)}`;
  assert.equal(atBudget.length, MAX_PACKAGE_PATH_LENGTH);
  assert.equal(assertPackagePath(atBudget, new Map()), atBudget);

  const overBudget = `${"a".repeat(74)}/${"b".repeat(76)}`;
  assert.equal(overBudget.length, MAX_PACKAGE_PATH_LENGTH + 1);
  assert.throws(() => assertPackagePath(overBudget, new Map()), /path budget/u);

  const root = await fixture(t, `${"n".repeat(80)}/${"m".repeat(80)}.md`, "over budget\n");
  await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /path budget/u);
});

test("the length budget is measured against the NFC form, not the un-normalized NFD form", () => {
  // U+AC01 "각" decomposes into 3 NFD jamo (choseong+jungseong+jongseong) per NFC syllable,
  // so 60 repeats push the NFD form well past the budget while the NFC form stays under it.
  // This mirrors a real packaged path in this repo (97 chars in NFC, 156 in NFD).
  const nfc = `references/source/docs/${"각".repeat(60)}.md`;
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfc, nfd, "fixture must use distinct code point sequences");
  assert.ok(nfd.length > MAX_PACKAGE_PATH_LENGTH, `NFD form (${nfd.length}) must exceed the budget`);
  assert.ok(nfc.length <= MAX_PACKAGE_PATH_LENGTH, `NFC form (${nfc.length}) must stay within the budget`);
  assert.equal(assertPackagePath(nfd, new Map()), nfd);
});

// The binary lane exists so a vendored upstream can ship a font. It is the vendor lock that says which
// files those are, and this pins that the lane is exactly as wide as the lock and no wider.
test("the binary lane admits only lock-registered bytes and still refuses everything else", async (t) => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from([0x00, 0xff, 0x10])]);
  const digest = createHash("sha256").update(png).digest("hex");
  const registered = new Map([["assets/mark.png", { size: png.length, sha256: digest }]]);

  const root = await fixture(t, "assets/mark.png", png);
  const audit = await auditTree({ root, packageName: "game-design-studio", binaryFiles: registered });
  assert.deepEqual({ files: audit.files, utf8Files: audit.utf8Files, binaryFiles: audit.binaryFiles }, { files: 1, utf8Files: 0, binaryFiles: 1 });

  await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /not valid UTF-8/u, "an unregistered binary is still rejected");
  await assert.rejects(
    () => auditTree({ root, packageName: "game-design-studio", binaryFiles: new Map([["assets/mark.png", { size: png.length, sha256: "0".repeat(64) }]]) }),
    /registered binary digest/u,
    "a registered path with the wrong digest is rejected",
  );
  await assert.rejects(
    () => auditTree({ root, packageName: "game-design-studio", binaryFiles: new Map([["assets/mark.png", { size: png.length + 1, sha256: digest }]]) }),
    /registered as binary at/u,
    "a registered path with the wrong size is rejected",
  );
  await assert.rejects(
    () => auditTree({ root, packageName: "game-design-studio", binaryFiles: new Map([...registered, ["assets/absent.png", { size: 1, sha256: "0".repeat(64) }]]) }),
    /registered binary files are absent/u,
    "a register entry with no file behind it is reported",
  );
});

test("a script renamed to a media extension cannot buy its way into the binary lane", async (t) => {
  const script = Buffer.from("import fs from \"node:fs\";\n");
  const registered = new Map([["assets/payload.png", { size: script.length, sha256: createHash("sha256").update(script).digest("hex") }]]);
  const root = await fixture(t, "assets/payload.png", script);
  await assert.rejects(
    () => auditTree({ root, packageName: "game-design-studio", binaryFiles: registered }),
    /does not start with a \.png signature/u,
  );
});

test("binary bytes are still searched for sibling package names and host paths", async (t) => {
  for (const [label, needle, expected] of [
    ["sibling", "game-design-career", /references sibling package/u],
    ["host path", `${homedir()}/private/tool.mjs`, /forbidden absolute path/u],
  ]) {
    await t.test(label, async (t) => {
      const bytes = Buffer.concat([
        Buffer.from([0x00, 0x01, 0x00, 0x00]),
        Buffer.from(needle, "utf8"),
      ]);
      const root = await fixture(t, "assets/font.ttf", bytes);
      await assert.rejects(() => auditTree({
        root,
        packageName: "game-design-studio",
        siblingNames: ["game-design-career"],
        forbiddenAbsolutePaths: [repoRoot, homedir()],
        binaryFiles: new Map([["assets/font.ttf", { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }]]),
      }), expected);
    });
  }
});

// An upstream test fixture may quote an import path that leaves the package. Those bytes are the tag's,
// verified and unmodifiable, so the escape gate does not apply to them — but the repo-only fallback
// pattern still does, because no upstream has any reason to write it.
test("a vendored file may quote an escaping path, and still may not name this repository", async (t) => {
  const root = await fixture(t, "skills/svg-infographic/scripts/preflight.test.mjs", 'import y from "../../../../outside.mjs";\n');
  await assert.doesNotReject(() => auditTree({ root, packageName: "game-design-studio", vendorRoots: ["skills/svg-infographic"] }));
  await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /escapes package root/u);

  const fallback = await fixture(t, "skills/svg-infographic/scripts/loader.mjs", "new URL('../../../../shared/scripts/check.mjs', import.meta.url)\n");
  await assert.rejects(
    () => auditTree({ root: fallback, packageName: "game-design-studio", vendorRoots: ["skills/svg-infographic"] }),
    /repo-only shared fallback/u,
  );
});
