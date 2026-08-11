---
source_prompt_id: studio:case:ST-C03
route: studio
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

## 사람 검토
사람 design owner와 engineering owner가 precedence, migration과 rollback을 검토합니다. 상태: blocked. 결과 보장 없음: 표와 lint 결과는 배포 승인을 뜻하지 않습니다.
