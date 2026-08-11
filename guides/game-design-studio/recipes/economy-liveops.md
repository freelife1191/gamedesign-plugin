# 경제·LiveOps를 가설·보호 지표·rollback으로 설계하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![경제 밸런스와 LiveOps 루프](../../assets/game-design-studio/economy-balance-liveops-loop.png)

## 완료 목표

통화 source/sink, progression, price·probability 가정, player protection, 실험·stop·rollback을 분리해 reversible한 경제 artifact를 만듭니다.

## 준비할 입력

- resource ID, telemetry, current price/probability policy, experiment hypothesis와 보호 지표
- Canonical Artifact 경로 family: `game-design/<project-id>/economy-balance/` 및 `game-design/<project-id>/liveops-experiment-event/`
- 템플릿: `economy-balance`, `liveops-experiment-event`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 골드와 토큰의 source/sink, target inventory, progression, price·odds·pity 가정을 기록하고 LiveOps 실험의 control, guardrail, stop과 rollback을 설계해. 근거 없는 수치와 monetization 승인은 만들지 마.
```

Codex CLI 명시 호출:

```text
$game-design-studio:design-game-economy-and-liveops game-design/<project-id>/economy-balance/와 liveops-experiment-event/를 작성한 뒤 $game-design-studio:design-game-systems 및 $game-design-studio:plan-game-production으로 rollback dependency를 검토해.
```

## 단계별 진행

1. economy quality profile을 적용하고 source, policy date, region/scope, telemetry limitation을 기록합니다.
2. `design-game-economy-and-liveops`로 source/sink, target inventory, probability/pity, inflation risk와 recovery를 명세합니다.
3. 실험마다 hypothesis, control, changed variable, guardrail, stop, rollback과 owner를 분리합니다.
4. `design-game-systems`으로 authority와 data mapping을, `plan-game-production`으로 rollback readiness를 확인합니다.
5. value-flow와 feedback loop는 `visualize-game-design` SVG로 도식화하고 imagegen으로 대체하지 않습니다. 이 사례의 event communication slot은 승인 전 `prompt-only`로 두며, 선택 생성은 `select` receipt와 finite manifest 범위가 있을 때만 허용합니다. `required`는 finite required asset만, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Economy Owner **정하늘**이 price/probability evidence와 player consequence를, LiveOps Owner **윤태호**가 guardrail·stop·rollback을 승인합니다. hard No-Go는 조건부 승인으로 바꾸지 않습니다.

## 예상 결과

두 Canonical Artifact의 `content.md`에 가설·근거·보호 지표·rollback decision이 남고, 현재 renderer가 없으면 SVG와 source mapping은 유지하되 PNG를 verified로 표시하지 않습니다.

### 예상 파일 트리

```text
game-design/<project-id>/
├── economy-balance/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/README.md
│   ├── assets/README.md
│   └── export-manifest.yml
└── liveops-experiment-event/
    ├── content.md
    ├── evidence.yml
    ├── decisions/README.md
    ├── assets/README.md
    └── export-manifest.yml
```

`game-design/<project-id>/economy-balance/`와 `game-design/<project-id>/liveops-experiment-event/`의 `content.md`는 하나의 policy date와 rollback decision을 참조합니다.

### 대표 내용 예시

`economy-balance`와 `liveops-experiment-event`는 수치를 확정된 성과가 아니라 검증할 가설로 남깁니다.

```md
EXP-FEST-01: control 대비 한 변수만 바꾸고 guardrail은 구매 후회 신고다.
stop: 보호 지표가 악화하거나 정책 근거가 빠지면 experiment를 중단한다.
rollback: tested rollback receipt가 없으면 publish하지 않고 economy 가정으로 유지한다.
```

### 완료 기준

정하늘이 price·probability evidence와 player consequence를, 윤태호가 guardrail·stop·rollback 준비를 승인하거나 blocker로 보류합니다. 두 `content.md`에 source/sink, 가설, policy date, 보호 지표와 재개 조건이 있어야 하며 근거 없는 monetization 승인은 완료가 아닙니다.

### 포트폴리오 또는 팀 전달 포인트

Canonical Artifact의 `content.md`, evidence와 rollback 결정을 함께 전달해 팀이 어떤 가정과 위험을 재검토할지 알게 합니다. 포트폴리오에는 synthetic example과 검증 계획만 사용하고, 실제 가격·확률·개인 데이터를 공개하거나 성과로 단정하지 않습니다.

## 실패와 재개

telemetry, 가격 정책 또는 rollback capability가 없으면 affected experiment를 `blocked`로 기록합니다. Artifact path와 stop-condition ID를 요청해 그 지점에서 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [경제·LiveOps 스킬](../skills/design-game-economy-and-liveops.md), [시스템 스킬](../skills/design-game-systems.md), [시각화](../visualization.md)
- [문서 내보내기 흐름](../../assets/shared/document-export-flow.png)은 승인 이후 delivery 준비 경계를 설명합니다.

<!-- PROMPT-TEMPLATES:START game-design-studio:recipe:economy-liveops -->
<!-- PROMPT-CARD: studio:recipe:economy-liveops -->
#### studio:recipe:economy-liveops

**economy-liveops recipe**

economy-liveops recipe의 ordered CLI calls와 artifact read order를 보존한다.

##### 간단 요청 예시
```text
@Game Design Studio 골드와 토큰의 source/sink, target inventory, progression, price·odds·pity 가정을 기록하고 LiveOps 실험의 control, guardrail, stop과 rollback을 설계해. 근거 없는 수치와 monetization 승인은 만들지 마.
```

##### 짧은 흐름
- 작업 순서: design-game-economy-and-liveops → design-game-systems → plan-game-production
- 함께 검토하는 역할: lead-game-designer

##### 이 요청으로 받는 결과
예: `game-design/[프로젝트 ID]/economy-balance/content.md`에 economy-balance canonical artifact, blocker와 resume receipt을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

##### 사용하는 경우
canonical artifact의 안전한 다음 작업 순서가 필요할 때 사용한다.

##### 사용하지 않는 경우
evidence, rights, image, export 또는 approval gate를 건너뛸 때는 사용하지 않는다.

##### 준비 입력
###### 필수 입력
- 공개 가능한 canonical artifact

###### 선택 입력
- named human decision receipt

##### 바꿀 자리표시자
- [프로젝트 ID]

##### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

##### Codex App 재사용 템플릿
```text
@Game Design Studio 골드와 토큰의 source/sink, target inventory, progression, price·odds·pity 가정을 기록하고 LiveOps 실험의 control, guardrail, stop과 rollback을 설계해. 근거 없는 수치와 monetization 승인은 만들지 마. [프로젝트 ID]의 fact, inference, recommendation과 미정 blocker를 보존해.
```

##### Codex CLI 완성 예시
```text
$game-design-studio:design-game-economy-and-liveops game-design/<project-id>/economy-balance/와 liveops-experiment-event/를 작성한 뒤 $game-design-studio:design-game-systems 및 $game-design-studio:plan-game-production으로 rollback dependency를 검토해.
```

##### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-economy-and-liveops game-design/[프로젝트 ID]/economy-balance/와 liveops-experiment-event/를 작성한 뒤 $game-design-studio:design-game-systems 및 $game-design-studio:plan-game-production으로 rollback dependency를 검토해. fact, inference, recommendation을 보존해.
```

##### 스킬·전문 역할 흐름
- 기본 스킬: design-game-economy-and-liveops
- 스킬 흐름: design-game-economy-and-liveops → design-game-systems → plan-game-production
- 전문 역할: lead-game-designer

##### 중간 산출물
- economy-balance
- liveops-experiment-event

##### 예상 결과물
###### 최소 결과물
- economy-balance canonical artifact
- blocker와 resume receipt

###### 선택 결과물
- 공개 가능한 evidence summary

###### 확장 결과물
- downstream handoff

##### 파일 구조
- game-design/[프로젝트 ID]/economy-balance/content.md
- game-design/[프로젝트 ID]/economy-balance/evidence.yml
- game-design/[프로젝트 ID]/economy-balance/decisions/README.md
- game-design/[프로젝트 ID]/economy-balance/assets/README.md
- game-design/[프로젝트 ID]/economy-balance/export-manifest.yml
- game-design/[프로젝트 ID]/liveops-experiment-event/content.md
- game-design/[프로젝트 ID]/liveops-experiment-event/evidence.yml
- game-design/[프로젝트 ID]/liveops-experiment-event/decisions/README.md
- game-design/[프로젝트 ID]/liveops-experiment-event/assets/README.md
- game-design/[프로젝트 ID]/liveops-experiment-event/export-manifest.yml

##### 읽는 순서
- game-design/[프로젝트 ID]/economy-balance/content.md
- game-design/[프로젝트 ID]/economy-balance/evidence.yml
- game-design/[프로젝트 ID]/economy-balance/decisions/README.md
- game-design/[프로젝트 ID]/economy-balance/assets/README.md
- game-design/[프로젝트 ID]/economy-balance/export-manifest.yml
- game-design/[프로젝트 ID]/liveops-experiment-event/content.md
- game-design/[프로젝트 ID]/liveops-experiment-event/evidence.yml
- game-design/[프로젝트 ID]/liveops-experiment-event/decisions/README.md
- game-design/[프로젝트 ID]/liveops-experiment-event/assets/README.md
- game-design/[프로젝트 ID]/liveops-experiment-event/export-manifest.yml

##### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: Studio recipe flow

##### 사람 검토
###### 승인 경계
named human decision owner가 economy-liveops의 approval 또는 보류를 결정한다.

###### 보류 조건
- canonical evidence, rights, image/export receipt, 또는 owner approval receipt가 없으면 보류

###### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

##### 실패와 재개
```text
economy-liveops의 보존 canonical artifact와 blocker를 읽고 공개 정보만으로 재개해.
```

</details>
<!-- PROMPT-TEMPLATES:END game-design-studio:recipe:economy-liveops -->
