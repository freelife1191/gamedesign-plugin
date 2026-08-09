# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:research-game-design-jobs:beginner -->
## career:research-game-design-jobs:beginner

**공식 공고 한 개를 근거로 읽는 채용 조사**

공식 공고 한 개의 requirement를 dated fact로 기록하고 inference와 recommendation을 분리한다.

### 사용하는 경우
한 role·level·region의 공식 current posting을 source와 날짜로 읽을 때 사용한다.

### 사용하지 않는 경우
공고 한 개로 시장·채용량·적합성·합격을 일반화할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- target role
- region
- official source URL
- retrieval date
- as-of date
- sample scope

#### 선택 입력
- candidate artifact IDs

### 바꿀 자리표시자
- [target role]
- [region]
- [공식 공고 URL]
- [retrieval date]
- [as-of date]
- [sample scope]
- [blind spots]

### Codex App 완성 예시
```text
@Game Design Career KR entry 시스템 기획의 사용자가 제공한 단일 공식 공고 URL 또는 미정 상태를 retrieval date, as-of date, region, sample scope, blind spots와 함께 기록하고 requirement fact, inference, recommendation을 나눠 줘.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [target role]의 [region] 공식 공고 [공식 공고 URL]를 [retrieval date], [as-of date], [sample scope], [blind spots]와 함께 기록하고 fact, inference, recommendation을 나눠 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:research-game-design-jobs role=systems level=entry officialPostingUrl="사용자가 제공한 공식 공고 URL 또는 미정" retrievalDate=2026-08-09 asOfDate=2026-08-09 region=KR sampleScope=한-공식-공고 blindSpots=미정-기록 source URL, retrieval date, as-of date, region, sample scope, blind spots의 requirement fact, inference, recommendation을 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:research-game-design-jobs role=[target role] officialPostingUrl=[공식 공고 URL] retrievalDate=[retrieval date] asOfDate=[as-of date] region=[region] sampleScope=[sample scope] blindSpots=[blind spots] fact, inference, recommendation을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: research-game-design-jobs
- 스킬 흐름: research-game-design-jobs
- 전문 역할: evidence-auditor

### 중간 산출물
- job-posting-evidence

### 예상 결과물
#### 최소 결과물
- source URL
- retrieval/as-of dates
- region와 sample scope
- posting fact
- inference/recommendation label

#### 선택 결과물
- candidate evidence gap

#### 확장 결과물
- reviewAfter

### 파일 구조
- game-design-career/career-foundations/research-beginner/content.md
- game-design-career/career-foundations/research-beginner/evidence.yml
- game-design-career/career-foundations/research-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/research-beginner/content.md
- game-design-career/career-foundations/research-beginner/evidence.yml
- game-design-career/career-foundations/research-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s10
- SVG: guides/assets/game-design-career/skills/research-game-design-jobs.svg
- PNG: guides/assets/game-design-career/skills/research-game-design-jobs.png
- 대체 텍스트: 게임 기획 채용 근거 조사 직접 호출 흐름

### 사람 검토
#### 승인 경계
evidence-auditor owner가 source와 날짜를 검토하고 current claim을 승인 또는 보류한다. 공고 한 개는 채용 가능성을 보장하지 않는다.

#### 보류 조건
- official source URL 또는 retrieval date가 없음
- region 또는 sample scope가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
research-beginner source record를 보존하고 fresh source URL과 retrieval date를 확인해 fact 분리부터 재개해.
```
<!-- PROMPT-CARD: career:research-game-design-jobs:standard -->
## career:research-game-design-jobs:standard

**날짜·지역·표본을 경계로 하는 채용 조사**

여러 공식 공고의 날짜, 지역, 표본 경계를 기록하고 fact, inference, recommendation을 분리한다.

### 사용하는 경우
동일 role·level의 공식 posting sample에서 반복 signal과 candidate gap을 비교할 때 사용한다.

### 사용하지 않는 경우
표본 밖 prevalence, 보상, 채용량, 적합성이나 합격을 결론낼 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- target role/level
- region
- official source URLs
- retrieval date
- as-of date
- sample boundary

#### 선택 입력
- candidate artifacts
- reviewAfter

### 바꿀 자리표시자
- [target role]
- [region]
- [공식 공고 URL 목록]
- [retrieval date]
- [as-of date]
- [sample scope]
- [blind spots]

### Codex App 완성 예시
```text
@Game Design Career KR entry 시스템 기획의 사용자가 제공한 복수 공식 공고 URL 목록 또는 미정 상태를 retrieval date, as-of date, region, sample scope, blind spots와 함께 비교해 repeated signal과 evidence gap의 fact, inference, recommendation을 분리해 줘.
```

### Codex App 재사용 템플릿
```text
@Game Design Career [target role]의 [region] 복수 공식 공고 URL 목록 [공식 공고 URL 목록]를 [retrieval date], [as-of date], [sample scope], [blind spots]와 함께 비교하고 fact, inference, recommendation을 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:research-game-design-jobs role=systems level=entry officialPostingUrls="사용자가 제공한 복수 공식 공고 URL 목록 또는 미정" retrievalDate=2026-08-09 asOfDate=2026-08-09 region=KR sampleScope=공식-공고-표본 blindSpots=미정-기록 source URL, retrieval date, as-of date, region, sample scope, blind spots의 fact, inference, recommendation을 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:research-game-design-jobs role=[target role] officialPostingUrls=[공식 공고 URL 목록] retrievalDate=[retrieval date] asOfDate=[as-of date] region=[region] sampleScope=[sample scope] blindSpots=[blind spots] fact, inference, recommendation을 비교해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: research-game-design-jobs
- 스킬 흐름: research-game-design-jobs
- 전문 역할: evidence-auditor → career-strategist

### 중간 산출물
- job-posting-evidence

### 예상 결과물
#### 최소 결과물
- source URL/date/region/sample boundary
- repeated signal 조건
- fact/inference/recommendation label
- evidence gap

#### 선택 결과물
- candidate artifact mapping

#### 확장 결과물
- reviewAfter
- non-generalizable limit

### 파일 구조
- game-design-career/career-foundations/research-standard/content.md
- game-design-career/career-foundations/research-standard/evidence.yml
- game-design-career/career-foundations/research-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/research-standard/content.md
- game-design-career/career-foundations/research-standard/evidence.yml
- game-design-career/career-foundations/research-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s10
- SVG: guides/assets/game-design-career/skills/research-game-design-jobs.svg
- PNG: guides/assets/game-design-career/skills/research-game-design-jobs.png
- 대체 텍스트: 게임 기획 채용 근거 조사 직접 호출 흐름

### 사람 검토
#### 승인 경계
evidence-auditor owner와 career-strategist가 표본 경계를 검토하고 repeated signal을 승인 또는 보류한다. 표본은 채용 시장이나 합격을 보장하지 않는다.

#### 보류 조건
- source URL/date/region/sample boundary 중 하나가 없음
- 두 개 미만 공고를 repeated signal로 표시함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
research-standard의 source records와 sample boundary를 보존하고 만료된 공고만 재검색해 validator 확인부터 재개해.
```
<!-- PROMPT-CARD: career:research-game-design-jobs:advanced -->
## career:research-game-design-jobs:advanced

**최신성·blind spot·일반화 한계를 검토하는 채용 조사**

freshness와 blind spot을 보이는 sample의 일반화 한계를 기록하고 fact, inference, recommendation을 분리한다.

### 사용하는 경우
current posting conclusion의 freshness, source coverage, blind spot, reviewAfter를 audit할 때 사용한다.

### 사용하지 않는 경우
표본의 빈칸을 추정된 시장 사실로 채우거나 채용 확률·적합성·합격을 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- official source URLs
- retrieval date
- as-of date
- region
- sample scope
- blind spots
- reviewAfter

#### 선택 입력
- prior evidence IDs
- candidate artifacts

### 바꿀 자리표시자
- [공식 공고 URL 목록]
- [retrieval date]
- [as-of date]
- [region]
- [sample scope]
- [blind spots]
- [reviewAfter]

### Codex App 완성 예시
```text
@Game Design Career 사용자가 제공한 복수 공식 공고 URL 목록 또는 미정 상태의 retrieval date, as-of date, region, sample scope, blind spots, reviewAfter를 audit해 fact, inference, recommendation과 일반화 제한을 구분해 줘.
```

### Codex App 재사용 템플릿
```text
@Game Design Career 복수 공식 공고 URL 목록 [공식 공고 URL 목록]의 [retrieval date], [as-of date], [region], [sample scope], [blind spots], [reviewAfter]를 audit하고 fact, inference, recommendation과 일반화 제한을 나눠 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:research-game-design-jobs officialPostingUrls="사용자가 제공한 복수 공식 공고 URL 목록 또는 미정" retrievalDate=2026-08-09 asOfDate=2026-08-09 region=KR sampleScope=공식-공고-표본 blindSpots=미정-기록 reviewAfter=2026-09-09 source URL, retrieval date, as-of date, region, sample scope, blind spots의 fact, inference, recommendation과 generalization limit을 audit해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:research-game-design-jobs officialPostingUrls=[공식 공고 URL 목록] retrievalDate=[retrieval date] asOfDate=[as-of date] region=[region] sampleScope=[sample scope] blindSpots=[blind spots] reviewAfter=[reviewAfter] fact, inference, recommendation을 audit해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: research-game-design-jobs
- 스킬 흐름: research-game-design-jobs
- 전문 역할: evidence-auditor → career-strategist

### 중간 산출물
- job-posting-evidence

### 예상 결과물
#### 최소 결과물
- freshness status
- source URL/date/region/sample scope
- blind spots
- generalization limits
- fact/inference/recommendation label

#### 선택 결과물
- refresh queue

#### 확장 결과물
- audit receipt
- cross-region comparison limit

### 파일 구조
- game-design-career/career-foundations/research-advanced/content.md
- game-design-career/career-foundations/research-advanced/evidence.yml
- game-design-career/career-foundations/research-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/research-advanced/content.md
- game-design-career/career-foundations/research-advanced/evidence.yml
- game-design-career/career-foundations/research-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s10
- SVG: guides/assets/game-design-career/skills/research-game-design-jobs.svg
- PNG: guides/assets/game-design-career/skills/research-game-design-jobs.png
- 대체 텍스트: 게임 기획 채용 근거 조사 직접 호출 흐름

### 사람 검토
#### 승인 경계
evidence-auditor owner가 freshness와 blind spots를 검토하고 career-strategist와 current conclusion을 승인 또는 보류한다. audit은 채용 확률이나 합격을 보장하지 않는다.

#### 보류 조건
- as-of date 또는 reviewAfter가 없음
- blind spot을 숨긴 current conclusion

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
research-advanced의 dated sample과 blind spots를 보존하고 reviewAfter가 지난 source만 갱신해 freshness audit부터 재개해.
```
