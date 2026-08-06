# design-player-experience

## 목적과 최종 산출물

첫 세션 onboarding, UI state, input, performance, cross-platform과 accessibility를 `ui-ux-flow-state` 계약으로 만듭니다.

## 사용할 때

- 첫 5분과 first success, tutorial skip/revisit를 설계할 때
- critical action별 UI state와 접근 가능한 대체 경로를 검토할 때

## 사용하지 않을 때

- authoritative rule은 `design-game-systems`, 경제·가격·확률은 `design-game-economy-and-liveops`를 사용합니다.
- milestone과 staffing은 `plan-game-production`을 사용합니다.

## 필수 입력과 선택 입력

- 필수: target experience, critical actions, players, platforms, devices, input, UI surfaces, owner
- 선택: performance measurements, current accessibility evidence, test participants, 기존 flow, review questions
- 검증되지 않은 threshold는 provisional입니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 모바일 협동 RPG 첫 세션 onboarding을 설계해. 첫 5분, first success, tutorial skip/revisit, 모든 UI state와 critical action의 접근 가능한 대체 경로를 포함해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:design-player-experience 첫 세션 onboarding과 UI state를 ui-ux-flow-state로 작성하고 입력·접근성·오류 복구를 검토해.
```

## 내부 진행 흐름

정보 우선순위와 각 critical action의 상태를 추적하고 첫 성공, 실패 feedback, recovery, device 차이와 accessibility evidence를 연결합니다. 주 템플릿/profile은 `ui-ux-flow-state`/`ui-ux-flow-state-specification`, 관련 역할은 `ux-accessibility-reviewer`와 `lead-game-designer`, 다음 스킬은 `review-game-design`입니다.

## 생성 파일과 결과 구조

interaction/UI states, onboarding, input, performance, cross-platform, accessibility, assumptions와 gates를 Canonical Artifact에 기록합니다. 예상 결과 요약: QA 가능한 첫 세션과 접근성 경로가 명확해집니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

critical action의 state, cue, input, recovery 또는 sensory alternative가 빠지면 `inaccessible-critical-action` blocker입니다. current 요구사항에 최신 1차 근거가 없으면 release를 승인하지 않습니다.

## 실패·fallback·재개 방법

플랫폼 근거나 test participant 정보가 없으면 해당 target을 승인하지 않고 validation task를 보존합니다.

```text
$game-design-studio:design-player-experience 기존 ui-ux-flow-state를 유지하고, 새 플랫폼 접근성 근거와 controller 테스트 결과를 연결해 blocked critical action만 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:design-player-experience 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
