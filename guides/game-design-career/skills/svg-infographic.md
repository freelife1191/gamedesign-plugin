# svg-infographic

## 목적과 최종 산출물

Career 구조를 위한 vendored Skillstead 0.8.3의 editable SVG authoring과 canonical Chromium 정확한 2× PNG workflow를 설명합니다.

## 사용할 때

- `visualize-career-roadmap`이 source mapping과 preset을 정한 뒤 구조 SVG를 직접 작성할 때
- flow, roadmap, dependency, qualitative matrix 또는 technical one-pager가 필요할 때

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

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

관계·흐름·상태·의존성이 prose보다 명확할 때 Skillstead 구조 도식을 만듭니다. 삽화·캐릭터·배경은 생성하지 않으며 필요 시 [이미지 자산 흐름](../image-assets.md)으로 분리합니다.

## 검토·승인 기준

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 source lint와 machine-linted handoff에는 필요합니다. 없으면 OS와 신뢰 가능한 package manager, Node 18+ candidate를 확인하고 정확한 설치 명령을 제시한 뒤 명시적 승인을 받습니다. `curl | sh`를 쓰지 않으며 elevated privilege를 알립니다. 설치 실패·구버전이면 다른 source 재시도 전에 새 승인을 받습니다. SVG/PNG는 권리·career evidence·문서 승인이 아닙니다.

## 실패·fallback·재개 방법

승인 거절 또는 안전한 route 부재 시 manual source checklist를 완료하고 `render.sh`를 호출하지 않습니다. Node-free Chromium으로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 쓰지 않고 automated source lint 미실행을 기록합니다. Chromium도 없으면 SVG-only로 전달하고 automated source lint와 PNG visual verification이 모두 미실행이라고 명시합니다.

```text
$game-design-career:svg-infographic 기존 editable SVG를 보존하고 승인된 fallback branch의 마지막 lint/render/visual QA 단계부터 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:svg-infographic 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [도식화 안내](../visualization.md), [이미지 자산 흐름](../image-assets.md), [문제 해결](../troubleshooting.md)
