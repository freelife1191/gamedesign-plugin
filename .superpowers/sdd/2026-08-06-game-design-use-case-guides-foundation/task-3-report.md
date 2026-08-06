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

## Fix round 1 — content preservation and output containment

### 수정

- card label은 최대 20자, detail은 최대 22자로 validation합니다. 이 경계를 넘는 source는 명시적인 `card fit limit` 오류로 거부하며, 렌더러가 두 줄을 넘어 원문을 slice하거나 mask하지 않습니다. 현재 6개 source는 모두 제한 안에 있습니다.
- builder는 repository root를 canonicalize하고, output parent의 모든 기존 구성요소와 existing output file이 regular non-symlink인지 확인합니다. 각 existing directory/file은 `realpath`가 canonical root 아래인지 재검증합니다. 필요한 parent도 한 단계씩 생성 후 재검증합니다.
- check mode의 OS temporary root도 canonical non-symlink directory로 처리합니다. builder unit test는 임시 repo의 고정 Studio wrapper를 실제 subprocess로 실행합니다.

### TDD RED → GREEN

1. 긴 step detail fixture가 validator 오류를 내야 한다는 test와, repository output parent를 OS temporary directory로 symlink했을 때 외부 sentinel이 보존되어야 한다는 builder test를 먼저 추가했습니다.
2. RED: `node --test tests/unit/use-case-diagrams.test.mjs tests/unit/build-use-case-diagrams.test.mjs`는 8개 중 2개 실패였습니다. 긴 detail은 `Missing expected exception`, symlink case는 `Missing expected rejection`이었습니다.
3. card text limit validation과 canonical containment/symlink validation을 구현했습니다. OS `/var`→`/private/var` canonical alias를 테스트에서 발견해 요청 경로의 non-symlink 검증 후 canonical path를 containment root로 사용하도록 보정했습니다.
4. 후속 self-review에서 wrapper render 뒤 PNG output이 symlink로 교체될 수 있는 창을 발견해 그 회귀를 다시 RED(`Missing expected rejection`)로 고정하고, lint/render 직후 output을 다시 검증했습니다.
5. GREEN: renderer+builder test 10/10 PASS. warning summary, nonzero wrapper exit, corrupt PNG, rendered-output symlink, check-mode repository byte preservation, temporary render directory cleanup, OS temporary symlink escape 차단을 모두 실제 결과로 검증합니다.

### 검증

- `node --test tests/unit/use-case-diagrams.test.mjs tests/unit/build-use-case-diagrams.test.mjs` → 10/10 PASS
- `npm run build:guide-diagrams -- --id aud-01` → 1 SVG, 1 PNG built
- `npm run build:guide-diagrams` → 6 SVG, 6 PNG built
- `npm run check:guide-diagrams` → 6 SVG, 6 PNG checked; check test는 repository asset bytes 불변 및 temporary render directory ENOENT를 검증
- `npm run test:unit` → 353/353 PASS
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 9/9 PASS
- Studio wrapper 6-file lint → `0 error(s), 0 warning(s) across 6 file(s)`

### 우려 사항

- Node의 path API만으로 write 직전의 파일시스템 swap race를 완전히 제거할 수는 없습니다. 이 변경은 canonical root, 모든 existing parent/file의 `lstat` non-symlink 검사, `realpath` containment 재검증으로 일반적인 symlink escape를 fail-closed 처리합니다.
