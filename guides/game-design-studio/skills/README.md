# Game Design Studio 스킬 레퍼런스

설치된 14개 Studio 스킬과 vendored Skillstead 스킬 1개를 정리합니다. 복합 요청은 오케스트레이터로 시작하고, 목적이 한 영역으로 분명하면 해당 스킬을 직접 호출합니다.

| 스킬 ID | 목적 | 직접 호출 | 주 템플릿 | 일반 입력 | 일반 결과 |
| --- | --- | --- | --- | --- | --- |
| [`apply-document-quality-profile`](apply-document-quality-profile.md) | 산출물에 결정적 품질 계약 적용 | `$game-design-studio:apply-document-quality-profile` | 요청에 맞는 설치 템플릿 | 목표, 청중, artifact 유형, 형식 | 선택 기록, checklist, requirement manifest |
| [`define-game-vision`](define-game-vision.md) | 플레이어 약속과 검증 가능한 비전 정의 | `$game-design-studio:define-game-vision` | `vision-pillars` | 대상 플레이어, 핵심 재미, 제약 | pillar, loop, 성공 기준 |
| [`design-game-content`](design-game-content.md) | 퀘스트·NPC·전투 콘텐츠 명세 | `$game-design-studio:design-game-content` | `narrative-quest-npc` | 콘텐츠 목적, system/data ID, 생산 근거 | 플레이 가능한 콘텐츠 계약 |
| [`design-game-economy-and-liveops`](design-game-economy-and-liveops.md) | 경제 흐름과 안전한 LiveOps 실험 설계 | `$game-design-studio:design-game-economy-and-liveops` | `economy-balance` | 통화, source/sink, 실험·보호 근거 | 경제 명세 또는 실험 계획 |
| [`design-game-systems`](design-game-systems.md) | 규칙·상태·예외·데이터 명세 | `$game-design-studio:design-game-systems` | `system-specification` | 규칙, 상태, 권위 데이터, 실패 기대 | 구현 가능한 시스템 계약 |
| [`design-player-experience`](design-player-experience.md) | 첫 세션·UI state·접근성 설계 | `$game-design-studio:design-player-experience` | `ui-ux-flow-state` | critical action, 플랫폼, 입력, 측정값 | 상호작용과 접근성 계약 |
| [`export-game-design-documents`](export-game-design-documents.md) | 승인 가능한 원본의 다중 형식 작업 준비 | `$game-design-studio:export-game-design-documents` | 선택된 canonical artifact | artifact, 형식, capability, 발표 story | renderer-neutral 준비 manifest |
| [`generate-image-assets`](generate-image-assets.md) | 선택된 stable asset ID만 provider에 라우팅 | `$game-design-studio:generate-image-assets` | 선택된 canonical artifact | image manifest, prompt, mode, 선택 receipt | generation 결과와 검토 handoff |
| [`orchestrate-game-design-project`](orchestrate-game-design-project.md) | 복합 게임 기획의 전체 라우팅과 게이트 조정 | `$game-design-studio:orchestrate-game-design-project` | `game-design-brief` | 신규 모바일 협동 RPG 브리프 | 최소 스킬 체인과 Canonical Artifact |
| [`plan-game-production`](plan-game-production.md) | prototype·범위·owner·kill criteria 계획 | `$game-design-studio:plan-game-production` | `production-scope-risk` | 목표 경험, capacity, dependency, 근거 | 단계별 commit/defer/kill 계약 |
| [`plan-image-assets`](plan-image-assets.md) | profile-bound 이미지 manifest와 prompt 계획 | `$game-design-studio:plan-image-assets` | 선택된 canonical artifact | profile, slot, source ID, 수량 | manifest, prompt package, placeholder |
| [`review-game-design`](review-game-design.md) | evidence와 launch blocker 중심 검토 | `$game-design-studio:review-game-design` | `game-design-review` | canonical artifact, 질문, owner | traceable finding과 최소 수정 |
| [`review-image-assets`](review-image-assets.md) | 이미지의 사람 승인 경계 기록 | `$game-design-studio:review-image-assets` | 선택된 canonical artifact | asset ID, 실제 사용자 결정, 권리 근거 | 승인 transition 또는 blocker |
| [`svg-infographic`](svg-infographic.md) | 고급 구조형 SVG authoring과 2× 렌더 | `$game-design-studio:svg-infographic` | 선택된 canonical artifact | 구조, 청중, 비율, 언어 | editable SVG와 검증된 PNG 또는 제한 |
| [`visualize-game-design`](visualize-game-design.md) | source-backed 게임 기획 구조 도식화 | `$game-design-studio:visualize-game-design` | 선택된 canonical artifact | stable source ID, 관계, acceptance | source-mapped SVG·PNG evidence |

## 선택 원칙

- 단일 영역이면 해당 스킬을 직접 호출합니다.
- 여러 영역이 섞이거나 범위가 불명확하면 `orchestrate-game-design-project`를 사용합니다.
- 문서 작성과 이미지 계획 전에 `apply-document-quality-profile`을 실행합니다.
- `visualize-game-design`이 preset과 source mapping을 먼저 고른 뒤 필요할 때 vendored `svg-infographic`을 사용합니다.
- 생성, 렌더, reviewer 권고는 사람 승인을 대신하지 않습니다.
