# Game Design Plugin 사용자 가이드

이 가이드는 처음 사용하는 사람이 Game Design Studio와 Game Design Career 중 하나를 고르고, 지원되는 환경에 설치해 첫 Canonical Artifact(기준 작업 폴더)를 만드는 데 필요한 출발점입니다.

> 🧭 처음이라면 아래에서 목표에 맞는 플러그인을 고른 뒤 `처음 시작하기` 순서만
> 따라가세요. 나머지 문서는 필요한 작업이 생겼을 때 찾아보면 됩니다.

---

## 어떤 플러그인을 선택할까요?

| 목표 | 선택 | 첫 결과 |
| --- | --- | --- |
| 게임 아이디어를 실제 제작 가능한 기획으로 구체화 | Game Design Studio | 게임 방향, 핵심 재미, 설계 원칙과 검증 기준을 담은 기획 요약서 |
| 시스템·콘텐츠·UX·경제·LiveOps·제작 계획을 연결 | Game Design Studio | 검토 가능한 게임 기획 Canonical Artifact |
| 목표 직무와 현재 역량을 진단하고 취업을 준비 | Game Design Career | 역할 선택, 역량 격차와 학습·증거 로드맵 |
| 역기획·포트폴리오·면접·주니어 성장을 관리 | Game Design Career | 근거가 연결된 Career Canonical Artifact |

- [Game Design Studio 가이드](game-design-studio/README.md)
- [Studio 목적별 레시피 6개](game-design-studio/README.md#목적별-레시피)
- [Game Design Career 가이드](game-design-career/README.md)

---

## Curated Archify 상태

[Curated Archify 상태 인덱스](archify-diagrams/README.md)는 검증된 Archify HTML 공개물과 차단된 후보의 근거·재시도 경계를 분리해 기록합니다. 현재 공개된 한국어 Archify diagram은 **5개**입니다.

- [플러그인 모음 전체 시스템 구조](assets/archify/suite/suite-plugin-system-architecture.html)
- [Studio 전체 프로젝트 워크플로](assets/archify/studio/studio-project-workflow.html)
- [Career 증거·포트폴리오 워크플로](assets/archify/career/career-evidence-workflow.html)
- [Studio → Career 공개 근거 인계](assets/archify/suite/suite-studio-career-handoff.html)
- [프로젝트 기억 저장·승인·재사용 흐름](assets/archify/suite/suite-project-memory-lifecycle.html)

두 플러그인은 독립적으로 설치합니다. 게임을 설계하면서 동시에 취업 증거를 만들려면 둘 다 설치할 수 있지만, 각 작업의 기준 Artifact와 승인 상태는 섞지 마세요.

---

## 목표에서 다음 문서까지

| 목표 | 대표 문서 | 예상 결과 | 다음 상세 문서 |
| --- | --- | --- | --- |
| 작은 규칙·루프·시스템·UX를 학습 | [Studio 활용 사례 인덱스](game-design-studio/use-cases/README.md) | 작게 검토할 가정, 규칙 또는 UX 초안 | [Studio 스킬 워크벤치](game-design-studio/use-cases/skill-workbench.md) · [Studio FAQ](game-design-studio/faq.md) |
| 전체 GDD와 제작 검토를 연결 | [Game Design Studio 가이드](game-design-studio/README.md) | 범위·검토 게이트가 있는 Studio Artifact | [결과물 카탈로그](use-cases/output-catalog.md) |
| **승인된 프로젝트 교훈을 재사용** | [프로젝트 기억 공통 가이드](project-memory.md) | 출처·범위·만료가 확인된 적용 기록과 검토 대기 후보 | [Studio 기억](game-design-studio/memory.md) · [Career 기억](game-design-career/memory.md) |
| **경쟁작·레퍼런스의 게임 시스템을 분석** | [Studio 레퍼런스 분석](game-design-studio/reference-analysis.md) 또는 [Career 레퍼런스 분석](game-design-career/reference-analysis.md) | 관찰 근거, 시스템 지도, 비교와 검토 대기 설계 전환 제안 | [공통 활용 허브](use-cases/README.md) |
| **한국어·영어 기획 용어를 일관되게 관리** | [Studio 용어 사전](game-design-studio/glossary.md) 또는 [Career 용어 사전](game-design-career/glossary.md) | 문서 영향 목록, 승인 전 후보와 사람 승인 스냅샷 | [공통 활용 허브](use-cases/README.md) |
| **컷씬의 장면·프롬프트·이미지 비용을 나눠 준비** | [컷씬 장면·이미지 사전 설계](game-design-studio/cutscene-visual-preproduction.md) | **승인 전 이미지 제공자 호출 0회**를 지키는 컷씬 패키지와 단계별 비용·연속성 검토 | [Studio 이미지 자산](game-design-studio/image-assets.md) |
| 직무 탐색·역기획·포트폴리오·면접 준비 | [Career 활용 사례 인덱스](game-design-career/use-cases/README.md) | 근거·개인 기여·다음 증거 작업 | [Career 스킬 워크벤치](game-design-career/use-cases/skill-workbench.md) · [Career FAQ](game-design-career/faq.md) |
| 현재 상황과 결과 경계를 먼저 확인 | [사용자 경로](use-cases/audience-paths.md) | 권장 시작점, 최소 결과와 사람 검토 경계 | [공통 활용 허브](use-cases/README.md) · [결과물 카탈로그](use-cases/output-catalog.md) |

---

## 처음 시작하기

Studio 또는 Career 한 제품을 고른 뒤 다음 순서로 진행합니다.

1. [설치](game-design-studio/installation.md) 또는 [Career 설치](game-design-career/installation.md)에서 App·CLI 중 한 환경만 설정합니다.
2. [Studio 5분 빠른 시작](game-design-studio/quick-start.md) 또는 [Career 5분 빠른 시작](game-design-career/quick-start.md)으로 첫 요청을 만듭니다.
3. [Studio 템플릿](game-design-studio/templates.md)·[스킬](game-design-studio/skills/README.md) 또는 [Career 템플릿](game-design-career/templates.md)·[스킬](game-design-career/skills/README.md)에서 목적에 맞는 템플릿을 고르고, 필요하면 연결된 스킬을 직접 호출합니다.
4. 제품 README의 [Studio 목적별 레시피](game-design-studio/README.md#목적별-레시피) 또는 [Career 목적별 레시피](game-design-career/README.md#목적별-레시피)를 선택합니다.
5. [Studio 전체 작업 흐름](game-design-studio/workflow.md) 또는 [Career 전체 작업 흐름](game-design-career/workflow.md)에서 다음 사람 결정을 확인합니다.
6. [Studio 이미지 자산](game-design-studio/image-assets.md) 또는 [Career 이미지 자산](game-design-career/image-assets.md)으로 image slot을 계획합니다.
7. [Studio 시각화](game-design-studio/visualization.md) 또는 [Career 시각화](game-design-career/visualization.md)에서 Skillstead SVG를 만듭니다.
8. [Studio 내보내기](game-design-studio/exports.md) 또는 [Career 내보내기](game-design-career/exports.md)로 필요한 형식만 준비합니다.
9. [Studio 문제 해결](game-design-studio/troubleshooting.md) 또는 [Career 문제 해결](game-design-career/troubleshooting.md)로 안전하게 재개합니다.

### 사용자 유형·난이도별 요청문

[요청문 템플릿 허브](prompt-templates/README.md)는 입문·표준·고급·사례 카드를 사용자 유형과 목표별로 묶습니다. 각 카드에서 복사할 요청문, 실행 흐름, 예상 결과, 사람 검토와 실패·재개 경계를 함께 확인합니다.

- Studio 입문: [비전 가설](prompt-templates/studio/define-game-vision.md#studiodefine-game-visionbeginner)
- Studio 표준: [시스템](prompt-templates/studio/design-game-systems.md#studiodesign-game-systemsstandard), [UX·접근성](prompt-templates/studio/design-player-experience.md#studiodesign-player-experiencestandard)
- Studio 고급: [차단된 프로젝트 재개](prompt-templates/studio/orchestrate-game-design-project.md#studioorchestrate-game-design-projectadvanced)
- Career 입문·표준·고급: [직무 가설](prompt-templates/career/map-game-design-career.md#careermap-game-design-careerbeginner), [역기획](prompt-templates/career/reverse-engineer-game-design.md#careerreverse-engineer-game-designstandard), [포트폴리오](prompt-templates/career/build-game-design-portfolio.md#careerbuild-game-design-portfolioadvanced)
- 사례: [프로젝트 증거와 면접](prompt-templates/suite/career-proof-project-interview.md#suitecareer-proof-project-interviewcase)

---

## 전체 가이드 탐색

Studio 인덱스는 설치 스킬 24개, Career 인덱스는 설치 스킬 23개와 각각 15개 템플릿, 6개 목적별 레시피, 설치·빠른 시작·전체 작업 흐름·품질·이미지·시각화·내보내기·문제 해결을 연결합니다.

| 제품 | 시작 | 전체 카탈로그 | 목적별 작업 |
| --- | --- | --- | --- |
| Studio | [제품 인덱스](game-design-studio/README.md) · [설치](game-design-studio/installation.md) · [5분 시작](game-design-studio/quick-start.md) | [스킬 24개](game-design-studio/skills/README.md) · [공통 기억](project-memory.md) · [Studio 기억](game-design-studio/memory.md) · [레퍼런스 분석](game-design-studio/reference-analysis.md) · [용어 사전](game-design-studio/glossary.md) · [컷씬](game-design-studio/cutscene-visual-preproduction.md) · [템플릿 15개](game-design-studio/templates.md) | [레시피 6개](game-design-studio/README.md#목적별-레시피) |
| Career | [제품 인덱스](game-design-career/README.md) · [설치](game-design-career/installation.md) · [5분 시작](game-design-career/quick-start.md) | [스킬 23개](game-design-career/skills/README.md) · [공통 기억](project-memory.md) · [Career 기억](game-design-career/memory.md) · [레퍼런스 분석](game-design-career/reference-analysis.md) · [용어 사전](game-design-career/glossary.md) · [템플릿 15개](game-design-career/templates.md) | [레시피 6개](game-design-career/README.md#목적별-레시피) |

---

## 활용 사례와 결과물

[공통 활용 허브](use-cases/README.md)는 사용자 상황과 요청문을, [사용자 경로](use-cases/audience-paths.md)는 여섯 사용자군의 단계별 경로를, [결과물 카탈로그](use-cases/output-catalog.md)는 최소·선택·확장 결과와 Studio → Career 인계 경계를 설명합니다. 도식의 확인 기준은 [Visual QA](assets/VISUAL-QA.md)에서 봅니다.

| 탐색 방식 | Studio | Career |
| --- | --- | --- |
| 역량 사례 | [역량 사례](game-design-studio/use-cases/competency-paths.md) | [역량 사례](game-design-career/use-cases/competency-paths.md) |
| 콘셉트·대상 사례 | [콘셉트 사례](game-design-studio/use-cases/concept-scenarios.md) | [대상 사례](game-design-career/use-cases/concept-scenarios.md) |
| 직접 스킬 | [스킬 워크벤치](game-design-studio/use-cases/skill-workbench.md) | [스킬 워크벤치](game-design-career/use-cases/skill-workbench.md) |
| 대표 사례 | [ST-C03 규칙·상태·예외·데이터](game-design-studio/use-cases/competency-paths.md#st-c03-규칙상태예외데이터) | [CA-C06 창작 기획 포트폴리오](game-design-career/use-cases/competency-paths.md#ca-c06-창작-기획-포트폴리오) |
| 제품 질문 | [Studio FAQ](game-design-studio/faq.md) | [Career FAQ](game-design-career/faq.md) |

---

## 입문에서 포트폴리오까지 읽기

1. **입문:** [AUD-01 사용자 경로](use-cases/audience-paths.md#aud-01-게임-기획-입문-학생)에서 작은 관찰과 규칙 실습을 고릅니다.
2. **기초·응용:** Studio 또는 Career의 역량·콘셉트·직접 스킬 중 현재 입력에 맞는 하나를 선택합니다.
3. **포트폴리오:** [결과물 카탈로그](use-cases/output-catalog.md#studio-career-handoff)의 공개·권리·개인 기여 경계를 읽고, Studio 원본을 합치지 않은 별도 Career Artifact를 만듭니다.
4. **전체 프로젝트:** 범위와 검토 게이트가 여러 개면 제품 오케스트레이터와 workflow로 돌아가 사람 결정을 남깁니다.

---

## 지원 환경

이 저장소가 안내하는 플러그인 표면은 ChatGPT 데스크톱 앱의 Work 또는 Codex와 Codex CLI입니다. IDE 확장, 모바일, 일반 Chat에서는 플러그인을 사용할 수 있다고 가정하지 않습니다.

- App에서는 Work 또는 Codex를 선택하고 Plugins에서 설치한 뒤 **새 채팅**을 엽니다.
- CLI에서는 `/plugins` 브라우저 또는 `codex plugin` 명령으로 설치한 뒤 **새 세션**을 시작합니다.
- CLI `/plugins`의 활성화 전환과 App의 설치·사용 UI는 서로 다른 조작입니다.

공식 동작은 [OpenAI Plugins 안내](https://learn.chatgpt.com/docs/plugins)와 [Codex CLI plugin 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin)에서 확인할 수 있습니다.

---

## 초보자 읽기 경로

| 상황 | 읽기 순서 |
| --- | --- |
| App에서 처음 설치 | [처음 시작하기](#처음-시작하기) 1–9단계를 따르되 2단계에서 App 자연어 요청문을 사용 |
| CLI에서 처음 설치 | [처음 시작하기](#처음-시작하기) 1–9단계를 따르되 2단계에서 CLI 명시적 스킬 요청문을 사용 |
| Studio로 제작 문서 작성 | [처음 시작하기](#처음-시작하기) 3–8단계에서 Studio 템플릿·스킬·레시피·workflow를 순서대로 선택 |
| Career로 취업 준비 | [처음 시작하기](#처음-시작하기) 3–8단계에서 Career 템플릿·스킬·레시피·workflow를 순서대로 선택 |
| 중단된 작업 재개 | [처음 시작하기](#처음-시작하기) 9단계와 제품 문제 해결에서 보존된 `content.md`와 차단 상태를 지정 |

---

## 용어

| 용어 | 뜻 |
| --- | --- |
| 플러그인 | 스킬, 참조 자료, 역할, hook과 자산을 함께 배포하는 설치 단위 |
| 스킬 | 특정 결과를 만들기 위한 재사용 가능한 작업 절차 |
| Canonical Artifact | `content.md`를 내용 기준으로 삼고 근거, 결정, 자산과 내보내기 상태를 함께 보존하는 작업 폴더 |
| Quality Profile | 문서 목적과 청중에 맞춰 필수 섹션, 표, 검토 기준과 승인 게이트를 정하는 계약 |
| 도식 | Skillstead로 만드는 구조적 SVG와 검증된 2× PNG 파생본 |
| **프로젝트 기억** | 출처·적용 범위·검토 시점과 사람 승인 상태에 묶인 로컬 프로젝트 기록 |
| **레퍼런스 분석** | 관찰 근거와 추론을 분리해 시스템 지도·비교·설계 전환 제안을 만드는 절차 |
| **용어 사전** | 한국어·영어 선호 용어와 문서 영향을 검토하고 이름이 기록된 사람의 결정으로 스냅샷을 갱신하는 계약 |
| **컷씬 장면·이미지 사전 설계** | 장면·마스터 프롬프트·비용 확인·생성 승인·연속성 검토를 네 단계로 나누는 Studio 절차 |
| **이미지 승인** | 생성 또는 렌더 결과를 이름이 기록된 사람이 권리·품질 근거와 함께 승인하는 별도 결정 |
| UX | 사용자가 화면·입력·피드백을 이해하고 작업을 마칠 수 있게 만드는 경험 설계입니다. |
| LiveOps | 출시 뒤 이벤트·실험·밸런스 변경을 측정하고 되돌릴 수 있게 운영하는 일입니다. |
| renderer capability | 현재 host가 PDF·문서·발표 파일을 실제로 만들고 검사할 수 있는지 probe가 알려 주는 기능 상태입니다. |
| QA | 결과가 요구 형식·내용·화면 품질을 충족하는지 확인하는 검사 기록입니다. |
| 목록 (`manifest`) | 어떤 파일·형식·자산·검사를 준비했는지 안정 ID로 적는 작업 목록입니다. |
| 안정 자산 ID (`stable asset ID`) | 계획·생성·검토를 거쳐도 바뀌지 않는 이미지 자산의 고유 이름입니다. |
| 영수 기록 (`receipt`) | 호스트가 실제 사용자 선택·승인과 증거를 변경 불가능한 구조로 기록한 내역입니다. |
| 자리 (`slot`) | 템플릿에서 이미지나 도식처럼 필요한 자산을 넣을 위치와 조건을 가리키는 항목입니다. |
| 호스트 (`host`) | 지금 대화나 세션을 실행하며 파일 생성 기능을 제공할 수 있는 Codex 실행 환경입니다. |
| 기능 확인 (`probe`) | 호스트가 PDF·문서·발표 파일 같은 기능을 실제로 쓸 수 있는지 먼저 확인하는 점검입니다. |
| 사전 점검 (`preflight`) | 파일을 만들기 전에 결과물, 입력, 안전한 출력 경로와 기능 상태를 검사해 준비 목록을 만드는 단계입니다. |
| 후속 작업 (`downstream workflow`) | 사전 점검 뒤 필요한 기능을 갖춘 별도 작업이 실제 파일 생성과 형식 품질 검사를 수행하는 단계입니다. |
| `<artifact-path>` / `<export-manifest-path>` / `<selected-skill>` | 복사 전 사용자가 실제 artifact 경로, export manifest 경로, routing에서 선택한 skill ID로 바꿔야 하는 자리표시자입니다. shell redirection이나 실제 파일명으로 해석하지 않습니다. |

플러그인은 합격, 흥행, 재미, 제작 가능성 또는 사람의 승인을 보장하지 않습니다. 사실, 추론, 가정, 미확정 결정과 차단 상태를 분리해 결과를 검토할 수 있게 합니다.
