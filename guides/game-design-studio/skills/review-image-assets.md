# review-image-assets

## 목적과 최종 산출물

stable image asset의 시각·접근성·배치·권리 근거와 실제 사용자 결정을 검토해 허용된 lifecycle transition만 기록합니다.

## 사용할 때

- `concept-draft`를 문서용으로 승인할지 검토할 때
- `document-approved`를 production 검토 후보로 올릴 근거를 확인할 때

## 사용하지 않을 때

- agent 권고, timestamp, 파일 존재만으로 승인할 때
- `production-candidate`를 release·법무·production approval로 해석할 때

## 필수 입력과 선택 입력

- 필수: manifest, stable asset ID, requested transition, 실제 user decision receipt, named human, review time, artifact-local evidence, rights decision
- 문서 승인 필수: purpose, placement, alt text, readability
- 후보 승격 필수: technical fit, gameplay readability, active rights

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio asset hero-keyart-01의 placement, alt text, readability와 rights evidence를 검토해. 실제 named human 결정을 확인한 경우에만 document-approved transition을 기록해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:review-image-assets artifact=artifacts/coop-rpg-brief, assetId=hero-keyart-01, targetState=document-approved, reviewer="[실제 담당자 이름]", decision=approve
```

## 내부 진행 흐름

manifest를 검증하고 `visual-asset-reviewer`와 `art-brief-director`의 finding을 받습니다. 사용자는 stable asset ID와 실제 승인/거부 결정을 입력하고 host adapter가 immutable structured decision receipt를 공급한 경우에만 strict order로 transition을 적용합니다. 임의 JSON·문자열 receipt는 거부됩니다. 주 템플릿/profile은 현재 artifact 선택값, 다음 스킬은 `export-game-design-documents` 또는 추가 사람 검토입니다.

## 생성 파일과 결과 구조

asset ID, findings, named human decision, accepted/rejected transition, lifecycle receipt, blocker와 derivative eligibility를 반환합니다. 예상 결과 요약: 이미지의 사용 가능 범위가 evidence와 사람 결정에 묶입니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 review가 profile을 바꾸지 않음`.
- Reviewer/role ID: `visual-asset-reviewer · art-brief-director`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

기존 illustration asset의 placement·alt text·rights만 검토합니다. 새 구조 도식이나 이미지를 만들지 않으며 `document-approved`가 된 asset만 export binding 후보가 됩니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

순서는 `concept-draft → document-approved → production-candidate`입니다. 단계를 건너뛸 수 없고 specialist ID는 named human을 대신하지 않습니다. `production-candidate`도 release/legal/production approval이 아닙니다.

## 실패·fallback·재개 방법

권리, 배치, 접근성 또는 user decision evidence가 빠지면 상태를 바꾸지 않고 blocker와 권고를 보존합니다.

```text
$game-design-studio:review-image-assets 기존 finding과 asset state를 유지하고, 새 named-human rights receipt와 artifact-local evidence로 요청한 transition만 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 조건부 다음 handoff**

@Game Design Studio requested transition이 document-approved가 되어 export binding 조건을 만족할 때만 export-game-design-documents로 진행해. 그렇지 않으면 review finding을 보존해.

```text
$game-design-studio:export-game-design-documents artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

`document-approved` export binding 조건을 만족한 경우의 허용 대상은 `export-game-design-documents`뿐입니다. 그 외 상태에서는 이 review artifact와 finding만 유지합니다.

## 관련 문서

[템플릿 카탈로그](../templates.md), [export-game-design-documents 스킬](./export-game-design-documents.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
