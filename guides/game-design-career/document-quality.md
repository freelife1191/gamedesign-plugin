# Career 문서 품질 profile

Game Design Career는 canonical artifact마다 primary profile 하나를 선택합니다. profile은 내용을 쓰거나 채용 결정을 대신하지 않고 required section, table, Skillstead diagram, image, acceptance criterion과 export boundary를 고정합니다.

## 선택 계약

필수 입력은 goal, audience, artifact type, requested format입니다. compatible template match 뒤 artifact type, format, audience overlap, goal overlap을 비교하고 마지막 동점은 profile ID lexical order로 해결합니다. unknown override는 nearest ID와 차이를 보여 줄 뿐 선택하지 않으며, known compatible fallback을 명시해야 합니다.

- primary profile은 artifact당 정확히 하나입니다.
- 비호환 deliverable은 separate selection record를 씁니다.
- 설치된 플러그인 안의 canonical index는 `references/shared/document-quality/indexes/career.json`이고, template map은 `references/document-quality/template-profile-map.json`입니다. 저장소의 `shared/document-quality/indexes/career.json`은 authoring source이므로 설치 사용자 경로로 부르지 않습니다.
- additive overlay는 `mobile`, `live-service`, `pc-console`, neutral preset은 최대 하나이며 기존 evidence·rights·human gate를 삭제할 수 없습니다.

## 13개 Career profile

| Profile ID | Artifact / audience | Required format | 핵심 slot |
| --- | --- | --- | --- |
| `career-stage-role-map` | career document / learner·mentor·career coach | MD, PDF | current stage, role paths, role table, role roadmap diagram, work-context image |
| `competency-matrix` | career document / learner·mentor·hiring manager | MD, PDF | competency model, evidence assessment, competency-evidence table, dependency diagram, proof image |
| `game-analysis-report` | review report / portfolio reviewer·designer·mentor | MD, PDF | analysis question/findings, finding table, analysis flow, evidence image |
| `interview-question-answer-report` | review report / candidate·mentor·interview coach | MD, PDF | interview context, answer review, answer table/structure, proof image |
| `job-posting-evidence` | review report / job seeker·career coach | MD, PDF | source scope, requirement evidence, requirement table/dependency, posting image |
| `junior-growth-review` | review report / junior·mentor·manager | MD, PDF | growth period/assessment, evidence table, growth roadmap, work sample |
| `learning-roadmap` | career document / learner·mentor | MD, PDF | learning goal/plan, milestone table, roadmap diagram, learning output image |
| `portfolio-case-study` | career document / recruiter·hiring manager·peer reviewer | MD, PDF | case context/evidence, decision-evidence table, process diagram, proof image |
| `portfolio-project-brief` | career document / candidate·mentor·portfolio reviewer | MD, PDF | project case/execution plan, deliverable table, dependency diagram, direction image |
| `portfolio-review-backlog` | review report / candidate·mentor·peer reviewer | MD, PDF | review baseline/backlog, backlog table, dependency diagram, review image |
| `recruiter-portfolio-presentation` | presentation / recruiter·hiring manager | PPTX, PDF | candidate fit/proof case, claim table, portfolio story diagram, hero proof image |
| `reverse-design-document` | career document / portfolio reviewer·designer·mentor | MD, PDF, DOCX | observed behavior/inferred design, inference table, system loop, evidence image |
| `transition-readiness` | review report / candidate·mentor·career coach | MD, PDF | transition target/readiness case, evidence table, roadmap dependency, proof image |

PPTX가 forbidden인 profile에는 mechanical presentation을 추가하지 않습니다. `recruiter-portfolio-presentation`만 독립적인 presentation story를 요구합니다.

## 4개 stage

| Stage | 진단 신호 | 기본 output | 증거 초점 |
| --- | --- | --- | --- |
| `entry` | 탐색 중이며 target level이 없음 | `career-stage-goal` | 관심·제약·현재 artifact에서 첫 observable evidence로 연결 |
| `new-hire` | 신입·첫 게임 기획 역할 | `portfolio-project-brief` | current posting requirement와 portfolio proof 연결 |
| `junior-growth` | 현 직무의 project impact·성장 기록 | `junior-growth-review` | project event, feedback, quarterly proof artifact |
| `transition` | 이직·직무 전환·새 회사 목표 | `transition-readiness` | fresh target requirement와 current evidence gap |

stage나 target role이 불명확하면 `unclear`로 두고 `game-design-role-map`의 multiple provisional paths를 사용합니다. 하나의 정답 진로나 합격을 보장하지 않습니다.

## Evidence와 공통 필드

모든 template은 target role, target level, current evidence를 명시합니다. current employer·posting·tool claim에는 source URL/location, 검색일, source date, 지역, 표본, review-after와 refresh owner를 기록합니다. 사실, candidate statement, 추론과 제안을 분리하고 employer·region scope를 표본 밖으로 일반화하지 않습니다.

개인정보, 회사 비공개 자료, 제3자 자산은 privacy, fairness, attribution, use purpose, rights/consent, publication owner와 revocation을 기록합니다. 나이·학력·전공·배경·고용 공백·prestige로 적합성을 순위화하지 않습니다.

## Checklist와 승인 상태

required section/table/diagram/image/acceptance criteria는 stable ID checklist와 manifest digest에 묶입니다. Skillstead slot은 renderer QA 전까지 unverified입니다.

```text
draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved
```

external artifact inspection, evidence audit, renderer/rights QA와 named-human receipt가 같은 artifact digest에 묶여야 상태가 전진합니다. generated image, rendered file, requested diagram과 self-attestation은 자동 승인이 아닙니다.

## 복사 가능한 요청문

```text
@Game Design Career reverse-design-document와 recruiter-portfolio-presentation을 별도 artifact로 선택해. profile별 required slot, allowed format, evidence freshness, privacy·fairness와 human approval checklist를 보여 줘.
```
