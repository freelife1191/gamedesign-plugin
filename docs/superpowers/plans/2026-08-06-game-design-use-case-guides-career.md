# Game Design Career Use-Case Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Career 역량 사례 8개, 대상 사례 10개, 직접 스킬 사례 15개, FAQ 18개와 Skillstead 도식 33쌍을 완성한다.

**Architecture:** foundation manifest와 diagram builder 위에 Career 전용 문서와 assets를 추가한다. competency-paths.md는 직무 탐색부터 면접·성장까지의 전이 가능한 역량을 소유하고, concept-scenarios.md는 목표 직무와 경력 단계별 적용을 소유한다. 현재 채용 주장은 sourceUrl, retrievalDate, region, sample boundary, reviewAfter와 stale 재검색 경계를 유지한다.

**Tech Stack:** Node.js 18+ ESM, node:test, Markdown, JSON, SVG, vendored Skillstead 0.8.3, Chromium

## Global Constraints

- Foundation plan이 완료되고 commit된 상태에서 시작한다.
- Studio plan과 파일 소유권이 겹치는 guides/use-cases/use-case-manifest.json, diagram-manifest.json과 diagram source는 순차 통합한다.
- 새 dependency와 plugin runtime 변경을 추가하지 않는다.
- Career case는 Studio Artifact를 합치지 않고 공개 가능한 evidence summary만 handoff로 받는다.
- 경험, 팀 기여, 채용 결과와 시장 전체 주장을 발명하지 않는다.
- current evidence에는 sourceUrl, location, retrievalDate, region, sample boundary, reviewAfter와 stale 경계를 기록한다.
- 기존 Career skill guide의 14개 H2 순서와 recipe의 8개 H2 순서를 변경하지 않는다.
- 새 Career SVG는 1400×900, PNG는 2800×1800이며 Skillstead lint 0 error/0 warning을 통과한다.

---

### Task 1: Career manifest coverage contract

**Files:**
- Modify: guides/use-cases/use-case-manifest.json
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: CA-C01..CA-C08, CA-T01..CA-T10 and 15 game-design-career skill_case entries.

- [ ] **Step 1: Add failing count and ID tests**

Assert these exact ordered IDs and fifteen installed Career skills from collectProductInventory:

~~~javascript
const careerCases = manifest.cases.filter((entry) => entry.product === "game-design-career");
assert.deepEqual(careerCases.filter((entry) => entry.view === "competency").map((entry) => entry.id), [
  "CA-C01", "CA-C02", "CA-C03", "CA-C04",
  "CA-C05", "CA-C06", "CA-C07", "CA-C08",
]);
assert.deepEqual(careerCases.filter((entry) => entry.view === "target").map((entry) => entry.id), [
  "CA-T01", "CA-T02", "CA-T03", "CA-T04", "CA-T05",
  "CA-T06", "CA-T07", "CA-T08", "CA-T09", "CA-T10",
]);
assert.equal(manifest.skill_cases.filter((entry) => entry.product === "game-design-career").length, 15);
~~~

- [ ] **Step 2: Run and observe zero-entry failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

- [ ] **Step 3: Add the 18 Career case entries**

Use:

- competency document: guides/game-design-career/use-cases/competency-paths.md
- target document: guides/game-design-career/use-cases/concept-scenarios.md
- view values competency and target
- diagram path: guides/assets/game-design-career/use-cases/ca-c01.svg|png through ca-c08.svg|png and ca-t01.svg|png through ca-t10.svg|png

Bind topics exactly to spec sections 7.3 and 7.4.

- [ ] **Step 4: Add the 15 Career skill_case entries**

Derive skill IDs from collectProductInventory. Use current source routing, career stage and template-profile maps for output and next skill fields.

- [ ] **Step 5: Run the manifest test**

Expected: Career IDs and partial validation PASS.

- [ ] **Step 6: Commit Career manifest entries**

~~~bash
git add guides/use-cases/use-case-manifest.json tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "test(docs): declare Career use-case coverage"
~~~

### Task 2: Career competency guide

**Files:**
- Create: guides/game-design-career/use-cases/README.md
- Create: guides/game-design-career/use-cases/competency-paths.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: eight complete Career case-card sections.

- [ ] **Step 1: Add failing anchor and case-card tests**

Reuse the common case markers and additionally require current evidence fields for CA-C03 and evidence IDs for CA-C05 through CA-C08.

- [ ] **Step 2: Run and verify missing Career guide failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

- [ ] **Step 3: Write the Career use-case index**

Route by competency, target role, direct skill and work scale. Link all 18 Career cases, FAQ and shared output catalog.

- [ ] **Step 4: Write CA-C01 through CA-C04**

Cover role exploration, analysis language, official job research and gap/evidence roadmaps. Preserve multiple paths and do not rank candidate worth or hiring probability.

- [ ] **Step 5: Write CA-C05 through CA-C08**

Cover reverse design, creative portfolio, five-axis review/presentation, interview/junior growth/transition. Include individual contribution and public-rights review.

- [ ] **Step 6: Run Career competency tests**

Expected: all eight sections and evidence boundaries PASS.

- [ ] **Step 7: Commit competency guides**

~~~bash
git add guides/game-design-career/use-cases tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Career competency learning paths"
~~~

### Task 3: Career target-role guide

**Files:**
- Create: guides/game-design-career/use-cases/concept-scenarios.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: ten target-role/stage cases CA-T01..CA-T10.

- [ ] **Step 1: Add failing target-case tests**

Require target role, observable evidence, smallest proof project, review owner, portfolio result and non-guarantee boundary in every section.

- [ ] **Step 2: Run and verify missing-file failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

- [ ] **Step 3: Write CA-T01 through CA-T05**

Cover system, content/quest, combat/character, economy/balance/LiveOps and UI/UX preparation. Link each target to one or more neutral Studio proof projects without merging artifacts.

- [ ] **Step 4: Write CA-T06 through CA-T10**

Cover narrative, level design, no-experience new hire, non-major/role transition and junior growth/job transition.

- [ ] **Step 5: Add role comparison tables**

Compare the problem types, evidence artifacts, common review questions and boundaries. Do not imply that a single company uses the same role split.

- [ ] **Step 6: Run target-case tests**

Expected: all ten sections PASS.

- [ ] **Step 7: Commit the target guide**

~~~bash
git add guides/game-design-career/use-cases/concept-scenarios.md tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Career target-role scenarios"
~~~

### Task 4: Career skill workbench and 15 detailed skill guides

**Files:**
- Create: guides/game-design-career/use-cases/skill-workbench.md
- Modify: guides/game-design-career/skills/apply-document-quality-profile.md
- Modify: guides/game-design-career/skills/build-game-design-portfolio.md
- Modify: guides/game-design-career/skills/export-career-documents.md
- Modify: guides/game-design-career/skills/generate-image-assets.md
- Modify: guides/game-design-career/skills/map-game-design-career.md
- Modify: guides/game-design-career/skills/orchestrate-game-design-career.md
- Modify: guides/game-design-career/skills/plan-image-assets.md
- Modify: guides/game-design-career/skills/plan-junior-growth.md
- Modify: guides/game-design-career/skills/practice-game-design-interview.md
- Modify: guides/game-design-career/skills/research-game-design-jobs.md
- Modify: guides/game-design-career/skills/reverse-engineer-game-design.md
- Modify: guides/game-design-career/skills/review-game-design-portfolio.md
- Modify: guides/game-design-career/skills/review-image-assets.md
- Modify: guides/game-design-career/skills/svg-infographic.md
- Modify: guides/game-design-career/skills/visualize-career-roadmap.md
- Modify: tests/contracts/user-guides-career.test.mjs
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: H3 직접 호출 활용 in all 15 guides while keeping the fixed H2 contract.

- [ ] **Step 1: Add failing Career direct-use tests**

Require direct-use condition, beginner/applied/advanced request, expected files/read order and next route. Diagram embeds are added only after their files exist in Task 6.

- [ ] **Step 2: Run and verify failures**

Run:

~~~bash
node --test tests/contracts/user-guides-career.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

- [ ] **Step 3: Write the Career skill workbench**

List all installed skills exactly once with direct-use and orchestrator boundaries. Group role/evidence, reverse design/portfolio, interview/growth, image/visualization and export lanes.

- [ ] **Step 4: Extend role, research, growth and orchestration guides**

Modify:

- map-game-design-career
- research-game-design-jobs
- plan-junior-growth
- orchestrate-game-design-career
- apply-document-quality-profile

Preserve current evidence and routing contract terms.

- [ ] **Step 5: Extend portfolio and interview guides**

Modify:

- reverse-engineer-game-design
- build-game-design-portfolio
- review-game-design-portfolio
- practice-game-design-interview
- export-career-documents

Keep observation/inference/proposal, attribution, evidence ID and no-guarantee boundaries.

- [ ] **Step 6: Extend image and visualization guides**

Modify:

- plan-image-assets
- generate-image-assets
- review-image-assets
- visualize-career-roadmap
- svg-infographic

Preserve provider routing, named human approval, Skillstead and renderer fallback behavior.

- [ ] **Step 7: Run Career guide contracts**

Expected: all 15 guides PASS existing and new contracts.

- [ ] **Step 8: Commit Career skill guides**

~~~bash
git add guides/game-design-career/use-cases/skill-workbench.md guides/game-design-career/skills tests/contracts
git commit -m "docs: add Career direct-skill workbench"
~~~

### Task 5: Career recipes and FAQ

**Files:**
- Modify: guides/game-design-career/recipes/role-learning-roadmap.md
- Modify: guides/game-design-career/recipes/job-research-gap.md
- Modify: guides/game-design-career/recipes/reverse-design.md
- Modify: guides/game-design-career/recipes/portfolio-build-review.md
- Modify: guides/game-design-career/recipes/interview-preparation.md
- Modify: guides/game-design-career/recipes/junior-growth-transition.md
- Create: guides/game-design-career/faq.md
- Modify: tests/contracts/user-guide-career-diagrams.test.mjs
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: concrete result examples in six existing recipes and at least 18 Career FAQ answers.

- [ ] **Step 1: Add failing recipe result tests**

Require 예상 파일 트리, 대표 내용 예시, 완료 기준 and portfolio/interview use inside 예상 결과. Preserve exact heading and one-primary-diagram contracts.

- [ ] **Step 2: Add failing FAQ tests**

Require at least 18 Q headings and the approved answer shape.

- [ ] **Step 3: Run and observe failures**

Run:

~~~bash
node --test tests/contracts/user-guide-career-diagrams.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

- [ ] **Step 4: Expand all six recipe results**

Use only existing artifacts, skills and current evidence fields. Do not create duplicate complete sample projects.

- [ ] **Step 5: Write Career FAQ**

Cover all 18 questions in spec section 11.3. Cite official sources only for time-sensitive or external hiring claims and include 2026-08-06 as the research confirmation date.

- [ ] **Step 6: Run recipe and FAQ tests**

Expected: all Career contracts PASS.

- [ ] **Step 7: Commit Career recipe and FAQ changes**

~~~bash
git add guides/game-design-career/recipes guides/game-design-career/faq.md tests/contracts
git commit -m "docs: expand Career outcomes and FAQ"
~~~

### Task 6: Career 33 Skillstead diagram pairs

**Files:**
- Modify: guides/assets/use-case-diagram-sources.json
- Create: guides/assets/game-design-career/use-cases/*.svg
- Create: guides/assets/game-design-career/use-cases/*.png
- Create: guides/assets/game-design-career/skills/*.svg
- Create: guides/assets/game-design-career/skills/*.png
- Modify: guides/assets/diagram-manifest.json
- Modify: guides/assets/VISUAL-QA.md
- Modify: guides/game-design-career/use-cases/competency-paths.md
- Modify: guides/game-design-career/use-cases/concept-scenarios.md
- Modify: guides/game-design-career/skills/*.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Produces: scopes game-design-career-use-case and game-design-career-skill.

- [ ] **Step 1: Add failing Career diagram tests**

Require 18 and 15 scope counts plus the same accessibility, dimensions, lint, source and usedBy contracts as Studio.

- [ ] **Step 2: Run and verify 33 missing diagram failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

- [ ] **Step 3: Add 18 Career case sources**

Use design-pipeline for competency cases and decision-flow for target cases. Every diagram must show evidence, human review and no-guarantee or revalidation boundary where relevant.

- [ ] **Step 4: Add 15 Career skill-flow sources**

Use exact trigger, evidence input, owned work, output and next route from each guide.

- [ ] **Step 5: Generate and register the 33 pairs**

Run npm run build:guide-diagrams and append exact manifest entries without changing existing Career recipe scope entries.

- [ ] **Step 6: Insert all 33 Career diagram embeds**

Add one manifest-alt PNG wrapped in the paired editable SVG link to every CA-C/CA-T case section and every Career direct-use skill section. Require exactly one new use-case or skill-flow embed per manifest entry.

- [ ] **Step 7: Perform automated and representative visual QA**

Inspect CA-C05, CA-T01, CA-T09 and the longest Career skill diagram at high and original detail. Record the QA in VISUAL-QA.md.

- [ ] **Step 8: Run Career diagram checks**

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs
npm run check:guide-diagrams
~~~

Expected: 33 new Career pairs PASS.

- [ ] **Step 9: Commit Career diagrams**

~~~bash
git add guides/assets guides/game-design-career tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add Career use-case Skillstead diagrams"
~~~

### Task 7: Career indexes and product README

**Files:**
- Modify: guides/game-design-career/README.md
- Modify: guides/game-design-career/skills/README.md
- Modify: products/game-design-career/plugin/README.md
- Modify: tests/contracts/user-guides-career.test.mjs
- Modify: tests/products/career/readme.test.mjs

**Interfaces:**
- Produces: target-user, exploration-path, direct-skill and expected-result routing.

- [ ] **Step 1: Add failing README routing tests**

Require target users, direct skill versus orchestrator rule, six representative cases/results, four Career use-case guide links, FAQ and output catalog.

- [ ] **Step 2: Run targeted tests and verify failures**

Run:

~~~bash
node --test tests/contracts/user-guides-career.test.mjs
node --test tests/products/career/readme.test.mjs
~~~

- [ ] **Step 3: Expand the Career guide index**

Keep installation and first-artifact path while adding competency, target, skill and FAQ tables.

- [ ] **Step 4: Expand the source product README**

Add target users, representative requests/results, direct skill conditions and result reading order. Keep package-local links safe and do not promise hiring outcomes.

- [ ] **Step 5: Run README tests**

Expected: guide and source README tests PASS.

- [ ] **Step 6: Commit Career README changes**

~~~bash
git add guides/game-design-career/README.md guides/game-design-career/skills/README.md products/game-design-career/plugin/README.md tests
git commit -m "docs: expand Career usage entry points"
~~~

## Career Plan Completion Gate

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guides-career.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs tests/products/career/readme.test.mjs
npm run check:guide-diagrams
git diff --check
~~~

Expected: 18 Career cases, 15 Career skill cases, 18 FAQ answers and 33 new Career diagram pairs PASS.
