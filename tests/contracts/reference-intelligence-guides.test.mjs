import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateUserGuides } from "../../tooling/lib/user-guides.mjs";

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
  "게임별 해결 원리 비교",
  "adopt/adapt/reject/hold 제안과 사람 검토",
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
    for (const stage of requestStages) {
      assert.ok(requests.some((request) => request.includes(stage)), `${product}: ${stage}`);
    }
    for (const artifact of analysisArtifacts) assert.match(guide, new RegExp(artifact.replaceAll(".", "\\."), "u"), `${product}: ${artifact}`);
    assert.match(guide, /pending-review/u, `${product}: transfer review boundary`);
    assert.match(guide, /validationState: not-run/u, `${product}: transfer validation boundary`);
    assert.match(guide, /관찰.*추론.*가설.*미정/u, `${product}: evidence boundary`);
    assert.match(guide, /자동 승인하지 않/u, `${product}: human review boundary`);
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
    const lifecycle = glossary.slice(glossary.indexOf("## 후보부터 영향 검토까지 진행하기"));
    const positions = glossaryLifecycle.map((stage) => lifecycle.indexOf(stage));
    assert.equal(positions.every((position) => position >= 0), true, `${product}: lifecycle stages are explicit`);
    assert.equal(positions.every((position, index) => index === 0 || positions[index - 1] < position), true, `${product}: lifecycle order`);
  }
});

test("reference guides are linked from root and product discovery pages", async () => {
  const root = await readFile(path.join(repoRoot, "README.md"), "utf8");
  for (const product of products) {
    const productReadme = await readFile(path.join(repoRoot, "guides", product, "README.md"), "utf8");
    assert.match(root, new RegExp(`\\(guides/${product}/reference-analysis\\.md\\)`, "u"));
    assert.match(root, new RegExp(`\\(guides/${product}/glossary\\.md\\)`, "u"));
    assert.match(productReadme, /\(reference-analysis\.md\)/u);
    assert.match(productReadme, /\(glossary\.md\)/u);
  }
});

test("guide validation count follows the actual Markdown inventory", async () => {
  const files = await markdownFiles(path.join(repoRoot, "guides"));
  const validation = await validateUserGuides({ repoRoot, requireComplete: true });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validation.counts.guides, files.length);
});
