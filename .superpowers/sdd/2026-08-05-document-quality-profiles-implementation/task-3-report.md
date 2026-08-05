# Task 3 Report — Product Template Quality Profile Mapping

## 변경 파일

- `products/game-design-studio/plugin/references/document-quality/template-profile-map.json`
- `products/game-design-career/plugin/references/document-quality/template-profile-map.json`
- Studio/Career의 30개 `plugin/assets/templates/*/content.md`
- `shared/export/schema/artifact.schema.json`
- `shared/scripts/validate-artifact.mjs`
- `tests/unit/validate-artifact.test.mjs`
- `tests/products/studio/templates.test.mjs`
- `tests/products/career/templates.test.mjs`
- `plugins/game-design-studio/**`, `plugins/game-design-career/**` — source 변경 후 `npm run build`로만 갱신한 생성 snapshot

## 정확한 primary mapping 결정

### Studio (15)

| Template | Primary Quality Profile |
| --- | --- |
| `accessibility-platform-matrix` | `accessibility-platform-matrix` |
| `character-skill-combat-monster` | `character-skill-combat-monster-specification` |
| `core-motivation-loop` | `core-motivation-loop` |
| `data-schema-table-contract` | `data-table-contract` |
| `decision-change-log` | `design-review-decision-log` |
| `economy-balance` | `economy-balance-specification` |
| `game-design-brief` | `game-design-brief` |
| `game-design-review` | `design-review-decision-log` |
| `liveops-experiment-event` | `liveops-event-experiment-plan` |
| `narrative-quest-npc` | `narrative-quest-npc-specification` |
| `production-scope-risk` | `production-scope-milestone-risk-plan` |
| `rule-exception-matrix` | `rule-state-exception-matrix` |
| `system-specification` | `system-feature-specification` |
| `ui-ux-flow-state` | `ui-ux-flow-state-specification` |
| `vision-pillars` | `vision-one-pager` |

의도적 공유: `decision-change-log`와 `game-design-review`는 모두 `design-review-decision-log`를 사용한다.

### Career (15)

| Template | Primary Quality Profile |
| --- | --- |
| `career-stage-goal` | `career-stage-role-map` |
| `competency-matrix` | `competency-matrix` |
| `creative-design-portfolio` | `portfolio-case-study` |
| `five-axis-review` | `portfolio-review-backlog` |
| `game-analysis-report` | `game-analysis-report` |
| `game-design-role-map` | `career-stage-role-map` |
| `interview-question-answer-log` | `interview-question-answer-report` |
| `introduction-motivation` | `recruiter-portfolio-presentation` |
| `job-posting-evidence` | `job-posting-evidence` |
| `junior-growth-review` | `junior-growth-review` |
| `learning-roadmap` | `learning-roadmap` |
| `portfolio-backlog` | `portfolio-review-backlog` |
| `portfolio-project-brief` | `portfolio-project-brief` |
| `reverse-design-document` | `reverse-design-document` |
| `transition-readiness` | `transition-readiness` |

의도적 공유: `career-stage-goal`과 `game-design-role-map`은 `career-stage-role-map`을, `five-axis-review`와 `portfolio-backlog`는 `portfolio-review-backlog`를 사용한다.

## RED → GREEN → REFACTOR

- RED: `node --test tests/unit/validate-artifact.test.mjs tests/products/studio/templates.test.mjs tests/products/career/templates.test.mjs`
  - 83개 중 77 PASS / 6 FAIL.
  - 두 mapping 파일 부재, `quality_profile` unknown frontmatter key, 필수 profile 누락/unknown/array 검증 부재로 의도대로 실패했다.
- GREEN: optional schema property, profile-aware validator option, 두 mapping, 30개 frontmatter를 구현했다.
  - frontmatter 변경으로 기존 seed hash 계약이 실제 실패하는 것을 확인한 후 content hash 30개만 갱신했다.
  - focused suite 83/83 PASS.
- REFACTOR: 제품 mapping 테스트가 source text grep이 아니라 clean-built package의 mapping/frontmatter를 parse하고 packaged catalog profile을 runtime validator로 검증하도록 정리했다.
  - refactor 후 focused suite 83/83 PASS.

## 30개 검증

- mapping object의 key 집합과 clean-built package의 실제 template directory 집합이 제품별로 정확히 일치한다.
- 각 mapping 값은 배열이 아닌 단일 string이다.
- 각 mapped ID의 packaged catalog JSON을 읽어 `validateQualityProfile`과 `profile_id` 일치를 확인한다.
- 각 packaged `content.md` frontmatter의 `quality_profile`이 mapping 값과 일치한다.
- 30개 모두 `validateArtifact(templateDir, { requireQualityProfile: true, profileCatalogRoot })`가 성공한다.
- missing, unknown, array, duplicate primary는 unit test에서 거부된다.
- generic artifact는 `requireQualityProfile: false` 기본값으로 계속 성공하여 기존 결과 shape/default behavior를 보존한다.

## Snapshot build / drift

- `npm run build` 성공:
  - Career: 303 files, `94eb5fc8bd8c0fd75b51ecd9a44b9ac857dd0e28f572ffb8f5c5760ab0fb62af`
  - Studio: 311 files, `8c85ab08b75db5095e55eaac30457b53e5d3d737bac8ff2562eff089ce8b29d2`
- `node tooling/validate-build-drift.mjs` 성공, 동일한 file count/hash를 재확인했다.
- 관련 catalog/shared/package contract와 focused tests가 함께 통과했다.
- `npm test` 성공(exit 0).

## 자기검토

- 생성 `plugins/`는 직접 편집하지 않았고 source 수정 후 build로만 갱신했다.
- mapping JSON top-level은 `schema_version`, `product`, `templates`만 허용하도록 테스트했다.
- `quality_profile`은 generic schema에서 optional이며 profile-aware validation에서만 필수/known catalog resolution을 요구한다.
- 기존 `validateArtifact` 반환 필드(`ok`, `errors`, `warnings`, `files`, `requestedFormats`)를 변경하지 않았다.
- catalog lookup은 kebab-case ID를 `<profileCatalogRoot>/<id>.json`에 한정하고 regular non-symlink file 및 profile validator/ID 일치를 요구한다.
- `git diff --check` 통과. 임시/debug 코드 없음.

## 커밋

- 구현 커밋: `1830b1e` (`feat(quality): map product templates to quality profiles`)

## 우려사항

- 없음.
