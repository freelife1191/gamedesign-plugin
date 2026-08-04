# Game Design Career

Game Design Career는 게임 기획 입문, 첫 취업, 주니어 성장, 이직 준비를 검증 가능한 산출물로 바꾸는 Codex 플러그인입니다. 진로를 단정하거나 합격을 보장하지 않고, 현재 자료와 제약에서 확인할 수 있는 근거·공백·다음 실험을 분리합니다.

플러그인은 10개 워크플로 스킬, 6개 전문 역할 프롬프트, 15개 Canonical Artifact 템플릿, Skillstead `svg-infographic` 0.8.3, MD/PDF/DOCX/PPTX 내보내기 계약을 하나의 독립 패키지에 포함합니다.

## 설치

요구 사항은 Codex CLI와 Node.js 18 이상입니다. 배포 대상은 저장소의 `plugins/game-design-career` 스냅샷이며, `products/game-design-career/plugin`은 개발 원천입니다.

### 저장소 marketplace 등록

저장소를 받은 뒤 저장소 루트를 비기본 로컬 marketplace로 한 번 등록합니다. `<path-to-repository-root>`에는 `.agents/plugins/marketplace.json`이 들어 있는 디렉터리의 실제 경로를 넣습니다.

```bash
codex plugin marketplace add <path-to-repository-root>
```

등록 결과에서 marketplace 이름 `game-design-suite`와 플러그인을 확인합니다.

```bash
codex plugin marketplace list
codex plugin list
```

### 개별 플러그인 직접 설치

같은 marketplace의 Studio 플러그인과 독립적으로 Career 플러그인만 설치합니다.

```bash
codex plugin add game-design-career@game-design-suite
```

설치 후 새 Codex 작업을 시작해야 새 스킬과 도구가 확실히 로드됩니다. Codex CLI는 임의 디렉터리를 `plugin add` 인자로 받지 않으므로, 로컬 경로를 직접 복사하거나 설정 파일을 수동 편집하지 마십시오.

## 업데이트와 제거

Git marketplace로 등록했다면 스냅샷을 갱신한 뒤 다시 설치합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin add game-design-career@game-design-suite
```

로컬 저장소 marketplace라면 저장소를 갱신하고 배포 스냅샷을 다시 만든 다음 재설치합니다. 같은 버전으로 로컬 개발 중일 때는 설치된 `plugin-creator`의 `update_plugin_cachebuster.py`로 `plugins/game-design-career`의 단일 cachebuster suffix를 갱신한 후 재설치합니다. `marketplace.json`이나 Codex 설정을 손으로 수정하지 마십시오.

제거 명령은 다음과 같습니다.

```bash
codex plugin remove game-design-career@game-design-suite
```

marketplace 자체도 더 이상 사용하지 않을 때만 별도로 제거합니다.

```bash
codex plugin marketplace remove game-design-suite
```

## 플러그인 구조

저장소에는 편집 원천과 배포 결과가 분리되어 있습니다.

- `products/game-design-career/plugin`은 Career 전용 source overlay입니다. 제품 스킬·역할·references·템플릿·문서만 여기서 편집합니다.
- `shared/`는 지식, 책임 있는 설계, 내보내기 계약, hooks, shared runtime scripts와 vendored Skillstead의 공동 원천입니다.
- `plugins/game-design-career`는 suite build가 두 원천을 깨끗한 staging 디렉터리에서 합성한 generated independent snapshot입니다. 다른 플러그인이나 저장소 상대 경로 없이 단독 설치할 수 있어야 합니다.

`plugins/game-design-career` 생성은 suite build가 소유합니다. 생성 결과를 직접 편집하지 마십시오. 변경은 `products/` 또는 `shared/` 원천에 적용하고 테스트한 뒤 다시 빌드합니다.

최종 배포 스냅샷의 구조는 다음과 같습니다. 괄호의 개수는 Career release 계약에서 고정한 수입니다.

```text
plugins/game-design-career/
├── .codex-plugin/plugin.json
├── skills/ (11개)
│   ├── <10개 Career 제품 스킬>/
│   │   └── scripts/                 # 필요한 스킬에만 있는 product helper
│   └── svg-infographic/             # vendored Skillstead 0.8.3
├── agents/ (6개)                    # 이식 가능한 전문 역할 프롬프트
├── hooks/
│   └── hooks.json
├── scripts/                         # shared runtime
│   ├── capability-probe.mjs
│   ├── stop-artifact-review.mjs
│   └── validate-artifact.mjs
├── references/
│   ├── <Career routing, methods, rubric, product schemas>
│   ├── shared/
│   │   ├── knowledge/
│   │   │   ├── core/
│   │   │   └── trends/
│   │   ├── responsible-design/
│   │   └── export/
│   │       ├── schema/
│   │       ├── qa-contracts/
│   │       └── themes/
│   └── source/docs/                 # 원문 49개
├── assets/
│   ├── product-mark.svg
│   ├── templates/                   # Career Canonical Artifact 15개
│   └── shared/templates/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── README.md
└── BUILD-MANIFEST.json              # suite build가 만드는 파일 목록·해시
```

경로 계약을 검색하기 쉽게 요약하면 `references/shared/knowledge/core/`는 검토된 Core 지식, `references/shared/knowledge/trends/`는 Current 근거와 갱신 정책, `references/source/docs/ (49개)`는 원문 provenance입니다. 내보내기 스키마는 `references/shared/export/schema/`에 있고 Career 전용 job·fact/inference·evidence schemas는 제품 references에 있습니다. Studio와 달리 Career에는 profile 합성 계층이 없습니다.

`assets/templates/ (15개)`와 `assets/product-mark.svg`는 Career source overlay에서 옵니다. 최종 `skills/ (11개)`는 제품 스킬 10개와 `skills/svg-infographic/` 한 개이며, `agents/ (6개)`는 네이티브 발견 여부와 무관하게 오케스트레이터가 전달할 수 있는 역할 프롬프트입니다.

`hooks/hooks.json`은 두 shared runtime 진입점을 연결합니다.

- `SessionStart`는 `scripts/capability-probe.mjs`를 실행하는 capability-probe hook입니다. Node, Chromium, LibreOffice와 Codex 문서·PDF·프레젠테이션 capability를 감지하되 선택 기능 부재로 작업을 중단하지 않습니다.
- `Stop`은 `scripts/stop-artifact-review.mjs`를 실행하는 one-retry artifact review hook입니다. 최종 artifact sentinel이 있을 때 Canonical Artifact를 검증하고, 실패하면 교정 패스를 한 번만 요청합니다. hook 재진입 상태에서는 다시 차단하지 않습니다.

최상위 `scripts/`는 이 두 hook과 Canonical Artifact 검증을 위한 shared runtime입니다. Career 전용 product helper는 필요한 제품 스킬의 `skills/<skill-id>/scripts/`에 있으며, 역할 병합, E2E 시나리오, 채용 근거, 시각화 상태와 내보내기 job을 검증합니다. 최종 `BUILD-MANIFEST.json`은 제품 원천 파일이 아니라 suite build가 독립 스냅샷에 추가하는 생성물입니다.

## 작동 방식

1. [오케스트레이터](skills/orchestrate-game-design-career/SKILL.md)가 목표, 경력 단계, 보유 자료, 제약, 요청 형식을 정규화합니다.
2. 가장 작은 순서형 스킬 체인을 선택합니다. 현재 채용 공고·회사·프로젝트·도구·시장 사실이 필요하면 조사 스킬을 먼저 실행합니다.
3. 검토가 필요하면 전문 역할을 최대 3개 선택합니다. 서로 독립적인 검토는 병렬 실행하고, 호스트가 병렬 서브에이전트를 지원하지 않으면 동일한 질문과 역할을 고정 우선순위로 순차 fallback 실행합니다.
4. 결과는 `severity → evidence-gap-id → artifact-section-id → role-priority` 순서로 결정론적으로 병합합니다. 충돌하는 권고는 지우지 않고 명시적 결정으로 남깁니다.
5. 내용은 Canonical Artifact에 보존하고, 도식화와 내보내기는 선택적 파생 작업으로 실행합니다.

`agents/*.md`는 오케스트레이션에 전달하는 이식 가능한 역할 자산입니다. 이 자산은 네이티브 자동 발견을 보장하지 않습니다. 호스트의 자동 발견이 없어도 현재 에이전트가 같은 프롬프트를 순차 실행해야 합니다.

### 경력 단계

| 단계 | 적용 신호 | 기본 결과 |
| --- | --- | --- |
| `entry` | 게임 기획 탐색, 목표 레벨 미정 | 목표와 제약을 기록한 입문 계획 |
| `new-hire` | 신입·첫 게임 기획 직무 준비 | 채용 근거, 역할 맵, 포트폴리오 |
| `junior-growth` | 현직 주니어의 프로젝트 영향·성장 증명 | 분기별 증거 프로젝트와 피드백 계획 |
| `transition` | 회사·직무 전환 준비 | 채용 근거, 면접, 성장·전환 준비도 |

단계나 목표 직무가 불명확하면 `unclear`로 처리하고, 여러 임시 경로와 기회비용을 비교합니다. 하나의 정답 진로를 선언하지 않습니다.

## 스킬 카탈로그

| 스킬 ID | 사용하는 때 | 핵심 결과 |
| --- | --- | --- |
| `orchestrate-game-design-career` | 단계 진단과 복합 작업 라우팅 | 단계·목표 브리프, 스킬 체인, 검토 envelope |
| `map-game-design-career` | 역할군 비교와 역량 공백 계획 | 복수 임시 경로, 교환조건, 증거 과제 |
| `research-game-design-jobs` | 현재 채용·회사·프로젝트 사실이 필요할 때 | 날짜·지역·표본 한계가 있는 채용 근거 세트 |
| `build-game-design-portfolio` | 프로젝트를 검토 가능한 사례로 만들 때 | 주장-근거 색인, 기여도, 복구 큐 |
| `reverse-engineer-game-design` | 기존 게임의 규칙·UI·경제·운영을 역기획할 때 | 관찰/추론 분리, 대안, 반증 방법 |
| `practice-game-design-interview` | 공고와 포트폴리오 기반 면접 연습 | 4종 질문, 근거 연결 답변, 정직한 답변 패턴 |
| `review-game-design-portfolio` | 포트폴리오를 5축으로 검토할 때 | 관찰 상태, 근거 한정 점수, 최소 수정 큐 |
| `plan-junior-growth` | 분기 성장 목표와 이직 준비도를 계획할 때 | 요구사항 레지스터, 증거 프로젝트, 재평가 결정 |
| `visualize-career-roadmap` | 관계·의존·순서가 공간적으로 더 명확할 때 | 접근 가능한 SVG, 선택 근거, 검증 상태 |
| `export-career-documents` | MD/PDF/DOCX/PPTX 파생본이 필요할 때 | Canonical Artifact digest와 capability probe를 담은 non-terminal preflight manifest |

## 전문 역할 프롬프트

| 역할 ID | 검토 책임 | 경계 |
| --- | --- | --- |
| `career-strategist` | 근거 기반 진로 방향과 교환조건 | 작은 표본을 보편 규칙으로 만들지 않음 |
| `game-design-mentor` | 연습이 검토 가능한 기획 판단과 산출물을 만드는지 확인 | 활동량을 능력 증거로 대체하지 않음 |
| `portfolio-reviewer` | 각 주장이 증명하는 역량과 근거 위치 확인 | 시각적 완성도에서 역량을 추론하지 않음 |
| `reverse-design-critic` | 관찰·사실·추론과 반증 경로 검토 | 내부 의도나 구현을 사실로 단정하지 않음 |
| `interview-coach` | 답변의 주장·근거·선택·대안·결과·성찰 연결 확인 | 경험이나 성과를 조작하지 않음 |
| `evidence-auditor` | 최신성, 1차 출처, 범위, 일반화 한계 감사 | 누락·오래됨·비1차 근거를 승인하지 않음 |

## 근거와 최신성 정책

- 현재 채용 공고, 회사·프로젝트, 지역, 고용 형태, 보상, 도구 선호, 정책과 시장 전망은 시점 의존 주장입니다. 최신 1차 출처, 게시일 또는 갱신일, 검색일, 적용 지역을 기록합니다.
- 한 공고나 편의 표본은 시장 전체를 대표하지 않습니다. 반복 신호는 중복을 제거한 출처 ID, 분자, 분모, 표본 크기, 지역, source mix, blind spot과 일반화 한계를 함께 남깁니다.
- 관찰된 사실, 사용자 진술, 해석과 미확인 주장을 분리합니다. 새 근거가 로컬 문서와 충돌하면 충돌을 기록하고 최신 1차 근거를 우선합니다.
- 지원자의 경력, 기여, 팀 규모, 매출, 리텐션, 구현 상태, 결과를 조작하지 않습니다. 누락은 검증 과제나 정직한 답변 패턴이 됩니다.
- 학력, 나이, 전공, 배경, 공백, 명성만으로 적합성이나 경로 순위를 판단하지 않습니다. 비교 기준은 관찰 가능한 근거, 사용자의 목표와 제약입니다.
- 결과는 취업, 합격, 승진, 특정 역량 수준을 보장하지 않습니다.

기본 지식은 프로젝트가 제공한 한국어 원문 49개를 다섯 범주로 색인한 자료와 검토된 Core/Current references에서 옵니다. 원문의 시점 의존 조언은 현재 사실로 재사용하지 않습니다.

## Canonical Artifact

주요 결과는 다음 구조를 기준 원본으로 사용합니다.

```text
artifact-name/
├── content.md
├── evidence.yml
├── decisions/
│   └── README.md
├── assets/
│   └── README.md
└── export-manifest.yml
```

`content.md`는 유일한 내용 기준입니다. `evidence.yml`은 주장·출처·한계를, `decisions/`는 선택·대안·부작용·승인을, `assets/`는 출처·권리를, `export-manifest.yml`은 형식별 작업과 QA 상태를 기록합니다. 파생 파일이 실패해도 기준 원본은 덮어쓰지 않습니다.

## Canonical Artifact 템플릿

| 템플릿 ID | 용도 |
| --- | --- |
| `career-stage-goal` | 단계, 목표, 제약, 다음 검증 과제 |
| `game-design-role-map` | 역할군, 교환조건, 증거 공백 비교 |
| `competency-matrix` | 목표 역량과 현재 증거·학습 과제 연결 |
| `job-posting-evidence` | 공고별 1차 근거와 표본 한계 |
| `portfolio-project-brief` | 문제, 판단, 구현, 테스트, 결과의 검토 경로 |
| `reverse-design-document` | 관찰, 추론, 대안, 반증 계획 |
| `five-axis-review` | 5축 관찰 상태, 근거 점수, 최소 수정 |
| `interview-question-answer-log` | 4종 질문, 답변 근거, 피드백 |
| `junior-growth-review` | 프로젝트 사건, 분기 목표, 재평가 결정 |
| `transition-readiness` | 목표 요구사항, 현재 근거, 전환 공백 |
| `learning-roadmap` | 학습·연습·피드백·증거의 순서 |
| `portfolio-backlog` | 포트폴리오 증거 복구 우선순위 |
| `creative-design-portfolio` | 창의 기획의 의도·대안·검증 증거 |
| `introduction-motivation` | 사실 기반 자기소개와 지원 동기 |
| `game-analysis-report` | 범위가 명확한 게임 분석과 검증 큐 |

각 템플릿은 `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, `assets/README.md`를 포함합니다. [템플릿 디렉터리](assets/templates/)에서 원본을 확인할 수 있습니다.

## 사용 예시

아래 문장은 입력 예시입니다. 플러그인은 없는 자료를 채우지 않고 필요한 근거 공백을 결과에 남깁니다.

### 진로 미결정 입문자

> 시스템, 콘텐츠 기획 중 어느 쪽이 맞는지 아직 모르겠어. 주 8시간, 작은 솔로 프로토타입만 가능해. 복수 경로와 12주 검증 계획을 만들어 줘.

결과는 최소 두 경로, 교환조건, 역량 공백, 작은 연습, 증거 산출물과 피드백 시점을 포함합니다.

### 목표 채용 공고 근거 매트릭스

> 한국의 주니어 시스템 기획 공고를 공식 회사 채용 페이지에서 조사해. 공고별 요구사항과 반복 신호를 분리하고 게시일·검색일·표본·지역·일반화 한계를 기록해 줘.

### 역기획 포트폴리오

> 이 게임의 업그레이드 UI와 비용 규칙을 관찰 근거로 역기획해. 사실과 추론을 분리하고, 각 추론에 반례·대안·검증 방법을 넣어 포트폴리오 사례로 만들어 줘.

사용법 설명만 나열한 문서는 완료로 보지 않습니다.

### 5축 포트폴리오 리뷰

> 이 포트폴리오를 문제 정의, 기획 판단, 구현 연결, 근거와 검증, 회고 관점에서 검토해. 보이지 않은 능력을 0점으로 단정하지 말고 가장 작은 수정부터 제안해 줘.

### 면접 연습

> 이 공고와 내 포트폴리오 근거 ID로 기본·후속·반론·상황 질문을 만들어 줘. 확인할 수 없는 팀 성과는 정직한 답변 패턴으로 바꿔 줘.

### 주니어 성장 계획

> 최근 프로젝트 사건과 피드백을 목표 역할 요구사항에 연결해 두 분기 성장 계획을 만들어 줘. 각 목표에 담당자, 피드백 주기, 증거 산출물과 재평가 결정을 넣어 줘.

### 시각적 로드맵

> 검증된 역량 공백, 학습 의존성과 증거 산출물의 관계를 시각적 로드맵으로 만들어 줘. 적합한 프리셋 선택과 제외 이유도 기록해 줘.

### 문서 내보내기

> 이 Canonical Artifact를 MD와 PDF로, 리뷰어 발표용 PPTX로 내보내 줘. 먼저 preflight manifest를 만들고, trusted bundled renderer와 형식 QA가 원본·파생본 artifact digest를 결합해 검증한 뒤에만 terminal 결과를 기록해 줘.

## Skillstead 도식화

[visualize-career-roadmap](skills/visualize-career-roadmap/SKILL.md)는 관계가 실제로 더 명확해질 때만 Skillstead `svg-infographic` 0.8.3을 사용합니다. 역할 맵, 역량 의존도, 학습 순서, 개발 프로세스, 포트폴리오 정보 구조, 복수 성장 경로 프리셋을 비교하고 선택·제외 이유를 남깁니다. 단순 목록이나 근거 없는 수치는 표 또는 본문으로 유지합니다.

SVG에는 `<title>`, `<desc>`, 결론을 설명하는 alt text가 필요합니다. 패키지의 SVG lint는 정확한 SVG bytes와 digest를 다시 검사합니다. Chromium이 있으면 2× PNG 렌더를 준비할 수 있지만, terminal 성공은 downstream trusted bundled renderer와 visual QA가 실제 SVG/PNG 파일, 정확한 크기와 artifact digest를 결합해 확인한 뒤에만 기록합니다. 브라우저가 없으면 편집 가능한 lint 통과 SVG를 보존하고 PNG를 `unavailable`로 표시하며, 렌더·검증 성공을 주장하지 않습니다.

색, 면적, 위치나 진행률처럼 보이는 표현으로 채용 가능성·역량 수준·일정·결과를 암시하지 않습니다. 모든 수치에는 source, baseline, owner, validation이 필요합니다.

## MD, PDF, DOCX, PPTX 내보내기

[export-career-documents](skills/export-career-documents/SKILL.md)의 `prepare-career-export.mjs`는 preflight 전용입니다. Canonical Artifact 검증이 없거나 실패하면 fail-closed로 중단합니다. 검증에 성공하면 digest를 기록하고 형식별 capability probe를 정규화하지만, 파생 파일을 생성하거나 terminal 결과를 판정하지 않습니다. 준비 단계가 기록할 수 있는 format status는 `not-requested`, `blocked`, `pending`, `unavailable`뿐입니다.

Preflight는 `passed` 또는 `failed`를 수용하거나 생성하지 않으며, caller가 제시한 generation·QA·derivative terminal evidence도 겉보기에 유효한 파일이나 명령과 관계없이 거부합니다. 따라서 preflight manifest 자체는 MD/PDF/DOCX/PPTX 생성 성공이나 실패의 증거가 아닙니다.

준비가 끝난 뒤에만 downstream trusted bundled renderer가 파생본을 만들고 format/visual QA를 실행합니다. 이 downstream 단계는 canonical source, 생성된 derivative, 검사 결과와 artifact digest를 결합해야 terminal `passed` 또는 `failed`를 판정할 수 있습니다. 실제 MD/PDF/DOCX/PPTX/SVG/PNG 성공 판정과 대표 출력 검증은 suite Task 11이 수행합니다.

| 형식 | downstream terminal QA 계약 |
| --- | --- |
| MD | frontmatter, H1 하나, 안정 heading ID, NFC, 상대 자산과 alt text 검증 |
| PDF | 텍스트 의미 비교와 모든 페이지 렌더 시각 QA |
| DOCX | OOXML package·relationship, 의미 비교, 모든 페이지 렌더 시각 QA |
| PPTX | 청중·목적·슬라이드별 메시지가 있는 독립적인 스토리, overflow 검사, 모든 슬라이드 렌더 QA |

PPTX는 Markdown 제목을 기계적으로 나누지 않습니다. Preflight의 capability `unknown`, `available`, `unavailable`과 준비 status `not-requested`, `blocked`, `pending`, `unavailable`을 downstream terminal status와 섞지 않습니다. Terminal promotion은 trusted renderer와 QA 경계 밖에서 추측하거나 대리 입력으로 만들 수 없습니다.

## 권리, 개인정보와 공정성

- 포트폴리오의 게임 화면, 아트, 데이터, 인용문과 제3자 자료는 출처, 사용 목적, 권리 또는 인용 근거를 `assets/README.md`에 기록합니다.
- 지원자·동료·면접관의 이름, 연락처, 비공개 회사 자료, NDA 정보와 개인 식별 정보는 필요한 최소 범위만 사용하고 공개 산출물에서는 제거하거나 비식별화합니다.
- 팀 결과와 개인 기여를 분리합니다. 승인받지 않은 내부 수치, 소유권, 구현 또는 성과를 추정하지 않습니다.
- 민감 특성이나 대리 변수를 근거로 적합성, 우선순위, 채용 가능성을 판단하지 않습니다.
- 법률·노무·저작권 판단은 제공하지 않습니다. 공개·배포 전 권리 보유자, 회사 정책과 필요한 전문가 검토를 확인하십시오.

## 제한 사항

- 플러그인은 채용, 합격, 승진, 연봉, 일정 또는 포트폴리오 평가 결과를 예측하거나 보장하지 않습니다.
- 채용 표본은 선택한 지역·시점·공고에 한정됩니다. 조사 결과는 전체 시장 통계가 아닙니다.
- 네이티브 역할 자동 발견과 병렬 서브에이전트 지원은 호스트에 따라 다릅니다. 순차 fallback은 동일 질문과 병합 순서를 유지합니다.
- PDF/DOCX/PPTX 생성과 PNG 렌더는 설치 환경의 renderer에 의존합니다. capability probe는 preflight 상태만 바꾸며 성공 증거가 아닙니다. Trusted downstream renderer·format/visual QA와 artifact digest 결합이 없으면 terminal 성공으로 표시하지 않습니다.
- 로컬 원문과 템플릿은 출발점이며, 시점 의존 사실을 대체하지 않습니다.

## 문제 해결

| 증상 | 확인 및 복구 |
| --- | --- |
| marketplace가 보이지 않음 | `codex plugin marketplace list`로 `game-design-suite`와 루트를 확인하고, 저장소 루트를 다시 등록합니다. |
| 업데이트가 반영되지 않음 | 올바른 로컬 marketplace가 설치되어 있는지 `codex plugin list`로 확인하고, cachebuster 갱신 후 재설치한 다음 새 작업을 시작합니다. |
| 현재 채용 주장을 만들 수 없음 | 공식 공고 URL, 게시일, 검색일, 지역을 제공하거나 조사 범위를 좁힙니다. 근거가 없으면 검증 과제로 남깁니다. |
| PNG가 생성되지 않음 | SVG lint 결과를 보존하고 Chromium probe 실패 근거를 기록합니다. SVG만 전달하고 PNG 검증을 주장하지 않습니다. |
| 내보내기가 `blocked`임 | Canonical validation과 형식별 capability evidence를 확인합니다. renderer가 준비되면 같은 preflight manifest를 trusted downstream 생성·QA 단계로 넘기고, 검증된 terminal 결과는 별도 증거로 기록합니다. |
| 포트폴리오 점수가 비어 있음 | 해당 축의 section/evidence ID가 관찰 가능한지 확인합니다. 미관이나 서술만으로 점수를 채우지 않습니다. |

## 검증

저장소 루트에서 다음 계약을 실행합니다.

```bash
node --test tests/products/career/readme.test.mjs
node --test tests/products/career/*.test.mjs tests/e2e/career/*.test.mjs
```

10개 source skill의 공식 구조를 확인합니다.

```bash
find products/game-design-career/plugin/skills -name SKILL.md -print0 | xargs -0 -n1 dirname | while read skill_dir; do python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"; done
```

source plugin manifest를 확인합니다.

```bash
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py products/game-design-career/plugin
```

절대 경로가 포함된 두 검증 예시는 이 저장소를 만든 로컬 개발 환경의 설치 위치를 사용합니다. 다른 환경에서는 설치된 `skill-creator`와 `plugin-creator`의 실제 경로로 바꾸십시오. 배포 스냅샷 생성·독립 설치 smoke와 전체 형식 렌더 검증은 suite 통합 검증에서 실행합니다.

## 라이선스

Game Design Career 자체는 [MIT License](LICENSE)로 배포됩니다. 포함된 Skillstead `svg-infographic` 0.8.3은 Apache-2.0이며 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 패키지 안의 원본 라이선스가 적용됩니다. 프로젝트 제공 원문과 제3자 자료의 권리는 각각의 권리자에게 남습니다.
