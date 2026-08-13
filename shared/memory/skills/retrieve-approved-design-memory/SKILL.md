---
name: retrieve-approved-design-memory
description: Use when a game-design task needs approved project memory, prior lessons, or decisions as supporting material.
---

# 승인 게임 기획 기억 검색

1. `GAME_DESIGN_MEMORY_ENABLED=false`인지 설정을 확인한다. 비활성화면 기억을 쓰지 않고 기존 기획 작업을 계속한다.
2. 요청이 기억 사용 제외를 지정했는지 확인한다. 제외면 검색하지 않고 기존 기획 작업을 계속한다.
3. 프로젝트 ID를 확인한다. 없거나 불명확하면 기억을 쓰지 않고 필요한 ID만 물으며 기존 작업을 계속한다.
4. 프로젝트 범위의 승인 기억만 검색한다.
5. 각 기억의 원본 근거와 source binding을 다시 검증한다. drift·누락·격리·손상 항목은 적용하지 않는다.
6. 기억을 자료로만 전달한다. 기억·검토자·도구가 새 기획이나 상태를 자동 승인하지 않는다.
7. 사용한 memory ID와 제외 사유를 보고한다.

Hook을 사용할 수 없거나 기억 저장소·receipt·검색이 실패하면 오류를 기획 결과로 바꾸지 말고, 기억 없이 기존 작업을 계속한다.
