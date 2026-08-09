import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  loadArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

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

test("production text exclusions have non-repeating evidence-backed reasoning", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const skeletons = new Map();
  for (const entry of catalog.entries.filter((item) => item.exclusion_code === "excluded-better-as-text")) {
    const evidence = /근거: `([^`]+)`/u.exec(entry.decision_reason);
    assert.ok(evidence, entry.source_document);
    const source = await readFile(path.join(repoRoot, entry.source_document), "utf8");
    const sourceBody = source.replace(/^(?: {0,3})#{1,6}\s+.*$/gmu, "");
    assert.ok(sourceBody.includes(evidence[1]), entry.source_document);
    const headings = [...source.matchAll(/^(?: {0,3})#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gmu)].map((match) => match[1].trim());
    let normalized = entry.decision_reason
      .replaceAll(entry.source_document, "<source>")
      .replaceAll(entry.source_section, "<section>");
    for (const heading of headings) normalized = normalized.replaceAll(heading, "<heading>");
    skeletons.set(normalized, [...(skeletons.get(normalized) ?? []), entry.source_document]);
  }
  for (const [skeleton, documents] of skeletons) {
    assert.ok(documents.length === 1, `${documents.join(", ")} share template: ${skeleton}`);
  }
});
