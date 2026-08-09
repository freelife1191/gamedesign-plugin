# Game Design Career 사용자 가이드

Game Design Career는 목표 역할과 경력 단계를 진단하고, 현재 채용 근거와 역량 격차를 학습·증거 프로젝트·포트폴리오·면접·성장 계획으로 연결합니다. 사실, 추론, 공백과 다음 검증 작업을 보존하는 Canonical Artifact(기준 작업 폴더)를 사용하며, 합격이나 한 가지 정답 진로를 약속하지 않습니다. [공통 용어](../README.md#용어)를 먼저 확인하세요.

## 사례 탐색 경로

취업 준비 학생, 주니어, 직무 전환자와 과제·피드백을 설계하는 멘토는 현재 근거와 다음 작은 증거 작업에 맞춰 아래 네 문서에서 시작합니다. 한 문서는 선택 색인, 나머지 세 문서는 역량·대상·직접 실행의 관점을 각각 제공합니다.

| 대상 사용자 | 탐색 문서 | 시작점 |
| --- | --- | --- |
| 모든 Career 사용자 | 사용 사례 색인 | [사용 사례 색인](use-cases/README.md#역량대상직접-스킬-선택) |
| 역량을 비교하는 사용자 | 역량 사례 | [역량 사례](use-cases/competency-paths.md#ca-c01-기획-직무와-전문-분야-탐색) |
| 역할 맥락을 고르는 사용자 | 대상 사례 | [대상 사례](use-cases/concept-scenarios.md#ca-t01-시스템-기획-입문-학생) |
| 입력과 결과가 확정된 사용자 | 직접 스킬 작업대 | [직접 스킬 작업대](use-cases/skill-workbench.md#역할근거-lane) |

### 목표별 결과와 다음 문서

| 목표 | 예상 결과 | 상세 문서 |
| --- | --- | --- |
| 직무 탐색 | 목표 역할, 현재 근거와 역량 gap | [역할·학습 로드맵](recipes/role-learning-roadmap.md) |
| 역기획 | 공개 관찰과 추론을 분리한 분석 근거 | [관찰 기반 역기획](recipes/reverse-design.md) |
| 포트폴리오 | 개인 기여·권리 경계가 남은 evidence 프로젝트 | [portfolio 구축·검토](recipes/portfolio-build-review.md) |
| 면접 | 근거 연결 질문·답변과 다음 proof task | [근거 연결 면접 연습](recipes/interview-preparation.md) |
| 성장 | 학습 로드맵과 재검토할 증거 작업 | [주니어 성장·전환](recipes/junior-growth-transition.md) |

## 상세 참조

| 문서 | 용도 |
| --- | --- |
| [Career 활용 사례 인덱스](use-cases/README.md) | 직무·대상·직접 스킬 중 현재 목표의 출발점을 고름 |
| [Career FAQ](faq.md) | 요청문·읽는 순서·재개 경로 |
| [공통 결과물 카탈로그](../use-cases/output-catalog.md) | 원본·선택 자산·파생 형식과 사람 검토 |

Career에는 18개 사례, 15개 직접 스킬, 18개 FAQ와 33개 도식 쌍이 있습니다. 도식은 사례나 직접 호출의 입력·검토·결과 흐름을 설명할 뿐, 결과의 품질·합격·채용을 보장하지 않습니다.

## 대표 사례

각 행의 전체 스킬 경로는 canonical 사례의 순서를 모두 보존합니다. 명시적 직접 요청은 그 경로를 축약하지 않는 시작 명령 하나이며, 입력과 결과는 해당 사례 카드의 원문을 따릅니다.

| 사례 ID · 제목 · 대상 | 정확한 준비 입력 | 전체 스킬 경로 | 명시적 직접 요청 | 결과 ID · owner · root | 사례 읽는 순서 |
| --- | --- | --- | --- | --- | --- |
| `CA-T01` — 시스템 기획 입문 학생 — AUD-01 · AUD-02 | 공개적으로 관찰 가능한 기능 하나, 입력과 결과, 모르는 규칙, 개인 작업 범위와 시스템 기획 멘토를 준비합니다. | $game-design-career:map-game-design-career → $game-design-career:build-game-design-portfolio → $game-design-career:plan-junior-growth | $game-design-career:map-game-design-career artifact=game-design-career/system-student 규칙·상태·예외를 competency-matrix와 learning-roadmap으로 연결해. | `competency-matrix` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/competency-matrix`<br>`learning-roadmap` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/learning-roadmap` | 상태표 → 규칙표 → 반례 → 다음 질문 |
| `CA-T04` — 경제·밸런스·LiveOps 준비생 — AUD-01 · AUD-02 | 공개적으로 보이는 재화 흐름, source·sink 가정, 이벤트 목적, guardrail, rollback과 검토자를 준비합니다. | $game-design-career:reverse-engineer-game-design → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:reverse-engineer-game-design artifact=game-design-career/economy-prep 공개 관찰을 source, sink와 가설로 분리한 game-analysis-report로 정리해. | `portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`five-axis-review` ($game-design-career:review-game-design-portfolio) → `game-design-career/<career-id>/five-axis-review` | source·sink → 가설 → guardrail → rollback |
| `CA-T05` — UI·UX 기획 준비생 — AUD-01 · AUD-02 | 공개 화면, 주요 행동, 오류 상태, focus 순서, 대체 입력 가정과 UX·접근성 검토자를 준비합니다. | $game-design-career:map-game-design-career → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:build-game-design-portfolio artifact=game-design-career/uiux-prep 온보딩 한 장면의 오류와 대체 입력을 portfolio-project-brief로 작성해. | `competency-matrix` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/competency-matrix`<br>`portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`five-axis-review` ($game-design-career:review-game-design-portfolio) → `game-design-career/<career-id>/five-axis-review` | 행동 → 오류 → focus → 대체 입력 |
| `CA-C05` — 관찰 기반 역기획 — AUD-01 · AUD-02 · AUD-03 · AUD-04 · AUD-05 | - 최소 입력: 공개 location, `evidence ID`, 관찰 범위, 개인 기여 경계, 공개·권리 검토자.<br>- 선택 입력: version, timestamp, counterexample, 재관찰 날짜. | $game-design-career:apply-document-quality-profile → $game-design-career:reverse-engineer-game-design → $game-design-career:export-career-documents | $game-design-career:reverse-engineer-game-design artifact=game-design-career/reverse-design EVID-RD-01 관찰을 보존하고 reverse-design-document를 작성해. | `reverse-design-document` ($game-design-career:reverse-engineer-game-design) → `game-design-career/<career-id>/reverse-design-document` | observation evidence ID → inference → proposal → 개인 기여 → public-rights review |
| `CA-C06` — 창작 기획 포트폴리오 — AUD-02 · AUD-03 · AUD-04 · AUD-05 · AUD-06 | - 최소 입력: 문제, 설계 제약, `evidence ID`, 실제 개인 기여, public-rights review owner.<br>- 선택 입력: feedback, prototype 관찰, 기각한 대안, 공개 목표. | $game-design-career:apply-document-quality-profile → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:build-game-design-portfolio artifact=game-design-career/creative-case EVID-CP-01과 개인 기여 경계를 보존해 creative-design-portfolio를 작성해. | `portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`creative-design-portfolio` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/creative-design-portfolio` | evidence ID → observation → inference → proposal → 개인 기여 → public-rights review |
| `CA-C08` — 면접·주니어 성장·직무 전환 — AUD-03 · AUD-05 · AUD-06 | - 최소 입력: posting 또는 portfolio `evidence ID`, 개인 기여 경계, feedback owner, public-rights review owner.<br>- 선택 입력: target role, reviewAfter, 실험할 proof task, 공개 가능 여부. | $game-design-career:practice-game-design-interview → $game-design-career:plan-junior-growth → $game-design-career:visualize-career-roadmap → $game-design-career:export-career-documents | $game-design-career:practice-game-design-interview artifact=game-design-career/growth-transition EVID-GR-01을 보존하고 interview-question-answer-log와 다음 proof task를 연결해. | `interview-question-answer-log` ($game-design-career:practice-game-design-interview) → `game-design-career/<career-id>/interview-question-answer-log`<br>`junior-growth-review` ($game-design-career:plan-junior-growth) → `game-design-career/<career-id>/junior-growth-review`<br>`transition-readiness` ($game-design-career:plan-junior-growth) → `game-design-career/<career-id>/transition-readiness` | evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → feedback |

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
