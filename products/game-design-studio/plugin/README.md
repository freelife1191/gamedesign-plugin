# Game Design Studio

Game Design Studio는 게임 비전부터 시스템·콘텐츠·플레이어 경험·경제·LiveOps·프로덕션 설계, 전문 검토, 도식화, 문서 내보내기까지 하나의 검증 가능한 작업 흐름으로 연결하는 Codex 플러그인입니다. 그럴듯한 수치나 승인을 조작하지 않고 근거, 가정, 결정, 차단 조건을 Canonical Artifact에 남깁니다.

플러그인은 제품 스킬 17개, 전문 역할 12개, Canonical Artifact 템플릿 15개와 문서·이미지·내보내기 계약을 하나의 독립 패키지에 포함합니다. 공통 스킬 9개는 Archify, humanize-korean, Skillstead `svg-infographic` 0.10.0, 프로젝트 기억 스킬 3개, [레퍼런스 분석 스킬](../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md), [용어 사전 스킬](../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md), [스위트 업데이트 스킬](../../../shared/suite-update/skills/upgrade-game-design-suite/SKILL.md)입니다. 제품 스킬과 합친 설치 스킬은 26개입니다.

## 설치

요구 사항은 Codex CLI와 Node.js 18 이상입니다. 설치 대상은 release checkout의 `plugins/game-design-studio`이며, `products/game-design-studio/plugin`은 개발 원천입니다. suite build가 아직 실행되지 않은 개발 checkout에는 설치 가능한 스냅샷이 없을 수 있습니다.

### marketplace 등록

등록 방법은 둘이고 갱신 방법이 다릅니다. 공개 릴리스를 최신 판정 근거로 쓰려면 GitHub 저장소를 Git marketplace로 등록합니다.

```bash
codex plugin marketplace add freelife1191/gamedesign-plugin
```

저장소를 직접 고치며 쓸 때만 로컬 checkout을 등록합니다. 이 경우 공개 릴리스로 갱신되지 않습니다. 저장소 루트에는 suite build가 관리하는 `.agents/plugins/marketplace.json`이 있어야 합니다. `<path-to-repository-root>`를 실제 저장소 루트로 바꿉니다.

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

`SessionStart`는 처음 시작할 때와 마지막 확인 뒤 7일이 지난 뒤에만 번들 업데이트를 확인합니다. 결과는 “플러그인 업데이트를 확인해 줘”라는 **알림**일 뿐이며, 플러그인을 자동으로 업데이트하거나 다시 설치하지 않습니다. 확인을 끄려면 `GAME_DESIGN_UPDATE_CHECKS=false`를 설정하세요. Skillstead·Archify·im-not-ai 번들은 다음 suite release 전까지 현재 버전으로 고정됩니다. 설치된 캐시 폴더는 직접 편집하지 마세요.

설치한 제품의 `$upgrade-game-design-suite`를 호출하면 아래 명령을 대신 안내받을 수 있습니다. 설치된 버전과 공개된 최신 릴리스를 비교한 결과를 먼저 보여 주고 승인을 기다리며, 검사와 계획 단계에서는 어떤 설치도 바꾸지 않습니다. 승인 없이 적용되는 업데이트는 없습니다. 선택지 표는 저장소의 `guides/game-design-studio/installation.md`에 있습니다.

아래는 스킬 없이 손으로 처리할 때의 명령입니다.

`codex plugin list --available`은 설치하지 않은 플러그인 목록만 보여 줍니다. Codex 0.147.0에서는 이미 설치한 Studio의 새 원천 버전을 판별하지 않습니다. 알림을 본 뒤에만 아래 명령을 명시적으로 실행하고, 재설치가 끝나면 새 채팅 또는 새 세션을 열어 새 설치본을 사용하세요.

Git marketplace로 등록한 경우 snapshot을 갱신하고 플러그인을 다시 설치합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin add game-design-studio@game-design-suite
```

로컬 marketplace(저장소 경로 등록)는 Git fetch 대상이 아닙니다. 저장소를 갱신하고 suite build로 `plugins/game-design-studio`를 다시 만든 뒤, 설치된 snapshot을 명시적으로 제거하고 다시 추가합니다.

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
├── skills/ (26개)
│   ├── <17개 Studio 제품 스킬>/
│   │   └── scripts/                 # 필요한 스킬에만 있는 product helper
│   ├── analyze-game-design-references/ # 근거를 분리해 레퍼런스를 분석
│   ├── archify/                      # vendored Archify 2.15.0
│   ├── capture-game-design-memory/   # 검증한 교훈을 후보로 기록
│   ├── humanize-korean/              # vendored im-not-ai
│   ├── maintain-game-design-glossary/ # 용어 후보와 사람 검토 결정 관리
│   ├── maintain-game-design-memory/  # 후보와 승인 이력 관리
│   ├── retrieve-approved-design-memory/ # 승인된 관련 기억 조회
│   └── svg-infographic/              # vendored Skillstead 0.10.0
├── agents/ (12개)                   # 기획·검토·이미지 작업을 맡는 이식 가능한 전문 역할 프롬프트
├── hooks/
│   └── hooks.json
├── scripts/                         # shared runtime
│   ├── capability-probe.mjs
│   ├── data-only-snapshot.mjs
│   ├── quality-source-anchors.mjs
│   ├── resolve-quality-profile.mjs
│   ├── stop-artifact-review.mjs
│   ├── validate-artifact.mjs
│   ├── validate-quality-profile.mjs
│   └── validate-reference-preset.mjs
├── references/
│   ├── <Studio routing, methods, profiles, export/visualization contracts>
│   ├── source-document-rights.json  # 원문 49개의 경로·해시·권리 상태
│   ├── profiles/                    # 4개: universal core 1 + 선택 프로필 3
│   ├── shared/
│   │   ├── knowledge/
│   │   │   ├── core/
│   │   │   └── trends/
│   │   ├── responsible-design/
│   │   ├── document-quality/        # indexes, profiles, overlays, presets, schemas, render contracts
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

검색 가능한 경로 계약은 `references/shared/knowledge/core/`, `references/shared/knowledge/trends/`, `references/source/docs/ (49개)`, `references/shared/export/schema/`, `references/shared/document-quality/`, `references/shared/image-assets/`, `references/shared/memory/`, `references/shared/reference-intelligence/`, `references/document-quality/template-profile-map.json`, `references/profiles/`, `assets/templates/ (15개)`, `assets/product-mark.svg`입니다. 최종 `skills/ (26개)`는 제품 스킬 17개와 공통 스킬 9개입니다. 공통 스킬은 [레퍼런스 분석 스킬](../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md) `analyze-game-design-references`, `archify`, `humanize-korean`, `svg-infographic`, `retrieve-approved-design-memory`, `capture-game-design-memory`, `maintain-game-design-memory`, [용어 사전 스킬](../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md) `maintain-game-design-glossary`, [스위트 업데이트 스킬](../../../shared/suite-update/skills/upgrade-game-design-suite/SKILL.md) `upgrade-game-design-suite`이며 `agents/ (12개)`는 네이티브 발견 여부와 무관하게 오케스트레이터가 전달할 수 있는 전문 역할 자산입니다.

## 설치된 top-level scripts

| 파일 | 역할 |
| --- | --- |
| `analyze-game-design-references.mjs` | 근거를 분리해 레퍼런스 분석 산출물을 검증 |
| `build-image-asset-plan.mjs` | profile과 artifact에서 image asset plan 생성 |
| `capability-probe.mjs` | 선택 renderer capability 점검 |
| `capture-design-memory.mjs` | 검증한 작업의 교훈을 검토 대기 후보로 기록 |
| `check-game-design-updates.mjs` | 고정 번들의 업데이트 정보를 7일 주기 안내로 확인 |
| `compile-image-prompts.mjs` | Markdown/JSON prompt package 생성 |
| `data-only-snapshot.mjs` | 신뢰 경계의 data-only snapshot 검증 |
| `estimate-cutscene-image-cost.mjs` | 현재 컷씬 wave의 비용 범위와 cap 계산 |
| `generate-openai-images.mjs` | OpenAI Images API bounded adapter |
| `inspect-game-design-plugin-updates.mjs` | inventory의 비교 가능 여부와 명시적 재설치 계획 확인 |
| `load-memory-config.mjs` | 프로젝트 기억 설정을 안전한 값으로 읽기 |
| `maintain-design-memory.mjs` | 후보·사람 결정·충돌·복구 관리 |
| `manage-game-design-glossary.mjs` | 용어 후보·오버레이·사람 결정 기록 관리 |
| `plan-cutscene-visual-preproduction.mjs` | 컷씬 brief, shot, 프롬프트와 serial wave 계획 생성 |
| `quality-source-anchors.mjs` | canonical quality source byte·semantic anchor |
| `resolve-quality-profile.mjs` | profile 선택·합성·manifest·상태 전이 |
| `retrieve-design-memory.mjs` | 승인된 관련 기억과 적용·제외 기록 조회 |
| `review-cutscene-continuity.mjs` | 컷씬 결과의 continuity receipt와 gate 검토 |
| `run-approved-cutscene-image-stage.mjs` | 현재 승인된 컷씬 wave만 provider dispatch로 전달 |
| `run-game-design-writing-polish.mjs` | writing specialist와 bundled humanize-korean을 거치는 bounded revision 실행 |
| `run-image-asset-workflow.mjs` | image workflow composition |
| `stop-artifact-review.mjs` | one-retry Stop artifact review |
| `validate-artifact.mjs` | Canonical Artifact 검증 |
| `validate-cutscene-visual-preproduction.mjs` | 컷씬 계획, wave 순서와 approval binding 검증 |
| `validate-design-memory.mjs` | 기억 원본·상태 전이·출처 연결 검증 |
| `validate-game-design-writing-language.mjs` | 게임 기획 문서의 용어·문체 검증 |
| `validate-image-assets.mjs` | image manifest/lifecycle 검증 |
| `validate-image-config.mjs` | redacted image configuration 검증 |
| `validate-quality-profile.mjs` | closed Quality Profile 검증 |
| `validate-reference-intelligence.mjs` | 레퍼런스 분석과 용어 사전 산출물의 경계 검증 |
| `validate-reference-preset.mjs` | neutral reference preset 검증 |
| `validate-writing-revision.mjs` | protected content와 bounded writing revision 검증 |

이 표는 기존 16개와 기억 스크립트 5개, 레퍼런스 인텔리전스 스크립트 4개, 컷씬 프리프로덕션 스크립트 5개, 업데이트 검사 스크립트 2개를 합친 최상위 실행 스크립트 32개입니다. `scripts/lib/*.mjs`는 최상위 스크립트가 쓰는 내부 도구이며 직접 실행 목록에 포함하지 않습니다.

## 프로젝트 기억

프로젝트 기억은 이전 플레이테스트와 검토에서 확인한 설계 교훈을 출처·범위·상태와 함께 로컬에 보관합니다. 현재 프로젝트를 뜻하는 `project`가 기본 범위이며 `.game-design/`을 자동으로 Git에 커밋하거나 원격 저장소로 보내지 않습니다. 설치·업데이트·제거도 이 폴더를 만들거나 지우지 않습니다.

자동으로 남는 것은 검토 대기 후보뿐입니다. 후보를 자동 승인하지 않으며 이름이 확인된 사람이 출처와 적용 조건을 검증한 뒤 승인·거부·폐기합니다. 출처가 달라지거나 검토·만료 시점을 지난 기록, 충돌한 기록은 적용하지 않습니다. `GAME_DESIGN_MEMORY_ENABLED=false` 또는 “이번 작업에서는 이전 기억을 사용하지 마.”라는 요청으로 제외할 수 있고, 기억 기능에 문제가 생겨도 기존 Studio 작업은 기억 없이 계속합니다.

사용법과 복구 절차는 저장소 checkout의 `guides/game-design-studio/memory.md`에서 확인합니다. 설치 패키지 안에서는 `retrieve-approved-design-memory`, `capture-game-design-memory`, `maintain-game-design-memory` 스킬을 직접 호출할 수 있습니다.

## 설치된 document-quality 경로

아래 경로는 `references/shared/document-quality/` 아래에 설치됩니다.

| 상대 경로 | 내용 |
| --- | --- |
| `indexes/career.json` | Career closed selection index |
| `indexes/studio.json` | Studio closed selection index |
| `profiles/career/` | Career 13-profile catalog |
| `profiles/studio/` | Studio 17-profile catalog |
| `overlays/` | additive overlay 3개 |
| `presets/` | neutral reference preset 7개 |
| `render-contracts/long-form-document.json` | 장문 문서 render contract |
| `render-contracts/presentation.json` | presentation render contract |
| `render-contracts/review-report.json` | review report render contract |
| `schema/quality-profile-selection.schema.json` | profile selection schema |
| `schema/quality-profile.schema.json` | Quality Profile schema |
| `schema/reference-preset.schema.json` | neutral preset schema |

## 원문 권리와 배포 모드

`references/source/docs/`의 원문 49개는 사용자 제공 workspace에서 왔으며, 사용자가 요청한 로컬 플러그인 제작·사용을 위해 복사됩니다. [원문 권리 매니페스트](references/source-document-rights.json)는 각 문서의 정확한 package path와 SHA-256, `user-provided-workspace` origin, 로컬 포함 근거, MIT 제외 상태, 공개 재배포 상태, 검토일과 필요한 후속 조치를 기록합니다.

플러그인 코드와 이 프로젝트가 작성한 문서·템플릿·설정에는 MIT License가 적용됩니다. Skillstead `svg-infographic` 0.10.0에는 Apache-2.0이 적용됩니다. 원문 49개는 MIT로 재허가되지(not sublicensed) 않았고 공개 재배포(public redistribution) 권리는 확인되지 않았습니다. 따라서 현재 상태에서는 원문을 포함한 snapshot을 공개하거나 제3자에게 배포하면 안 됩니다.

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
| `universal-core` | 목표 플레이어·경험, 핵심 플레이 흐름·규칙, 가정·근거·제외 목표, 의존성·위험·결정 |
| `live-service-rpg` | 장기 성장, persistent authority, LiveOps calendar·rollback, sources·sinks·inflation |
| `mobile` | touch/device matrix, short session·interruption recovery, network degradation, store/privacy/commerce policy |
| `pc-console` | controller·keyboard/mouse, certification·entitlement, hardware performance, save·commerce·release operation |

복수 프로필은 `universal-core → live-service-rpg → mobile → pc-console`의 canonical order로 중복 없이 합성됩니다. `mobile`과 다른 프로필을 함께 선택하면 session length, client/server authority, primary input, monetization/platform policy 충돌이 나타날 수 있습니다. 각 충돌은 자동으로 타협하지 않고 `conflict decision record`를 요구합니다. 기록에는 `decision`, `rationale`, `evidenceIds`, `owner`, `approvalDate`가 모두 있어야 합니다.

## Document Quality Profiles

`apply-document-quality-profile`은 goal, audience, artifact type, requested format, template ID를 정규화해 정확히 하나의 primary profile을 선택합니다. `references/document-quality/template-profile-map.json`은 설치 패키지의 canonical template map이며 production 호출은 caller-authored production map을 받지 않습니다. 알려진 명시적 override는 호환성을 확인한 뒤 사용합니다. 알 수 없는 요청은 결정론적 `nearest profile`과 차이를 기록하고, 사용자가 알려진 호환 `fallback`을 함께 지정한 경우에만 그 profile로 진행합니다. 호환 profile이 없거나 override/fallback이 잘못되면 fail-closed로 중단합니다.

| 프로필 ID | 대표 문서 목적 |
| --- | --- |
| `vision-one-pager` | 의사결정용 비전 요약 |
| `game-design-brief` | 목표·범위·제약 브리프 |
| `master-gdd` | 장문 기준 GDD |
| `core-motivation-loop` | 핵심 행동·동기 루프 |
| `system-feature-specification` | 기능 규칙·상태·예외 명세 |
| `rule-state-exception-matrix` | 규칙·상태·예외 매트릭스 |
| `data-table-contract` | 데이터 테이블 계약 |
| `narrative-quest-npc-specification` | 내러티브·퀘스트·NPC 명세 |
| `character-skill-combat-monster-specification` | 캐릭터·스킬·전투·몬스터 명세 |
| `ui-ux-flow-state-specification` | UI/UX 흐름·상태 명세 |
| `economy-balance-specification` | 경제·밸런스 명세 |
| `liveops-event-experiment-plan` | LiveOps 이벤트·실험 계획 |
| `accessibility-platform-matrix` | 접근성·플랫폼 매트릭스 |
| `production-scope-milestone-risk-plan` | 범위·마일스톤·위험 계획 |
| `playtest-metrics-report` | 플레이테스트·지표 보고서 |
| `design-review-decision-log` | 설계 검토·결정 로그 |
| `executive-pitch` | 의사결정형 발표 자료 |

primary 요구사항에는 additive overlay `mobile`, `pc-console`, `live-service`를 중복 없이 더할 수 있고, neutral reference preset은 `competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling` 중 최대 하나만 더할 수 있습니다. overlay와 preset은 primary requirement나 안전 게이트를 삭제·약화할 수 없습니다. 이 reference-only preset은 회사나 프로젝트의 형식 복제가 아니며 결과에 authoring-only source, 회사·프로젝트명, 상표, URL, 로고, 원본 이미지·레이아웃을 노출하지 않고 공식 studio endorsement를 주장하지 않습니다.

선택 결과는 primary/overlay/preset ID, 이유, 점수, tie-break와 fallback 기록을 보존합니다. 요구사항 manifest와 stable section/table/Skillstead diagram/image/acceptance checklist ID는 canonical source bytes와 artifact digest에 결합됩니다. 상태는 `draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved`로만 전진합니다. 외부 artifact inspection, evidence reviewer, renderer/visual·rights·책임 게이트 reviewer, 이름 있는 human approval의 digest-bound receipt가 각각 필요하며 상태를 건너뛸 수 없습니다. Skillstead diagram slot은 renderer/visual review 전까지 unverified이고, generated image와 render는 자동 승인하지 않습니다.

설치 후 고급 사용자는 `references/shared/document-quality/schema/quality-profile.schema.json`, `references/shared/document-quality/schema/quality-profile-selection.schema.json`, `references/shared/document-quality/schema/reference-preset.schema.json`, `references/shared/document-quality/render-contracts/`, `references/shared/document-quality/profiles/studio/`, `references/shared/document-quality/indexes/studio.json`을 검사할 수 있습니다. 이 경로는 패키지 내부 canonical source이며 저장소의 authoring-only evidence로 fallback하지 않습니다. 렌더 계약은 후속 renderer가 지켜야 할 계약이지 현재 플러그인이 PDF/DOCX/PPTX/image를 자동 완성한다는 뜻이 아닙니다.

정확한 intent 예시는 다음과 같습니다.

```text
apply-document-quality-profile: game-design-brief 템플릿으로 production 대상 MD를 만들고 mobile overlay와 function-first preset을 적용해. section/table/diagram/image/acceptance checklist와 선택 기록을 먼저 반환해.
```

## 스킬 카탈로그

| 스킬 ID | 사용하는 때 | 핵심 결과 |
| --- | --- | --- |
| `game-design-studio` | 어떤 스킬이 요청의 소유자인지 모를 때 | 소유 제품 하나, 실행 경로 하나, 라우팅 영수증 |
| `orchestrate-game-design-project` | 복합·불명확 요청과 전체 완료 조정 | 브리프, 최소 스킬 체인, 프로필, 검토 envelope, 완료 게이트 |
| `apply-document-quality-profile` | 산출물 유형·대상·형식에 맞는 문서 품질 계약 적용 | 선택 기록, 요구사항 manifest, stable checklist와 상태 envelope |
| `define-game-vision` | 목표 플레이어, 의도 경험, core fun과 pillars 정의 | `vision-pillars`, core/motivation loop, 측정 가능한 가설 |
| `design-game-systems` | 규칙, 상태, 우선순위, 예외, 데이터 계약 설계 | 실행 가능한 `system-specification`과 table/runtime mapping |
| `design-game-content` | quest, level, encounter, character, enemy, narrative unit 설계 | 시스템·데이터·생산 근거에 연결된 content spec |
| `design-cutscene-visual-preproduction` | 컷씬 brief, shot, 프롬프트, 비용과 continuity를 분리할 때 | serial wave 계획, cost estimate, named approval과 continuity review |
| `design-player-experience` | UI/UX flow, onboarding, input, accessibility 설계 | interaction states, first session, cross-platform access contract |
| `design-game-economy-and-liveops` | economy, monetization, probability, event, experiment 설계 | sources/sinks, transparency, hypothesis/control/guardrail/rollback |
| `plan-game-production` | prototype, scope, estimate, milestone, risk 결정 | evidence-backed scope, dependencies, DoD, kill criteria |
| `review-game-design` | 기준 산출물의 evidence, risk, readiness 검토 | traceable findings, minimal fixes, unresolved decision items |
| `visualize-game-design` | loop, state, economy, timeline, dependency를 공간적으로 설명 | accessible SVG, 정확한 2× PNG와 검증 증거 또는 fallback |
| `export-game-design-documents` | MD/PDF/DOCX/PPTX 파생본 준비와 QA | format별 capability, generation, renderer, output, QA manifest |
| `plan-image-assets` | 이미지가 필요한 profile/brief를 계획할 때 | stable asset ID, placeholders, `assets/image-assets.yml`, Markdown/JSON prompts |
| `generate-image-assets` | 명시적으로 선택/허용된 asset만 생성할 때 | provider policy, immutable selection receipt, truthful provenance 또는 placeholder |
| `review-image-assets` | 사람의 이미지 검토를 기록할 때 | named human evidence, rights/provenance review와 approval transition |
| `polish-game-design-writing` | 기획 문장을 전문적으로 점검·최소 수정할 때 | protected content receipt, revision findings, human review handoff |

## 전문 역할 프롬프트

| 역할 ID | 검토 책임 | blocker 권한 경계 |
| --- | --- | --- |
| `lead-game-designer` | 목표 경험, core loop, pillars, meaningful choice, scope coherence | `scope-control` |
| `document-quality-editor` | 문서 구조, section/slot, story contract의 최소 수정 검토 | evidence·visual·rights·production·release·human 승인 권한 없음 |
| `system-economy-designer` | rules, precedence, state, data mapping, sources/sinks, balance, monetization | `economy-transparency` |
| `content-narrative-designer` | content purpose, system dependency, strategy, telegraph, narrative, rights | `ai-rights-human-approval` |
| `ux-accessibility-reviewer` | critical actions, states, onboarding, input, performance, access | `accessibility` |
| `liveops-data-designer` | hypothesis, control, variable, sample, guardrail, stop, rollback | `liveops-experiment` |
| `production-feasibility-critic` | contribution, effort evidence, dependencies, prototype, milestones, kill criteria | `scope-control` |
| `combat-encounter-reviewer` | encounter signal, counterplay, failure recovery와 evidence gap 검토 | blocker 승인·artifact 재작성 권한 없음 |
| `level-puzzle-reviewer` | level·puzzle path, reset/retry, accessibility recovery와 evidence gap 검토 | blocker 승인·artifact 재작성 권한 없음 |
| `game-design-writing-editor` | 번역투·반복·문맥 단절을 찾아 최소 수정안 기록 | 사실·수치·근거·승인 상태를 바꾸지 않음 |

역할은 산출물 전체를 다시 쓰거나 자신에게 없는 게이트를 승인하지 않습니다. finding에는 stable source ID, severity, evidence, impact, affected section, assumptions, minimal fix와 역할이 필요합니다.

## 이미지 전문 역할 레지스트리

| 역할 ID | 책임 | 경계 |
| --- | --- | --- |
| `art-brief-director` | art brief, prompt constraint, character/NPC/monster-boss/skill-VFX/environment/item/UI/story/key-art/document 요구사항 검토 | 일반 역할 priority/merge registry를 바꾸지 않고 approval authority가 없음 |
| `visual-asset-reviewer` | 가독성, provenance, Skillstead 증거와 rights/privacy 누락 검토 | immutable receipt 또는 사람의 document/production decision을 대신하지 않음 |

일반 역할 registry와 image specialist registry는 의도적으로 분리됩니다. 기존 7개 일반 역할의 병합 순서와 권한은 그대로이며, image specialist는 image workflow에만 명시적으로 연결됩니다.

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
| `vision-pillars` | 플레이 경험의 약속, 설계 원칙, 하지 않을 설계 원칙, 성공 신호 |
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

## 활용 경로와 결과

### 가장 잘 맞는 사용자

Game Design Studio는 기획 입문 학생, 솔로·인디 개발자, 현업 기획자, 팀 리드·교육자·멘토가 아이디어·규칙·콘텐츠·UX·경제·제작 검토를 근거와 사람 결정이 남는 Artifact로 정리할 때 가장 잘 맞습니다. 결과는 재미, 시장성, 일정 또는 승인 결과를 보장하지 않으며, 검증할 가정과 owner를 남깁니다.

### 역량 중심

장르와 무관한 플레이 경험의 약속, 핵심 플레이 흐름, 규칙·상태, 사용자 경험, 콘텐츠, 경제와 검토 역량을 작은 실습부터 익힐 때 선택합니다. 사례 본문과 요청문은 아래 저장소 전용 경로에서 확인합니다.

### 콘셉트 중심

모바일 RPG, 협동 액션, 내러티브, 코지 게임처럼 장르·플랫폼·운영 제약이 같은 역량의 판단을 어떻게 바꾸는지 비교할 때 선택합니다. 콘셉트 사례는 관습을 정답으로 복제하지 않고 검증할 차이를 남깁니다.

### 스킬 중심

일반적인 작업은 스킬 이름을 고를 필요가 없습니다. `@Game Design Studio` 뒤에 만들고 싶은 결과와 가진 자료를 자연어로 적으면, 한 분야가 분명한 요청은 해당 전문 스킬로 보내고 여러 분야가 섞였거나 범위가 불명확한 요청은 오케스트레이터가 필요한 경로만 고릅니다. 작업이 끝나면 선택한 스킬과 검토 역할, 결과 파일, 남은 결정을 알려 줍니다. 이 자동 선택은 자동 승인이 아닙니다.

같은 경로를 다시 실행하거나 특정 단계부터 재개해야 할 때만 전문 스킬을 직접 호출합니다. 한 작업의 입력과 원하는 결과가 분명하면 `$game-design-studio:design-game-systems`처럼 해당 전문 스킬을 직접 지정할 수 있습니다. 복수 영역이 얽히거나 범위가 불명확하면 `$game-design-studio:orchestrate-game-design-project`로 실행 순서를 고정할 수 있습니다. 스킬 워크벤치는 직접 호출이 유용한 때와 다음 작업 인계를 비교합니다.

### 대표 작업 경로

아래 요약으로 목적을 고른 뒤 카드에서 입력, 흐름, 결과와 사람 검토 경계를 확인합니다. 기준 결과는 renderer나 image provider와 무관하게 Canonical Artifact에 남습니다.

| 목표 | 시작 스킬 |
| --- | --- |
| 규칙·핵심 루프 | `orchestrate-game-design-project` |
| 시스템 | `design-game-systems` |
| UX·접근성 | `design-player-experience` |
| 콘텐츠·퀘스트 | `design-game-content` |
| 경제·LiveOps | `design-game-economy-and-liveops` |
| 전체 프로젝트 | `orchestrate-game-design-project` |

### 규칙·핵심 루프

#### 준비 입력

- 선수 지식: 게임에서 확인한 사실과 자신의 해석을 분리하는 방법.
- 최소 입력: 아이디어 한 문장, 예상 대상, 플랫폼 가정, 원하는 감정, 알려진 제약, 실제 기획 책임자.
- 선택 입력: 인터뷰·플레이테스트 기록, 유사 경험 관찰, 기존 범위 결정. 제3자 자료는 출처와 이용 범위를 기록합니다.

#### 연결 흐름

`apply-document-quality-profile` → `define-game-vision` → 필요 시 `orchestrate-game-design-project` → `review-game-design` 순서입니다. 템플릿은 게임 방향 원칙(`vision-pillars`)과 게임 기획 요약서(`game-design-brief`)입니다. **역할 경계:** 문서 품질 검토자는 구조 누락을, 수석 게임 기획자와 콘텐츠·내러티브 기획자는 근거 연결 문제를, 제작 가능성 검토자는 범위 위험을 보고합니다. 전문 역할은 원본을 승인하거나 재작성하지 않고, 실제 기획 책임자가 설계 원칙과 이번에 다루지 않을 목표를 결정합니다.

#### 예상 결과

- 최소: `vision-pillars`, `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록.
- 선택: 검토 목적이 분명한 이미지 요청문 또는 근거가 연결된 도식 계획. 이미지 생성과 도식 변환 성공은 승인이 아닙니다.
- 확장: 사람 검토와 형식별 품질 확인을 통과한 팀 기획 요약서 또는 공개 가능한 판단 근거.

#### 사람 검토

- **읽는 순서:** `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`. 중간 결과에서는 플레이어에게 약속할 경험과 각 설계 원칙이 행동·선택·반응에 연결되는지 먼저 봅니다. **사람 결정:** 실제 기획 책임자가 대상 플레이어, 지킬 설계 원칙, 하지 않을 설계 원칙, 이번에 다루지 않을 목표와 다음 시험 제작 범위를 승인·수정·보류합니다. 스킬 실행, 검토 의견과 파일 생성은 자동 승인하지 않습니다.

### 시스템

#### 준비 입력

- 선수 지식: 입력·상태·출력을 분리하고 happy path만으로 완료하지 않는 태도.
- 최소 입력: system boundary, actor, input, precondition, authoritative state, 예상 output, 실패와 recovery, owner.
- 선택 입력: 기존 API/schema, concurrency 관찰, platform 상태, engineering·QA 질문. 실제 schema가 없으면 design meaning만 provisional로 둡니다.

#### 연결 흐름

`apply-document-quality-profile` → `design-game-systems` → `design-player-experience` → `review-game-design` 순서입니다. 템플릿은 `system-specification`, `rule-exception-matrix`, `data-schema-table-contract`입니다. **역할 경계:** `document-quality-editor`는 필수 계약, `system-economy-designer`는 rule·authority, `ux-accessibility-reviewer`는 feedback·recovery finding을 냅니다. design·engineering owner가 precedence와 runtime mapping을 결정합니다.

#### 예상 결과

- 최소: `system-specification`, `rule-exception-matrix`, `data-schema-table-contract`.
- 선택: 상태 관계가 prose보다 명확할 때만 source mapping이 있는 도식 계획.
- 확장: owner 결정과 test evidence가 연결된 개발·QA handoff.

#### 사람 검토

- **읽는 순서:** 시스템 경계 → 규칙표 → 예외표 → 데이터 관계 → 근거·결정 순서입니다. 중간 결과에서 규칙 ID마다 상태, 반응, 실패 처리와 시험 항목이 있는지 봅니다. **사람 결정:** 기획 책임자와 개발 책임자가 권한, 우선순위, 이전 방법과 되돌리기 기준을 승인합니다. 검토 의견과 자동 검사만으로 승인하지 않습니다.

### UX·접근성

#### 준비 입력

- 선수 지식: user goal과 system state를 분리하는 방법.
- 최소 입력: 대상 플레이어, critical actions, 화면·상태, 플랫폼, 입력 장치, feedback, recovery, owner.
- 선택 입력: current platform·accessibility 1차 근거, usability 관찰, device 제약, interruption 사례.

#### 연결 흐름

`apply-document-quality-profile` → `design-player-experience` → `review-game-design` → 설명 가치가 있을 때 `visualize-game-design` 순서입니다. 템플릿은 화면 흐름·상태표(`ui-ux-flow-state`)와 접근성·플랫폼표(`accessibility-platform-matrix`)입니다. **역할 경계:** 문서 품질 검토자는 구조를, 사용자 경험·접근성 검토자는 핵심 행동과 대체 경로를, 수석 게임 기획자는 목표 경험 연결을 검토합니다. 실제 접근성 책임자와 기획 책임자가 지원 범위와 진행을 막는 문제의 처리 방법을 결정합니다.

#### 예상 결과

- 최소: `ui-ux-flow-state`, `accessibility-platform-matrix`, `game-design-review`.
- 선택: source-backed interaction 도식 계획이나 검토용 화면 reference prompt.
- 확장: usability evidence와 사람 승인을 반영한 UX·QA handoff.

#### 사람 검토

- **읽는 순서:** 사용자 목표 → 핵심 행동표 → 상태 범위 → 플랫폼표 → 근거·결정 순서입니다. 중간 결과에서 로딩·빈 화면·오류·중단 상황과 대체 입력 누락을 먼저 봅니다. **사람 결정:** 접근성 책임자와 기획 책임자가 지원 플랫폼, 검증 방법과 진행을 막는 문제를 승인·수정·보류합니다. 화면 시안·문서 변환 도구·검토 결과는 자동 승인하지 않습니다.

### 콘텐츠·퀘스트

#### 준비 입력

- 선수 지식: 퀘스트 서술과 실행 상태를 구분하는 방법.
- 최소 입력: player purpose, entry condition, system/data IDs, 선택, consequence, state, reward, failure·recovery, owner.
- 선택 입력: tone 범위, production rate evidence, localization·accessibility 요구, 권리와 consent 근거.

#### 연결 흐름

`apply-document-quality-profile` → `design-game-content` → `design-game-systems` → `plan-game-production` → `review-game-design` 순서입니다. 템플릿은 `narrative-quest-npc`, `character-skill-combat-monster`입니다. **역할 경계:** `content-narrative-designer`는 choice·state, `lead-game-designer`는 목표 경험, `production-feasibility-critic`은 dependency·제작 근거 finding을 냅니다. 실제 content·rights·production owner가 결정을 내립니다.

#### 예상 결과

- 최소: `narrative-quest-npc`, `character-skill-combat-monster`, `game-design-review`.
- 선택: 승인 전 narrative image prompt 또는 source-backed quest flow 계획.
- 확장: system/data/production owner 검토를 통과한 콘텐츠 handoff.

#### 사람 검토·근거

- **읽는 순서:** purpose → entry/state → choice·consequence → dependency → production·rights evidence → decisions입니다. 중간 결과에서 연결되지 않은 system/data ID와 근거 없는 제작 비용을 blocker로 봅니다. **사람 결정:** content owner, system owner, production owner와 권리 담당자가 분기, 범위, provenance·consent를 승인합니다. 생성된 서사나 이미지가 자동 승인되지는 않습니다.

### 경제·LiveOps

#### 준비 입력

- 선수 지식: system boundary와 가정·evidence 구분.
- 최소 입력: resource IDs, source, sink, inventory/progression 의도, eligibility, hypothesis, control, guardrail, stop·rollback, owner.
- 선택 입력: current policy, consent basis, telemetry definition, tested rollback, prototype/simulation result. 실제 수치는 source locator와 freshness가 있을 때만 사용합니다.

#### 연결 흐름

`apply-document-quality-profile` → `design-game-economy-and-liveops` → `design-game-systems` → `review-game-design` 순서입니다. 템플릿은 `economy-balance`, `liveops-experiment-event`입니다. **역할 경계:** `system-economy-designer`는 value flow, `liveops-data-designer`는 experiment·telemetry, `ux-accessibility-reviewer`는 player protection finding을 제출합니다. 실제 economy·LiveOps·policy owner가 가격·확률·실험과 rollback을 결정합니다.

#### 예상 결과

- 최소: `economy-balance`, `liveops-experiment-event`, `game-design-review`.
- 선택: source-backed economy/experiment 관계 계획 또는 communication image prompt.
- 확장: current evidence, tested rollback과 사람 결정을 가진 운영 검토 패키지.

#### 사람 검토·근거

- **읽는 순서:** resource flow → progression/recovery → price·probability evidence → experiment → guardrail·rollback → decisions입니다. 중간 결과에서 source 없는 수치, 다중 변수, 복구 불가 변경을 blocker로 봅니다. **사람 결정:** economy, LiveOps, policy와 accessibility owner가 실험 실행·중단·rollback을 승인합니다. simulation, telemetry 수집과 reviewer 권고는 자동 승인하지 않습니다.

### 전체 프로젝트

#### 준비 입력

- 선수 지식: 앞선 사례 중 필요한 domain Artifact와 `content.md` 기준 원칙.
- 최소 입력: target experience, scope 후보, dependency, capacity evidence 또는 공백, owner, review 질문, image 목적, 요청 형식.
- 선택 입력: prototype result, measured throughput, rights·consent evidence, current renderer capability, 실제 named-human decision receipt.

#### 연결 흐름

`plan-game-production` → `review-game-design` → `plan-image-assets` → 필요할 때 `visualize-game-design` → `export-game-design-documents` 순서입니다. 템플릿은 `production-scope-risk`, `game-design-review`, `decision-change-log`입니다. **역할 경계:** `production-feasibility-critic`은 범위·출력 위험, `lead-game-designer`는 목표 연결, `art-brief-director`는 이미지 계획, `ux-accessibility-reviewer`는 접근성 finding을 제출합니다. 전문 역할과 자동화는 staffing, scope, 비용, 권리, 이미지 transition, document approval 또는 release를 결정하지 않습니다.

#### 예상 결과

- 최소: `production-scope-risk`, `game-design-review`, `export-preparation-manifest`에 해당하는 canonical 내용, finding과 renderer-neutral 준비 상태.
- 선택: mode와 receipt가 허용한 prompt·이미지, source-backed SVG·PNG, PDF·DOCX·PPTX 준비 job.
- 확장: 이름 있는 사람의 승인과 asset·format·visual QA evidence가 있는 전달 패키지.

#### 사람 검토·근거

- **읽는 순서:** `content.md → evidence.yml → decisions/ → assets/ → export-manifest.yml`. 중간 결과에서 blocker, capacity gap, image lifecycle, renderer capability와 형식별 QA를 따로 봅니다. **사람 결정:** production owner가 scope·kill, review decision owner가 finding disposition, rights/asset owner가 이미지 transition, export owner가 실제 format QA를 승인합니다. 생성, render, lint, reviewer finding과 state 문자열은 자동 승인하지 않습니다.

### 대표 요청과 예상 결과

아래 요청문은 그대로 복사해 시작할 수 있습니다. 결과는 사람 검토 전 초안이며, 실제 파일과 상태는 요청 범위·capability·승인에 따라 달라집니다.

| 사례 | 복사 가능한 요청 | 예상 결과 |
| --- | --- | --- |
| 새 게임 GDD | `$game-design-studio:orchestrate-game-design-project 4인 협동 탐험 게임의 대상 플레이어, 플레이 경험의 약속, 핵심 플레이 흐름, 제외 목표와 시험 제작 질문을 정리해.` | 게임 기획 요약서(`game-design-brief`)와 게임 방향 원칙(`vision-pillars`)을 담은 기준 기획 폴더 초안 |
| 시스템 명세 | `$game-design-studio:design-game-systems 장비 강화의 rule ID, state transition, precedence, exception과 data authority를 명세해.` | `system-specification`의 규칙·상태·예외·검증 표 |
| UX·접근성 | `$game-design-studio:design-player-experience 첫 세션의 critical action, 대체 입력, 오류 recovery와 접근성 검토를 연결해.` | `ui-ux-flow-state`와 접근성 검토 큐 |
| 콘텐츠·퀘스트 | `$game-design-studio:design-game-content 협동 복구 퀘스트의 목표, NPC state, choice와 consequence를 작성해.` | `narrative-quest-npc`의 quest state와 제작 handoff |
| 경제·LiveOps | `$game-design-studio:design-game-economy-and-liveops 토큰 source/sink, guardrail, stop 조건과 rollback 증거를 가정으로 정리해.` | `economy-balance`의 source/sink 가정과 guardrail·rollback 질문 |
| 제작 검토·출력 | `$game-design-studio:plan-game-production prototype scope, dependency, kill criteria와 review owner를 정리해.` | `production-scope-risk`의 scope·dependency·kill criteria 초안 |

### 결과를 읽고 검토하는 순서

Canonical Artifact는 다음 순서로 읽습니다. `content.md`가 유일한 내용 기준이며, 자산 또는 파생 형식 실패가 원본을 대체하지 않습니다.

```text
content.md
→ evidence.yml
→ decisions/
→ assets/
→ export-manifest.yml
```

### Repository checkout only guides

아래 문서는 이 패키지에 포함되지 않습니다. canonical git remote와 default branch가 정의되기 전에는 클릭 가능한 외부 URL이나 상대 Markdown 링크를 약속하지 않습니다. repository checkout only에서 다음 plain code path를 사용합니다.

| 문서 | repository checkout only path |
| --- | --- |
| Studio 활용 사례 인덱스 | `guides/game-design-studio/use-cases/README.md` |
| Studio 역량 사례 | `guides/game-design-studio/use-cases/competency-paths.md` |
| Studio 콘셉트 사례 | `guides/game-design-studio/use-cases/concept-scenarios.md` |
| Studio 스킬 워크벤치 | `guides/game-design-studio/use-cases/skill-workbench.md` |
| Studio FAQ | `guides/game-design-studio/faq.md` |
| 공통 결과물 카탈로그 | `guides/use-cases/output-catalog.md` |

### 패키지 내부 실행 계약

package-local 파일은 설치한 플러그인에서 바로 열 수 있습니다.

| 문서 | package-local 링크 |
| --- | --- |
| 시스템 스킬 계약 | [설치된 스킬](skills/design-game-systems/SKILL.md) |
| 시스템 템플릿 seed | [설치된 템플릿](assets/templates/system-specification/) |

## 이미지 asset workflow

설치된 plugin root `.env.example`만 안전하게 추적합니다. tracked `.env`나 어떤 문서에도 실제 `OPENAI_API_KEY`를 붙여넣지 마십시오. 로컬 작업공간 root의 비추적 `.env`는 다음 안전한 기본값을 참고합니다.

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_PROVIDER=codex-first
IMAGE_EMBEDDED_TEXT_LOCALE=none
# 다음 값은 IMAGE_PROVIDER=openai를 명시적으로 선택했을 때만 사용합니다.
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
OPENAI_API_KEY=
```

`IMAGE_GEN_MODE`는 정확히 `prompt-only`(기본값), `select`, `required`, `all`만 허용합니다. `IMAGE_PROVIDER=codex-first`는 API key가 있어도 available Codex/host `image_gen`을 먼저 쓰며 유료 API로 자동 전환하지 않습니다. `IMAGE_PROVIDER=openai`는 비용 안내와 현재 사용자 승인 뒤에만 선택합니다. 이미지 안 한글은 `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`과 `IMAGE_MODEL=gpt-image-2`가 필수입니다. 유료 quality는 `low`가 기본, `medium`은 선택된 마스터, `high`는 예외적인 영상 핵심 프레임·게임 원화에만 비용 승인 뒤 사용합니다.

| mode | 실행 | provider/실패 경계 |
| --- | --- | --- |
| `prompt-only` | 외부 호출 0회, 계획·prompt·placeholder 생성 | 안전한 기본값; 모든 실패와 무관하게 package 유지 |
| `select` | 실제 user stable IDs만 | 이름/순번/agent 추측은 안 되며 ordered IDs의 immutable receipt 전에는 호출 0회 |
| `required` | manifest의 required asset만 | 유한 declared count만 처리 |
| `all` | declared required/recommended/variant asset만 | 선언되지 않은 variant를 만들지 않음 |

모든 mode는 `assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`, expected count와 placeholders를 유지합니다. 지원 유형은 character, NPC, monster/boss, skill/VFX, environment/landmark, item/equipment, UI icon, story/storyboard, key art/pitch concept, document illustration/cover, Skillstead diagram입니다.

생성은 승인과 다릅니다. 승인 lifecycle은 `concept-draft → document-approved → production-candidate`이며 새 asset은 `concept-draft`로 시작합니다. 이름 있는 사람의 placement, alt text, evidence, rights/provenance 검토가 있어야 `document-approved`가 됩니다. 기술 적합성·게임 가독성·권리 검토가 더해진 상태가 `production-candidate`이며, **production-candidate는 release/legal/production approval이 아님**입니다. generated/host provenance와 applied model/quality는 host가 실제로 보고한 값만 기록합니다. 사람 검토는 저작권, 개인정보, 제3자 자료, 민감 정보, 접근성과 맥락을 별도로 확인합니다.

Skillstead SVG는 권위 있는 도식 원본입니다. 하나의 title/desc와 alt text를 제공하고 product wrapper lint, renderer, 정확한 @2x PNG, visual QA, evidence를 분리합니다. SVG/PNG가 생성됐다는 사실은 approval이 아닙니다. MD/PDF/DOCX/PPTX의 final derivative는 document-approved 이상 asset만 참조하고, PPTX는 독립 story와 visual QA를 별도로 통과해야 합니다.

`npm run smoke:image:live`는 한 장의 실제 외부 generation을 위한 explicit opt-in입니다. 기본 test, build, marketplace smoke는 no-network이며 이를 실행하지 않습니다. image capability가 없으면 plan만 남기고 capability를 확인합니다. renderer가 없으면 linted SVG와 실패 근거를 보존하고 PNG 성공을 주장하지 않습니다. manifest 또는 prompt가 없으면 `plan-image-assets`를 먼저 실행하고, select가 멈추면 실제 user stable IDs와 immutable receipt를 확인합니다.

## 사용 예시

다음 문장은 입력 예시입니다. 플러그인은 누락된 자료와 결정을 채우지 않고 Canonical Artifact에 공백과 담당자를 남깁니다.

### 새 GDD

> 4인 협동 탐험 게임의 새 GDD를 만들어 줘. 목표 플레이어, 원하는 감정, 핵심 플레이 흐름, 설계 원칙, 제작 범위와 제외 목표를 먼저 정의하고 PC·콘솔 품질 기준을 적용해. 검증하지 않은 수치는 미정으로 남겨 줘.

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

[visualize-game-design](skills/visualize-game-design/SKILL.md)는 spatial encoding이 실제로 관계를 더 명확하게 할 때만 Skillstead `svg-infographic` 0.10.0을 사용합니다. 지원 preset은 core/motivation loop, state/rule flow, economy source/sink, progression/lifecycle, production timeline/dependency, RACI/role flow입니다. 단순 목록은 본문이나 표로 유지합니다.

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

11개 source skill의 공식 구조를 확인합니다.

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

Game Design Studio 플러그인 코드와 이 프로젝트가 작성한 문서·템플릿·설정은 [MIT License](LICENSE)로 배포됩니다. 포함된 Skillstead `svg-infographic` 0.10.0은 Apache-2.0이며 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 패키지 안의 원본 라이선스가 적용됩니다. 사용자 제공 원문 49개는 MIT 대상에서 제외되고 재허가되지 않으며, 공개 재배포 권리가 문서별로 확인될 때까지 로컬·사설 사용 범위를 벗어나 배포할 수 없습니다.
