# Task 5 보고서 — 공통 게임 기획 기억 스킬 패키징

## RED → GREEN

- RED: `node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs`에서 43개 중 4개가 실패했다. 새 memory fixture와 temporary product contract의 핵심 신호는 `Unknown shared module: memory`였고, 설치 skill·schema path 계약도 아직 충족하지 못했다.
- GREEN: `memory`를 허용 module·product schema·두 제품 contract에 등록하고, 모든 shared mapping을 array-of-tuples로 일반화했다. memory는 skills, schema, references, templates의 네 destination에 각각 설치되며 기존 collision, symlink, `.env` fail-closed 경계는 유지된다.
- GREEN: temporary Studio/Career build는 source skill 15개 + shared skill 6개 = 설치 skill 21개를 검증한다. `memory-receipt.schema.json` source bytes, index 10,000 entries, receipt 세 배열 256개와 두 routing의 exact workflow/owner 계약을 검증한다.
- GREEN: source와 packaged `safe-memory-store.mjs`의 import/외부 실행 금지 경계를 정적 검사하고, 빈 `PATH`, 존재하지 않는 `CC`/`CXX`의 child Node에서 sealed append 뒤 retry `present`를 실제로 통과했다.

## 스킬 검증

- `python3 .../skill-creator/scripts/quick_validate.py shared/memory/skills/retrieve-approved-design-memory` → `Skill is valid!`
- `python3 .../skill-creator/scripts/quick_validate.py shared/memory/skills/capture-game-design-memory` → `Skill is valid!`
- `python3 .../skill-creator/scripts/quick_validate.py shared/memory/skills/maintain-game-design-memory` → `Skill is valid!`
- 각 skill은 initializer로 생성한 뒤 `SKILL.md`만 남겼고, frontmatter는 `name`, `description` 두 key만 가진다.

## 검증

- `node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs` → 43 passed, 0 failed.
- `node --check tooling/lib/build-product.mjs` → success.
- `jq empty shared/contracts/product.schema.json products/game-design-studio/product.json products/game-design-career/product.json products/game-design-studio/plugin/references/routing.json products/game-design-career/plugin/references/routing.json` → success.
- `git diff --check` → success.

## 변경 파일

- `shared/memory/skills/*/SKILL.md`, `shared/memory/references/*.md`
- `tooling/lib/build-product.mjs`, `tooling/lib/product-contract.mjs`
- `shared/contracts/product.schema.json`, `shared/contracts/README.md`
- 두 제품의 `product.json`, `plugin/references/routing.json`
- `tests/unit/build-product.test.mjs`, `tests/contracts/shared-contract.test.mjs`

## 우려

- committed `plugins/*` snapshot과 aggregate snapshot test는 Task 8 전까지 의도적으로 수정하거나 실행하지 않았다.

## Fix round 1 — RED → GREEN

- Career routing RED: `node --test tests/contracts/shared-contract.test.mjs`는 `plannedPaths.skills`가 memory 3개만 포함하여 `skillIds` 20개와의 exact equality에서 실패했다. GREEN: `skills/<id>/SKILL.md` 20개를 `skillIds` 순서로 명시하고, exact set·NFC uniqueness 계약을 고정했다.
- Node-only runtime RED: 새 compilerless helper의 단일-build 인자 사용은 `Cannot read properties of undefined (reading 'outputDir')`로 실패했고, 그 뒤 실제 source graph는 `maintain-design-memory.mjs`의 `node:child_process`와 `exec("git", …)`를 검출했다. GREEN: 두 temporary product build와 source의 static import graph를 재귀 검사하고, child-process/git helper를 제거했다. 각 설치본은 빈 `PATH`, `/nonexistent/cc`, `/nonexistent/cxx`에서 sealed append `created`와 동일 retry `present`를 통과한다.
- Tuple mapping RED: 기존 테스트에는 memory 없는 fixture의 모든 기존 source→destination pair를 source bytes와 비교하는 독립 oracle이 없었다. oracle의 vendor destination 변이에서 `skills/svg-infographic/SKILL.md`가 `ENOENT`로 실패함을 확인했다. GREEN: knowledge, templates, responsible-design, export, vendor, archify, im-not-ai, document-quality, image-assets와 image-assets root example·archify lock·im-not-ai license까지 exact recursive byte oracle로 고정했다.
- Memory inventory RED: `shared/memory/references/unexpected.md`가 build에 허용되어 `Missing expected rejection`으로 실패했다. GREEN: skills의 정확한 세 `SKILL.md`, canonical schema 다섯 개, policy/lifecycle, intended templates 세 개만 허용하는 inventory를 build 전에 검사하고, output directory가 생기기 전에 거부한다.

## Fix round 1 검증

- `node --test tests/unit/build-product.test.mjs` → 43 passed, 0 failed.
- `node --test tests/contracts/shared-contract.test.mjs` → 1 passed, 0 failed. source + Studio/Career package import graph와 양 제품 compilerless sealed append smoke 포함.
- `node --test tests/unit/design-memory-maintenance.test.mjs` → 19 passed, 0 failed.
- 세 memory skill에 `quick_validate.py` → 모두 `Skill is valid!`.
- `node --check tooling/lib/build-product.mjs`, `node --check shared/scripts/maintain-design-memory.mjs`, `jq empty ...`, `git diff --check` → success.
- committed `plugins/*` snapshot과 aggregate snapshot test는 계속 수정하거나 실행하지 않았다.
