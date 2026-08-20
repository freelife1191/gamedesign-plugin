# Curated Archify Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존의 동일 템플릿형 Archify 50개 산출물과 생성 계층을 제거하고, 저장소 문서의 실제 질문과 근거를 분석해 선별한 도식만 독립 저작·검증·전수 시각 검수하여 발행한다.

**Architecture:** `guides/archify-diagrams/catalog.json`이 분석 대상 문서, 선택·제외 결정, source digest, spec·HTML·QA 상태의 유일한 기준이다. committed JSON spec만 topology를 소유하며 공통 tooling은 catalog 검증, 구조 중복 탐지, Archify CLI identity 고정, validate·deliver receipt 확인, staging·atomic publication, visual QA evidence 검증만 담당한다. Studio, Career, Suite spec은 서로 독립 저작하고, 자동 검증과 headless 전수 시각 QA를 모두 통과한 항목만 `guides/assets/archify/`에 게시한다.

**Tech Stack:** Node.js 18+ ESM, `node:test`, JSON, Markdown, Archify 2.13+ CLI, 기존 `shared/scripts/capability-probe.mjs`, 기존 guarded temporary-root utility, headless `agent-browser`와 local image reader를 이용한 시각 QA.

## Global Constraints

- 기준 설계는 `docs/superpowers/specs/2026-08-10-curated-archify-redesign-design.md`다.
- 기존 Task 13의 tracked Archify 파일 151개와 ignored `.DS_Store` 2개를 제거하고 어떤 JSON·HTML도 새 spec의 시작점으로 재사용하지 않는다.
- host Archify capability probe와 제품별 optional routing·Skillstead fallback 계약은 유지한다.
- 도식 수량을 미리 정하지 않는다. 모든 scan 대상 Markdown은 selected 또는 excluded 분석 기록을 가져야 한다.
- 문서당 primary는 최대 1개, 실제로 직교하는 질문이 있을 때만 secondary를 최대 1개 허용한다.
- committed spec만 node, lane, edge, state, transition, participant, message와 layout을 소유한다. builder는 topology를 생성하지 않는다.
- 각 spec은 해당 source 문서·section, 선택한 type schema, `common.schema.json`, 가장 가까운 example 하나를 읽은 뒤 새 ID·문구·layout으로 작성한다.
- 모든 spec은 정확한 `meta.quality_profile: "showcase"`를 사용한다.
- Archify 자동 완료 조건은 validate·deliver 성공, showcase 9/9, composition errors 0, warnings 0, specification·artifact digest와 byte count 일치다.
- 시각 완료 조건은 default READ, light, dark, 모든 guided view의 실제 headless 렌더를 원본 크기로 전수 검사하고 `visual_review: passed`로 기록하는 것이다.
- focused validation repair와 visual correction은 각각 최대 2회다. 이후 남은 결함은 blocked 상태로 기록하고 발행하지 않는다.
- 실제 창을 여는 `--open`, `preview`, `--headed`를 사용하지 않는다.
- generated `plugins/*`는 직접 편집하지 않는다. canonical product source를 변경한 경우 기존 snapshot builder로 재생성한다.
- 새 HTML은 repository guide surface에만 게시한다. `products/*/plugin`과 generated `plugins/*` 문서는 분석하되, 패키지 밖 상대 링크를 만들지 않도록 각각 `excluded-package-surface`와 `excluded-package-mirror`로 기록한다.
- 새 npm dependency를 추가하지 않는다.
- main checkout의 기존 untracked `package-lock.json`은 수정·추가·삭제·커밋하지 않는다.
- 각 task는 RED → GREEN → 관련 회귀 검증 → 단일 목적 커밋 순서를 지킨다.

---

## File and Interface Map

### Retired Task 13 surface

- Delete: `guides/assets/archify/**`
- Delete: `tooling/build-archify-guides.mjs`
- Delete: `tooling/lib/archify-guides.mjs`
- Delete: `tests/unit/archify-guides.test.mjs`
- Modify: `package.json` — remove `build:archify-guides`, `check:archify-guides`
- Create: `tests/contracts/archify-retirement.test.mjs`

### Catalog and diversity source

- Create: `guides/archify-diagrams/catalog.json`
- Create: `guides/archify-diagrams/catalog.schema.json`
- Create: `guides/archify-diagrams/README.md`
- Create: `tooling/lib/archify-catalog.mjs`
  - `discoverArchifySourceDocuments({ repoRoot, scanRoots, scanExcludes })`
  - `hashArchifySource(filename)`
  - `loadArchifyCatalog({ repoRoot, catalogPath })`
  - `validateArchifyCatalog({ repoRoot, catalog })`
  - `publishableArchifyEntries(catalog)`
- Create: `tooling/validate-archify-catalog.mjs`
- Create: `tooling/lib/archify-signature.mjs`
  - `structuralSignature({ type, spec })`
  - `findStructuralDuplicates({ catalog, specsById })`
- Create: `tests/unit/archify-catalog.test.mjs`
- Create: `tests/unit/archify-signature.test.mjs`
- Create: `tests/contracts/archify-catalog.test.mjs`

### CLI, receipts, and delivery

- Modify: `shared/scripts/capability-probe.mjs`
- Modify: `tests/unit/capability-probe.test.mjs`
- Create: `tooling/lib/archify-receipt.mjs`
- Create: `tooling/lib/archify-delivery.mjs`
- Create: `tooling/build-curated-archify.mjs`
- Create: `tests/unit/archify-receipt.test.mjs`
- Create: `tests/unit/archify-delivery.test.mjs`
- Modify: `package.json`

### Hand-authored specifications and outputs

- Create: `guides/archify-diagrams/specs/studio/${entry.id}.json` for every selected Studio entry
- Create: `guides/archify-diagrams/specs/career/${entry.id}.json` for every selected Career entry
- Create: `guides/archify-diagrams/specs/suite/${entry.id}.json` for every selected Suite entry
- Generate: `guides/assets/archify/${entry.product}/${entry.id}.html` for every published entry
- Generate: `guides/assets/archify/${entry.product}/${entry.id}.receipt.json` for every published entry
- Create: `tests/contracts/archify-specs.test.mjs`

The `${entry.id}` notation is deterministic, not an unresolved filename choice: it is the exact `id` value committed in `catalog.json`, and the catalog validator rejects any spec, HTML, or receipt path that does not match this formula.

### Visual QA and guide routing

- Create: `guides/archify-diagrams/visual-qa/manifest.json`
- Create: `guides/archify-diagrams/visual-qa/renders/${entry.product}/${entry.id}/read.png`
- Create: matching `light.png`, `dark.png`, and `view-${view.id}.png`
- Create: product, used-type, and global HTML·PNG files under `guides/archify-diagrams/visual-qa/contact-sheets/`
- Create: `tooling/lib/archify-visual-qa.mjs`
- Create: `tooling/build-archify-contact-sheets.mjs`
- Create: `tests/unit/archify-visual-qa.test.mjs`
- Create: `tests/contracts/archify-visual-qa.test.mjs`
- Create: `tests/contracts/archify-guide-links.test.mjs`
- Modify: root `README.md` when it has a published selected entry
- Modify: `guides/README.md`, both product guide READMEs, and each published source section

---

### Task 1: Retire the old Task 13 Archify surface

**Files:**
- Create: `tests/contracts/archify-retirement.test.mjs`
- Delete: `guides/assets/archify/**`
- Delete: `tooling/build-archify-guides.mjs`
- Delete: `tooling/lib/archify-guides.mjs`
- Delete: `tests/unit/archify-guides.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: current Task 13 paths and `probeArchifyCapability`.
- Produces: a clean baseline where the incorrect generator and artifacts are absent while host capability detection still works.

- [ ] **Step 1: Write the failing retirement contract**

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const retired = [
  "tooling/build-archify-guides.mjs",
  "tooling/lib/archify-guides.mjs",
  "tests/unit/archify-guides.test.mjs",
  "guides/assets/archify/manifest.json",
];

test("old Task 13 Archify surface is absent", async () => {
  for (const relative of retired) {
    await assert.rejects(access(path.resolve(relative)), { code: "ENOENT" });
  }
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(Object.hasOwn(packageJson.scripts, "build:archify-guides"), false);
  assert.equal(Object.hasOwn(packageJson.scripts, "check:archify-guides"), false);
});
```

```js
test("retirement preserves the public Archify capability boundary", async () => {
  for (const expected of ["available", "unavailable", "unknown"]) {
    const context = await runCapabilityFixture(expected);
    assert.equal(context.capabilities.archify.status, expected);
    assert.equal(JSON.stringify(context.capabilities.archify).includes("/Users/"), false);
    assert.equal(Object.hasOwn(context.capabilities.archify, "path"), false);
  }
});
```

The product routing `failed` state is execution-time behavior, not a capability-probe result. Preserve it through the existing Studio and Career output-skill tests in Step 4.

- [ ] **Step 2: Run RED**

Run: `node --test tests/contracts/archify-retirement.test.mjs`

Expected: FAIL because the old builder, library, test, manifest, and npm scripts still exist.

- [ ] **Step 3: Remove only the approved old surface**

Delete all tracked files under `guides/assets/archify/`, then remove the two ignored `.DS_Store` files. Remove the old builder, old library, old unit test, and the two old npm scripts. Do not alter `shared/scripts/capability-probe.mjs` or product routing in this task.

- [ ] **Step 4: Verify retirement and retained capability**

```bash
node --test tests/contracts/archify-retirement.test.mjs tests/unit/capability-probe.test.mjs tests/products/studio/output-skills.test.mjs tests/products/career/output-skills.test.mjs
test ! -e tooling/build-archify-guides.mjs
test ! -e tooling/lib/archify-guides.mjs
test ! -e tests/unit/archify-guides.test.mjs
test ! -e guides/assets/archify
git diff --check
```

Expected: all tests PASS; no old Archify artifact directory remains.

- [ ] **Step 5: Commit the isolated removal**

```bash
git add -A guides/assets/archify tooling/build-archify-guides.mjs tooling/lib/archify-guides.mjs tests/unit/archify-guides.test.mjs tests/contracts/archify-retirement.test.mjs package.json
git commit -m "refactor: retire templated Archify guide generation"
```

### Task 2: Add the closed catalog schema and safe loader

**Files:**
- Create: `guides/archify-diagrams/catalog.schema.json`
- Create: `tooling/lib/archify-catalog.mjs`
- Create: `tooling/validate-archify-catalog.mjs`
- Create: `tests/unit/archify-catalog.test.mjs`

**Interfaces:**
- Consumes: repository root and a fixture catalog path.
- Produces: safe Markdown discovery, source hashing, state validation, and publishable-entry projection used by all later tasks.

- [ ] **Step 1: Write failing schema, path, coverage, and state tests**

```js
test("catalog requires one analysis record for every scanned Markdown", async (t) => {
  const repoRoot = await catalogFixture(t, {
    documents: ["README.md", "guides/a.md"],
    entries: [excludedEntry("README.md")],
  });
  await assert.rejects(
    () => loadArchifyCatalog({ repoRoot }),
    /uncovered source document: guides\/a\.md/u,
  );
});

test("catalog rejects unknown fields, symlinks, unsafe paths, and illegal states", async (t) => {
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: await unknownFieldFixture(t) }), /unknown field/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: await symlinkSourceFixture(t) }), /symlink/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: await traversalFixture(t) }), /contained/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: await publishedWithoutQaFixture(t) }), /published.*visual review/u);
});
```

Use this table-driven matrix in the same test file:

```js
for (const [name, build, pattern] of [
  ["NFC duplicate ID", nfcDuplicateFixture, /duplicate.*id/u],
  ["duplicate document record", duplicateDocumentFixture, /duplicate.*source document/u],
  ["two primary entries", twoPrimaryFixture, /at most one primary/u],
  ["two secondary entries", twoSecondaryFixture, /at most one secondary/u],
  ["missing secondary rationale", secondaryWithoutReasonFixture, /secondary_reason/u],
  ["stale source digest", staleDigestFixture, /stale-source/u],
  ["missing heading", missingHeadingFixture, /source_section/u],
  ["blocked publishable entry", blockedPublishableFixture, /blocked.*publish/u],
]) {
  test(`catalog rejects ${name}`, async (t) => {
    await assert.rejects(() => loadArchifyCatalog({ repoRoot: await build(t) }), pattern);
  });
}
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/archify-catalog.test.mjs`

Expected: FAIL because the loader and schema do not exist.

- [ ] **Step 3: Write the closed catalog schema**

Use these exact top-level fields:

```json
{
  "schema_version": 1,
  "scan_roots": ["README.md", "guides", "products/game-design-studio", "products/game-design-career", "plugins/game-design-studio", "plugins/game-design-career"],
  "scan_excludes": ["guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build"],
  "entries": []
}
```

Selected entry exact fields:

```json
{
  "id": "stable-id",
  "product": "studio",
  "source_document": "guides/example.md",
  "source_section": "Exact heading",
  "source_digest": "64-lowercase-hex",
  "question": "이 도식이 답하는 한 문장 질문",
  "decision": "selected",
  "decision_reason": "텍스트보다 관계를 더 명확하게 보여 주는 근거",
  "diagram_type": "workflow",
  "diagram_type_reason": "역할별 단계와 승인 분기가 핵심이기 때문",
  "priority": "primary",
  "secondary_reason": null,
  "visual_system": "studio",
  "composition_rationale": "문서 근거에 맞춘 주 경로와 분기 설명",
  "shared_process_with": null,
  "shared_process_reason": null,
  "diagnostics": [],
  "spec": "guides/archify-diagrams/specs/studio/stable-id.json",
  "html": "guides/assets/archify/studio/stable-id.html",
  "receipt": "guides/assets/archify/studio/stable-id.receipt.json",
  "delivery_status": "planned",
  "visual_review": "pending",
  "reviewer": null
}
```

Excluded entries require a concrete exclusion code and reason, an empty `diagnostics` array, null diagram paths, `delivery_status: "not-applicable"`, and `visual_review: "not-applicable"`. Blocked entries append stable diagnostic code, exact subject, measured evidence, attempted fix, round, and remaining error to `diagnostics`; they never overwrite `decision_reason`.

- [ ] **Step 4: Implement safe discovery, hashing, and validation**

```js
export const DELIVERY_STATES = Object.freeze([
  "not-applicable", "planned", "spec-authored", "auto-validated",
  "blocked-schema", "blocked-validation", "blocked-visual",
  "stale-source", "passed", "published",
]);

export async function hashArchifySource(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}

export function publishableArchifyEntries(catalog) {
  return catalog.entries.filter((entry) =>
    entry.decision === "selected"
    && ["passed", "published"].includes(entry.delivery_status)
    && entry.visual_review === "passed");
}
```

Walk scan roots using `lstat`, reject symlinks, normalize paths to NFC, require repository containment, sort deterministically, and compare the discovered Markdown set to analyzed documents. Validate exact keys and the state machine. Verify selected path formulas from `entry.id` and `entry.product`.

Path existence is state-aware: `planned` may name a deterministic future spec path that does not exist yet; `spec-authored` and every later non-blocked state require a regular contained spec file; `published` additionally requires regular contained HTML and receipt files. Structural duplicate checks run only across entries whose specs exist, so the Task 3 planning inventory remains valid before authoring.

- [ ] **Step 5: Add the validation CLI**

`tooling/validate-archify-catalog.mjs` accepts only `--list-uncovered` and `--json`. The default exits non-zero on any validation error. `--list-uncovered` prints exact repository-relative paths and exits non-zero while any document lacks analysis.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test tests/unit/archify-catalog.test.mjs
node --check tooling/lib/archify-catalog.mjs
node --check tooling/validate-archify-catalog.mjs
git diff --check
git add guides/archify-diagrams/catalog.schema.json tooling/lib/archify-catalog.mjs tooling/validate-archify-catalog.mjs tests/unit/archify-catalog.test.mjs
git commit -m "feat: add curated Archify catalog contract"
```

### Task 3: Analyze every target document and commit the selection inventory

**Files:**
- Create: `guides/archify-diagrams/catalog.json`
- Create: `guides/archify-diagrams/README.md`
- Create: `tests/contracts/archify-catalog.test.mjs`

**Interfaces:**
- Consumes: Task 2 discovery and selection rules from the approved design.
- Produces: the exact selected/excluded inventory and future spec filenames for Studio, Career, and Suite.

- [ ] **Step 1: Write the failing production coverage contract**

```js
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
```

```js
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
```

- [ ] **Step 2: Run RED and export the uncovered list**

```bash
node --test tests/contracts/archify-catalog.test.mjs
node tooling/validate-archify-catalog.mjs --list-uncovered
```

Expected: FAIL because production `catalog.json` does not exist.

- [ ] **Step 3: Review the corpus in deterministic groups**

Review in this exact order:

1. root `README.md` and `guides/README.md`
2. `guides/game-design-studio/**/*.md`
3. `guides/game-design-career/**/*.md`
4. `guides/prompt-templates/**/*.md` and `guides/use-cases/**/*.md`
5. `products/game-design-studio/**/*.md` and `products/game-design-career/**/*.md`
6. `plugins/game-design-studio/**/*.md` and `plugins/game-design-career/**/*.md`

For each document, read all headings and the body of every relationship-bearing section. Record at least one analysis entry. Choose Archify only for root and `guides/**` documents with dependent steps, role handoffs, branch·retry·hold·resume, artifact transformation, multi-component structure, timed calls, or state transitions. Use `excluded-better-as-text`, `excluded-skillstead-overlap`, `excluded-insufficient-evidence`, `excluded-package-surface`, or `excluded-package-mirror` for all other documents.

- [ ] **Step 4: Create selected entries without writing specs**

For selected entries, set `delivery_status: "planned"`, `visual_review: "pending"`, and exact deterministic paths. Write one sentence for `question`, type rationale, and composition rationale. For secondary entries, name the orthogonal question and explain why the primary cannot answer it. Do not create HTML or JSON specs in this task.

- [ ] **Step 5: Document the selection method and run GREEN**

`guides/archify-diagrams/README.md` explains the old inventory removal, every state, product differences, evidence paths, and why count is not a target.

```bash
node --test tests/unit/archify-catalog.test.mjs tests/contracts/archify-catalog.test.mjs
node tooling/validate-archify-catalog.mjs --json
git diff --check
git add guides/archify-diagrams/catalog.json guides/archify-diagrams/README.md tests/contracts/archify-catalog.test.mjs
git commit -m "docs: inventory evidence-backed Archify candidates"
```

The JSON report may show any non-negative selected count. Complete source coverage and defensible decisions are the acceptance condition.

### Task 4: Add structural signature and duplicate-template rejection

**Files:**
- Create: `tooling/lib/archify-signature.mjs`
- Create: `tests/unit/archify-signature.test.mjs`
- Modify: `tooling/lib/archify-catalog.mjs`
- Modify: `tests/contracts/archify-catalog.test.mjs`

**Interfaces:**
- Consumes: catalog entries and parsed committed specs.
- Produces: ID-independent structural signatures and duplicate findings required before delivery.

- [ ] **Step 1: Write failing label-only clone and exception tests**

```js
test("label-only workflow clones have the same structural signature", () => {
  const first = workflowFixture({ ids: ["a", "b", "c"], labels: ["입력", "검토", "완료"] });
  const second = workflowFixture({ ids: ["x", "y", "z"], labels: ["자료", "승인", "출력"] });
  assert.equal(
    structuralSignature({ type: "workflow", spec: first }),
    structuralSignature({ type: "workflow", spec: second }),
  );
});

test("duplicates require a symmetric documented shared-process exception", () => {
  assert.throws(
    () => findStructuralDuplicates({ catalog: duplicateCatalogWithoutReason(), specsById: duplicateSpecs() }),
    /shared_process_reason/u,
  );
});
```

Use this signature-difference matrix:

```js
for (const [name, type, fixture, mutate] of [
  ["branch count", "workflow", workflowFixture, addBranch],
  ["cycle", "workflow", workflowFixture, addRetryCycle],
  ["main-path length", "workflow", workflowFixture, extendMainPath],
  ["hold-resume loop", "lifecycle", lifecycleFixture, addHoldResumeLoop],
  ["lane count", "workflow", workflowFixture, addLane],
  ["boundary count", "architecture", architectureFixture, addBoundary],
  ["participant count", "sequence", sequenceFixture, addParticipant],
]) {
  test(`${name} changes the structural signature`, () => {
    const original = fixture();
    const changed = structuredClone(original);
    mutate(changed);
    assert.notEqual(
      structuralSignature({ type, spec: original }),
      structuralSignature({ type, spec: changed }),
    );
  });
}

test("diagram type participates in the signature", () => {
  assert.notEqual(
    structuralSignature({ type: "workflow", spec: workflowFixture() }),
    structuralSignature({ type: "lifecycle", spec: lifecycleFixture() }),
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/archify-signature.test.mjs`

Expected: FAIL because the signature module does not exist.

- [ ] **Step 3: Implement type adapters and canonical signature**

```js
const adapters = Object.freeze({
  architecture: { nodes: "components", edges: "connections", containers: "boundaries" },
  workflow: { nodes: "nodes", edges: "edges", containers: "lanes" },
  sequence: { nodes: "participants", edges: "messages", containers: "segments" },
  dataflow: { nodes: "nodes", edges: "flows", containers: "stages" },
  lifecycle: { nodes: "states", edges: "transitions", containers: "lanes" },
});

export function structuralSignature({ type, spec }) {
  const adapter = adapters[type];
  if (!adapter) throw new Error(`unsupported Archify diagram type: ${type}`);
  const nodes = spec[adapter.nodes] ?? [];
  const edges = spec[adapter.edges] ?? [];
  const degree = degreeSequence(nodes, edges);
  return sha256(canonicalJson({
    type,
    node_count: nodes.length,
    edge_count: edges.length,
    container_count: (spec[adapter.containers] ?? []).length,
    degree,
    branch_count: degree.filter((item) => item.out > 1).length,
    merge_count: degree.filter((item) => item.in > 1).length,
    cycle_count: countDirectedCycles(nodes, edges),
    main_path_length: Array.isArray(spec.mainPath) ? spec.mainPath.length : condensedLongestPath(nodes, edges),
    kind_distribution: distribution(nodes, "type"),
    variant_distribution: distribution(nodes, "variant"),
    relationship_distribution: distribution(edges, "variant"),
    relative_layout: relativeLayoutPattern(type, spec),
  }));
}
```

`condensedLongestPath` first collapses strongly connected components so retry cycles cannot cause unbounded traversal. `relativeLayoutPattern` quantizes rows, columns, lanes, stages, and boundaries rather than hashing exact pixels. Do not include labels, descriptions, cards, stable IDs, or source names in the signature. Exception validation is symmetric: both entries name each other, share the same signature, and provide non-empty evidence-based reasons. `findStructuralDuplicates` returns only unapproved findings; approved exceptions are reported separately in the final summary.

- [ ] **Step 4: Integrate duplicate checks and commit**

```bash
node --test tests/unit/archify-signature.test.mjs tests/unit/archify-catalog.test.mjs tests/contracts/archify-catalog.test.mjs
git diff --check
git add tooling/lib/archify-signature.mjs tooling/lib/archify-catalog.mjs tests/unit/archify-signature.test.mjs tests/contracts/archify-catalog.test.mjs
git commit -m "test: reject repeated Archify topology templates"
```

### Task 5: Add private Archify execution identity and strict receipt parsing

**Files:**
- Modify: `shared/scripts/capability-probe.mjs`
- Modify: `tests/unit/capability-probe.test.mjs`
- Create: `tooling/lib/archify-receipt.mjs`
- Create: `tests/unit/archify-receipt.test.mjs`

**Interfaces:**
- Consumes: installed Archify 2.13+ candidate and actual validate/deliver JSON.
- Produces: a pinned private CLI identity and exact persisted receipt records without exposing host paths through SessionStart.

- [ ] **Step 1: Write failing private-identity and public-redaction tests**

```js
test("execution resolver pins regular CLI bytes while public probe hides paths", async () => {
  const installation = await resolveArchifyInstallation({}, { home: fixtureHome });
  assert.equal(installation.status, "available");
  assert.match(installation.cli.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(typeof installation.cli.dev, "bigint");
  const publicResult = await probeArchifyCapability({}, { home: fixtureHome });
  assert.deepEqual(Object.keys(publicResult).sort(), ["provider", "status", "version"]);
});
```

Add replacement, parent symlink, unsupported SemVer, malformed metadata, missing higher root, and inaccessible root cases. Public capability behavior remains byte-compatible.

- [ ] **Step 2: Write failing receipt mutation tests**

```js
test("deliver receipt rejects omitted showcase status and strips nested extras", () => {
  assert.throws(() => validateArchifyDeliverReceipt(deliverReceipt({ compositionProfile: undefined })), /showcase/u);
  assert.throws(() => validateArchifyDeliverReceipt(deliverReceipt({ compositionStatus: undefined })), /pass/u);
  const saved = toPersistedArchifyReceipt(deliverReceipt({
    specification: { sha256: DIGEST, bytes: 100, debugPath: "file:///private/secret" },
  }), stablePaths());
  assert.deepEqual(Object.keys(saved.specification).sort(), ["bytes", "sha256"]);
});
```

Use explicit validate and deliver mutation matrices:

```js
for (const [name, mutate, pattern] of [
  ["schemaVersion", (r) => { r.schemaVersion = 999; }, /schemaVersion/u],
  ["ok", (r) => { r.ok = false; }, /ok/u],
  ["command", (r) => { r.command = "preview"; }, /command/u],
  ["type", (r) => { r.type = "unknown"; }, /type/u],
  ["duplicate check", (r) => { r.checks[1].name = r.checks[0].name; }, /invalid artifact check/u],
  ["false check", (r) => { r.checks[0].ok = false; }, /artifact check/u],
  ["wrong check count", (r) => { r.checks.pop(); }, /9/u],
  ["errors", (r) => { r.composition.summary.errors = 1; }, /errors/u],
  ["warnings", (r) => { r.composition.summary.warnings = 1; }, /warnings/u],
  ["profile", (r) => { r.composition.profile = "standard"; }, /showcase/u],
  ["status", (r) => { r.composition.status = "fail"; }, /composition/u],
]) {
  test(`validate receipt rejects ${name}`, () => {
    const receipt = validateReceipt();
    mutate(receipt);
    assert.throws(() => validateArchifyValidateReceipt(receipt), pattern);
  });
}

for (const [name, mutate, pattern] of [
  ["wrong count", (r) => { r.validation.checkCount = 8; }, /9/u],
  ["errors", (r) => { r.validation.errors = 1; }, /errors/u],
  ["warnings", (r) => { r.validation.warnings = 1; }, /warnings/u],
  ["profile", (r) => { r.validation.compositionProfile = "standard"; }, /showcase/u],
  ["status", (r) => { r.validation.compositionStatus = "fail"; }, /pass/u],
  ["digest", (r) => { r.artifact.sha256 = "0".repeat(64); }, /digest/u],
  ["bytes", (r) => { r.artifact.bytes += 1; }, /byte count/u],
]) {
  test(`deliver receipt rejects ${name}`, () => {
    const receipt = deliverReceipt();
    mutate(receipt);
    assert.throws(() => validateArchifyDeliverReceipt(receipt, fixtureFiles()), pattern);
  });
}

for (const leaked of [
  "/private/secret", "C:\\secret\\file", "file:///private/secret",
  "../../escape", ".curated-archify-temp/path",
]) {
  test(`persisted receipt omits unsafe extra ${leaked}`, () => {
    const receipt = deliverReceipt();
    receipt.specification.debugPath = leaked;
    const saved = toPersistedArchifyReceipt(receipt, stablePaths());
    assert.equal(JSON.stringify(saved).includes(leaked), false);
  });
}
```

- [ ] **Step 3: Run RED**

Run: `node --test tests/unit/capability-probe.test.mjs tests/unit/archify-receipt.test.mjs`

Expected: receipt tests fail because the new parser does not exist; the new private identity test fails.

- [ ] **Step 4: Refactor capability resolution without exposing paths**

```js
export async function resolveArchifyInstallation(env = process.env, options = {}) {
  const result = await inspectConfiguredArchifyCandidates(env, options);
  if (result.status !== "available") return result;
  const bytes = await readFile(result.cliPath);
  const stats = await lstat(result.cliPath, { bigint: true });
  return {
    status: "available",
    provider: "host-archify-skill",
    version: result.version,
    cli: Object.freeze({
      path: result.cliPath,
      realpath: await realpath(result.cliPath),
      dev: stats.dev,
      ino: stats.ino,
      size: stats.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  };
}

export async function probeArchifyCapability(env = process.env, options = {}) {
  const result = await resolveArchifyInstallation(env, options);
  if (result.status !== "available") return result;
  return { status: result.status, provider: result.provider, version: result.version };
}
```

Preserve the current candidate precedence and fail-closed terminal behavior for malformed or unsupported higher-priority installations.

- [ ] **Step 5: Implement exact receipt validation and persisted allowlist**

Persist only:

```js
return Object.freeze({
  schemaVersion: 1,
  ok: true,
  command: "deliver",
  type: receipt.type,
  quality: "showcase",
  checksPassed: 9,
  checkCount: 9,
  errors: 0,
  warnings: 0,
  compositionProfile: "showcase",
  compositionStatus: "pass",
  input: stablePaths.input,
  output: stablePaths.output,
  specification: { sha256: receipt.specification.sha256, bytes: receipt.specification.bytes },
  artifact: { sha256: receipt.artifact.sha256, bytes: receipt.artifact.bytes },
});
```

Reject all missing required values and all digest/byte mismatches before producing this record.

- [ ] **Step 6: Run GREEN and commit**

```bash
node --test tests/unit/capability-probe.test.mjs tests/unit/archify-receipt.test.mjs
node --check shared/scripts/capability-probe.mjs
node --check tooling/lib/archify-receipt.mjs
git diff --check
git add shared/scripts/capability-probe.mjs tests/unit/capability-probe.test.mjs tooling/lib/archify-receipt.mjs tests/unit/archify-receipt.test.mjs
git commit -m "feat: pin Archify execution and receipt identity"
```

### Task 6: Build the topology-free staging, check, and publication pipeline

**Files:**
- Create: `tooling/lib/archify-delivery.mjs`
- Create: `tooling/build-curated-archify.mjs`
- Create: `tests/unit/archify-delivery.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: catalog, committed specs, structural signatures, pinned CLI, strict receipts, and visual QA manifest.
- Produces: ignored staging artifacts, deterministic check results, and one atomic publication of passed entries.

- [ ] **Step 1: Write failing no-topology, staging, and exact-set tests**

```js
test("delivery cannot synthesize topology when a selected spec is missing", async (t) => {
  const repoRoot = await selectedCatalogWithoutSpecFixture(t);
  await assert.rejects(() => stageCuratedArchify({ repoRoot }), /missing committed Archify spec/u);
  await assert.rejects(access(path.join(repoRoot, ".tmp/curated-archify/current")), { code: "ENOENT" });
});

test("catalog wording changes never create or rewrite a spec", async (t) => {
  const repoRoot = await validDeliveryFixture(t);
  const before = await readFile(specPath(repoRoot));
  await rewriteCatalogQuestion(repoRoot, "다른 질문 문구");
  await assert.rejects(() => stageCuratedArchify({ repoRoot }), /source or catalog drift/u);
  assert.deepEqual(await readFile(specPath(repoRoot)), before);
});
```

Add check-mode stale extra-file detection and exact passed-only output set assertions.

- [ ] **Step 2: Write failing security and recovery tests**

Cover the exact failure seams with this table-driven fake-CLI matrix:

- CLI regular-file replacement between validate and deliver
- stage parent symlink swap and swap-back during deliver
- delivered HTML symlink
- nondeterministic deliver bytes between stage and check
- backup rename failure
- publish rename failure
- post-publish verification failure
- temporary cleanup failure
- backup cleanup partial failure after a committed publication
- rollback restore failure producing an `AggregateError` with original and rollback causes
- no-prior-output failure leaving no new output
- successful rollback leaving no `.curated-archify-*` private sibling

```js
for (const seam of [
  "replace-cli-after-validate",
  "swap-stage-parent-and-restore",
  "symlink-delivered-html",
  "nondeterministic-deliver",
  "fail-backup-rename",
  "fail-publish-rename",
  "fail-post-publish-verification",
  "fail-temp-cleanup",
  "partially-fail-backup-cleanup",
  "fail-rollback-restore",
  "fail-without-prior-output",
  "rollback-without-private-siblings",
]) {
  test(`delivery fails closed at ${seam}`, async (t) => {
    const fixture = await deliveryFailureFixture(t, seam);
    await assert.rejects(() => publishCuratedArchify(fixture), fixture.expectedError);
    await assertTrustedTree(fixture);
    await assertExternalSentinelsUnchanged(fixture);
  });
}
```

- [ ] **Step 3: Run RED**

Run: `node --test tests/unit/archify-delivery.test.mjs`

Expected: FAIL because the delivery module does not exist.

- [ ] **Step 4: Implement pinned CLI execution and staging**

```js
export async function stageCuratedArchify({ repoRoot, ids = [], product = null }) {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const selected = selectPlannedEntries(catalog, { ids, product });
  const cli = await pinArchifyCli({ env: process.env });
  const stage = await createGuardedTempRoot({
    parent: path.join(repoRoot, ".tmp"),
    prefix: "curated-archify-",
  });
  try {
    const records = [];
    for (const entry of selected) {
      await assertPinnedArchifyCli(cli);
      const spec = await readCommittedSpec(repoRoot, entry);
      const validation = await runArchify(cli, ["validate", entry.diagram_type, spec.path, "--quality", "showcase", "--json"]);
      validateArchifyValidateReceipt(validation);
      await assertPinnedArchifyCli(cli);
      const delivered = await deliverIntoPinnedWorkflowDirectory({ cli, stage, entry, spec });
      records.push(validateDeliveredRecord({ entry, spec, delivered }));
    }
    return await commitStageCandidate({ repoRoot, stage, records });
  } catch (error) {
    await cleanupGuardedTempRoot(stage);
    throw error;
  }
}
```

`readCommittedSpec` only reads `entry.spec`; no function in this module may construct type fields. Before and after each spawn, re-check CLI realpath, dev, ino, size, and sha256. Pin each workflow directory identity across delivery.

- [ ] **Step 5: Implement check and atomic publish**

`stage` writes to `.tmp/curated-archify/current/` for headless QA and never touches `guides/assets/archify/`. `check` re-delivers into a guarded temporary root and compares committed HTML·receipt bytes, exact managed set, source digests, spec digests, and QA binding. `publish` re-delivers all publishable entries, requires artifact digests to match passed QA records, then atomically replaces `guides/assets/archify/`.

Before the first stage, create `.tmp` only after verifying the repository root is a non-symlink directory; then verify `.tmp` is a contained non-symlink directory and pin its identity. `guides/assets/VISUAL-QA.md` remains inside the analysis corpus because only the retired `guides/assets/archify` subtree is excluded.

Cleanup after a successful commit is non-transactional: a backup cleanup failure reports cleanup failure but never rolls back to a partially deleted backup. A failed commit restores the complete previous trusted tree or preserves forensic paths and throws `AggregateError`.

- [ ] **Step 6: Add the thin CLI and npm scripts**

Accepted arguments are only `--stage`, `--check`, `--publish`, repeated `--id`, and one `--product studio|career|suite`. No opener flag exists.

```json
"validate:archify-catalog": "node tooling/validate-archify-catalog.mjs",
"build:curated-archify": "node tooling/build-curated-archify.mjs --stage",
"check:curated-archify": "node tooling/build-curated-archify.mjs --check",
"publish:curated-archify": "node tooling/build-curated-archify.mjs --publish"
```

- [ ] **Step 7: Run GREEN and commit**

```bash
node --test tests/unit/archify-delivery.test.mjs tests/unit/archify-receipt.test.mjs tests/unit/archify-signature.test.mjs tests/unit/archify-catalog.test.mjs
node --check tooling/lib/archify-delivery.mjs
node --check tooling/build-curated-archify.mjs
git diff --check
git add tooling/lib/archify-delivery.mjs tooling/build-curated-archify.mjs tests/unit/archify-delivery.test.mjs package.json
git commit -m "feat: add curated Archify delivery pipeline"
```

### Task 7: Hand-author and validate the Studio specifications

**Files:**
- Create: exact `guides/archify-diagrams/specs/studio/${entry.id}.json` files declared by selected Studio entries
- Modify: `guides/archify-diagrams/catalog.json`
- Create: `tests/contracts/archify-specs.test.mjs`

**Interfaces:**
- Consumes: selected Studio entries and installed Archify schemas/examples.
- Produces: fresh Studio specs with source-bound topology and `delivery_status: auto-validated`.

- [ ] **Step 1: Write the failing production spec contract**

```js
test("every selected Studio entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const studio = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "studio");
  for (const entry of studio) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "studio");
    assert.ok(entry.composition_rationale.length >= 20);
  }
});
```

```js
test("Studio specs remain source-bound and do not recreate the retired six-node template", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "studio");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "studio")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='selected Studio' tests/contracts/archify-specs.test.mjs`

Expected: FAIL for the first missing Studio spec.

- [ ] **Step 3: Author each Studio spec independently**

For each selected entry:

1. Read the complete source section and adjacent constraints.
2. Read only the matching Archify type schema, `common.schema.json`, and nearest example.
3. Write a new spec before inspecting renderer internals.
4. Use one obvious main path, short source-backed branches, sparse labels, and no more than 12 primary nodes.
5. Express ownership, artifact transformation, feasibility, playtest, and review boundaries only when the source supports them.
6. Start with automatic routes and add one geometry control only after a diagnostic identifies its subject.

- [ ] **Step 4: Validate after every edit and stage the product**

```bash
node /Users/freelife/.agents/skills/archify/bin/archify.mjs doctor
npm run build:curated-archify -- --id "$ARCHIFY_ENTRY_ID"
```

Before each run, set `ARCHIFY_ENTRY_ID` to the exact `id` of the current selected catalog object. The builder reads its `diagram_type` and `spec` directly and invokes the exact Archify validate·deliver commands. Accept only 9/9, errors 0, warnings 0. Set `spec-authored` immediately after the committed JSON exists, then `auto-validated` only after delivery succeeds. Stop after two non-improving rounds, set `blocked-validation`, and append the exact diagnostic without changing the original selection reason.

- [ ] **Step 5: Set honest states, run GREEN, and commit**

Successful entries become `auto-validated`; `visual_review` remains `pending`.

```bash
node --test --test-name-pattern='Studio|duplicate' tests/contracts/archify-specs.test.mjs tests/unit/archify-signature.test.mjs
npm run build:curated-archify -- --product studio
git diff --check
git add guides/archify-diagrams/specs/studio guides/archify-diagrams/catalog.json tests/contracts/archify-specs.test.mjs
git commit -m "docs: author evidence-backed Studio Archify specs"
```

### Task 8: Hand-author and validate the Career specifications

**Files:**
- Create: exact `guides/archify-diagrams/specs/career/${entry.id}.json` files declared by selected Career entries
- Modify: `guides/archify-diagrams/catalog.json`
- Modify: `tests/contracts/archify-specs.test.mjs`

**Interfaces:**
- Consumes: selected Career entries and the shared spec contract.
- Produces: fresh Career specs with evidence, human review, hold·resume semantics, and `delivery_status: auto-validated`.

- [ ] **Step 1: Add the failing Career production contract**

```js
test("every selected Career entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const career = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "career");
  for (const entry of career) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "career");
    assert.match(entry.composition_rationale, /증거|검토|학습|승인|재개/u);
  }
});
```

Add source-backed assertions that hiring outcomes are not guaranteed, human approval is topology when it is the question, and a recoverable lifecycle failure has a real transition back to active state.

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='selected Career' tests/contracts/archify-specs.test.mjs`

Expected: FAIL for the first missing Career spec.

- [ ] **Step 3: Author, validate, and stage each Career spec**

Use the Task 7 schema-first sequence. Express evidence flow, student work, mentor feedback, disclosure boundaries, hold, resume, and next learning target only when present in the exact source. Never convert human review into automatic approval or a guaranteed recruiting result.

```bash
npm run build:curated-archify -- --id "$ARCHIFY_ENTRY_ID"
```

Before each run, set `ARCHIFY_ENTRY_ID` to the exact `id` of the current selected Career catalog object. Set `spec-authored` after the JSON exists and `auto-validated` only after the per-ID stage command succeeds.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test --test-name-pattern='Career|duplicate|lifecycle' tests/contracts/archify-specs.test.mjs tests/unit/archify-signature.test.mjs
npm run build:curated-archify -- --product career
git diff --check
git add guides/archify-diagrams/specs/career guides/archify-diagrams/catalog.json tests/contracts/archify-specs.test.mjs
git commit -m "docs: author evidence-backed Career Archify specs"
```

### Task 9: Hand-author and validate the cross-plugin Suite specifications

**Files:**
- Create: exact `guides/archify-diagrams/specs/suite/${entry.id}.json` files declared by selected Suite entries
- Modify: `guides/archify-diagrams/catalog.json`
- Modify: `tests/contracts/archify-specs.test.mjs`

**Interfaces:**
- Consumes: Suite selections that require both Studio and Career to answer one question.
- Produces: bounded handoff diagrams with real product boundaries and no merged mega-diagram.

- [ ] **Step 1: Add the failing Suite boundary contract**

```js
test("Suite specs exist only for questions that cross both product boundaries", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    assert.match(entry.decision_reason, /Studio/u);
    assert.match(entry.decision_reason, /Career/u);
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.ok(hasNamedProductBoundary(spec, "Studio"));
    assert.ok(hasNamedProductBoundary(spec, "Career"));
  }
});
```

```js
test("Suite specs stay bounded and do not concatenate both product graphs", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    const spec = specsById.get(entry.id);
    assert.ok(primaryNodeCount(spec) <= 12, entry.id);
    assert.equal(containsCompleteProductGraph(spec, "studio"), false, entry.id);
    assert.equal(containsCompleteProductGraph(spec, "career"), false, entry.id);
  }
});
```

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern='Suite' tests/contracts/archify-specs.test.mjs`

Expected: FAIL for the first missing Suite spec when Suite selections exist. If the analyzed catalog has zero Suite selections, the test passes with an explicit zero-selection assertion and no spec is invented.

- [ ] **Step 3: Author only selected Suite specs**

Show exact handoff artifacts, owners, approval boundaries, and return paths. Keep product internals collapsed to the minimum nodes needed for the cross-product question.

- [ ] **Step 4: Validate the complete spec corpus and commit**

```bash
npm run build:curated-archify -- --product suite
node --test tests/contracts/archify-specs.test.mjs tests/unit/archify-signature.test.mjs
npm run validate:archify-catalog
git diff --check
git add guides/archify-diagrams/specs/suite guides/archify-diagrams/catalog.json tests/contracts/archify-specs.test.mjs
git commit -m "docs: author evidence-backed Suite Archify specs"
```

If Suite has zero selected entries, omit the empty directory and commit only a changed strengthened contract.

### Task 10: Add the visual QA evidence contract and contact-sheet builder

**Files:**
- Create: `guides/archify-diagrams/visual-qa/manifest.json`
- Create: `tooling/lib/archify-visual-qa.mjs`
- Create: `tooling/build-archify-contact-sheets.mjs`
- Create: `tests/unit/archify-visual-qa.test.mjs`
- Create: `tests/contracts/archify-visual-qa.test.mjs`

**Interfaces:**
- Consumes: staged HTML, catalog, spec/artifact digests, and committed screenshots.
- Produces: fail-closed visual review records and deterministic contact-sheet HTML.

- [ ] **Step 1: Write failing manifest and mutation tests**

```js
test("passed visual review requires every view and every defect check", async (t) => {
  const fixture = await visualQaFixture(t, { omit: "dark" });
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture }), /missing dark render/u);
});

test("visual review cannot pass with an unchecked defect class", async (t) => {
  const fixture = await visualQaFixture(t, { checks: { edge_node_collision: null } });
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture }), /edge_node_collision/u);
});
```

Use this mutation matrix:

```js
for (const [name, mutate, pattern] of [
  ["PNG signature", replacePngWithText, /PNG signature/u],
  ["zero dimensions", (q) => { q.entries[0].renders.read.width = 0; }, /dimensions/u],
  ["render digest", corruptReadDigest, /render digest/u],
  ["guided view", removeRequiredGuidedView, /guided view/u],
  ["spec digest", corruptSpecificationDigest, /specification digest/u],
  ["artifact digest", corruptArtifactDigest, /artifact digest/u],
  ["third correction", (q) => { q.entries[0].correction_rounds = 3; }, /correction_rounds/u],
  ["reviewer", (q) => { q.entries[0].reviewer = ""; }, /reviewer/u],
  ["published failure", markFailedEntryPublished, /published.*passed/u],
  ["stale source", markEntryStale, /stale-source/u],
  ["duplicate render path", duplicateRenderPath, /duplicate render/u],
  ["contact-sheet omission", removeEntryFromAllSheet, /contact sheet/u],
]) {
  test(`visual QA rejects ${name}`, async (t) => {
    const fixture = await visualQaMutationFixture(t, mutate);
    await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture }), pattern);
  });
}
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/archify-visual-qa.test.mjs tests/contracts/archify-visual-qa.test.mjs`

Expected: FAIL because the QA module and manifest do not exist.

- [ ] **Step 3: Define the exact QA entry contract**

```json
{
  "id": "catalog-id",
  "specification_sha256": "64-lowercase-hex",
  "artifact_sha256": "64-lowercase-hex",
  "reviewer": "named-agent-or-human",
  "review_method": "headless-agent-browser + original-size image reader",
  "correction_rounds": 0,
  "verdict": "passed",
  "renders": {
    "read": { "path": "renders/studio/catalog-id/read.png", "sha256": "64-lowercase-hex", "width": 1600, "height": 1200 },
    "light": { "path": "renders/studio/catalog-id/light.png", "sha256": "64-lowercase-hex", "width": 1600, "height": 1200 },
    "dark": { "path": "renders/studio/catalog-id/dark.png", "sha256": "64-lowercase-hex", "width": 1600, "height": 1200 },
    "guided_views": []
  },
  "checks": {
    "text_clipping": "passed",
    "glyph_distortion": "passed",
    "blur_or_tofu": "passed",
    "node_text_collision": "passed",
    "edge_node_collision": "passed",
    "edge_label_collision": "passed",
    "ambiguous_corridor": "passed",
    "branch_merge_retry_resume": "passed",
    "rail_legend_footer": "passed",
    "light_dark_contrast": "passed",
    "guided_view_usefulness": "passed",
    "within_product_diversity": "passed",
    "cross_product_distinction": "passed"
  },
  "defects": []
}
```

Failed entries require at least one defect with exact view, subject, symptom, and correction outcome. A blocked entry may not use `verdict: passed`.

- [ ] **Step 4: Implement validation and deterministic contact-sheet HTML**

```js
export function renderArchifyContactSheets({ catalog, qa }) {
  const passed = qa.entries.filter((entry) => entry.verdict === "passed");
  return new Map([
    ["all.html", renderSheet("All curated Archify diagrams", passed)],
    ...groupSheets("product", passed),
    ...groupSheets("type", passed, catalog),
  ]);
}
```

Contact sheets display ID, question, type, product, source link, and the READ screenshot. Sort by product, type, then ID. Escape all HTML. The builder has `--check` and compares exact HTML bytes; it does not mark any review passed.

- [ ] **Step 5: Run GREEN and commit the contract with an empty pending manifest**

```bash
node --test tests/unit/archify-visual-qa.test.mjs tests/contracts/archify-visual-qa.test.mjs
node --check tooling/lib/archify-visual-qa.mjs
node --check tooling/build-archify-contact-sheets.mjs
git diff --check
git add guides/archify-diagrams/visual-qa/manifest.json tooling/lib/archify-visual-qa.mjs tooling/build-archify-contact-sheets.mjs tests/unit/archify-visual-qa.test.mjs tests/contracts/archify-visual-qa.test.mjs
git commit -m "test: require full Archify visual QA evidence"
```

The initial manifest contains `schema_version: 1` and an empty `entries` array. Production tests allow this only while no catalog entry is `passed` or `published`.

### Task 11: Perform headless full visual QA and correct defects

**Files:**
- Create: all required files under `guides/archify-diagrams/visual-qa/renders/`
- Create: all required files under `guides/archify-diagrams/visual-qa/contact-sheets/`
- Modify: `guides/archify-diagrams/visual-qa/manifest.json`
- Modify: affected specs under `guides/archify-diagrams/specs/`
- Modify: `guides/archify-diagrams/catalog.json`

**Interfaces:**
- Consumes: Task 6 stage output and Task 10 QA contract.
- Produces: actual inspected render evidence, corrected specs, passed/blocked states, and whole-corpus diversity evidence.

- [ ] **Step 1: Rebuild a clean stage and verify Archify**

```bash
node /Users/freelife/.agents/skills/archify/bin/archify.mjs doctor
npm run build:curated-archify
```

Expected: doctor PASS and one staged HTML per auto-validated entry under `.tmp/curated-archify/current/`.

- [ ] **Step 2: Load the current headless browser contract**

```bash
agent-browser skills get core --full
ARCHIFY_QA_SESSION="$(agent-browser session id --scope worktree --prefix archify-qa)"
agent-browser --session "$ARCHIFY_QA_SESSION" session info
```

Use the task-scoped session ID returned above when visual QA benefits from isolation; no pre-existing named session is required. Keep that ID on browser commands that share state, and do not pass `--headed`. Inspect tabs before each new artifact and close only tabs owned by this task. Do not use Archify `--open` or preview.

- [ ] **Step 3: Capture READ, light, dark, and every guided view**

For each staged HTML:

```bash
test -n "$QA_ID" && test -f "$QA_HTML" && mkdir -p "$QA_RENDER_ROOT"
agent-browser --session "$ARCHIFY_QA_SESSION" tab new --label "archify-qa-$QA_ID" "file://$QA_HTML"
agent-browser --session "$ARCHIFY_QA_SESSION" wait --load domcontentloaded
agent-browser --session "$ARCHIFY_QA_SESSION" eval "localStorage.removeItem('archify-theme'); location.reload()"
agent-browser --session "$ARCHIFY_QA_SESSION" wait --load domcontentloaded
agent-browser --session "$ARCHIFY_QA_SESSION" screenshot --full "$QA_RENDER_ROOT/read.png"
agent-browser --session "$ARCHIFY_QA_SESSION" eval "localStorage.setItem('archify-theme','light'); location.reload()"
agent-browser --session "$ARCHIFY_QA_SESSION" wait --load domcontentloaded
agent-browser --session "$ARCHIFY_QA_SESSION" screenshot --full "$QA_RENDER_ROOT/light.png"
agent-browser --session "$ARCHIFY_QA_SESSION" eval "localStorage.setItem('archify-theme','dark'); location.reload()"
agent-browser --session "$ARCHIFY_QA_SESSION" wait --load domcontentloaded
agent-browser --session "$ARCHIFY_QA_SESSION" screenshot --full "$QA_RENDER_ROOT/dark.png"
agent-browser --session "$ARCHIFY_QA_SESSION" snapshot -i
```

Before each capture, bind `QA_ID`, `QA_HTML`, and `QA_RENDER_ROOT` from the current entry in the JSON stage report. Re-snapshot after every state-changing click, activate each authored guided view by its exact `meta.views[].label`, capture `view-${view.id}.png`, then close the task tab before the next artifact.

- [ ] **Step 4: Inspect every image at fit and original size**

Use the local image reader on every READ, light, dark, and guided-view PNG. Inspect fit-to-page first for path readability and original size second for text and connector details. Record every defect against the exact entry, view, and node or relationship subject. Decide every check key from Task 10; a contact sheet does not replace original-size inspection.

- [ ] **Step 5: Apply at most two focused correction rounds**

For each failed entry:

1. Record the visible defect before editing.
2. Change only the diagnosed spec subject.
3. Run Archify validate and deliver again.
4. Rebuild the stage.
5. Recapture every affected view.
6. Reinspect the affected view and one unaffected control view.

If two rounds do not resolve the defect, set `delivery_status: "blocked-visual"`, `visual_review: "failed"`, keep the defect record, and exclude the entry from publication.

- [ ] **Step 6: Build and inspect product, type, and global contact sheets**

```bash
node tooling/build-archify-contact-sheets.mjs
```

Open each contact-sheet HTML headlessly, capture the matching PNG, and inspect it with the image reader. Reject label-only clones, repeated lane/card templates, or product systems that are visually indistinguishable without reading titles. A spec change consumes one correction round for the affected entry and requires validation, delivery, and recapture.

- [ ] **Step 7: Bind the final QA manifest and catalog states**

For each passed entry, record actual screenshot digest and dimensions, staged specification and artifact digests, named reviewer, inspection method, correction round, all passed checks, and no unresolved defects. Set catalog `delivery_status: "passed"`, `visual_review: "passed"`, and the same reviewer.

- [ ] **Step 8: Verify the complete QA corpus and commit**

```bash
node --test tests/unit/archify-visual-qa.test.mjs tests/contracts/archify-visual-qa.test.mjs tests/contracts/archify-specs.test.mjs
node tooling/build-archify-contact-sheets.mjs --check
npm run validate:archify-catalog
git diff --check
agent-browser --session "$ARCHIFY_QA_SESSION" close
git add guides/archify-diagrams/catalog.json guides/archify-diagrams/specs guides/archify-diagrams/visual-qa
git commit -m "docs: verify curated Archify diagrams visually"
```

### Task 12: Publish passed diagrams and connect them to user guides

**Files:**
- Generate: exact passed files under `guides/assets/archify/`
- Modify: `guides/archify-diagrams/catalog.json`
- Modify: `guides/archify-diagrams/README.md`
- Modify: root `README.md` when selected and published
- Modify: `guides/README.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `guides/game-design-career/README.md`
- Modify: each passed source Markdown section under root or `guides/**`
- Create: `tests/contracts/archify-guide-links.test.mjs`

**Interfaces:**
- Consumes: passed QA records and matching re-delivered artifact digests.
- Produces: trusted published HTML/receipts and user-facing links only for passed entries.

- [ ] **Step 1: Write the failing publication-link contract**

```js
test("only published and visually passed Archify entries are linked from guides", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const links = await collectProductionArchifyLinks(repoRoot);
  const expected = catalog.entries
    .filter((entry) => entry.delivery_status === "published" && entry.visual_review === "passed")
    .map((entry) => entry.html)
    .sort();
  assert.deepEqual(links.sort(), expected);
});
```

Add tests that every linked file and receipt exist, every source section matches the catalog, blocked/stale/excluded entries have no production link, and old `flow.html` paths never return.

- [ ] **Step 2: Run RED**

Run: `node --test tests/contracts/archify-guide-links.test.mjs`

Expected: FAIL because passed entries are not published or linked.

- [ ] **Step 3: Publish through the verified transaction**

```bash
npm run publish:curated-archify
```

The command re-delivers from committed specs, matches QA digests, writes only passed entries, and atomically replaces the managed tree. After publication, change only corresponding catalog states from `passed` to `published` and rerun `check:curated-archify`.

- [ ] **Step 4: Add readable guide links**

At each published source section, add a short Markdown block containing the question, diagram type, relative HTML link, relative spec link, and relative visual QA evidence link. Do not insert links for blocked or excluded entries. Add the curated index to `guides/README.md` and both product guide READMEs. Update root README only when the catalog selected it; never add package-external links to `products/*` or edit generated `plugins/*` mirrors. The catalog README lists published and blocked entries separately.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test tests/contracts/archify-guide-links.test.mjs tests/contracts/archify-catalog.test.mjs tests/contracts/archify-specs.test.mjs tests/contracts/archify-visual-qa.test.mjs
npm run check:curated-archify
npm run validate:guides
git diff --check
git add guides/assets/archify guides/archify-diagrams/catalog.json guides/archify-diagrams/README.md guides/README.md guides/game-design-studio/README.md guides/game-design-career/README.md tests/contracts/archify-guide-links.test.mjs
git commit -m "docs: publish verified curated Archify diagrams"
```

Before the commit, stage each additional published root or guide `source_document` path individually from the validated catalog report. Do not stage whole guide directories.

### Task 13: Run complete verification and independent review

**Files:**
- Modify only files required by verified review findings
- Record ignored reports under `.superpowers/sdd/2026-08-10-curated-archify-rebuild/`

**Interfaces:**
- Consumes: the complete branch.
- Produces: fresh end-to-end evidence, Important-or-higher review closure, and a clean worktree.

- [ ] **Step 1: Run targeted Archify verification from a clean stage**

```bash
node /Users/freelife/.agents/skills/archify/bin/archify.mjs doctor
npm run validate:archify-catalog
npm run check:curated-archify
node tooling/build-archify-contact-sheets.mjs --check
node --test tests/unit/archify-catalog.test.mjs tests/unit/archify-signature.test.mjs tests/unit/archify-receipt.test.mjs tests/unit/archify-delivery.test.mjs tests/unit/archify-visual-qa.test.mjs
node --test tests/contracts/archify-retirement.test.mjs tests/contracts/archify-catalog.test.mjs tests/contracts/archify-specs.test.mjs tests/contracts/archify-visual-qa.test.mjs tests/contracts/archify-guide-links.test.mjs
```

Expected: every command exits 0; every published artifact exists exactly once; no old Task 13 path exists.

- [ ] **Step 2: Run repository-wide verification sequentially**

```bash
npm run build
npm run validate:guides
npm run validate
npm test
git diff --check
git status --short
```

Expected: all commands exit 0. `git status --short` shows only intentional generated changes from the build; commit them only when required canonical snapshots changed. The protected main-checkout `package-lock.json` remains unchanged and untracked.

- [ ] **Step 3: Request independent code and visual review**

Use `superpowers:requesting-code-review` for the full change range. Require reviewers to check:

- old Task 13 removal completeness
- no topology generation or cloned spec template
- catalog coverage and state integrity
- structural duplicate false-negative and false-positive risk
- CLI identity, receipt, path, transaction, rollback, cleanup, and nondeterminism boundaries
- only passed entries published and linked
- actual full-size visual QA evidence for every view
- Studio/Career/Suite distinction and within-product diversity

Any Critical or Important finding blocks completion. Fix findings with RED mutation tests, rerun targeted and full verification, and request re-review.

- [ ] **Step 4: Verify worktree and commit review fixes**

```bash
git diff --check
git status --short
git log --oneline --decorate -15
```

If review fixes changed tracked files, stage the explicit paths shown by `git status --short` and commit them with `git commit -m "fix: close curated Archify review findings"`. Never use a broad path that could include unrelated user work.

- [ ] **Step 5: Report final completion evidence**

Report selected, excluded, blocked, and published counts; published counts by product and type; exact 9/9 receipt count; visual QA passed count and correction-round distribution; structural duplicate exceptions; full test results; final review verdicts; remaining blocked IDs; commit range; and clean-worktree status.

Do not claim completion if any published entry lacks current source digest, current spec/artifact receipt, all required screenshots, or a passed visual review.

---

## Execution Notes

- Tasks 1–6 are sequential because each establishes a contract used by the next task.
- Tasks 7, 8, and 9 may run in parallel only after Task 6 because their spec directories are disjoint. The leader must serialize shared `catalog.json` updates or merge three temporary entry patches by ID to prevent lost updates.
- Task 10 lands before Task 11.
- Task 11 is a serialized visual-review lane because every image needs an individual verdict and the capture sequence must preserve deterministic browser state.
- Tasks 12 and 13 are sequential integration and verification work.
- Use fresh reviewers for Task 13; spec authors must not self-approve their own visual diversity findings.
