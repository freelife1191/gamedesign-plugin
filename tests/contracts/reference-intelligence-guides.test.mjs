import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractMarkdownLinks, validateUserGuides } from "../../tooling/lib/user-guides.mjs";
import { validateArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const products = ["game-design-studio", "game-design-career"];
const analysisArtifacts = [
  "reference-intelligence/brief.md",
  "reference-intelligence/brief.json",
  "reference-intelligence/reference-set.yml",
  "reference-intelligence/evidence-register.yml",
  "reference-intelligence/atlas-selection.json",
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
const referenceGuideCatalogRecords = [
  {
    id: "excluded-6cfb0f7c2ba4",
    product: "studio",
    source_document: "guides/game-design-studio/reference-analysis.md",
    source_section: "경쟁작 분석으로 설계 가설을 검토하기",
  },
  {
    id: "excluded-38fa4feccf84",
    product: "studio",
    source_document: "guides/game-design-studio/glossary.md",
    source_section: "용어 후보를 검토하고 스냅샷 만들기",
  },
  {
    id: "excluded-3df497a4b09e",
    product: "career",
    source_document: "guides/game-design-career/reference-analysis.md",
    source_section: "레퍼런스 분석을 포트폴리오 근거로 정리하기",
  },
  {
    id: "excluded-2eb68785035f",
    product: "career",
    source_document: "guides/game-design-career/glossary.md",
    source_section: "포트폴리오 용어를 사람 검토로 관리하기",
  },
];

function assertActiveInventoryStatements({ guideIndex, studioUseCases, marketplaceSmoke, archifyCatalog, careerWorkbench }) {
  assert.match(guideIndex, /Studio 인덱스는 설치 스킬 26개, Career 인덱스는 설치 스킬 25개/u);
  for (const [product, count] of [["Studio", 26], ["Career", 25]]) {
    assert.match(guideIndex, new RegExp(`\\[스킬 ${count}개\\]\\(game-design-${product.toLowerCase()}/skills/README\\.md\\)`, "u"));
  }
  assert.match(studioUseCases, /설치된 Studio 스킬 26개의 직접 호출 신호/u);
  assert.match(marketplaceSmoke, /플러그인마다 스킬 25개 이상과 공식 플러그인 검증기/u);
  assert.equal((marketplaceSmoke.match(/"skills": 25,/gu) ?? []).length, 1, "marketplace success example uses the packaged Career skill count");
  assert.equal((marketplaceSmoke.match(/"skills": 26,/gu) ?? []).length, 1, "marketplace success example uses the packaged Studio skill count");

  const catalogSources = [
    { id: "excluded-649d189a8231", source: guideIndex, label: "guide index" },
    { id: "excluded-95601350f8c7", source: studioUseCases, label: "Studio use-case index" },
    { id: "excluded-902c61df1537", source: careerWorkbench, label: "Career workbench" },
  ];
  for (const { id, source, label } of catalogSources) {
    const entry = archifyCatalog.entries.find((candidate) => candidate.id === id);
    assert.ok(entry, `${label} catalog entry exists`);
    assert.equal(entry.source_digest, createHash("sha256").update(source).digest("hex"), `${label} catalog digest matches the active source`);
  }

  const workbenchEntry = archifyCatalog.entries.find((entry) => entry.id === "excluded-902c61df1537");
  assert.ok(workbenchEntry, "Career workbench catalog entry exists");
  assert.match(workbenchEntry.decision_reason, /설치된 Career 스킬 25개/u);
}

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
    assert.match(skillReadme, product === "game-design-studio" ? /설치 스킬 26개/u : /설치 스킬 25개/u, `${product}: skill inventory count`);
  }
});

test("active user documentation keeps the installed Studio 26 and Career 25 skill inventories synchronized", async () => {
  const [guideIndex, studioUseCases, marketplaceSmoke, catalogText, careerWorkbench] = await Promise.all([
    readFile(path.join(repoRoot, "guides/README.md"), "utf8"),
    readFile(path.join(repoRoot, "guides/game-design-studio/use-cases/README.md"), "utf8"),
    readFile(path.join(repoRoot, "tests/e2e/install-marketplace-smoke.md"), "utf8"),
    readFile(path.join(repoRoot, "guides/archify-diagrams/catalog.json"), "utf8"),
    readFile(path.join(repoRoot, "guides/game-design-career/use-cases/skill-workbench.md"), "utf8"),
  ]);
  const archifyCatalog = JSON.parse(catalogText);
  assertActiveInventoryStatements({ guideIndex, studioUseCases, marketplaceSmoke, archifyCatalog, careerWorkbench });

  const staleGuideIndex = guideIndex.replace("Studio 인덱스는 설치 스킬 26개", "Studio 인덱스는 설치 스킬 21개");
  assert.notEqual(staleGuideIndex, guideIndex, "guide-index mutation changes the active statement");
  assert.throws(() => assertActiveInventoryStatements({
    guideIndex: staleGuideIndex,
    studioUseCases,
    marketplaceSmoke,
    archifyCatalog,
    careerWorkbench,
  }), /Studio 인덱스는 설치 스킬 26개/u, "stale guide-index inventory is rejected");
  const staleMarketplaceExample = marketplaceSmoke.replace('"skills": 26,', '"skills": 21,');
  assert.notEqual(staleMarketplaceExample, marketplaceSmoke, "marketplace mutation changes the active statement");
  assert.throws(() => assertActiveInventoryStatements({
    guideIndex,
    studioUseCases,
    marketplaceSmoke: staleMarketplaceExample,
    archifyCatalog,
    careerWorkbench,
  }), /Studio skill count/u, "stale marketplace example inventory is rejected");
  const staleCatalog = { ...archifyCatalog, entries: archifyCatalog.entries.map((entry) => entry.id === "excluded-902c61df1537" ? { ...entry, decision_reason: entry.decision_reason.replace("스킬 25개", "스킬 21개") } : entry) };
  assert.notDeepEqual(staleCatalog, archifyCatalog, "catalog mutation changes the active statement");
  assert.throws(() => assertActiveInventoryStatements({
    guideIndex,
    studioUseCases,
    marketplaceSmoke,
    archifyCatalog: staleCatalog,
    careerWorkbench,
  }), /Career 스킬 25개/u, "stale catalog inventory is rejected");
  const staleCatalogDigest = { ...archifyCatalog, entries: archifyCatalog.entries.map((entry) => entry.id === "excluded-902c61df1537" ? { ...entry, source_digest: "0".repeat(64) } : entry) };
  assert.throws(() => assertActiveInventoryStatements({
    guideIndex,
    studioUseCases,
    marketplaceSmoke,
    archifyCatalog: staleCatalogDigest,
    careerWorkbench,
  }), /Career workbench catalog digest/u, "catalog source digest mutation is rejected");
});

test("guide validation count follows the actual Markdown inventory", async () => {
  const files = await markdownFiles(path.join(repoRoot, "guides"));
  const validation = await validateUserGuides({ repoRoot, requireComplete: true });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validation.counts.guides, files.length);
});

test("Task 8 Archify records close the prior stale baseline and cover generated mirrors", async () => {
  const catalog = JSON.parse(await readFile(path.join(repoRoot, "guides/archify-diagrams/catalog.json"), "utf8"));
  const validation = await validateArchifyCatalog(catalog, { repoRoot });
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.uncovered, []);

  for (const record of referenceGuideCatalogRecords) {
    const entry = catalog.entries.find((candidate) => candidate.id === record.id);
    const source = await readFile(path.join(repoRoot, record.source_document));
    assert.deepEqual(
      {
        id: entry?.id,
        product: entry?.product,
        source_document: entry?.source_document,
        source_section: entry?.source_section,
        source_digest: entry?.source_digest,
        decision: entry?.decision,
        exclusion_code: entry?.exclusion_code,
        diagnostics: entry?.diagnostics,
        spec: entry?.spec,
        html: entry?.html,
        receipt: entry?.receipt,
        delivery_status: entry?.delivery_status,
        visual_review: entry?.visual_review,
      },
      {
        ...record,
        source_digest: createHash("sha256").update(source).digest("hex"),
        decision: "excluded",
        exclusion_code: "excluded-better-as-text",
        diagnostics: [],
        spec: null,
        html: null,
        receipt: null,
        delivery_status: "not-applicable",
        visual_review: "not-applicable",
      },
      `${record.source_document}: canonical text exclusion`,
    );
    assert.match(entry.decision_reason, /copyable|복사 가능한/u);
    assert.match(entry.decision_reason, /artifact|경로/u);
    assert.match(entry.decision_reason, /사람 검토|승인/u);
    assert.match(entry.decision_reason, /도식.*대체하지 못|본문.*정확/u);
  }

  const target = referenceGuideCatalogRecords[0];
  const staleDigestCatalog = {
    ...catalog,
    entries: catalog.entries.map((entry) => entry.id === target.id ? { ...entry, source_digest: "0".repeat(64) } : entry),
  };
  const staleDigest = await validateArchifyCatalog(staleDigestCatalog, { repoRoot });
  assert.ok(staleDigest.errors.includes(`stale-source: ${target.source_document}`), "guide digest mutation is rejected");

  const omittedGuideCatalog = {
    ...catalog,
    entries: catalog.entries.filter((entry) => entry.id !== target.id),
  };
  const omittedGuide = await validateArchifyCatalog(omittedGuideCatalog, { repoRoot });
  assert.deepEqual(omittedGuide.uncovered, [target.source_document], "guide omission is uncovered");
});
