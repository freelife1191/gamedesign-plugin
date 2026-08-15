# Game Reference Intelligence and Glossary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경쟁·레퍼런스 게임의 근거 기반 시스템 분석을 Studio와 Career에서 공유하고, 승인된 한·영 용어 사전을 프로젝트 문서에 결속한다.

**Architecture:** 새 `shared/reference-intelligence` 모듈이 닫힌 스키마, 시스템 Atlas, 근거 정책, 두 공통 스킬과 템플릿을 소유한다. 순수 Node 런타임은 근거·온톨로지·분석·설계 전환과 glossary snapshot을 결정적으로 검증하고 안전한 artifact writer로 결과를 기록하며, Studio와 Career는 같은 분석 ID를 제품별 문서로 투영한다.

**Tech Stack:** Node.js `>=18` ESM, JSON Schema 2020-12, JSON-compatible YAML, SHA-256, `node:test`, 기존 `safe-artifact-write.mjs`, 기존 제품 라우팅·build snapshot 계약

**Spec:** `docs/superpowers/specs/2026-08-13-game-reference-intelligence-and-glossary-design.md`

## Global Constraints

- 외부 런타임 의존성을 추가하지 않고 Node.js `>=18` 표준 라이브러리만 사용한다.
- 직접 플레이·공식 자료·보조 자료를 구분하고 관찰, 추론, 가설과 미확인 항목을 서로 승격하지 않는다.
- 기본 레퍼런스 역할은 직접 경쟁작 1개, 핵심 시스템 우수 사례 1개, 운영·BM 비교작 1개다.
- 장르 관습은 분석 질문이며 자동 설계 의무가 아니다.
- 설계 전환은 `adopt`, `adapt`, `reject`, `hold` 중 하나이며 사람 검토 전 `pending-review`다.
- 공통 glossary와 프로젝트 overlay는 언어 중립 `TERM-...` ID로 결합한다.
- 용어 충돌은 경고 또는 차단만 하며 원문을 자동 치환하지 않는다.
- 웹, 유료 서비스나 직접 플레이 자료가 없어도 가용 근거로 fail-open하고 한계를 기록한다.
- 진단은 자격 증명, 비공개 원문, 절대 경로와 원문 byte를 노출하지 않는다.
- 기존 역기획, 시스템 설계, 문장 검수, 기억과 내보내기는 새 기능 실패와 무관하게 계속 동작한다.

## File Structure

### New shared module

- `shared/reference-intelligence/schema/reference-analysis.schema.json`: brief, reference set, evidence, atlas 상태, 분석, 비교, 전환과 verification queue의 닫힌 계약
- `shared/reference-intelligence/schema/game-design-glossary.schema.json`: 공통·프로젝트 용어와 상태 계약
- `shared/reference-intelligence/schema/glossary-receipt.schema.json`: 문서와 glossary snapshot 결속 계약
- `shared/reference-intelligence/catalog/system-atlas.json`: 공통 시스템 온톨로지
- `shared/reference-intelligence/catalog/overlays/genre.json`: 장르별 질문 overlay
- `shared/reference-intelligence/catalog/overlays/play-mode.json`: 싱글·협동·PvP·지속 월드 overlay
- `shared/reference-intelligence/catalog/overlays/platform.json`: PC·콘솔·모바일·웹 overlay
- `shared/reference-intelligence/catalog/overlays/business-model.json`: 패키지·F2P·구독·광고·시즌·UGC overlay
- `shared/reference-intelligence/catalog/source-register.json`: 초기 공개 참고 서비스와 필수 여부
- `shared/reference-intelligence/references/evidence-policy.md`: 출처 등급과 주장 경계
- `shared/reference-intelligence/references/reference-analysis-flow.md`: 0~9 단계 분석 흐름
- `shared/reference-intelligence/templates/`: 승인 명세의 artifact tree seed
- `shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md`: 공통 분석 스킬
- `shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md`: 공통 glossary 스킬

### New runtime files

- `shared/scripts/lib/reference-intelligence-canonical.mjs`: NFC·안전 문자열·canonical JSON·SHA-256
- `shared/scripts/validate-reference-intelligence.mjs`: 세 스키마와 runtime parity validator
- `shared/scripts/lib/reference-evidence.mjs`: 출처 등급, scope와 fact/inference 경계
- `shared/scripts/lib/system-atlas.mjs`: 공통 Atlas와 overlay의 결정적 병합
- `shared/scripts/analyze-game-design-references.mjs`: 분석, 우선순위, 전환과 artifact projection
- `shared/scripts/lib/game-design-glossary-capabilities.mjs`: 사람이 승인한 glossary 결정 capability
- `shared/scripts/manage-game-design-glossary.mjs`: glossary 병합, 결정, snapshot과 문서 검사
- `shared/scripts/validate-game-design-writing-language.mjs`: 한국어 검수 인계와 영어 locale·문장·용어 일관성 finding

### Product and documentation changes

- `products/game-design-studio/product.json`
- `products/game-design-career/product.json`
- `products/game-design-studio/plugin/references/routing.json`
- `products/game-design-career/plugin/references/routing.json`
- `products/game-design-studio/plugin/skills/design-game-systems/SKILL.md`
- `products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md`
- `products/game-design-career/plugin/skills/reverse-engineer-game-design/SKILL.md`
- `products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md`
- `shared/document-quality/indexes/studio.json`
- `shared/document-quality/profiles/studio/reference-system-analysis.json`
- `shared/document-quality/profiles/studio/reference-comparison.json`
- `shared/document-quality/profiles/studio/design-transfer-decision.json`
- `guides/game-design-studio/reference-analysis.md`
- `guides/game-design-studio/glossary.md`
- `guides/game-design-career/reference-analysis.md`
- `guides/game-design-career/glossary.md`
- `README.md`, `guides/game-design-studio/README.md`, `guides/game-design-career/README.md`
- `tooling/lib/build-product.mjs`, `tooling/isolation-smoke.mjs`, `tooling/lib/user-guides.mjs`

### Test files

- `tests/unit/reference-intelligence.test.mjs`
- `tests/unit/game-design-glossary.test.mjs`
- `tests/products/studio/reference-intelligence.test.mjs`
- `tests/products/career/reference-intelligence.test.mjs`
- `tests/contracts/reference-intelligence-package.test.mjs`
- `tests/e2e/suite/reference-intelligence.e2e.test.mjs`
- `tests/fixtures/reference-intelligence/reference-intelligence-mutation-harness.mjs`
- `tests/unit/reference-intelligence-mutation-harness.test.mjs`
- existing build, shared-contract, isolation, marketplace, user-guide and package lifecycle tests

---

### Task 1: Closed schemas and canonical validation

**Files:**
- Create: `shared/reference-intelligence/schema/reference-analysis.schema.json`
- Create: `shared/reference-intelligence/schema/game-design-glossary.schema.json`
- Create: `shared/reference-intelligence/schema/glossary-receipt.schema.json`
- Create: `shared/scripts/lib/reference-intelligence-canonical.mjs`
- Create: `shared/scripts/validate-reference-intelligence.mjs`
- Create: `tests/unit/reference-intelligence.test.mjs`
- Create: `tests/unit/game-design-glossary.test.mjs`

**Interfaces:**
- Produces: `canonicalJson(value): string`
- Produces: `sha256Canonical(value): string`
- Produces: `validateReferenceAnalysis(value): {ok:boolean, errors:Array<{code:string,path:string}>}`
- Produces: `validateGameDesignGlossary(value): {ok:boolean, errors:Array<{code:string,path:string}>}`
- Produces: `validateGlossaryReceipt(value,{glossary}={}): {ok:boolean, errors:Array<{code:string,path:string}>}`
- Produces: `canonicalReferenceAnalysis(value): string`, `canonicalGlossary(value): string`

- [ ] **Step 1: Write failing schema/runtime parity tests**

```js
test("reference analysis keeps fact, inference, unknown and transfer state closed", () => {
  const result = validateReferenceAnalysis(validReferenceAnalysis());
  assert.equal(result.ok, true);
  for (const mutate of [
    (value) => { value.evidence[0].tier = "trusted"; },
    (value) => { value.systemInventory[0].applicability = "mandatory"; },
    (value) => { value.transferDecisions[0].decision = "copy"; },
    (value) => { value.transferDecisions[0].reviewState = "approved"; },
    (value) => { value.unknownField = true; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.equal(validateReferenceAnalysis(value).ok, false);
  }
});

test("glossary and receipt require one language-neutral concept binding", () => {
  const glossary = validGlossary();
  assert.equal(validateGameDesignGlossary(glossary).ok, true);
  assert.equal(validateGlossaryReceipt({
    schemaVersion: 1,
    documentId: "system-combat-v1",
    glossaryVersion: glossary.version,
    glossarySha256: sha256Canonical(glossary),
    termIds: ["TERM-PLAYER-POWER"],
  }, { glossary }).ok, true);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/unit/reference-intelligence.test.mjs tests/unit/game-design-glossary.test.mjs`

Expected: FAIL because the validator modules and schema files do not exist.

- [ ] **Step 3: Add exact closed schemas**

Use these root contracts and expand every nested object with `additionalProperties: false`:

```json
{
  "reference-analysis": {
    "required": ["schemaVersion", "analysisId", "brief", "referenceSet", "evidence", "atlasSelection", "systemInventory", "systemMaps", "priority", "deepDives", "comparison", "transferDecisions", "verificationQueue"],
    "transferDecision": ["adopt", "adapt", "reject", "hold"],
    "reviewState": ["pending-review"],
    "applicability": ["required-candidate", "conditional", "optional", "not-applicable", "unknown"],
    "evidenceTier": ["primary", "supporting", "discovery"],
    "claimKind": ["observation", "inference", "hypothesis", "unknown"]
  },
  "game-design-glossary": {
    "required": ["schemaVersion", "scope", "version", "terms"],
    "scope": ["shared", "project-overlay"],
    "state": ["proposed", "approved", "deprecated"],
    "termIdPattern": "^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$"
  },
  "glossary-receipt": {
    "required": ["schemaVersion", "documentId", "glossaryVersion", "glossarySha256", "termIds"]
  }
}
```

- [ ] **Step 4: Implement canonical helpers and runtime parity**

```js
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
```

Reject NUL, CR, non-NFC text, unsafe IDs, duplicate or unsorted semantic arrays, unsupported enum values, unknown keys, zero-evidence inference, transfer without evidence IDs and glossary receipts whose hash does not match the supplied glossary.

- [ ] **Step 5: Run GREEN and schema parse checks**

Run: `node --test tests/unit/reference-intelligence.test.mjs tests/unit/game-design-glossary.test.mjs`

Run: `node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("fs").readFileSync(p,"utf8"))' shared/reference-intelligence/schema/*.json`

Expected: all tests pass and every schema parses.

- [ ] **Step 6: Commit Task 1**

```bash
git add shared/reference-intelligence/schema shared/scripts/lib/reference-intelligence-canonical.mjs shared/scripts/validate-reference-intelligence.mjs tests/unit/reference-intelligence.test.mjs tests/unit/game-design-glossary.test.mjs
git commit -m "feat: define reference intelligence contracts"
```

### Task 2: Evidence registry and System Atlas overlays

**Files:**
- Create: `shared/reference-intelligence/catalog/system-atlas.json`
- Create: `shared/reference-intelligence/catalog/overlays/genre.json`
- Create: `shared/reference-intelligence/catalog/overlays/play-mode.json`
- Create: `shared/reference-intelligence/catalog/overlays/platform.json`
- Create: `shared/reference-intelligence/catalog/overlays/business-model.json`
- Create: `shared/reference-intelligence/catalog/source-register.json`
- Create: `shared/reference-intelligence/references/evidence-policy.md`
- Create: `shared/scripts/lib/reference-evidence.mjs`
- Create: `shared/scripts/lib/system-atlas.mjs`
- Modify: `tests/unit/reference-intelligence.test.mjs`

**Interfaces:**
- Consumes: `canonicalJson`, schema validators from Task 1
- Produces: `registerReferenceEvidence({records}): EvidenceRecord[]`
- Produces: `validateClaimAgainstEvidence({claim,evidenceById}): {ok,code}`
- Produces: `mergeSystemAtlas({atlas,genreIds,playModeIds,platformIds,businessModelIds}): AtlasQuestion[]`
- Produces: `loadBundledReferenceCatalog({moduleRoot}): ReferenceCatalog`

- [ ] **Step 1: Add RED tests for source tiering and overlay determinism**

```js
test("Atlas merge is order-independent and genre convention is not a requirement", () => {
  const left = mergeSystemAtlas({
    atlas, genreIds: ["action-rpg"], playModeIds: ["single-player"],
    platformIds: ["pc-console"], businessModelIds: ["premium"],
  });
  const right = mergeSystemAtlas({
    atlas, genreIds: ["action-rpg"].reverse(), playModeIds: ["single-player"],
    platformIds: ["pc-console"], businessModelIds: ["premium"],
  });
  assert.deepEqual(left, right);
  assert.equal(left.every(({ applicability }) => applicability !== "mandatory"), true);
});

test("discovery evidence cannot independently prove monetization causality", () => {
  const result = validateClaimAgainstEvidence({
    claim: { claimId: "CLAIM-BM-1", kind: "observation", evidenceIds: ["EV-COMMUNITY-1"], causal: true },
    evidenceById: new Map([["EV-COMMUNITY-1", { tier: "discovery", sourceType: "community" }]]),
  });
  assert.deepEqual(result, { ok: false, code: "unsupported_causal_claim" });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='Atlas|discovery evidence' tests/unit/reference-intelligence.test.mjs`

Expected: FAIL because the evidence and Atlas modules are missing.

- [ ] **Step 3: Add the common Atlas and four overlay catalogs**

Use stable IDs for these top-level domains:

```json
[
  "core-play", "player-character", "progression", "collection-crafting",
  "economy", "rewards", "content", "social", "monetization", "retention",
  "meta-liveops", "ux-accessibility", "account-platform", "session-network",
  "failure-recovery", "operations-telemetry"
]
```

Every overlay entry must contain `questionId`, `systemId`, `applicability`, `rationale`, `conditions`, and `verificationPrompts`. Sort by UTF-8 `questionId` and reject duplicate `(overlayId, questionId)` pairs.

The bundled optional source register contains these stable IDs and URLs, all with `required: false`:

```json
[
  ["steamworks-tags", "https://partner.steamgames.com/doc/store/tags?l=english&language=english"],
  ["gamerefinery-genres", "https://docs.gamerefinery.com/en/articles/2278730-what-are-categories-genres-and-subgenres"],
  ["gamerefinery-intelligence", "https://www.gamerefinery.com/game-intelligence-tools/"],
  ["gdc-postmortems", "https://gdcvault.com/browse/postmortem/?media=s"],
  ["game-ui-database", "https://www.gameuidatabase.com/"],
  ["interface-in-game", "https://interfaceingame.com/screenshots/"],
  ["steamdb-faq", "https://steamdb.info/faq/"],
  ["igdb-api", "https://api-docs.igdb.com/"]
]
```

- [ ] **Step 4: Implement source policy and deterministic merge**

```js
const tierBySourceType = Object.freeze({
  "direct-play": "primary", "official-site": "primary", "official-patch-note": "primary",
  "official-odds": "primary", "official-store": "primary", "developer-talk": "supporting",
  "curated-wiki": "supporting", "expert-guide": "supporting", "community": "discovery",
  "video": "discovery", "review": "discovery", "unofficial-tracker": "discovery",
});

export function mergeSystemAtlas(selection) {
  return mergeQuestions(selection).sort((a, b) => Buffer.compare(Buffer.from(a.questionId), Buffer.from(b.questionId)));
}
```

The merge keeps the most cautious applicability when overlays disagree: `unknown`, `conditional`, `optional`, `required-candidate`; explicit `not-applicable` is allowed only when every selected overlay agrees or supplies a matching condition.

- [ ] **Step 5: Run catalog, offline and conflict tests**

Run: `node --test tests/unit/reference-intelligence.test.mjs`

Expected: catalog load, tier validation, offline source fallback and overlay order tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add shared/reference-intelligence/catalog shared/reference-intelligence/references/evidence-policy.md shared/scripts/lib/reference-evidence.mjs shared/scripts/lib/system-atlas.mjs tests/unit/reference-intelligence.test.mjs
git commit -m "feat: add game system analysis atlas"
```

### Task 3: Staged analysis, design transfer and safe artifact projection

**Files:**
- Create: `shared/reference-intelligence/references/reference-analysis-flow.md`
- Create: `shared/reference-intelligence/templates/brief.md`
- Create: `shared/reference-intelligence/templates/reference-set.yml`
- Create: `shared/reference-intelligence/templates/evidence-register.yml`
- Create: `shared/reference-intelligence/templates/system-inventory.json`
- Create: `shared/reference-intelligence/templates/analysis-priority.md`
- Create: `shared/reference-intelligence/templates/comparison-matrix.md`
- Create: `shared/reference-intelligence/templates/transfer-decisions.md`
- Create: `shared/reference-intelligence/templates/verification-queue.md`
- Create: `shared/scripts/analyze-game-design-references.mjs`
- Modify: `tests/unit/reference-intelligence.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–2 validators, `safeWriteArtifactFile`, `ensureArtifactDirectories`
- Produces: `buildReferenceBrief(input): ReferenceBrief`
- Produces: `inventoryReferenceSystems({brief,atlas,evidence,claims}): SystemInventoryItem[]`
- Produces: `buildSystemMaps({inventory,edges,loops}): SystemMaps`
- Produces: `rankDeepDiveCandidates({inventory,maps,questions}): PriorityEntry[]`
- Produces: `buildDesignTransfers({deepDives,projectConstraints}): TransferDecision[]`
- Produces: `buildReferenceAnalysis(input): ReferenceAnalysis`
- Produces: `writeReferenceAnalysisWorkspace({artifactRoot,analysis}): Promise<{analysisSha256,files}>`

- [ ] **Step 1: Add RED tests for the scan-to-transfer pipeline**

```js
test("analysis stages preserve evidence and never auto-approve transfer", async (t) => {
  const analysis = buildReferenceAnalysis({
    brief: briefFixture(), referenceSet: referenceSetFixture(), atlas: atlasFixture(), evidence: evidenceFixture(), claims: claimFixture(),
    edges: edgeFixture(), loops: loopFixture(), projectConstraints: ["ten-minute-session"],
  });
  assert.equal(analysis.referenceSet.map(({ role }) => role).join(","),
    "direct-competitor,core-system-exemplar,operations-monetization-comparator");
  assert.equal(analysis.transferDecisions.every(({ reviewState }) => reviewState === "pending-review"), true);
  assert.equal(analysis.verificationQueue.some(({ status }) => status === "not-observed"), true);
  const written = await writeReferenceAnalysisWorkspace({ artifactRoot: await artifactRoot(t), analysis });
  assert.match(written.analysisSha256, /^[a-f0-9]{64}$/u);
});
```

- [ ] **Step 2: Run the pipeline test and verify RED**

Run: `node --test --test-name-pattern='analysis stages' tests/unit/reference-intelligence.test.mjs`

Expected: FAIL because the analysis runtime does not exist.

- [ ] **Step 3: Implement the 0–9 stage pipeline**

```js
export function buildReferenceAnalysis(input) {
  const brief = buildReferenceBrief(input.brief);
  const referenceSet = normalizeReferenceSet(input.referenceSet);
  const evidence = registerReferenceEvidence({ records: input.evidence });
  const atlasSelection = mergeSystemAtlas(input.atlas);
  const systemInventory = inventoryReferenceSystems({ brief, atlas: atlasSelection, evidence, claims: input.claims });
  const systemMaps = buildSystemMaps({ inventory: systemInventory, edges: input.edges, loops: input.loops });
  const priority = rankDeepDiveCandidates({ inventory: systemInventory, maps: systemMaps, questions: brief.decisionQuestions });
  const deepDives = buildDeepDives({ priority, evidence, claims: input.claims });
  const comparison = compareReferenceSolutions({ referenceSet, deepDives });
  const transferDecisions = buildDesignTransfers({ deepDives, projectConstraints: input.projectConstraints });
  const verificationQueue = collectVerificationQueue({ evidence, systemInventory, deepDives, transferDecisions });
  return validateAndFreeze({ schemaVersion: 1, analysisId: brief.analysisId, brief, referenceSet, evidence, atlasSelection, systemInventory, systemMaps, priority, deepDives, comparison, transferDecisions, verificationQueue });
}
```

Priority calculation uses seven explicit integer dimensions from 1–5: relevance, player-experience impact, economy-progression impact, differentiation potential, evidence strength, uncertainty and research cost. Research cost is an inverse tie-break; a missing dimension remains unscored instead of receiving an inferred value.

- [ ] **Step 4: Implement safe artifact projection**

Write JSON-compatible YAML for `.yml` files, canonical JSON for machine files and deterministic Markdown tables for human files. Use only these relative paths:

```js
const artifactFiles = Object.freeze([
  "reference-intelligence/brief.md",
  "reference-intelligence/reference-set.yml",
  "reference-intelligence/evidence-register.yml",
  "reference-intelligence/system-inventory.json",
  "reference-intelligence/analysis-priority.md",
  "reference-intelligence/comparison-matrix.md",
  "reference-intelligence/transfer-decisions.md",
  "reference-intelligence/verification-queue.md",
]);
```

Create `system-maps/`, `deep-dives/`, `glossary/` and `decisions/` through `ensureArtifactDirectories`; reject symlink ancestors, absolute paths, NUL and over-2MiB documents through `safeWriteArtifactFile`.

- [ ] **Step 5: Run complete, offline, single-game and unsafe-path tests**

Run: `node --test tests/unit/reference-intelligence.test.mjs`

Expected: full three-role flow, single-game `hold`, unavailable source, version conflict and symlink/no-write cases pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add shared/reference-intelligence/references/reference-analysis-flow.md shared/reference-intelligence/templates shared/scripts/analyze-game-design-references.mjs tests/unit/reference-intelligence.test.mjs
git commit -m "feat: build staged reference analysis"
```

### Task 4: Glossary lifecycle, human approval and document validation

**Files:**
- Create: `shared/scripts/lib/game-design-glossary-capabilities.mjs`
- Create: `shared/scripts/manage-game-design-glossary.mjs`
- Create: `shared/scripts/validate-game-design-writing-language.mjs`
- Modify: `tests/unit/game-design-glossary.test.mjs`

**Interfaces:**
- Consumes: Task 1 canonical validators and `safe-artifact-write.mjs`
- Produces: `issueGlossaryHumanDecision(input): {receipt, capability}` for trusted host use only
- Produces: `mergeGameDesignGlossaries({sharedGlossary,projectOverlay}): EffectiveGlossary`
- Produces: `extractGlossaryCandidates({documents,effectiveGlossary}): GlossaryCandidate[]`
- Produces: `applyGlossaryDecision({glossary,receipt,capability}): GameDesignGlossary`
- Produces: `createGlossarySnapshot({documentId,effectiveGlossary,termIds}): GlossaryReceipt`
- Produces: `validateDocumentTerminology({text,language,effectiveGlossary,receipt}): {ok,blocking,warnings}`
- Produces: `validateGameDesignWritingLanguage({text,language,locale,effectiveGlossary,receipt}): {ok,blocking,warnings,handoff}`

- [ ] **Step 1: Add RED tests for approval, conflicts and no mutation**

```js
test("glossary approval requires a live human capability", () => {
  const input = proposedGlossary();
  assert.throws(() => applyGlossaryDecision({
    glossary: input,
    receipt: { action: "approve", termIds: ["TERM-PLAYER-POWER"], actor: "ChatGPT" },
    capability: Object.freeze({}),
  }), /human glossary decision/u);
});

test("terminology validation reports but never rewrites", () => {
  const text = "Player Power를 전투력이라고도 부른다.";
  const result = validateDocumentTerminology({ text, language: "ko", effectiveGlossary: approvedGlossary(), receipt: validReceipt() });
  assert.equal(result.ok, false);
  assert.deepEqual(result.blocking.map(({ code }) => code), ["multiple-preferred-terms"]);
  assert.equal(result.revisedText, undefined);
  assert.equal(text, "Player Power를 전투력이라고도 부른다.");
});

test("English validation keeps locale and approved terminology consistent", () => {
  const result = validateGameDesignWritingLanguage({
    text: "The player customises gear. The armor menu shows Player power.",
    language: "en", locale: "en-US", effectiveGlossary: approvedGlossary(), receipt: validReceipt(),
  });
  assert.deepEqual(result.warnings.map(({ code }) => code), ["mixed-english-locale", "orthography-variant"]);
  assert.equal(result.handoff, "named-human-english-writing-review");
  assert.equal(result.revisedText, undefined);
});
```

- [ ] **Step 2: Run glossary tests and verify RED**

Run: `node --test tests/unit/game-design-glossary.test.mjs`

Expected: FAIL because capability and lifecycle functions do not exist.

- [ ] **Step 3: Implement opaque human decision capability**

```js
const issued = new WeakMap();

export function issueGlossaryHumanDecision(input) {
  const receipt = Object.freeze(normalizeHumanDecision(input));
  const capability = Object.freeze(Object.create(null));
  issued.set(capability, sha256Canonical(receipt));
  return Object.freeze({ receipt, capability });
}

export function assertGlossaryHumanDecision(receipt, capability) {
  if (issued.get(capability) !== sha256Canonical(receipt)) throw new Error("A live human glossary decision is required.");
}
```

The issuer rejects role-like actors, agent channels, duplicated term IDs, stale glossary hashes and actions outside `approve`, `deprecate`, `replace`.

- [ ] **Step 4: Implement merge, snapshot and diagnostic semantics**

```js
export function validateDocumentTerminology({ text, language, effectiveGlossary, receipt }) {
  assertReceiptMatchesGlossary(receipt, effectiveGlossary);
  const findings = scanTerms({ text, language, glossary: effectiveGlossary });
  return Object.freeze({
    ok: findings.blocking.length === 0,
    blocking: findings.blocking,
    warnings: findings.warnings,
  });
}
```

Blocking codes: `multiple-preferred-terms`, `ambiguous-concept-label`, `missing-bilingual-mapping`, `stale-glossary-receipt`, `semantic-auto-replacement`. Warning codes: `unapproved-term`, `deprecated-term`, `unexplained-abbreviation`, `orthography-variant`, `unnecessary-english`, `translation-mismatch`.

Each glossary term uses this exact field set; optional arrays are present as empty arrays instead of disappearing:

```js
const glossaryTermFields = Object.freeze([
  "termId", "koPreferred", "enPreferred", "definition", "scope", "contexts",
  "abbreviations", "allowedVariants", "forbiddenTerms", "deprecatedTerms",
  "untranslatedExpressions", "grammar", "examples", "confusedConceptIds",
  "decisionIds", "evidenceIds", "state", "approver", "replacementTermId",
  "version", "changedAt"
]);
```

`validateGameDesignWritingLanguage` uses two distinct branches:

```js
export function validateGameDesignWritingLanguage(input) {
  const terminology = validateDocumentTerminology(input);
  if (input.language === "ko") {
    return Object.freeze({ ...terminology, handoff: "polish-game-design-writing", warnings: [...terminology.warnings] });
  }
  if (input.language === "en" && ["en-US", "en-GB"].includes(input.locale)) {
    return Object.freeze({
      ...terminology,
      warnings: [...terminology.warnings, ...scanEnglishWritingConsistency(input.text, input.locale)],
      handoff: "named-human-english-writing-review",
    });
  }
  throw new Error("Writing validation requires ko or a declared en-US/en-GB locale.");
}
```

The English scan reports mixed US/UK spelling within one document, heading-style drift, sentence fragments outside tables, inconsistent capitalization/plural forms for approved terms and unexplained abbreviations. It emits findings only and does not claim full grammar correction.

- [ ] **Step 5: Add artifact outputs and run GREEN**

Write only:

```text
reference-intelligence/glossary/terms.json
reference-intelligence/glossary/glossary.ko.md
reference-intelligence/glossary/glossary.en.md
reference-intelligence/glossary/terminology-findings.md
reference-intelligence/glossary/glossary-receipt.json
reference-intelligence/decisions/glossary-<event-id>.json
```

Run: `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs`

Expected: approval, deprecation, project overlay, bilingual conflict, stale hash and no-auto-rewrite cases pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add shared/scripts/lib/game-design-glossary-capabilities.mjs shared/scripts/manage-game-design-glossary.mjs shared/scripts/validate-game-design-writing-language.mjs tests/unit/game-design-glossary.test.mjs
git commit -m "feat: manage approved game design terminology"
```

### Task 5: Shared skills and Studio/Career projections

**Files:**
- Create: `shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md`
- Create: `shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md`
- Create: `shared/document-quality/profiles/studio/reference-system-analysis.json`
- Create: `shared/document-quality/profiles/studio/reference-comparison.json`
- Create: `shared/document-quality/profiles/studio/design-transfer-decision.json`
- Modify: `shared/document-quality/indexes/studio.json`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `products/game-design-studio/plugin/skills/design-game-systems/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md`
- Modify: `products/game-design-career/plugin/skills/reverse-engineer-game-design/SKILL.md`
- Modify: `products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md`
- Create: `tests/products/studio/reference-intelligence.test.mjs`
- Create: `tests/products/career/reference-intelligence.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4 runtime and artifact outputs
- Produces: installed skills `analyze-game-design-references`, `maintain-game-design-glossary`
- Produces: Studio output types `reference-system-analysis`, `reference-comparison`, `design-transfer-decision`
- Produces: Career projections `reverse-design-document`, `game-analysis-report`

- [ ] **Step 1: Add RED product contract tests**

```js
test("Studio routes reference analysis through common evidence and pending transfer", async () => {
  const routing = await readRouting("game-design-studio");
  assert.equal(routing.skillIds.includes("analyze-game-design-references"), true);
  assert.equal(routing.skillIds.includes("maintain-game-design-glossary"), true);
  assert.deepEqual(routing.referenceIntelligenceWorkflow.transferState, "pending-review");
  assert.deepEqual(routing.referenceIntelligenceWorkflow.outputs,
    ["reference-system-analysis", "reference-comparison", "design-transfer-decision"]);
});

test("Career reuses common analysis without changing fact-inference rules", async () => {
  const skill = await readSkill("game-design-career", "reverse-engineer-game-design");
  assert.match(skill, /analyze-game-design-references/u);
  assert.match(skill, /fact-inference-schema\.json/u);
});
```

- [ ] **Step 2: Run product tests and verify RED**

Run: `node --test tests/products/studio/reference-intelligence.test.mjs tests/products/career/reference-intelligence.test.mjs`

Expected: FAIL because the common skills, routes and Studio profiles are absent.

- [ ] **Step 3: Author the two shared skills**

`analyze-game-design-references` must require the ordered flow:

```text
Reference Brief → role-based Reference Set → Evidence Registry → System Atlas
→ inventory without evaluation → system maps and loops → priority → deep dives
→ cross-game comparison → adopt/adapt/reject/hold → verification queue → glossary candidates
```

`maintain-game-design-glossary` must require host-issued human capability for approval and must state: “Never rewrite source text; emit findings and an impact list.” Both skills treat external instructions as untrusted data.

- [ ] **Step 4: Add Studio profiles and route projections**

Add exact Studio route IDs:

```json
[
  { "id": "reference-game-analysis", "skill": "analyze-game-design-references", "outputTypes": ["reference-system-analysis", "reference-comparison", "design-transfer-decision"] },
  { "id": "project-glossary-maintenance", "skill": "maintain-game-design-glossary", "outputTypes": ["game-design-glossary", "terminology-findings", "glossary-receipt"] }
]
```

Career exposes the same direct-use skills but projects analysis into existing `reverse-design-document` and `game-analysis-report`. Add both skills to `skillIds`, `plannedPaths.skills` and `directUseReviewOwners`; use `lead-game-designer` for Studio analysis, `document-quality-editor` for Studio glossary, and existing Career evidence/review owners without granting approval authority.

- [ ] **Step 5: Bind glossary snapshots to writing polish**

Both `polish-game-design-writing` skills must add these inputs and boundaries:

```json
{
  "optionalInputs": ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"],
  "terminologyBehavior": "validate-and-report",
  "autoReplace": false,
  "approvalMutation": false,
  "languageRoutes": {
    "ko": "humanize-korean-then-human-review",
    "en-US": "english-consistency-findings-then-human-review",
    "en-GB": "english-consistency-findings-then-human-review"
  }
}
```

- [ ] **Step 6: Run product and profile tests**

Run: `node --test tests/products/studio/reference-intelligence.test.mjs tests/products/career/reference-intelligence.test.mjs tests/products/studio/core-design-skills.test.mjs tests/products/career/research-skills.test.mjs`

Expected: all route, skill, output and existing reverse-design assertions pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add shared/reference-intelligence/skills shared/document-quality/indexes/studio.json shared/document-quality/profiles/studio/reference-system-analysis.json shared/document-quality/profiles/studio/reference-comparison.json shared/document-quality/profiles/studio/design-transfer-decision.json products/game-design-studio/plugin/references/routing.json products/game-design-career/plugin/references/routing.json products/game-design-studio/plugin/skills/design-game-systems/SKILL.md products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md products/game-design-career/plugin/skills/reverse-engineer-game-design/SKILL.md products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md tests/products/studio/reference-intelligence.test.mjs tests/products/career/reference-intelligence.test.mjs
git commit -m "feat: expose reference analysis workflows"
```

### Task 6: Package the common module safely

**Files:**
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Modify: `tooling/lib/build-product.mjs`
- Modify: `tooling/isolation-smoke.mjs`
- Modify: `tests/unit/build-product.test.mjs`
- Modify: `tests/contracts/shared-contract.test.mjs`
- Create: `tests/contracts/reference-intelligence-package.test.mjs`
- Modify: `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`

**Interfaces:**
- Consumes: complete `shared/reference-intelligence` inventory
- Produces: product contract shared module ID `reference-intelligence`
- Produces: byte-exact Studio and Career package mirrors

- [ ] **Step 1: Add RED package inventory tests**

```js
test("reference-intelligence packages exact skills, schemas, catalogs and templates", async (t) => {
  const result = await buildFixture(t, { sharedModules: ["reference-intelligence"] });
  assert.deepEqual(result.files.filter((file) => file.includes("reference-intelligence") || file.includes("game-design-glossary")), expectedReferenceFiles);
  assert.deepEqual(await readBytes(result.outputDir, "skills/analyze-game-design-references/SKILL.md"),
    await readBytes(result.repoRoot, "shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md"));
});

test("unexpected reference-intelligence source file fails before output publication", async (t) => {
  const fixture = await buildFixture(t, { sharedModules: ["reference-intelligence"] });
  await writeText(fixture.repoRoot, "shared/reference-intelligence/references/unexpected.md", "blocked\n");
  await assert.rejects(() => fixture.build(), /unexpected shared reference-intelligence package file/iu);
  assert.equal(await exists(fixture.outputDir), false);
});
```

- [ ] **Step 2: Run package tests and verify RED**

Run: `node --test tests/unit/build-product.test.mjs tests/contracts/reference-intelligence-package.test.mjs`

Expected: FAIL with unknown shared module `reference-intelligence`.

- [ ] **Step 3: Add exact build mapping and inventory**

```js
"reference-intelligence": [
  ["shared/reference-intelligence/skills", "skills"],
  ["shared/reference-intelligence/schema", "references/shared/reference-intelligence/schema"],
  ["shared/reference-intelligence/catalog", "references/shared/reference-intelligence/catalog"],
  ["shared/reference-intelligence/references", "references/shared/reference-intelligence/references"],
  ["shared/reference-intelligence/templates", "references/shared/reference-intelligence/templates"]
]
```

Define a frozen exact inventory for every source root. Reject extra files, symlinks, special files, `.env`, credentials and product overlay collisions before staging output. Add `reference-intelligence` to both product `sharedModules` arrays.

- [ ] **Step 4: Update recursive compilerless graph and lifecycle expectations**

The source, Studio package and Career package graph must recursively resolve every relative import within the approved package root; non-relative imports must be `node:*`. Add the two shared skills to the routing-derived exact inventory; when this plan runs before the independent cutscene plan the expected total is 23 for both products. Preserve local memory, `.git/info/exclude` and unrelated sibling bytes through install, replace and remove.

- [ ] **Step 5: Run package and isolation GREEN**

Run: `node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/contracts/reference-intelligence-package.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`

Run: `node tooling/isolation-smoke.mjs`

Expected: exact inventory, both compilerless smokes, lifecycle and isolation pass.

- [ ] **Step 6: Commit Task 6**

```bash
git add products/game-design-studio/product.json products/game-design-career/product.json tooling/lib/build-product.mjs tooling/isolation-smoke.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/contracts/reference-intelligence-package.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
git commit -m "build: package reference intelligence module"
```

### Task 7: User guides and copyable prompt templates

**Files:**
- Create: `guides/game-design-studio/reference-analysis.md`
- Create: `guides/game-design-studio/glossary.md`
- Create: `guides/game-design-career/reference-analysis.md`
- Create: `guides/game-design-career/glossary.md`
- Modify: `README.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `guides/game-design-career/README.md`
- Modify: `tooling/lib/user-guides.mjs`
- Modify: `tests/unit/user-guides.test.mjs`
- Create: `tests/contracts/reference-intelligence-guides.test.mjs`

**Interfaces:**
- Consumes: installed skills and artifact paths from Tasks 3–6
- Produces: App·CLI examples for scan, map, deep dive, transfer and glossary review

- [ ] **Step 1: Add RED guide contracts**

```js
test("reference guides expose the staged flow and exact artifact paths", async () => {
  for (const product of ["game-design-studio", "game-design-career"]) {
    const guide = await readFile(`guides/${product}/reference-analysis.md`, "utf8");
    for (const phrase of ["조사 질문", "시스템 목록", "시스템 지도", "심층 분석", "adopt", "adapt", "reject", "hold", "verification-queue.md"]) assert.match(guide, new RegExp(phrase, "u"));
    const glossary = await readFile(`guides/${product}/glossary.md`, "utf8");
    assert.match(glossary, /자동 치환하지/u);
    assert.match(glossary, /glossary-receipt\.json/u);
  }
});
```

- [ ] **Step 2: Run guide tests and verify RED**

Run: `node --test tests/contracts/reference-intelligence-guides.test.mjs tests/unit/user-guides.test.mjs`

Expected: FAIL because four guides and README links do not exist.

- [ ] **Step 3: Write Studio and Career guides**

Each analysis guide must include copyable requests for:

```text
1. 이번 분석으로 결정할 질문 정의
2. 직접 경쟁작·핵심 우수 사례·운영 비교작 선정
3. 공식 자료와 사용자 플레이·스크린샷 등록
4. 평가 없이 시스템 목록화
5. core/session/meta loop와 economy source-transform-sink 작성
6. 심층 분석 우선순위 확인
7. 게임별 해결 원리 비교
8. adopt/adapt/reject/hold 제안과 사람 검토
```

Each glossary guide must show candidate → proposed → conflict check → human approval → snapshot → document validation → deprecation and impact review. Provide both Korean and English term examples using `TERM-PLAYER-POWER`.

- [ ] **Step 4: Update README discovery and dynamic guide counts**

Add one “경쟁작·레퍼런스 분석과 용어 사전” use-case entry per product. Compare the actual Markdown inventory against `validateUserGuides(...).counts.guides`; do not introduce a new fixed total.

- [ ] **Step 5: Run guides GREEN and link validation**

Run: `node --test tests/contracts/reference-intelligence-guides.test.mjs tests/unit/user-guides.test.mjs`

Run: `npm run validate:guides`

Expected: guide contracts, exact links and complete guide validation pass.

- [ ] **Step 6: Commit Task 7**

```bash
git add guides/game-design-studio/reference-analysis.md guides/game-design-studio/glossary.md guides/game-design-career/reference-analysis.md guides/game-design-career/glossary.md README.md guides/game-design-studio/README.md guides/game-design-career/README.md tooling/lib/user-guides.mjs tests/unit/user-guides.test.mjs tests/contracts/reference-intelligence-guides.test.mjs
git commit -m "docs: guide reference analysis and terminology"
```

### Task 8: End-to-end, mutation evidence and final verification

**Files:**
- Create: `tests/e2e/suite/reference-intelligence.e2e.test.mjs`
- Create: `tests/fixtures/reference-intelligence/reference-intelligence-mutation-harness.mjs`
- Create: `tests/unit/reference-intelligence-mutation-harness.test.mjs`
- Create: `.superpowers/sdd/2026-08-13-game-reference-intelligence/task-report.md`
- Generated by build only: `plugins/game-design-studio/**`, `plugins/game-design-career/**`

**Interfaces:**
- Consumes: public production APIs and packaged skills only
- Produces: executable evidence for Studio/Career parity, offline fallback, glossary gates and mutation non-vacuity

- [ ] **Step 1: Write direct public-API E2E scenarios**

```js
const scenarios = [
  "three-role reference set produces one evidence-bound analysis",
  "single-game input keeps comparison transfer on hold",
  "official and direct-play evidence outrank discovery leads",
  "version and platform conflicts remain separate",
  "genre overlays never auto-require a feature",
  "unsupported retention and monetization causality is rejected",
  "Studio and Career projections preserve claim and evidence IDs",
  "transfer remains pending-review and cannot modify a system specification",
  "offline and unavailable paid sources preserve usable local analysis",
  "glossary approval requires a live named-human capability",
  "stale glossary receipt blocks terminology-reviewed status",
  "terminology findings never rewrite Korean or English source text",
];
```

Use real temporary artifact roots, production exports and filesystem snapshots. Do not import unit tests, expose traversal hooks or spawn `node --test` from the E2E file.

- [ ] **Step 2: Run E2E and fix only production defects it exposes**

Run: `node --test tests/e2e/suite/reference-intelligence.e2e.test.mjs`

Expected: exactly 12 tests pass, no skip.

- [ ] **Step 3: Add assertion-bound mutation evidence**

The mutation harness must make these seven narrow changes one at a time and require the named assertion to fail:

```text
evidence-tier: allow discovery-only causal claim
fact-inference: promote zero-evidence inference
atlas-obligation: convert required-candidate to mandatory
transfer-approval: replace pending-review with approved
transfer-trace: drop evidence IDs
glossary-capability: accept forged approval object
glossary-rewrite: mutate source text during validation
```

Use a bounded dedicated FD protocol, 4KiB evidence cap, 64KiB stdout+stderr cap, 15-second timeout, environment allowlist and process-tree cleanup, matching the hardened memory mutation harness pattern.

- [ ] **Step 4: Run mutation and package verification**

Run: `node --test tests/unit/reference-intelligence-mutation-harness.test.mjs`

Run: `node --test tests/unit/reference-intelligence.test.mjs tests/unit/game-design-glossary.test.mjs tests/products/studio/reference-intelligence.test.mjs tests/products/career/reference-intelligence.test.mjs tests/contracts/reference-intelligence-package.test.mjs tests/contracts/reference-intelligence-guides.test.mjs tests/e2e/suite/reference-intelligence.e2e.test.mjs`

Expected: every mutation is detected and all functional tests pass.

- [ ] **Step 5: Build snapshots once and verify package parity**

Run: `npm run build`

Run: `npm run build -- --check`

Run: `node tooling/validate-packages.mjs plugins/game-design-studio plugins/game-design-career`

Expected: both snapshots contain the exact two shared skills, three schemas, catalogs, references and templates; no project artifact or local glossary is packaged.

- [ ] **Step 6: Run final repository gates**

Run: `node --check shared/scripts/lib/reference-intelligence-canonical.mjs shared/scripts/validate-reference-intelligence.mjs shared/scripts/lib/reference-evidence.mjs shared/scripts/lib/system-atlas.mjs shared/scripts/analyze-game-design-references.mjs shared/scripts/lib/game-design-glossary-capabilities.mjs shared/scripts/manage-game-design-glossary.mjs shared/scripts/validate-game-design-writing-language.mjs`

Run: `npm run test:unit`

Run: `npm run test:contracts`

Run: `npm run test:products`

Run: `git diff --check`

Expected: zero failures; the only allowed skips are pre-existing documented platform limitations.

- [ ] **Step 7: Commit Task 8**

Record the final commands, counts, build hashes and remaining gaps in the task report before staging:

```bash
git add tests/e2e/suite/reference-intelligence.e2e.test.mjs tests/fixtures/reference-intelligence/reference-intelligence-mutation-harness.mjs tests/unit/reference-intelligence-mutation-harness.test.mjs plugins/game-design-studio plugins/game-design-career
git add -f .superpowers/sdd/2026-08-13-game-reference-intelligence/task-report.md
git commit -m "test: verify reference intelligence lifecycle"
```

## Final Review Checklist

- Every spec section maps to one of Tasks 1–8.
- The plan introduces no paid or authenticated source dependency.
- Runtime and JSON Schema reject the same closed invalid fixtures.
- No function changes source document text during analysis or terminology validation.
- Korean polish and English consistency findings remain separate language-specific review paths.
- Human glossary approval and design transfer review remain separate capabilities.
- Studio and Career share evidence IDs and packaged source bytes.
- Build output contains common knowledge and skills, never project analysis or glossary data.
- Final status reports exact tests, skips, build hashes, changed files and any unavailable external validation.
