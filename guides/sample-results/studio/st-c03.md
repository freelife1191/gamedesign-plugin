---
source_prompt_id: studio:case:ST-C03
route: studio
supplied_fact_ids: none
evidence_ids: none
---
# 장비 강화: 규칙과 예외 초안

## 간단 요청 예시
@Game Design Studio ST-C03의 공개 가능한 사실, 추론, 제안을 분리해 canonical artifact를 작성해.

## 선택된 작업 순서
- `apply-document-quality-profile`
- `design-game-systems`
- `design-player-experience`
- `review-game-design`

## 참여 역할
- `lead-game-designer`
- `system-economy-designer`

## 이 요청으로 받는 결과
허구 입력은 강화 1회와 실패 시 재료 반환 규칙이다. 확인 정보: 강화 단계와 재료 이름은 임시다. 가정: 실패 보정이 재도전을 돕는다는 것은 검증 전이다. 제안: 예외 표에 취소·연결 끊김·중복 지급을 별도 state로 둔다. 다음 질문: rollback 뒤 플레이어에게 어떤 근거를 보여 줄 것인가?

## 산출물
- `system-specification`
- `rule-exception-matrix`
- `data-schema-table-contract`

## 읽는 순서
- `game-design/[프로젝트 ID]/system-specification/content.md`
- `game-design/[프로젝트 ID]/system-specification/evidence.yml`
- `game-design/[프로젝트 ID]/system-specification/export-manifest.yml`

## 보호한 가정
가상의 사례이며 허구 데이터만 사용합니다. 확인되지 않은 수치와 우선순위는 미정으로 남깁니다.

## 사람 결정
**읽는 순서:** 시스템 경계 → 규칙표 → 예외표 → 데이터 관계 → 근거·결정 순서입니다. 중간 결과에서 규칙 ID마다 상태, 반응, 실패 처리와 시험 항목이 있는지 봅니다. **사람 결정:** 기획 책임자와 개발 책임자가 권한, 우선순위, 이전 방법과 되돌리기 기준을 승인합니다. 검토 의견과 자동 검사만으로 승인하지 않습니다.

- 결정 상태: blocked
- 가능한 행동: 승인·수정·보류

결과 보장 없음: 표와 lint 결과는 배포 승인을 뜻하지 않습니다.
