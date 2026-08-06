# 게임 기획 시각화

도식은 prose보다 관계를 더 분명하게 할 때만 만듭니다. `visualize-game-design`이 preset과 source mapping을 먼저 선택하고, vendored Skillstead `svg-infographic`은 그 구조를 authoring·lint·render합니다.

## Diagram decision

loop, state transition, progression, economy source/sink, roadmap, dependency와 role 구조는 적합할 수 있습니다. 단순 목록은 본문이나 표로 유지합니다. 통계 정확성이 필요한 bar/line/scatter/heatmap은 chart capability를 사용합니다. character art, background scene illustration, mascot, logo와 marketing illustration에는 Skillstead를 사용하지 않습니다.

## Packaged preset

| Preset | 적합한 관계 | 부적합한 입력 |
| --- | --- | --- |
| `core-motivation-loop` | player action, feedback, reward, repeat driver | 근거 없는 sample loop, retention chart |
| `state-rule-flow` | state, precedence, transition, guard, recovery | source state나 precedence 없는 규칙 |
| `quest-content-progression` | quest stage, branch, gate, outcome, repeat path | 관계 없는 content list |
| `economy-source-sink` | currency source/sink, exchange, cap, ownership | canonical evidence 없는 가격·확률 |
| `liveops-roadmap` | dated phase, milestone, gate, rollback, owner | 발명한 일정, statistical chart |
| `production-role-structure` | role, dependency, handoff, milestone, escalation | 검증되지 않은 staffing estimate |

exactly one preset을 고르고 관계, source stable section, rejected alternative와 diagram이 필요한 이유를 기록합니다.

## Source mapping과 SVG authority

모든 node, connector, label, date와 numeric annotation을 source locator에 연결합니다. illustrative placeholder는 `illustrative`, `non-canonical`로 표시하고 verified completion에서 제외합니다. editable SVG가 authority이며 nonempty `<title>`, `<desc>`, adjacent alt text와 stable source mapping을 가집니다. PNG만 수정하지 않습니다.

## Lint와 render

product wrapper의 명령을 사용하고 vendored path를 직접 호출하지 않습니다.

```bash
node skills/visualize-game-design/scripts/run-skillstead.mjs lint <svg-path>
node skills/visualize-game-design/scripts/run-skillstead.mjs render <svg-path> <png-path>
```

lint는 command, exit code, log, linter identity/digest, SVG path/digest를 보존합니다. render는 canonical Chromium executable/version, renderer digest, command, exit code, SVG/PNG digest, viewBox와 actual dimensions를 보존하고 정확한 2× PNG인지 확인합니다.

## Node.js 18+ 부재 시 fallback

먼저 `node --version`으로 Node 18+인지 확인합니다. Node는 SVG authoring에는 필요하지 않지만 bundled source lint와 machine-linted handoff에는 필요합니다.

Node가 없으면 OS와 신뢰 가능한 package manager를 확인하고 candidate가 Node 18+를 제공하는지 검증합니다. 그 뒤 정확한 설치 명령을 제시하고 사용자에게 명시적 승인을 받기 전에는 설치하지 않습니다. `curl | sh`는 금지하며 elevated privilege가 필요하면 별도 승인을 요청합니다. 설치 뒤 version을 다시 확인합니다. 설치가 실패하거나 구버전이면 다른 source로 재시도하기 전에 다시 승인을 받아야 합니다.

사용자가 거절하거나 안전한 route가 없으면 manual source checklist를 완료하고 `render.sh`를 호출하지 않습니다. 문서화된 Node-free Chromium 경로로 정확한 2× PNG를 렌더하고 visual QA를 수행합니다. 이 결과를 machine-linted라고 표시하지 않으며 automated source lint 미실행, manual source checklist, PNG render/visual QA의 실제 상태를 명시합니다.

Chromium도 없으면 SVG-only draft를 전달하고 automated source lint와 PNG visual verification이 모두 실행되지 않았다고 표시합니다.

## Two-pass QA

1. fit-to-page에서 reading order와 주요 connector가 즉시 보이는지 확인합니다.
2. close-up에서 text/CJK, containment, arrow shaft/head, contrast, source fidelity와 alt text를 확인합니다.

`requested`, `generated`, `linted`, `rendered`, `verified`는 독립 상태입니다. lint·browser·render·pixel review가 실패하면 canonical artifact와 통과한 SVG를 보존하고 PNG는 `failed` 또는 `unavailable`로 남깁니다.

## 복사 가능한 요청문

```text
@Game Design Studio 검증된 system state와 recovery 관계만 source mapping해 적합한 preset을 골라. editable SVG, product wrapper lint, 정확한 2× PNG, fit-to-page와 close-up QA 증거를 남겨 줘.
```
