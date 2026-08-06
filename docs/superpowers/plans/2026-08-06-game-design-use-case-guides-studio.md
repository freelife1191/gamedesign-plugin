# Game Design Studio Use-Case Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Studio 역량 사례 8개, 콘셉트 사례 10개, 직접 스킬 사례 15개, FAQ 18개와 Skillstead 도식 33쌍을 완성한다.

**Architecture:** foundation plan의 manifest와 diagram builder를 사용한다. competency-paths.md와 concept-scenarios.md가 18개 복합 사례의 교육적 본문을 소유하고, skill-workbench.md는 15개 상세 스킬 가이드로 routing한다. 기존 recipe와 skill guide의 고정 H2 계약은 유지하고 H3와 결과 예시만 확장한다.

**Tech Stack:** Node.js 18+ ESM, node:test, Markdown, JSON, SVG, vendored Skillstead 0.8.3, Chromium

## Global Constraints

- Foundation plan이 완료되고 commit된 상태에서 시작한다.
- 새 dependency와 plugin runtime 변경을 추가하지 않는다.
- Studio case는 Career-only skill 또는 template을 소유하지 않는다.
- 시장, 매출, retention, 일정과 재미를 근거 없이 단정하지 않는다.
- 모든 사례는 App 요청, CLI 요청, 결과 파일, 사람 결정, 실패·재개와 자기점검을 포함한다.
- 기존 Studio skill guide의 14개 H2 순서와 recipe의 8개 H2 순서를 변경하지 않는다.
- 새 Studio SVG는 1400×900, PNG는 2800×1800이며 Skillstead lint 0 error/0 warning을 통과한다.
- 생성 이미지와 파생 문서는 자동 승인하지 않는다.

---

### Task 1: Studio manifest coverage contract

**Files:**
- Modify: guides/use-cases/use-case-manifest.json
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: manifest version 1 and validator from foundation.
- Produces: 18 case entries ST-C01..ST-C08 and ST-G01..ST-G10.
- Produces: 15 skill_case entries with product game-design-studio.

- [ ] **Step 1: Add failing count and ID tests**

~~~javascript
const studioCases = manifest.cases.filter((entry) => entry.product === "game-design-studio");
assert.deepEqual(studioCases.filter((entry) => entry.view === "competency").map((entry) => entry.id), [
  "ST-C01", "ST-C02", "ST-C03", "ST-C04", "ST-C05", "ST-C06", "ST-C07", "ST-C08",
]);
assert.deepEqual(studioCases.filter((entry) => entry.view === "concept").map((entry) => entry.id), [
  "ST-G01", "ST-G02", "ST-G03", "ST-G04", "ST-G05",
  "ST-G06", "ST-G07", "ST-G08", "ST-G09", "ST-G10",
]);
assert.equal(manifest.skill_cases.filter((entry) => entry.product === "game-design-studio").length, 15);
~~~

- [ ] **Step 2: Run the test and verify zero-entry failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL because no Studio entries exist.

- [ ] **Step 3: Add the 18 Studio case entries**

Each entry includes product, view, audiences, level, document, anchor, skills, templates, outputs and diagram. Bind IDs and subject matter exactly to spec sections 7.1 and 7.2. Use:

- competency document: guides/game-design-studio/use-cases/competency-paths.md
- concept document: guides/game-design-studio/use-cases/concept-scenarios.md
- diagram path: guides/assets/game-design-studio/use-cases/st-c01.svg|png through st-c08.svg|png and st-g01.svg|png through st-g10.svg|png

- [ ] **Step 4: Add the 15 Studio skill_case entries**

Read the closed inventory from collectProductInventory rather than manually inventing skill IDs. Every entry uses:

- document: guides/game-design-studio/skills plus the exact installed skill ID plus .md
- anchor: the GitHub anchor of the H3 직접 호출 활용
- diagram path: guides/assets/game-design-studio/skills plus the exact installed skill ID plus .svg and .png
- outputs and next_skills derived from the existing guide and canonical routing.json

- [ ] **Step 5: Run the manifest test**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: PASS for Studio IDs and partial manifest validation.

- [ ] **Step 6: Commit the Studio manifest slice**

~~~bash
git add guides/use-cases/use-case-manifest.json tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "test(docs): declare Studio use-case coverage"
~~~

### Task 2: Studio competency guide

**Files:**
- Create: guides/game-design-studio/use-cases/README.md
- Create: guides/game-design-studio/use-cases/competency-paths.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: ST-C01..ST-C08 manifest entries.
- Produces: eight case sections following the 18-section case-card contract.

- [ ] **Step 1: Add failing anchor and section tests**

For every competency entry, extract its H2 section and require these H3 markers:

~~~javascript
const requiredCaseMarkers = [
  "현재 상황과 목표",
  "적합한 경우와 적합하지 않은 경우",
  "준비 입력",
  "10분 미니 실습",
  "표준 실습",
  "포트폴리오·실무 확장",
  "Codex App 요청문",
  "Codex CLI 요청문",
  "스킬·템플릿 흐름",
  "결과물",
  "검토와 승인",
  "실패·재개",
  "자기점검과 다음 학습",
];
~~~

- [ ] **Step 2: Run the test and verify missing-file failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL for missing Studio use-case files.

- [ ] **Step 3: Write the Studio use-case index**

Include:

- competency versus concept versus skill decision table
- beginner, applied, portfolio and full-project paths
- all 18 case links
- skill-workbench and FAQ links
- output-catalog link
- no duplicate full case text

- [ ] **Step 4: Write ST-C01 through ST-C04**

Use the approved topics: vision/player experience, player verbs/core loop, rule/state/exception/data, and UX/onboarding/accessibility. Each case includes a neutral example, actual template IDs, App and CLI copy blocks, file tree, representative content excerpt, human decision and resume prompt.

- [ ] **Step 5: Write ST-C05 through ST-C08**

Use content/narrative/quest/NPC; character/skill/combat/monster; economy/balance/LiveOps; and production/review/image/export. Bind IMAGE_GEN_MODE to prompt-only/select/required/all without changing provider routing.

- [ ] **Step 6: Run the competency tests**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: all eight anchors and case-card contracts PASS.

- [ ] **Step 7: Commit the competency guide**

~~~bash
git add guides/game-design-studio/use-cases tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Studio competency learning paths"
~~~

### Task 3: Studio concept guide

**Files:**
- Create: guides/game-design-studio/use-cases/concept-scenarios.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: ST-G01..ST-G10 manifest entries.
- Produces: ten genre/platform/operation cases using the common case-card contract.

- [ ] **Step 1: Add failing tests for ten concept anchors and comparison fields**

Require every concept section to include player context, design constraints, transferable competency, unsupported assumptions and validation plan.

- [ ] **Step 2: Run the test and verify missing-file failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL for missing concept-scenarios.md.

- [ ] **Step 3: Write ST-G01 through ST-G05**

Cover mobile collection RPG/live service, casual puzzle/idle, cooperative survival action, competitive PvP arena and PC/console action roguelite. Do not invent KPI targets; label numeric examples as assumptions requiring prototype or telemetry validation.

- [ ] **Step 4: Write ST-G06 through ST-G10**

Cover branching narrative adventure, cozy life simulation, management/tycoon, sandbox/UGC and educational/social/accessibility-centered games. Record ethical, moderation, rights or accessibility review where applicable.

- [ ] **Step 5: Add cross-concept comparison tables**

Compare the same general problems across concepts: core loop, failure/recovery, information load, social risk, content cadence and evidence needed. The table must link back to ST-C IDs.

- [ ] **Step 6: Run the concept tests**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: all ten sections and transfer fields PASS.

- [ ] **Step 7: Commit the concept guide**

~~~bash
git add guides/game-design-studio/use-cases/concept-scenarios.md tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Studio concept scenarios"
~~~

### Task 4: Studio skill workbench and 15 detailed skill guides

**Files:**
- Create: guides/game-design-studio/use-cases/skill-workbench.md
- Modify: guides/game-design-studio/skills/apply-document-quality-profile.md
- Modify: guides/game-design-studio/skills/define-game-vision.md
- Modify: guides/game-design-studio/skills/design-game-content.md
- Modify: guides/game-design-studio/skills/design-game-economy-and-liveops.md
- Modify: guides/game-design-studio/skills/design-game-systems.md
- Modify: guides/game-design-studio/skills/design-player-experience.md
- Modify: guides/game-design-studio/skills/export-game-design-documents.md
- Modify: guides/game-design-studio/skills/generate-image-assets.md
- Modify: guides/game-design-studio/skills/orchestrate-game-design-project.md
- Modify: guides/game-design-studio/skills/plan-game-production.md
- Modify: guides/game-design-studio/skills/plan-image-assets.md
- Modify: guides/game-design-studio/skills/review-game-design.md
- Modify: guides/game-design-studio/skills/review-image-assets.md
- Modify: guides/game-design-studio/skills/svg-infographic.md
- Modify: guides/game-design-studio/skills/visualize-game-design.md
- Modify: tests/contracts/user-guides-studio.test.mjs
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: 15 Studio skill_case entries and canonical routing.json.
- Produces: H3 anchor 직접 호출 활용 inside each existing guide without changing its 14 H2 headings.

- [ ] **Step 1: Add a failing direct-use contract**

Inside each skill guide require:

- H3 직접 호출 활용
- direct-use condition
- beginner, applied and advanced copyable request
- expected files/read order
- next skill condition

Keep assertSkillContract and requiredHeadings unchanged.

- [ ] **Step 2: Run Studio guide tests and verify missing H3 failures**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

Expected: FAIL because direct-use sections are absent.

- [ ] **Step 3: Write the skill workbench router**

List all 15 skills exactly once with direct-use signal, avoid-when signal, input, result, next skill and detailed guide link. Include separate rows for orchestrator, domain design, quality/review, image, visualization and export lanes.

- [ ] **Step 4: Extend orchestration, quality, review and export guides**

Modify:

- apply-document-quality-profile
- orchestrate-game-design-project
- review-game-design
- plan-game-production
- export-game-design-documents

Place H3 content inside the most relevant existing H2 section. Preserve source-derived route conditions and exact CLI targets already tested.

- [ ] **Step 5: Extend five domain-design guides**

Modify:

- define-game-vision
- design-game-systems
- design-game-content
- design-player-experience
- design-game-economy-and-liveops

Use examples that point to ST-C cases and preserve existing template/profile/role bindings.

- [ ] **Step 6: Extend five image and visualization guides**

Modify:

- plan-image-assets
- generate-image-assets
- review-image-assets
- visualize-game-design
- svg-infographic

Preserve prompt-only/select/required/all, named human approval, Skillstead wrapper and renderer fallback boundaries.

- [ ] **Step 7: Run the Studio guide contracts**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

Expected: PASS for all 15 skill contracts and direct-use anchors.

- [ ] **Step 8: Commit the Studio skill workbench**

~~~bash
git add guides/game-design-studio/use-cases/skill-workbench.md guides/game-design-studio/skills tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Studio direct-skill workbench"
~~~

### Task 5: Studio recipes and FAQ

**Files:**
- Modify: guides/game-design-studio/recipes/new-game-gdd.md
- Modify: guides/game-design-studio/recipes/system-feature-spec.md
- Modify: guides/game-design-studio/recipes/content-quest-design.md
- Modify: guides/game-design-studio/recipes/ux-accessibility.md
- Modify: guides/game-design-studio/recipes/economy-liveops.md
- Modify: guides/game-design-studio/recipes/production-review-export.md
- Create: guides/game-design-studio/faq.md
- Modify: tests/contracts/user-guide-studio-diagrams.test.mjs
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: representative output example within the existing 예상 결과 H2 for all six recipes.
- Produces: at least 18 FAQ H3 questions.

- [ ] **Step 1: Add failing recipe output-example tests**

Require each recipe 예상 결과 section to contain:

- 예상 파일 트리
- 대표 내용 예시
- 완료 기준
- 포트폴리오 또는 팀 전달 포인트

Do not alter recipeHeadings or the exactly-one-primary-diagram rule.

- [ ] **Step 2: Add failing FAQ tests**

Require at least 18 H3 headings beginning Q and verify every answer contains 실행 요청, 예상 결과 and 관련 사례.

- [ ] **Step 3: Run the tests and verify failures**

Run:

~~~bash
node --test tests/contracts/user-guide-studio-diagrams.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

- [ ] **Step 4: Expand the six recipe result sections**

Use their existing canonical templates and skills. Add concise but concrete file trees and excerpts; do not create six duplicate sample project directories.

- [ ] **Step 5: Write Studio FAQ**

Cover all 18 approved questions from spec section 11.3. Every answer follows conclusion → reason/boundary → executable request → expected result → related case/skill/template → safety note.

- [ ] **Step 6: Run recipe and FAQ tests**

Expected: all Studio recipe and FAQ contracts PASS.

- [ ] **Step 7: Commit recipes and FAQ**

~~~bash
git add guides/game-design-studio/recipes guides/game-design-studio/faq.md tests/contracts
git commit -m "docs: expand Studio outcomes and FAQ"
~~~

### Task 6: Studio 33 Skillstead diagram pairs

**Files:**
- Modify: guides/assets/use-case-diagram-sources.json
- Create: guides/assets/game-design-studio/use-cases/*.svg
- Create: guides/assets/game-design-studio/use-cases/*.png
- Create: guides/assets/game-design-studio/skills/*.svg
- Create: guides/assets/game-design-studio/skills/*.png
- Modify: guides/assets/diagram-manifest.json
- Modify: guides/assets/VISUAL-QA.md
- Modify: guides/game-design-studio/use-cases/competency-paths.md
- Modify: guides/game-design-studio/use-cases/concept-scenarios.md
- Modify: guides/game-design-studio/skills/*.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: 18 case entries and 15 skill_case entries.
- Produces: scopes game-design-studio-use-case and game-design-studio-skill.

- [ ] **Step 1: Add failing Studio diagram coverage tests**

Assert scope counts 18 and 15, path conventions, manifest/document alt equality, source/usedBy files, title/desc, 1400×900 viewBox, complete 2800×1800 PNG and Skillstead lint.

- [ ] **Step 2: Run the test and verify 33 missing-entry failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

- [ ] **Step 3: Add 18 case diagram sources**

Use design-pipeline for ST-C cases and decision-flow for ST-G cases. Derive node labels from the case skill chain, decisions, results and validation rather than generic repeated labels.

- [ ] **Step 4: Add 15 skill-flow sources**

Each source shows trigger, required input, skill-owned work, output and next route. Use exact skill IDs and output names from the guides.

- [ ] **Step 5: Generate and register all Studio pairs**

Run:

~~~bash
npm run build:guide-diagrams
~~~

Append 33 manifest entries with exact sources and usedBy paths. Do not change the existing game-design-studio recipe scope entries.

- [ ] **Step 6: Insert all 33 Studio diagram embeds**

Add one manifest-alt PNG wrapped in the paired editable SVG link to every ST-C/ST-G case section and every direct-use skill section. Require exactly one new use-case or skill-flow embed per manifest entry; existing recipe and general visualization images do not count toward this assertion.

- [ ] **Step 7: Perform automated and representative visual QA**

Run check:guide-diagrams and inspect ST-C03, ST-G01, ST-G06 and the longest skill-flow at high and original detail. Record the result in VISUAL-QA.md.

- [ ] **Step 8: Run Studio diagram tests**

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs
npm run check:guide-diagrams
~~~

Expected: 33 new Studio pairs PASS without changing the six existing recipe pairs.

- [ ] **Step 9: Commit Studio diagrams**

~~~bash
git add guides/assets guides/game-design-studio tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Studio use-case Skillstead diagrams"
~~~

### Task 7: Studio indexes and product README

**Files:**
- Modify: guides/game-design-studio/README.md
- Modify: guides/game-design-studio/skills/README.md
- Modify: products/game-design-studio/plugin/README.md
- Modify: tests/contracts/user-guides-studio.test.mjs
- Modify: tests/products/studio/readme.test.mjs

**Interfaces:**
- Produces: stable links to competency, concept, skill and FAQ guides.
- Product README source is later copied to plugins/game-design-studio/README.md by npm run build.

- [ ] **Step 1: Add failing README routing tests**

Require:

- target users
- direct skill versus orchestrator decision
- six representative cases with expected outputs
- links to all four Studio use-case documents, FAQ and output catalog
- source README local links remain package-safe

- [ ] **Step 2: Run the targeted README tests**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/products/studio/readme.test.mjs
~~~

Expected: FAIL for missing new routing content.

- [ ] **Step 3: Expand the Studio guide index**

Add concise entry tables without duplicating case bodies. Keep installation and original workflow reading path.

- [ ] **Step 4: Expand the source product README**

Add target users, three exploration paths, representative requests/results, direct skill rules and result reading order. Do not link from the packaged README to repository-only guides with paths that are absent from the package; label the repository guide URL or keep package-local skill/template links distinct.

- [ ] **Step 5: Run README tests**

Expected: guide and source README contracts PASS.

- [ ] **Step 6: Commit Studio README changes**

~~~bash
git add guides/game-design-studio/README.md guides/game-design-studio/skills/README.md products/game-design-studio/plugin/README.md tests
git commit -m "docs: expand Studio usage entry points"
~~~

## Studio Plan Completion Gate

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs tests/products/studio/readme.test.mjs
npm run check:guide-diagrams
git diff --check
~~~

Expected: 18 Studio cases, 15 Studio skill cases, 18 FAQ answers and 33 new Studio diagram pairs PASS. Do not run complete aggregate count assertions until the Career plan is complete.
