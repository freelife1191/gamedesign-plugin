import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  loadArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function normalizedReasonTemplate(entry) {
  return entry.decision_reason
    .toLowerCase()
    .replaceAll(entry.source_document.toLowerCase(), "<source>")
    .replaceAll(entry.source_section.toLowerCase(), "<section>")
    .replace(/https?:\/\/\S+|(?:[\w.-]+\/)+(?:[\w.-]+)|[\w.-]+\.[a-z0-9]+/gu, "<path>")
    .replace(/\$[a-z0-9:-]+|(?:studio|career|suite):[a-z0-9:-]+|\b[a-z]{2}-[a-z0-9-]+\b/gu, "<id>")
    .replace(/근거:\s*[^.!?。]+/gu, "근거: <evidence>")
    .replace(/`[^`]*`|“[^”]*”|"[^"]*"|'[^']*'/gu, "<quoted>")
    .replace(/\*\*[^*]*\*\*|_[^_]*_/gu, "<emphasis>")
    .replace(/은 .*?을 실제 근거로 삼는다\./gu, "은 <evidence>을 실제 근거로 삼는다.")
    .replace(/(?:스킬 흐름:|기본 스킬:)\s*[^.]+/gu, "<skill-flow>")
    .replace(/\s+/gu, " ")
    .trim();
}

function assertNoRepeatedGenericReasonTemplates(entries) {
  const templates = new Map();
  for (const entry of entries) {
    const template = normalizedReasonTemplate(entry);
    templates.set(template, [...(templates.get(template) ?? []), entry.source_document]);
  }
  for (const [template, documents] of templates) {
    assert.ok(documents.length < 3, `${documents.join(", ")} repeat generic template: ${template}`);
  }
}

function assertSourceBodyEvidence(entry, source) {
  const sourceBody = source.replace(/^(?: {0,3})#{1,6}\s+.*$/gmu, "").toLowerCase();
  const explicitEvidence = /근거:\s*(.+?)(?:[.!?。]|$)/u.exec(entry.decision_reason)?.[1]?.trim();
  if (explicitEvidence !== undefined) {
    assert.ok(
      sourceBody.includes(explicitEvidence.toLowerCase()),
      `${entry.source_document} lacks source body evidence: ${explicitEvidence}`,
    );
    return;
  }

  const ignoredTokens = new Set(["archify", "career", "studio", "suite", "문서", "본문", "텍스트", "관계", "관계도", "도식", "안내", "질문", "근거", "직접", "이미", "별도", "기존", "더", "한다", "이다"]);
  const evidenceTokens = [...entry.decision_reason.toLowerCase().matchAll(/[a-z0-9][a-z0-9_./:-]{3,}|[가-힣]{3,}/gu)]
    .map((match) => match[0])
    .filter((token) => !ignoredTokens.has(token) && sourceBody.includes(token));
  assert.ok(
    evidenceTokens.length > 0,
    `${entry.source_document} lacks source body evidence`,
  );
}

test("production Archify catalog covers the complete declared Markdown corpus", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const documents = await discoverArchifySourceDocuments({
    repoRoot,
    scanRoots: catalog.scan_roots,
    scanExcludes: catalog.scan_excludes,
  });

  assert.equal(new Set(catalog.entries.map((entry) => entry.source_document)).size, documents.length);
  assert.deepEqual(
    [...new Set(catalog.entries.map((entry) => entry.source_document))].sort(),
    documents,
  );
});

test("production inventory has bounded diagrams and explicit package exclusions", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const document of new Set(catalog.entries.map((entry) => entry.source_document))) {
    const entries = catalog.entries.filter((entry) => entry.source_document === document);
    assert.ok(entries.filter((entry) => entry.priority === "primary").length <= 1, document);
    assert.ok(entries.filter((entry) => entry.priority === "secondary").length <= 1, document);
  }
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("products/"))) {
    assert.equal(entry.decision, "excluded");
    assert.match(entry.decision_reason, /package surface|패키지 외부 링크/u);
  }
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("plugins/"))) {
    assert.equal(entry.decision, "excluded");
    assert.match(entry.decision_reason, /products\/game-design-(?:studio|career)/u);
  }
});

test("production selection does not duplicate existing Skillstead diagrams", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const overlappingSkillsteadPaths = new Map([
    ["career-junior-growth-transition", "guides/assets/game-design-career/career-stage-routing.svg"],
    ["career-portfolio-review-cycle", "guides/assets/game-design-career/portfolio-review-loop.svg"],
    ["studio-economy-liveops-lifecycle", "guides/assets/game-design-studio/economy-balance-liveops-loop.svg"],
    ["studio-production-review-export", "guides/assets/game-design-studio/production-risk-review-flow.svg"],
    ["suite-audience-paths", "guides/assets/use-cases/audiences/aud-01.svg"],
  ]);

  for (const [id, evidencePath] of overlappingSkillsteadPaths) {
    const entry = catalog.entries.find((item) => item.id === id);
    assert.ok(entry, id);
    assert.equal(entry.decision, "excluded", id);
    assert.equal(entry.exclusion_code, "excluded-skillstead-overlap", id);
    assert.match(entry.decision_reason, new RegExp(evidencePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), id);
  }
});

test("production exclusions retain exact package classes and source-specific evidence", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("products/"))) {
    assert.equal(entry.exclusion_code, "excluded-package-surface", entry.source_document);
  }
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("plugins/"))) {
    assert.equal(entry.exclusion_code, "excluded-package-mirror", entry.source_document);
  }
  for (const entry of catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text")) {
    assert.notEqual(entry.decision_reason, "이 문서는 단일 설명·참조·요청문을 직접 읽는 편이 관계 도식보다 명확하다.", entry.source_document);
    assert.ok(entry.decision_reason.includes(entry.source_section), entry.source_document);
  }
});

test("production selection excludes the existing plugin selection Skillstead flow", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const entry = catalog.entries.find((item) => item.id === "suite-entry-navigation");
  assert.ok(entry);
  assert.equal(entry.decision, "excluded");
  assert.equal(entry.exclusion_code, "excluded-skillstead-overlap");
  assert.match(entry.decision_reason, /guides\/assets\/shared\/plugin-selection-flow\.svg/u);
});

test("reason template guard rejects three scope-and-evidence interpolations", () => {
  const entries = ["alpha", "beta", "gamma"].map((name) => ({
    source_document: `guides/${name}.md`,
    source_section: `${name} section`,
    decision_reason: `“${name} section”은 $${name}:run의 ${name}.svg를 이미 참조한다. 같은 안내 문구를 직접 읽는 편이 더 정확하다. 근거: \`${name} output\`.`,
  }));
  assert.throws(() => assertNoRepeatedGenericReasonTemplates(entries), /repeat generic template/u);
});

test("reason template guard rejects bare IDs, YAML paths, and plain evidence payload interpolations", () => {
  const entries = ["alpha", "beta", "gamma"].map((name, index) => ({
    source_document: `guides/${name}.md`,
    source_section: `${name} section`,
    decision_reason: `“${name} section”은 CA-C0${index + 1}의 ${name}.evidence.yml을 적용한다. 근거: ${name} output. 같은 안내 문구를 직접 읽는 편이 더 정확하다.`,
  }));
  assert.throws(() => assertNoRepeatedGenericReasonTemplates(entries), /repeat generic template/u);
});

test("reason template guard allows three different semantic exclusion reasons", () => {
  const entries = [
    {
      source_document: "guides/alpha.md",
      source_section: "Alpha",
      decision_reason: "“Alpha”은 role evidence matrix의 주장 경계를 표로 비교하는 안내라서 직접 읽는 편이 낫다.",
    },
    {
      source_document: "guides/beta.md",
      source_section: "Beta",
      decision_reason: "“Beta”는 retry checkpoint에서 artifact custody를 복구하는 절차를 단계별 텍스트로 보존한다.",
    },
    {
      source_document: "guides/gamma.md",
      source_section: "Gamma",
      decision_reason: "“Gamma”는 provider policy의 approval boundary와 금지 조건을 대조하는 정책표다.",
    },
  ];
  assert.doesNotThrow(() => assertNoRepeatedGenericReasonTemplates(entries));
});

test("source body evidence guard rejects an invented reason that only repeats its heading", () => {
  const entry = {
    source_document: "guides/alpha.md",
    source_section: "Alpha heading",
    decision_reason: "“Alpha heading”은 근거: invented evidence payload. 관계도보다 직접 읽는 편이 명확하다.",
  };
  const source = "# Alpha\n\n## Alpha heading\n\nObserved source evidence payload.\n";
  assert.throws(() => assertSourceBodyEvidence(entry, source), /source body evidence/u);
});

test("production text exclusions have non-repeating evidence-backed reasoning", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text")) {
    assert.ok(entry.decision_reason.includes(entry.source_section), entry.source_document);
    assertSourceBodyEvidence(entry, await readFile(path.join(repoRoot, entry.source_document), "utf8"));
  }
  assertNoRepeatedGenericReasonTemplates(catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text"));
});
