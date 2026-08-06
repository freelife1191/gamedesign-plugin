# visualize-game-design

## 목적과 산출물

경제 flow와 system state처럼 공간 표현이 유용한 source-backed 관계를 accessible SVG와 정확한 2× PNG 증거로 만듭니다.

## 사용할 때

- loop, state transition, progression, source/sink, timeline, dependency와 role 구조를 설명할 때
- 문서·발표에 editable SVG와 검증된 PNG가 필요할 때

## 사용하지 않을 때

- 간단한 prose나 표가 더 명확할 때
- 통계 chart, character art, background scene illustration, marketing illustration, mascot 또는 logo에는 사용하지 않습니다.

## 필수 입력과 선택 입력

- 필수: validated artifact path/version, stable source IDs, 관계, audience, intent, language, ratio, output directory, acceptance criteria
- 선택: brief-first/source-first/research-first mode, 기존 SVG, requested assets와 review question
- source에 없는 node, edge, date나 statistic은 canonical evidence로 만들지 않습니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 검증된 economy section의 두 통화 source·sink와 system state만 source mapping해 도식화해. preset 선택 이유, editable SVG, 정확한 2× PNG와 two-pass QA 증거를 남겨 줘.
```

## Codex CLI 예시

```text
$game-design-studio:visualize-game-design artifact=artifacts/economy, sources=economy-flow,state-rules, relationship=source-sink-and-state, assets=svg,png
```

## 진행 흐름

diagram이 필요한지 먼저 판단하고 packaged preset 하나와 source mapping을 고릅니다. product wrapper를 통해 vendored Skillstead를 lint/render하고 fit-to-page·close-up QA 뒤 evidence validator를 실행합니다. 주 profile은 현재 artifact 선택값, 관련 역할은 `lead-game-designer`와 필요한 reviewer 최대 2개, 다음 스킬은 `review-game-design` 또는 `export-game-design-documents`입니다.

## 결과와 파일

artifact `assets/`에 editable SVG, adjacent alt text, 검증 시 PNG와 execution evidence를 남깁니다. `requested`, `generated`, `linted`, `rendered`, `verified`는 별도 상태입니다. 예상 결과 요약: source 관계를 왜곡하지 않는 검증 가능한 도식이 생깁니다.

## 검토와 승인

모든 node·connector·label·수치는 source locator가 필요합니다. 먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 bundled source lint와 machine-linted handoff에는 필요합니다. Node가 없으면 OS와 신뢰 가능한 package manager를 확인하고 candidate가 Node 18+를 제공하는지 검증한 뒤 정확한 설치 명령을 제시합니다. 사용자에게 명시적 승인을 받기 전에는 설치하지 않고 `curl | sh`를 사용하지 않으며, elevated privilege가 필요하면 별도 승인을 요청합니다. 설치 뒤 version을 다시 확인하고 실패하거나 구버전이면 다른 source로 재시도하기 전에 다시 승인을 받습니다.

SVG `<title>`/`<desc>`, lint, renderer identity, exact dimensions와 two-pass visual QA 없이는 verified가 아닙니다. 렌더와 reviewer 권고는 문서 승인도 아닙니다.

## 실패와 재개

사용자가 Node 설치를 거절하거나 안전한 route가 없으면 manual source checklist를 완료하고 `render.sh`를 호출하지 않습니다. Node-free Chromium 경로로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 표시하지 않습니다. automated source lint 미실행, manual source checklist, PNG render/visual QA의 실제 상태를 각각 명시합니다.

Chromium도 없으면 SVG-only draft로 전달하고 automated source lint와 PNG visual verification이 모두 실행되지 않았다고 표시합니다. 그 밖의 lint·browser·render·pixel review 실패에서도 canonical artifact와 통과한 SVG evidence를 보존하고 PNG 성공을 주장하지 않습니다.

```text
$game-design-studio:visualize-game-design 기존 SVG와 source mapping을 보존하고 Node 18+ 설치 승인 여부와 Chromium availability를 확인해. 선택된 fallback branch의 마지막 검증 단계부터 재개해.
```
