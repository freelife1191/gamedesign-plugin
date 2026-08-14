# Studio 스킬 워크벤치

입력과 원하는 결과가 이미 한 작업으로 좁혀졌을 때 이 표에서 직접 호출할 스킬을 고릅니다. 여러 열의 신호가 동시에 맞거나 책임 범위가 불명확하면 `orchestrate-game-design-project`로 시작합니다. 각 결과는 사람의 결정·승인을 대신하지 않으며, 정확한 입력·실패·재개 계약은 연결한 상세 가이드가 소유합니다.

## 오케스트레이션

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `orchestrate-game-design-project` | `$game-design-studio:orchestrate-game-design-project` — 복수 도메인·gate | 한 output이 분명할 때 | 대상·경험·플랫폼·제약·owner | bounded brief·canonical route | 선택된 route 하나 | [직접 호출](../skills/orchestrate-game-design-project.md#직접-호출-활용-orchestrate-game-design-project) |

## 도메인 설계

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `define-game-vision` | `$game-design-studio:define-game-vision` — promise·pillar | rule만 필요할 때 | 대상·감정·제약 | vision-pillars | verb·state가 필요할 때 systems | [직접 호출](../skills/define-game-vision.md#직접-호출-활용-define-game-vision) |
| `design-game-systems` | `$game-design-studio:design-game-systems` — rule·state | 비전이 비어 있을 때 | input·authority·exception | system specification | precedence finding이면 review | [직접 호출](../skills/design-game-systems.md#직접-호출-활용-design-game-systems) |
| `design-game-content` | `$game-design-studio:design-game-content` — quest·combat | runtime authority가 없을 때 | content purpose·budget | content specification | 충돌이면 review | [직접 호출](../skills/design-game-content.md#직접-호출-활용-design-game-content) |
| `design-player-experience` | `$game-design-studio:design-player-experience` — first session·accessibility | authoritative state가 없을 때 | critical action·input | UX flow·accessibility matrix | evidence gap이면 review | [직접 호출](../skills/design-player-experience.md#직접-호출-활용-design-player-experience) |
| `design-game-economy-and-liveops` | `$game-design-studio:design-game-economy-and-liveops` — source/sink·experiment | 근거 없이 KPI를 확정하려 할 때 | resource·hypothesis·guardrail | economy·event plan | stop/rollback이면 review | [직접 호출](../skills/design-game-economy-and-liveops.md#직접-호출-활용-design-game-economy-and-liveops) |
| `plan-game-production` | `$game-design-studio:plan-game-production` — scope·risk | core loop가 없을 때 | team·dependency·kill criteria | production risk plan | risk finding이면 review | [직접 호출](../skills/plan-game-production.md#직접-호출-활용-plan-game-production) |

## 품질·검토

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `apply-document-quality-profile` | `$game-design-studio:apply-document-quality-profile` — profile 선택 | route가 섞였을 때 | template·artifact·owner | selection record | 선택된 domain skill | [직접 호출](../skills/apply-document-quality-profile.md#직접-호출-활용-apply-document-quality-profile) |
| `humanize-korean` | `$game-design-studio:humanize-korean` — 문체만 검토 | 규칙·수치·결정을 바꿔야 할 때 | 원문·독자·보호 항목 | 수정안·변경 요약 | 사람의 의미 확인 | [직접 호출](../skills/humanize-korean.md#직접-호출-활용-humanize-korean) |
| `polish-game-design-writing` | `$game-design-studio:polish-game-design-writing` — 긴 문장 윤문 | 근거·범위를 다시 설계할 때 | 원문·용어집·보호 항목 | 수정안·보호 확인표 | 사람의 의미 확인 | [직접 호출](../skills/polish-game-design-writing.md#직접-호출-활용-polish-game-design-writing) |
| `review-game-design` | `$game-design-studio:review-game-design` — finding·owner | artifact가 없을 때 | canonical artifact·question | review·change log | fix, diagram 또는 export | [직접 호출](../skills/review-game-design.md#직접-호출-활용-review-game-design) |

## 이미지

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `plan-image-assets` | `$game-design-studio:plan-image-assets` — finite slot | bytes 생성·승인 때 | profile·stable ID·mode | manifest·prompts | select/required/all 생성 또는 diagram | [직접 호출](../skills/plan-image-assets.md#직접-호출-활용-plan-image-assets) |
| `generate-image-assets` | `$game-design-studio:generate-image-assets` — finite declared job | prompt-only·diagram slot | selected receipt·prompt | draft·provenance | named human image review | [직접 호출](../skills/generate-image-assets.md#직접-호출-활용-generate-image-assets) |
| `review-image-assets` | `$game-design-studio:review-image-assets` — named human review | rights·reviewer가 없을 때 | draft·source·placement | lifecycle receipt | approved export preflight | [직접 호출](../skills/review-image-assets.md#직접-호출-활용-review-image-assets) |

## 시각화

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `visualize-game-design` | `$game-design-studio:visualize-game-design` — 관계 설명 | 장식 이미지 | source artifact·audience | SVG·2× PNG evidence | review 또는 export | [직접 호출](../skills/visualize-game-design.md#직접-호출-활용-visualize-game-design) |
| `archify` | `$game-design-studio:archify` — 탐색 가능한 구조 HTML | 단순 표나 장식 이미지 | 사실 관계·독자·도식 유형 | JSON 원본·HTML·검증 영수증 | 구조 의미 검토 | [직접 호출](../skills/archify.md#직접-호출-활용-archify) |
| `svg-infographic` | `$game-design-studio:svg-infographic` — wrapper 선택 뒤 authoring | preset·source mapping 전 | structural source·ratio | editable SVG·render evidence | wrapper validation | [직접 호출](../skills/svg-infographic.md#직접-호출-활용-svg-infographic) |

## 출력

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `export-game-design-documents` | `$game-design-studio:export-game-design-documents` — approved format handoff | blocker·rights가 남을 때 | canonical artifact·formats·audience | export manifest·format jobs | pending→downstream; unavailable→resume | [직접 호출](../skills/export-game-design-documents.md#직접-호출-활용-export-game-design-documents) |

## 프로젝트 기억

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `retrieve-approved-design-memory` | `$game-design-studio:retrieve-approved-design-memory` — 승인된 프로젝트 교훈 조회 | 이번 요청에서 기억을 쓰지 않기로 했을 때 | project ID·현재 요청·설정 | 적용·제외 기록 | 선택된 Studio 작업 | [프로젝트 기억](../memory.md) |
| `capture-game-design-memory` | `$game-design-studio:capture-game-design-memory` — 근거 있는 교훈 후보 제안 | 추측·일회성 문구·민감 정보만 있을 때 | 검증한 결과·출처·분류 receipt | candidate 기록 | 사람 확인·관리 | [프로젝트 기억](../memory.md) |
| `maintain-game-design-memory` | `$game-design-studio:maintain-game-design-memory` — 후보 확인·승인·거부·폐기 | 이름이 확인된 사람의 판단이 없을 때 | 후보 ID·출처·사람의 결정 | 상태 이력·충돌 안내 | Studio 작업 재개 | [프로젝트 기억](../memory.md) |

## 레퍼런스 분석·용어 사전

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `analyze-game-design-references` | `$game-design-studio:analyze-game-design-references` — 경쟁작 관찰과 시스템 비교 | 단일 규칙 명세만 바로 작성할 때 | 결정 질문·관찰 근거·프로젝트 제약 | 시스템 지도·심층 분석·`pending-review` 전송 제안 | 사람 검토 또는 시스템 설계 | [경쟁작·레퍼런스 분석](../reference-analysis.md) |
| `maintain-game-design-glossary` | `$game-design-studio:maintain-game-design-glossary` — 용어 후보와 스냅샷 검토 | 원문을 자동으로 바꾸려 할 때 | 문서·근거 ID·사람 결정 | 후보·findings·승인된 용어 스냅샷 | 사람의 원문 반영 결정 | [용어 사전 검토](../glossary.md) |

이미지 mode는 `prompt-only`, `select`, `required`, `all`의 기존 artifact-local 선택을 그대로 따릅니다. `prompt-only`는 prompt·placeholder만 보존하고 생성 없음입니다. `select`는 사용자가 제공한 ordered exact stable IDs로 finite generation을 선택합니다. host adapter가 immutable selection receipt를 공급합니다. `required`와 `all`은 declared finite generation만 허용합니다. 이 generation selection은 승인 결정이 아닙니다. named human decision은 `concept-draft → document-approved → production-candidate` lifecycle promotion에만 필요하며, 각 승격의 reviewer·scope·evidence를 대체하지 않습니다. SVG는 Skillstead wrapper의 source mapping·lint·renderer fallback 경계를 우회하지 않습니다.
