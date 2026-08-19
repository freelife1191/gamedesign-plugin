import assert from "node:assert/strict";
import { access, lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  loadArchifyCatalog,
  validateArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";
import { findStructuralDuplicates } from "../../tooling/lib/archify-signature.mjs";
import { vendorMappings } from "../../tooling/lib/vendor-components.mjs";
import { applyVendorDescriptionOverlay, loadVendorDescriptionOverlays } from "../../tooling/lib/vendor-description-overlay.mjs";
import {
  collectMarkdownHeadings,
  extractMarkdownLinks,
} from "../../tooling/lib/user-guides.mjs";

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

// Entries that mirror a vendored upstream document are written from the packages, so their number is the
// upstream release's business and changes on every bump. What must not move without review is the number
// of documents this repository authored a decision about, so that is the count pinned here.
const VENDOR_MIRROR_ROOTS = Object.freeze(["skills/svg-infographic", "skills/archify", "skills/humanize-korean"]);
const AUTHORED_CATALOG_ENTRIES = 705;

function isVendorMirrorEntry(entry) {
  const document = entry.source_document ?? "";
  return /^plugins\/game-design-(?:studio|career)\//u.test(document)
    && VENDOR_MIRROR_ROOTS.some((root) => document.includes(`/${root}/`));
}

function assertSuiteCatalogCardinality(catalog) {
  const authored = catalog.entries.filter((entry) => !isVendorMirrorEntry(entry));
  assert.equal(authored.length, AUTHORED_CATALOG_ENTRIES, `catalog must retain exactly ${AUTHORED_CATALOG_ENTRIES} authored entries`);
  assert.equal(
    catalog.entries.filter((entry) => entry.source_document === "README.md").length,
    1,
    "README.md must have exactly one catalog record",
  );
}

const publishedSourceLabels = new Map([
  ["studio-project-workflow", "Studio 전체 워크플로 원문"],
  ["career-evidence-workflow", "Career 전체 워크플로 원문"],
  ["suite-studio-career-handoff", "Studio → Career 인계 원문"],
  ["suite-project-memory-lifecycle", "프로젝트 기억 공통 가이드"],
]);

function publishedDiagramSection(markdown, id) {
  const marker = `### \`${id}\`\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `published diagram section exists: ${id}`);
  const end = markdown.indexOf("\n### ", start + marker.length);
  return markdown.slice(start, end === -1 ? markdown.length : end);
}

async function sourceTargetFromCuratedIndex(entry) {
  const sourcePath = path.join(repoRoot, entry.source_document);
  const source = await readFile(sourcePath, "utf8");
  const heading = collectMarkdownHeadings(source).find((candidate) => candidate.label === entry.source_section);
  assert.ok(heading, `${entry.id}: catalog source section resolves in its source document`);
  const indexDir = path.join(repoRoot, "guides/archify-diagrams");
  return `${path.relative(indexDir, sourcePath).split(path.sep).join("/")}#${heading.anchor}`;
}

async function assertCuratedPublishedIndex(catalog, markdown) {
  const selected = catalog.entries.filter((entry) => entry.decision === "selected");
  const published = selected.filter((entry) => entry.delivery_status === "published");
  assert.equal(selected.length, 5, "selected count is the published index source of truth");
  assert.equal(published.length, 5, "published count is the published index source of truth");
  const productCounts = Object.fromEntries(["studio", "career", "suite"].map((product) => [
    product,
    published.filter((entry) => entry.product === product).length,
  ]));
  const typeCounts = Object.fromEntries(["architecture", "workflow", "dataflow"].map((type) => [
    type,
    published.filter((entry) => entry.diagram_type === type).length,
  ]));
  assert.ok(markdown.includes(`**${published.length}개.**`), "published count is rendered from the catalog count");
  assert.ok(
    markdown.includes(`Studio ${productCounts.studio}개, Career ${productCounts.career}개, Suite ${productCounts.suite}개`),
    "published product counts match the catalog",
  );
  assert.ok(
    markdown.includes(`architecture ${typeCounts.architecture}개, workflow ${typeCounts.workflow}개, dataflow ${typeCounts.dataflow}개`),
    "published type counts match the catalog",
  );
  assert.ok(
    markdown.includes(`현재 선택된 ${selected.length}개 도식에는 남은 \`blocked-*\` 상태가 없습니다.`),
    "blocked summary uses the actual selected count",
  );

  for (const entry of published.filter((candidate) => publishedSourceLabels.has(candidate.id))) {
    const label = publishedSourceLabels.get(entry.id);
    const target = await sourceTargetFromCuratedIndex(entry);
    const section = publishedDiagramSection(markdown, entry.id);
    const sourceLine = section.split("\n").find((line) => line.startsWith("- 원문 근거:"));
    assert.ok(sourceLine, `${entry.id}: source line exists`);
    assert.ok(sourceLine.includes(`[${label}](${target})`), `${entry.id}: source link names the catalog source document and section`);
    assert.equal(sourceLine.includes("specs/"), false, `${entry.id}: a spec cannot be presented as the source document`);
    const link = extractMarkdownLinks(sourceLine).find((candidate) => candidate.label === label);
    assert.ok(link, `${entry.id}: source link is visible Markdown`);
    const sourcePath = path.resolve(path.join(repoRoot, "guides/archify-diagrams"), link.target.split("#", 1)[0]);
    const stat = await lstat(sourcePath);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, `${entry.id}: source target is a regular local file`);
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

test("production Archify catalog keeps vendor mirror schema valid without repoRoot", async () => {
  const catalog = JSON.parse(await readFile(path.join(repoRoot, "guides/archify-diagrams/catalog.json"), "utf8"));
  assert.deepEqual((await validateArchifyCatalog(catalog)).errors, []);
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
  for (const entry of [studio, career, suite]) {
    assert.equal(entry?.delivery_status, "published", entry?.id);
    assert.equal(entry?.visual_review, "passed", entry?.id);
    assert.deepEqual(entry?.diagnostics, [], entry?.id);
    assert.equal(typeof entry?.reviewer, "string", entry?.id);
  }
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
    () => assertStateAwareMaterialization({ ...career, delivery_status: "published", visual_review: "passed", reviewer: "reviewer" }),
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
    if (Object.hasOwn(entry, "origin_source")) {
      assert.match(entry.decision_reason, /(?:build mapping|products\/game-design-(?:studio|career))/u);
    } else {
      assert.match(entry.decision_reason, /products\/game-design-(?:studio|career)/u);
    }
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

test("production shared package mirrors retain structured build origins", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const origins = catalog.entries.filter((entry) => Object.hasOwn(entry, "origin_source"));
  // Vendored mirrors carry an origin_source too, and how many Markdown documents Archify and im-not-ai
  // ship is theirs to decide. Only the shared and product-source half is a number we chose.
  const vendorOrigins = origins.filter((entry) => /\/skills\/(?:archify|humanize-korean)\//u.test(entry.source_document));
  assert.equal(origins.length - vendorOrigins.length, 55, "shared and product-source package mirrors declare an origin_source");
  assert.ok(vendorOrigins.length > 0, "vendored package mirrors declare an origin_source");

  const mappings = new Map([
    ["document-quality", ["shared/document-quality", "references/shared/document-quality"]],
    ["archify", vendorMappings({ repoRoot }).archify[0]],
    ["im-not-ai", vendorMappings({ repoRoot })["im-not-ai"][0]],
    ["reference-intelligence", ["shared/reference-intelligence", "references/shared/reference-intelligence"]],
    ["image-assets", ["shared/image-assets", "references/shared/image-assets"]],
    ["studio-cutscene-skill", ["products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction", "skills/design-cutscene-visual-preproduction"]],
    ["suite-update-skill", ["shared/suite-update/skills/upgrade-game-design-suite", "skills/upgrade-game-design-suite"]],
  ]);
  for (const entry of origins) {
    assert.equal(entry.exclusion_code, "excluded-package-mirror", entry.id);
    assert.deepEqual(Object.keys(entry.origin_source).sort(), ["build_mapping", "source_document"]);
    const [sourceRoot, destinationRoot] = entry.origin_source.build_mapping === "memory"
      ? (entry.source_document.includes("/references/shared/memory/")
        ? ["shared/memory", "references/shared/memory"]
        : ["shared/memory/skills", "skills"])
      : entry.origin_source.build_mapping === "suite-handoff"
        ? ["shared/suite-handoff/references", `skills/game-design-${entry.product}/references`]
      : (entry.origin_source.build_mapping === "reference-intelligence" && entry.source_document.includes("/skills/"))
        ? ["shared/reference-intelligence/skills", "skills"]
      : (mappings.get(entry.origin_source.build_mapping) ?? []);
    assert.ok(sourceRoot, `${entry.id}: origin source uses an approved build mapping`);
    const productName = `game-design-${entry.product}`;
    const suffix = entry.source_document.slice(`plugins/${productName}/${destinationRoot}/`.length);
    assert.notEqual(suffix, entry.source_document, `${entry.id}: mirror uses the declared mapping destination`);
    assert.equal(entry.origin_source.source_document, `${sourceRoot}/${suffix}`, entry.id);
    assert.equal(entry.decision_reason.includes("원본은 products/"), false, `${entry.id}: no phantom products origin claim`);

    const [sourceStats, mirrorStats, sourceBytes, mirrorBytes] = await Promise.all([
      lstat(path.join(repoRoot, entry.origin_source.source_document)),
      lstat(path.join(repoRoot, entry.source_document)),
      readFile(path.join(repoRoot, entry.origin_source.source_document)),
      readFile(path.join(repoRoot, entry.source_document)),
    ]);
    assert.equal(sourceStats.isFile() && !sourceStats.isSymbolicLink(), true, `${entry.id}: origin is a regular non-symlink file`);
    assert.equal(mirrorStats.isFile() && !mirrorStats.isSymbolicLink(), true, `${entry.id}: mirror is a regular non-symlink file`);
    // A vendored mirror is its origin byte for byte with one declared exception: the description
    // overlay rewrites one frontmatter field as the build projects the file, because the upstream
    // description runs past the router's catalog budget. Applying the same overlay to the origin here
    // asks what the build was supposed to produce; a mapping with no overlay passes straight through.
    const overlay = loadVendorDescriptionOverlays({ repoRoot }).get(entry.origin_source.build_mapping);
    const { bytes: expectedBytes } = applyVendorDescriptionOverlay({ relativePath: suffix, bytes: sourceBytes }, overlay);
    assert.deepEqual(expectedBytes, mirrorBytes, `${entry.id}: mirror remains byte-identical to its origin`);
  }
});

test("cutscene visual-preproduction source and generated mirrors retain exact catalog records", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const expected = new Map([
    ["guides/game-design-studio/cutscene-visual-preproduction.md", undefined],
    ["guides/game-design-studio/skills/design-cutscene-visual-preproduction.md", undefined],
    ["guides/prompt-templates/studio/design-cutscene-visual-preproduction.md", undefined],
    ["products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/SKILL.md", undefined],
    ["plugins/game-design-studio/skills/design-cutscene-visual-preproduction/SKILL.md", "studio-cutscene-skill"],
  ]);
  for (const product of ["game-design-studio", "game-design-career"]) {
    for (const relative of [
      "references/shared/image-assets/references/cutscene-generation-policy.md",
      "references/shared/image-assets/templates/cutscene/cutscene-brief.md",
      "references/shared/image-assets/templates/cutscene/generation-guide.md",
    ]) expected.set(`plugins/${product}/${relative}`, "image-assets");
  }
  for (const [sourceDocument, buildMapping] of expected) {
    const entry = catalog.entries.find((candidate) => candidate.source_document === sourceDocument);
    assert.ok(entry, `${sourceDocument}: catalog entry exists`);
    assert.equal(entry.decision, "excluded", `${sourceDocument}: no duplicate diagram selection`);
    if (buildMapping === undefined) {
      assert.equal(Object.hasOwn(entry, "origin_source"), false, `${sourceDocument}: source surface is not a generated mirror`);
    } else {
      assert.equal(entry.origin_source?.build_mapping, buildMapping, `${sourceDocument}: exact build mapping`);
    }
  }
});

test("memory package mirrors recognize their reference and skill build destinations", async () => {
  const catalog = {
    schema_version: 1,
    scan_roots: [
      "README.md", "guides", "products/game-design-studio", "products/game-design-career",
      "plugins/game-design-studio", "plugins/game-design-career",
    ],
    scan_excludes: ["guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build"],
    entries: [
      {
        id: "memory-reference-mirror",
        product: "studio",
        source_document: "plugins/game-design-studio/references/shared/memory/references/memory-lifecycle.md",
        source_section: "게임 기획 기억 수명주기",
        source_digest: "a".repeat(64),
        decision: "excluded",
        exclusion_code: "excluded-package-mirror",
        decision_reason: "공유 build mapping으로 설치되는 memory reference mirror다.",
        diagnostics: [],
        spec: null,
        html: null,
        receipt: null,
        delivery_status: "not-applicable",
        visual_review: "not-applicable",
        origin_source: {
          source_document: "shared/memory/references/memory-lifecycle.md",
          build_mapping: "memory",
        },
      },
      {
        id: "memory-skill-mirror",
        product: "career",
        source_document: "plugins/game-design-career/skills/capture-game-design-memory/SKILL.md",
        source_section: "게임 기획 기억 후보 캡처",
        source_digest: "b".repeat(64),
        decision: "excluded",
        exclusion_code: "excluded-package-mirror",
        decision_reason: "공유 build mapping으로 설치되는 memory skill mirror다.",
        diagnostics: [],
        spec: null,
        html: null,
        receipt: null,
        delivery_status: "not-applicable",
        visual_review: "not-applicable",
        origin_source: {
          source_document: "shared/memory/skills/capture-game-design-memory/SKILL.md",
          build_mapping: "memory",
        },
      },
    ],
  };

  const result = await validateArchifyCatalog(catalog);
  assert.deepEqual(result, { ok: true, errors: [], uncovered: [] });
});

test("root README selects the Suite system architecture without changing corpus coverage", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  assertSuiteCatalogCardinality(catalog);
  const entry = catalog.entries.find((item) => item.id === "suite-plugin-system-architecture");
  assert.ok(entry);
  assert.deepEqual({
    id: entry.id,
    product: entry.product,
    source_document: entry.source_document,
    source_section: entry.source_section,
    question: entry.question,
    decision: entry.decision,
    diagram_type: entry.diagram_type,
    priority: entry.priority,
    visual_system: entry.visual_system,
    delivery_status: entry.delivery_status,
    visual_review: entry.visual_review,
    reviewer: entry.reviewer,
  }, {
    id: "suite-plugin-system-architecture",
    product: "suite",
    source_document: "README.md",
    source_section: "플러그인 구조와 전체 시스템 아키텍처",
    question: "사용자 진입점에서 두 기획 플러그인의 작업, 기준 기획 결과물, 자동 검증과 사람 검토·승인을 거쳐 결과가 어떻게 전달되는가?",
    decision: "selected",
    diagram_type: "architecture",
    priority: "primary",
    visual_system: "suite",
    delivery_status: "published",
    visual_review: "passed",
    reviewer: "Codex 헤드리스 시각 QA",
  });
  assert.equal(catalog.entries.some((item) => item.id === "suite-entry-navigation"), false);
  const selected = catalog.entries.filter((item) => item.decision === "selected");
  assert.equal(selected.length, 5);
  assert.deepEqual(
    Object.fromEntries(["studio", "career", "suite"].map((product) => [
      product,
      selected.filter((item) => item.product === product).length,
    ])),
    { studio: 1, career: 1, suite: 3 },
  );
});

test("curated Archify index renders catalog counts and links each workflow to its actual source", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const index = await readFile(path.join(repoRoot, "guides/archify-diagrams/README.md"), "utf8");
  await assertCuratedPublishedIndex(catalog, index);
});

test("curated Archify index rejects stale counts and spec links presented as source documents", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const index = await readFile(path.join(repoRoot, "guides/archify-diagrams/README.md"), "utf8");
  const mutations = [
    ["stale published count", index.replace("**5개.**", "**4개.**")],
    ["stale blocked count", index.replace("현재 선택된 5개 도식", "현재 선택된 네 도식")],
    [
      "Studio spec presented as source",
      index.replace(
        "[Studio 전체 워크플로 원문](../game-design-studio/workflow.md#game-design-studio-전체-워크플로)",
        "[Studio 전체 워크플로 원문](specs/studio/studio-project-workflow.json)",
      ),
    ],
  ];
  for (const [label, mutated] of mutations) {
    assert.notEqual(mutated, index, `${label}: mutation changes the curated index`);
    await assert.rejects(() => assertCuratedPublishedIndex(catalog, mutated), undefined, label);
  }
});

test("Suite catalog cardinality rejects an appended record or duplicate README record", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const appended = structuredClone(catalog);
  appended.entries.push({ ...appended.entries[0], id: "unexpected-764th-record", source_document: "guides/README.md" });
  assert.throws(() => assertSuiteCatalogCardinality(appended), /705/u);
  const duplicateReadme = structuredClone(catalog);
  duplicateReadme.entries.push({ ...duplicateReadme.entries[0], id: "duplicate-readme-record" });
  assert.throws(() => assertSuiteCatalogCardinality(duplicateReadme), /705/u);
  duplicateReadme.entries.pop();
  duplicateReadme.entries[1] = { ...duplicateReadme.entries[1], source_document: "README.md" };
  assert.throws(() => assertSuiteCatalogCardinality(duplicateReadme), /exactly one catalog record/u);
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
