# Game Design Plugin Suite

Game Design Plugin Suite는 게임을 만들기 위한 **Game Design Studio**와 게임 기획 경력을 준비하기 위한 **Game Design Career**를 독립 플러그인으로 제공합니다. 각 플러그인은 `content.md`를 내용 기준으로 하는 Canonical Artifact(기준 작업 폴더)에 근거, 결정, 자산과 형식별 상태를 함께 보존합니다. 처음 쓰는 용어는 [사용자 가이드 용어](guides/README.md#용어)에서 확인할 수 있습니다.

> 이 도구는 기획 판단과 근거 관리를 돕습니다. 재미·흥행·매출·채용 합격·법률 준수·플랫폼 승인 또는 사람의 승인을 보장하지 않습니다.

## 이 플러그인으로 할 수 있는 일

게임 기획 학생은 작은 규칙, 행동 루프, 시스템, UX를 관찰·설계·검토하는 데서 시작하고, 필요하면 제작 범위가 있는 전체 프로젝트로 넓힐 수 있습니다. 취업 준비에서는 공개 가능한 역기획, 포트폴리오 판단과 면접 근거를 별도 Career Artifact로 정리합니다. 먼저 [공통 활용 허브](guides/use-cases/README.md)에서 현재 목적을 고르고, [결과물 카탈로그](guides/use-cases/output-catalog.md)에서 최소·선택·확장 결과와 사람 검토 경계를 확인하세요.

모든 경로는 `content.md`와 `evidence.yml`을 보존합니다. SVG·PNG는 검토 가능한 도식 자산이고, MD는 renderer가 없어도 남습니다. PDF·DOCX·PPTX는 별도 renderer와 형식·visual QA가 확인된 뒤에만 파생 결과로 다룹니다.

## 사용자 유형별 추천 시작점

현재 상황에 맞는 [사용자 경로](guides/use-cases/audience-paths.md)를 선택합니다.

| 사용자 | 권장 시작 |
| --- | --- |
| [AUD-01 게임 기획 입문 학생](guides/use-cases/audience-paths.md#aud-01-게임-기획-입문-학생) | 규칙과 관찰 하나를 작은 기획 브리프로 만듭니다. |
| [AUD-02 게임 기획 취업 준비생](guides/use-cases/audience-paths.md#aud-02-게임-기획-취업-준비생) | 역할·역기획·포트폴리오 증거를 구분합니다. |
| [AUD-03 게임 기획 직무 전환자](guides/use-cases/audience-paths.md#aud-03-게임-기획-직무-전환자) | 전이 가능한 경험과 새 증거 과제를 분리합니다. |
| [AUD-04 솔로·인디 게임 기획자](guides/use-cases/audience-paths.md#aud-04-솔로인디-게임-기획자) | 범위·위험이 제한된 설계로 시작합니다. |
| [AUD-05 현업 게임 기획자](guides/use-cases/audience-paths.md#aud-05-현업-게임-기획자) | 시스템·콘텐츠·UX·경제 문제 하나를 검토합니다. |
| [AUD-06 팀 리드·교육자·멘토](guides/use-cases/audience-paths.md#aud-06-팀-리드교육자멘토) | 과제, 검토 기준과 피드백 흐름을 설계합니다. |

## 활용 방법 선택

공통 원리를 익히려면 역량 사례, 장르·목표 제약을 비교하려면 콘셉트 사례, 입력과 결과가 분명하면 직접 스킬을 선택합니다. 아래 대표 링크는 사례 전체 본문을 복제하지 않고 다음 학습 지점만 가리킵니다.

| 탐색 방식 | 기획 학생 중심 Studio 사례 | Career 사례 |
| --- | --- | --- |
| 규칙·루프·시스템 | [ST-C02 행동·핵심 루프](guides/game-design-studio/use-cases/competency-paths.md#st-c02-행동핵심-루프의미-있는-선택) · [ST-C03 규칙·상태·예외·데이터](guides/game-design-studio/use-cases/competency-paths.md#st-c03-규칙상태예외데이터) | [CA-T01 시스템 기획 입문 학생](guides/game-design-career/use-cases/concept-scenarios.md#ca-t01-시스템-기획-입문-학생) |
| UX와 콘텐츠 | [ST-C04 UI·UX·온보딩·접근성](guides/game-design-studio/use-cases/competency-paths.md#st-c04-uiux온보딩접근성) · [ST-C05 콘텐츠·퀘스트](guides/game-design-studio/use-cases/competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc) | [CA-C01 기획 직무와 전문 분야 탐색](guides/game-design-career/use-cases/competency-paths.md#ca-c01-기획-직무와-전문-분야-탐색) |
| 포트폴리오·역기획·면접 | [ST-C07 경제·밸런스·LiveOps](guides/game-design-studio/use-cases/competency-paths.md#st-c07-성장경제밸런스liveops) | [CA-C05 관찰 기반 역기획](guides/game-design-career/use-cases/competency-paths.md#ca-c05-관찰-기반-역기획) · [CA-C06 창작 기획 포트폴리오](guides/game-design-career/use-cases/competency-paths.md#ca-c06-창작-기획-포트폴리오) · [CA-C07 포트폴리오 검토·발표](guides/game-design-career/use-cases/competency-paths.md#ca-c07-포트폴리오-검토수정발표) · [CA-C08 면접·주니어 성장·직무 전환](guides/game-design-career/use-cases/competency-paths.md#ca-c08-면접주니어-성장직무-전환) |
| 전체 프로젝트 | [ST-C08 제작·검토·이미지·출력](guides/game-design-studio/use-cases/competency-paths.md#st-c08-제작검토이미지출력) | Career Artifact로 넘길 공개 가능한 문제·결정·검증 evidence를 분리합니다. |

**입문 요청문:** `관찰한 장면 하나를 사실·가정·질문으로 나누고, 규칙 하나를 설명하는 짧은 기획 브리프로 만들어 줘.`

**응용 요청문:** `이 시스템의 상태, 예외, UX 피드백과 검토할 반례를 표로 정리해 줘.`

**포트폴리오 요청문:** `공개 가능한 관찰을 역기획의 사실·추론·제안으로 분리하고, 개인 기여와 권리 검토가 필요한 항목을 남겨 줘.`

**전체 프로젝트 요청문:** `핵심 루프, 시스템, UX, 제작 범위와 검토 게이트를 하나의 제한된 게임 기획 프로젝트로 연결해 줘.`

## 어떤 플러그인을 설치할까

| 지금 하려는 일 | 설치할 플러그인 | 첫 결과 |
| --- | --- | --- |
| 게임 비전, 시스템, 콘텐츠, UX, 경제·LiveOps, 제작 계획을 실제 작업 문서로 연결 | Game Design Studio | 검토 가능한 게임 기획 Canonical Artifact |
| 역할 탐색, 채용 근거, 역기획, 포트폴리오, 면접, 성장 계획을 연결 | Game Design Career | 근거가 연결된 Career Canonical Artifact |
| 두 일을 각각 진행 | 둘 다 | 서로 섞이지 않는 두 작업 기준 |

각 제품에는 **제품 스킬 14개**와 번들 **Skillstead** 시각화 스킬 1개가 있어, 제품마다 총 **15개** 스킬이 설치됩니다. Skillstead는 별도 제품 기능이 아니라 편집 가능한 SVG 도식과 검증된 2× PNG를 만드는 공통 번들 스킬입니다.

[![Studio와 Career 선택·설치 흐름](guides/assets/shared/plugin-selection-flow.png)](guides/assets/shared/plugin-selection-flow.svg)

[편집 가능한 SVG 열기](guides/assets/shared/plugin-selection-flow.svg)

- [Game Design Studio 사용자 가이드](guides/game-design-studio/README.md)
- [Game Design Career 사용자 가이드](guides/game-design-career/README.md)
- [두 제품을 비교하는 전체 가이드](guides/README.md)

## 지원 환경

이 안내는 ChatGPT 데스크톱 앱의 **Work 또는 Codex**와 **Codex CLI**를 대상으로 합니다. IDE 확장, 모바일, 일반 Chat에서 플러그인을 사용할 수 있다고 가정하지 않습니다.

- App: 저장소를 로컬 프로젝트 또는 작업 폴더로 열고 Plugins에서 설치합니다.
- CLI: Node.js 18 이상과 `codex plugin` 명령을 지원하는 Codex CLI가 필요합니다.
- PDF·DOCX·PPTX·PNG는 해당 renderer capability와 형식별 QA가 있어야 합니다. capability가 없으면 기준 Markdown과 실패·차단 상태를 보존합니다.

App과 CLI의 설치·활성화 UI는 다릅니다. App에서 CLI의 `/plugins` 활성화 키를 사용하지 않으며, CLI 설치 뒤에는 App의 Plugins UI를 대신 사용하지 않습니다.

## Codex App 설치

1. 저장소 루트를 로컬 프로젝트 또는 작업 폴더로 엽니다.
2. `.agents/plugins/marketplace.json`의 top-level `name`이 `game-design-suite`인지 확인합니다.
3. ChatGPT 데스크톱 앱을 다시 시작한 뒤 **Codex**를 선택하거나 **ChatGPT → Work**를 켭니다.
4. **Plugins**에서 marketplace `game-design-suite`를 열고 필요한 제품을 설치합니다.
5. 설치 직후 **새 채팅**을 열고 `@Game Design Studio` 또는 `@Game Design Career`를 선택합니다.

제품별 화면 절차와 제거 방법은 [Studio App 설치](guides/game-design-studio/installation.md#codex-app-설치) 및 [Career App 설치](guides/game-design-career/installation.md#codex-app-설치)에 있습니다.

## Codex CLI 설치

저장소 루트에서 marketplace를 등록하고 목록을 확인합니다.

```bash
codex plugin marketplace add .
codex plugin marketplace list
```

필요한 제품 하나만 선택해 설치합니다.

**Studio만 설치**

```bash
codex plugin add game-design-studio@game-design-suite
```

**Career만 설치**

```bash
codex plugin add game-design-career@game-design-suite
```

둘 다 필요하면 위의 두 코드 블록 모두 실행합니다. 선택한 설치가 끝나면 상태를 확인합니다.

```bash
codex plugin list
```

`PLUGIN@MARKETPLACE` 선택자를 유지해야 합니다. 또는 CLI 세션에서 `/plugins`를 열고 `game-design-suite` 탭에서 설치할 수 있으며, 이 화면의 `Space`는 **CLI 전용 활성화 전환**입니다. 설치 확인은 `codex plugin list`에서 plugin ID, marketplace, 설치·활성 상태를 확인한 뒤 **새 세션**에서 스킬을 호출하는 것입니다.

Git marketplace의 `codex plugin marketplace upgrade game-design-suite`는 marketplace snapshot을 refresh할 뿐 설치된 플러그인을 교체하지 않습니다. 로컬 marketplace는 그 refresh 대상이 아니므로 checkout을 갱신·검증한 뒤 해당 제품을 제거하고 다시 설치합니다. 자세한 절차는 [Studio CLI 설치·업데이트](guides/game-design-studio/installation.md#codex-cli-설치)와 [Career CLI 설치·업데이트](guides/game-design-career/installation.md#codex-cli-설치)를 따르세요.

## 5분 빠른 시작

모르는 정보는 꾸며내지 말고 `미정`으로 남깁니다.

### Codex App

새 App 채팅에서 필요한 플러그인을 선택한 뒤 자연어 요청문을 복사합니다.

**Studio**

```text
@Game Design Studio 모바일 협동 RPG의 대상 플레이어, 핵심 재미, 세 가지 설계 원칙과 검증 기준을 게임 기획 브리프로 만들어줘.
```

**Career**

```text
@Game Design Career 시스템 기획과 콘텐츠 기획 중 목표가 아직 정해지지 않았어. 주 8시간, 솔로 프로토타입만 가능해. 두 경로의 교환조건과 공백을 비교하고 12주 증거 로드맵을 만들어줘.
```

### Codex CLI

설치 확인 뒤 새 CLI 세션에서 명시적 스킬 요청문을 복사합니다.

**Studio**

```text
$game-design-studio:orchestrate-game-design-project 모바일 협동 RPG 아이디어를 game-design-brief부터 검토 가능한 Canonical Artifact까지 진행해줘.
```

**Career**

```text
$game-design-career:orchestrate-game-design-career 시스템 기획자 취업을 위한 역할 선택, 역량 격차와 12주 증거 계획을 만들어줘.
```

명시적 스킬 호출, 예상 Artifact와 다음 요청은 [Studio 5분 빠른 시작](guides/game-design-studio/quick-start.md)과 [Career 5분 빠른 시작](guides/game-design-career/quick-start.md)을 사용합니다.

## 기획 문서 템플릿

모든 주요 결과는 `content.md`, `evidence.yml`, `decisions/`, `assets/`, `export-manifest.yml`을 가진 Canonical Artifact로 시작합니다. `content.md`만이 내용 기준이며, 대화·렌더 결과·생성 이미지가 이를 대체하지 않습니다.

| 제품 | 15개 Canonical Artifact 템플릿의 용도 | 전체 카탈로그 |
| --- | --- | --- |
| Studio | 비전, 시스템 명세, 콘텐츠·퀘스트, UX·접근성, 경제·LiveOps, 제작 범위와 검토 | [Studio 템플릿 15개](guides/game-design-studio/templates.md) |
| Career | 경력 단계·목표, 역량 gap, 공고 근거, 역기획, 포트폴리오, 면접과 성장 | [Career 템플릿 15개](guides/game-design-career/templates.md) |

작성 전에는 [Studio Quality Profile](guides/game-design-studio/document-quality.md) 또는 [Career Quality Profile](guides/game-design-career/document-quality.md)로 목적·청중·형식에 맞는 필수 섹션과 사람 승인 게이트를 선택합니다.

## 이미지와 도식화

이미지 계획·생성·검토와 구조 도식은 별도 단계입니다.

두 플러그인은 저장소 루트의 동일한 이미지 설정을 사용합니다. 최초 한 번 예제 파일을 복사한 뒤, 생성된 `.env`만 로컬에서 수정합니다.

```bash
cp .env.example .env
```

실제 API key가 들어 있는 `.env`는 Git에 추가하지 않습니다.

- `IMAGE_GEN_MODE`는 `prompt-only`, `select`, `required`, `all` 네 값만 허용합니다. 기본 `prompt-only`는 외부 호출 없이 prompt와 placeholder만 보존합니다.
- 비어 있지 않은 `OPENAI_API_KEY`가 있으면 OpenAI Images API만 사용합니다. 키가 없고 host image capability가 `available`일 때만 Codex/host 경로를 사용하며, `unknown` 또는 `unavailable`이면 prompt-only fallback을 유지합니다.
- 생성 파일은 자동 승인되지 않습니다. 이름 있는 사람이 placement, alt text, evidence, rights/privacy를 검토해 `document-approved` 이상으로 올려야 문서 파생본에 사용할 수 있습니다.
- 관계를 설명해야 할 때는 Skillstead가 editable SVG를 기준 자산으로 만들고, renderer와 QA가 가능할 때만 정확한 2× PNG를 파생합니다.

상세 정책은 [Studio 이미지 자산](guides/game-design-studio/image-assets.md), [Career 이미지 자산](guides/game-design-career/image-assets.md), [Studio 시각화](guides/game-design-studio/visualization.md), [Career 시각화](guides/game-design-career/visualization.md)에 있습니다.

## 문서 내보내기

MD·PDF·DOCX·PPTX는 문서 내보내기 lane이고 SVG·PNG는 시각화 lane입니다. 내보내기 준비 상태는 다음 의미를 갖습니다.

| 상태 | 의미 |
| --- | --- |
| `not-requested` | 요청하지 않은 형식 |
| `blocked` | Canonical validation 또는 필수 증거가 부족함 |
| `pending` | capability probe 전이거나 사용 가능한 capability 확인 뒤 준비 대기 |
| `unavailable` | probe가 해당 renderer capability 부재를 확인함 |

MD는 renderer capability와 무관하게 항상 사용할 수 있으며, `pending`에서 downstream validation `passed`로 전진합니다. PDF·DOCX·PPTX는 파일이 생기거나 renderer가 실행된 사실만으로 성공·QA 통과·승인이 되지 않습니다. renderer가 없거나 QA가 실패하면 fail-closed로 Canonical Artifact, 기존 검증 결과와 MD를 보존하고 실패한 형식만 재개합니다. [Studio 내보내기](guides/game-design-studio/exports.md)와 [Career 내보내기](guides/game-design-career/exports.md)에서 형식별 renderer fallback을 확인하세요.

## 상세 사용 가이드

| 가이드 | Studio | Career |
| --- | --- | --- |
| 설치·새 채팅/세션 | [설치](guides/game-design-studio/installation.md) | [설치](guides/game-design-career/installation.md) |
| 첫 Artifact | [5분 빠른 시작](guides/game-design-studio/quick-start.md) | [5분 빠른 시작](guides/game-design-career/quick-start.md) |
| 작업 순서·재개 | [전체 워크플로](guides/game-design-studio/workflow.md) | [전체 워크플로](guides/game-design-career/workflow.md) |
| 15개 스킬·15개 템플릿 | [스킬](guides/game-design-studio/skills/README.md) · [템플릿](guides/game-design-studio/templates.md) | [스킬](guides/game-design-career/skills/README.md) · [템플릿](guides/game-design-career/templates.md) |
| 목적별 레시피 6개 | [Studio 레시피](guides/game-design-studio/README.md#목적별-레시피) | [Career 레시피](guides/game-design-career/README.md#목적별-레시피) |

## 제한·개인정보·권리·사람 승인

- API key나 다른 secret은 prompt·문서·로그에 입력하지 않습니다.
- 개인정보, 실명, 연락처, 비공개 회사 자료는 원문으로 넣지 말고 익명화한 최소 정보만 사용합니다.
- 제3자 권리와 consent evidence, 출처·이용 목적·공개 범위를 기록합니다.
- 생성 자산과 renderer 결과는 자동 승인되지 않습니다. 권리·품질·배치·alt text를 검토한 이름 있는 사람의 승인이 필요합니다.
- 이 도구는 재미, 흥행, 매출, 채용·합격, 법률 준수 또는 플랫폼 승인을 보장하지 않습니다.

## 문제 해결

- 플러그인이 보이지 않으면 App은 Work/Codex의 Plugins인지, CLI는 `codex plugin marketplace list`와 `codex plugin list`인지 확인합니다.
- 설치했지만 호출되지 않으면 기존 대화를 계속 쓰지 말고 App은 **새 채팅**, CLI는 **새 세션**에서 확인합니다.
- 이미지·PNG·PDF·DOCX·PPTX가 없으면 capability와 manifest의 `blocked`/`unavailable` 원인을 확인하고, 기준 Markdown·SVG·기존 검증 결과는 덮어쓰지 않습니다.
- 개인정보, 비공개 회사 자료, 제3자 권리 또는 최신 근거가 부족하면 해당 claim·자산을 승인하지 않고 gap과 다음 검토 작업을 남깁니다.

증상별 안전 복구와 복사 가능한 재개 요청문은 [Studio 문제 해결](guides/game-design-studio/troubleshooting.md)과 [Career 문제 해결](guides/game-design-career/troubleshooting.md)을 참고하세요.

## 기술 문서·기여·라이선스

초보자 경로에 넣지 않은 source tree, build·release·검증 명령과 독립 패키지 구조는 다음 기술 문서에 보존합니다.

- [플러그인 스위트 아키텍처](architecture/plugin-suite.md)
- [지식·근거 아키텍처](architecture/knowledge-and-evidence.md)
- [내보내기 파이프라인](architecture/export-pipeline.md)
- [Studio 기술 README](plugins/game-design-studio/README.md)
- [Career 기술 README](plugins/game-design-career/README.md)

<details>
<summary>패키지 기술 inventory</summary>

## 설치된 top-level scripts

| 파일 | 역할 |
| --- | --- |
| `build-image-asset-plan.mjs` | profile과 artifact에서 image asset plan 생성 |
| `capability-probe.mjs` | 선택 renderer capability 점검 |
| `compile-image-prompts.mjs` | Markdown/JSON prompt package 생성 |
| `data-only-snapshot.mjs` | 신뢰 경계의 data-only snapshot 검증 |
| `generate-openai-images.mjs` | OpenAI Images API bounded adapter |
| `quality-source-anchors.mjs` | canonical quality source byte·semantic anchor |
| `resolve-quality-profile.mjs` | profile 선택·합성·manifest·상태 전이 |
| `run-image-asset-workflow.mjs` | image workflow composition |
| `stop-artifact-review.mjs` | one-retry Stop artifact review |
| `validate-artifact.mjs` | Canonical Artifact 검증 |
| `validate-image-assets.mjs` | image manifest/lifecycle 검증 |
| `validate-image-config.mjs` | redacted image configuration 검증 |
| `validate-quality-profile.mjs` | closed Quality Profile 검증 |
| `validate-reference-preset.mjs` | neutral reference preset 검증 |

## 설치된 document-quality 경로

아래 경로는 설치된 패키지에서 inspectable copies로 확인할 수 있습니다. Studio 17개와 Career 13개 profile catalog, additive overlay 3개, neutral reference preset 7개를 포함합니다.

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

neutral preset은 authoring-only source 귀속이나 공식 endorsement를 뜻하지 않습니다. 설치된 경로는 각 패키지의 inspectable copies이며 `plugins/game-design-studio/references/shared/document-quality/` 및 `plugins/game-design-career/references/shared/document-quality/`에서 확인할 수 있습니다.

</details>

기여 시에는 공통 변경을 `shared/`, 제품 변경을 `products/<product>/plugin/`에서 편집하고 `npm test`, `npm run validate`, `npm run build`로 독립 배포 스냅샷을 확인합니다. 프로젝트 코드·템플릿·문서는 MIT License이며, vendored Skillstead는 Apache-2.0입니다. 사용자 제공 원문과 제3자 자료의 권리는 각 권리자에게 남으므로 공개 재배포 전에 문서별 권리 근거를 확인해야 합니다.
