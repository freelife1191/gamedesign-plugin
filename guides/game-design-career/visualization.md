# Career 시각화

Career 도식은 role, competency, learning, portfolio와 growth 관계가 prose나 표보다 분명할 때만 사용합니다. `visualize-career-roadmap`이 preset과 source mapping을 고르고 vendored Skillstead가 SVG를 authoring·lint·render합니다.

[![Career 역할·학습 로드맵 예시](../assets/game-design-career/role-gap-learning-roadmap.png)](../assets/game-design-career/role-gap-learning-roadmap.svg)

## Preset 선택

| Preset | 관계 | 제외 조건 |
| --- | --- | --- |
| `role-map` | 역할군·책임·evidence·adjacent path mapping | 단일 역할을 prose로 충분히 설명할 수 있음 |
| `competency-map` | 역량 간 dependency/support | unordered checklist뿐임 |
| `learning-roadmap` | evidence task의 prerequisite·phase sequence | duration·order·prerequisite 근거가 없음 |
| `development-process` | handoff·feedback·decision·gate sequence | 의미 있는 handoff/branch가 없음 |
| `portfolio-information-architecture` | navigation·case nesting·evidence placement hierarchy | 짧은 ordered section list가 동일하게 명확함 |
| `growth-path` | multiple provisional paths·gap·review point mapping | source가 한 행동만 지지하거나 보장된 progression처럼 보임 |

각 preset의 selection question과 exclusion condition을 모두 비교하고 `selectedPresetId`, rationale와 모든 excluded preset 이유를 기록합니다. quantitative bar/line/scatter/heatmap은 data-accurate chart workflow로 보냅니다.

## Evidence boundary

모든 node, connector, label과 qualitative order는 stable source locator를 가집니다. 현재 role/posting/tool claim에는 사실·추론·제안, 검색일, 지역, 표본과 generalization limit을 유지합니다. number·score·duration은 source, baseline, owner, validation이 모두 없으면 비워 두며 layout으로 hiring probability, competency level 또는 progress를 암시하지 않습니다. 합격을 보장하지 않습니다.

editable SVG가 authority이며 root direct child인 nonempty `<title>`과 `<desc>`, matching `aria-label`, adjacent alt text를 가집니다. active `<script>`/`<style>` element와 invalid XML character는 거부합니다.

## Product wrapper

vendored path를 직접 호출하지 않고 product wrapper를 사용합니다.

다음 명령은 **저장소 루트**에서 실행합니다.

`path/to/diagram.svg`와 `path/to/diagram.png`는 실제 파일 경로로 바꾸는 교체 placeholder입니다.

```bash
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint path/to/diagram.svg
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs render path/to/diagram.svg path/to/diagram.png
```

command, exit result, file/digest, linter/renderer identity, Chromium executable/version, viewBox와 exact dimensions를 보존합니다. PNG는 정확한 2× PNG여야 하며 fit-to-page와 close-up visual QA를 모두 통과해야 합니다.

## Node.js 18+ 부재 시 fallback

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 bundled source lint와 machine-linted handoff에는 필요합니다.

Node가 없으면 OS와 신뢰 가능한 package manager를 확인하고 candidate가 Node 18+를 제공하는지 검증합니다. 정확한 설치 명령을 제시한 뒤 명시적 승인 전에는 설치하지 않습니다. `curl | sh`를 금지하고 elevated privilege가 필요하면 알립니다. 설치 뒤 version을 확인하며 실패·구버전이면 다른 source로 재시도하기 전에 새 승인을 받습니다.

사용자가 거절하거나 안전한 route가 없으면 manual source checklist를 완료하고 `render.sh`를 호출하지 않습니다. 문서화된 Node-free Chromium 경로로 정확한 2× PNG와 visual QA를 수행하되 machine-linted라고 표시하지 않습니다. automated source lint 미실행, checklist와 render/QA 상태를 각각 기록합니다.

Chromium도 없으면 SVG-only draft를 전달하고 automated source lint와 PNG visual verification이 모두 미실행이라고 명시합니다.

## 상태와 승인

`requested`, `planned`, `generated`, `linted`, `rendered`, `verified`는 독립 상태입니다. command가 계획되었다고 실행된 것이 아니며 render가 사람의 문서·권리 승인이 아닙니다. 실패하면 canonical artifact와 통과한 SVG evidence를 보존합니다.

## 복사 가능한 요청문

```text
@Game Design Career fresh evidence에 연결된 시스템 기획 competency와 12주 proof project dependency만 도식화해. preset 선택·제외 이유, editable SVG, 정확한 2× PNG와 two-pass QA evidence를 남겨.
```
