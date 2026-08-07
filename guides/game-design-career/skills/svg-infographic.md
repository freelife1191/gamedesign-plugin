# svg-infographic

## 목적과 최종 산출물

Career 구조를 위한 vendored Skillstead 0.8.3의 editable SVG authoring과 canonical Chromium 정확한 2× PNG workflow를 설명합니다.

## 사용할 때

- `visualize-career-roadmap`이 source mapping과 preset을 정한 뒤 구조 SVG를 직접 작성할 때
- flow, roadmap, dependency, qualitative matrix 또는 technical one-pager가 필요할 때

### Career 직접 호출 활용 — svg-infographic

#### 직접 호출 조건

하나의 source-mapped 구조 SVG와 검증 상태만 만들 때 직접 호출합니다. 여러 Career route와 source priority가 섞였을 때만 `$game-design-career:orchestrate-game-design-career`로 범위를 나눕니다. Node-free Chromium fallback을 보존합니다.

#### 입문 App 요청문

```text
@Game Design Career source ID가 있는 간단한 role dependency를 editable SVG로 작성해.
```

#### 입문 CLI 요청문

```text
$game-design-career:svg-infographic source=role-map output=artifacts/roadmap.svg
```

#### 응용 App 요청문

```text
@Game Design Career Skillstead source lint와 exact 2× PNG 검증 상태를 분리해.
```

#### 응용 CLI 요청문

```text
$game-design-career:svg-infographic source=competency-matrix output=artifacts/roadmap.svg
```

#### 고급 App 요청문

```text
@Game Design Career Node-free Chromium fallback의 manual source checklist와 visual QA를 기록해.
```

#### 고급 CLI 요청문

```text
$game-design-career:svg-infographic source=learning-roadmap fallback=chromium
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → decisions/ → export-manifest.yml` 순서로 읽습니다. `editable-svg`, `png-2x`, `render-evidence`를 반환합니다. 검토 owner: `game-design-mentor`.

#### 실패·재개와 다음 스킬 조건

Node 또는 Chromium fallback이 막히면 SVG source와 manual source checklist를 보존합니다. 재개: 마지막 Skillstead lint·render·visual QA 상태에서 재개합니다. relationship가 준비됐을 때만 `$game-design-career:visualize-career-roadmap`로 넘깁니다.

## 사용하지 않을 때

- 일반 Career 요청에서는 product wrapper를 우선합니다.
- photo/illustration-heavy graphic, mascot, logo, character art나 data-accurate statistical chart를 만들 때

## 필수 입력과 선택 입력

- 필수: visual intent, audience, ratio, language, structure, project 내부 output directory
- 선택: brief/source/research-first mode, brand color, dark mode, opt-in sketch preset, SVG-only 여부
- source-first는 핵심 메시지를 합의하고 box-by-box transcription을 피합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career source-mapped 역할·역량 dependency를 1400×900 editable SVG로 작성해. canonical Chromium 정확한 2× PNG와 fit-to-page·close-up QA까지 수행해.
```

## Codex CLI 요청 예시

```text
$game-design-career:svg-infographic source-mapped systems-designer roadmap를 editable SVG와 exact 2x PNG로 검증해.
```

## 내부 진행 흐름

archetype·authoring reference를 읽고 canvas, regions, grid, text budget와 connector corridor 수치를 먼저 계산합니다. `<title>`·`<desc>`와 planned `<tspan>`을 가진 SVG를 작성하고 source lint, canonical Chromium render, fit-to-page와 close-up pixel QA를 순서대로 수행합니다.

## 생성 파일과 결과 구조

editable SVG authority, derivative PNG, renderer executable/version, lint/render command, exact dimensions와 warning/QA disposition을 handoff합니다. 예상 결과 요약: Career structure의 수정 가능한 원본과 재현 가능한 렌더 증거가 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `no Canonical Artifact template` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `no Quality Profile: vendored Skillstead tool`.
- Reviewer/role ID: `game-design-mentor` (Career `visualize-career-roadmap` wrapper가 관계와 학습 맥락을 검토합니다).

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

이 도구는 structural SVG와 2× PNG에만 사용합니다. illustration lifecycle·portrait·scene을 생성하지 않으며 관계가 prose/표보다 분명할 때만 사용합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 source lint와 machine-linted handoff에는 필요합니다. 없으면 OS와 신뢰 가능한 package manager, Node 18+ candidate를 확인하고 정확한 설치 명령을 제시한 뒤 명시적 승인을 받습니다. `curl | sh`를 쓰지 않으며 elevated privilege를 알립니다. 설치 실패·구버전이면 다른 source 재시도 전에 새 승인을 받습니다. SVG/PNG는 권리·career evidence·문서 승인이 아닙니다.

## 실패·fallback·재개 방법

승인 거절 또는 안전한 route 부재 시 manual source checklist를 완료하고 `render.sh`를 호출하지 않습니다. Node-free Chromium으로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 쓰지 않고 automated source lint 미실행을 기록합니다. Chromium도 없으면 SVG-only로 전달하고 automated source lint와 PNG visual verification이 모두 미실행이라고 명시합니다.

```text
$game-design-career:svg-infographic 기존 editable SVG를 보존하고 승인된 fallback branch의 마지막 lint/render/visual QA 단계부터 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Career visualize-career-roadmap로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-career:visualize-career-roadmap artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[템플릿 카탈로그](../templates.md), [visualize-career-roadmap 스킬](./visualize-career-roadmap.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
