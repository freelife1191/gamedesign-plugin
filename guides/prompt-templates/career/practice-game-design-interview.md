# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:practice-game-design-interview:beginner -->
## career:practice-game-design-interview:beginner

**근거 질문 한 개 연습**

questionId 하나를 evidence link와 honest-answer pattern에 연결해 사실, 추론, 제안을 구분한다.

### 사용하는 경우
포트폴리오 evidence 하나로 질문과 답변을 처음 연습할 때 사용한다.

### 사용하지 않는 경우
없는 결과나 개인 기여를 면접 답변으로 발명할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- questionId
- portfolio evidence link
- 답변 claim

#### 선택 입력
- reflection

### 바꿀 자리표시자
- [questionId]
- [portfolio evidence link]
- [답변 claim]

### Codex App 완성 예시
```text
@Game Design Career Q-01 질문을 EVID-PT-01 evidence link에 연결하고, 검증할 수 없는 결과는 honest-answer로 남겨 줘. fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [questionId]를 [portfolio evidence link]에 연결해 [답변 claim]을 연습해. fact, inference, recommendation과 honest-answer를 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:practice-game-design-interview questionId=Q-01 portfolioEvidence=EVID-PT-01@case#decision claim=design-choice 근거 질문을 연습해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:practice-game-design-interview questionId=[questionId] portfolioEvidence=[portfolio evidence link] claim=[답변 claim] fact, inference, recommendation과 honest-answer를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: practice-game-design-interview
- 스킬 흐름: practice-game-design-interview
- 전문 역할: interview-coach

### 중간 산출물
- interview-question-answer-log

### 예상 결과물
#### 최소 결과물
- questionId와 evidence link가 있는 질문·답변
- stale posting이면 최신 evidence 갱신 후 재개
- fact/inference/recommendation 및 honest-answer pattern

#### 선택 결과물
- reflection

#### 확장 결과물
- verification task

### 파일 구조
- game-design-career/career-evidence/interview-beginner/content.md
- game-design-career/career-evidence/interview-beginner/evidence.yml
- game-design-career/career-evidence/interview-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/interview-beginner/content.md
- game-design-career/career-evidence/interview-beginner/evidence.yml
- game-design-career/career-evidence/interview-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s09
- SVG: guides/assets/game-design-career/skills/practice-game-design-interview.svg
- PNG: guides/assets/game-design-career/skills/practice-game-design-interview.png
- 대체 텍스트: 게임 기획 면접 연습 직접 호출 흐름

### 사람 검토
#### 승인 경계
interview-coach owner가 evidence link와 답변 범위를 검토하고 승인 또는 보류한다.

#### 보류 조건
- questionId가 없음
- evidence link가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
interview-beginner의 questionId와 evidence link를 보존하고 답변 claim 확인부터 재개해.
```
<!-- PROMPT-CARD: career:practice-game-design-interview:standard -->
## career:practice-game-design-interview:standard

**네 질문 유형과 답변 기록**

base, follow-up, objection, situational questionId를 evidence link와 stale posting 갱신 기록에 연결한다.

### 사용하는 경우
공고와 포트폴리오 근거로 네 유형의 면접 연습을 기록할 때 사용한다.

### 사용하지 않는 경우
stale posting을 현재 요구사항으로 단정하거나 evidence 없는 답변을 사실로 말할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- posting evidence link
- portfolio evidence links
- 네 questionId

#### 선택 입력
- stale 확인 날짜

### 바꿀 자리표시자
- [posting evidence link]
- [portfolio evidence links]
- [네 questionId]
- [stale 확인 날짜]

### Codex App 완성 예시
```text
@Game Design Career posting과 portfolio evidence link로 base, follow-up, objection, situational questionId를 기록해. stale이면 최신 evidence를 갱신한 뒤 재개하고 fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [posting evidence link]와 [portfolio evidence links]로 [네 questionId]의 네 질문 유형을 기록해. [stale 확인 날짜]에 stale이면 최신 evidence 갱신 후 재개하고 fact, inference, recommendation과 honest-answer를 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:practice-game-design-interview postingEvidence=POST-01 portfolioEvidence=EVID-01,EVID-02 questionIds=Q-01,Q-02,Q-03,Q-04 staleCheck=2026-08-09 네 유형을 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:practice-game-design-interview postingEvidence=[posting evidence link] portfolioEvidence=[portfolio evidence links] questionIds=[네 questionId] staleCheck=[stale 확인 날짜] stale이면 최신 evidence 갱신 후 fact, inference, recommendation과 honest-answer를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: practice-game-design-interview
- 스킬 흐름: practice-game-design-interview
- 전문 역할: interview-coach → evidence-auditor

### 중간 산출물
- interview-question-answer-log

### 예상 결과물
#### 최소 결과물
- 네 questionId 유형과 evidence link
- stale posting 갱신·재개 조건
- fact/inference/recommendation 및 honest-answer

#### 선택 결과물
- feedback record

#### 확장 결과물
- verification task queue

### 파일 구조
- game-design-career/career-evidence/interview-standard/content.md
- game-design-career/career-evidence/interview-standard/evidence.yml
- game-design-career/career-evidence/interview-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/interview-standard/content.md
- game-design-career/career-evidence/interview-standard/evidence.yml
- game-design-career/career-evidence/interview-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s09
- SVG: guides/assets/game-design-career/skills/practice-game-design-interview.svg
- PNG: guides/assets/game-design-career/skills/practice-game-design-interview.png
- 대체 텍스트: 게임 기획 면접 연습 직접 호출 흐름

### 사람 검토
#### 승인 경계
interview-coach owner와 evidence-auditor가 stale evidence를 검토하고 승인 또는 보류한다.

#### 보류 조건
- posting evidence가 stale이며 최신 evidence가 없음
- questionId가 evidence link에 연결되지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
interview-standard의 questionId 기록을 보존하고 최신 evidence 갱신 후 재개해.
```
<!-- PROMPT-CARD: career:practice-game-design-interview:advanced -->
## career:practice-game-design-interview:advanced

**stale 갱신·정직한 답변·coach 검토**

stale posting을 최신 evidence로 갱신한 뒤 questionId별 honest-answer와 coach 검토를 추적한다.

### 사용하는 경우
공고 변경 가능성이 있는 인터뷰 기록을 재검증하고 coach feedback을 받을 때 사용한다.

### 사용하지 않는 경우
최신 근거 없이 공고별 적합성이나 합격을 선언할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- stale posting evidence
- latest evidence link
- questionId 로그
- coach

#### 선택 입력
- counterexample

### 바꿀 자리표시자
- [stale posting evidence]
- [latest evidence link]
- [questionId 로그]
- [coach]

### Codex App 완성 예시
```text
@Game Design Career stale posting evidence를 최신 evidence link로 갱신한 뒤 questionId 로그의 honest-answer와 coach 검토를 기록해. fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [stale posting evidence]가 stale이면 [latest evidence link]로 갱신한 뒤 [questionId 로그]를 [coach]와 검토해. fact, inference, recommendation과 honest-answer를 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:practice-game-design-interview stalePosting=POST-OLD latestEvidence=POST-NEW@source questionLog=interview-log coach=interview-coach 최신 근거로 재개해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:practice-game-design-interview stalePosting=[stale posting evidence] latestEvidence=[latest evidence link] questionLog=[questionId 로그] coach=[coach] 최신 evidence 갱신 후 fact, inference, recommendation과 honest-answer를 검토해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: practice-game-design-interview
- 스킬 흐름: practice-game-design-interview → research-game-design-jobs
- 전문 역할: interview-coach → evidence-auditor

### 중간 산출물
- interview-question-answer-log

### 예상 결과물
#### 최소 결과물
- questionId별 latest evidence link와 stale 갱신 기록
- honest-answer, coach feedback, fact/inference/recommendation

#### 선택 결과물
- counterexample follow-up

#### 확장 결과물
- resume task

### 파일 구조
- game-design-career/career-evidence/interview-advanced/content.md
- game-design-career/career-evidence/interview-advanced/evidence.yml
- game-design-career/career-evidence/interview-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/interview-advanced/content.md
- game-design-career/career-evidence/interview-advanced/evidence.yml
- game-design-career/career-evidence/interview-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s09
- SVG: guides/assets/game-design-career/skills/practice-game-design-interview.svg
- PNG: guides/assets/game-design-career/skills/practice-game-design-interview.png
- 대체 텍스트: 게임 기획 면접 연습 직접 호출 흐름

### 사람 검토
#### 승인 경계
named interview-coach owner가 latest evidence와 답변 범위를 검토하고 승인 또는 보류한다. coach 검토는 자동 합격 판정이 아니다.

#### 보류 조건
- latest evidence link가 없음
- coach가 stale claim을 확인하지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
interview-advanced의 questionId와 stale 기록을 보존하고 latest evidence 확인 후 재개해.
```
