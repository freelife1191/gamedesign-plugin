# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:build-game-design-portfolio:beginner -->
## career:build-game-design-portfolio:beginner

**문제·판단·근거로 포트폴리오 사례 시작**

한 사례의 문제, 설계 판단, evidence ID와 주소를 연결하고 claim을 사실, 추론, 제안으로 구분한다.

### 사용하는 경우
관찰 가능한 문제와 설계 판단 하나를 검토 가능한 사례로 정리할 때 사용한다.

### 사용하지 않는 경우
실제 경험, 기여, 성과 또는 채용 가능성을 채우거나 보장해야 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 사례 Artifact ID
- 문제와 대상 사용자
- evidence ID
- evidence address
- 개인 기여 상태

#### 선택 입력
- 대안
- 권리 검토 상태

### 바꿀 자리표시자
- [사례 Artifact]
- [문제]
- [evidence ID]
- [evidence address]
- [개인 기여 상태]

### Codex App 완성 예시
```text
@Game Design Career onboarding 사례의 문제, 판단, EVID-ON-01 evidence address와 실제 개인 기여 상태를 claimId로 연결해. fact, inference, recommendation을 구분하고 모르는 정보는 미정으로 남겨 줘.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [사례 Artifact]의 [문제], [evidence ID], [evidence address], [개인 기여 상태]를 claimId로 연결해. fact, inference, recommendation을 구분하고 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:build-game-design-portfolio artifact=career/onboarding problem=first-session evidenceId=EVID-ON-01 evidenceAddress=case#observation contribution=personal-verified claimId와 사실·추론·제안을 정리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:build-game-design-portfolio artifact=[사례 Artifact] problem=[문제] evidenceId=[evidence ID] evidenceAddress=[evidence address] contribution=[개인 기여 상태] claimId와 fact, inference, recommendation을 정리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: build-game-design-portfolio
- 스킬 흐름: build-game-design-portfolio
- 전문 역할: portfolio-reviewer → evidence-auditor

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- claimId, evidenceAddress, provenance이 있는 문제·판단·근거
- personal contribution state, team contribution, 미정·비공개와 fact/inference/recommendation label

#### 선택 결과물
- 대안과 권리 검토 note

#### 확장 결과물
- inspectability recovery queue

### 파일 구조
- game-design-career/career-evidence/portfolio-beginner/content.md
- game-design-career/career-evidence/portfolio-beginner/evidence.yml
- game-design-career/career-evidence/portfolio-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/portfolio-beginner/content.md
- game-design-career/career-evidence/portfolio-beginner/evidence.yml
- game-design-career/career-evidence/portfolio-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s02
- SVG: guides/assets/game-design-career/skills/build-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/build-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer owner가 claim과 evidence address를 검토하고 승인 또는 보류한다. 검토는 채용 판단이 아니다.

#### 보류 조건
- material claim에 evidence address가 없음
- 개인 기여 상태가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
portfolio-beginner의 claimId와 evidence record를 보존하고 확인된 문제부터 재개해.
```
<!-- PROMPT-CARD: career:build-game-design-portfolio:standard -->
## career:build-game-design-portfolio:standard

**claim-evidence index로 사례 검증**

claim-evidence index에 주소 가능한 source와 개인·팀 기여를 기록해 사실, 추론, 제안을 분리한다.

### 사용하는 경우
여러 material claim을 evidence record와 provenance로 검토할 때 사용한다.

### 사용하지 않는 경우
team outcome을 개인 성과로 바꾸거나 근거 없는 결과를 제시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 사례 Artifact ID
- claim 목록
- evidence ID와 source
- personal contribution
- team contribution

#### 선택 입력
- rights note
- recovery owner

### 바꿀 자리표시자
- [사례 Artifact]
- [claim 목록]
- [evidence ID와 source]
- [personal contribution]
- [team contribution]

### Codex App 완성 예시
```text
@Game Design Career combat 사례의 claim-evidence index에 EVID-CB-01 source, personal contribution과 team contribution을 기록해. 미정·비공개는 숨기지 말고 fact, inference, recommendation으로 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [사례 Artifact]의 [claim 목록]을 [evidence ID와 source]에 연결하고 [personal contribution], [team contribution]을 기록해. 미정·비공개와 fact, inference, recommendation을 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:build-game-design-portfolio artifact=career/combat claims=CLAIM-01 evidence=EVID-CB-01@case#test personalContribution=verified teamContribution=attributed result layers=fact,inference,recommendation personal attribution=verified team attribution=attributed unknown=미정 private=비공개 claim-evidence index를 만들어.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:build-game-design-portfolio artifact=[사례 Artifact] claims=[claim 목록] evidence=[evidence ID와 source] personalContribution=[personal contribution] teamContribution=[team contribution] result layers=fact,inference,recommendation personal attribution=[personal contribution] team attribution=[team contribution] unknown=미정 private=비공개 claim-evidence index를 만들어.
```

### 스킬·전문 역할 흐름
- 기본 스킬: build-game-design-portfolio
- 스킬 흐름: build-game-design-portfolio
- 전문 역할: portfolio-reviewer → evidence-auditor

### 중간 산출물
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- claimId/evidenceAddress/provenance claim-evidence index
- personal contribution, team contribution, 미정·비공개 상태
- fact/inference/recommendation label

#### 선택 결과물
- rights note

#### 확장 결과물
- recovery owner와 action

### 파일 구조
- game-design-career/career-evidence/portfolio-standard/content.md
- game-design-career/career-evidence/portfolio-standard/evidence.yml
- game-design-career/career-evidence/portfolio-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/portfolio-standard/content.md
- game-design-career/career-evidence/portfolio-standard/evidence.yml
- game-design-career/career-evidence/portfolio-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s02
- SVG: guides/assets/game-design-career/skills/build-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/build-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer owner와 evidence-auditor가 attribution을 검토하고 승인 또는 보류한다. evidence strength는 능력이나 합격을 단정하지 않는다.

#### 보류 조건
- source가 주소 가능하지 않음
- personal contribution과 team contribution이 혼합됨

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
portfolio-standard의 claim-evidence index를 보존하고 source 확인이 끝난 claim부터 재개해.
```
<!-- PROMPT-CARD: career:build-game-design-portfolio:advanced -->
## career:build-game-design-portfolio:advanced

**사례 선택·기여·공개 gate**

사례 선택과 공개 gate를 claim evidence, personal contribution, team contribution, 미정·비공개 상태로 검토한다.

### 사용하는 경우
공개 후보 사례의 inspectability와 rights boundary를 결정하기 전 사용한다.

### 사용하지 않는 경우
비공개 자료를 요청하거나 공개 승인을 자동으로 선언할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 후보 사례
- claim evidence index
- personal contribution
- team contribution
- 공개 상태

#### 선택 입력
- rights reviewer note

### 바꿀 자리표시자
- [후보 사례]
- [claim evidence index]
- [personal contribution]
- [team contribution]
- [공개 상태]

### Codex App 완성 예시
```text
@Game Design Career 두 후보 사례의 claim evidence index, personal contribution, team contribution, 미정·비공개 및 공개 gate를 비교해. fact, inference, recommendation을 구분해.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [후보 사례]의 [claim evidence index], [personal contribution], [team contribution], [공개 상태]를 검토해 공개 gate를 보류 또는 제안해. fact, inference, recommendation을 구분해.
```

### Codex CLI 완성 예시
```text
$game-design-career:build-game-design-portfolio candidates=career/a,career/b evidence=claim-index personalContribution=verified teamContribution=attributed publicState=rights-pending result layers=fact,inference,recommendation personal attribution=verified team attribution=attributed unknown=미정 private=비공개 공개 gate를 검토해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:build-game-design-portfolio candidates=[후보 사례] evidence=[claim evidence index] personalContribution=[personal contribution] teamContribution=[team contribution] publicState=[공개 상태] result layers=fact,inference,recommendation personal attribution=[personal contribution] team attribution=[team contribution] unknown=미정 private=비공개 공개 gate를 검토해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: build-game-design-portfolio
- 스킬 흐름: build-game-design-portfolio → review-game-design-portfolio
- 전문 역할: portfolio-reviewer → evidence-auditor

### 중간 산출물
- creative-design-portfolio
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- claimId/evidenceAddress와 사례 선택 이유
- personal contribution, team contribution, 미정·비공개 구분
- fact/inference/recommendation 및 공개 hold

#### 선택 결과물
- rights review note

#### 확장 결과물
- public release recovery queue

### 파일 구조
- game-design-career/career-evidence/portfolio-advanced/content.md
- game-design-career/career-evidence/portfolio-advanced/evidence.yml
- game-design-career/career-evidence/portfolio-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/portfolio-advanced/content.md
- game-design-career/career-evidence/portfolio-advanced/evidence.yml
- game-design-career/career-evidence/portfolio-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s02
- SVG: guides/assets/game-design-career/skills/build-game-design-portfolio.svg
- PNG: guides/assets/game-design-career/skills/build-game-design-portfolio.png
- 대체 텍스트: 게임 기획 포트폴리오 직접 호출 흐름

### 사람 검토
#### 승인 경계
portfolio-reviewer owner와 evidence-auditor가 공개 가능 claim을 검토하고 승인 또는 보류한다. 사람 승인 전 공개 완료를 선언하지 않는다.

#### 보류 조건
- 비공개 source의 공개 권한이 미정
- claim evidence의 provenance가 불완전

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
portfolio-advanced의 공개 gate와 claim evidence를 보존하고 rights 확인 후 재개해.
```
