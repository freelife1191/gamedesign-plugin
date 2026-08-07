import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { collectProductInventory } from "../../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const readmePath = path.join(pluginRoot, "README.md");

const skillIds = [
  "orchestrate-game-design-career",
  "apply-document-quality-profile",
  "map-game-design-career",
  "research-game-design-jobs",
  "build-game-design-portfolio",
  "reverse-engineer-game-design",
  "practice-game-design-interview",
  "review-game-design-portfolio",
  "plan-junior-growth",
  "visualize-career-roadmap",
  "export-career-documents",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
];

const roleIds = [
  "career-strategist",
  "document-quality-editor",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
];

const imageRoleIds = ["art-brief-director", "visual-asset-reviewer"];

const templateIds = [
  "career-stage-goal",
  "game-design-role-map",
  "competency-matrix",
  "job-posting-evidence",
  "portfolio-project-brief",
  "reverse-design-document",
  "five-axis-review",
  "interview-question-answer-log",
  "junior-growth-review",
  "transition-readiness",
  "learning-roadmap",
  "portfolio-backlog",
  "creative-design-portfolio",
  "introduction-motivation",
  "game-analysis-report",
];

const qualityProfileIds = [
  "career-stage-role-map",
  "competency-matrix",
  "learning-roadmap",
  "job-posting-evidence",
  "reverse-design-document",
  "game-analysis-report",
  "portfolio-project-brief",
  "portfolio-case-study",
  "portfolio-review-backlog",
  "interview-question-answer-report",
  "junior-growth-review",
  "transition-readiness",
  "recruiter-portfolio-presentation",
];

const topLevelScriptIds = [
  "build-image-asset-plan.mjs",
  "capability-probe.mjs",
  "compile-image-prompts.mjs",
  "data-only-snapshot.mjs",
  "generate-openai-images.mjs",
  "quality-source-anchors.mjs",
  "resolve-quality-profile.mjs",
  "run-image-asset-workflow.mjs",
  "stop-artifact-review.mjs",
  "validate-artifact.mjs",
  "validate-image-assets.mjs",
  "validate-image-config.mjs",
  "validate-quality-profile.mjs",
  "validate-reference-preset.mjs",
];

const documentQualityPaths = [
  "indexes/career.json",
  "indexes/studio.json",
  "profiles/career/",
  "profiles/studio/",
  "overlays/",
  "presets/",
  "render-contracts/long-form-document.json",
  "render-contracts/presentation.json",
  "render-contracts/review-report.json",
  "schema/quality-profile-selection.schema.json",
  "schema/quality-profile.schema.json",
  "schema/reference-preset.schema.json",
];

function tableIds(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const section = markdown.slice(start + heading.length + 3).split("\n## ")[0];
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await visit(root);
  return files.sort();
}

test("release documentation ships the plugin license and third-party notices", async () => {
  await Promise.all([
    access(readmePath),
    access(path.join(pluginRoot, "LICENSE")),
    access(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md")),
  ]);

  const [license, notices] = await Promise.all([
    readFile(path.join(pluginRoot, "LICENSE"), "utf8"),
    readFile(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ]);
  assert.match(license, /MIT License/);
  assert.match(notices, /Skillstead svg-infographic/);
  assert.match(notices, /0\.8\.3/);
  assert.match(notices, /Apache-2\.0/);
  assert.match(notices, /Copyright 2026 Kyungseo Park/);
  assert.match(notices, /49/);
  assert.match(notices, /docs\//);
});

test("README exposes every shipped skill, role asset, stage, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "이미지 전문 역할 레지스트리"), imageRoleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);
  for (const stage of ["entry", "new-hire", "junior-growth", "transition"]) {
    assert.ok(readme.includes(`| \`${stage}\` |`), `missing career stage: ${stage}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "작동 방식",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "권리, 개인정보와 공정성",
    "제한 사항",
    "문제 해결",
    "검증",
    "라이선스",
  ];
  for (const heading of requiredHeadings) {
    assert.match(readme, new RegExp(`^## ${heading}$`, "m"));
  }

  for (const command of [
    "codex plugin marketplace add <path-to-repository-root>",
    "codex plugin add game-design-career@game-design-suite",
    "codex plugin remove game-design-career@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "1차 출처",
    "검색일",
    "표본",
    "지역",
    "일반화",
    "조작하지",
    "합격을 보장하지",
    "독립적인 스토리",
    "fail-closed",
    "SVG lint",
    "2× PNG",
    "네이티브 자동 발견을 보장하지",
    "IMAGE_GEN_MODE",
    "prompt-only",
    "production-candidate는 release/legal/production approval이 아님",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "진로 미결정 입문자",
    "목표 채용 공고 근거 매트릭스",
    "역기획 포트폴리오",
    "5축 포트폴리오 리뷰",
    "면접 연습",
    "주니어 성장 계획",
    "시각적 로드맵",
    "문서 내보내기",
  ]) {
    assert.match(readme, new RegExp(`^### ${example}$`, "m"));
  }
});

test("README documents the isolated image workflow contract", async () => {
  const readme = await readFile(readmePath, "utf8");
  for (const contract of [
    "root `.env.example`",
    "tracked `.env`",
    "IMAGE_MODEL=gpt-image-2",
    "IMAGE_QUALITY=low",
    "OpenAI only",
    "Codex/host",
    "immutable receipt",
    "assets/prompts/image-prompts.md",
    "assets/prompts/image-prompts.json",
    "concept-draft → document-approved → production-candidate",
    "Skillstead SVG",
    "smoke:image:live",
  ]) assert.ok(readme.includes(contract), `missing image operating contract: ${contract}`);
});

test("README documents the closed Career document-quality workflow and installed contracts", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /^## Document Quality Profiles$/m);
  assert.deepEqual(tableIds(readme, "Document Quality Profiles"), qualityProfileIds);
  for (const contract of [
    "정확히 하나의 primary profile",
    "명시적 override",
    "nearest profile",
    "fallback",
    "mobile`, `pc-console`, `live-service",
    "competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling",
    "caller-authored production map",
    "stable section/table/Skillstead diagram/image/acceptance checklist ID",
    "draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved",
    "receipt",
    "generated image와 render는 자동 승인",
    "공식 studio endorsement",
    "references/document-quality/template-profile-map.json",
    "references/shared/document-quality/schema/quality-profile.schema.json",
    "references/shared/document-quality/render-contracts/",
  ]) {
    assert.ok(readme.includes(contract), `missing document-quality contract: ${contract}`);
  }
  assert.match(readme, /apply-document-quality-profile.*portfolio-case-study.*pc-console.*function-first/su);
});

test("README inventories the exact packaged runtime scripts and shared quality subtrees", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "설치된 top-level scripts"), topLevelScriptIds);
  assert.deepEqual(tableIds(readme, "설치된 document-quality 경로"), documentQualityPaths);

  const sourceScripts = (await readdir(path.join(repoRoot, "shared/scripts"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(sourceScripts, [...topLevelScriptIds].sort());

  const stage = await mkdtemp(path.join(os.tmpdir(), "career-readme-inventory-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot: stage, sourceDateEpoch: 0 });
    const builtScripts = (await readdir(path.join(build.outputDir, "scripts"), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
      .map(({ name }) => name)
      .sort();
    assert.deepEqual(builtScripts, [...topLevelScriptIds].sort());
    for (const relativePath of documentQualityPaths) {
      await access(path.join(repoRoot, "shared/document-quality", relativePath));
      await access(path.join(build.outputDir, "references/shared/document-quality", relativePath));
    }
    const sourceQualityRoot = path.join(repoRoot, "shared/document-quality");
    const builtQualityRoot = path.join(build.outputDir, "references/shared/document-quality");
    assert.deepEqual(
      (await walkFiles(sourceQualityRoot)).map((file) => path.relative(sourceQualityRoot, file)),
      (await walkFiles(builtQualityRoot)).map((file) => path.relative(builtQualityRoot, file)),
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
});

test("README local links resolve inside the source plugin or repository", async () => {
  const readme = await readFile(readmePath, "utf8");
  const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) {
    assert.ok(!path.isAbsolute(target), `local link must be relative: ${target}`);
    await access(path.resolve(pluginRoot, target));
  }
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /^## 플러그인 구조$/m);

  for (const pathOrCount of [
    "products/game-design-career/plugin",
    "plugins/game-design-career",
    ".codex-plugin/plugin.json",
    "skills/ (15개)",
    "skills/svg-infographic/",
    "agents/ (9개)",
    "hooks/hooks.json",
    "scripts/",
    "references/shared/knowledge/core/",
    "references/shared/knowledge/trends/",
    "references/source/docs/ (49개)",
    "references/shared/export/schema/",
    "assets/templates/ (15개)",
    "assets/product-mark.svg",
  ]) {
    assert.ok(readme.includes(pathOrCount), `missing packaged structure: ${pathOrCount}`);
  }

  for (const contract of [
    "source overlay",
    "generated independent snapshot",
    "suite build",
    "SessionStart",
    "capability-probe",
    "Stop",
    "one-retry",
    "artifact review",
    "shared runtime",
    "product helper",
    "생성 결과를 직접 편집하지",
  ]) {
    assert.ok(readme.includes(contract), `missing structure boundary: ${contract}`);
  }
});

test("README keeps Career export preparation non-terminal and delegates trusted terminal verification", async () => {
  const readme = await readFile(readmePath, "utf8");
  const exportSection = readme.split("## MD, PDF, DOCX, PPTX 내보내기\n")[1]
    ?.split("\n## ")[0] ?? "";

  for (const contract of [
    "preflight 전용",
    "`not-requested`, `blocked`, `pending`, `unavailable`",
    "`passed` 또는 `failed`를 수용하거나 생성하지",
    "generation·QA·derivative terminal evidence",
    "trusted bundled renderer",
    "artifact digest",
    "MD/PDF/DOCX/PPTX/SVG/PNG",
    "suite Task 11",
  ]) {
    assert.ok(readme.includes(contract), `missing export trust boundary: ${contract}`);
  }

  assert.doesNotMatch(exportSection, /각 형식은 capability probe, 생성, 파일 존재, 형식별 QA가 모두 통과해야 `passed`/u);
  assert.doesNotMatch(readme, /형식별 capability·생성·QA 증거가 있는 작업 manifest/u);
});

test("README distinguishes the low-level product build from the current suite snapshot and stays machine-portable", async () => {
  const stage = await mkdtemp(path.join(os.tmpdir(), "career-readme-build-"));
  try {
    const result = await buildProduct({
      repoRoot,
      productName: "game-design-career",
      stagingRoot: stage,
      sourceDateEpoch: 0,
    });
    const sourceReadme = await readFile(readmePath, "utf8");
    const builtReadme = await readFile(path.join(result.outputDir, "README.md"), "utf8");

    assert.equal(result.files.includes("BUILD-MANIFEST.json"), false);
    assert.match(sourceReadme, /저수준 `buildProduct\(\)` 출력에는 `BUILD-MANIFEST\.json`이 없습니다/u);
    assert.match(sourceReadme, /이 suite distribution snapshot에는 `BUILD-MANIFEST\.json`이 있으며/u);
    assert.doesNotMatch(sourceReadme, /└── BUILD-MANIFEST\.json\s+# suite build가 만드는 파일 목록·해시/u);

    for (const [label, root, readme] of [
      ["source", pluginRoot, sourceReadme],
      ["built", result.outputDir, builtReadme],
    ]) {
      assert.doesNotMatch(readme, /\/Users\/|\/home\/|[A-Za-z]:\\/u, `${label} README contains a machine absolute path`);
      assert.match(readme, /\$\{CODEX_HOME:-\$HOME\/\.codex\}/u);
      const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
      for (const target of links) {
        assert.equal(path.isAbsolute(target), false, `${label} README link must be relative: ${target}`);
        const resolved = path.resolve(root, target);
        assert.ok(resolved === root || resolved.startsWith(`${root}${path.sep}`), `${label} README link escapes package: ${target}`);
        await access(resolved);
      }
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
});

test("README validation commands honor a CODEX_HOME override containing spaces", async () => {
  const readme = await readFile(readmePath, "utf8");
  const blocks = [...readme.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
  const skillCommand = blocks.find((block) => block.includes("CODEX_SKILL_CREATOR_ROOT"));
  const pluginCommand = blocks.find((block) => block.includes("CODEX_PLUGIN_CREATOR_ROOT"));
  assert.ok(skillCommand, "missing portable skill validation command");
  assert.ok(pluginCommand, "missing portable plugin validation command");

  const scratch = await mkdtemp(path.join(os.tmpdir(), "career readme commands-"));
  const codexHome = path.join(scratch, "Codex Home With Spaces");
  try {
    const skillScript = path.join(codexHome, "skills/.system/skill-creator/scripts/quick_validate.py");
    const pluginScript = path.join(codexHome, "skills/.system/plugin-creator/scripts/validate_plugin.py");
    await mkdir(path.dirname(skillScript), { recursive: true });
    await mkdir(path.dirname(pluginScript), { recursive: true });
    await writeFile(skillScript, "import sys\nprint('override-skill:' + sys.argv[1])\n", "utf8");
    await writeFile(pluginScript, "import sys\nprint('override-plugin:' + sys.argv[1])\n", "utf8");

    const environment = { ...process.env, CODEX_HOME: codexHome };
    const skillRun = spawnSync("/bin/bash", ["-c", skillCommand], { cwd: repoRoot, env: environment, encoding: "utf8" });
    assert.equal(skillRun.status, 0, skillRun.stderr);
    assert.equal((skillRun.stdout.match(/^override-skill:/gm) ?? []).length, 14);

    const pluginRun = spawnSync("/bin/bash", ["-c", pluginCommand], { cwd: repoRoot, env: environment, encoding: "utf8" });
    assert.equal(pluginRun.status, 0, pluginRun.stderr);
    assert.match(pluginRun.stdout, /^override-plugin:products\/game-design-career\/plugin$/m);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("README routes Career entry users to canonical skills and inspectable results without package-escaping links", async () => {
  const [readme, routingSource, manifestSource, inventory] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(path.join(pluginRoot, "references/routing.json"), "utf8"),
    readFile(path.join(repoRoot, "guides/use-cases/use-case-manifest.json"), "utf8"),
    collectProductInventory(repoRoot, "game-design-career"),
  ]);
  const routing = JSON.parse(routingSource);
  const manifest = JSON.parse(manifestSource);
  const careerCases = manifest.cases.filter(({ product }) => product === "game-design-career");
  const skillCases = manifest.skill_cases.filter(({ product }) => product === "game-design-career");

  assert.match(readme, /^## 활용 시작점$/mu);
  for (const audience of ["취업 준비", "주니어", "전환", "멘토"]) assert.ok(readme.includes(audience), `target audience: ${audience}`);
  assert.match(readme, /여러 Career 단계와 산출물이 함께.*orchestrate-game-design-career/su, "orchestrator scope");
  assert.match(readme, /한 산출물.*직접.*스킬/su, "direct-skill scope");
  for (const summary of [
    `${careerCases.length}개 사례`,
    `${inventory.skillIds.length}개 직접 스킬`,
    `${routing.faqContracts.length}개 FAQ`,
    `${careerCases.length + skillCases.length}개 도식`,
  ]) assert.ok(readme.includes(summary), `catalog relationship: ${summary}`);

  for (const caseId of ["CA-T01", "CA-T04", "CA-T05", "CA-C05", "CA-C06", "CA-C08"]) {
    const entry = careerCases.find(({ id }) => id === caseId);
    assert.ok(entry, `representative Career case: ${caseId}`);
    const row = readme.split("\n").find((line) => line.includes(`\`${entry.id}\``));
    assert.ok(row, `README case row: ${entry.id}`);
    assert.ok(row.includes(`$game-design-career:${entry.skills[0]}`), `${entry.id}: canonical skill`);
    assert.ok(row.includes(`\`${entry.outputs[0]}\``), `${entry.id}: canonical result`);
    assert.ok(row.includes(`game-design-career/<career-id>/${entry.outputs[0]}/`), `${entry.id}: canonical result path`);
    const commands = [...row.matchAll(/\$game-design-career:([a-z0-9-]+)/gu)].map((match) => match[1]);
    assert.ok(commands.every((skillId) => entry.skills.includes(skillId)), `${entry.id}: no unknown direct skill`);
  }
  assert.match(readme, /content\.md\s*→\s*evidence\.yml\s*→\s*decisions\//u, "result read order");
  assert.doesNotMatch(readme, /합격(?:을)?\s*(?:보장|확정)(?:합니다|됩니다|될 수)|채용(?:을)?\s*(?:보장|확정)(?:합니다|됩니다|될 수)/u, "no hiring guarantee");

  const localLinks = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
  for (const target of localLinks) {
    assert.equal(path.isAbsolute(target), false, `README link must be package-relative: ${target}`);
    const resolved = path.resolve(pluginRoot, target);
    assert.ok(resolved === pluginRoot || resolved.startsWith(`${pluginRoot}${path.sep}`), `README link escapes package: ${target}`);
    await access(resolved);
  }
});
