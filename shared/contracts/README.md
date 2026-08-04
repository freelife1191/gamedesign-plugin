# Shared Contract v1

`shared-contract-v1`은 Studio와 Career product lane이 함께 소비하는 패키징·런타임 계약이다. 호환 변경은 기존 필드, 경로, marker, mapping의 의미를 유지해야 한다. 필수 필드 제거, 경로 변경, 허용 값 축소, marker 변경, 충돌 규칙 변경은 비호환 변경이며 새 계약 이름과 suite 통합 계획이 필요하다. 선택 필드나 허용 값을 추가하는 변경도 production validator, 이 문서, `tests/contracts/shared-contract.test.mjs`를 한 커밋에서 갱신해야 한다.

Product lane은 루트에서 `npm run test:shared-contract`를 실행해 이 체크포인트를 검증한다.

## Product contract and source root

각 product는 `products/<product-name>/product.json`과 하나 이상의 source root를 가진다. 기본 source root layout은 `products/<product-name>/plugin/`이다. `product.json`은 `shared/contracts/product.schema.json` 및 `tooling/lib/product-contract.mjs` 양쪽을 만족해야 하며 다음 필드가 필수다.

- `schemaVersion`: `1`
- `name`: 정규화된 kebab-case이며 디렉터리 이름과 동일
- `displayName`, `description`: 비어 있지 않은 문자열
- `sharedModules`: 중복 없는 `knowledge`, `templates`, `responsible-design`, `export`, `vendor`의 부분집합. 두 제품은 다섯 모듈을 모두 선언한다.
- `sharedRuntime`: `true`
- `sourceRoots`: product 디렉터리 안의 중복 없는 상대 경로 배열
- `sourceDocuments` 또는 `sourceDocumentCategories`: 정확히 하나만 선언하는 중복 없는 배열

Studio와 Career는 `sourceDocumentCategories`에 `career`, `fun-intent`, `systems`, `content`, `feedback`을 선언해 49개 source document 전체를 선택한다. 명시적 문서 선택이 필요하면 `sourceDocuments`에 `shared/knowledge/reference-index.json`의 고유 ID를 사용한다. 알 수 없는 ID/category, 중복 ID/path, `docs/` 밖의 source는 build 실패다.

## Fixed build mapping and overrides

`buildProduct`의 shared module mapping은 고정되어 있다.

| Module | Source | Built destination |
| --- | --- | --- |
| `knowledge` | `shared/knowledge/` | `references/shared/knowledge/` |
| `templates` | `shared/templates/` | `assets/shared/templates/` |
| `responsible-design` | `shared/responsible-design/` | `references/shared/responsible-design/` |
| `export` | `shared/export/` | `references/shared/export/` |
| `vendor` | `shared/vendor/skillstead/svg-infographic/0.8.3/` | `skills/svg-infographic/` |
| shared runtime | `shared/hooks/`, `shared/scripts/` | `hooks/`, `scripts/` |
| indexed source | selected `docs/**` | `references/source/docs/**` |
| product overlay | each `sourceRoots` tree | package root |

Product files do not silently override shared files. 동일 destination에 같은 bytes가 들어오면 하나로 합치고, bytes가 다르거나 file/directory collision이 있으면 build를 거부한다. 모든 입력 경로는 NFC 정규화 상대 경로여야 하며 symlink와 root 탈출은 허용하지 않는다.

`buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch })`는 destination path 정렬, 파일 mode `0644`, 디렉터리 mode `0755`, 고정 timestamp, 정렬된 파일 목록 및 SHA-256으로 재현 가능한 결과를 만든다. 동일 입력과 `sourceDateEpoch`은 동일 파일 목록·bytes·hash를 산출해야 한다.

## Role prompt contract

Role prompt는 `products/<product-name>/plugin/agents/<role-id>.md`에 둔다(예: `agents/<role-id>.md`). 파일명은 kebab-case role ID이며 prompt는 역할 범위, 입력 review envelope, 검토 질문, finding 출력 경로, severity/evidence 기준을 명시한다. Role prompt는 portable orchestration asset이지 host의 자동 agent discovery 계약이 아니다. Workflow는 최대 3개 role을 선택하고 병렬 실행이 없을 때의 고정 순서 및 deterministic merge order를 함께 선언한다.

## Skill contract

각 skill은 `products/<product-name>/plugin/skills/<skill-name>/SKILL.md`에 둔다(즉 `skills/<skill-name>/SKILL.md`). 디렉터리 이름과 frontmatter `name`은 동일한 kebab-case이며 YAML frontmatter에는 최소 `name`과 비어 있지 않은 `description`이 필요하다. 본문은 trigger/입력, progressive reference loading, 단계, output, completion gate, capability 실패 시 canonical artifact 보존 규칙을 명시한다. Host-specific UI나 top-level agent 자동 발견을 전제하지 않는다.

## Templates and E2E fixtures

Product template은 `products/<product-name>/plugin/assets/templates/<template-name>/`(built 경로 `assets/templates/<template-name>/`)에 둔다. `<template-name>`은 kebab-case artifact type이며 임의 별칭이나 대소문자 변형을 만들지 않는다. Canonical handoff가 필요한 template은 `content.md`, `evidence.yml`, `export-manifest.yml`, `assets/`, `decisions/` 구조를 유지하고 production `validateArtifact`를 통과해야 한다.

E2E fixture의 product ID와 lane ID mapping은 고정되어 있다.

| Product ID | Lane ID | Scenario root |
| --- | --- | --- |
| `game-design-studio` | `studio` | `tests/e2e/studio/<scenario>/` |
| `game-design-career` | `career` | `tests/e2e/career/<scenario>/` |

각 scenario root는 고정 입력과 기대 artifact type/gate를 포함하고 네트워크, 현재 시각, 사용자 홈 경로에 의존하지 않는다. 별도 `fixtures/` 계층이나 product ID를 E2E lane ID로 사용하지 않는다. Expected artifact를 복제 validator로 검사하지 말고 production build/validator를 호출한다.

## Generated snapshots

`plugins/game-design-studio`와 `plugins/game-design-career`는 human-edited source가 아니라 generated snapshot이다. Product lane은 이 경로를 직접 편집하거나 product 전용 변경에 포함하지 않는다. Suite integration만 clean staging build로 두 경로를 교체하며, committed snapshot 및 `BUILD-MANIFEST.json`은 production builder의 정렬·timestamp·hash 규칙으로 재현되어야 한다. Generated 파일의 수동 override는 금지되고 source 또는 builder를 수정한 뒤 전체 snapshot을 다시 생성한다.

## Hooks and artifact/export handoff

Hooks 지원은 host에서 optional이다. Product manifest는 비표준 `hooks` 필드를 선언하지 않는다. 지원 host는 built `hooks/hooks.json`의 공식 `SessionStart` 및 `Stop` command 구조를 사용하며 `${PLUGIN_ROOT}/scripts/*`만 실행한다. 미지원 host에서도 skills와 canonical artifact 작성은 동작해야 한다.

완성 artifact는 다음 sentinel을 assistant message의 마지막 내용으로 한 번만 공개한다.

`<!-- game-design-plugin:artifact {"path":"<artifact-path>","formats":[]} -->`

`path`는 workspace 내부의 symlink 없는 정규화 상대 디렉터리이고 `formats`는 중복 없는 `md`, `pdf`, `docx`, `pptx` 값이다. Stop hook은 production `validateArtifact`로 canonical artifact를 검증하고, 첫 실패에만 `corrective-pass-requested`로 block한다. 재진입의 공식 marker는 `stop_hook_active: true`이며 `GAME_DESIGN_REVIEW_ATTEMPT=1`은 호환 fallback이다. 재진입 실패는 `invalid-after-corrective-pass`와 `continue: true`를 반환해 반복하지 않는다.

Export는 먼저 유효한 canonical artifact를 보존한 뒤 `export-manifest.yml`의 요청 format을 capability probe 결과에 따라 처리한다. 선택 renderer가 없거나 export가 실패해도 canonical artifact를 삭제·변형하지 않고 structured warning과 pending/unavailable 상태로 handoff한다.
