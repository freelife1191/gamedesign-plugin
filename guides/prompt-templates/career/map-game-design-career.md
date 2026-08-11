# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:map-game-design-career:beginner -->
## career:map-game-design-career:beginner

**두 게임 기획 역할을 비교하는 Career map**

두 역할 family의 현재 증거와 제약을 비교해 fact, inference, recommendation이 분리된 provisional role map을 만든다.

### 간단 요청 예시
```text
@Game Design Career 시스템 기획과 콘텐츠 기획 두 역할을 현재 evidence, 제약, tradeoff와 다음 작은 evidence 과제로 비교해 줘. fact, inference, recommendation을 구분하고 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: map-game-design-career
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/map-beginner/content.md`에 두 provisional role path, 각 path의 tradeoff, fact/inference/recommendation label, 다음 smallest exercise을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
관심 역할이 둘이라 한 경로를 강요하지 않고 차이를 비교할 때 사용한다.

### 사용하지 않는 경우
현재 고용주나 공고 사실을 source 없이 일반화하거나 합격을 약속할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- role A
- role B
- 현재 evidence
- 제약
- 가능한 시간

#### 선택 입력
- target level
- feedback source

### 바꿀 자리표시자
- [role A]
- [role B]
- [현재 evidence]
- [제약]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [role A]와 [role B]를 [현재 evidence], [제약], tradeoff와 다음 작은 evidence 과제로 비교해 줘. fact, inference, recommendation을 구분하고 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:map-game-design-career roles=systems,content evidence=career/current constraints=evenings 두 role path의 tradeoff와 smallest exercise를 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:map-game-design-career roles=[role A],[role B] evidence=[현재 evidence] constraints=[제약] 두 role path와 tradeoff를 비교해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: map-game-design-career
- 스킬 흐름: map-game-design-career
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- game-design-role-map

### 예상 결과물
#### 최소 결과물
- 두 provisional role path
- 각 path의 tradeoff
- fact/inference/recommendation label
- 다음 smallest exercise

#### 선택 결과물
- target level 가설

#### 확장 결과물
- competency gap

### 파일 구조
- game-design-career/career-foundations/map-beginner/content.md
- game-design-career/career-foundations/map-beginner/evidence.yml
- game-design-career/career-foundations/map-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/map-beginner/content.md
- game-design-career/career-foundations/map-beginner/evidence.yml
- game-design-career/career-foundations/map-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s05
- SVG: guides/assets/game-design-career/skills/map-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/map-game-design-career.png
- 대체 텍스트: 게임 기획 경로 매핑 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner와 game-design-mentor가 두 path를 검토하고 승인 또는 보류한다. 어느 path도 단일 정답이나 합격을 뜻하지 않는다.

#### 보류 조건
- 두 role 중 하나의 current evidence가 미정
- tradeoff 없이 단일 경로를 선언함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
map-beginner의 두 provisional path와 tradeoff를 보존하고 새 evidence만 연결해 비교부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:map-game-design-career:standard -->
## career:map-game-design-career:standard

**역량 gap과 12주 evidence 과제를 잇는 Career map**

선택한 역할의 competency gap을 12주 evidence task와 feedback cadence로 바꾸며 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career 시스템 기획 목표의 competency gap을 12주 learning task, proof Artifact, feedback cadence와 재평가 질문으로 바꿔 줘. fact, inference, recommendation을 분리해 줘.
```

### 짧은 흐름
- 작업 순서: map-game-design-career
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/map-standard/content.md`에 competency gap, 12주 learning tasks, proof Artifacts, fact/inference/recommendation label을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
목표 역할과 현재 evidence 사이의 gap을 제한된 기간의 observable task로 나눌 때 사용한다.

### 사용하지 않는 경우
검증되지 않은 경력이나 기여를 proof로 쓰거나 채용 가능성을 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- target role
- competency evidence
- gap
- 12주 시간 예산
- feedback cadence

#### 선택 입력
- fresh posting evidence ID
- review date

### 바꿀 자리표시자
- [target role]
- [competency evidence]
- [gap]
- [12주 시간 예산]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [target role]의 [competency evidence]와 [gap]을 [12주 시간 예산] 안의 12주 task, proof Artifact, feedback cadence로 바꿔 줘. fact, inference, recommendation을 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:map-game-design-career role=systems evidence=career/competency-gap timeBudget=12-weeks gap=rule-specification 12주 proof task와 feedback cadence를 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:map-game-design-career role=[target role] evidence=[competency evidence] gap=[gap] timeBudget=[12주 시간 예산] 12주 proof task를 작성해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: map-game-design-career
- 스킬 흐름: map-game-design-career
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- competency-matrix
- learning-roadmap

### 예상 결과물
#### 최소 결과물
- competency gap
- 12주 learning tasks
- proof Artifacts
- fact/inference/recommendation label

#### 선택 결과물
- fresh evidence link

#### 확장 결과물
- feedback cadence
- re-evaluation question

### 파일 구조
- game-design-career/career-foundations/map-standard/content.md
- game-design-career/career-foundations/map-standard/evidence.yml
- game-design-career/career-foundations/map-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/map-standard/content.md
- game-design-career/career-foundations/map-standard/evidence.yml
- game-design-career/career-foundations/map-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s05
- SVG: guides/assets/game-design-career/skills/map-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/map-game-design-career.png
- 대체 텍스트: 게임 기획 경로 매핑 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner가 gap-to-task 연결을 검토하고 game-design-mentor와 승인 또는 보류한다. 12주 계획은 경력·채용 결과를 보장하지 않는다.

#### 보류 조건
- gap이 관찰 가능한 evidence와 연결되지 않음
- 시간 예산이 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
map-standard의 gap과 12주 task를 보존하고 새 feedback만 연결해 가장 작은 proof task부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:map-game-design-career:advanced -->
## career:map-game-design-career:advanced

**복수 경로·교환조건·재평가를 다루는 Career map**

복수 career path를 single-path 강요 없이 비교하고 tradeoff, 교환 조건, 재평가 조건을 fact, inference, recommendation으로 구분한다.

### 간단 요청 예시
```text
@Game Design Career 시스템 기획과 UI UX 기획의 복수 path를 evidence, tradeoff, 교환 조건, 반증 가능한 재평가 날짜와 다음 task로 비교해 줘. 단일 경로를 강요하지 마.
```

### 짧은 흐름
- 작업 순서: map-game-design-career
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/map-advanced/content.md`에 multiple provisional paths, tradeoff, 교환 조건, re-evaluation conditions, fact/inference/recommendation label을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
역할 family·지역·시간 제약이 달라 여러 현실적인 path를 유지해야 할 때 사용한다.

### 사용하지 않는 경우
한 path를 유일한 정답으로 선언하거나 적합성·합격을 예측할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 복수 target path
- 각 path evidence
- tradeoff
- 교환 조건
- 재평가 날짜

#### 선택 입력
- fresh job evidence ID
- mentor feedback

### 바꿀 자리표시자
- [path A]
- [path B]
- [tradeoff]
- [교환 조건]
- [재평가 날짜]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [path A]와 [path B]의 [tradeoff], [교환 조건], [재평가 날짜]를 비교하고 복수 path와 다음 task를 유지해 줘. fact, inference, recommendation을 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:map-game-design-career paths=systems,uiux tradeoff=artifact-depth-vs-breadth reevaluate=2026-11-01 복수 path와 교환 조건을 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:map-game-design-career paths=[path A],[path B] tradeoff=[tradeoff] exchange=[교환 조건] reviewAfter=[재평가 날짜] 복수 path를 비교해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: map-game-design-career
- 스킬 흐름: map-game-design-career
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- game-design-role-map
- competency-matrix

### 예상 결과물
#### 최소 결과물
- multiple provisional paths
- tradeoff
- 교환 조건
- re-evaluation conditions
- fact/inference/recommendation label

#### 선택 결과물
- falsification task

#### 확장 결과물
- path switch rationale
- review receipt

### 파일 구조
- game-design-career/career-foundations/map-advanced/content.md
- game-design-career/career-foundations/map-advanced/evidence.yml
- game-design-career/career-foundations/map-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/map-advanced/content.md
- game-design-career/career-foundations/map-advanced/evidence.yml
- game-design-career/career-foundations/map-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s05
- SVG: guides/assets/game-design-career/skills/map-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/map-game-design-career.png
- 대체 텍스트: 게임 기획 경로 매핑 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner와 game-design-mentor가 복수 path의 tradeoff를 검토하고 승인 또는 보류한다. 어떤 path도 적합성이나 합격을 보장하지 않는다.

#### 보류 조건
- 교환 조건이 없음
- 재평가 날짜 없이 하나의 path를 강요함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
map-advanced의 복수 path, tradeoff와 재평가 조건을 보존하고 새 evidence를 반영해 비교부터 재개해.
```

</details>
