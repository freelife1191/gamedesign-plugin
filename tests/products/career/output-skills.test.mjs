import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "missing YAML frontmatter");
  return match[1].split("\n").map((line) => line.split(/:\s+/u, 2)[0]);
}

function tableFirstColumn(markdown, heading) {
  const section = markdown.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "u"));
  assert.ok(section, `missing section: ${heading}`);
  return section[1]
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
}

function assertVisualizationContract(presets, skill) {
  assert.deepEqual(presets.map(({ id }) => id), [
    "role-map",
    "competency-map",
    "learning-roadmap",
    "development-process",
    "portfolio-information-architecture",
    "growth-path",
  ]);
  for (const preset of presets) {
    assert.equal(preset.renderer, "skills/svg-infographic");
    assert.equal(preset.activeContentPolicy, "reject-script-and-style-elements");
    assert.ok(["hierarchy", "dependency", "sequence", "mapping"].includes(preset.relationship));
    assert.ok(preset.selectionQuestion);
    assert.ok(preset.exclusionCondition);
  }
  assert.match(skill, /Read `\.\.\/\.\.\/references\/visualization-presets\.json`/u);
  assert.match(skill, /selectedPresetId.*selectionRationale.*excludedPresets/isu);
  assert.deepEqual(tableFirstColumn(skill, "Produce and Verify"), [
    "requested",
    "planned",
    "generated",
    "linted",
    "rendered",
    "verified",
  ]);
  assert.match(skill, /record `source`, `baseline`, `owner`, and `validation`/u);
  assert.match(skill, /data-accurate chart/iu);
  assert.match(skill, /skills\/svg-infographic/iu);
  assert.match(skill, /alt text/iu);
  assert.match(skill, /exactly one non-empty `<title>`.*direct children.*root `<svg>`/iu);
  assert.match(skill, /Comments.*CDATA.*processing instructions.*attributes.*script\/style.*escaped markup.*DTDs.*entities/iu);
  assert.match(skill, /reject.*actual `<script>` or `<style>` element.*case.*namespace.*inline presentation.*style.*attributes/isu);
  assert.match(skill, /canonical valid UTF-8.*XML 1\.0 Fifth Edition `Char` production/iu);
  assert.match(skill, /XML 1\.0 Fifth Edition `Char` production.*#x9.*#xD7FF.*#xE000.*#xFFFD.*#x10000.*#x10FFFF/iu);
  assert.match(skill, /NUL.*forbidden C0.*surrogate encodings.*U\+FFFE.*U\+FFFF.*Korean.*C1.*U\+FDD0.*supplementary-plane/iu);
  assert.match(skill, /2.?×|2x/iu);
  assert.match(skill, /browser.*unavailable.*SVG.*PNG.*unavailable/isu);
  assert.doesNotMatch(skill, /\b\d+(?:\.\d+)?%/u, "skill contains an evidence-free percentage");
}

function assertExportContract(recipes, skill) {
  for (const type of [
    "learning-plan",
    "portfolio",
    "reverse-design",
    "review",
    "interview-report",
    "transition-report",
  ]) assert.match(recipes, new RegExp(`\\| ${"`"}${type}${"`"} \\|`, "u"));
  assert.match(recipes, /canonical validation.*before.*derivative/isu);
  assert.match(recipes, /availability.*status.*evidence/isu);
  assert.match(recipes, /`unknown` means no capability probe ran\./u);
  assert.match(recipes, /`unavailable` means a probe ran and proved the capability absent\./u);
  assert.match(recipes, /Preparation never accepts or emits terminal format status `passed` or `failed`/u);
  assert.match(recipes, /trusted downstream.*generation.*format-verification/isu);
  assert.match(recipes, /rejects `passed`, `failed`, generation evidence, QA evidence, and derivative file claims/isu);
  assert.match(recipes, /audience.*purpose.*story outline/isu);
  assert.match(recipes, /independent story.*not.*Markdown headings/isu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/export-recipes\.md`/u);
  assert.match(skill, /prepare-career-export\.mjs/u);
  assert.match(skill, /fail closed/iu);
  assert.match(skill, /never accepts or emits format status `passed` or `failed`/u);
}

async function loadPrepareModule() {
  const url = pathToFileURL(path.join(
    pluginRoot,
    "skills/export-career-documents/scripts/prepare-career-export.mjs",
  ));
  return import(`${url.href}?test=${Date.now()}`);
}

async function loadVisualizationModule() {
  const url = pathToFileURL(path.join(
    pluginRoot,
    "skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs",
  ));
  return import(`${url.href}?test=${Date.now()}`);
}

async function loadSkillsteadWrapper(root = pluginRoot) {
  const url = pathToFileURL(path.join(
    root,
    "skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
  ));
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

function pngFixture(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const value = Buffer.alloc(12 + data.length);
    value.writeUInt32BE(data.length, 0);
    value.write(type, 4, "latin1");
    data.copy(value, 8);
    value.writeUInt32BE(crc32(value.subarray(4, 8 + data.length)), 8 + data.length);
    return value;
  };
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  return Buffer.concat([signature, chunk("IHDR", ihdrData), chunk("IDAT", Buffer.from([0])), chunk("IEND", Buffer.alloc(0))]);
}

function corruptPngChunkCrc(bytes, type, replacement = 0) {
  const corrupted = Buffer.from(bytes);
  const typeOffset = corrupted.indexOf(Buffer.from(type, "latin1"));
  assert.ok(typeOffset >= 4, `missing PNG chunk ${type}`);
  const length = corrupted.readUInt32BE(typeOffset - 4);
  corrupted.writeUInt32BE(replacement >>> 0, typeOffset + 4 + length);
  return corrupted;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeCanonicalFixture(root) {
  await cp(path.join(repoRoot, "tests/fixtures/artifacts/valid"), root, { recursive: true });
  await writeFile(path.join(root, "content.md"), [
    "---", "title: Career Portfolio", "artifact_id: career-portfolio", "version: 1", "---",
    "# Career Portfolio {#career-portfolio}", "", "## Evidence {#evidence}", "", "Evidence-led portfolio.", "",
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "export-manifest.yml"), [
    "artifact_id: career-portfolio", "formats:", "  md:", "    status: passed", "  pdf:", "    status: pending",
    "  docx:", "    status: unavailable", "  pptx:", "    status: pending", "    audience: recruiter",
    "    purpose: review evidence", "    slide_outline:", "      - title: Evidence", "",
  ].join("\n"), "utf8");
}

function minimalPdf() {
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n2 0 obj<</Type /Pages /Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type /Page /Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Root 1 0 R /Size 4>>\nstartxref\n0\n%%EOF\n");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, source] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(source);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    data.copy(local, 30 + nameBytes.length);
    locals.push(local);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, eocd]);
}

function minimalDocx() {
  return storedZip({
    "[Content_Types].xml": "<Types></Types>",
    "_rels/.rels": '<Relationships><Relationship Target="word/document.xml"/></Relationships>',
    "word/document.xml": '<w:document xmlns:w="urn:w"><w:body/></w:document>',
    "word/_rels/document.xml.rels": '<Relationships><Relationship Target="styles.xml"/></Relationships>',
  });
}

function minimalPptx() {
  return storedZip({
    "[Content_Types].xml": "<Types></Types>",
    "_rels/.rels": '<Relationships><Relationship Target="ppt/presentation.xml"/></Relationships>',
    "ppt/presentation.xml": '<p:presentation xmlns:p="urn:p"></p:presentation>',
    "ppt/_rels/presentation.xml.rels": '<Relationships><Relationship Target="slides/slide1.xml"/></Relationships>',
    "ppt/slides/slide1.xml": '<p:sld xmlns:p="urn:p"></p:sld>',
    "ppt/slides/_rels/slide1.xml.rels": '<Relationships><Relationship Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
  });
}

function baseJob(root) {
  return {
    schemaVersion: 1,
    artifactRoot: root,
    artifactId: "career-portfolio",
    documentType: "portfolio",
    canonicalValidation: {
      status: "passed",
      command: "node validate-canonical.mjs artifact",
      file: "content.md",
      verification: "frontmatter, stable IDs, evidence links, and relative assets passed",
    },
    formats: {
      md: { requested: true, availability: "unknown", status: "blocked", evidence: [] },
      pdf: { requested: false, availability: "unknown", status: "not-requested", evidence: [] },
      docx: { requested: false, availability: "unknown", status: "not-requested", evidence: [] },
      pptx: { requested: false, availability: "unknown", status: "not-requested", evidence: [] },
    },
  };
}

test("visualization presets and skill preserve structural selection and evidence states", async () => {
  const presets = JSON.parse(await read("references/visualization-presets.json"));
  const skill = await read("skills/visualize-career-roadmap/SKILL.md");
  assert.deepEqual(frontmatter(skill), ["name", "description"]);
  assertVisualizationContract(presets, skill);
});

test("structural diagram routes prefer optional Archify while retaining packaged fallback evidence", async () => {
  const skills = await Promise.all([
    read("skills/visualize-career-roadmap/SKILL.md"),
    read("skills/orchestrate-game-design-career/SKILL.md"),
  ]);

  for (const skill of skills) {
    assert.match(skill, /(?:architecture|component boundaries), workflow, sequence, dataflow, or lifecycle/iu);
    assert.match(skill, /packaged `?\$archify`?/iu);
    assert.match(skill, /source-backed JSON spec.*checked HTML.*receipt/isu);
    assert.match(skill, /packaged `?\$svg-infographic`?/iu);
    assert.match(skill, /(?:does not replace|never replaces).*grants? approval/isu);
    assert.doesNotMatch(skill, /capabilities\.archify|host Archify|archify-unavailable/isu);
  }
});

test("visualization mutation guard rejects missing presets and weakened evidence boundaries", async () => {
  const presets = JSON.parse(await read("references/visualization-presets.json"));
  const skill = await read("skills/visualize-career-roadmap/SKILL.md");
  const mutations = [
    [presets.slice(1), skill],
    [presets.map((item, index) => index === 0 ? { ...item, renderer: "generic-svg" } : item), skill],
    [presets.map((item, index) => index === 0 ? { ...item, activeContentPolicy: "allow-style-elements" } : item), skill],
    [presets, skill.replace("selectedPresetId", "diagramType")],
    [presets, skill.replace("requested", "wanted")],
    [presets, skill.replace(
      "record `source`, `baseline`, `owner`, and `validation`",
      "record `note`, `baseline`, `owner`, and `validation`",
    )],
    [presets, skill.replace(/data-accurate chart/iu, "infographic")],
    [presets, `${skill}\nProgress is 50%.\n`],
  ];
  for (const [index, [mutatedPresets, mutatedSkill]] of mutations.entries()) {
    assert.throws(
      () => assertVisualizationContract(mutatedPresets, mutatedSkill),
      undefined,
      `visualization mutation ${index + 1} survived`,
    );
  }
});

test("plugin-owned visualization validator rejects impossible state and artifact claims", async () => {
  const { validateVisualizationState } = await loadVisualizationModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-viz-"));
  try {
    const svgSource = '<svg role="img" aria-label="Role evidence map" viewBox="0 0 600 300"><title>Role evidence map</title><desc>Evidence maps to provisional paths.</desc></svg>';
    await writeFile(path.join(root, "career-map.svg"), svgSource, "utf8");
    await writeFile(path.join(root, "career-map.png"), pngFixture(1200, 600));
    await writeFile(path.join(root, "other.png"), pngFixture(1200, 600));
    const svgOnly = {
      artifactRoot: root,
      requested: true,
      planned: true,
      generated: true,
      linted: true,
      rendered: false,
      verified: false,
      svgFile: "career-map.svg",
      pngAvailability: "unavailable",
      altText: "Role evidence map",
      availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "failed", reason: "no Chromium found" },
      lintEvidence: {
        command: "node run-skillstead.mjs lint career-map.svg",
        file: "career-map.svg",
        result: "passed",
        sha256: digest(Buffer.from(svgSource)),
        errors: [],
        warnings: [],
        warningsDisposition: "No warnings.",
      },
    };
    assert.doesNotThrow(() => validateVisualizationState(svgOnly));
    for (const mutation of [
      { ...svgOnly, requested: false },
      { ...svgOnly, planned: false },
      { ...svgOnly, generated: false },
      { ...svgOnly, lintEvidence: null },
      { ...svgOnly, lintEvidence: { ...svgOnly.lintEvidence, sha256: "0".repeat(64) } },
      { ...svgOnly, lintEvidence: { ...svgOnly.lintEvidence, warningsDisposition: "No SVG lint warnings." } },
      { ...svgOnly, lintEvidence: { ...svgOnly.lintEvidence, command: "node check-svg.mjs career-map.svg" } },
      { ...svgOnly, availabilityEvidence: { ...svgOnly.availabilityEvidence, command: "node render.mjs --probe" } },
      { ...svgOnly, svgFile: "../outside.svg" },
      { ...svgOnly, svgFile: "missing.svg" },
      { ...svgOnly, rendered: true },
      { ...svgOnly, verified: true },
    ]) assert.throws(() => validateVisualizationState(mutation));

    const verified = {
      ...svgOnly,
      pngAvailability: "available",
      availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "passed", reason: "Chromium found" },
      rendered: true,
      verified: true,
      pngFile: "career-map.png",
      altText: "Role evidence map",
      visualQa: "No clipping; relationship labels inspected.",
      renderEvidence: {
        command: "node run-skillstead.mjs render career-map.svg career-map.png",
        svgFile: "career-map.svg",
        pngFile: "career-map.png",
        browser: "Chromium 150",
        result: "passed",
        scale: 2,
        sourceWidth: 600,
        sourceHeight: 300,
        outputWidth: 1200,
        outputHeight: 600,
      },
    };
    assert.doesNotThrow(() => validateVisualizationState(verified));
    for (const mutation of [
      { ...verified, pngFile: "other.png" },
      { ...verified, renderEvidence: { ...verified.renderEvidence, scale: 1 } },
      { ...verified, renderEvidence: { ...verified.renderEvidence, outputWidth: 1199 } },
      { ...verified, renderEvidence: { ...verified.renderEvidence, svgFile: "missing.svg" } },
      { ...verified, renderEvidence: { ...verified.renderEvidence, pngFile: "other.png" } },
      { ...verified, renderEvidence: { ...verified.renderEvidence, command: "node render.mjs career-map.svg career-map.png" } },
      { ...verified, altText: "" },
      { ...verified, altText: "Forged alt text" },
    ]) assert.throws(() => validateVisualizationState(mutation));

    const partial = pngFixture(1200, 600).subarray(0, 33);
    await writeFile(path.join(root, "partial.png"), partial);
    assert.throws(() => validateVisualizationState({
      ...verified,
      pngFile: "partial.png",
      renderEvidence: { ...verified.renderEvidence, pngFile: "partial.png" },
    }), /complete PNG/iu);

    const validPng = pngFixture(1200, 600);
    for (const type of ["IHDR", "IDAT", "IEND"]) {
      const file = `bad-${type.toLowerCase()}.png`;
      await writeFile(path.join(root, file), corruptPngChunkCrc(validPng, type));
      assert.throws(() => validateVisualizationState({
        ...verified,
        pngFile: file,
        renderEvidence: { ...verified.renderEvidence, pngFile: file },
      }), new RegExp(`${type}.*CRC32`, "iu"));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Career Skillstead wrapper owns execution identity and fails on nonzero or missing vendor output", async () => {
  const { runSkillstead } = await loadSkillsteadWrapper();
  const sink = { write() {} };
  await assert.rejects(
    () => runSkillstead("lint", ["diagram.svg"], {
      spawn: () => ({ status: 0, stdout: "", stderr: "" }), stdout: sink, stderr: sink,
    }),
    /returned no output/iu,
  );
  await assert.rejects(
    () => runSkillstead("lint", ["diagram.svg"], {
      spawn: () => ({ status: 7, stdout: "", stderr: "vendor failed" }), stdout: sink, stderr: sink,
    }),
    /exit 7.*vendor failed/iu,
  );

  const tempBase = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const stagingRoot = await mkdtemp(path.join(tempBase, "career-skillstead-wrapper-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const aliasRoot = path.join(stagingRoot, "linked-build");
    await symlink(build.outputDir, aliasRoot, "dir");
    const relativeWrapper = "skills/visualize-career-roadmap/scripts/run-skillstead.mjs";
    const tmpAliasWrapper = path.join(build.outputDir, relativeWrapper);
    const canonicalWrapper = await realpath(tmpAliasWrapper);
    const wrapper = path.join(aliasRoot, relativeWrapper);
    const fileAlias = path.join(stagingRoot, "run-skillstead-link.mjs");
    await symlink(canonicalWrapper, fileAlias);
    const svg = path.join(stagingRoot, "valid.svg");
    await writeFile(svg, '<svg role="img" aria-label="Valid" viewBox="0 0 600 300"><title>Valid</title><desc>Valid diagram.</desc></svg>', "utf8");
    const sourceWrapper = path.join(pluginRoot, relativeWrapper);
    for (const [label, invoked, cwd] of [
      ["source-direct", sourceWrapper, repoRoot],
      ["source-relative", path.relative(repoRoot, sourceWrapper), repoRoot],
      ["built-canonical", canonicalWrapper, repoRoot],
      ["built-relative", relativeWrapper, build.outputDir],
      ["built-tmp-alias", tmpAliasWrapper, repoRoot],
      ["built-symlink-ancestor", wrapper, repoRoot],
      ["built-symlink-file", fileAlias, repoRoot],
    ]) {
      const run = spawnSync(process.execPath, [invoked, "lint", svg], { cwd, encoding: "utf8" });
      assert.equal(run.status, 0, `${label}: ${run.stderr}`);
      assert.match(run.stdout, /check-svg:\s*0 error\(s\)/iu, label);
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("supported Career CLI inventory excludes immutable vendor internals and raw URL guards", async () => {
  const supported = [
    "scripts/capability-probe.mjs",
    "scripts/stop-artifact-review.mjs",
    "scripts/validate-artifact.mjs",
    "skills/export-career-documents/scripts/prepare-career-export.mjs",
    "skills/orchestrate-game-design-career/scripts/merge-role-findings.mjs",
    "skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs",
    "skills/research-game-design-jobs/scripts/validate-job-evidence.mjs",
    "skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
  ];
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-cli-inventory-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    for (const relative of supported) {
      const source = await readFile(path.join(build.outputDir, relative), "utf8");
      assert.match(source, /^#!\/usr\/bin\/env node/u, relative);
      assert.doesNotMatch(source, /import\.meta\.url\s*===\s*pathToFileURL\(process\.argv\[1\]\)\.href/u, relative);
      assert.equal(relative.includes("skills/svg-infographic/"), false, relative);
    }
    assert.equal(supported.length, 8);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("source and clean-built visualization validators reject structural accessibility spoofs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-viz-xml-"));
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-viz-build-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const sourceModule = await loadVisualizationModule();
    const builtModule = await import(`${pathToFileURL(path.join(
      build.outputDir,
      "skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs",
    )).href}?attack=${Date.now()}`);
    const alt = "Role evidence map";
    const attacks = {
      comments: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><!-- <title>${alt}</title><desc>Fake</desc> --></svg>`,
      attribute: `<svg role="img" aria-label="${alt}" data-spoof="<title>${alt}</title><desc>Fake</desc>" viewBox="0 0 600 300"></svg>`,
      style: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><style>.x{content:"<title>${alt}</title><desc>Fake</desc>"}</style></svg>`,
      script: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><script>const x="<title>${alt}</title><desc>Fake</desc>";</script></svg>`,
      nested: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><g><title>${alt}</title><desc>Fake</desc></g></svg>`,
      duplicate: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><title>${alt}</title><title>${alt}</title><desc>Fake</desc></svg>`,
      escaped: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300">&lt;title&gt;${alt}&lt;/title&gt;&lt;desc&gt;Fake&lt;/desc&gt;</svg>`,
      processing: `<?fake <title>${alt}</title><desc>Fake</desc>?><svg role="img" aria-label="${alt}" viewBox="0 0 600 300"></svg>`,
      cdata: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><![CDATA[<title>${alt}</title><desc>Fake</desc>]]></svg>`,
      doctype: `<!DOCTYPE svg [<!ENTITY x "<title>${alt}</title><desc>Fake</desc>">]><svg role="img" aria-label="${alt}" viewBox="0 0 600 300">&x;</svg>`,
      unclosed: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><title>${alt}</title><desc>Fake</desc>`,
      mismatched: `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><title>${alt}</desc><desc>Fake</desc></svg>`,
    };
    for (const [name, source] of Object.entries(attacks)) {
      const file = `${name}.svg`;
      await writeFile(path.join(root, file), source, "utf8");
      const state = {
        artifactRoot: root,
        requested: true,
        planned: true,
        generated: true,
        linted: true,
        rendered: false,
        verified: false,
        svgFile: file,
        pngAvailability: "unavailable",
        altText: alt,
        availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "failed", reason: "test fallback" },
        lintEvidence: {
          command: `node run-skillstead.mjs lint ${file}`,
          file,
          result: "passed",
          sha256: digest(Buffer.from(source)),
          errors: [],
          warnings: [],
          warningsDisposition: "No warnings.",
        },
      };
      for (const validator of [sourceModule.validateVisualizationState, builtModule.validateVisualizationState]) {
        assert.throws(
          () => validator(state),
          undefined,
          `${name} accessibility spoof passed ${validator === sourceModule.validateVisualizationState ? "source" : "built"} validation`,
        );
      }
    }
    const commentState = {
      artifactRoot: root,
      requested: true,
      planned: true,
      generated: true,
      linted: true,
      rendered: false,
      verified: false,
      svgFile: "comments.svg",
      pngAvailability: "unavailable",
      altText: alt,
      availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "failed", reason: "test fallback" },
      lintEvidence: {
        command: "node run-skillstead.mjs lint comments.svg",
        file: "comments.svg",
        result: "passed",
        sha256: digest(Buffer.from(attacks.comments)),
        errors: [],
        warnings: [],
        warningsDisposition: "No warnings.",
      },
    };
    assert.throws(
      () => sourceModule.validateVisualizationState(commentState),
      /exactly one non-empty direct-child <title> and <desc>/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("source and clean-built visualization validators reject active SVG elements before raw content can bypass tokenization", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-viz-active-"));
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-viz-active-build-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const sourceModule = await loadVisualizationModule();
    const builtModule = await import(`${pathToFileURL(path.join(
      build.outputDir,
      "skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs",
    )).href}?active=${Date.now()}`);
    const validators = [sourceModule.validateVisualizationState, builtModule.validateVisualizationState];
    const alt = "Active-content-free roadmap";
    const prefix = `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><title>${alt}</title><desc>Safe roadmap.</desc>`;
    const suffix = "</svg>";
    const attacks = {
      "broken-script.svg": `${prefix}<script><broken</script>${suffix}`,
      "broken-style.svg": `${prefix}<style><broken</style>${suffix}`,
      "unclosed-script.svg": `${prefix}<script>broken${suffix}`,
      "unclosed-style.svg": `${prefix}<style>broken${suffix}`,
      "nested-script.svg": `${prefix}<script><script>nested</script></script>${suffix}`,
      "nested-style.svg": `${prefix}<style><style>nested</style></style>${suffix}`,
      "mixed-active.svg": `${prefix}<script><style>nested</style></script>${suffix}`,
      "closing-spoof.svg": `${prefix}<script><broken</script   >${suffix}`,
      "uppercase-script.svg": `${prefix}<SCRIPT/>${suffix}`,
      "mixed-case-style.svg": `${prefix}<StYlE/>${suffix}`,
      "namespaced-script.svg": `${prefix}<svg:script/>${suffix}`,
      "namespaced-style.svg": `${prefix}<x:style/>${suffix}`,
      "comment-spoof.svg": `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><!-- <title>${alt}</title><desc>Fake</desc><script>bad()</script> --></svg>`,
      "cdata-spoof.svg": `<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><![CDATA[<title>${alt}</title><desc>Fake</desc><style/>]]></svg>`,
    };
    const stateFor = (file, bytes) => ({
      artifactRoot: root,
      requested: true,
      planned: true,
      generated: true,
      linted: true,
      rendered: false,
      verified: false,
      svgFile: file,
      pngAvailability: "unavailable",
      altText: alt,
      availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "failed", reason: "test fallback" },
      lintEvidence: {
        command: `node run-skillstead.mjs lint ${file}`,
        file,
        result: "passed",
        sha256: digest(bytes),
        errors: [],
        warnings: [],
        warningsDisposition: "No warnings.",
      },
    });
    for (const [file, source] of Object.entries(attacks)) {
      const bytes = Buffer.from(source);
      await writeFile(path.join(root, file), bytes);
      for (const validator of validators) {
        assert.throws(
          () => validator(stateFor(file, bytes)),
          file.includes("comment") || file.includes("cdata")
            ? undefined
            : /rejects active <(?:script|style)> elements/iu,
          `${file} passed ${validator === sourceModule.validateVisualizationState ? "source" : "built"} validation`,
        );
      }
    }
    const safeInlineSource = `${prefix}<rect x="1" y="1" width="10" height="10" style="fill:#fff;stroke:#000"/>${suffix}`;
    const safeInlineBytes = Buffer.from(safeInlineSource);
    await writeFile(path.join(root, "safe-inline-style.svg"), safeInlineBytes);
    for (const validator of validators) {
      assert.doesNotThrow(() => validator(stateFor("safe-inline-style.svg", safeInlineBytes)));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("source and clean-built validators reject invalid UTF-8 and forbidden XML character data", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-viz-chars-"));
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-viz-char-build-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const sourceModule = await loadVisualizationModule();
    const builtModule = await import(`${pathToFileURL(path.join(
      build.outputDir,
      "skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs",
    )).href}?characters=${Date.now()}`);
    const validators = [sourceModule.validateVisualizationState, builtModule.validateVisualizationState];
    const alt = "역할 🧭 지도";
    const allowedBoundaries = `\t\n\r \u0085\uD7FF\uE000\uFDD0\uFFFD\u{10000}\u{10FFFF}`;
    const valid = `<svg role="img" aria-label="${alt}" data-note="한국어 🧭" viewBox="0 0 600 300"><title>${alt}</title><desc>증거와 연습을 연결하는 지도 🧭${allowedBoundaries}</desc></svg>`;
    const stateFor = (file, bytes) => ({
      artifactRoot: root,
      requested: true,
      planned: true,
      generated: true,
      linted: true,
      rendered: false,
      verified: false,
      svgFile: file,
      pngAvailability: "unavailable",
      altText: alt,
      availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "failed", reason: "test fallback" },
      lintEvidence: {
        command: `node run-skillstead.mjs lint ${file}`,
        file,
        result: "passed",
        sha256: digest(bytes),
        errors: [],
        warnings: [],
        warningsDisposition: "No warnings.",
      },
    });
    const validBytes = Buffer.from(valid, "utf8");
    await writeFile(path.join(root, "valid-unicode.svg"), validBytes);
    for (const validator of validators) assert.doesNotThrow(() => validator(stateFor("valid-unicode.svg", validBytes)));

    const characterAttacks = {
      "nul-title.svg": valid.replace(alt, `${alt}\u0000`),
      "c0-desc.svg": valid.replace("증거와", "증거\u000B와"),
      "control-viewbox.svg": valid.replace("0 0 600 300", "0 0\u001F 600 300"),
      "fffe-attribute.svg": valid.replace("한국어 🧭", "한국어\uFFFE🧭"),
      "ffff-desc.svg": valid.replace("지도 🧭", "지도\uFFFF🧭"),
    };
    for (const [file, source] of Object.entries(characterAttacks)) {
      const bytes = Buffer.from(source, "utf8");
      await writeFile(path.join(root, file), bytes);
      for (const validator of validators) {
        assert.throws(() => validator(stateFor(file, bytes)), /forbidden XML character U\+/iu);
      }
    }

    const titlePrefix = Buffer.from(`<svg role="img" aria-label="${alt}" viewBox="0 0 600 300"><title>${alt}`);
    const titleSuffix = Buffer.from(`</title><desc>설명</desc></svg>`);
    const invalidUtf8 = {
      "overlong.svg": Buffer.concat([titlePrefix, Buffer.from([0xc0, 0xaf]), titleSuffix]),
      "surrogate.svg": Buffer.concat([titlePrefix, Buffer.from([0xed, 0xa0, 0x80]), titleSuffix]),
      "invalid-byte.svg": Buffer.concat([titlePrefix, Buffer.from([0xff]), titleSuffix]),
    };
    for (const [file, bytes] of Object.entries(invalidUtf8)) {
      await writeFile(path.join(root, file), bytes);
      for (const validator of validators) {
        assert.throws(() => validator(stateFor(file, bytes)), /canonical valid UTF-8 without replacement decoding/iu);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("export recipes and skill define renderer-neutral fail-closed jobs", async () => {
  const recipes = await read("references/export-recipes.md");
  const skill = await read("skills/export-career-documents/SKILL.md");
  assert.deepEqual(frontmatter(skill), ["name", "description"]);
  assertExportContract(recipes, skill);
});

test("export mutation guard rejects missing recipes and status/evidence drift", async () => {
  const recipes = await read("references/export-recipes.md");
  const skill = await read("skills/export-career-documents/SKILL.md");
  const mutations = [
    [recipes.replace("| `transition-report` |", "| `career-report` |"), skill],
    [recipes.replace("availability", "capability"), skill],
    [recipes.replace(
      "`unknown` means no capability probe ran.",
      "`unavailable` means no capability probe ran.",
    ), skill],
    [recipes.replace("independent story", "section story"), skill],
    [recipes, skill.replace("fail closed", "continue with warnings")],
  ];
  for (const [index, [mutatedRecipes, mutatedSkill]] of mutations.entries()) {
    assert.throws(
      () => assertExportContract(mutatedRecipes, mutatedSkill),
      undefined,
      `export mutation ${index + 1} survived`,
    );
  }
});

test("prepare script preserves unknown capability and blocks derivatives on canonical failure", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    const unknown = baseJob(root);
    unknown.formats.pdf = { requested: true, availability: "unknown", status: "blocked", evidence: [] };
    const prepared = prepareCareerExport(unknown);
    assert.equal(prepared.formats.pdf.availability, "unknown");
    assert.equal(prepared.formats.pdf.status, "blocked");

    const invalid = structuredClone(unknown);
    invalid.canonicalValidation.status = "failed";
    assert.throws(() => prepareCareerExport(invalid), /canonical validation must pass/iu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script rejects terminal status and all generation or QA evidence", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    for (const status of ["passed", "failed"]) {
      const terminal = baseJob(root);
      terminal.formats.pdf = {
        requested: true,
        availability: "available",
        status,
        evidence: [{ kind: "capability-probe", command: "renderer --version", result: "passed" }],
      };
      assert.throws(() => prepareCareerExport(terminal), /preparation cannot accept terminal status/iu);
    }
    for (const kind of ["generation", "qa"]) {
      const evidence = baseJob(root);
      evidence.formats.pdf = {
        requested: true,
        availability: "available",
        status: "pending",
        evidence: [{ kind, command: "forged command", file: "portfolio.pdf", result: "passed" }],
      };
      assert.throws(() => prepareCareerExport(evidence), /rejects generation and qa evidence/iu);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script enforces exact availability, status, request, and evidence transitions", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), "% derivative fixture", "utf8");
    const valid = baseJob(root);
    const pendingAvailable = structuredClone(valid);
    pendingAvailable.formats.pdf = {
      requested: true,
      availability: "available",
      status: "pending",
      evidence: [{ kind: "capability-probe", command: "probe", result: "passed" }],
    };
    assert.equal(prepareCareerExport(pendingAvailable).formats.pdf.status, "pending");
    const unavailable = structuredClone(valid);
    unavailable.formats.pdf = {
      requested: true,
      availability: "unavailable",
      status: "unavailable",
      evidence: [{ kind: "capability-probe", command: "probe", result: "failed" }],
    };
    assert.equal(prepareCareerExport(unavailable).formats.pdf.status, "unavailable");
    const mutations = [];

    const probeConflict = structuredClone(valid);
    probeConflict.formats.pdf = {
      requested: true,
      availability: "available",
      status: "pending",
      evidence: [
        { kind: "capability-probe", command: "probe pass", result: "passed" },
        { kind: "capability-probe", command: "probe fail", result: "failed" },
      ],
    };
    mutations.push(probeConflict);

    const requestedNotRequested = structuredClone(valid);
    requestedNotRequested.formats.pdf = {
      requested: true,
      availability: "unknown",
      status: "not-requested",
      evidence: [],
    };
    mutations.push(requestedNotRequested);

    const falseRequestedPassed = structuredClone(valid);
    falseRequestedPassed.formats.pdf = {
      requested: false,
      availability: "unknown",
      status: "passed",
      evidence: [],
    };
    mutations.push(falseRequestedPassed);

    const availableBlocked = structuredClone(valid);
    availableBlocked.formats.pdf = {
      requested: true,
      availability: "available",
      status: "blocked",
      evidence: [{ kind: "capability-probe", command: "probe", result: "passed" }],
    };
    mutations.push(availableBlocked);

    const unavailablePending = structuredClone(valid);
    unavailablePending.formats.pdf = {
      requested: true,
      availability: "unavailable",
      status: "pending",
      evidence: [{ kind: "capability-probe", command: "probe", result: "failed" }],
    };
    mutations.push(unavailablePending);

    const failedWithPassedQa = structuredClone(valid);
    failedWithPassedQa.formats.pdf = {
      requested: true,
      availability: "available",
      status: "failed",
      evidence: [
        { kind: "capability-probe", command: "probe", result: "passed" },
        { kind: "generation", command: "render", file: "portfolio.pdf", result: "failed" },
        { kind: "qa", command: "verify", file: "portfolio.pdf", result: "passed" },
      ],
    };
    mutations.push(failedWithPassedQa);

    let survivors = 0;
    for (const mutation of mutations) {
      try { prepareCareerExport(mutation); survivors++; } catch {}
    }
    assert.equal(survivors, 0, "invalid export state transitions must be rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script rejects unknown and dangerous keys at every schema boundary", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    const base = baseJob(root);
    const mutations = [];
    for (const [target, key] of [
      [[], "__proto__"],
      [[], "constructor"],
      [["canonicalValidation"], "path"],
      [["formats"], "prototype"],
      [["formats", "md"], "output"],
      [["formats", "md", "evidence"], "filePath"],
    ]) {
      const mutated = structuredClone(base);
      let object = mutated;
      for (const segment of target) object = object[segment];
      if (Array.isArray(object)) object.push({ kind: "capability-probe", command: "probe", result: "passed", [key]: "x" });
      else Object.defineProperty(object, key, { value: "x", enumerable: true, configurable: true });
      mutations.push(mutated);
    }

    const pptx = structuredClone(base);
    pptx.formats.pptx = {
      requested: true,
      availability: "available",
      status: "pending",
      evidence: [{ kind: "capability-probe", command: "probe", result: "passed" }],
      audience: "recruiter",
      purpose: "short review",
      outlineSource: "independent-story",
      storyOutline: [{ title: "Promise", message: "Evidence-led candidate promise", output: "slide.pptx" }],
    };
    mutations.push(pptx);

    let survivors = 0;
    for (const mutation of mutations) {
      try { prepareCareerExport(mutation); survivors++; } catch {}
    }
    assert.equal(survivors, 0, "unknown or dangerous schema keys must be rejected");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script rejects derivative path claims and false unavailable transitions", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    const unsafe = baseJob(root);
    unsafe.formats.md = {
      requested: true,
      availability: "available",
      status: "pending",
      evidence: [
        { kind: "generation", command: "copy", file: "../outside.md", result: "passed" },
      ],
    };
    assert.throws(() => prepareCareerExport(unsafe), /rejects generation and qa evidence/iu);

    const unprobed = baseJob(root);
    unprobed.formats.pdf = { requested: true, availability: "unavailable", status: "unavailable", evidence: [] };
    assert.throws(() => prepareCareerExport(unprobed), /unavailable.*failed capability-probe/iu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script blocks PPTX without an independently authored story outline", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    const job = baseJob(root);
    job.formats.pptx = {
      requested: true,
      availability: "available",
      status: "pending",
      evidence: [{ kind: "capability-probe", command: "pptxgen --version", result: "passed" }],
      audience: "recruiter",
      purpose: "short portfolio review",
      storyOutline: [
        { title: "Portfolio", message: "Candidate promise" },
        { title: "Problem", message: "Problem" },
        { title: "Result", message: "Result" },
      ],
      outlineSource: "markdown-headings",
    };
    assert.throws(() => prepareCareerExport(job), /independent story outline/iu);
    job.formats.pptx.outlineSource = "independent-story";
    assert.doesNotThrow(() => prepareCareerExport(job));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preparation rejects structurally valid and fake terminal-passed MD PDF DOCX and PPTX", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-format-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    await writeFile(path.join(root, "portfolio.docx"), minimalDocx());
    await writeFile(path.join(root, "portfolio.pptx"), minimalPptx());
    const files = { md: "content.md", pdf: "portfolio.pdf", docx: "portfolio.docx", pptx: "portfolio.pptx" };
    const assertTerminalRejected = (format, file) => {
      const job = baseJob(root);
      job.formats[format] = {
        requested: true,
        availability: "available",
        status: "passed",
        evidence: [
          { kind: "capability-probe", command: `${format}-tool --version`, result: "passed" },
          { kind: "generation", command: `generate ${file}`, file, result: "passed" },
          { kind: "qa", command: `verify ${file}`, file, result: "passed" },
        ],
      };
      if (format === "pptx") Object.assign(job.formats.pptx, {
        audience: "recruiter",
        purpose: "review evidence",
        outlineSource: "independent-story",
        storyOutline: [{ title: "Evidence", message: "Show the evidence chain." }],
      });
      assert.throws(() => prepareCareerExport(job), /preparation cannot accept terminal status passed/iu);
    };
    for (const [format, file] of Object.entries(files)) assertTerminalRejected(format, file);

    await writeFile(path.join(root, "fake.md"), "fake Markdown", "utf8");
    await writeFile(path.join(root, "portfolio.pdf"), "not a PDF", "utf8");
    await writeFile(path.join(root, "portfolio.docx"), "not a DOCX", "utf8");
    await writeFile(path.join(root, "portfolio.pptx"), "not a PPTX", "utf8");
    for (const [format, file] of Object.entries({ ...files, md: "fake.md" })) assertTerminalRejected(format, file);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("export CLI executes through symlinked non-ASCII build paths and preserves wx overwrite safety", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-cli-"));
  try {
    const artifactRoot = path.join(root, "artifact 자료");
    await mkdir(artifactRoot, { recursive: true });
    await writeCanonicalFixture(artifactRoot);
    const input = path.join(root, "입력 job.json");
    await writeFile(input, `${JSON.stringify(baseJob(artifactRoot), null, 2)}\n`, "utf8");

    const stagingRoot = path.join(root, "실제 build 경로");
    await mkdir(stagingRoot, { recursive: true });
    await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const linkedRoot = path.join(root, "링크 build 경로");
    await symlink(stagingRoot, linkedRoot, "dir");

    const relativeScript = "game-design-career/skills/export-career-documents/scripts/prepare-career-export.mjs";
    const normalScript = path.join(stagingRoot, relativeScript);
    const linkedScript = path.join(linkedRoot, relativeScript);
    const sourceScript = path.join(
      pluginRoot,
      "skills/export-career-documents/scripts/prepare-career-export.mjs",
    );

    const linkedOutput = path.join(root, "linked manifest.json");
    const first = spawnSync(process.execPath, [linkedScript, input, linkedOutput], { encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const firstBytes = await readFile(linkedOutput);
    const prepared = JSON.parse(firstBytes.toString("utf8"));
    assert.equal(prepared.artifactId, "career-portfolio");
    assert.equal(prepared.formats.md.status, "blocked");

    const second = spawnSync(process.execPath, [linkedScript, input, linkedOutput], { encoding: "utf8" });
    assert.equal(second.status, 1, "second wx write must fail");
    assert.match(second.stderr, /EEXIST|file already exists/iu);
    assert.deepEqual(await readFile(linkedOutput), firstBytes, "failed overwrite must preserve the first manifest");

    for (const [label, script] of [["source", sourceScript], ["normal-build", normalScript]]) {
      const output = path.join(root, `${label} manifest.json`);
      const run = spawnSync(process.execPath, [script, input, output], { encoding: "utf8" });
      assert.equal(run.status, 0, `${label}: ${run.stderr}`);
      assert.equal(JSON.parse(await readFile(output, "utf8")).artifactId, "career-portfolio");
    }

    const moduleUrl = pathToFileURL(sourceScript).href;
    for (const setup of ["", 'process.argv[1] = "\\0";']) {
      const imported = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", `${setup} await import(${JSON.stringify(moduleUrl)}); process.stdout.write("imported");`],
        { encoding: "utf8" },
      );
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout, "imported");
      assert.equal(imported.stderr, "");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
