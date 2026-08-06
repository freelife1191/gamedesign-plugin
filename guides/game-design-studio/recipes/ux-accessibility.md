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
5. 구조 도식은 `visualize-game-design` SVG를 사용하며 imagegen으로 대체하지 않습니다. UI key-screen slot이 필요한 경우에는 `prompt-only`로 먼저 계획하고, accessibility review가 통과한 stable ID만 `select` receipt로 재개합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Accessibility Owner **이민아**가 각 critical action의 equivalent path와 verification evidence를 승인합니다. Product Owner **김서윤**은 unresolved blocker를 출시 승인으로 바꾸지 않고 보류 또는 범위 축소를 결정합니다.

## 예상 결과

`game-design/<project-id>/ui-ux-flow-state/content.md`에 testable interaction state와 pending/blocked accessibility gate가 남습니다. renderer fallback은 SVG source·lint 기록을 보존하고 PNG `unavailable`을 명시합니다.

## 실패와 재개

플랫폼 evidence가 오래되었거나 input path가 누락되면 current-compliance 선언을 하지 않습니다. Artifact와 unverified state ID를 지정해 검증 단계부터 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [플레이어 경험 스킬](../skills/design-player-experience.md), [문서 품질](../document-quality.md), [전체 워크플로](../workflow.md)
- [Canonical Artifact 수명주기](../../assets/shared/canonical-artifact-lifecycle.png)를 함께 확인합니다.
