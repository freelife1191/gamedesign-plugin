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

## Fix round 1 — sealed bytes, claim envelope, diagnostics

독립 리뷰의 세 Important를 TDD로 보정했다.

### RED

```sh
node --test --test-name-pattern="raw sealed|canonical envelope|do not expose" tests/unit/design-memory-store.test.mjs
```

결과: 3개 중 0 통과, 3 실패.

- invalid leading/continuation byte를 가진 raw event/marker instance가 lossy UTF-8
  decode와 decoded-content ID로 authority를 얻었다.
- extra, missing, duplicate, whitespace 변경, non-object claim envelope이 완전히
  닫히지 않았다.
- secret-looking, newline/control, 긴 component와 invalid Unicode component를 가진
  물리 경로가 diagnostics에 그대로 포함됐다.

### GREEN

- raw instance는 fatal UTF-8 decode를 통과해야 하며, event/marker ID는 decoded
  문자열이 아니라 raw Buffer SHA-256과 일치해야 한다.
- claim/commit bytes는 exact five-key plain-object envelope 및 `claimBytes()`의
  canonical JSON/LF와 일치해야 한다.
- scanner diagnostics는 stable code만 기록하고 untrusted physical path나 raw
  document bytes를 복사하지 않는다.

```sh
node --test --test-name-pattern="raw sealed|canonical envelope|do not expose" tests/unit/design-memory-store.test.mjs
```

결과: 3/3 통과, 실패 0.

```sh
node --test tests/unit/design-memory-store.test.mjs
```

결과: 총 19개 중 18 통과, 실패 0, 의도된 same-user directory-swap non-goal 1 skip.

```sh
node --test tests/unit/design-memory-config.test.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
```

결과: 총 68개 중 67 통과, 실패 0, 의도된 non-goal 1 skip.

```sh
node --check shared/scripts/lib/safe-memory-store.mjs
node --check tests/unit/design-memory-store.test.mjs
git diff --check
```

결과: 모두 성공, 출력 없음.
