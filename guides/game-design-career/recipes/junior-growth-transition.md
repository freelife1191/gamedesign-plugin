# 주니어 성장과 전환 준비를 검토하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![현재 단계와 실제 project event, 전환 readiness, 사람 결정이 성장·전환 artifact와 내보내기 준비로 이어지는 경로.](../../assets/game-design-career/career-stage-routing.png)

## 완료 목표

실제 project event와 fresh role evidence를 분기 성장 목표·전환 gap·내보내기 준비로 연결하고, 다음 재평가 조건을 기록합니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- 현재 단계, project event evidence, target role·region, feedback cadence와 공개 가능한 proof artifact
- Canonical Artifact family: `game-design-career/<career-id>/junior-growth-review/`, `game-design-career/<career-id>/transition-readiness/`
- 템플릿: `junior-growth-review`, `transition-readiness`, `career-stage-goal`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID와 proof artifact만 사용해 주니어 성장과 전환 준비를 정리해. 관찰 사실·추론·제안, freshness와 재검토 조건을 분리해.
```

Codex CLI 명시 호출:

```text
$game-design-career:plan-junior-growth game-design-career/<career-id>/junior-growth-review/를 만들고 $game-design-career:map-game-design-career, $game-design-career:review-game-design-portfolio, $game-design-career:export-career-documents로 transition-readiness와 export manifest를 연결해.
```

## 단계별 진행

1. actual event와 proof artifact는 `관찰 사실`이며 current role evidence에는 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 기록합니다.
2. readiness 평가는 `추론`, 다음 project·feedback cadence는 `제안`으로 두고 target level은 확정 사실처럼 쓰지 않습니다.
3. stale evidence는 재검색 전에는 current claim에 사용하지 않습니다. `reviewAfter` 이후 fresh source를 연결하고 historical record는 보존합니다.
4. 성장 증거의 `growth-work-sample-image` slot은 `prompt-only`에서 prompt와 placeholder만 만들고 생성하지 않습니다. `select`는 사람이 제출한 receipt의 stable ID만 생성하고, `required`는 finite required asset만 생성하며, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Growth Manager **김서윤**, Portfolio Reviewer **한지훈**, Export Owner **오지은**이 goal, evidence 공개, 전환 대안과 내보내기 범위를 각각 승인합니다.

## 예상 결과

승진·이직 결과를 예측하지 않고, 현재 evidence와 다음 성장 검토의 연결만 남깁니다.

### 예상 파일 트리

```text
game-design-career/<career-id>/
├── junior-growth-review/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/
│   │   └── README.md
│   ├── assets/
│   │   └── README.md
│   └── export-manifest.yml
└── transition-readiness/
    ├── content.md
    ├── evidence.yml
    ├── decisions/
    │   └── README.md
    ├── assets/
    │   └── README.md
    └── export-manifest.yml
```

### 대표 내용 예시

`junior-growth-review/content.md`에는 `project-event-evidence`, `goal`, `next-review-date`, `proof-artifact`를, `transition-readiness/content.md`에는 `target-requirement`, `retrieval-date`, `gap`, `verification-task`를 기록합니다.

### 완료 기준

각 목표가 실제 `project-event-evidence`와 `proof-artifact`(`proof artifact`)에 연결되고 다음 `next-review-date`가 있으며, time-sensitive requirement에는 `retrieval-date`·`region`이 있고, 빈 evidence를 readiness 주장으로 바꾸지 않으면 완료입니다.

### 포트폴리오·면접 활용

portfolio에서는 수정과 feedback으로 바뀐 판단을 보여 주고, interview에서는 project-event-evidence, 남은 gap, 다음 review를 근거로 성장 방향을 설명합니다.

### 읽는 순서

`game-design-career/<career-id>/junior-growth-review/content.md → game-design-career/<career-id>/junior-growth-review/evidence.yml → game-design-career/<career-id>/junior-growth-review/decisions/README.md → game-design-career/<career-id>/junior-growth-review/assets/README.md → game-design-career/<career-id>/junior-growth-review/export-manifest.yml`, `game-design-career/<career-id>/transition-readiness/content.md → game-design-career/<career-id>/transition-readiness/evidence.yml → game-design-career/<career-id>/transition-readiness/decisions/README.md → game-design-career/<career-id>/transition-readiness/assets/README.md → game-design-career/<career-id>/transition-readiness/export-manifest.yml` 순서로 읽습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다. fresh evidence가 없으면 current claim을 만들지 않고 stale record와 next retrieval에서 재개합니다.

## 관련 기능

- [주니어 성장](../skills/plan-junior-growth.md), [역할 매핑](../skills/map-game-design-career.md), [내보내기](../skills/export-career-documents.md)
- [문서 내보내기 흐름](../../assets/shared/document-export-flow.png)

<!-- PROMPT-TEMPLATES:START game-design-career:recipe:junior-growth-transition -->
<!-- PROMPT-CARD: career:recipe:junior-growth-transition -->
#### career:recipe:junior-growth-transition

**주니어 성장 기록에서 전환 준비까지 (junior-growth-transition)**

junior-growth-transition recipe의 ordered CLI calls와 artifact read order를 보존한다.

##### 간단 요청 예시
```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID와 proof artifact만 사용해 주니어 성장과 전환 준비를 정리해. 관찰 사실·추론·제안, freshness와 재검토 조건을 분리해.
```

##### 짧은 흐름
- 작업 순서: plan-junior-growth → map-game-design-career → review-game-design-portfolio → export-career-documents
- 함께 검토하는 역할: career-strategist

##### 이 요청으로 받는 결과
12주 성장 기록에서 규칙 문서와 피드백 반영 사례를 골라 전환 준비표에 연결했습니다. 부족한 라이브 지표 경험은 다음 증명 과제로 남겼으며 준비 상태는 멘토 검토 전입니다. (ID: career:recipe:junior-growth-transition; 파일: game-design-career/[경력 ID]/junior-growth-review/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

##### 사용하는 경우
canonical artifact의 안전한 다음 작업 순서가 필요할 때 사용한다.

##### 사용하지 않는 경우
evidence, rights, 또는 approval gate를 건너뛸 때는 사용하지 않는다.

##### 준비 입력
###### 필수 입력
- 공개 가능한 canonical artifact

###### 선택 입력
- named human decision receipt

##### 바꿀 자리표시자
- [경력 ID]

##### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

##### Codex App 재사용 템플릿
```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID와 proof artifact만 사용해 주니어 성장과 전환 준비를 정리해. 관찰 사실·추론·제안, freshness와 재검토 조건을 분리해. [경력 ID]의 fact, inference, recommendation과 미정 blocker를 보존해.
```

##### Codex CLI 완성 예시
```text
$game-design-career:plan-junior-growth game-design-career/<career-id>/junior-growth-review/를 만들고 $game-design-career:map-game-design-career, $game-design-career:review-game-design-portfolio, $game-design-career:export-career-documents로 transition-readiness와 export manifest를 연결해.
```

##### Codex CLI 재사용 템플릿
```text
$game-design-career:plan-junior-growth game-design-career/[경력 ID]/junior-growth-review/를 만들고 $game-design-career:map-game-design-career, $game-design-career:review-game-design-portfolio, $game-design-career:export-career-documents로 transition-readiness와 export manifest를 연결해. fact, inference, recommendation을 보존해.
```

##### 스킬·전문 역할 흐름
- 기본 스킬: plan-junior-growth
- 스킬 흐름: plan-junior-growth → map-game-design-career → review-game-design-portfolio → export-career-documents
- 전문 역할: career-strategist

##### 중간 산출물
- junior-growth-review
- transition-readiness

##### 예상 결과물
###### 최소 결과물
- junior-growth-review canonical artifact
- blocker와 resume receipt

###### 선택 결과물
- 공개 가능한 evidence summary

###### 확장 결과물
- downstream handoff

##### 파일 구조
- game-design-career/[경력 ID]/junior-growth-review/content.md
- game-design-career/[경력 ID]/junior-growth-review/evidence.yml
- game-design-career/[경력 ID]/junior-growth-review/decisions/README.md
- game-design-career/[경력 ID]/junior-growth-review/assets/README.md
- game-design-career/[경력 ID]/junior-growth-review/export-manifest.yml
- game-design-career/[경력 ID]/transition-readiness/content.md
- game-design-career/[경력 ID]/transition-readiness/evidence.yml
- game-design-career/[경력 ID]/transition-readiness/decisions/README.md
- game-design-career/[경력 ID]/transition-readiness/assets/README.md
- game-design-career/[경력 ID]/transition-readiness/export-manifest.yml

##### 읽는 순서
- game-design-career/[경력 ID]/junior-growth-review/content.md
- game-design-career/[경력 ID]/junior-growth-review/evidence.yml
- game-design-career/[경력 ID]/junior-growth-review/decisions/README.md
- game-design-career/[경력 ID]/junior-growth-review/assets/README.md
- game-design-career/[경력 ID]/junior-growth-review/export-manifest.yml
- game-design-career/[경력 ID]/transition-readiness/content.md
- game-design-career/[경력 ID]/transition-readiness/evidence.yml
- game-design-career/[경력 ID]/transition-readiness/decisions/README.md
- game-design-career/[경력 ID]/transition-readiness/assets/README.md
- game-design-career/[경력 ID]/transition-readiness/export-manifest.yml

##### 도식 바인딩
- ID: ca-s05
- SVG: guides/assets/game-design-career/skills/map-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/map-game-design-career.png
- 대체 텍스트: Career recipe flow

##### 사람 검토
###### 승인 경계
named human decision owner가 junior-growth-transition의 approval 또는 보류를 결정한다.

###### 보류 조건
- canonical evidence, rights, 또는 owner receipt가 없으면 보류

###### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

##### 실패와 재개
```text
junior-growth-transition의 보존 canonical artifact와 blocker를 읽고 공개 정보만으로 재개해.
```

</details>
<!-- PROMPT-TEMPLATES:END game-design-career:recipe:junior-growth-transition -->
