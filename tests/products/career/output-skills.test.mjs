import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
  assert.match(recipes, /`passed` means capability, generation, file existence, and format-appropriate QA all passed\./u);
  assert.match(recipes, /generation.*format-appropriate.*verification/isu);
  assert.match(recipes, /audience.*purpose.*story outline/isu);
  assert.match(recipes, /independent story.*not.*Markdown headings/isu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/export-recipes\.md`/u);
  assert.match(skill, /prepare-career-export\.mjs/u);
  assert.match(skill, /fail closed/iu);
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

function pngFixture(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "latin1");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  const iend = Buffer.alloc(12);
  iend.write("IEND", 4, "latin1");
  return Buffer.concat([signature, ihdr, iend]);
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

async function passedQa(file, format) {
  const bytes = await readFile(file);
  const validators = {
    md: "career-export/md-canonical-identity-v1",
    pdf: "career-export/pdf-structure-v1",
    docx: "career-export/docx-ooxml-v1",
    pptx: "career-export/pptx-ooxml-v1",
  };
  return { sha256: digest(bytes), size: bytes.length, validatorId: validators[format] };
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

test("visualization mutation guard rejects missing presets and weakened evidence boundaries", async () => {
  const presets = JSON.parse(await read("references/visualization-presets.json"));
  const skill = await read("skills/visualize-career-roadmap/SKILL.md");
  const mutations = [
    [presets.slice(1), skill],
    [presets.map((item, index) => index === 0 ? { ...item, renderer: "generic-svg" } : item), skill],
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
      availabilityEvidence: { command: "node render.mjs --probe", result: "failed", reason: "no Chromium found" },
      lintEvidence: {
        command: "node check-svg.mjs career-map.svg",
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
      { ...svgOnly, svgFile: "../outside.svg" },
      { ...svgOnly, svgFile: "missing.svg" },
      { ...svgOnly, rendered: true },
      { ...svgOnly, verified: true },
    ]) assert.throws(() => validateVisualizationState(mutation));

    const verified = {
      ...svgOnly,
      pngAvailability: "available",
      availabilityEvidence: { command: "node render.mjs --probe", result: "passed", reason: "Chromium found" },
      rendered: true,
      verified: true,
      pngFile: "career-map.png",
      altText: "Role evidence map",
      visualQa: "No clipping; relationship labels inspected.",
      renderEvidence: {
        command: "node render.mjs career-map.svg career-map.png",
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
  } finally {
    await rm(root, { recursive: true, force: true });
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

test("prepare script requires probe generation and QA evidence before passed", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    const job = baseJob(root);
    job.formats.pdf = {
      requested: true,
      availability: "available",
      status: "passed",
      evidence: [],
    };
    assert.throws(() => prepareCareerExport(job), /capability-probe.*generation.*qa/isu);

    job.formats.pdf.evidence = [
      { kind: "capability-probe", command: "renderer --version", result: "passed" },
      { kind: "generation", command: "render portfolio.md portfolio.pdf", file: "portfolio.pdf", result: "passed" },
      { kind: "qa", command: "verify-pdf portfolio.pdf", file: "portfolio.pdf", result: "passed", ...await passedQa(path.join(root, "portfolio.pdf"), "pdf") },
    ];
    assert.equal(prepareCareerExport(job).formats.pdf.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepare script rejects derivative identity and contradictory passed evidence mutations", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    await writeFile(path.join(root, "other.pdf"), minimalPdf());
    await writeFile(path.join(root, "wrong.docx"), "not a DOCX", "utf8");
    const valid = baseJob(root);
    valid.formats.pdf = {
      requested: true,
      availability: "available",
      status: "passed",
      evidence: [
        { kind: "capability-probe", command: "renderer --version", result: "passed" },
        { kind: "generation", command: "render", file: "portfolio.pdf", result: "passed" },
        { kind: "qa", command: "verify", file: "portfolio.pdf", result: "passed", ...await passedQa(path.join(root, "portfolio.pdf"), "pdf") },
      ],
    };
    assert.doesNotThrow(() => prepareCareerExport(valid));
    const mutations = [];

    const wrongExtension = structuredClone(valid);
    wrongExtension.formats.pdf.evidence[1].file = "wrong.docx";
    wrongExtension.formats.pdf.evidence[2].file = "wrong.docx";
    mutations.push(wrongExtension);

    const mismatchedFiles = structuredClone(valid);
    mismatchedFiles.formats.pdf.evidence[2].file = "other.pdf";
    mutations.push(mismatchedFiles);

    const passedAndFailed = structuredClone(valid);
    passedAndFailed.formats.pdf.evidence.push({
      kind: "qa",
      command: "verify again",
      file: "portfolio.pdf",
      result: "failed",
    });
    mutations.push(passedAndFailed);

    const unknownTop = structuredClone(valid);
    unknownTop.output = "portfolio.pdf";
    mutations.push(unknownTop);

    const unknownEvidence = structuredClone(valid);
    unknownEvidence.formats.pdf.evidence[1].path = "portfolio.pdf";
    mutations.push(unknownEvidence);

    let survivors = 0;
    for (const mutation of mutations) {
      try { prepareCareerExport(mutation); survivors++; } catch {}
    }
    assert.equal(survivors, 0, "all five export identity/schema mutations must be rejected");
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

test("prepare script rejects unsafe evidence paths and false unavailable transitions", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-export-"));
  try {
    await writeCanonicalFixture(root);
    const unsafe = baseJob(root);
    unsafe.formats.md = {
      requested: true,
      availability: "available",
      status: "passed",
      evidence: [
        { kind: "generation", command: "copy", file: "../outside.md", result: "passed" },
        { kind: "qa", command: "verify-md", file: "../outside.md", result: "passed" },
      ],
    };
    assert.throws(() => prepareCareerExport(unsafe), /safe relative path/iu);

    const unprobed = baseJob(root);
    unprobed.formats.pdf = { requested: true, availability: "unavailable", status: "unavailable", evidence: [] };
    assert.throws(() => prepareCareerExport(unprobed), /unavailable.*probe evidence/iu);
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

test("passed MD PDF DOCX and PPTX require independently verified bytes, not forged status strings", async () => {
  const { prepareCareerExport } = await loadPrepareModule();
  const root = await mkdtemp(path.join(os.tmpdir(), "career-format-"));
  try {
    await writeCanonicalFixture(root);
    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    await writeFile(path.join(root, "portfolio.docx"), minimalDocx());
    await writeFile(path.join(root, "portfolio.pptx"), minimalPptx());
    const files = { md: "content.md", pdf: "portfolio.pdf", docx: "portfolio.docx", pptx: "portfolio.pptx" };
    const job = baseJob(root);
    for (const format of Object.keys(files)) {
      const file = files[format];
      job.formats[format] = {
        requested: true,
        availability: "available",
        status: "passed",
        evidence: [
          { kind: "capability-probe", command: `${format}-tool --version`, result: "passed" },
          { kind: "generation", command: `generate ${file}`, file, result: "passed" },
          { kind: "qa", command: `verify ${file}`, file, result: "passed", ...await passedQa(path.join(root, file), format) },
        ],
      };
    }
    Object.assign(job.formats.pptx, {
      audience: "recruiter",
      purpose: "review evidence",
      outlineSource: "independent-story",
      storyOutline: [{ title: "Evidence", message: "Show the evidence chain." }],
    });
    assert.deepEqual(
      Object.values(prepareCareerExport(job).formats).map(({ status }) => status),
      ["passed", "passed", "passed", "passed"],
    );

    const forgedStatus = structuredClone(job);
    await writeFile(path.join(root, "portfolio.pdf"), "not a PDF", "utf8");
    Object.assign(forgedStatus.formats.pdf.evidence[2], await passedQa(path.join(root, "portfolio.pdf"), "pdf"));
    assert.throws(() => prepareCareerExport(forgedStatus), /PDF requires/iu);

    await writeFile(path.join(root, "portfolio.pdf"), minimalPdf());
    const forgedDigest = structuredClone(job);
    forgedDigest.formats.pdf.evidence[2].sha256 = "0".repeat(64);
    assert.throws(() => prepareCareerExport(forgedDigest), /digest.*size.*validatorId/iu);

    const corruptDocx = structuredClone(job);
    const docxBytes = await readFile(path.join(root, "portfolio.docx"));
    await writeFile(path.join(root, "portfolio.docx"), docxBytes.subarray(0, docxBytes.length - 5));
    Object.assign(corruptDocx.formats.docx.evidence[2], await passedQa(path.join(root, "portfolio.docx"), "docx"));
    assert.throws(() => prepareCareerExport(corruptDocx), /ZIP|OOXML/iu);

    const invalidMarkdown = structuredClone(job);
    await writeFile(path.join(root, "copy.md"), "# forged", "utf8");
    invalidMarkdown.formats.md.evidence[1].file = "copy.md";
    invalidMarkdown.formats.md.evidence[2] = {
      ...invalidMarkdown.formats.md.evidence[2], file: "copy.md", ...await passedQa(path.join(root, "copy.md"), "md"),
    };
    assert.throws(() => prepareCareerExport(invalidMarkdown), /byte-identical/iu);
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
