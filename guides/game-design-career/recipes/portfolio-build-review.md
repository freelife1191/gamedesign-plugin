# portfolio를 만들고 5축으로 검토하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![portfolio claim evidence와 five-axis finding이 minimum repair, 권리 검토와 다음 review loop로 이어지는 흐름.](../../assets/game-design-career/portfolio-review-loop.png)

## 완료 목표

개인 기여와 팀 결과를 분리한 case study를 만들고, 5축 finding을 최소 repair backlog로 연결합니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- target competency, 공개 가능한 claim·evidence address, 개인/팀 attribution, rights·privacy 범위
- Canonical Artifact family: `game-design-career/<career-id>/creative-design-portfolio/`, `game-design-career/<career-id>/five-axis-review/`, `game-design-career/<career-id>/portfolio-backlog/`
- 템플릿: `creative-design-portfolio`, `five-axis-review`, `portfolio-backlog`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID만 사용해 portfolio case study와 5축 review를 만들어. 관찰 사실·추론·제안과 attribution을 분리해.
```

Codex CLI 명시 호출:

```text
$game-design-career:build-game-design-portfolio game-design-career/<career-id>/creative-design-portfolio/를 작성하고 $game-design-career:review-game-design-portfolio, $game-design-career:plan-image-assets로 five-axis-review, portfolio-backlog와 asset plan을 연결해.
```

## 단계별 진행

1. claim과 evidence address를 `관찰 사실`로 두고, 외부 current evidence는 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 기록합니다.
2. reviewer finding은 `추론`, 다음 repair는 `제안`으로 구분하고 `review-game-design-portfolio`의 minimum repair를 `portfolio-backlog/`에 기록합니다. inspectability가 없는 impact는 gap으로 남깁니다.
3. stale evidence는 재검색 전에는 current claim에 사용하지 않습니다. 새 locator를 추가하고 원래 claim과 review history는 보존합니다.
4. portfolio case study의 proof image는 `prompt-only`에서 prompt와 placeholder만 만들고 생성하지 않습니다. `select`는 사람이 제출한 receipt의 stable ID만 생성하고, `required`는 finite required asset만 생성하며, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Portfolio Owner **정하늘**이 claim·attribution을, Rights Reviewer **윤태호**가 이미지 rights·privacy와 공개 상태를 승인합니다.

## 예상 결과

완성 포트폴리오 웹사이트를 생성하지 않고, claim과 검토 가능한 repair 기록만 남깁니다.

### 예상 파일 트리

```text
game-design-career/<career-id>/
├── creative-design-portfolio/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/
│   │   └── README.md
│   ├── assets/
│   │   └── README.md
│   └── export-manifest.yml
├── five-axis-review/
│   ├── content.md
│   ├── evidence.yml
│   ├── decisions/
│   │   └── README.md
│   ├── assets/
│   │   └── README.md
│   └── export-manifest.yml
└── portfolio-backlog/
    ├── content.md
    ├── evidence.yml
    ├── decisions/
    │   └── README.md
    ├── assets/
    │   └── README.md
    └── export-manifest.yml
```

### 대표 내용 예시

`creative-design-portfolio/content.md`에는 `claim-id`, `evidence-id`, `attribution`을, `five-axis-review/content.md`에는 `finding-id`, `minimum-repair`를, `portfolio-backlog/content.md`에는 `backlog-id`, `minimum-repair`, `owner`를 기록합니다.

### 완료 기준

모든 공개 `claim-id`가 `evidence-id`, `attribution`, `rights`와 `inspectabilityGate`에 연결되고, 각 finding에 하나의 `minimum-repair`(`minimum repair`), `owner`, 재검토 조건이 있으며, unsupported claim을 점수나 문구로 숨기지 않으면 완료입니다.

### 포트폴리오·면접 활용

portfolio에서는 읽는 사람이 claim과 evidence를 직접 찾게 하고, interview에서는 받은 finding, 선택한 repair, 아직 해결되지 않은 gap을 과장 없이 설명합니다.

### 읽는 순서

`game-design-career/<career-id>/creative-design-portfolio/content.md → game-design-career/<career-id>/creative-design-portfolio/evidence.yml → game-design-career/<career-id>/creative-design-portfolio/decisions/README.md → game-design-career/<career-id>/creative-design-portfolio/assets/README.md → game-design-career/<career-id>/creative-design-portfolio/export-manifest.yml`, `game-design-career/<career-id>/five-axis-review/content.md → game-design-career/<career-id>/five-axis-review/evidence.yml → game-design-career/<career-id>/five-axis-review/decisions/README.md → game-design-career/<career-id>/five-axis-review/assets/README.md → game-design-career/<career-id>/five-axis-review/export-manifest.yml`, `game-design-career/<career-id>/portfolio-backlog/content.md → game-design-career/<career-id>/portfolio-backlog/evidence.yml → game-design-career/<career-id>/portfolio-backlog/decisions/README.md → game-design-career/<career-id>/portfolio-backlog/assets/README.md → game-design-career/<career-id>/portfolio-backlog/export-manifest.yml` 순서로 읽습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다. unsupported claim은 삭제로 숨기지 않고 missing evidence와 owner action으로 재개합니다.

## 관련 기능

- [portfolio 구축](../skills/build-game-design-portfolio.md), [portfolio 검토](../skills/review-game-design-portfolio.md), [이미지 자산](../image-assets.md)
- [이미지 자산 수명주기](../../assets/shared/image-asset-lifecycle.png)

<!-- PROMPT-TEMPLATES:START game-design-career:recipe:portfolio-build-review -->
<!-- PROMPT-CARD: career:recipe:portfolio-build-review -->
#### career:recipe:portfolio-build-review

**portfolio-build-review recipe**

portfolio-build-review recipe의 ordered CLI calls와 artifact read order를 보존한다.

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
```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID만 사용해 portfolio case study와 5축 review를 만들어. 관찰 사실·추론·제안과 attribution을 분리해.
```

##### Codex App 재사용 템플릿
```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID만 사용해 portfolio case study와 5축 review를 만들어. 관찰 사실·추론·제안과 attribution을 분리해. [경력 ID]의 fact, inference, recommendation과 미정 blocker를 보존해.
```

##### Codex CLI 완성 예시
```text
$game-design-career:build-game-design-portfolio game-design-career/<career-id>/creative-design-portfolio/를 작성하고 $game-design-career:review-game-design-portfolio, $game-design-career:plan-image-assets로 five-axis-review, portfolio-backlog와 asset plan을 연결해.
```

##### Codex CLI 재사용 템플릿
```text
$game-design-career:build-game-design-portfolio game-design-career/[경력 ID]/creative-design-portfolio/를 작성하고 $game-design-career:review-game-design-portfolio, $game-design-career:plan-image-assets로 five-axis-review, portfolio-backlog와 asset plan을 연결해. fact, inference, recommendation을 보존해.
```

##### 스킬·전문 역할 흐름
- 기본 스킬: build-game-design-portfolio
- 스킬 흐름: build-game-design-portfolio → review-game-design-portfolio → plan-image-assets
- 전문 역할: career-strategist

##### 중간 산출물
- creative-design-portfolio
- five-axis-review
- portfolio-backlog

##### 예상 결과물
###### 최소 결과물
- creative-design-portfolio canonical artifact
- blocker와 resume receipt

###### 선택 결과물
- 공개 가능한 evidence summary

###### 확장 결과물
- downstream handoff

##### 파일 구조
- game-design-career/[경력 ID]/creative-design-portfolio/content.md
- game-design-career/[경력 ID]/creative-design-portfolio/evidence.yml
- game-design-career/[경력 ID]/creative-design-portfolio/decisions/README.md
- game-design-career/[경력 ID]/creative-design-portfolio/assets/README.md
- game-design-career/[경력 ID]/creative-design-portfolio/export-manifest.yml
- game-design-career/[경력 ID]/five-axis-review/content.md
- game-design-career/[경력 ID]/five-axis-review/evidence.yml
- game-design-career/[경력 ID]/five-axis-review/decisions/README.md
- game-design-career/[경력 ID]/five-axis-review/assets/README.md
- game-design-career/[경력 ID]/five-axis-review/export-manifest.yml
- game-design-career/[경력 ID]/portfolio-backlog/content.md
- game-design-career/[경력 ID]/portfolio-backlog/evidence.yml
- game-design-career/[경력 ID]/portfolio-backlog/decisions/README.md
- game-design-career/[경력 ID]/portfolio-backlog/assets/README.md
- game-design-career/[경력 ID]/portfolio-backlog/export-manifest.yml

##### 읽는 순서
- game-design-career/[경력 ID]/creative-design-portfolio/content.md
- game-design-career/[경력 ID]/creative-design-portfolio/evidence.yml
- game-design-career/[경력 ID]/creative-design-portfolio/decisions/README.md
- game-design-career/[경력 ID]/creative-design-portfolio/assets/README.md
- game-design-career/[경력 ID]/creative-design-portfolio/export-manifest.yml
- game-design-career/[경력 ID]/five-axis-review/content.md
- game-design-career/[경력 ID]/five-axis-review/evidence.yml
- game-design-career/[경력 ID]/five-axis-review/decisions/README.md
- game-design-career/[경력 ID]/five-axis-review/assets/README.md
- game-design-career/[경력 ID]/five-axis-review/export-manifest.yml
- game-design-career/[경력 ID]/portfolio-backlog/content.md
- game-design-career/[경력 ID]/portfolio-backlog/evidence.yml
- game-design-career/[경력 ID]/portfolio-backlog/decisions/README.md
- game-design-career/[경력 ID]/portfolio-backlog/assets/README.md
- game-design-career/[경력 ID]/portfolio-backlog/export-manifest.yml

##### 도식 바인딩
- ID: ca-s05
- SVG: guides/assets/game-design-career/skills/map-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/map-game-design-career.png
- 대체 텍스트: Career recipe flow

##### 사람 검토
###### 승인 경계
named human decision owner가 portfolio-build-review의 approval 또는 보류를 결정한다.

###### 보류 조건
- canonical evidence, rights, 또는 owner receipt가 없으면 보류

###### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

##### 실패와 재개
```text
portfolio-build-review의 보존 canonical artifact와 blocker를 읽고 공개 정보만으로 재개해.
```
<!-- PROMPT-TEMPLATES:END game-design-career:recipe:portfolio-build-review -->
