---
source_prompt_id: suite:gdd-image-presentation:case
route: suite
supplied_fact_ids: none
evidence_ids: none
---
# GDD 이미지 발표: concept-draft handoff

## 간단 요청 예시
@Game Design Studio와 @Game Design Career에서 gdd-image-presentation handoff를 public/evidence-safe하게 작성해.

## 선택된 작업 순서
- `orchestrate-game-design-project`
- `plan-image-assets`
- `review-image-assets`
- `export-game-design-documents`

## 참여 역할
- `lead-game-designer`
- `career-strategist`

## 이 요청으로 받는 결과
허구 입력은 GDD 한 장과 등대 섬의 concept-draft 이미지 설명이다. 확인 정보: 이미지는 발표용 배치 후보일 뿐이다. 가정: 도식과 이미지가 같은 의사결정을 설명한다는 것은 미정이다. 제안: 이미지 권리·배치·대체 텍스트를 export 전에 분리한다. 다음 질문: document-approved 전 어떤 슬라이드를 보류해야 하는가?

## 산출물
- `content.md, approved images, PPTX preflight`

## 읽는 순서
- `suite/gdd-image-presentation/content.md`
- `suite/gdd-image-presentation/evidence.yml`
- `suite/gdd-image-presentation/export-manifest.yml`

## 보호한 가정
가상의 사례이며 허구 데이터만 사용합니다. 확인되지 않은 이미지 권리와 렌더 결과는 미정으로 남깁니다.

## 사람 결정
지정된 의사결정권자가 gdd-image-presentation의 공개 범위를 승인하거나 보류한다.

- 결정 상태: pending
- 가능한 행동: 승인·수정·보류

결과 보장 없음: preflight는 PPTX 승인이나 권리 허가를 보장하지 않습니다.

## 이미지 계보와 검토 상태
- `asset_id`: `lighthouse-master`
- `derivative_of`: `null`
- `approval_state`: `concept-draft`
- `asset_id`: `lighthouse-slide`
- `derivative_of`: `lighthouse-master`
- `approval_state`: `concept-draft`
- `review_decision`: `pending`

이 이미지는 concept-draft이며 document-approved 또는 production-candidate가 아닙니다.
