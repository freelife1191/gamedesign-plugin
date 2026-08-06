# define-game-vision

## 목적과 최종 산출물

대상 플레이어, 의도 경험, 원하는 감정, 핵심 재미, pillar와 검증 기준을 `vision-pillars` artifact로 만듭니다.

## 사용할 때

- 새 게임의 player promise와 core/motivation loop를 정할 때
- 기능이 비전을 지지하는지 판단할 측정 기준이 필요할 때

## 사용하지 않을 때

- 실행 규칙과 state transition은 `design-game-systems`를 사용합니다.
- 퀘스트·NPC·보스 단위는 `design-game-content`를 사용합니다.

## 필수 입력과 선택 입력

- 필수: target-player evidence, experience intent, desired emotion, 제약, decision owner
- 선택: player research, business/platform constraints, 기존 vision 문서, 검토 질문
- 누락된 demographic·성공 수치는 만들지 않고 provisional validation task로 남깁니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 4인 모바일 협동 RPG의 대상 플레이어, 핵심 재미, design pillar, anti-pillar와 검증 기준을 정의해. 근거 없는 수치는 provisional로 남겨 줘.
```

## Codex CLI 요청 예시

```text
$game-design-studio:define-game-vision 4인 모바일 협동 RPG의 target player·desired emotion·core fun·pillar·검증 기준을 vision-pillars로 작성해.
```

## 내부 진행 흐름

근거, 외부 자료, 가정, 미해결 질문을 분리한 뒤 player verbs·decisions·feedback으로 핵심 재미를 운영 가능하게 정의합니다. 주 템플릿/profile은 `vision-pillars`/`vision-one-pager`, 관련 역할은 `lead-game-designer`와 `content-narrative-designer`, 다음 스킬은 `design-game-systems`입니다.

## 생성 파일과 결과 구조

Canonical Artifact의 `content.md`, `evidence.yml`, decisions와 검토 항목에 target player, pillars, loops, meaningful choice, metrics, assumptions와 owner를 남깁니다. 예상 결과 요약: 팀이 기능 선택에 사용할 검증 가능한 비전 기준이 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `vision-pillars` — [vision-pillars 템플릿](../templates.md#vision-pillars).
- Quality Profile ID: `vision-one-pager`.
- Reviewer/role ID: `lead-game-designer · content-narrative-designer`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

`vision-reference-image`는 player promise를 검토할 때만 illustration lifecycle로 계획합니다. pillar·loop 의존성은 `skillstead-vision-dependency-diagram`으로 구조적으로 설명할 때만 만듭니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

claim은 `provided`, `sourced`, `assumption`, `provisional`로 구분합니다. 적용 가능한 responsible-design gate는 먼저 `pending`이며 missing evidence나 자동 생성 결과는 승인이 아닙니다.

## 실패·fallback·재개 방법

대상 플레이어 근거나 owner가 부족해도 초안을 보존하고 질문과 validation task를 남깁니다.

```text
$game-design-studio:define-game-vision 기존 vision-pillars를 유지하고, 새로 제공한 플레이테스트 근거를 evidence.yml에 연결해 provisional 성공 기준부터 다시 검토해.
```

## 다음 작업 요청문

**복사 가능한 다음 handoff**

@Game Design Studio design-game-systems로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-studio:design-game-systems artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[vision-pillars 템플릿](../templates.md#vision-pillars), [design-game-systems 스킬](./design-game-systems.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
