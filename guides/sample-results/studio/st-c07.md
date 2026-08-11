---
source_prompt_id: studio:case:ST-C07
route: studio
supplied_fact_ids: none
evidence_ids: none
---
# 등대 축제: 경제 실험 초안

## 간단 요청 예시
@Game Design Studio ST-C07의 공개 가능한 사실, 추론, 제안을 분리해 canonical artifact를 작성해.

## 선택된 작업 순서
- `apply-document-quality-profile`
- `design-game-economy-and-liveops`
- `design-game-systems`
- `review-game-design`

## 참여 역할
- `system-economy-designer`
- `liveops-data-designer`
- `ux-accessibility-reviewer`

## 이 요청으로 받는 결과
허구 입력은 축제 재화의 획득·소비·중단 기준이다. 확인 정보: 재화는 이벤트 안에서만 쓰인다. 가정: 하루 한 번의 선택 보상이 복귀를 늘린다는 것은 검증 전이다. 제안: 가격·확률·rollback을 한 실험 기록에 분리한다. 다음 질문: 불리한 조건을 읽기 쉽게 고지하는가?

## 산출물
- `economy-balance`
- `liveops-experiment-event`
- `game-design-review`

## 읽는 순서
- `game-design/[프로젝트 ID]/economy-balance/content.md`
- `game-design/[프로젝트 ID]/economy-balance/evidence.yml`
- `game-design/[프로젝트 ID]/economy-balance/export-manifest.yml`

## 보호한 가정
가상의 사례이며 허구 데이터만 사용합니다. 확인되지 않은 telemetry와 수치는 미정으로 남깁니다.

## 사람 결정
**읽는 순서:** resource flow → progression/recovery → price·probability evidence → experiment → guardrail·rollback → decisions입니다. 중간 결과에서 source 없는 수치, 다중 변수, 복구 불가 변경을 blocker로 봅니다. **사람 결정:** economy, LiveOps, policy와 accessibility owner가 실험 실행·중단·rollback을 승인합니다. simulation, telemetry 수집과 reviewer 권고는 자동 승인하지 않습니다.

- 결정 상태: blocked
- 가능한 행동: 승인·수정·보류

결과 보장 없음: simulation은 경제 효과를 확정하지 않습니다.
