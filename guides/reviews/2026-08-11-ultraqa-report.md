# UltraQA 보고서

## 목표와 성공 기준

- 목표: 간단한 자연어 요청이 올바른 Studio·Career 작업 경로로 이어지고, 문체 검수·이미지 계보·도식 검증·사람 승인 경계를 건너뛰지 않는지 실행형 시나리오로 확인한다.
- 종료 조건: 기본 빌드와 전체 검증이 통과하고, 아래 정상·공격·중단·오염 시나리오가 모두 통과하며 임시 파일과 프로세스가 남지 않는다.
- 안전 범위: 실제 이미지 API와 외부 서비스는 호출하지 않는다. 비밀값은 읽거나 출력하지 않고, 임시 디렉터리와 격리된 상태만 사용한다.

## 시나리오 표

| ID | 사용자·공격자 모델 | 시나리오 | 명령·검증 장치 | 기대 신호 | 실제 결과 | 상태 | 수정·근거 | 정리 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NL-01 | 처음 쓰는 Studio 사용자 | 보스전 기획을 한 문장으로 요청 | `natural-language-routing.e2e.test.mjs` | 콘텐츠 경로, 전투 검토 역할, 최대 3명, 사람 승인 대기 | 등록 경로와 검토 상한 일치 | PASS | 실행형 registry·reviewer selection | 임시 입력 삭제 |
| NL-02 | 처음 쓰는 Studio 사용자 | 퍼즐·레벨 기획을 한 문장으로 요청 | `natural-language-routing.e2e.test.mjs` | 콘텐츠 경로, 퍼즐·레벨 검토 역할, 복구 질문 | 등록 경로와 조건부 역할 일치 | PASS | 실행형 registry·reviewer selection | 임시 입력 삭제 |
| NL-03 | 처음 쓰는 Studio 사용자 | 비전·경제·복합 요청 | `natural-language-routing.e2e.test.mjs` | 단일 요청은 전문 스킬, 복합 요청은 오케스트레이터 | 단일·복합 경계와 결과 형식 일치 | PASS | Studio routing·scenario validator | 임시 입력 삭제 |
| NL-04 | 학생·취업 준비자 | 역할 탐색·학습 계획·포트폴리오 요청 | `natural-language-routing.e2e.test.mjs` | Career 최소 스킬 체인, 최대 3명, 결과물 경로 | 설치형 Career 시나리오 검증 통과 | PASS | Career scenario validator | 임시 입력 삭제 |
| NL-05 | Studio와 Career를 함께 쓰는 사용자 | 승인된 기획 결과를 포트폴리오 사례로 정리 | `natural-language-routing.e2e.test.mjs` | 공개 가능한 정보만 전달, Studio 원본과 Career 결과 분리 | 인계 결과와 공개 관문 분리 | PASS | Suite source-bound handoff | 임시 입력 삭제 |
| ADV-01 | 잘못된 입력을 보내는 사용자 | 누락 JSON·과대 Unicode·경로 이탈 값 | 설치형 Studio validator | 명확한 실패, 저장소 밖 쓰기 0 | 입력별 fail-closed, 증거 바이트 불변 | PASS | malformed·Unicode·traversal probes | 임시 입력 삭제 |
| ADV-02 | 지침을 덮어쓰려는 공격자 | 비밀 출력·검증 생략·자동 승인·삭제 지시 | 설치형 validator·writing runner | 입력을 데이터로 취급, 승인·검증 상태 불변 | 승인·원본·비밀 경계 불변 | PASS | injection probes | 임시 입력 삭제 |
| WR-01 | 문체 윤문 사용자 | 정상 한국어 윤문 | `document-writing-polish.e2e.test.mjs` | 별도 수정본·검수 기록, 원본 불변 | 수정 초안과 receipt 분리, 원본 불변 | PASS | 실제 writing runner | 임시 입력 삭제 |
| WR-02 | 보호 내용을 바꾸려는 윤문기 | 고유명사·ID·사실·중복 구간 변조 | `document-writing-polish.e2e.test.mjs` | 보호 매니페스트가 실패로 차단 | 네 변조 모두 humanizer 뒤 validator에서 차단 | PASS | protected manifest probes | 임시 입력 삭제 |
| RES-01 | 작업을 여러 번 멈추는 사용자 | continue·stop·abort 반복, stale 상태에서 재개 | `interruption-resume.e2e.test.mjs` | 완료를 가장하지 않고 마지막 유효 기록에서 재개 | stale resume 거부, cancel 뒤 fresh run 요구 | PASS | installed Stop hook·isolated lifecycle | 상태 fixture 삭제 |
| HANG-01 | 멈춘 하위 명령 | 종료되지 않는 reader·child process | bounded harness | 제한 시간 안에 중단, 자식 프로세스·부분 PNG 0 | timeout·kill 완료, 부분 PNG 0 | PASS | hung reader·child probes | 자식 종료·임시 파일 삭제 |
| DIRTY-01 | 수정 중인 저장소 사용자 | tracked·untracked 파일이 있는 상태에서 검증 | `dirty-worktree-preservation.e2e.test.mjs` | 시작·종료 상태 동일, 사용자 파일 보존 | tracked·untracked·동시 편집 바이트 일치 | PASS | isolated dirty fixture | fixture 삭제 |
| FALSE-01 | 성공 문구를 악용하는 도구 | `SUCCESS` 출력 뒤 exit 1·skip·부분 로그 | bounded harness | exit code와 실패 표식을 우선해 실패 처리 | 성공 문구를 무시하고 실패 처리 | PASS | false-success child probe | 자식 종료·fixture 삭제 |
| ASSET-01 | 잘못된 이미지·도식 입력 | 이미지 cycle·stale ref·vendor 변조 | 공개 validator·CLI | provider 0회, 도식·vendor fail-closed | provider 0회, output 0, 변조 거부 | PASS | image lineage·Archify CLI·vendor probes | fixture 삭제 |
| FLAKE-01 | 간헐 실패 테스트 | 같은 대상 3회 반복 | `node --test tests/e2e/suite/*.test.mjs` | 세 번 모두 통과, 실패 군집 없음 | 21/21을 3회 연속 통과, 추가 post-commit 통과 | PASS | 총 56개 하위 probe | 잔여 프로세스 0 |
| SIMPLE-01 | 스킬 이름을 모르는 처음 사용자 | 평범한 한국어 한 문장으로 Studio·Career 작업 요청 | 격리 marketplace 설치 + `codex exec` | 플러그인이 경로를 골라 검증 가능한 결과물 생성 | Career는 `entry-role-map`, Studio는 `vision` 경로를 선택했다. 기준 결과물 구조·요청 반영·설치 안내문 해시·요청 해시·비공개 결합값에 묶인 경로 선택 기록을 연속 2회 검증했다. | PASS | 스킬 ID·경로를 프롬프트에 넣지 않은 실제 설치 실행 | 격리 HOME·작업 폴더 삭제 |
| PKG-01 | Codex 플러그인 설치 사용자 | 한국어 시작 문구와 인터페이스 스키마 확인 | Plugin Creator 공식 validator + 제품 계약 | 한국어 설명, 시작 프롬프트 배열 1~3개 | 원천·설치본 4개 모두 통과 | PASS | manifest schema·한국어 우선 검사 | 변경 없음 |
| SKILL-01 | 직접 스킬을 호출하는 사용자 | 설치된 36개 스킬의 메타데이터와 경로 검사 | Skill Creator `quick_validate.py` | 모든 스킬이 발견·실행 가능한 구조 | 36/36 통과 | PASS | 실제 설치 트리 검사 | 변경 없음 |
| HK-01 | 문체를 지나치게 바꾸는 윤문기 | 원문의 절반 이상을 다른 문장으로 교체 | im-not-ai 변경률 + 보호 내용 validator | 30% 초과 재검토, 50% 초과 폐기 | 반올림 전 SequenceMatcher 비율로 경계를 판정하고 과윤문 차단 | PASS | 변경률 receipt·롤백 회귀 | 임시 입력 삭제 |
| HK-02 | 아주 크거나 반복 문자가 많은 문서를 보내는 사용자 | 메모리와 비교 횟수를 폭증시키는 문서 윤문 | 입력 크기·100만 회 비교 상한 + fail-closed validator | 배열 변환 전에 크기를 확인하고 필요하면 분할 재개 | 문서별 UTF-8 128KiB·코드포인트 65,536개를 먼저 확인하고, 이후 비교도 100만 회를 넘기기 전에 거부 | PASS | matcher 시작 전 크기 검사·의미 변경 우선 진단 | 임시 입력 삭제 |
| SVG-01 | 문서용 흐름도가 필요한 사용자 | Skillstead SVG lint·2× PNG 렌더 | 설치형 Skillstead CLI | 오류·경고 0, 잘림 없는 2× PNG | Studio·Career 모두 2800×1800 생성 | PASS | 정상·malformed SVG 검사 | `/tmp` 산출물 삭제 |
| ARCH-01 | 구조도를 탐색하는 사용자 | Archify validate·deliver·테마·키보드 검사 | 설치형 Archify CLI·headless Chrome | 9/9, 오류·경고 0, 한글 UI·관계 탐색 | 밝은·어두운 화면과 오류 경계 통과 | PASS | HTML·상호작용·traversal 검사 | `/tmp` 산출물 삭제 |
| IMG-01 | 마스터 이미지를 기준으로 파생 이미지를 만드는 사용자 | `gpt-image-2` 생성·편집·계보·승인 검사 | mock provider + 실제 workflow | 마스터 우선, 참조 SHA 고정, 사람 승인 전 보류 | 151/151 통과, 외부 과금 호출 0 | PASS | timeout·stale·symlink·oversize 포함 | 임시 이미지 삭제 |

## 명령 실행 기록

- `[0] node --test tests/e2e/suite/*.test.mjs` — 21/21 통과, 0 fail, 0 skip, 약 1초. 같은 대상을 세 번 연속 통과했고 post-commit도 통과했다.
- `[0] npm run build -- --check` — Career 453개·Studio 463개, 원천과 설치 스냅샷 일치.
- `[0] npm run validate:guides` — 가이드 147개, 스킬 가이드 36개, 템플릿 30개, SVG/PNG 각 90개 통과.
- `[0] npm run check:prompt-guides` — Markdown 89개와 product projection 2개 통과.
- `[0] npm run check:im-not-ai` — 고정 v2.3.0, 15개 파일 검증.
- `[0] npm run check:diagram-skills` — Skillstead v0.9.0 55개, Archify v2.13.0 60개 파일 검증.
- `[0 × 2] npm run smoke:marketplace` — 스킬 이름·경로를 프롬프트와 proof 명령에 넣지 않은 한국어 요청으로 Career `entry-role-map → map-game-design-career`, Studio `vision → define-game-vision`을 연속 두 번 선택. 실행기가 설치본의 기준 결과물 구조를 먼저 복사하고 모델은 본문과 선택 경로만 작성했다. 원래 frontmatter·제목 ID·근거 파일·출력 준비표·파일 집합이 그대로인지, 요청의 모든 의미 축이 코드 블록·주석이 아닌 본문에 있는지, 요청 해시·비공개 결합값과 설치 안내문 SHA-256이 일치하는지 검증했다. 운영 상태와 임시 파일도 원상 복구됐다.
- `[0] Plugin Creator 공식 validator` — 원천·설치 Studio/Career 4개 모두 통과.
- `[0] Skill Creator quick validator` — 설치된 스킬 36/36 통과.
- `[0] 이미지 파이프라인 대상 테스트` — 151/151 통과. 마스터·파생 계보, 참조 편집, 승인, 시간 초과와 경로 공격을 포함하며 외부 호출은 0회.
- `[0] Skillstead·Archify 설치 실행 QA` — SVG lint 0/0, 2× PNG, Archify 9/9·오류 0·경고 0, 밝은·어두운 화면과 키보드 탐색 통과.
- `[1→0] npm run check:guide-diagrams` — Studio 콘텐츠 경로 trigger contract 누락을 검출한 뒤 수정. 단위 31/31, Studio SVG 39개 lint 0/0, 전체 check 통과.
- `[0] npm run validate` — 단위·제품·계약·격리·형식 검증을 포함한 배포 준비 검사가 모두 통과.
- `[0] npm run test:unit` — 819/819 통과, 실패·건너뜀 0.
- `[0] npm test` — 1,620/1,620 통과, 실패·건너뜀 0, 653.13초.
- `[0] npm run validate:archify-catalog` — 692개 source record, selected 4개, errors·uncovered 0.
- `[0] npm run check:curated-archify` — 공개 HTML 4개와 receipt·시각 QA 결합 통과.
- `[0] node tooling/build-archify-contact-sheets.mjs --check` — 전체·제품·유형별 contact sheet 7개 통과.

## 발견한 결함

- 설치형 Studio의 경제·LiveOps 템플릿 6개가 한국어 원문으로 바뀌었지만 무결성 receipt는 예전 SHA를 가리켜 E2E가 실패했다.
- 설치 패키지에 Archify vendor lock이 포함되지 않아 격리 smoke가 경로 부재로 실패했다.
- README 사례 8개가 최신 source-bound 카탈로그 문구와 달랐다.
- Studio 콘텐츠 경로의 전투·퍼즐 관련 9개 트리거가 Skillstead 생산 계약에 반영되지 않았다.
- 대규모 문서 변경 뒤 Archify catalog의 source digest와 uncovered 분류가 stale 상태였다.
- 공유 스킬의 package mirror 42개가 실제 원본이 아닌 존재하지 않는 제품 경로를 origin으로 기록했다.
- 한국어화한 결과 템플릿의 승인 해시와 의미 검사가 이전 영문 제목에 묶여 있었다.
- Studio source의 공통 gate·현행 지식·검토 양식 링크가 삭제된 product-local mirror를 가리켰다.
- Skillstead 0.9.0과 문체 검수 workflow 추가 뒤 일부 release 계약이 0.8.3과 예전 script·role 수를 기대했다.
- Suite handoff의 Archify 링크가 생성 원천이 아니라 생성된 Markdown에 직접 들어가 있었다.
- 30개 사용자 결과 템플릿이 영어 표제 앞에 `기획 항목:`만 붙였고 본문과 표 작업 지시도 영어로 남아 있었다.
- Career 플러그인의 `interface.defaultPrompt`가 배열이 아닌 문자열이어서 Plugin Creator 인터페이스 계약과 달랐다. 두 제품의 사용자용 설명과 시작 문구도 영어 우선이었다.
- marketplace 실행 검사가 설치 스킬 수를 예전 15개로 고정하고, 실제 사용 흐름도 스킬 이름을 명시해야만 통과하도록 짜여 있었다.
- 한국어 윤문 validator가 뜻·수치·ID는 지켰지만, 원문의 절반 이상을 바꾸는 과도한 수정까지 성공으로 처리했다.
- marketplace proof 명령이 오케스트레이터 안내문 경로를 포함해, 자연어만으로 작업 경로를 고른다는 검증을 약하게 만들었다. 초기 자연어 스모크는 모델이 경로 기록이나 기준 기획 폴더의 필수 구조를 빠뜨릴 때 실패 단계를 구분하지 못했다.
- im-not-ai 변경률 계산이 큰 입력을 배열로 바꾸기 전에 크기를 제한하지 않았고, 반복 문자가 많은 문서의 비교 횟수도 제한하지 않았다. 30%·50% 경계도 반올림한 표시값으로 판정했다.
- 모델이 엄격한 결과물 파일 전체를 다시 만들게 하자 YAML 구조와 제목 ID가 실행마다 달라지는 문제가 있었다. 기준 구조를 미리 제공한 뒤에도 초기 사후 검사는 frontmatter·제목 ID·근거 파일 변조와 일부 핵심어만 있는 결과를 놓쳤다.
- 가시 본문 검사에서 코드 블록의 가짜 닫힘 표식과 닫히지 않은 HTML 주석을 실제 본문으로 잘못 읽을 수 있었다.

## 적용한 수정

- 템플릿 6개의 무결성 receipt를 현재 바이트에 결합했고 Studio E2E 17/17로 확인했다.
- 양 제품에 package-local Archify vendor lock을 포함해 isolation 100%를 복구했다.
- README 사례를 정확한 카탈로그 원문과 동기화했다.
- Studio Skillstead content route contract를 14개 trigger 전체와 동기화했다. 도식 바이트는 변하지 않았다.
- Archify catalog를 692개 record로 재기준화하고, 공유 package mirror 42개를 실제 source의 regular file·허용 build mapping·바이트 동일성에 결합했다.
- Career 15개 콘텐츠와 Studio 75개 seed의 승인 해시를 현재 한국어 원문에 맞추고, 의미 검사는 안정적인 anchor ID와 본문 계약을 사용하도록 바꿨다.
- Studio source의 공통 gate·현행 지식·검토 양식은 canonical shared path를, 설치본은 package-local path를 가리키도록 build projection을 명시했다.
- 양 제품 문서와 release 계약을 직접 스킬 15개·설치 스킬 18개, Skillstead 0.9.0, 문체 검수 스크립트와 역할 우선순위에 맞췄다.
- Suite prompt catalog의 diagram binding에 관리되는 Archify HTML 경로를 추가해, 프롬프트 가이드 재생성 뒤에도 링크가 보존되도록 했다.
- Studio·Career 결과 템플릿 30개의 표제·설명·표 작업 지시를 실제 한국어로 교정했다. 감사기는 혼합 접두어 표제와 한글 몇 글자로 숨긴 영어 우세 문장도 실패로 처리한다.
- 두 플러그인의 설명과 시작 요청을 한국어 우선으로 고치고, Career 시작 요청을 3개 이하 배열로 맞췄다.
- marketplace 설치 검사를 현재 설치 수인 18개로 고쳤다. 최종 프롬프트와 proof 명령에서 스킬 이름·경로를 제거했다. runner가 미리 만든 요청 해시·무작위 결합값은 프롬프트에 값을 노출하지 않고, 모델은 이를 보존하면서 선택 route ID만 채운다. proof harness는 설치본 registry와 실제 `SKILL.md` 해시를 대조해 선택 스킬을 도출한다. 실패 결과는 제품·단계·허용된 진단 코드만 남긴다.
- 번들된 im-not-ai의 SequenceMatcher 변경률을 Node validator에 맞춰 구현했다. 배열 변환 전에 문서별 UTF-8 128KiB·코드포인트 65,536개 상한을 적용하고, 이후 반복 입력은 100만 회 비교 상한에서 중단한다. 반올림 전 값으로 30%·50% 경계를 판정하고 영수증에만 소수점 여섯째 자리까지 표시하며, 상한 초과 시 문서를 의미 단위로 나눠 재개하도록 안내한다.
- marketplace runner가 설치본의 검증된 기준 결과물 구조를 먼저 복사하고 모델은 `content.md` 본문과 선택 경로만 채우도록 책임을 분리했다. frontmatter·순서가 있는 제목과 ID·나머지 파일의 경로·종류·SHA-256을 실행 전 상태에 고정하고, 요청 의미 축은 모두 실제 본문에 있어야 한다. fenced code는 설치 validator와 같은 규칙으로 제외하고 HTML 주석은 닫힘 또는 문서 끝까지 제외한다. 구조 변조·가짜 fence 종료·열린 주석·일부 핵심어만 있는 결과는 적대적 테스트에서 모두 실패한다.

## 정리와 되돌림

- 모든 E2E 임시 검증 장치는 운영 저장소 밖의 임시 디렉터리에서 만들고 테스트 종료 시 삭제했다.
- hung child process와 reader는 제한 시간 안에 종료했다. 부분 이미지, 상태 fixture, 임시 vendor tree가 남지 않았다.
- 실제 OpenAI 이미지 API와 외부 모델은 호출하지 않았다.
- 검증 중 네트워크 호출과 이미지 생성 호출은 각각 0회였으며, 저장소의 실제 `.env` 값은 출력하거나 보고서에 기록하지 않았다.

## 남은 위험

- 자유로운 자연어 해석 자체는 호스트 LLM의 책임이다. 다만 실제 격리 설치 스모크는 스킬 이름·경로를 주지 않고 모델을 실행해 선택 경로와 설치 안내문 해시를 검증했다. 이미지 생성용 외부 모델 호출만 비용·네트워크 부작용 때문에 mock 계약으로 대체했다.

## 증거

- E2E 실행형 테스트 21개, 표 내부 하위 probe 56개.
- 가이드·프롬프트·vendor·빌드 검증 결과는 위 명령 기록에 남겼다.
- 전체 저장소 테스트 1,620/1,620와 Archify 카탈로그·공개 산출물·콘택트 시트 검증이 모두 통과했다.
