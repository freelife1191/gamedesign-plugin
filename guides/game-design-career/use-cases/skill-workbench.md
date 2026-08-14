# Career 스킬 워크벤치

이 표는 설치된 Career 스킬 23개를 한 번씩만 분류합니다. 입력과 output 하나가 확정된 작업은 직접 스킬 호출로 시작하고, 여러 단계·역할·우선순위가 섞일 때만 오케스트레이터로 범위를 나눕니다. 생성·렌더·추천은 사람 승인이나 채용 결과를 대신하지 않습니다.

## 역할·근거 lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`apply-document-quality-profile`](../skills/apply-document-quality-profile.md) | 한 Artifact의 template·profile과 checklist만 고정할 때 | selection record는 `document-quality-editor` 검토 전 승인 자체가 아닙니다. |
| [`humanize-korean`](../skills/humanize-korean.md) | 증거와 수치를 바꾸지 않고 문체만 다듬을 때 | 수정안은 `game-design-writing-editor` 또는 작성자가 의미·주장 경계를 확인합니다. |
| [`polish-game-design-writing`](../skills/polish-game-design-writing.md) | 긴 포트폴리오·학습 문장의 표현만 윤문할 때 | 경험·증거 ID와 공개·보류 판단은 사람이 다시 확인합니다. |
| [`map-game-design-career`](../skills/map-game-design-career.md) | 한 역할의 current evidence와 gap만 비교할 때 | `career-strategist`가 사실·추론·제안을 구분합니다. |
| [`orchestrate-game-design-career`](../skills/orchestrate-game-design-career.md) | 여러 Career stage와 completion gate를 한 brief로 묶을 때 | route 선택은 사실·추론·제안과 named owner를 보존합니다. |
| [`research-game-design-jobs`](../skills/research-game-design-jobs.md) | 한 role·level·region의 current posting sample만 조사할 때 | `sourceUrl`, `location`, `retrievalDate`, `region`, sample boundary, `reviewAfter`가 없으면 current claim을 만들지 않습니다. |
| [`analyze-game-design-references`](../reference-analysis.md) | 경쟁작 관찰을 포트폴리오 분석 근거로 정리할 때 | 관찰·추론·가설을 나누고, 설계 전환 제안은 `pending-review`로 남깁니다. |
| [`maintain-game-design-glossary`](../glossary.md) | 용어 후보와 스냅샷을 검토할 때 | 원문 자동 치환 없이 사람이 승인한 용어만 스냅샷에 넣습니다. |

직접 스킬은 입력과 output이 하나로 확정됐을 때만 사용합니다. 여러 단계와 우선순위가 남으면 오케스트레이터가 route를 정한 후 같은 직접 스킬로 돌아옵니다.

## 역기획·포트폴리오 lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`reverse-engineer-game-design`](../skills/reverse-engineer-game-design.md) | 한 공개 build의 관찰과 validation queue를 기록할 때 | 관찰·추론·제안, attribution과 public rights를 구분합니다. |
| [`build-game-design-portfolio`](../skills/build-game-design-portfolio.md) | 한 project의 claim·evidence case study를 만들 때 | 개인 기여와 팀 결과를 분리하며 합격을 보장하지 않습니다. |
| [`review-game-design-portfolio`](../skills/review-game-design-portfolio.md) | 한 Artifact의 five-axis finding과 repair만 볼 때 | `portfolio-reviewer`가 evidence ID와 inspectability를 검토합니다. |

## 면접·성장 lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`practice-game-design-interview`](../skills/practice-game-design-interview.md) | 한 posting·portfolio evidence set의 stable question record를 연습할 때 | 개인 기여, attribution과 evidence ID를 보존하며 합격을 보장하지 않습니다. |
| [`plan-junior-growth`](../skills/plan-junior-growth.md) | 한 requirement의 gap과 proof task를 계획할 때 | stale requirement는 갱신하고 `game-design-mentor`가 growth proof를 검토합니다. |

## 이미지·시각화 lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`plan-image-assets`](../skills/plan-image-assets.md) | finite image 또는 Skillstead slot의 ID·수량·prompt를 계획할 때 | 계획은 bytes 생성이나 승인 상태 변경을 하지 않습니다. |
| [`generate-image-assets`](../skills/generate-image-assets.md) | selection receipt가 있는 finite provider job을 실행할 때 | provider routing과 `IMAGE_GEN_MODE`를 기록하며 AI 결과는 자동 승인되지 않습니다. |
| [`review-image-assets`](../skills/review-image-assets.md) | 한 asset ID의 lifecycle transition을 검토할 때 | named human approval과 rights evidence 없이는 state를 전진하지 않습니다. |
| [`svg-infographic`](../skills/svg-infographic.md) | 하나의 구조 SVG를 직접 authoring·검증할 때 | Skillstead와 Node-free Chromium fallback은 문서 승인과 별개입니다. |
| [`archify`](../skills/archify.md) | 경력 흐름을 탐색 가능한 HTML로 설명할 때 | 노드의 근거와 공개 범위는 멘토 또는 작성자가 확인합니다. |
| [`visualize-career-roadmap`](../skills/visualize-career-roadmap.md) | 하나의 source-mapped role·learning relationship을 도식화할 때 | SVG/PNG evidence와 visual QA는 named human 내용 승인을 대신하지 않습니다. |

## export lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`export-career-documents`](../skills/export-career-documents.md) | 하나의 승인 대기 Artifact의 format job을 준비할 때 | renderer 실행과 파일 생성은 downstream workflow가 확인하며 준비 단계에서 성공을 약속하지 않습니다. |

## 프로젝트 기억 lane

| 스킬 | 직접 호출할 때 | evidence와 사람 경계 |
| --- | --- | --- |
| [`retrieve-approved-design-memory`](../memory.md) | 현재 프로젝트의 승인된 Career·공통 교훈만 시작 전에 확인할 때 | 출처·만료·lane이 맞지 않는 기록은 제외하며 기억 오류가 나도 기존 작업을 계속합니다. |
| [`capture-game-design-memory`](../memory.md) | 근거가 연결된 작업 결과에서 재사용할 교훈 후보를 제안할 때 | 자동 기록은 후보까지만 가능하며 추측·개인정보·비공개 원문은 남기지 않습니다. |
| [`maintain-game-design-memory`](../memory.md) | 후보의 출처를 확인하고 이름이 확인된 사람이 검증·승인·거부·폐기할 때 | 사람의 판단과 이유 없이는 상태를 바꾸지 않고, 충돌하면 다시 선택을 요청합니다. |

## 경계와 재개

직접 호출이 blocked면 해당 Artifact의 `content.md → evidence.yml → decisions/ → export-manifest.yml`과 failure record를 보존하고, 필요한 evidence·권리·사람 결정을 확보한 동일 route에서 재개합니다. 복수 lane의 우선순위 또는 stage가 다시 섞일 때만 `$game-design-career:orchestrate-game-design-career`로 돌아갑니다.
