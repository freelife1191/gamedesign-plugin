# Studio 스킬 워크벤치

입력과 원하는 결과가 이미 한 작업으로 좁혀졌을 때 이 표에서 직접 호출할 스킬을 고릅니다. 여러 조건이 동시에 맞거나 담당 범위가 불분명하면 `orchestrate-game-design-project`로 시작합니다. 각 결과는 담당자의 결정이나 승인을 대신하지 않습니다. 정확한 입력 조건과 실패·재개 방법은 연결된 상세 가이드에서 확인하세요.

## 오케스트레이션

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `game-design-studio` | `$game-design-studio:game-design-studio` — 어떤 스킬이 맡아야 할지 모를 때 | 결과가 하나로 분명할 때 | 원하는 결과·가진 자료·공개 범위·결정 담당자·출력 형식 | 경로 선택 기록 | 선택한 실행 경로 | [직접 호출](../skills/game-design-studio.md#직접-호출-활용-game-design-studio) |
| `orchestrate-game-design-project` | `$game-design-studio:orchestrate-game-design-project` — 여러 분야와 완료 조건을 함께 조율할 때 | 결과와 입력이 한 작업으로 분명할 때 | 대상·경험·플랫폼·제약·결정 담당자 | 범위를 정한 요청 요약·대표 실행 경로 | 선택한 실행 경로 | [직접 호출](../skills/orchestrate-game-design-project.md#직접-호출-활용-orchestrate-game-design-project) |

## 도메인 설계

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `define-game-vision` | `$game-design-studio:define-game-vision` — 핵심 약속·설계 원칙 | 규칙 하나만 필요할 때 | 대상·감정·제약 | 비전 원칙 | 행동·상태 설계가 필요하면 시스템 설계 | [직접 호출](../skills/define-game-vision.md#직접-호출-활용-define-game-vision) |
| `design-game-systems` | `$game-design-studio:design-game-systems` — 규칙·상태 | 게임 비전이 비어 있을 때 | 입력·판정 기준·예외 | 시스템 명세 | 우선순위 충돌이 있으면 기획 검토 | [직접 호출](../skills/design-game-systems.md#직접-호출-활용-design-game-systems) |
| `design-game-content` | `$game-design-studio:design-game-content` — 퀘스트·전투 | 실행 규칙이 없을 때 | 콘텐츠 목적·제작 예산 | 콘텐츠 명세 | 충돌이 있으면 기획 검토 | [직접 호출](../skills/design-game-content.md#직접-호출-활용-design-game-content) |
| `design-player-experience` | `$game-design-studio:design-player-experience` — 첫 세션·접근성 | 기준 상태가 없을 때 | 핵심 행동·입력 | UX 흐름·접근성 표 | 근거가 부족하면 기획 검토 | [직접 호출](../skills/design-player-experience.md#직접-호출-활용-design-player-experience) |
| `design-game-economy-and-liveops` | `$game-design-studio:design-game-economy-and-liveops` — 재화 획득·소비·실험 | 근거 없이 지표를 확정하려 할 때 | 재화·가설·안전 조건 | 경제·이벤트 계획 | 중단·되돌리기 조건이 있으면 기획 검토 | [직접 호출](../skills/design-game-economy-and-liveops.md#직접-호출-활용-design-game-economy-and-liveops) |
| `plan-game-production` | `$game-design-studio:plan-game-production` — 범위·위험 | 핵심 플레이 흐름이 없을 때 | 팀·의존 관계·중단 기준 | 제작 위험 계획 | 위험이 발견되면 기획 검토 | [직접 호출](../skills/plan-game-production.md#직접-호출-활용-plan-game-production) |

## 품질·검토

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `apply-document-quality-profile` | `$game-design-studio:apply-document-quality-profile` — 문서 품질 기준 선택 | 실행 경로가 여러 개 섞였을 때 | 템플릿·결과물·결정 담당자 | 선택 기록 | 선택한 전문 스킬 | [직접 호출](../skills/apply-document-quality-profile.md#직접-호출-활용-apply-document-quality-profile) |
| `humanize-korean` | `$game-design-studio:humanize-korean` — 문체만 검토 | 규칙·수치·결정을 바꿔야 할 때 | 원문·독자·보호 항목 | 수정안·변경 요약 | 사람의 의미 확인 | [직접 호출](../skills/humanize-korean.md#직접-호출-활용-humanize-korean) |
| `polish-game-design-writing` | `$game-design-studio:polish-game-design-writing` — 긴 문장 윤문 | 근거·범위를 다시 설계할 때 | 원문·용어집·보호 항목 | 수정안·보호 확인표 | 사람의 의미 확인 | [직접 호출](../skills/polish-game-design-writing.md#직접-호출-활용-polish-game-design-writing) |
| `review-game-design` | `$game-design-studio:review-game-design` — 발견 항목·담당자 | 기준 결과물이 없을 때 | 기준 결과 폴더·검토 질문 | 검토 결과·변경 기록 | 수정·도식화 또는 문서 내보내기 | [직접 호출](../skills/review-game-design.md#직접-호출-활용-review-game-design) |

## 이미지

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `plan-image-assets` | `$game-design-studio:plan-image-assets` — 한정된 자산 자리 | 이미지 생성·승인 단계일 때 | 품질 기준·고정 ID·생성 범위 | 자산 목록·프롬프트 | 선택·필수·전체 생성 또는 도식화 | [직접 호출](../skills/plan-image-assets.md#직접-호출-활용-plan-image-assets) |
| `design-cutscene-visual-preproduction` | `$game-design-studio:design-cutscene-visual-preproduction` — 컷씬 제작 묶음·연속성 | 이미지 생성 기능을 호출하거나 전체를 한꺼번에 승인할 때 | 장면 단위·숏·연속성·최대 수량 | 프롬프트 묶음·예상 비용·연속성 검토 | 현재 승인한 묶음만 이미지 생성 | [직접 호출](../skills/design-cutscene-visual-preproduction.md#직접-호출-활용-design-cutscene-visual-preproduction) |
| `generate-image-assets` | `$game-design-studio:generate-image-assets` — 목록에 등록한 생성 작업 | 프롬프트만 준비하거나 도식 자리일 때 | 선택 기록·프롬프트 | 초안·출처 기록 | 지정된 담당자의 이미지 검토 | [직접 호출](../skills/generate-image-assets.md#직접-호출-활용-generate-image-assets) |
| `review-image-assets` | `$game-design-studio:review-image-assets` — 지정된 담당자의 검토 | 권리 근거·검토자가 없을 때 | 초안·출처·배치 위치 | 상태 변경 기록 | 승인된 자산의 내보내기 사전 점검 | [직접 호출](../skills/review-image-assets.md#직접-호출-활용-review-image-assets) |

## 시각화

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `visualize-game-design` | `$game-design-studio:visualize-game-design` — 관계 설명 | 장식용 이미지가 필요할 때 | 출처 결과물·독자 | SVG·2배 PNG 검증 근거 | 검토 또는 문서 내보내기 | [직접 호출](../skills/visualize-game-design.md#직접-호출-활용-visualize-game-design) |
| `archify` | `$game-design-studio:archify` — 탐색 가능한 구조 HTML | 단순 표나 장식 이미지가 더 알맞을 때 | 사실 관계·독자·도식 유형 | JSON 원본·HTML·검증 기록 | 구조와 의미 검토 | [직접 호출](../skills/archify.md#직접-호출-활용-archify) |
| `svg-infographic` | `$game-design-studio:svg-infographic` — 제작 방식을 고른 뒤 SVG 작성 | 서식과 출처 연결을 정하지 않았을 때 | 구조 근거·화면 비율 | 편집 가능한 SVG·렌더링 근거 | Skillstead 검증 | [직접 호출](../skills/svg-infographic.md#직접-호출-활용-svg-infographic) |

## 출력

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `export-game-design-documents` | `$game-design-studio:export-game-design-documents` — 승인된 형식 인계 | 차단 사유·권리 문제가 남아 있을 때 | 기준 결과 폴더·형식·독자 | 내보내기 목록·형식별 작업 | 준비 중이면 후속 작업, 사용 불가면 재개 조건 확인 | [직접 호출](../skills/export-game-design-documents.md#직접-호출-활용-export-game-design-documents) |

## 프로젝트 기억

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `retrieve-approved-design-memory` | `$game-design-studio:retrieve-approved-design-memory` — 승인된 프로젝트 교훈 조회 | 이번 요청에서 기억을 쓰지 않기로 했을 때 | project ID·현재 요청·설정 | 적용·제외 기록 | 선택된 Studio 작업 | [프로젝트 기억](../memory.md) |
| `capture-game-design-memory` | `$game-design-studio:capture-game-design-memory` — 근거 있는 교훈 후보 제안 | 추측·일회성 문구·민감 정보만 있을 때 | 검증한 결과·출처·분류 기록 | 후보 기록 | 담당자 확인·관리 | [프로젝트 기억](../memory.md) |
| `maintain-game-design-memory` | `$game-design-studio:maintain-game-design-memory` — 후보 확인·승인·거부·폐기 | 이름이 확인된 사람의 판단이 없을 때 | 후보 ID·출처·사람의 결정 | 상태 이력·충돌 안내 | Studio 작업 재개 | [프로젝트 기억](../memory.md) |

## 레퍼런스 분석·용어 사전

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `analyze-game-design-references` | `$game-design-studio:analyze-game-design-references` — 경쟁작 관찰과 시스템 비교 | 단일 규칙 명세만 바로 작성할 때 | 결정 질문·관찰 근거·프로젝트 제약 | 시스템 지도·심층 분석·`pending-review` 설계 전환 제안 | 사람 검토 또는 시스템 설계 | [경쟁작·레퍼런스 분석](../reference-analysis.md) |
| `maintain-game-design-glossary` | `$game-design-studio:maintain-game-design-glossary` — 용어 후보와 스냅샷 검토 | 원문을 자동으로 바꾸려 할 때 | 문서·근거 ID·담당자 결정 | 후보·검토 결과·승인된 용어 스냅샷 | 담당자의 원문 반영 결정 | [용어 사전 검토](../glossary.md) |

## 설치·업데이트

| 스킬 | 직접 호출 신호 | 피할 때 | 입력 | 결과 | 다음 스킬 | 상세 가이드 |
| --- | --- | --- | --- | --- | --- | --- |
| `upgrade-game-design-suite` | `$game-design-studio:upgrade-game-design-suite` — 설치된 버전과 공개된 릴리스 비교 | 설계·문서 작업을 진행할 때 | 설치 위치·마켓플레이스 유형·사용자의 선택 | 버전 비교·검증된 재설치 계획·선택 기록 | 선택한 처리 뒤 새 세션 | [설치와 업데이트](../installation.md) |

이미지 생성 범위는 `prompt-only`, `select`, `required`, `all` 가운데 하나로 정합니다. `prompt-only`는 프롬프트와 자리표시자만 남기고 이미지를 만들지 않습니다. `select`는 사용자가 순서까지 정해 고른 자산 ID만 생성 대상으로 삼습니다. 호스트 기능이 바꿀 수 없는 선택 기록을 남기며, `required`와 `all`도 자산 목록에 미리 등록된 범위를 벗어나지 않습니다. 이 선택만으로 이미지가 승인되지는 않습니다. `concept-draft → document-approved → production-candidate` 상태를 바꿀 때는 지정된 담당자의 결정이 필요하며, 검토자·범위·근거 기록을 생략할 수 없습니다. SVG도 Skillstead의 원본 연결, 문법 검사, 렌더링과 대체 경로 검증을 그대로 따릅니다.
