import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

import { buildUseCaseDiagrams } from "../../tooling/build-use-case-diagrams.mjs";
import * as studioProductionContract from "../../tooling/lib/studio-diagram-production-contract.mjs";
import { renderDiagramSvg } from "../../tooling/lib/use-case-diagrams.mjs";

const productionRepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const source = Object.freeze({
  id: "aud-01",
  scope: "audiences",
  title: "검증 가능한 학습 경로",
  description: "작은 단계와 사람 검토를 연결합니다.",
  alt: "검증 가능한 학습 경로",
  type: "learning-path",
  eyebrow: "AUD-01 · TEST",
  conclusion: "사람 검토 뒤 다음 단계를 정합니다.",
  steps: [
    { label: "관찰", detail: "사실을 기록합니다." },
    { label: "실습", detail: "작은 규칙을 만듭니다." },
    { label: "검토", detail: "다음 과제를 정합니다." },
  ],
  source_paths: ["guides/use-cases/audience-paths.md"],
  used_by: ["guides/use-cases/audience-paths.md"],
});

const pngPath = "guides/assets/use-cases/audiences/aud-01.png";
const svgPath = "guides/assets/use-cases/audiences/aud-01.svg";

function completePng(width = 2800, height = 1800) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function completePngSource(width = 2800, height = 1800) {
  return `const crc32 = (data) => { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };\nconst chunk = (type, data) => { const typeBytes = Buffer.from(type, "ascii"); const length = Buffer.alloc(4); const checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data]))); return Buffer.concat([length, typeBytes, data, checksum]); };\nconst ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(${width}, 0); ihdr.writeUInt32BE(${height}, 4); ihdr.set([8,6,0,0,0], 8); const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.alloc((${width} * 4 + 1) * ${height}))), chunk("IEND", Buffer.alloc(0))]);\n`;
}

function wrapperSource({ lint = "check-svg: 0 error(s), 0 warning(s) across 1 file(s)", lintStatus = 0, png = "complete", recordFile, externalPng } = {}) {
  const render = png === "complete"
    ? `${completePngSource()}await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, png);`
    : png === "wrong-dimensions"
      ? `${completePngSource(1400, 900)}await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, png);`
    : png === "symlink"
      ? `await mkdir(path.dirname(output), { recursive: true }); await symlink(${JSON.stringify(externalPng)}, output);`
    : "await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, Buffer.from([0x89, 0x50]));";
  const record = recordFile ? `await writeFile(${JSON.stringify(recordFile)}, path.dirname(input));` : "";
  return `import { mkdir, symlink, writeFile } from "node:fs/promises";\nimport path from "node:path";\nimport { deflateSync } from "node:zlib";\nconst [command, input, output] = process.argv.slice(2);\nif (command === "lint") { console.log(${JSON.stringify(lint)}); process.exit(${lintStatus}); }\nif (command === "render") { ${record} ${render} }\n`;
}

function decodePng(data) {
  assert.deepEqual(data.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  let offset = 8;
  let ihdr;
  let ended = false;
  const idat = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const payload = data.subarray(offset + 8, offset + 8 + length);
    assert.equal(data.readUInt32BE(offset + 8 + length), crc32(Buffer.concat([Buffer.from(type), payload])));
    offset += 12 + length;
    if (type === "IHDR") ihdr = payload;
    if (type === "IDAT") idat.push(payload);
    if (type === "IEND") ended = offset === data.length;
  }
  assert.ok(ended);
  return { width: ihdr.readUInt32BE(0), height: ihdr.readUInt32BE(4), raw: inflateSync(Buffer.concat(idat)) };
}

function audienceEntry(id, diagram) {
  return {
    id: id.toUpperCase(),
    slug: "test",
    document: "guides/use-cases/audience-paths.md",
    anchor: id,
    level: "foundation",
    recommended_views: [],
    outputs: [],
    diagram: { ...diagram, alt: source.alt },
  };
}

function caseEntry(id, diagram) {
  return {
    id: id.toUpperCase(),
    product: "game-design-studio",
    view: "competency",
    audiences: ["AUD-01"],
    level: ["foundation"],
    skills: [],
    templates: [],
    outputs: [],
    document: "guides/game-design-studio/use-cases/case.md",
    anchor: id,
    diagram: { ...diagram, alt: source.alt },
  };
}

function skillCaseEntry(id, diagram) {
  return {
    id: id.toUpperCase(),
    product: "game-design-studio",
    skill: "skill",
    next_skills: [],
    outputs: [],
    document: "guides/game-design-studio/use-cases/skill.md",
    anchor: id,
    diagram: { ...diagram, alt: source.alt },
  };
}

async function writeFixture(t, { wrapper, existingOutputs = false, fixtureSource = source, manifest } = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(path.join(repoRoot, "guides/assets"), { recursive: true });
  await mkdir(path.join(repoRoot, "guides/use-cases"), { recursive: true });
  await mkdir(path.join(repoRoot, "products/game-design-studio/plugin/skills/visualize-game-design/scripts"), { recursive: true });
  await writeFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), JSON.stringify([fixtureSource]));
  await writeFile(path.join(repoRoot, "guides/use-cases/use-case-manifest.json"), JSON.stringify(manifest ?? {
    version: 1,
    audience_paths: [{
      id: "AUD-01",
      slug: "test",
      document: "guides/use-cases/audience-paths.md",
      anchor: "aud-01",
      level: "foundation",
      recommended_views: [],
      outputs: [],
      diagram: { svg: svgPath, png: pngPath, alt: source.alt },
    }],
    cases: [],
    skill_cases: [],
  }));
  await writeFile(
    path.join(repoRoot, "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs"),
    wrapper ?? wrapperSource(),
  );
  if (existingOutputs) {
    const svg = renderDiagramSvg(fixtureSource);
    const outputDir = path.dirname(path.join(repoRoot, svgPath));
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(repoRoot, svgPath), svg);
    await writeFile(path.join(repoRoot, pngPath), completePng());
  }
  return repoRoot;
}

async function readStudioProductionInputs() {
  const [sources, routing] = await Promise.all([
    readFile(path.join(productionRepoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"),
    readFile(path.join(productionRepoRoot, "products/game-design-studio/plugin/references/routing.json"), "utf8"),
  ]);
  return { sources: JSON.parse(sources), routing: JSON.parse(routing) };
}

async function writeStudioProductionFixture(t, mutate) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "studio-diagram-production-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const inputs = await readStudioProductionInputs();
  mutate(inputs);
  await mkdir(path.join(repoRoot, "guides/assets"), { recursive: true });
  await mkdir(path.join(repoRoot, "products/game-design-studio/plugin/references"), { recursive: true });
  await writeFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), JSON.stringify(inputs.sources));
  await writeFile(path.join(repoRoot, "products/game-design-studio/plugin/references/routing.json"), JSON.stringify(inputs.routing));
  return { repoRoot, ...inputs };
}

const studioSource = (sources, id) => sources.find((candidate) => candidate.id === id);
const studioRoute = (routing, id) => routing.routes.find((candidate) => candidate.id === id);
const exactStudioProductionSourceIds = Object.freeze([
  "st-c01", "st-c02", "st-c03", "st-c04", "st-c05", "st-c06", "st-c07", "st-c08",
  "st-g01", "st-g02", "st-g03", "st-g04", "st-g05", "st-g06", "st-g07", "st-g08", "st-g09", "st-g10",
  "st-s01", "st-s02", "st-s03", "st-s04", "st-s05", "st-s06", "st-s07", "st-s08", "st-s09", "st-s10", "st-s11", "st-s12", "st-s13", "st-s14", "st-s15", "st-s16",
]);

test("cutscene skill diagram names the four waves and selective provider policy", async () => {
  const { sources } = await readStudioProductionInputs();
  const cutscene = studioSource(sources, "st-s16");
  const visible = JSON.stringify(cutscene);
  assert.equal(cutscene.display_contract, "explicit-steps");
  for (const phrase of ["style-master", "reference-masters", "keyframes", "storyboard", "image_gen", "gpt-image-2", "low 기본", "medium 선택", "high 예외", "승인 전에는 provider를 호출하지 않습니다"]) {
    assert.match(visible, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  assert.deepEqual(cutscene.steps.map(({ label }) => label), ["style-master", "reference-masters", "keyframes", "storyboard", "승인·연속성 검토"]);
  assert.deepEqual(cutscene.steps.map(({ detail }) => detail), ["스타일 기준 이미지", "인물·배경·소품 기준", "장면별 핵심 프레임", "최종 장면 흐름", "image_gen 우선·유료 생성 선택"]);
  const svg = renderDiagramSvg(cutscene);
  for (const [index, label] of cutscene.steps.map(({ label }) => label).entries()) {
    assert.match(svg, new RegExp(`aria-label="읽기 순서 ${index + 1}: ${label}"`, "u"));
  }
});

for (const [name, mutate, expected] of [
  ["a missing one of the exact 34 Studio sources", ({ sources }) => sources.splice(sources.findIndex(({ id }) => id === "st-c01"), 1), /Studio production source IDs.*missing.*st-c01/u],
  ["an extra Studio source", ({ sources }) => sources.push({ ...structuredClone(studioSource(sources, "st-c01")), id: "st-c99" }), /Studio production source IDs.*extra.*st-c99/u],
  ["a duplicate Studio source ID", ({ sources }) => sources.push(structuredClone(studioSource(sources, "st-c01"))), /duplicate.*st-c01/u],
  ["a missing canonical route", ({ routing }) => routing.routes.splice(routing.routes.findIndex(({ id }) => id === "vision"), 1), /canonical route IDs.*missing.*vision/u],
  ["an extra canonical route", ({ routing }) => routing.routes.push({ ...structuredClone(studioRoute(routing, "vision")), id: "other-vision" }), /canonical route IDs.*extra.*other-vision/u],
  ["a duplicate canonical route ID", ({ routing }) => routing.routes.push(structuredClone(studioRoute(routing, "vision"))), /duplicate.*canonical route.*vision/u],
  ["a wrong-valid trigger intent replacement", ({ routing }) => { studioRoute(routing, "vision").triggerIntents[0] = "design review"; }, /vision canonical route mismatch: triggerIntents/u],
  ["a missing trigger intent", ({ routing }) => { studioRoute(routing, "vision").triggerIntents.pop(); }, /vision canonical route mismatch: triggerIntents/u],
  ["a replaced canonical target skill", ({ routing }) => { studioRoute(routing, "vision").skill = "design-game-systems"; }, /vision canonical route mismatch: skill|st-s02.*routeIds/u],
  ["changed canonical required inputs", ({ routing }) => { studioRoute(routing, "vision").requiredInputs.pop(); }, /vision canonical route mismatch: requiredInputs/u],
  ["a changed canonical artifact type", ({ routing }) => { studioRoute(routing, "vision").artifactType = "game-design-review"; }, /vision canonical route mismatch: artifactType/u],
]) {
  test(`production builder rejects ${name}`, async (t) => {
    const { repoRoot } = await writeStudioProductionFixture(t, mutate);
    await assert.rejects(() => buildUseCaseDiagrams({ repoRoot, ids: ["st-c01"] }), expected);
  });
}

test("production builder rejects the exact missing 34 Studio sources when only non-Studio sources remain", async (t) => {
  const { repoRoot } = await writeStudioProductionFixture(t, ({ sources }) => {
    assert.deepEqual(
      sources
        .filter(({ scope }) => scope === "game-design-studio-use-case" || scope === "game-design-studio-skill")
        .map(({ id }) => id)
        .sort(),
      exactStudioProductionSourceIds,
    );
    const nonStudioSources = sources.filter(({ scope }) => scope !== "game-design-studio-use-case" && scope !== "game-design-studio-skill");
    sources.splice(0, sources.length, ...nonStudioSources);
  });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    {
      name: "TypeError",
      message: "Studio production source IDs mismatch: missing [st-c01, st-c02, st-c03, st-c04, st-c05, st-c06, st-c07, st-c08, st-g01, st-g02, st-g03, st-g04, st-g05, st-g06, st-g07, st-g08, st-g09, st-g10, st-s01, st-s02, st-s03, st-s04, st-s05, st-s06, st-s07, st-s08, st-s09, st-s10, st-s11, st-s12, st-s13, st-s14, st-s15, st-s16], extra []",
    },
  );
});

test("check mode rejects a committed Studio skill SVG with glyph-scaling attributes", async (t) => {
  const skillSource = {
    ...source,
    id: "st-s02",
    scope: "game-design-studio-skill",
    type: "skill-flow",
    steps: ["trigger", "필수 입력", "skill-owned work", "output", "next route"].map((stage, index) => ({
      stage,
      label: `단계 ${index + 1}`,
      detail: `근거 ${index + 1}`,
    })),
    semantic: {
      skill: "define-game-vision",
      required_input: "player promise + design constraints",
      outputs: ["vision-pillars", "core-motivation-loop"],
      next_routes: ["design-game-systems"],
    },
  };
  const repoRoot = await writeFixture(t, {
    fixtureSource: skillSource,
    existingOutputs: true,
    manifest: {
      version: 1,
      audience_paths: [],
      cases: [],
      skill_cases: [skillCaseEntry("st-s02", { svg: svgPath, png: pngPath, alt: skillSource.alt })],
    },
  });
  const committedSvg = path.join(repoRoot, svgPath);
  await writeFile(committedSvg, (await readFile(committedSvg, "utf8")).replace("<text", '<text textLength="164" lengthAdjust="spacingAndGlyphs"'));

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: [skillSource.id], check: true }),
    /st-s02.*textLength.*repair source layout\/wrapping/u,
  );
});

test("production builder rejects an S routeId whose canonical target differs from the loaded source skill", async (t) => {
  const { repoRoot } = await writeStudioProductionFixture(t, ({ sources }) => {
    studioSource(sources, "st-s02").semantic.skill = "design-game-systems";
  });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["st-s02"] }),
    {
      name: "TypeError",
      message: "st-s02 routeIds mismatch: vision targets define-game-vision, not design-game-systems",
    },
  );
});

test("production builder rejects a loaded boundary nextRoutes target absent from installed skillIds", async (t) => {
  const { repoRoot } = await writeStudioProductionFixture(t, ({ sources }) => {
    studioSource(sources, "st-s14").semantic.next_routes = ["svg-infographic"];
  });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["st-s14"] }),
    {
      name: "TypeError",
      message: "st-s14 nextRoutes target svg-infographic is absent from installed skillIds",
    },
  );
});

test("production batch rejects an S routeId whose canonical target differs from the source skill", async () => {
  const { sources, routing } = await readStudioProductionInputs();
  studioSource(sources, "st-s02").semantic.skill = "design-game-systems";
  assert.throws(
    () => studioProductionContract.validateStudioDiagramProductionBatch(sources, routing),
    /st-s02.*routeIds.*vision.*define-game-vision/u,
  );
});

test("production batch rejects a boundary nextRoutes target absent from installed skillIds", async () => {
  const { sources, routing } = await readStudioProductionInputs();
  studioSource(sources, "st-s14").semantic.next_routes = ["svg-infographic"];
  assert.throws(
    () => studioProductionContract.validateStudioDiagramProductionBatch(sources, routing),
    /st-s14.*nextRoutes.*svg-infographic.*installed skillIds/u,
  );
});

test("production batch accepts the published content combat and puzzle routing intents", async () => {
  const { sources, routing } = await readStudioProductionInputs();
  assert.deepStrictEqual(studioRoute(routing, "content").triggerIntents, [
    "quest",
    "level content",
    "narrative",
    "character",
    "enemy",
    "combat",
    "boss",
    "encounter",
    "puzzle",
    "level design",
    "soft lock",
    "secret route",
    "reset",
    "retry",
  ]);
  assert.doesNotThrow(() => studioProductionContract.validateStudioDiagramProductionBatch(sources, routing));
});

test("builder propagates zero-exit Skillstead warnings from its fixed wrapper", async (t) => {
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ lint: "check-svg: 0 error(s), 1 warning(s) across 1 file(s)" }) });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /zero errors and warnings/u,
  );
});

test("builder propagates a nonzero fixed-wrapper lint failure", async (t) => {
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ lint: "check-svg: 1 error(s)", lintStatus: 7 }) });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /Skillstead lint failed/u,
  );
});

test("builder fails closed when the wrapper emits a corrupt PNG", async (t) => {
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ png: "corrupt" }) });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /incomplete PNG/u,
  );
});

test("builder fails closed when the wrapper emits a complete PNG with wrong dimensions", async (t) => {
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ png: "wrong-dimensions" }) });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /PNG must be 2800x1800/u,
  );
  const decoded = decodePng(await readFile(path.join(repoRoot, pngPath)));
  assert.deepEqual({ width: decoded.width, height: decoded.height, rawLength: decoded.raw.length }, { width: 1400, height: 900, rawLength: (1400 * 4 + 1) * 900 });
});

test("builder accepts a decodeable 2800 by 1800 PNG from the same wrapper generator", async (t) => {
  const repoRoot = await writeFixture(t);

  assert.deepEqual(await buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }), { svg: 1, png: 1 });
  const decoded = decodePng(await readFile(path.join(repoRoot, pngPath)));
  assert.deepEqual({ width: decoded.width, height: decoded.height, rawLength: decoded.raw.length }, { width: 2800, height: 1800, rawLength: (2800 * 4 + 1) * 1800 });
});

test("builder resolves exactly one explicit output from every manifest lane", async (t) => {
  const lanes = [
    ["audience_paths", "aud-11", audienceEntry],
    ["cases", "st-c11", caseEntry],
    ["skill_cases", "st-s11", skillCaseEntry],
  ];

  for (const [lane, id, entryFactory] of lanes) {
    const diagram = {
      svg: `guides/assets/test/${lane}/${id}.svg`,
      png: `guides/assets/test/${lane}/${id}.png`,
    };
    const fixtureSource = { ...source, id };
    const repoRoot = await writeFixture(t, {
      fixtureSource,
      manifest: {
        version: 1,
        audience_paths: lane === "audience_paths" ? [entryFactory(id, diagram)] : [],
        cases: lane === "cases" ? [entryFactory(id, diagram)] : [],
        skill_cases: lane === "skill_cases" ? [entryFactory(id, diagram)] : [],
      },
    });

    assert.deepEqual(await buildUseCaseDiagrams({ repoRoot, ids: [id] }), { svg: 1, png: 1 }, lane);
    assert.equal(await readFile(path.join(repoRoot, diagram.svg), "utf8"), renderDiagramSvg(fixtureSource), `${lane} SVG output`);
    assert.ok((await lstat(path.join(repoRoot, diagram.png))).isFile(), `${lane} PNG output`);
  }
});

test("builder fails closed when source output has zero or duplicate manifest matches", async (t) => {
  const diagram = { svg: svgPath, png: pngPath };
  const duplicateRoot = await writeFixture(t, {
    manifest: {
      version: 1,
      audience_paths: [audienceEntry("aud-01", diagram)],
      cases: [caseEntry("aud-01", diagram)],
      skill_cases: [],
    },
  });
  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot: duplicateRoot, ids: ["aud-01"] }),
    /expected exactly one explicit manifest output.*found 2/u,
  );

  const zeroRoot = await writeFixture(t, {
    manifest: { version: 1, audience_paths: [], cases: [], skill_cases: [] },
  });
  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot: zeroRoot, ids: ["aud-01"] }),
    /expected exactly one explicit manifest output.*found 0/u,
  );
});

test("builder rejects a PNG output replaced with a symlink after rendering", async (t) => {
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-rendered-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  const externalPng = path.join(externalRoot, "valid.png");
  await writeFile(externalPng, completePng());
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ png: "symlink", externalPng }) });

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /symlink|outside/u,
  );
});

test("check mode preserves repository assets and removes its OS temporary render directory", async (t) => {
  const recordFile = path.join(await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-record-")), "temp-directory.txt");
  t.after(() => rm(path.dirname(recordFile), { recursive: true, force: true }));
  const repoRoot = await writeFixture(t, { wrapper: wrapperSource({ recordFile }), existingOutputs: true });
  const before = await Promise.all([readFile(path.join(repoRoot, svgPath)), readFile(path.join(repoRoot, pngPath))]);

  const result = await buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"], check: true });
  const after = await Promise.all([readFile(path.join(repoRoot, svgPath)), readFile(path.join(repoRoot, pngPath))]);
  const temporaryDirectory = await readFile(recordFile, "utf8");

  assert.deepEqual(result, { svg: 1, png: 1 });
  assert.deepEqual(after, before);
  await assert.rejects(() => lstat(temporaryDirectory), /ENOENT/u);
});

test("check mode rejects a complete same-size PNG whose bytes differ from the deterministic renderer", async (t) => {
  const repoRoot = await writeFixture(t, { existingOutputs: true });
  const filename = path.join(repoRoot, pngPath);
  const original = await readFile(filename);
  const changed = Buffer.from(original);
  const idat = changed.indexOf(Buffer.from("IDAT", "ascii"));
  assert.ok(idat > 0, "fixture PNG has IDAT data");
  changed[idat + 4] ^= 0x01;
  await writeFile(filename, changed);

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"], check: true }),
    /generated PNG differs/u,
  );
});

test("builder rejects a repository output parent symlinked to an OS temporary directory", async (t) => {
  const repoRoot = await writeFixture(t);
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  const linkedParent = path.join(repoRoot, "guides/assets/use-cases/audiences");
  await mkdir(path.dirname(linkedParent), { recursive: true });
  await writeFile(path.join(externalRoot, "aud-01.svg"), "outside bytes");
  await symlink(externalRoot, linkedParent);

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
    /symlink|unsafe|outside/u,
  );
  assert.equal(await readFile(path.join(externalRoot, "aud-01.svg"), "utf8"), "outside bytes");
});

test("builder preserves non-ENOENT output-path errors instead of treating them as missing", async (t) => {
  const repoRoot = await writeFixture(t);
  const protectedParent = path.join(repoRoot, "guides/assets/use-cases");
  await mkdir(protectedParent, { recursive: true });
  await chmod(protectedParent, 0o000);
  try {
    await assert.rejects(
      () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"] }),
      (error) => error?.code === "EACCES" || error?.code === "EPERM",
    );
  } finally {
    await chmod(protectedParent, 0o700);
  }
});

test("builder rethrows the exact injected optional-lstat error", async (t) => {
  const repoRoot = await writeFixture(t);
  const sentinel = new Error("optional lstat sentinel");

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot, ids: ["aud-01"], __testLstat: async () => { throw sentinel; } }),
    (error) => error === sentinel,
  );
});
