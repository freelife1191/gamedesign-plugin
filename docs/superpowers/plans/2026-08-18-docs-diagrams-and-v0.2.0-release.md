# 문서·도식·snapshot 재생성과 `0.2.0` 릴리스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 "문서와 도식"·"릴리스" 절이 요구하는 진입 경로 안내, 인계·설치·업데이트 도식, 대표 진입 스킬 도식을 착지시키고, 두 제품 버전을 `0.1.1`에서 `0.2.0`으로 올려 snapshot·BUILD-MANIFEST·업데이트 잠금까지 일치시킨 뒤 `v0.2.0` 태그를 발행할 수 있는 상태로 만든다.

**Architecture:** 문서 변경은 사람이 읽는 표면(루트 README, 제품 README, 설치·문제 해결 가이드, 대표 진입 스킬 가이드)에만 손대고, 계약 테스트가 그 표면을 고정한다. 도식은 두 종류로 갈라진다. 스킬 도식은 `guides/assets/use-case-diagram-sources.json`에 원본 JSON을 넣고 `tooling/build-use-case-diagrams.mjs`가 SVG를 생성하며 production contract가 의미를 고정한다. shared 도식은 손으로 쓴 SVG가 원본이고 Chromium 2× 렌더가 PNG를 만들며 `guides/assets/diagram-manifest.json`과 `guides/assets/VISUAL-QA.md`가 등록·검수 기록을 맡는다. 버전 인상은 `products/*/plugin/.codex-plugin/plugin.json`이 유일한 원천이고, `plugins/**` snapshot과 `BUILD-MANIFEST.json`, `shared/updates/installed-components.json`은 전부 생성물이므로 빌더로만 바꾼다.

**Tech Stack:** Node.js >= 18 (의존성 0), `node:test`, Google Chrome (도식 렌더), `git`.

**Spec:** `docs/superpowers/specs/2026-08-17-suite-entry-upgrade-and-windows-encoding-design.md` ("문서와 도식", "릴리스", 구현 순서 7단계)

## Global Constraints

스펙 A절 "금지 동작"과 앞선 계획들의 Global Constraints가 그대로 적용된다. 이 계획에서 특히 걸리는 항목:

- 무승인 자동 업데이트 금지. 문서에 자동 적용을 암시하는 문장을 쓰지 않는다.
- 설치 디렉터리, 설치된 플러그인 캐시, 번들 스킬 디렉터리를 직접 수정하지 않는다.
- `plugins/game-design-studio`와 `plugins/game-design-career`는 생성 snapshot이다. 손으로 고치지 않고 `npm run build`로만 바꾼다. `BUILD-MANIFEST.json`도 같다.
- `shared/updates/installed-components.json`은 `tooling/generate-update-manifest.mjs`의 출력이다. 손으로 고치지 않는다.
- 패키지 파일에 BOM, CRLF, invalid UTF-8, NFC·대소문자 충돌, 150자 초과 상대 경로가 있으면 안 된다 (`tooling/lib/tree-audit.mjs`가 강제).
- 도식은 SVG가 편집 가능한 원본이고 PNG는 후처리 없는 Chromium 2× 파생물이다. PNG를 손으로 만들지 않는다.
- 릴리스 검증은 `npm run validate:release`로 전 스테이지를 돌린다. `--skip`은 릴리스에서 거부된다.
- `shared/updates/suite-release.lock.json`의 `installedTag`는 두 제품 `plugin.json`의 버전과 `v` 접두사만 다르게 정확히 일치해야 한다. 어긋나면 `SUITE_VERSION_MISMATCH`로 검증이 멈춘다.
- 태그 푸시, PR 머지, GitHub Release 발행은 바깥으로 나가는 동작이다. 사용자가 명시로 지시하기 전에는 하지 않는다.

## 사전 확인된 사실

착수 전 실측한 내용이다. 계획의 범위 판단 근거이므로 남긴다.

- 루트 README의 스킬 표 3종(직접 스킬 빠른 참조, Studio 설치 스킬 26개, Career 설치 스킬 25개)에는 대표 진입 스킬 2개와 `upgrade-game-design-suite`가 이미 들어 있다. README 표 갱신은 남은 일이 아니다.
- `products/*/plugin/references/routing.json`의 `skillIds`와 `plannedPaths.skills`에도 세 스킬이 모두 들어 있다. routing 갱신은 남은 일이 아니다.
- `guides/prompt-templates/catalog/studio-entry.json`과 `career-entry.json`에 대표 진입 스킬 요청문 3단계(beginner·standard·advanced)가 이미 있다.
- 루트 README `## 5분 안에 첫 결과 만들기`는 이미 `@Game Design Studio`·`@Game Design Career` 대표 진입으로 시작한다. 스펙 "첫 요청" 항목은 충족돼 있다. 남은 것은 설치 절과 업데이트 절이다.
- 두 제품 `troubleshooting.md`는 이미 App 표면과 CLI 표면을 열로 구분하고 `$<product>:<skill>` 요청문을 싣는다. 스펙의 "문제 해결 가이드에서 App·CLI 구분"은 충족돼 있다. BOM 진단 행만 없다.
- `guides/game-design-studio/skills/game-design-studio.md`와 `guides/game-design-career/skills/game-design-career.md`가 이미 있고, 각각 `### 직접 호출 활용 — <skill-id>` 절을 가진다. 다만 그 절의 도식이 오케스트레이터 도식을 빌려 쓰고 있고("대표 진입은 이 흐름의 앞단"), 요청문이 CLI `$` 한 표면만 보여 준다.
- 두 대표 진입 스킬 가이드는 "이 스킬이 만드는 파일은 없습니다"라고 적는다(`game-design-studio.md:79`, `game-design-career.md:79`). 위임된 스킬의 Artifact를 읽고 `route-receipt.json`의 `routeId`만 채운다.
- `tests/contracts/user-guide-use-case-manifest.test.mjs:41-42`의 `DIRECT_USE_EXCLUDED_SKILL_IDS`는 `game-design-studio`, `game-design-career`, `upgrade-game-design-suite`를 직접 사용 사례에서 제외하며 그 근거를 주석으로 남긴다. 같은 파일 2683줄은 skill case 목록이 `routing.json`의 `skillIds` 순서와 정확히 같아야 한다고 요구한다.
- 스킬 도식의 출력 경로는 `guides/use-cases/use-case-manifest.json`의 `skill_cases`에서만 나온다(`tooling/build-use-case-diagrams.mjs:127`). 이 매니페스트에 항목이 없으면 빌더가 `expected exactly one explicit manifest output` 오류로 멈춘다.
- `guides/assets/diagram-manifest.json`은 어떤 빌더도 쓰지 않는다. 손으로 편집하고 `tooling/lib/user-guides.mjs:1342`와 `tooling/lib/use-case-guides.mjs:323`이 검증만 한다.
- 도식 개수는 다섯 곳에 상수로 박혀 있다. `tooling/lib/use-case-guides.mjs:21-30`의 `DIAGRAM_EXPECTED_SCOPE_COUNTS`(`shared: 8`), `tooling/lib/user-guides.mjs:1363`의 `20 + registered`, `tests/contracts/user-guide-shared-diagrams.test.mjs:10-19`의 `expectedSharedIds`와 같은 파일 39줄의 테스트 이름("eight"), `tests/contracts/user-guide-career-diagrams.test.mjs:539`의 `93`, `tests/contracts/user-guide-use-case-manifest.test.mjs:2033-2034`의 `svg: 93`·`png: 93`과 2058줄의 `shared: 8`이다.
- 스킬 도식은 Studio 16개(`st-s01`~`st-s16`), Career 15개(`ca-s01`~`ca-s15`)이며 대표 진입 스킬 2개의 도식은 없다.
- `guides/assets/diagram-manifest.json`에 shared 도식 8개가 있고 그중 `app-cli-install-flow`가 설치 도식이다. 인계 도식과 업데이트 승인 도식은 없다.
- 루트 README의 사례 카드 18개는 `guides/prompt-templates/catalog/*.json`의 `app_prompt.template`·`cli_prompt.template`에 문자열 단위로 묶여 있다(`tests/contracts/root-readme-user-guides.test.mjs`의 `assertPromptCard`).
- 사례 그룹 도입부 계약(`assertReadableCaseGroupIntroductions`)은 `startsWith`로 검사한다. 기존 두 문장을 그대로 두고 그 뒤에 문단을 더하는 것은 허용된다.
- 연계 사례의 실제 카탈로그 ID는 `suite:studio-to-career-handoff:case` 형태다. `SUITE-01` 같은 짧은 ID는 없다. Studio·Career 사례는 `ST-C01`·`CA-C01` 형태다.
- 대표 진입 스킬은 사례 ID를 실제로 해석한다. `products/*/plugin/skills/<entry>/SKILL.md`가 "case ID such as `ST-G04` is not a runtime skill ID … Look the ID up in the prompt template catalog"로 규정한다.
- 버전 문자열이 손으로 박혀 있는 곳은 `products/*/plugin/.codex-plugin/plugin.json` 2곳, `tooling/marketplace-smoke.mjs`의 `RELEASE_PLUGIN_VERSION`, `tooling/isolation-smoke.mjs`의 매니페스트 비교, `shared/updates/suite-release.lock.json`, 그리고 이 값들을 고정한 유닛·e2e 테스트다. `0.1.1`은 테스트 11개 파일에 나오지만 그중 상당수는 임의 fixture 값이라 옮길 필요가 없다. Task 6 Step 1의 grep이 실제 대상을 가른다.
- `shared/updates/installed-components.json`의 `commit` 필드는 40자 hex 형식만 검사받는다(`shared/scripts/check-game-design-updates.mjs:829`). 최신 판정은 `installedTag`로만 한다.

## 판단 기록

착수 전에 정한 것이다. 구현 중에 다시 논의하지 않는다.

- **대표 진입 스킬 도식은 shared scope 손그림 도식 한 장으로 만든다. `skill_cases`에는 넣지 않는다.** 스킬 도식 경로를 쓰려면 `use-case-manifest.json`의 `skill_cases`에 항목을 넣어야 하는데, 그 목록은 `DIRECT_USE_EXCLUDED_SKILL_IDS`가 대표 진입 스킬을 "자기 산출물을 만들지 않고 언제나 다른 스킬로 위임하므로 직접 사용 사례가 없다"는 이유로 이미 닫아 뒀다. 두 가이드 본문도 "이 스킬이 만드는 파일은 없습니다"라고 적는다. 스킬 도식 경로를 억지로 열면 `outputs`에 없는 산출물을 선언하게 되고, `skillIds` 순서 계약과 frozen 계약 배열 두 개를 함께 흔들어야 한다. 대신 두 제품이 함께 쓰는 `suite-entry-routing-flow` 한 장을 shared로 만들어 두 가이드에 싣는다. 스펙이 요구하는 "전용 도식"은 충족되고 직접 사용 사례 계약은 그대로 닫혀 있다.
- **`upgrade-game-design-suite`에는 스킬 도식도 prompt-template 카탈로그 엔트리도 만들지 않는다.** 이 스킬은 설계 산출물을 만들지 않고 설치 상태를 바꾼다. `DIRECT_USE_EXCLUDED_SKILL_IDS`가 같은 근거로 이미 제외했고, 같은 성격의 번들 스킬(`archify`, `humanize-korean`, 기억 스킬 3종, `maintain-game-design-glossary`)도 둘 다 갖고 있지 않다. 이 스킬의 흐름은 Task 4가 만드는 업데이트 승인 도식이 대신 담는다. 스펙의 "신규 스킬마다" 목록에서 이 두 항목만 의도적으로 비운다.
- **사례 카드 18개의 요청문 fence는 건드리지 않는다.** 스펙이 요구하는 "대표 진입 스킬이 catalog를 해석한다는 설명과 실제 CLI 호출"은 사례 그룹 도입부 3곳에 둔다. 같은 두 줄을 18번 복제하면 읽는 사람이 얻는 정보는 늘지 않고 계약 표면만 18배가 된다. 카드 fence는 `cli_prompt.template`에 문자열로 묶여 있어 한 줄만 넣어도 카탈로그 161개 엔트리와 생성 가이드가 함께 흔들린다.
- **`suite-release.lock.json`의 `commit`은 릴리스 내용이 확정된 마지막 커밋을 가리킨다.** 파일이 제 커밋 해시를 담을 수는 없다. `installedTag`만 최신 판정에 쓰이고 `commit`은 형식 검사만 받으므로, 태그가 붙을 커밋의 부모(= 이 계획의 내용 작업이 끝난 커밋)를 기록한다. 같은 파일의 다른 구성 요소는 `commit`이 태그가 가리키는 실제 커밋이므로 열의 뜻이 갈린다. 그 차이를 `architecture/plugin-suite.md`에 적는다.

## File Structure

| 파일 | 책임 | 상태 |
| --- | --- | --- |
| `README.md` | 설치·업데이트 진입 경로를 Git 마켓플레이스와 업그레이드 스킬 기준으로 안내. 사례 그룹 도입부에서 대표 진입 스킬의 사례 ID 해석을 설명 | 수정 |
| `guides/game-design-studio/installation.md`, `guides/game-design-career/installation.md` | Git 마켓플레이스를 1순위 설치·업데이트 경로로 제시, UTF-8 preflight, 업데이트 도식 삽입 | 수정 |
| `products/game-design-studio/plugin/README.md`, `products/game-design-career/plugin/README.md` | 설치 패키지 안에서 읽는 설치·업데이트 절을 같은 순서로 정렬 | 수정 |
| `guides/game-design-studio/skills/game-design-studio.md`, `guides/game-design-career/skills/game-design-career.md` | App `@`/CLI `$` 요청문 쌍, 대표 진입 도식으로 교체 | 수정 |
| `guides/assets/shared/suite-entry-routing-flow.svg`/`.png` | 대표 진입 라우팅 도식 | 생성 |
| `guides/assets/shared/suite-handoff-ownership-flow.svg`/`.png` | Studio ↔ Career 단방향 인계 도식 | 생성 |
| `guides/assets/shared/suite-update-approval-flow.svg`/`.png` | 업데이트 승인·재설치·검증·새 세션 도식 | 생성 |
| `guides/assets/shared/app-cli-install-flow.svg`/`.png` | 설치 도식에 UTF-8 preflight와 마켓플레이스 종류 추가 | 수정 |
| `guides/assets/diagram-manifest.json` | 새 shared 도식 3개 등록, `app-cli-install-flow`의 `alt` 갱신. 손으로 편집한다 | 수정 |
| `tooling/lib/use-case-guides.mjs` | `DIAGRAM_EXPECTED_SCOPE_COUNTS.shared` 8 → 11 | 수정 |
| `tooling/lib/user-guides.mjs` | `expectedDiagramTotal`의 고정 항 20 → 23 | 수정 |
| `tests/contracts/user-guide-shared-diagrams.test.mjs` | `expectedSharedIds` 3개 추가, 테스트 이름 갱신, 새 도식 3개의 의미 계약 | 수정 |
| `tests/contracts/user-guide-career-diagrams.test.mjs` | 전체 도식 수 93 → 96 | 수정 |
| `tests/contracts/user-guide-use-case-manifest.test.mjs` | `svg`·`png` 93 → 96, `shared` 8 → 11 | 수정 |
| `guides/assets/VISUAL-QA.md` | 새·변경 도식의 렌더 검수 기록 | 수정 |
| `shared/suite-handoff/references/` 인계 계약 문서 | 인계 도식 삽입 | 수정 |
| `products/*/plugin/.codex-plugin/plugin.json` | 버전 `0.2.0` | 수정 |
| `shared/updates/suite-release.lock.json` | `installedTag` `v0.2.0`, `commit` 갱신 | 수정 |
| `shared/updates/installed-components.json`, `plugins/**` | 생성물. 빌더로만 갱신 | 재생성 |
| `tooling/marketplace-smoke.mjs`, `tooling/isolation-smoke.mjs` | 릴리스 버전 상수 | 수정 |
| `tests/contracts/root-readme-user-guides.test.mjs` | 사례 그룹 도입부 계약 | 수정 |
| 버전 고정값을 가진 유닛·e2e 테스트 | Task 6 Step 1의 grep이 실제 대상을 가른다 | 수정 |
| `guides/archify-diagrams/catalog.json` | 새 소스가 필요하면 | 수정 |
| `architecture/plugin-suite.md` | 릴리스 절차, 도식 목록, `commit` 열의 뜻 | 수정 |

---

### Task 1: 루트 README의 설치·업데이트 경로를 Git 마켓플레이스와 업그레이드 스킬 기준으로 고친다

현재 README는 로컬 마켓플레이스(`codex plugin marketplace add .`)를 1순위로 안내한다. 스펙의 "확인된 사실"은 실사용 설치가 Git 마켓플레이스 경로였고 원격 릴리스 권위가 생겼다고 기록한다. 로컬 경로는 저장소를 직접 고치는 개발자용 대안으로 내린다. 업데이트 절은 `upgrade-game-design-suite`를 먼저 제시하고, 손으로 하는 제거·재설치를 그 아래 대안으로 남긴다.

**Files:**
- Modify: `README.md` (`## 설치하기`, `### Codex App에 설치하기`, `### Codex CLI에 설치하기`, `### 업데이트·재설치하기`)
- Test: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 없음. 이 태스크는 사람이 읽는 문장만 바꾼다.

- [ ] **Step 1: 지금 계약이 무엇을 고정하는지 읽는다**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs 2>&1 | tail -20
grep -n "설치하기\|marketplace add\|업데이트·재설치" tests/contracts/root-readme-user-guides.test.mjs
```

기대: 통과. grep 결과가 비어 있으면 설치 절 본문은 계약에 묶여 있지 않다는 뜻이고, 그렇다면 Step 5의 테스트 수정은 필요 없다.

- [ ] **Step 2: CLI 설치 절을 Git 마켓플레이스 우선으로 고친다**

`### Codex CLI에 설치하기`의 첫 코드 블록을 아래로 바꾸고, 기존 `codex plugin marketplace add .` 블록은 그 아래 "저장소를 직접 고치며 쓸 때" 문단으로 내린다.

```bash
codex plugin marketplace add freelife1191/gamedesign-plugin
codex plugin marketplace list
```

문장으로 덧붙일 내용: Git 마켓플레이스로 등록하면 공개 릴리스가 최신 판정 근거가 되고, `upgrade-game-design-suite`가 그 태그를 읽는다. 로컬 마켓플레이스는 Git fetch 대상이 아니므로 공개 릴리스로 갱신되지 않는다.

- [ ] **Step 3: App 설치 절에 마켓플레이스 종류를 구분해 적는다**

`### Codex App에 설치하기`의 2번 항목 아래에 한 문단을 넣는다. Git 마켓플레이스를 CLI로 먼저 등록해 두면 App의 Plugins Directory에서도 같은 `game-design-suite`가 보이고, 저장소 checkout을 그대로 쓰는 로컬 마켓플레이스와는 갱신 방법이 다르다는 사실을 적는다. App 화면 조작은 지금 절차를 유지한다.

- [ ] **Step 4: 업데이트 절의 순서를 뒤집는다**

`### 업데이트·재설치하기` 도입부 다음에 `#### 업그레이드 스킬로 처리하기`를 새로 넣고, 기존 `#### Codex App`·`#### Codex CLI` 수동 절차를 그 뒤로 옮긴다. 새 절에 들어갈 내용:

```text
$game-design-studio:upgrade-game-design-suite
$game-design-career:upgrade-game-design-suite
```

- 설치된 버전과 공개된 최신 릴리스를 비교한 결과를 먼저 보여 주고 승인을 기다린다.
- 검사와 계획 단계에서는 어떤 설치도 바꾸지 않는다.
- 승인 없이 적용되는 업데이트는 없다.
- 끝나면 이전 버전, 새 버전, 바뀐 제품, 번들 구성 요소 변화, 검증 결과를 요약하고 새 세션에서 이어가는 방법을 알려 준다.
- 자세한 선택지 표는 [Studio 설치 가이드](guides/game-design-studio/installation.md)와 [Career 설치 가이드](guides/game-design-career/installation.md)에 있다.

- [ ] **Step 5: 링크와 계약을 확인한다**

```bash
node tooling/index-references.mjs --check
node --test tests/contracts/root-readme-user-guides.test.mjs
```

기대: 두 명령 모두 통과. 실패하면 계약이 고정한 문구를 확인해 README 또는 테스트 기대값 중 진짜 원천 쪽을 고친다.

- [ ] **Step 6: 커밋**

```bash
git add README.md tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: lead the install and update paths with the Git marketplace and the upgrade skill"
```

---

### Task 2: 제품 설치 가이드와 설치 패키지 README를 같은 순서로 맞춘다

Task 1이 루트 README에서 정한 순서를 제품 표면에도 적용한다. 설치 가이드는 이미 App `@`와 CLI `$`를 구분하고 업그레이드 스킬 절을 갖고 있으므로, 바뀌는 것은 마켓플레이스 우선순위와 UTF-8 사전 점검 안내다.

**Files:**
- Modify: `guides/game-design-studio/installation.md`, `guides/game-design-career/installation.md` (`## Codex CLI 설치`, `## 업데이트`)
- Modify: `products/game-design-studio/plugin/README.md`, `products/game-design-career/plugin/README.md` (`## 설치`, `## 업데이트와 제거`)
- Test: `tests/contracts/user-guides-studio.test.mjs`, `tests/contracts/user-guides-career.test.mjs`, `tests/contracts/package-contents.test.mjs`

**Interfaces:**
- Consumes: Task 1이 정한 안내 순서(Git 마켓플레이스 → 로컬 마켓플레이스, 업그레이드 스킬 → 수동 제거·재설치)
- Produces: 없음

- [ ] **Step 1: 기준 계약을 먼저 돌린다**

```bash
node --test tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs
```

기대: 통과.

- [ ] **Step 2: 두 설치 가이드의 CLI 절을 고친다**

`## Codex CLI 설치`의 명령 묶음을 아래로 바꾼다(제품 ID만 다르다).

```bash
codex plugin marketplace add freelife1191/gamedesign-plugin
codex plugin marketplace list
codex plugin add game-design-studio@game-design-suite
codex plugin list
```

바로 아래에 로컬 checkout으로 쓸 때의 대안을 남긴다. `codex plugin marketplace add .`는 저장소를 직접 고치며 쓸 때만 쓰고, 이 경우 공개 릴리스로는 갱신되지 않는다는 사실을 한 문장으로 적는다.

- [ ] **Step 3: UTF-8 사전 점검을 설치 절에 넣는다**

두 설치 가이드의 CLI 절 끝에 한 문단을 넣는다. 다른 marketplace JSON에 UTF-8 BOM이 있으면 `codex plugin list` 로딩이 막혀 설치가 불가능해진다. 내용을 그대로 두고 BOM 없는 UTF-8로 다시 저장하면 풀린다. 이 플러그인 패키지 자체는 BOM·CRLF 게이트를 통과한 상태로만 배포된다.

- [ ] **Step 4: 설치 패키지 README 2개를 같은 순서로 맞춘다**

`## 설치`의 `### 로컬 저장소 marketplace 등록`을 `### marketplace 등록`으로 바꾸고 Git 경로를 먼저, 로컬 경로를 대안으로 둔다. `## 업데이트와 제거`의 맨 앞에 `upgrade-game-design-suite` 한 문단을 넣고 기존 수동 절차를 그 아래로 옮긴다.

- [ ] **Step 5: 계약과 링크를 확인한다**

```bash
node --test tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/contracts/package-contents.test.mjs
node tooling/index-references.mjs --check
```

기대: 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add guides/game-design-studio/installation.md guides/game-design-career/installation.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md
git commit -m "docs: align the product install surfaces on the Git marketplace and the upgrade skill"
```

---

### Task 3: 대표 진입 스킬 가이드에 App·CLI 요청문 쌍을 넣고 사례 ID 해석을 설명한다

두 대표 진입 스킬 가이드는 CLI `$` 요청문만 보여 준다. 다른 스킬 가이드는 전부 `#### 입문 App 요청문` / `#### 입문 CLI 요청문` 쌍을 쓴다. 그 형식으로 맞추고, 사례 ID를 그대로 넘기면 대표 진입 스킬이 catalog를 해석해 실행 경로로 바꾼다는 사실을 여기와 루트 README 사례 그룹 도입부에 적는다.

**Files:**
- Modify: `guides/game-design-studio/skills/game-design-studio.md`, `guides/game-design-career/skills/game-design-career.md` (`### 직접 호출 활용 — <skill-id>` 절)
- Modify: `README.md` (`### Studio 기획 사례 7개`, `### Career 학습·취업 사례 7개`, `### Studio와 Career 연계 사례 4개` 도입부)
- Test: `tests/contracts/root-readme-user-guides.test.mjs` (`caseGroupIntroductions`)

**Interfaces:**
- Consumes: 없음
- Produces: 사례 그룹 도입부 문장 3개. Task 5의 도식 캡션이 같은 표현을 쓴다.

- [ ] **Step 1: 도입부 계약이 무엇을 요구하는지 읽는다**

```bash
grep -n "caseGroupIntroductions" -A 20 tests/contracts/root-readme-user-guides.test.mjs
```

기대: 그룹 제목별로 정확한 두 문장 도입부가 상수로 박혀 있고, `assertReadableCaseGroupIntroductions`가 마침표 2개를 세는 것이 보인다. 문장을 늘리려면 상수와 문장 수 검사를 함께 고쳐야 한다.

- [ ] **Step 2: 실패하는 테스트를 먼저 쓴다**

`tests/contracts/root-readme-user-guides.test.mjs`에 다음 테스트를 추가한다.

```js
test("each case group tells the reader the entry skill resolves a case ID", async () => {
  const markdown = await readFile(path.join(root, "README.md"), "utf8");
  for (const [heading, product] of [
    ["Studio 기획 사례 7개", "game-design-studio"],
    ["Career 학습·취업 사례 7개", "game-design-career"],
    ["Studio와 Career 연계 사례 4개", "game-design-studio"],
  ]) {
    const group = exactSection(markdown, heading, 3);
    const intro = group.slice(0, group.indexOf("<details data-prompt-id="));
    // 사례 ID는 카탈로그의 키다. 대표 진입 스킬이 그 키를 실행 경로로 바꾼다는 사실이 카드보다 먼저 보여야
    // 사용자가 ID를 외운 사람만 쓰는 것으로 오해하지 않는다.
    assert.match(intro, /사례 ID/u, `${heading}: 도입부가 사례 ID를 이름으로 부른다`);
    assert.match(
      intro,
      new RegExp(`\\$${product}:${product} `, "u"),
      `${heading}: 도입부가 대표 진입 스킬의 실제 CLI 호출을 보여 준다`,
    );
  }
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

```bash
node --test --test-name-pattern="entry skill resolves a case ID" tests/contracts/root-readme-user-guides.test.mjs
```

기대: FAIL. `도입부가 사례 ID를 이름으로 부른다`에서 멈춘다.

- [ ] **Step 4: 세 사례 그룹 도입부에 문장을 넣는다**

각 그룹의 기존 두 문장 도입부 아래, 첫 `<details>` 앞에 한 문단과 한 줄 코드 블록을 넣는다. Studio 그룹의 예:

```text
$game-design-studio:game-design-studio ST-C01
```

문단에 담을 내용: 사례 ID는 제작용 요청문 카탈로그의 키다. 대표 진입 스킬에 ID만 넘겨도 카탈로그를 읽어 실행 경로 하나와 라우팅 영수증으로 바꾼다. 카드의 전문 스킬 호출은 같은 경로를 손으로 고정할 때 쓴다.

Career 그룹은 `$game-design-career:game-design-career CA-C01`을 쓴다. 연계 그룹의 실제 카탈로그 ID는 `suite:studio-to-career-handoff:case` 형태다. `SUITE-01` 같은 짧은 ID는 없으므로 README 카드의 `data-prompt-id`와 같은 문자열을 그대로 쓴다. 아래로 다시 확인한다.

```bash
python3 -c "import json;print([e['id'] for e in json.load(open('guides/prompt-templates/catalog/suite.json'))])"
grep -o 'data-prompt-id="suite:[^"]*"' README.md | head -4
```

기대: 두 출력의 ID가 같다.

- [ ] **Step 5: 대표 진입 스킬 가이드 2개에 App 요청문을 짝지어 넣는다**

`### 직접 호출 활용 — game-design-studio` 절의 `#### 입문 요청문`·`#### 응용 요청문`·`#### 고급 요청문`을 다른 스킬 가이드와 같은 여섯 개로 나눈다. 기존 `$` 요청문은 CLI 쪽에 그대로 두고, App 쪽에 같은 뜻의 `@Game Design Studio` 요청문을 새로 쓴다. 예로 입문 App 요청문:

```text
@Game Design Studio 기획을 어디서부터 시작할지 모르겠어. 요청을 정규화하고 route 하나를 골라 라우팅 영수증으로 남겨.
```

Career 가이드도 `@Game Design Career`로 같게 한다. 같은 절에 사례 ID를 그대로 넘길 수 있다는 문장을 한 줄 더한다.

- [ ] **Step 6: 테스트와 링크를 확인한다**

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs
node tooling/index-references.mjs --check
```

기대: 전부 통과. 도입부 문장 수 계약(`canonical introduction has two sentences`)이 걸리면 상수의 두 문장은 그대로 두고 새 문단을 그 뒤에 두는 방식으로 맞춘다.

- [ ] **Step 7: 커밋**

```bash
git add README.md guides/game-design-studio/skills/game-design-studio.md guides/game-design-career/skills/game-design-career.md tests/contracts/root-readme-user-guides.test.mjs
git commit -m "docs: show that the entry skill resolves a case ID, on both surfaces"
```

---

### Task 4: shared 도식 3개를 신설하고 설치 도식을 스펙이 요구하는 단계까지 늘린다

스펙이 명시로 요구하는 도식 셋을 한 태스크로 묶는다. 개수 상수가 다섯 곳에 박혀 있어 도식을 하나씩 나눠 넣으면 중간 상태가 전부 실패하기 때문이다.

- **대표 진입 라우팅**(`suite-entry-routing-flow`) — 두 가이드가 빌려 쓰는 오케스트레이터 도식을 대체한다. 판단 기록대로 skill 도식이 아니라 shared 도식이다.
- **단방향 인계**(`suite-handoff-ownership-flow`) — 최종 owner, supplier evidence, 단방향 반환이 보여야 한다.
- **업데이트 승인**(`suite-update-approval-flow`) — 사용자 승인, `plugin add`, 검증, 새 세션 재개가 보여야 한다.
- **설치 도식 확장**(`app-cli-install-flow`) — UTF-8 preflight와 마켓플레이스 종류를 더한다. 승인·재설치·검증·새 세션까지 한 장에 넣으면 1400×900에서 읽히지 않으므로 새 도식으로 뺐다.

**Files:**
- Create: `guides/assets/shared/suite-entry-routing-flow.svg`/`.png`, `guides/assets/shared/suite-handoff-ownership-flow.svg`/`.png`, `guides/assets/shared/suite-update-approval-flow.svg`/`.png`
- Modify: `guides/assets/shared/app-cli-install-flow.svg`/`.png`
- Modify: `guides/assets/diagram-manifest.json`, `guides/assets/VISUAL-QA.md`
- Modify: `tooling/lib/use-case-guides.mjs`, `tooling/lib/user-guides.mjs`
- Modify: `tests/contracts/user-guide-shared-diagrams.test.mjs`, `tests/contracts/user-guide-career-diagrams.test.mjs`, `tests/contracts/user-guide-use-case-manifest.test.mjs`
- Modify: `shared/suite-handoff/references/` 아래 인계 계약 문서, `guides/game-design-studio/installation.md`, `guides/game-design-career/installation.md`, `guides/game-design-studio/skills/game-design-studio.md`, `guides/game-design-career/skills/game-design-career.md`

**Interfaces:**
- Consumes: Task 3이 정한 표현(라우팅 영수증, 단방향 인계). 인계 도식의 용어는 `shared/suite-handoff/references`의 계약 용어와 같아야 한다.
- Produces: 도식 ID `suite-entry-routing-flow`, `suite-handoff-ownership-flow`, `suite-update-approval-flow`

- [ ] **Step 1: 계약 용어를 원문에서 가져온다**

```bash
ls shared/suite-handoff/references/
grep -rn "owner\|supplier\|반환\|단방향" shared/suite-handoff/handoff.md shared/suite-handoff/references/*.md | head -30
```

기대: 최종 owner, supplier evidence, 단방향 반환의 정확한 표기가 나온다. 도식 label은 이 표기를 그대로 쓴다. 새 용어를 만들지 않는다.

- [ ] **Step 2: 기존 shared SVG의 규격을 읽는다**

```bash
grep -n "viewBox\|<title>\|<desc>\|aria-label" guides/assets/shared/app-cli-install-flow.svg | head
```

기대: `viewBox="0 0 1400 900"`, `<svg>`의 직계 자식 `<title>`·`<desc>`, `aria-label="읽기 순서 …"` group이 보인다. 새 도식은 같은 규격을 따른다. `tests/contracts/user-guide-shared-diagrams.test.mjs`가 title/desc를 정규식으로 강제한다.

- [ ] **Step 3: 실패를 먼저 만든다 — 개수 상수와 ID 목록을 늘린다**

다섯 곳을 함께 고친다.

```bash
python3 - <<'EOF'
import pathlib, re
edits = [
    ("tooling/lib/use-case-guides.mjs", "  shared: 8,", "  shared: 11,"),
    ("tooling/lib/user-guides.mjs", "const expectedDiagramTotal = 20 + registered;", "const expectedDiagramTotal = 23 + registered;"),
    ("tests/contracts/user-guide-career-diagrams.test.mjs", 'manifest.diagrams.length, 93,', 'manifest.diagrams.length, 96,'),
    ("tests/contracts/user-guide-use-case-manifest.test.mjs", "    svg: 93,", "    svg: 96,"),
    ("tests/contracts/user-guide-use-case-manifest.test.mjs", "    png: 93,", "    png: 96,"),
    ("tests/contracts/user-guide-use-case-manifest.test.mjs", "    shared: 8,", "    shared: 11,"),
]
for filename, old, new in edits:
    p = pathlib.Path(filename)
    text = p.read_text(encoding="utf8")
    assert text.count(old) == 1, (filename, old, text.count(old))
    p.write_text(text.replace(old, new), encoding="utf8")
EOF
```

`tests/contracts/user-guide-shared-diagrams.test.mjs`의 `expectedSharedIds`에 세 ID를 정렬 순서에 맞게 넣고(`app-cli-install-flow` 다음이 `canonical-artifact-lifecycle`이므로 `suite-*` 셋은 `project-memory-reuse-flow` 뒤), 테스트 이름의 `eight`를 `eleven`으로 바꾼다.

- [ ] **Step 4: 검사를 돌려 실패를 확인한다**

```bash
node --test tests/contracts/user-guide-shared-diagrams.test.mjs 2>&1 | tail -20
```

기대: FAIL. `expectedSharedIds` 비교에서 세 ID가 missing으로 나온다. 이것이 도식을 만들라는 게이트다.

- [ ] **Step 5: 대표 진입 라우팅 도식을 쓴다**

`guides/assets/shared/suite-entry-routing-flow.svg`. 담을 것:

- 자연어 요청 또는 사례 ID 도착
- 요청 정규화와 소유 제품 판정(Studio / Career)
- route 하나 선택. 여러 개로 넘기지 않는다
- `route-receipt.json`의 `routeId`만 채운다. 이 스킬은 자기 파일을 만들지 않는다
- 전문 스킬 위임
- 상대 제품 소유일 때는 단방향 인계 후보로만 분리하고 인계 도식으로 넘긴다

- [ ] **Step 6: 인계 도식을 쓴다**

`guides/assets/shared/suite-handoff-ownership-flow.svg`. 담을 것:

- 요청 도착 → 소유 제품 판정 → 최종 owner 확정
- supplier 제품이 근거만 제공하는 경로와 그 근거의 출처 표시
- 단방향 반환: supplier가 owner에게 한 번 돌려주고 다시 넘기지 않는다
- 상대 제품이 없거나 비활성일 때 blocker를 남기고 멈춘다
- 사람 승인 gate

- [ ] **Step 7: 설치 도식을 늘리고 업데이트 도식을 쓴다**

`app-cli-install-flow.svg`에 두 단계를 더한다. 하나는 UTF-8 preflight(BOM 있는 marketplace JSON이 `codex plugin list` 로딩을 막는다), 하나는 마켓플레이스 종류 분기(Git 마켓플레이스와 로컬 마켓플레이스의 갱신 방법이 다르다).

`guides/assets/shared/suite-update-approval-flow.svg`를 새로 만든다. 담을 것: 업데이트 알림 → `upgrade-game-design-suite` 검사(설치를 바꾸지 않음) → 사용자 승인 gate → `codex plugin add` → 검증 → 새 채팅·새 세션 재개.

- [ ] **Step 8: lint와 2× 렌더를 돌린다**

```bash
WRAP=products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs
node "$WRAP" lint guides/assets/shared/suite-entry-routing-flow.svg guides/assets/shared/suite-handoff-ownership-flow.svg guides/assets/shared/suite-update-approval-flow.svg guides/assets/shared/app-cli-install-flow.svg
for id in suite-entry-routing-flow suite-handoff-ownership-flow suite-update-approval-flow app-cli-install-flow; do
  node "$WRAP" render "guides/assets/shared/$id.svg" "guides/assets/shared/$id.png"
done
```

기대: lint 오류 0건, 경고 0건. PNG는 정확히 2800×1800.

- [ ] **Step 9: 매니페스트에 등록하고 문서에 삽입한다**

`guides/assets/diagram-manifest.json`의 `diagrams` 배열에 `scope: "shared"` 항목 3개를 손으로 넣는다. 기존 shared 항목과 같은 키(`id`, `scope`, `svg`, `png`, `alt`, `sources`, `usedBy`)를 쓰고 `svg`는 정확히 `shared/<id>.svg`, `png`는 `shared/<id>.png`여야 한다. `sources`와 `usedBy`의 모든 경로는 실재하는 일반 파일이어야 한다(심볼릭 링크 불가). `app-cli-install-flow`의 `alt`도 늘어난 단계를 반영해 고친다.

그다음 도식을 문서에 싣는다. 대표 진입 도식은 두 대표 진입 스킬 가이드의 `### 직접 호출 활용` 절에서 빌려 쓰던 오케스트레이터 도식을 대체한다.

```markdown
[![Studio와 Career 대표 진입 라우팅 흐름](../../assets/shared/suite-entry-routing-flow.png)](../../assets/shared/suite-entry-routing-flow.svg)
```

인계 도식은 인계 계약 문서에, 업데이트 도식은 두 설치 가이드의 `## 업데이트` 절에 넣는다. 링크 형태는 `](<png>)](<svg>)`를 유지한다. 계약 테스트가 이 형태를 문자열로 검사한다.

- [ ] **Step 10: 새 도식 3개의 의미 계약을 테스트로 고정한다**

`tests/contracts/user-guide-shared-diagrams.test.mjs`에 기존 도식들과 같은 방식으로 테스트를 더한다. 각 도식의 SVG 본문에 스펙이 요구하는 요소가 실제로 있는지 문자열로 검사한다.

```js
test("entry routing diagram shows one route, the receipt, and the one-way handoff candidate", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-entry-routing-flow.svg"), "utf8");
  for (const phrase of ["route-receipt.json", "단방향", "소유 제품"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  // 대표 진입 스킬은 자기 파일을 만들지 않는다. 도식이 산출물을 약속하면 가이드 본문과 어긋난다.
  assert.doesNotMatch(svg, /자동 적용|승인 없이/u);
});

test("handoff diagram names the final owner, the supplier evidence, and the one-way return", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-handoff-ownership-flow.svg"), "utf8");
  for (const phrase of ["최종 owner", "supplier", "단방향 반환", "blocker"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
});

test("update diagram gates every install change behind a named human approval", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-update-approval-flow.svg"), "utf8");
  for (const phrase of ["upgrade-game-design-suite", "사용자 승인", "codex plugin add", "새 세션"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  // 검사 단계는 설치를 바꾸지 않는다. 도식이 자동 적용을 암시하면 스펙의 금지 동작을 어긴다.
  assert.doesNotMatch(svg, /자동 업데이트|자동 적용/u);
});
```

- [ ] **Step 11: 검수 기록을 남긴다**

`guides/assets/VISUAL-QA.md`의 표에 새 도식 3개 행을 추가하고 `app-cli-install-flow` 행을 갱신한다. 전체 보기와 원본 해상도에서 각각 확인한 결과(tofu, 텍스트 넘침, 잘린 glyph, containment 실패 없음)와 읽기 순서 일치를 적는다. 실제로 이미지를 열어 확인한 뒤 적는다. 보지 않고 적지 않는다.

- [ ] **Step 12: 검사를 돌린다**

```bash
node --test tests/contracts/user-guide-shared-diagrams.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs
npm run validate:guides
npm run check:guide-diagrams
node tooling/index-references.mjs --check
node tooling/audit-evidence.mjs --check
```

기대: 전부 통과.

- [ ] **Step 13: 커밋**

```bash
git add guides/assets/shared guides/assets/diagram-manifest.json guides/assets/VISUAL-QA.md tooling/lib/use-case-guides.mjs tooling/lib/user-guides.mjs tests/contracts shared/suite-handoff guides/game-design-studio guides/game-design-career
git commit -m "docs: draw the entry routing, the one-way handoff, and the approval-gated update path"
```

---

### Task 5: snapshot, BUILD-MANIFEST, Archify catalog를 재생성하고 재검수한다

Task 1~4가 `products/**`와 `shared/**`를 바꿨다. 두 설치 패키지 snapshot과 매니페스트는 생성물이므로 빌더로 다시 만들고, Archify 소스 카탈로그가 새 문서와 도식을 아는지 확인한다.

**Files:**
- Regenerate: `plugins/game-design-studio/**`, `plugins/game-design-career/**`, 두 `BUILD-MANIFEST.json`
- Modify: `guides/archify-diagrams/catalog.json` (새 소스가 필요하면)
- Test: `npm run check:curated-archify`, `npm run validate:archify-catalog`

**Interfaces:**
- Consumes: Task 1~4의 모든 원본 변경
- Produces: 재현 가능한 snapshot. Task 6의 버전 인상이 이 위에 한 번 더 빌드를 돌린다.

- [ ] **Step 1: 카탈로그가 새 파일을 아는지 확인한다**

```bash
npm run validate:archify-catalog
npm run check:curated-archify
```

기대: 새 도식·문서가 카탈로그에 없으면 여기서 잡힌다. 잡히면 `guides/archify-diagrams/catalog.json`에 항목을 추가한다.

- [ ] **Step 2: snapshot을 다시 만든다**

```bash
npm run build
git status --short plugins products shared
```

기대: `plugins/**`의 변경이 원본 변경과 대응한다. 대응하지 않는 변경(예: 손대지 않은 스킬의 바이트 변화)이 보이면 멈추고 원인을 먼저 찾는다.

- [ ] **Step 3: 빌드 표류 검사를 돌린다**

```bash
node tooling/validate-build-drift.mjs
node tooling/index-references.mjs --check
node tooling/audit-evidence.mjs --check
```

기대: 전부 통과.

- [ ] **Step 4: 커밋**

```bash
git add plugins guides/archify-diagrams/catalog.json
git commit -m "build: regenerate the product snapshots for the new docs and diagrams"
```

---

### Task 6: 두 제품 버전을 `0.2.0`으로 올리고 릴리스 잠금을 맞춘다

신규 스킬 3개와 진입점 변경이 들어갔으므로 minor를 올린다. 원천은 두 제품 `plugin.json`이고, 나머지는 그 값에 묶인 상수와 생성물이다.

**Files:**
- Modify: `products/game-design-studio/plugin/.codex-plugin/plugin.json`, `products/game-design-career/plugin/.codex-plugin/plugin.json`
- Modify: `shared/updates/suite-release.lock.json`
- Modify: `tooling/marketplace-smoke.mjs`, `tooling/isolation-smoke.mjs`
- Modify: 버전 고정값을 가진 테스트. `0.1.1`은 `tests/unit/`의 9개 파일과 `tests/e2e/suite/`의 2개 파일에 나오지만 상당수는 임의 fixture 값이라 옮길 필요가 없다. Step 1의 grep과 Step 5의 실패 메시지가 실제 대상을 가른다
- Regenerate: `shared/updates/installed-components.json`, `plugins/**`
- Modify: `architecture/plugin-suite.md`

**Interfaces:**
- Consumes: Task 5가 남긴 깨끗한 snapshot
- Produces: `0.2.0`으로 일치한 트리. Task 7의 릴리스 게이트가 이것을 검사한다.

- [ ] **Step 1: 지금 값이 어디에 박혀 있는지 다시 센다**

```bash
grep -rn '"0\.1\.1"\|0\.1\.1' --include="*.json" --include="*.mjs" products shared tooling tests | grep -v "svg-infographic/CHANGELOG"
```

기대: 이 계획의 File Structure가 적은 파일만 나온다. 새로 나오는 파일이 있으면 목록에 더한다.

- [ ] **Step 2: 실패를 먼저 만든다 — 두 제품 버전을 올린다**

```bash
python3 - <<'EOF'
import json, pathlib
for product in ("game-design-studio", "game-design-career"):
    p = pathlib.Path(f"products/{product}/plugin/.codex-plugin/plugin.json")
    text = p.read_text(encoding="utf8")
    assert '"version": "0.1.1"' in text, p
    p.write_text(text.replace('"version": "0.1.1"', '"version": "0.2.0"', 1), encoding="utf8")
EOF
node tooling/generate-update-manifest.mjs --check
```

기대: FAIL. `SUITE_VERSION_MISMATCH`가 `suite-release.lock.json pins v0.1.1 but ...`로 멈춘다. 이것이 잠금과 버전을 함께 움직이라는 게이트다.

- [ ] **Step 3: 릴리스 잠금을 맞춘다**

`shared/updates/suite-release.lock.json`의 `installedTag`를 `v0.2.0`으로, `commit`을 이 계획의 내용 작업이 끝난 커밋(= Task 5의 커밋) 해시로 바꾼다.

```bash
git rev-parse HEAD
```

판단 기록에 적은 대로, 이 필드는 태그가 붙을 커밋이 아니라 릴리스 내용이 확정된 커밋을 가리킨다. 파일이 제 커밋 해시를 담을 수는 없기 때문이다. `installedTag`만 최신 판정에 쓰이고 `commit`은 40자 hex 형식 검사만 받는다.

- [ ] **Step 4: 생성물을 다시 만든다**

```bash
node tooling/generate-update-manifest.mjs
npm run build
```

기대: `shared/updates/installed-components.json`의 suite 항목이 `v0.2.0`이 되고, 두 snapshot의 `plugin.json`과 `BUILD-MANIFEST.json`이 따라온다.

- [ ] **Step 5: 버전 상수와 테스트를 맞춘다**

`tooling/marketplace-smoke.mjs`의 `RELEASE_PLUGIN_VERSION`을 `"0.2.0"`으로, `tooling/isolation-smoke.mjs`의 매니페스트 비교값을 `"0.2.0"`으로 바꾼다. 그다음 유닛 테스트의 고정값을 같은 값으로 옮긴다.

```bash
node tooling/run-test-group.mjs unit 2>&1 | grep -E "^not ok|# fail" | head -20
```

기대: 실패가 0이 될 때까지 고정값을 옮긴다. 실패 메시지가 가리키는 파일만 고친다.

- [ ] **Step 6: 아키텍처 문서에 릴리스 사실을 남긴다**

`architecture/plugin-suite.md`에 이번 릴리스에서 바뀐 것을 적는다. 신규 스킬 3개, 대표 진입점 2개, 도식 3개(추가 2·확장 1), 버전 `0.1.1` → `0.2.0`, 그리고 `suite-release.lock.json`의 `commit`이 무엇을 가리키는지에 대한 한 문단.

- [ ] **Step 7: 전체 검증을 돌린다**

```bash
npm run validate 2>&1 | tail -30
```

기대: `Suite release readiness: COMPLETE`, 종료 코드 0.

- [ ] **Step 8: 커밋**

```bash
git add products shared tooling tests plugins architecture/plugin-suite.md
git commit -m "release: raise both products to 0.2.0 and pin the suite release lock to v0.2.0"
```

---

### Task 7: 릴리스 게이트를 통과시키고 태그를 준비한다

`npm run validate:release`는 `--skip`을 거부하고 CI가 건너뛰는 네 스테이지를 전부 돌린다. 릴리스 전에 로컬에서 반드시 실행한다는 의무가 `architecture/plugin-suite.md`에 이미 적혀 있다. 태그 생성과 푸시는 사용자 승인 뒤에만 한다.

**Files:**
- 없음 (검증과 태그만)

**Interfaces:**
- Consumes: Task 6이 남긴 `0.2.0` 트리
- Produces: `v0.2.0` 태그 (승인 시)

- [ ] **Step 1: 번들 상류가 최신인지 확인한다**

```bash
npm run check:updates 2>&1 | tail -20
```

기대: skillstead·archify·im-not-ai 셋 다 `current`. 하나라도 `outdated`면 릴리스에 그 사실을 적을지 상류를 먼저 올릴지 사용자에게 묻는다. `unknown`(네트워크 불가)이면 그대로 기록하고 진행한다.

`npm run validate:release:latest`를 쓰지 않는다. 그 스크립트는 `check-suite-updates.mjs --require-current && validate-suite.mjs --release`라서 Step 2의 릴리스 게이트를 통째로 한 번 더 돌린다.

- [ ] **Step 2: 릴리스 게이트를 돌린다**

```bash
npm run validate:release 2>&1 | tee /tmp/validate-release-v0.2.0.log | tail -40
```

기대: 모든 스테이지가 `PASS`이고 `SKIPPED`가 하나도 없으며 마지막 줄이 `Suite release readiness: COMPLETE`다. 이 계획 착수 시점의 기준선에서 `format smoke`를 포함한 전 스테이지가 로컬에서 통과했으므로, `UNAVAILABLE`이나 `SKIPPED`가 새로 나타나면 이 계획이 만든 회귀다. 그 자리에서 멈춘다.

- [ ] **Step 3: 설치 왕복을 로컬에서 한 번 더 돌린다**

```bash
npm run verify:install-roundtrip 2>&1 | tail -20
```

기대: 통과. 실패하면 릴리스를 멈춘다.

- [ ] **Step 4: 릴리스 노트용 구성 요소 표를 만든다**

```bash
python3 -c "
import json
d=json.load(open('shared/updates/installed-components.json'))
print('| 구성 요소 | 버전 |'); print('| --- | --- |')
for c in d['components']: print(f\"| {c['id']} | {c['installedTag']} |\")
"
```

기대: 네 행. 이 표를 사용자에게 그대로 전달한다. GitHub Release 본문은 사용자가 쓴다.

- [ ] **Step 5: 여기서 멈추고 승인을 받는다**

태그를 붙일 커밋, PR #1 머지 여부, 푸시 시점은 사용자 결정이다. 승인 전에는 `git tag`도 `git push`도 하지 않는다.

- [ ] **Step 6: 승인 뒤에만 — 태그를 만들고 푸시한다**

```bash
git tag -a v0.2.0 -m "Game Design Plugin Suite v0.2.0"
git push origin v0.2.0
```

기대: 태그가 원격에 생긴다. 그 뒤 `upgrade-game-design-suite`가 이 태그를 최신 판정 근거로 읽는다.

---

## Self-Review

**1. 스펙 범위 대조** — "문서와 도식"의 일곱 항목 중 셋(신규 스킬 README 표, `routing.json`, 대표 진입 스킬 가이드 존재)은 앞선 계획에서 이미 착지했고, 넷째의 절반(README 첫 요청 절, 두 제품 troubleshooting의 App·CLI 구분)도 이미 충족돼 있다. 근거는 "사전 확인된 사실"에 적었다. 남은 항목이 Task 1~4에 대응한다. "릴리스" 절은 Task 6~7이다. `upgrade-game-design-suite`의 카탈로그 엔트리와 스킬 도식 두 항목만 의도적으로 비웠고 판단 기록에 근거를 남겼다. 대표 진입 스킬의 도식은 스킬 도식이 아니라 shared 도식으로 만든다. 근거도 같은 곳에 있다.

**2. 자리표시자 점검** — 모든 단계에 실행할 명령 또는 넣을 내용이 있다. 도식 SVG 본문은 코드로 적지 않았다. 1400×900 canvas의 SVG 전체를 계획에 적는 것은 계획이 아니라 산출물이고, 대신 담아야 할 요소를 항목으로 못 박고 Step 10의 의미 계약 테스트, lint, 2× 렌더, 시각 검수를 검증 단계로 뒀다.

**3. 타입 일관성** — Task 4는 `use-case-manifest.json`의 `skill_cases`와 두 production contract를 건드리지 않는다. shared 도식 경로만 쓰기 때문이다. 대신 개수 상수 다섯 곳과 `expectedSharedIds`가 함께 움직여야 하고 Step 3이 그 전부를 한 번에 고친다. Task 6의 버전 문자열은 `plugin.json`이 유일한 원천이고 나머지는 상수·생성물로 분류했다.

**4. 순서 의존성** — Task 5는 Task 1~4의 원본 변경을 전부 받아야 하고, Task 6의 `commit` 필드는 Task 5의 커밋 해시를 쓴다. Task 7은 Task 6 없이는 의미가 없다. Task 1~4는 서로 독립이지만 Task 2와 Task 4가 같은 두 설치 가이드를, Task 3과 Task 4가 같은 두 대표 진입 스킬 가이드를 건드리므로 병렬로 돌리지 않는다.

**5. 검사 상수의 위치** — 도식을 하나만 더해도 `tooling/lib/use-case-guides.mjs`, `tooling/lib/user-guides.mjs`, 계약 테스트 세 곳이 함께 움직여야 한다. 그래서 도식 셋을 한 태스크로 묶었다. 나눠 넣으면 중간 커밋마다 `npm run validate`가 실패한다.
