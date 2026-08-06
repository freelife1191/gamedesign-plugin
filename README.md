# Game Design Plugin Suite

Game Design Plugin Suite는 게임을 만들기 위한 **Game Design Studio**와 게임 기획 경력을 준비하기 위한 **Game Design Career**를 독립 플러그인으로 제공합니다. 각 플러그인은 `content.md`를 내용 기준으로 하는 Canonical Artifact에 근거, 결정, 자산과 형식별 상태를 함께 보존합니다.

> 이 도구는 기획 판단과 근거 관리를 돕습니다. 재미·흥행·매출·채용 합격·법률 준수·플랫폼 승인 또는 사람의 승인을 보장하지 않습니다.

## 어떤 플러그인을 설치할까

| 지금 하려는 일 | 설치할 플러그인 | 첫 결과 |
| --- | --- | --- |
| 게임 비전, 시스템, 콘텐츠, UX, 경제·LiveOps, 제작 계획을 실제 작업 문서로 연결 | Game Design Studio | 검토 가능한 게임 기획 Canonical Artifact |
| 역할 탐색, 채용 근거, 역기획, 포트폴리오, 면접, 성장 계획을 연결 | Game Design Career | 근거가 연결된 Career Canonical Artifact |
| 두 일을 각각 진행 | 둘 다 | 서로 섞이지 않는 두 작업 기준 |

각 제품에는 **제품 스킬 14개**와 번들 **Skillstead** 시각화 스킬 1개가 있어, 제품마다 총 **15개** 스킬이 설치됩니다. Skillstead는 별도 제품 기능이 아니라 편집 가능한 SVG 도식과 검증된 2× PNG를 만드는 공통 번들 스킬입니다.

[![Studio와 Career 선택·설치 흐름](guides/assets/shared/plugin-selection-flow.png)](guides/assets/shared/plugin-selection-flow.svg)

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

`<path-to-repository-root>`는 `.agents/plugins/marketplace.json`이 있는 실제 저장소 경로로 바꿉니다.

```bash
codex plugin marketplace add <path-to-repository-root>
codex plugin marketplace list
codex plugin list
codex plugin add game-design-studio@game-design-suite
```

Career도 필요하면 다음 선택자를 추가합니다.

```bash
codex plugin add game-design-career@game-design-suite
```

`PLUGIN@MARKETPLACE` 선택자를 유지해야 합니다. 또는 CLI 세션에서 `/plugins`를 열고 `game-design-suite` 탭에서 설치할 수 있으며, 이 화면의 `Space`는 **CLI 전용 활성화 전환**입니다. 설치 확인은 `codex plugin list`에서 plugin ID, marketplace, 설치·활성 상태를 확인한 뒤 **새 세션**에서 스킬을 호출하는 것입니다.

Git marketplace의 `codex plugin marketplace upgrade game-design-suite`는 marketplace snapshot을 refresh할 뿐 설치된 플러그인을 교체하지 않습니다. 로컬 marketplace는 그 refresh 대상이 아니므로 checkout을 갱신·검증한 뒤 해당 제품을 제거하고 다시 설치합니다. 자세한 절차는 [Studio CLI 설치·업데이트](guides/game-design-studio/installation.md#codex-cli-설치)와 [Career CLI 설치·업데이트](guides/game-design-career/installation.md#codex-cli-설치)를 따르세요.

## 5분 빠른 시작

아래 요청문 하나를 새 App 채팅 또는 새 CLI 세션에 복사하세요. 모르는 정보는 꾸며내지 말고 `미정`으로 남깁니다.

**Studio**

```text
@Game Design Studio 모바일 협동 RPG의 대상 플레이어, 핵심 재미, 세 가지 설계 원칙과 검증 기준을 게임 기획 브리프로 만들어줘.
```

**Career**

```text
@Game Design Career 시스템 기획과 콘텐츠 기획 중 목표가 아직 정해지지 않았어. 주 8시간, 솔로 프로토타입만 가능해. 두 경로의 교환조건과 공백을 비교하고 12주 증거 로드맵을 만들어줘.
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

파일이 생기거나 renderer가 실행된 사실만으로 성공·QA 통과·승인이 되지 않습니다. renderer가 없거나 QA가 실패하면 Canonical Artifact, 기존 검증 결과와 가능한 MD를 보존하고 실패한 형식만 재개합니다. [Studio 내보내기](guides/game-design-studio/exports.md)와 [Career 내보내기](guides/game-design-career/exports.md)에서 형식별 renderer fallback을 확인하세요.

## 상세 사용 가이드

| 가이드 | Studio | Career |
| --- | --- | --- |
| 설치·새 채팅/세션 | [설치](guides/game-design-studio/installation.md) | [설치](guides/game-design-career/installation.md) |
| 첫 Artifact | [5분 빠른 시작](guides/game-design-studio/quick-start.md) | [5분 빠른 시작](guides/game-design-career/quick-start.md) |
| 작업 순서·재개 | [전체 워크플로](guides/game-design-studio/workflow.md) | [전체 워크플로](guides/game-design-career/workflow.md) |
| 15개 스킬·15개 템플릿 | [스킬](guides/game-design-studio/skills/README.md) · [템플릿](guides/game-design-studio/templates.md) | [스킬](guides/game-design-career/skills/README.md) · [템플릿](guides/game-design-career/templates.md) |
| 목적별 레시피 6개 | [Studio 레시피](guides/game-design-studio/README.md#목적별-레시피) | [Career 레시피](guides/game-design-career/README.md#목적별-레시피) |

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

기여 시에는 공통 변경을 `shared/`, 제품 변경을 `products/<product>/plugin/`에서 편집하고 `npm test`, `npm run validate`, `npm run build`로 독립 배포 스냅샷을 확인합니다. 프로젝트 코드·템플릿·문서는 MIT License이며, vendored Skillstead는 Apache-2.0입니다. 사용자 제공 원문과 제3자 자료의 권리는 각 권리자에게 남으므로 공개 재배포 전에 문서별 권리 근거를 확인해야 합니다.
