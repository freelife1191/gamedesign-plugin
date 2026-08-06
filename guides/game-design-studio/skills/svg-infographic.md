# svg-infographic

## 목적과 산출물

고급 사용자가 구조적 SVG를 직접 authoring하고 canonical Chromium renderer로 정확한 2× PNG를 만드는 vendored Skillstead 0.8.3 레퍼런스입니다.

## 사용할 때

- `visualize-game-design`이 preset과 source mapping을 먼저 선택한 뒤 세부 구조를 직접 authoring할 때
- topology, flow, layer, roadmap, qualitative matrix와 technical one-pager가 필요할 때

## 사용하지 않을 때

- 일반적인 Studio 작업에서는 product wrapper를 우선합니다.
- character art, background scene illustration, mascot, logo, photo-heavy graphic 또는 data-accurate statistical chart를 대체하지 않습니다.

## 필수 입력과 선택 입력

- 필수: visual intent, audience, ratio, language, 구조, project 내부 output directory
- 선택: brief/source/research-first mode, brand color, dark mode, sketch preset, SVG-only 여부
- source-first이면 핵심 메시지를 합의하고 box-by-box transcription을 피합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio product wrapper가 고른 state-rule-flow preset과 source mapping을 유지해서 고급 구조 SVG를 작성해. exact 2× PNG render와 fit-to-page·close-up QA까지 수행해.
```

## Codex CLI 예시

```text
$game-design-studio:svg-infographic source-mapped system state flow를 1400×900 editable SVG로 작성하고 canonical renderer로 exact 2× PNG를 검증해.
```

## 진행 흐름

archetype과 authoring reference를 읽고 숫자 layout을 먼저 계산합니다. SVG에 `<title>`/`<desc>`와 planned `<tspan>`을 작성하고 source lint 후 canonical Chromium renderer로 2× 렌더한 다음 두 번의 pixel QA를 합니다. 관련 역할은 Studio wrapper의 `lead-game-designer`; 주 profile/template은 wrapper가 선택한 artifact; 다음 스킬은 `visualize-game-design` evidence validation입니다.

## 결과와 파일

editable SVG가 authority이고 PNG는 derivative입니다. renderer executable/version, lint·render 명령, exact dimensions와 QA 결과를 handoff합니다. 예상 결과 요약: 구조 도식의 원본과 재현 가능한 렌더 증거가 생깁니다.

## 검토와 승인

Node 18+와 Chromium availability를 확인합니다. lint warning은 의도적으로 처리하며 PNG만 patch하지 않습니다. 생성된 SVG/PNG는 artifact, 이미지 권리 또는 사람 승인 증거가 아닙니다.

## 실패와 재개

browser가 없으면 SVG-only limitation을, sandbox launch가 막히면 동일 render command를 보존합니다. 다른 renderer를 Chromium 결과로 표시하지 않습니다.

```text
$game-design-studio:svg-infographic 기존 editable SVG와 lint 결과를 보존하고, 기록된 canonical render command부터 다시 실행해 exact 2× PNG와 two-pass QA를 재개해.
```
