# Task 7 Report — Studio indexes and product README

## Status

Fix round 1 완료. Studio 가이드 인덱스는 사용자 유형, 역량·콘셉트·스킬 진입점, 직접 호출과 오케스트레이션 선택, 여섯 대표 사례의 구체적 결과를 짧은 표로 연결합니다. 제품 source README는 세 탐색 경로, 복사 가능한 대표 요청·결과와 Canonical Artifact 읽기 순서를 추가하며, 설치·workflow 기존 읽기 경로와 패키지 내부 링크를 유지합니다.

## BASE / HEAD

- BASE: `16a68ccacb494345aa570c5fe5099ee8bc316252`
- HEAD: Task 7 commit containing this report; commit 뒤 `git rev-parse HEAD`로 확인합니다.

## RED / GREEN

- RED: `node --test tests/contracts/user-guides-studio.test.mjs`는 `활용 사례와 진입점` 누락으로 실패했고, `node --test tests/products/studio/readme.test.mjs`는 `활용 경로와 결과` 누락으로 실패했습니다.
- GREEN: 두 focused suite는 각각 15/15, 14/14 통과합니다. target user, direct-skill/orchestrator 조건, 여섯 request/result, 네 Studio use-case 문서·FAQ·output catalog 링크, Canonical Artifact 읽는 순서를 검증합니다.
- Mutation coverage: case/output swap, direct/orchestrator 조건 반전, wrong-but-valid guide URL, repository-only 상대 링크를 모두 거부합니다.

## Links and package safety

- canonical git remote와 default branch가 없으므로 fabricated GitHub URL을 만들지 않습니다. 여섯 repository-only guide는 `repository checkout only` 표의 unlinked code path로만 안내합니다.
- package README는 `skills/design-game-systems/SKILL.md`와 `assets/templates/system-specification/`만 package-local 상대 링크로 별도 표에 둡니다. `../guides/...`처럼 source repository에서만 유효한 Markdown 링크와 `/tree/` URL은 계약 테스트가 거부합니다.

## Tests

- `node --test tests/contracts/user-guides-studio.test.mjs` → 15 passed, 0 failed.
- `node --test tests/products/studio/readme.test.mjs` → 14 passed, 0 failed.
- `node --check tests/contracts/user-guides-studio.test.mjs` → passed.
- `node --check tests/products/studio/readme.test.mjs` → passed.
- `git diff --check` → passed.

## Concerns

Open concerns: none. 생성 결과와 파생 형식은 사람 검토·승인 전 초안이며, package README는 저장소 가이드를 package-local 경로 또는 존재하지 않는 원격 URL로 가장하지 않습니다.

## Fix round 1 — checkout-only links and direct output ownership

- RED: product README focused test는 old GitHub `/tree/` URLs와 economy의 `economy-balance` + LiveOps experiment 동시 약속, production의 review/export-manifest 선취가 exact request/result contract와 불일치해 실패했습니다.
- GREEN: six repository-only guide는 각각 한 번의 plain code path로 `repository checkout only` 표에만 표시합니다. source README의 guide 링크는 그대로 두고, package-local skill/template 링크는 별도 표로 유지합니다.
- Output ownership: `design-game-economy-and-liveops` direct row는 source contract의 선택지 중 `economy-balance` 하나만 약속합니다. `plan-game-production` direct row는 source contract의 `production-scope-risk` 하나만 약속하며 review/export는 직접 결과로 말하지 않습니다.
- Contract coverage: fabricated `github.com/freelife/game-design-plugin`, `/tree/` file URL, repository-only relative Markdown link, missing/linked/nonexistent checkout path, command/result swap, economy two-output promise, production review/export preclaim을 거부합니다. checkout paths는 실제 repository guide heading을 읽어 확인합니다.

## Fix round 1 tests

- `node --test tests/products/studio/readme.test.mjs` → 14 passed, 0 failed.
- Fix round 1 handoff 전 `tests/contracts/user-guides-studio.test.mjs`, changed JavaScript `node --check`, `git diff --check`, `git show --check`를 다시 실행합니다.

## Fix round 2 — exact source identities and table ownership

- RED: checkout tuple에 expected H1을 요구한 뒤 current assertion은 첫 guide의 실제 `Game Design Studio 활용 사례`를 `undefined`와 비교해 실패했습니다. 기존 file-exists/임의 H1 검사는 valid-but-wrong guide identity를 구분하지 못했습니다.
- GREEN: six checkout tuple은 label, exact path, exact first H1을 함께 고정하고 실제 파일의 첫 H1과 strict 비교합니다. 두 H1 identity swap과 두 valid checkout path swap은 모두 production assertion에서 실패합니다.
- Source output contract: canonical SKILL.md의 `## Output contract` section에서 첫 문장을 exact 비교하고, `Produce … with stable sections for …` 문장의 허용 output set을 exact parse합니다. prefix `includes` 검사가 아니며 economy direct row는 allowed set 중 `economy-balance` 한 개, production direct row는 `production-scope-risk` 한 개만 backticked output으로 약속합니다.
- Table parsing: representative table row를 code-span 안의 `|`를 보존하는 3-cell parser로 읽습니다. economy와 production의 해당 row에서 command/result cell을 직접 교환하는 mutation은 full production row assertion에서 실패합니다. 결과 suffix output, review/export preclaim도 계속 거부합니다.

## Fix round 2 tests

- `node --test tests/products/studio/readme.test.mjs` → 14 passed, 0 failed.
- Fix round 2 handoff 전 `node --test tests/contracts/user-guides-studio.test.mjs`, changed JavaScript `node --check`, `git diff --check`, `git show --check`를 다시 실행합니다.
