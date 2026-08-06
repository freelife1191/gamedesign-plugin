# orchestrate-game-design-project

## 목적과 최종 산출물

신규 모바일 협동 RPG처럼 여러 영역이 섞인 요청을 bounded brief, 최소 스킬 체인, Canonical Artifact와 완료 게이트로 라우팅합니다.

## 사용할 때

- 비전, 시스템, 콘텐츠, UX, 경제와 생산 범위가 함께 필요할 때
- intent가 불명확하거나 launch readiness 조정이 필요할 때

### 직접 호출 활용 — orchestrate-game-design-project

#### 직접 호출 조건

여러 도메인과 completion gate를 하나의 bounded brief로 묶어야 할 때 직접 호출합니다. 한 가지 output과 입력이 분명하면 해당 specialist를 직접 호출합니다.

#### 입문 요청문

```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/island/brief 아이디어, 대상, 플랫폼, 제약과 decision owner를 받아 최소 route와 completion gate를 정해.
```

#### 응용 요청문

```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/island/brief ST-C08의 제작·검토·이미지·출력 범위를 나누고 선택된 route와 최대 3개 reviewer finding을 기록해.
```

#### 고급 요청문

```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/island/brief 기존 Canonical Artifact를 보존하고 blocked gate만 재개하며 routing.json의 한 route씩만 실행해.
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → export-manifest.yml` 순서로 읽습니다. route·role·gate의 실제 보조 기록은 존재할 때만 `decisions/`, `assets/`에서 확인하며, `game-design-brief`와 `canonical-artifact`는 파일명이 아니라 Artifact의 논리 결과입니다. 사람의 승인과는 별개입니다.

#### 다음 스킬 조건

선택된 route가 vision·systems·content·player-experience·economy/liveops·production·review·visualization·export 중 하나일 때만 같은 route의 `$game-design-studio:<selected-skill>`을 호출합니다.

## 사용하지 않을 때

- 목적이 한 영역으로 확정되었으면 해당 specialist skill을 직접 사용합니다.
- 알려지지 않은 intent를 임의 specialist로 추측하지 않습니다.

## 필수 입력과 선택 입력

- 필수: 게임 아이디어, 목표 산출물, 대상, 결정 owner, 알려진 제약
- 선택: 기존 artifact, 원하는 형식, 이미지 요구, 검토 질문, 출시 gate
- 안전한 가정은 표시하고 결과를 바꾸는 질문만 남깁니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 신규 모바일 4인 협동 RPG의 전체 기획을 라우팅해. vision, 핵심 시스템, 첫 세션, 경제, vertical slice와 검토 gate를 하나의 Canonical Artifact 체계로 연결해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:orchestrate-game-design-project 신규 모바일 협동 RPG의 brief, 최소 domain routes, artifact/profile, 최대 3개 review role과 completion gate를 정해.
```

## 내부 진행 흐름

intake를 정리하고 `routing.json.routes`의 exact route와 artifact를 고른 뒤 각 artifact에 quality profile을 적용합니다. 한 실행에서는 선택된 route만 호출하며, 필요하면 이미지 계획을 생성보다 먼저 실행하고 최대 3개 역할 finding을 결정적으로 병합합니다. 주 템플릿/profile은 `game-design-brief`/`game-design-brief`, 관련 역할은 `lead-game-designer`를 포함한 범위별 최대 3개입니다.

각 selected route는 아래 같은 행의 CLI handoff 하나에만 결합됩니다.

| routing.json route 조건 | 다음 CLI handoff |
| --- | --- |
| `vision` | `$game-design-studio:define-game-vision` |
| `systems` | `$game-design-studio:design-game-systems` |
| `content` | `$game-design-studio:design-game-content` |
| `player-experience` | `$game-design-studio:design-player-experience` |
| `economy` 또는 `liveops` | `$game-design-studio:design-game-economy-and-liveops` |
| `production` | `$game-design-studio:plan-game-production` |
| `review` | `$game-design-studio:review-game-design` |
| `visualization` | `$game-design-studio:visualize-game-design` |
| `export` | `$game-design-studio:export-game-design-documents` |

## 생성 파일과 결과 구조

Canonical Artifact의 `content.md`, `evidence.yml`, `decisions/`, `assets/`, `export-manifest.yml`과 route·role·gate·next owner를 기록합니다. 예상 결과 요약: 복합 요청이 검증 가능한 순서와 책임 경계로 나뉩니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `game-design-brief` — [game-design-brief 템플릿](../templates.md#game-design-brief).
- Quality Profile ID: `game-design-brief`.
- Reviewer/role ID: `lead-game-designer · production-feasibility-critic`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

초기 brief의 `design-context-image` slot이 명시된 경우에만 image plan으로 넘깁니다. 전체 workflow 관계는 `skillstead-design-flow-diagram`이 decision 흐름을 더 명확히 할 때만 Skillstead로 만듭니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

가정, 미해결 질문, blocked gate, capability 부재를 그대로 보고합니다. profile은 질문과 gate를 추가할 뿐 사실을 발명하지 않으며, 모든 applicable gate는 승인되거나 명시적으로 blocked여야 합니다.

## 실패·fallback·재개 방법

optional review, visualization, image 또는 export가 실패해도 canonical Markdown과 통과한 증거를 보존합니다.

```text
$game-design-studio:orchestrate-game-design-project 기존 Canonical Artifact와 route 기록을 유지하고, blocked gate와 실패한 optional 단계만 마지막 검증 증거부터 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 조건부 다음 handoff**

`<selected-skill>`은 routing record의 실제 skill ID로 바꿉니다. 목표·핵심 재미가 미확정이면 vision, 시스템 범위면 systems, 형식 전달만 남았으면 export처럼 조건에 맞는 **하나의** route만 이어 진행합니다.

```text
$game-design-studio:define-game-vision artifact=<artifact-path> vision uncertainty가 있을 때만 진행해.
```

```text
$game-design-studio:design-game-systems artifact=<artifact-path> 시스템 범위가 이미 확정됐을 때만 진행해.
```

```text
$game-design-studio:export-game-design-documents artifact=artifacts/approved-gdd 승인 가능한 artifact에 요청 형식이 남았을 때만 진행해.
```

```text
$game-design-studio:<selected-skill> artifact=artifacts/<artifact-id> routing.json.routes에서 선택한 skill ID로 바꿔 한 route만 실행해.
```

## 관련 문서

[game-design-brief 템플릿](../templates.md#game-design-brief), [스킬 선택표](README.md), [문서 placeholder 규칙](../../README.md#용어), [제품 workflow](../workflow.md)
