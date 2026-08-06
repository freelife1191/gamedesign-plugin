# portfolio를 만들고 5축으로 검토하기

![portfolio 제작과 검토 루프](../../assets/game-design-career/portfolio-review-loop.png)

## 완료 목표

개인 기여와 팀 결과를 분리한 case study를 만들고, 5축 finding을 최소 repair backlog로 연결합니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- target competency, 공개 가능한 claim·evidence address, 개인/팀 attribution, rights·privacy 범위
- Canonical Artifact family: `game-design-career/<career-id>/creative-design-portfolio/`, `game-design-career/<career-id>/five-axis-review/`
- 템플릿: `creative-design-portfolio`, `five-axis-review`, `portfolio-backlog`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 이름, 연락처, 비공개 Jira·회사 자료를 넣지 않고 공개 가능한 evidence ID만 사용해 portfolio case study와 5축 review를 만들어. 관찰 사실·추론·제안과 attribution을 분리해.
```

Codex CLI 명시 호출:

```text
$game-design-career:build-game-design-portfolio game-design-career/<career-id>/creative-design-portfolio/를 작성하고 $game-design-career:review-game-design-portfolio, $game-design-career:plan-image-assets로 five-axis-review와 asset plan을 연결해.
```

## 단계별 진행

1. claim과 evidence address를 `관찰 사실`로 두고, 외부 current evidence는 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 기록합니다.
2. reviewer finding은 `추론`, 다음 repair는 `제안`으로 구분하며 inspectability가 없는 impact는 gap으로 남깁니다.
3. stale external evidence는 재검색해 새 locator를 추가하고, 원래 claim과 review history는 보존합니다.
4. `prompt-only`는 plan만, `select`는 receipt asset만, `required`는 required finite asset만, `all`은 declared asset만 생성 대상으로 삼습니다.

## 사람이 결정할 지점

Portfolio Owner **정하늘**이 claim·attribution을, Rights Reviewer **윤태호**가 이미지 rights·privacy와 공개 상태를 승인합니다.

## 예상 결과

`creative-design-portfolio/content.md`, `five-axis-review/content.md`, `portfolio-backlog/content.md`에 evidence index와 minimum repair가 남습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable으로 남기고 Canonical Artifact와 기존 output을 보존합니다. unsupported claim은 삭제로 숨기지 않고 missing evidence와 owner action으로 재개합니다.

## 관련 기능

- [portfolio 구축](../skills/build-game-design-portfolio.md), [portfolio 검토](../skills/review-game-design-portfolio.md), [이미지 자산](../image-assets.md)
- [이미지 자산 수명주기](../../assets/shared/image-asset-lifecycle.png)
