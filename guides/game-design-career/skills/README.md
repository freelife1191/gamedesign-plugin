# Game Design Career 스킬 레퍼런스

설치된 Career 제품 스킬 14개와 vendored Skillstead `svg-infographic` 1개를 정리합니다. 단계나 목표 역할이 불명확하면 오케스트레이터로 시작하고, 산출물이 명확하면 해당 스킬을 직접 호출합니다.

| 스킬 ID | 목적 | 직접 호출 | 주 템플릿 | 일반 입력 | 일반 결과 |
| --- | --- | --- | --- | --- | --- |
| [`apply-document-quality-profile`](apply-document-quality-profile.md) | artifact별 품질 profile과 checklist 결정 | `$game-design-career:apply-document-quality-profile` | 요청에 맞는 설치 템플릿 | goal, audience, artifact type, format | selection record, checklist, manifest |
| [`build-game-design-portfolio`](build-game-design-portfolio.md) | 결정·실험·협업 증거를 case study로 구성 | `$game-design-career:build-game-design-portfolio` | `creative-design-portfolio` | 목표 역량, claim, 기여, evidence | case study와 claim-evidence index |
| [`export-career-documents`](export-career-documents.md) | Career 문서의 다중 형식 작업 준비 | `$game-design-career:export-career-documents` | 선택된 canonical artifact | artifact, MD/PDF/DOCX/PPTX, capability | renderer-neutral job manifest |
| [`generate-image-assets`](generate-image-assets.md) | mode와 사용자 선택에 맞는 이미지 생성 라우팅 | `$game-design-career:generate-image-assets` | 선택된 canonical artifact | manifest, prompt, mode, selection receipt | generation 결과와 review handoff |
| [`map-game-design-career`](map-game-design-career.md) | 역할군·목표 수준·역량 gap 비교 | `$game-design-career:map-game-design-career` | `game-design-role-map` | 현재 증거, 제약, 역할 후보 | provisional role paths와 증거 과제 |
| [`orchestrate-game-design-career`](orchestrate-game-design-career.md) | 단계 진단과 전체 Career workflow routing | `$game-design-career:orchestrate-game-design-career` | `career-stage-goal` | 목표, 단계, 보유 증거, 제약 | stage brief와 최소 skill chain |
| [`plan-image-assets`](plan-image-assets.md) | portfolio 이미지·diagram slot과 prompt package 계획 | `$game-design-career:plan-image-assets` | 선택된 canonical artifact | profile, source section, 수량, placement | manifest, prompt, placeholder |
| [`plan-junior-growth`](plan-junior-growth.md) | 분기 목표·증거 프로젝트·feedback cycle 계획 | `$game-design-career:plan-junior-growth` | `junior-growth-review` | target requirement, project event | goal records와 feedback calendar |
| [`practice-game-design-interview`](practice-game-design-interview.md) | 공고·portfolio 근거 기반 면접 연습 | `$game-design-career:practice-game-design-interview` | `interview-question-answer-log` | posting IDs, portfolio evidence IDs | 4종 질문과 answer feedback |
| [`research-game-design-jobs`](research-game-design-jobs.md) | 현재 공고의 required·preferred evidence 조사 | `$game-design-career:research-game-design-jobs` | `job-posting-evidence` | role, level, region, 검색일 | 검증된 posting collection과 gap |
| [`reverse-engineer-game-design`](reverse-engineer-game-design.md) | 관찰 기반 게임 역기획 | `$game-design-career:reverse-engineer-game-design` | `reverse-design-document` | build, platform, 관찰, source | 사실·추론 claim과 validation queue |
| [`review-game-design-portfolio`](review-game-design-portfolio.md) | recruiter 관점 5축 portfolio 검토 | `$game-design-career:review-game-design-portfolio` | `five-axis-review` | section/evidence IDs, review goal | finding, score, minimum repair backlog |
| [`review-image-assets`](review-image-assets.md) | 이미지 권리·가독성·placement 사람 승인 | `$game-design-career:review-image-assets` | 선택된 canonical artifact | asset ID, evidence, named reviewer | lifecycle transition 또는 blocker |
| [`svg-infographic`](svg-infographic.md) | Career 구조용 editable SVG와 정확한 2× PNG | `$game-design-career:svg-infographic` | 선택된 canonical artifact | 구조, audience, ratio, language | editable SVG와 검증 evidence |
| [`visualize-career-roadmap`](visualize-career-roadmap.md) | 역할·역량·학습 dependency 도식화 | `$game-design-career:visualize-career-roadmap` | 선택된 canonical artifact | stable source IDs, 관계, audience | source-mapped SVG/PNG state |

## 선택 원칙

- 단계·역할이 불명확하거나 여러 산출물이 연결되면 `orchestrate-game-design-career`를 사용합니다.
- 모든 canonical artifact는 작성·이미지 계획 전에 `apply-document-quality-profile`을 별도로 실행합니다.
- 현재 공고·회사·도구 claim은 `research-game-design-jobs`의 fresh primary evidence를 먼저 확보합니다.
- portfolio, 면접, 성장, transition 결과는 합격·승진·전환을 보장하지 않습니다.
- 생성·렌더·agent 권고는 이름 있는 사람의 권리·품질·공개 승인을 대신하지 않습니다.
