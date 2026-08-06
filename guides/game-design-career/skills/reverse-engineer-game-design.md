# reverse-engineer-game-design

## 목적과 산출물

실제 게임의 UI·규칙·예외·data behavior·operation을 관찰해 사실과 falsifiable 추론이 분리된 역기획 모델을 만듭니다.

## 사용할 때

- 게임 build의 UI state와 visible value 변화로 rule을 역추적할 때
- internal design record 없이 economy·operation 가설과 validation method를 정리할 때

## 사용하지 않을 때

- 플레이 방법만 설명하는 user manual을 만들 때
- game-specific evidence가 없는데 internal intent나 구현을 “가장 가능성 높음”으로 단정할 때

## 필수 입력과 선택 입력

- 필수: build/version, platform, account/player state, region, time window, accessible source와 evidence address
- 선택: screenshots, repeated observations, comparison build와 contradictory evidence
- claim마다 observation, inference, confidence, counterexample, alternative와 `validationMethod`를 별도로 기록합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 게임의 제작 UI, 자원 변화와 예외를 관찰 기반으로 역기획해. 사실과 추론을 나누고 각 가설에 반례, 대안과 다음 검증 방법을 붙여.
```

## Codex CLI 예시

```text
$game-design-career:reverse-engineer-game-design surface=ui,rules,data,operations, source=observations/crafting-build-1.4
```

## 진행 흐름

scope를 고정하고 independently falsifiable claim record를 만듭니다. player action을 UI state, rule/exception, visible data change, downstream operation과 unresolved uncertainty로 trace합니다. observation이 없으면 `inference: null`, `confidence: unassessed`로 두고 가능한 관찰만 제안합니다.

## 결과와 파일

`reverse-design-document` 또는 `game-analysis-report`의 scope, claim records, relationship trace, competing explanations, contradiction log, validation queue와 unknowns를 반환합니다. 예상 결과 요약: reviewer가 관찰과 설계 가설을 각각 반박하거나 확인할 수 있습니다.

## 검토와 승인

사실은 recorded scope의 관찰·인용에만 한정합니다. confidence는 수사적 확신이 아니라 evidence support입니다. 제3자 screenshot·게임 자료는 source, use purpose, rights와 privacy를 사람이 검토합니다.

## 실패와 재개

접근 불가 surface와 모순 관찰은 삭제하지 않고 uncertainty와 validation task로 남깁니다. 내부 의도·data structure를 증거 없이 채우지 않습니다.

```text
$game-design-career:reverse-engineer-game-design 기존 claimId와 contradiction log를 유지하고 새 build 관찰만 추가해 validation queue부터 재개해.
```
