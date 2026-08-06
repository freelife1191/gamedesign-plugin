# visualize-career-roadmap

## 목적과 최종 산출물

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

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 시스템 기획 role requirement와 12주 evidence project dependency를 source ID로 연결해. preset 선택·제외 이유, editable SVG, 정확한 2× PNG와 two-pass QA evidence를 남겨.
```

## Codex CLI 요청 예시

```text
$game-design-career:visualize-career-roadmap artifact=artifacts/system-roadmap, relationship=learning-dependency, assets=svg,png
```

## 내부 진행 흐름

모든 preset의 relationship·selection question·exclusion condition을 비교하고 하나 또는 `null`을 고릅니다. product wrapper만 사용해 `node skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint path/to/diagram.svg`과 `node skills/visualize-career-roadmap/scripts/run-skillstead.mjs render path/to/diagram.svg path/to/diagram.png`을 실행합니다. `requested`, `planned`, `generated`, `linted`, `rendered`, `verified` 상태를 실제 command/file evidence로 각각 검증합니다.

## 생성 파일과 결과 구조

selection/exclusion record, quantitative claim evidence, SVG/PNG state, paths, commands/results, alt text, warnings와 next action을 반환합니다. editable SVG가 authority입니다. 예상 결과 요약: Career 관계를 왜곡하지 않는 접근 가능한 도식과 재현 가능한 evidence가 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 visualization이 profile을 바꾸지 않음`.
- Reviewer/role ID: `game-design-mentor`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

선택한 preset의 Skillstead diagram slot만 authoring하고 SVG/2× PNG를 검증합니다. portfolio illustration은 필요할 때만 image-assets lifecycle로 분리합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 bundled source lint와 machine-linted handoff에는 필요합니다. 없으면 OS와 신뢰 가능한 package manager 및 Node 18+ candidate를 확인하고 정확한 설치 명령을 제시한 뒤 명시적 승인을 받습니다. `curl | sh`를 쓰지 않고 elevated privilege를 알리며, 실패·구버전이면 다른 source 재시도에 새 승인을 받습니다. lint, exact dimensions, fit-to-page/close-up visual QA와 renderer evidence는 사람의 문서 승인이 아닙니다.

## 실패·fallback·재개 방법

승인 거절 또는 안전한 route 부재 시 manual source checklist를 수행하고 `render.sh`를 호출하지 않습니다. Node-free Chromium으로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 표시하지 않고 automated source lint 미실행을 기록합니다. Chromium도 없으면 SVG-only로 전달하고 automated source lint와 PNG visual verification이 모두 미실행임을 명시합니다.

```text
$game-design-career:visualize-career-roadmap 기존 SVG와 source mapping을 유지하고 승인된 fallback branch의 마지막 검증 단계부터 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Career export-career-documents로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-career:export-career-documents artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[템플릿 카탈로그](../templates.md), [export-career-documents 스킬](./export-career-documents.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
