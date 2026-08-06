# Career 역량 학습 경로

각 사례는 Career Canonical Artifact를 별도로 만들고, 관찰 사실·추론·제안과 사람 결정을 분리합니다. 채용 가능성, 후보자 가치, 팀 기여 또는 시장 전체를 순위·단정하지 않습니다.

## CA-C01 기획 직무와 전문 분야 탐색

### 현재 상황과 목표

**사용자와 상황:** 시스템, 콘텐츠, UX, 경제 중 관심은 있으나 현재 증거가 어느 역할 경로를 지지하는지 불분명합니다.

**학습 목표:** 역할 이름을 정답으로 고정하지 않고 여러 provisional path와 각 path의 다음 증거를 비교합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 관심 분야, 공개 가능한 경험, 학습 시간을 역할 요구와 나란히 보려 할 때.
- 부적합: 한 역할이 더 우월하거나 합격 가능성이 높다고 판정하려 할 때.

### 준비 입력

- 최소 입력: 관심 역할 후보, 현재 공개 가능한 작업물, 학습 제약, 검토자.
- 선택 입력: 이전 프로젝트에서 확인 가능한 개인 판단과 dated role evidence.

### 10분 미니 실습

역할 후보 둘을 적고 각각에 “현재 evidence”, “모르는 점”, “다음 proof task” 한 줄씩 붙입니다. evidence가 없으면 빈칸을 경력처럼 채우지 않습니다.

### 표준 실습

1. `career-stage-goal`에 목표·제약·검토일을 기록합니다.
2. `game-design-role-map`에 여러 role path와 전이 가능한 역량을 분리합니다.
3. `learning-roadmap`에 path별 최소 proof task와 사람 feedback cadence를 둡니다.

### 포트폴리오·실무 확장

경로 선택 이유, 보류한 대안, 공개 가능한 evidence summary를 별도 Career Artifact에 남깁니다. Studio 원본이나 팀 비공개 자료를 병합하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 시스템·콘텐츠·UX 역할 경로를 현재 공개 가능한 evidence와 gap으로 비교해. 후보자 순위나 합격 예측 없이 여러 provisional path와 다음 proof task를 보여 줘.
```

### Codex CLI 요청문

```text
$game-design-career:map-game-design-career artifact=game-design-career/role-map 현재 evidence와 미확인 gap을 보존하고 role path별 learning-roadmap을 제안해.
```

### 스킬·템플릿 흐름

`apply-document-quality-profile` → `map-game-design-career` → 필요 시 `research-game-design-jobs`를 사용합니다. 템플릿은 `career-stage-goal`, `game-design-role-map`, `learning-roadmap`입니다. 역할 경계는 career strategist가 비교를 돕고, 실제 사용자와 멘토가 선택을 검토하는 데 있습니다.

### 결과물

**최소 결과:** `game-design-role-map`, `learning-roadmap`과 명시적 gap.

**선택 결과:** 사람 검토를 위한 공개 가능한 evidence summary.

**확장 결과:** 검토자가 다음 proof task를 확인한 Career Artifact.

### 검토와 승인

**읽는 순서:** 목표 → evidence → gap → proof task → 결정 기록입니다. **검토 체크포인트:** `game-design-role-map` → `learning-roadmap` 순서로 읽고 역할 후보와 proof task의 연결을 확인합니다. **사람 결정:** 사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류합니다. 도구 실행은 자동 승인이 아닙니다.

### 실패·재개

role evidence가 없으면 unknown을 보존합니다. **보존:** 기존 role map, evidence ID, 보류한 대안과 검토 날짜. 사용자와 멘토가 role evidence 또는 과제 기록을 확인한 뒤에만 관찰 또는 짧은 과제로 재개합니다.

### 자기점검과 다음 학습

현재 evidence가 실제로 지지하는 path와 희망을 구분했는가? 분석 언어가 필요하면 `CA-C02`, current requirement가 필요하면 `CA-C03`으로 이동합니다.

## CA-C02 게임 분석 언어와 관찰·추론 분리

### 현재 상황과 목표

**사용자와 상황:** 플레이한 게임을 설명하지만 직접 본 장면과 설계 의도에 대한 해석이 섞여 있습니다.

**학습 목표:** 관찰 사실, 추론, 반례와 검증 제안을 분리한 분석 언어를 사용합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 공개 build의 행동·피드백·상태를 분석해 포트폴리오 근거를 만들 때.
- 부적합: 내부 구현, 매출, 팀 의도를 확인 없이 사실로 쓰거나 작품을 복제할 때.

### 준비 입력

- 최소 입력: 공개 build 또는 공개 영상의 location, 관찰할 장면, 권리 경계.
- 선택 입력: timestamp, 버전, 관찰 질문, 반례 후보.

### 10분 미니 실습

짧은 장면에서 입력과 화면 반응만 세 줄로 적고, “의도일 수 있다”는 문장을 별도 추론으로 옮깁니다.

### 표준 실습

1. `game-analysis-report`에 장면·location·관찰 사실을 기록합니다.
2. `reverse-design-document`에 추론과 counterexample을 분리합니다.
3. `five-axis-review`로 근거 누락과 과장 claim을 검토합니다.

### 포트폴리오·실무 확장

관찰 범위, 기각한 해석, 재관찰 조건을 사례의 공개 가능한 evidence로 정리합니다. 팀 결과나 경험을 만들지 않습니다.

### Codex App 요청문

```text
@Game Design Career 공개 build의 관찰 사실, 추론, 반례와 다음 검증을 분리한 게임 분석 보고서를 만들어. 확인하지 못한 내부 의도와 성과는 추정하지 마.
```

### Codex CLI 요청문

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/analysis 공개 location의 관찰과 추론을 분리해 reverse-design-document로 정리해.
```

### 스킬·템플릿 흐름

`apply-document-quality-profile` → `reverse-engineer-game-design` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-analysis-report`, `reverse-design-document`, `five-axis-review`입니다. reviewer는 finding을 제출하고, 공개 범위와 해석 채택은 사람이 결정합니다.

### 결과물

**최소 결과:** `game-analysis-report`, `reverse-design-document`와 반례.

**선택 결과:** timestamp가 있는 공개 가능한 관찰 목록.

**확장 결과:** 권리 검토를 거친 분석 사례.

### 검토와 승인

**읽는 순서:** 관찰 → 추론 → 반례 → 제안 → 권리 경계입니다. **검토 체크포인트:** `game-analysis-report` → `reverse-design-document` 순서로 읽고 관찰과 해석의 경계를 확인합니다. **사람 결정:** 작성자와 멘토가 관찰의 정확성, 공개 범위와 다음 검증을 결정합니다. 자동 분석은 사실이나 승인을 대신하지 않습니다.

### 실패·재개

location 또는 권리가 불명확하면 해당 claim을 보류합니다. **보존:** 관찰 기록, evidence ID, 반례와 확인 질문. 작성자와 멘토가 공개 location 또는 권리를 확인한 뒤에만 보존한 관찰에서 재개합니다.

### 자기점검과 다음 학습

각 문장이 직접 본 사실인지, 해석인지, 다음 제안인지 설명할 수 있는가? 역할·공고 요구와 연결하려면 `CA-C03` 또는 `CA-C04`로 이동합니다.

## CA-C03 현재 채용공고 조사

### 현재 상황과 목표

**사용자와 상황:** 특정 역할의 current requirement를 알고 싶지만 하나의 공고나 검색 결과를 시장 전체처럼 일반화하면 안 됩니다.

**학습 목표:** 공식 source와 dated sample을 재현 가능한 current evidence로 남기고, 반복 신호와 개인 gap을 분리합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 역할·level·region을 정해 공식 회사 채용 페이지의 요구를 비교할 때.
- 부적합: convenience sample로 채용량, 후보자 가치, 합격 가능성 또는 시장 전체를 단정할 때.

### 준비 입력

- 최소 입력: target role, level, region, retrievalDate, 조사 질문과 공개 가능한 개인 evidence.
- 선택 입력: 사람 검토자, sample size, blind spot, 다음 proof task 후보.

### 10분 미니 실습

공식 회사 채용 페이지 하나를 “표본 하나”로 기록하고 required와 preferred를 분리합니다. 없거나 stale한 source는 current claim에 쓰지 않습니다.

### 표준 실습

1. 공고별 observation record에 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`를 함께 기록합니다.
2. 예시 source는 기존 [공고 조사 스킬](../skills/research-game-design-jobs.md)의 `official company career page` 기준을 따르며, 실제 공식 HTTPS URL은 실행 시 기록합니다.
3. 반복 신호는 제한된 표본의 추론으로 두고, 개인 evidence 부족은 portfolio proof task 제안으로 남깁니다.
4. stale record는 `reviewAfter` 이후 재검색 전까지 current claim에 사용하지 않으며, 새 source ID로 이어서 기록합니다.

### 포트폴리오·실무 확장

표본 안의 requirement와 자신의 공개 가능한 evidence를 나란히 두되 fit·채용 결과를 판정하지 않습니다. 의사결정자는 sample boundary와 refresh owner를 확인합니다.

### Codex App 요청문

```text
@Game Design Career 공식 회사 채용 페이지의 공개 공고만 사용해 role별 requirement를 기록해. sourceUrl, location, retrievalDate, region, sample boundary, reviewAfter와 stale 재검색 경계를 보존하고 시장·합격을 일반화하지 마.
```

### Codex CLI 요청문

```text
$game-design-career:research-game-design-jobs role=systems-designer level=entry region=KR retrievalDate=<date> official source record와 sample boundary를 보존해.
```

### 스킬·템플릿 흐름

`research-game-design-jobs` → `map-game-design-career` → `apply-document-quality-profile` 순서입니다. 템플릿은 `job-posting-evidence`, `game-design-role-map`, `competency-matrix`입니다. evidence auditor와 Research Owner가 source freshness·지역·표본을 검토하며, 도구가 채용 결정을 내리지 않습니다.

### 결과물

**최소 결과:** `job-posting-evidence`, `game-design-role-map`과 source ID별 표본 경계.

**선택 결과:** requirement 비교와 다음 proof task.

**확장 결과:** 사람이 freshness와 공개 범위를 확인한 dated evidence set.

### 검토와 승인

**읽는 순서:** source record → sample boundary → observation → inference → proposal입니다. **검토 체크포인트:** `job-posting-evidence` → `game-design-role-map` 순서로 읽고 source record와 role inference를 확인합니다. **사람 결정:** Research Owner와 Portfolio Reviewer가 region, reviewAfter, 공개 가능한 evidence와 backlog를 결정합니다. source 수집은 자동 승인을 하지 않으며 채용을 보장하지 않습니다.

### 실패·재개

공식 source가 없거나 `reviewAfter`가 지나면 current conclusion을 보류합니다. **보존:** 기존 source ID, location, retrievalDate, sample boundary와 historical record. Research Owner와 Portfolio Reviewer가 공식 source와 freshness를 확인한 뒤에만 재검색한 뒤 새 source ID 또는 evidence ID로 갱신해 재개합니다.

### 자기점검과 다음 학습

모든 current claim이 dated 공식 표본으로 되짚어지는가? gap을 학습 과제로 바꾸려면 `CA-C04`로 이동합니다.

## CA-C04 역량 격차와 학습·증거 계획

### 현재 상황과 목표

**사용자와 상황:** 역할 요구와 현재 작업물 사이의 차이를 보았지만 무엇을 배우고 어떤 proof를 남길지 정하지 못했습니다.

**학습 목표:** gap을 결함 판정이 아니라 학습 가설, evidence task, reviewer cadence로 바꿉니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: current evidence와 target requirement를 비교해 짧은 학습 계획을 만들 때.
- 부적합: 부족한 경험을 지어 내거나 일정·채용 결과를 약속할 때.

### 준비 입력

- 최소 입력: evidence ID, 목표 역할의 표본 경계, 사용 가능한 시간, reviewer.
- 선택 입력: existing artifact, 접근성·권리 제약, 학습 우선순위 기준.

### 10분 미니 실습

gap 하나를 “모르는 점”, “작은 proof”, “검토 날짜”로 나누고, 현재 level을 사실처럼 확정하지 않습니다.

### 표준 실습

1. `competency-matrix`에 evidence가 지지하는 관찰과 open gap을 씁니다.
2. `learning-roadmap`에 prerequisite, proof artifact, reviewer, 재검토일을 둡니다.
3. `career-stage-goal`에 우선순위가 바뀌는 조건을 기록하고 필요할 때만 `visualize-career-roadmap`과 `export-career-documents`를 준비합니다.

### 포트폴리오·실무 확장

완성도가 아니라 수정 전후 evidence, 기각한 대안, 다음 review를 보여 줍니다. 개인과 팀의 기여를 섞지 않습니다.

### Codex App 요청문

```text
@Game Design Career 공개 evidence와 제한된 공고 표본을 비교해 competency gap을 학습 가설과 proof task로 바꿔. 경력 단계나 합격 결과를 확정하지 말고 reviewer와 재검토 조건을 넣어 줘.
```

### Codex CLI 요청문

```text
$game-design-career:map-game-design-career artifact=game-design-career/learning-roadmap evidence ID를 보존하고 competency-matrix와 learning-roadmap을 연결해.
```

### 스킬·템플릿 흐름

`apply-document-quality-profile` → `map-game-design-career` → 필요 시 `visualize-career-roadmap` → `export-career-documents`입니다. 템플릿은 `competency-matrix`, `learning-roadmap`, `career-stage-goal`입니다. 멘토와 작성자가 proof scope를 검토합니다.

### 결과물

**최소 결과:** `competency-matrix`, `learning-roadmap`과 review date.

**선택 결과:** 검토용 경로 도식 계획 또는 export 준비.

**확장 결과:** 사람이 확인한 proof artifact와 다음 iteration.

### 검토와 승인

**읽는 순서:** current evidence → gap → proof task → cadence → 결정입니다. **검토 체크포인트:** `competency-matrix` → `learning-roadmap` 순서로 읽고 gap과 proof task의 우선순위를 확인합니다. **사람 결정:** 작성자와 멘토가 우선순위, 가능한 범위와 공개 여부를 결정합니다. 계획 생성은 자동 승인을 하지 않으며 성장을 보장하지 않습니다.

### 실패·재개

evidence가 비어 있으면 gap을 유지합니다. **보존:** evidence ID, matrix 행, 보류한 path와 review date. 작성자와 멘토가 작은 관찰 과제를 확인한 뒤에만 작은 관찰 과제로 되돌아갑니다.

### 자기점검과 다음 학습

gap이 능력의 낙인 대신 검증 가능한 다음 작업으로 적혔는가? 관찰 기반 사례는 `CA-C05`, 창작 사례는 `CA-C06`으로 이동합니다.

## CA-C05 관찰 기반 역기획

### 현재 상황과 목표

**사용자와 상황:** 공개 게임 기능을 분석해 역기획 사례를 만들고 싶지만 보이지 않는 구현과 타인의 권리를 넘어서면 안 됩니다.

**학습 목표:** evidence ID가 있는 관찰 사실, confidence가 있는 추론, 다음 검증 제안을 분리한 역기획을 만듭니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 공개 build·영상의 기능을 관찰해 선택, 피드백, 반례를 분석할 때.
- 부적합: 내부 코드·팀 성과·개인 기여를 발명하거나 권리 불명 capture를 공개할 때.

### 준비 입력

- 최소 입력: 공개 location, `evidence ID`, 관찰 범위, 개인 기여 경계, 공개·권리 검토자.
- 선택 입력: version, timestamp, counterexample, 재관찰 날짜.

### 10분 미니 실습

`EVID-RD-01`에 화면에서 직접 본 행동을 observation으로 쓰고, 의도 해석은 inference, 다음 확인은 proposal로 따로 씁니다.

### 표준 실습

1. observation은 `EVID-RD-01`처럼 location과 범위를 가진 `evidence ID`로 기록합니다.
2. inference에는 반례와 confidence를, proposal에는 재관찰 또는 prototype 질문을 붙입니다.
3. 개인 기여는 실제로 수행한 분석·수정만 적고, 공개 전 public-rights review에서 source·capture·인용 허용 범위를 확인합니다.

### 포트폴리오·실무 확장

Studio 작업이 입력이면 공개 가능한 evidence summary만 handoff로 받고 원본 Artifact를 병합하지 않습니다. 팀의 성과나 경험은 개인 evidence로 바꾸지 않습니다.

### Codex App 요청문

```text
@Game Design Career 공개 build 관찰을 EVID-RD-01로 기록해 observation, inference, proposal과 반례를 분리한 역기획을 만들어. 개인 기여와 public-rights review가 확인되지 않으면 공개 claim을 보류해.
```

### Codex CLI 요청문

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/reverse-design EVID-RD-01 관찰을 보존하고 reverse-design-document를 작성해.
```

### 스킬·템플릿 흐름

`apply-document-quality-profile` → `reverse-engineer-game-design` → `export-career-documents`입니다. 템플릿은 `reverse-design-document`, `game-analysis-report`입니다. public-rights reviewer와 작성자가 공개 범위·개인 기여를 검토합니다.

### 결과물

**최소 결과:** `reverse-design-document`, `game-analysis-report`, `EVID-RD-01`.

**선택 결과:** 권리 검토 전의 공개 가능성 체크리스트.

**확장 결과:** public-rights review를 통과한 별도 Career 사례.

### 검토와 승인

**읽는 순서:** observation evidence ID → inference → proposal → 개인 기여 → public-rights review입니다. **검토 체크포인트:** `reverse-design-document` → `game-analysis-report` 순서로 읽고 관찰 evidence와 분석 claim을 확인합니다. **사람 결정:** 작성자와 public-rights reviewer가 공개 범위, 인용·capture 권리와 개인 기여 서술을 승인·수정·보류합니다. 분석은 자동 승인을 하지 않으며 품질, 채용 또는 공개를 보장하지 않습니다.

### 실패·재개

source location·권리·개인 기여 중 하나라도 불명확하면 공개하지 않고 evidence를 보존합니다. **보존:** `EVID-RD-01`, observation, inference, proposal과 review finding. public-rights reviewer가 source location, 권리와 개인 기여를 확인한 뒤에만 public-rights review 뒤 확인된 범위에서 재개합니다.

### 자기점검과 다음 학습

관찰을 구현 사실처럼 썼거나 팀 결과를 개인 기여로 썼는가? 창작 설계 사례가 필요하면 `CA-C06`으로 이동합니다.

## CA-C06 창작 기획 포트폴리오

### 현재 상황과 목표

**사용자와 상황:** 새 기획 아이디어를 포트폴리오로 만들고 싶지만 문제, 판단, 검증 계획과 실제 개인 기여가 흐려질 수 있습니다.

**학습 목표:** evidence ID를 가진 입력과 observation·inference·proposal을 분리해 창작 기획의 판단을 보여 줍니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 공개 가능한 문제 정의와 직접 만든 설계 산출물을 case study로 구성할 때.
- 부적합: 팀 결과를 자기 성과로 바꾸거나 사용 권한 없는 asset을 proof로 넣을 때.

### 준비 입력

- 최소 입력: 문제, 설계 제약, `evidence ID`, 실제 개인 기여, public-rights review owner.
- 선택 입력: feedback, prototype 관찰, 기각한 대안, 공개 목표.

### 10분 미니 실습

`EVID-CP-01` 하나에 observation을, 그 해석을 inference로, 다음 prototype을 proposal로 적습니다. 내가 한 판단과 팀이 한 일을 별도 줄에 둡니다.

### 표준 실습

1. `portfolio-project-brief`에 문제·제약·개인 기여·evidence ID를 기록합니다.
2. `creative-design-portfolio`에 observation, inference, proposal과 대안을 연결합니다.
3. `five-axis-review`와 public-rights review로 claim, asset, 공개 범위를 확인합니다.

### 포트폴리오·실무 확장

Studio Artifact에서 받은 것은 공개 가능한 evidence summary뿐이며 Career folder와 병합하지 않습니다. 아직 검증되지 않은 효과나 팀 결과는 claim으로 쓰지 않습니다.

### Codex App 요청문

```text
@Game Design Career EVID-CP-01에 근거한 창작 기획 포트폴리오를 구성해. observation, inference, proposal, 실제 개인 기여와 public-rights review를 분리하고 성과·채용을 보장하지 마.
```

### Codex CLI 요청문

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/creative-case EVID-CP-01과 개인 기여 경계를 보존해 creative-design-portfolio를 작성해.
```

### 스킬·템플릿 흐름

`apply-document-quality-profile` → `build-game-design-portfolio` → `review-game-design-portfolio`입니다. 템플릿은 `portfolio-project-brief`, `creative-design-portfolio`, `five-axis-review`입니다. portfolio reviewer와 public-rights reviewer가 finding을 내고 사람이 선택합니다.

### 결과물

**최소 결과:** `portfolio-project-brief`, `creative-design-portfolio`, `EVID-CP-01`.

**선택 결과:** 개인 기여와 공개 범위의 review queue.

**확장 결과:** public-rights review를 통과한 portfolio case study.

### 검토와 승인

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review입니다. **검토 체크포인트:** `portfolio-project-brief` → `creative-design-portfolio` 순서로 읽고 개인 기여와 공개 claim을 확인합니다. **사람 결정:** 작성자, portfolio reviewer, public-rights reviewer가 공개 가능한 claim과 asset을 결정합니다. 생성 결과는 자동 승인을 하지 않으며 포트폴리오 품질이나 채용을 보장하지 않습니다.

### 실패·재개

개인 기여 또는 권리가 확인되지 않으면 해당 section을 보류합니다. **보존:** `EVID-CP-01`, 관찰·추론·제안, review finding과 공개 제외 목록. portfolio reviewer와 public-rights reviewer가 개인 기여와 권리를 확인한 뒤에만 public-rights review가 끝난 범위에서 재개합니다.

### 자기점검과 다음 학습

문제, 내 판단, 검증 evidence가 연결되는가? 수정 우선순위와 발표가 필요하면 `CA-C07`로 이동합니다.

## CA-C07 포트폴리오 검토·수정·발표

### 현재 상황과 목표

**사용자와 상황:** 포트폴리오 초안은 있으나 claim과 evidence, 수정 우선순위, 발표 답변의 연결이 불분명합니다.

**학습 목표:** evidence ID에 근거한 observation·inference·proposal로 다섯 축 검토와 발표 연습을 만듭니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 공개 전에 claim, 개인 기여, evidence trace와 수정 backlog를 검토할 때.
- 부적합: reviewer finding을 자동 승인으로 처리하거나 성과·합격을 보장할 때.

### 준비 입력

- 최소 입력: 사례 초안, `evidence ID`, 개인 기여 statement, public-rights review owner.
- 선택 입력: feedback 기록, 발표 시간 제약, 공개 audience, pending 질문.

### 10분 미니 실습

`EVID-PR-01` 한 항목을 observation으로 읽고, evidence sufficiency는 inference, 가장 작은 수정은 proposal로 적습니다.

### 표준 실습

1. `five-axis-review`에 `EVID-PR-01`과 observation, inference, proposal을 연결합니다.
2. `portfolio-backlog`에 최소 repair와 review owner를 기록합니다.
3. `introduction-motivation`과 면접 질문은 실제 개인 기여와 public-rights review가 확인된 범위만 사용합니다.

### 포트폴리오·실무 확장

발표 자료는 Studio 원본을 가져오지 않고 공개 가능한 summary만 참조합니다. 팀 성과, 매출, retention이나 타인의 기여를 개인 주장으로 넣지 않습니다.

### Codex App 요청문

```text
@Game Design Career EVID-PR-01을 기준으로 five-axis review와 최소 수정 backlog를 만들어. observation, inference, proposal, 개인 기여와 public-rights review를 분리하고 채용 결과를 보장하지 마.
```

### Codex CLI 요청문

```text
$game-design-career:review-game-design-portfolio artifact=game-design-career/portfolio-review EVID-PR-01에 연결된 finding과 portfolio-backlog를 남겨.
```

### 스킬·템플릿 흐름

`review-game-design-portfolio` → `build-game-design-portfolio` → `practice-game-design-interview` → `export-career-documents`입니다. 템플릿은 `five-axis-review`, `portfolio-backlog`, `introduction-motivation`입니다. reviewer와 발표 준비 멘토가 finding을 내고 공개 여부는 사람이 결정합니다.

### 결과물

**최소 결과:** `five-axis-review`, `portfolio-backlog`, `introduction-motivation`, `EVID-PR-01`.

**선택 결과:** 발표 연습용 질문과 공개 전 권리 체크.

**확장 결과:** 사람 검토 뒤의 public-ready presentation package.

### 검토와 승인

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → backlog입니다. **검토 체크포인트:** `five-axis-review` → `portfolio-backlog` → `introduction-motivation` 순서로 읽고 finding, repair, 발표 claim을 확인합니다. **사람 결정:** 작성자, portfolio reviewer, public-rights reviewer와 멘토가 수정·발표·공개 범위를 결정합니다. review는 자동 승인을 하지 않으며 합격, 시장 반응 또는 팀 성과를 보장하지 않습니다.

### 실패·재개

evidence가 claim을 지지하지 않으면 claim을 줄입니다. **보존:** `EVID-PR-01`, 관찰·추론·제안, 개인 기여 경계와 review history. portfolio reviewer와 멘토가 claim과 evidence를 확인한 뒤에만 backlog로 되돌립니다.

### 자기점검과 다음 학습

각 발표 claim이 evidence ID와 개인 기여 범위로 돌아가는가? honest gap 답변과 성장 계획은 `CA-C08`으로 이동합니다.

## CA-C08 면접·주니어 성장·직무 전환

### 현재 상황과 목표

**사용자와 상황:** 면접, 주니어 성장 또는 직무 전환을 준비하지만 현재 evidence와 목표 사이의 준비도를 확정 사실처럼 쓰기 쉽습니다.

**학습 목표:** evidence ID에 기반한 observation·inference·proposal로 honest gap, 개인 기여, 다음 proof task를 기록합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 공개 가능한 requirement와 경험을 연결해 답변 연습·성장 검토·전환 계획을 만들 때.
- 부적합: 면접 결과, 승진, 이직 성공 또는 팀 기여를 보장하거나 발명할 때.

### 준비 입력

- 최소 입력: posting 또는 portfolio `evidence ID`, 개인 기여 경계, feedback owner, public-rights review owner.
- 선택 입력: target role, reviewAfter, 실험할 proof task, 공개 가능 여부.

### 10분 미니 실습

`EVID-GR-01`의 관찰 사실 하나를 답변 근거로 적고, readiness는 inference, 다음 연습은 proposal로 둡니다. 모르는 점은 honest gap으로 남깁니다.

### 표준 실습

1. `interview-question-answer-log`에 `EVID-GR-01`, observation, inference, proposal과 honest gap을 연결합니다.
2. `junior-growth-review`에 실제 개인 기여와 feedback을 기록하고, 팀 결과·비공개 자료는 분리합니다.
3. `transition-readiness`에는 public-rights review, target evidence freshness와 다음 proof task를 남기고 필요할 때만 `visualize-career-roadmap`과 `export-career-documents`를 준비합니다.

### 포트폴리오·실무 확장

Studio에서 온 항목은 공개 가능한 evidence summary만 Career Artifact에 적습니다. 권리, 개인 기여, 사람 검토가 없는 자료는 공개·면접 claim에 사용하지 않습니다.

### Codex App 요청문

```text
@Game Design Career EVID-GR-01을 사용해 면접·주니어 성장·직무 전환의 observation, inference, proposal과 honest gap을 정리해. 개인 기여와 public-rights review를 분리하고 채용·승진·전환을 보장하지 마.
```

### Codex CLI 요청문

```text
$game-design-career:practice-game-design-interview artifact=game-design-career/growth-transition EVID-GR-01을 보존하고 interview-question-answer-log와 다음 proof task를 연결해.
```

### 스킬·템플릿 흐름

`practice-game-design-interview` → `plan-junior-growth` → 필요 시 `visualize-career-roadmap` → `export-career-documents`입니다. 템플릿은 `interview-question-answer-log`, `junior-growth-review`, `transition-readiness`입니다. 멘토, manager 또는 career reviewer와 public-rights reviewer가 검토를 맡고, 결과는 사람이 결정합니다.

### 결과물

**최소 결과:** `interview-question-answer-log`, `junior-growth-review`, `transition-readiness`, `EVID-GR-01`.

**선택 결과:** feedback cadence, proof task, 도식·export 준비 상태.

**확장 결과:** public-rights review와 사람 피드백을 거친 성장·전환 evidence package.

### 검토와 승인

**읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → feedback입니다. **검토 체크포인트:** `interview-question-answer-log` → `junior-growth-review` → `transition-readiness` 순서로 읽고 honest gap, feedback, 다음 proof task를 확인합니다. **사람 결정:** 작성자와 멘토·manager·career reviewer, public-rights reviewer가 공개 범위와 다음 task를 결정합니다. 이 기록은 자동 승인을 하지 않으며 채용, 승진, 이직, 팀 기여 또는 시장 가치를 보장하지 않습니다.

### 실패·재개

fresh requirement, 개인 기여 또는 권리 확인이 없으면 readiness claim을 보류합니다. **보존:** `EVID-GR-01`, observation, inference, proposal, honest gap과 review owner의 질문. 멘토·manager·career reviewer와 public-rights reviewer가 fresh requirement, 개인 기여와 권리를 확인한 뒤에만 재검색·재검토합니다.

### 자기점검과 다음 학습

답변이 evidence ID와 실제 개인 기여로 추적되는가? stale current evidence는 재검색했는가? 다음 주기의 역할·gap 비교는 `CA-C03`과 `CA-C04`로 돌아갑니다.
