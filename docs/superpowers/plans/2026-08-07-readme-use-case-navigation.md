# README Use-Case Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트·제품·사용자 가이드 README에서 목표별 사용 예시, 예상 결과물과 상세 가이드 경로를 일관되게 안내하고 완료된 Career 사례를 오래된 `deferred` 상태로 표시하는 불일치를 제거한다.

**Architecture:** README는 선택과 routing만 담당하고, 전체 사례·스킬 계약·FAQ는 기존 `guides/` 문서가 계속 소유한다. 제품 README는 `products/*/plugin/README.md`만 편집하고 `npm run build`로 `plugins/*/README.md`를 재생성한다. 기존 계약 테스트를 먼저 강화해 사용자-facing README의 완료 상태와 탐색 경로를 고정한다.

**Tech Stack:** Markdown, Node.js 18+, `node:test`, 저장소 Markdown visibility/link parser, suite snapshot build, guide validators

## Global Constraints

- 브라우저나 인터랙티브 사이트를 사용하지 않고 Markdown 텍스트만 편집한다.
- 36개 복합 사례와 30개 직접 스킬 사례의 전체 본문을 README에 복제하지 않는다.
- 새로운 도식, 외부 의존성, runtime 스킬, 에이전트, hook, script 또는 템플릿 동작을 추가하지 않는다.
- 제품 배포 패키지에 저장소의 `guides/`를 포함하지 않는다.
- 제품 README는 `products/*/plugin/README.md` 원본만 직접 편집하며 `plugins/*/README.md`는 빌드 결과로만 갱신한다.
- 템플릿 `assets/README.md`, `decisions/README.md`, shared 계약 README와 vendored Skillstead README는 수정하지 않는다.
- 최소 결과, 선택 결과, 확장 결과와 이름 있는 사람의 승인 경계를 구분한다.
- 기존 미추적 `package-lock.json`은 수정하거나 커밋하지 않는다.

## File Structure

### 직접 편집

- `README.md`: 스위트 전체의 목표별·규모별·결과물별 시작 허브
- `guides/README.md`: 공통 가이드 탐색 인덱스
- `guides/use-cases/README.md`: 사용자 경로·FAQ·결과물 허브
- `guides/game-design-studio/README.md`: Studio 대표 사례·결과·상세 문서 진입점
- `guides/game-design-career/README.md`: Career 대표 사례·결과·상세 문서 진입점
- `guides/game-design-studio/use-cases/README.md`: Studio 사례 인덱스의 routing 일관성
- `guides/game-design-career/use-cases/README.md`: 완료된 대상 사례와 스킬 워크벤치의 현재 링크
- `products/game-design-studio/plugin/README.md`: 배포 Studio README 원본
- `products/game-design-career/plugin/README.md`: 배포 Career README 원본

### 계약 테스트

- `tests/contracts/root-readme-user-guides.test.mjs`: 루트·공통·제품 가이드 README의 목표·결과·상세 문서 연결
- `tests/contracts/user-guide-use-case-manifest.test.mjs`: Career 대상 사례 10개와 스킬 워크벤치의 완료된 링크 상태
- `tests/products/studio/readme.test.mjs`: 배포 Studio README의 대표 목표·결과·guide 경로
- `tests/products/career/readme.test.mjs`: 배포 Career README의 대표 목표·결과·guide 경로

### 빌드 생성물

- `plugins/game-design-studio/README.md`: Studio product source에서 재생성
- `plugins/game-design-career/README.md`: Career product source에서 재생성

---

### Task 1: Career 활용 사례 인덱스의 완료 상태 복구

**Files:**
- Modify: `tests/contracts/user-guide-use-case-manifest.test.mjs:1599-1620`
- Modify: `guides/game-design-career/use-cases/README.md:5-52`

**Interfaces:**
- Consumes: use-case manifest의 `CA-C01..08`, `CA-T01..10` document·anchor와 현재 `concept-scenarios.md`, `skill-workbench.md`
- Produces: 역량 8개·대상 10개·직접 스킬 워크벤치가 모두 실제 Markdown 링크인 Career 사례 인덱스

- [ ] **Step 1: 완료된 Career 링크를 요구하는 실패 계약 작성**

`assertCareerIndexRouteStrings()`에서 deferred section 계약을 제거하고 다음 계약으로 바꾼다.

```js
const targetSection = sectionByHeading(index, 2, "대상별 사례");
const targetLinks = extractMarkdownLinks(targetSection).map(({ target }) => target);
for (const entry of allCareerCases.filter((entry) => entry.view === "target")) {
  const target = `${entry.document.split("/").pop()}#${entry.anchor}`;
  assert.ok(targetLinks.includes(target), `${entry.id} current Markdown link`);
}
for (const target of ["skill-workbench.md", "../../use-cases/README.md#공통-faq", "../../use-cases/output-catalog.md"]) {
  assert.ok(links.includes(target), `Career index actual shared link: ${target}`);
}
assert.doesNotMatch(index, /Task [345]|deferred|본문을 추가할 예정|아직 작성되지 않았/u);
```

- [ ] **Step 2: 변경된 계약이 현재 문서에서 실패하는지 확인**

Run: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs`

Expected: FAIL. `대상별 사례` heading 또는 `CA-T01 current Markdown link`가 없고 오래된 상태 문구가 검출된다.

- [ ] **Step 3: Career 사례 인덱스를 현재 상태로 갱신**

- 선택 표의 대상은 `[대상 사례 10개](concept-scenarios.md)`, 직접 스킬은 `[스킬 워크벤치](skill-workbench.md)`로 연결한다.
- `## 대상별 사례`에 `CA-T01..CA-T10`의 실제 anchor 링크를 나열한다.
- `Task 4`, `Task 5`, `deferred` 문장을 삭제한다.
- `## 직접 스킬`에서 워크벤치와 스킬 레퍼런스의 책임 차이를 설명한다.
- 공통 FAQ와 결과물 카탈로그 링크를 보존한다.

- [ ] **Step 4: Career 사례 인덱스 계약 검증**

Run: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs`

Expected: PASS.

- [ ] **Step 5: Task 1 커밋**

```bash
git add tests/contracts/user-guide-use-case-manifest.test.mjs guides/game-design-career/use-cases/README.md
git commit -m "docs: publish completed Career use-case routes"
```

### Task 2: 루트와 사용자 가이드 README를 목표·결과 중심으로 연결

**Files:**
- Modify: `tests/contracts/root-readme-user-guides.test.mjs:16-49,236-282,520-558`
- Modify: `README.md:7-44,116-205`
- Modify: `guides/README.md:20-61`
- Modify: `guides/use-cases/README.md:5-30,140-145`
- Modify: `guides/game-design-studio/README.md:5-55`
- Modify: `guides/game-design-career/README.md:5-71`
- Modify if contract requires a missing route: `guides/game-design-studio/use-cases/README.md:5-67`

**Interfaces:**
- Consumes: use-case manifest, output catalog, 제품별 competency·concept·skill-workbench·FAQ
- Produces: 루트에서 세 번 이내 이동으로 대표 사례 또는 직접 스킬 사용법에 도달하는 탐색 경로

- [ ] **Step 1: README 탐색 계약을 목표·규모·결과 층위로 확장**

`assertRootUseCaseNavigation()`에 다음 요구를 추가한다.

```js
for (const heading of ["목표별 바로 시작", "작업 규모별 사용 예시", "요청하면 얻는 결과"]) {
  assert.ok(markdown.includes(`### ${heading}`), `root navigation subsection: ${heading}`);
}
for (const phrase of ["10분 실습", "단일 과제", "포트폴리오 프로젝트", "전체 프로젝트"]) {
  assert.ok(markdown.includes(phrase), `root work scale: ${phrase}`);
}
for (const phrase of ["최소 결과", "선택 결과", "확장 결과", "사람 검토"]) {
  assert.ok(markdown.includes(phrase), `root output layer: ${phrase}`);
}
```

초보자 읽기 경로 테스트에는 공통·제품 README가 `use-cases/README.md`, `output-catalog.md`, 제품별 `skill-workbench.md`, `faq.md`를 안내하는지 추가한다. 기존 H2 순서와 설치·초보자 reading order는 유지한다.

- [ ] **Step 2: 강화된 계약이 현재 문서에서 실패하는지 확인**

Run: `node --test tests/contracts/root-readme-user-guides.test.mjs`

Expected: FAIL. 루트의 세 신규 H3 또는 작업 규모·결과 층위가 아직 없다.

- [ ] **Step 3: 루트 README를 종합 허브로 보강**

기존 H2 순서를 변경하지 않고 `## 활용 방법 선택` 내부에 다음 H3를 추가한다.

- `목표별 바로 시작`: 학습, 규칙·루프·시스템·UX, 전체 GDD, 역기획, 포트폴리오·면접, 현업 검토
- `작업 규모별 사용 예시`: 10분 실습, 단일 과제, 포트폴리오 프로젝트, 전체 프로젝트의 준비 입력·권장 시작·핵심 결과
- `요청하면 얻는 결과`: 최소 결과, 선택 결과, 확장 결과와 사람 검토 경계

기존 네 대표 요청문과 manifest 기반 대표 링크 순서는 보존한다. `상세 사용 가이드` 표에는 사용자 경로, 결과물 카탈로그, 제품별 역량·콘셉트·스킬 워크벤치·FAQ를 연결한다.

- [ ] **Step 4: 공통·제품 사용자 가이드 인덱스 정돈**

- `guides/README.md`: 목표 → 대표 문서 → 예상 결과 → 다음 상세 문서 표를 추가한다.
- `guides/use-cases/README.md`: 사용자 경로 → 제품 사례 → 스킬 워크벤치 → 결과물 카탈로그 → FAQ 순서를 명시한다.
- `guides/game-design-studio/README.md`: 작은 실습·단일 명세·전체 프로젝트와 결과물 카탈로그 관계를 명확히 한다.
- `guides/game-design-career/README.md`: 직무 탐색·역기획·포트폴리오·면접·성장 목표별 결과와 상세 문서를 연결한다.
- `guides/game-design-studio/use-cases/README.md`: 누락된 route가 검출될 때만 보강하고 사례 본문은 복제하지 않는다.

- [ ] **Step 5: 공통 README 계약과 validator 검증**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
npm run validate:guides
```

Expected: 둘 다 PASS.

- [ ] **Step 6: Task 2 커밋**

```bash
git add README.md guides/README.md guides/use-cases/README.md guides/game-design-studio/README.md guides/game-design-career/README.md tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: route README users by goals and outputs"
```

`guides/game-design-studio/use-cases/README.md`가 실제로 변경되면 같은 커밋에 추가한다.

### Task 3: 배포 제품 README의 대표 활용과 결과 보강

**Files:**
- Modify: `tests/products/studio/readme.test.mjs:160-205,250-330`
- Modify: `tests/products/career/readme.test.mjs:100-250,330-390`
- Modify: `products/game-design-studio/plugin/README.md:347-411`
- Modify: `products/game-design-career/plugin/README.md:7-22,350-390`
- Generate: `plugins/game-design-studio/README.md`
- Generate: `plugins/game-design-career/README.md`

**Interfaces:**
- Consumes: 제품별 skill·template inventory, routing 계약, repository-checkout-only guide 경로
- Produces: 설치 패키지 안에서 이해 가능한 대표 요청·예상 Artifact와 저장소 상세 가이드 경로

- [ ] **Step 1: 제품 README 결과·가이드 계약을 먼저 강화**

Studio 테스트는 `활용 경로와 결과`에서 여섯 목표와 결과를 요구한다.

```js
const studioGoalOutputs = new Map([
  ["규칙·핵심 루프", ["game-design-brief", "vision-pillars"]],
  ["시스템", ["system-specification"]],
  ["UX·접근성", ["ui-ux-flow-state"]],
  ["콘텐츠·퀘스트", ["narrative-quest-npc"]],
  ["경제·LiveOps", ["economy-balance"]],
  ["전체 프로젝트", ["production-scope-risk", "export-manifest.yml"]],
]);
```

Career 테스트는 목표 요약에서 여섯 목표와 결과를 요구한다.

```js
const careerGoalOutputs = new Map([
  ["직무 탐색·학습", ["game-design-role-map", "learning-roadmap"]],
  ["역기획", ["reverse-design-document"]],
  ["창작 포트폴리오", ["creative-design-portfolio"]],
  ["포트폴리오 검토", ["five-axis-review"]],
  ["면접", ["interview-question-answer-log"]],
  ["성장·전환", ["junior-growth-review", "transition-readiness"]],
]);
```

두 제품 모두 6개 repository-checkout-only guide path를 일반 코드 경로로 제공하고 `../guides/` 상대 링크로 가장하지 않는지 검증한다.

- [ ] **Step 2: 강화된 제품 테스트가 현재 문서에서 실패하는지 확인**

Run: `node --test tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs`

Expected: FAIL. 목표별 결과 요약 또는 Career의 checkout-only guide 표가 부족하다.

- [ ] **Step 3: Studio 제품 source README 보강**

`활용 경로와 결과`에 여섯 목표의 대표 요청, 최소 Artifact와 선택·확장 결과를 요약한다. 기존 대표 요청 표와 읽는 순서를 재사용하고 6개 repository-checkout-only code path를 유지한다.

- [ ] **Step 4: Career 제품 source README 보강**

`활용 시작점`에 목표별 대표 결과 요약을 추가하고 `사용 예시` 뒤에 다음 code path 표를 추가한다.

```text
guides/game-design-career/use-cases/README.md
guides/game-design-career/use-cases/competency-paths.md
guides/game-design-career/use-cases/concept-scenarios.md
guides/game-design-career/use-cases/skill-workbench.md
guides/game-design-career/faq.md
guides/use-cases/output-catalog.md
```

- [ ] **Step 5: 제품 테스트와 snapshot 재생성 검증**

```bash
node --test tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs
npm run build
cmp products/game-design-studio/plugin/README.md plugins/game-design-studio/README.md
cmp products/game-design-career/plugin/README.md plugins/game-design-career/README.md
```

Expected: 테스트와 build PASS, 두 `cmp` exit 0.

- [ ] **Step 6: Task 3 커밋**

```bash
git add tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md plugins/game-design-studio plugins/game-design-career
git commit -m "docs: expand packaged plugin use-case guidance"
```

### Task 4: 전체 문서·빌드·회귀 검증

**Files:**
- Verify: Task 1~3의 모든 변경 파일
- Preserve: `package-lock.json`

**Interfaces:**
- Consumes: README·테스트·generated snapshots
- Produces: 링크, guide count, package snapshot과 전체 테스트가 일치하는 완료 증거

- [ ] **Step 1: 오래된 상태 문구와 Markdown 형식 검사**

```bash
! rg -n 'Task [345].*(deferred|예정)|deferred.*Task [345]|본문을 추가할 예정|아직 작성되지 않았' README.md guides products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md
git diff --check
```

Expected: 검색 0건, diff check 출력 없음.

- [ ] **Step 2: 가이드와 도식 검증**

```bash
npm run validate:guides
npm run check:guide-diagrams
```

Expected: guides 79, skillGuides 30, templates 30, SVG 90, PNG 90, audiencePaths 6, useCases 36, skillCases 30, FAQ 48; guide diagrams 72 SVG와 72 PNG PASS.

- [ ] **Step 3: 제품 snapshot 결정성 검증**

```bash
npm run build
npm run build
cmp products/game-design-studio/plugin/README.md plugins/game-design-studio/README.md
cmp products/game-design-career/plugin/README.md plugins/game-design-career/README.md
```

Expected: 두 build가 같은 file count와 SHA-256을 출력하고 두 `cmp`가 exit 0.

- [ ] **Step 4: 전체 검증과 테스트 실행**

```bash
npm run validate
npm test
```

Expected: release readiness `COMPLETE`, 전체 테스트 fail 0.

- [ ] **Step 5: 변경 범위와 기존 미추적 파일 보존 확인**

```bash
shasum -a 256 package-lock.json
git status --short
git log -5 --oneline
```

Expected: `package-lock.json` SHA-256은 `fb94f141e42bee0329e7cfbad365d82f979c76a51dd77b908da0124931755242`이며 미추적 상태로만 남는다. README·계약 테스트·generated snapshots 이외의 예상하지 않은 변경이 없다.
