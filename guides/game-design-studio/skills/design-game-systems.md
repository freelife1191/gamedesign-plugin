# design-game-systems

## 목적과 최종 산출물

메커니즘을 규칙 순서, 상태, 예외, 실패·복구, UI feedback과 data/runtime mapping이 있는 `system-specification`으로 만듭니다.

## 사용할 때

- 스태미나·제작 규칙과 state transition을 구현 가능하게 정의할 때
- 동시 결과의 precedence, PK/FK, authority와 schema mapping이 필요할 때

### 직접 호출 활용 — design-game-systems

#### 직접 호출 조건

`ST-C03`처럼 input, authority, rule precedence와 recovery를 명세할 때 직접 호출합니다. player promise 자체가 아직 모호하면 vision부터 정합니다.

#### 입문 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/workbench/system 제작 요청의 input, state transition, output과 failure recovery를 system-specification으로 작성해.
```

#### 응용 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/workbench/system ST-C03의 concurrency exception, rule precedence, authoritative state와 test case를 rule-exception-matrix에 연결해.
```

#### 고급 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/workbench/system 확인된 runtime mapping만 data-schema-table-contract에 넣고 unknown schema는 provisional로 보존해.
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → export-manifest.yml` 순서로 읽고 `system-specification`, `rule-exception-matrix`, `data-schema-table-contract`는 별도 YAML 파일이 아니라 `content.md`의 안정 섹션과 stable ID로 검토합니다. `decisions/`은 실제 결정 기록이 있을 때만 그 뒤에 읽습니다.

#### 다음 스킬 조건

rule precedence 또는 recovery의 근거·영향이 불명확할 때만 `$game-design-studio:review-game-design`으로 넘기며, review finding은 runtime 구현 승인이 아닙니다.

## 사용하지 않을 때

- 전체 player promise는 `define-game-vision`, 콘텐츠 단위는 `design-game-content`를 사용합니다.
- cross-system economy나 LiveOps는 `design-game-economy-and-liveops`를 사용합니다.

## 필수 입력과 선택 입력

- 필수: 목적, actor, input, constraints, current rules, authoritative data, failure expectations, owner
- 선택: network model, UI surface, balance evidence, 기존 spec, review questions
- 수치·확률·limit은 승인 근거가 없으면 provisional입니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 스태미나 소비와 제작 규칙을 rule ID, 상태 전이, precedence, 동시 처리, 예외, 실패·복구, UI state와 PK/FK까지 명세해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:design-game-systems 스태미나·제작 시스템의 executable rules, state transition, exception, table/runtime mapping을 작성해.
```

## 내부 진행 흐름

boundary와 authoritative state를 정한 뒤 ordered rules, concurrency, transition, recovery, abuse case, UI feedback과 schema를 연결합니다. 주 템플릿/profile은 `system-specification`/`system-feature-specification`, 관련 역할은 `system-economy-designer`와 `ux-accessibility-reviewer`, 다음 스킬은 `review-game-design`입니다.

## 생성 파일과 결과 구조

Canonical Artifact에 rule·state·exception·data ID와 validation task를 기록합니다. 복잡한 precedence는 `rule-exception-matrix`, schema 집중 작업은 `data-schema-table-contract`를 함께 사용할 수 있습니다. 예상 결과 요약: 설계와 엔지니어링이 동일한 실행 계약을 검토할 수 있습니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `system-specification` — [system-specification 템플릿](../templates.md#system-specification).
- Quality Profile ID: `system-feature-specification`.
- Reviewer/role ID: `system-economy-designer · ux-accessibility-reviewer`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

`feature-readability-image`은 system-feature-specification profile에서 플레이어 신호를 검토할 때만 계획합니다. rule/state/exception 관계가 표보다 복잡할 때만 `skillstead-feature-state-diagram`을 Skillstead로 만들고, 별도 illustration slot은 template manifest가 요구할 때만 계획합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

모든 transition에는 trigger, guard, source/target state, side effect, feedback이 필요합니다. precedence가 결정되지 않았거나 balance 근거가 없으면 완료를 막고 owner가 있는 결정·검증 항목으로 남깁니다.

## 실패·fallback·재개 방법

권위 데이터나 precedence가 빠졌다면 구현 승인을 주장하지 않고 기존 섹션을 보존합니다.

```text
$game-design-studio:design-game-systems 기존 system-specification에서 미해결 precedence만 재개해. 새 server-authoritative 규칙과 실패 복구 근거를 연결하고 나머지는 보존해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Studio review-game-design로 현재 Artifact의 검증된 기록을 이어 rule precedence와 recovery blocker를 검토해.

```text
$game-design-studio:review-game-design artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[system-specification 템플릿](../templates.md#system-specification), [review-game-design 스킬](./review-game-design.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
