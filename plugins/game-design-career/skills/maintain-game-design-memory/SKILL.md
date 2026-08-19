---
name: maintain-game-design-memory
description: Use when a human reviews game-design memory candidates or approves, rejects, retires, lints, or rebuilds them.
---

# 게임 기획 기억 유지관리

1. `GAME_DESIGN_MEMORY_ENABLED=false`인지 설정을 확인한다. 비활성화면 유지관리를 건너뛰고 기존 작업을 계속한다.
2. 요청 단위 기억 제외가 있는지 확인한다. 제외면 유지관리를 건너뛰고 기존 작업을 계속한다.
3. 프로젝트 ID를 확인한다. 없거나 불명확하면 변경하지 않고 기존 작업을 계속한다.
4. 후보와 현재 상태를 목록으로 보여 준다.
5. 사람의 명시적 approve, reject, retire 지시와 해당 근거를 확인한다. 자동 승인하거나 상태를 추측하지 않는다.
6. 허용된 변경 뒤 lint와 rebuild를 실행한다.
7. 변경 log와 memory ID를 보고한다.

검토 책임자도 상태 승인 권한을 자동으로 얻지 않는다. Hook을 사용할 수 없거나 저장소·lint·rebuild가 실패하면 상태를 바꾸지 말고 기존 작업을 계속한다.
