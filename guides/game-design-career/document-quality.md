# Career 문서 품질 기준

Game Design Career는 기준 결과물마다 기본 품질 프로필 하나를 선택합니다. 품질 프로필은 내용을 대신 작성하거나 채용 결정을 내리지 않습니다. 필요한 섹션, 표, Skillstead 도식, 이미지, 승인 기준과 내보내기 범위를 정합니다.

## 선택 계약

필수 입력은 `goal`, `audience`, `artifact type`, `requested format`입니다. 호환되는 템플릿인지 확인한 뒤 결과물 유형, 형식, 독자와 목표가 얼마나 맞는지 비교합니다. 마지막 동점은 프로필 ID의 사전순으로 결정합니다. 등록되지 않은 `override`는 선택하지 않고 가장 가까운 ID와 차이만 보여 줍니다. 이때는 호환되는 대체 항목을 명시해야 합니다.

- 기본 프로필은 결과물마다 정확히 하나입니다.
- 서로 호환되지 않는 결과물은 선택 기록을 따로 남깁니다.
- 설치된 플러그인의 기준 색인은 `references/shared/document-quality/indexes/career.json`, 템플릿 매핑은 `references/document-quality/template-profile-map.json`입니다. 저장소의 `shared/document-quality/indexes/career.json`은 제작 원본이므로 설치 사용자가 참조할 경로로 안내하지 않습니다.
- 추가 조건은 `mobile`, `live-service`, `pc-console`이며 중립 프리셋은 최대 하나만 적용합니다. 기존 근거·권리·담당자 승인 조건은 삭제할 수 없습니다.

## Career 품질 프로필 13개

| 프로필 ID | 결과물·독자 | 필수 형식 | 핵심 항목 |
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

PPTX가 허용되지 않은 프로필에는 기계적으로 발표 자료를 덧붙이지 않습니다. `recruiter-portfolio-presentation`만 독립적인 발표 구성을 요구합니다.

## 경력 단계 4개

| 단계 | 진단 신호 | 기본 결과 | 증거 초점 |
| --- | --- | --- | --- |
| `entry` | 탐색 중이며 target level이 없음 | `career-stage-goal` | 관심·제약·현재 artifact에서 첫 observable evidence로 연결 |
| `new-hire` | 신입·첫 게임 기획 역할 | `portfolio-project-brief` | current posting requirement와 portfolio proof 연결 |
| `junior-growth` | 현 직무의 project impact·성장 기록 | `junior-growth-review` | project event, feedback, quarterly proof artifact |
| `transition` | 이직·직무 전환·새 회사 목표 | `transition-readiness` | fresh target requirement와 current evidence gap |

경력 단계나 목표 직무가 불명확하면 `unclear`로 두고 `game-design-role-map`에 여러 임시 경로를 남깁니다. 하나뿐인 정답 진로나 합격을 보장하지 않습니다.

## 근거와 공통 항목

모든 템플릿에는 목표 직무, 목표 수준과 현재 근거를 명시합니다. 현재 회사·채용 공고·도구에 관한 주장에는 원문 URL 또는 위치, 검색일, 원문 날짜, 지역, 표본, 재검토일과 갱신 담당자를 기록합니다. 사실, 지원자 진술, 추론과 제안을 나누고 회사·지역 범위를 표본 밖으로 일반화하지 않습니다.

개인정보, 회사 비공개 자료와 제3자 자산에는 개인정보 보호, 공정성, 출처 표시, 사용 목적, 권리·동의, 공개 담당자와 철회 조건을 기록합니다. 나이·학력·전공·배경·고용 공백·명성으로 적합성을 순위화하지 않습니다.

## 확인 목록과 승인 상태

필수 섹션·표·도식·이미지·승인 기준은 안정된 ID가 있는 확인 목록과 명세 다이제스트에 묶입니다. Skillstead 도식 자리는 렌더링 품질 검사를 마치기 전까지 `unverified` 상태입니다.

```text
draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved
```

외부 결과물 검사, 근거 검토, 렌더링·권리 품질 검사와 식별 가능한 담당자의 승인 기록이 같은 결과물 다이제스트에 묶여야 다음 상태로 넘어갑니다. 생성 이미지, 렌더링 파일, 요청한 도식과 자체 확인만으로는 자동 승인되지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Career reverse-design-document와 recruiter-portfolio-presentation을 별도 결과물로 선택해 줘. 프로필별 필수 항목, 허용 형식, 근거 최신성, 개인정보 보호·공정성과 담당자 승인 확인 목록을 보여 줘.
```
