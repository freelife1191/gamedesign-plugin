# Game Design Plugin Suite

Game Design Plugin Suite는 게임 제작 기획용 **Game Design Studio**와 게임 기획 학습·취업용 **Game Design Career**를 독립 플러그인으로 제공합니다. 두 제품은 `content.md`를 기준으로 근거, 결정, 자산과 내보내기 상태를 보존합니다.

이 도구는 판단과 근거 관리를 돕지만 재미, 흥행, 매출, 채용·합격, 법률 준수, 플랫폼 승인 또는 사람 승인을 보장하지 않습니다. 결과를 사용하거나 공개하기 전에 이름 있는 사람이 사실, 범위, 권리와 품질을 검토해야 합니다.

## 목차

아래 순서대로 제품을 고르고 설치한 뒤 첫 결과와 상세 작업 경로를 확인하세요.

1. [30초 안에 플러그인 선택하기](#30초-안에-플러그인-선택하기)
2. [설치하기](#설치하기)
3. [5분 안에 첫 결과 만들기](#5분-안에-첫-결과-만들기)
4. [케이스별 프롬프트로 시작하기](#케이스별-프롬프트로-시작하기)
5. [스킬별로 바로 실행하기](#스킬별로-바로-실행하기)
6. [요청 뒤에 생성되는 결과물](#요청-뒤에-생성되는-결과물)
7. [플러그인 구조와 전체 시스템 아키텍처](#플러그인-구조와-전체-시스템-아키텍처)
8. [이미지·도식·문서 내보내기](#이미지도식문서-내보내기)
9. [상세 가이드에서 더 알아보기](#상세-가이드에서-더-알아보기)
10. [안전·권리·사람 승인 경계](#안전권리사람-승인-경계)
11. [문제를 해결하고 작업 재개하기](#문제를-해결하고-작업-재개하기)
12. [기술 문서·기여·라이선스](#기술-문서기여라이선스)

## 30초 안에 플러그인 선택하기

만들 결과와 사용할 사람을 기준으로 Studio, Career 또는 두 제품을 선택하세요.

| 선택 | 사용하는 사람 | 첫 요청 유형 | 첫 Artifact | 상세 가이드 |
| --- | --- | --- | --- | --- |
| Studio | 게임 기획 학생, 현업 기획자, 팀 리드 | 비전·규칙·콘텐츠·UX·경제·제작 범위 설계 | `game-design-brief` | [Studio 사용자 가이드](guides/game-design-studio/README.md) |
| Career | 취업 준비생, 주니어, 직무 전환자, 멘토 | 역할 탐색·역기획·포트폴리오·면접·성장 계획 | `game-design-career-plan` | [Career 사용자 가이드](guides/game-design-career/README.md) |
| 둘 다 | 완성한 기획서를 취업용 포트폴리오 사례로 정리할 기획자 | Studio 검토 뒤 Career 포트폴리오 사례로 정리 | 제품별 Canonical Artifact 2개 | [전체 사용자 가이드](guides/README.md) |

[![Studio와 Career 선택·설치 흐름](guides/assets/shared/plugin-selection-flow.png)](guides/assets/shared/plugin-selection-flow.svg)

[편집 가능한 선택 흐름 SVG](guides/assets/shared/plugin-selection-flow.svg)에서 레이블과 관계를 확인할 수 있습니다.

## 설치하기

App에서는 Plugins 화면을 사용하고, Codex CLI에서는 marketplace와 제품 ID를 사용합니다. 필요한 제품만 설치하세요.

### Codex App에 설치하기

ChatGPT 데스크톱 앱의 Work 또는 Codex에서 저장소와 플러그인을 연결합니다.

1. 저장소 루트를 로컬 프로젝트 또는 작업 폴더로 엽니다.
2. `.agents/plugins/marketplace.json`의 marketplace 이름이 `game-design-suite`인지 확인합니다.
3. 앱을 다시 시작하고 **Codex**를 선택하거나 **ChatGPT → Work**를 켭니다.
4. **Plugins**에서 marketplace를 열고 필요한 제품을 설치합니다.
5. 설치 직후 **새 채팅**을 열고 Studio 또는 Career를 선택합니다.

제품별 화면 절차는 [Studio 설치 가이드](guides/game-design-studio/installation.md)와 [Career 설치 가이드](guides/game-design-career/installation.md)를 따르세요.

### Codex CLI에 설치하기

저장소 루트에서 marketplace를 등록하고 설치할 제품을 하나씩 선택합니다.

```bash
codex plugin marketplace add .
codex plugin marketplace list
```

Studio가 필요하면 다음 명령만 실행합니다.

```bash
codex plugin add game-design-studio@game-design-suite
```

Career가 필요하면 다음 명령만 실행합니다.

```bash
codex plugin add game-design-career@game-design-suite
```

둘 다 필요하면 위의 두 설치 코드 블록을 모두 실행합니다. 설치 뒤 상태를 확인하고 **새 세션**을 시작하세요.

```bash
codex plugin list
```

### 업데이트·재설치하기

Marketplace refresh와 설치 패키지 교체는 서로 다른 작업입니다.

#### Codex App

1. 로컬 checkout을 갱신하고 저장소 루트에서 `npm run build`와 `npm run validate`를 실행합니다.
2. ChatGPT 데스크톱 앱을 다시 시작해 로컬 marketplace를 다시 읽습니다.
3. **Plugins**의 설치된 Studio 또는 Career 상세 화면에서 **Uninstall plugin**을 선택합니다.
4. **Plugins Directory**의 `game-design-suite`에서 제거한 제품을 다시 설치합니다.
5. Plugins 목록에서 설치 확인을 마친 뒤 **새 채팅**을 열고 제품을 선택합니다.

관리자가 제공한 기본 플러그인처럼 제거할 수 없는 항목은 관리자에게 업데이트를 요청하세요.

#### Codex CLI

1. 로컬 checkout을 갱신하고 저장소 루트에서 package를 빌드·검증합니다.

```bash
npm run build
npm run validate
```

2. 설치한 제품만 제거합니다. 둘 다 설치했다면 두 명령을 모두 실행합니다.

```bash
codex plugin remove game-design-studio@game-design-suite
codex plugin remove game-design-career@game-design-suite
```

3. 제거한 제품만 다시 설치합니다.

```bash
codex plugin add game-design-studio@game-design-suite
codex plugin add game-design-career@game-design-suite
```

4. 설치 상태를 확인한 뒤 **새 세션**을 시작합니다.

```bash
codex plugin list
```

Git marketplace를 등록했다면 재설치 전에 `codex plugin marketplace upgrade game-design-suite`로 설치 가능한 snapshot을 refresh할 수 있습니다. 이 명령은 설치된 플러그인을 교체하지 않으므로 위 제거·재설치 단계를 계속 수행해야 합니다.

## 5분 안에 첫 결과 만들기

모르는 정보는 미정으로 남깁니다. 아래 세 경로는 첫 Artifact와 먼저 읽을 파일을 함께 지정합니다.

### Studio에서 첫 게임 기획 브리프 만들기

예상 첫 Artifact는 `game-design-brief`입니다. `content.md`, `evidence.yml`, `export-manifest.yml` 순서로 먼저 읽으세요.

```text
@Game Design Studio 모바일 협동 RPG의 대상 플레이어와 핵심 재미를
미정 항목과 함께 game-design-brief로 작성해.

$game-design-studio:orchestrate-game-design-project
모바일 협동 RPG의 대상 플레이어와 핵심 재미를
미정 항목과 함께 game-design-brief로 작성해.
```

### Career에서 첫 경력 계획 만들기

예상 첫 Artifact는 `game-design-career-plan`입니다. `content.md`, `evidence.yml`, `export-manifest.yml` 순서로 먼저 읽으세요.

```text
@Game Design Career 시스템 기획과 콘텐츠 기획의 교환조건을 비교하고
주 8시간 기준 12주 증거 계획을 미정 항목과 함께 작성해.

$game-design-career:orchestrate-game-design-career
시스템 기획과 콘텐츠 기획의 교환조건을 비교하고
주 8시간 기준 12주 증거 계획을 미정 항목과 함께 작성해.
```

### 완성한 게임 기획을 취업용 포트폴리오 사례로 정리하기

Studio에서 사람이 검토한 기획서 하나를 바탕으로, 내가 해결한 문제와
기여를 보여 주는 취업용 포트폴리오 사례를 만듭니다.

**이럴 때 사용:** 수업·개인 프로젝트에서 완성한 기획서를 포트폴리오와
면접 준비에 활용하고 싶을 때 사용합니다.

**준비물:** Studio에서 작성하고 검토한 기획서 1개와 내가 실제로 맡은
범위, 공개 가능한 정보입니다.

**실행 순서:** 먼저 Studio 기획 검토(`review-game-design`)로 공개할
내용을 구분한 뒤, Career 포트폴리오 작성(`build-game-design-portfolio`)으로
사례를 재구성합니다.

```text
App
@Game Design Studio에서 기획 검토(review-game-design)를 먼저 실행해,
완성한 기획서에서 공개할 수 있는 문제, 내가 맡은 범위,
선택 이유와 검증 결과를 구분해 줘.

그다음 @Game Design Career에서 포트폴리오 작성
(build-game-design-portfolio)을 실행해 검토된 내용만 사용하여
포트폴리오 사례 본문, 개인 기여 요약, 면접 답변 소재와
공개 전 확인 목록을 작성해 줘.

CLI
$game-design-studio:review-game-design
완성한 기획서에서 공개할 수 있는 문제, 내가 맡은 범위,
선택 이유와 검증 결과를 구분해 줘.

$game-design-career:build-game-design-portfolio
검토된 내용만 사용해 포트폴리오 사례 본문, 개인 기여 요약,
면접 답변 소재와 공개 전 확인 목록을 만들어 줘.
```

**얻게 되는 결과:**

- **포트폴리오 사례 본문** (`creative-design-portfolio/content.md`):
  문제, 내 역할, 판단과 검증 결과를 읽는 사람이 따라갈 수 있게 정리합니다.
- **개인 기여와 선택 근거** (`creative-design-portfolio/evidence.yml`):
  내가 한 일과 그 선택을 뒷받침하는 내용을 분리해 기록합니다.
- **면접 답변 소재** (`creative-design-portfolio/decisions/`):
  예상 질문에 설명할 판단, 대안과 배운 점을 정리합니다.
- **공개 전 확인 목록** (`creative-design-portfolio/export-manifest.yml`):
  공개할 파일, 보류 항목과 내보내기 상태를 확인합니다.

**공개 전 확인:** 작성자가 실제 기여 범위와 공개 권한을 직접 확인합니다.
이 플러그인은 공개를 자동 승인하지 않으며, 미정·제외 내용은 보존합니다.

## 케이스별 프롬프트로 시작하기

Production catalog의 대표 카드 18개를 Studio 7개, Career 7개, 연계 4개 순서로 제공합니다. 카드를 열어 입력, 실행 흐름, 결과와 사람 검토 경계를 확인하세요.

### Studio 기획 사례 7개

게임의 규칙, 콘텐츠, 경험과 제작 범위를 설계하려는 기획자가 Studio 사례를 고릅니다. 각 사례는 검토 가능한 기획 Artifact와 사람 검토 지점을 남깁니다.

<details data-prompt-id="studio:case:ST-C01">
<summary>게임의 방향과 핵심 재미 정의 (studio:case:ST-C01)</summary>

게임의 방향을 정하지 못했을 때 대상 플레이어와 검증 기준을 기획 브리프로 정리합니다.

#### 사용 시점

ST-C01의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C01 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C01를 작성해.

CLI
$game-design-studio:apply-document-quality-profile
$game-design-studio:define-game-vision
$game-design-studio:orchestrate-game-design-project
$game-design-studio:review-game-design [프로젝트 ID] [공개 정보] ST-C01의 fact,
inference, recommendation을 분리해.
```

#### 실행 흐름

`apply-document-quality-profile` → `define-game-vision` → `orchestrate-game-design-project` → `review-game-design`

#### 예상 결과

`vision-pillars` → `game-design-brief` → `game-design-review`

#### 읽는 순서

`game-design/[프로젝트 ID]/vision-pillars/content.md` → `game-design/[프로젝트 ID]/vision-pillars/evidence.yml` → `game-design/[프로젝트 ID]/vision-pillars/export-manifest.yml`

#### 사람 검토

**읽는 순서:** `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`. 중간 결과에서는 player promise와 각 pillar가 verb·decision·feedback에 연결되는지 먼저 봅니다. **사람 결정:** 실제 design owner가 대상, pillar, anti-pillar, non-goal과 다음 prototype 범위를 승인·수정·보류합니다. 스킬 실행, reviewer finding과 파일 생성은 자동 승인하지 않습니다.

#### 다음 요청

ST-C01의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C02">
<summary>핵심 플레이 루프와 선택 설계 (studio:case:ST-C02)</summary>

플레이어가 반복할 행동과 의미 있는 선택을 시스템 명세로 만들 때 사용합니다.

#### 사용 시점

ST-C02의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C02 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C02를 작성해.

CLI
$game-design-studio:define-game-vision $game-design-studio:design-game-systems
$game-design-studio:design-player-experience
$game-design-studio:review-game-design [프로젝트 ID] [공개 정보] ST-C02의 fact,
inference, recommendation을 분리해.
```

#### 실행 흐름

`define-game-vision` → `design-game-systems` → `design-player-experience` → `review-game-design`

#### 예상 결과

`core-motivation-loop` → `system-specification` → `game-design-review`

#### 읽는 순서

`game-design/[프로젝트 ID]/core-motivation-loop/content.md` → `game-design/[프로젝트 ID]/core-motivation-loop/evidence.yml` → `game-design/[프로젝트 ID]/core-motivation-loop/export-manifest.yml`

#### 사람 검토

**읽는 순서:** `content.md`의 loop와 rule ID, `evidence.yml`의 관찰, `decisions/`의 대안 순서입니다. 중간 결과에서 모든 단계가 입력과 feedback을 갖고 실패 뒤 복구 가능한지 확인합니다. **사람 결정:** design owner와 player-protection owner가 의미 있는 선택, stop condition과 다음 prototype을 승인하거나 보류합니다. 자동화는 재미나 retention을 승인하지 않습니다.

#### 다음 요청

ST-C02의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C03">
<summary>규칙과 예외를 시스템 명세로 정리 (studio:case:ST-C03)</summary>

규칙이 충돌하거나 예외가 늘어날 때 상태와 데이터를 검토 가능한 표로 정리합니다.

#### 사용 시점

ST-C03의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C03 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C03를 작성해.

CLI
$game-design-studio:apply-document-quality-profile
$game-design-studio:design-game-systems
$game-design-studio:design-player-experience
$game-design-studio:review-game-design [프로젝트 ID] [공개 정보] ST-C03의 fact,
inference, recommendation을 분리해.
```

#### 실행 흐름

`apply-document-quality-profile` → `design-game-systems` → `design-player-experience` → `review-game-design`

#### 예상 결과

`system-specification` → `rule-exception-matrix` → `data-schema-table-contract`

#### 읽는 순서

`game-design/[프로젝트 ID]/system-specification/content.md` → `game-design/[프로젝트 ID]/system-specification/evidence.yml` → `game-design/[프로젝트 ID]/system-specification/export-manifest.yml`

#### 사람 검토

**읽는 순서:** system boundary → rule table → exception matrix → data mapping → evidence·decisions입니다. 중간 결과에서 rule ID마다 state, feedback, failure와 test case가 있는지 봅니다. **사람 결정:** design owner와 engineering owner가 authority, precedence, migration과 rollback을 승인합니다. reviewer finding과 lint는 자동 승인하지 않습니다.

#### 다음 요청

ST-C03의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C04">
<summary>화면 흐름과 접근성 점검 (studio:case:ST-C04)</summary>

온보딩과 UI 흐름이 헷갈릴 때 화면 상태와 접근성 기준을 함께 점검합니다.

#### 사용 시점

ST-C04의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C04 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C04를 작성해.

CLI
$game-design-studio:apply-document-quality-profile
$game-design-studio:design-player-experience
$game-design-studio:review-game-design
$game-design-studio:visualize-game-design [프로젝트 ID] [공개 정보] ST-C04의 fact,
inference, recommendation을 분리해.
```

#### 실행 흐름

`apply-document-quality-profile` → `design-player-experience` → `review-game-design` → `visualize-game-design`

#### 예상 결과

`ui-ux-flow-state` → `accessibility-platform-matrix` → `game-design-review`

#### 읽는 순서

`game-design/[프로젝트 ID]/ui-ux-flow-state/content.md` → `game-design/[프로젝트 ID]/ui-ux-flow-state/evidence.yml` → `game-design/[프로젝트 ID]/ui-ux-flow-state/export-manifest.yml`

#### 사람 검토

**읽는 순서:** user goal → critical action table → state coverage → platform matrix → evidence·decision입니다. 중간 결과에서 loading·empty·error·interruption과 대체 입력 누락을 먼저 봅니다. **사람 결정:** accessibility owner와 design owner가 지원 플랫폼, 검증 방법과 blocker를 승인·수정·보류합니다. mockup, renderer와 reviewer는 자동 승인하지 않습니다.

#### 다음 요청

ST-C04의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C05">
<summary>퀘스트와 캐릭터 콘텐츠 설계 (studio:case:ST-C05)</summary>

퀘스트, NPC, 전투 요소가 얽힐 때 선택과 결과가 보이는 콘텐츠 명세를 만듭니다.

#### 사용 시점

ST-C05의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C05 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C05를 작성해.

CLI
$game-design-studio:apply-document-quality-profile
$game-design-studio:design-game-content
$game-design-studio:design-game-systems
$game-design-studio:plan-game-production
$game-design-studio:review-game-design [프로젝트 ID] [공개 정보] ST-C05의 fact,
inference, recommendation을 분리해.
```

#### 실행 흐름

`apply-document-quality-profile` → `design-game-content` → `design-game-systems` → `plan-game-production` → `review-game-design`

#### 예상 결과

`narrative-quest-npc` → `character-skill-combat-monster` → `game-design-review`

#### 읽는 순서

`game-design/[프로젝트 ID]/narrative-quest-npc/content.md` → `game-design/[프로젝트 ID]/narrative-quest-npc/evidence.yml` → `game-design/[프로젝트 ID]/narrative-quest-npc/export-manifest.yml`

#### 사람 검토

**읽는 순서:** purpose → entry/state → choice·consequence → dependency → production·rights evidence → decisions입니다. 중간 결과에서 연결되지 않은 system/data ID와 근거 없는 제작 비용을 blocker로 봅니다. **사람 결정:** content owner, system owner, production owner와 권리 담당자가 분기, 범위, provenance·consent를 승인합니다. 생성된 서사나 이미지가 자동 승인되지는 않습니다.

#### 다음 요청

ST-C05의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C07">
<summary>성장·경제·라이브 운영 설계 (studio:case:ST-C07)</summary>

성장 보상과 이벤트 운영이 필요한 프로젝트에서 재화 흐름과 측정 기준을 정리합니다.

#### 사용 시점

ST-C07의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C07 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C07를 작성해.

CLI
$game-design-studio:apply-document-quality-profile
$game-design-studio:design-game-economy-and-liveops
$game-design-studio:design-game-systems $game-design-studio:review-game-design
[프로젝트 ID] [공개 정보] ST-C07의 fact, inference, recommendation을 분리해.
```

#### 실행 흐름

`apply-document-quality-profile` → `design-game-economy-and-liveops` → `design-game-systems` → `review-game-design`

#### 예상 결과

`economy-balance` → `liveops-experiment-event` → `game-design-review`

#### 읽는 순서

`game-design/[프로젝트 ID]/economy-balance/content.md` → `game-design/[프로젝트 ID]/economy-balance/evidence.yml` → `game-design/[프로젝트 ID]/economy-balance/export-manifest.yml`

#### 사람 검토

**읽는 순서:** resource flow → progression/recovery → price·probability evidence → experiment → guardrail·rollback → decisions입니다. 중간 결과에서 source 없는 수치, 다중 변수, 복구 불가 변경을 blocker로 봅니다. **사람 결정:** economy, LiveOps, policy와 accessibility owner가 실험 실행·중단·rollback을 승인합니다. simulation, telemetry 수집과 reviewer 권고는 자동 승인하지 않습니다.

#### 다음 요청

ST-C07의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="studio:case:ST-C08">
<summary>제작 범위와 출시 위험 점검 (studio:case:ST-C08)</summary>

일정과 인력이 불확실할 때 제작 범위, 의존성, 중단 기준을 검토합니다.

#### 사용 시점

ST-C08의 공개 가능한 가정과 검증 경계를 작업할 때 사용한다.

#### 준비 입력

ST-C08 공개 가능한 설계 경계

#### 복사할 요청문

```text
App
@Game Design Studio [프로젝트 ID] [공개 정보]의 fact, inference, recommendation을 분리해
ST-C08를 작성해.

CLI
$game-design-studio:plan-game-production
$game-design-studio:review-game-design $game-design-studio:plan-image-assets
$game-design-studio:visualize-game-design
$game-design-studio:export-game-design-documents [프로젝트 ID] [공개 정보] ST-C08의
fact, inference, recommendation을 분리해.
```

#### 실행 흐름

`plan-game-production` → `review-game-design` → `plan-image-assets` → `visualize-game-design` → `export-game-design-documents`

#### 예상 결과

`production-scope-risk` → `game-design-review` → `export-preparation-manifest`

#### 읽는 순서

`game-design/[프로젝트 ID]/production-scope-risk/content.md` → `game-design/[프로젝트 ID]/production-scope-risk/evidence.yml` → `game-design/[프로젝트 ID]/production-scope-risk/export-manifest.yml`

#### 사람 검토

**읽는 순서:** `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`. 중간 결과에서 blocker, capacity gap, image lifecycle, renderer capability와 형식별 QA를 따로 봅니다. **사람 결정:** production owner가 scope·kill, review decision owner가 finding disposition, rights/asset owner가 이미지 transition, export owner가 실제 format QA를 승인합니다. 생성, render, lint, reviewer finding과 state 문자열은 자동 승인하지 않습니다.

#### 다음 요청

ST-C08의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

### Career 학습·취업 사례 7개

게임 기획을 배우거나 취업을 준비하는 사람은 Career 사례로 역할, 증거와 다음 과제를 정리합니다. 각 사례는 멘토와 함께 검토할 수 있는 학습 또는 포트폴리오 Artifact를 만듭니다.

<details data-prompt-id="career:case:CA-C01">
<summary>기획 직무와 전문 분야 탐색 (career:case:CA-C01)</summary>

어떤 기획 직무를 목표로 할지 고민할 때 역할 후보와 학습 과제를 비교합니다.

#### 사용 시점

CA-C01의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C01를 작성해.

CLI
$game-design-career:apply-document-quality-profile
$game-design-career:map-game-design-career
$game-design-career:research-game-design-jobs [경력 ID] [공개 정보] CA-C01의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`apply-document-quality-profile` → `map-game-design-career` → `research-game-design-jobs`

#### 예상 결과

`game-design-role-map` → `learning-roadmap`

#### 읽는 순서

`game-design-career/[경력 ID]/career-stage-goal/content.md` → `game-design-career/[경력 ID]/career-stage-goal/evidence.yml` → `game-design-career/[경력 ID]/career-stage-goal/export-manifest.yml`

#### 사람 검토

**읽는 순서:** 목표 → evidence → gap → proof task → 결정 기록입니다. **검토 체크포인트:** `game-design-role-map` → `learning-roadmap` 순서로 읽고 역할 후보와 proof task의 연결을 확인합니다. **사람 결정:** 사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류합니다. 도구 실행은 자동 승인이 아닙니다.

#### 다음 요청

CA-C01의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-C04">
<summary>12주 역량 증거 계획 만들기 (career:case:CA-C04)</summary>

목표 직무에 필요한 역량을 12주 동안 증명할 과제로 나눌 때 사용합니다.

#### 사용 시점

CA-C04의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C04를 작성해.

CLI
$game-design-career:apply-document-quality-profile
$game-design-career:map-game-design-career
$game-design-career:visualize-career-roadmap
$game-design-career:export-career-documents [경력 ID] [공개 정보] CA-C04의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`apply-document-quality-profile` → `map-game-design-career` → `visualize-career-roadmap` → `export-career-documents`

#### 예상 결과

`competency-matrix` → `learning-roadmap`

#### 읽는 순서

`game-design-career/[경력 ID]/competency-matrix/content.md` → `game-design-career/[경력 ID]/competency-matrix/evidence.yml` → `game-design-career/[경력 ID]/competency-matrix/export-manifest.yml`

#### 사람 검토

**읽는 순서:** current evidence → gap → proof task → cadence → 결정입니다. **검토 체크포인트:** `competency-matrix` → `learning-roadmap` 순서로 읽고 gap과 proof task의 우선순위를 확인합니다. **사람 결정:** 작성자와 멘토가 우선순위, 가능한 범위와 공개 여부를 결정합니다. 계획 생성은 자동 승인을 하지 않으며 성장을 보장하지 않습니다.

#### 다음 요청

CA-C04의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-C05">
<summary>관찰을 근거로 역기획하기 (career:case:CA-C05)</summary>

공개 플레이 경험을 분석해 관찰과 추론을 구분한 역기획 문서를 만들 때 사용합니다.

#### 사용 시점

CA-C05의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C05를 작성해.

CLI
$game-design-career:apply-document-quality-profile
$game-design-career:reverse-engineer-game-design
$game-design-career:export-career-documents [경력 ID] [공개 정보] CA-C05의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`apply-document-quality-profile` → `reverse-engineer-game-design` → `export-career-documents`

#### 예상 결과

`reverse-design-document` → `game-analysis-report`

#### 읽는 순서

`game-design-career/[경력 ID]/reverse-design-document/content.md` → `game-design-career/[경력 ID]/reverse-design-document/evidence.yml` → `game-design-career/[경력 ID]/reverse-design-document/export-manifest.yml`

#### 사람 검토

**읽는 순서:** observation evidence ID → inference → proposal → 개인 기여 → public-rights review입니다. **검토 체크포인트:** `reverse-design-document` → `game-analysis-report` 순서로 읽고 관찰 evidence와 분석 claim을 확인합니다. **사람 결정:** 작성자와 public-rights reviewer가 공개 범위, 인용·capture 권리와 개인 기여 서술을 승인·수정·보류합니다. 분석은 자동 승인을 하지 않으며 품질, 채용 또는 공개를 보장하지 않습니다.

#### 다음 요청

CA-C05의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-C06">
<summary>창작 기획 포트폴리오 만들기 (career:case:CA-C06)</summary>

개인 기여를 보여 줄 새 기획 프로젝트를 포트폴리오 사례로 만들 때 사용합니다.

#### 사용 시점

CA-C06의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C06를 작성해.

CLI
$game-design-career:apply-document-quality-profile
$game-design-career:build-game-design-portfolio
$game-design-career:review-game-design-portfolio [경력 ID] [공개 정보] CA-C06의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`apply-document-quality-profile` → `build-game-design-portfolio` → `review-game-design-portfolio`

#### 예상 결과

`portfolio-project-brief` → `creative-design-portfolio`

#### 읽는 순서

`game-design-career/[경력 ID]/portfolio-project-brief/content.md` → `game-design-career/[경력 ID]/portfolio-project-brief/evidence.yml` → `game-design-career/[경력 ID]/portfolio-project-brief/export-manifest.yml`

#### 사람 검토

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review입니다. **검토 체크포인트:** `portfolio-project-brief` → `creative-design-portfolio` 순서로 읽고 개인 기여와 공개 claim을 확인합니다. **사람 결정:** 작성자, portfolio reviewer, public-rights reviewer가 공개 가능한 claim과 asset을 결정합니다. 생성 결과는 자동 승인을 하지 않으며 포트폴리오 품질이나 채용을 보장하지 않습니다.

#### 다음 요청

CA-C06의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-C07">
<summary>포트폴리오를 다섯 축으로 점검 (career:case:CA-C07)</summary>

포트폴리오의 빈틈을 찾아 수정 순서와 발표 문장을 정리할 때 사용합니다.

#### 사용 시점

CA-C07의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C07를 작성해.

CLI
$game-design-career:review-game-design-portfolio
$game-design-career:build-game-design-portfolio
$game-design-career:practice-game-design-interview
$game-design-career:export-career-documents [경력 ID] [공개 정보] CA-C07의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`review-game-design-portfolio` → `build-game-design-portfolio` → `practice-game-design-interview` → `export-career-documents`

#### 예상 결과

`five-axis-review` → `portfolio-backlog` → `introduction-motivation`

#### 읽는 순서

`game-design-career/[경력 ID]/five-axis-review/content.md` → `game-design-career/[경력 ID]/five-axis-review/evidence.yml` → `game-design-career/[경력 ID]/five-axis-review/export-manifest.yml`

#### 사람 검토

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → backlog입니다. **검토 체크포인트:** `five-axis-review` → `portfolio-backlog` → `introduction-motivation` 순서로 읽고 finding, repair, 발표 claim을 확인합니다. **사람 결정:** 작성자, portfolio reviewer, public-rights reviewer와 멘토가 수정·발표·공개 범위를 결정합니다. review는 자동 승인을 하지 않으며 합격, 시장 반응 또는 팀 성과를 보장하지 않습니다.

#### 다음 요청

CA-C07의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-C08">
<summary>면접 답변과 성장 과제 정리 (career:case:CA-C08)</summary>

면접 답변의 근거를 보강하고 다음 성장 과제를 정할 때 사용합니다.

#### 사용 시점

CA-C08의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-C08를 작성해.

CLI
$game-design-career:practice-game-design-interview
$game-design-career:plan-junior-growth
$game-design-career:visualize-career-roadmap
$game-design-career:export-career-documents [경력 ID] [공개 정보] CA-C08의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`practice-game-design-interview` → `plan-junior-growth` → `visualize-career-roadmap` → `export-career-documents`

#### 예상 결과

`interview-question-answer-log` → `junior-growth-review` → `transition-readiness`

#### 읽는 순서

`game-design-career/[경력 ID]/interview-question-answer-log/content.md` → `game-design-career/[경력 ID]/interview-question-answer-log/evidence.yml` → `game-design-career/[경력 ID]/interview-question-answer-log/export-manifest.yml`

#### 사람 검토

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → feedback입니다. **검토 체크포인트:** `interview-question-answer-log` → `junior-growth-review` → `transition-readiness` 순서로 읽고 honest gap, feedback, 다음 proof task를 확인합니다. **사람 결정:** 작성자와 멘토·manager·career reviewer, public-rights reviewer가 공개 범위와 다음 task를 결정합니다. 이 기록은 자동 승인을 하지 않으며 채용, 승진, 이직, 팀 기여 또는 시장 가치를 보장하지 않습니다.

#### 다음 요청

CA-C08의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="career:case:CA-T01">
<summary>역할 선택부터 학습 계획까지 설계 (career:case:CA-T01)</summary>

관심 분야를 고른 뒤 역량 격차와 학습 순서를 한 번에 정리할 때 사용합니다.

#### 사용 시점

CA-T01의 공개 가능한 evidence와 canonical artifact가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence와 작업 범위

#### 복사할 요청문

```text
App
@Game Design Career [경력 ID] [공개 정보]의 fact, inference, recommendation을 분리해
CA-T01를 작성해.

CLI
$game-design-career:map-game-design-career
$game-design-career:build-game-design-portfolio
$game-design-career:plan-junior-growth [경력 ID] [공개 정보] CA-T01의 fact,
inference, recommendation을 작성해.
```

#### 실행 흐름

`map-game-design-career` → `build-game-design-portfolio` → `plan-junior-growth`

#### 예상 결과

`game-design-role-map` → `competency-matrix` → `learning-roadmap`

#### 읽는 순서

`game-design-career/[경력 ID]/game-design-role-map/content.md` → `game-design-career/[경력 ID]/game-design-role-map/evidence.yml` → `game-design-career/[경력 ID]/game-design-role-map/export-manifest.yml`

#### 사람 검토

**읽는 순서:** 상태표 → 규칙표 → 반례 → 다음 질문입니다. **검토 체크포인트:** `game-design-role-map` → `competency-matrix` → `learning-roadmap` 순서로 읽고 상태와 예외의 근거를 확인합니다. **사람 결정:** 시스템 기획 멘토가 규칙과 예외의 범위를 읽고 질문을 남깁니다. 스킬 실행은 자동 승인을 하지 않으며 실제 역할 적합성을 확정하지 않습니다.

#### 다음 요청

CA-T01의 보존 artifact와 blocker receipt를 읽고 공개 정보만으로 재개해.

</details>

### Studio와 Career 연계 사례 4개

제작 기획을 경력 증거, 발표 자료 또는 재개 계획으로 연결하려면 연계 사례를 고릅니다. 각 사례는 공개 범위와 이름 있는 사람의 승인 지점을 보존한 인계 Artifact를 만듭니다.

<details data-prompt-id="suite:studio-to-career-handoff:case">
<summary>제작 결과를 포트폴리오 증거로 연결 (suite:studio-to-career-handoff:case)</summary>

Studio 기획 결과에서 공개 가능한 문제, 판단, 검증 근거를 포트폴리오로 옮길 때 사용합니다.

#### 사용 시점

두 제품의 canonical artifact handoff가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence summary

#### 복사할 요청문

```text
App
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 fact, inference,
recommendation으로 분리해 studio-to-career-handoff handoff를 작성해.

CLI
$game-design-studio:review-game-design
$game-design-career:build-game-design-portfolio [공개 정보]
studio-to-career-handoff handoff의 fact, inference, recommendation을 작성해.
```

#### 실행 흐름

`review-game-design` → `build-game-design-portfolio`

#### 예상 결과

`공개 가능한 문제·판단·검증 summary`

#### 읽는 순서

`suite/studio-to-career-handoff/content.md` → `suite/studio-to-career-handoff/evidence.yml` → `suite/studio-to-career-handoff/export-manifest.yml`

#### 사람 검토

named human decision owner가 studio-to-career-handoff handoff의 공개 범위를 승인 또는 보류한다.

#### 다음 요청

studio-to-career-handoff의 보존 파일과 blocker를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="suite:career-proof-project-interview:case">
<summary>프로젝트 증거를 면접 답변으로 연결 (suite:career-proof-project-interview:case)</summary>

시스템 기획 과제를 12주 증거 계획과 면접 답변으로 연결할 때 사용합니다.

#### 사용 시점

두 제품의 canonical artifact handoff가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence summary

#### 복사할 요청문

```text
App
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 fact, inference,
recommendation으로 분리해 career-proof-project-interview handoff를 작성해.

CLI
$game-design-career:map-game-design-career
$game-design-studio:design-game-systems
$game-design-career:practice-game-design-interview [공개 정보]
career-proof-project-interview handoff의 fact, inference, recommendation을 작성해.
```

#### 실행 흐름

`map-game-design-career` → `design-game-systems` → `practice-game-design-interview`

#### 예상 결과

`12주 proof와 evidence-linked 답변`

#### 읽는 순서

`suite/career-proof-project-interview/content.md` → `suite/career-proof-project-interview/evidence.yml` → `suite/career-proof-project-interview/export-manifest.yml`

#### 사람 검토

named human decision owner가 career-proof-project-interview handoff의 공개 범위를 승인 또는 보류한다.

#### 다음 요청

career-proof-project-interview의 보존 파일과 blocker를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="suite:gdd-image-presentation:case">
<summary>기획서와 이미지·발표 자료 함께 준비 (suite:gdd-image-presentation:case)</summary>

기획서, 승인된 이미지, 발표 자료를 같은 검토 경계 안에서 준비할 때 사용합니다.

#### 사용 시점

두 제품의 canonical artifact handoff가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence summary

#### 복사할 요청문

```text
App
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 fact, inference,
recommendation으로 분리해 gdd-image-presentation handoff를 작성해.

CLI
$game-design-studio:orchestrate-game-design-project
$game-design-studio:plan-image-assets $game-design-studio:review-image-assets
$game-design-studio:export-game-design-documents [공개 정보]
gdd-image-presentation handoff의 fact, inference, recommendation을 작성해.
```

#### 실행 흐름

`orchestrate-game-design-project` → `plan-image-assets` → `review-image-assets` → `export-game-design-documents`

#### 예상 결과

`content.md, approved images, PPTX preflight`

#### 읽는 순서

`suite/gdd-image-presentation/content.md` → `suite/gdd-image-presentation/evidence.yml` → `suite/gdd-image-presentation/export-manifest.yml`

#### 사람 검토

named human decision owner가 gdd-image-presentation handoff의 공개 범위를 승인 또는 보류한다.

#### 다음 요청

gdd-image-presentation의 보존 파일과 blocker를 읽고 공개 정보만으로 재개해.

</details>

<details data-prompt-id="suite:resume-failed-derivatives:case">
<summary>막힌 이미지·문서 출력 안전하게 재개 (suite:resume-failed-derivatives:case)</summary>

이미지나 내보내기가 막혔을 때 보존 파일과 blocker를 확인해 필요한 작업만 재개합니다.

#### 사용 시점

두 제품의 canonical artifact handoff가 필요할 때 사용한다.

#### 준비 입력

공개 가능한 evidence summary

#### 복사할 요청문

```text
App
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 fact, inference,
recommendation으로 분리해 resume-failed-derivatives handoff를 작성해.

CLI
$game-design-studio:plan-image-assets
$game-design-studio:generate-image-assets
$game-design-studio:review-image-assets
$game-design-studio:export-game-design-documents
$game-design-career:export-career-documents [공개 정보] canonical artifact, failed
image/export blocker, retry receipt를 fact, inference, recommendation으로 기록해.
```

#### 실행 흐름

`plan-image-assets` → `generate-image-assets` → `review-image-assets` → `export-game-design-documents` → `export-career-documents`

#### 예상 결과

`보존 파일, blocker, resume receipt`

#### 읽는 순서

`suite/resume-failed-derivatives/content.md` → `suite/resume-failed-derivatives/evidence.yml` → `suite/resume-failed-derivatives/export-manifest.yml`

#### 사람 검토

named human decision owner가 resume-failed-derivatives handoff의 공개 범위를 승인 또는 보류한다.

#### 다음 요청

resume-failed-derivatives의 보존 파일과 blocker를 읽고 공개 정보만으로 재개해.

</details>

### [전체 146개 요청문 찾기](guides/prompt-templates/README.md)

사용자 유형, 난이도와 결과를 기준으로 production catalog 전체를 찾을 수 있습니다.

## 스킬별로 바로 실행하기

오케스트레이터가 필요 없는 좁은 작업에서는 설치 namespace를 붙여 스킬을 직접 호출하세요. [Studio 스킬 인덱스](guides/game-design-studio/skills/README.md)와 [Career 스킬 인덱스](guides/game-design-career/skills/README.md)에서 입력 계약을 먼저 확인할 수 있습니다.

### 직접 스킬 빠른 참조

작업 범위가 한 행에 머물고 필요한 입력을 제공할 수 있을 때 직접 호출합니다.

| 작업 그룹 | Studio 스킬·직접 호출 조건·대표 결과 | Career 스킬·직접 호출 조건·대표 결과 |
| --- | --- | --- |
| 전체 조율 | `orchestrate-game-design-project`: 여러 분야를 연결할 때 호출, `game-design-brief` | `orchestrate-game-design-career`: 경력 단계와 여러 작업을 연결할 때 호출, `game-design-career-plan` |
| 탐색·분석 | `review-game-design`: 기존 Artifact의 근거와 위험을 분석할 때 호출, `game-design-review` | `research-game-design-jobs`, `reverse-engineer-game-design`: 최신 공고 또는 관찰 자료가 있을 때 호출, `job-research-evidence`, `reverse-design-document` |
| 핵심 설계 | `define-game-vision`, `design-game-systems`: 비전 또는 규칙 범위가 정해졌을 때 호출, `vision-pillars`, `system-specification` | `map-game-design-career`, `plan-junior-growth`: 목표 역할 또는 성장 기간을 비교할 때 호출, `competency-matrix`, `learning-roadmap` |
| 콘텐츠·경험 | `design-game-content`, `design-player-experience`: 콘텐츠 단위나 UX 흐름이 정해졌을 때 호출, `narrative-quest-npc`, `ui-ux-flow-state` | `build-game-design-portfolio`, `practice-game-design-interview`: 공개 증거나 공고가 있을 때 호출, `creative-design-portfolio`, `interview-question-answer-log` |
| 검토·품질 | `review-game-design`, `apply-document-quality-profile`: Artifact 또는 출력 목적이 있을 때 호출, 검토 보고서와 품질 profile | `review-game-design-portfolio`, `apply-document-quality-profile`: 증거 패키지 또는 출력 목적이 있을 때 호출, 포트폴리오 검토와 품질 profile |
| 이미지·도식·출력 | 이미지 계획·생성·검토, `visualize-game-design`, `export-game-design-documents`: 승인된 기준 문서가 있을 때 호출, SVG·PNG·내보내기 manifest | 이미지 계획·생성·검토, `visualize-career-roadmap`, `export-career-documents`: 승인된 기준 문서가 있을 때 호출, SVG·PNG·내보내기 manifest |

각 제품은 제품 스킬 14개와 Skillstead에서 가져온 vendored `svg-infographic` 1개를 설치하므로 총 15개가 됩니다. `svg-infographic`는 제품 디렉터리가 아니라 표준 빌드가 번들하는 설치 스킬입니다.

<details>
<summary>Studio 설치 스킬 전체 보기</summary>

### Studio 설치 스킬 15개

| 스킬 이름과 ID | 직접 호출 | 쉬운 역할 설명 | 상세 가이드 |
| --- | --- | --- | --- |
| 문서 품질 기준 적용 (`apply-document-quality-profile`) | `$game-design-studio:apply-document-quality-profile` | 문서 목적과 형식에 맞는 품질 기준을 고정하고 선택 기록을 만듭니다. | [apply-document-quality-profile 상세 가이드](guides/game-design-studio/skills/apply-document-quality-profile.md) |
| 게임 비전 정의 (`define-game-vision`) | `$game-design-studio:define-game-vision` | 대상 플레이어, 핵심 재미와 검증 기준을 정리해 비전 기둥을 만듭니다. | [define-game-vision 상세 가이드](guides/game-design-studio/skills/define-game-vision.md) |
| 게임 콘텐츠 설계 (`design-game-content`) | `$game-design-studio:design-game-content` | 퀘스트, 레벨, 조우와 캐릭터를 제작 가능한 콘텐츠 명세로 만듭니다. | [design-game-content 상세 가이드](guides/game-design-studio/skills/design-game-content.md) |
| 경제와 라이브 운영 설계 (`design-game-economy-and-liveops`) | `$game-design-studio:design-game-economy-and-liveops` | 재화 흐름, 성장, 보상과 운영 결정을 경제 명세로 만듭니다. | [design-game-economy-and-liveops 상세 가이드](guides/game-design-studio/skills/design-game-economy-and-liveops.md) |
| 게임 시스템 설계 (`design-game-systems`) | `$game-design-studio:design-game-systems` | 규칙, 상태, 우선순위, 예외와 데이터 관계를 시스템 명세로 만듭니다. | [design-game-systems 상세 가이드](guides/game-design-studio/skills/design-game-systems.md) |
| 플레이어 경험 설계 (`design-player-experience`) | `$game-design-studio:design-player-experience` | 정보 구조, 상호작용, 온보딩과 접근성 흐름을 정리합니다. | [design-player-experience 상세 가이드](guides/game-design-studio/skills/design-player-experience.md) |
| 기획 문서 내보내기 준비 (`export-game-design-documents`) | `$game-design-studio:export-game-design-documents` | 검증된 Artifact의 MD, PDF, DOCX, PPTX 준비 상태를 기록합니다. | [export-game-design-documents 상세 가이드](guides/game-design-studio/skills/export-game-design-documents.md) |
| 이미지 자산 생성 (`generate-image-assets`) | `$game-design-studio:generate-image-assets` | 승인된 목록의 선택 작업만 생성하고 제공자 상태를 기록합니다. | [generate-image-assets 상세 가이드](guides/game-design-studio/skills/generate-image-assets.md) |
| 게임 기획 프로젝트 조율 (`orchestrate-game-design-project`) | `$game-design-studio:orchestrate-game-design-project` | 여러 기획 분야의 범위, 순서와 검토 지점을 프로젝트 브리프로 묶습니다. | [orchestrate-game-design-project 상세 가이드](guides/game-design-studio/skills/orchestrate-game-design-project.md) |
| 게임 제작 계획 (`plan-game-production`) | `$game-design-studio:plan-game-production` | 시제품 기준, 의존성, 담당자와 중단 기준을 제작 계획으로 만듭니다. | [plan-game-production 상세 가이드](guides/game-design-studio/skills/plan-game-production.md) |
| 이미지 자산 계획 (`plan-image-assets`) | `$game-design-studio:plan-image-assets` | 기준 문서에서 이미지 목록, 프롬프트 묶음과 자리표시자를 만듭니다. | [plan-image-assets 상세 가이드](guides/game-design-studio/skills/plan-image-assets.md) |
| 게임 기획 검토 (`review-game-design`) | `$game-design-studio:review-game-design` | 근거, 위험과 막힌 지점을 검토해 최소 수정이 담긴 검토 문서를 만듭니다. | [review-game-design 상세 가이드](guides/game-design-studio/skills/review-game-design.md) |
| 이미지 자산 검토 (`review-image-assets`) | `$game-design-studio:review-image-assets` | 시각 품질, 접근성, 권리와 배치를 검토해 사람의 결정을 요청합니다. | [review-image-assets 상세 가이드](guides/game-design-studio/skills/review-image-assets.md) |
| 기획 도식 만들기 (`svg-infographic`) | `$game-design-studio:svg-infographic` | Skillstead 0.8.3에서 번들된 스킬로 편집 가능한 SVG와 검증용 PNG를 만듭니다. | [svg-infographic 상세 가이드](guides/game-design-studio/skills/svg-infographic.md) |
| 게임 기획 시각화 (`visualize-game-design`) | `$game-design-studio:visualize-game-design` | 루프, 상태, 흐름과 의존성을 접근 가능한 SVG와 PNG 도식으로 만듭니다. | [visualize-game-design 상세 가이드](guides/game-design-studio/skills/visualize-game-design.md) |

</details>

<details>
<summary>Career 설치 스킬 전체 보기</summary>

### Career 설치 스킬 15개

| 스킬 이름과 ID | 직접 호출 | 쉬운 역할 설명 | 상세 가이드 |
| --- | --- | --- | --- |
| 경력 문서 품질 기준 적용 (`apply-document-quality-profile`) | `$game-design-career:apply-document-quality-profile` | 경력 문서 목적과 형식에 맞는 품질 기준과 선택 기록을 만듭니다. | [apply-document-quality-profile 상세 가이드](guides/game-design-career/skills/apply-document-quality-profile.md) |
| 기획 포트폴리오 만들기 (`build-game-design-portfolio`) | `$game-design-career:build-game-design-portfolio` | 공개 가능한 판단, 개인 기여와 검증을 포트폴리오 사례로 만듭니다. | [build-game-design-portfolio 상세 가이드](guides/game-design-career/skills/build-game-design-portfolio.md) |
| 경력 문서 내보내기 준비 (`export-career-documents`) | `$game-design-career:export-career-documents` | Career Artifact의 MD, PDF, DOCX, PPTX 준비 상태를 기록합니다. | [export-career-documents 상세 가이드](guides/game-design-career/skills/export-career-documents.md) |
| 경력 이미지 자산 생성 (`generate-image-assets`) | `$game-design-career:generate-image-assets` | 승인된 이미지 목록의 선택 작업만 생성하고 제공자 상태를 기록합니다. | [generate-image-assets 상세 가이드](guides/game-design-career/skills/generate-image-assets.md) |
| 게임 기획 경력 지도 만들기 (`map-game-design-career`) | `$game-design-career:map-game-design-career` | 역할군, 목표 수준과 역량 격차를 비교해 경력 지도를 만듭니다. | [map-game-design-career 상세 가이드](guides/game-design-career/skills/map-game-design-career.md) |
| 게임 기획 경력 조율 (`orchestrate-game-design-career`) | `$game-design-career:orchestrate-game-design-career` | 경력 단계, 작업 순서와 검토를 하나의 경력 계획으로 묶습니다. | [orchestrate-game-design-career 상세 가이드](guides/game-design-career/skills/orchestrate-game-design-career.md) |
| 경력 이미지 자산 계획 (`plan-image-assets`) | `$game-design-career:plan-image-assets` | Career Artifact에서 이미지 목록, 프롬프트 묶음과 자리표시자를 만듭니다. | [plan-image-assets 상세 가이드](guides/game-design-career/skills/plan-image-assets.md) |
| 주니어 성장 계획 (`plan-junior-growth`) | `$game-design-career:plan-junior-growth` | 분기 목표, 증거 과제와 피드백 주기를 성장 계획으로 만듭니다. | [plan-junior-growth 상세 가이드](guides/game-design-career/skills/plan-junior-growth.md) |
| 게임 기획 면접 연습 (`practice-game-design-interview`) | `$game-design-career:practice-game-design-interview` | 공고와 포트폴리오 근거를 질문, 답변과 피드백 기록으로 연결합니다. | [practice-game-design-interview 상세 가이드](guides/game-design-career/skills/practice-game-design-interview.md) |
| 게임 기획 채용 조사 (`research-game-design-jobs`) | `$game-design-career:research-game-design-jobs` | 최신 공고와 회사 근거를 모아 요구사항과 지원자 격차를 기록합니다. | [research-game-design-jobs 상세 가이드](guides/game-design-career/skills/research-game-design-jobs.md) |
| 게임 기획 역기획 (`reverse-engineer-game-design`) | `$game-design-career:reverse-engineer-game-design` | 공개 관찰과 추론을 분리해 검토 가능한 역기획 문서를 만듭니다. | [reverse-engineer-game-design 상세 가이드](guides/game-design-career/skills/reverse-engineer-game-design.md) |
| 기획 포트폴리오 검토 (`review-game-design-portfolio`) | `$game-design-career:review-game-design-portfolio` | 증거, 개인 기여, 권리와 수정 우선순위를 포트폴리오 검토 문서로 만듭니다. | [review-game-design-portfolio 상세 가이드](guides/game-design-career/skills/review-game-design-portfolio.md) |
| 경력 이미지 자산 검토 (`review-image-assets`) | `$game-design-career:review-image-assets` | 시각 품질, 접근성, 권리와 배치를 검토해 사람의 결정을 요청합니다. | [review-image-assets 상세 가이드](guides/game-design-career/skills/review-image-assets.md) |
| 경력 도식 만들기 (`svg-infographic`) | `$game-design-career:svg-infographic` | Skillstead 0.8.3에서 번들된 스킬로 편집 가능한 SVG와 검증용 PNG를 만듭니다. | [svg-infographic 상세 가이드](guides/game-design-career/skills/svg-infographic.md) |
| 경력 성장 경로 시각화 (`visualize-career-roadmap`) | `$game-design-career:visualize-career-roadmap` | 역할, 역량, 학습 의존성과 성장 경로를 SVG와 PNG 도식으로 만듭니다. | [visualize-career-roadmap 상세 가이드](guides/game-design-career/skills/visualize-career-roadmap.md) |

</details>

에이전트는 사용자가 직접 호출하는 스킬 command가 아닙니다. 오케스트레이터 또는 전문 스킬이 검토·설계 질문을 위임하고, 에이전트는 finding과 권고만 반환합니다.

<details>
<summary>Studio 에이전트 전체 보기</summary>

### Studio 에이전트 9개

| 에이전트 역할과 ID | 쉬운 역할 설명 | 검토 초점 | 호출 경계 | 역할 문서 |
| --- | --- | --- | --- | --- |
| 이미지 기획 총괄 (`art-brief-director`) | 이미지 목적과 프롬프트 초안을 읽고 빠진 요구사항을 찾습니다. | 목적·가독성·prompt·variant | 이미지 전문 스킬이 전문가에게 위임 | [art-brief-director 역할 문서](plugins/game-design-studio/agents/art-brief-director.md) |
| 콘텐츠와 서사 설계자 (`content-narrative-designer`) | 콘텐츠 선택이 시스템과 제작 범위에 맞는지 검토합니다. | 시스템 의존성·선택·결과·제작 권리 | 오케스트레이터가 콘텐츠 전문가에게 위임 | [content-narrative-designer 역할 문서](plugins/game-design-studio/agents/content-narrative-designer.md) |
| 문서 품질 편집자 (`document-quality-editor`) | 문서 구조와 발표 흐름이 읽기 쉬운지 점검합니다. | checklist·PPT story contract·최소 구조 수정 | 품질 전문 스킬이 전문가에게 위임 | [document-quality-editor 역할 문서](plugins/game-design-studio/agents/document-quality-editor.md) |
| 수석 게임 기획자 (`lead-game-designer`) | 비전과 결정이 서로 어긋나지 않는지 전체 기준으로 검토합니다. | 비전·일관성·의사결정·검토 게이트 | 오케스트레이터가 수석 전문가에게 위임 | [lead-game-designer 역할 문서](plugins/game-design-studio/agents/lead-game-designer.md) |
| 라이브 운영 데이터 설계자 (`liveops-data-designer`) | 운영 지표와 실험이 성장·경제 설계와 연결되는지 확인합니다. | 지표·실험·세분화·중단 기준 | 경제 전문 스킬이 전문가에게 위임 | [liveops-data-designer 역할 문서](plugins/game-design-studio/agents/liveops-data-designer.md) |
| 제작 가능성 비평가 (`production-feasibility-critic`) | 일정, 인력과 의존성을 기준으로 제작 가능한 범위를 점검합니다. | 범위·의존성·effort 근거·kill criteria | 오케스트레이터가 제작 전문가에게 위임 | [production-feasibility-critic 역할 문서](plugins/game-design-studio/agents/production-feasibility-critic.md) |
| 시스템과 경제 설계자 (`system-economy-designer`) | 규칙, 재화와 악용 가능성을 함께 살펴 시스템 균형을 검토합니다. | 규칙·상태·재화 흐름·악용 가능성 | 시스템 또는 경제 전문 스킬이 전문가에게 위임 | [system-economy-designer 역할 문서](plugins/game-design-studio/agents/system-economy-designer.md) |
| UX와 접근성 검토자 (`ux-accessibility-reviewer`) | 입력, 피드백과 접근성 문제가 화면 흐름에 없는지 점검합니다. | 상태 coverage·입력·피드백·접근성 | 경험 설계 전문 스킬이 전문가에게 위임 | [ux-accessibility-reviewer 역할 문서](plugins/game-design-studio/agents/ux-accessibility-reviewer.md) |
| 시각 자산 검토자 (`visual-asset-reviewer`) | 이미지가 읽기 쉽고 권리와 배치 기준을 지키는지 검토합니다. | 가독성·alt text·권리·배치 | 이미지 검토 전문 스킬이 전문가에게 위임 | [visual-asset-reviewer 역할 문서](plugins/game-design-studio/agents/visual-asset-reviewer.md) |

</details>

<details>
<summary>Career 에이전트 전체 보기</summary>

### Career 에이전트 9개

| 에이전트 역할과 ID | 쉬운 역할 설명 | 검토 초점 | 호출 경계 | 역할 문서 |
| --- | --- | --- | --- | --- |
| 경력 이미지 기획 총괄 (`art-brief-director`) | 포트폴리오 이미지의 근거와 프롬프트 초안을 검토합니다. | 근거 보존·가독성·prompt·variant | 이미지 전문 스킬이 전문가에게 위임 | [art-brief-director 역할 문서](plugins/game-design-career/agents/art-brief-director.md) |
| 경력 전략가 (`career-strategist`) | 목표 직무와 현실적인 선택지를 비교해 경력 방향을 점검합니다. | tradeoff·제약·근거 순서·일반화 방지 | 오케스트레이터가 경력 전문가에게 위임 | [career-strategist 역할 문서](plugins/game-design-career/agents/career-strategist.md) |
| 경력 문서 품질 편집자 (`document-quality-editor`) | 증거가 빠지지 않고 문서와 발표 흐름이 읽히는지 확인합니다. | checklist·PPT story contract·증거 보존 | 품질 전문 스킬이 전문가에게 위임 | [document-quality-editor 역할 문서](plugins/game-design-career/agents/document-quality-editor.md) |
| 근거 감사자 (`evidence-auditor`) | 출처, 최신성, 권리와 근거 연결이 충분한지 살펴봅니다. | freshness·primary source·provenance·권리 | 조사 또는 검토 전문 스킬이 전문가에게 위임 | [evidence-auditor 역할 문서](plugins/game-design-career/agents/evidence-auditor.md) |
| 게임 기획 멘토 (`game-design-mentor`) | 학습 목표와 연습 과제가 목표 직무에 맞는지 검토합니다. | 요구 역량·연습·artifact·feedback | 오케스트레이터가 멘토 전문가에게 위임 | [game-design-mentor 역할 문서](plugins/game-design-career/agents/game-design-mentor.md) |
| 면접 코치 (`interview-coach`) | 답변의 주장과 근거가 연결되는지 확인하고 보완 질문을 남깁니다. | claim·evidence·선택·대안·정직한 gap | 면접 전문 스킬이 전문가에게 위임 | [interview-coach 역할 문서](plugins/game-design-career/agents/interview-coach.md) |
| 포트폴리오 검토자 (`portfolio-reviewer`) | 개인 기여와 공개 가능한 증거가 선명한지 검토합니다. | 역량 증거·개인 기여·inspectability·권리 | 포트폴리오 전문 스킬이 전문가에게 위임 | [portfolio-reviewer 역할 문서](plugins/game-design-career/agents/portfolio-reviewer.md) |
| 역기획 비평가 (`reverse-design-critic`) | 관찰과 추론을 구분하고 반례 검증이 가능한지 점검합니다. | 관찰·추론·반례·검증 방법 | 역기획 전문 스킬이 전문가에게 위임 | [reverse-design-critic 역할 문서](plugins/game-design-career/agents/reverse-design-critic.md) |
| 경력 시각 자산 검토자 (`visual-asset-reviewer`) | 공개할 이미지의 가독성, 대체 텍스트와 권리를 검토합니다. | 가독성·alt text·권리·배치 | 이미지 검토 전문 스킬이 전문가에게 위임 | [visual-asset-reviewer 역할 문서](plugins/game-design-career/agents/visual-asset-reviewer.md) |

</details>

## 요청 뒤에 생성되는 결과물

모든 주요 결과는 Canonical Artifact 폴더에 기준 내용, 근거, 결정, 자산과 내보내기 상태를 함께 보존합니다.

```text
project-artifact/
├── content.md
├── evidence.yml
├── decisions/
├── assets/
└── export-manifest.yml
```

| 결과 층 | 생성 조건 | 예시 | 검토 방법 |
| --- | --- | --- | --- |
| 최소 결과 | 요청 범위와 검증이 성립할 때 | `content.md`, `evidence.yml`, 결정 기록 | 내용, 근거와 미정 항목을 먼저 읽습니다. |
| 선택 결과 | 요청하거나 관계 설명이 필요할 때 | Skillstead SVG·PNG, 이미지 prompt package | 의미, 레이블, 권리와 배치를 검토합니다. |
| 확장 결과 | renderer와 형식별 QA가 통과할 때 | MD, PDF, DOCX, PPTX | 기준 Markdown과 내용·페이지·폰트를 대조합니다. |

MD는 항상 보존합니다. PDF, DOCX와 PPTX는 renderer와 시각적 품질 보증(visual QA)이 모두 필요합니다.

### 결과 예시 6종

각 행의 생성 폴더는 핵심 파일 칸에 함께 표시합니다. 선택 자산과 검토 결과는 이름 있는 사람의 승인 전까지 보류합니다.

| 결과 이름과 ID | 핵심 파일 | 선택 자산 | 읽는 순서 | 승인 전 보류 경계 |
| --- | --- | --- | --- | --- |
| 게임 기획 브리프 (`game-design-brief`) | 생성 폴더 `game-design/[프로젝트 ID]/game-design-brief/`, 핵심 파일 `content.md` | 비전 도식·concept 이미지 | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |
| 시스템 명세서 (`system-specification`) | 생성 폴더 `game-design/[프로젝트 ID]/system-specification/`, 핵심 파일 `content.md` | 상태 전이 SVG·PNG | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |
| UI·UX 흐름과 상태표 (`ui-ux-flow-state`) | 생성 폴더 `game-design/[프로젝트 ID]/ui-ux-flow-state/`, 핵심 파일 `content.md` | UX flow·화면 이미지 | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |
| 관찰 기반 역기획 문서 (`reverse-design-document`) | 생성 폴더 `game-design-career/[경력 ID]/reverse-design-document/`, 핵심 파일 `content.md` | 관찰 도식·공개 screenshot | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |
| 창작 기획 포트폴리오 (`creative-design-portfolio`) | 생성 폴더 `game-design-career/[경력 ID]/creative-design-portfolio/`, 핵심 파일 `content.md` | 포트폴리오 도식·발표 자산 | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |
| 문서 내보내기 준비 목록 (`export-preparation-manifest`) | 생성 폴더 `project-artifact/export-preparation-manifest/`, 핵심 파일 `content.md` | PDF·DOCX·PPTX 파생 후보 | `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` | 이미지·파생 문서·검토 결과는 사람 승인 전 보류하며 자동 승인되지 않습니다. |

## 플러그인 구조와 전체 시스템 아키텍처

`products/<product>/plugin/`은 편집 원본이고 `plugins/<product>/`는 표준 빌드가 만드는 generated snapshot입니다. Generated tree는 수정 대상이 아니며 manifest는 빌드에서만 갱신합니다.

### Studio 설치 패키지 tree

Studio snapshot은 에이전트 9개, 설치 스킬 15개, 템플릿 15개와 지원 script 14개를 포함합니다.

```text
plugins/game-design-studio/
├── .codex-plugin/plugin.json   # 플러그인 manifest
├── agents/                     # 전문 에이전트 9개
├── skills/                     # 제품 스킬 14개 + Skillstead 1개
├── assets/
│   ├── templates/              # Canonical Artifact 템플릿 15개
│   └── shared/                 # 공통 템플릿·지원 자산
├── references/
│   ├── document-quality/       # 문서 품질 profile·preset
│   ├── methods/                # 기획 방법 reference
│   ├── shared/                 # 공통 계약과 책임 설계
│   └── source/                 # 근거 문서의 설치 snapshot
├── scripts/                    # 검증·이미지·내보내기 script 14개
├── hooks/hooks.json            # 중단·검토 hook
├── .env.example                # 이미지 생성 설정 예시
├── README.md
└── BUILD-MANIFEST.json         # 생성 snapshot 무결성
# assets/templates/ 및 assets/shared/는 위 assets/ 하위 경로입니다.
authoring source: products/game-design-studio/plugin/
generated snapshot: plugins/game-design-studio/
```

### Career 설치 패키지 tree

Career snapshot은 에이전트 9개, 설치 스킬 15개, 템플릿 15개와 지원 script 14개를 포함합니다.

```text
plugins/game-design-career/
├── .codex-plugin/plugin.json   # 플러그인 manifest
├── agents/                     # 전문 에이전트 9개
├── skills/                     # 제품 스킬 14개 + Skillstead 1개
├── assets/
│   ├── templates/              # Canonical Artifact 템플릿 15개
│   └── shared/                 # 공통 템플릿·지원 자산
├── references/
│   ├── document-quality/       # 문서 품질 profile·preset
│   ├── methods/                # 학습·취업 방법 reference
│   ├── shared/                 # 공통 계약과 책임 설계
│   └── source/                 # 근거 문서의 설치 snapshot
├── scripts/                    # 검증·이미지·내보내기 script 14개
├── hooks/hooks.json            # 중단·검토 hook
├── .env.example                # 이미지 생성 설정 예시
├── README.md
└── BUILD-MANIFEST.json         # 생성 snapshot 무결성
# assets/templates/ 및 assets/shared/는 위 assets/ 하위 경로입니다.
authoring source: products/game-design-career/plugin/
generated snapshot: plugins/game-design-career/
```

### 경로별 역할과 편집 경계

제품 source를 편집한 뒤 표준 빌드로 generated snapshot을 갱신합니다.

| 경로 | 확인하는 내용 | 직접 편집 여부 |
| --- | --- | --- |
| `.codex-plugin/` | 설치 ID와 metadata | source manifest에서만 편집 |
| `agents/` | 검토·설계에 참여하는 전문가 | 제품 source에서 편집. [Studio 기술 README](plugins/game-design-studio/README.md), [Career 기술 README](plugins/game-design-career/README.md) 참고 |
| `skills/` | 직접 호출하는 작업 단위 | 제품 source에서 편집. [Studio 스킬 가이드](guides/game-design-studio/skills/README.md), [Career 스킬 가이드](guides/game-design-career/skills/README.md) 참고 |
| `assets/templates/` | Canonical Artifact 종류 | 제품 source에서 편집. [Studio 템플릿](guides/game-design-studio/templates.md), [Career 템플릿](guides/game-design-career/templates.md) 참고 |
| `references/` | 품질·방법·근거 계약 | 제품 또는 shared source에서 편집 |
| `scripts/` | 검증·이미지·내보내기 지원 | shared source에서 편집 |
| `hooks/` | 중단·검토·재개 경계 | 제품 source에서 편집 |
| `BUILD-MANIFEST.json` | 배포 파일과 digest 증거 | 표준 빌드에서만 갱신 |

### 기존 Archify 워크플로 3종

현재는 검증된 기존 HTML 워크플로 3종과 검증 상태 문서를 연결합니다.

- [Studio 프로젝트 워크플로 열기](guides/assets/archify/studio/studio-project-workflow.html)
- [Career 증거 워크플로 열기](guides/assets/archify/career/career-evidence-workflow.html)
- [Studio에서 Career로 넘기는 공개 근거 흐름 열기](guides/assets/archify/suite/suite-studio-career-handoff.html)
- [Archify 검증 상태와 QA 근거 보기](guides/archify-diagrams/README.md)

## 이미지·도식·문서 내보내기

이미지 생성, 편집 가능한 도식과 문서 파생본은 서로 다른 lane이며 모두 Canonical Artifact와 사람 승인 경계를 유지합니다.

### 이미지 생성 모드

두 제품은 저장소 루트의 `.env` 설정을 공유합니다. 실제 API key는 prompt, 문서 또는 Git에 넣지 마세요.

```bash
cp .env.example .env
```

- `IMAGE_GEN_MODE=prompt-only`: 외부 호출 없이 prompt와 placeholder만 보존
- `IMAGE_GEN_MODE=select`: 지정한 stable asset ID만 생성 후보로 전달
- `IMAGE_GEN_MODE=required`: 필수 자산만 생성하되 provider가 없으면 차단
- `IMAGE_GEN_MODE=all`: manifest의 모든 eligible asset을 생성 후보로 전달

비어 있지 않은 `OPENAI_API_KEY`가 있으면 OpenAI Images API만 사용합니다. 키가 없고 host capability가 `available`일 때만 host fallback을 사용합니다. 그 외에는 prompt-only fallback을 유지합니다.

### 편집 가능한 도식

관계 설명에는 Skillstead의 editable SVG를 기준 자산으로 사용합니다. Renderer와 QA가 가능할 때만 2× PNG를 파생합니다.

[Studio 시각화 가이드](guides/game-design-studio/visualization.md)와 [Career 시각화 가이드](guides/game-design-career/visualization.md)에서 SVG·PNG 검증 경계를 확인하세요.

### 문서 내보내기 상태

MD는 renderer capability와 무관하게 항상 보존합니다. PDF, DOCX와 PPTX는 renderer와 형식별 visual QA가 필요하며 실패 시 fail-closed로 해당 형식만 차단합니다.

| 상태 | 의미 |
| --- | --- |
| `not-requested` | 요청하지 않은 형식 |
| `blocked` | Canonical validation 또는 필수 근거가 부족한 형식 |
| `pending` | capability probe 전이거나 validation을 기다리는 형식 |
| `unavailable` | 필요한 renderer capability가 없는 형식 |

[Studio 내보내기 가이드](guides/game-design-studio/exports.md)와 [Career 내보내기 가이드](guides/game-design-career/exports.md)에서 형식별 fallback과 QA를 확인하세요.

## 상세 가이드에서 더 알아보기

작업 이름으로 다음 문서를 선택하세요. 설치부터 문제 해결까지 제품별 경로를 같은 순서로 제공합니다.

| 하려는 작업 | Studio | Career |
| --- | --- | --- |
| 설치하고 활성화하기 | [Studio 설치](guides/game-design-studio/installation.md) | [Career 설치](guides/game-design-career/installation.md) |
| 첫 Artifact 만들기 | [Studio 빠른 시작](guides/game-design-studio/quick-start.md) | [Career 빠른 시작](guides/game-design-career/quick-start.md) |
| 전체 workflow와 재개 조건 보기 | [Studio workflow](guides/game-design-studio/workflow.md) | [Career workflow](guides/game-design-career/workflow.md) |
| 스킬을 직접 호출하기 | [Studio 스킬](guides/game-design-studio/skills/README.md) | [Career 스킬](guides/game-design-career/skills/README.md) |
| Artifact 템플릿 고르기 | [Studio 템플릿](guides/game-design-studio/templates.md) | [Career 템플릿](guides/game-design-career/templates.md) |
| use case로 탐색하기 | [Studio use case](guides/game-design-studio/use-cases/README.md) | [Career use case](guides/game-design-career/use-cases/README.md) |
| 자주 묻는 질문 확인하기 | [Studio FAQ](guides/game-design-studio/faq.md) | [Career FAQ](guides/game-design-career/faq.md) |
| 이미지 자산 계획·검토하기 | [Studio 이미지](guides/game-design-studio/image-assets.md) | [Career 이미지](guides/game-design-career/image-assets.md) |
| SVG·PNG로 시각화하기 | [Studio 시각화](guides/game-design-studio/visualization.md) | [Career 시각화](guides/game-design-career/visualization.md) |
| MD·PDF·DOCX·PPTX 준비하기 | [Studio 내보내기](guides/game-design-studio/exports.md) | [Career 내보내기](guides/game-design-career/exports.md) |

[공통 활용 허브](guides/use-cases/README.md), [사용자 경로](guides/use-cases/audience-paths.md), [결과물 카탈로그](guides/use-cases/output-catalog.md)에서 두 제품의 연결 경계를 비교할 수 있습니다.

## 안전·권리·사람 승인 경계

민감정보와 비공개 자료를 제외하고, 생성·검토 결과를 사람이 승인하기 전에는 전달 또는 공개하지 마세요.

- API key와 다른 secret은 prompt, 문서 또는 로그에 입력하지 않습니다.
- 개인정보, 실명, 연락처와 비공개 회사 자료는 원문 대신 익명화한 최소 정보만 사용합니다.
- 제3자 권리, 출처, 이용 목적, 공개 범위와 consent evidence를 기록합니다.
- 이미지·파생 문서·검토 결과는 자동 승인되지 않습니다.
- 권리·품질·배치·alt text는 이름 있는 사람이 근거와 함께 승인하거나 보류합니다.
- 이 도구는 재미, 흥행, 매출, 채용, 합격, 법률 준수 또는 플랫폼 승인을 보장하지 않습니다.

## 문제를 해결하고 작업 재개하기

기준 Markdown과 검증 결과를 보존한 채 실패한 설치, 이미지 또는 내보내기 lane만 복구하세요.

| 증상 | 확인할 지점 | 재개 방법 |
| --- | --- | --- |
| 플러그인이 보이지 않음 | App의 Work/Codex Plugins, CLI의 marketplace·plugin list | App은 새 채팅, CLI는 새 세션에서 다시 호출 |
| 이미지가 없음 | `IMAGE_GEN_MODE`, provider capability, rights 상태 | prompt package와 blocker receipt를 읽고 해당 asset ID만 재개 |
| PDF·DOCX·PPTX가 없음 | `blocked`, `pending`, `unavailable`, renderer QA | MD를 보존하고 실패한 형식만 재개 |
| 근거·권리 검토가 막힘 | evidence gap, 공개 범위, named owner | 미정과 보류 항목을 유지하고 필요한 근거만 추가 |

[Studio 문제 해결](guides/game-design-studio/troubleshooting.md)과 [Career 문제 해결](guides/game-design-career/troubleshooting.md)에서 복사 가능한 재개 요청과 상태별 복구 절차를 확인하세요.

## 기술 문서·기여·라이선스

Source tree, build·release·검증 명령과 패키지 내부 계약은 기술 문서에서 확인하세요.

- [플러그인 스위트 아키텍처](architecture/plugin-suite.md)
- [지식·근거 아키텍처](architecture/knowledge-and-evidence.md)
- [내보내기 파이프라인](architecture/export-pipeline.md)
- [Studio 기술 README](plugins/game-design-studio/README.md)
- [Career 기술 README](plugins/game-design-career/README.md)

<details>
<summary>패키지 기술 inventory</summary>

표준 빌드는 각 제품에 전문 에이전트 9개, 설치 스킬 15개, Canonical Artifact 템플릿 15개와 지원 script 14개를 포함합니다. 공통 변경은 `shared/`, 제품 변경은 `products/<product>/plugin/`에서 작성합니다.

| 기술 경로 | 역할 |
| --- | --- |
| `shared/` | 두 제품이 소비하는 품질·이미지·내보내기 source |
| `products/<product>/plugin/` | 제품별 authoring source |
| `plugins/<product>/` | 표준 빌드가 생성하는 배포 snapshot |
| `plugins/<product>/BUILD-MANIFEST.json` | snapshot 파일과 digest 증거 |

</details>

기여 전 `npm test`, `npm run validate`, `npm run build`로 독립 snapshot을 검증합니다. 프로젝트 코드·템플릿·문서는 MIT License이며, vendored Skillstead는 Apache-2.0입니다. 사용자 원문과 제3자 자료의 권리는 각 권리자에게 남습니다.
