# UX·접근성 경로를 첫 입력부터 복구까지 설계하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![Studio 오케스트레이션 맵](../../assets/game-design-studio/studio-orchestration-map.png)

## 완료 목표

critical action, UI state, input, sensory alternative와 recovery를 player journey와 reviewer gate에 연결합니다.

## 준비할 입력

- 대상 플랫폼, critical action, 입력 방식, known accessibility evidence, error/offline 조건
- Canonical Artifact 경로 family: `game-design/<project-id>/ui-ux-flow-state/`
- 템플릿: `ui-ux-flow-state`; 플랫폼 비교가 필요하면 `accessibility-platform-matrix`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 첫 세션의 critical action을 모바일과 PC 입력, focus, text scale, visual/audio alternative, loading·error·offline recovery까지 설계해. 현재 근거와 가정을 분리하고 accessibility owner 승인을 대기해.
```

Codex CLI 명시 호출:

```text
$game-design-studio:design-player-experience game-design/<project-id>/ui-ux-flow-state/에서 작성한 뒤 $game-design-studio:apply-document-quality-profile 및 $game-design-studio:review-game-design으로 접근성 gate를 검토해.
```

## 단계별 진행

1. profile과 `ui-ux-flow-state` template을 적용하고 platform evidence의 freshness를 기록합니다.
2. `design-player-experience`로 entry, focus, action, feedback, loading/empty/error/offline, exit와 recovery를 씁니다.
3. `review-game-design`에서 unverified critical path를 blocker로 분류하고 최소 수정과 owner를 할당합니다.
4. 협업 route가 복잡하면 `orchestrate-game-design-project`로 systems·quality·review handoff를 한 Artifact 기준으로 합칩니다.
5. 구조 도식은 `visualize-game-design` SVG를 사용하며 imagegen으로 대체하지 않습니다. UI key-screen slot이 필요한 경우에는 `prompt-only`로 먼저 계획하고, accessibility review가 통과한 stable ID만 `select` receipt로 재개합니다. `required`는 finite required asset만, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Accessibility Owner **이민아**가 각 critical action의 equivalent path와 verification evidence를 승인합니다. Product Owner **김서윤**은 unresolved blocker를 출시 승인으로 바꾸지 않고 보류 또는 범위 축소를 결정합니다.

## 예상 결과

`game-design/<project-id>/ui-ux-flow-state/content.md`에 testable interaction state와 pending/blocked accessibility gate가 남습니다. renderer fallback은 SVG source·lint 기록을 보존하고 PNG `unavailable`을 명시합니다.

### 예상 파일 트리

```text
game-design/<project-id>/
├── ui-ux-flow-state/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/README.md
│   ├── assets/README.md
│   └── export-manifest.yml
└── accessibility-platform-matrix/
    └── content.md
```

`game-design/<project-id>/ui-ux-flow-state/`에는 critical action별 state ID를, 비교 근거는 별도 `content.md`에 둡니다.

### 대표 내용 예시

`ui-ux-flow-state`와 `accessibility-platform-matrix`는 같은 행동의 기본·대체 입력과 실패 복구를 함께 기록합니다.

```md
UX-ACT-01: 지도 열기 → focus 이동 → 목적지 선택 → feedback.
대체 경로: pointer 없이 keyboard·pad focus와 text cue로 같은 action을 수행한다.
offline이면 저장된 목표를 보이고, 재연결 후 state를 다시 검증한다.
```

### 완료 기준

이민아가 각 critical action의 equivalent path와 검증 evidence를, 김서윤이 unresolved blocker의 보류 또는 범위 축소를 승인합니다. `content.md`의 state, input, sensory alternative와 재개 조건이 연결되기 전에는 접근성 준수나 출시 준비를 선언하지 않습니다.

### 포트폴리오 또는 팀 전달 포인트

Canonical Artifact의 `content.md`, 플랫폼 matrix, 사용자 관찰과 미해결 위험을 함께 전달합니다. 포트폴리오에는 공개 가능한 흐름과 대체 경로의 설계 이유만 정리하고, 실제 사용자 정보나 검증되지 않은 준수 주장은 제외합니다.

## 실패와 재개

플랫폼 evidence가 오래되었거나 input path가 누락되면 current-compliance 선언을 하지 않습니다. Artifact와 unverified state ID를 지정해 검증 단계부터 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [플레이어 경험 스킬](../skills/design-player-experience.md), [문서 품질](../document-quality.md), [전체 워크플로](../workflow.md)
- [Canonical Artifact 수명주기](../../assets/shared/canonical-artifact-lifecycle.png)를 함께 확인합니다.

<!-- PROMPT-TEMPLATES:START game-design-studio:recipe:ux-accessibility -->
<!-- PROMPT-CARD: studio:recipe:ux-accessibility -->
#### studio:recipe:ux-accessibility

**ux-accessibility recipe**

ux-accessibility recipe의 ordered CLI calls와 artifact read order를 보존한다.

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
@Game Design Studio 첫 세션의 critical action을 모바일과 PC 입력, focus, text scale, visual/audio alternative, loading·error·offline recovery까지 설계해. 현재 근거와 가정을 분리하고 accessibility owner 승인을 대기해.
```

##### Codex App 재사용 템플릿
```text
@Game Design Studio 첫 세션의 critical action을 모바일과 PC 입력, focus, text scale, visual/audio alternative, loading·error·offline recovery까지 설계해. 현재 근거와 가정을 분리하고 accessibility owner 승인을 대기해. [프로젝트 ID]의 fact, inference, recommendation과 미정 blocker를 보존해.
```

##### Codex CLI 완성 예시
```text
$game-design-studio:design-player-experience game-design/<project-id>/ui-ux-flow-state/에서 작성한 뒤 $game-design-studio:apply-document-quality-profile 및 $game-design-studio:review-game-design으로 접근성 gate를 검토해.
```

##### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-player-experience game-design/[프로젝트 ID]/ui-ux-flow-state/에서 작성한 뒤 $game-design-studio:apply-document-quality-profile 및 $game-design-studio:review-game-design으로 접근성 gate를 검토해. fact, inference, recommendation을 보존해.
```

##### 스킬·전문 역할 흐름
- 기본 스킬: design-player-experience
- 스킬 흐름: design-player-experience → apply-document-quality-profile → review-game-design
- 전문 역할: lead-game-designer

##### 중간 산출물
- ui-ux-flow-state

##### 예상 결과물
###### 최소 결과물
- ui-ux-flow-state canonical artifact
- blocker와 resume receipt

###### 선택 결과물
- 공개 가능한 evidence summary

###### 확장 결과물
- downstream handoff

##### 파일 구조
- game-design/[프로젝트 ID]/ui-ux-flow-state/content.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/evidence.yml
- game-design/[프로젝트 ID]/ui-ux-flow-state/decisions/README.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/assets/README.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/export-manifest.yml
- game-design/[프로젝트 ID]/accessibility-platform-matrix/content.md

##### 읽는 순서
- game-design/[프로젝트 ID]/ui-ux-flow-state/content.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/evidence.yml
- game-design/[프로젝트 ID]/ui-ux-flow-state/decisions/README.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/assets/README.md
- game-design/[프로젝트 ID]/ui-ux-flow-state/export-manifest.yml
- game-design/[프로젝트 ID]/accessibility-platform-matrix/content.md

##### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: Studio recipe flow

##### 사람 검토
###### 승인 경계
named human decision owner가 ux-accessibility의 approval 또는 보류를 결정한다.

###### 보류 조건
- canonical evidence, rights, image/export receipt, 또는 owner approval receipt가 없으면 보류

###### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

##### 실패와 재개
```text
ux-accessibility의 보존 canonical artifact와 blocker를 읽고 공개 정보만으로 재개해.
```
<!-- PROMPT-TEMPLATES:END game-design-studio:recipe:ux-accessibility -->
