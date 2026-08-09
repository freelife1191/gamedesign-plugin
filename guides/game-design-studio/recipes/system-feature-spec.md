# 시스템 기능을 규칙·상태·예외 명세로 만들기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![규칙·상태·예외 흐름](../../assets/game-design-studio/system-rule-state-exception-flow.png)

## 완료 목표

한 기능의 입력, 규칙, 상태 전이, 예외 우선순위, 실패 복구와 runtime mapping을 검토 가능한 명세로 연결합니다.

## 준비할 입력

- 기능 목표, authoritative data ID, precondition, 실패 기대와 플랫폼 제약
- Canonical Artifact 경로 family: `game-design/<project-id>/system-specification/`
- 템플릿: `system-specification`; 예외 충돌이 크면 `rule-exception-matrix`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 제작 기능의 input, rule, state, exception precedence, failure/recovery와 table/runtime mapping을 명세해. 접근성 critical action도 누락하지 말고 design owner 검토 전에는 승인하지 마.
```

Codex CLI 명시 호출:

```text
$game-design-studio:design-game-systems game-design/<project-id>/system-specification/에서 rule과 state를 명세한 뒤 $game-design-studio:design-player-experience 및 $game-design-studio:review-game-design으로 검토해.
```

## 단계별 진행

1. quality profile을 적용하고 stable section ID와 data authority를 정합니다.
2. `design-game-systems`으로 normal path, guard, transition, precedence, exception과 test case를 `content.md`에 씁니다.
3. `design-player-experience`로 UI feedback, error, offline/interruption과 accessible alternative를 연결합니다.
4. `review-game-design`으로 implementation blocker와 최소 수정을 finding으로 남깁니다.
5. 구조 관계는 `visualize-game-design`으로 SVG로 작성하고 wrapper lint 뒤 Chromium으로 정확한 2× PNG를 만듭니다. 이 구조 도식에는 imagegen을 사용하지 않습니다.
6. 이 시스템 명세에 화면 설명 slot이 필요하면 권장 mode는 `prompt-only`이며, prompt와 placeholder만 기록합니다. `select`는 stable ID receipt와 finite manifest가 있어야 생성하며, `required`는 finite required asset만, `all`은 declared asset만 생성합니다. rule/state 구조는 Skillstead 도식으로 유지합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Systems Owner **박도현**이 rule precedence와 exception policy를 승인하고, Accessibility Reviewer **이민아**가 critical action의 대체 경로를 확인합니다.

## 예상 결과

`game-design/<project-id>/system-specification/content.md`와 testable state/exception record가 생깁니다. renderer가 없으면 source-mapped SVG, lint 결과와 `png: unavailable`을 남기고 PNG 승인으로 가장하지 않습니다.

### 예상 파일 트리

```text
game-design/<project-id>/
├── system-specification/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/README.md
│   ├── assets/README.md
│   └── export-manifest.yml
└── rule-exception-matrix/
    └── content.md
```

`game-design/<project-id>/system-specification/` 아래의 rule ID와 `content.md`가 구현·QA가 함께 읽는 기준입니다.

### 대표 내용 예시

`system-specification`과 `rule-exception-matrix`는 normal path만이 아니라 precedence를 테스트 가능한 문장으로 남깁니다.

```md
R-CRAFT-03: validating 중 cancel은 craft 완료보다 먼저 적용한다.
상태: idle → validating → crafting → completed|failed|cancelled
TC-09: authoritative data가 없으면 상태를 변경하지 않고 blocker를 반환한다.
```

### 완료 기준

박도현이 rule precedence와 exception policy를, 이민아가 critical action의 대체 경로를 승인하거나 blocker로 보류합니다. `content.md`의 rule·state·test case가 data authority와 연결되고, 미확정 예외는 구현 완료로 전달하지 않습니다.

### 포트폴리오 또는 팀 전달 포인트

Canonical Artifact의 `content.md`, 예외 결정과 test case를 함께 전달해 팀이 근거와 미해결 위험을 재현할 수 있게 합니다. 포트폴리오에는 공개 가능한 상태 전이와 검증 질문만 남기며 실제 schema나 내부 데이터는 포함하지 않습니다.

## 실패와 재개

권위 데이터나 precedence가 없으면 `blocked`로 기록하고 구현 규칙을 추측하지 않습니다. 같은 Artifact의 `decisions/README.md`와 blocker ID를 요청문에 넣어 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [시스템 스킬](../skills/design-game-systems.md), [플레이어 경험 스킬](../skills/design-player-experience.md), [시각화](../visualization.md)
- [이미지 mode 라우팅](../../assets/shared/image-generation-mode-routing.png)은 별도 image slot의 생성 경계를 보여 줍니다.

<!-- PROMPT-TEMPLATES:START game-design-studio:recipe:system-feature-spec -->
<!-- PROMPT-CARD: studio:recipe:system-feature-spec -->
#### studio:recipe:system-feature-spec

**system-feature-spec recipe**

system-feature-spec recipe의 ordered CLI calls와 artifact read order를 보존한다.

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
```text
@Game Design Studio 제작 기능의 input, rule, state, exception precedence, failure/recovery와 table/runtime mapping을 명세해. 접근성 critical action도 누락하지 말고 design owner 검토 전에는 승인하지 마.
```

##### Codex App 재사용 템플릿
```text
@Game Design Studio 제작 기능의 input, rule, state, exception precedence, failure/recovery와 table/runtime mapping을 명세해. 접근성 critical action도 누락하지 말고 design owner 검토 전에는 승인하지 마. [프로젝트 ID]의 fact, inference, recommendation과 미정 blocker를 보존해.
```

##### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems game-design/<project-id>/system-specification/에서 rule과 state를 명세한 뒤 $game-design-studio:design-player-experience 및 $game-design-studio:review-game-design으로 검토해.
```

##### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems game-design/[프로젝트 ID]/system-specification/에서 rule과 state를 명세한 뒤 $game-design-studio:design-player-experience 및 $game-design-studio:review-game-design으로 검토해. fact, inference, recommendation을 보존해.
```

##### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems → design-player-experience → review-game-design
- 전문 역할: lead-game-designer

##### 중간 산출물
- system-specification

##### 예상 결과물
###### 최소 결과물
- system-specification canonical artifact
- blocker와 resume receipt

###### 선택 결과물
- 공개 가능한 evidence summary

###### 확장 결과물
- downstream handoff

##### 파일 구조
- game-design/[프로젝트 ID]/system-specification/content.md
- game-design/[프로젝트 ID]/system-specification/evidence.yml
- game-design/[프로젝트 ID]/system-specification/decisions/README.md
- game-design/[프로젝트 ID]/system-specification/assets/README.md
- game-design/[프로젝트 ID]/system-specification/export-manifest.yml
- game-design/[프로젝트 ID]/rule-exception-matrix/content.md

##### 읽는 순서
- game-design/[프로젝트 ID]/system-specification/content.md
- game-design/[프로젝트 ID]/system-specification/evidence.yml
- game-design/[프로젝트 ID]/system-specification/decisions/README.md
- game-design/[프로젝트 ID]/system-specification/assets/README.md
- game-design/[프로젝트 ID]/system-specification/export-manifest.yml
- game-design/[프로젝트 ID]/rule-exception-matrix/content.md

##### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: Studio recipe flow

##### 사람 검토
###### 승인 경계
named human decision owner가 system-feature-spec의 approval 또는 보류를 결정한다.

###### 보류 조건
- canonical evidence, rights, image/export receipt, 또는 owner approval receipt가 없으면 보류

###### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

##### 실패와 재개
```text
system-feature-spec의 보존 canonical artifact와 blocker를 읽고 공개 정보만으로 재개해.
```
<!-- PROMPT-TEMPLATES:END game-design-studio:recipe:system-feature-spec -->
