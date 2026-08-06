# Game Design Use-Case Guides Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 공통 use-case manifest, 검증 API, 사용자 유형 6개, 결과물 카탈로그와 재현 가능한 Skillstead 도식 생성 기반을 만든다.

**Architecture:** guides/use-cases/use-case-manifest.json은 사용자 경로, 제품 사례와 스킬 사례 coverage의 단일 routing 기준이다. tooling/lib/use-case-guides.mjs는 부분 상태와 최종 complete 상태를 구분해 검증하고, tooling/build-use-case-diagrams.mjs는 선언형 diagram source를 Skillstead lint와 Chromium 2× render로 변환한다. 이 계획은 공통 경로 6개만 완성하고 Studio와 Career 배열은 후속 계획이 채운다.

**Tech Stack:** Node.js 18+ ESM, node:test, Markdown, JSON, SVG 1.1, vendored Skillstead svg-infographic 0.8.3, Chromium

## Global Constraints

- 새 npm dependency를 추가하지 않는다.
- 기존 plugin runtime skill, agent, hook, image provider와 export 동작을 변경하지 않는다.
- 모든 guide path는 저장소 내부 regular file이어야 하며 symlink와 절대 경로를 허용하지 않는다.
- 모든 use-case SVG는 viewBox 0 0 1400 900, 직접 자식 title과 desc, 의미 있는 alt text를 가진다.
- 모든 PNG는 vendored Skillstead Chromium renderer가 만든 2800×1800의 정확한 2× 파생본이어야 한다.
- 실제 OPENAI_API_KEY, 개인정보, NDA 자료와 권리 불명 자산을 추가하지 않는다.
- 기존 diagram 18쌍과 shared scope 6개 계약을 변경하지 않는다.
- 공통 guide는 회사 고유 양식과 문체를 복제하지 않고 중립적인 사례만 사용한다.
- source 문서와 generated plugin snapshot을 직접 혼용하지 않는다.

---

### Task 1: Use-case manifest validator API

**Files:**
- Create: tests/contracts/user-guide-use-case-manifest.test.mjs
- Create: tooling/lib/use-case-guides.mjs
- Create: guides/use-cases/use-case-manifest.json

**Interfaces:**
- Produces: USE_CASE_EXPECTED_COUNTS = { audiencePaths: 6, studioCases: 18, careerCases: 18, studioSkillCases: 15, careerSkillCases: 15 }
- Produces: validateUseCaseGuides({ repoRoot: string, requireComplete?: boolean, inventories?: Map }) -> Promise<{ ok: boolean, errors: string[], counts: object }>
- Produces: loadUseCaseManifest({ repoRoot: string }) -> Promise<object>
- Consumes later: Studio, Career와 integration 계획은 같은 manifest 배열을 확장하고 requireComplete=true 검증을 사용한다.

- [ ] **Step 1: Write the failing manifest loader test**

~~~javascript
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadUseCaseManifest } from "../../tooling/lib/use-case-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("use-case manifest exposes the versioned three-lane contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.audience_paths));
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(Array.isArray(manifest.skill_cases));
});
~~~

- [ ] **Step 2: Run the loader test and verify the missing-module failure**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL because tooling/lib/use-case-guides.mjs does not exist.

- [ ] **Step 3: Implement the safe manifest loader and partial validator**

Implement these exact exported names:

~~~javascript
export const USE_CASE_EXPECTED_COUNTS = Object.freeze({
  audiencePaths: 6,
  studioCases: 18,
  careerCases: 18,
  studioSkillCases: 15,
  careerSkillCases: 15,
});

export async function loadUseCaseManifest({ repoRoot }) {
  const manifestPath = path.join(await realpath(repoRoot), "guides/use-cases/use-case-manifest.json");
  await assertRegularContainedFile(await realpath(repoRoot), manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== 1) throw new Error("use-case manifest version must be 1");
  for (const field of ["audience_paths", "cases", "skill_cases"]) {
    if (!Array.isArray(manifest[field])) throw new Error("use-case manifest field must be an array: " + field);
  }
  return manifest;
}

export async function validateUseCaseGuides({ repoRoot, requireComplete = false, inventories }) {
  const errors = [];
  const manifest = await loadUseCaseManifest({ repoRoot });
  const counts = countEntries(manifest);
  validateUniqueIds(manifest, errors);
  validateEntryShapes(manifest, errors);
  if (inventories) validateCatalogBindings(manifest, inventories, errors);
  if (requireComplete) validateCompleteCounts(counts, errors);
  return { ok: errors.length === 0, errors, counts };
}
~~~

The private helpers must reject empty IDs, duplicate IDs across all three arrays, unknown product values, unsafe absolute or traversal paths, missing document/anchor/diagram fields and non-array skill/template/output fields. Partial validation accepts empty cases and skill_cases but never accepts malformed entries. The module must not import tooling/lib/user-guides.mjs; complete catalog inventories are injected by the caller to avoid an ESM import cycle.

- [ ] **Step 4: Add the initial manifest with six stable audience IDs**

Create version 1 with these exact IDs and empty product arrays:

~~~json
{
  "version": 1,
  "audience_paths": [
    { "id": "AUD-01", "slug": "game-design-student" },
    { "id": "AUD-02", "slug": "job-seeking-student" },
    { "id": "AUD-03", "slug": "career-transitioner" },
    { "id": "AUD-04", "slug": "solo-indie-designer" },
    { "id": "AUD-05", "slug": "working-game-designer" },
    { "id": "AUD-06", "slug": "lead-educator-mentor" }
  ],
  "cases": [],
  "skill_cases": []
}
~~~

Before the test passes, expand each audience entry with document, anchor, level, recommended_views, outputs and diagram { svg, png, alt }. Use guides/use-cases/audience-paths.md as document and these exact anchors and asset stems:

- AUD-01: aud-01-게임-기획-입문-학생, aud-01
- AUD-02: aud-02-게임-기획-취업-준비생, aud-02
- AUD-03: aud-03-게임-기획-직무-전환자, aud-03
- AUD-04: aud-04-솔로인디-게임-기획자, aud-04
- AUD-05: aud-05-현업-게임-기획자, aud-05
- AUD-06: aud-06-팀-리드교육자멘토, aud-06

- [ ] **Step 5: Add negative tests for duplicate IDs and unsafe paths**

Export pure helpers only if the tests require them. Prefer writing a temporary manifest fixture under an OS temporary directory and calling validateUseCaseGuides. Assert that duplicate AUD-01 and ../../escape.svg produce nonempty errors.

- [ ] **Step 6: Run the targeted tests**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: PASS with the loader, six audience entries and malformed fixture rejection.

- [ ] **Step 7: Commit the manifest foundation**

~~~bash
git add tests/contracts/user-guide-use-case-manifest.test.mjs tooling/lib/use-case-guides.mjs guides/use-cases/use-case-manifest.json
git commit -m "test(docs): add use-case manifest contract"
~~~

### Task 2: Common use-case hub and output catalog

**Files:**
- Create: guides/use-cases/README.md
- Create: guides/use-cases/audience-paths.md
- Create: guides/use-cases/output-catalog.md
- Modify: guides/use-cases/use-case-manifest.json
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs

**Interfaces:**
- Consumes: loadUseCaseManifest and validateUseCaseGuides from Task 1.
- Produces: six audience anchors and the shared result taxonomy used by all product case entries.
- Produces: result levels named 최소 결과, 선택 결과, 확장 결과.

- [ ] **Step 1: Write failing tests for the three common documents**

Add assertions that each path is a regular file, all six manifest anchors exist in audience-paths.md, and output-catalog.md contains these exact result levels:

~~~javascript
for (const heading of ["최소 결과", "선택 결과", "확장 결과"]) {
  assert.ok(outputCatalog.includes("## " + heading));
}
for (const entry of manifest.audience_paths) {
  assert.ok(collectHeadingAnchors(audiencePaths).has(entry.anchor), entry.id + " anchor");
}
~~~

- [ ] **Step 2: Run the test and verify ENOENT failures**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL because the common Markdown files do not exist.

- [ ] **Step 3: Write guides/use-cases/README.md**

Use this exact H2 order:

1. 무엇을 할 수 있나요
2. 누구를 위한 가이드인가요
3. 역량·콘셉트·스킬 중 선택하기
4. 작업 규모 선택하기
5. 결과물 먼저 보기
6. 공통 FAQ
7. 제품별 상세 가이드

The common FAQ section must contain twelve H3 questions with IDs Q01 through Q12 and the approved answer shape: short conclusion, reason/boundary, executable request, expected result, related guide and rights/evidence note.

- [ ] **Step 4: Write the six audience paths**

Each AUD heading must include:

- current situation and success signal
- beginner, foundation, applied, portfolio and full-project route where relevant
- recommended Studio or Career case IDs
- one App request and one CLI request
- minimum, optional and extended outputs
- review and resume boundary

Use headings such as:

~~~markdown
## AUD-01 — 게임 기획 입문 학생
~~~

Do not add literal HTML anchors. Use the exact headings represented by the six manifest anchors and verify them with collectHeadingAnchors.

- [ ] **Step 5: Write the output catalog**

Include Studio and Career tables mapping a user request to template, minimum files, optional image/diagram assets, derivative formats, human review and portfolio/team use. Include the canonical file reading order:

~~~text
content.md
→ evidence.yml
→ decisions/
→ assets/
→ export-manifest.yml
~~~

State that MD survives renderer absence, generated images start as concept-draft, and PDF/DOCX/PPTX success requires downstream renderer plus format/visual QA.

Add a Studio → Career handoff subsection that keeps both Canonical Artifacts separate, transfers only public problem/decision/validation evidence, and excludes NDA material, team PII, rights-unknown assets and unverified team outcomes.

- [ ] **Step 6: Run the common guide tests**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: PASS with three common guides, six anchors and twelve common FAQ questions.

- [ ] **Step 7: Commit common guides**

~~~bash
git add guides/use-cases tests/contracts/user-guide-use-case-manifest.test.mjs
git commit -m "docs: add use-case audience and output guides"
~~~

### Task 3: Declarative Skillstead diagram builder

**Files:**
- Create: tooling/lib/use-case-diagrams.mjs
- Create: tooling/build-use-case-diagrams.mjs
- Create: tests/unit/use-case-diagrams.test.mjs
- Create: guides/assets/use-case-diagram-sources.json
- Modify: package.json

**Interfaces:**
- Produces: validateDiagramSource(source: object) -> void
- Produces: renderDiagramSvg(source: object) -> string
- Produces: buildUseCaseDiagrams({ repoRoot: string, ids?: string[] }) -> Promise<{ svg: number, png: number }>
- Source fields: id, scope, title, description, alt, type, eyebrow, conclusion, steps[], source_paths[], used_by[]
- Supported type values: learning-path, design-pipeline, decision-flow, skill-flow

- [ ] **Step 1: Write the failing pure rendering tests**

~~~javascript
test("renderDiagramSvg creates an accessible 1400 by 900 Skillstead source", () => {
  const svg = renderDiagramSvg(validFixture);
  assert.match(svg, /^<svg[^>]+viewBox="0 0 1400 900"[^>]*>\n  <title>[^<]+<\/title>\n  <desc>[^<]+<\/desc>/u);
  assert.doesNotMatch(svg, /<style\b/iu);
  assert.match(svg, /aria-label="읽기 순서 1:/u);
});

test("diagram source rejects an unsupported type and fewer than three steps", () => {
  assert.throws(() => validateDiagramSource({ ...validFixture, type: "chart" }));
  assert.throws(() => validateDiagramSource({ ...validFixture, steps: validFixture.steps.slice(0, 2) }));
});
~~~

- [ ] **Step 2: Run the unit test and verify the missing-module failure**

Run: node --test tests/unit/use-case-diagrams.test.mjs

Expected: FAIL because tooling/lib/use-case-diagrams.mjs does not exist.

- [ ] **Step 3: Implement the four fixed SVG layouts**

Use one neutral visual grammar:

- 1400×900 canvas and visible background rectangle
- 54px title, 24px description and 18px labels
- three to five cards with at least 24px internal padding
- 2px connector shafts and open-V arrowheads
- 12px gap before target card borders
- conclusion strip at the bottom
- no foreignObject, external font, script, embedded bitmap or style element

Escape XML for every source-controlled string. decision-flow may branch but must preserve a left-to-right primary reading order. Each SVG group must have aria-label with an ordinal reading order.

- [ ] **Step 4: Implement the CLI builder**

The CLI accepts:

~~~text
node tooling/build-use-case-diagrams.mjs --id aud-01
node tooling/build-use-case-diagrams.mjs --check
~~~

Normal mode writes only the explicit paths declared by each source, calls the Studio product wrapper for lint and render, and rejects any nonzero exit or warning summary. Check mode renders into an OS temporary directory and byte-compares generated SVG plus validates PNG completeness and dimensions without changing repository files.

Use products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs as the wrapper. Do not discover or invoke an alternate renderer.

- [ ] **Step 5: Add package scripts**

~~~json
"build:guide-diagrams": "node tooling/build-use-case-diagrams.mjs",
"check:guide-diagrams": "node tooling/build-use-case-diagrams.mjs --check"
~~~

- [ ] **Step 6: Add six complete audience diagram sources**

Each source ID is aud-01 through aud-06 and maps to the manifest SVG/PNG path. Each diagram uses type learning-path and distinct step labels derived from its audience route. source_paths contains guides/use-cases/audience-paths.md and used_by contains the same file.

- [ ] **Step 7: Run unit tests and build the six diagram pairs**

Run:

~~~bash
node --test tests/unit/use-case-diagrams.test.mjs
npm run build:guide-diagrams -- --id aud-01
npm run build:guide-diagrams
~~~

Expected: unit tests PASS; six SVG files lint with 0 errors and 0 warnings; six PNG files are complete 2800×1800 images.

- [ ] **Step 8: Commit the builder and generated audience assets**

~~~bash
git add package.json tooling/lib/use-case-diagrams.mjs tooling/build-use-case-diagrams.mjs tests/unit/use-case-diagrams.test.mjs guides/assets/use-case-diagram-sources.json guides/assets/use-cases
git commit -m "feat(docs): add reproducible Skillstead guide diagrams"
~~~

### Task 4: Audience diagram manifest and foundation validation

**Files:**
- Modify: guides/assets/diagram-manifest.json
- Modify: guides/use-cases/use-case-manifest.json
- Modify: guides/use-cases/audience-paths.md
- Modify: tests/contracts/user-guide-use-case-manifest.test.mjs
- Modify: tests/contracts/user-guide-studio-diagrams.test.mjs
- Modify: tests/contracts/user-guide-career-diagrams.test.mjs
- Modify: tooling/lib/user-guides.mjs
- Modify: guides/assets/VISUAL-QA.md

**Interfaces:**
- Consumes: six generated SVG/PNG pairs and manifest entries.
- Produces: diagram scope use-case-audience with exactly six entries.
- Leaves complete product counts deferred to Studio and Career plans.

- [ ] **Step 1: Write a failing test for the six audience diagram entries**

Assert exactly six entries with scope use-case-audience. For each, assert:

- id equals aud-01 through aud-06
- svg and png paths match the use-case manifest
- sources and usedBy resolve to audience-paths.md
- manifest alt text equals the Markdown embed alt
- SVG has title and desc
- PNG is complete and 2800×1800

- [ ] **Step 2: Run the test and verify the manifest count failure**

Run: node --test tests/contracts/user-guide-use-case-manifest.test.mjs

Expected: FAIL because diagram-manifest.json still has only the existing 18 entries.

- [ ] **Step 3: Append the six audience diagram entries**

Use scope use-case-audience. Preserve the existing 18 entries byte-for-byte except for the JSON insertion point. Update each audience manifest diagram alt to exactly match diagram-manifest.json.

- [ ] **Step 4: Insert the six audience diagram embeds**

Under every AUD section, add one PNG embed using the canonical manifest alt and wrap it in a link to the paired editable SVG. All six paths now exist from Task 3, so generic guide link validation remains green.

- [ ] **Step 5: Make aggregate diagram validation follow registered partial coverage**

Remove the hard-coded global length 18 from validateDiagramManifest. Compute the expected total as:

~~~javascript
const useCases = await validateUseCaseGuides({ repoRoot, requireComplete: false });
const registered = useCases.counts.audiencePaths
  + useCases.counts.studioCases
  + useCases.counts.careerCases
  + useCases.counts.studioSkillCases
  + useCases.counts.careerSkillCases;
const expectedDiagramTotal = 18 + registered;
~~~

The global manifest must equal expectedDiagramTotal at every intermediate phase. Update Studio and Career recipe diagram tests to assert unique global IDs and their exact six-entry legacy scope instead of hard-coding a global length of 18. The final integration plan adds the separate exact 90 assertion.

- [ ] **Step 6: Record foundation visual QA**

Add a dated section to VISUAL-QA.md with:

- wrapper and browser identity
- six-source lint summary
- six PNG dimension summary
- high-detail inspection result for AUD-01
- original-detail inspection result for AUD-06
- explicit note that all six passed automated overflow, completion and 2× checks

- [ ] **Step 7: Run foundation checks**

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
npm run check:guide-diagrams
npm run validate:guides
git diff --check
~~~

Expected: targeted tests, existing Studio/Career recipe diagram tests and validate:guides PASS with the dynamic expected total 24.

- [ ] **Step 8: Commit the audience integration**

~~~bash
git add guides/assets/diagram-manifest.json guides/assets/VISUAL-QA.md guides/use-cases tooling/lib/user-guides.mjs tests/contracts
git commit -m "docs: register audience learning flows"
~~~

## Foundation Plan Completion Gate

Run:

~~~bash
node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/unit/use-case-diagrams.test.mjs
npm run check:guide-diagrams
git diff --check
~~~

Expected: all commands PASS; six audience guides and six Skillstead pairs are complete; Studio and Career arrays remain intentionally empty for their dedicated plans.
