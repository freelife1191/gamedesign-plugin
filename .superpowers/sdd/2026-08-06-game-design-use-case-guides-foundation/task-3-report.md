# Task 3 — Declarative Skillstead diagram builder

## 구현

- `tooling/lib/use-case-diagrams.mjs`는 `validateDiagramSource(source)`와 `renderDiagramSvg(source)`를 export합니다. 네 가지 고정 layout type을 검증하고, 모든 source 제어 문자열을 XML escape한 1400×900 접근 가능한 SVG를 만듭니다.
- `tooling/build-use-case-diagrams.mjs`는 `buildUseCaseDiagrams({ repoRoot, ids })`를 export하고 `--id`, `--check` CLI를 제공합니다. use-case manifest의 명시된 SVG/PNG path만 사용하며, Studio `run-skillstead.mjs` wrapper만 호출합니다.
- check mode는 OS temp directory에서 SVG/PNG를 렌더한 뒤 repository SVG byte equality와 PNG 구조·2800×1800 치수를 검증하고 temp를 삭제합니다.
- `guides/assets/use-case-diagram-sources.json`에 AUD-01부터 AUD-06까지 각 audience route의 learning-path source를 추가했고, manifest 경로에 6 SVG/PNG 쌍을 생성했습니다.

## 파일

- 생성: `tooling/lib/use-case-diagrams.mjs`, `tooling/build-use-case-diagrams.mjs`, `tests/unit/use-case-diagrams.test.mjs`
- 생성: `guides/assets/use-case-diagram-sources.json`, `guides/assets/use-cases/audiences/aud-01.{svg,png}` … `aud-06.{svg,png}`
- 수정: `package.json` (`build:guide-diagrams`, `check:guide-diagrams`)

## TDD RED → GREEN

1. `tests/unit/use-case-diagrams.test.mjs`를 production module 없이 먼저 추가했습니다.
2. `node --test tests/unit/use-case-diagrams.test.mjs`는 예상대로 `ERR_MODULE_NOT_FOUND`로 RED였습니다.
3. 최소 renderer/validator를 구현한 뒤 같은 test가 3/3 PASS가 되었습니다.
4. 첫 aud-01 build에서 wrapper lint가 detail text overflow 3 errors/1 warning을 보고했습니다. 글자 단위 two-line wrapping으로 수정한 뒤 aud-01 및 전체 6쌍 build가 통과했습니다.

## 검증 명령과 결과

- `node --test tests/unit/use-case-diagrams.test.mjs` → 3/3 PASS
- `npm run build:guide-diagrams -- --id aud-01` → 1 SVG, 1 PNG built
- `npm run build:guide-diagrams` → 6 SVG, 6 PNG built
- `node …/run-skillstead.mjs lint aud-01.svg … aud-06.svg` → `0 error(s), 0 warning(s) across 6 file(s)`
- `npm run check:guide-diagrams` → 6 SVG, 6 PNG checked; asset checksum unchanged across check mode
- PNG header/chunk check → 모든 PNG 2800×1800, final IEND chunk complete
- `npm run test:unit` → 346/346 PASS
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 9/9 PASS
- `git diff --check` → clean

## Visual render evidence

- Wrapper Chromium renderer의 `aud-01.png`과 5-card `aud-02.png`를 육안 검토했습니다.
- 2× PNG에서 카드 label/detail, 2px connector와 열린 V arrowhead, conclusion strip이 잘리고 겹치지 않으며 읽기 순서와 일치합니다.

## 우려 사항

- 현 Task는 audience 6개 source만 생성합니다. 후속 Studio/Career diagram source는 같은 schema와 기존 use-case manifest의 explicit output declaration을 추가해야 합니다.
