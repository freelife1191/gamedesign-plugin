# 경력 경로 구조 도식 만들기

## 목적과 최종 산출물

`archify`는 역량 경로, 포트폴리오 준비 흐름, 면접 준비 상태를 읽기 쉬운 한국어 HTML 도식으로 정리합니다.

## 사용할 때

학습 과제와 증거, 검토 지점의 관계를 한 번에 설명해야 할 때 사용합니다. 목표가 불명확하면 `orchestrate-game-design-career`로 먼저 경로를 고릅니다.

## 사용하지 않을 때

채용 결과를 예측하거나, 검증하지 않은 경력을 사실처럼 보이게 만들 때는 사용하지 않습니다.

## 필수 입력과 선택 입력

- 필수: 현재 근거, 목표 역할, 다음 과제와 검토자
- 선택: workflow 또는 lifecycle 유형, 발표용 강조점

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 시스템 기획 포트폴리오 준비 흐름을 한국어 Archify HTML로 그려줘. 현재 증거와 다음 과제를 구분해.
```

## Codex CLI 요청 예시

```text
$game-design-career:archify 현재 역량·과제·멘토 검토 흐름을 한국어 workflow HTML로 정리해.
```

## 내부 진행 흐름

경력 결과물의 `content.md`와 근거를 읽고 알맞은 도식 유형을 고릅니다. JSON 원본을 검증한 뒤 HTML과 검증 기록을 남기며, 역할 적합성은 멘토가 판단합니다.

## 생성 파일과 결과 구조

`assets/`에 도식 JSON·HTML·검증 기록을 남깁니다. 예상 결과는 학습 대화에 쓰는 경력 흐름 도식이며, 채용 승인을 입증하는 자료가 아닙니다.

## 관련 템플릿·품질 프로필·전문 역할

[포트폴리오 스킬](build-game-design-portfolio.md)과 `game-design-mentor`가 결과를 검토합니다.

## 이미지·도식화 조건

관계 설명이 필요한 경우에만 사용합니다. SVG 인포그래픽은 [경력 도식 만들기](svg-infographic.md), 이미지 생성은 [이미지 자산 안내](../image-assets.md)를 따릅니다.

## 검토·승인 기준

노드마다 공개 가능한 근거나 `미정` 표기를 남깁니다. HTML 검증은 경력 사실이나 채용 결과를 보장하지 않습니다.

## 실패했을 때와 재개 방법

검증 오류는 해당 관계만 고쳐 재검사합니다. 근거가 부족하면 도식 대신 다음 조사 과제를 남깁니다.

## 다음 작업 요청문

자리표시자 `<artifact-path>`와 `<diagram-path>`은 실제 경로로 바꿉니다. [공통 규칙](../../README.md#용어)을 따릅니다.

```text
$game-design-career:review-game-design-portfolio artifact=<artifact-path> diagram=<diagram-path> 공개 가능 근거와 다음 과제를 검토해.
```

## 관련 문서

[Career 스킬 선택표](README.md), [도식화 안내](../visualization.md), [전체 시스템 구조 HTML](../../assets/archify/suite/suite-plugin-system-architecture.html)
