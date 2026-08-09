# Prompt Template and Diagram Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 게임 기획 플러그인의 146개 사례에 App·CLI 실행 경로 292개와 복사 가능한 `text` 프롬프트 블록 730개, 검증 가능한 결과 계약, Archify 실행 도식과 Skillstead 정적 fallback을 제공하고 README·가이드에서 쉽게 탐색하게 한다.

**Architecture:** `guides/prompt-templates/catalog.json`을 안전한 shard index로 사용하고 loader가 9개 shard를 하나의 146-entry catalog로 검증한다. 결정론적 builder가 전용 프롬프트 라이브러리, 기존 스킬·사례·레시피의 managed section과 제품별 packaged reference를 생성한다. Archify는 설치된 host capability일 때 검증된 HTML을 만들고, 모든 스킬 프롬프트는 같은 semantic source에서 생성한 Skillstead SVG·2× PNG fallback을 가진다.

**Tech Stack:** Node.js 18+ ESM, `node:test`, JSON Schema 2020-12 형식의 정적 계약, Markdown, Archify 2.13 CLI, vendored Skillstead `svg-infographic` 0.8.3, 기존 snapshot builder.

## Global Constraints

- 기준 설계는 `docs/superpowers/specs/2026-08-09-prompt-template-and-diagram-library-design.md`다.
- 정확히 30개 설치 스킬에 `beginner`, `standard`, `advanced`가 하나씩 있어야 한다.
- skill template 90개, use-case 36개, recipe 12개, suite case 8개로 총 146개다.
- 146개 모두 App·CLI 실행 경로를 제공해 292개 경로를 만들고, 각 경로의 완성 예시·재사용 템플릿과 사례별 재개 프롬프트를 합쳐 730개 `text` 블록을 만든다.
- App prompt는 `@Game Design Studio` 또는 `@Game Design Career`를, CLI prompt는 실제 `$game-design-studio:*` 또는 `$game-design-career:*` namespace를 사용한다.
- 모르는 정보는 `미정`으로 남기고 secret, API key, 개인정보와 비공개 회사 자료를 입력으로 요구하지 않는다.
- 기존 이미지 계약을 유지한다: `IMAGE_GEN_MODE`는 `prompt-only|select|required|all`, 기본 모델은 `gpt-image-2`, 기본 품질은 `low`, API key가 있으면 API 경로만 시도한다.
- Archify는 번들하지 않는다. 설치 감지 뒤 우선 사용하고 부재·실패 시 Skillstead fallback과 정확한 상태를 기록한다.
- Archify 완료는 `showcase` 9검사, composition 오류 0, 경고 0, `deliver` 성공과 digest receipt가 필요하다.
- Skillstead 완료는 editable SVG, lint 오류·경고 0, 정확한 2× PNG, 접근성 metadata와 visual QA가 필요하다.
- `content.md`가 Canonical Artifact의 유일한 내용 기준이다. 파생 이미지·도식·PDF·DOCX·PPTX는 이를 덮어쓰지 않는다.
- generated `plugins/*`는 직접 편집하지 않는다. `products/*/plugin`, `shared/`, `guides/`와 tooling 원천에서 다시 빌드한다.
- 브라우저를 자동으로 열지 않는다. Archify delivery와 visual QA는 headless 경로를 사용한다.
- main checkout의 기존 untracked `package-lock.json`은 수정·추가·삭제·커밋하지 않는다.

---

## File and Interface Map

### Catalog source

- Create: `guides/prompt-templates/catalog.json` — canonical shard index
- Create: `guides/prompt-templates/catalog.schema.json` — closed index and entry contract
- Create: `guides/prompt-templates/catalog/studio-foundations.json` — Studio skill entries 15개
- Create: `guides/prompt-templates/catalog/studio-production.json` — Studio skill entries 15개
- Create: `guides/prompt-templates/catalog/studio-visual.json` — Studio skill entries 15개
- Create: `guides/prompt-templates/catalog/career-foundations.json` — Career skill entries 15개
- Create: `guides/prompt-templates/catalog/career-evidence.json` — Career skill entries 15개
- Create: `guides/prompt-templates/catalog/career-visual.json` — Career skill entries 15개
- Create: `guides/prompt-templates/catalog/studio-scenarios.json` — Studio case 18개와 recipe 6개
- Create: `guides/prompt-templates/catalog/career-scenarios.json` — Career case 18개와 recipe 6개
- Create: `guides/prompt-templates/catalog/suite.json` — cross-plugin case 8개

### Tooling

- Create: `tooling/lib/prompt-template-catalog.mjs`
  - `loadPromptTemplateCatalog({ repoRoot })`
  - `validatePromptTemplateCatalog({ entries, inventories, useCaseManifest })`
  - `productPromptProjection(catalog, productId)`
- Create: `tooling/lib/prompt-guides.mjs`
  - `renderPromptCard(entry)`
  - `renderPromptLibrary(catalog)`
  - `replaceManagedSection(markdown, markerId, body)`
  - `buildPromptGuides({ repoRoot, check })`
- Create: `tooling/build-prompt-guides.mjs`
- Create: `tooling/lib/archify-guides.mjs`
  - `resolveArchifyCli({ env, home })`
  - `buildArchifyWorkflowSpec(entry)`
  - `validateArchifyReceipt(receipt, files)`
  - `buildArchifyGuides({ repoRoot, check, ids })`
- Create: `tooling/build-archify-guides.mjs`
- Modify: `tooling/build-use-case-diagrams.mjs`
- Modify: `package.json`

### Generated user and package surfaces

- Generate: `guides/prompt-templates/README.md`
- Generate: the exact 15 Studio, 15 Career and 8 suite files in Appendix A
- Modify managed sections in 30 skill guides, 4 use-case body files and 12 recipe files.
- Create: `guides/assets/archify/manifest.json` — 30 skill + 12 recipe + 8 suite = 50 HTML artifacts
- Create: `guides/assets/prompt-flow-diagram-sources.json` — 90 static prompt diagrams
- Generate: `products/game-design-studio/plugin/references/prompt-templates.json` — 77 entries
- Generate: `products/game-design-career/plugin/references/prompt-templates.json` — 77 entries

### Tests

- Create: `tests/unit/prompt-template-catalog.test.mjs`
- Create: `tests/unit/prompt-guides.test.mjs`
- Create: `tests/unit/archify-guides.test.mjs`
- Create: `tests/contracts/prompt-template-guides.test.mjs`
- Modify existing capability, diagram, guide, product README, package-content and isolation tests.

---

### Task 1: Prompt catalog schema and safe loader

**Files:**
- Create: `guides/prompt-templates/catalog.json`
- Create: `guides/prompt-templates/catalog.schema.json`
- Create: `tooling/lib/prompt-template-catalog.mjs`
- Create: `tests/unit/prompt-template-catalog.test.mjs`

**Interfaces:**
- Consumes: `collectProductInventory` and `loadUseCaseManifest`.
- Produces: the validated aggregate catalog used by every later task.

- [ ] **Step 1: Write failing loader safety and count tests**

```js
test("complete catalog has exact kind and prompt counts", () => {
  const result = validatePromptTemplateCatalog({ entries: completeFixture() });
  assert.deepEqual(result.counts, {
    skillTemplates: 90,
    useCases: 36,
    recipes: 12,
    suiteCases: 8,
    total: 146,
    appPrompts: 146,
    cliPrompts: 146,
  });
});

test("loader rejects duplicate IDs and symlink shards", async (t) => {
  await assert.rejects(
    () => loadPromptTemplateCatalog({ repoRoot: await duplicateIdFixture(t) }),
    /duplicate prompt template id/u,
  );
  await assert.rejects(
    () => loadPromptTemplateCatalog({ repoRoot: await symlinkShardFixture(t) }),
    /symlink/u,
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/prompt-template-catalog.test.mjs`
Expected: FAIL because the module is absent.

- [ ] **Step 3: Add the canonical index**

```json
{
  "version": 1,
  "sources": [
    "catalog/studio-foundations.json",
    "catalog/studio-production.json",
    "catalog/studio-visual.json",
    "catalog/career-foundations.json",
    "catalog/career-evidence.json",
    "catalog/career-visual.json",
    "catalog/studio-scenarios.json",
    "catalog/career-scenarios.json",
    "catalog/suite.json"
  ]
}
```

- [ ] **Step 4: Implement the loader and semantic validator**

```js
export const PROMPT_LEVELS = Object.freeze(["beginner", "standard", "advanced"]);
export const PROMPT_KIND_COUNTS = Object.freeze({
  "skill-template": 90,
  "use-case": 36,
  "recipe": 12,
  "suite-case": 8,
});

export async function loadPromptTemplateCatalog({ repoRoot }) {
  const root = await realpath(repoRoot);
  await assertNoSymlinkPath(root, "guides/prompt-templates/catalog.json", "prompt catalog index");
  const index = JSON.parse(await readFile(joinWithin(root, "guides/prompt-templates/catalog.json"), "utf8"));
  const entries = [];
  for (const source of assertUniqueNormalizedPaths(index.sources, "prompt catalog sources")) {
    if (!source.startsWith("catalog/")) throw new Error("prompt catalog source must stay under catalog/");
    const relative = "guides/prompt-templates/" + source;
    await assertNoSymlinkPath(root, relative, "prompt catalog shard");
    const shard = JSON.parse(await readFile(joinWithin(root, relative), "utf8"));
    if (!Array.isArray(shard)) throw new Error("prompt catalog shard must be an array");
    entries.push(...shard);
  }
  const result = validatePromptTemplateCatalog({ entries });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])), counts: result.counts };
}
```

Close unknown fields. Require ID, kind, product, title, audiences, level, skill/chain, input arrays, placeholders, two App strings, two CLI strings, roles, intermediate artifacts, three output layers, file tree, read order, human boundary, holds, resume prompt, safety boundary and diagram binding. Validate real skill/template/role IDs, namespaces, safe paths, unique text and no credential/PII request.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog.json guides/prompt-templates/catalog.schema.json tooling/lib/prompt-template-catalog.mjs tests/unit/prompt-template-catalog.test.mjs
git commit -m "feat: add prompt template catalog contract"
```

### Task 2: Deterministic prompt guide renderer

**Files:**
- Create: `tooling/lib/prompt-guides.mjs`
- Create: `tooling/build-prompt-guides.mjs`
- Create: `tests/unit/prompt-guides.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes Task 1 loader.
- Produces library Markdown, managed sections and package projections.

- [ ] **Step 1: Write failing renderer, marker and check-mode tests**

```js
test("renderPromptCard emits the fixed readable order", () => {
  const markdown = renderPromptCard(validSkillEntry());
  assertOrdered(markdown, [
    "### 사용하는 경우", "### 준비 입력", "### 바꿀 자리표시자",
    "### Codex App 완성 예시", "### Codex App 재사용 템플릿",
    "### Codex CLI 완성 예시", "### Codex CLI 재사용 템플릿",
    "### 스킬·전문 역할 흐름", "### 예상 결과물",
    "### 사람 검토", "### 실패와 재개",
  ]);
});

test("managed sections require one exact marker pair", () => {
  assert.throws(() => replaceManagedSection("no markers", "studio:vision", "new"), /exactly one/u);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/prompt-guides.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement renderer and bounded marker replacement**

```js
export function replaceManagedSection(markdown, markerId, body) {
  const start = "<!-- PROMPT-TEMPLATES:START " + markerId + " -->";
  const end = "<!-- PROMPT-TEMPLATES:END " + markerId + " -->";
  if (markdown.split(start).length !== 2 || markdown.split(end).length !== 2) {
    throw new Error("expected exactly one prompt-template marker pair: " + markerId);
  }
  return markdown.slice(0, markdown.indexOf(start) + start.length)
    + "\n" + body.trim() + "\n"
    + markdown.slice(markdown.indexOf(end));
}
```

`renderPromptCard` must emit five `text` blocks: App example/template, CLI example/template and resume prompt. Then emit skill chain, roles, intermediate Artifact, minimum/optional/extended results, file tree, read order, reviewer/hold/approval boundary and safety.

- [ ] **Step 4: Implement atomic build and drift check**

Build all outputs in memory. Validate the complete graph before writing. Build mode atomically replaces only regular contained targets. Check mode writes into a guarded temporary root and compares committed bytes.

Add scripts:

```json
"build:prompt-guides": "node tooling/build-prompt-guides.mjs",
"check:prompt-guides": "node tooling/build-prompt-guides.mjs --check"
```

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test tests/unit/prompt-guides.test.mjs
git add tooling/lib/prompt-guides.mjs tooling/build-prompt-guides.mjs tests/unit/prompt-guides.test.mjs package.json
git commit -m "feat: add deterministic prompt guide renderer"
```

### Task 3: Studio foundation skill templates

**Files:**
- Create: `guides/prompt-templates/catalog/studio-foundations.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

**Exact 15-entry matrix:**

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `apply-document-quality-profile` | 목적·대상·형식 선택 | overlay·preset manifest | fallback·state receipt·사람 승인 |
| `define-game-vision` | 아이디어와 player promise | pillar·anti-pillar·prototype | 상충 기능·근거·owner |
| `design-player-experience` | 행동·피드백 | onboarding·오류·접근성 | 멀티모달 UX·책임 gate |
| `design-game-systems` | 규칙과 상태 | rule·state·exception·data | 상호 시스템·반례·engineering |
| `design-game-content` | 퀘스트/NPC 한 개 | content graph·state·reward | narrative·production·rights |

- [ ] **Step 1: Add an exact ID, level and namespace test**
- [ ] **Step 2: Run `node --test --test-name-pattern="Studio foundation" tests/unit/prompt-template-catalog.test.mjs` and confirm RED**
- [ ] **Step 3: Author 15 unique entries from the product SKILL.md, guide, routing and template/profile maps**

Representative ID and prompts:

```json
{
  "id": "studio:define-game-vision:beginner",
  "kind": "skill-template",
  "product": "game-design-studio",
  "level": "beginner",
  "skill": "define-game-vision",
  "skill_chain": ["define-game-vision"],
  "app_prompt": {
    "example": "@Game Design Studio 낯선 섬 협동 복구 게임의 대상 플레이어, player promise, pillar 하나와 검증 질문을 짧은 기획 브리프로 만들어 줘. 모르는 정보는 미정으로 남겨 줘.",
    "template": "@Game Design Studio [게임 아이디어]의 대상 플레이어, player promise, pillar 하나와 검증 질문을 짧은 기획 브리프로 만들어 줘. 모르는 정보는 미정으로 남겨 줘."
  },
  "cli_prompt": {
    "example": "$game-design-studio:define-game-vision 낯선 섬 협동 복구 게임을 vision-pillars와 game-design-brief로 작성하고 design owner 결정을 기다려.",
    "template": "$game-design-studio:define-game-vision [게임 아이디어]를 vision-pillars와 game-design-brief로 작성하고 [검토자 역할] 결정을 기다려."
  }
}
```

Complete all schema fields with skill-specific content; do not clone prompts across levels.

- [ ] **Step 4: Run the whole catalog test and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/studio-foundations.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Studio foundation prompt templates"
```

### Task 4: Studio production skill templates

**Files:**
- Create: `guides/prompt-templates/catalog/studio-production.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `design-game-economy-and-liveops` | source·sink | progression·guardrail·rollback | experiment·telemetry·player protection |
| `plan-game-production` | 범위·제외·위험 | milestone·dependency·owner | kill criteria·outsourcing·license |
| `orchestrate-game-design-project` | 제한된 brief | 여러 Artifact 연결 | 역할 검토·결정 병합·재개 |
| `review-game-design` | 누락·모순 질문 | evidence gap·severity·owner | 교차 도메인 finding·decision queue |
| `export-game-design-documents` | MD terminal | PDF·DOCX preflight | PPTX story·format QA·부분 재개 |

- [ ] **Step 1: Add failing output-ownership, no-success-guarantee and renderer-boundary tests**
- [ ] **Step 2: Run the focused test and confirm RED**
- [ ] **Step 3: Author 15 entries; keep economy metrics provisional and derivative formats capability-gated**
- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/studio-production.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Studio production prompt templates"
```

### Task 5: Studio visual and image templates

**Files:**
- Create: `guides/prompt-templates/catalog/studio-visual.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `plan-image-assets` | prompt-only slot | stable ID·alt·count | profile slot·rights·handoff |
| `generate-image-assets` | selected asset | required receipt | all mode·provider failure·provenance |
| `review-image-assets` | document concept | rights·readability·placement | production-candidate·재검토 |
| `visualize-game-design` | 규칙 흐름 | Archify 우선·fallback | source mapping·receipt·visual QA |
| `svg-infographic` | 간단 SVG | source-backed 2× PNG | lint·render·접근성·승인 |

- [ ] **Step 1: Add failing IMAGE_GEN_MODE, no-key and Archify fallback tests**
- [ ] **Step 2: Run the focused test and confirm RED**
- [ ] **Step 3: Author 15 entries with exact concept/document-approved/production-candidate separation**
- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/studio-visual.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Studio visual prompt templates"
```

### Task 6: Career foundation skill templates

**Files:**
- Create: `guides/prompt-templates/catalog/career-foundations.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `apply-document-quality-profile` | 목표 역할 문서 선택 | audience·format·preset | evidence state·fallback·reviewer |
| `map-game-design-career` | 두 역할 비교 | competency gap·12주 과제 | 복수 경로·교환조건·재평가 |
| `research-game-design-jobs` | 공고 한 개 | 날짜·지역·표본 | 최신성·blind spot·일반화 제한 |
| `reverse-engineer-game-design` | 관찰/추론 | rule·UI·economy 가설 | 반증·rights·대안 |
| `orchestrate-game-design-career` | 단계·목표 brief | research→portfolio | 역할 검토·handoff·재개 |

- [ ] **Step 1: Add failing freshness, fact/inference and no-hiring-guarantee tests**
- [ ] **Step 2: Run the focused test and confirm RED**
- [ ] **Step 3: Author 15 unique entries; require source URL/date/region/sample boundaries only when current facts are used**
- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/career-foundations.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Career foundation prompt templates"
```

### Task 7: Career evidence and delivery templates

**Files:**
- Create: `guides/prompt-templates/catalog/career-evidence.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `build-game-design-portfolio` | 문제·판단·근거 | claim-evidence index | case selection·기여·공개 gate |
| `practice-game-design-interview` | 근거 질문 한 개 | 네 질문 유형·답변 기록 | stale 갱신·정직한 답변·coach |
| `review-game-design-portfolio` | 5축 빠른 검토 | finding·severity·queue | mutation·발표 readiness·승인 |
| `plan-junior-growth` | 4주 목표 | 12주 증거 프로젝트 | 전환 준비도·fresh requirement |
| `export-career-documents` | MD 요약 | PDF·DOCX preflight | recruiter PPTX·format QA·재개 |

- [ ] **Step 1: Add failing evidence-link, personal-contribution and honest-claim tests**
- [ ] **Step 2: Run RED**
- [ ] **Step 3: Author 15 entries; never invent experience, contribution, outcome or hiring probability**
- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/career-evidence.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Career evidence prompt templates"
```

### Task 8: Career visual and image templates

**Files:**
- Create: `guides/prompt-templates/catalog/career-visual.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

| Skill | Beginner | Standard | Advanced |
| --- | --- | --- | --- |
| `plan-image-assets` | portfolio placeholder | proof image·alt·rights | profile slot·presentation handoff |
| `generate-image-assets` | selected cover concept | proof-image receipt | provider failure·provenance·retry |
| `review-image-assets` | document concept | 공개 권리·가독성 | production candidate·review cycle |
| `visualize-career-roadmap` | 역할 비교 흐름 | competency dependency | Archify·fallback·receipt |
| `svg-infographic` | 학습 roadmap SVG | evidence map | lint·2× render·접근성·승인 |

- [ ] **Step 1: Add failing privacy, attribution, provider-policy and diagram-routing tests**
- [ ] **Step 2: Run RED**
- [ ] **Step 3: Author 15 entries with portfolio-publication and named-reviewer boundaries**
- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/career-visual.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add Career visual prompt templates"
```

### Task 9: Existing cases, recipes and suite cases

**Files:**
- Create: `guides/prompt-templates/catalog/studio-scenarios.json`
- Create: `guides/prompt-templates/catalog/career-scenarios.json`
- Create: `guides/prompt-templates/catalog/suite.json`
- Modify: `tests/unit/prompt-template-catalog.test.mjs`

**Interfaces:**
- Completes the exact 146-entry catalog.
- Binds existing `ST-C01..08`, `ST-G01..10`, `CA-C01..08`, `CA-T01..10` and the 12 recipe files.

- [ ] **Step 1: Write failing exact count and source-binding tests**

```js
assert.deepEqual(catalog.counts, {
  skillTemplates: 90,
  useCases: 36,
  recipes: 12,
  suiteCases: 8,
  total: 146,
  appPrompts: 146,
  cliPrompts: 146,
});
for (const entry of catalog.entries.filter((value) => value.kind === "use-case")) {
  assert.ok(useCaseManifestIds.has(entry.source_case_id));
}
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/prompt-template-catalog.test.mjs`
Expected: FAIL with 56 missing scenario entries.

- [ ] **Step 3: Author 24 Studio and 24 Career scenario entries**

Each existing case preserves its manifest audiences, skills, templates, results, owner and approval boundary. Each recipe preserves the ordered CLI calls and artifact paths from its source file. Add complete App/CLI example/template pairs rather than merely linking to the old request.

- [ ] **Step 4: Author the exact suite cases**

| ID | Ordered chain | Minimum result |
| --- | --- | --- |
| `suite:studio-to-career-handoff:case` | Studio review → public evidence → Career portfolio | 공개 가능한 문제·판단·검증 summary |
| `suite:reverse-to-system-proposal:case` | Career reverse design → Studio system design → review | fact/inference 역기획과 system specification |
| `suite:multi-domain-portfolio:case` | Studio system·UX·economy → Career portfolio | 개인 판단과 evidence index |
| `suite:gdd-image-presentation:case` | Studio GDD → image plan/review → export | content.md, approved images, PPTX preflight |
| `suite:career-proof-project-interview:case` | Career map → Studio proof project → Career interview | 12주 proof와 evidence-linked 답변 |
| `suite:student-mentor-review:case` | Studio task → Career review → human feedback | 과제, 루브릭, 수정 기록 |
| `suite:work-to-public-case:case` | Studio safe summary → Career artifact | 공개 요약과 제외 기록 |
| `suite:resume-failed-derivatives:case` | canonical artifact → failed image/export → retry | 보존 파일, blocker, resume receipt |

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test tests/unit/prompt-template-catalog.test.mjs
git add guides/prompt-templates/catalog/studio-scenarios.json guides/prompt-templates/catalog/career-scenarios.json guides/prompt-templates/catalog/suite.json tests/unit/prompt-template-catalog.test.mjs
git commit -m "docs: add prompt scenario catalog"
```

### Task 10: Generated prompt library and guide integration

**Files:**
- Generate: `guides/prompt-templates/README.md`
- Generate: 15 Studio, 15 Career and 8 suite prompt pages
- Modify: the 30 exact skill guides corresponding one-to-one with Appendix A
- Modify: 4 product use-case body files
- Modify: all 12 `guides/game-design-*/recipes/*.md` files
- Create: `tests/contracts/prompt-template-guides.test.mjs`

- [ ] **Step 1: Write failing production guide contracts**

Assert 38 detail pages, 146 visible cards, 292 App/CLI execution paths, 584 primary example/template blocks, 146 resume blocks, per-skill exact level triples, stable catalog IDs, result layers, human boundary and diagram binding. Mutation tests reject swapped chains, missing result layers, wrong namespace and removed reviewer.

- [ ] **Step 2: Run RED**

Run: `node --test tests/contracts/prompt-template-guides.test.mjs`
Expected: FAIL because pages and managed markers are absent.

- [ ] **Step 3: Add exact marker pairs**

- Skill marker ID는 `productId + ":" + skillId`로 계산한다. 예: `game-design-studio:define-game-vision`, `game-design-career:map-game-design-career`.
- Case marker: lowercase source case ID inside that case section.
- Recipe marker ID는 `productId + ":recipe:" + recipeSlug`로 계산한다. 예: `game-design-studio:recipe:new-game-gdd`, `game-design-career:recipe:reverse-design`.
- Do not add new H2 headings to the 30 skill guides; their 14-heading order remains stable.

- [ ] **Step 4: Complete the renderer**

Generate the hub, 30 skill pages and 8 suite pages. Update every owner file in memory, validate the full graph, and only then write. The hub must index by user, goal, level, product, skill, output format, image/diagram need and reviewer.

- [ ] **Step 5: Build, check and test**

```bash
npm run build:prompt-guides
npm run check:prompt-guides
node --test tests/contracts/prompt-template-guides.test.mjs
```

Expected: exit 0; a second build changes no bytes.

- [ ] **Step 6: Commit**

```bash
git add guides/prompt-templates guides/game-design-studio/skills guides/game-design-career/skills guides/game-design-studio/use-cases guides/game-design-career/use-cases guides/game-design-studio/recipes guides/game-design-career/recipes tests/contracts/prompt-template-guides.test.mjs
git commit -m "docs: publish reusable prompt template library"
```

### Task 11: README routing and Markdown readability

**Files:**
- Modify: `README.md`
- Modify: `guides/README.md`
- Modify: both product guide READMEs and `guides/use-cases/README.md`
- Modify: `guides/use-cases/audience-paths.md`
- Modify: both `products/*/plugin/README.md` files
- Modify: `tooling/lib/user-guides.mjs`
- Modify: root, use-case and product README contract tests

- [ ] **Step 1: Write failing navigation and readability tests**

Root README exposes these exact representative IDs:

- `studio:define-game-vision:beginner`
- `studio:design-game-systems:standard`
- `studio:design-player-experience:standard`
- `studio:orchestrate-game-design-project:advanced`
- `career:map-game-design-career:beginner`
- `career:reverse-engineer-game-design:standard`
- `career:build-game-design-portfolio:advanced`
- `suite:career-proof-project-interview:case`

Add `assertReadableResultBoundaries` to reject a visible paragraph containing three or more contract labels among minimum, optional, expanded, owner, hold, resume and safety.

- [ ] **Step 2: Run RED**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
```

- [ ] **Step 3: Rewrite all six audience result-boundary sections**

```markdown
#### 결과물

- 최소 결과: 목표, 평가 질문, 피드백 기록, 다음 과제
- 선택 결과: 루브릭 표, 흐름 도식 source, 발표·이미지 prompt
- 확장 결과: 학생 또는 팀원이 설명한 판단과 검증 evidence가 남은 검토 패키지

#### 사람 검토

- 승인 주체: 교사 또는 멘토
- 보류 대상: 검토 패키지
- 승인 경계: 교사 또는 멘토가 검토하고 승인 전에는 평가 완료로 표시하지 않음

#### 실패와 재개

- 재개 조건: 기관 AI 정책 또는 공개 권한 미확인
- 재개 요청: `정책과 공개 권한을 확인할 질문, 다음 과제, 사람 피드백 지점을 다시 정리해 줘.`
- 안전·증거 경계: 답안 대행·자동 승인 대신 질문과 사람 피드백으로 재개
```

Preserve every existing owner, hold, resume and safety clause.

- [ ] **Step 4: Split prose-heavy tables into summary tables and list cards**

Keep short comparisons. Move multi-sentence input, chain, result and approval content in root/product READMEs into list cards. Product package README links must remain inside the package root.

- [ ] **Step 5: Run targeted tests and guide validation**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs
npm run validate:guides
```

- [ ] **Step 6: Commit**

```bash
git add README.md guides products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md tooling/lib/user-guides.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs
git commit -m "docs: route users through prompt examples and readable outcomes"
```

### Task 12: Optional Archify runtime capability and routing

**Files:**
- Modify: `shared/scripts/capability-probe.mjs`
- Modify: `tests/unit/capability-probe.test.mjs`
- Modify: both product visualization and orchestrator SKILL.md files
- Modify: `tests/products/studio/output-skills.test.mjs`
- Modify: `tests/products/career/output-skills.test.mjs`

**Interfaces:**
- Produces `capabilities.archify = { status, provider?, version? }` without an absolute host path.

- [ ] **Step 1: Write failing probe tests**

```js
test("detects a regular host Archify skill without exposing its path", async () => {
  const home = await temporaryWorkspace();
  const root = join(home, ".agents/skills/archify");
  await mkdir(join(root, "bin"), { recursive: true });
  await writeFile(join(root, "SKILL.md"), "---\nname: archify\n---\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ version: "2.13.0" }));
  await writeFile(join(root, "bin/archify.mjs"), "#!/usr/bin/env node\n");
  assert.deepEqual(await probeArchifyCapability({}, { home }), {
    status: "available",
    provider: "host-archify-skill",
    version: "2.13.0",
  });
});
```

Also test absent, symlink, malformed version, inaccessible path and no absolute path in SessionStart JSON.

- [ ] **Step 2: Run RED**

Run: `node --test --test-name-pattern="Archify" tests/unit/capability-probe.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement read-only detection**

Candidate order:

1. `path.join(codexHome, "skills", "archify")`
2. `path.join(home, ".agents", "skills", "archify")`

Require regular non-symlink `SKILL.md`, `package.json` and `bin/archify.mjs`. Accept version 2.13.0 or newer within major 2. Return only status/provider/version. Absence is `unavailable`; permission or malformed state is `unknown`.

- [ ] **Step 4: Update product routing contracts**

For architecture, workflow, sequence, dataflow or lifecycle:

1. Use host `archify` when capability status is available.
2. Preserve JSON spec, checked HTML and receipt as a separate lane.
3. Always provide packaged Skillstead SVG/2× PNG fallback for Markdown.
4. Record `archify-unavailable` or `archify-failed` truthfully.
5. Never label fallback as Archify output or auto-approve either asset.

- [ ] **Step 5: Run tests and commit**

```bash
node --test tests/unit/capability-probe.test.mjs tests/products/studio/output-skills.test.mjs tests/products/career/output-skills.test.mjs
git add shared/scripts/capability-probe.mjs tests/unit/capability-probe.test.mjs products/game-design-studio/plugin/skills/visualize-game-design/SKILL.md products/game-design-career/plugin/skills/visualize-career-roadmap/SKILL.md products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md products/game-design-career/plugin/skills/orchestrate-game-design-career/SKILL.md tests/products/studio/output-skills.test.mjs tests/products/career/output-skills.test.mjs
git commit -m "feat: route structural diagrams through optional Archify"
```

### Task 13: Archify builder and 50 checked HTML artifacts

**Files:**
- Create: `tooling/lib/archify-guides.mjs`
- Create: `tooling/build-archify-guides.mjs`
- Create: `guides/assets/archify/manifest.json`
- Create: `tests/unit/archify-guides.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes catalog diagram bindings.
- Produces 50 workflow specs, HTML files and digest receipts.

- [ ] **Step 1: Write failing fake-CLI tests**

The fixture records exact argument arrays `["validate", "workflow", specPath, "--quality", "showcase", "--json"]` and `["deliver", "workflow", specPath, htmlPath, "--quality", "showcase", "--json"]`. Reject nonzero exit, warning receipt, 4-check basic receipt, digest mismatch, symlink output, check-mode drift and nondeterministic bytes.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/archify-guides.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement deterministic workflow spec generation**

```js
export function buildArchifyWorkflowSpec(entry) {
  return {
    schema_version: 1,
    diagram_type: "workflow",
    meta: {
      title: entry.title,
      subtitle: "입력에서 스킬·사람 검토·결과물로 이어지는 실행 흐름",
      animation: "none",
      visual_preset: "editorial",
      quality_profile: "showcase",
      views: entry.diagram_binding.archify.views,
      viewBox: [960, 900],
    },
    lanes: entry.diagram_binding.archify.lanes,
    mainPath: entry.diagram_binding.archify.main_path,
    nodes: entry.diagram_binding.archify.nodes,
    edges: entry.diagram_binding.archify.edges,
  };
}
```

Skill specs use beginner/standard/advanced views. Recipe and suite specs use input, skill/role, review/approval and result/resume lanes. Limit nodes to 12, views to 3 for skills, focus IDs to existing nodes and one main path.

- [ ] **Step 4: Implement validate/deliver/check transactions**

Capture JSON stdout. Require all 9 artifact checks, zero errors and zero warnings. Write receipt only after HTML exists and receipt SHA-256 matches exact spec and artifact bytes. Check mode delivers to a guarded temporary root and compares bytes.

- [ ] **Step 5: Add scripts and run fixture tests**

```json
"build:archify-guides": "node tooling/build-archify-guides.mjs",
"check:archify-guides": "node tooling/build-archify-guides.mjs --check"
```

Run: `node --test tests/unit/archify-guides.test.mjs`
Expected: PASS.

- [ ] **Step 6: Build the real assets without opening a browser**

```bash
node /Users/freelife/.agents/skills/archify/bin/archify.mjs doctor
npm run build:archify-guides
npm run check:archify-guides
```

Expected: 30 skill + 12 recipe + 8 suite specs, HTML files and receipts; showcase 9/9, 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add tooling/lib/archify-guides.mjs tooling/build-archify-guides.mjs guides/assets/archify tests/unit/archify-guides.test.mjs package.json
git commit -m "feat: build verified Archify prompt flows"
```

### Task 14: Ninety static prompt-flow fallbacks

**Files:**
- Create: `guides/assets/prompt-flow-diagram-sources.json`
- Modify: `tooling/build-use-case-diagrams.mjs`
- Modify: `guides/assets/diagram-manifest.json`
- Modify: `tests/unit/build-use-case-diagrams.test.mjs`
- Modify: `tests/contracts/user-guide-shared-diagrams.test.mjs`

- [ ] **Step 1: Write failing source and output tests**

Assert exactly 90 `scope: "prompt-flow"` sources. IDs equal the safe diagram IDs of the 90 skill entries. Each output resolves through `diagram_binding.static.svg/png`. Existing exact 33 Studio and 33 Career production-source contracts remain unchanged.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/build-use-case-diagrams.test.mjs`
Expected: FAIL because prompt sources are not loaded.

- [ ] **Step 3: Extend the existing builder**

Load both diagram source files. Existing scopes resolve through `use-case-manifest.json`; `prompt-flow` resolves through `loadPromptTemplateCatalog`. Reuse `renderDiagramSvg` and the product-owned Skillstead wrapper; do not copy rendering or lint logic.

- [ ] **Step 4: Generate the 90 sources from the catalog**

Each source has four or five steps: required input → skill/first chain → intermediate Artifact → named review → result or resumable hold. The conclusion names the human boundary. `source_paths` and `used_by` point to the shard and generated prompt page.

- [ ] **Step 5: Build, check and test**

```bash
npm run build:guide-diagrams
npm run check:guide-diagrams
node --test tests/unit/build-use-case-diagrams.test.mjs tests/contracts/user-guide-shared-diagrams.test.mjs
```

Expected: legacy 72 plus new 90 generated pairs are deterministic, lint is 0/0, and PNGs are 2800×1800 with exact IEND.

- [ ] **Step 6: Commit**

```bash
git add guides/assets/prompt-flow-diagram-sources.json guides/assets/diagram-manifest.json guides/assets/archify tooling/build-use-case-diagrams.mjs tests/unit/build-use-case-diagrams.test.mjs tests/contracts/user-guide-shared-diagrams.test.mjs
git commit -m "docs: add static prompt flow fallbacks"
```

### Task 15: Diagram embedding and visual QA

**Files:**
- Modify generated prompt pages and 30 managed skill sections
- Create: `guides/assets/ARCHIFY-VISUAL-QA.md`
- Modify: `guides/assets/VISUAL-QA.md`
- Modify: `tests/contracts/prompt-template-guides.test.mjs`

- [ ] **Step 1: Add failing embed and accessibility tests**

Each skill card embeds its level PNG linked to editable SVG and links to checked Archify HTML. Adjacent labels distinguish interactive Archify authority from static Skillstead fallback.

- [ ] **Step 2: Run RED**

Run: `node --test tests/contracts/prompt-template-guides.test.mjs`
Expected: FAIL for missing embeds/status.

- [ ] **Step 3: Update renderer and regenerate**

```markdown
[![실행 흐름 대체 텍스트](static-flow.png)](static-flow.svg)

[검증된 Archify 실행 흐름 열기](flow.html)

- 정적 fallback: Skillstead editable SVG와 검증된 2× PNG
- 대화형 기준: Archify checked HTML과 digest receipt
```

- [ ] **Step 4: Perform headless visual QA**

Capture screenshots without opening a window for 3 Studio skills, 3 Career skills, 2 recipes and all 8 suite flows. Inspect with `view_image` at high and original. Inspect the longest-label Studio/Career static diagrams and one Korean-heavy suite diagram. Record IDs, tool versions, both themes, clipping, overlap, connectors, CJK and receipt results.

- [ ] **Step 5: Rebuild focused repairs and run complete checks**

```bash
npm run check:archify-guides
npm run check:guide-diagrams
node --test tests/contracts/prompt-template-guides.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add guides tests/contracts/prompt-template-guides.test.mjs
git commit -m "docs: embed and verify prompt execution diagrams"
```

### Task 16: Package prompt references and rebuild snapshots

**Files:**
- Generate: both `products/*/plugin/references/prompt-templates.json` files
- Modify: both product orchestrator SKILL.md and source README files
- Modify: `tests/contracts/package-contents.test.mjs`
- Modify: `tests/isolation/plugin-smoke.test.mjs`
- Generate: both `plugins/*` snapshots

- [ ] **Step 1: Write failing projection tests**

```js
for (const [product, expected] of [["game-design-studio", 77], ["game-design-career", 77]]) {
  test(product + " packages prompt templates", async (t) => {
    const build = await cleanBuild(t, product);
    const projection = JSON.parse(await readFile(join(build.outputDir, "references/prompt-templates.json"), "utf8"));
    assert.equal(projection.entries.length, expected);
    assert.equal(projection.entries.filter((entry) => entry.product === "suite").length, 8);
  });
}
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/contracts/package-contents.test.mjs tests/isolation/plugin-smoke.test.mjs`
Expected: FAIL for missing references.

- [ ] **Step 3: Generate safe product projections**

Studio projection contains Studio 69 + suite 8; Career contains Career 69 + suite 8. Remove checkout-only paths and host Archify paths. Retain IDs, prompts, chains, result layers, review and resume contracts.

- [ ] **Step 4: Make orchestrators load the packaged reference**

Allow exact prompt ID or nearest intent selection. Unknown IDs fail closed and return nearest IDs plus differences. Templates provide phrasing/routing only; they cannot supply missing facts or approval.

- [ ] **Step 5: Build and verify isolation**

```bash
npm run build:prompt-guides
npm run build
node --test tests/contracts/package-contents.test.mjs tests/isolation/plugin-smoke.test.mjs
```

Expected: both products include the reference, no sibling/host path, and no Archify bundle.

- [ ] **Step 6: Commit**

```bash
git add products plugins tests/contracts/package-contents.test.mjs tests/isolation/plugin-smoke.test.mjs
git commit -m "build: package prompt template references"
```

### Task 17: Final validation and deterministic handoff

**Files:**
- Modify only files required by proven failures.

- [ ] **Step 1: Run formatting and narrow contracts**

```bash
git diff --check
node --test tests/unit/prompt-template-catalog.test.mjs tests/unit/prompt-guides.test.mjs tests/unit/archify-guides.test.mjs tests/unit/capability-probe.test.mjs tests/unit/build-use-case-diagrams.test.mjs
node --test tests/contracts/prompt-template-guides.test.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs
```

- [ ] **Step 2: Run all guide and diagram gates**

```bash
npm run check:prompt-guides
npm run check:archify-guides
npm run check:guide-diagrams
npm run validate:guides
```

Expected counts include 30 skill pages, 90 skill templates, 146 total cases, 292 execution paths, 730 copyable `text` blocks, 50 Archify artifacts and 90 new static prompt diagrams.

- [ ] **Step 3: Run suite validation and full tests**

```bash
npm run validate
npm test
```

Expected: exit 0 with no required test failed, cancelled or skipped.

- [ ] **Step 4: Prove deterministic rebuild**

```bash
npm run build:prompt-guides
npm run build:archify-guides
npm run build:guide-diagrams
npm run build
npm run check:prompt-guides
npm run check:archify-guides
npm run check:guide-diagrams
node tooling/build-snapshots.mjs --check
```

Expected: the second pass changes no bytes and both product tree hashes remain stable.

- [ ] **Step 5: Verify protected state**

Main checkout `package-lock.json` remains untracked with SHA-256 `fb94f141e42bee0329e7cfbad365d82f979c76a51dd77b908da0124931755242`.

- [ ] **Step 6: Commit only proven corrections**

Stage the exact files changed by a diagnosed failure and commit `fix: finalize prompt guide validation`. Skip this commit when no correction is needed.

- [ ] **Step 7: Request final independent review**

Review the full branch against the design. Fix only proven Important/Critical defects, rerun the smallest failing check and then Steps 1–5.

---

## Execution Order and Review Gates

1. Tasks 1–2 establish schema, loader and renderer.
2. Tasks 3–8 add six independent 15-entry skill shards.
3. Task 9 closes the exact 146-case, 292-path and 730-block catalog.
4. Tasks 10–11 publish text documentation and repair readability.
5. Tasks 12–15 add optional Archify routing and visual assets.
6. Task 16 packages product projections and rebuilds snapshots.
7. Task 17 performs final review and verification.

Do not start Tasks 10–17 while the 146-case, 292-path and 730-block catalog contract is red. Do not commit generated snapshots before source checks pass. Do not describe Archify or Skillstead assets as verified until their actual receipts exist.

## Appendix A: Exact generated prompt page inventory

### Studio

- `guides/prompt-templates/studio/apply-document-quality-profile.md`
- `guides/prompt-templates/studio/define-game-vision.md`
- `guides/prompt-templates/studio/design-game-content.md`
- `guides/prompt-templates/studio/design-game-economy-and-liveops.md`
- `guides/prompt-templates/studio/design-game-systems.md`
- `guides/prompt-templates/studio/design-player-experience.md`
- `guides/prompt-templates/studio/export-game-design-documents.md`
- `guides/prompt-templates/studio/generate-image-assets.md`
- `guides/prompt-templates/studio/orchestrate-game-design-project.md`
- `guides/prompt-templates/studio/plan-game-production.md`
- `guides/prompt-templates/studio/plan-image-assets.md`
- `guides/prompt-templates/studio/review-game-design.md`
- `guides/prompt-templates/studio/review-image-assets.md`
- `guides/prompt-templates/studio/svg-infographic.md`
- `guides/prompt-templates/studio/visualize-game-design.md`

### Career

- `guides/prompt-templates/career/apply-document-quality-profile.md`
- `guides/prompt-templates/career/build-game-design-portfolio.md`
- `guides/prompt-templates/career/export-career-documents.md`
- `guides/prompt-templates/career/generate-image-assets.md`
- `guides/prompt-templates/career/map-game-design-career.md`
- `guides/prompt-templates/career/orchestrate-game-design-career.md`
- `guides/prompt-templates/career/plan-image-assets.md`
- `guides/prompt-templates/career/plan-junior-growth.md`
- `guides/prompt-templates/career/practice-game-design-interview.md`
- `guides/prompt-templates/career/research-game-design-jobs.md`
- `guides/prompt-templates/career/reverse-engineer-game-design.md`
- `guides/prompt-templates/career/review-game-design-portfolio.md`
- `guides/prompt-templates/career/review-image-assets.md`
- `guides/prompt-templates/career/svg-infographic.md`
- `guides/prompt-templates/career/visualize-career-roadmap.md`

### Suite

- `guides/prompt-templates/suite/studio-to-career-handoff.md`
- `guides/prompt-templates/suite/reverse-to-system-proposal.md`
- `guides/prompt-templates/suite/multi-domain-portfolio.md`
- `guides/prompt-templates/suite/gdd-image-presentation.md`
- `guides/prompt-templates/suite/career-proof-project-interview.md`
- `guides/prompt-templates/suite/student-mentor-review.md`
- `guides/prompt-templates/suite/work-to-public-case.md`
- `guides/prompt-templates/suite/resume-failed-derivatives.md`
