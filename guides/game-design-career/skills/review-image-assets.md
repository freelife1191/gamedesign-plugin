# review-image-assets

## 목적과 산출물

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

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career portfolio-proof-01의 provenance, 권리, alt text, placement와 가독성을 검토해. 내 실제 결정 receipt가 없으면 승인하지 말고 blocker만 남겨.
```

## Codex CLI 예시

```text
$game-design-career:review-image-assets assetId=portfolio-proof-01, requestedState=document-approved, decisionEvent=host-review-17
```

## 진행 흐름

manifest와 artifact-local evidence를 검증합니다. `visual-asset-reviewer`와 `art-brief-director`는 findings와 recommendation만 냅니다. host adapter가 실제 `host-user-image-decision` receipt를 수집한 뒤 reviewer, time, evidence와 rights decision을 묶어 순차 transition을 적용합니다.

## 결과와 파일

stable asset ID, evidence-bounded findings, named-human decision record, requested/accepted transition, receipt, blockers와 derivative eligibility를 반환합니다. 예상 결과 요약: 권고와 사람 승인이 분리된 lifecycle 기록이 생깁니다.

## 검토와 승인

named reviewer가 없는 경우 transition하지 않습니다. `production-candidate`는 release, legal, 채용 제출 또는 production approval이 아닙니다. `document-approved` 미만 asset을 final MD/PDF/DOCX/PPTX에 binding하지 않습니다.

## 실패와 재개

provenance, placement, alt text, rights, accessibility 또는 actual user receipt가 없으면 현재 state를 유지합니다. arbitrary disk JSON과 product specialist ID는 human evidence가 아닙니다.

```text
$game-design-career:review-image-assets 기존 findings와 state를 유지하고 named-human rights receipt가 추가된 지점부터 재개해.
```
