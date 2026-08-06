# Game Design Plugin 사용자 가이드

이 가이드는 처음 사용하는 사람이 Game Design Studio와 Game Design Career 중 하나를 고르고, 지원되는 환경에 설치해 첫 Canonical Artifact를 만드는 데 필요한 출발점입니다.

## 어떤 플러그인을 선택할까요?

| 목표 | 선택 | 첫 결과 |
| --- | --- | --- |
| 게임 아이디어를 실제 제작 가능한 기획으로 구체화 | Game Design Studio | 비전, 핵심 재미, 설계 원칙과 검증 기준을 담은 기획 브리프 |
| 시스템·콘텐츠·UX·경제·LiveOps·제작 계획을 연결 | Game Design Studio | 검토 가능한 게임 기획 Canonical Artifact |
| 목표 직무와 현재 역량을 진단하고 취업을 준비 | Game Design Career | 역할 선택, 역량 격차와 학습·증거 로드맵 |
| 역기획·포트폴리오·면접·주니어 성장을 관리 | Game Design Career | 근거가 연결된 Career Canonical Artifact |

- [Game Design Studio 가이드](game-design-studio/README.md)
- [Studio 목적별 레시피 6개](game-design-studio/README.md#목적별-레시피)
- [Game Design Career 가이드](game-design-career/README.md)

두 플러그인은 독립적으로 설치합니다. 게임을 설계하면서 동시에 취업 증거를 만들려면 둘 다 설치할 수 있지만, 각 작업의 기준 Artifact와 승인 상태는 섞지 마세요.

## 전체 가이드 탐색

각 제품 인덱스는 15개 스킬, 15개 템플릿, 6개 목적별 레시피와 설치·빠른 시작·workflow·품질·이미지·시각화·내보내기·문제 해결을 모두 연결합니다.

| 제품 | 시작 | 전체 카탈로그 | 목적별 작업 |
| --- | --- | --- | --- |
| Studio | [제품 인덱스](game-design-studio/README.md) · [설치](game-design-studio/installation.md) · [5분 시작](game-design-studio/quick-start.md) | [스킬 15개](game-design-studio/skills/README.md) · [템플릿 15개](game-design-studio/templates.md) | [레시피 6개](game-design-studio/README.md#목적별-레시피) |
| Career | [제품 인덱스](game-design-career/README.md) · [설치](game-design-career/installation.md) · [5분 시작](game-design-career/quick-start.md) | [스킬 15개](game-design-career/skills/README.md) · [템플릿 15개](game-design-career/templates.md) | [레시피 6개](game-design-career/README.md#목적별-레시피) |

## 지원 환경

이 저장소가 안내하는 플러그인 표면은 ChatGPT 데스크톱 앱의 Work 또는 Codex와 Codex CLI입니다. IDE 확장, 모바일, 일반 Chat에서는 플러그인을 사용할 수 있다고 가정하지 않습니다.

- App에서는 Work 또는 Codex를 선택하고 Plugins에서 설치한 뒤 **새 채팅**을 엽니다.
- CLI에서는 `/plugins` 브라우저 또는 `codex plugin` 명령으로 설치한 뒤 **새 세션**을 시작합니다.
- CLI `/plugins`의 활성화 전환과 App의 설치·사용 UI는 서로 다른 조작입니다.

공식 동작은 [OpenAI Plugins 안내](https://learn.chatgpt.com/docs/plugins)와 [Codex CLI plugin 명령](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin)에서 확인할 수 있습니다.

## 초보자 읽기 경로

| 상황 | 읽기 순서 |
| --- | --- |
| App에서 처음 설치 | 제품 가이드 → 설치의 `Codex App 설치` → 빠른 시작의 자연어 요청문 |
| CLI에서 처음 설치 | 제품 가이드 → 설치의 `Codex CLI 설치` → 설치 확인 → 빠른 시작의 명시적 스킬 요청문 |
| Studio로 제작 문서 작성 | Studio 빠른 시작 → 전체 워크플로 → 검토·자산·내보내기 단계 |
| Career로 취업 준비 | Career 빠른 시작 → 전체 워크플로 → 근거 프로젝트·포트폴리오 단계 |
| 중단된 작업 재개 | 제품 문제 해결 → 보존된 `content.md`와 차단 상태를 지정한 재개 요청문 |

## 용어

| 용어 | 뜻 |
| --- | --- |
| 플러그인 | 스킬, 참조 자료, 역할, hook과 자산을 함께 배포하는 설치 단위 |
| 스킬 | 특정 결과를 만들기 위한 재사용 가능한 작업 절차 |
| Canonical Artifact | `content.md`를 내용 기준으로 삼고 근거, 결정, 자산과 내보내기 상태를 함께 보존하는 작업 폴더 |
| Quality Profile | 문서 목적과 청중에 맞춰 필수 섹션, 표, 검토 기준과 승인 게이트를 정하는 계약 |
| 도식 | Skillstead로 만드는 구조적 SVG와 검증된 2× PNG 파생본 |
| 이미지 승인 | 생성 또는 렌더 결과를 이름이 기록된 사람이 권리·품질 근거와 함께 승인하는 별도 결정 |

플러그인은 합격, 흥행, 재미, 제작 가능성 또는 사람의 승인을 보장하지 않습니다. 사실, 추론, 가정, 미확정 결정과 차단 상태를 분리해 결과를 검토할 수 있게 합니다.
