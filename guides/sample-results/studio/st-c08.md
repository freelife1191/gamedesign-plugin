---
source_prompt_id: studio:case:ST-C08
route: studio
---
# 여덟 주 시제품: 범위·출력 준비 초안

## 간단 요청 예시
@Game Design Studio ST-C08의 공개 가능한 사실, 추론, 제안을 분리해 canonical artifact를 작성해.

## 선택된 작업 순서
- `plan-game-production`
- `review-game-design`
- `plan-image-assets`
- `visualize-game-design`
- `export-game-design-documents`

## 참여 역할
- `production-feasibility-critic`
- `lead-game-designer`
- `visual-asset-reviewer`
- `document-quality-editor`

## 이 요청으로 받는 결과
허구 입력은 여덟 주 안에 항해·복구·한 보스만 담는 시제품이다. 확인 정보: 팀 규모와 엔진 선택은 공개하지 않는다. 가정: 한 장의 흐름도가 의사결정을 빠르게 한다는 것은 미정이다. 제안: 기능별 kill 조건과 export QA를 분리한다. 다음 질문: renderer가 없는 환경에서 어떤 결과를 보류할 것인가?

## 산출물
- `production-scope-risk`
- `game-design-review`
- `export-preparation-manifest`

## 읽는 순서
- `game-design/[프로젝트 ID]/production-scope-risk/content.md`
- `game-design/[프로젝트 ID]/production-scope-risk/evidence.yml`
- `game-design/[프로젝트 ID]/production-scope-risk/export-manifest.yml`

## 보호한 가정
가상의 사례이며 허구 데이터만 사용합니다. 확인되지 않은 capacity와 asset 권리는 미정으로 남깁니다.

## 사람 결정
**읽는 순서:** `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`. 중간 결과에서 blocker, capacity gap, image lifecycle, renderer capability와 형식별 QA를 따로 봅니다. **사람 결정:** production owner가 scope·kill, review decision owner가 finding disposition, rights/asset owner가 이미지 transition, export owner가 실제 format QA를 승인합니다. 생성, render, lint, reviewer finding과 state 문자열은 자동 승인하지 않습니다.

- 결정 상태: pending
- 가능한 행동: 승인·수정·보류

결과 보장 없음: render와 lint는 format QA 승인을 대신하지 않습니다.

## 이미지 계보와 검토 상태
- `asset_id`: `wind-island-flow-diagram`
- `derivative_of`: `wind-island-master`
- `approval_state`: `concept-draft`
- `review_decision`: `pending`

이 이미지는 concept-draft이며 document-approved 또는 production-candidate가 아닙니다.