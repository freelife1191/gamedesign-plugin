# README 정보 구조·활용 예시·전체 아키텍처 보강 설계

## 문서 상태

- 작성일: 2026-08-11
- 상태: 구현 전 승인 설계
- 콘텐츠 유형: Landing
- 대상 문서: 저장소 루트 `README.md`
- 주요 독자: 게임 기획 입문 학생, 취업 준비생, 솔로·인디 기획자, 현업 기획자, 교육자·멘토
- 시각화 도구: 설치된 Archify 2.13과 기존 Skillstead 배포 자산

## 1. 결정 요약

루트 README를 기능 목록 중심 문서에서 작업 중심 랜딩 페이지로 재구성한다. 독자는 상단 목차에서 자신의 목적을 고른 뒤 설치, 첫 요청, 케이스별 프롬프트, 예상 결과물, 스킬, 아키텍처와 상세 가이드로 이동한다. README는 대표 실행 경로를 충분히 설명하되 146개 전체 프롬프트 카드와 개별 스킬 계약은 기존 `guides/` 문서에 유지한다.

README에 새 한국어 Archify 전체 시스템 아키텍처를 추가한다. GitHub에서는 정적 PNG 미리보기를 보여 주고, 이미지를 클릭하면 검색·확대·테마·가이드 보기를 제공하는 한국어 대화형 HTML이 열린다. 기존 Studio 프로젝트, Career 증거와 두 플러그인 인계 도식은 하위 상세 보기로 연결한다.

## 2. 배경과 문제

현재 README에는 제품 선택, 설치, 빠른 시작, 활용 사례, 결과 경계와 상세 가이드가 있다. 그러나 정보가 여러 구역에 분산되어 다음 문제가 생긴다.

- 상단에 목차가 없어 349줄 문서에서 목적에 맞는 구역을 찾기 어렵다.
- 설치 설명과 첫 요청 사이에 긴 설명이 있어 처음 실행하는 경로가 끊긴다.
- `5분 빠른 시작`의 일부 요청문이 한 줄로 길어 GitHub에서 가로 스크롤이 생긴다.
- 대표 요청문은 있으나 케이스 수가 적고, 어떤 스킬이 어떤 순서로 실행되는지 한눈에 보이지 않는다.
- 예상 결과가 일반적인 최소·선택·확장 분류로만 설명되어 요청별 실제 파일과 읽는 순서를 예상하기 어렵다.
- Archify 링크 3개는 있지만 플러그인 구성 요소와 전체 실행 경계를 설명하는 하나의 시스템 아키텍처가 없다.
- 상세 설명을 한 문단에 연속해서 나열한 부분은 목록, 표 또는 카드로 바꿀 수 있다.
- 입문자용 안내와 패키지 기술 inventory가 같은 시각적 무게로 이어져 핵심 경로가 흐려진다.

## 3. 목표와 비목표

### 3.1 목표

1. 독자가 상단 목차에서 두 번 이내 이동으로 원하는 시작점에 도달한다.
2. 처음 방문한 독자가 30초 안에 Studio, Career 또는 두 플러그인 조합을 선택한다.
3. 설치부터 첫 결과 확인까지의 순서를 한 화면 흐름으로 이해한다.
4. 입문, 단일 기획 과제, 포트폴리오, 전체 프로젝트에 사용할 대표 프롬프트를 복사한다.
5. 각 예시에서 플러그인, 직접 스킬, 실행 흐름, 최소 결과, 선택 결과, 사람 검토와 다음 요청을 확인한다.
6. 각 결과물이 저장되는 Canonical Artifact 구조와 읽는 순서를 실제 파일명으로 보여 준다.
7. 전체 플러그인 시스템의 구성 요소, 신뢰 경계, 자동 검증과 사람 승인 관계를 Archify로 설명한다.
8. Studio와 Career 설치 패키지의 file tree, 주요 디렉터리 역할과 source/generated 관계를 한눈에 보여 준다.
9. 설치, 이미지, 내보내기, 권리와 승인에 관한 기존 fail-closed 계약을 유지한다.
10. README의 상세 링크와 실제 가이드, 스킬, 템플릿, Archify 산출물이 일치하도록 테스트한다.

### 3.2 비목표

- 146개 전체 프롬프트 카드를 루트 README에 복제하지 않는다.
- 30개 스킬 가이드의 입력·출력·오류 계약을 README에 전부 복제하지 않는다.
- README를 개발자용 API reference나 전체 운영 runbook으로 바꾸지 않는다.
- 기존 Studio, Career와 Suite Archify 도식의 의미를 새 전체 아키텍처에 중복해서 넣지 않는다.
- 이미지, PDF, DOCX 또는 PPTX가 capability와 품질 검증 없이 생성된다고 약속하지 않는다.
- 사람의 기획 판단, 채용 합격, 권리 검토 또는 공개 승인을 자동화하지 않는다.

## 4. 검토한 구성 대안

### 4.1 대안 A: 작업 중심 계층형 랜딩 페이지

상단에서 선택과 실행을 먼저 안내하고, 대표 사례와 결과물 뒤에 정책·기술 정보를 둔다. 상세 계약은 기존 가이드로 연결한다.

- 장점: 입문자는 빠르게 시작하고 숙련자는 TOC로 원하는 reference에 바로 이동한다.
- 장점: 대표 예시를 늘려도 접이식 카드와 요약표로 길이를 통제할 수 있다.
- 단점: 전체 세부 계약을 보려면 상세 가이드로 이동해야 한다.

### 4.2 대안 B: 제품별 두 개의 긴 설명으로 분리

README 상단부터 Studio와 Career를 각각 완결된 문서처럼 설명한다.

- 장점: 한 제품만 사용하는 독자는 제품 문맥을 유지할 수 있다.
- 단점: 설치, 안전, 결과 계약과 두 제품 연계 설명이 반복된다.

### 4.3 대안 C: 스킬·템플릿 카탈로그 중심 reference

30개 스킬과 30개 템플릿을 표로 먼저 보여 준다.

- 장점: 이미 스킬 ID를 아는 독자는 검색하기 쉽다.
- 단점: 처음 사용하는 독자가 목적에서 시작하기 어렵고 결과보다 내부 명칭이 앞선다.

대안 A를 선택한다.

## 5. README의 최종 정보 구조

README의 H2 순서는 다음과 같이 고정한다.

1. `목차`
2. `30초 안에 플러그인 선택하기`
3. `설치하기`
4. `5분 안에 첫 결과 만들기`
5. `케이스별 프롬프트로 시작하기`
6. `스킬별로 바로 실행하기`
7. `요청 뒤에 생성되는 결과물`
8. `플러그인 구조와 전체 시스템 아키텍처`
9. `이미지·도식·문서 내보내기`
10. `상세 가이드에서 더 알아보기`
11. `안전·권리·사람 승인 경계`
12. `문제를 해결하고 작업 재개하기`
13. `기술 문서·기여·라이선스`

현재 별도 H2인 App 설치와 CLI 설치는 `설치하기`의 H3으로 합친다. 사용자 유형, 활용 방법과 작업 규모 설명은 `30초 안에 플러그인 선택하기`와 `케이스별 프롬프트로 시작하기`에 통합한다. 템플릿 설명은 결과물 구역에 포함한다. 기술 inventory는 마지막 `<details>` 안에 유지한다.

### 5.1 문서 상단

첫 화면은 다음 요소만 포함한다.

1. 제품을 한 문장으로 설명하는 TL;DR
2. 결과 보장과 사람 검토에 관한 한 문장 경계
3. 13개 H2로 이동하는 상단 TOC
4. Studio, Career, 둘 다의 차이를 설명하는 3열 선택표
5. 기존 `plugin-selection-flow.png`와 편집 가능한 SVG 링크

TOC는 목록의 표현과 실제 H2 anchor가 정확히 일치해야 한다. 빈 앵커, 중복 heading과 숨긴 HTML 링크를 허용하지 않는다.

### 5.2 설치와 첫 실행

설치는 App과 CLI를 같은 H2 아래에서 구분한다.

- App: 프로젝트 열기, marketplace 확인, 앱 재시작, 플러그인 설치, 새 채팅 시작
- CLI: marketplace 등록, 제품별 독립 설치 명령, 설치 확인, 새 세션 시작
- 업데이트: marketplace refresh와 실제 플러그인 재설치의 차이

`5분 안에 첫 결과 만들기`는 다음 3개 경로를 제공한다.

- Studio 첫 브리프
- Career 첫 경력 계획
- Studio 결과를 Career 공개 증거 후보로 넘기는 연계 흐름

요청문은 80자 이하의 의미 단위로 줄바꿈한 `text` 코드 블록을 사용한다. 같은 요청을 App과 CLI에 중복하지 않고, App 호출과 CLI 직접 스킬 접두어의 차이만 별도 예시로 보여 준다.

### 5.3 케이스별 프롬프트

README에는 18개의 대표 케이스를 제공한다. 각 카드는 `<details>`로 접되 `summary`를 코드 inventory처럼 쓰지 않는다. 한글 작업 제목과 한 문장 목적을 먼저 표시하고, stable ID·난이도·영문 Artifact ID는 보조 정보로 괄호 또는 본문에 둔다.

```text
게임 비전과 핵심 기둥 정리 (ST-C01)
대상 플레이어와 핵심 재미를 검토 가능한 기획 브리프로 바꿉니다.
```

접힌 상태에서도 사용자가 `무엇을 하는 사례인지`, `언제 쓰는지`, `무엇을 얻는지`를 한글로 이해할 수 있어야 한다. 영문 ID만 나열한 summary와 한국어 설명 없이 Artifact slug만 이어 붙인 summary는 허용하지 않는다.

#### Studio 7개

1. 대상 플레이어와 핵심 재미 정의
2. 핵심 루프와 의미 있는 선택 설계
3. 규칙·상태·예외·데이터 명세
4. 온보딩·UI·접근성 흐름 검토
5. 퀘스트·NPC·내러티브 구조 설계
6. 성장·경제·밸런스·LiveOps 설계
7. 전체 게임 기획 프로젝트와 GDD 구성

#### Career 7개

1. 게임 기획 직무와 전문 분야 비교
2. 12주 역량 증거 로드맵
3. 관찰 기반 역기획
4. 창작 기획 포트폴리오 프로젝트
5. 포트폴리오 5축 검토와 수정
6. 면접 질문·답변·근거 연결
7. 주니어 성장 또는 직무 전환 계획

#### 두 플러그인 연계 4개

1. Studio 프로젝트를 Career 포트폴리오 후보로 분리
2. 시스템 기획 산출물을 면접 근거로 연결
3. 공개 가능한 이미지·도식·결정 근거 패키지 구성
4. 기획 프로젝트 완료 뒤 역량 gap과 다음 과제 갱신

각 카드의 필드는 다음 순서로 고정한다.

- **사용 시점**: 어떤 문제에서 이 카드를 선택하는가
- **준비 입력**: 사용자가 제공해야 하는 최소 정보
- **복사할 요청문**: App 자연어 호출과 CLI 직접 스킬 ID
- **실행 흐름**: 호출되는 주요 스킬을 순서대로 표시
- **예상 결과**: 최소, 선택, 확장 결과의 구체적 파일 또는 Artifact ID
- **읽는 순서**: 결과를 어떤 순서로 검토하는가
- **사람 검토**: 사실, 범위, 권리 또는 승인 주체
- **다음 요청**: 막히거나 확장할 때 복사하는 한 문장

대표 카드의 문구와 스킬 순서는 `guides/prompt-templates/catalog.json`, `guides/use-cases/use-case-manifest.json`과 제품 스킬 계약에서 파생한다. README 문구만으로 새로운 스킬 체인이나 결과를 만들어 내지 않는다.

### 5.4 스킬·에이전트 빠른 사용표와 전체 인벤토리

먼저 제품별로 자주 쓰는 스킬을 작업 유형별 표로 묶어 초보자가 시작점을 고르게 한다.

| 그룹 | Studio 예시 | Career 예시 |
| --- | --- | --- |
| 전체 조율 | `orchestrate-game-design-project` | `orchestrate-game-design-career` |
| 탐색·분석 | `research-game-design` | `research-game-design-jobs`, `reverse-engineer-game-design` |
| 핵심 설계 | `define-game-vision`, `design-game-systems` | `map-game-design-career`, `plan-junior-growth` |
| 콘텐츠·경험 | `design-game-content`, `design-player-experience` | `build-game-design-portfolio`, `practice-game-design-interview` |
| 검토·품질 | `review-game-design`, `apply-document-quality-profile` | `review-game-design-portfolio`, `apply-document-quality-profile` |
| 이미지·도식·출력 | 이미지·시각화·export 스킬 | 이미지·시각화·export 스킬 |

각 행은 다음 질문에 답한다.

- 언제 직접 스킬을 호출하는가
- 어떤 입력이 필요한가
- 어떤 대표 Artifact를 얻는가
- 전체 오케스트레이터 대신 직접 호출할 때의 경계는 무엇인가

빠른 사용표 다음에는 Studio와 Career를 각각 접이식 인벤토리로 제공한다. 사용자가 README만으로 설치 패키지의 전체 역할 구성을 확인할 수 있도록 다음 수량과 구분을 정확히 표시한다.

- 제품 전용 스킬 14개와 vendored Skillstead `svg-infographic` 1개, 합계 15개
- 일반 역할 에이전트 7개와 이미지 전문 에이전트 2개, 합계 9개
- Studio와 Career를 합쳐 설치 스킬 30개와 에이전트 18개

각 스킬 행은 `한글 스킬명 (영문 스킬 ID)`, `사용하는 때`, `핵심 결과`, `직접 호출 커맨드`, `상세 가이드`를 제공한다. 한글 스킬명과 쉬운 설명이 먼저 오고 stable ID는 괄호에 둔다. 직접 호출 커맨드는 설치 namespace를 포함한 다음 형식으로 쓴다.

```text
$game-design-studio:<skill-id>
$game-design-career:<skill-id>
```

각 에이전트 행은 `한글 역할명 (영문 에이전트 ID)`, `쉬운 역할 설명`, `주요 검토 지점`, `호출 경계`, `상세 역할 문서`를 제공한다. 에이전트는 사용자가 직접 호출하는 스킬로 오인하지 않도록 전문 스킬 또는 오케스트레이터가 전달하는 역할 자산이라고 명시한다.

`svg-infographic`는 제품 source의 14개 스킬과 달리 표준 빌드에서 Skillstead 0.8.3으로 vendoring되는 설치 스킬이다. README의 상세 링크는 제품별 `guides/<product>/skills/svg-infographic.md`로 연결하고, 직접 호출 커맨드는 최종 설치 namespace를 사용한다.

### 5.5 Skillstead 설명 도식

코드와 표만으로 처음 사용 흐름을 해석하지 않도록 README에 세 개의 한국어 Skillstead 도식을 추가한다.

1. `사례 선택에서 다음 요청까지`: 플러그인 선택 → 한글 prompt 카드 → 스킬 실행 → Canonical Artifact → 사람 검토 → 다음 요청
2. `스킬과 에이전트가 함께 일하는 방식`: 사용자 직접 호출 또는 오케스트레이션 → 전문 스킬 → 전문 에이전트 검토 → 결과·보류·재개
3. `Canonical Artifact 읽기와 승인 순서`: `content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml` → 사람 승인

각 도식은 editable SVG와 2× PNG를 함께 제공하고 해당 README 섹션에 PNG를 SVG 링크로 감싸 배치한다. 제목·노드·보조 설명은 한국어를 기본으로 하며 stable filename 또는 command만 영문을 유지한다. Skillstead 0.8.3의 source lint, canonical Chromium renderer, 정확한 2× dimension 검증과 fit-to-page·original-size 시각 QA를 모두 통과해야 한다.

### 5.6 플러그인별 file tree

`플러그인 구조와 전체 시스템 아키텍처`의 첫 부분에 Studio와 Career의 설치 패키지 file tree를 각각 둔다. 두 tree는 실제 배포 snapshot인 `plugins/<product>/`를 보여 주되, 편집 원본은 `products/<product>/plugin/`이고 `plugins/<product>/`는 표준 빌드가 생성한다는 점을 먼저 설명한다.

Studio tree는 다음 구조와 수량을 표시한다.

```text
plugins/game-design-studio/
├── .codex-plugin/plugin.json   # 플러그인 manifest
├── agents/                     # 전문 에이전트 9개
├── skills/                     # 제품 스킬 14개 + Skillstead 1개
├── assets/
│   ├── templates/              # Canonical Artifact 템플릿 15개
│   └── shared/                 # 공통 템플릿·지원 자산
├── references/
│   ├── document-quality/       # 문서 품질 profile·preset
│   ├── methods/                # 기획 방법 reference
│   ├── shared/                 # 공통 계약과 책임 설계
│   └── source/                 # 근거 문서의 설치 snapshot
├── scripts/                    # 검증·이미지·내보내기 지원 script 14개
├── hooks/hooks.json            # 작업 중단·검토 hook
├── .env.example                # 이미지 생성 설정 예시
├── README.md
└── BUILD-MANIFEST.json         # 생성 snapshot 무결성
```

Career tree는 다음 구조와 수량을 표시한다.

```text
plugins/game-design-career/
├── .codex-plugin/plugin.json   # 플러그인 manifest
├── agents/                     # 전문 에이전트 9개
├── skills/                     # 제품 스킬 14개 + Skillstead 1개
├── assets/
│   ├── templates/              # Canonical Artifact 템플릿 15개
│   └── shared/                 # 공통 템플릿·지원 자산
├── references/
│   ├── document-quality/       # 문서 품질 profile·preset
│   ├── methods/                # 학습·취업 방법 reference
│   ├── shared/                 # 공통 계약과 책임 설계
│   └── source/                 # 근거 문서의 설치 snapshot
├── scripts/                    # 검증·이미지·내보내기 지원 script 14개
├── hooks/hooks.json            # 작업 중단·검토 hook
├── .env.example                # 이미지 생성 설정 예시
├── README.md
└── BUILD-MANIFEST.json         # 생성 snapshot 무결성
```

각 tree 아래에는 주요 디렉터리의 역할을 설명하는 짧은 표를 둔다.

| 경로 | 사용자가 확인하는 내용 | 직접 편집 여부 |
| --- | --- | --- |
| `.codex-plugin/` | 설치 ID와 플러그인 metadata | source manifest에서만 편집 |
| `agents/` | 어떤 전문가가 검토·설계에 참여하는지 | 제품 source에서 편집 |
| `skills/` | 직접 호출할 수 있는 작업 단위 | 제품 source에서 편집 |
| `assets/templates/` | 생성되는 Canonical Artifact 종류 | 제품 source에서 편집 |
| `references/` | 품질·방법·근거 계약 | 제품 또는 shared source에서 편집 |
| `scripts/` | 검증·이미지·내보내기 실행 지원 | shared source에서 편집 |
| `hooks/` | 중단·검토·재개 경계 | 제품 source에서 편집 |
| `BUILD-MANIFEST.json` | 배포 snapshot 파일·digest 증거 | 직접 편집하지 않음 |

README의 tree는 모든 하위 파일을 나열하지 않는다. 에이전트와 스킬의 정확한 이름은 제품별 `agents/`, `skills/` 목록과 상세 가이드 링크로 이어진다. 이 방식은 구조를 한눈에 보여 주면서 README가 수백 개 파일의 중복 inventory가 되는 것을 막는다.

## 6. 결과물 설명 계약

`요청 뒤에 생성되는 결과물`은 추상적인 목록 대신 하나의 예시 디렉터리와 결과별 역할을 보여 준다.

```text
project-artifact/
├── content.md
├── evidence.yml
├── decisions/
├── assets/
└── export-manifest.yml
```

결과는 다음 세 층으로 구분한다.

| 결과 층 | 항상 생성되는가 | 예시 | 검토 방법 |
| --- | --- | --- | --- |
| 최소 결과 | 요청 범위와 검증이 성립하면 생성 | `content.md`, `evidence.yml`, 결정 기록 | 내용, 근거, 미정 항목을 먼저 읽는다. |
| 선택 결과 | 사용자가 요청하거나 관계 설명이 필요할 때 생성 | Skillstead SVG·PNG, 이미지 prompt package | 원문 의미, 레이블, 권리와 배치를 검토한다. |
| 확장 결과 | renderer와 형식별 QA가 통과할 때 생성 | MD, PDF, DOCX, PPTX | 기준 Markdown과 내용·페이지·폰트를 대조한다. |

README에는 6개 대표 요청의 예상 결과 예시를 별도 표로 제공한다.

- 게임 기획 브리프
- 시스템 명세
- UX 흐름과 접근성 검토
- 관찰 기반 역기획
- 포트폴리오 프로젝트 패키지
- 전체 프로젝트 검토·내보내기

각 예시는 `생성 폴더`, `핵심 파일`, `선택 자산`, `읽는 순서`, `승인 전 보류 항목`을 표시한다.

## 7. Archify 전체 시스템 아키텍처

### 7.1 새 도식의 질문

새 도식 `suite-plugin-system-architecture`는 다음 질문에 답한다.

> Codex 진입점에서 Studio와 Career 플러그인을 선택한 뒤 전문 스킬, Canonical Artifact, 시각·내보내기 lane, 자동 검증과 사람 승인을 거쳐 결과가 어떻게 전달되는가?

diagram type은 `architecture`를 사용한다. 이 질문은 단계 순서보다 구성 요소, 제품 경계, 저장 책임과 승인 경계를 설명하는 것이 핵심이기 때문이다.

### 7.2 구성 요소

도식은 최대 12개 primary node와 두 개의 독립 interface card를 사용한다. primary node는 실행·승인·보류 경로를, card는 topology를 복잡하게 만들지 않고 설치 계약을 설명한다.

1. Codex App와 Codex CLI 진입점
2. `game-design-suite` marketplace
3. Game Design Studio 플러그인과 오케스트레이터
4. Game Design Career 플러그인과 오케스트레이터
5. Studio Canonical Artifact 저장소
6. 승인된 Career 공개 증거 후보 저장소
7. Skillstead·이미지 prompt·생성 후보 시각화 lane
8. MD·PDF·DOCX·PPTX 내보내기 lane
9. 자동 validation과 형식별 QA
10. 실패한 lane의 보류 상태
11. 이름 있는 사람의 검토·승인
12. 전달 결과

두 interface card는 다음 의미를 독립적으로 보존한다.

- `전문 스킬 인터페이스`: Studio와 Career가 각 제품 namespace의 오케스트레이터와 전문 스킬을 실행한다.
- `근거·결정 인터페이스`: Canonical Artifact가 `content.md`, `evidence.yml`, `decisions/`와 manifest를 보존한다.

card는 component를 대체하는 숨은 topology가 아니다. component 경로는 승인 성공, 승인된 Career 증거 인계와 실패 보류·복구 순서를 직접 증명하고, card는 해당 노드가 사용하는 설치 계약을 설명하는 사용자 가시 보조 surface다.

관계는 다음 불변식을 보여 준다.

- App와 CLI는 같은 플러그인 계약을 다른 호출 표면으로 사용한다.
- Studio와 Career 작업 기준은 서로 섞이지 않는다.
- 두 플러그인의 `agents/`, `skills/`, `assets/`, `references/`, `scripts/`, `hooks/` 책임 경계를 file tree와 같은 용어로 표시한다.
- 모든 파생 이미지와 문서는 Canonical Artifact를 기준으로 한다.
- 자동 검증은 사람의 기획·권리·공개 승인을 대체하지 않는다.
- 실패한 renderer나 QA는 기준 Markdown과 검증 결과를 보존하고 해당 lane만 차단한다.
- Studio 산출물은 공개 가능성 검토 뒤에만 Career 증거 후보로 넘어간다.

### 7.3 발행과 README 표시

Archify 산출물은 다음 경로에 둔다.

```text
guides/archify-diagrams/specs/suite/suite-plugin-system-architecture.json
guides/assets/archify/suite/suite-plugin-system-architecture.html
guides/assets/archify/suite/suite-plugin-system-architecture.receipt.json
guides/archify-diagrams/visual-qa/renders/suite/
  suite-plugin-system-architecture/read.png
```

README는 `read.png`를 표시하고 그 이미지를 HTML 링크로 감싼다. 이미지 아래에는 다음 링크를 둔다.

- 대화형 전체 시스템 아키텍처 열기
- Studio 프로젝트 워크플로 열기
- Career 증거 워크플로 열기
- Studio에서 Career로 넘기는 공개 근거 흐름 열기
- Archify 검증 상태와 QA 근거 보기

### 7.4 Archify 검증

- 설치된 Archify 2.13의 architecture schema, common schema와 architecture example만 확인한다.
- 새 stable ID와 한국어 제품 용어로 spec을 처음부터 작성한다.
- `meta.quality_profile`은 `showcase`로 고정한다.
- 자동 route로 시작하고 진단 전에는 geometry control을 넣지 않는다.
- `validate`와 `deliver` 모두 9개 검사, 오류 0, 경고 0이어야 한다.
- 최종 spec 수정 뒤에는 다시 validate, deliver와 시각 QA를 수행한다.
- READ, light, dark와 필요한 guided view를 headless로 캡처한다.
- 글리프 왜곡, tofu, clipping, node·edge·label 충돌과 과도한 crop을 전수 확인한다.
- PNG와 HTML digest를 QA manifest와 receipt에 결합한다.

## 8. 가독성 규칙

README 편집은 다음 규칙을 적용한다.

- 각 H2는 한 문장의 요약으로 시작한다.
- 한 문단은 2~4문장으로 제한한다.
- 세 개 이상의 병렬 항목은 목록이나 표로 바꾼다.
- 순서가 있는 작업은 번호 목록을 사용한다.
- 제목만 읽어도 구역의 작업을 예상할 수 있게 한다.
- 코드 블록에는 언어 태그를 넣는다.
- 복사 요청문은 의미 단위로 줄바꿈하고 한 줄 80자를 넘기지 않는다.
- 경로, 스킬 ID, 환경 변수와 상태 값은 inline code로 표시한다.
- 같은 정책을 여러 구역에서 반복하지 않고 상세 정책 링크를 사용한다.
- 초보자 경로에는 구현 파일 목록과 내부 manifest 세부 정보를 노출하지 않는다.
- 기술 inventory는 접힌 상태를 유지한다.
- 사용자가 제공하지 않은 사실은 `미정`으로 보존한다는 원칙을 첫 실행 구역에 표시한다.

## 9. 테스트와 검증 설계

### 9.1 README 계약

기존 `tests/contracts/root-readme-user-guides.test.mjs`를 새 H2 순서와 다음 계약으로 갱신한다.

- 상단 TOC가 13개 H2의 exact ordered set과 일치한다.
- TOC 링크의 anchor가 실제 visible heading에 존재한다.
- Studio, Career와 연계 예시 수가 각각 7, 7, 4개다.
- 18개 카드가 사용 시점, 입력, 요청문, 스킬 흐름, 결과, 읽는 순서, 사람 검토와 다음 요청을 가진다.
- Studio와 Career 각각 제품 스킬 14개와 vendored Skillstead 1개를 합친 15개 설치 스킬을 정확히 나열한다.
- 30개 스킬 행은 실제 설치 namespace의 직접 호출 커맨드와 제품별 상세 가이드에 결합된다.
- Studio와 Career 각각 9개 에이전트를 정확히 나열하고 역할 문서 링크와 오케스트레이터 전달 경계를 표시한다.
- 누락, 중복, 잘못된 namespace, 제품 간 스킬·에이전트 교환과 존재하지 않는 상세 링크를 거부한다.
- 18개 사례 summary가 한글 제목, 괄호 속 stable ID와 한글 한 문장 설명을 가지며 코드·slug 나열만으로 끝나지 않는다.
- 30개 스킬과 18개 에이전트의 첫 표시가 `한글 이름 (영문 ID)` 형식이며 쉬운 한글 역할 설명을 가진다.
- 세 Skillstead SVG·PNG 쌍이 정확한 README 섹션에 연결되고 regular non-symlink 파일, source lint와 2× dimension 계약을 통과한다.
- 대표 결과 ID와 read order가 prompt catalog 또는 use-case manifest와 일치한다.
- 긴 요청문 코드 줄이 80자를 넘지 않는다.
- Studio와 Career file tree가 각각 존재하고 required top-level 경로와 실제 agent·skill·template·script 수를 정확히 표시한다.
- file tree가 `products/<product>/plugin/`을 편집 원본, `plugins/<product>/`를 generated snapshot으로 구분한다.
- `BUILD-MANIFEST.json`과 generated `plugins/` tree를 직접 편집하라고 안내하지 않는다.
- 전체 시스템 PNG가 HTML 링크로 감싸져 있고 두 파일이 regular non-symlink 파일이다.
- 기존 설치, 이미지 모드, export 상태와 안전 경계 계약이 유지된다.

### 9.2 Archify 계약

- catalog selected set에 새 suite architecture 항목을 추가한다.
- source document와 source digest를 고정한다.
- architecture spec의 component, boundary와 relationship이 질문의 의미를 보존한다.
- showcase 9/9, 오류·경고 0 receipt를 검증한다.
- published HTML과 receipt의 digest가 일치한다.
- QA manifest가 READ, light, dark와 guided view PNG를 exact set으로 기록한다.
- contact sheet가 새 도식을 포함하며 check mode에서 byte drift가 없다.
- published tree와 catalog에 stale 또는 extra 파일이 있으면 실패한다.

### 9.3 실행 순서

1. README 계약 테스트를 새 구조에 맞게 RED로 작성한다.
2. 새 Archify spec과 상태 계약 테스트를 RED로 작성한다.
3. README를 새 구조로 재작성한다.
4. Archify architecture spec을 작성하고 validate·deliver한다.
5. headless 시각 QA와 contact sheet를 갱신한다.
6. README 링크·앵커와 가이드 검증을 실행한다.
7. 제품 snapshot build check를 실행한다.
8. Archify publication·contact-sheet check를 실행한다.
9. 문서 문체와 코드 블록 길이를 검사한다.
10. 전체 `npm run validate`와 `npm test`를 실행한다.
11. `git diff --check`와 깨끗한 worktree를 확인한다.

## 10. 오류·차단·재개 정책

- 대표 예시의 스킬 또는 결과가 catalog와 맞지 않으면 README를 발행하지 않는다.
- README 링크가 없거나 anchor가 달라지면 guide validation을 실패시킨다.
- Archify가 9/9를 통과하지 못하면 HTML과 PNG를 완료 산출물로 링크하지 않는다.
- 시각 QA에서 글자, 경로, clipping 또는 crop 문제가 발견되면 `blocked-visual`로 기록하고 spec부터 수정한다.
- PDF·DOCX·PPTX renderer가 없으면 해당 결과만 `unavailable` 또는 `blocked`로 유지한다.
- 이미지 provider가 없으면 prompt와 placeholder를 보존한다.
- 사람 승인 전에는 결과를 제작 확정, 공개 승인 또는 채용 준비 완료로 표시하지 않는다.

## 11. 완료 기준

- README 상단에 정확한 TOC가 있다.
- 30초 선택, 설치와 5분 시작이 문서 앞부분에 연속해서 배치된다.
- 18개 대표 케이스에 복사 가능한 요청문, 스킬 흐름과 예상 결과가 있다.
- 18개 사례는 접힌 상태에서도 한글 제목·설명·예상 결과를 이해할 수 있다.
- 스킬 빠른 사용표와 30개 전체 스킬 인벤토리가 직접 호출 커맨드·역할·상세 가이드로 연결된다.
- 18개 전체 에이전트 인벤토리가 역할·검토 지점·호출 경계·상세 역할 문서로 연결된다.
- 30개 스킬과 18개 에이전트가 `한글 이름 (영문 ID)`와 쉬운 설명으로 표시된다.
- 세 개의 Skillstead 설명 도식이 사례 실행, 스킬·에이전트 협업, Artifact 검토·승인 흐름을 설명한다.
- Studio와 Career 각각의 file tree가 주요 경로, 실제 수량과 편집 책임을 설명한다.
- 결과물 예시가 실제 Canonical Artifact 파일과 읽는 순서를 설명한다.
- 새 한국어 Archify 전체 시스템 아키텍처 PNG가 README에 보이고 클릭하면 대화형 HTML이 열린다.
- 기존 3개 한국어 Archify 상세 도식으로 이동할 수 있다.
- 설치, 이미지, 내보내기, 권리와 사람 승인 경계가 유지된다.
- README의 긴 한 줄 요청문과 목록형 문단이 제거된다.
- 관련 계약 테스트, 가이드 검증, 빌드 검사, Archify 검사와 전체 테스트가 통과한다.
- 최종 코드·문서 검토에서 Critical과 Important finding이 0개다.

## 12. 설계 자체 검토

- Placeholder: `TBD`, `TODO` 또는 미결정 구현 항목이 없다.
- 일관성: README의 대표 사례 수는 Studio 7, Career 7, 연계 4로 총 18개다.
- 범위: 루트 README와 새 suite architecture, 직접 관련 테스트·catalog·QA 산출물만 변경한다.
- 중복: 전체 스킬·프롬프트 계약은 기존 상세 가이드가 계속 소유한다.
- 안전: capability 실패와 사람 승인 경계를 약화하지 않는다.
- 시각화: README 정적 PNG와 대화형 HTML의 역할을 분리한다.
