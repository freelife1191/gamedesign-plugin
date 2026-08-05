# Game Design Plugin 사용자 가이드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 사용하는 사람이 저장소 문서만으로 Game Design Studio와 Game Design Career를 Codex App·CLI에 설치하고, 모든 스킬·템플릿·이미지·도식·내보내기 흐름을 정확히 사용할 수 있는 검증 가능한 사용자 가이드를 만든다.

**Architecture:** `guides/`를 사용자 문서의 단일 원본으로 만들고 root `README.md`를 짧은 진입점으로 재구성한다. Repository truth에서 스킬·템플릿 inventory를 계산하는 Node.js validator가 문서 coverage, link, heading, option과 diagram manifest를 검증하며, 구조적 시각 자료는 vendored Skillstead 0.8.3의 product-owned wrapper로 SVG와 정확한 2× PNG를 생성한다.

**Tech Stack:** Korean Markdown, Node.js 18+ built-ins and test runner, JSON, SVG, PNG, Codex CLI 0.146.0 command contract, vendored Skillstead `svg-infographic` 0.8.3, Chromium renderer.

## Global Constraints

- 모든 사용자 문서는 한국어로 작성한다.
- Codex App와 Codex CLI를 동등하게 다루되 설치, 호출, 활성화와 제거 UI를 섞지 않는다.
- 현재 검증 기준은 Node.js 18+이며 계획 작성 환경은 Node.js 24.19.0, Codex CLI 0.146.0이다.
- `codex plugin marketplace upgrade`는 Git marketplace refresh로만 설명하고 plugin auto-update라고 표현하지 않는다.
- App 설치 후 새 채팅, CLI 설치 후 새 세션이 필요함을 명시한다.
- 제품 runtime, skill, hook, image provider와 export renderer의 동작을 변경하지 않는다.
- `products/`와 `shared/`는 plugin source이고 `plugins/`는 generated snapshot이다. `plugins/`를 직접 편집하지 않는다.
- 새 dependency를 추가하지 않는다.
- 각 제품은 제품 전용 스킬 14개와 vendored Skillstead 1개, 설치 스킬 15개를 가진다.
- 각 제품의 Canonical Artifact template ID 15개를 package inventory와 정확히 맞춘다.
- 예시는 `복사 가능한 요청문 → 진행 흐름 → 예상 결과 요약` 형식이며 전체 샘플 프로젝트를 추가하지 않는다.
- 구조적 흐름은 Skillstead로 만들고 캐릭터·배경·장면 이미지나 통계 차트로 대체하지 않는다.
- 18개 diagram은 editable SVG와 Chromium exact 2× PNG를 모두 제공한다.
- API key, 실제 `.env` 값, private config와 사용자 자료를 문서·fixture·로그에 기록하지 않는다.
- 생성되지 않은 파일, 실행되지 않은 command, 통과하지 않은 QA나 사람 승인을 성공으로 표현하지 않는다.
- 공개 marketplace 제출, remote push, release 배포와 main merge는 이 계획 범위 밖이다.

---

## File Map

### Validation infrastructure

- Create: `tooling/lib/user-guides.mjs` — product inventory, Markdown link·anchor, guide heading와 diagram manifest 검증
- Create: `tooling/validate-user-guides.mjs` — user-guide validator CLI
- Create: `tests/unit/user-guides.test.mjs` — validator unit tests
- Create: `tests/unit/validate-packages.test.mjs` — packaged target discovery와 30-skill regression
- Modify: `tooling/validate-packages.mjs` — hard-coded 22개 대신 actual packaged target count 사용
- Modify: `package.json` — `validate:guides` script 추가

### Common and entry guides

- Create: `guides/README.md`
- Create: `guides/game-design-studio/README.md`
- Create: `guides/game-design-studio/installation.md`
- Create: `guides/game-design-studio/quick-start.md`
- Create: `guides/game-design-studio/workflow.md`
- Create: `guides/game-design-studio/troubleshooting.md`
- Create: `guides/game-design-career/README.md`
- Create: `guides/game-design-career/installation.md`
- Create: `guides/game-design-career/quick-start.md`
- Create: `guides/game-design-career/workflow.md`
- Create: `guides/game-design-career/troubleshooting.md`
- Create: `tests/contracts/user-guides-entry.test.mjs`

### Product reference guides

- Create: `guides/game-design-studio/skills/*.md` — Studio 15개 설치 스킬
- Create: `guides/game-design-studio/skills/README.md`
- Create: `guides/game-design-studio/templates.md`
- Create: `guides/game-design-studio/document-quality.md`
- Create: `guides/game-design-studio/image-assets.md`
- Create: `guides/game-design-studio/visualization.md`
- Create: `guides/game-design-studio/exports.md`
- Create: `tests/contracts/user-guides-studio.test.mjs`
- Create: `guides/game-design-career/skills/*.md` — Career 15개 설치 스킬
- Create: `guides/game-design-career/skills/README.md`
- Create: `guides/game-design-career/templates.md`
- Create: `guides/game-design-career/document-quality.md`
- Create: `guides/game-design-career/image-assets.md`
- Create: `guides/game-design-career/visualization.md`
- Create: `guides/game-design-career/exports.md`
- Create: `tests/contracts/user-guides-career.test.mjs`

### Diagrams and recipes

- Create: `guides/assets/diagram-manifest.json`
- Create: `guides/assets/VISUAL-QA.md`
- Create: `guides/assets/shared/*.{svg,png}` — 6개 공통 diagram
- Create: `guides/assets/game-design-studio/*.{svg,png}` — 6개 Studio diagram
- Create: `guides/assets/game-design-career/*.{svg,png}` — 6개 Career diagram
- Create: `guides/game-design-studio/recipes/*.md` — 6개 Studio recipe
- Create: `guides/game-design-career/recipes/*.md` — 6개 Career recipe
- Create: `tests/contracts/user-guide-shared-diagrams.test.mjs`
- Create: `tests/contracts/user-guide-studio-diagrams.test.mjs`
- Create: `tests/contracts/user-guide-career-diagrams.test.mjs`

### Landing and integration

- Modify: `README.md`
- Create: `tests/contracts/root-readme-user-guides.test.mjs`

---

### Task 1: Guide validator와 packaged skill count를 정확하게 만든다

**Files:**
- Create: `tooling/lib/user-guides.mjs`
- Create: `tooling/validate-user-guides.mjs`
- Create: `tests/unit/user-guides.test.mjs`
- Create: `tests/unit/validate-packages.test.mjs`
- Modify: `tooling/validate-packages.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `collectProductInventory(repoRoot, productId): Promise<{ skillIds: string[], templateIds: string[] }>`
- Produces: `extractMarkdownLinks(markdown): Array<{ target: string, line: number }>`
- Produces: `collectHeadingAnchors(markdown): Set<string>`
- Produces: `validateUserGuides({ repoRoot, requireComplete }): Promise<{ ok: boolean, errors: string[], counts: object }>`
- Produces: `discoverPackagedTargets(repoRoot, mode): Promise<string[]>` with modes `plugins|skills`
- Later tasks consume these functions in contract tests and `npm run validate:guides`.

- [ ] **Step 1: Write failing inventory, link and package-count tests**

~~~js
// tests/unit/user-guides.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectHeadingAnchors,
  collectProductInventory,
  extractMarkdownLinks,
} from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("product inventory includes 14 product skills plus vendored Skillstead", async () => {
  const studio = await collectProductInventory(repoRoot, "game-design-studio");
  const career = await collectProductInventory(repoRoot, "game-design-career");
  assert.equal(studio.skillIds.length, 15);
  assert.equal(career.skillIds.length, 15);
  assert.equal(studio.templateIds.length, 15);
  assert.equal(career.templateIds.length, 15);
  assert.ok(studio.skillIds.includes("svg-infographic"));
  assert.ok(career.skillIds.includes("svg-infographic"));
});

test("Markdown helpers preserve Korean anchors and reject no links", () => {
  const markdown = "# 설치 안내\n\n[빠른 시작](quick-start.md#첫-요청)\n";
  assert.deepEqual(extractMarkdownLinks(markdown), [
    { target: "quick-start.md#첫-요청", line: 3 },
  ]);
  assert.ok(collectHeadingAnchors("# 설치 안내\n\n## 첫 요청\n").has("첫-요청"));
});
~~~

~~~js
// tests/unit/validate-packages.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoverPackagedTargets } from "../../tooling/validate-packages.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("package validator discovers two plugins and thirty installed skills", async () => {
  assert.equal((await discoverPackagedTargets(repoRoot, "plugins")).length, 2);
  assert.equal((await discoverPackagedTargets(repoRoot, "skills")).length, 30);
});
~~~

- [ ] **Step 2: Run the tests and confirm the new exports are missing**

Run:

~~~bash
node --test tests/unit/user-guides.test.mjs tests/unit/validate-packages.test.mjs
~~~

Expected: FAIL because `tooling/lib/user-guides.mjs` and `discoverPackagedTargets` do not exist.

- [ ] **Step 3: Implement repository-derived inventory and Markdown helpers**

Implement `tooling/lib/user-guides.mjs` with these exact rules:

~~~js
export const PRODUCT_IDS = Object.freeze([
  "game-design-career",
  "game-design-studio",
]);

export async function collectProductInventory(repoRoot, productId) {
  if (!PRODUCT_IDS.includes(productId)) throw new Error("unknown product: " + productId);
  const productRoot = path.join(repoRoot, "products", productId, "plugin");
  const productSkills = await directoryIds(path.join(productRoot, "skills"), "SKILL.md");
  const vendorSkill = path.join(
    repoRoot,
    "shared/vendor/skillstead/svg-infographic/0.8.3/SKILL.md",
  );
  await assertRegularFile(vendorSkill);
  const templateIds = await directoryIds(path.join(productRoot, "assets/templates"), "content.md");
  return {
    skillIds: [...productSkills, "svg-infographic"].sort(compareIds),
    templateIds: templateIds.sort(compareIds),
  };
}
~~~

The same module must:

- reject symlinked guide roots and link targets;
- resolve only paths contained by the repository root;
- ignore external `http:` and `https:` links during local path checks;
- calculate GitHub-style Korean heading anchors and duplicate suffixes;
- reject missing local files, missing anchors, absolute local links and path traversal;
- read `guides/assets/diagram-manifest.json` only when `requireComplete` is true;
- require unique diagram IDs, exactly 18 entries, existing SVG·PNG paths, nonempty alt text, nonempty source paths and at least one `usedBy` path;
- import `parseViewBox`, `pngDims` and `isCompletePng` from the locked vendored Skillstead renderer, require a complete PNG ending at IEND, and require width and height to equal exactly twice the SVG viewBox;
- scan guide Markdown for the literal configuration values `prompt-only`, `select`, `required`, `all`, `gpt-image-2` and `low`;
- reject strings matching an OpenAI secret key shape or a nonempty `OPENAI_API_KEY=` assignment.

- [ ] **Step 4: Replace the hard-coded skill total in package validation**

Export `discoverPackagedTargets` from `tooling/validate-packages.mjs`. The function must enumerate the two actual package roots and return every skill directory containing `SKILL.md`. `main()` must run exactly the discovered targets and print their actual count; remove the `count !== 22` branch.

~~~js
export async function discoverPackagedTargets(root, mode) {
  if (mode === "plugins") {
    return ["game-design-career", "game-design-studio"]
      .map((product) => path.join(root, "plugins", product));
  }
  if (mode !== "skills") throw new Error("mode must be plugins or skills");
  const targets = [];
  for (const product of ["game-design-career", "game-design-studio"]) {
    const skillsRoot = path.join(root, "plugins", product, "skills");
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) targets.push(path.join(skillsRoot, entry.name));
    }
  }
  return targets.sort();
}
~~~

- [ ] **Step 5: Add the guide validator CLI and package script**

`tooling/validate-user-guides.mjs` accepts no arguments except optional `--complete`. It calls `validateUserGuides`, prints each error to stderr, prints counts on success and exits nonzero on failure.

Add:

~~~json
"validate:guides": "node tooling/validate-user-guides.mjs --complete"
~~~

- [ ] **Step 6: Run focused and existing validation tests**

Run:

~~~bash
node --test tests/unit/user-guides.test.mjs tests/unit/validate-packages.test.mjs
node tooling/validate-packages.mjs skills
npm run test:unit
~~~

Expected: focused tests PASS; package validator reports `skills: PASS (30 validators)`; unit group PASS.

- [ ] **Step 7: Commit the validation foundation**

~~~bash
git add package.json tooling/lib/user-guides.mjs tooling/validate-user-guides.mjs tooling/validate-packages.mjs tests/unit/user-guides.test.mjs tests/unit/validate-packages.test.mjs
git commit -m "test(docs): add user guide validation contracts"
~~~

---

### Task 2: Common entry, installation, quick-start와 troubleshooting guides를 작성한다

**Files:**
- Create: `guides/README.md`
- Create: `guides/game-design-studio/README.md`
- Create: `guides/game-design-studio/installation.md`
- Create: `guides/game-design-studio/quick-start.md`
- Create: `guides/game-design-studio/workflow.md`
- Create: `guides/game-design-studio/troubleshooting.md`
- Create: `guides/game-design-career/README.md`
- Create: `guides/game-design-career/installation.md`
- Create: `guides/game-design-career/quick-start.md`
- Create: `guides/game-design-career/workflow.md`
- Create: `guides/game-design-career/troubleshooting.md`
- Create: `tests/contracts/user-guides-entry.test.mjs`

**Interfaces:**
- Consumes: official installation facts in the approved spec and actual CLI selector `PLUGIN@MARKETPLACE`.
- Produces: stable entry paths that every later skill, template, recipe and root README link targets.

- [ ] **Step 1: Write the failing entry-guide contract test**

~~~js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

for (const product of ["game-design-studio", "game-design-career"]) {
  test(product + " entry guide separates App and CLI workflows", async () => {
    const base = path.join(root, "guides", product);
    const installation = await readFile(path.join(base, "installation.md"), "utf8");
    const quickStart = await readFile(path.join(base, "quick-start.md"), "utf8");
    for (const heading of ["Codex App 설치", "Codex CLI 설치", "설치 확인", "업데이트", "제거"]) {
      assert.match(installation, new RegExp("^## " + heading + "$", "m"));
    }
    assert.match(installation, /새 채팅/);
    assert.match(installation, /새 세션/);
    assert.match(installation, /Git marketplace/);
    assert.doesNotMatch(installation, /plugin 자동 업데이트/);
    assert.match(quickStart, /복사 가능한 요청문/);
    assert.match(quickStart, /예상 결과/);
  });
}
~~~

- [ ] **Step 2: Run the test and confirm guides are absent**

Run:

~~~bash
node --test tests/contracts/user-guides-entry.test.mjs
~~~

Expected: FAIL with `ENOENT` for `guides/game-design-studio/installation.md`.

- [ ] **Step 3: Write the common index and both product entry guides**

`guides/README.md` must include:

- Studio·Career decision table;
- beginner reading paths for App, CLI, Studio production and Career preparation;
- supported surfaces and unsupported IDE extension·mobile·general Chat statement;
- links to both product guide indexes;
- a concise terminology table for plugin, skill, Canonical Artifact, Quality Profile, diagram and image approval.

Each product `README.md` must link to installation, quick start, workflow, skills, templates, quality, image, visualization, export, recipes and troubleshooting. Links to files created in later tasks may not be added until those files exist.

Each `installation.md` must include these exact verified CLI commands for its product:

~~~bash
codex plugin marketplace add <path-to-repository-root>
codex plugin marketplace list
codex plugin list
codex plugin add game-design-studio@game-design-suite
codex plugin remove game-design-studio@game-design-suite
~~~

Career substitutes `game-design-career`. Explain that `<path-to-repository-root>` is the directory containing `.agents/plugins/marketplace.json`. Include:

- App flow: register marketplace, restart desktop app when local source changed, open Codex or Work → Plugins, choose `game-design-suite`, install, open a new chat;
- CLI flow: register marketplace, use `/plugins` or `codex plugin add`, open a new session;
- local marketplace update: update checkout, run build and validation, reinstall the plugin;
- Git marketplace update: run `codex plugin marketplace upgrade game-design-suite` before checking the installable snapshot;
- remove plugin separately from removing marketplace;
- managed/workspace plugin uninstall limitation.

Each `quick-start.md` must contain one natural-language prompt and one explicit skill prompt:

~~~text
Studio App:
@Game Design Studio 모바일 협동 RPG의 대상 플레이어, 핵심 재미, 세 가지 설계 원칙과 검증 기준을 게임 기획 브리프로 만들어줘.

Studio explicit:
$game-design-studio:orchestrate-game-design-project 모바일 협동 RPG 아이디어를 game-design-brief부터 검토 가능한 Canonical Artifact까지 진행해줘.

Career App:
@Game Design Career 시스템 기획자를 목표로 하는 입문자의 현재 역량을 진단하고 12주 학습·포트폴리오 로드맵을 만들어줘.

Career explicit:
$game-design-career:orchestrate-game-design-career 시스템 기획자 취업을 위한 역할 선택, 역량 격차와 12주 증거 계획을 만들어줘.
~~~

For each prompt explain required user input, plugin actions, human decisions and expected files.

- [ ] **Step 4: Write workflow and troubleshooting guides**

Studio `workflow.md` covers vision → systems/content/UX/economy/production → review → assets → export. Career covers stage diagnosis → research → evidence project → portfolio/interview/growth → review → export.

Both `troubleshooting.md` use:

~~~text
증상 → 가능한 원인 → 확인 방법 → 안전한 복구 → 재개 요청문 → 보존된 결과
~~~

They must cover plugin discovery, stale session, marketplace selector, Node·Chromium, image mode, API-key routing, image approval, renderer absence, evidence·rights·privacy and Artifact resume.

- [ ] **Step 5: Run the entry-guide tests and local link scan**

Run:

~~~bash
node --test tests/contracts/user-guides-entry.test.mjs
node tooling/validate-user-guides.mjs
git diff --check
~~~

Expected: tests PASS; non-complete validator checks existing files and links without requiring the final 18 diagrams.

- [ ] **Step 6: Commit common entry documentation**

~~~bash
git add guides tests/contracts/user-guides-entry.test.mjs
git commit -m "docs: add beginner plugin entry guides"
~~~

---

### Task 3: Game Design Studio의 15개 skill과 15개 template reference를 작성한다

**Files:**
- Create: `guides/game-design-studio/skills/README.md`
- Create: `guides/game-design-studio/skills/apply-document-quality-profile.md`
- Create: `guides/game-design-studio/skills/define-game-vision.md`
- Create: `guides/game-design-studio/skills/design-game-content.md`
- Create: `guides/game-design-studio/skills/design-game-economy-and-liveops.md`
- Create: `guides/game-design-studio/skills/design-game-systems.md`
- Create: `guides/game-design-studio/skills/design-player-experience.md`
- Create: `guides/game-design-studio/skills/export-game-design-documents.md`
- Create: `guides/game-design-studio/skills/generate-image-assets.md`
- Create: `guides/game-design-studio/skills/orchestrate-game-design-project.md`
- Create: `guides/game-design-studio/skills/plan-game-production.md`
- Create: `guides/game-design-studio/skills/plan-image-assets.md`
- Create: `guides/game-design-studio/skills/review-game-design.md`
- Create: `guides/game-design-studio/skills/review-image-assets.md`
- Create: `guides/game-design-studio/skills/visualize-game-design.md`
- Create: `guides/game-design-studio/skills/svg-infographic.md`
- Create: `guides/game-design-studio/templates.md`
- Create: `guides/game-design-studio/document-quality.md`
- Create: `guides/game-design-studio/image-assets.md`
- Create: `guides/game-design-studio/visualization.md`
- Create: `guides/game-design-studio/exports.md`
- Create: `tests/contracts/user-guides-studio.test.mjs`

**Interfaces:**
- Consumes: `products/game-design-studio/plugin/skills/*/SKILL.md`, Studio template directories, quality indexes, image contracts and export contracts.
- Produces: exact Studio reference paths consumed by recipes, diagrams and root navigation.
- May run in parallel with Task 4 after Task 2.

- [ ] **Step 1: Write the failing Studio coverage test**

~~~js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 예시",
  "Codex CLI 예시",
  "진행 흐름",
  "결과와 파일",
  "검토와 승인",
  "실패와 재개",
];

test("Studio documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-studio/skills", skillId + ".md"),
      "utf8",
    );
    for (const heading of requiredHeadings) {
      assert.match(markdown, new RegExp("^## " + heading + "$", "m"), skillId + ": " + heading);
    }
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});
~~~

- [ ] **Step 2: Run the Studio test and confirm missing files**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs
~~~

Expected: FAIL on the first missing Studio skill guide.

- [ ] **Step 3: Build the Studio skill index from source contracts**

Read every Studio `SKILL.md` completely before writing its guide. `skills/README.md` must table all 15 IDs with purpose, direct invocation, primary template, typical input and output. Use the following primary cases:

| Skill | Primary example |
| --- | --- |
| `orchestrate-game-design-project` | 신규 모바일 협동 RPG의 전체 기획 라우팅 |
| `apply-document-quality-profile` | live-service RPG 시스템 명세 profile 선택 |
| `define-game-vision` | 대상 플레이어·핵심 재미·pillar·검증 기준 |
| `design-game-systems` | 스태미나·제작 규칙, 상태와 예외 |
| `design-game-content` | 퀘스트·NPC·보스 encounter |
| `design-player-experience` | 첫 세션 onboarding, UI state와 접근성 |
| `design-game-economy-and-liveops` | 두 통화의 source·sink와 이벤트 실험 |
| `plan-game-production` | vertical slice 범위, owner, gate와 kill criteria |
| `review-game-design` | evidence와 launch blocker 중심의 최소 수정 |
| `plan-image-assets` | prompt package와 placeholder 계획 |
| `generate-image-assets` | select receipt로 선택한 stable asset ID 생성 |
| `review-image-assets` | document-approved와 production-candidate 승격 |
| `visualize-game-design` | 경제 flow와 system state의 source-backed diagram |
| `export-game-design-documents` | 승인 Artifact의 MD·PDF·DOCX·PPTX 준비 |
| `svg-infographic` | 구조적 SVG authoring과 exact 2× PNG render |

- [ ] **Step 4: Write all Studio skill guides with the fixed section schema**

Each file must cover only branches present in its source skill. For every applicable branch include:

- minimal, structured, existing-document and review inputs;
- explicit `@Game Design Studio` App prompt and explicit CLI `$game-design-studio:<skill-id>` prompt;
- related agent role, template, quality profile and next skill;
- evidence, assumption, approval and unsupported-request boundaries;
- generated, preserved and unavailable files;
- one copyable resume request after failure.

The `svg-infographic` guide must clearly state that the product wrapper `visualize-game-design` should normally select the preset and source mapping first; direct use is for advanced structural diagram authoring, not character art or statistical charts.

- [ ] **Step 5: Write Studio template, quality, image, visualization and export references**

`templates.md` must compare these exact 15 IDs against the package directory:

~~~text
accessibility-platform-matrix
character-skill-combat-monster
core-motivation-loop
data-schema-table-contract
decision-change-log
economy-balance
game-design-brief
game-design-review
liveops-experiment-event
narrative-quest-npc
production-scope-risk
rule-exception-matrix
system-specification
ui-ux-flow-state
vision-pillars
~~~

For each template include purpose, good·bad fit, required sections, evidence, approval, profile, image·diagram slot, formats, package path, prompt and expected result.

`document-quality.md` explains primary profile, overlays, neutral presets and `draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved`.

`image-assets.md` explains `prompt-only|select|required|all`, `gpt-image-2`, `low`, API-key-only OpenAI routing, no-key Codex route, immutable receipts, rights and approval states.

`visualization.md` explains preset selection, source mapping, SVG authority, exact 2× PNG, lint, render and two-pass QA.

`exports.md` compares MD, PDF, DOCX and PPTX, independent presentation story, approved asset binding and fail-closed renderer behavior.

- [ ] **Step 6: Extend the test for exact template and policy coverage**

Add assertions that the IDs parsed from `templates.md` equal `collectProductInventory(...).templateIds` and that the topical guides contain:

~~~js
for (const phrase of [
  "prompt-only", "select", "required", "all",
  "gpt-image-2", "low", "OpenAI only", "Codex",
  "SVG", "정확한 2× PNG", "MD", "PDF", "DOCX", "PPTX",
]) {
  assert.ok(joinedGuides.includes(phrase), "missing Studio guide contract: " + phrase);
}
~~~

- [ ] **Step 7: Run Studio guide validation**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs
node tooling/validate-user-guides.mjs
git diff --check
~~~

Expected: Studio test PASS and existing-guide validation PASS.

- [ ] **Step 8: Commit Studio reference guides**

~~~bash
git add guides/game-design-studio tests/contracts/user-guides-studio.test.mjs
git commit -m "docs(studio): add complete skill and template guides"
~~~

---

### Task 4: Game Design Career의 15개 skill과 15개 template reference를 작성한다

**Files:**
- Create: `guides/game-design-career/skills/README.md`
- Create: `guides/game-design-career/skills/apply-document-quality-profile.md`
- Create: `guides/game-design-career/skills/build-game-design-portfolio.md`
- Create: `guides/game-design-career/skills/export-career-documents.md`
- Create: `guides/game-design-career/skills/generate-image-assets.md`
- Create: `guides/game-design-career/skills/map-game-design-career.md`
- Create: `guides/game-design-career/skills/orchestrate-game-design-career.md`
- Create: `guides/game-design-career/skills/plan-image-assets.md`
- Create: `guides/game-design-career/skills/plan-junior-growth.md`
- Create: `guides/game-design-career/skills/practice-game-design-interview.md`
- Create: `guides/game-design-career/skills/research-game-design-jobs.md`
- Create: `guides/game-design-career/skills/reverse-engineer-game-design.md`
- Create: `guides/game-design-career/skills/review-game-design-portfolio.md`
- Create: `guides/game-design-career/skills/review-image-assets.md`
- Create: `guides/game-design-career/skills/visualize-career-roadmap.md`
- Create: `guides/game-design-career/skills/svg-infographic.md`
- Create: `guides/game-design-career/templates.md`
- Create: `guides/game-design-career/document-quality.md`
- Create: `guides/game-design-career/image-assets.md`
- Create: `guides/game-design-career/visualization.md`
- Create: `guides/game-design-career/exports.md`
- Create: `tests/contracts/user-guides-career.test.mjs`

**Interfaces:**
- Consumes: `products/game-design-career/plugin/skills/*/SKILL.md`, Career template directories, stage routing, evidence, image and export contracts.
- Produces: exact Career reference paths consumed by recipes, diagrams and root navigation.
- May run in parallel with Task 3 after Task 2.

- [ ] **Step 1: Write the failing Career coverage test**

~~~js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 예시",
  "Codex CLI 예시",
  "진행 흐름",
  "결과와 파일",
  "검토와 승인",
  "실패와 재개",
];

test("Career documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const heading of requiredHeadings) {
      assert.match(markdown, new RegExp("^## " + heading + "$", "m"), skillId + ": " + heading);
    }
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});
~~~

Add named-evidence assertions and require the distinction between fact, inference and proposal where the source skill makes current claims.

- [ ] **Step 2: Run the Career test and confirm missing files**

Run:

~~~bash
node --test tests/contracts/user-guides-career.test.mjs
~~~

Expected: FAIL on the first missing Career skill guide.

- [ ] **Step 3: Build the Career skill index from source contracts**

Read every Career `SKILL.md` completely. Use these primary cases:

| Skill | Primary example |
| --- | --- |
| `orchestrate-game-design-career` | 시스템 기획 입문자의 전체 취업 준비 routing |
| `apply-document-quality-profile` | reverse-design 또는 portfolio profile 선택 |
| `map-game-design-career` | 역할군 비교와 목표 수준·역량 gap |
| `research-game-design-jobs` | 현재 채용공고의 required·preferred evidence |
| `reverse-engineer-game-design` | 실제 게임 UI·규칙·경제의 관찰 기반 역기획 |
| `build-game-design-portfolio` | 결정·실험·협업 evidence를 case study로 구성 |
| `review-game-design-portfolio` | recruiter 관점의 5축 검토와 revision backlog |
| `practice-game-design-interview` | target posting과 portfolio 기반 질문·답변 |
| `plan-junior-growth` | quarterly goal, evidence project와 feedback cycle |
| `plan-image-assets` | portfolio용 prompt package와 diagram slot |
| `generate-image-assets` | 선택된 document image 생성과 provider evidence |
| `review-image-assets` | 권리·가독성·placement와 human approval |
| `visualize-career-roadmap` | role·competency·learning dependency diagram |
| `export-career-documents` | portfolio·roadmap·interview report 다중 형식 출력 |
| `svg-infographic` | career 구조용 editable SVG와 exact 2× PNG |

- [ ] **Step 4: Write all Career skill guides**

Use explicit `@Game Design Career` App prompts and explicit CLI `$game-design-career:<skill-id>` prompts. Every current-claim workflow must explain source date, location, sample boundary, fact·inference separation and stale-evidence fallback. Career outcome language must not guarantee hiring, promotion or transition success.

- [ ] **Step 5: Write Career template, quality, image, visualization and export references**

`templates.md` must contain exactly:

~~~text
career-stage-goal
competency-matrix
creative-design-portfolio
five-axis-review
game-analysis-report
game-design-role-map
interview-question-answer-log
introduction-motivation
job-posting-evidence
junior-growth-review
learning-roadmap
portfolio-backlog
portfolio-project-brief
reverse-design-document
transition-readiness
~~~

Document the same fields as Studio, adding target role, target level, current evidence, source date, employer·region scope, privacy and fairness.

`document-quality.md` covers the 13 Career profiles and four stages `entry|new-hire|junior-growth|transition`. Image, visualization and export guides follow the shared contracts but use Career-specific portfolio, roadmap and evidence examples.

- [ ] **Step 6: Extend the Career test for exact inventory and safety coverage**

Assert exact template equality and require:

~~~js
for (const phrase of [
  "사실", "추론", "제안", "검색일", "지역", "표본",
  "합격을 보장하지", "prompt-only", "select", "required", "all",
  "SVG", "2× PNG", "MD", "PDF", "DOCX", "PPTX",
]) {
  assert.ok(joinedGuides.includes(phrase), "missing Career guide contract: " + phrase);
}
~~~

- [ ] **Step 7: Run Career guide validation**

Run:

~~~bash
node --test tests/contracts/user-guides-career.test.mjs
node tooling/validate-user-guides.mjs
git diff --check
~~~

Expected: Career test PASS and existing-guide validation PASS.

- [ ] **Step 8: Commit Career reference guides**

~~~bash
git add guides/game-design-career tests/contracts/user-guides-career.test.mjs
git commit -m "docs(career): add complete skill and template guides"
~~~

---

### Task 5: 공통 Skillstead diagram 6개를 제작하고 검증한다

**Files:**
- Create: `guides/assets/diagram-manifest.json`
- Create: `guides/assets/VISUAL-QA.md`
- Create: `guides/assets/shared/plugin-selection-flow.svg`
- Create: `guides/assets/shared/plugin-selection-flow.png`
- Create: `guides/assets/shared/app-cli-install-flow.svg`
- Create: `guides/assets/shared/app-cli-install-flow.png`
- Create: `guides/assets/shared/canonical-artifact-lifecycle.svg`
- Create: `guides/assets/shared/canonical-artifact-lifecycle.png`
- Create: `guides/assets/shared/image-generation-mode-routing.svg`
- Create: `guides/assets/shared/image-generation-mode-routing.png`
- Create: `guides/assets/shared/image-asset-lifecycle.svg`
- Create: `guides/assets/shared/image-asset-lifecycle.png`
- Create: `guides/assets/shared/document-export-flow.svg`
- Create: `guides/assets/shared/document-export-flow.png`
- Create: `tests/contracts/user-guide-shared-diagrams.test.mjs`

**Interfaces:**
- Produces: diagram manifest schema `{ version, skillsteadVersion, diagrams[] }`.
- Each diagram entry: `{ id, scope, svg, png, alt, sources, usedBy }`.
- Later Studio and Career diagram tasks append entries without changing the schema.

- [ ] **Step 1: Write the failing shared diagram manifest test**

~~~js
test("shared diagram manifest declares six verified diagrams", async () => {
  const manifest = JSON.parse(await readFile(
    path.join(root, "guides/assets/diagram-manifest.json"),
    "utf8",
  ));
  const shared = manifest.diagrams.filter(({ scope }) => scope === "shared");
  assert.deepEqual(shared.map(({ id }) => id).sort(), [
    "app-cli-install-flow",
    "canonical-artifact-lifecycle",
    "document-export-flow",
    "image-asset-lifecycle",
    "image-generation-mode-routing",
    "plugin-selection-flow",
  ]);
  for (const diagram of shared) {
    assert.ok(diagram.alt);
    assert.ok(diagram.sources.length > 0);
    assert.ok(diagram.usedBy.length > 0);
  }
});
~~~

- [ ] **Step 2: Run the diagram test and confirm the manifest is absent**

Run:

~~~bash
node --test tests/contracts/user-guide-shared-diagrams.test.mjs
~~~

Expected: FAIL with missing `diagram-manifest.json`.

- [ ] **Step 3: Read the Skillstead authoring contracts before drawing**

Read completely:

~~~text
shared/vendor/skillstead/svg-infographic/0.8.3/SKILL.md
shared/vendor/skillstead/svg-infographic/0.8.3/references/archetypes.md
shared/vendor/skillstead/svg-infographic/0.8.3/references/authoring.md
~~~

Choose archetypes:

| Diagram | Archetype |
| --- | --- |
| plugin selection | decision cards |
| App·CLI install | two-lane flow |
| Canonical lifecycle | approval flow |
| image mode routing | decision flow |
| image asset lifecycle | staged flow |
| document export | branching flow |

- [ ] **Step 4: Author six original Korean SVGs and the first manifest entries**

Each SVG must use actual plugin, mode and status names; one nonempty root `<title>` and `<desc>`; Korean-safe font stack; explicit reading order; no unsupported statistics; and source mapping in the manifest.

The manifest uses paths relative to `guides/assets/diagram-manifest.json`. `usedBy` initially points at existing installation, workflow, image and export guides.

- [ ] **Step 5: Lint and render through the Studio product-owned wrapper**

Run lint for all six SVG paths:

~~~bash
node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs lint guides/assets/shared/plugin-selection-flow.svg guides/assets/shared/app-cli-install-flow.svg guides/assets/shared/canonical-artifact-lifecycle.svg guides/assets/shared/image-generation-mode-routing.svg guides/assets/shared/image-asset-lifecycle.svg guides/assets/shared/document-export-flow.svg
~~~

Render each pair with:

~~~bash
node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs render guides/assets/shared/plugin-selection-flow.svg guides/assets/shared/plugin-selection-flow.png
~~~

Render all six exact pairs:

~~~bash
for id in plugin-selection-flow app-cli-install-flow canonical-artifact-lifecycle image-generation-mode-routing image-asset-lifecycle document-export-flow
do
  node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs render "guides/assets/shared/$id.svg" "guides/assets/shared/$id.png"
done
~~~

Expected: every command exits 0, identifies a Chromium renderer and reports exact 2× dimensions.

- [ ] **Step 6: Perform and record two-pass visual QA**

Inspect every PNG once at fit-to-page and once at original detail. Record renderer path·version, SVG viewBox, PNG dimensions, Korean glyph, overflow, containment, connector, contrast, reading order and source-fidelity result in `guides/assets/VISUAL-QA.md`. If any check fails, edit SVG, lint again, render again and re-inspect.

- [ ] **Step 7: Run shared diagram contract tests**

Run:

~~~bash
node --test tests/contracts/user-guide-shared-diagrams.test.mjs
node tooling/validate-user-guides.mjs
git diff --check
~~~

Expected: shared diagram test PASS; validator accepts a partial 6-entry manifest when `--complete` is absent.

- [ ] **Step 8: Commit shared diagrams**

~~~bash
git add guides/assets tests/contracts/user-guide-shared-diagrams.test.mjs
git commit -m "docs(diagrams): add shared plugin workflow visuals"
~~~

---

### Task 6: Studio recipe 6개와 Studio diagram 6개를 제작한다

**Files:**
- Create: `guides/game-design-studio/recipes/new-game-gdd.md`
- Create: `guides/game-design-studio/recipes/system-feature-spec.md`
- Create: `guides/game-design-studio/recipes/content-quest-design.md`
- Create: `guides/game-design-studio/recipes/ux-accessibility.md`
- Create: `guides/game-design-studio/recipes/economy-liveops.md`
- Create: `guides/game-design-studio/recipes/production-review-export.md`
- Create: `guides/assets/game-design-studio/studio-orchestration-map.{svg,png}`
- Create: `guides/assets/game-design-studio/vision-to-gdd-approval.{svg,png}`
- Create: `guides/assets/game-design-studio/system-rule-state-exception-flow.{svg,png}`
- Create: `guides/assets/game-design-studio/content-narrative-quest-map.{svg,png}`
- Create: `guides/assets/game-design-studio/economy-balance-liveops-loop.{svg,png}`
- Create: `guides/assets/game-design-studio/production-risk-review-flow.{svg,png}`
- Modify: `guides/assets/diagram-manifest.json`
- Modify: `guides/assets/VISUAL-QA.md`
- Modify: `guides/game-design-studio/README.md`
- Create: `tests/contracts/user-guide-studio-diagrams.test.mjs`

**Interfaces:**
- Consumes: Studio skill and template guides from Task 3 plus manifest schema from Task 5.
- Produces: six end-to-end routes linked from Studio index and root README.

- [ ] **Step 1: Write the failing Studio recipe and diagram test**

Require the six recipe IDs and six diagram IDs. For each recipe assert headings:

~~~js
const recipeHeadings = [
  "완료 목표",
  "준비할 입력",
  "복사 가능한 요청문",
  "단계별 진행",
  "사람이 결정할 지점",
  "예상 결과",
  "실패와 재개",
  "관련 기능",
];
~~~

Require exactly one primary diagram image link in each recipe and verify it points to the matching manifest ID.

- [ ] **Step 2: Run the test and confirm recipe files are absent**

Run:

~~~bash
node --test tests/contracts/user-guide-studio-diagrams.test.mjs
~~~

Expected: FAIL with missing recipe or diagram.

- [ ] **Step 3: Write six complete Studio recipes**

Use these exact flow bindings:

| Recipe | Primary diagram | Main skills |
| --- | --- | --- |
| new game GDD | vision-to-gdd-approval | orchestrate, quality, vision, review |
| system feature | system-rule-state-exception-flow | systems, player experience, review |
| content quest | content-narrative-quest-map | content, systems, production |
| UX accessibility | studio-orchestration-map | player experience, quality, review |
| economy LiveOps | economy-balance-liveops-loop | economy, systems, production |
| production review export | production-risk-review-flow | production, review, image, visualize, export |

Each recipe includes natural App text, explicit CLI skill invocation, expected Canonical Artifact path family, relevant template, image mode branch, human approval and renderer fallback.

- [ ] **Step 4: Author, lint and render six Studio SVG·PNG pairs**

Read the relevant Skillstead archetype before each layout. Use actual status and skill IDs, then lint all six with the Studio wrapper. Render the six exact pairs:

~~~bash
for id in studio-orchestration-map vision-to-gdd-approval system-rule-state-exception-flow content-narrative-quest-map economy-balance-liveops-loop production-risk-review-flow
do
  node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs render "guides/assets/game-design-studio/$id.svg" "guides/assets/game-design-studio/$id.png"
done
~~~

- [ ] **Step 5: Inspect pixels and append immutable QA rows**

Perform fit-to-page and close-up inspection for each Studio PNG. Append six rows to `VISUAL-QA.md` without rewriting shared results. Add six entries to the manifest with source paths and recipe `usedBy` paths.

- [ ] **Step 6: Link recipes and diagrams from Studio guide pages**

Update Studio index, workflow, skills and topical guides only where the diagram clarifies an existing relationship. Reuse shared diagrams for image and export flows instead of redrawing them.

- [ ] **Step 7: Run Studio diagram and guide tests**

Run:

~~~bash
node --test tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs
node tooling/validate-user-guides.mjs
git diff --check
~~~

Expected: all Studio guide and diagram tests PASS.

- [ ] **Step 8: Commit Studio recipes and visuals**

~~~bash
git add guides/game-design-studio guides/assets tests/contracts/user-guide-studio-diagrams.test.mjs
git commit -m "docs(studio): add end-to-end recipes and diagrams"
~~~

---

### Task 7: Career recipe 6개와 Career diagram 6개를 제작한다

**Files:**
- Create: `guides/game-design-career/recipes/role-learning-roadmap.md`
- Create: `guides/game-design-career/recipes/job-research-gap.md`
- Create: `guides/game-design-career/recipes/reverse-design.md`
- Create: `guides/game-design-career/recipes/portfolio-build-review.md`
- Create: `guides/game-design-career/recipes/interview-preparation.md`
- Create: `guides/game-design-career/recipes/junior-growth-transition.md`
- Create: `guides/assets/game-design-career/career-stage-routing.{svg,png}`
- Create: `guides/assets/game-design-career/role-gap-learning-roadmap.{svg,png}`
- Create: `guides/assets/game-design-career/job-research-evidence-flow.{svg,png}`
- Create: `guides/assets/game-design-career/reverse-design-portfolio-flow.{svg,png}`
- Create: `guides/assets/game-design-career/portfolio-review-loop.{svg,png}`
- Create: `guides/assets/game-design-career/interview-growth-transition-flow.{svg,png}`
- Modify: `guides/assets/diagram-manifest.json`
- Modify: `guides/assets/VISUAL-QA.md`
- Modify: `guides/game-design-career/README.md`
- Create: `tests/contracts/user-guide-career-diagrams.test.mjs`

**Interfaces:**
- Consumes: Career reference guides from Task 4 and manifest schema from Task 5.
- Produces: six Career end-to-end routes and completes the 18-entry diagram inventory.

- [ ] **Step 1: Write the failing Career recipe and diagram test**

Require these headings in every Career recipe:

~~~js
const recipeHeadings = [
  "완료 목표",
  "준비할 입력",
  "복사 가능한 요청문",
  "단계별 진행",
  "사람이 결정할 지점",
  "예상 결과",
  "실패와 재개",
  "관련 기능",
];
~~~

Assert the six exact Career recipe and diagram IDs, one primary diagram per recipe, current-evidence boundaries and no hiring guarantee language.

- [ ] **Step 2: Run the test and confirm Career assets are absent**

Run:

~~~bash
node --test tests/contracts/user-guide-career-diagrams.test.mjs
~~~

Expected: FAIL with missing Career recipe or diagram.

- [ ] **Step 3: Write six complete Career recipes**

Use:

| Recipe | Primary diagram | Main skills |
| --- | --- | --- |
| role and learning roadmap | role-gap-learning-roadmap | orchestrate, map, quality |
| job research gap | job-research-evidence-flow | research jobs, map, portfolio |
| reverse design | reverse-design-portfolio-flow | reverse engineer, visualize, export |
| portfolio build review | portfolio-review-loop | build portfolio, review portfolio, image |
| interview preparation | interview-growth-transition-flow | interview, job research, portfolio review |
| junior growth transition | career-stage-routing | junior growth, map, review, export |

Each recipe distinguishes observed fact, inference and proposal; records source date, region and sample boundary where current data is used; and provides privacy-safe prompts.

- [ ] **Step 4: Author, lint and render six Career SVG·PNG pairs**

Use the Career product-owned wrapper:

~~~bash
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint guides/assets/game-design-career/career-stage-routing.svg guides/assets/game-design-career/role-gap-learning-roadmap.svg guides/assets/game-design-career/job-research-evidence-flow.svg guides/assets/game-design-career/reverse-design-portfolio-flow.svg guides/assets/game-design-career/portfolio-review-loop.svg guides/assets/game-design-career/interview-growth-transition-flow.svg
~~~

Render each exact SVG·PNG pair:

~~~bash
for id in career-stage-routing role-gap-learning-roadmap job-research-evidence-flow reverse-design-portfolio-flow portfolio-review-loop interview-growth-transition-flow
do
  node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs render "guides/assets/game-design-career/$id.svg" "guides/assets/game-design-career/$id.png"
done
~~~

- [ ] **Step 5: Complete visual QA and the 18-entry manifest**

Inspect each Career PNG at fit and original detail. Append six QA rows. The manifest must now contain 6 shared, 6 Studio and 6 Career entries with unique IDs.

- [ ] **Step 6: Link recipes and diagrams from Career guides**

Reuse shared diagrams for image and export flows. Add product diagrams only to the related Career workflow, skill and recipe sections.

- [ ] **Step 7: Run complete diagram and Career guide validation**

Run:

~~~bash
node --test tests/contracts/user-guides-career.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs
npm run validate:guides
git diff --check
~~~

Expected: Career tests PASS; complete validator reports 30 skill guides, 30 templates and 18 diagrams.

- [ ] **Step 8: Commit Career recipes and visuals**

~~~bash
git add guides/game-design-career guides/assets tests/contracts/user-guide-career-diagrams.test.mjs
git commit -m "docs(career): add end-to-end recipes and diagrams"
~~~

---

### Task 8: Root README를 beginner landing page로 재구성하고 모든 navigation을 연결한다

**Files:**
- Modify: `README.md`
- Modify: `guides/README.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `guides/game-design-studio/workflow.md`
- Modify: `guides/game-design-studio/image-assets.md`
- Modify: `guides/game-design-studio/visualization.md`
- Modify: `guides/game-design-studio/exports.md`
- Modify: `guides/game-design-career/README.md`
- Modify: `guides/game-design-career/workflow.md`
- Modify: `guides/game-design-career/image-assets.md`
- Modify: `guides/game-design-career/visualization.md`
- Modify: `guides/game-design-career/exports.md`
- Create: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: all completed guides and diagram manifest.
- Produces: one discoverable entry point with no broken local links.

- [ ] **Step 1: Write the failing root README contract**

~~~js
test("root README is a beginner landing page for both plugins", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  for (const heading of [
    "어떤 플러그인을 설치할까",
    "지원 환경",
    "Codex App 설치",
    "Codex CLI 설치",
    "5분 빠른 시작",
    "기획 문서 템플릿",
    "이미지와 도식화",
    "문서 내보내기",
    "상세 사용 가이드",
    "문제 해결",
  ]) {
    assert.match(readme, new RegExp("^## " + heading + "$", "m"));
  }
  assert.match(readme, /guides\/game-design-studio\/README\.md/);
  assert.match(readme, /guides\/game-design-career\/README\.md/);
  assert.match(readme, /Codex App/);
  assert.match(readme, /Codex CLI/);
  assert.match(readme, /제품 스킬 14개.*Skillstead.*15개/s);
});
~~~

- [ ] **Step 2: Run the test against the technical root README**

Run:

~~~bash
node --test tests/contracts/root-readme-user-guides.test.mjs
~~~

Expected: FAIL because the current root README does not have the approved beginner heading structure.

- [ ] **Step 3: Rewrite root README around user outcomes**

Keep the following sequence:

1. suite introduction and non-guarantee;
2. product selection table;
3. supported surfaces and requirements;
4. App install;
5. CLI install;
6. installation verification and new chat·session;
7. Studio and Career first prompts;
8. quality, Canonical Artifact, image and Skillstead overview;
9. Studio and Career template summaries with detailed catalog links;
10. MD·PDF·DOCX·PPTX overview;
11. detailed guide cards;
12. limitations, privacy, rights and human approval;
13. troubleshooting;
14. technical architecture, contribution and license links.

Embed `plugin-selection-flow.png` and at most two additional shared diagrams. Link every PNG to its editable SVG.

Move low-level file trees, script inventories and release commands out of the beginner reading path by linking the existing technical product READMEs and `architecture/` documents. Do not delete those technical sources.

- [ ] **Step 4: Complete product and global navigation**

Update all three guide indexes so every skill, template, topical guide and recipe is reachable. Add previous·next links only when they do not create duplicate navigation noise. Run the validator to catch every missing local file and anchor.

- [ ] **Step 5: Run root and complete guide tests**

Run:

~~~bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
npm run test:contracts
git diff --check
~~~

Expected: root contract, complete guide validator and all contract tests PASS.

- [ ] **Step 6: Commit the landing page and navigation**

~~~bash
git add README.md guides tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: add complete beginner plugin documentation"
~~~

---

### Task 9: 전체 검증, 독립 review와 문서 정확성 수정을 완료한다

**Files:**
- Modify after evidence-backed review findings: `README.md`
- Modify after evidence-backed review findings: `guides/**/*.md`
- Modify after evidence-backed review findings: `guides/assets/diagram-manifest.json`
- Modify after evidence-backed review findings: `tooling/lib/user-guides.mjs`
- Modify after evidence-backed review findings: `tooling/validate-user-guides.mjs`
- Modify after evidence-backed review findings: `tests/unit/user-guides.test.mjs`
- Modify after evidence-backed review findings: `tests/contracts/user-guide*.test.mjs`

**Interfaces:**
- Consumes: every prior task.
- Produces: clean branch with evidence that docs, diagrams, packages and existing behavior pass.

- [ ] **Step 1: Run the focused user-guide suite**

Run:

~~~bash
node --test tests/unit/user-guides.test.mjs tests/unit/validate-packages.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/contracts/user-guide-shared-diagrams.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
~~~

Expected: all focused tests PASS and counts equal 30 skill guides, 30 templates, 18 SVG and 18 PNG.

- [ ] **Step 2: Re-run Skillstead lint and inspect the final PNG set**

Run each scope through its product-owned wrapper:

~~~bash
node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs lint guides/assets/shared/*.svg guides/assets/game-design-studio/*.svg
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint guides/assets/game-design-career/*.svg
~~~

Confirm `VISUAL-QA.md` has exactly 18 diagram rows and no failed or unavailable result.

- [ ] **Step 3: Run build, full tests and release validation**

Run sequentially:

~~~bash
npm run build -- --check
npm run test:unit
npm run test:contracts
npm run test:products
npm run test:formats
npm test
npm run validate:release
npm run smoke:marketplace
~~~

Expected: every command exits 0. `validate:release` must show two official plugin validators and 30 skill validators.

- [ ] **Step 4: Run separate writer and reviewer passes**

Writer pass checks Korean clarity, beginner sequencing, command explanations, copyable prompts and unnecessary repetition. Reviewer pass independently checks:

- official App·CLI facts;
- exact skill and template inventory;
- image provider and approval policy;
- Skillstead scope, license and QA evidence;
- export fail-closed behavior;
- privacy, rights and non-guarantee language;
- broken links, unsupported claims and stale version statements.

Use `superpowers:requesting-code-review` for the independent final review. Apply only evidence-backed corrections.

- [ ] **Step 5: Re-run affected focused tests after review fixes**

Run the exact failing focused command first, then:

~~~bash
npm run validate:guides
npm run build -- --check
npm test
git diff --check
~~~

Expected: PASS with no unresolved review issue.

- [ ] **Step 6: Commit review corrections if any**

~~~bash
git add README.md guides tooling package.json tests
git commit -m "docs: finalize verified plugin user guides"
~~~

If review produced no changes, do not create an empty commit.

- [ ] **Step 7: Verify final branch state**

Run:

~~~bash
git status --short --branch
git log -10 --oneline --decorate
~~~

Expected: branch `codex/game-design-plugins` is clean and the documentation commits are visible. Stop before merge, push or release.
