import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const readmePath = path.join(pluginRoot, "README.md");
const temporaryDirectories = [];

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const skillIds = [
  "orchestrate-game-design-project",
  "apply-document-quality-profile",
  "define-game-vision",
  "design-game-systems",
  "design-game-content",
  "design-player-experience",
  "design-game-economy-and-liveops",
  "plan-game-production",
  "review-game-design",
  "visualize-game-design",
  "export-game-design-documents",
];

const roleIds = [
  "lead-game-designer",
  "document-quality-editor",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
];

const templateIds = [
  "game-design-brief",
  "vision-pillars",
  "core-motivation-loop",
  "system-specification",
  "rule-exception-matrix",
  "ui-ux-flow-state",
  "data-schema-table-contract",
  "narrative-quest-npc",
  "character-skill-combat-monster",
  "economy-balance",
  "liveops-experiment-event",
  "accessibility-platform-matrix",
  "production-scope-risk",
  "game-design-review",
  "decision-change-log",
];

const qualityProfileIds = [
  "vision-one-pager",
  "game-design-brief",
  "master-gdd",
  "core-motivation-loop",
  "system-feature-specification",
  "rule-state-exception-matrix",
  "data-table-contract",
  "narrative-quest-npc-specification",
  "character-skill-combat-monster-specification",
  "ui-ux-flow-state-specification",
  "economy-balance-specification",
  "liveops-event-experiment-plan",
  "accessibility-platform-matrix",
  "production-scope-milestone-risk-plan",
  "playtest-metrics-report",
  "design-review-decision-log",
  "executive-pitch",
];

const topLevelScriptIds = [
  "capability-probe.mjs",
  "data-only-snapshot.mjs",
  "quality-source-anchors.mjs",
  "resolve-quality-profile.mjs",
  "stop-artifact-review.mjs",
  "validate-artifact.mjs",
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

function localMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].split("#", 1)[0])
    .filter((target) => target && !/^[a-z][a-z0-9+.-]*:/iu.test(target) && !target.startsWith("#"));
}

async function assertContainedLink(root, markdownFile, target) {
  assert.ok(!path.isAbsolute(target), `local link must be relative: ${target}`);
  const rootReal = await realpath(root);
  const rootLexical = path.resolve(root);
  const markdownRelative = path.relative(rootLexical, path.resolve(markdownFile));
  assert.ok(markdownRelative && !markdownRelative.startsWith("..") && !path.isAbsolute(markdownRelative), `Markdown source escapes plugin root: ${markdownFile}`);
  const resolved = path.resolve(rootReal, path.dirname(markdownRelative), target);
  const relative = path.relative(rootReal, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `local link escapes plugin root: ${target}`);
  let cursor = rootReal;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    assert.equal(stat.isSymbolicLink(), false, `local link traverses symlink: ${target}`);
  }
  const targetReal = await realpath(resolved);
  const canonicalRelative = path.relative(rootReal, targetReal);
  assert.ok(canonicalRelative && !canonicalRelative.startsWith("..") && !path.isAbsolute(canonicalRelative), `real link target escapes plugin root: ${target}`);
}

async function assertAllMarkdownLinksContained(root) {
  const markdownFiles = (await walkFiles(root)).filter((file) => file.endsWith(".md"));
  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, "utf8");
    for (const target of localMarkdownLinks(markdown)) await assertContainedLink(root, markdownFile, target);
  }
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

test("README exposes every shipped skill, role asset, profile, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);

  const [actualSkills, actualRoles, actualTemplates, actualProfiles] = await Promise.all([
    readdir(path.join(pluginRoot, "skills"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "agents"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "assets/templates"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "references/profiles"), { withFileTypes: true }),
  ]);
  assert.deepEqual(
    actualSkills.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...skillIds].sort(),
  );
  assert.deepEqual(
    actualRoles.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map(({ name }) => name.slice(0, -3)).sort(),
    [...roleIds].sort(),
  );
  assert.deepEqual(
    actualTemplates.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...templateIds].sort(),
  );
  assert.deepEqual(
    actualProfiles.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map(({ name }) => name.slice(0, -5)).sort(),
    ["live-service-rpg", "mobile", "pc-console", "universal-core"],
  );
  for (const profile of ["universal-core", "live-service-rpg", "mobile", "pc-console"]) {
    assert.ok(readme.includes(`| \`${profile}\` |`), `missing profile: ${profile}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "플러그인 구조",
    "작동 방식",
    "프로필 합성",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "책임 있는 설계 게이트",
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
    "codex plugin add game-design-studio@game-design-suite",
    "codex plugin remove game-design-studio@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "universal-core",
    "conflict decision record",
    "1차 출처",
    "검색일",
    "조작하지",
    "hard No-Go",
    "fail-closed",
    "SVG lint",
    "정확한 2× PNG",
    "네이티브 자동 발견을 보장하지",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "새 GDD",
    "시스템 명세",
    "경제와 LiveOps 리뷰",
    "AI NPC 안전 검토",
    "게임 기획 도식화",
    "문서 내보내기",
  ]) {
    assert.match(readme, new RegExp(`^### ${example}$`, "m"));
  }
});

test("README documents the closed Studio document-quality workflow and installed contracts", async () => {
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
  assert.match(readme, /apply-document-quality-profile.*game-design-brief.*mobile.*function-first/su);
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

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-readme-inventory-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
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
});

test("root README describes both packaged quality-profile catalogs without source attribution claims", async () => {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.deepEqual(tableIds(readme, "설치된 top-level scripts"), topLevelScriptIds);
  assert.deepEqual(tableIds(readme, "설치된 document-quality 경로"), documentQualityPaths);
  for (const contract of [
    "Studio 17개",
    "Career 13개",
    "additive overlay 3개",
    "neutral reference preset 7개",
    "authoring-only source",
    "공식 endorsement",
    "plugins/game-design-studio/references/shared/document-quality/",
    "plugins/game-design-career/references/shared/document-quality/",
  ]) {
    assert.ok(readme.includes(contract), `missing root quality-profile contract: ${contract}`);
  }
});

test("README local links resolve inside the source plugin root", async () => {
  const links = localMarkdownLinks(await readFile(readmePath, "utf8"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) await assertContainedLink(pluginRoot, readmePath, target);
});

test("source and clean-built Markdown links stay inside their own plugin roots", async () => {
  await assertAllMarkdownLinksContained(pluginRoot);
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-readme-links-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  await assertAllMarkdownLinksContained(build.outputDir);
});

test("link containment rejects parent traversal and symlink escapes", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "studio-link-containment-"));
  temporaryDirectories.push(fixtureRoot);
  const docsRoot = path.join(fixtureRoot, "plugin");
  const outsideRoot = path.join(fixtureRoot, "outside");
  await Promise.all([mkdir(docsRoot, { recursive: true }), mkdir(outsideRoot, { recursive: true })]);
  const markdownFile = path.join(docsRoot, "README.md");
  await assert.rejects(assertContainedLink(docsRoot, markdownFile, "../../../../etc/hosts"), /escapes plugin root/);
  await symlink(outsideRoot, path.join(docsRoot, "escape"));
  await assert.rejects(assertContainedLink(docsRoot, markdownFile, "escape/secret.md"), /traverses symlink/);
});

test("release-bound source and built text contain no user or workspace absolute paths", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-portable-text-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const textExtensions = new Set(["", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);
  const forbidden = /(?:\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/u;
  for (const root of [pluginRoot, build.outputDir]) {
    for (const file of await walkFiles(root)) {
      if (!textExtensions.has(path.extname(file))) continue;
      assert.doesNotMatch(await readFile(file, "utf8"), forbidden, `machine-specific path in ${path.relative(root, file)}`);
    }
  }
});

test("portable CODEX_HOME shell expansion preserves spaces and honors an override", async () => {
  const command = 'CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"; printf "%s" "$CODEX_ROOT"';
  const fallback = spawnSync("/bin/sh", ["-c", command], {
    encoding: "utf8",
    env: { HOME: "/tmp/home with spaces", PATH: process.env.PATH },
  });
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.equal(fallback.stdout, "/tmp/home with spaces/.codex");
  const overridden = spawnSync("/bin/sh", ["-c", command], {
    encoding: "utf8",
    env: { HOME: "/tmp/ignored home", CODEX_HOME: "/tmp/custom codex", PATH: process.env.PATH },
  });
  assert.equal(overridden.status, 0, overridden.stderr);
  assert.equal(overridden.stdout, "/tmp/custom codex");

  const readme = await readFile(readmePath, "utf8");
  assert.ok(readme.includes('CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"'));
  assert.ok(readme.includes('python3 "$CODEX_ROOT/skills/.system/skill-creator/scripts/quick_validate.py"'));
  assert.ok(readme.includes('python3 "$CODEX_ROOT/skills/.system/plugin-creator/scripts/validate_plugin.py"'));
  const validationBlocks = [...readme.matchAll(/```bash\n([\s\S]*?)```/gu)]
    .map((match) => match[1])
    .filter((block) => block.includes("CODEX_ROOT="));
  assert.equal(validationBlocks.length, 2);
  for (const block of validationBlocks) {
    const syntax = spawnSync("/bin/bash", ["-n"], { encoding: "utf8", input: block });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});

test("source-local shared link mirrors remain byte-identical to canonical shared inputs", async () => {
  const mirrors = [
    ["shared/responsible-design/gates.json", "references/shared/responsible-design/gates.json"],
    ["shared/knowledge/trends/2026-current-practices.md", "references/shared/knowledge/trends/2026-current-practices.md"],
    ["shared/knowledge/trends/source-register.json", "references/shared/knowledge/trends/source-register.json"],
    ["shared/templates/review-finding.md", "assets/shared/templates/review-finding.md"],
  ];
  for (const [canonical, mirror] of mirrors) {
    assert.deepEqual(
      await readFile(path.join(repoRoot, canonical)),
      await readFile(path.join(pluginRoot, mirror)),
      `${mirror} must match ${canonical}`,
    );
  }
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  for (const pathOrCount of [
    "products/game-design-studio/plugin",
    "plugins/game-design-studio",
    ".codex-plugin/plugin.json",
    "skills/ (12개)",
    "skills/svg-infographic/",
    "agents/ (7개)",
    "hooks/hooks.json",
    "scripts/",
    "references/shared/knowledge/core/",
    "references/shared/knowledge/trends/",
    "references/source/docs/ (49개)",
    "references/shared/export/schema/",
    "references/profiles/",
    "assets/templates/ (15개)",
    "assets/product-mark.svg",
    "BUILD-MANIFEST.json",
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
  assert.ok(readme.includes("1개 universal core와 3개 선택 프로필"));
  assert.ok(readme.includes("저수준 `buildProduct()` 출력에는 `BUILD-MANIFEST.json`이 없습니다"));
  assert.ok(readme.includes("이 suite distribution snapshot에는 `BUILD-MANIFEST.json`이 있으며"));
});
