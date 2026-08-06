# 관찰 기반 역기획을 portfolio 증거로 만들기

![역기획에서 portfolio로 가는 흐름](../../assets/game-design-career/reverse-design-portfolio-flow.png)

## 완료 목표

플레이 가능한 공개 build의 관찰과 가설을 구분한 역기획서를 만들고, 검증 가능한 부분만 portfolio 후보로 연결합니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- 공개 build, 플랫폼·버전·관찰 시점, 허용된 screenshot/source와 검증 질문
- Canonical Artifact family: `game-design-career/<career-id>/reverse-design-document/`
- 템플릿: `reverse-design-document`, `game-analysis-report`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 계정, 사용자명, 비공개 테스트 자료를 제외한 공개 build 관찰만 사용해 crafting system 역기획을 써 줘. 관찰 사실·추론·제안과 반례·검증 방법을 분리해.
```

Codex CLI 명시 호출:

```text
$game-design-career:reverse-engineer-game-design game-design-career/<career-id>/reverse-design-document/에서 관찰 record를 만들고 $game-design-career:visualize-career-roadmap, $game-design-career:export-career-documents로 검토용 SVG와 export manifest를 준비해.
```

## 단계별 진행

1. 직접 본 행동을 `관찰 사실`로 기록하고 `sourceUrl` 또는 build `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 명시합니다.
2. 의도·내부 구현은 확정하지 않고 `추론`과 confidence, counterexample을 붙이며, 다음 playtest는 `제안`으로 둡니다.
3. stale build evidence는 재검색 또는 재관찰해 version·location을 갱신하고, 이전 record는 보존합니다.
4. 이미지 asset은 `prompt-only` placeholder, `select` human receipt, `required` finite manifest, `all` declared asset의 네 경계를 지킵니다.

## 사람이 결정할 지점

Design Reviewer **한지훈**이 inference 공개 범위를, Rights Reviewer **오지은**이 screenshot·source 사용 권한과 export 범위를 승인합니다.

## 예상 결과

`reverse-design-document/content.md`와 export manifest에 observation, inference, validation queue, 권리 결정이 남습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable으로 남기고 Canonical Artifact와 기존 output을 보존합니다. missing observation은 만들지 말고 validation queue와 기존 record에서 재개합니다.

## 관련 기능

- [역기획](../skills/reverse-engineer-game-design.md), [Career 시각화](../skills/visualize-career-roadmap.md), [내보내기](../exports.md)
- [문서 내보내기 흐름](../../assets/shared/document-export-flow.png)
