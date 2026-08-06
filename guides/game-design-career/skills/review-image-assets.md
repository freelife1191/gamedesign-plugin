# review-image-assets

## 목적과 최종 산출물

Career image의 권리·provenance·가독성·accessibility·placement를 검토하고 named-human evidence가 있을 때만 lifecycle transition을 적용합니다.

## 사용할 때

- portfolio proof image를 document에 넣기 전 권리와 alt text를 검토할 때
- `concept-draft → document-approved → production-candidate` 전환을 기록할 때

## 사용하지 않을 때

- agent 추천, 생성 성공, file existence 또는 timestamp만으로 승인할 때
- 이미지를 career evidence나 portfolio claim의 증명으로 바꿀 때

## 필수 입력과 선택 입력

- 필수: validated manifest, stable asset ID, requested state, actual user decision evidence, named human reviewer/time, artifact-local evidence paths, placement, alt text, readability, scope, rights/provenance decision
- `production-candidate` 추가 필수: technical fit, gameplay readability와 active rights evidence
- 선택: prior findings, prompt/variant notes와 revocation history

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career portfolio-proof-01의 provenance, 권리, alt text, placement와 가독성을 검토해. 내 실제 결정 receipt가 없으면 승인하지 말고 blocker만 남겨.
```

## Codex CLI 요청 예시

```text
$game-design-career:review-image-assets assetId=portfolio-proof-01, requestedState=document-approved, reviewer="[실제 담당자 이름]", decision=approve
```

## 내부 진행 흐름

manifest와 artifact-local evidence를 검증합니다. `visual-asset-reviewer`와 `art-brief-director`는 findings와 recommendation만 냅니다. 사용자는 stable asset ID와 실제 승인/거부 결정을 입력하고, host adapter가 immutable structured `host-user-image-decision` receipt를 수집한 뒤 reviewer, time, evidence와 rights decision을 묶어 순차 transition을 적용합니다. 임의 JSON·문자열 receipt는 거부됩니다.

## 생성 파일과 결과 구조

stable asset ID, evidence-bounded findings, named-human decision record, requested/accepted transition, receipt, blockers와 derivative eligibility를 반환합니다. 예상 결과 요약: 권고와 사람 승인이 분리된 lifecycle 기록이 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

이미지를 새로 만들지 않고 기존 asset의 provenance·권리·배치·alt text를 조건부 검토합니다. 관계 도식은 이 검토의 산출물이 아니며 [이미지 자산 흐름](../image-assets.md)의 host-user decision receipt가 있어야 상태 전이가 가능합니다.

## 검토·승인 기준

named reviewer가 없는 경우 transition하지 않습니다. `production-candidate`는 release, legal, 채용 제출 또는 production approval이 아닙니다. `document-approved` 미만 asset을 final MD/PDF/DOCX/PPTX에 binding하지 않습니다.

## 실패·fallback·재개 방법

provenance, placement, alt text, rights, accessibility 또는 actual user receipt가 없으면 현재 state를 유지합니다. arbitrary disk JSON과 product specialist ID는 human evidence가 아닙니다.

```text
$game-design-career:review-image-assets 기존 findings와 state를 유지하고 named-human rights receipt가 추가된 지점부터 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:review-image-assets 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [이미지 자산 흐름](../image-assets.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
