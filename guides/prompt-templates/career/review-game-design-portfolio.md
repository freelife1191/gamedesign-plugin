# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:review-game-design-portfolio:beginner -->
## career:review-game-design-portfolio:beginner

**5축 빠른 검토**

다섯 축을 finding, severity, repair queue로 기록하고 사실, 추론, 제안을 분리한다.

### 사용하는 경우
사례 하나의 evidence 접근성과 최소 수정을 빠르게 검토할 때 사용한다.

### 사용하지 않는 경우
관찰하지 못한 evidence로 능력이나 합격을 판단할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- portfolio section IDs
- evidence IDs
- review owner

#### 선택 입력
- finding note

### 바꿀 자리표시자
- [portfolio section IDs]
- [evidence IDs]
- [review owner]

### Codex App 완성 예시
```text
@Game Design Career section IDs와 evidence IDs로 5축 빠른 검토를 하고 finding, severity, queue를 작성해. fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [portfolio section IDs]와 [evidence IDs]를 [review owner]가 5축 검토해 finding, severity, queue를 작성해. fact, inference, recommendation을 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-game-design-portfolio sections=case#problem,case#evidence evidenceIds=EVID-01 owner=portfolio-reviewer finding severity queue를 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-game-design-portfolio sections=[portfolio section IDs] evidenceIds=[evidence IDs] owner=[review owner] finding, severity, queue와 fact, inference, recommendation을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design-portfolio
- 스킬 흐름: review-game-design-portfolio
- 전문 역할: portfolio-reviewer

### 중간 산출물
- five-axis-review

### 예상 결과물
#### 최소 결과물
- 5축 observation state와 finding/severity/queue
- evidence-addressable fact/inference/recommendation

#### 선택 결과물
- minimum repair

#### 확장 결과물
- re-evaluation task

### 파일 구조
- game-design-career/career-evidence/review-beginner/content.md
- game-design-career/career-evidence/review-beginner/evidence.yml
- game-design-career/career-evidence/review-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/review-beginner/content.md
- game-design-career/career-evidence/review-beginner/evidence.yml
- game-design-career/career-evidence/review-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s12
- SVG: guides/assets/game-design-career/skills/review-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/review-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer owner가 finding을 검토하고 승인 또는 보류한다. review score는 능력이나 합격 판정이 아니다.

#### 보류 조건
- evidence IDs가 접근 불가
- finding에 severity가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-beginner의 finding과 queue를 보존하고 evidence 접근 확인부터 재개해.
```
<!-- PROMPT-CARD: career:review-game-design-portfolio:standard -->
## career:review-game-design-portfolio:standard

**finding·severity·queue 검토**

typed finding, severity, dependency queue와 evidence 주소를 이용해 수정을 재현 가능하게 만든다.

### 사용하는 경우
여러 finding의 영향과 minimum repair 순서를 정할 때 사용한다.

### 사용하지 않는 경우
시각적 완성도로 개인 소유권·성과를 추론할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- five-axis records
- finding evidence IDs
- queue owner

#### 선택 입력
- presentation note

### 바꿀 자리표시자
- [five-axis records]
- [finding evidence IDs]
- [queue owner]

### Codex App 완성 예시
```text
@Game Design Career five-axis records와 finding evidence IDs를 검토해 typed finding, severity, dependency queue를 작성해. fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [five-axis records]와 [finding evidence IDs]를 [queue owner]가 검토해 finding, severity, queue를 작성해. fact, inference, recommendation을 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-game-design-portfolio review=five-axis-review evidenceIds=EVID-01,EVID-02 owner=portfolio-reviewer finding severity queue를 정렬해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-game-design-portfolio review=[five-axis records] evidenceIds=[finding evidence IDs] owner=[queue owner] finding, severity, queue와 fact, inference, recommendation을 정렬해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design-portfolio
- 스킬 흐름: review-game-design-portfolio
- 전문 역할: portfolio-reviewer → evidence-auditor

### 중간 산출물
- five-axis-review
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- typed finding, severity, dependency queue
- evidence-addressable fact/inference/recommendation

#### 선택 결과물
- minimum repair owner

#### 확장 결과물
- portfolio-backlog

### 파일 구조
- game-design-career/career-evidence/review-standard/content.md
- game-design-career/career-evidence/review-standard/evidence.yml
- game-design-career/career-evidence/review-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/review-standard/content.md
- game-design-career/career-evidence/review-standard/evidence.yml
- game-design-career/career-evidence/review-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s12
- SVG: guides/assets/game-design-career/skills/review-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/review-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer owner와 evidence-auditor가 queue 순서를 검토하고 승인 또는 보류한다.

#### 보류 조건
- finding evidence IDs가 없음
- severity와 minimum repair가 불일치

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-standard의 finding, severity, queue를 보존하고 최상위 repair부터 재개해.
```
<!-- PROMPT-CARD: career:review-game-design-portfolio:advanced -->
## career:review-game-design-portfolio:advanced

**mutation·발표 readiness·승인 검토**

finding mutation, severity queue, presentation readiness와 named human approval을 분리하며 자동 합격 판정을 금지한다.

### 사용하는 경우
발표 전 evidence 변화와 reviewer handoff를 재검토할 때 사용한다.

### 사용하지 않는 경우
presentation readiness를 자동 합격 판정이나 공개 승인으로 바꿀 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- finding mutation
- evidence IDs
- named-human reviewer ID
- approval state
- presentation readiness

#### 선택 입력
- approval note

### 바꿀 자리표시자
- [finding mutation]
- [evidence IDs]
- [named-human reviewer ID]
- [approval state]
- [presentation readiness]

### Codex App 완성 예시
```text
@Game Design Career finding mutation과 evidence IDs의 severity queue를 검토해 presentation readiness와 human approval을 분리해. named-human reviewer ID와 approval state를 기록하고 자동 합격/채용 판정 금지; portfolio-reviewer agent는 finding만 내며 승인자 아님; fact, inference, recommendation을 기록해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [finding mutation]과 [evidence IDs]를 검토해 [presentation readiness]와 human approval을 분리해. [named-human reviewer ID], [approval state], finding, severity, queue를 기록하고 자동 합격/채용 판정 금지; portfolio-reviewer agent는 finding만 내며 승인자 아님; fact, inference, recommendation을 지켜.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-game-design-portfolio mutation=F-03 evidenceIds=EVID-03 readiness=pending presentation readiness와 human approval을 분리해 named-human reviewer ID=HUMAN-01 approval state=pending을 기록해. 자동 합격/채용 판정 금지; portfolio-reviewer agent는 finding만 내며 승인자 아님; finding severity queue와 fact, inference, recommendation을 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-game-design-portfolio mutation=[finding mutation] evidenceIds=[evidence IDs] readiness=[presentation readiness] presentation readiness와 human approval을 분리해 reviewerId=[named-human reviewer ID] approvalState=[approval state]를 기록해. 자동 합격/채용 판정 금지; portfolio-reviewer agent는 finding만 내며 승인자 아님; finding, severity, queue와 fact, inference, recommendation을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design-portfolio
- 스킬 흐름: review-game-design-portfolio
- 전문 역할: portfolio-reviewer → evidence-auditor

### 중간 산출물
- five-axis-review
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- finding mutation, severity, queue
- presentation readiness와 named human approval 상태
- 자동 합격 판정 금지, fact/inference/recommendation

#### 선택 결과물
- approval note

#### 확장 결과물
- re-review gate

### 파일 구조
- game-design-career/career-evidence/review-advanced/content.md
- game-design-career/career-evidence/review-advanced/evidence.yml
- game-design-career/career-evidence/review-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/review-advanced/content.md
- game-design-career/career-evidence/review-advanced/evidence.yml
- game-design-career/career-evidence/review-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s12
- SVG: guides/assets/game-design-career/skills/review-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/review-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer agent는 finding만 내며 승인자 아님이다. named-human reviewer ID의 human decision owner가 presentation readiness와 human approval을 분리해 approval state를 검토하고 승인 또는 보류한다. 자동 합격/채용 판정 금지이며 검토는 채용 결정을 대체하지 않는다.

#### 보류 조건
- presentation readiness evidence가 없음
- named-human reviewer ID 또는 approval state가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-advanced의 mutation과 severity queue를 보존하고 named human 검토 후 재개해.
```
