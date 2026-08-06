# define-game-vision

## 목적과 산출물

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

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 4인 모바일 협동 RPG의 대상 플레이어, 핵심 재미, design pillar, anti-pillar와 검증 기준을 정의해. 근거 없는 수치는 provisional로 남겨 줘.
```

## Codex CLI 예시

```text
$game-design-studio:define-game-vision 4인 모바일 협동 RPG의 target player·desired emotion·core fun·pillar·검증 기준을 vision-pillars로 작성해.
```

## 진행 흐름

근거, 외부 자료, 가정, 미해결 질문을 분리한 뒤 player verbs·decisions·feedback으로 핵심 재미를 운영 가능하게 정의합니다. 주 템플릿/profile은 `vision-pillars`/`vision-one-pager`, 관련 역할은 `lead-game-designer`와 `content-narrative-designer`, 다음 스킬은 `design-game-systems`입니다.

## 결과와 파일

Canonical Artifact의 `content.md`, `evidence.yml`, decisions와 검토 항목에 target player, pillars, loops, meaningful choice, metrics, assumptions와 owner를 남깁니다. 예상 결과 요약: 팀이 기능 선택에 사용할 검증 가능한 비전 기준이 생깁니다.

## 검토와 승인

claim은 `provided`, `sourced`, `assumption`, `provisional`로 구분합니다. 적용 가능한 responsible-design gate는 먼저 `pending`이며 missing evidence나 자동 생성 결과는 승인이 아닙니다.

## 실패와 재개

대상 플레이어 근거나 owner가 부족해도 초안을 보존하고 질문과 validation task를 남깁니다.

```text
$game-design-studio:define-game-vision 기존 vision-pillars를 유지하고, 새로 제공한 플레이테스트 근거를 evidence.yml에 연결해 provisional 성공 기준부터 다시 검토해.
```
