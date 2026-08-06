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

모든 node·connector·label·수치는 source locator가 필요합니다. SVG `<title>`/`<desc>`, lint, renderer identity, exact dimensions와 two-pass visual QA 없이는 verified가 아닙니다. 렌더와 reviewer 권고는 문서 승인도 아닙니다.

## 실패와 재개

lint·browser·render·pixel review 실패 시 canonical artifact와 통과한 SVG evidence를 보존하고 PNG 성공을 주장하지 않습니다.

```text
$game-design-studio:visualize-game-design 통과한 SVG와 source mapping을 보존하고, 이전 render 오류부터 같은 preset과 acceptance criteria로 재개해.
```
