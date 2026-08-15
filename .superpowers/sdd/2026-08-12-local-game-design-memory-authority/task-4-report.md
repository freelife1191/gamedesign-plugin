# Task 4 report — 기존 경로와 Git exclude identity

## RED → GREEN

RED를 먼저 추가하고 다음 명령을 실행했다.

```sh
node --test --test-name-pattern='ancestor symlinks|Git common and info|Git exclude identity|pathname swaps' tests/unit/design-memory-store.test.mjs
```

결과: 5개 실패, 0개 통과. workspace/home ancestor symlink는 초기화를
허용했고, Git common/info ancestor와 `beforeAppend`/`beforeFinalRecheck` fixture는
`ready`를 반환했다.

구현 뒤의 focused 검증:

```sh
node --check shared/scripts/lib/safe-memory-store.mjs
node --test --test-name-pattern='ancestor symlinks|Git common and info|Git exclusion leaves|Git exclude identity|pathname swaps' tests/unit/design-memory-store.test.mjs
```

결과: 6개 통과, 0개 실패.

## 구현

- 호출 전에 존재한 절대 경로 component를 `lstat`·`realpath`·directory
  identity로 검사하는 `inspectExistingPathChain()`을 추가했다. workspace, home,
  store 부모, Git common/info 생성 경로가 이 검사를 생성 전과 생성 후에 통과해야 한다.
- Git exclude는 `O_NOFOLLOW` handle에서 bounded bytes와 dev/ino/size/mtime/ctime,
  SHA-256 snapshot을 고정한다. 쓰기 전 재읽기, 정확한 append bytes와 sync, 최종
  handle bytes 및 pathname identity를 모두 확인한다.
- 불일치는 `memory.git_exclude` warning으로만 종료한다. memory append를
  되돌리거나 사용자 bytes를 rollback하지 않는다.

## 최종 검증

```sh
node --test tests/unit/design-memory-store.test.mjs
node --test tests/unit/design-memory-config.test.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
node --check shared/scripts/lib/safe-memory-store.mjs
node --check tests/unit/design-memory-store.test.mjs
git diff --check
```

결과:

- store: 32 PASS, 0 FAIL, same-user between-syscall directory swap non-goal 1 SKIP.
- config/record/store: 81 PASS, 0 FAIL, 같은 의도적 non-goal 1 SKIP.
- 두 syntax check와 diff check 모두 성공.

## 범위와 non-goal

- 변경 파일은 Task 4 소유 파일 세 개뿐이다.
- 같은 OS 사용자가 승인된 syscall 사이에서 path를 바꾸는 공격은 기존 명시적
  non-goal로 남긴다.

## Fix round 1 — hard-link 및 최종 metadata identity

독립 리뷰의 Important 두 건을 RED로 재현했다.

```sh
node --test --test-name-pattern='hard-link victim|metadata changes after sync' tests/unit/design-memory-store.test.mjs
```

결과: 0 PASS, 2 FAIL. 기존 hard-link exclude는 `ready`를 반환했고 victim alias에
marker를 추가했으며, `beforeFinalRecheck`의 `utimes(..., 2000-01-01)` metadata-only
변경도 `ready`를 반환했다.

GREEN 구현은 모든 Git snapshot과 pathname 검증에 `nlink === 1`을 포함하고,
write+sync 직후 handle에서 기대 post-append snapshot을 고정한다. seam 뒤 handle과
pathname은 expected dev/ino/size/mtime/ctime/nlink 및 exact bytes와 각각 같아야 한다.
hard-link 거부 전에도 열린 handle은 항상 닫힌다.

```sh
node --check shared/scripts/lib/safe-memory-store.mjs
node --test --test-name-pattern='hard-link victim|metadata changes after sync|Git exclusion is best-effort|identity changes before append|pathname swaps' tests/unit/design-memory-store.test.mjs
node --test tests/unit/design-memory-store.test.mjs
node --test tests/unit/design-memory-config.test.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
node --check tests/unit/design-memory-store.test.mjs
git diff --check
```

결과:

- focused: 5 PASS, 0 FAIL.
- store: 34 PASS, 0 FAIL, same-user between-syscall non-goal 1 SKIP.
- config/record/store: 83 PASS, 0 FAIL, 같은 non-goal 1 SKIP.
- 두 syntax check와 diff check 모두 성공.
