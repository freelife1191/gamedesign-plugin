# Game Design Career 사용자 가이드

Game Design Career는 목표 역할과 경력 단계를 진단하고, 현재 채용 근거와 역량 격차를 학습·증거 프로젝트·포트폴리오·면접·성장 계획으로 연결합니다. 사실, 추론, 공백과 다음 검증 작업을 보존하는 Canonical Artifact(기준 작업 폴더)를 사용하며, 합격이나 한 가지 정답 진로를 약속하지 않습니다. [공통 용어](../README.md#용어)를 먼저 확인하세요.

## 누구를 위한 가이드인가

이 가이드는 취업 준비 학생, 주니어, 직무 전환자와 과제·피드백을 설계하는 멘토가 자신의 현재 근거와 다음 작은 증거 작업을 고르는 데 사용합니다. 사용자는 하나의 고정 경로 대신 아래 네 탐색 문서를 오갈 수 있습니다.

- [역량 사례](use-cases/competency-paths.md): 관찰·추론, 공고 근거, 역기획, 포트폴리오, 면접·성장처럼 전이 가능한 역량에서 시작합니다.
- [대상 사례](use-cases/concept-scenarios.md): 시스템, 경제·밸런스·LiveOps, UI/UX 같은 일반 게임 기획 문제와 목표 직무별 증거 과제를 비교합니다.
- [직접 스킬 작업대](use-cases/skill-workbench.md): 입력과 산출물이 하나로 분명할 때 설치 스킬을 직접 선택합니다.
- [Career FAQ](faq.md): 자주 막히는 질문의 요청문·읽는 순서·재개 경로를 확인합니다.
- [공통 결과물 카탈로그](../use-cases/output-catalog.md): 원본, 선택 자산, 파생 형식과 사람 검토 지점을 구분합니다.

Career에는 18개 사례, 15개 직접 스킬, 18개 FAQ와 33개 도식 쌍이 있습니다. 도식은 사례나 직접 호출의 입력·검토·결과 흐름을 설명할 뿐, 결과의 품질·합격·채용을 보장하지 않습니다.

### CA-T01

**시스템 기획 입문 학생**은 현재 규칙·상태·예외를 설명할 수 있는 근거와 가능한 작은 과제를 입력으로 둡니다. `$game-design-career:map-game-design-career`로 역할·gap을 정리하고 `game-design-role-map`을 `game-design-career/<career-id>/game-design-role-map/`에 얻은 뒤 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 읽습니다.

### CA-T04

**경제·밸런스·LiveOps 준비생**은 공개 관찰, 가정과 검증하려는 반례를 입력으로 둡니다. `$game-design-career:reverse-engineer-game-design`은 `game-analysis-report`를 `game-design-career/<career-id>/game-analysis-report/`에 만들며, `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 가정과 검증 큐를 확인합니다.

### CA-T05

**UI/UX 기획 준비생**은 사용자 흐름, 오류·복구 관찰과 접근성 제약을 입력으로 둡니다. `$game-design-career:map-game-design-career`로 `competency-matrix`를 `game-design-career/<career-id>/competency-matrix/`에 만들고 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 gap과 proof task를 읽습니다.

### CA-C05

**관찰 기반 역기획**은 공개 build의 관찰, 출처와 반례를 입력으로 둡니다. `$game-design-career:apply-document-quality-profile`로 profile을 고른 뒤 `$game-design-career:reverse-engineer-game-design`으로 `reverse-design-document`를 `game-design-career/<career-id>/reverse-design-document/`에 만들고 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 사실·추론·검증 방법을 분리해 읽습니다.

### CA-C06

**창작 기획 포트폴리오**는 개인 기여, claim과 확인 가능한 evidence를 입력으로 둡니다. `$game-design-career:apply-document-quality-profile`로 profile을 고른 뒤 `$game-design-career:build-game-design-portfolio`로 `portfolio-project-brief`를 `game-design-career/<career-id>/portfolio-project-brief/`에 만들며, `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 공개 범위와 다음 검토를 읽습니다.

### CA-C08

**면접·주니어 성장·직무 전환**은 posting·portfolio evidence ID 또는 프로젝트 사건과 feedback을 입력으로 둡니다. `$game-design-career:practice-game-design-interview`로 `interview-question-answer-log`를 `game-design-career/<career-id>/interview-question-answer-log/`에 만들고 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 정직한 답변 패턴과 재검증 작업을 읽습니다.

## 처음 시작하기

1. [설치](installation.md)에서 App 또는 CLI 중 한 환경의 절차만 따라 설치합니다.
2. [5분 빠른 시작](quick-start.md)의 요청문 하나를 복사합니다.
3. [Canonical Artifact 템플릿](templates.md)에서 목적에 맞는 템플릿을 고르고, 필요하면 [스킬 레퍼런스](skills/README.md)의 연결된 스킬을 직접 호출합니다.
4. [목적별 레시피](#목적별-레시피) 하나를 선택합니다.
5. [전체 워크플로](workflow.md)에서 현재 경력 단계와 다음 증거 작업을 확인합니다.
6. [이미지 자산](image-assets.md)에서 proof image slot과 사람 승인 경계를 계획합니다.
7. [Career 시각화](visualization.md)에서 Skillstead SVG와 PNG 검증을 준비합니다.
8. [MD·PDF·DOCX·PPTX 내보내기](exports.md)에서 필요한 형식만 준비합니다.
9. 막히면 [문제 해결](troubleshooting.md)에서 보존된 결과로 재개합니다.

## 목적별 레시피

- [역할·학습 로드맵](recipes/role-learning-roadmap.md)
- [공고 조사·gap](recipes/job-research-gap.md)
- [관찰 기반 역기획](recipes/reverse-design.md)
- [portfolio 구축·검토](recipes/portfolio-build-review.md)
- [근거 연결 면접 연습](recipes/interview-preparation.md)
- [주니어 성장·전환](recipes/junior-growth-transition.md)

대표 도식:

- [![경력 단계 라우팅](../assets/game-design-career/career-stage-routing.png)](../assets/game-design-career/career-stage-routing.svg)
- [경력 단계 라우팅 SVG 열기](../assets/game-design-career/career-stage-routing.svg)
- [![역할 gap과 학습 로드맵](../assets/game-design-career/role-gap-learning-roadmap.png)](../assets/game-design-career/role-gap-learning-roadmap.svg)
- [역할 gap과 학습 로드맵 SVG 열기](../assets/game-design-career/role-gap-learning-roadmap.svg)

## 가이드 목차

현재 사용할 수 있는 진입 문서:

- [설치](installation.md)
- [5분 빠른 시작](quick-start.md)
- [전체 워크플로](workflow.md)
- [문제 해결](troubleshooting.md)

전체 제품 레퍼런스:

- [스킬 레퍼런스](skills/README.md)
- [역량 사례](use-cases/competency-paths.md)
- [대상 사례](use-cases/concept-scenarios.md)
- [직접 스킬 작업대](use-cases/skill-workbench.md)
- [Career FAQ](faq.md)
- [공통 결과물 카탈로그](../use-cases/output-catalog.md)
- [Canonical Artifact 템플릿](templates.md)
- [문서 품질 profile](document-quality.md)
- [이미지 자산](image-assets.md)
- [Career 시각화](visualization.md)
- [MD·PDF·DOCX·PPTX 내보내기](exports.md)

목적별 레시피의 안정 경로는 `recipes/`입니다. 각 레시피는 current evidence의 출처·검색일·지역·표본 경계·재검색 시점을 보존하며, 생성·렌더 결과와 사람 승인을 분리합니다.

각 스킬 ID는 [스킬 레퍼런스](skills/README.md)에서 해당 상세 가이드로 직접 연결됩니다. 각 템플릿의 용도와 복사 가능한 요청문은 [Canonical Artifact 템플릿](templates.md)에 있습니다.

## 작업 원칙

- 개인정보, 회사 비공개 자료와 제3자 저작물을 입력하기 전에 사용 권한과 공유 범위를 확인합니다.
- 현재 채용·회사·도구 사실은 날짜와 출처를 기록하고, 관찰과 추론을 구분합니다.
- 경험과 성과를 발명하지 않습니다. 없는 증거는 gap과 다음 프로젝트로 남깁니다.
- 생성 이미지와 렌더 결과는 자동 승인되지 않습니다. 권리와 품질을 확인한 이름 있는 사람의 결정이 필요합니다.
