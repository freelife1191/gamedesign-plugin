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

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

이미지를 새로 만들지 않고 기존 asset의 provenance·권리·배치·alt text를 조건부 검토합니다. 관계 도식은 이 검토의 산출물이 아니며 [이미지 자산 흐름](../image-assets.md)의 host-user decision receipt가 있어야 상태 전이가 가능합니다.

## 검토·승인 기준

순서는 `concept-draft → document-approved → production-candidate`입니다. 단계를 건너뛸 수 없고 specialist ID는 named human을 대신하지 않습니다. `production-candidate`도 release/legal/production approval이 아닙니다.

## 실패·fallback·재개 방법

권리, 배치, 접근성 또는 user decision evidence가 빠지면 상태를 바꾸지 않고 blocker와 권고를 보존합니다.

```text
$game-design-studio:review-image-assets 기존 finding과 asset state를 유지하고, 새 named-human rights receipt와 artifact-local evidence로 요청한 transition만 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:review-image-assets 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [이미지 자산 흐름](../image-assets.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
