---
source_prompt_id: studio:case:ST-C04
route: studio
supplied_fact_ids: none
evidence_ids: none
---
# 첫 세션: 접근성 흐름 초안

## 간단 요청 예시
@Game Design Studio ST-C04의 공개 가능한 사실, 추론, 제안을 분리해 canonical artifact를 작성해.

## 선택된 작업 순서
- `apply-document-quality-profile`
- `design-player-experience`
- `review-game-design`
- `visualize-game-design`

## 참여 역할
- `ux-accessibility-reviewer`
- `lead-game-designer`

## 이 요청으로 받는 결과
허구 입력은 시작·설정·첫 전투로 이어지는 화면 흐름이다. 확인 정보: 키보드와 터치 입력을 함께 고려한다. 가정: 설정 건너뛰기가 이탈을 줄인다는 것은 아직 모른다. 제안: loading·empty·error·중단 화면을 flow state에 함께 기록한다. 다음 질문: 대체 입력에서 전투 시작 상태를 어떻게 되돌릴 것인가?

## 산출물
- `ui-ux-flow-state`
- `accessibility-platform-matrix`
- `game-design-review`

## 읽는 순서
- `game-design/[프로젝트 ID]/ui-ux-flow-state/content.md`
- `game-design/[프로젝트 ID]/ui-ux-flow-state/evidence.yml`
- `game-design/[프로젝트 ID]/ui-ux-flow-state/export-manifest.yml`

## 보호한 가정
가상의 사례이며 허구 데이터만 사용합니다. 확인되지 않은 접근성 요구와 플랫폼 제약은 미정으로 남깁니다.

## 사람 결정
**읽는 순서:** 사용자 목표 → 핵심 행동표 → 상태 범위 → 플랫폼표 → 근거·결정 순서입니다. 중간 결과에서 로딩·빈 화면·오류·중단 상황과 대체 입력 누락을 먼저 봅니다. **사람 결정:** 접근성 책임자와 기획 책임자가 지원 플랫폼, 검증 방법과 진행을 막는 문제를 승인·수정·보류합니다. 화면 시안·문서 변환 도구·검토 결과는 자동 승인하지 않습니다.

- 결정 상태: pending
- 가능한 행동: 승인·수정·보류

결과 보장 없음: mockup과 renderer는 접근성 승인을 대신하지 않습니다.
