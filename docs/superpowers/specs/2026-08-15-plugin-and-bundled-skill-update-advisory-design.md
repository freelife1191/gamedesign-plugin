# 플러그인·번들 스킬 업데이트 안내 설계

## 목적

Game Design Studio와 Game Design Career를 설치한 사용자가 처음 플러그인을 실행할 때 플러그인 자체와 번들 스킬의 새 버전 여부를 확인할 수 있게 한다. 이후에는 7일 간격으로 다시 확인하고, 업데이트가 있으면 현재 버전·최신 버전·변경 경로를 안내한다.

검사는 읽기 전용이어야 한다. 플러그인 캐시, 마켓플레이스, 번들 스킬 또는 사용자 프로젝트를 자동으로 바꾸지 않는다. 실제 업데이트는 사용자가 명시적으로 요청한 뒤에만 수행한다.

## 현재 제약

- Codex 플러그인에는 설치 직후 임의 명령을 실행하는 별도 설치 훅이 없다. 따라서 설치 뒤 처음 시작되는 `SessionStart`가 가장 이른 검사 시점이다.
- 현재 `game-design-suite` 마켓플레이스는 로컬 소스다. Git 마켓플레이스처럼 원격 snapshot을 갱신할 수 없으므로, 플러그인 자체의 최신 여부는 구성된 마켓플레이스의 설치본·가용본을 비교해야 한다.
- 번들 스킬은 설치된 플러그인 캐시 안에서 개별 업데이트하지 않는다. Archify, Skillstead SVG, humanize-korean의 새 릴리스가 확인되어도 사용자는 검증된 새 Game Design Suite 릴리스를 설치해야 한다.
- 원격 최신 버전 검사는 실패할 수 있다. 네트워크 단절, GitHub 제한, 잘못된 응답은 기획 작업을 막지 않으며 `unknown`으로 남긴다.
- 현재 번들 상태는 Skillstead SVG `0.9.0`, Archify `2.14.0`, humanize-korean `2.3.0`이다.

## 검토한 접근

### 1. 설치·세션 시작 때 최신 버전을 자동 적용

가장 간단해 보이지만 채택하지 않는다. 새 릴리스가 기존 도식, 패키지 경로, 계약 테스트와 맞지 않을 수 있고, 설치 중 네트워크 상태에 따라 서로 다른 패키지가 만들어진다. 사용자 승인 없이 원격 코드를 적용하므로 재현성과 공급망 검증도 깨진다.

### 2. CI에서만 주기 검사

유지보수자에게는 유용하지만 설치 사용자는 자신이 오래된 버전을 쓰는지 알 수 없다. 설치 후 안내 요구를 충족하지 못하므로 단독 방식으로 사용하지 않는다.

### 3. 최초 실행·주기 안내 + 명시적 업데이트

채택한다. `SessionStart`는 캐시가 없거나 7일이 지난 경우에만 공식 릴리스를 읽기 전용으로 확인한다. 업데이트가 있으면 에이전트가 한 번만 간단히 알리고, 사용자가 업데이트를 요청하면 별도의 검증·재설치 흐름으로 넘어간다. 저장소에서는 주기 CI 검사를 추가해 유지보수자에게도 같은 상태를 알린다.

## 사용자 흐름

1. 사용자가 Studio 또는 Career를 설치한다.
2. 설치 뒤 첫 새 세션에서 기존 capability probe가 업데이트 advisory를 함께 계산한다.
3. 모든 구성 요소가 최신이면 별도 메시지를 표시하지 않는다.
4. 업데이트가 있으면 다음 정보만 안내한다.
   - 구성 요소 이름
   - 설치 버전
   - 최신 안정 버전
   - 공식 릴리스 URL
   - 업데이트가 자동 적용되지 않았다는 사실
   - 플러그인 업데이트 요청 예시
5. 사용자가 업데이트를 명시적으로 요청하면 현재 마켓플레이스 종류를 확인한다.
   - 로컬 마켓플레이스: 가용 source manifest와 설치본을 비교한 뒤 `codex plugin add <plugin>@game-design-suite --json`으로 재설치한다.
   - Git 마켓플레이스: 먼저 `codex plugin marketplace upgrade game-design-suite --json`을 실행하고, 가용 버전을 확인한 뒤 재설치한다.
6. 새 플러그인이 없다면 번들 스킬만 플러그인 캐시에서 직접 교체하지 않는다. 유지보수자용 업데이트 절차를 안내한다.
7. 재설치 뒤 새 스킬과 에이전트가 확실히 로드되도록 새 스레드 사용을 안내한다.

## `$gstack-upgrade`에서 채택하는 흐름

Game Design Suite의 명시적 업데이트 UX는 설치된 `$gstack-upgrade`의 다음 순서를 참고한다.

1. 새 버전 여부를 먼저 확인한다.
2. 설치 형태와 현재 버전을 판별한다.
3. 변경을 적용하기 전에 이전 버전과 대상 제품을 기록한다.
4. 업데이트를 수행하고 결과를 다시 검증한다.
5. 사용자에게 달라진 점을 짧게 설명한다.
6. 업데이트를 요청하기 전에 하던 작업이 있다면 새 세션에서 이어갈 방법을 안내한다.

다음 동작은 Game Design Suite에 그대로 가져오지 않는다.

- 무인 자동 업데이트와 `auto_upgrade` 설정은 제공하지 않는다. 플러그인, 번들 스킬과 생성 snapshot은 하나의 검증된 릴리스 단위이므로 매번 사용자의 명시적 승인을 받는다.
- 설치 디렉터리에서 `git reset --hard`, `rm -rf`, 직접 교체 또는 `.bak` 복원을 실행하지 않는다.
- 설치된 플러그인 캐시나 번들 스킬을 직접 수정하지 않는다. 설치와 교체는 Codex의 `plugin marketplace upgrade`와 `plugin add`만 사용한다.
- 저장소 checkout의 로컬 변경을 자동 stash하거나 삭제하지 않는다. dirty local marketplace는 업데이트를 중단하고 현재 상태를 보고한다.

새 공통 스킬 `upgrade-game-design-suite`는 두 제품에 동일 바이트로 포함한다. Studio와 Career 중 어느 제품에서 호출해도 설치된 두 제품을 한 번에 점검하고, 사용자가 선택한 제품만 갱신한다. 스킬은 다음 사용자 선택을 제공한다.

- 지금 업데이트: 검증된 계획을 적용한다.
- 나중에: 기존 7일 advisory 상태를 유지하고 현재 작업으로 돌아간다.
- 이 버전은 다시 알리지 않기: 해당 최신 버전 조합에 대해서만 알림을 억제한다.
- 업데이트 알림 끄기: 기존 opt-out 계약을 안내하고 검사·캐시 쓰기를 중단한다.

스킬은 업데이트 성공 뒤 이전 버전, 새 버전, 갱신된 제품, 번들 구성 요소 변화, 검증 결과를 5~7개 이하의 항목으로 요약한다. 변경 내역의 근거가 없으면 기능을 추측하지 않고 버전·검증 결과만 표시한다.

## 런타임 구성

### 업데이트 정책 파일

공통 source에 폐쇄된 JSON 정책을 둔다. 빌드는 Studio와 Career에 동일 바이트로 복사한다.

정책은 다음 항목만 포함한다.

- schema version
- 검사 주기: 7일
- 전체 네트워크 제한 시간
- 마켓플레이스 이름: `game-design-suite`
- 제품 ID: `game-design-studio`, `game-design-career`
- 번들 구성 요소 ID와 공식 GitHub 저장소
- 안정 SemVer 릴리스만 허용한다는 규칙

설치 경로나 사용자 홈 경로, 토큰, 프로젝트 정보는 정책과 요청에 포함하지 않는다.

### 업데이트 검사기

새 공통 모듈은 다음 상태를 반환한다.

- `current`: 설치 버전과 최신 안정 버전이 같다.
- `outdated`: 더 높은 안정 SemVer 릴리스가 있다.
- `unknown`: 네트워크, 응답, 신뢰 또는 버전 판정이 불가능하다.
- `disabled`: 사용자가 검사를 껐다.

업스트림은 정확히 다음 allowlist만 허용한다.

- `https://github.com/kyungseo/skillstead`
- `https://github.com/tt-a1i/archify`
- `https://github.com/epoko77-ai/im-not-ai`

GitHub 응답에서 draft와 prerelease를 제외하고, 구성 요소별 안정 SemVer 태그만 비교한다. 리디렉션된 임의 호스트, 응답 안의 다운로드 URL, 자격 증명 요청은 따르지 않는다.

### 캐시

검사 결과는 사용자 캐시 아래 단일 JSON 파일에 저장한다.

- `XDG_CACHE_HOME`이 있으면 그 아래 `game-design-suite/update-advisory-v1.json`
- 없으면 운영체제 기본 사용자 캐시 아래 같은 상대 경로

캐시는 상태·설치 버전·최신 버전·검사 시각·공식 릴리스 URL만 저장한다. 프로젝트 경로, 사용자 입력, 프롬프트, API 키는 저장하지 않는다.

캐시 파일이 없으면 첫 실행 검사다. 정상 캐시가 7일 이내면 네트워크를 사용하지 않는다. 손상·symlink·비정규 파일·미래 시각·정책 불일치 캐시는 신뢰하지 않되 사용자 프로젝트는 건드리지 않는다. 캐시 갱신 실패는 `unknown` 경고만 남긴다.

### SessionStart 통합

기존 `capability-probe.mjs`가 업데이트 검사 결과를 `hookSpecificOutput.additionalContext`의 `updates`에 포함한다. 기존 capability와 image config 계약은 유지한다.

훅은 다음 원칙을 따른다.

- 전체 검사 제한 시간을 넘기면 즉시 `unknown`으로 끝낸다.
- 업데이트가 없으면 사용자에게 별도 문장을 출력하지 않는다.
- 업데이트가 있으면 세션마다 반복하지 않고 캐시의 `lastNotifiedAt`을 기준으로 같은 버전 조합을 한 번만 권고한다.
- 어떤 경우에도 `codex plugin add`, `marketplace upgrade`, 번들 updater를 자동 실행하지 않는다.
- `GAME_DESIGN_UPDATE_CHECKS=false`이면 네트워크와 캐시 쓰기를 모두 생략한다.

## 플러그인 자체 버전 확인

플러그인 자체는 임의 GitHub URL을 발명하지 않는다. 현재 배포 권위는 구성된 `game-design-suite` 마켓플레이스다.

자동 SessionStart 검사는 설치 플러그인의 버전만 공개한다. `--available`은 설치되지 않은 항목만 보여 주므로 설치된 같은 제품의 최신 버전 근거로 사용하지 않는다.

사용자가 `upgrade-game-design-suite`를 호출하면 다음 순서로 비교한다.

1. `codex plugin list --marketplace game-design-suite --json`에서 설치된 제품, 설치 버전, marketplace 종류와 현재 source 경로를 읽는다.
2. 로컬 marketplace는 source 경로가 marketplace root 안의 정규 디렉터리인지 확인하고 `.codex-plugin/plugin.json`을 symlink 없이 UTF-8로 읽는다.
3. Git marketplace는 사용자 승인 뒤 `codex plugin marketplace upgrade game-design-suite --json`을 먼저 실행한 다음 갱신된 local snapshot의 manifest를 같은 방식으로 읽는다.
4. manifest의 이름이 대상 제품과 같고 안정 SemVer가 설치 버전보다 높을 때만 `codex plugin add <plugin>@game-design-suite --json` 계획을 만든다.
5. 같은 버전, 낮은 버전, prerelease, 잘못된 UTF-8, BOM, symlink, marketplace 밖 경로, 이름 불일치는 `current` 또는 `unknown`으로 끝내며 설치 명령을 만들지 않는다.

Codex CLI `0.147.0` 격리 확인에서는 같은 selector에 `plugin add`를 다시 실행해 `0.1.1`을 `0.1.2`로 교체했으며 이전 버전 캐시는 제거됐다. 이 동작을 E2E로 고정하되, 설치 캐시를 직접 조작하는 fallback은 만들지 않는다.

향후 공식 원격 저장소가 정해지면 정책 파일에 신뢰된 suite release channel을 추가할 수 있다. 그 전에는 원격 suite 최신 여부를 사실처럼 표시하지 않는다.

## 저장소 유지보수 흐름

저장소에는 다음 두 층을 둔다.

1. 읽기 전용 통합 검사
   - 기존 `check:diagram-skills-latest`
   - 기존 `check:im-not-ai-latest`
   - 새 `check:updates` 집계 명령
2. 명시적 업데이트
   - 기존 vendor updater로 공식 릴리스와 immutable commit을 확인한다.
   - lock file, 라이선스, 파일 closure와 해시를 갱신한다.
   - 버전 경로를 lock file에서 파생해 Archify처럼 여러 파일에 흩어진 고정 경로를 제거한다.
   - snapshot build, plugin/skill validator, contracts, diagrams, Archify catalog, 시각 QA를 모두 통과해야 릴리스한다.

주기 CI는 매주 한 번 `check:updates`를 실행한다. 업데이트가 있으면 실패가 아니라 구조화된 outdated 결과와 작업 요약을 남긴다. CI 시스템이 지원하면 유지보수 알림 또는 issue를 만들 수 있지만, vendor tree나 release branch는 자동 수정하지 않는다.

오프라인 `validate`와 `validate:release`는 네트워크 상태 때문에 불안정해지지 않도록 최신 조회를 직접 포함하지 않는다. 대신 release 과정은 최근 7일 안에 생성된 update audit가 있고 `unknown` 항목이 없음을 별도 gate로 확인한다.

## 업데이트 권고 문구

사용자 안내는 자연스러운 한국어 한 문단으로 제한한다.

예시:

> 번들 구성 요소의 새 안정 버전을 확인했습니다. 현재 플러그인의 검증된 버전은 자동으로 바꾸지 않았습니다. 새 Game Design Suite 릴리스가 준비됐는지 확인하려면 “Game Design Suite를 업데이트해 줘”라고 요청하세요.

`최신 버전이니까 즉시 설치`, `보안상 반드시 업데이트`, `자동으로 업데이트됨`처럼 근거가 없는 표현은 사용하지 않는다.

## 오류와 안전 경계

- 설치·첫 실행·일반 기획 작업은 업데이트 서버 장애로 실패하지 않는다.
- timeout, HTTP 오류, schema 오류, SemVer 오류는 `unknown`으로 합친다.
- 응답 본문과 로컬 절대 경로를 사용자 메시지에 노출하지 않는다.
- update checker는 GitHub API token이나 사용자 API key를 읽지 않는다.
- 업데이트 발견과 업데이트 승인 상태를 혼동하지 않는다.
- 설치 cache 안의 vendor 폴더를 직접 수정하지 않는다.
- 두 플러그인을 함께 설치해도 동일 캐시와 동일 검사 결과를 사용해 중복 네트워크 요청과 중복 알림을 막는다.

## 테스트 전략

### 단위 테스트

- 최초 실행은 정확한 allowlist endpoint만 조회한다.
- 7일 이내 캐시는 네트워크 호출 0이다.
- 7일 경계와 그 이후에는 정확히 한 번 재검사한다.
- draft, prerelease, 다른 구성 요소 태그, malformed SemVer를 제외한다.
- newer/current/unknown/disabled 상태를 구분한다.
- timeout, 403, 404, 429, 500, malformed JSON을 fail-open `unknown`으로 처리한다.
- cache symlink, future timestamp, unknown key, partial write를 거부한다.
- 같은 Studio·Career 세션이 캐시를 공유해 한 번만 알린다.

### 계약 테스트

- source 정책과 Studio·Career package 정책이 byte-exact다.
- SessionStart 기존 output key와 capability 의미가 유지되고 `updates`만 폐쇄적으로 추가된다.
- updater가 lock file, official repository, tag, commit, license, closure를 검증한다.
- 설치 inventory는 `codex plugin list --marketplace game-design-suite --json`의 허용 필드만 읽고, `--available` 결과를 설치된 같은 제품의 최신 근거로 사용하지 않는다.
- 설치된 플러그인의 source manifest 비교는 marketplace root containment, 정규 파일, UTF-8, BOM 부재, 이름과 안정 SemVer를 모두 검증한다.
- `upgrade-game-design-suite`의 source와 Studio·Career package가 byte-exact이고 두 제품에서 같은 계획을 반환한다.

### E2E

- 빈 격리 HOME/CODEX_HOME에서 로컬 마켓플레이스 설치 후 첫 SessionStart가 outdated advisory를 한 번만 반환한다.
- 두 제품을 함께 설치해도 네트워크 probe는 한 번이고 안내는 중복되지 않는다.
- offline 설치·첫 실행은 정상이며 update status만 `unknown`이다.
- explicit update 경로는 사용자 승인 전 `marketplace upgrade`와 `plugin add`를 호출하지 않는다.
- 승인 후 local/Git marketplace별 정확한 명령만 실행하고 새 thread 안내를 반환한다.
- 로컬 marketplace `0.1.1 → 0.1.2` fixture에서 `plugin add`가 새 버전을 설치하고 이전 캐시를 제거한다.
- Git marketplace는 승인 전 refresh 0회이며, 승인 뒤 refresh 1회 후 manifest를 다시 읽는다.
- 업데이트 성공 뒤 이전·새 버전과 검증 결과를 요약하고 원래 작업의 새 세션 재개 지침을 반환한다.
- 제거 후에도 사용자 프로젝트와 다른 플러그인 파일을 바꾸지 않는다.

## 문서 범위

- 루트 README 설치 섹션에 최초·주기 검사, opt-out, 명시적 업데이트 원칙을 추가한다.
- Studio/Career README에 동일한 사용자 흐름을 짧게 추가한다.
- Studio/Career 스킬 카탈로그와 설치 가이드에 `$game-design-*:upgrade-game-design-suite` 직접 호출 예시를 추가한다.
- 기술 문서에 유지보수자 명령과 release audit를 기록한다.
- 버전별 release note에는 번들 구성 요소 버전을 표로 남긴다.

## 완료 조건

- 설치 뒤 첫 새 세션에서 최신 여부를 안전하게 확인한다.
- 같은 결과를 7일 동안 재사용하고 같은 업데이트를 반복 안내하지 않는다.
- 업데이트는 사용자 승인 없이 적용되지 않는다.
- 플러그인 자체와 세 번들 스킬의 상태를 구분해 설명한다.
- 오프라인에서도 플러그인의 본래 기능이 정상 동작한다.
- 두 제품의 package, skill, hook, lifecycle, build, docs 계약이 모두 통과한다.
