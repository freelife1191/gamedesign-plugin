# visualize-career-roadmap

## 목적과 산출물

역할·역량·학습 dependency, portfolio structure 또는 growth path를 source-mapped editable SVG와 정확한 2× PNG evidence로 만듭니다.

## 사용할 때

- role path, competency dependency, learning sequence와 portfolio evidence 관계가 prose보다 명확할 때
- roadmap의 source·alt text·lint·render·visual QA 상태를 추적해야 할 때

## 사용하지 않을 때

- prose나 표가 더 명확하거나 bar/line/scatter/heatmap 등 data-accurate chart가 필요할 때
- layout·area·color로 hiring probability, competency level, progress 또는 기간을 암시할 때

## 필수 입력과 선택 입력

- 필수: audience, decision, source artifact/IDs, relationship, language, ratio, project 내부 output path와 alt text
- 선택: packaged preset, qualitative order와 quantitative claim evidence
- 숫자는 source, baseline, owner, validation이 모두 없으면 비워 둡니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 시스템 기획 role requirement와 12주 evidence project dependency를 source ID로 연결해. preset 선택·제외 이유, editable SVG, 정확한 2× PNG와 two-pass QA evidence를 남겨.
```

## Codex CLI 예시

```text
$game-design-career:visualize-career-roadmap artifact=artifacts/system-roadmap, relationship=learning-dependency, assets=svg,png
```

## 진행 흐름

모든 preset의 relationship·selection question·exclusion condition을 비교하고 하나 또는 `null`을 고릅니다. product wrapper만 사용해 `node skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint path/to/diagram.svg`과 `node skills/visualize-career-roadmap/scripts/run-skillstead.mjs render path/to/diagram.svg path/to/diagram.png`을 실행합니다. `requested`, `planned`, `generated`, `linted`, `rendered`, `verified` 상태를 실제 command/file evidence로 각각 검증합니다.

## 결과와 파일

selection/exclusion record, quantitative claim evidence, SVG/PNG state, paths, commands/results, alt text, warnings와 next action을 반환합니다. editable SVG가 authority입니다. 예상 결과 요약: Career 관계를 왜곡하지 않는 접근 가능한 도식과 재현 가능한 evidence가 생깁니다.

## 검토와 승인

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 bundled source lint와 machine-linted handoff에는 필요합니다. 없으면 OS와 신뢰 가능한 package manager 및 Node 18+ candidate를 확인하고 정확한 설치 명령을 제시한 뒤 명시적 승인을 받습니다. `curl | sh`를 쓰지 않고 elevated privilege를 알리며, 실패·구버전이면 다른 source 재시도에 새 승인을 받습니다. lint, exact dimensions, fit-to-page/close-up visual QA와 renderer evidence는 사람의 문서 승인이 아닙니다.

## 실패와 재개

승인 거절 또는 안전한 route 부재 시 manual source checklist를 수행하고 `render.sh`를 호출하지 않습니다. Node-free Chromium으로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 표시하지 않고 automated source lint 미실행을 기록합니다. Chromium도 없으면 SVG-only로 전달하고 automated source lint와 PNG visual verification이 모두 미실행임을 명시합니다.

```text
$game-design-career:visualize-career-roadmap 기존 SVG와 source mapping을 유지하고 승인된 fallback branch의 마지막 검증 단계부터 재개해.
```
