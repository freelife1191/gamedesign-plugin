---
source_prompt_id: studio:case:ST-C04
route: studio
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

## 사람 검토
사람 accessibility owner와 design owner가 지원 플랫폼과 blocker를 검토합니다. 상태: pending. 결과 보장 없음: mockup과 renderer는 접근성 승인을 대신하지 않습니다.
