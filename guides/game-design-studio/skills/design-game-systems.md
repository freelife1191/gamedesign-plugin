# design-game-systems

## 목적과 산출물

메커니즘을 규칙 순서, 상태, 예외, 실패·복구, UI feedback과 data/runtime mapping이 있는 `system-specification`으로 만듭니다.

## 사용할 때

- 스태미나·제작 규칙과 state transition을 구현 가능하게 정의할 때
- 동시 결과의 precedence, PK/FK, authority와 schema mapping이 필요할 때

## 사용하지 않을 때

- 전체 player promise는 `define-game-vision`, 콘텐츠 단위는 `design-game-content`를 사용합니다.
- cross-system economy나 LiveOps는 `design-game-economy-and-liveops`를 사용합니다.

## 필수 입력과 선택 입력

- 필수: 목적, actor, input, constraints, current rules, authoritative data, failure expectations, owner
- 선택: network model, UI surface, balance evidence, 기존 spec, review questions
- 수치·확률·limit은 승인 근거가 없으면 provisional입니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 스태미나 소비와 제작 규칙을 rule ID, 상태 전이, precedence, 동시 처리, 예외, 실패·복구, UI state와 PK/FK까지 명세해.
```

## Codex CLI 예시

```text
$game-design-studio:design-game-systems 스태미나·제작 시스템의 executable rules, state transition, exception, table/runtime mapping을 작성해.
```

## 진행 흐름

boundary와 authoritative state를 정한 뒤 ordered rules, concurrency, transition, recovery, abuse case, UI feedback과 schema를 연결합니다. 주 템플릿/profile은 `system-specification`/`system-feature-specification`, 관련 역할은 `system-economy-designer`와 `ux-accessibility-reviewer`, 다음 스킬은 `review-game-design`입니다.

## 결과와 파일

Canonical Artifact에 rule·state·exception·data ID와 validation task를 기록합니다. 복잡한 precedence는 `rule-exception-matrix`, schema 집중 작업은 `data-schema-table-contract`를 함께 사용할 수 있습니다. 예상 결과 요약: 설계와 엔지니어링이 동일한 실행 계약을 검토할 수 있습니다.

## 검토와 승인

모든 transition에는 trigger, guard, source/target state, side effect, feedback이 필요합니다. precedence가 결정되지 않았거나 balance 근거가 없으면 완료를 막고 owner가 있는 결정·검증 항목으로 남깁니다.

## 실패와 재개

권위 데이터나 precedence가 빠졌다면 구현 승인을 주장하지 않고 기존 섹션을 보존합니다.

```text
$game-design-studio:design-game-systems 기존 system-specification에서 미해결 precedence만 재개해. 새 server-authoritative 규칙과 실패 복구 근거를 연결하고 나머지는 보존해.
```
