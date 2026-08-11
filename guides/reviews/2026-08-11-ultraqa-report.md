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

## 명령 실행 기록

- `[0] node --test tests/e2e/suite/*.test.mjs` — 21/21 통과, 0 fail, 0 skip, 약 1초. 같은 대상을 세 번 연속 통과했고 post-commit도 통과했다.
- `[0] npm run build -- --check` — Career 453개·Studio 463개, 원천과 설치 스냅샷 일치.
- `[0] npm run validate:guides` — 가이드 147개, 스킬 가이드 36개, 템플릿 30개, SVG/PNG 각 90개 통과.
- `[0] npm run check:prompt-guides` — Markdown 89개와 product projection 2개 통과.
- `[0] npm run check:im-not-ai` — 고정 v2.3.0, 15개 파일 검증.
- `[0] npm run check:diagram-skills` — Skillstead v0.9.0 55개, Archify v2.13.0 60개 파일 검증.
- `[1→0] npm run check:guide-diagrams` — Studio 콘텐츠 경로 trigger contract 누락을 검출한 뒤 수정. 단위 31/31, Studio SVG 39개 lint 0/0, 전체 check 통과.
- `[0] npm run validate` — 단위 790/790, 제품 394/394, 계약·격리·형식 검증을 포함한 release readiness 전체 통과.
- `[0] npm test` — 1,591/1,591 통과, fail·skip 0, 642.08초.
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

## 정리와 되돌림

- 모든 E2E 임시 검증 장치는 운영 저장소 밖의 임시 디렉터리에서 만들고 테스트 종료 시 삭제했다.
- hung child process와 reader는 제한 시간 안에 종료했다. 부분 이미지, 상태 fixture, 임시 vendor tree가 남지 않았다.
- 실제 OpenAI 이미지 API와 외부 모델은 호출하지 않았다.
- 검증 중 네트워크 호출과 이미지 생성 호출은 각각 0회였으며, 저장소의 실제 `.env` 값은 출력하거나 보고서에 기록하지 않았다.

## 남은 위험

- 자연어의 의미를 자유롭게 해석하는 부분은 호스트 LLM의 책임이다. 이 저장소의 자동 검증은 의미가 정규화된 뒤의 경로·스킬·검토 역할·결과물·승인 경계를 실행형 계약으로 확인한다. 실제 외부 모델 호출은 비용·네트워크 부작용 때문에 이 검증 범위에서 제외한다.

## 증거

- E2E 실행형 테스트 21개, 표 내부 하위 probe 56개.
- 가이드·프롬프트·vendor·빌드 검증 결과는 위 명령 기록에 남겼다.
- 전체 저장소 테스트 1,591/1,591과 Archify catalog·curated output·contact sheet 검증이 모두 통과했다.
