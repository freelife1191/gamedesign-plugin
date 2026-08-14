# Game Design Career 스킬 레퍼런스

설치된 Career 제품 스킬 15개와 공통 스킬 8개를 합친 설치 스킬 23개를 정리합니다. 공통 스킬은 Archify, humanize-korean, Skillstead, 프로젝트 기억 스킬 3개와 레퍼런스 분석·용어 사전 스킬 2개입니다. 단계나 목표 역할이 불명확하면 오케스트레이터로 시작하고, 산출물이 명확하면 해당 스킬을 직접 호출합니다.

## 오케스트레이터와 직접 호출

여러 Career 단계와 산출물, 우선순위 또는 completion gate가 함께 남으면 `$game-design-career:orchestrate-game-design-career`로 stage brief와 가장 작은 skill chain을 먼저 만듭니다. 반대로 입력·한 가지 결과·읽는 순서가 분명하면 아래의 직접 스킬을 호출합니다. 사례의 전체 스킬 경로는 모든 순서형 단계를 뜻하고, 명시적 직접 요청은 그 경로의 시작 명령 하나이므로 둘을 혼동하지 않습니다. 직접 호출은 다른 증거·권리·사람 검토를 생략하지 않으며, route가 다시 섞일 때만 오케스트레이터로 돌아갑니다.

| 선택 | 사용할 때 | 결과를 먼저 읽는 순서 |
| --- | --- | --- |
| 오케스트레이터 | 여러 단계, 역할 또는 여러 산출물의 우선순위를 정해야 할 때 | `career-stage-goal`의 `content.md → evidence.yml → decisions/ → export-manifest.yml` |
| 직접 스킬 | 하나의 명확한 입력으로 한 결과를 만들거나 검토할 때 | 해당 Canonical Artifact의 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` |

| 스킬 ID | 목적 | 직접 호출 | 주 템플릿 | 일반 입력 | 일반 결과 |
| --- | --- | --- | --- | --- | --- |
| [`apply-document-quality-profile`](apply-document-quality-profile.md) | artifact별 품질 profile과 checklist 결정 | `$game-design-career:apply-document-quality-profile` | 요청에 맞는 설치 템플릿 | goal, audience, artifact type, format | selection record, checklist, manifest |
| [`analyze-game-design-references`](../reference-analysis.md) | 경쟁작 관찰을 포트폴리오 분석 근거와 검토 대기 설계 전환 제안으로 정리 | `$game-design-career:analyze-game-design-references` | 레퍼런스 분석 | 결정 질문, 관찰 근거, 개인 기여 경계 | 시스템 지도, 심층 분석, `pending-review` 제안 |
| [`archify`](archify.md) | 경력 경로와 작업 흐름을 탐색 가능한 HTML로 설명 | `$game-design-career:archify` | 선택된 canonical artifact | 근거, 관계, 독자 | JSON 원본, HTML, 검증 영수증 |
| [`capture-game-design-memory`](../memory.md#기본-작업-흐름) | 검증한 Career 교훈을 후보로 기록 | `$game-design-career:capture-game-design-memory` | 프로젝트 기억 | 출처가 연결된 결과, 적용·제외 조건 | 검토 대기 후보와 기록 결과 |
| [`build-game-design-portfolio`](build-game-design-portfolio.md) | 결정·실험·협업 증거를 case study로 구성 | `$game-design-career:build-game-design-portfolio` | `creative-design-portfolio` | 목표 역량, claim, 기여, evidence | case study와 claim-evidence index |
| [`export-career-documents`](export-career-documents.md) | Career 문서의 다중 형식 작업 준비 | `$game-design-career:export-career-documents` | 선택된 canonical artifact | artifact, MD/PDF/DOCX/PPTX, capability | renderer-neutral job manifest |
| [`generate-image-assets`](generate-image-assets.md) | mode와 사용자 선택에 맞는 이미지 생성 라우팅 | `$game-design-career:generate-image-assets` | 선택된 canonical artifact | manifest, prompt, mode, selection receipt | generation 결과와 review handoff |
| [`humanize-korean`](humanize-korean.md) | 증거·주장 경계를 보존한 한국어 문체 검토 | `$game-design-career:humanize-korean` | 선택된 canonical artifact | 원문, 독자, 보호 항목 | 자연스러운 수정안과 변경 요약 |
| [`maintain-game-design-memory`](../memory.md#후보-확인승인거부폐기-예시) | 후보 확인과 사람 승인·거부·폐기 | `$game-design-career:maintain-game-design-memory` | 프로젝트 기억 | 기억 ID, 이름 있는 사람, 결정 이유 | 상태 변경 이력 또는 충돌 안내 |
| [`maintain-game-design-glossary`](../glossary.md) | 용어 후보와 승인된 스냅샷을 사람 검토로 관리 | `$game-design-career:maintain-game-design-glossary` | 용어 사전 | 문서, 근거 ID, 사람 결정 | 후보, findings, 승인된 용어 스냅샷 |
| [`map-game-design-career`](map-game-design-career.md) | 역할군·목표 수준·역량 gap 비교 | `$game-design-career:map-game-design-career` | `game-design-role-map` | 현재 증거, 제약, 역할 후보 | provisional role paths와 증거 과제 |
| [`orchestrate-game-design-career`](orchestrate-game-design-career.md) | 단계 진단과 전체 Career workflow routing | `$game-design-career:orchestrate-game-design-career` | `career-stage-goal` | 목표, 단계, 보유 증거, 제약 | stage brief와 최소 skill chain |
| [`plan-image-assets`](plan-image-assets.md) | portfolio 이미지·diagram slot과 prompt package 계획 | `$game-design-career:plan-image-assets` | 선택된 canonical artifact | profile, source section, 수량, placement | manifest, prompt, placeholder |
| [`plan-junior-growth`](plan-junior-growth.md) | 분기 목표·증거 프로젝트·feedback cycle 계획 | `$game-design-career:plan-junior-growth` | `junior-growth-review` | target requirement, project event | goal records와 feedback calendar |
| [`polish-game-design-writing`](polish-game-design-writing.md) | 긴 커리어 문장의 표현만 안전하게 윤문 | `$game-design-career:polish-game-design-writing` | 선택된 canonical artifact | 원문, 증거 ID, 보호 항목 | 수정안, 변경 기록, 증거 확인표 |
| [`practice-game-design-interview`](practice-game-design-interview.md) | 공고·portfolio 근거 기반 면접 연습 | `$game-design-career:practice-game-design-interview` | `interview-question-answer-log` | posting IDs, portfolio evidence IDs | 4종 질문과 answer feedback |
| [`research-game-design-jobs`](research-game-design-jobs.md) | 현재 공고의 required·preferred evidence 조사 | `$game-design-career:research-game-design-jobs` | `job-posting-evidence` | role, level, region, 검색일 | 검증된 posting collection과 gap |
| [`reverse-engineer-game-design`](reverse-engineer-game-design.md) | 관찰 기반 게임 역기획 | `$game-design-career:reverse-engineer-game-design` | `reverse-design-document` | build, platform, 관찰, source | 사실·추론 claim과 validation queue |
| [`review-game-design-portfolio`](review-game-design-portfolio.md) | recruiter 관점 5축 portfolio 검토 | `$game-design-career:review-game-design-portfolio` | `five-axis-review` | section/evidence IDs, review goal | finding, score, minimum repair backlog |
| [`review-image-assets`](review-image-assets.md) | 이미지 권리·가독성·placement 사람 승인 | `$game-design-career:review-image-assets` | 선택된 canonical artifact | asset ID, evidence, named reviewer | lifecycle transition 또는 blocker |
| [`retrieve-approved-design-memory`](../memory.md#어떤-기록을-기억하는가) | 현재 작업과 관련된 승인 기록 조회 | `$game-design-career:retrieve-approved-design-memory` | 프로젝트 기억 | 프로젝트 ID, Career 요청 맥락 | 적용 가능한 기록과 제외 이유 |
| [`svg-infographic`](svg-infographic.md) | Career 구조용 editable SVG와 정확한 2× PNG | `$game-design-career:svg-infographic` | 선택된 canonical artifact | 구조, audience, ratio, language | editable SVG와 검증 evidence |
| [`visualize-career-roadmap`](visualize-career-roadmap.md) | 역할·역량·학습 dependency 도식화 | `$game-design-career:visualize-career-roadmap` | 선택된 canonical artifact | stable source IDs, 관계, audience | source-mapped SVG/PNG state |

## 선택 원칙

- 단계·역할이 불명확하거나 여러 산출물이 연결되면 `orchestrate-game-design-career`를 사용합니다.
- 모든 canonical artifact는 작성·이미지 계획 전에 `apply-document-quality-profile`을 별도로 실행합니다.
- 현재 공고·회사·도구 claim은 `research-game-design-jobs`의 fresh primary evidence를 먼저 확보합니다.
- portfolio, 면접, 성장, transition 결과는 합격·승진·전환을 보장하지 않습니다.
- `archify`는 관계를 자세히 탐색할 HTML이 필요할 때, `humanize-korean`과 `polish-game-design-writing`은 경험·증거를 바꾸지 않는 문장 검토가 필요할 때 사용합니다.
- 프로젝트 기억의 조회·후보 기록·상태 변경은 [Career 프로젝트 기억](../memory.md)의 로컬 보관과 사람 승인 경계를 따릅니다.
- 생성·렌더·agent 권고는 이름 있는 사람의 권리·품질·공개 승인을 대신하지 않습니다.
