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
