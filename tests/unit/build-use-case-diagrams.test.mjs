import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildUseCaseDiagrams } from "../../tooling/build-use-case-diagrams.mjs";
import { renderDiagramSvg } from "../../tooling/lib/use-case-diagrams.mjs";

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
  const png = Buffer.alloc(45);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.set([8, 2, 0, 0, 0], 24);
  png.write("IEND", 37);
  return png;
}

function completePngSource(width = 2800, height = 1800) {
  return `const png = Buffer.alloc(45);\npng.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);\npng.writeUInt32BE(13, 8); png.write("IHDR", 12); png.writeUInt32BE(${width}, 16); png.writeUInt32BE(${height}, 20); png.set([8,2,0,0,0], 24); png.write("IEND", 37);\n`;
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
  return `import { mkdir, symlink, writeFile } from "node:fs/promises";\nimport path from "node:path";\nconst [command, input, output] = process.argv.slice(2);\nif (command === "lint") { console.log(${JSON.stringify(lint)}); process.exit(${lintStatus}); }\nif (command === "render") { ${record} ${render} }\n`;
}

async function writeFixture(t, { wrapper, existingOutputs = false } = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(path.join(repoRoot, "guides/assets"), { recursive: true });
  await mkdir(path.join(repoRoot, "guides/use-cases"), { recursive: true });
  await mkdir(path.join(repoRoot, "products/game-design-studio/plugin/skills/visualize-game-design/scripts"), { recursive: true });
  await writeFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), JSON.stringify([source]));
  await writeFile(path.join(repoRoot, "guides/use-cases/use-case-manifest.json"), JSON.stringify({
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
    const svg = renderDiagramSvg(source);
    const outputDir = path.dirname(path.join(repoRoot, svgPath));
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(repoRoot, svgPath), svg);
    await writeFile(path.join(repoRoot, pngPath), completePng());
  }
  return repoRoot;
}

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
