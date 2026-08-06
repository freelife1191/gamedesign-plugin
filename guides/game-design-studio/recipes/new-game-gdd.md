# 새 게임 GDD를 승인 가능한 기준 문서로 만들기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![비전에서 GDD 승인까지의 흐름](../../assets/game-design-studio/vision-to-gdd-approval.png)

## 완료 목표

검증 가능한 비전과 범위를 `content.md` 기준으로 묶고, 도메인 작업이 참조할 GDD의 첫 승인 게이트를 남깁니다.

## 준비할 입력

- 대상 플레이어, 핵심 재미, 플랫폼, 알려진 제약과 아직 모르는 사항
- 작업 디렉터리와 Canonical Artifact 경로 family: `game-design/<project-id>/vision-pillars/`
- 템플릿: `vision-pillars`, 이후 프로젝트 brief가 필요하면 `game-design-brief`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 새 협동 RPG의 대상 플레이어, 핵심 재미, pillar, anti-pillar와 non-goal을 분리해 GDD 기준을 만들어 줘. 근거 없는 주장은 assumption으로 남기고 lead design owner의 승인을 기다려.
```

Codex CLI 명시 호출:

```text
$game-design-studio:orchestrate-game-design-project game-design/<project-id>/vision-pillars/의 content.md를 기준으로 $game-design-studio:apply-document-quality-profile, $game-design-studio:define-game-vision, $game-design-studio:review-game-design을 순서대로 실행해.
```

## 단계별 진행

1. `apply-document-quality-profile`로 `vision-pillars` profile과 checklist를 먼저 고릅니다.
2. `define-game-vision`으로 provided, sourced, assumption, provisional을 구분한 `content.md`를 작성합니다.
3. `orchestrate-game-design-project`로 필요한 시스템·콘텐츠·UX·제작 route만 정하고, 미결정은 `decisions/`에 보존합니다.
4. `review-game-design`으로 player promise, non-goal, 성공 신호의 최소 수정 finding을 기록합니다.
5. 이 초기 GDD의 `design-context-image` slot은 가설 검토용이므로 `prompt-only`에서는 prompt와 placeholder만 만들고 생성하지 않습니다. `select`는 사람이 제출한 receipt의 stable ID만 생성하며, `required`는 manifest에 required로 선언된 finite stable asset IDs만 생성합니다. `all`도 manifest에 declared asset만 생성하고 manifest 밖 자산은 만들지 않습니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Lead Designer **김서윤**이 target player, 세 가지 pillar, anti-pillar와 scope boundary를 승인하거나 보류합니다. AI의 초안, lint 또는 생성 성공은 이 승인을 대신하지 않습니다.

## 예상 결과

`game-design/<project-id>/vision-pillars/content.md`에 비전, evidence, decision owner, pending gate와 다음 도메인 route가 남습니다. SVG/PNG가 필요하지만 Chromium renderer가 없으면 editable SVG와 `renderer-unavailable` 기록만 보존하고 GDD Markdown은 계속 사용합니다.

### 예상 파일 트리

```text
game-design/<project-id>/
├── vision-pillars/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/README.md
│   ├── assets/README.md
│   └── export-manifest.yml
└── game-design-brief/
    └── content.md
```

`vision-pillars/`의 판단 기준과 `game-design-brief/`의 범위는 같은 Canonical Artifact 읽기 순서에서 확인합니다.

### 대표 내용 예시

`vision-pillars`와 `game-design-brief`는 다음처럼 확정 사실과 검증할 가정을 분리합니다.

```md
Player promise
혼자서도 복구에 기여하고, 협동하면 변화가 보이는 탐험을 제공한다.

Unsupported fun boundary
재미·시장성은 사실로 확정하지 않고 prototype 관찰로 검증한다.
```

### 완료 기준

김서윤이 player promise, 세 pillar, anti-pillar, non-goal과 다음 prototype 질문을 승인하거나 보류합니다. `content.md`에 evidence ID와 decision owner가 연결되고, 보류된 가정은 검증 전 완료로 표시하지 않습니다.

### 포트폴리오 또는 팀 전달 포인트

Canonical Artifact의 `content.md`, evidence와 결정 기록을 함께 전달해 어떤 기능을 포기했는지와 남은 위험을 읽을 수 있게 합니다. 포트폴리오에는 공개 가능한 문제·가정·검증 과정만 요약하고, 미해결 결정은 성과처럼 쓰지 않습니다.

## 실패와 재개

근거가 부족하면 숫자나 시장 주장을 발명하지 않고 assumption과 validation task로 남깁니다. `content.md`와 `decisions/README.md`를 지정해 같은 Artifact에서 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [전체 워크플로](../workflow.md), [비전 스킬](../skills/define-game-vision.md), [문서 품질](../document-quality.md)
- [Canonical Artifact 수명주기](../../assets/shared/canonical-artifact-lifecycle.png)는 공통 승인 경계를 설명합니다.
