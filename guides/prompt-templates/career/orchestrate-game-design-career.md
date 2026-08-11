# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:orchestrate-game-design-career:beginner -->
## career:orchestrate-game-design-career:beginner

**단계와 목표를 정하는 Career orchestration brief**

career stage와 목표를 짧은 brief로 정리하고 다음 skill handoff의 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career entrant stage의 시스템 기획 목표를 current evidence, 제약, 다음 작은 skill과 review date가 있는 brief로 정리해 줘. fact, inference, recommendation을 분리해 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-career → map-game-design-career
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/orchestrate-beginner/content.md`에 stage, goal, next skill handoff, review date, fact/inference/recommendation label을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
현재 stage와 목표가 섞여 있어 한 번에 할 다음 작은 career 작업을 고를 때 사용한다.

### 사용하지 않는 경우
근거 없는 경험·기여를 채우거나 채용 확률·합격을 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- current stage
- goal
- current evidence
- constraints
- available time

#### 선택 입력
- preferred next skill
- review date

### 바꿀 자리표시자
- [current stage]
- [goal]
- [current evidence]
- [constraints]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [current stage]의 [goal]을 [current evidence], [constraints], 다음 작은 skill과 review date가 있는 brief로 정리해 줘. fact, inference, recommendation을 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:orchestrate-game-design-career stage=entrant goal=systems-design evidence=career/current constraints=evenings 다음 작은 skill brief를 정리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:orchestrate-game-design-career stage=[current stage] goal=[goal] evidence=[current evidence] constraints=[constraints] 다음 skill brief를 정리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-career
- 스킬 흐름: orchestrate-game-design-career → map-game-design-career
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- career-stage-goal

### 예상 결과물
#### 최소 결과물
- stage
- goal
- next skill handoff
- review date
- fact/inference/recommendation label

#### 선택 결과물
- uncertainty list

#### 확장 결과물
- evidence gap

### 파일 구조
- game-design-career/career-foundations/orchestrate-beginner/content.md
- game-design-career/career-foundations/orchestrate-beginner/evidence.yml
- game-design-career/career-foundations/orchestrate-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/orchestrate-beginner/content.md
- game-design-career/career-foundations/orchestrate-beginner/evidence.yml
- game-design-career/career-foundations/orchestrate-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이션 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner가 stage와 next skill을 검토하고 game-design-mentor와 승인 또는 보류한다. brief는 채용 결과를 보장하지 않는다.

#### 보류 조건
- stage 또는 goal이 미정
- current evidence 없이 next skill을 단정함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-beginner brief와 uncertainty를 보존하고 확인된 stage만 반영해 next skill 선택부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:orchestrate-game-design-career:standard -->
## career:orchestrate-game-design-career:standard

**research에서 portfolio로 잇는 Career orchestration**

research → role map → portfolio handoff의 evidence boundary와 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career fresh job research에서 role map과 portfolio proof Artifact로 이어지는 handoff를 owner, hold condition, review date와 함께 정리해 줘. fact, inference, recommendation을 분리해 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-career → research-game-design-jobs → map-game-design-career → build-game-design-portfolio
- 함께 검토하는 역할: career-strategist → evidence-auditor → portfolio-reviewer

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/orchestrate-standard/content.md`에 research→portfolio handoff, owner, hold condition, review date, fact/inference/recommendation label을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
fresh job research를 portfolio evidence task에 연결하되 source와 recommendation을 분리할 때 사용한다.

### 사용하지 않는 경우
stale 공고를 current fact로 쓰거나 포트폴리오가 채용 적합성·합격을 보장한다고 말할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- career goal
- research evidence state
- portfolio evidence
- handoff owner
- review date

#### 선택 입력
- source IDs
- portfolio template ID

### 바꿀 자리표시자
- [career goal]
- [research evidence state]
- [portfolio evidence]
- [handoff owner]
- [review date]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [career goal]의 [research evidence state]를 [portfolio evidence]로 연결하고 [handoff owner]와 [review date]가 있는 research→portfolio handoff를 정리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:orchestrate-game-design-career goal=systems-portfolio researchState=fresh evidence=career/job-postings owner=career-strategist reviewDate=2026-09-01 research→portfolio handoff를 정리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:orchestrate-game-design-career goal=[career goal] researchState=[research evidence state] portfolioEvidence=[portfolio evidence] owner=[handoff owner] reviewDate=[review date] handoff를 정리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-career
- 스킬 흐름: orchestrate-game-design-career → research-game-design-jobs → map-game-design-career → build-game-design-portfolio
- 전문 역할: career-strategist → evidence-auditor → portfolio-reviewer

### 중간 산출물
- career-stage-goal
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- research→portfolio handoff
- owner
- hold condition
- review date
- fact/inference/recommendation label

#### 선택 결과물
- source freshness note

#### 확장 결과물
- portfolio backlog

### 파일 구조
- game-design-career/career-foundations/orchestrate-standard/content.md
- game-design-career/career-foundations/orchestrate-standard/evidence.yml
- game-design-career/career-foundations/orchestrate-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/orchestrate-standard/content.md
- game-design-career/career-foundations/orchestrate-standard/evidence.yml
- game-design-career/career-foundations/orchestrate-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이션 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner가 research→portfolio handoff를 검토하고 evidence-auditor·portfolio-reviewer와 승인 또는 보류한다. handoff는 채용 적합성이나 합격을 보장하지 않는다.

#### 보류 조건
- research evidence가 stale
- handoff owner 또는 review date가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-standard의 research state와 portfolio handoff를 보존하고 fresh evidence를 확인해 hold condition부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:orchestrate-game-design-career:advanced -->
## career:orchestrate-game-design-career:advanced

**역할 검토·handoff·재개를 관리하는 Career orchestration**

복수 role review, owner handoff, hold, resume 조건을 기록하고 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career 복수 role path의 active handoff를 owner, hold condition, resume evidence, 재평가 날짜와 함께 검토해 줘. research·portfolio·reverse 작업은 각각의 실제 skill로 넘기고 fact, inference, recommendation을 분리해 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-career → research-game-design-jobs → map-game-design-career → reverse-engineer-game-design → build-game-design-portfolio
- 함께 검토하는 역할: career-strategist → game-design-mentor → evidence-auditor

### 이 요청으로 받는 결과
예: `game-design-career/career-foundations/orchestrate-advanced/content.md`에 role review, actual skill handoffs, owner/hold/resume matrix, re-evaluation condition, fact/inference/recommendation label을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 role path와 research·portfolio·reverse handoff가 동시에 보류되어 owner별 재개 순서를 정할 때 사용한다.

### 사용하지 않는 경우
사람 승인 없이 route를 확정하거나 experience·contribution·hiring probability·fit·offer를 발명하거나 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- role review scope
- active handoffs
- owners
- hold conditions
- resume evidence
- re-evaluation date

#### 선택 입력
- fresh source IDs
- rights review state

### 바꿀 자리표시자
- [role review scope]
- [active handoffs]
- [owners]
- [hold conditions]
- [resume evidence]
- [re-evaluation date]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [role review scope]의 [active handoffs]를 [owners], [hold conditions], [resume evidence], [re-evaluation date]와 함께 검토하고 실제 skill handoff와 재개 순서를 정리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:orchestrate-game-design-career roleScope=systems,uiux handoffs=research,portfolio,reverse owners=career-strategist,evidence-auditor holds=stale-source resumeEvidence=fresh-source reEvaluate=2026-10-01 handoff와 재개를 관리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:orchestrate-game-design-career roleScope=[role review scope] handoffs=[active handoffs] owners=[owners] holds=[hold conditions] resumeEvidence=[resume evidence] reviewAfter=[re-evaluation date] handoff와 재개를 관리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-career
- 스킬 흐름: orchestrate-game-design-career → research-game-design-jobs → map-game-design-career → reverse-engineer-game-design → build-game-design-portfolio
- 전문 역할: career-strategist → game-design-mentor → evidence-auditor

### 중간 산출물
- career-stage-goal
- transition-readiness

### 예상 결과물
#### 최소 결과물
- role review
- actual skill handoffs
- owner/hold/resume matrix
- re-evaluation condition
- fact/inference/recommendation label

#### 선택 결과물
- rights review dependency

#### 확장 결과물
- route decision receipt
- recovery queue

### 파일 구조
- game-design-career/career-foundations/orchestrate-advanced/content.md
- game-design-career/career-foundations/orchestrate-advanced/evidence.yml
- game-design-career/career-foundations/orchestrate-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/orchestrate-advanced/content.md
- game-design-career/career-foundations/orchestrate-advanced/evidence.yml
- game-design-career/career-foundations/orchestrate-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s06
- SVG: guides/assets/game-design-career/skills/orchestrate-game-design-career.svg
- PNG: guides/assets/game-design-career/skills/orchestrate-game-design-career.png
- 대체 텍스트: 게임 기획 커리어 오케스트레이션 직접 호출 흐름

### 사람 검토
#### 승인 경계
career-strategist owner가 role review를 검토하고 game-design-mentor·evidence-auditor와 handoff를 승인 또는 보류한다. 승인 전에는 route와 합격 가능성을 확정하지 않는다.

#### 보류 조건
- named owner가 없음
- stale source·rights blocker·resume evidence가 unresolved

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-advanced의 owner/hold/resume matrix를 보존하고 named owner가 확인한 evidence만 반영해 blocked handoff부터 재개해.
```

</details>
