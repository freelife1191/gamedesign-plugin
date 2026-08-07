# Task 4 보고 — Career skill workbench와 직접 호출 가이드

## 상태

`DONE` — Career 설치 스킬 15개에 manifest anchor를 따르는 직접 호출 H3 카드를 추가하고, 도식 임베드 없이 workbench와 계약 테스트를 완성했습니다.

## RED → GREEN 증거

- RED: `node --test tests/contracts/user-guides-career.test.mjs` → 19개 중 3개 실패: 15개 H3 누락과 workbench 파일 부재를 확인했습니다.
- RED: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → Career direct-use anchor H3 누락으로 실패했습니다.
- GREEN: `node --test tests/contracts/user-guides-career.test.mjs` → 19/19 pass, 0 fail.
- GREEN: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 25/25 pass, 0 fail.
- 정적 검증: `node --check tests/contracts/user-guides-career.test.mjs`, `node --check tests/contracts/user-guide-use-case-manifest.test.mjs`, `git diff --check` → 모두 성공.

## 15개 가이드 매핑

| manifest | skill | anchor 형태 | outputs | next route |
| --- | --- | --- | --- | --- |
| CA-S01 | apply-document-quality-profile | `career-직접-호출-활용-*` | selection record, checklist, manifest | 선택 Career route |
| CA-S02 | build-game-design-portfolio | 직접 호출 활용 | portfolio brief, portfolio | review, interview, export |
| CA-S03 | export-career-documents | 직접 호출 활용 | export preparation, format jobs | terminal |
| CA-S04 | generate-image-assets | `career-직접-호출-활용-*` | generation result, provenance | image review |
| CA-S05 | map-game-design-career | 직접 호출 활용 | role map, competency matrix | research, portfolio, visualization |
| CA-S06 | orchestrate-game-design-career | 직접 호출 활용 | stage goal, stage brief | 선택 Career route |
| CA-S07 | plan-image-assets | `career-직접-호출-활용-*` | image manifest, prompts | generation, visualization |
| CA-S08 | plan-junior-growth | 직접 호출 활용 | growth review, transition readiness | visualization, export |
| CA-S09 | practice-game-design-interview | 직접 호출 활용 | interview log, answer patterns | growth, portfolio review |
| CA-S10 | research-game-design-jobs | 직접 호출 활용 | job evidence, gap plan | map, portfolio, interview |
| CA-S11 | reverse-engineer-game-design | 직접 호출 활용 | reverse document, analysis report | portfolio, export |
| CA-S12 | review-game-design-portfolio | 직접 호출 활용 | five-axis review, backlog | portfolio, interview, export |
| CA-S13 | review-image-assets | `career-직접-호출-활용-*` | image review, lifecycle receipt | export |
| CA-S14 | svg-infographic | `career-직접-호출-활용-*` | editable SVG, 2× PNG, render evidence | visualization |
| CA-S15 | visualize-career-roadmap | 직접 호출 활용 | editable SVG, 2× PNG, visualization evidence | export |

각 카드는 직접 호출 조건과 오케스트레이터 경계, 입문·응용·고급 App/CLI 요청, installed command, 읽는 순서, manifest output 순서, review owner, failure-resume와 next route를 section-local로 제공합니다.

## H2·workbench·mutation 증거

- 15개 가이드 모두 기존 H2는 14개이며 순서가 변하지 않았고, 직접 호출 H3는 각 1개입니다.
- direct card에는 `[![...]]` diagram embed가 없습니다.
- workbench는 역할·근거(4), 역기획·포트폴리오(3), 면접·성장(2), 이미지·시각화(5), export(1)로 15개 installed skill을 정확히 한 번씩 나열합니다.
- mutation matrix: shared-anchor drift, guide body swap, valid wrong CLI, output/read-order swap, unconditional orchestrator handoff, TODO, evidence freshness polarity, image approval/provider drift, no-Node fallback removal, export preclaim, workbench skill 누락·중복을 계약 테스트로 거부합니다.

## 보류 위험

Task 6 전제에 따라 새 diagram source, SVG/PNG, embed는 만들지 않았습니다. manifest의 diagram target은 Task 6에서 구현·검증할 deferred surface로 남습니다.
