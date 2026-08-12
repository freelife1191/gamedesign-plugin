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
