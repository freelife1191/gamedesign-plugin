# Game Design Use-Case Guides Suite Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 공통, Studio와 Career 작업을 루트 README, complete validator, 90-diagram inventory, generated plugin snapshots와 전체 검증으로 통합한다.

**Architecture:** Foundation, Studio와 Career 계획의 결과를 complete mode에서 하나의 폐쇄된 문서 계약으로 묶는다. tooling/lib/user-guides.mjs는 use-case validator 결과를 합성하고 90개 전체 diagram pair를 검증한다. Root와 guide indexes는 상세 내용을 복제하지 않고 사용자 유형, 세 탐색 방식, 대표 결과와 안정적인 링크를 제공한다.

**Tech Stack:** Node.js 18+ ESM, node:test, Markdown, JSON, Skillstead SVG/PNG, existing snapshot builder

## Global Constraints

- Foundation, Studio와 Career 계획이 모두 완료된 뒤 시작한다.
- use-case complete counts는 audience 6, Studio cases 18, Career cases 18, Studio skills 15, Career skills 15다.
- diagram manifest total은 기존 18쌍과 새 72쌍을 합친 정확히 90쌍이다.
- guide Markdown count는 기존 66개와 새 13개를 합친 79개다.
- source 제품 README를 편집하고 npm run build로 plugins snapshots를 생성한다.
- root README는 초보자에게 필요한 선택과 대표 결과를 우선하고 기술 appendix를 유지한다.
- 새 dependency, 실제 API 호출, 이미지 생성과 외부 production 변경을 하지 않는다.
- full test에서 실패가 하나라도 있으면 완료를 주장하지 않는다.

---

### Task 1: Complete use-case validator integration

**Files:**
- Modify: tooling/lib/user-guides.mjs
- Modify: tooling/lib/use-case-guides.mjs
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs
- Modify: tests/contracts/user-guide-studio-diagrams.test.mjs
- Modify: tests/contracts/user-guide-career-diagrams.test.mjs

**Interfaces:**
- Consumes: validateUseCaseGuides({ repoRoot, requireComplete: true, inventories }).
- Produces: validateUserGuides counts including audiencePaths, useCases, skillCases and faq.
- Produces: exact total diagram count 90 while preserving existing recipe scope subsets.

- [ ] **Step 1: Add failing complete-count tests**

~~~javascript
const inventories = new Map(await Promise.all(PRODUCT_IDS.map(async (productId) => [
  productId,
  await collectProductInventory(repoRoot, productId),
])));
const result = await validateUseCaseGuides({ repoRoot, requireComplete: true, inventories });
assert.equal(result.ok, true, result.errors.join("\n"));
assert.deepEqual(result.counts, {
  audiencePaths: 6,
  studioCases: 18,
  careerCases: 18,
  studioSkillCases: 15,
  careerSkillCases: 15,
  faq: 48,
});
~~~

Add a test that diagram-manifest.json has 90 unique IDs and scope counts:

- shared 6
- game-design-studio 6
- game-design-career 6
- use-case-audience 6
- game-design-studio-use-case 18
- game-design-studio-skill 15
- game-design-career-use-case 18
- game-design-career-skill 15

- [ ] **Step 2: Run complete tests and verify expected count failures**

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs
~~~

- [ ] **Step 3: Make use-case complete validation inspect real files**

In requireComplete mode validate:

- exact array counts
- all document anchors
- all App and CLI request markers
- all manifest skills/templates against collectProductInventory
- every diagram path and alt against diagram-manifest.json
- at least 48 FAQ headings across common, Studio and Career
- no product-boundary violations

- [ ] **Step 4: Compose use-case results into validateUserGuides**

Extend counts:

~~~javascript
const counts = {
  guides: 0,
  skillGuides: 0,
  templates: 0,
  svg: 0,
  png: 0,
  audiencePaths: 0,
  useCases: 0,
  skillCases: 0,
  faq: 0,
};
~~~

When requireComplete is true, pass the existing inventories Map to validateUseCaseGuides and append its errors with prefix use-case. The foundation's dynamic diagram total resolves to 90 once the complete manifest is present; keep the separate exact-90 contract test as the final invariant.

- [ ] **Step 5: Update existing product diagram tests**

Change only global total assertions from 18 to 90. Keep the product recipe scope expectations at exactly six each so new scopes cannot masquerade as existing recipe diagrams.

- [ ] **Step 6: Run targeted complete validation**

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guide-shared-diagrams.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs
npm run validate:guides
~~~

Expected: PASS with guides 79, skillGuides 30, templates 30, svg 90, png 90, audiencePaths 6, useCases 36, skillCases 30 and faq at least 48.

- [ ] **Step 7: Commit complete validator integration**

~~~bash
git add tooling/lib tests/contracts
git commit -m "test(docs): enforce complete use-case guide coverage"
~~~

### Task 2: Root and global guide navigation

**Files:**
- Modify: README.md
- Modify: guides/README.md
- Modify: tests/contracts/root-readme-user-guides.test.mjs

**Interfaces:**
- Produces: root navigation to user paths, three exploration modes, representative Studio/Career cases and output catalog.

- [ ] **Step 1: Add failing root README contract assertions**

Extend requiredRootHeadings before 어떤 플러그인을 설치할까 with:

1. 이 플러그인으로 할 수 있는 일
2. 사용자 유형별 추천 시작점
3. 활용 방법 선택

Require:

- links to guides/use-cases/README.md, audience-paths.md and output-catalog.md
- six audience labels
- at least six Studio and six Career representative case links
- result terms content.md, evidence.yml, SVG, PNG, MD, PDF, DOCX and PPTX
- one beginner, one applied, one portfolio and one full-project request

- [ ] **Step 2: Run the root README test and verify missing-heading failures**

Run: node --test tests/contracts/root-readme-user-guides.test.mjs

- [ ] **Step 3: Expand README.md**

Add concise sections before installation selection. Keep all existing install, image, export, safety, troubleshooting and technical appendix content. Do not copy full case bodies.

- [ ] **Step 4: Expand guides/README.md**

Add common use-case hub, output catalog, three exploration paths, product case/FAQ links and a beginner-to-portfolio reading route. Preserve the terminology section.

- [ ] **Step 5: Extend reachability tests**

Update the expected reachable paths to include the 13 new Markdown files:

- shared use-cases 3
- Studio use-cases 4 plus faq 1
- Career use-cases 4 plus faq 1

Assert total guide Markdown reachability is 79 without relying only on a raw file count.

- [ ] **Step 6: Run root and reachability tests**

Run:

~~~bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
~~~

Expected: all new guides are reachable from guides/README.md and root README keeps its safety contract.

- [ ] **Step 7: Commit root navigation**

~~~bash
git add README.md guides/README.md tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: expose use-case learning paths"
~~~

### Task 3: Product snapshot synchronization

**Files:**
- Generated modify: plugins/game-design-studio/**
- Generated modify: plugins/game-design-career/**
- Test: tests/contracts/package-contents.test.mjs

**Interfaces:**
- Consumes: source product README changes from Studio and Career plans.
- Produces: exact clean built plugin snapshots and BUILD-MANIFEST updates.

- [ ] **Step 1: Run snapshot check and observe source/snapshot drift**

Run: node tooling/build-snapshots.mjs --check

Expected: FAIL because source product README files changed while plugin snapshots are stale.

- [ ] **Step 2: Rebuild both snapshots**

Run: npm run build

Expected: the builder updates only plugins/game-design-studio and plugins/game-design-career through its recoverable transaction.

- [ ] **Step 3: Run package-content and product README tests**

Run:

~~~bash
node --test tests/contracts/package-contents.test.mjs
node --test tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs
~~~

Expected: clean build and checked-in snapshot trees match exactly.

- [ ] **Step 4: Inspect generated scope**

Run: git status --short

Expected: only planned source docs/tests plus the two plugin snapshot directories are changed. No .env, temporary render profile or recovery directory is tracked.

- [ ] **Step 5: Commit generated snapshots**

~~~bash
git add plugins/game-design-studio plugins/game-design-career
git commit -m "build: sync use-case plugin readmes"
~~~

### Task 4: Final visual QA and documentation integrity

**Files:**
- Modify: guides/assets/VISUAL-QA.md
- Modify: guides/assets/diagram-manifest.json only if a verified path or QA mismatch is found
- Modify: guides/assets/use-case-diagram-sources.json only if a source correction is required

**Interfaces:**
- Produces: final evidence for all 72 generated pairs and eight representative manual inspections.

- [ ] **Step 1: Run reproducibility and manifest checks**

Run:

~~~bash
npm run check:guide-diagrams
npm run validate:guides
~~~

Expected: all generated SVG bytes are reproducible and all 90 PNG files are complete exact 2× assets.

- [ ] **Step 2: Inspect eight representative PNGs**

Use view_image at high and original detail for:

- aud-01
- aud-06
- st-c03
- st-g01
- one longest Studio skill diagram
- ca-c05
- ca-t09
- one longest Career skill diagram

Check tofu, clipping, overlap, connector gaps, visual hierarchy, contrast and source fidelity.

- [ ] **Step 3: Fix only failing source records**

If an inspection fails, patch its entry in use-case-diagram-sources.json, rerun the builder with the exact failing manifest ID, for example npm run build:guide-diagrams -- --id st-c03, and re-inspect both detail levels. Never edit rendered PNG manually.

- [ ] **Step 4: Finalize VISUAL-QA.md**

Record:

- Skillstead 0.8.3 and Chromium identity
- 72-source lint 0 error/0 warning
- 72 PNG exact 2× and complete
- eight representative high/original verdicts
- any fix rounds with affected IDs

- [ ] **Step 5: Commit visual QA evidence**

~~~bash
git add guides/assets
git commit -m "docs: verify use-case visual assets"
~~~

### Task 5: Full suite verification and final review

**Files:**
- Modify only files required by a demonstrated test failure.

**Interfaces:**
- Produces: completion evidence for the approved design.

- [ ] **Step 1: Run formatting and secret checks**

Run:

~~~bash
git diff --check
rg -n "sk-(proj-)?[A-Za-z0-9_-]{20,}|OPENAI_API_KEY=[^[:space:]#]" README.md guides products plugins
~~~

Expected: diff check PASS and secret scan returns no matches.

- [ ] **Step 2: Run targeted documentation validation**

Run:

~~~bash
npm run validate:guides
npm run check:guide-diagrams
node --test tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs
~~~

Expected: all commands PASS with exact approved counts.

- [ ] **Step 3: Run build and repository validation**

Run:

~~~bash
npm run build
npm run validate
~~~

Expected: both commands PASS and the second build creates no new diff.

- [ ] **Step 4: Run the full test suite**

Run: npm test

Expected: PASS with zero failed tests.

- [ ] **Step 5: Review completion against the design**

Check every item in docs/superpowers/specs/2026-08-06-game-design-plugin-use-case-learning-guide-design.md section 18. Record any validation gap instead of marking it complete.

- [ ] **Step 6: Close demonstrated failures in their owning task**

If no fix is required, do not create an empty commit. If a failure is found, return to Task 1 for validator/count failures, Task 2 for navigation failures, Task 3 for snapshot failures or Task 4 for visual failures; apply that task's exact test-and-commit sequence before rerunning this gate.

## Suite Integration Completion Gate

The work is complete only when all of the following are fresh and successful:

~~~bash
npm run validate:guides
npm run check:guide-diagrams
npm run build
npm run validate
npm test
git diff --check
git status --short --branch
~~~

Expected final state: main feature branch is clean; 6 audience paths, 36 complex cases, 30 skill cases, at least 48 FAQ questions, 90 total SVG/PNG pairs and synchronized plugin snapshots are verified.
