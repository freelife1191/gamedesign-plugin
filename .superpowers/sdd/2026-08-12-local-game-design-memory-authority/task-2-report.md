# Task 2 보고서 — sealed 내용 우선 scanner

## 범위

- `shared/scripts/lib/safe-memory-store.mjs`
- `tests/unit/design-memory-store.test.mjs`

scanner가 sealed claim과 instance의 canonical 내용을 먼저 검증한 뒤 event의 논리
정체성으로 canonical 경로를 계산하도록 변경했다. event를 모두 확정한 후에는
`eventId` lookup을 기준으로 marker의 memory ID, event ID, target 경로 및 optional
digest를 결속한다. seal, 경로, marker 결속 오류는 모두 scan 전체를 닫고 빈 event 및
quarantine 목록을 반환한다.

## RED

명령:

```sh
node --test --test-name-pattern="moved|marker binding|unbound" tests/unit/design-memory-store.test.mjs
```

결과: 3개 중 0 통과, 3 실패.

- 이동된 disputed event 뒤 `scan.complete`가 `true`여서 이전 approved 상태가 계속
  authority 입력으로 남았다.
- marker target path/event/memory/digest 위조 뒤에도 `scan.complete`가 `true`였다.
- 존재하지 않는 marker target도 `scan.complete`가 `true`였다.

실패는 모두 기존 scanner가 물리 경로와 marker target을 memory 단위 taint로만
처리하고, 부분적으로 읽은 event를 반환한 데서 재현됐다.

## GREEN 및 검증

```sh
node --test --test-name-pattern="moved|marker binding|unbound" tests/unit/design-memory-store.test.mjs
```

결과: 3/3 통과, 실패 0.

```sh
node --test tests/unit/design-memory-store.test.mjs
```

결과: 총 16개 중 15 통과, 실패 0, 의도된 same-user directory-swap non-goal 1 skip.

```sh
node --check shared/scripts/lib/safe-memory-store.mjs
git diff --check
```

결과: 두 명령 모두 성공, 출력 없음.

## 남은 범위

append 전 권한 통합(Task 3), symlink/Git exclude(Task 4), multiprocess 및 failpoint
복구(Task 5)는 이번 변경에 포함하지 않았다.
