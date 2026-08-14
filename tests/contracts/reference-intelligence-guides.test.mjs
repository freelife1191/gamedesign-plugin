import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractMarkdownLinks, validateUserGuides } from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const products = ["game-design-studio", "game-design-career"];
const analysisArtifacts = [
  "reference-intelligence/brief.md",
  "reference-intelligence/reference-set.yml",
  "reference-intelligence/evidence-register.yml",
  "reference-intelligence/system-inventory.json",
  "reference-intelligence/analysis-priority.md",
  "reference-intelligence/comparison-matrix.md",
  "reference-intelligence/transfer-decisions.md",
  "reference-intelligence/verification-queue.md",
];
const glossaryLifecycle = [
  "candidate",
  "proposed",
  "conflict check",
  "human approval",
  "snapshot",
  "document validation",
  "deprecation",
  "impact review",
];
const requestStages = [
  "이번 분석으로 결정할 질문 정의",
  "직접 경쟁작·핵심 우수 사례·운영 비교작 선정",
  "공식 자료와 사용자 플레이·스크린샷 등록",
  "평가 없이 시스템 목록화",
  "core/session/meta loop와 economy source-transform-sink 작성",
  "심층 분석 우선순위 확인",
  "선택한 시스템 심층 분석 실행",
  "게임별 해결 원리 비교",
  "adopt/adapt/reject/hold 제안과 사람 검토",
];
const dynamicAnalysisArtifacts = [
  "reference-intelligence/system-maps/<map-id>.json",
  "reference-intelligence/deep-dives/<system-id>.md",
];
const rootGuideLinks = [
  { label: "Studio 분석", target: "guides/game-design-studio/reference-analysis.md" },
  { label: "Studio 용어 사전", target: "guides/game-design-studio/glossary.md" },
  { label: "Career 분석", target: "guides/game-design-career/reference-analysis.md" },
  { label: "Career 용어 사전", target: "guides/game-design-career/glossary.md" },
];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(filename);
    return entry.isFile() && entry.name.endsWith(".md") ? [filename] : [];
  }));
  return nested.flat();
}

function copyableRequests(markdown) {
  return [...markdown.matchAll(/^```text\n([\s\S]*?)^```$/gmu)].map((match) => match[1]);
}

test("reference guides expose copyable staged requests and exact artifact paths", async () => {
  for (const product of products) {
    const guide = await readFile(path.join(repoRoot, "guides", product, "reference-analysis.md"), "utf8");
    const requests = copyableRequests(guide);
    assert.ok(requests.length >= requestStages.length, `${product} has one copyable request per stage`);
    const stagePositions = requestStages.map((stage) => requests.findIndex((request) => request.includes(stage)));
    assert.equal(stagePositions.every((position) => position >= 0), true, `${product}: every stage is copyable`);
    assert.equal(stagePositions.every((position, index) => index === 0 || stagePositions[index - 1] < position), true, `${product}: stages remain ordered`);
    for (const artifact of analysisArtifacts) assert.match(guide, new RegExp(artifact.replaceAll(".", "\\."), "u"), `${product}: ${artifact}`);
    for (const artifact of dynamicAnalysisArtifacts) assert.match(guide, new RegExp(artifact.replaceAll(".", "\\."), "u"), `${product}: ${artifact}`);
    assert.match(guide, /pending-review/u, `${product}: transfer review boundary`);
    assert.match(guide, /validationState: not-run/u, `${product}: transfer validation boundary`);
    assert.match(guide, /관찰.*추론.*가설.*미정/u, `${product}: evidence boundary`);
    assert.match(guide, /자동 승인하지 않/u, `${product}: human review boundary`);
    assert.match(guide, /장르 관례.*오버레이.*조사 질문/u, `${product}: overlay is investigatory`);
    assert.match(guide, /자동 의무.*아닙/u, `${product}: overlay is not mandatory`);
    const calls = requests.flatMap((request) => [...request.matchAll(/\$game-design-(?:studio|career):[a-z-]+/gu)].map((match) => match[0]));
    assert.equal(calls.length > 0, true, `${product}: CLI calls are in text blocks`);
    assert.equal(calls.every((call) => call === `$${product}:analyze-game-design-references`), true, `${product}: analysis calls use its exact namespace`);
  }
});

test("glossary guides keep TERM-PLAYER-POWER bilingual and lifecycle-gated", async () => {
  for (const product of products) {
    const glossary = await readFile(path.join(repoRoot, "guides", product, "glossary.md"), "utf8");
    assert.match(glossary, /TERM-PLAYER-POWER/u);
    assert.match(glossary, /플레이어 파워/u);
    assert.match(glossary, /Player Power/u);
    assert.match(glossary, /자동 치환하지 않/u);
    assert.match(glossary, /reference-intelligence\/glossary\/glossary-receipt\.json/u);
    assert.match(glossary, /reference-intelligence\/glossary\/terms\.json/u);
    assert.match(glossary, /reference-intelligence\/decisions\/glossary-<safe-event-id>\.json/u);
    assert.match(glossary, /공통.*프로젝트.*오버레이.*TERM-\*/u);
    assert.match(glossary, /충돌.*명시적 이유.*이름이 확인된 사람.*승인/u);
    assert.match(glossary, /값만 담은 진단.*비공개.*비밀.*절대 경로/u);
    const lifecycle = glossary.slice(glossary.indexOf("## 후보부터 영향 검토까지 진행하기"));
    const positions = glossaryLifecycle.map((stage) => lifecycle.indexOf(stage));
    assert.equal(positions.every((position) => position >= 0), true, `${product}: lifecycle stages are explicit`);
    assert.equal(positions.every((position, index) => index === 0 || positions[index - 1] < position), true, `${product}: lifecycle order`);
    const calls = copyableRequests(glossary).flatMap((request) => [...request.matchAll(/\$game-design-(?:studio|career):[a-z-]+/gu)].map((match) => match[0]));
    assert.equal(calls.length > 0, true, `${product}: glossary CLI call is in a text block`);
    assert.equal(calls.every((call) => call === `$${product}:maintain-game-design-glossary`), true, `${product}: glossary calls use its exact namespace`);
  }
});

test("reference guides are linked from root and product discovery pages", async () => {
  const root = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.deepEqual(extractMarkdownLinks(root).filter((link) => rootGuideLinks.some(({ label, target }) => link.label === label && link.target === target)).map(({ label, target }) => ({ label, target })), rootGuideLinks);
  for (const product of products) {
    const productReadme = await readFile(path.join(repoRoot, "guides", product, "README.md"), "utf8");
    const skillReadme = await readFile(path.join(repoRoot, "guides", product, "skills", "README.md"), "utf8");
    const expected = [
      { label: "경쟁작·레퍼런스 분석", target: "reference-analysis.md" },
      { label: "용어 사전 검토", target: "glossary.md" },
    ];
    const visibleProductLinks = extractMarkdownLinks(productReadme).filter((link) => expected.some(({ label, target }) => link.label === label && link.target === target)).map(({ label, target }) => ({ label, target }));
    assert.deepEqual([...new Map(visibleProductLinks.map((link) => [`${link.label}\0${link.target}`, link])).values()], expected, `${product}: product discovery`);
    const expectedSkillLinks = [
      { label: "analyze-game-design-references", target: "../reference-analysis.md" },
      { label: "maintain-game-design-glossary", target: "../glossary.md" },
    ];
    const visibleSkillLinks = extractMarkdownLinks(skillReadme).filter((link) => expectedSkillLinks.some(({ label, target }) => link.label === label && link.target === target)).map(({ label, target }) => ({ label, target }));
    assert.deepEqual(visibleSkillLinks, expectedSkillLinks, `${product}: source-bound skill discovery`);
    assert.match(skillReadme, /설치 스킬 23개/u, `${product}: skill inventory count`);
  }
});

test("guide validation count follows the actual Markdown inventory", async () => {
  const files = await markdownFiles(path.join(repoRoot, "guides"));
  const validation = await validateUserGuides({ repoRoot, requireComplete: true });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validation.counts.guides, files.length);
});
