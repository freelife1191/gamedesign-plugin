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

function assertVisualizationState(record) {
  for (const state of ["requested", "planned", "generated", "linted", "rendered", "verified"]) {
    assert.equal(typeof record[state], "boolean", `${state} must be boolean`);
  }
  if (record.generated) assert.ok(record.svgFile, "generated requires svgFile");
  if (record.linted) {
    assert.equal(record.generated, true, "linted requires generated SVG");
    for (const field of ["command", "file", "result"]) assert.ok(record.lintEvidence?.[field]);
    assert.equal(record.lintEvidence.result, "passed");
  }
  if (record.rendered) {
    assert.equal(record.linted, true, "rendered requires linted SVG");
    for (const field of ["command", "svgFile", "pngFile", "browser", "result"]) {
      assert.ok(record.renderEvidence?.[field]);
    }
    assert.equal(record.renderEvidence.result, "passed");
  }
  if (record.verified) {
    assert.equal(record.rendered, true, "verified requires rendered PNG");
    assert.ok(record.altText);
    assert.ok(record.visualQa);
    assert.equal(record.renderEvidence.scale, 2, "verified PNG must be 2x");
  }
  if (record.pngAvailability === "unavailable") {
    assert.equal(record.rendered, false);
    assert.equal(record.verified, false);
  }
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

test("visualization state fixtures reject generated, linted, rendered, or verified claims without evidence", () => {
  const svgOnly = {
    requested: true,
    planned: true,
    generated: true,
    linted: true,
    rendered: false,
    verified: false,
    svgFile: "career-map.svg",
    pngAvailability: "unavailable",
    lintEvidence: { command: "node check-svg.mjs career-map.svg", file: "career-map.svg", result: "passed" },
  };
  assert.doesNotThrow(() => assertVisualizationState(svgOnly));
  assert.throws(() => assertVisualizationState({ ...svgOnly, generated: false }));
  assert.throws(() => assertVisualizationState({ ...svgOnly, lintEvidence: null }));
  assert.throws(() => assertVisualizationState({ ...svgOnly, rendered: true }));
  assert.throws(() => assertVisualizationState({ ...svgOnly, verified: true }));

  const verified = {
    ...svgOnly,
    pngAvailability: "available",
    rendered: true,
    verified: true,
    altText: "Role evidence maps to two provisional paths.",
    visualQa: "No clipping; relationship labels inspected.",
    renderEvidence: {
      command: "node render.mjs career-map.svg career-map.png",
      svgFile: "career-map.svg",
      pngFile: "career-map.png",
      browser: "Chromium 150",
      result: "passed",
      scale: 2,
    },
  };
  assert.doesNotThrow(() => assertVisualizationState(verified));
  assert.throws(() => assertVisualizationState({ ...verified, renderEvidence: { ...verified.renderEvidence, scale: 1 } }));
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
