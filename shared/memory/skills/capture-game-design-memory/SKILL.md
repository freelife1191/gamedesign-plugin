---
name: capture-game-design-memory
description: Use when a completed game-design result may yield a reviewable project-memory candidate without automatic approval.
---

# 게임 기획 기억 후보 캡처

1. `GAME_DESIGN_MEMORY_ENABLED=false`인지 설정을 확인한다. 비활성화면 후보를 만들지 않고 기존 작업을 계속한다.
2. 요청 단위 기억 제외가 있는지 확인한다. 제외면 후보를 만들지 않고 기존 작업을 계속한다.
3. 프로젝트 ID를 확인한다. 없거나 불명확하면 캡처하지 않고 기존 작업을 계속한다.
4. 결과물의 검증과 완료 gate가 끝났는지 확인한다.
5. 명시적 사용자 선호, 사람 결정, 검증된 플레이테스트·검토 발견처럼 허용된 사건만 선별한다. 민감 정보와 검증되지 않은 추측은 제외한다.
6. 원본 근거와 적용·제외 조건을 붙여 후보를 작성한다.
7. 자동 승인하지 않는다. 후보·검토자·도구는 approve 권한이 없다.
8. 만든 후보 수와 제외 사유를 보고한다.

Hook을 사용할 수 없거나 기억 저장소·후보 기록이 실패하면 기획 결과를 막지 말고, 후보 없이 기존 작업을 계속한다.
