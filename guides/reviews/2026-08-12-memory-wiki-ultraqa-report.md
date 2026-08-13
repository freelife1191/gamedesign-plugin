# 프로젝트 기억 UltraQA 보고서

## 범위와 판정 기준

이 보고서는 프로젝트 기억 기능의 설치 수명주기, 패키지 인벤토리, 가이드 연결, 격리 설치본을 검증한 Task 8 실행 기록입니다. 검증은 외부 네트워크와 `codex exec`를 사용하지 않았고, 실제 사용자 홈이 아닌 임시 `HOME`·`CODEX_HOME`에서만 실행했습니다.

제품별 설치 인벤토리는 제품 스킬 15개와 공통 스킬 6개, 총 21개입니다. 공통 기억 스킬 `capture-game-design-memory`, `maintain-game-design-memory`, `retrieve-approved-design-memory`는 개별 가이드 세 장이 아니라 제품별 `memory.md` 한 문서가 함께 설명하는 source-bound 예외입니다. 이 예외는 인벤토리·가이드·프롬프트 카탈로그 계약에서 세 ID로 닫아 검증합니다.

## 스냅샷 재생성 이력

| 순서 | 명령 | 결과 | 이유·후속 조치 |
| --- | --- | --- | --- |
| 1 | `npm run build` | 성공 | 초기 21개 인벤토리 스냅샷 생성 |
| 점검 | `npm run build -- --check` | 성공 | 첫 생성본과 원천 일치 확인 |
| 결함 | Career FAQ Q19와 `faqContracts`가 18 대 19로 불일치 | 발견·수정 | source commit `2a9a004`가 Q19 계약을 추가 |
| 2 (최종) | `npm run build` | 성공 | Q19 source fix를 설치 스냅샷에 반영 |
| 최종 점검 | `npm run build -- --check` | 성공 | Career 475개 `e653ad…f752a5`, Studio 485개 `3e3c58…81169d` |

두 번째 빌드는 첫 스냅샷 뒤 발견된 Q19 source 계약 누락을 반영하기 위한 승인된 재생성입니다. 빌드가 남긴 정확한 35MB recovery bundle `snapshot-recovery-5KcIQa`는 스냅샷 검증 뒤 Finder 휴지통으로 회수했습니다.

## 설치·인벤토리 검증

| 검증 | 명령·장치 | 실제 결과 |
| --- | --- | --- |
| 패키지 구조 | `node tooling/validate-packages.mjs plugins` | Studio·Career 2/2 통과 |
| 스킬 구조 | `node tooling/validate-packages.mjs skills` | 설치 스킬 42/42 통과 |
| 스냅샷 동기화 | `npm run build -- --check` | 두 제품 원천과 generated snapshot 일치 |
| 기억 lifecycle | `memory-install-lifecycle.e2e.test.mjs` | Studio·Career 설치→교체→제거 2/2 통과, memory·`.git/info/exclude`·형제 플러그인 bytes/mode/mtime 보존 |
| dirty worktree | `dirty-worktree-preservation.e2e.test.mjs` | 6/6 통과, memory sentinel과 Git local exclude를 독립 비교 |
| 설치 격리 | `plugin-smoke.test.mjs` | 8/8 통과, 21개 정확한 스킬 목록·vendored runtime·symlink 방어 확인 |
| 가이드·카탈로그 | guide/product/root README/prompt catalog focused 묶음 | 234/234 통과 |

## 실제 로컬 Codex CLI 수명주기

`/opt/homebrew/bin/codex`를 발견해 실제 CLI 검증을 수행했습니다. 격리된 임시 홈에서 로컬 저장소 경로만 마켓플레이스로 등록하고 다음 순서를 실행했습니다.

```text
marketplace add local-repository
Studio add → Career add → list
Studio remove → Studio add → list
Studio remove → Career remove → marketplace remove → empty list
```

각 캐시에서 21개 스킬, 기억 capture 스킬, memory record schema, retrieve runtime을 확인했습니다. 최종 실제 실행은 `LOCAL_CLI_FINAL=PASS products=2 skills=21 network=0 codex_exec=0 cleanup=trash`였습니다. 첫 수동 시도는 `game-design`이라는 잘못된 marketplace 별칭을 사용해 add 단계에서 즉시 실패했고, 결과를 성공으로 취급하지 않았습니다. 선언된 정확한 이름 `game-design-suite`를 확인한 뒤 `set -e`로 재실행해 위 PASS를 얻었습니다. 두 임시 홈은 Finder 휴지통으로 회수했습니다.

## UltraQA 시나리오 행렬

| ID | 공격·사용자 모델 | 실제 검증과 결과 | 상태 |
| --- | --- | --- | --- |
| MEM-OFF, MEM-SCOPE, MEM-STATE, MEM-SOURCE, MEM-INJECT, MEM-LANE | 비활성화·범위·상태·근거·지시 오염 | memory unit/E2E 및 source-bound guide 계약에서 fail-closed 경계 확인 | 관련 memory gate |
| MEM-APPEND, MEM-SEAL-RECOVERY, MEM-BRANCH, MEM-CORRUPT, MEM-SCAN-LIMIT | append·봉인·분기·손상·대형 scan | memory store/record/retrieval hostile matrix는 별도 memory gate에서 소유·검증 | 관련 memory gate |
| MEM-INDEX-GEN, MEM-RECEIPT, MEM-DERIVED-CONCURRENT, MEM-DERIVED-LIMIT, MEM-DERIVED-TRIPWIRE, MEM-DERIVED-SIZE | derived index·receipt·동시성·제한·변조 | 관련 memory gate의 production API/E2E 범위 | 관련 memory gate |
| MEM-GIT-ISOLATION | Git local exclude 보존 | dirty E2E 6/6 및 lifecycle E2E 2/2에서 bytes/mode/mtime 보존 | PASS |
| MEM-NODE-ONLY, MEM-FAILOPEN | Node runtime·기억 오류 시 기존 작업 계속 | package isolation과 memory lifecycle의 no-network/패키지 누출 0 확인 | PASS |
| MEM-INSTALL | 설치·교체·제거 | lifecycle E2E 2/2, 각 설치본의 21 skills·schema·policy·runtime 확인 | PASS |
| MEM-DIRTY | 사용자 수정 중인 저장소 | dirty E2E 6/6, `.git/info/exclude` 별도 보존 | PASS |
| MEM-THREAT-BOUNDARY | package에 local state·`.env` 누출 | lifecycle E2E가 `.env`, memory event/control/derived package 누출 0 확인 | PASS |
| INSTALL-LOCAL-CLI | 실제 Codex CLI 사용자 | 로컬 marketplace add/readd/remove 전체 순서, 캐시 21 skills | PASS |
| PACKAGE-PLUGIN-CREATOR | plugin manifest·설치 구조 | plugins validator 2/2 | PASS |
| PACKAGE-SKILL-CREATOR | 모든 설치 스킬 구조 | skills validator 42/42 | PASS |
| KO-HUMANIZE, KO-IM-NOT-AI | 한국어 안내·윤문 경계 | memory guide/root README contract 및 기존 writing polish E2E가 focused 묶음에서 통과 | PASS |
| DIAGRAM-SKILLSTEAD, DIAGRAM-ARCHIFY | 도식 vendor·guide 연결 | root README/guide contract와 isolation smoke가 focused 묶음에서 통과 | PASS |
| FORMAT-GENERATE, FORMAT-VERIFY, FORMAT-VISUAL-30 | MD/PDF/DOCX/PPTX 실생성·30장 시각 점검 | 이 실행 lane에서는 수행하지 않음. 별도 format/visual QA lane의 증거가 합쳐지기 전 PASS로 표시하지 않음 | 별도 lane |
| INTERRUPTION-RESUME, MISLEADING-OUTPUT | 중단 재개·거짓 성공 문자열 | 기존 root UltraQA suite의 별도 범위. 이 lifecycle lane에서 재실행하지 않음 | 별도 gate |
| CLEANUP | 임시 파일·프로세스 잔존 | CLI temp homes와 final recovery bundle 휴지통 회수, focused 명령의 child 종료 확인 | PASS |

## 최종 focused 명령 기록

```text
npm run build -- --check                                      → PASS
node tooling/validate-packages.mjs plugins                     → 2/2 PASS
node tooling/validate-packages.mjs skills                      → 42/42 PASS
node --test [guide/product/catalog/lifecycle/dirty/isolation] → 234/234 PASS
git diff --check                                               → PASS
```

## 남은 통합 경계

이 보고서는 설치·인벤토리·가이드·실제 CLI 수명주기 증거만 확정합니다. 실제 MD/PDF/DOCX/PPTX 대표 생성과 30장 시각 확인은 별도 검증 lane의 결과를 이 문서에 합치기 전까지 완료로 주장하지 않습니다. 네트워크 API, OpenAI 이미지 API, GitHub·원격 저장소 쓰기는 수행하지 않았습니다.
