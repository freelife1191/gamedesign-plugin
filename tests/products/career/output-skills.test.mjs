import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

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
  const png = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "latin1");
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
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
    await writeFile(path.join(root, "career-map.svg"), '<svg viewBox="0 0 600 300"></svg>', "utf8");
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
      availabilityEvidence: { command: "node render.mjs --probe", result: "failed", reason: "no Chromium found" },
      lintEvidence: {
        command: "node check-svg.mjs career-map.svg",
        file: "career-map.svg",
        result: "passed",
        warningsDisposition: "no warnings",
      },
    };
    assert.doesNotThrow(() => validateVisualizationState(svgOnly));
    for (const mutation of [
      { ...svgOnly, requested: false },
      { ...svgOnly, planned: false },
      { ...svgOnly, generated: false },
      { ...svgOnly, lintEvidence: null },
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
      altText: "Role evidence maps to two provisional paths.",
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
    ]) assert.throws(() => validateVisualizationState(mutation));
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
    await writeFile(path.join(root, "portfolio.pdf"), "%PDF fixture", "utf8");
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
      { kind: "qa", command: "verify-pdf portfolio.pdf", file: "portfolio.pdf", result: "passed" },
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
    for (const file of ["portfolio.pdf", "other.pdf", "wrong.docx"]) {
      await writeFile(path.join(root, file), "% derivative fixture", "utf8");
    }
    const valid = baseJob(root);
    valid.formats.pdf = {
      requested: true,
      availability: "available",
      status: "passed",
      evidence: [
        { kind: "capability-probe", command: "renderer --version", result: "passed" },
        { kind: "generation", command: "render", file: "portfolio.pdf", result: "passed" },
        { kind: "qa", command: "verify", file: "portfolio.pdf", result: "passed" },
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n", "utf8");
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
    await writeFile(path.join(root, "content.md"), "# Portfolio\n\n## Problem\n\n## Result\n", "utf8");
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
