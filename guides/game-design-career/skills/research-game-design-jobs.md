# research-game-design-jobs

## 목적과 산출물

현재 게임 기획 공고를 dated primary evidence collection으로 만들고 required·preferred requirement, repeated signal, applicant evidence와 gap을 분리합니다.

## 사용할 때

- 특정 role·level·지역의 현재 공고와 tool preference를 조사할 때
- transition이나 portfolio gap을 fresh posting source에 연결할 때

## 사용하지 않을 때

- 단일 공고나 convenience sample로 전체 시장·채용량·성장·보상·적합성을 일반화할 때
- secondary source, stale record 또는 insecure URL을 current claim 근거로 사용할 때

## 필수 입력과 선택 입력

- 필수: target role/level, 지역, employment type, 검색일(`retrievalDate`), trusted `asOfDate`, evidence question
- 선택: candidate artifacts와 employer/project scope
- 모든 결과는 사실·추론·제안을 분리하고 표본 크기·표본 지역·source location·blind spot을 기록합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 한국의 신입 시스템 기획 공고를 공식 회사 채용 페이지에서 조사해. required와 preferred를 분리하고 검색일, 지역, 표본, 반복 신호와 일반화 한계를 기록해.
```

## Codex CLI 예시

```text
$game-design-career:research-game-design-jobs role=systems-designer, level=entry, region=KR, retrievalDate=2026-08-06, asOfDate=2026-08-06
```

## 진행 흐름

official company career page를 우선하고 posting마다 unique `sourceId`, HTTPS URL, `postedDate ≤ retrievalDate ≤ asOfDate ≤ reviewAfter`를 기록합니다. 같은 normalized requirement가 서로 다른 공식 공고 2개 이상에 있을 때만 repeated signal로 표시하고 exact statement·field·index·requirement ID를 보존합니다. nonempty collection은 skill directory에서 `node scripts/validate-job-evidence.mjs collection.json --as-of 2026-08-06`으로 검증합니다.

## 결과와 파일

schema-valid posting records, posting-specific required/preferred, repeated signals, applicant evidence, gaps, non-generalizable constraints, sample size/geography와 inference limits를 `job-posting-evidence`에 남깁니다. 예상 결과 요약: 현재 claim을 source와 날짜까지 재현할 수 있는 evidence set이 생깁니다.

## 검토와 승인

byte-exact source statement가 사실이고, repeated pattern·candidate fit은 별도 추론이며 exercise·proof artifact는 제안입니다. 표본 밖 prevalence나 합격을 보장하지 않습니다. 개인정보·공개 범위와 refresh owner는 사람이 승인합니다.

## 실패와 재개

stale, undated, secondary, insecure, future-retrieved source나 count/denominator/geography mismatch는 completion blocker입니다. `reviewAfter` 이후에는 다시 검색하고 검증합니다.

```text
$game-design-career:research-game-design-jobs 기존 sourceId를 유지하고 reviewAfter가 지난 공고만 재검색한 뒤 validator부터 재개해.
```
