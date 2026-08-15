# Game Design Studio 사용자 가이드

Game Design Studio는 게임 디자인 문서(GDD)를 게임 비전에서 시스템·콘텐츠·플레이어 경험·경제·LiveOps·제작 계획, 검토, 자산과 내보내기까지 연결합니다. `content.md`를 기준으로 근거, 결정, 미해결 위험과 사람 승인 상태를 보존하는 Canonical Artifact(기준 작업 폴더)를 사용합니다. [공통 용어](../README.md#용어)를 먼저 확인하세요.

> 🎮 게임의 방향, 규칙, 콘텐츠, 화면 흐름과 제작 범위를 정리하려면 여기서
> 시작하세요. 처음에는 `처음 시작하기`와 목적별 레시피 하나만 읽으면 됩니다.

---

## Curated Archify 상태

[Curated Archify 상태 인덱스](../archify-diagrams/README.md)에서 Studio 후보의 검증·시각 QA 근거를 확인합니다. [한국어 Studio 전체 프로젝트 워크플로](../assets/archify/studio/studio-project-workflow.html)는 비전, 설계, 검토, 자산, 내보내기와 보류 후 재개 경로를 대화형 HTML로 보여 줍니다.

---

## 작업 규모와 결과

| 목표 규모 | 권장 시작 | 예상 결과 | 다음 문서 |
| --- | --- | --- | --- |
| 작은 실습 | [Studio 활용 사례 인덱스](use-cases/README.md) | 10분 안에 설명할 플레이 경험의 약속, 플레이 흐름 또는 규칙 가정 | [역량 사례](use-cases/competency-paths.md) |
| 단일 명세 | [스킬 워크벤치](use-cases/skill-workbench.md) | 상태·예외·UX·콘텐츠 중 하나의 검토 가능한 작업 초안 | [Studio FAQ](faq.md) |
| 전체 프로젝트 | [새 게임 GDD 레시피](recipes/new-game-gdd.md) | 범위·검토 gate와 재개 조건이 있는 Studio Artifact | [결과물 카탈로그](../use-cases/output-catalog.md) |

작은 실습과 단일 명세도 `content.md`와 근거를 남기며, 전체 프로젝트는 이를 대체하지 않고 범위와 사람 결정을 추가합니다. 최소·선택·확장 결과와 Studio → Career handoff는 [결과물 카탈로그](../use-cases/output-catalog.md)에서 확인합니다.

---

## 활용 사례와 진입점

### 대상 사용자

| 사용자 | 먼저 고를 경로 | 처음 확인할 결과 |
| --- | --- | --- |
| 기획 입문 학생 | [역량 사례](use-cases/competency-paths.md) | 작게 검증할 플레이 경험의 약속, 플레이 흐름 또는 규칙 초안 |
| 솔로·인디 개발자 | [콘셉트 사례](use-cases/concept-scenarios.md) | 제약·scope·prototype 질문이 있는 설계 경로 |
| 현업 기획자 | [스킬 워크벤치](use-cases/skill-workbench.md) | 특정 작업의 입력, 결과와 다음 handoff |
| 팀 리드·교육자·멘토 | [역량 사례](use-cases/competency-paths.md)와 [Studio FAQ](faq.md) | 검토 기준, 사람 결정과 재개 질문 |

### 직접 호출 또는 오케스트레이션

한 작업의 입력과 원하는 결과가 분명하면 [스킬 워크벤치](use-cases/skill-workbench.md)에서 해당 스킬을 직접 호출합니다. 복수 영역이 얽히거나 범위가 불명확하면 `$game-design-studio:orchestrate-game-design-project`로 시작해 최소 route와 사람 gate를 정합니다.

### 대표 사례와 예상 결과

사례 본문과 복사 가능한 요청문은 연결 문서가 소유합니다. 이 표는 선택을 돕는 짧은 입구이며, 본문을 다시 복제하지 않습니다.

| 사례 | 적합한 시작 | 구체적인 예상 결과 |
| --- | --- | --- |
| ST-C01 | [플레이어 경험과 게임 비전](use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전) | 게임 방향 원칙(`vision-pillars`)과 게임 기획 요약서(`game-design-brief`)의 플레이 경험 약속·제외 목표 초안 |
| ST-C03 | [규칙·상태·예외·데이터](use-cases/competency-paths.md#st-c03-규칙상태예외데이터) | `system-specification`의 rule, state, exception, authority 표 |
| ST-C04 | [UI·UX·온보딩·접근성](use-cases/competency-paths.md#st-c04-uiux온보딩접근성) | `ui-ux-flow-state`의 critical action·recovery와 접근성 검토 큐 |
| ST-C05 | [콘텐츠·내러티브·퀘스트·NPC](use-cases/competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc) | `narrative-quest-npc`의 quest state·choice·consequence 초안 |
| ST-C07 | [성장·경제·밸런스·LiveOps](use-cases/competency-paths.md#st-c07-성장경제밸런스liveops) | `economy-balance`의 source/sink 가정과 guardrail·rollback 질문 |
| ST-C08 | [제작·검토·이미지·출력](use-cases/competency-paths.md#st-c08-제작검토이미지출력) | `export-manifest.yml`의 pending·unavailable·blocked 준비 상태 |

### 상세 문서

- [Studio 활용 사례 인덱스](use-cases/README.md): 역량·콘셉트·직접 스킬 중 무엇부터 볼지 선택합니다.
- [역량 사례 8개](use-cases/competency-paths.md)와 [콘셉트 사례 10개](use-cases/concept-scenarios.md): 사례의 전체 흐름과 검토·재개를 읽습니다.
- [스킬 워크벤치](use-cases/skill-workbench.md): Studio 제품 작업의 직접 호출 신호와 피할 때를 비교합니다.
- [프로젝트 기억](memory.md): 승인된 설계 교훈의 로컬 보관, 요청별 제외와 후보 관리 방법을 확인합니다.
- [경쟁작·레퍼런스 분석](reference-analysis.md): 관찰 근거로 시스템을 비교하고 adopt·adapt·reject·hold 제안을 사람에게 검토받습니다.
- [용어 사전 검토](glossary.md): 후보 용어를 사람 승인과 스냅샷에 묶고 원문 자동 치환을 막습니다.
- [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md): shot, 프롬프트, wave별 비용·승인과 continuity gate를 분리합니다.
- [Studio FAQ](faq.md): 현재 막힌 질문의 실행 요청과 관련 사례를 찾습니다.
- [공통 결과물 카탈로그](../use-cases/output-catalog.md): 최소·선택·확장 결과와 Canonical Artifact 읽는 순서를 확인합니다.
- [요청문 템플릿 허브](../prompt-templates/README.md): 사용자 유형·난이도별 요청과 예상 결과를 비교합니다.
- 대표 카드: [비전 입문](../prompt-templates/studio/define-game-vision.md#studiodefine-game-visionbeginner), [시스템 표준](../prompt-templates/studio/design-game-systems.md#studiodesign-game-systemsstandard), [UX 표준](../prompt-templates/studio/design-player-experience.md#studiodesign-player-experiencestandard), [프로젝트 재개 고급](../prompt-templates/studio/orchestrate-game-design-project.md#studioorchestrate-game-design-projectadvanced)

---

## 처음 시작하기

1. [설치](installation.md)에서 App 또는 CLI 중 한 환경의 절차만 따라 설치합니다.
2. [5분 빠른 시작](quick-start.md)의 요청문 하나를 복사합니다.
3. [템플릿 15개](templates.md)에서 목적에 맞는 템플릿을 고르고, 필요하면 [스킬 24개](skills/README.md)의 연결된 스킬을 직접 호출합니다.
4. [목적별 레시피](#목적별-레시피) 하나를 선택합니다.
5. [전체 워크플로](workflow.md)에서 현재 단계와 다음 사람 결정을 확인합니다.
6. [이미지 자산](image-assets.md)에서 image slot과 사람 승인 경계를 계획합니다.
7. 컷씬 이미지가 필요하면 [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md)에서 Prompt Only, Estimate Only, Generate After Approval 순서를 확인합니다.
8. [시각화](visualization.md)에서 Skillstead SVG와 PNG 검증을 준비합니다.
9. [MD·PDF·DOCX·PPTX 내보내기](exports.md)에서 필요한 형식만 준비합니다.
10. 막히면 [문제 해결](troubleshooting.md)에서 보존된 결과로 재개합니다.

---

## 목적별 레시피

- [새 게임 GDD](recipes/new-game-gdd.md)
- [시스템 기능 명세](recipes/system-feature-spec.md)
- [콘텐츠·퀘스트 설계](recipes/content-quest-design.md)
- [UX·접근성](recipes/ux-accessibility.md)
- [경제·LiveOps](recipes/economy-liveops.md)
- [제작 검토·내보내기](recipes/production-review-export.md)

대표 도식:

- [![Studio 오케스트레이션 맵](../assets/game-design-studio/studio-orchestration-map.png)](../assets/game-design-studio/studio-orchestration-map.svg)
- [Studio 오케스트레이션 맵 SVG 열기](../assets/game-design-studio/studio-orchestration-map.svg)
- [![비전에서 GDD 승인까지](../assets/game-design-studio/vision-to-gdd-approval.png)](../assets/game-design-studio/vision-to-gdd-approval.svg)
- [비전에서 GDD 승인까지 SVG 열기](../assets/game-design-studio/vision-to-gdd-approval.svg)

---

## 가이드 목차

현재 사용할 수 있는 진입 문서:

- [설치](installation.md)
- [5분 빠른 시작](quick-start.md)
- [전체 워크플로](workflow.md)
- [프로젝트 기억](memory.md)
- [경쟁작·레퍼런스 분석](reference-analysis.md)
- [용어 사전 검토](glossary.md)
- [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md)
- [문제 해결](troubleshooting.md)

전체 레퍼런스:

- [스킬 24개](skills/README.md)
- [템플릿 15개](templates.md)
- [문서 품질 profile](document-quality.md)
- [이미지 자산](image-assets.md)
- [시각화](visualization.md)
- [MD·PDF·DOCX·PPTX 내보내기](exports.md)

각 스킬 ID는 [스킬 24개](skills/README.md)에서 해당 상세 가이드로 직접 연결됩니다. 컷씬 전용 순서는 [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md)에서 확인합니다. 각 템플릿의 용도와 복사 가능한 요청문은 [템플릿 15개](templates.md)에 있습니다.

---

## 작업 원칙

- 게임 아이디어 한두 문장으로 시작할 수 있지만, 가정은 사실과 분리합니다.
- Canonical Artifact의 `content.md`가 내용 기준입니다. 렌더 결과나 대화만을 새 기준으로 삼지 않습니다.
- 이미지 생성, 도식 렌더, 문서 내보내기가 실패해도 검증된 Markdown과 기존 자산을 보존합니다.
- 생성 이미지와 렌더 결과는 자동 승인되지 않습니다. 권리와 품질을 확인한 이름 있는 사람의 결정이 필요합니다.
