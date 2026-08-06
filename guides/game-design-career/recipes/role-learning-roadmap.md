# 역할과 학습 로드맵을 증거 과제로 연결하기

![역할 gap과 학습 로드맵 흐름](../../assets/game-design-career/role-gap-learning-roadmap.png)

## 완료 목표

목표 역할의 요구와 현재 증거를 분리해, 검토 가능한 학습 과제와 재평가 시점을 가진 로드맵을 만듭니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- 목표 역할, 현재 단계, 공개 가능한 work sample, 시간·지역 제약
- Canonical Artifact family: `game-design-career/<career-id>/career-stage-goal/`, `game-design-career/<career-id>/learning-roadmap/`
- 템플릿: `career-stage-goal`, `game-design-role-map`, `learning-roadmap`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 개인정보·비공개 회사 자료 없이 공개 가능한 work sample만 사용해 시스템 기획 역할과 현재 증거의 gap을 로드맵으로 정리해. 관찰 사실, 추론, 제안을 분리하고 검토자를 지정해.
```

Codex CLI 명시 호출:

```text
$game-design-career:orchestrate-game-design-career game-design-career/<career-id>/career-stage-goal/를 기준으로 $game-design-career:map-game-design-career, $game-design-career:apply-document-quality-profile를 실행하고 game-design-career/<career-id>/learning-roadmap/에 저장해.
```

## 단계별 진행

1. 공개 가능한 evidence를 `관찰 사실`로 기록하고, 필요한 current evidence에는 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 함께 남깁니다.
2. `map-game-design-career`로 evidence가 지지하는 경로만 `추론`으로 표시하고, 빈 부분은 `제안`인 proof task로 둡니다.
3. `learning-roadmap`의 prerequisite, owner, proof artifact, cadence를 정하고 `reviewAfter`가 지난 stale evidence는 재검색 뒤에만 current claim에 다시 씁니다.
4. 이미지가 필요하면 `IMAGE_GEN_MODE=prompt-only`는 prompt와 placeholder만, `select`는 사람이 제출한 receipt의 stable ID만, `required`는 manifest의 finite required asset만, `all`은 선언된 asset만 처리합니다.

## 사람이 결정할 지점

Career Lead **김서윤**이 목표 역할과 공개 범위를, Mentor **박도현**이 proof task·cadence와 재평가 기준을 승인하거나 보류합니다. 생성 결과는 이 결정을 대신하지 않습니다.

## 예상 결과

`career-stage-goal/content.md`와 `learning-roadmap/content.md`에 evidence locator, gap, task, owner, 다음 review가 남습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다. stale current evidence는 재검색하며, 기존 evidence ID와 차단 이유를 유지한 채 `content.md`에서 재개합니다.

## 관련 기능

- [전체 워크플로](../workflow.md), [역할 매핑](../skills/map-game-design-career.md), [Career 시각화](../visualization.md)
- [학습 로드맵](../templates.md), [공통 이미지 모드](../../assets/shared/image-generation-mode-routing.png)
