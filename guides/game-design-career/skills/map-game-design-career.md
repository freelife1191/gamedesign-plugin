# map-game-design-career

## 목적과 산출물

현재 증거와 제약을 여러 역할군·목표 수준에 비교해 provisional role paths, 역량 gap과 가장 작은 증거 과제를 만듭니다.

## 사용할 때

- 시스템·콘텐츠·경제·UX 등 목표 역할을 비교할 때
- 입문, new-hire, junior 또는 transition 단계의 `targetLevel`과 evidence gap을 정할 때

## 사용하지 않을 때

- 현재 공고 수요를 조사 없이 단정할 때
- 학력·나이·전공·고용 공백·prestige로 적합성을 순위화할 때

## 필수 입력과 선택 입력

- 필수: 관심 역할, 제약, 현재 artifact/evidence, 가능한 시간, uncertainty
- 선택: target role/level, current posting IDs, reviewer와 feedback source
- 현재 claim은 검색일, 지역, 표본과 source location을 기록하고 사실·추론·제안을 구분합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 시스템·콘텐츠 기획 경로를 비교해. 내 역기획서와 팀 프로젝트 기록만 현재 증거로 쓰고 target level, gap, 4주 증거 과제와 주별 feedback cadence를 제안해.
```

## Codex CLI 예시

```text
$game-design-career:map-game-design-career roles=systems,content, targetLevel=entrant-portfolio, evidence=artifacts/current-work
```

## 진행 흐름

목표가 고정되지 않았으면 최소 두 role family를 만듭니다. 각 path에 `roleFamily`, `currentEvidence`, `targetLevel`, `gaps`, `learningTasks`, `proofArtifacts`, tradeoffs와 uncertainties를 기록합니다. 현재 employer·posting·tool claim은 `research-game-design-jobs`로 보내고, 각 gap을 observable exercise와 task별 `feedbackCadence`로 전환합니다.

## 결과와 파일

`game-design-role-map` 또는 `competency-matrix`에 role paths, gap-to-evidence chain, verification tasks와 next smallest exercise를 남깁니다. 예상 결과 요약: 한 진로를 선언하는 대신 강화하거나 반증할 수 있는 역할 가설이 생깁니다.

## 검토와 승인

source의 검색일·지역·표본이 convenience sample이면 그 한계를 표시합니다. candidate statement는 사실과 다르며 agent의 추론과 학습 제안도 별도 label을 가집니다. 어떤 path도 합격을 보장하지 않습니다.

## 실패와 재개

target role이나 current evidence가 부족하면 `unclear`와 multiple provisional paths를 유지하고 owner·source/exercise·decision date가 있는 verification task를 남깁니다.

```text
$game-design-career:map-game-design-career 기존 두 role path를 유지하고 새 공고 evidence ID만 연결해 tradeoff 비교부터 재개해.
```
