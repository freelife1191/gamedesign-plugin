# Plugin And Bundled Skill Update Advisory Final Fix Report

## 상태

- 결과: 승인된 최종 리뷰의 IMPORTANT 3건과 MINOR 1건을 모두 수정했다.
- 작업 기준: `9b1067b..37357f4`
- 커밋 제목: `fix: harden update advisory state and locking`
- 실행 범위: 로컬 fixture와 임시 디렉터리만 사용했다. 실제 네트워크, 실제 사용자 캐시/상태, `docs/LLM WIKI/`는 읽거나 쓰지 않았다.
- 자동 업데이트: 추가하지 않았다. SessionStart hook은 여전히 하나이며 advisory 전용이다.

## 수정 내용

### 1. 버전이 닫힌 알림 identity

- 캐시의 `lastNotifiedComponentIds`를 정렬된 `lastNotifiedComponents` 레코드로 교체했다.
- 각 레코드는 정확히 `{ id, installedTag, latestTag }`만 허용한다.
- 같은 outdated 버전 조합은 계속 억제하지만, 같은 component ID의 최신 태그가 `vN`에서 `vN+1`로 바뀌면 다시 한 번만 알린다.
- 구 identity, 부분 상태, unknown key, advisory와 불일치하는 identity는 캐시 hit로 사용하지 않고 fail-closed 재검사한다.
- fresh-cache claim과 stale-cache refresh 모두 동일한 operation lock 아래 원자적으로 캐시를 게시한다.

### 2. 비-SemVer 릴리스 후보 처리

- 구조가 정확하고 공식 canonical release URL을 가진 임의 비-SemVer 태그(예: `vnot-semver`)는 후보에서 제외한다.
- malformed object와 official URL 구조 손상은 계속 `unknown`이다.
- 숫자로 SemVer를 의도했지만 규칙을 위반한 태그와 잘못된 prerelease 표시는 기존 승인 규칙대로 `unknown`을 유지한다.

### 3. Windows 캐시 경로

- Windows 드라이브/UNC 절대 경로를 플랫폼 구분자로 조합한다.
- `LOCALAPPDATA`가 상대 경로이면 사용하지 않고 절대 `home/AppData/Local`로 fallback한다.
- POSIX에서 Windows 동작을 시험할 때도 실제 임시 cwd 아래에는 파일이나 디렉터리를 만들지 않는다.
- home 자체가 절대 경로가 아니면 경로를 cwd에서 해석하지 않고 공개 결과를 `unknown`으로 닫는다.

### 4. 오래된 operation lock 회수

- lock directory 안에 exact-key `owner.json`을 `O_EXCL`, `O_NOFOLLOW`, mode `0600`으로 만든다.
- owner는 현재 PID와 nonce를 포함하고, createdAt은 canonical ISO instant다.
- 최소 30초이면서 checker timeout보다 긴 lease가 지났고 owner PID가 존재하지 않을 때만 task-owned lock을 stale로 판정한다.
- 회수와 release는 inode/owner를 재검사한 뒤 unique quarantine 이름으로 원자 rename하고, 이동한 디렉터리가 같은 task-owned identity일 때만 exact metadata file과 빈 디렉터리를 제거한다.
- 활성 PID, malformed/unknown metadata, extra entry, symlink lock은 삭제하지 않는다.

## TDD 증거

### RED

- `vnot-semver` 혼합 evidence: 기대 `outdated`, 실제 `unknown`.
- Windows cache path: 기대 `C:\\Cache\\game-design-suite\\...`, 실제 host separator가 섞인 경로.
- 동일 component의 `v2.14.0 -> v2.15.0`: 기대 알림 1개, ID-only 비교 mutation에서 실제 0개.
- stale task-owned lock: 기대 `current` 및 네트워크 3회, 실제 1초 wait 뒤 `unknown` 및 네트워크 0회.
- 활성 owner PID가 있는 오래된 timestamp lock: timestamp-only 회수 구현에서 기대 `unknown`, 실제 `current`.

### GREEN

- `node --test tests/unit/update-advisory.test.mjs tests/unit/game-design-update-check.test.mjs`
  - 30 tests, 30 pass, 0 fail.
- 업데이트 기능 집중 묶음:
  - update checker/evaluator/packaging/manifest/suite checker/plugin inspection/capability/shared contracts/hooks/E2E
  - 84 tests, 84 pass, 0 fail.
- package parity contract:
  - Studio/Career generated snapshot exact clean-build parity 통과.

### Mutation 확인

- cache age `>=`를 `>`로 바꾸면 정확한 7일 경계 테스트가 `hit !== miss`로 실패했다.
- notification identity를 ID만 비교하도록 바꾸면 `v2.14.0 -> v2.15.0` 동시 claim 테스트가 `0 !== 1`로 실패했다.
- 모든 matching-prefix 비-SemVer를 evidence poison으로 되돌리면 `vnot-semver` 혼합 테스트가 `unknown`으로 실패했다.
- 세 mutation은 모두 원복했고 focused 30/30을 다시 통과했다.

## 생성물·정적 검증

- `npm run build`
  - Career 542 files
  - Studio 554 files
- `node tooling/build-snapshots.mjs --check`
  - Career/Studio 통과.
- shared와 두 plugin snapshot의 update checker/evaluator 바이트를 `cmp`로 확인했다.
- shared 및 packaged checker/evaluator `node --check` 통과.
- 두 `BUILD-MANIFEST.json`, update policy, installed manifest JSON parse 통과.
- `git diff --check` 통과.
- 빌드가 만든 두 임시 recovery bundle은 package parity 검증 뒤 각각 정확한 임시 경로만 제거했다.

## 전체 검증

- 명령: fresh `npm test`
- 결과: 2,259 tests; 2,258 pass; 0 fail; 1 skipped; 0 cancelled; 0 todo.
- 실행 시간: 1,034,790.12475 ms.
- skip은 기존에 명시된 `same-user directory swap` non-goal이며 이번 변경과 무관하다.

## 변경 파일

- source:
  - `shared/scripts/check-game-design-updates.mjs`
  - `shared/scripts/lib/update-advisory.mjs`
- regression tests:
  - `tests/unit/game-design-update-check.test.mjs`
  - `tests/unit/update-advisory.test.mjs`
- generated parity:
  - Studio/Career packaged checker/evaluator
  - Studio/Career `BUILD-MANIFEST.json`
- 이 보고서.

## 보존된 계약

- `GAME_DESIGN_UPDATE_CHECKS=false`의 cache/network zero I/O.
- 정확한 7일 경계 재검사.
- atomic notification claim과 Studio/Career shared cache.
- 세 개의 allowlisted GitHub releases endpoint만 사용.
- malformed/network/cache 오류의 fail-open public `unknown`.
- raw 오류, 로컬 경로, token/secret 비노출.
- SessionStart hook 1개.
- 사용자 승인 전 plugin/marketplace/vendor 자동 업데이트 없음.

## 남은 우려

- PID 조회가 `ESRCH`가 아닌 권한 오류를 반환하거나 PID가 재사용된 경우 stale lock을 보수적으로 보존한다. 이 경우 checker는 bounded wait 뒤 `unknown`이며 안전하지 않은 삭제를 하지 않는다.
- legacy ID-only cache는 한 번 재검사되어 새 closed schema로 교체된다. 의도된 fail-closed migration 비용이다.
- active/unknown/hostile lock contention은 최대 1초 wait 뒤 `unknown`을 반환한다. plugin 본래 기능은 계속 진행된다.

## Fix2: canonical lock publication과 cleanup 경계

### 수정 내용

- 새 lock은 canonical `.lock`을 먼저 만들지 않는다. unique staging regular file에 완전한 exact-key metadata를 `O_EXCL`·`O_NOFOLLOW`·`0600`으로 sync한 뒤, 같은 filesystem의 `link(staging, canonical)`으로 no-replace 게시한다. 따라서 canonical path에는 완성된 task-owned metadata file만 나타난다.
- staging 파일 정리는 canonical path를 다시 따라가지 않는다. 생성 실패와 게시 후 staging 정리는 identity-verified staging을 unique quarantine으로 이동한 뒤 그 quarantine만 삭제한다.
- 기존 directory-form task lock은 계속 inspect/reclaim/release한다. 오래된, 비-symlink, 정확히 빈 legacy directory만 mtime lease 이후 quarantine으로 이동해 회수한다. `owner.json`이 부분적이거나 unknown/extra entry가 있으면 canonical에 그대로 보존되고 checker는 1초 내 `unknown`으로 닫힌다.
- 새 regular-file lock release도 owner·inode·kind를 재검사한 뒤 quarantine에서만 삭제한다. PID/nonce/lease 검증과 active/symlink/hostile fail-closed 계약은 유지한다.

### TDD 증거

#### RED

- stale empty legacy `.lock`: 기대 `current`, network 3회였으나 기존 구현은 bounded `unknown`, network 0회로 실패했다.
- injected canonical directory-to-symlink swap: 기존 `createOwnedLock` catch가 `lockPath/owner.json`을 unlink해 외부 `owner.json` sentinel entry가 사라져 실패했다.

#### GREEN

- stale empty legacy lock은 회수 후 staged publication으로 `current`, network 3회이며 canonical/staging entry가 남지 않는다.
- 부분 `owner.json` legacy directory는 network 0회·`unknown`이며 bytes/entries를 보존한다.
- publication 중 canonical을 external directory symlink로 교체해도 결과는 network 0회·`unknown`; external sentinel bytes와 전체 entry set은 동일하고 staging entry는 남지 않는다.
- `node --test tests/unit/game-design-update-check.test.mjs`: 24 pass, 0 fail.
- `node --test tests/unit/update-advisory.test.mjs tests/unit/game-design-update-check.test.mjs`: 32 pass, 0 fail.

### 생성물·정적 검증

- `npm run build && npm run build -- --check` 통과: Career 542 files, Studio 554 files.
- shared checker와 Studio/Career checker `cmp -s` byte parity, 세 checker `node --check`, 두 `BUILD-MANIFEST.json` JSON parse, `git diff --check`를 통과했다.

### 남은 우려

- stale empty legacy directory 회수는 metadata가 없는 이전 crash artefact에만 좁게 적용한다. 비어 있지 않거나 symlink인 canonical path는 소유를 추정하지 않고 보존한다.
