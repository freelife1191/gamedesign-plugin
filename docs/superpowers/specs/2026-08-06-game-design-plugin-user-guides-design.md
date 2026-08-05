# Game Design Plugin 사용자 가이드 설계

## 1. 결정 요약

Game Design Studio와 Game Design Career를 처음 설치하는 사용자가 저장소 문서만으로 설치, 첫 실행, 기능 선택, 기획 문서 작성, 이미지·도식 제작, 검토와 다중 형식 내보내기까지 완료할 수 있는 계층형 사용자 가이드를 만든다.

핵심 결정은 다음과 같다.

1. 저장소 루트 `README.md`는 두 플러그인의 선택, 설치와 5분 빠른 시작을 제공하는 사용자 중심 진입점으로 재구성한다.
2. 상세 문서는 `guides/game-design-studio/`와 `guides/game-design-career/`로 분리한다.
3. Codex App와 Codex CLI를 동등하게 지원하되 환경별 설치와 호출 방법을 구분한다.
4. 각 플러그인의 설치 스킬 15개를 하나씩 설명하고, 모든 실제 지원 분기를 사례 매트릭스로 문서화한다. 두 제품을 합치면 제품 전용 스킬 28개와 각 독립 패키지에 포함된 동일한 Skillstead 스킬 2개, 총 30개 문서다.
5. 각 플러그인의 Canonical Artifact 템플릿 15개를 목적, 연결 스킬, 품질 프로필, 이미지·도식 슬롯과 함께 목록화한다.
6. 예시는 완성 샘플 프로젝트를 추가하지 않고 `복사 가능한 요청문 → 실행 흐름 → 예상 결과 요약` 규격으로 제공한다.
7. 관계를 공간적으로 표현할 가치가 있는 흐름은 패키지에 고정된 Skillstead `svg-infographic` 0.8.3으로 SVG와 정확한 2× PNG를 만든다.
8. 기술 아키텍처와 유지보수 정보는 기존 `architecture/`, 제품 README와 테스트 문서에 유지하고 사용자 가이드와 분리한다.
9. `guides/`는 저장소의 단일 문서 원본으로 유지하며 생성된 플러그인 스냅샷에 복제하지 않는다.

## 2. 현재 상태와 보완할 차이

현재 `codex/game-design-plugins` 브랜치에는 다음이 구현되어 있다.

- 독립 설치 가능한 Game Design Studio와 Game Design Career
- 제품별 14개 워크플로 스킬과 vendored Skillstead 1개, 합계 설치 스킬 15개
- 제품별 전문 역할 프롬프트 9개
- 제품별 Canonical Artifact 템플릿 15개
- Document Quality Profile, Canonical Artifact, 책임 있는 설계와 승인 계약
- `IMAGE_GEN_MODE` 네 모드와 OpenAI·Codex provider routing
- Skillstead SVG와 정확한 2× PNG 계약
- MD, PDF, DOCX, PPTX 내보내기와 형식별 QA 계약
- root 및 제품별 README의 기술 설명, 설치 명령과 짧은 사용 예시

보완할 차이는 다음과 같다.

- 저장소에 `guides/` 사용자 문서 계층이 없다.
- 기존 README는 기술 계약과 유지보수 정보의 비중이 높아 초보자가 처음부터 따라가기 어렵다.
- 30개 설치 스킬에 대한 일관된 기능별 설명과 App·CLI 요청 예시가 없다.
- 30개 템플릿을 한눈에 비교하고 선택할 수 있는 사용자용 카탈로그가 없다.
- 이미지, 도식화, 승인과 내보내기의 성공·실패 분기를 연결한 사용 설명이 부족하다.
- 사례별 흐름이 텍스트 중심이며, 실제 작업 순서를 보여 주는 검증된 SVG·PNG 도식이 없다.

## 3. 사용자와 성공 기준

### 3.1 주요 사용자

- Codex 플러그인을 처음 설치하는 사용자
- 게임 기획 경험은 있지만 이 플러그인의 Artifact·품질·승인 모델은 모르는 사용자
- Studio로 실제 게임 기획 문서를 만들려는 기획자, 프로듀서와 인디 개발자
- Career로 진로, 채용, 역기획, 포트폴리오, 면접과 성장 자료를 만들려는 입문자·주니어·전환 준비자
- 특정 기능, 템플릿이나 오류 해결 절차만 빠르게 찾으려는 숙련 사용자

### 3.2 성공 기준

처음 사용하는 사람은 문서만 보고 다음을 수행할 수 있어야 한다.

1. Studio와 Career 중 필요한 플러그인을 선택한다.
2. Codex App 또는 CLI에서 marketplace를 연결하고 플러그인을 설치한다.
3. 새 채팅 또는 새 세션에서 플러그인을 호출한다.
4. 목적에 맞는 스킬과 템플릿을 선택한다.
5. 복사 가능한 요청문으로 첫 Canonical Artifact를 만든다.
6. 필요한 이미지와 Skillstead 도식을 계획하고 승인 상태를 이해한다.
7. MD, PDF, DOCX 또는 PPTX 출력을 요청한다.
8. capability 부재나 검증 실패 시 보존된 결과와 재개 방법을 찾는다.

## 4. 공식 자료 조사와 문서 경계

2026-08-06 기준 다음 공식 자료를 확인했다.

- [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins): 지원 표면, 설치, 새 채팅·세션, 활성화와 제거
- [Codex CLI plugin 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin): `plugin add`, `list`, `remove` 계약
- [Codex CLI marketplace 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace): marketplace 등록과 Git source 갱신 계약
- [OpenAI Plugin Packaging](https://developers.openai.com/plugins/build/plugins): 로컬·repo marketplace와 플러그인 구조
- [Skillstead 설치 안내](https://github.com/kyungseo/skillstead/blob/main/docs/INSTALL.md): 고정 태그와 전체 스킬 폴더 설치
- [Skillstead svg-infographic](https://github.com/kyungseo/skillstead/blob/main/skills/svg-infographic/README.md): SVG authoring, lint, Chromium 2× PNG와 예제 범위
- [Skillstead svg-infographic 0.8.3](https://github.com/kyungseo/skillstead/releases/tag/svg-infographic/v0.8.3): 현재 고정 공개 릴리스
- [Skillstead Apache-2.0 License](https://github.com/kyungseo/skillstead/blob/main/LICENSE): 재배포 시 라이선스와 고지 의무

문서에 반영할 사실은 다음과 같다.

- 플러그인은 Codex App의 지원 표면과 Codex CLI에서 사용한다. IDE 확장, 모바일과 일반 Chat을 지원한다고 표현하지 않는다.
- App 설치 후에는 새 채팅, CLI 설치 후에는 새 세션을 시작해야 번들 스킬과 도구를 확실하게 사용할 수 있다.
- `codex plugin marketplace upgrade`는 구성된 Git marketplace를 갱신한다. 플러그인 자동 업데이트라고 표현하지 않는다.
- CLI `/plugins` 브라우저의 활성화 키 동작을 App UI에 일반화하지 않는다.
- workspace 또는 관리자 설치 플러그인은 사용자가 제거하지 못할 수 있음을 안내한다.
- Skillstead 0.8.3은 구조적 기술 도식용이며 캐릭터, 배경, 장면, 마스코트와 통계 정확도가 필요한 차트를 대신하지 않는다.
- 저장소의 vendored Skillstead 0.8.3과 현재 upstream 공개 스킬 사이에 확인된 구현 차이는 없다. 이후 갱신은 전체 패키지와 hash lock을 다시 검증한다.

게임 기획 최신 트렌드를 새로 확장하는 연구는 이 작업의 범위가 아니다. 플러그인에 이미 포함된 2026년 Current 근거를 사용하며 설치·사용법과 직접 연결된 공식 제품 자료만 최신 확인한다.

## 5. 문서 정보 구조

```text
guides/
├── README.md
├── game-design-studio/
│   ├── README.md
│   ├── installation.md
│   ├── quick-start.md
│   ├── workflow.md
│   ├── skills/
│   │   ├── README.md
│   │   └── <설치 스킬별 상세 문서>.md
│   ├── templates.md
│   ├── document-quality.md
│   ├── image-assets.md
│   ├── visualization.md
│   ├── exports.md
│   ├── recipes/
│   │   └── <작업 목적별 레시피>.md
│   └── troubleshooting.md
├── game-design-career/
│   └── Studio와 같은 구조
└── assets/
    ├── shared/
    ├── game-design-studio/
    └── game-design-career/
```

`guides/README.md`는 전체 목차, 플러그인 선택과 독자별 추천 시작점을 제공한다. 제품별 `README.md`는 해당 플러그인의 완전한 사용자 가이드 인덱스다.

`guides/`는 source-owned 문서다. `npm run build`가 재생성하는 `plugins/` 스냅샷에 복제하지 않는다. 기존 제품 README는 독립 패키지의 기술·운영 설명으로 유지하며, root README와 `guides/`는 저장소 사용자를 위한 학습·작업 안내를 담당한다.

## 6. 루트 README 설계

루트 `README.md`는 다음 순서로 재구성한다.

1. 제품군 소개와 보장하지 않는 결과
2. Studio와 Career 선택표
3. 지원 환경과 요구 사항
4. Codex App 설치
5. Codex CLI 설치
6. 설치 확인, 새 채팅·세션과 첫 요청
7. Studio 5분 예시
8. Career 5분 예시
9. 품질 프로필, Canonical Artifact, 이미지, Skillstead와 내보내기 요약
10. 30개 템플릿 요약과 상세 카탈로그 링크
11. 제품별 상세 가이드 링크
12. 제한, 개인정보, 권리와 사람 승인
13. 문제 해결과 개발자 문서 링크
14. 라이선스와 Skillstead 고지

기존의 긴 파일 구조, 내부 script 목록, 빌드 상세와 release 검증 정보는 제거하지 않고 적절한 기술 문서나 제품 README 링크로 이동시켜 중복을 줄인다.

## 7. 제품별 가이드 설계

각 제품 가이드는 다음 학습 순서를 제공한다.

```text
제품 이해
→ 설치
→ 5분 빠른 시작
→ 전체 workflow 이해
→ 스킬 또는 템플릿 선택
→ 목적별 recipe 실행
→ 이미지·도식·내보내기
→ 검토·승인
→ 문제 해결
```

### 7.1 Studio 레시피

- 신규 게임 아이디어에서 승인 가능한 GDD까지
- 시스템 기능과 규칙·상태·예외 명세
- 내러티브·퀘스트·NPC와 전투 콘텐츠 설계
- UI/UX, 온보딩, 플랫폼과 접근성 검토
- 경제·밸런스·LiveOps 이벤트 설계
- 제작 범위·리스크·검토·다중 형식 출력

### 7.2 Career 레시피

- 목표 직무 선택과 학습 로드맵
- 현재 채용공고 조사와 역량 격차 분석
- 게임 분석과 역기획 포트폴리오
- 창작 포트폴리오 제작과 5축 검토
- 채용공고·포트폴리오 기반 면접 연습
- 주니어 성장과 이직·직무 전환 준비

각 레시피는 최소 하나의 Skillstead 흐름도, 복사 가능한 App·CLI 요청문, 단계별 산출물, 사람 승인 지점, 실패·재개 경로와 관련 스킬·템플릿 링크를 포함한다.

## 8. 스킬별 문서 규격

각 설치 스킬 문서는 다음 고정 목차를 사용한다.

1. 목적과 최종 산출물
2. 사용할 때
3. 사용하지 않을 때
4. 필수 입력과 선택 입력
5. Codex App 요청 예시
6. Codex CLI 요청 예시
7. 내부 진행 흐름
8. 생성 파일과 결과 구조
9. 관련 템플릿·품질 프로필·전문 역할
10. 이미지·도식화 조건
11. 검토·승인 기준
12. 실패·fallback·재개 방법
13. 다음 작업 요청문
14. 관련 문서

예시는 다음 형식으로 통일한다.

```text
[복사 가능한 요청문]
→ [사용되는 스킬·역할·템플릿과 진행 순서]
→ [예상 결과 파일과 핵심 내용]
```

요청문은 실제 호출면에 맞춰 검증한다. App의 `@` 호출과 CLI의 `$plugin:skill` 호출을 무검증 상태로 단정하지 않는다. 설치된 플러그인과 공식 문서에서 노출 이름을 확인하고, 자연어 자동 라우팅 예시와 명시 호출 예시를 구분한다.

### 8.1 사례 범위

각 스킬의 실제 계약에서 해당되는 다음 분기를 빠짐없이 다룬다.

| 사례 | 설명 |
| --- | --- |
| 최소 시작 | 아이디어 한두 문장만 있는 상태 |
| 구조화된 시작 | 목표, 대상, 플랫폼과 제약이 준비된 상태 |
| 기존 문서 개선 | 기존 Artifact나 기획서를 보완하는 상태 |
| 검토·감사 | 품질, 근거, 위험과 승인 상태를 확인하는 작업 |
| 후속 작업 | 이전 Canonical Artifact를 이어서 작업하는 경우 |
| 이미지 포함 | prompt-only, select, required, all 분기 |
| 도식 포함 | 흐름, 상태, 루프, 의존성이나 로드맵을 시각화하는 경우 |
| 다중 형식 출력 | MD, PDF, DOCX, PPTX 전달 |
| 입력 부족 | 가정과 미확정 항목을 분리하는 경우 |
| capability 부재 | API key, Codex image, Chromium 또는 renderer가 없는 경우 |
| 지원하지 않는 요청 | 다른 스킬, 차트 경로 또는 외부 도구로 넘기는 경우 |

무한한 문장 변형을 나열하지 않는다. 스킬의 trigger, non-trigger, required input, workflow, output, completion과 실패 계약에서 확인되는 의미 있는 분기를 모두 문서화한다.

### 8.2 Studio 스킬 카탈로그

- `apply-document-quality-profile`
- `define-game-vision`
- `design-game-content`
- `design-game-economy-and-liveops`
- `design-game-systems`
- `design-player-experience`
- `export-game-design-documents`
- `generate-image-assets`
- `orchestrate-game-design-project`
- `plan-game-production`
- `plan-image-assets`
- `review-game-design`
- `review-image-assets`
- `visualize-game-design`
- `svg-infographic`

### 8.3 Career 스킬 카탈로그

- `apply-document-quality-profile`
- `build-game-design-portfolio`
- `export-career-documents`
- `generate-image-assets`
- `map-game-design-career`
- `orchestrate-game-design-career`
- `plan-image-assets`
- `plan-junior-growth`
- `practice-game-design-interview`
- `research-game-design-jobs`
- `reverse-engineer-game-design`
- `review-game-design-portfolio`
- `review-image-assets`
- `visualize-career-roadmap`
- `svg-infographic`

## 9. 템플릿 카탈로그 설계

각 템플릿 항목은 한국어 표시명, template ID, 목적, 적합·부적합 사례, 연결 스킬과 전문 역할, 필수·선택 섹션, 근거·승인, 품질 프로필, 이미지·도식 슬롯, 출력 형식, package path, 요청 예시와 예상 결과를 제공한다.

### 9.1 Studio 템플릿

| Template ID | 한국어 표시명 |
| --- | --- |
| `game-design-brief` | 게임 기획 브리프 |
| `vision-pillars` | 게임 비전·설계 원칙 |
| `core-motivation-loop` | 핵심 재미·동기 루프 |
| `system-specification` | 시스템 명세 |
| `rule-exception-matrix` | 규칙·예외 매트릭스 |
| `ui-ux-flow-state` | UI/UX 흐름·상태 |
| `accessibility-platform-matrix` | 접근성·플랫폼 매트릭스 |
| `narrative-quest-npc` | 내러티브·퀘스트·NPC |
| `character-skill-combat-monster` | 캐릭터·스킬·전투·몬스터 |
| `economy-balance` | 경제·밸런스 |
| `liveops-experiment-event` | LiveOps 실험·이벤트 |
| `production-scope-risk` | 제작 범위·리스크 |
| `data-schema-table-contract` | 데이터 스키마·테이블 계약 |
| `decision-change-log` | 의사결정·변경 이력 |
| `game-design-review` | 게임 기획 검토 |

### 9.2 Career 템플릿

| Template ID | 한국어 표시명 |
| --- | --- |
| `game-design-role-map` | 게임 기획 직무 지도 |
| `career-stage-goal` | 경력 단계·목표 |
| `competency-matrix` | 역량 매트릭스 |
| `learning-roadmap` | 학습 로드맵 |
| `job-posting-evidence` | 채용공고 근거 |
| `game-analysis-report` | 게임 분석 보고서 |
| `reverse-design-document` | 역기획서 |
| `portfolio-project-brief` | 포트폴리오 프로젝트 브리프 |
| `creative-design-portfolio` | 창작 기획 포트폴리오 |
| `portfolio-backlog` | 포트폴리오 백로그 |
| `five-axis-review` | 5축 포트폴리오 검토 |
| `interview-question-answer-log` | 면접 질문·답변 로그 |
| `introduction-motivation` | 자기소개·지원동기 |
| `junior-growth-review` | 주니어 성장 검토 |
| `transition-readiness` | 이직·전환 준비도 |

## 10. Skillstead 도식화 설계

도식은 관계가 prose나 짧은 표보다 명확해질 때만 사용한다. 구조적 도식은 Skillstead 전용 lane이며 일반 이미지 provider로 대체하지 않는다.

### 10.1 공통 도식

- Studio와 Career 선택 흐름
- Codex App·CLI 설치 흐름
- Canonical Artifact 상태·승인 흐름
- `IMAGE_GEN_MODE` 네 가지 분기
- 이미지 계획·생성·검토·문서 삽입 흐름
- MD·PDF·DOCX·PPTX 내보내기 흐름

### 10.2 Studio 도식

- 전체 게임 기획 오케스트레이션
- 비전에서 GDD 승인까지의 흐름
- 시스템 규칙·상태·예외 설계
- 콘텐츠·내러티브·퀘스트 연결
- 경제·밸런스·LiveOps 루프
- 제작 범위·리스크·검토 흐름

### 10.3 Career 도식

- 경력 단계 진단과 스킬 라우팅
- 직무 선택·역량 격차·학습 로드맵
- 채용 조사에서 지원 증거까지의 흐름
- 역기획 포트폴리오 제작 흐름
- 포트폴리오 검토·수정 루프
- 면접·성장·이직 준비 흐름

### 10.4 도식 산출물 계약

- `guides/assets/<scope>/<diagram-id>.svg`가 편집 가능한 기준 원본이다.
- 같은 경로의 `<diagram-id>.png`는 Chromium으로 렌더한 정확한 2× 파생본이다.
- SVG는 한국어 `<title>`, `<desc>`, 안정적인 reading order와 source mapping을 가진다.
- Markdown의 이미지 대체 텍스트는 SVG title과 의미가 일치해야 한다.
- 패키지에 고정된 Skillstead와 product-owned wrapper를 사용해 lint와 render를 수행한다.
- fit-to-page와 close-up 두 단계에서 한글 glyph, overflow, containment, connector, 대비와 reading order를 검토한다.
- upstream 예제 이미지를 복제하지 않고 플러그인의 실제 구조와 상태를 기반으로 독창적인 도식을 작성한다.
- 동일 관계는 새로 그리지 않고 canonical diagram을 여러 문서에서 재사용한다.

## 11. 이미지와 문서 내보내기 설명

`image-assets.md`는 다음을 설명한다.

- `IMAGE_GEN_MODE=prompt-only|select|required|all`
- 모든 모드에서 prompt package와 placeholder가 생성되는 이유
- `select`의 사용자 선택 receipt
- `OPENAI_API_KEY`가 있으면 OpenAI만 사용하고 실패 시 Codex로 fallback하지 않는 정책
- API key가 없을 때 Codex host image capability를 사용하는 정책
- concept-draft, document-approved, production-candidate 상태와 사람 승인
- 캐릭터, NPC, 몬스터, 스킬·VFX, 배경, 아이템, UI, 스토리, key art, 문서 삽화와 표지 유형
- API key, raw private config, 권리와 개인정보 경계

`exports.md`는 다음을 설명한다.

- Canonical MD가 내용 기준 원본인 이유
- MD, PDF, DOCX, PPTX의 용도와 선택 기준
- 승인되지 않은 이미지가 placeholder로 남는 조건
- Skillstead SVG와 검증된 2× PNG 결속
- PPTX가 문서 제목 분할이 아니라 독립적인 발표 story를 요구하는 이유
- renderer 부재나 시각 QA 실패 시 fail-closed 결과와 재개 방법

## 12. 오류와 fallback 문서 규격

모든 문제 해결 항목은 다음 순서로 작성한다.

```text
증상
→ 가능한 원인
→ 확인 방법
→ 안전한 복구 단계
→ 복사 가능한 재개 요청문
→ 보존된 결과와 생성되지 않은 결과
```

최소 문제 해결 범위는 다음과 같다.

- App 또는 CLI에서 플러그인이 보이지 않음
- 설치했지만 현재 채팅·세션에서 스킬을 찾지 못함
- marketplace 이름이나 plugin selector 오류
- local marketplace와 Git marketplace update 차이
- Node.js 또는 Chromium 부재
- Skillstead lint, render 또는 visual QA 실패
- `IMAGE_GEN_MODE` 값 오류
- API key 존재 상태에서 OpenAI generation 실패
- API key와 Codex image capability가 모두 없는 상태
- image approval 부족으로 문서 삽입이 차단됨
- PDF, DOCX 또는 PPTX renderer 부재
- 근거, 권리, 개인정보 또는 사람 승인 누락
- 이전 Canonical Artifact를 재개하지 못함

문서는 의도만 존재하는 상태를 성공으로 표현하지 않는다. 실제로 남아 있는 Canonical MD, SVG, prompt package, placeholder, manifest와 재개 단계만 안내한다.

## 13. 추가 조사와 구현 전 확인

가이드 작성 전에 다음을 repository truth와 대조한다.

1. 설치된 Codex CLI의 `plugin` 명령과 공식 명령 문법
2. 30개 설치 스킬의 trigger, non-trigger, input, workflow, output, completion과 fallback
3. 30개 템플릿과 Document Quality Profile mapping
4. 이미지 네 모드와 API key 유무별 provider 분기
5. App와 CLI에 노출되는 plugin·skill 이름과 명시 호출 문법
6. 내보내기 capability와 형식별 QA 계약
7. 기존 unit, contract와 E2E fixture에서 사용자 예시로 전환할 수 있는 검증된 흐름
8. 각 Skillstead diagram에 적합한 preset과 source mapping

공식 자료와 로컬 구현이 다르면 현재 실행 환경과 repository test가 증명하는 동작을 우선하고 차이를 문서에 명시한다. 발견된 불일치는 이 가이드 범위를 벗어난 제품 변경으로 조용히 수정하지 않고 별도 이슈나 후속 계획으로 보고한다.

## 14. 검증 설계

### 14.1 구조와 coverage

- Studio와 Career 각각 15개 스킬 문서가 존재한다.
- 두 템플릿 카탈로그가 package의 15개 template ID와 정확히 일치한다.
- 각 recipe, 기능 guide와 root README가 제품별 index에서 도달 가능하다.
- 모든 상대 링크, file link와 heading anchor가 유효하다.
- 문서의 경로는 generated snapshot과 source-owned 경계를 혼동하지 않는다.

### 14.2 내용 정확성

- `제품 스킬 14개 + vendored Skillstead 1개 = 설치 스킬 15개` 표현을 통일한다.
- App와 CLI의 설치, 새 채팅·세션, 호출과 제거를 구분한다.
- Git marketplace upgrade를 plugin auto-update로 표현하지 않는다.
- 모든 복사 가능한 요청문은 실제 plugin, skill, profile, template와 option을 참조한다.
- 이미지 모드, provider routing, approval lifecycle과 export 제한이 source contract와 일치한다.
- 지원하지 않는 기능, capability 부재와 사람 승인 필요성을 숨기지 않는다.
- 실제 `.env` 값, API key, private config나 사용자 자료를 예시에 포함하지 않는다.

### 14.3 도식 검증

- 모든 SVG가 packaged Skillstead lint를 통과한다.
- 모든 PNG가 정확한 2× 크기이며 CRC-valid complete PNG다.
- SVG title, desc와 Markdown alt text가 존재하고 의미가 일치한다.
- fit-to-page와 close-up visual QA 결과를 기록한다.
- diagram ID, source mapping과 문서 link가 안정적이다.

### 14.4 저장소 회귀 검증

- `npm run build -- --check`
- Markdown과 JSON format gate
- unit, contract, product와 E2E test
- 독립 plugin marketplace smoke test
- official plugin validator와 skill validator
- `git diff --check`
- 변경 문서에 대한 초보자 관점 writer pass와 별도 reviewer pass

새 dependency는 추가하지 않는다. 기존 Node.js tooling과 vendored Skillstead scripts를 사용해 문서 coverage, link, path와 diagram 검증을 확장한다.

## 15. 비목표

- 플러그인 runtime, 스킬, hook, 이미지 provider나 export renderer의 동작을 변경하지 않는다.
- 실제 완성형 게임 프로젝트나 전체 포트폴리오 출력물을 새 fixture로 추가하지 않는다.
- 모든 가능한 자연어 문장 변형을 예시로 나열하지 않는다.
- Skillstead upstream 갤러리 자산이나 회사 내부 기획 문서를 복제하지 않는다.
- 일반 생성형 이미지로 구조적 도식이나 통계 차트를 만든다고 안내하지 않는다.
- 현재 지원하지 않는 IDE 확장, 모바일 또는 일반 Chat 설치를 약속하지 않는다.
- 공개 marketplace 제출, remote push, release 배포를 수행하지 않는다.

## 16. 위험과 완화

| 위험 | 완화 |
| --- | --- |
| 가이드가 너무 길어 처음 사용자가 길을 잃음 | root와 제품 quick start를 짧게 유지하고 상세 reference를 분리 |
| 동일 내용이 여러 문서에서 drift | canonical diagram과 제품 index를 재사용하고 coverage test 추가 |
| App·CLI 동작이 바뀜 | 공식 문서 링크, 기준일과 실제 CLI 검증을 기록 |
| 30개 스킬 문서의 설명이 source contract와 어긋남 | SKILL.md 기반 inventory와 positive·negative coverage 검사 |
| 템플릿 이름·개수가 package와 어긋남 | package template directory에서 exact ID set 비교 |
| 도식이 장식으로 과도하게 사용됨 | relationship이 prose보다 명확할 때만 생성하고 canonical diagram 재사용 |
| PNG가 존재하지만 읽기 어려움 | lint와 render를 verification과 분리하고 두 단계 visual QA 수행 |
| 설치 예시가 특정 개발 checkout에만 맞음 | App, CLI, local marketplace와 Git marketplace 경로를 구분 |

## 17. 완료 기준

다음 조건을 모두 만족하면 구현이 완료된다.

1. root README만 읽어도 두 플러그인의 차이, App·CLI 설치, 첫 요청과 상세 가이드 위치를 이해할 수 있다.
2. 제품별 가이드가 설치부터 문제 해결까지 끊김 없는 초보자 경로를 제공한다.
3. 30개 설치 스킬과 30개 템플릿이 누락 없이 문서화된다.
4. 모든 기능 예시가 복사 가능한 요청문, 진행 흐름과 예상 결과를 포함한다.
5. 승인된 18개 diagram inventory가 SVG와 검증된 2× PNG로 제공된다.
6. 이미지, Skillstead, 승인과 다중 형식 export의 성공·실패 분기가 실제 계약과 일치한다.
7. 모든 문서 link, path, command, skill ID, template ID와 option이 검증된다.
8. 기존 build, test, marketplace smoke와 plugin validation이 회귀 없이 통과한다.
9. 구현 중 발견된 제품 동작 불일치는 가이드에서 숨기지 않고 후속 작업으로 보고한다.

## 18. 구현 순서

1. repository truth와 공식 설치 계약 inventory를 고정한다.
2. root 및 제품별 guide skeleton과 navigation을 만든다.
3. Studio와 Career의 30개 skill reference를 작성한다.
4. 30개 template catalog와 document-quality 설명을 작성한다.
5. image, visualization, export와 troubleshooting guide를 작성한다.
6. 제품별 recipe와 copyable prompt를 작성한다.
7. 18개 Skillstead SVG를 authoring하고 2× PNG를 render·검토한다.
8. root README를 beginner landing page로 재구성한다.
9. coverage, link, path와 diagram 검증을 추가한다.
10. 전체 release gate와 독립 설치 smoke를 실행하고 별도 문서 review를 받는다.
