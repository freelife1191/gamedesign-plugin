# Game Design Studio

Game Design Studio는 게임 비전부터 시스템·콘텐츠·플레이어 경험·경제·LiveOps·프로덕션 설계, 전문 검토, 도식화, 문서 내보내기까지 하나의 검증 가능한 작업 흐름으로 연결하는 Codex 플러그인입니다. 그럴듯한 수치나 승인을 조작하지 않고 근거, 가정, 결정, 차단 조건을 Canonical Artifact에 남깁니다.

플러그인은 제품 스킬 10개, 이식 가능한 전문 역할 프롬프트 6개, Canonical Artifact 템플릿 15개, 1개 universal core와 3개 선택 프로필, Skillstead `svg-infographic` 0.8.3, MD/PDF/DOCX/PPTX 내보내기 계약을 하나의 독립 패키지에 포함합니다. 배포 스냅샷에는 vendored Skillstead를 합쳐 스킬이 11개입니다.

## 설치

요구 사항은 Codex CLI와 Node.js 18 이상입니다. 설치 대상은 release checkout의 `plugins/game-design-studio`이며, `products/game-design-studio/plugin`은 개발 원천입니다. suite build가 아직 실행되지 않은 개발 checkout에는 설치 가능한 스냅샷이 없을 수 있습니다.

### 로컬 저장소 marketplace 등록

저장소 루트에는 suite build가 관리하는 `.agents/plugins/marketplace.json`이 있어야 합니다. `<path-to-repository-root>`를 실제 저장소 루트로 바꿉니다.

```bash
codex plugin marketplace add <path-to-repository-root>
```

등록된 marketplace 이름과 플러그인을 확인합니다.

```bash
codex plugin marketplace list
codex plugin list
```

이 저장소의 marketplace 이름은 `game-design-suite`입니다.

### Studio 플러그인 설치

같은 marketplace의 Career 플러그인과 독립적으로 Studio만 설치합니다.

```bash
codex plugin add game-design-studio@game-design-suite
```

설치 후 새 Codex 작업을 시작해야 새 스킬과 hook이 확실히 로드됩니다. 현재 Codex CLI의 `plugin add`는 구성된 marketplace snapshot에서 설치하므로 `products/game-design-studio/plugin` 경로를 직접 인자로 전달하지 마십시오.

## 업데이트와 제거

Git marketplace로 등록한 경우 snapshot을 갱신하고 플러그인을 다시 설치합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin add game-design-studio@game-design-suite
```

로컬 저장소 marketplace는 Git fetch 대상이 아닙니다. 저장소를 갱신하고 suite build로 `plugins/game-design-studio`를 다시 만든 뒤, 설치된 snapshot을 명시적으로 제거하고 다시 추가합니다.

```bash
codex plugin remove game-design-studio@game-design-suite
codex plugin add game-design-studio@game-design-suite
```

플러그인 제거는 다음 명령만 실행합니다.

```bash
codex plugin remove game-design-studio@game-design-suite
```

두 제품을 모두 제거했고 marketplace도 더 이상 사용하지 않을 때만 marketplace 등록을 제거합니다.

```bash
codex plugin marketplace remove game-design-suite
```

## 플러그인 구조

저장소의 편집 원천, 공동 입력, 배포 결과는 분리되어 있습니다.

- `products/game-design-studio/plugin`은 Studio 전용 source overlay입니다. 제품 스킬, 역할, 프로필, methods, helper scripts, 템플릿과 이 문서를 여기서 편집합니다.
- `shared/`는 Core/Current 지식, 책임 있는 설계, 내보내기 스키마·QA 계약, hooks, shared runtime scripts와 vendored Skillstead의 공동 입력입니다.
- `plugins/game-design-studio`는 suite build가 두 원천을 깨끗한 staging 디렉터리에서 합성하는 generated independent snapshot입니다. 저장소나 다른 플러그인의 상대 경로 없이 독립 설치할 수 있어야 합니다.

`plugins/game-design-studio`는 suite build가 소유합니다. 생성 결과를 직접 편집하지 마십시오. 변경은 `products/` 또는 `shared/` 원천에 적용하고 검증한 뒤 다시 빌드합니다.

배포 스냅샷은 다음 구조를 가집니다.

```text
plugins/game-design-studio/
├── .codex-plugin/plugin.json
├── skills/ (11개)
│   ├── <10개 Studio 제품 스킬>/
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
│   ├── <Studio routing, methods, profiles, export/visualization contracts>
│   ├── source-document-rights.json  # 원문 49개의 경로·해시·권리 상태
│   ├── profiles/                    # 4개: universal core 1 + 선택 프로필 3
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
├── examples/
│   └── intent-invocation-contract/  # vendored Skillstead 상대 링크의 package-local target
├── assets/
│   ├── product-mark.svg
│   ├── templates/                   # Studio Canonical Artifact 15개
│   └── shared/templates/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── README.md
└── BUILD-MANIFEST.json              # suite distribution snapshot 생성물
```

저수준 `buildProduct()` 출력에는 `BUILD-MANIFEST.json`이 없습니다. 이 suite distribution snapshot에는 `BUILD-MANIFEST.json`이 있으며, suite 통합 빌드가 현재 원천에서 생성합니다. 저수준 builder는 파일 목록과 SHA-256을 반환할 뿐 manifest 파일을 쓰지 않습니다.

제품 source overlay의 package-local Markdown 링크가 저장소 밖으로 나가지 않도록, 실제 실행 경로와 같은 `references/shared/...` 및 `assets/shared/...` 위치에 필요한 shared 계약의 byte-identical authoring mirror를 둡니다. Canonical shared 파일이 먼저 package target에 매핑되고 같은 바이트의 mirror는 build에서 중복 제거됩니다. mirror drift는 README 계약 테스트가 차단합니다.

검색 가능한 경로 계약은 `references/shared/knowledge/core/`, `references/shared/knowledge/trends/`, `references/source/docs/ (49개)`, `references/shared/export/schema/`, `references/profiles/`, `assets/templates/ (15개)`, `assets/product-mark.svg`입니다. 최종 `skills/ (11개)`는 제품 스킬 10개와 `skills/svg-infographic/`이고 `agents/ (6개)`는 네이티브 발견 여부와 무관하게 오케스트레이터가 전달할 수 있는 역할 자산입니다.

## 원문 권리와 배포 모드

`references/source/docs/`의 원문 49개는 사용자 제공 workspace에서 왔으며, 사용자가 요청한 로컬 플러그인 제작·사용을 위해 복사됩니다. [원문 권리 매니페스트](references/source-document-rights.json)는 각 문서의 정확한 package path와 SHA-256, `user-provided-workspace` origin, 로컬 포함 근거, MIT 제외 상태, 공개 재배포 상태, 검토일과 필요한 후속 조치를 기록합니다.

플러그인 코드와 이 프로젝트가 작성한 문서·템플릿·설정에는 MIT License가 적용됩니다. Skillstead `svg-infographic` 0.8.3에는 Apache-2.0이 적용됩니다. 원문 49개는 MIT로 재허가되지(not sublicensed) 않았고 공개 재배포(public redistribution) 권리는 확인되지 않았습니다. 따라서 현재 상태에서는 원문을 포함한 snapshot을 공개하거나 제3자에게 배포하면 안 됩니다.

[원문 재배포 가드](skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs)는 매니페스트 49개와 실제 package bytes를 대조합니다. `local`과 `private` 모드는 요청된 로컬·사설 사용을 허용합니다.

```bash
PLUGIN_ROOT="plugins/game-design-studio"
node "$PLUGIN_ROOT/skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs" \
  --mode local --plugin-root "$PLUGIN_ROOT"
```

`public`과 `distributable` 모드는 모든 문서에 명시적인 재배포 가능 license 또는 permission evidence가 없으면 실패합니다. 현재 매니페스트는 49개 모두 `not-established`이므로 다음 공개 배포 검사는 의도적으로 non-zero로 종료됩니다.

```bash
PLUGIN_ROOT="plugins/game-design-studio"
node "$PLUGIN_ROOT/skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs" \
  --mode public --plugin-root "$PLUGIN_ROOT"
```

공개 배포를 준비하려면 각 문서별로 명시적인 라이선스 또는 허가 증거를 package 내부에 보존하고, 그 파일의 SHA-256·검토일·공개 재배포 허용 사실을 매니페스트에 기록한 뒤 가드를 다시 실행해야 합니다. 근거가 없는 권리 상태를 추정하거나 자동 승인하지 마십시오.

`hooks/hooks.json`은 두 shared runtime 진입점을 연결합니다.

- `SessionStart`는 `scripts/capability-probe.mjs`를 실행하는 capability-probe hook입니다. Node, Chromium, LibreOffice와 문서·PDF·프레젠테이션 capability를 감지하되 선택 기능 부재만으로 설계를 중단하지 않습니다.
- `Stop`은 `scripts/stop-artifact-review.mjs`를 실행하는 one-retry artifact review hook입니다. 최종 artifact sentinel이 있을 때 Canonical Artifact를 검사하고 실패하면 교정 패스를 한 번만 요청합니다. hook 재진입 상태에서는 다시 차단하지 않습니다.

최상위 `scripts/`는 hooks와 Canonical Artifact 검증에 쓰는 shared runtime입니다. Studio 전용 product helper는 필요한 제품 스킬의 `skills/<skill-id>/scripts/`에 있고 프로필 합성, 역할 병합, E2E 시나리오, 시각화 증거와 내보내기 job을 검증합니다.

## 작동 방식

1. [오케스트레이터](skills/orchestrate-game-design-project/SKILL.md)가 목표 플레이어, 의도한 경험, 플랫폼, 장르, 개발 단계, 제약과 완료 조건을 정규화합니다.
2. [routing registry](references/routing.json)에서 필요한 최소 스킬 체인을 선택하고, `universal-core` 뒤에 요청된 제품 프로필을 합성합니다.
3. 검토가 필요하면 서로 다른 질문을 맡을 전문 역할을 최대 3개 선택합니다. 독립 검토는 병렬 실행하고, 호스트가 서브에이전트를 지원하지 않으면 동일한 envelope를 역할 우선순위대로 순차 fallback 실행합니다.
4. finding은 severity, stable section ID, role priority 순으로 결정론적으로 병합합니다. 도착 순서는 결과를 바꾸지 않으며, 충돌하는 권고는 결정 항목으로 남깁니다.
5. 기준 내용은 Canonical Artifact에 보존합니다. 도식화와 형식별 내보내기는 검증 가능한 선택적 파생 작업입니다.

`agents/*.md`는 오케스트레이션에 전달하는 이식 가능한 역할 자산이며 네이티브 자동 발견을 보장하지 않습니다. 자동 발견이나 병렬 실행이 없는 호스트에서도 동일 역할, 질문, 정렬 규칙을 사용해야 합니다.

## 프로필 합성

모든 작업은 `universal-core`에서 시작합니다. 선택 프로필은 장르나 플랫폼을 근거로 사실을 발명하는 프리셋이 아니라 추가 질문, 필수 섹션, evidence trigger, 책임 게이트와 검토 역할을 더하는 계약입니다.

| 프로필 ID | 추가 설계 초점 |
| --- | --- |
| `universal-core` | 목표 플레이어·경험, core loop·rules, 가정·근거·non-goals, 의존성·위험·결정 |
| `live-service-rpg` | 장기 성장, persistent authority, LiveOps calendar·rollback, sources·sinks·inflation |
| `mobile` | touch/device matrix, short session·interruption recovery, network degradation, store/privacy/commerce policy |
| `pc-console` | controller·keyboard/mouse, certification·entitlement, hardware performance, save·commerce·release operation |

복수 프로필은 `universal-core → live-service-rpg → mobile → pc-console`의 canonical order로 중복 없이 합성됩니다. `mobile`과 다른 프로필을 함께 선택하면 session length, client/server authority, primary input, monetization/platform policy 충돌이 나타날 수 있습니다. 각 충돌은 자동으로 타협하지 않고 `conflict decision record`를 요구합니다. 기록에는 `decision`, `rationale`, `evidenceIds`, `owner`, `approvalDate`가 모두 있어야 합니다.

## 스킬 카탈로그

| 스킬 ID | 사용하는 때 | 핵심 결과 |
| --- | --- | --- |
| `orchestrate-game-design-project` | 복합·불명확 요청과 전체 완료 조정 | 브리프, 최소 스킬 체인, 프로필, 검토 envelope, 완료 게이트 |
| `define-game-vision` | 목표 플레이어, 의도 경험, core fun과 pillars 정의 | `vision-pillars`, core/motivation loop, 측정 가능한 가설 |
| `design-game-systems` | 규칙, 상태, 우선순위, 예외, 데이터 계약 설계 | 실행 가능한 `system-specification`과 table/runtime mapping |
| `design-game-content` | quest, level, encounter, character, enemy, narrative unit 설계 | 시스템·데이터·생산 근거에 연결된 content spec |
| `design-player-experience` | UI/UX flow, onboarding, input, accessibility 설계 | interaction states, first session, cross-platform access contract |
| `design-game-economy-and-liveops` | economy, monetization, probability, event, experiment 설계 | sources/sinks, transparency, hypothesis/control/guardrail/rollback |
| `plan-game-production` | prototype, scope, estimate, milestone, risk 결정 | evidence-backed scope, dependencies, DoD, kill criteria |
| `review-game-design` | 기준 산출물의 evidence, risk, readiness 검토 | traceable findings, minimal fixes, unresolved decision items |
| `visualize-game-design` | loop, state, economy, timeline, dependency를 공간적으로 설명 | accessible SVG, 정확한 2× PNG와 검증 증거 또는 fallback |
| `export-game-design-documents` | MD/PDF/DOCX/PPTX 파생본 준비와 QA | format별 capability, generation, renderer, output, QA manifest |

## 전문 역할 프롬프트

| 역할 ID | 검토 책임 | blocker 권한 경계 |
| --- | --- | --- |
| `lead-game-designer` | 목표 경험, core loop, pillars, meaningful choice, scope coherence | `scope-control` |
| `system-economy-designer` | rules, precedence, state, data mapping, sources/sinks, balance, monetization | `economy-transparency` |
| `content-narrative-designer` | content purpose, system dependency, strategy, telegraph, narrative, rights | `ai-rights-human-approval` |
| `ux-accessibility-reviewer` | critical actions, states, onboarding, input, performance, access | `accessibility` |
| `liveops-data-designer` | hypothesis, control, variable, sample, guardrail, stop, rollback | `liveops-experiment` |
| `production-feasibility-critic` | contribution, effort evidence, dependencies, prototype, milestones, kill criteria | `scope-control` |

역할은 산출물 전체를 다시 쓰거나 자신에게 없는 게이트를 승인하지 않습니다. finding에는 stable source ID, severity, evidence, impact, affected section, assumptions, minimal fix와 역할이 필요합니다.

## 근거와 최신성 정책

- 저장소의 한국어 원문 49개는 출처 provenance와 검토 출발점입니다. 검토된 Core는 오래 유지되는 설계 원칙을 제공하고, Current는 정책·플랫폼·시장·도구처럼 변하는 주장을 별도 관리합니다.
- 플랫폼 정책, 규제, 접근성 기준, 상점 규칙, 엔진·도구, monetization 관행과 시장 수치는 시점 의존 주장입니다. 가능한 최신 1차 출처, 게시일 또는 갱신일, 검색일, 적용 지역, 범위와 충돌을 기록합니다.
- 사용자 제공 사실, 외부 근거, 추론, 가정, provisional value를 분리합니다. genre convention이나 attractive target을 승인된 사실로 만들지 않습니다.
- 가격, 확률, pity, retention, sample size, schedule, person-week, team capacity, performance target, 비용, 권리·동의, 구현 상태를 조작하지 않습니다.
- 새 근거가 로컬 문서와 충돌하면 충돌을 기록하고 현재의 적용 가능한 1차 근거를 우선합니다.

## Canonical Artifact

모든 주요 산출물은 하나의 기준 원본을 사용합니다.

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

`content.md`는 유일한 내용 기준입니다. `evidence.yml`은 material claim과 출처·한계를, `decisions/`는 선택·대안·부작용·승인·검토 finding을, `assets/`는 source mapping·alt text·권리를, `export-manifest.yml`은 형식별 작업과 QA 상태를 기록합니다. 도식화나 내보내기가 실패해도 이 원본과 기존 출력은 덮어쓰지 않습니다.

## Canonical Artifact 템플릿

| 템플릿 ID | 용도 |
| --- | --- |
| `game-design-brief` | 목표 플레이어, 경험, 플랫폼, 장르, business model, scope와 owner |
| `vision-pillars` | player promise, design rules, anti-pillars, success signals |
| `core-motivation-loop` | input, response, feedback, reward, choice, failure/recovery loop |
| `system-specification` | executable rules, transitions, precedence, exception, runtime mapping |
| `rule-exception-matrix` | rule/exception 우선순위, concurrency, authority와 test cases |
| `ui-ux-flow-state` | state별 critical action, input, feedback, error/offline/recovery |
| `data-schema-table-contract` | PK/FK, type/range, source of truth, runtime consumer, migration |
| `narrative-quest-npc` | quest/NPC state, choice/consequence, rewards, repeatability, rights |
| `character-skill-combat-monster` | combat role, timing, telegraph, counterplay, data key, balance test |
| `economy-balance` | sources/sinks, target inventory, progression, real price, odds, pity |
| `liveops-experiment-event` | hypothesis, control, one variable, sample, guardrail, stop, rollback |
| `accessibility-platform-matrix` | critical action별 input, modality alternatives, platform verification |
| `production-scope-risk` | contribution, MoSCoW, effort, dependency, prototype, DoD, kill criteria |
| `game-design-review` | evidence-backed finding, impact, minimal fix, role와 decision ID |
| `decision-change-log` | context, alternatives, evidence, rationale, approver, reopen condition |

각 템플릿은 `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, `assets/README.md`를 포함합니다. [템플릿 원천](assets/templates/)에서 전체 seed를 확인할 수 있습니다.

## 사용 예시

다음 문장은 입력 예시입니다. 플러그인은 누락된 자료와 결정을 채우지 않고 Canonical Artifact에 공백과 담당자를 남깁니다.

### 새 GDD

> 4인 협동 탐험 게임의 새 GDD를 만들어 줘. 목표 플레이어, 원하는 감정, core loop, pillars, scope와 non-goals를 먼저 정의하고 PC/console 프로필을 적용해. 검증하지 않은 수치는 provisional로 남겨 줘.

### 시스템 명세

> 장비 강화 시스템을 rule ID, precondition, state transition, rule precedence, simultaneous outcome, exception, failure/recovery, abuse case, UI states, PK/FK와 table/runtime mapping까지 구현 가능한 명세로 만들어 줘.

### 경제와 LiveOps 리뷰

> 이 live-service RPG의 currency sources/sinks, target inventory, progression time, real price, odds와 pity를 검토해. 이벤트는 hypothesis, control, one variable, sample basis, guardrail, stop condition과 tested rollback이 없으면 hard No-Go로 표시해.

### AI NPC 안전 검토

> PC/console AI NPC 기획을 검토해. source provenance, rights/consent, disclosure, moderation, memory/privacy, behavior boundaries, human approver, safe fallback과 kill switch의 실제 근거가 없으면 승인하지 마.

### 게임 기획 도식화

> 검증된 시스템 명세의 combat state transition과 failure recovery만 source mapping해서 도식화해. 적합한 preset과 제외 이유를 기록하고 editable SVG, SVG lint, 정확한 2× PNG와 two-pass visual QA 증거를 남겨 줘.

### 문서 내보내기

> 이 Canonical Artifact의 MD, PDF, DOCX와 의사결정자용 PPTX 내보내기 작업을 준비해 줘. PPTX는 제목을 기계적으로 나누지 말고 청중·목적·slide message가 있는 독립적인 스토리로 구성해. 이 단계에서는 형식별 `passed`나 `failed`를 주장하지 말고 renderer-neutral 준비 manifest만 만들어 줘.

## Skillstead 도식화

[visualize-game-design](skills/visualize-game-design/SKILL.md)는 spatial encoding이 실제로 관계를 더 명확하게 할 때만 Skillstead `svg-infographic` 0.8.3을 사용합니다. 지원 preset은 core/motivation loop, state/rule flow, economy source/sink, progression/lifecycle, production timeline/dependency, RACI/role flow입니다. 단순 목록은 본문이나 표로 유지합니다.

모든 node, connector, label, date와 numeric annotation은 stable source locator에 연결해야 합니다. SVG에는 `<title>`, `<desc>`, alt text가 필요합니다. 패키지의 SVG lint를 통과한 뒤 Chromium이 있으면 canonical renderer로 정확한 2× PNG를 생성하고 browser identity/version, source/output digest, 실제 dimensions와 fit-to-page·close-up visual QA를 기록합니다.

브라우저가 없거나 render/visual QA가 실패하면 lint를 통과한 editable SVG와 source evidence를 보존하고 PNG를 `unavailable` 또는 `failed`로 표시합니다. `requested`, `generated`, `linted`, `rendered`, `verified`는 서로 다른 상태이며 앞 상태만으로 뒤 상태를 주장하지 않습니다.

## MD, PDF, DOCX, PPTX 내보내기

[export-game-design-documents](skills/export-game-design-documents/SKILL.md)는 Canonical Artifact preflight 뒤 format별 renderer-neutral 작업만 준비합니다. 지원되는 요청은 `pending`, capability 부재는 `unavailable`, preflight 실패는 `blocked`로 남기며 generation·renderer·QA는 `not-run`, derivative path·digest·count는 null, format evidence는 빈 배열로 유지합니다. 이 플러그인의 준비 validator는 format-level `passed`와 `failed`를 fail-closed로 거부합니다.

| 형식 | `passed`에 필요한 검증 |
| --- | --- |
| MD | canonical structure, links, referenced assets, alt text, NFC와 stable IDs |
| PDF | source semantics 비교, 실제 PDF, 모든 page render와 visual QA |
| DOCX | OOXML package/relationships, semantics 비교, 모든 page render와 visual QA |
| PPTX | audience·purpose·독립적인 story outline, unique slide ID/message/purpose, overflow 검사, 모든 slide render QA |

표의 검증은 별도의 신뢰된 renderer-and-QA 단계가 terminal 상태를 판단할 때 필요한 downstream 계약입니다. Studio 준비 manifest는 그 실행 결과를 소비하거나 검증하지 않습니다. MD는 canonical text capability로, PDF, DOCX와 PPTX는 각각 감지된 PDF, documents, presentations capability로 계획만 세웁니다. unsafe traversal, symlink, 기존 출력 overwrite는 원본을 보존하고 차단합니다.

## 책임 있는 설계 게이트

모든 게이트는 `not-applicable`, `pending`, `blocked`, `approved` 중 하나입니다. 적용 가능하면 먼저 `pending`이며, missing evidence는 승인이 아닙니다. blocking condition은 해당 scope를 hard No-Go로 유지합니다. 자동화는 consent를 추론하거나 권리를 부여하거나 residual risk를 수락하지 못하며, 지정된 사람의 evidence-linked approval만 `approved`가 됩니다.

| 게이트 | 차단되는 대표 조건 | 사람 승인자 |
| --- | --- | --- |
| `ai-rights-human-approval` | provenance, rights/consent, compensation 또는 human approval 누락 | rights-and-legal owner |
| `accessibility` | core path의 accessible alternative 또는 target evidence 누락 | accessibility owner |
| `economy-transparency` | price, odds, conversion, eligibility, purchase consequence 은폐·누락 | economy/monetization owner |
| `liveops-experiment` | hypothesis, guardrail, treatment boundary, rollback, accountable owner 누락 | live operations owner |
| `ugc-safety` | reporting, moderation, age/privacy, enforcement, appeal path 누락 | trust and safety owner |
| `ai-npc-safety` | unbounded harmful output, deceptive personhood, unsafe memory, unguarded high-impact action | AI safety owner |
| `scope-control` | owner, cost/risk, success measure, explicit approval 없는 scope expansion | product owner |

법률, 안전, 접근성, 생산 또는 제품 책임자를 플러그인이 대체하지 않습니다. 관련 없는 범위는 계속 작업할 수 있지만 차단된 범위의 release·experiment·procurement·production approval은 진행할 수 없습니다.

## 제한 사항

- 플러그인은 재미, retention, 수익, 일정, 품질, 접근성 준수, 법적 적합성 또는 출시 성공을 예측하거나 보장하지 않습니다.
- 원문 49개와 Core guidance는 시점 의존 정책·시장·도구 사실을 대체하지 않습니다. Current claim은 다시 조사해야 합니다.
- 원문 49개는 로컬·사설 snapshot용으로만 포함됩니다. 공개 또는 배포 가능한 release에는 모든 문서의 명시적 재배포 권리 근거가 필요합니다.
- 역할 프롬프트의 네이티브 발견과 병렬 서브에이전트 지원은 호스트에 따라 다릅니다. 순차 fallback은 역할·질문·merge order를 보존합니다.
- PDF/DOCX/PPTX 생성과 PNG render는 설치 환경의 capability에 의존합니다. unavailable 또는 failed 상태를 성공으로 바꾸지 않습니다.
- 템플릿은 빈칸을 승인된 사실로 채우지 않습니다. 사람의 결정, 권리·동의와 현재 근거가 필요한 게이트는 자동 완료되지 않습니다.

## 문제 해결

| 증상 | 확인 및 복구 |
| --- | --- |
| marketplace가 보이지 않음 | `codex plugin marketplace list`에서 `game-design-suite`와 저장소 루트를 확인합니다. `.agents/plugins/marketplace.json`과 suite-built snapshot이 있는 release checkout을 등록합니다. |
| 설치 후 스킬이 보이지 않음 | `codex plugin list`에서 설치 상태를 확인하고 새 Codex 작업을 시작합니다. 제품 source overlay를 직접 설치 대상으로 쓰지 않습니다. |
| 프로필 합성이 멈춤 | unknown profile ID를 제거합니다. conflict가 있으면 필수 5개 필드가 있는 decision record를 작성합니다. |
| 검토 결과가 호스트마다 달라짐 | 동일 role envelope와 priority를 사용했는지 확인합니다. arrival order나 완성 시간으로 finding을 정렬하지 않습니다. |
| PNG가 생성되지 않음 | SVG lint 결과와 Chromium probe 실패를 확인합니다. passed SVG를 보존하고 PNG를 `unavailable`로 남깁니다. |
| 내보내기가 `blocked`임 | Canonical Artifact validation, safe output path와 해당 format capability를 확인합니다. 기존 manifest에서 증거가 없는 단계부터 재개합니다. |
| 게이트가 `approved`가 되지 않음 | 해당 게이트의 evidence fields, 지정 사람 승인자, approval date와 decision record를 연결합니다. 자동 승인을 시도하지 않습니다. |

## 검증

저장소 루트에서 README 계약과 Studio 전체 제품·E2E 계약을 실행합니다.

```bash
node --test tests/products/studio/readme.test.mjs
node --test tests/products/studio/*.test.mjs tests/e2e/studio/*.test.mjs
```

10개 source skill의 공식 구조를 확인합니다.

```bash
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
find products/game-design-studio/plugin/skills -name SKILL.md -print0 |
  while IFS= read -r -d '' skill_file; do
    python3 "$CODEX_ROOT/skills/.system/skill-creator/scripts/quick_validate.py" "$(dirname "$skill_file")"
  done
```

source plugin manifest를 확인합니다.

```bash
CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"
python3 "$CODEX_ROOT/skills/.system/plugin-creator/scripts/validate_plugin.py" products/game-design-studio/plugin
```

`CODEX_HOME`을 지정하지 않으면 명령은 `$HOME/.codex`를 사용합니다. 두 경로 모두 따옴표로 감싸므로 공백이 있는 홈이나 사용자 지정 Codex 디렉터리에서도 하나의 인자로 전달됩니다. Codex 설치 명령 문법은 로컬 `codex plugin ... --help`로 확인했습니다. 배포 snapshot 생성, 독립 설치 smoke와 전체 형식 render는 suite 통합 검증이 소유합니다.

## 라이선스

Game Design Studio 플러그인 코드와 이 프로젝트가 작성한 문서·템플릿·설정은 [MIT License](LICENSE)로 배포됩니다. 포함된 Skillstead `svg-infographic` 0.8.3은 Apache-2.0이며 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 패키지 안의 원본 라이선스가 적용됩니다. 사용자 제공 원문 49개는 MIT 대상에서 제외되고 재허가되지 않으며, 공개 재배포 권리가 문서별로 확인될 때까지 로컬·사설 사용 범위를 벗어나 배포할 수 없습니다.
