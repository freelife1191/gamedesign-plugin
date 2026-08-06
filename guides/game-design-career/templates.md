# Career 템플릿 레퍼런스

설치된 플러그인에는 아래 Canonical Artifact seed가 들어 있습니다. `products/`는 편집 원본이고 `plugins/`는 build가 만든 snapshot이므로 설치 사용자 경로와 혼동하지 않습니다. 각 디렉터리는 `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, `assets/README.md`를 포함합니다.

| 템플릿 ID | Profile | 주 용도 |
| --- | --- | --- |
| `career-stage-goal` | `career-stage-role-map` | stage·target role·goal 진단 |
| `competency-matrix` | `competency-matrix` | target requirement와 current evidence gap 비교 |
| `creative-design-portfolio` | `portfolio-case-study` | inspectable portfolio case study |
| `five-axis-review` | `portfolio-review-backlog` | recruiter 관점 5축 review |
| `game-analysis-report` | `game-analysis-report` | 관찰 기반 game analysis |
| `game-design-role-map` | `career-stage-role-map` | multiple role paths와 tradeoff |
| `interview-question-answer-log` | `interview-question-answer-report` | posting·portfolio 근거 면접 연습 |
| `introduction-motivation` | `recruiter-portfolio-presentation` | recruiter용 동기·근거 story |
| `job-posting-evidence` | `job-posting-evidence` | fresh official posting collection |
| `junior-growth-review` | `junior-growth-review` | project event와 분기 성장 review |
| `learning-roadmap` | `learning-roadmap` | evidence-building task sequence |
| `portfolio-backlog` | `portfolio-review-backlog` | portfolio claim의 minimum repair |
| `portfolio-project-brief` | `portfolio-project-brief` | 목표 역량을 드러내는 evidence project |
| `reverse-design-document` | `reverse-design-document` | 사실·추론 분리 역기획 |
| `transition-readiness` | `transition-readiness` | target requirement와 transition evidence 비교 |

## 모든 템플릿의 공통 입력과 경계

- target role, target level, current evidence와 evidence gap을 명시합니다.
- 현재 공고·회사·도구 claim은 source URL/location, source date, 검색일, 지역, 표본, review-after와 refresh owner를 기록합니다.
- employer·region scope를 표본 밖으로 일반화하지 않고 사실, candidate statement, 추론과 제안을 분리합니다.
- 개인정보, 회사 비공개 자료와 제3자 자산은 privacy, fairness, attribution, use purpose, rights/consent, publication owner와 revocation을 기록합니다.
- 나이·학력·전공·배경·고용 공백·prestige로 role fit을 순위화하지 않으며 합격·승진·transition을 보장하지 않습니다.
- `evidence.yml`의 seed claim은 template structure만 설명합니다. project-specific evidence로 교체하기 전 candidate·portfolio·hiring claim을 승인하지 않습니다.

## career-stage-goal

- 좋은 적합: `entry|new-hire|junior-growth|transition` stage, target role, goal과 success evidence를 정렬. 나쁜 적합: 근거 없이 단일 진로를 확정하거나 채용 결과를 약속하는 작업.
- 필수 section/record: `Stage and Target Role`, `Goal Contract`; `stage`, `target-role`, `goal`, `success-evidence`, `owner`, `approval-status`, `review-date`.
- Evidence/approval: current artifact, available time, constraints와 desired output을 기록하고 불명확하면 provisional paths를 유지합니다.
- Profile/slot: `career-stage-role-map`; image `career-work-context-image`, diagram `skillstead-career-role-roadmap-diagram`.
- 설치 상대 경로: `assets/templates/career-stage-goal/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/career-stage-goal/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/career-stage-goal/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career career-stage-goal로 시스템 기획 입문자의 stage, target level, 보유 증거, 12주 goal과 사람 승인 지점을 정리해.`
- 예상 결과: route와 next evidence task가 분명한 Career Stage & Goal Brief.

## competency-matrix

- 좋은 적합: target requirement와 evidence strength, observation state, gap과 minimum repair 비교. 나쁜 적합: 활동량이나 자기평가만으로 competency level 확정.
- 필수 section/record: `Requirement Matrix`, `Repair and Re-evaluation`; `requirement-id`, `evidence-id`, `observation-state`, `target-level`, `gap`, `minimum-repair`, `owner`, `re-evaluation-date`.
- Evidence/approval: requirement source date·지역·표본과 current evidence address를 독립적으로 기록합니다.
- Profile/slot: `competency-matrix`; image `competency-proof-image`, diagram `skillstead-competency-dependency-diagram`.
- 설치 상대 경로: `assets/templates/competency-matrix/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/competency-matrix/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/competency-matrix/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career competency-matrix로 시스템 기획 신입 requirement와 내 evidence를 비교해 gap, minimum repair와 재검토 날짜를 기록해.`
- 예상 결과: 추측 등급 대신 evidence-addressable competency gap matrix.

## creative-design-portfolio

- 좋은 적합: design decision, test, collaboration과 result를 inspectable case study로 구성. 나쁜 적합: visual polish 또는 third-party work로 개인 기여를 암시.
- 필수 section/record: `Portfolio Story`, `Third-party and Publication Rights`; `claim-id`, `evidence-id`, `target-competency`, `third-party-source`, `attribution`, `rights`, `use-purpose`, `privacy`, `inspectability`.
- Evidence/approval: claim strength/status, 개인·팀 attribution, recovery action과 publication owner가 필요합니다.
- Profile/slot: `portfolio-case-study`; image `case-study-proof-image`, diagram `skillstead-case-study-process-diagram`.
- 설치 상대 경로: `assets/templates/creative-design-portfolio/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/creative-design-portfolio/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/creative-design-portfolio/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career creative-design-portfolio로 제작 시스템의 문제, 내 결정, 대안, 테스트와 결과를 evidence ID로 연결해.`
- 예상 결과: recruiter가 저자 설명 없이 핵심 역량을 검사할 수 있는 case study.

## five-axis-review

- 좋은 적합: problem framing, design reasoning, implementation specificity, evidence quality, communication inspectability 검토. 나쁜 적합: inaccessible evidence를 no-defect로 처리.
- 필수 section/record: `Review Records`, `Observation and Penalty Rules`; `finding-id`, `axis-id`, `section-id`, `evidence-id`, `observation-state`, `score`, `penalty`, `minimum-repair`.
- Evidence/approval: `not-observed|no-defect|defect-observed`를 분리하고 score는 inspectable section/evidence IDs에만 연결합니다.
- Profile/slot: `portfolio-review-backlog`; image `portfolio-review-image`, diagram `skillstead-portfolio-dependency-diagram`.
- 설치 상대 경로: `assets/templates/five-axis-review/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/five-axis-review/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/five-axis-review/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career five-axis-review로 이 portfolio의 5축 finding과 가장 작은 repair를 evidence ID에 연결해.`
- 예상 결과: 능력과 evidence completeness를 혼동하지 않는 prioritized review.

## game-analysis-report

- 좋은 적합: UI·rule·data·operation 관찰을 claim-level 분석으로 기록. 나쁜 적합: internal intent를 관찰 사실처럼 서술.
- 필수 section/record: `Analysis Claims`, `Decision Use`; `claim-id`, `observation`, `source-address`, `source-type`, `scope`, `inference`, `confidence`, `counterexample`, `alternative`, `validation-method`.
- Evidence/approval: 관찰이 없으면 inference null/confidence unassessed이며 source build·region·time scope를 보존합니다.
- Profile/slot: `game-analysis-report`; image `analysis-evidence-image`, diagram `skillstead-analysis-flow-diagram`.
- 설치 상대 경로: `assets/templates/game-analysis-report/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/game-analysis-report/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/game-analysis-report/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career game-analysis-report로 제작 UI의 관찰, 설계 추론, 반례, 대안과 검증 방법을 분리해.`
- 예상 결과: 의사결정에 사용할 수 있는 falsifiable analysis findings.

## game-design-role-map

- 좋은 적합: systems/content/economy/UX 등 role paths와 learning cost·tradeoff 비교. 나쁜 적합: background·prestige로 role fit 선언.
- 필수 section/record: `Role Families and Tradeoffs`, `Provisional Paths`; `role-family`, `current-evidence`, `target-level`, `gap`, `learning-task`, `feedback-cadence`, `proof-artifact`, `tradeoff`.
- Evidence/approval: 목표가 불명확하면 최소 두 path를 유지하고 current job claim은 fresh research에 연결합니다.
- Profile/slot: `career-stage-role-map`; image `career-work-context-image`, diagram `skillstead-career-role-roadmap-diagram`.
- 설치 상대 경로: `assets/templates/game-design-role-map/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/game-design-role-map/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/game-design-role-map/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career game-design-role-map으로 시스템·콘텐츠 기획 경로의 target level, gap, proof project와 tradeoff를 비교해.`
- 예상 결과: 작은 과제로 강화하거나 반증할 수 있는 provisional role paths.

## interview-question-answer-log

- 좋은 적합: target posting과 portfolio evidence로 질문·답변·feedback trace 작성. 나쁜 적합: posting 없이 회사별 요구나 candidate result 발명.
- 필수 section/record: `Question Set`, `Honest Answer Boundary`; `question-id`, `question-type`, `posting-evidence-id`, `portfolio-evidence-id`, `answer-status`, `honest-answer`, `verification-task`.
- Evidence/approval: base/follow-up/objection/situational 4종, grounded/role-general/blocked status와 verified result boundary가 필요합니다.
- Profile/slot: `interview-question-answer-report`; image `interview-proof-image`, diagram `skillstead-answer-structure-diagram`.
- 설치 상대 경로: `assets/templates/interview-question-answer-log/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/interview-question-answer-log/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/interview-question-answer-log/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career interview-question-answer-log로 공고 JP-12와 portfolio E-07 기반 4종 질문과 honest answer를 기록해.`
- 예상 결과: evidence gap을 숨기지 않는 면접 practice log.

## introduction-motivation

- 좋은 적합: target role과 motivation을 evidence-backed recruiter story로 구성. 나쁜 적합: 과장된 fit, private history 또는 unsupported impact를 발표에 사용.
- 필수 section/record: `Claim Map`, `Honest and Private Boundary`; `claim-id`, `evidence-id`, `target-role`, `motivation`, `honest-boundary`, `privacy`, `approval-status`.
- Evidence/approval: audience-specific independent story와 claim evidence, 공개 가능한 privacy 범위를 named owner가 승인합니다.
- Profile/slot: `recruiter-portfolio-presentation`; image `portfolio-hero-proof-image`, diagram `skillstead-portfolio-story-diagram`.
- 설치 상대 경로: `assets/templates/introduction-motivation/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/introduction-motivation/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/introduction-motivation/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career introduction-motivation으로 시스템 기획 target role, 동기와 검증 가능한 portfolio evidence만 recruiter story로 구성해.`
- 예상 결과: PDF/PPTX에 맞는 정직한 candidate-fit presentation seed.

## job-posting-evidence

- 좋은 적합: current official postings의 required/preferred와 repeated sample signal 조사. 나쁜 적합: stale·secondary·undated source를 current market 사실로 사용.
- 필수 section/record: `Posting Records`, `Freshness and Sample Limits`; `source-id`, `company`, `project`, `region`, `employment-type`, `posted-date`, `source-url`, `retrieval-date`, `source-type`, `sample-geography`, `freshness`.
- Evidence/approval: official HTTPS company source, `postedDate ≤ retrievalDate ≤ asOfDate ≤ reviewAfter`, sample size/geography와 blind spots가 필요합니다.
- Profile/slot: `job-posting-evidence`; image `posting-evidence-image`, diagram `skillstead-job-evidence-dependency-diagram`.
- 설치 상대 경로: `assets/templates/job-posting-evidence/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/job-posting-evidence/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/job-posting-evidence/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career job-posting-evidence로 한국 신입 시스템 기획 공식 공고의 검색일, 표본, required/preferred와 일반화 한계를 기록해.`
- 예상 결과: validator로 재현 가능한 dated posting evidence collection.

## junior-growth-review

- 좋은 적합: actual project events와 feedback을 quarterly goals에 연결. 나쁜 적합: 활동 count나 unverified plan을 promotion readiness로 사용.
- 필수 section/record: `Quarterly Evidence`, `Growth Commitments`; `requirement-id`, `project-event-evidence`, `goal`, `owner`, `cadence`, `reviewer`, `next-review-date`, `proof-artifact`.
- Evidence/approval: approved/provisional requirement status, personal/team attribution와 re-evaluation decision이 필요합니다.
- Profile/slot: `junior-growth-review`; image `growth-work-sample-image`, diagram `skillstead-growth-roadmap-diagram`.
- 설치 상대 경로: `assets/templates/junior-growth-review/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/junior-growth-review/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/junior-growth-review/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career junior-growth-review로 실제 project event와 feedback을 분기 goal, proof artifact와 격주 review에 연결해.`
- 예상 결과: 승진 보장이 아닌 observable growth evidence cycle.

## learning-roadmap

- 좋은 적합: gap을 prerequisite, observable task, cadence와 proof artifact로 배열. 나쁜 적합: source 없는 기간·순서·progress percentage를 확정.
- 필수 section/record: `Roadmap Commitments`, `Sequence and Dependencies`; `requirement-id`, `learning-task`, `owner`, `cadence`, `proof-artifact`, `reviewer`, `re-evaluation-date`.
- Evidence/approval: 각 task는 approved/provisional requirement와 review source에 연결하고 schedule assumption을 표시합니다.
- Profile/slot: `learning-roadmap`; image `learning-output-image`, diagram `skillstead-learning-roadmap-diagram`.
- 설치 상대 경로: `assets/templates/learning-roadmap/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/learning-roadmap/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/learning-roadmap/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career learning-roadmap으로 12주 시스템 기획 gap을 evidence project, mentor cadence와 proof artifact 순서로 바꿔.`
- 예상 결과: 읽기 목록이 아니라 검토 가능한 evidence-building roadmap.

## portfolio-backlog

- 좋은 적합: missing/weak portfolio claims의 smallest repair와 owner를 우선화. 나쁜 적합: 원본 claim·권리·privacy gap을 지우고 문장만 다듬는 작업.
- 필수 section/record: `Backlog Records`, `Minimum Repairs`; `backlog-id`, `claim-id`, `evidence-id`, `target-competency`, `attribution`, `rights`, `privacy`, `inspectability`, `minimum-repair`, `owner`.
- Evidence/approval: missing claim은 recovery action과 review gate를 가지며 publication owner가 close를 승인합니다.
- Profile/slot: `portfolio-review-backlog`; image `portfolio-review-image`, diagram `skillstead-portfolio-dependency-diagram`.
- 설치 상대 경로: `assets/templates/portfolio-backlog/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/portfolio-backlog/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/portfolio-backlog/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career portfolio-backlog로 source가 약한 claim의 evidence, attribution, rights와 minimum repair를 우선순위화해.`
- 예상 결과: 다음 review를 가능하게 하는 inspectability backlog.

## portfolio-project-brief

- 좋은 적합: target competency를 보여 줄 bounded project와 decision chain 계획. 나쁜 적합: 구현·test·result를 하기 전에 완료 성과로 서술.
- 필수 section/record: `Decision Chain`, `Publication Boundary`; `target-competency`, `problem-user`, `evidence`, `hypothesis-intent`, `rules-ui-data-content`, `constraints-alternatives`, `implementation-test`, `result-decision`, `retrospective`, `rights`.
- Evidence/approval: personal/team attribution, implementation status, source/use purpose, rights/privacy와 review gate가 필요합니다.
- Profile/slot: `portfolio-project-brief`; image `portfolio-direction-image`, diagram `skillstead-portfolio-roadmap-dependency-diagram`.
- 설치 상대 경로: `assets/templates/portfolio-project-brief/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/portfolio-project-brief/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/portfolio-project-brief/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career portfolio-project-brief로 시스템 기획 역량을 보여 줄 작은 제작 system project의 decision/test/evidence chain을 설계해.`
- 예상 결과: completion과 publication boundary가 있는 evidence project brief.

## reverse-design-document

- 좋은 적합: observed behavior와 design inference를 claim별로 분리. 나쁜 적합: zero evidence 상태에서 internal implementation과 intent를 확정.
- 필수 section/record: `Claim Records`, `Fact and Inference Boundary`; `claim-id`, `observation`, `source-address`, `scope`, `inference`, `confidence`, `counterexample`, `alternative`, `validation-method`.
- Evidence/approval: build/platform/account/region/time scope와 screenshot·third-party rights가 필요합니다.
- Profile/slot: `reverse-design-document`; image `reverse-design-evidence-image`, diagram `skillstead-reverse-system-loop-diagram`.
- 설치 상대 경로: `assets/templates/reverse-design-document/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/reverse-design-document/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/reverse-design-document/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career reverse-design-document로 제작 system 관찰과 가설을 나누고 반례·대안·검증 방법을 기록해.`
- 예상 결과: MD/PDF/DOCX로 검토할 수 있는 falsifiable 역기획서.

## transition-readiness

- 좋은 적합: fresh target-role requirement와 current evidence를 비교해 transition gap과 alternative path 결정. 나쁜 적합: 공고 표본만으로 readiness·hire probability를 점수화.
- 필수 section/record: `Readiness Matrix`, `Decision Options`; `target-requirement`, `current-evidence`, `posting-evidence-id`, `retrieval-date`, `region`, `gap`, `alternative`, `verification-task`.
- Evidence/approval: target level, employer/region scope, source type/freshness, minimum evidence, owner와 review date를 기록합니다.
- Profile/slot: `transition-readiness`; image `transition-proof-image`, diagram `skillstead-transition-roadmap-dependency-diagram`.
- 설치 상대 경로: `assets/templates/transition-readiness/` — 설치된 플러그인 안에서 찾는 경로입니다.
- 저장소 authoring source: `products/game-design-career/plugin/assets/templates/transition-readiness/` — 저장소 기여자가 편집하는 원본입니다.
- generated snapshot: `plugins/game-design-career/assets/templates/transition-readiness/` — build가 생성·검증하는 결과이며 직접 편집하지 않습니다.
- 복사 가능한 요청문: `@Game Design Career transition-readiness로 target systems role requirement와 내 current evidence를 비교해 gap, alternative와 verification task를 정리해.`
- 예상 결과: 합격 약속 없이 next evidence와 재평가 조건을 보여 주는 transition report.
