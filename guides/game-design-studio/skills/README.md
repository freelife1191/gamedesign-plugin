# Game Design Studio 스킬 레퍼런스

설치된 Studio 제품 스킬 15개와 공통 스킬 8개를 합친 설치 스킬 23개를 정리합니다. 공통 스킬은 Archify, humanize-korean, Skillstead, 프로젝트 기억 스킬 3개와 레퍼런스 분석·용어 사전 스킬 2개입니다. 복합 요청은 오케스트레이터로 시작하고, 목적이 한 영역으로 분명하면 해당 스킬을 직접 호출합니다.

## 활용 경로

한 작업의 입력과 원하는 결과가 분명하면 아래 표의 해당 스킬을 직접 호출합니다. 복수 영역이 얽히거나 범위가 불명확하면 `$game-design-studio:orchestrate-game-design-project`로 시작하고, route가 정해진 뒤 전문 스킬을 호출합니다.

| 상황 | 시작점 | 다음 읽기 |
| --- | --- | --- |
| 현업 기획자의 단일 system·UX·content·economy 작업 | 아래 스킬 표의 직접 호출 | [스킬 워크벤치](../use-cases/skill-workbench.md)의 입력·결과·handoff |
| 기획 입문 학생·솔로·인디 개발자의 학습 또는 scope 비교 | [Studio 활용 사례 인덱스](../use-cases/README.md) | 역량·콘셉트 사례와 [Studio FAQ](../faq.md) |
| 팀 리드·교육자·멘토의 여러 영역 검토 | `orchestrate-game-design-project` | [공통 결과물 카탈로그](../../use-cases/output-catalog.md)의 읽는 순서와 사람 gate |

| 스킬 ID | 목적 | 직접 호출 | 주 템플릿 | 일반 입력 | 일반 결과 |
| --- | --- | --- | --- | --- | --- |
| [`apply-document-quality-profile`](apply-document-quality-profile.md) | 산출물에 결정적 품질 계약 적용 | `$game-design-studio:apply-document-quality-profile` | 요청에 맞는 설치 템플릿 | 목표, 청중, artifact 유형, 형식 | 선택 기록, checklist, requirement manifest |
| [`analyze-game-design-references`](../reference-analysis.md) | 경쟁작 관찰을 시스템 비교와 검토 대기 설계 전환 제안으로 정리 | `$game-design-studio:analyze-game-design-references` | 레퍼런스 분석 | 결정 질문, 관찰 근거, 프로젝트 제약 | 시스템 지도, 심층 분석, `pending-review` 제안 |
| [`archify`](archify.md) | 구조와 흐름을 탐색 가능한 HTML로 설명 | `$game-design-studio:archify` | 선택된 canonical artifact | 구성 요소, 관계, 독자 | JSON 원본, HTML, 검증 영수증 |
| [`capture-game-design-memory`](../memory.md#기본-작업-흐름) | 검증한 Studio 교훈을 후보로 기록 | `$game-design-studio:capture-game-design-memory` | 프로젝트 기억 | 출처가 연결된 결과, 적용·제외 조건 | 검토 대기 후보와 기록 결과 |
| [`define-game-vision`](define-game-vision.md) | 플레이어 약속과 검증 가능한 비전 정의 | `$game-design-studio:define-game-vision` | `vision-pillars` | 대상 플레이어, 핵심 재미, 제약 | pillar, loop, 성공 기준 |
| [`design-game-content`](design-game-content.md) | 퀘스트·NPC·전투 콘텐츠 명세 | `$game-design-studio:design-game-content` | `narrative-quest-npc` | 콘텐츠 목적, system/data ID, 생산 근거 | 플레이 가능한 콘텐츠 계약 |
| [`design-game-economy-and-liveops`](design-game-economy-and-liveops.md) | 경제 흐름과 안전한 LiveOps 실험 설계 | `$game-design-studio:design-game-economy-and-liveops` | `economy-balance` | 통화, source/sink, 실험·보호 근거 | 경제 명세 또는 실험 계획 |
| [`design-game-systems`](design-game-systems.md) | 규칙·상태·예외·데이터 명세 | `$game-design-studio:design-game-systems` | `system-specification` | 규칙, 상태, 권위 데이터, 실패 기대 | 구현 가능한 시스템 계약 |
| [`design-player-experience`](design-player-experience.md) | 첫 세션·UI state·접근성 설계 | `$game-design-studio:design-player-experience` | `ui-ux-flow-state` | critical action, 플랫폼, 입력, 측정값 | 상호작용과 접근성 계약 |
| [`export-game-design-documents`](export-game-design-documents.md) | 승인 가능한 원본의 다중 형식 작업 준비 | `$game-design-studio:export-game-design-documents` | 선택된 canonical artifact | artifact, 형식, capability, 발표 story | renderer-neutral 준비 manifest |
| [`generate-image-assets`](generate-image-assets.md) | 선택된 stable asset ID만 provider에 라우팅 | `$game-design-studio:generate-image-assets` | 선택된 canonical artifact | image manifest, prompt, mode, 선택 receipt | generation 결과와 검토 handoff |
| [`humanize-korean`](humanize-korean.md) | 뜻과 수치·ID를 보존한 한국어 문체 검토 | `$game-design-studio:humanize-korean` | 선택된 canonical artifact | 원문, 독자, 보호 항목 | 자연스러운 수정안과 변경 요약 |
| [`maintain-game-design-memory`](../memory.md#후보-확인승인거부폐기-예시) | 후보 확인과 사람 승인·거부·폐기 | `$game-design-studio:maintain-game-design-memory` | 프로젝트 기억 | 기억 ID, 이름 있는 사람, 결정 이유 | 상태 변경 이력 또는 충돌 안내 |
| [`maintain-game-design-glossary`](../glossary.md) | 용어 후보와 승인된 스냅샷을 사람 검토로 관리 | `$game-design-studio:maintain-game-design-glossary` | 용어 사전 | 문서, 근거 ID, 사람 결정 | 후보, findings, 승인된 용어 스냅샷 |
| [`orchestrate-game-design-project`](orchestrate-game-design-project.md) | 복합 게임 기획의 전체 라우팅과 게이트 조정 | `$game-design-studio:orchestrate-game-design-project` | `game-design-brief` | 신규 모바일 협동 RPG 브리프 | 최소 스킬 체인과 Canonical Artifact |
| [`plan-game-production`](plan-game-production.md) | prototype·범위·owner·kill criteria 계획 | `$game-design-studio:plan-game-production` | `production-scope-risk` | 목표 경험, capacity, dependency, 근거 | 단계별 commit/defer/kill 계약 |
| [`plan-image-assets`](plan-image-assets.md) | profile-bound 이미지 manifest와 prompt 계획 | `$game-design-studio:plan-image-assets` | 선택된 canonical artifact | profile, slot, source ID, 수량 | manifest, prompt package, placeholder |
| [`polish-game-design-writing`](polish-game-design-writing.md) | 긴 기획 문장의 표현만 안전하게 윤문 | `$game-design-studio:polish-game-design-writing` | 선택된 canonical artifact | 원문, 용어집, 보호 항목 | 수정안, 변경 기록, 보호 확인표 |
| [`review-game-design`](review-game-design.md) | evidence와 launch blocker 중심 검토 | `$game-design-studio:review-game-design` | `game-design-review` | canonical artifact, 질문, owner | traceable finding과 최소 수정 |
| [`review-image-assets`](review-image-assets.md) | 이미지의 사람 승인 경계 기록 | `$game-design-studio:review-image-assets` | 선택된 canonical artifact | asset ID, 실제 사용자 결정, 권리 근거 | 승인 transition 또는 blocker |
| [`retrieve-approved-design-memory`](../memory.md#어떤-기록을-기억하는가) | 현재 작업과 관련된 승인 기록 조회 | `$game-design-studio:retrieve-approved-design-memory` | 프로젝트 기억 | 프로젝트 ID, Studio 요청 맥락 | 적용 가능한 기록과 제외 이유 |
| [`svg-infographic`](svg-infographic.md) | 고급 구조형 SVG authoring과 2× 렌더 | `$game-design-studio:svg-infographic` | 선택된 canonical artifact | 구조, 청중, 비율, 언어 | editable SVG와 검증된 PNG 또는 제한 |
| [`visualize-game-design`](visualize-game-design.md) | source-backed 게임 기획 구조 도식화 | `$game-design-studio:visualize-game-design` | 선택된 canonical artifact | stable source ID, 관계, acceptance | source-mapped SVG·PNG evidence |

## 선택 원칙

- 단일 영역이면 해당 스킬을 직접 호출합니다.
- 여러 영역이 섞이거나 범위가 불명확하면 `orchestrate-game-design-project`를 사용합니다.
- 문서 작성과 이미지 계획 전에 `apply-document-quality-profile`을 실행합니다.
- `visualize-game-design`이 preset과 source mapping을 먼저 고른 뒤 필요할 때 vendored `svg-infographic`을 사용합니다.
- `archify`는 관계를 자세히 탐색할 HTML이 필요할 때, `humanize-korean`과 `polish-game-design-writing`은 뜻을 바꾸지 않는 문장 검토가 필요할 때 사용합니다.
- 프로젝트 기억의 조회·후보 기록·상태 변경은 [Studio 프로젝트 기억](../memory.md)의 로컬 보관과 사람 승인 경계를 따릅니다.
- 생성, 렌더, reviewer 권고는 사람 승인을 대신하지 않습니다.
