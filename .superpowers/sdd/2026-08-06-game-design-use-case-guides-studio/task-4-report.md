# Task 4 실행 보고서

## Status

완료 — 직접 호출 계약, 15개 스킬 가이드, 워크벤치 라우터와 집중 계약 검증을 마쳤습니다.

## BASE / HEAD

- BASE: `26a44cbf92ebaadf7d52f3086cf7428c407c1995`
- 구현 HEAD: `85f043febe627e99fab25da8ba17f45dac95d320`

## 변경 파일

- `guides/game-design-studio/use-cases/skill-workbench.md` (신규)
- `guides/game-design-studio/use-cases/README.md`
- `guides/game-design-studio/skills/` 아래 15개 직접 호출 가이드
- `tests/contracts/user-guides-studio.test.mjs`
- `tests/contracts/user-guide-use-case-manifest.test.mjs`

## RED 증거

2026-08-06에 다음 명령을 실행했습니다.

```text
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
```

- Studio guide 계약: `apply-document-quality-profile: missing direct-use H3`로 1개 실패. 새 계약이 아직 없는 직접 호출 H3를 정확히 탐지했습니다.
- Manifest 계약: `ST-S01: direct-use heading exists`로 1개 실패. 매니페스트 anchor가 아직 실제 H3에 연결되지 않았음을 확인했습니다.

## GREEN 증거

- `node --test tests/contracts/user-guides-studio.test.mjs` → 12 passed / 0 failed.
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 22 passed / 0 failed.
- `git diff --check` → 출력 없음, exit 0.
- 각 가이드는 고정 H2 14개를 유지하면서 H3 `직접 호출 활용 — <skill>`에 직접 조건, 입문·응용·고급 요청문, Artifact 읽기 순서와 조건부 다음 handoff를 제공합니다.
- 워크벤치는 15개 설치 스킬을 오케스트레이션·도메인 설계·품질·검토·이미지·시각화·출력 lane으로 각각 한 번씩 연결합니다.

## 테스트 결과

- RED 실행: `user-guides-studio` 10 passed / 1 failed, `user-guide-use-case-manifest` 21 passed / 1 failed.
- GREEN 실행: `user-guides-studio` 12 passed / 0 failed, `user-guide-use-case-manifest` 22 passed / 0 failed.

## 우려사항

- 직접 호출 예시는 문서 계약이며 runtime 동작이나 이미지 provider 설정을 변경하지 않습니다.
- 이미지 mode(`prompt-only`/`select`/`required`/`all`), named human approval, Skillstead wrapper 및 renderer fallback 경계는 유지했습니다.

## Fix round 1

### Findings addressed

- 직접 호출 H4의 읽기 순서를 실제 canonical Artifact 경로(`content.md → evidence.yml → export-manifest.yml`)와 실제 image workflow 경로로 교정했습니다. 논리 output ID와 존재하지 않는 `*.yml`/디렉터리 경로는 파일처럼 제시하지 않습니다.
- image generation 증거는 실제 `assets/receipts/image-generation-<asset-id>-<attempt-id>.json`, named-human lifecycle decision은 실제 `decisions/image-review-<event-id>.json`으로 제한했습니다.
- export preparation은 `pending`/`unavailable`/`blocked`, 모든 실행 단계 `not-run`, null derivative와 빈 format evidence만 기록하도록 직접 요청과 읽기 순서를 고쳤습니다. generation·terminal validation·format QA는 downstream renderer-and-QA workflow로 분리했습니다.
- 워크벤치는 `prompt-only` 생성 없음, `select`의 stable-ID selection receipt, `required`/`all`의 finite generation과 named-human lifecycle promotion을 분리했습니다.
- `svg-infographic`의 Node 부재 fallback을 manual checklist → Node-free Chromium 2× PNG → Chromium 부재 시에만 SVG-only 순서로 명시했습니다.
- tests는 H4 본문 분리, 실제 output path, 조건+대상 handoff, closed lane map, 빈 `routing.routes`, wrong lane·unconditional handoff·invented path mutation을 검사합니다. `routing.skillIds` 기반 routed-set 검사는 제거했습니다.
- economy workbench의 피할 조건을 `근거 없이 KPI를 확정하려 할 때`로 좁혔습니다.

### Findings open

- 없음.

### RED evidence

```text
node --check tests/contracts/user-guides-studio.test.mjs
node --check tests/contracts/user-guide-use-case-manifest.test.mjs
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
```

- 새 강화 계약 직후 `user-guides-studio`는 12 passed / 2 failed였습니다. 실패는 `apply-document-quality-profile: canonical read order`(가짜 quality YAML 경로)와 export preparation의 `generation not-run` 누락이었습니다.
- manifest suite는 22 passed였고 새 empty `routing.routes` negative mutation은 의도대로 throw했습니다.

### GREEN evidence

```text
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
node --check tests/contracts/user-guides-studio.test.mjs
node --check tests/contracts/user-guide-use-case-manifest.test.mjs
git diff --check
```

- `user-guides-studio`: 14 passed / 0 failed.
- `user-guide-use-case-manifest`: 22 passed / 0 failed.
- 두 `node --check` 명령과 `git diff --check`: exit 0.

## Fix round 2

### Findings addressed

- export 직접 호출은 정상적으로 검증된 `pending` preparation job을 downstream renderer-and-QA workflow로 handoff하고, `unavailable`은 capability가 `available`로 바뀌었을 때만 preparation을 resume하도록 분리했습니다. 워크벤치도 `pending→downstream; unavailable→resume`으로 표시합니다.
- `svg-infographic`와 `visualize-game-design`의 직접 호출 읽기 순서는 Node 18+ packaged-wrapper evidence, Node-free Chromium의 manual checklist·직접 Chromium evidence, Chromium 부재 때만 SVG-only/PNG verification 미실행을 각각 구분합니다.
- `select`는 사용자가 제공한 ordered exact stable IDs로 선택하고 host adapter가 immutable selection receipt를 공급하도록 문장을 분리했습니다.
- tests는 pending/unavailable 반전, Node-free branch의 wrapper 재라벨, H4 evidence branch와 workbench lifecycle 경계를 직접 검사합니다.

### Findings open

- 없음.

### RED evidence

```text
node --check tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guides-studio.test.mjs
```

- 강화 계약 직후 `user-guides-studio`는 13 passed / 1 failed였습니다. 실패는 기존 export H4가 `renderer 또는 downstream workflow unavailable`만 downstream으로 보내어 정상 `pending` handoff trigger를 제공하지 않은 것이었습니다.

### GREEN evidence

```text
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
node --check tests/contracts/user-guides-studio.test.mjs
node --check tests/contracts/user-guide-use-case-manifest.test.mjs
git diff --check
```

- `user-guides-studio`: 14 passed / 0 failed.
- `user-guide-use-case-manifest`: 22 passed / 0 failed.
- 두 `node --check` 명령과 `git diff --check`: exit 0.
