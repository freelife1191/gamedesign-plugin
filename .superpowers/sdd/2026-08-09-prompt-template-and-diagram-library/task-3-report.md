# Task 3 보고서: Studio 기초 기획 prompt template

## 구현

- `guides/prompt-templates/catalog/studio-foundations.json`에 Studio 기초 기획 스킬 5개(`apply-document-quality-profile`, `define-game-vision`, `design-player-experience`, `design-game-systems`, `design-game-content`)의 `beginner`·`standard`·`advanced` 항목을 각각 하나씩, 총 15개 추가했다.
- 모든 항목에 고유한 App/CLI 요청문, 스킬 체인, 역할, 중간 산출물, 최소·선택·확장 결과, Artifact 파일 트리와 읽는 순서, 사람 검토 경계, hold/resume/safety 경계, 다이어그램 binding과 source reference를 작성했다.
- `tests/unit/prompt-template-catalog.test.mjs`에 15개 정확한 ID와 skill/level 매트릭스, Studio App/CLI namespace를 검증하는 테스트를 추가했다.

## Source 근거

- 다섯 스킬의 직접 호출 수준별 예시, 산출물·읽는 순서·역할·hold/resume 경계: `guides/game-design-studio/skills/{apply-document-quality-profile,define-game-vision,design-player-experience,design-game-systems,design-game-content}.md`
- 실제 Template ID와 Artifact 계약: `guides/game-design-studio/templates.md`
- profile/overlay/preset 및 승인 상태 경계: `guides/game-design-studio/document-quality.md`
- 실제 Studio role, skill, template 인벤토리: `products/game-design-studio/plugin/references/routing.json` 및 product inventory
- 사용 가능한 직접 호출 다이어그램: `guides/assets/diagram-manifest.json`

## RED / GREEN 증거

- RED: `node --test --test-name-pattern='Studio foundation' tests/unit/prompt-template-catalog.test.mjs`는 새 shard가 없어 `ENOENT .../catalog/studio-foundations.json`으로 1개 실패했다.
- GREEN: 같은 명령은 shard 작성 뒤 1개 통과했다.
- schema/reference 검증: 실제 Studio inventory, role registry, use-case manifest를 이용한 `validatePromptTemplateCatalog` 실행이 `schema validation: 15 Studio entries`로 통과했다.
- 전체 단위 회귀: `node --test tests/unit/prompt-template-catalog.test.mjs`가 21개 통과, 실패 0개였다.

## 변경 파일

- `guides/prompt-templates/catalog/studio-foundations.json`
- `tests/unit/prompt-template-catalog.test.mjs`
- `.superpowers/sdd/2026-08-09-prompt-template-and-diagram-library/task-3-report.md`

## 자체 검토

- 5 skills × 3 levels의 각 조합이 정확히 한 번인지 확인했다.
- 15개 항목의 App prompt는 `@Game Design Studio`, CLI prompt는 실제 `$game-design-studio:<skill>` namespace를 사용한다.
- 75개 App/CLI/resume 텍스트가 서로 중복되지 않음을 확인했다.
- 모든 safety boundary는 미정 처리를 명시하고 API key, 자격증명, 개인정보, 비공개 자료 요청을 금지한다.
- 생성된 plugin, browser, main package-lock.json은 변경하지 않았다.

## 우려사항

- 이 shard 단독으로는 전체 146개 카탈로그를 완성하지 않는다. 다른 task의 shard가 병합된 뒤 전체 catalog loader의 complete-count 검증이 가능하다.
