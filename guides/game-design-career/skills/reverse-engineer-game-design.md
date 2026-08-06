# reverse-engineer-game-design

## 목적과 최종 산출물

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

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 게임의 제작 UI, 자원 변화와 예외를 관찰 기반으로 역기획해. 사실과 추론을 나누고 각 가설에 반례, 대안과 다음 검증 방법을 붙여.
```

## Codex CLI 요청 예시

```text
$game-design-career:reverse-engineer-game-design surface=ui,rules,data,operations, source=observations/crafting-build-1.4
```

## 내부 진행 흐름

scope를 고정하고 independently falsifiable claim record를 만듭니다. player action을 UI state, rule/exception, visible data change, downstream operation과 unresolved uncertainty로 trace합니다. observation이 없으면 `inference: null`, `confidence: unassessed`로 두고 가능한 관찰만 제안합니다.

## 생성 파일과 결과 구조

`reverse-design-document` 또는 `game-analysis-report`의 scope, claim records, relationship trace, competing explanations, contradiction log, validation queue와 unknowns를 반환합니다. 예상 결과 요약: reviewer가 관찰과 설계 가설을 각각 반박하거나 확인할 수 있습니다.

## 관련 템플릿·품질 프로필·전문 역할
- Template ID: `reverse-design-document` — [reverse-design-document 템플릿](../templates.md#reverse-design-document).
- Quality Profile ID: `reverse-design-document`.
- Reviewer/role ID: `reverse-design-critic · evidence-auditor`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건
관찰 screenshot은 `reverse-design-evidence-image` slot의 권리·출처가 있을 때만 illustration lifecycle에 둡니다. observation/inference loop는 `skillstead-reverse-system-loop-diagram`이 반례 관계를 명확히 할 때만 Skillstead로 도식화합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

사실은 recorded scope의 관찰·인용에만 한정합니다. confidence는 수사적 확신이 아니라 evidence support입니다. 제3자 screenshot·게임 자료는 source, use purpose, rights와 privacy를 사람이 검토합니다.

## 실패·fallback·재개 방법

접근 불가 surface와 모순 관찰은 삭제하지 않고 uncertainty와 validation task로 남깁니다. 내부 의도·data structure를 증거 없이 채우지 않습니다.

```text
$game-design-career:reverse-engineer-game-design 기존 claimId와 contradiction log를 유지하고 새 build 관찰만 추가해 validation queue부터 재개해.
```

## 다음 작업 요청문
**복사 가능한 다음 handoff**

@Game Design Career export-career-documents로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-career:export-career-documents artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서
[reverse-design-document 템플릿](../templates.md#reverse-design-document), [export-career-documents 스킬](./export-career-documents.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
