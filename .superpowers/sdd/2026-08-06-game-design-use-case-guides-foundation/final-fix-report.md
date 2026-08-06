# Foundation final fix report

## 범위와 결과

Foundation whole-branch review의 Critical 0, Important 3, Minor 3을 하나의 최소 수정 파동으로 완료했습니다. runtime과 dependency는 변경하지 않았습니다.

## Finding별 변경과 RED → GREEN

### Important 1 — 모든 manifest lane의 builder output

- 변경: `tooling/build-use-case-diagrams.mjs`의 `outputForSource()`가 `audience_paths`, `cases`, `skill_cases` 전체에서 source ID의 정확히 하나인 entry만 찾습니다. 0개 또는 중복이면 명시적으로 fail-closed합니다.
- 테스트: `tests/unit/build-use-case-diagrams.test.mjs`는 세 lane 각각의 실제 builder subprocess가 manifest의 명시 SVG/PNG 경로에 출력하는지, zero/duplicate match가 거절되는지 확인합니다.
- RED: 기존 구현에서 `cases` source는 `no explicit audience manifest output`으로 실패했고 duplicate fixture는 잘못 통과했습니다.
- GREEN: `node --test tests/unit/build-use-case-diagrams.test.mjs` → 12/12 PASS.

### Important 2 — manifest target path fail-open

- 변경: `tooling/lib/use-case-guides.mjs`는 shape 검증 후 `validateTargets` 단계에서 모든 document/SVG/PNG를 canonical root 기준으로 resolve하고, 존재하는 모든 경로 구성요소와 target이 non-symlink regular file인지 검사합니다.
- 단계 계약: `requireComplete`는 기본적으로 target 검증을 요구합니다. 부분 manifest 선언은 `validateTargets: false`로 명시 지연하며, 반환값의 `targetValidation: "deferred"`와 `deferredTargetPaths`에 미검증 target을 노출합니다. aggregate guide validation은 partial count를 허용하되 `validateTargets: true`로 현재 선언 파일을 fail-closed 검사합니다.
- 테스트: `tests/contracts/user-guide-use-case-manifest.test.mjs`는 missing, directory, symlink target과 deferred declaration을 실제 filesystem fixture로 검증합니다.
- RED: 새 phase metadata와 target error가 없어 assertion이 실패했습니다.
- GREEN: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 12/12 PASS.

### Important 3 — aggregate validator masking

- 변경: `tooling/lib/user-guides.mjs`가 product inventories를 use-case validator에 전달하고 모든 use-case error를 `use-case manifest:` prefix로 aggregate합니다. use-case manifest가 invalid이면 dynamic diagram total을 계산의 권위로 사용하지 않습니다.
- 테스트: `tests/unit/user-guides.test.mjs`는 duplicate ID, malformed shape, unknown inventory skill이 aggregate validation에서 prefix와 함께 실패하며 diagram count masking이 생기지 않는지 검증합니다.
- RED: aggregate result에 use-case manifest failure가 없어 assertion이 실패했습니다.
- GREEN: `node --test tests/unit/user-guides.test.mjs` → 7/7 PASS.

### Minor 1 — output catalog

- 변경: `guides/use-cases/output-catalog.md`의 두 request table은 `최소 파일 경로`와 `내용 범위`를 분리했습니다. 최소 파일에는 artifact-relative canonical 경로만, 도메인 설명에는 명시적 `content.md` 내 범위를 둡니다. canonical 다섯 경로의 읽기 순서는 유지했습니다.
- RED/GREEN: contract heading/content assertion을 먼저 변경해 RED를 확인했고, `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 12/12 PASS.

### Minor 2 — diagram unit coverage

- 변경: `tests/unit/use-case-diagrams.test.mjs`가 `renderDiagramSvg()` 실제 output으로 네 layout type의 3·5-card 표본, 24px container/card padding, 12px target connector gap, 금지 요소(`foreignObject`, image, script, style, external font, embedded bitmap), 모든 visible/accessibility field XML escape를 검증합니다.
- Mutation sensitivity: card offset, connector gap, forbidden tag, 또는 어느 문자열 escape를 제거하면 해당 geometry/output assertion이 실패합니다.
- GREEN: `node --test tests/unit/use-case-diagrams.test.mjs` → 7/7 PASS.

### Minor 3 — Markdown whitespace

- 변경: `guides/use-cases/README.md` FAQ의 trailing-space hard break를 표준 backslash hard break로 치환했습니다.
- GREEN: `git diff --check` → clean.

## 최종 검증

- Focused contracts/unit: `node --test tests/unit/use-case-diagrams.test.mjs tests/unit/build-use-case-diagrams.test.mjs tests/unit/user-guides.test.mjs tests/contracts/user-guide-use-case-manifest.test.mjs` → 38/38 PASS.
- Diagram check: `npm run check:guide-diagrams` → 6 SVG, 6 PNG checked.
- Guide aggregate: `npm run validate:guides` → `guides: PASS {"guides":69,"skillGuides":30,"templates":30,"svg":24,"png":24}`.
- Full unit suite: `npm run test:unit` → 363/363 PASS.
- Contract suite: `npm run test:contracts` → PASS.
- Whitespace: `git diff --check` → clean; commit 후 `git diff --check 7727408..HEAD`도 실행합니다.

## 남은 우려

- partial manifest declaration은 target existence를 고의로 지연하므로, 후속 Studio/Career manifest-only 단계는 target files가 준비되기 전 `validateTargets: false`를 명시해야 합니다. 완성/aggregate target validation은 이를 fail-closed로 다시 확인합니다.
