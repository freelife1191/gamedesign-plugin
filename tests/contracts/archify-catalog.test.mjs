import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  loadArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";
import { findStructuralDuplicates } from "../../tooling/lib/archify-signature.mjs";

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
  const sourceBody = source.replace(/^(?: {0,3})#{1,6}\s+.*$/gmu, "");
  const explicitEvidence = /근거:\s*`([^`]+)`/u.exec(entry.decision_reason)?.[1];
  const boilerplateEvidence = new Set(["예상 결과", "artifact", "사용법"]);
  assert.ok(
    explicitEvidence,
    `${entry.source_document} lacks an explicit backticked source-body evidence excerpt`,
  );
  assert.ok(
    explicitEvidence.length >= 12 && !boilerplateEvidence.has(explicitEvidence.toLowerCase()),
    `${entry.source_document} has short or boilerplate evidence: ${explicitEvidence}`,
  );
  assert.ok(
    sourceBody.includes(explicitEvidence),
    `${entry.source_document} lacks exact source body evidence: ${explicitEvidence}`,
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

async function assertStateAwareMaterialization(entry) {
  const spec = path.join(repoRoot, entry.spec);
  if (entry.delivery_status === "planned") {
    await assert.rejects(access(spec), { code: "ENOENT" }, entry.id);
    return;
  }
  await access(spec);
  if (entry.delivery_status === "published") {
    assert.equal(entry.visual_review, "passed", entry.id);
    assert.equal(typeof entry.reviewer, "string", entry.id);
    await access(path.join(repoRoot, entry.html));
    await access(path.join(repoRoot, entry.receipt));
  }
}

test("production inventory has state-aware materialization contracts", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const specsById = new Map();
  const studio = catalog.entries.find((entry) => entry.id === "studio-project-workflow");
  const career = catalog.entries.find((entry) => entry.id === "career-evidence-workflow");
  const suite = catalog.entries.find((entry) => entry.id === "suite-studio-career-handoff");
  assert.equal(studio?.delivery_status, "blocked-validation");
  assert.equal(career?.delivery_status, "blocked-visual");
  assert.equal(career?.visual_review, "failed");
  assert.equal(suite?.delivery_status, "passed");
  assert.equal(suite?.visual_review, "passed");
  await assertStateAwareMaterialization(studio);
  await assertStateAwareMaterialization(career);
  await assertStateAwareMaterialization(suite);

  await assert.rejects(
    () => assertStateAwareMaterialization({ ...career, delivery_status: "planned" }),
    /Missing expected rejection/u,
  );
  await assert.rejects(
    () => assertStateAwareMaterialization({ ...suite, delivery_status: "planned" }),
    /Missing expected rejection/u,
  );
  await assert.doesNotReject(
    () => assertStateAwareMaterialization({ ...career, delivery_status: "passed", visual_review: "passed", reviewer: "reviewer" }),
  );
  await assert.rejects(
    () => assertStateAwareMaterialization({ ...career, delivery_status: "published", visual_review: "passed", reviewer: "reviewer" }),
    { code: "ENOENT" },
  );

  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
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

test("source body evidence guard rejects three invented prose reasons without explicit excerpts", () => {
  const source = "# Alpha\n\n## Alpha heading\n\nObserved source evidence payload with an actual semantic distinction.\n";
  for (const name of ["alpha", "beta", "gamma"]) {
    const entry = {
      source_document: `guides/${name}.md`,
      source_section: "Alpha heading",
      decision_reason: `“Alpha heading”은 lunar unicorn escrow topology ${name}를 직접 읽는 편이 명확하다. artifact`,
    };
    assert.throws(() => assertSourceBodyEvidence(entry, source), /explicit backticked/u);
  }
});

test("source body evidence guard rejects an excerpt invented outside the source body", () => {
  const entry = {
    source_document: "guides/alpha.md",
    source_section: "Alpha heading",
    decision_reason: "“Alpha heading”은 근거: `invented evidence payload`. 관계도보다 직접 읽는 편이 명확하다.",
  };
  const source = "# Alpha\n\n## Alpha heading\n\nObserved source evidence payload.\n";
  assert.throws(() => assertSourceBodyEvidence(entry, source), /exact source body evidence/u);
});

test("source body evidence guard rejects short and boilerplate excerpts", () => {
  const source = "# Alpha\n\n## Alpha heading\n\nartifact 사용법과 예상 결과를 비교한다.\n";
  for (const excerpt of ["artifact", "사용법", "예상 결과"]) {
    const entry = {
      source_document: "guides/alpha.md",
      source_section: "Alpha heading",
      decision_reason: `“Alpha heading”은 근거: \`${excerpt}\`. 관계도보다 직접 읽는 편이 명확하다.`,
    };
    assert.throws(() => assertSourceBodyEvidence(entry, source), /short or boilerplate/u);
  }
});

test("source body evidence guard accepts distinct semantic reasons with exact excerpts", () => {
  const source = "# Alpha\n\n## Alpha heading\n\nThe review owner records the evidence custody boundary before approval.\n";
  const entries = [
    "“Alpha heading”은 review owner의 승인 경계를 표로 읽는 정책이다. 근거: `records the evidence custody boundary`.",
    "“Alpha heading”은 evidence custody를 승인 전 보존하는 책임 설명이다. 근거: `review owner records the evidence`.",
    "“Alpha heading”은 approval 전에 남기는 review owner 기록을 안내한다. 근거: `boundary before approval`.",
  ];
  for (const decision_reason of entries) {
    assert.doesNotThrow(() => assertSourceBodyEvidence({ source_document: "guides/alpha.md", decision_reason }, source));
  }
});

test("production text exclusions have non-repeating evidence-backed reasoning", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text")) {
    assert.ok(entry.decision_reason.includes(entry.source_section), entry.source_document);
    assertSourceBodyEvidence(entry, await readFile(path.join(repoRoot, entry.source_document), "utf8"));
  }
  assertNoRepeatedGenericReasonTemplates(catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text"));
});
