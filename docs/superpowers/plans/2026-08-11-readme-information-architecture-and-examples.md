# README Information Architecture and Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트 README를 설치부터 결과 검토까지 안내하는 작업 중심 랜딩 페이지로 재구성하고, 18개 검증된 프롬프트 카드, 두 플러그인 file tree와 한국어 Archify 전체 시스템 아키텍처를 추가한다.

**Architecture:** 루트 `README.md`는 선택과 routing을 담당하고, `guides/prompt-templates/`와 `guides/use-cases/`는 실행 계약의 source of truth를 유지한다. 새 suite architecture는 기존 README catalog record를 근거 기반 selected entry로 전환해 Archify spec, published HTML, receipt와 visual QA evidence를 원자적으로 관리한다. README 계약 테스트는 목차, 카드 필드, inventory 수량, 결과물과 시각 자산 링크를 실제 catalog와 교차 검증한다.

**Tech Stack:** Markdown, Node.js 18+, Node test runner, JSON, Archify 2.13, headless Chromium visual QA, repository guide/build validators

## Global Constraints

- 구현 기준 설계는 `docs/superpowers/specs/2026-08-11-readme-information-architecture-and-examples-design.md`다.
- 작업 경로는 `/Users/freelife/game/gamedesign-plugin/.worktrees/readme-use-case-navigation`이다.
- 루트 `README.md`는 Landing 문서이며 상세 스킬·프롬프트 계약을 중복 소유하지 않는다.
- README의 대표 카드는 Studio 7개, Career 7개, Suite 4개로 정확히 18개다.
- README는 Studio와 Career 각각 설치 스킬 15개와 에이전트 9개를 전부 나열한다.
- 설치 스킬 15개는 제품 source 스킬 14개와 vendored Skillstead `svg-infographic` 1개로 구분한다.
- 모든 스킬 행은 설치 namespace 직접 호출 커맨드와 상세 가이드 링크를 가진다.
- 모든 에이전트 행은 역할, 주요 검토 지점, 호출 경계와 상세 역할 문서 링크를 가진다.
- 사례, 스킬과 에이전트의 첫 표시는 한글 제목 또는 역할명이 먼저 오고 stable 영문 ID는 괄호에 둔다.
- README의 추가 설명 도식은 Skillstead 0.8.3으로 작성하고 editable SVG와 2× PNG를 함께 보존한다.
- 복사 가능한 prompt 코드 줄은 80자를 넘기지 않는다.
- 편집 원본은 `products/<product>/plugin/`이며 `plugins/<product>/`는 표준 빌드가 생성한다.
- generated plugin tree와 `BUILD-MANIFEST.json`을 직접 편집하지 않는다.
- Studio와 Career file tree는 agents 9, skills 15, templates 15, scripts 14를 정확히 표시한다.
- 새 Archify ID는 `suite-plugin-system-architecture`, type은 `architecture`, quality profile은 `showcase`다.
- 최종 Archify `validate`와 `deliver`는 9/9, errors 0, warnings 0이어야 한다.
- Archify viewer와 사양의 사용자 가시 텍스트는 한국어로 유지한다.
- README의 정적 architecture PNG는 대화형 HTML 링크로 감싼다.
- 이미지·파생 문서·검토 결과는 자동 승인하지 않는다.
- capability가 없거나 QA가 실패하면 기준 Markdown과 검증 결과를 보존하고 해당 lane만 차단한다.
- 새 dependency를 추가하지 않는다.
- 기존 3개 published Archify 도식을 삭제하거나 의미를 변경하지 않는다.
- main worktree의 미추적 `package-lock.json`은 읽거나 수정하거나 커밋하지 않는다.

---

## File Structure

### Create

- `guides/archify-diagrams/specs/suite/suite-plugin-system-architecture.json`: 전체 플러그인 구성 요소와 승인 경계를 표현하는 Archify architecture source
- `guides/assets/archify/suite/suite-plugin-system-architecture.html`: 검증·시각 QA를 통과한 한국어 대화형 도식
- `guides/assets/archify/suite/suite-plugin-system-architecture.receipt.json`: spec·artifact SHA-256과 Archify 9/9 전달 receipt
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/read.png`: README 정적 미리보기
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/light.png`: light theme QA evidence
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/dark.png`: dark theme QA evidence
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/view-plugin-boundaries.png`: 플러그인 경계 guided view
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/view-artifact-validation.png`: Artifact·검증 guided view
- `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/view-human-approval.png`: 사람 승인 guided view
- `guides/assets/readme/prompt-to-result-flow.svg`: 사례 선택부터 다음 요청까지 설명하는 editable Skillstead source
- `guides/assets/readme/prompt-to-result-flow.png`: 위 도식의 2× PNG
- `guides/assets/readme/skill-agent-collaboration.svg`: 스킬과 에이전트 협업을 설명하는 editable Skillstead source
- `guides/assets/readme/skill-agent-collaboration.png`: 위 도식의 2× PNG
- `guides/assets/readme/artifact-review-flow.svg`: Artifact 읽기와 승인 순서를 설명하는 editable Skillstead source
- `guides/assets/readme/artifact-review-flow.png`: 위 도식의 2× PNG

### Modify

- `README.md`: TOC, 플러그인 선택, 설치, 첫 실행, 18개 프롬프트 카드, 스킬표, 결과물, file tree, architecture와 상세 routing
- `tests/contracts/root-readme-user-guides.test.mjs`: 새 H2 순서, TOC, 카드, inventory, prompt/result binding, architecture embed 계약
- `guides/archify-diagrams/catalog.json`: 기존 root README excluded record를 `suite-plugin-system-architecture` selected/published record로 전환하고 source digest 갱신
- `guides/archify-diagrams/README.md`: 새 architecture 상태, 질문, HTML과 QA 근거 링크
- `guides/archify-diagrams/visual-qa/manifest.json`: 새 도식의 원본·guided render와 digest·판정 기록
- `guides/archify-diagrams/visual-qa/contact-sheets/all.html`: 새 published 도식을 포함한 전체 contact sheet
- `guides/archify-diagrams/visual-qa/contact-sheets/all.png`: 전체 contact sheet PNG
- `guides/archify-diagrams/visual-qa/contact-sheets/product-suite.html`: suite contact sheet
- `guides/archify-diagrams/visual-qa/contact-sheets/product-suite.png`: suite contact sheet PNG
- `guides/archify-diagrams/visual-qa/contact-sheets/type-architecture.html`: architecture contact sheet
- `guides/archify-diagrams/visual-qa/contact-sheets/type-architecture.png`: architecture contact sheet PNG
- `tests/contracts/archify-catalog.test.mjs`: selected 4개와 새 root architecture 상태 계약
- `tests/contracts/archify-specs.test.mjs`: 새 architecture 의미·schema·receipt 계약
- `tests/contracts/archify-visual-qa.test.mjs`: 새 architecture render exact-set·passing QA 계약

### Generated only when the standard command changes them

- `plugins/game-design-studio/**`: `npm run build` 결과를 검증하며 README 작업이 제품 source를 바꾸지 않으면 byte 변경이 없어야 한다.
- `plugins/game-design-career/**`: `npm run build` 결과를 검증하며 README 작업이 제품 source를 바꾸지 않으면 byte 변경이 없어야 한다.

---

### Task 1: Lock the README navigation, card, result, and file-tree contracts

**Files:**
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Reference: `guides/prompt-templates/catalog/studio-scenarios.json`
- Reference: `guides/prompt-templates/catalog/career-scenarios.json`
- Reference: `guides/prompt-templates/catalog/suite.json`
- Reference: `guides/use-cases/use-case-manifest.json`

**Interfaces:**
- Consumes: `collectMarkdownHeadings()`, `extractMarkdownLinks()`, `collectProductInventory()` from `tooling/lib/user-guides.mjs`
- Produces: exact root README contract for Task 2, beginner-readable labels for Task 4, and architecture embed contract hook for Task 7

- [ ] **Step 1: Replace the old H2 contract with the approved ordered set**

Set `requiredRootHeadings` to this exact array:

```js
const requiredRootHeadings = [
  "목차",
  "30초 안에 플러그인 선택하기",
  "설치하기",
  "5분 안에 첫 결과 만들기",
  "케이스별 프롬프트로 시작하기",
  "스킬별로 바로 실행하기",
  "요청 뒤에 생성되는 결과물",
  "플러그인 구조와 전체 시스템 아키텍처",
  "이미지·도식·문서 내보내기",
  "상세 가이드에서 더 알아보기",
  "안전·권리·사람 승인 경계",
  "문제를 해결하고 작업 재개하기",
  "기술 문서·기여·라이선스",
];
```

- [ ] **Step 2: Add the exact representative card registry**

Use these exact source-bound IDs:

```js
const representativeCards = {
  studio: [
    "studio:case:ST-C01",
    "studio:case:ST-C02",
    "studio:case:ST-C03",
    "studio:case:ST-C04",
    "studio:case:ST-C05",
    "studio:case:ST-C07",
    "studio:case:ST-C08",
  ],
  career: [
    "career:case:CA-C01",
    "career:case:CA-C04",
    "career:case:CA-C05",
    "career:case:CA-C06",
    "career:case:CA-C07",
    "career:case:CA-C08",
    "career:case:CA-T01",
  ],
  suite: [
    "suite:studio-to-career-handoff:case",
    "suite:career-proof-project-interview:case",
    "suite:gdd-image-presentation:case",
    "suite:resume-failed-derivatives:case",
  ],
};
```

Load the nine prompt catalog shards through the production loader. For each README card, assert exact binding to `skill_chain`, `minimum_outputs`, `read_order`, `human_review_boundary` and `resume_prompt`.

- [ ] **Step 3: Add a rendered-card parser with non-vacuous failure checks**

Parse every `<details data-prompt-id="…">` block and require these visible labels exactly once:

```js
const requiredCardLabels = [
  "사용 시점",
  "준비 입력",
  "복사할 요청문",
  "실행 흐름",
  "예상 결과",
  "읽는 순서",
  "사람 검토",
  "다음 요청",
];
```

Add mutations that remove one field, duplicate one ID, replace one skill, reverse the read order and remove the human approval sentence. Each mutation must fail with the affected ID in the error message; reject a generic `TypeError` as a passing mutation result.

- [ ] **Step 4: Add TOC and prompt-width contracts**

Assert that `목차` contains an ordered link for every `requiredRootHeadings` item after `목차` itself. Resolve each anchor with `collectMarkdownHeadings()` and reject duplicate, missing or additional entries. Scan fenced `text` blocks inside representative cards and reject any non-empty source line whose Unicode code-point count exceeds 80.

- [ ] **Step 5: Add file-tree inventory contracts**

Require separate `text` blocks beginning with `plugins/game-design-studio/` and `plugins/game-design-career/`. Cross-check each product with the filesystem and production inventory:

```js
const expectedPluginTreeCounts = {
  "game-design-studio": { agents: 9, skills: 15, templates: 15, scripts: 14 },
  "game-design-career": { agents: 9, skills: 15, templates: 15, scripts: 14 },
};
```

Require `.codex-plugin/plugin.json`, `agents/`, `skills/`, `assets/templates/`, `assets/shared/`, `references/`, `scripts/`, `hooks/hooks.json`, `.env.example`, `README.md` and `BUILD-MANIFEST.json`. Require visible source/generated text containing both `products/<product>/plugin/` and `plugins/<product>/`. Add a mutation that tells readers to edit `BUILD-MANIFEST.json` directly and require rejection.

- [ ] **Step 6: Add complete skill and agent inventory contracts**

Require two product-scoped skill tables containing the exact 14 product skill directories plus the generated snapshot's vendored `svg-infographic`, for 15 installed skills per product. Every row must contain the exact namespaced command `$game-design-studio:<skill-id>` or `$game-design-career:<skill-id>`, a non-empty role/result description and a resolvable detailed guide link.

Require two product-scoped agent tables containing the exact nine `agents/*.md` IDs per product. Every row must contain a non-empty role, review focus, an orchestrator/specialist delegation boundary and a resolvable link to the role document. Reject missing, duplicate, cross-product-swapped and invented skill or agent IDs. Reject a README claim that `svg-infographic` is one of the 14 product source skills instead of a vendored installed skill. Mutation failures must name the affected product and ID and must not pass through a generic `TypeError`.

- [ ] **Step 7: Add result-example contracts**

Require the Canonical Artifact tree to include `content.md`, `evidence.yml`, `decisions/`, `assets/` and `export-manifest.yml`. Require six exact result categories:

```js
const resultExampleIds = [
  "game-design-brief",
  "system-specification",
  "ui-ux-flow-state",
  "reverse-design-document",
  "creative-design-portfolio",
  "export-preparation-manifest",
];
```

For every result row, require core file, optional asset, read order and pre-approval hold boundary. Cross-check template IDs against Studio or Career template inventories.

- [ ] **Step 8: Run the focused test and confirm RED**

Run:

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
```

Expected: FAIL on the first new heading or TOC assertion because the current README still uses the old H2 order.

- [ ] **Step 9: Commit the RED contract**

```bash
git add tests/contracts/root-readme-user-guides.test.mjs
git commit -m "test: define structured README contracts"
```

---

### Task 2: Rewrite the README as a task-oriented landing page

**Files:**
- Modify: `README.md`
- Test: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: exact headings, card IDs, result IDs and tree counts from Task 1
- Produces: complete textual README surface; Tasks 4–5 improve beginner readability and Skillstead explanations, Task 7 adds the final architecture image link without restructuring sections

- [ ] **Step 1: Write the new opener and TOC**

Keep the product boundary and non-guarantee in two short paragraphs. Add an ordered TOC whose anchor labels exactly match the 12 remaining H2 headings. Keep the TOC before every installation or usage section.

- [ ] **Step 2: Build the 30-second product selector**

Create a three-row table for Studio, Career and both. Each row must state who uses it, the first request type, the first Artifact and the detailed guide. Keep the existing `plugin-selection-flow.png` embed linked to its SVG.

- [ ] **Step 3: Consolidate installation under one H2**

Use H3 headings `Codex App에 설치하기`, `Codex CLI에 설치하기` and `업데이트·재설치하기`. Preserve these exact commands in separate `bash` blocks:

```bash
codex plugin marketplace add .
codex plugin marketplace list
```

```bash
codex plugin add game-design-studio@game-design-suite
```

```bash
codex plugin add game-design-career@game-design-suite
```

```bash
codex plugin list
```

- [ ] **Step 4: Add three first-result paths**

Add Studio, Career and Suite examples. State `모르는 정보는 미정으로 남깁니다.` before the prompts. Split prompt lines at semantic boundaries so every line is 80 characters or shorter. Each example must name the expected first Artifact and the first three files to read.

- [ ] **Step 5: Render the 18 representative cards from catalog truth**

For each ID in `representativeCards`, add one `<details data-prompt-id="ID">`. Use the production catalog values for `when_to_use`, `required_inputs`, `app_prompt.template`, `cli_prompt.template`, `skill_chain`, `minimum_outputs`, `read_order`, `human_review_boundary` and `resume_prompt`. Rewrite only labels and Korean explanatory prose; do not change the underlying skill order or output order.

The four visible group headings must be:

```text
Studio 기획 사례 7개
Career 학습·취업 사례 7개
Studio와 Career 연계 사례 4개
전체 146개 요청문 찾기
```

Link the final heading to `guides/prompt-templates/README.md`.

- [ ] **Step 6: Add the direct-skill quick reference**

Create six rows: 전체 조율, 탐색·분석, 핵심 설계, 콘텐츠·경험, 검토·품질, 이미지·도식·출력. Each row names Studio and Career skills, direct-call conditions and representative output. Link to both product skill indexes.

- [ ] **Step 7: Add complete Studio and Career skill inventories**

After the six-row quick reference, add one collapsed `<details>` block per product. Inside each block list all 14 product skills plus the vendored Skillstead `svg-infographic`, for exactly 15 installed skills. Each row provides the skill ID, when to use it, representative output, the exact namespaced direct-call command and a detailed guide link. Explain the source-versus-vendored distinction without presenting `svg-infographic` as a product source directory.

- [ ] **Step 8: Add complete Studio and Career agent inventories**

Add one collapsed `<details>` block per product with the exact nine agent IDs from `products/<product>/plugin/agents/*.md`. Each row provides the agent's role, primary review focus, whether an orchestrator or specialist skill delegates to it, and a link to the exact role Markdown. State explicitly that agents are delegated reviewer/design roles, not user-facing skill commands.

- [ ] **Step 9: Add six concrete result examples**

Show the Canonical Artifact tree, then add the six result IDs from Task 1. Each row includes `생성 폴더`, `핵심 파일`, `선택 자산`, `읽는 순서`, `승인 전 보류 항목`. State that MD is always preserved but PDF, DOCX and PPTX require renderer and visual QA.

- [ ] **Step 10: Add Studio and Career file trees**

Use the two exact tree shapes from the design spec. Explain that `products/<product>/plugin/` is source and `plugins/<product>/` is generated. Add the path-role-editability table. Link agents to the technical product README and skills/templates to the user guides.

- [ ] **Step 11: Consolidate image, diagram and export policy**

Preserve `IMAGE_GEN_MODE` values `prompt-only`, `select`, `required`, `all`; the `OPENAI_API_KEY` exclusive API behavior; host fallback when no key exists; Skillstead editable SVG rule; and export statuses `not-requested`, `blocked`, `pending`, `unavailable`.

- [ ] **Step 12: Rebuild detailed-guide, safety and troubleshooting routing**

Use task-named link labels. Preserve Studio/Career installation, quick start, workflow, skill, template, use-case, FAQ, image, visualization and export links. Keep the technical inventory inside one `<details>` block after the technical section introduction.

- [ ] **Step 13: Run the focused README contract and iterate to GREEN**

Run:

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
```

Expected: PASS for TOC, H2 order, 18 cards, prompt width, 30 installed skill rows, 18 agent rows, six results and both file trees. The architecture embed assertion remains absent until Task 7.

- [ ] **Step 14: Run guide validation and commit**

```bash
npm run validate:guides
git diff --check
git add README.md
git commit -m "docs: restructure the plugin suite README"
```

Expected: guide validation exit 0 and no whitespace errors.

---

### Task 3: Author and auto-validate the suite system architecture

**Files:**
- Create: `guides/archify-diagrams/specs/suite/suite-plugin-system-architecture.json`
- Modify: `guides/archify-diagrams/catalog.json`
- Modify: `tests/contracts/archify-catalog.test.mjs`
- Modify: `tests/contracts/archify-specs.test.mjs`

**Interfaces:**
- Consumes: installed Archify architecture schema, common schema, one architecture example and the README/file-tree semantics from Task 2
- Produces: immutable auto-validated spec and catalog record for Task 6 delivery

- [ ] **Step 1: Read only the required Archify authoring inputs**

Resolve the installed Archify skill, then read its complete `SKILL.md`, `schemas/common.schema.json`, `schemas/architecture.schema.json` and one architecture example. Do not inspect renderer internals before the first candidate.

- [ ] **Step 2: Replace the root README exclusion with a selected architecture record in the contract**

Update the catalog test to require one root README entry with these exact semantics:

```js
{
  id: "suite-plugin-system-architecture",
  product: "suite",
  source_document: "README.md",
  source_section: "플러그인 구조와 전체 시스템 아키텍처",
  question: "Codex 진입점에서 두 플러그인의 전문 스킬, Canonical Artifact, 검증과 사람 승인을 거쳐 결과가 어떻게 전달되는가?",
  decision: "selected",
  diagram_type: "architecture",
  priority: "primary",
  visual_system: "suite",
  delivery_status: "auto-validated",
  visual_review: "pending",
}
```

Keep total catalog coverage at 612 records by replacing `suite-entry-navigation`, not appending a second README record. Require selected count 4 and products Studio 1, Career 1, Suite 2.

- [ ] **Step 3: Add semantic spec assertions before the spec exists**

Require no more than 12 primary components for App/CLI, marketplace, Studio, Career, Studio Canonical Artifact storage, Career evidence candidate storage, visual lane, export lane, automated validation, held lane, human approval and delivered result. Require two independent visible interface cards named `전문 스킬 인터페이스` and `근거·결정 인터페이스`; their items must bind the product namespaces and `content.md`, `evidence.yml`, `decisions/`, manifest contract without masquerading as relationship nodes. Require non-overlapping Studio/Career storage boundaries and a review boundary. Require relationships and all-path guards that prove:

```text
App·CLI → marketplace → Studio 또는 Career
Studio·Career → 전문 스킬 → Canonical Artifact
Canonical Artifact → 시각화 lane 및 내보내기 lane
두 lane → 자동 검증 → 사람 승인 → 전달 결과
Studio 검토 결과 → 공개 범위 승인 → Career 포트폴리오 작업공간
검증 실패 → 해당 lane 보류 → Canonical Artifact 보존
```

Add negative mutations that remove the human approval node, connect derived output directly to delivery, merge Studio/Career storage, or omit the failure hold path.

- [ ] **Step 4: Run the focused tests and confirm RED**

```bash
node --test tests/contracts/archify-catalog.test.mjs tests/contracts/archify-specs.test.mjs
```

Expected: FAIL because the catalog still contains `suite-entry-navigation` and the new spec does not exist.

- [ ] **Step 5: Write the first candidate immediately**

Create the candidate with no more than 12 primary components, exactly the two visible interface cards from Step 3, one clear left-to-right main relationship path and short side branches. Use Korean component names, descriptions and card text. Set `meta.quality_profile` to `showcase`. Define three guided views named `플러그인 경계`, `Artifact와 검증`, `사람 승인`.

- [ ] **Step 6: Validate and repair only diagnosed subjects**

Run the installed Archify CLI against the candidate:

```bash
node "$HOME/.agents/skills/archify/bin/archify.mjs" validate architecture \
  guides/archify-diagrams/specs/suite/suite-plugin-system-architecture.json \
  --quality showcase --json
```

Expected final receipt: checkCount 9, checksPassed 9, errors 0, warnings 0, compositionProfile `showcase`, compositionStatus `pass`. Apply at most one diagnosed geometry control per repair round.

- [ ] **Step 7: Update the catalog to auto-validated**

Replace `suite-entry-navigation` with `suite-plugin-system-architecture`. Compute the exact README SHA-256 after Task 2, set `source_digest`, point `spec`, `html` and `receipt` at their final paths, and leave `delivery_status: "auto-validated"`, `visual_review: "pending"`, `reviewer: null`.

- [ ] **Step 8: Run catalog and spec contracts to GREEN**

```bash
node --test tests/contracts/archify-catalog.test.mjs tests/contracts/archify-specs.test.mjs
npm run validate:archify-catalog
git diff --check
```

- [ ] **Step 9: Commit the auto-validated spec**

```bash
git add guides/archify-diagrams/specs/suite/suite-plugin-system-architecture.json \
  guides/archify-diagrams/catalog.json \
  tests/contracts/archify-catalog.test.mjs \
  tests/contracts/archify-specs.test.mjs
git commit -m "docs: author the suite system architecture"
```

---

### Task 4: Replace code-first labels with beginner-readable Korean guidance

**Files:**
- Modify: `README.md`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Modify: `guides/archify-diagrams/catalog.json`

**Interfaces:**
- Consumes: 18 source-bound prompt cards, 30 installed skills, 18 agents and six result IDs from Tasks 1–2
- Produces: a beginner-readable README whose stable IDs remain available as secondary technical references

- [ ] **Step 1: Add RED contracts for human-readable summaries**

Require every representative `<summary>` to start with a Korean task title, include its stable case ID in parentheses, and be followed by a visible Korean one-sentence description that states when to use it or what it produces. Reject ID-first summaries, slug-only result lists, missing Hangul, swapped IDs and generic repeated descriptions.

- [ ] **Step 2: Add RED contracts for Korean skill and agent names**

Require every skill row to begin with a unique Korean skill name followed by the exact English skill ID in parentheses. Require every agent row to begin with a Korean role name followed by the exact English agent ID in parentheses. Each row must retain its command/link/delegation contract and add a plain-Korean role explanation. Mutations that remove the Korean name, move the ID before the name or reuse one generic description across a product must fail with the affected ID.

- [ ] **Step 3: Add RED contracts for result labels and section introductions**

Require every result example to use `한글 결과명 (English artifact ID)` and each Studio, Career and Suite case group to start with a two-sentence Korean introduction explaining who should choose the group and what reviewable result it creates.

- [ ] **Step 4: Rewrite the 18 case summaries and introductions**

Use source-backed use-case titles or faithful Korean task names. Translate levels as `기본`, `표준`, `심화` in visible prose while retaining the catalog level in the card body when needed. Keep the stable ID and artifact slugs as secondary technical evidence, not the leading message.

- [ ] **Step 5: Rewrite all skill, agent and result labels**

Add concise, unique Korean names and beginner-facing explanations to all 30 installed skills, all 18 agents and six result examples. Preserve exact English IDs, commands, links, output order and human-review boundaries.

- [ ] **Step 6: Run focused contracts and refresh the Archify source digest**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
```

Compute the new README SHA-256 and update only the `suite-plugin-system-architecture` catalog `source_digest`; do not edit the frozen Archify spec. Run `npm run validate:archify-catalog` and `git diff --check`.

- [ ] **Step 7: Commit the readable labels**

```bash
git add README.md tests/contracts/root-readme-user-guides.test.mjs \
  guides/archify-diagrams/catalog.json
git commit -m "docs: make README examples beginner-readable"
```

---

### Task 4A: Replace the abstract cross-plugin quick start with a portfolio task

**Files:**
- Modify: `README.md`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Modify: `guides/archify-diagrams/catalog.json`

**Interfaces:**
- Consumes: the completed Studio `game-design-brief` or another human-reviewed Studio Canonical Artifact
- Produces: a beginner-readable `creative-design-portfolio` quick-start route whose purpose, steps, outputs and review boundary are explicit

- [ ] **Step 1: Add a focused RED contract**

Require the third quick-start heading to be `완성한 게임 기획을 취업용 포트폴리오 사례로 정리하기`. Require visible labels for `이럴 때 사용`, `준비물`, `실행 순서`, `얻게 되는 결과` and `공개 전 확인`. Reject the user-facing phrases `증거 후보`, `공개 증거 후보` and a prompt that calls both products abstractly without naming the review and portfolio skills.

- [ ] **Step 2: Require exact actionable outputs**

Require these four Korean output labels with their stable technical files or IDs as secondary references:

```text
포트폴리오 사례 본문 (creative-design-portfolio/content.md)
개인 기여와 선택 근거 (creative-design-portfolio/evidence.yml)
면접 답변 소재 (creative-design-portfolio/decisions/)
공개 전 확인 목록 (creative-design-portfolio/export-manifest.yml)
```

Require the human boundary to say that the author verifies actual contribution and publication rights and that the plugin does not auto-approve publication.

- [ ] **Step 3: Rewrite the quick-start copy and prompt**

Explain that this route is for a student or junior who already has one reviewed Studio design document and wants to turn it into a portfolio case. Use this ordered CLI flow and an equivalent natural-language App request:

```text
$game-design-studio:review-game-design
완성한 기획서에서 공개할 수 있는 문제, 내가 맡은 범위,
선택 이유와 검증 결과를 구분해 줘.

$game-design-career:build-game-design-portfolio
검토된 내용만 사용해 포트폴리오 사례 본문, 개인 기여 요약,
면접 답변 소재와 공개 전 확인 목록을 만들어 줘.
```

Keep every source line at 80 Unicode code points or fewer. Use `creative-design-portfolio` only as the technical result ID after the Korean result name.

- [ ] **Step 4: Refresh the root architecture source digest**

Compute the new README SHA-256 and update only the `suite-plugin-system-architecture` catalog record's `source_digest`. Do not edit the already auto-validated Archify spec in this task.

- [ ] **Step 5: Verify and commit**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
npm run validate:archify-catalog
git diff --check
git add README.md tests/contracts/root-readme-user-guides.test.mjs \
  guides/archify-diagrams/catalog.json
git commit -m "docs: make the portfolio quick start actionable"
```

---

### Task 5: Add Skillstead diagrams for the beginner README flows

**Files:**
- Create: `guides/assets/readme/prompt-to-result-flow.svg`
- Create: `guides/assets/readme/prompt-to-result-flow.png`
- Create: `guides/assets/readme/skill-agent-collaboration.svg`
- Create: `guides/assets/readme/skill-agent-collaboration.png`
- Create: `guides/assets/readme/artifact-review-flow.svg`
- Create: `guides/assets/readme/artifact-review-flow.png`
- Modify: `README.md`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Modify: `guides/archify-diagrams/catalog.json`

**Interfaces:**
- Consumes: the Korean case, skill/agent and result explanations from Task 4
- Produces: three editable, machine-linted, visually reviewed Skillstead diagram pairs embedded in their owning README sections

- [ ] **Step 1: Add the Skillstead asset RED contract**

Require these exact PNG→SVG linked embeds in the case, skill and result sections. Resolve every target as a contained regular non-symlink file. Require SVG root `1400×900`, Korean `<title>/<desc>`, no distortion attributes and successful Skillstead source lint. Require every PNG IHDR to be exactly `2800×1800`.

- [ ] **Step 2: Read the installed Skillstead authoring contract**

Read the complete installed `svg-infographic` `SKILL.md` and `references/authoring.md`, plus the Flow and Approval/sequence-lite sections of `references/archetypes.md`. Confirm Node 18+ and use `guides/assets/readme/` as the already-approved in-project output directory.

- [ ] **Step 3: Author `prompt-to-result-flow`**

Use the Flow archetype with at most five main nodes: 플러그인 선택 → 한글 사례 카드 → 전문 스킬 실행 → Canonical Artifact → 사람 검토. Add one dashed branch from 사람 검토 to 다음 요청/재개. State the conclusion that IDs are references and the Korean task/result is the primary reading surface.

- [ ] **Step 4: Author `skill-agent-collaboration`**

Use a two-lane Flow or Approval archetype: 사용자 직접 호출/오케스트레이터 → 전문 스킬 → 최대 세 전문 에이전트 검토 → findings merge → Artifact 보완·보류·재개. Make clear that agents are delegated roles, not direct user commands, and that they cannot auto-approve.

- [ ] **Step 5: Author `artifact-review-flow`**

Use the Flow archetype with the exact order `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`, followed by a named-human approval gate. Distinguish always-read files, optional assets and renderer-dependent derivatives.

- [ ] **Step 6: Lint and render through canonical Skillstead**

Run the installed `check-svg.mjs` and `render.mjs` for every SVG. The renderer must report its Chromium executable/version and exact `2800×1800` PNG dimensions. Hard errors or warnings are not accepted without correction.

- [ ] **Step 7: Inspect all six files at fit and original size**

Inspect each SVG/PNG pair and all three PNGs at fit-to-page and original size. Reject tofu, glyph compression, clipping, overflow, overlap, mid-token split, unreadable connector, head-only arrow, weak fit-page flow, or an unclear human gate. Fix SVG source and rerender; never patch PNG pixels.

- [ ] **Step 8: Embed the diagrams and refresh the README digest**

Place the three PNG→SVG links after the corresponding section introduction. Recompute the root architecture catalog `source_digest` without changing the frozen Archify spec.

- [ ] **Step 9: Verify and commit**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
npm run validate:archify-catalog
git diff --check
git add README.md guides/assets/readme tests/contracts/root-readme-user-guides.test.mjs \
  guides/archify-diagrams/catalog.json
git commit -m "docs: add Skillstead README explainers"
```

---

### Task 6: Deliver, visually inspect, and publish the architecture

**Files:**
- Create: `guides/assets/archify/suite/suite-plugin-system-architecture.html`
- Create: `guides/assets/archify/suite/suite-plugin-system-architecture.receipt.json`
- Create: six PNG files under `guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/`
- Modify: `guides/archify-diagrams/catalog.json`
- Modify: `guides/archify-diagrams/visual-qa/manifest.json`
- Modify: six contact-sheet HTML/PNG files listed in File Structure
- Modify: `tests/contracts/archify-visual-qa.test.mjs`

**Interfaces:**
- Consumes: frozen auto-validated spec from Task 3
- Produces: published HTML, receipt and pinned visual evidence for Task 7

- [ ] **Step 1: Add the visual-QA RED contract**

Require the new ID in production QA with exact views `read`, `light`, `dark`, `view-plugin-boundaries`, `view-artifact-validation`, `view-human-approval`. Require `review_method: "headless-original-and-fit"`, `visual_review: "passed"`, non-empty reviewer, PNG dimensions, SHA-256 and exact artifact binding. Require new architecture and suite contact sheets.

- [ ] **Step 2: Run the visual contract and confirm RED**

```bash
node --test tests/contracts/archify-visual-qa.test.mjs
```

Expected: FAIL because published HTML and the six render records do not exist.

- [ ] **Step 3: Deliver through the repository publication pipeline**

Run:

```bash
npm run build:curated-archify -- --id suite-plugin-system-architecture
npm run publish:curated-archify
```

Do not add script aliases and do not hand-edit delivered HTML or receipt.

- [ ] **Step 4: Capture the six required views headlessly**

Use the existing Archify visual-QA capture path. Wait for fonts, images and the viewer readiness signal before capture. Capture at the existing production viewport and device scale used by the other three published entries.

- [ ] **Step 5: Inspect every render at fit and original size**

Check these defects independently for all six PNGs: tofu, blurred or compressed glyphs, clipping, overflow, node overlap, edge crossing unrelated nodes, label collision, cropped focus target, unreadable rail/footer and incorrect Korean UI. If a defect exists, set `blocked-visual`, edit the spec, rerun validate/deliver and recapture all six views.

- [ ] **Step 6: Record passing evidence and publish state**

After every view passes, set catalog `delivery_status: "published"`, `visual_review: "passed"`, reviewer `Codex 헤드리스 시각 QA`. Record the exact spec, HTML and PNG digests in receipt and QA manifest.

- [ ] **Step 7: Regenerate contact sheets**

```bash
node tooling/build-archify-contact-sheets.mjs
node tooling/build-archify-contact-sheets.mjs --check
```

Expected: `all`, `product-suite` and `type-architecture` HTML/PNG outputs exist and byte-check passes.

- [ ] **Step 8: Run publication checks**

```bash
npm run check:curated-archify
node --test tests/contracts/archify-visual-qa.test.mjs
npm run validate:archify-catalog
git diff --check
```

Expected: all commands exit 0, selected/published count 4, no stale or extra managed file.

- [ ] **Step 9: Commit published assets and evidence**

```bash
git add guides/assets/archify/suite \
  guides/archify-diagrams/catalog.json \
  guides/archify-diagrams/visual-qa \
  tests/contracts/archify-visual-qa.test.mjs
git commit -m "feat: publish the Korean suite architecture"
```

---

### Task 7: Embed the architecture and expose the four verified diagrams

**Files:**
- Modify: `README.md`
- Modify: `guides/archify-diagrams/README.md`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Test: `tests/contracts/archify-catalog.test.mjs`
- Test: `tests/contracts/archify-specs.test.mjs`
- Test: `tests/contracts/archify-visual-qa.test.mjs`

**Interfaces:**
- Consumes: published HTML and `read.png` from Task 6
- Produces: GitHub-visible architecture preview and complete diagram navigation

- [ ] **Step 1: Add the architecture embed contract**

Require this exact Markdown relationship in `플러그인 구조와 전체 시스템 아키텍처`:

```md
[![게임 기획 플러그인 모음 전체 시스템 구조](guides/archify-diagrams/visual-qa/renders/suite/suite-plugin-system-architecture/read.png)](guides/assets/archify/suite/suite-plugin-system-architecture.html)
```

Use the visible link validator to require regular non-symlink PNG and HTML targets. Add mutations for a missing image, unwrapped PNG, wrong HTML ID and stale receipt link.

- [ ] **Step 2: Add the preview and four diagram routes to README**

Place the preview after the two plugin file trees and before the component-boundary explanation. Add named links to:

```text
guides/assets/archify/suite/suite-plugin-system-architecture.html
guides/assets/archify/studio/studio-project-workflow.html
guides/assets/archify/career/career-evidence-workflow.html
guides/assets/archify/suite/suite-studio-career-handoff.html
guides/archify-diagrams/README.md
```

- [ ] **Step 3: Update the Archify status index**

State selected/published 4, Studio 1, Career 1, Suite 2, types architecture 1, workflow 2, dataflow 1. Add the new question, source section, HTML, receipt and QA views. Do not claim browser interaction; name headless fit+original review.

- [ ] **Step 4: Refresh the README source digest in catalog**

Compute SHA-256 after the final README edit and update the root architecture record. Run catalog validation immediately; do not touch the Archify spec after the passing receipt.

- [ ] **Step 5: Run focused contracts to GREEN**

```bash
node --test \
  tests/contracts/root-readme-user-guides.test.mjs \
  tests/contracts/archify-catalog.test.mjs \
  tests/contracts/archify-specs.test.mjs \
  tests/contracts/archify-visual-qa.test.mjs
npm run validate:guides
npm run check:curated-archify
node tooling/build-archify-contact-sheets.mjs --check
```

- [ ] **Step 6: Commit the integrated navigation**

```bash
git add README.md guides/archify-diagrams/README.md \
  guides/archify-diagrams/catalog.json \
  tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: expose the verified plugin architecture"
```

---

### Task 8: Run writing, regression, and final review gates

**Files:**
- Modify only files that fail a documented contract from Tasks 1–7
- Verify: all files changed since `7b605cc`

**Interfaces:**
- Consumes: completed README, catalog, spec, published artifact and QA evidence
- Produces: completion evidence with no Critical or Important finding

- [ ] **Step 1: Run the writing-guidelines audit**

Check `README.md` for paragraph length, three-item prose lists, vague headings, unlabeled code fences, code lines over 80 characters, bare paths that should be links and repeated policy text. Apply only clarity fixes that preserve tested semantics.

- [ ] **Step 2: Run repository guide and diagram checks**

```bash
npm run validate:guides
npm run check:guide-diagrams
npm run validate:archify-catalog
npm run check:curated-archify
node tooling/build-archify-contact-sheets.mjs --check
npm run build -- --check
```

Expected: every command exits 0; managed use-case diagrams report 72 SVG and 72 PNG, and the three README Skillstead SVG·PNG pairs pass their dedicated contract.

- [ ] **Step 3: Run targeted tests**

```bash
node --test \
  tests/contracts/root-readme-user-guides.test.mjs \
  tests/contracts/archify-catalog.test.mjs \
  tests/contracts/archify-specs.test.mjs \
  tests/contracts/archify-visual-qa.test.mjs \
  tests/unit/archify-delivery.test.mjs \
  tests/unit/archify-visual-qa.test.mjs
```

Expected: 0 failures and 0 unexpected skips.

- [ ] **Step 4: Run full validation and test suites**

```bash
npm run validate
npm test
```

Expected: both commands exit 0. Record exact test counts and duration from the fresh output.

- [ ] **Step 5: Run final static and repository-state checks**

```bash
git diff --check 7b605cc..HEAD
git status --short
find guides/assets/archify guides/archify-diagrams/visual-qa \
  -type l -print
find guides/assets/archify guides/archify-diagrams/visual-qa \
  -name '.DS_Store' -o -name '.archify-*'
```

Expected: no diff errors, no symlinks, no `.DS_Store`, no private transaction residue and no unexpected worktree changes.

- [ ] **Step 6: Request independent code and visual review**

Code review scope: README contract quality, Korean-name/source binding, Skillstead asset contracts, catalog/source binding, Archify delivery/receipt security, generated-tree policy and test mutation adequacy. Visual review scope: all three README Skillstead diagrams plus the README architecture preview and all six new architecture views at fit and original size. Fix every Critical or Important finding, rerun the affected test from RED to GREEN and repeat review until both verdicts are APPROVE.

- [ ] **Step 7: Commit any verified review fixes**

```bash
git add README.md \
  guides/archify-diagrams \
  guides/assets/archify/suite \
  tests/contracts/root-readme-user-guides.test.mjs \
  tests/contracts/archify-catalog.test.mjs \
  tests/contracts/archify-specs.test.mjs \
  tests/contracts/archify-visual-qa.test.mjs \
  tests/unit/archify-delivery.test.mjs \
  tests/unit/archify-visual-qa.test.mjs
git diff --cached --check
git commit -m "fix: close README architecture review findings"
```

Skip this commit only when no tracked fix remains after review.

- [ ] **Step 8: Report completion evidence**

Report the README path, new interactive HTML, static PNG, 18-card counts, plugin tree counts, Archify 9/9 receipt, visual QA verdict, guide/build/full-test counts, final review verdicts and commit range. Link directly to README, the new HTML, PNG and Archify status index.

---

## Self-Review

- Spec coverage: TOC, 18 cards, direct-skill table, six results, two file trees, source/generated boundary, Korean Archify architecture, visual QA, safety and full verification each have an owning task.
- Placeholder scan: no `TBD`, `TODO`, `implement later`, `fill in details` or unspecified test step remains. Bracketed values in prompt templates are deliberate user-input fields, not incomplete plan content.
- Type consistency: `suite-plugin-system-architecture`, the six view IDs, 18 prompt IDs, six result IDs and final paths are identical across Tasks 1–6.
- Task isolation: Task 2 reaches GREEN without the new architecture embed; Task 3 freezes the spec; Task 4 publishes verified assets; Task 5 adds the final README visual contract.
- Scope: no product runtime, skill behavior, image API policy or generated package content is changed beyond validation evidence.
