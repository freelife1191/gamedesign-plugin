import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(pluginRoot, "skills");
const fixtureArtifact = path.join(repoRoot, "tests/fixtures/artifacts/valid");
const validatorPath = path.join(repoRoot, "shared/scripts/validate-artifact.mjs");
const prepareScript = path.join(skillRoot, "export-game-design-documents/scripts/prepare-studio-export.mjs");
const exportValidatorScript = path.join(skillRoot, "export-game-design-documents/scripts/validate-studio-export.mjs");
const visualizationValidatorScript = path.join(skillRoot, "visualize-game-design/scripts/validate-visualization-evidence.mjs");
const skillsteadScriptRoot = path.join(repoRoot, "shared/vendor/skillstead/svg-infographic/0.8.3/scripts");
const visualizationWrapper = "skills/visualize-game-design/scripts/run-skillstead.mjs";
const temporaryDirectories = [];

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function readSkill(skillId, relativePath = "SKILL.md") {
  return readFile(path.join(skillRoot, skillId, relativePath), "utf8");
}

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: section missing`);
  const remainder = markdown.slice(start + marker.length);
  const end = remainder.indexOf("\n## ");
  return end === -1 ? remainder : remainder.slice(0, end);
}

function parseStableFields(outputContract, label) {
  const match = outputContract.match(/\bwith stable sections for ([^.]+)\./iu);
  assert.ok(match, `${label}: stable field declaration`);
  return match[1]
    .replace(/, and /iu, ", ")
    .split(",")
    .map((field) => field.trim().toLocaleLowerCase("en-US"));
}

async function loadPrepareModule() {
  return import(`${pathToFileURL(prepareScript).href}?test=${Date.now()}`);
}

async function writePreflightValidator(directory, name, { status, stdout = "", stderr = "" }) {
  const validator = path.join(directory, `${name}.mjs`);
  await writeFile(validator, [
    `process.stdout.write(${JSON.stringify(stdout)});`,
    `process.stderr.write(${JSON.stringify(stderr)});`,
    `process.exitCode = ${status};`,
    "",
  ].join("\n"));
  return validator;
}

async function loadModule(modulePath) {
  return import(`${pathToFileURL(modulePath).href}?test=${Date.now()}-${Math.random()}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseRendererIdentity(log) {
  const match = /^renderer:\s+(.+?)\s+\((.+?)\)\s+\[via .+\]$/imu.exec(log);
  assert.ok(match, `renderer identity missing from log:\n${log}`);
  return { renderer: match[1], rendererVersion: match[2], line: match[0] };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function completePngBytes(width, height, compressed = deflateSync(Buffer.alloc((1 + width * 4) * height)), {
  bitDepth = 8,
  colorType = 6,
  interlace = 0,
} = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([bitDepth, colorType, 0, 0, interlace], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function writeCompletePng(filePath, width, height) {
  const bytes = completePngBytes(width, height);
  await writeFile(filePath, bytes);
  return bytes;
}

const skillContracts = {
  "review-game-design": {
    outputFields: ["review scope", "findings", "decision items", "blockers", "review status"],
    prompt: "review a canonical game design artifact and return evidence-linked minimal fixes",
  },
  "visualize-game-design": {
    outputFields: ["diagram decision", "source mapping", "preset", "accessibility", "execution evidence", "asset index", "fallback status"],
    prompt: "turn source-backed game design structure into an accessible verified diagram",
  },
  "export-game-design-documents": {
    outputFields: ["preflight", "recipe", "capability probe", "format jobs", "renderer evidence", "qa status", "artifact preservation"],
    prompt: "prepare fail-closed MD PDF DOCX and PPTX export jobs from a canonical artifact",
  },
};

test("output skills use trigger-only metadata and generated interfaces", async () => {
  for (const [skillId, contract] of Object.entries(skillContracts)) {
    const [skill, openai] = await Promise.all([readSkill(skillId), readSkill(skillId, "agents/openai.yaml")]);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];
    assert.ok(frontmatter, `${skillId}: frontmatter`);
    assert.deepEqual(frontmatter.split("\n").map((line) => line.split(":", 1)[0]), ["name", "description"]);
    assert.match(frontmatter, new RegExp(`^name: ${skillId}$`, "mu"));
    assert.match(frontmatter, /^description: Use when /mu);
    assert.doesNotMatch(frontmatter, /workflow|step|produce|output/iu);
    assert.match(openai, /display_name: "[^"]+"/u);
    assert.match(openai, /short_description: "[^"]{25,64}"/u);
    assert.match(openai, new RegExp(`default_prompt: "Use \\$${skillId} ${contract.prompt}\\."`, "u"));
  }
});

test("review skill blocks absent source and emits independently actionable findings", async () => {
  const skill = await readSkill("review-game-design");
  for (const heading of [
    "Triggers", "Non-triggers", "Required input", "Assumption policy", "Workflow", "Output contract",
    "Role reviewers", "Completion checks",
  ]) section(skill, heading);

  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "review output"), skillContracts["review-game-design"].outputFields);
  const contract = section(skill, "Finding contract");
  for (const field of ["severity", "evidence", "impact", "affectedSectionId", "minimalFix"]) {
    assert.match(contract, new RegExp(`\\b${field}\\b`, "u"));
  }
  assert.match(section(skill, "Completion checks"), /source-unavailable/iu);
  assert.match(section(skill, "Completion checks"), /conflicting recommendations.*decision items/iu);
  assert.match(section(skill, "Assumption policy"), /illustrative.*source-derived/iu);
});

test("visualization presets cover six game-design structures with packaged Skillstead evidence gates", async () => {
  const presets = JSON.parse(await readFile(path.join(pluginRoot, "references/visualization-presets.json"), "utf8"));
  assert.equal(presets.schemaVersion, 1);
  assert.equal(presets.skillstead.packagePath, "skills/svg-infographic");
  assert.deepEqual(presets.presets.map(({ id }) => id), [
    "core-motivation-loop",
    "state-rule-flow",
    "quest-content-progression",
    "economy-source-sink",
    "liveops-roadmap",
    "production-role-structure",
  ]);
  for (const preset of presets.presets) {
    assert.deepEqual(Object.keys(preset).sort(), [
      "accessibility", "archetype", "fallback", "id", "pngRender", "suitedInputs", "svgLint", "unsuitableInputs",
    ]);
    assert.ok(preset.suitedInputs.length > 0, `${preset.id}: suited inputs`);
    assert.ok(preset.unsuitableInputs.length > 0, `${preset.id}: unsuitable inputs`);
    assert.equal(preset.accessibility.altTextRequired, true);
    assert.equal(preset.svgLint.command, `node ${visualizationWrapper} lint <svg-path>`);
    assert.equal(preset.pngRender.command, `node ${visualizationWrapper} render <svg-path> <png-path>`);
    assert.equal(preset.pngRender.scale, 2);
    assert.equal(preset.fallback.preserveCanonicalArtifact, true);
  }

  const skill = await readSkill("visualize-game-design");
  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "visualization output"), skillContracts["visualize-game-design"].outputFields);
  assert.match(section(skill, "Diagram decision"), /spatial structure materially improves understanding/iu);
  assert.match(section(skill, "Source integrity"), /illustrative placeholders.*non-canonical/isu);
  assert.match(section(skill, "Completion checks"), /requested.*generated.*linted.*rendered.*verified/isu);
  assert.match(section(skill, "Completion checks"), /command.*file evidence/isu);
});

test("plugin-owned visualization validator proves ordered same-file lint render and 2x verification", async () => {
  const artifactRoot = await temporaryDirectory("studio-visualization-evidence-");
  const assets = path.join(artifactRoot, "assets");
  await mkdir(assets);
  const svgPath = path.join(assets, "loop.svg");
  const pngPath = path.join(assets, "loop.png");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title><desc>Source-backed loop</desc><rect x="10" y="10" width="180" height="40" fill="#3366ff"/></svg>\n';
  await writeFile(svgPath, svg);
  const stagingRoot = await temporaryDirectory("studio-visualization-built-");
  const built = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const builtWrapperPath = path.join(built.outputDir, visualizationWrapper);
  const render = spawnSync(process.execPath, [builtWrapperPath, "render", svgPath, pngPath], { encoding: "utf8", timeout: 150_000 });
  const renderLog = `${render.stdout ?? ""}${render.stderr ?? ""}`.trim();
  assert.equal(render.status, 0, renderLog);
  const rendererIdentity = parseRendererIdentity(renderLog);
  const png = await readFile(pngPath);
  const [linterBytes, rendererBytes] = await Promise.all([
    readFile(path.join(skillsteadScriptRoot, "check-svg.mjs")),
    readFile(path.join(skillsteadScriptRoot, "render.mjs")),
  ]);
  const linterDigest = sha256(linterBytes);
  const rendererDigest = sha256(rendererBytes);
  const sourceValidationOptions = {
    artifactRoot,
    testRuntime: {
      wrapperPath: builtWrapperPath,
      linterPath: path.join(skillsteadScriptRoot, "check-svg.mjs"),
      rendererPath: path.join(skillsteadScriptRoot, "render.mjs"),
    },
  };
  const record = {
    schemaVersion: 1,
    presetId: "core-motivation-loop",
    requested: { svg: true, png: true },
    planned: {
      status: "passed", sourceSectionIds: ["core-loop"], altText: "Source-backed loop",
      svgPath: "assets/loop.svg", pngPath: "assets/loop.png",
    },
    generated: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg),
      evidence: [{ command: "author", exitCode: 0, svgPath: "assets/loop.svg", svgDigest: sha256(svg), sourceSectionIds: ["core-loop"] }],
    },
    linted: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg),
      linter: "Skillstead svg-infographic", linterVersion: "0.8.3", linterDigest,
      evidence: [{
        command: `node ${visualizationWrapper} lint assets/loop.svg`, exitCode: 0, log: "check-svg: 0 error(s), 0 warning(s)",
        linter: "Skillstead svg-infographic", linterVersion: "0.8.3", linterDigest,
        svgPath: "assets/loop.svg", svgDigest: sha256(svg),
      }],
    },
    rendered: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png",
      pngDigest: sha256(png), scale: 2, width: 400, height: 120,
      renderer: rendererIdentity.renderer, rendererVersion: rendererIdentity.rendererVersion, rendererDigest,
      evidence: [{
        command: `node ${visualizationWrapper} render assets/loop.svg assets/loop.png`, exitCode: 0,
        log: renderLog, renderer: rendererIdentity.renderer, rendererVersion: rendererIdentity.rendererVersion, rendererDigest,
        svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png", pngDigest: sha256(png), width: 400, height: 120,
      }],
    },
    verified: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png",
      pngDigest: sha256(png), width: 400, height: 120, sourceSectionIds: ["core-loop"], altText: "Source-backed loop",
      checks: ["fit-to-page", "close-up", "alt-text", "source-fidelity"],
    },
  };
  const { validateVisualizationEvidence } = await loadModule(visualizationValidatorScript);
  const valid = await validateVisualizationEvidence(record, sourceValidationOptions);
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  assert.deepEqual(valid.normalized, record);

  const mutations = [
    ["verified cannot skip lint", (value) => { value.linted.status = "pending"; }],
    ["all stages use the same SVG", (value) => { value.linted.svgPath = "assets/other.svg"; }],
    ["all render stages use the same PNG", (value) => { value.verified.pngPath = "assets/other.png"; }],
    ["PNG is exactly 2x the SVG viewBox", (value) => { value.rendered.width = 399; }],
    ["preset is one of the packaged registry IDs", (value) => { value.presetId = "invented-preset"; }],
    ["source section IDs are unique", (value) => { value.planned.sourceSectionIds.push("core-loop"); }],
    ["passed evidence requires exit zero", (value) => { value.linted.evidence[0].exitCode = 1; }],
    ["lint evidence uses the packaged wrapper", (value) => { value.linted.evidence[0].command = "node skills/svg-infographic/scripts/check-svg.mjs assets/loop.svg"; }],
    ["linter identity binds the vendored bytes", (value) => { value.linted.linterDigest = "0".repeat(64); value.linted.evidence[0].linterDigest = "0".repeat(64); }],
    ["renderer name and version are independent", (value) => { value.rendered.rendererVersion = ""; }],
    ["render evidence uses the packaged wrapper", (value) => { value.rendered.evidence[0].command = "node skills/svg-infographic/scripts/render.mjs assets/loop.svg assets/loop.png"; }],
    ["renderer identity binds the vendored bytes", (value) => { value.rendered.rendererDigest = "0".repeat(64); value.rendered.evidence[0].rendererDigest = "0".repeat(64); }],
    ["render log binds the renderer version", (value) => { value.rendered.evidence[0].log = "rendered 400x120"; }],
    ["source mapping evidence remains identical", (value) => { value.generated.evidence[0].sourceSectionIds = ["other-section"]; }],
    ["alt-text evidence remains identical", (value) => { value.verified.altText = "Different description"; }],
    ["QA checks are exact", (value) => { value.verified.checks.push("invented-check"); }],
    ["combined evidence attacks fail closed", (value) => { value.presetId = "invented-preset"; value.rendered.evidence[0].exitCode = 1; value.verified.altText = "forged"; }],
    ["asset traversal is rejected", (value) => { value.planned.svgPath = "../loop.svg"; }],
    ["unknown object keys fail closed", (value) => { value.rendered.untrusted = true; }],
    ["malformed QA arrays fail closed", (value) => { value.verified.checks = null; }],
    ["prototype-sensitive keys fail closed", (value) => { value.generated.evidence[0].constructor = "pollute"; }],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(record);
    mutate(candidate);
    const result = await validateVisualizationEvidence(candidate, sourceValidationOptions);
    assert.equal(result.ok, false, label);
    assert.equal(result.normalized, null, label);
  }

  for (const stageName of ["generated", "linted", "rendered"]) {
    for (const malformed of [null, {}, "invalid"]) {
      const candidate = structuredClone(record);
      candidate[stageName].evidence = malformed;
      const result = await validateVisualizationEvidence(candidate, sourceValidationOptions);
      assert.equal(result.ok, false, `${stageName} malformed evidence container`);
      assert.ok(result.errors.includes(`${stageName}.evidence must be an array`), `${stageName} container error path`);
      assert.equal(result.normalized, null);
    }
    for (const [malformed, expectedError] of [
      [null, `${stageName}.evidence[0] must be an object`],
      ["invalid", `${stageName}.evidence[0] must be an object`],
      [JSON.parse('{"constructor":{"polluted":true}}'), `record.${stageName}.evidence.0.constructor is prohibited`],
    ]) {
      const candidate = structuredClone(record);
      candidate[stageName].evidence = [malformed];
      const result = await validateVisualizationEvidence(candidate, sourceValidationOptions);
      assert.equal(result.ok, false, `${stageName} malformed evidence item`);
      assert.ok(result.errors.includes(expectedError), `${stageName} item error path: ${expectedError}`);
      assert.equal(result.normalized, null);
    }
    const candidate = structuredClone(record);
    candidate[stageName].evidence = [Object.create({ polluted: true })];
    const result = await validateVisualizationEvidence(candidate, sourceValidationOptions);
    assert.equal(result.ok, false, `${stageName} unsafe evidence prototype`);
    assert.ok(result.errors.includes(`record.${stageName}.evidence.0 has an unsafe prototype`));
    assert.equal(result.normalized, null);
  }

  for (const [label, invalidSvg] of [
    ["actual SVG title is required", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><desc>Source-backed loop</desc></svg>\n'],
    ["actual SVG desc is required", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title></svg>\n'],
  ]) {
    await writeFile(svgPath, invalidSvg);
    const candidate = structuredClone(record);
    const invalidDigest = sha256(invalidSvg);
    for (const stage of [candidate.generated, candidate.linted, candidate.rendered, candidate.verified]) stage.svgDigest = invalidDigest;
    candidate.generated.evidence[0].svgDigest = invalidDigest;
    candidate.linted.evidence[0].svgDigest = invalidDigest;
    candidate.rendered.evidence[0].svgDigest = invalidDigest;
    const result = await validateVisualizationEvidence(candidate, sourceValidationOptions);
    assert.equal(result.ok, false, label);
  }
  await writeFile(svgPath, svg);

  const builtValidatorPath = path.join(built.outputDir, "skills/visualize-game-design/scripts/validate-visualization-evidence.mjs");
  const builtValidator = await loadModule(builtValidatorPath);
  for (const [label, validate, options] of [
    ["source validator", validateVisualizationEvidence, sourceValidationOptions],
    ["built validator", builtValidator.validateVisualizationEvidence, { artifactRoot }],
  ]) {
    const hardErrorSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title><desc>Source-backed loop</desc><path d="M 0 0 L 10 10" marker-end="url(#missing)"/></svg>\n';
    await writeFile(svgPath, hardErrorSvg);
    const forgedLint = structuredClone(record);
    const hardErrorDigest = sha256(hardErrorSvg);
    for (const stage of [forgedLint.generated, forgedLint.linted, forgedLint.rendered, forgedLint.verified]) stage.svgDigest = hardErrorDigest;
    forgedLint.generated.evidence[0].svgDigest = hardErrorDigest;
    forgedLint.linted.evidence[0].svgDigest = hardErrorDigest;
    forgedLint.rendered.evidence[0].svgDigest = hardErrorDigest;
    const lintResult = await validate(forgedLint, options);
    assert.equal(lintResult.ok, false, `${label}: hard-error SVG with forged pass evidence`);
    assert.ok(lintResult.errors.some((message) => /Skillstead lint/iu.test(message)), `${label}: independent linter result`);
    await writeFile(svgPath, svg);

    const zeroCrc = Buffer.from(png);
    zeroCrc.writeUInt32BE(0, 29);
    const interlaced = completePngBytes(1, 1, deflateSync(Buffer.from([0])), { interlace: 1 });
    await writeFile(pngPath, interlaced);
    const interlacedCandidate = structuredClone(record);
    const interlacedDigest = sha256(interlaced);
    interlacedCandidate.rendered.pngDigest = interlacedDigest;
    interlacedCandidate.verified.pngDigest = interlacedDigest;
    interlacedCandidate.rendered.evidence[0].pngDigest = interlacedDigest;
    for (const target of [interlacedCandidate.rendered, interlacedCandidate.verified, interlacedCandidate.rendered.evidence[0]]) {
      target.width = 1;
      target.height = 1;
    }
    const interlacedResult = await validate(interlacedCandidate, options);
    assert.equal(interlacedResult.ok, false, `${label}: Adam7 PNG is unsupported`);
    assert.ok(interlacedResult.errors.some((message) => /interlac/iu.test(message)), `${label}: explicit non-interlaced invariant`);
    const alternateZeroPixels = completePngBytes(400, 120, deflateSync(Buffer.alloc((1 + 400 * 4) * 120), { level: 9 }));
    await writeFile(pngPath, alternateZeroPixels);
    const selfAttestedRender = structuredClone(record);
    const alternateDigest = sha256(alternateZeroPixels);
    selfAttestedRender.rendered.pngDigest = alternateDigest;
    selfAttestedRender.verified.pngDigest = alternateDigest;
    selfAttestedRender.rendered.evidence[0].pngDigest = alternateDigest;
    selfAttestedRender.rendered.evidence[0].log = `forged ${selfAttestedRender.rendered.rendererVersion}`;
    const selfAttestedResult = await validate(selfAttestedRender, options);
    assert.equal(selfAttestedResult.ok, false, `${label}: structurally valid self-attested PNG`);
    assert.ok(selfAttestedResult.errors.some((message) => /independent.*render|render.*independent/iu.test(message)), `${label}: independent render evidence`);
    const pngAttacks = [
      ["truncated PNG", png.subarray(0, -1), 400, 120],
      ["zero-CRC PNG", zeroCrc, 400, 120],
      ["extra-byte PNG", Buffer.concat([png, Buffer.from([0])]), 400, 120],
      ["invalid compressed PNG", completePngBytes(400, 120, Buffer.from([0])), 400, 120],
      ["short scanline PNG", completePngBytes(400, 120, deflateSync(Buffer.alloc((1 + 400 * 4) * 120 - 1))), 400, 120],
      ["extra scanline PNG", completePngBytes(400, 120, deflateSync(Buffer.alloc((1 + 400 * 4) * 120 + 1))), 400, 120],
      ["invalid filter PNG", completePngBytes(400, 120, deflateSync(Buffer.concat([Buffer.from([5]), Buffer.alloc((1 + 400 * 4) * 120 - 1)]))), 400, 120],
      ["unsupported RGBA bit depth PNG", completePngBytes(400, 120, undefined, { bitDepth: 4, colorType: 6 }), 400, 120],
      ["wrong-size PNG", await writeCompletePng(pngPath, 399, 120), 399, 120],
    ];
    for (const [attack, bytes, width, height] of pngAttacks) {
      await writeFile(pngPath, bytes);
      const candidate = structuredClone(record);
      const attackedDigest = sha256(bytes);
      candidate.rendered.pngDigest = attackedDigest;
      candidate.verified.pngDigest = attackedDigest;
      candidate.rendered.evidence[0].pngDigest = attackedDigest;
      candidate.rendered.width = width;
      candidate.rendered.height = height;
      candidate.verified.width = width;
      candidate.verified.height = height;
      candidate.rendered.evidence[0].width = width;
      candidate.rendered.evidence[0].height = height;
      const result = await validate(candidate, options);
      assert.equal(result.ok, false, `${label}: ${attack}`);
      assert.equal(result.normalized, null, `${label}: ${attack}`);
    }
    await writeFile(pngPath, png);
  }
});

test("packaged Skillstead wrapper survives tmp realpath symlink and relative aliases", async () => {
  const stagingRoot = await mkdtemp("/tmp/studio-skillstead-wrapper-");
  temporaryDirectories.push(stagingRoot);
  const built = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const wrapperPath = path.join(built.outputDir, visualizationWrapper);
  assert.equal((await lstat(wrapperPath)).isFile(), true, "packaged wrapper exists");
  const wrapperSource = await readFile(wrapperPath, "utf8");
  const forbiddenRepositoryFallback = /\.\.\/.*(?:shared\/vendor|products\/game-design)|\/Users\//u;
  assert.doesNotMatch(wrapperSource, forbiddenRepositoryFallback, "shipped wrapper has no repository or host fallback");
  for (const relativePath of built.files.filter((file) => /\.(?:mjs|md)$/u.test(file))) {
    const source = await readFile(path.join(built.outputDir, relativePath), "utf8");
    assert.doesNotMatch(source, forbiddenRepositoryFallback, `${relativePath}: release fallback scan`);
  }
  const canonicalWrapper = await realpath(wrapperPath);
  const wrapperLink = path.join(stagingRoot, "skillstead-wrapper-link.mjs");
  await symlink(wrapperPath, wrapperLink);
  const badSvg = path.join(stagingRoot, "bad.svg");
  await writeFile(badSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path marker-end="url(#missing)" d="M0 0L1 1"/></svg>\n');
  const aliases = [
    { value: wrapperPath, cwd: repoRoot },
    { value: canonicalWrapper, cwd: repoRoot },
    { value: wrapperLink, cwd: repoRoot },
    { value: path.relative(built.outputDir, wrapperPath), cwd: built.outputDir },
  ];
  for (const [index, alias] of aliases.entries()) {
    const lint = spawnSync(process.execPath, [alias.value, "lint", badSvg], { cwd: alias.cwd, encoding: "utf8" });
    assert.notEqual(lint.status, 0, `alias ${index} rejects a hard-error SVG`);
    assert.match(`${lint.stdout}${lint.stderr}`, /check-svg|E-REF|hard error/iu, `alias ${index} executed the real linter`);
  }

  const goodSvg = path.join(stagingRoot, "good.svg");
  const outputPng = path.join(stagingRoot, "good.png");
  await writeFile(goodSvg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><title>Good</title><desc>Good diagram</desc></svg>\n');
  const render = spawnSync(process.execPath, [wrapperLink, "render", goodSvg, outputPng], { encoding: "utf8", timeout: 30_000 });
  if (render.status === 0) {
    const { inspectCompletePng } = await loadModule(path.join(built.outputDir, "skills/visualize-game-design/scripts/validate-visualization-evidence.mjs"));
    const inspection = inspectCompletePng(await readFile(outputPng));
    assert.equal(inspection.ok, true, inspection.errors.join("\n"));
    assert.deepEqual({ width: inspection.width, height: inspection.height }, { width: 40, height: 20 });
  } else {
    await assert.rejects(lstat(outputPng), { code: "ENOENT" });
    assert.match(`${render.stdout}${render.stderr}`, /browser|chromium|render|unavailable|exit/iu);
  }

  const sourceWrapperPath = path.join(pluginRoot, visualizationWrapper);
  const sourceInvocation = spawnSync(process.execPath, [sourceWrapperPath, "lint", goodSvg], { encoding: "utf8" });
  assert.notEqual(sourceInvocation.status, 0, "source overlay cannot fall back to repository sibling vendor bytes");
  assert.match(`${sourceInvocation.stdout}${sourceInvocation.stderr}`, /packaged Skillstead.*unavailable/iu);

  await rm(path.join(built.outputDir, "skills/svg-infographic/scripts/check-svg.mjs"));
  const missingPackagedLinter = spawnSync(process.execPath, [wrapperPath, "lint", goodSvg], { encoding: "utf8" });
  assert.notEqual(missingPackagedLinter.status, 0, "missing packaged linter fails closed");
  assert.match(`${missingPackagedLinter.stdout}${missingPackagedLinter.stderr}`, /packaged Skillstead.*unavailable/iu);
});

test("visualization validator accepts a verified SVG fallback when PNG rendering fails", async () => {
  const artifactRoot = await temporaryDirectory("studio-visualization-fallback-");
  const assets = path.join(artifactRoot, "assets");
  await mkdir(assets);
  const svgPath = path.join(assets, "loop.svg");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title><desc>Source-backed loop</desc></svg>\n';
  await writeFile(svgPath, svg);
  const svgDigest = sha256(svg);
  const [linterBytes, rendererBytes] = await Promise.all([
    readFile(path.join(skillsteadScriptRoot, "check-svg.mjs")),
    readFile(path.join(skillsteadScriptRoot, "render.mjs")),
  ]);
  const linterDigest = sha256(linterBytes);
  const rendererDigest = sha256(rendererBytes);
  const record = {
    schemaVersion: 1,
    presetId: "core-motivation-loop",
    requested: { svg: true, png: true },
    planned: { status: "passed", sourceSectionIds: ["core-loop"], altText: "Source-backed loop", svgPath: "assets/loop.svg", pngPath: "assets/loop.png" },
    generated: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest,
      evidence: [{ command: "author", exitCode: 0, svgPath: "assets/loop.svg", svgDigest, sourceSectionIds: ["core-loop"] }],
    },
    linted: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest,
      linter: "Skillstead svg-infographic", linterVersion: "0.8.3", linterDigest,
      evidence: [{
        command: `node ${visualizationWrapper} lint assets/loop.svg`, exitCode: 0, log: "check-svg: 0 error(s), 0 warning(s)",
        linter: "Skillstead svg-infographic", linterVersion: "0.8.3", linterDigest, svgPath: "assets/loop.svg", svgDigest,
      }],
    },
    rendered: {
      status: "failed", svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null,
      scale: 2, width: null, height: null, renderer: "Chromium", rendererVersion: "Chromium 140", rendererDigest,
      evidence: [{
        command: `node ${visualizationWrapper} render assets/loop.svg assets/loop.png`, exitCode: 1, log: "renderer failed: Chromium 140",
        renderer: "Chromium", rendererVersion: "Chromium 140", rendererDigest,
        svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null, width: null, height: null,
      }],
    },
    verified: {
      status: "unavailable", svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null,
      width: null, height: null, sourceSectionIds: ["core-loop"], altText: "Source-backed loop", checks: [],
    },
  };
  const { validateVisualizationEvidence } = await loadModule(visualizationValidatorScript);
  const result = await validateVisualizationEvidence(record, {
    artifactRoot,
    testRuntime: {
      wrapperPath: path.join(pluginRoot, visualizationWrapper),
      linterPath: path.join(skillsteadScriptRoot, "check-svg.mjs"),
      rendererPath: path.join(skillsteadScriptRoot, "render.mjs"),
    },
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("export recipes are artifact-specific and presentations require an independent story", async () => {
  const recipes = await readFile(path.join(pluginRoot, "references/export-recipes.md"), "utf8");
  const jobManifest = await readSkill("export-game-design-documents", "references/job-manifest.md");
  const ids = [...recipes.matchAll(/^### Recipe: `([a-z0-9-]+)`$/gmu)].map(([, id]) => id);
  assert.deepEqual(ids, [
    "gdd",
    "system-spec",
    "content-spec",
    "liveops-plan",
    "review-report",
    "executive-presentation",
  ]);
  assert.match(recipes, /audience.*purpose.*independent story outline/isu);
  assert.match(recipes, /must not split Markdown headings into slides/iu);

  const skill = await readSkill("export-game-design-documents");
  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "export output"), skillContracts["export-game-design-documents"].outputFields);
  assert.match(section(skill, "Workflow"), /validate-artifact\.mjs/iu);
  assert.match(section(skill, "Workflow"), /capability-probe\.mjs/iu);
  for (const format of ["MD", "PDF", "DOCX", "PPTX"]) assert.match(section(skill, "Completion checks"), new RegExp(`\\b${format}\\b`, "u"));
  assert.match(section(skill, "Workflow"), /downstream.*generation.*actual-file.*digests.*counts.*evidence.*terminal/isu);
  assert.match(section(skill, "Completion checks"), /preparation manifest.*passed.*failed/isu);
  assert.match(section(skill, "Completion checks"), /not-run.*output path.*digest.*count.*evidence/isu);
  assert.match(jobManifest, /before downstream generation.*rejects terminal status.*derivative claims.*format evidence/isu);
  assert.doesNotMatch(jobManifest, /after downstream generation/iu);
});

test("export preparation emits a renderer-neutral pending manifest without fabricating outputs", async () => {
  const outputDir = await temporaryDirectory("studio-export-output-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "gdd",
    requestedFormats: ["md", "pdf", "docx", "pptx"],
    presentation: {
      audience: "studio leadership",
      purpose: "decide whether the combat brief advances",
      slideOutline: [
        { id: "decision", title: "Advance the combat direction", message: "The prototype evidence supports a bounded next gate.", purpose: "request a decision" },
        { id: "experience", title: "The intended play experience", message: "Timing and counterplay define the combat promise.", purpose: "align on experience" },
        { id: "proof", title: "What the evidence establishes", message: "The canonical brief separates facts from assumptions.", purpose: "show decision evidence" },
        { id: "next-gate", title: "Risks and the next gate", message: "Resolve the listed unknowns before production commitment.", purpose: "bound the investment" },
      ],
    },
    capabilities: {
      node: { available: true, version: process.versions.node },
      chromium: { available: true, command: "chromium" },
      soffice: { available: false },
      documents: { available: true, provider: "codex-bundled" },
      pdf: { available: true, provider: "codex-bundled" },
      presentations: { available: true, provider: "codex-bundled" },
    },
    validatorPath,
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.preflight.status, "passed");
  assert.equal(manifest.recipe.id, "gdd");
  assert.deepEqual(Object.keys(manifest.formats), ["md", "pdf", "docx", "pptx"]);
  const canonicalOutputDir = await realpath(outputDir);
  for (const [format, job] of Object.entries(manifest.formats)) {
    assert.equal(job.requested, true, format);
    assert.equal(job.status, "pending", format);
    assert.equal(job.extension, format, format);
    assert.deepEqual(job.statusHistory, ["pending"], format);
    assert.equal(job.outputPath, null, format);
    assert.equal(job.digest, null, format);
    assert.equal(job.pageOrSlideCount, null, format);
    assert.deepEqual(job.evidence, [], format);
    assert.ok(job.plannedOutputPath.startsWith(`${canonicalOutputDir}${path.sep}`), format);
  }
  assert.equal("renderer" in manifest, false);
  assert.equal("library" in manifest, false);
});

test("export preparation keeps unavailable capabilities distinct from renderer and QA evidence", async () => {
  const outputDir = await temporaryDirectory("studio-export-unavailable-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "review-report",
    requestedFormats: ["md", "pdf", "docx"],
    capabilities: {
      node: { available: true, version: process.versions.node },
      chromium: { available: false },
      soffice: { available: false },
      documents: { available: false },
      pdf: { available: false },
      presentations: { available: false },
    },
    validatorPath,
  });

  assert.equal(manifest.formats.md.status, "pending");
  assert.equal(manifest.formats.pdf.status, "unavailable");
  assert.equal(manifest.formats.docx.status, "unavailable");
  assert.equal(manifest.formats.pptx.status, "not-requested");
  assert.deepEqual(manifest.formats.pdf.evidence, []);
  assert.deepEqual(manifest.formats.docx.evidence, []);
});

test("export preparation fails closed before jobs when canonical preflight fails", async () => {
  const invalidArtifact = await temporaryDirectory("studio-invalid-artifact-");
  const outputDir = await temporaryDirectory("studio-invalid-output-");
  await mkdir(path.join(invalidArtifact, "assets"));
  await mkdir(path.join(invalidArtifact, "decisions"));
  await writeFile(path.join(invalidArtifact, "content.md"), "# Missing frontmatter and stable ID\n");

  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: invalidArtifact,
    outputDir,
    recipeId: "gdd",
    requestedFormats: ["md", "pdf"],
    capabilities: { pdf: { available: true } },
    validatorPath,
  });

  assert.equal(manifest.preflight.status, "failed");
  assert.ok(manifest.preflight.errors.length > 0);
  assert.equal(manifest.formats.md.status, "blocked");
  assert.equal(manifest.formats.pdf.status, "blocked");
});

test("export preflight parses the status-selected normalized JSON stream and rejects ambiguity", async () => {
  const root = await temporaryDirectory("studio-export-preflight-streams-");
  const outputDir = path.join(root, "output");
  await mkdir(outputDir);
  const normalizedFailure = {
    ok: false,
    errors: [{ code: "artifact.invalid", file: "content.md", message: "invalid artifact" }],
    warnings: [],
    files: ["content.md"],
    requestedFormats: ["md"],
  };
  const failureValidator = await writePreflightValidator(root, "failure", {
    status: 1,
    stderr: `${JSON.stringify(normalizedFailure)}\n`,
  });
  const stagingRoot = await temporaryDirectory("studio-export-preflight-built-");
  const built = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const modules = [
    ["source", await loadPrepareModule()],
    ["clean-built", await loadModule(path.join(built.outputDir, "skills/export-game-design-documents/scripts/prepare-studio-export.mjs"))],
  ];

  for (const [label, module] of modules) {
    const manifest = await module.prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "gdd",
      requestedFormats: ["md"],
      capabilities: {},
      validatorPath: failureValidator,
    });
    assert.equal(manifest.preflight.status, "failed", `${label}: stderr failure status`);
    assert.deepEqual(manifest.preflight.errors, normalizedFailure.errors, `${label}: normalized errors preserved`);
    assert.deepEqual(manifest.preflight.files, normalizedFailure.files, `${label}: normalized files preserved`);
  }

  const normalizedSuccess = { ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] };
  const invalidCases = [
    ["missing success stdout", { status: 0 }],
    ["malformed success stdout", { status: 0, stdout: "not-json\n" }],
    ["success with stderr", { status: 0, stdout: `${JSON.stringify(normalizedSuccess)}\n`, stderr: `${JSON.stringify(normalizedFailure)}\n` }],
    ["missing failure stderr", { status: 1 }],
    ["malformed failure stderr", { status: 1, stderr: "not-json\n" }],
    ["failure with stdout", { status: 1, stdout: `${JSON.stringify(normalizedSuccess)}\n`, stderr: `${JSON.stringify(normalizedFailure)}\n` }],
    ["success status conflicts with payload", { status: 0, stdout: `${JSON.stringify(normalizedFailure)}\n` }],
    ["failure status conflicts with payload", { status: 1, stderr: `${JSON.stringify(normalizedSuccess)}\n` }],
    ["malformed normalized contract", { status: 1, stderr: `${JSON.stringify({ ok: false, errors: "invalid", warnings: [], files: [], requestedFormats: [] })}\n` }],
  ];
  for (const [caseName, streams] of invalidCases) {
    const invalidValidator = await writePreflightValidator(root, caseName.replaceAll(" ", "-"), streams);
    for (const [label, module] of modules) {
      await assert.rejects(
        () => module.prepareStudioExportJob({
          artifactDir: fixtureArtifact,
          outputDir,
          recipeId: "gdd",
          requestedFormats: ["md"],
          capabilities: {},
          validatorPath: invalidValidator,
        }),
        /Canonical validator/iu,
        `${label}: ${caseName}`,
      );
    }
  }
});

test("export preparation rejects PPTX without audience purpose and independent outline", async () => {
  const outputDir = await temporaryDirectory("studio-pptx-brief-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "executive-presentation",
      requestedFormats: ["pptx"],
      capabilities: { presentations: { available: true } },
      presentation: { audience: "executives", purpose: "approve direction", slideOutline: [] },
      validatorPath,
    }),
    /PPTX.*slide outline/iu,
  );
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "executive-presentation",
      requestedFormats: ["pptx"],
      capabilities: { presentations: { available: true } },
      presentation: { audience: "executives", purpose: "approve direction", slideOutline: ["# Player Experience"] },
      validatorPath,
    }),
    /PPTX.*slide outline/iu,
  );
});

test("export preparation rejects traversal symlinks and unsafe overwrites", async () => {
  const root = await temporaryDirectory("studio-export-security-");
  const outputDir = path.join(root, "output");
  const symlinkOutput = path.join(root, "symlink-output");
  await mkdir(outputDir);
  await symlink(outputDir, symlinkOutput);
  const { prepareStudioExportJob } = await loadPrepareModule();

  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir: symlinkOutput,
      recipeId: "gdd",
      requestedFormats: ["md"],
      capabilities: {},
      validatorPath,
    }),
    /symlink/iu,
  );

  await writeFile(path.join(outputDir, "combat-brief.md"), "existing owner content\n");
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "gdd",
      requestedFormats: ["md"],
      capabilities: {},
      validatorPath,
    }),
    /overwrite/iu,
  );

  const stat = await lstat(path.join(outputDir, "combat-brief.md"));
  assert.equal(stat.isFile(), true);
  assert.equal(await readFile(path.join(outputDir, "combat-brief.md"), "utf8"), "existing owner content\n");
});

test("plugin-owned export validator accepts only non-terminal preparation manifests", async () => {
  const outputDir = await temporaryDirectory("studio-export-validator-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const { validateStudioExportManifest } = await loadModule(exportValidatorScript);
  const prepared = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "review-report",
    requestedFormats: ["md", "pptx"],
    capabilities: { presentations: { available: true, provider: "codex-bundled" } },
    presentation: {
      audience: "studio leadership",
      purpose: "decide the review outcome",
      slideOutline: [
        { id: "decision", title: "Choose the review outcome", message: "The evidence supports a bounded decision.", purpose: "request a decision" },
        { id: "risk", title: "Resolve the material risk", message: "One unknown remains before commitment.", purpose: "bound the next gate" },
      ],
    },
    validatorPath,
  });
  const valid = await validateStudioExportManifest(prepared, { outputRoot: outputDir });
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  assert.deepEqual(valid.normalized, prepared);

  const derivativePath = prepared.formats.md.plannedOutputPath;
  const derivativeBytes = Buffer.from("# Review report\n", "utf8");
  await writeFile(derivativePath, derivativeBytes);
  const terminalPassed = structuredClone(prepared);
  terminalPassed.formats.md = {
    ...terminalPassed.formats.md,
    status: "passed",
    statusHistory: ["pending", "passed"],
    generationStatus: "passed",
    rendererStatus: "not-required",
    qaStatus: "passed",
    outputPath: derivativePath,
    digest: sha256(derivativeBytes),
    pageOrSlideCount: 1,
    evidence: [
      { stage: "generation", status: "passed", derivativePath, digest: sha256(derivativeBytes), command: "canonical Markdown copy", exitCode: 0 },
      { stage: "qa", status: "passed", derivativePath, digest: sha256(derivativeBytes), command: "Markdown QA", exitCode: 0, count: 1 },
    ],
  };
  const rejectedPassed = await validateStudioExportManifest(terminalPassed, { outputRoot: outputDir });
  assert.equal(rejectedPassed.ok, false, "preparation validator must reject a fully evidenced passed derivative");
  assert.ok(rejectedPassed.errors.some((message) => /preparation|downstream|terminal/iu.test(message)));

  const terminalFailed = structuredClone(prepared);
  terminalFailed.formats.md = {
    ...terminalFailed.formats.md,
    status: "failed",
    statusHistory: ["pending", "failed"],
    generationStatus: "failed",
    evidence: [{ stage: "generation", status: "failed", derivativePath: null, digest: null, command: "generator", exitCode: 1 }],
  };
  const rejectedFailed = await validateStudioExportManifest(terminalFailed, { outputRoot: outputDir });
  assert.equal(rejectedFailed.ok, false, "preparation validator must reject a fully evidenced failed derivative");
  assert.ok(rejectedFailed.errors.some((message) => /preparation|downstream|terminal/iu.test(message)));

  const stagingRoot = await temporaryDirectory("studio-export-validator-built-");
  const built = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const builtValidator = await loadModule(path.join(
    built.outputDir,
    "skills/export-game-design-documents/scripts/validate-studio-export.mjs",
  ));
  for (const [label, candidate, expectedOk] of [
    ["prepared", prepared, true],
    ["passed", terminalPassed, false],
    ["failed", terminalFailed, false],
  ]) {
    const result = await builtValidator.validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, expectedOk, `built validator: ${label}`);
    if (!expectedOk) assert.ok(result.errors.some((message) => /preparation|downstream|terminal/iu.test(message)), `built validator: ${label} boundary`);
  }

  const mutations = [
    ["extension must match format", (value) => { value.formats.md.extension = "pdf"; }],
    ["capability probe states are mutually exclusive", (value) => { value.capabilityProbe.status = "missing"; value.capabilityProbe.capabilities.pdf = { available: true }; }],
    ["requested and not-requested are exact", (value) => { value.formats.pdf.requested = false; value.formats.pdf.status = "pending"; value.formats.pdf.statusHistory = ["pending"]; }],
    ["passed format status is downstream-only", (value) => { value.formats.md.status = "passed"; value.formats.md.statusHistory = ["pending", "passed"]; }],
    ["failed format status is downstream-only", (value) => { value.formats.md.status = "failed"; value.formats.md.statusHistory = ["pending", "failed"]; }],
    ["generation terminal state is downstream-only", (value) => { value.formats.md.generationStatus = "passed"; }],
    ["renderer terminal state is downstream-only", (value) => { value.formats.md.rendererStatus = "not-required"; }],
    ["QA terminal state is downstream-only", (value) => { value.formats.md.qaStatus = "failed"; }],
    ["passed preflight matches exit code and errors", (value) => { value.preflight.exitCode = 1; value.preflight.errors = [{ code: "FORGED", file: "content.md", message: "forged" }]; }],
    ["pending jobs cannot claim derivatives", (value) => { value.formats.pptx.outputPath = value.formats.pptx.plannedOutputPath; value.formats.pptx.digest = "0".repeat(64); }],
    ["format evidence is downstream-only", (value) => { value.formats.md.evidence = [{ stage: "generation", status: "passed", derivativePath: value.formats.md.plannedOutputPath, digest: "0".repeat(64), command: "forged", exitCode: 0 }]; }],
    ["format capability identity is fixed", (value) => { value.formats.pptx.capability.name = "pdf"; }],
    ["format capability equals its probe snapshot", (value) => { value.formats.pptx.capability.provider = "forged-provider"; }],
    ["PPTX requests require presentation", (value) => { delete value.presentation; }],
    ["presentation slides are independent stories", (value) => { value.presentation.slideOutline[0].title = "# Review report"; }],
    ["presentation slides do not copy canonical headings", (value) => { value.presentation.slideOutline[0].title = "Player Experience"; }],
    ["malformed evidence arrays fail closed", (value) => { value.formats.pptx.evidence = null; }],
    ["unknown object keys fail closed", (value) => { value.formats.md.untrusted = true; }],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(prepared);
    mutate(candidate);
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, label);
    assert.equal(result.normalized, null, label);
  }

  const invalidArtifact = await temporaryDirectory("studio-export-validator-preflight-");
  await mkdir(path.join(invalidArtifact, "assets"));
  await mkdir(path.join(invalidArtifact, "decisions"));
  await writeFile(path.join(invalidArtifact, "content.md"), "# Invalid artifact\n");
  const failedPreflight = await prepareStudioExportJob({
    artifactDir: invalidArtifact,
    outputDir,
    recipeId: "review-report",
    requestedFormats: ["md"],
    capabilities: {},
    validatorPath,
  });
  const preservedPreflight = await validateStudioExportManifest(failedPreflight, { outputRoot: outputDir });
  assert.equal(preservedPreflight.ok, true, preservedPreflight.errors.join("\n"));
  assert.equal(preservedPreflight.normalized.preflight.status, "failed");
  assert.ok(preservedPreflight.normalized.preflight.errors.length > 0);


  for (const malformed of [null, {}, "invalid"]) {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = malformed;
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "malformed capability evidence container");
    assert.ok(result.errors.includes("capabilityProbe.evidence must be an array"));
    assert.equal(result.normalized, null);
  }
  for (const [malformed, expectedError] of [
    [null, "capabilityProbe.evidence[0] must be an object"],
    ["invalid", "capabilityProbe.evidence[0] must be an object"],
    [JSON.parse('{"constructor":{"polluted":true}}'), "manifest.capabilityProbe.evidence.0.constructor is prohibited"],
  ]) {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = [malformed];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "malformed capability evidence item");
    assert.ok(result.errors.includes(expectedError), expectedError);
    assert.equal(result.normalized, null);
  }
  {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = [Object.create({ polluted: true })];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "unsafe capability evidence prototype");
    assert.ok(result.errors.includes("manifest.capabilityProbe.evidence.0 has an unsafe prototype"));
    assert.equal(result.normalized, null);
  }
  for (const format of ["md", "pdf", "docx", "pptx"]) {
    for (const malformed of [null, {}, "invalid"]) {
      const candidate = structuredClone(prepared);
      candidate.formats[format].evidence = malformed;
      const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
      assert.equal(result.ok, false, `${format} malformed evidence container`);
      assert.ok(result.errors.includes(`formats.${format}.evidence must be an array`), `${format} container error path`);
      assert.equal(result.normalized, null);
    }
    for (const [malformed, expectedError] of [
      [null, `formats.${format}.evidence[0] must be an object`],
      ["invalid", `formats.${format}.evidence[0] must be an object`],
      [JSON.parse('{"constructor":{"polluted":true}}'), `manifest.formats.${format}.evidence.0.constructor is prohibited`],
    ]) {
      const candidate = structuredClone(prepared);
      candidate.formats[format].evidence = [malformed];
      const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
      assert.equal(result.ok, false, `${format} malformed evidence item`);
      assert.ok(result.errors.includes(expectedError), `${format} item error path: ${expectedError}`);
      assert.equal(result.normalized, null);
    }
    const candidate = structuredClone(prepared);
    candidate.formats[format].evidence = [Object.create({ polluted: true })];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, `${format} unsafe evidence prototype`);
    assert.ok(result.errors.includes(`manifest.formats.${format}.evidence.0 has an unsafe prototype`));
    assert.equal(result.normalized, null);
  }
});
