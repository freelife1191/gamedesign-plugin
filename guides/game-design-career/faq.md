# Career FAQ

Career 사례는 직무·경험·공고·포트폴리오를 증거와 사람 검토에 연결하는 방법을 안내합니다. 아래 요청은 초안을 만들 뿐이며, 합격·채용·승진·회사 평가는 보장하지 않습니다. template-backed Artifact는 각 질문에 적힌 artifact-relative 경로에서 `content.md → evidence.yml → decisions/ → assets/README.md → export-manifest.yml` 순서로 읽습니다.

### Q01. 시스템, 콘텐츠, 전투, 경제, UX, 내러티브와 레벨 기획은 어떻게 비교하는가?

**결론:** 직무는 이름보다 해결하는 문제와 확인 가능한 증거로 비교합니다. 시스템은 규칙·상태, 콘텐츠는 분기, 전투는 선택, 경제는 source·sink, UX는 복구, 내러티브·레벨은 맥락·공간을 중심으로 봅니다.

**언제·왜:** 목표 직무를 하나로 단정하기 전, 같은 역할명도 조직·프로젝트에 따라 달라질 수 있으므로 작은 proof task와 review 질문을 비교할 때 사용합니다. 비교표는 역할 적합성이나 채용 결과를 판정하지 않습니다.

**실행 요청:**

```text
@Game Design Career 시스템, 콘텐츠, 전투, 경제, UX, 내러티브와 레벨 기획을 문제·증거·가장 작은 과제로 비교하고 내 현재 evidence의 빈칸을 표시해.
```

```text
$game-design-career:map-game-design-career artifact=game-design-career/<career-id>/competency-matrix/ evidence=public-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/competency-matrix/content.md → game-design-career/<career-id>/competency-matrix/evidence.yml → game-design-career/<career-id>/competency-matrix/decisions/README.md → game-design-career/<career-id>/competency-matrix/assets/README.md → game-design-career/<career-id>/competency-matrix/export-manifest.yml` 순서로 `target-level`, `gap`, `minimum-repair`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 멘토가 직무 비교의 범위와 `proof artifact`를 검토하고, 근거가 없는 역할 수준은 가설로 둡니다. 공개 권리와 attribution을 확인하며 직무 선택·합격 가능성은 보장하지 않습니다.

**실패·재개·관련 경로:** evidence가 부족하면 빈칸과 대안을 **보존 → 사람 확인 → 재개**합니다. [CA-T01](use-cases/concept-scenarios.md#ca-t01-시스템-기획-입문-학생), [역할 매핑](skills/map-game-design-career.md), [역할·학습 레시피](recipes/role-learning-roadmap.md)를 함께 읽습니다.

### Q02. 비전공·무경력자는 무엇부터 증명해야 하는가?

**결론:** 비전공·무경력자는 경력처럼 보이게 꾸미기보다 작은 문제를 고르고, 자신의 판단·수정·증거를 읽을 수 있게 만드는 것부터 증명합니다.

**언제·왜:** 이력에 직접 연결할 경험이 적을 때 하나의 규칙표, 관찰 기반 분석 또는 짧은 개선 기록을 proof로 시작합니다. 전공 여부가 역량·채용 결과를 자동으로 결정하지 않으므로 역할 가설은 재검토합니다.

**실행 요청:**

```text
@Game Design Career 무경력 상태를 숨기지 말고, 공개 가능한 한 페이지 proof와 개인 판단·수정 근거를 가진 portfolio project brief를 만들어.
```

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/<career-id>/portfolio-project-brief/ evidence=public-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/portfolio-project-brief/content.md → game-design-career/<career-id>/portfolio-project-brief/evidence.yml → game-design-career/<career-id>/portfolio-project-brief/decisions/README.md → game-design-career/<career-id>/portfolio-project-brief/assets/README.md → game-design-career/<career-id>/portfolio-project-brief/export-manifest.yml` 순서로 `target-competency`, `implementation-test`, `rights`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 포트폴리오 검토자가 개인 기여와 근거의 구분 및 `inspectabilityGate`를 확인하고, 권리 불명 자료는 공개하지 않습니다. 작은 proof는 역량 기록일 뿐 합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** 기여를 입증할 evidence가 없으면 unknown과 다음 과제를 **보존 → 사람 확인 → 재개**합니다. [CA-T08](use-cases/concept-scenarios.md#ca-t08-실무-경험이-없는-신입), [portfolio 구축](skills/build-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 연결합니다.

### Q03. 학교 프로젝트도 포트폴리오 증거가 되는가?

**결론:** 학교 프로젝트는 실제로 한 개인의 기여, 판단 과정과 공개 범위를 확인할 수 있을 때 포트폴리오 증거가 될 수 있으며, 팀 전체 성과를 개인 성과로 바꾸면 안 됩니다.

**언제·왜:** 학교 정책과 팀 동의를 확인한 뒤, 맡은 문제·변경 전후·검토 feedback을 claim-evidence index에 남길 때 사용합니다. 이는 확인일 **2026-08-06**의 단일 회사 공식 source인 [EA Early Careers FAQ](https://www.ea.com/careers/early-careers/faq)를 제한적으로 적용한 것으로, 적용 지역은 source가 명시하지 않아 **지역 불명**이며 표본은 EA 한 회사뿐입니다. 다음 지원·공개 전 source 또는 학교 정책이 바뀌었는지 재확인합니다.

**실행 요청:**

```text
@Game Design Career 학교 팀 프로젝트의 개인 기여, evidence locator, 팀 attribution과 공개 권한을 분리한 portfolio case study 초안을 만들어.
```

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/<career-id>/creative-design-portfolio/ evidence=school-project-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/creative-design-portfolio/content.md → game-design-career/<career-id>/creative-design-portfolio/evidence.yml → game-design-career/<career-id>/creative-design-portfolio/decisions/README.md → game-design-career/<career-id>/creative-design-portfolio/assets/README.md → game-design-career/<career-id>/creative-design-portfolio/export-manifest.yml` 순서로 `claim-id`, `evidence-id`, `attribution`을 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 팀원·교사가 attribution, 공개 권리와 `inspectabilityGate`를 검토하고, 근거는 학교·지역·표본이 아닌 해당 프로젝트의 범위로 제한합니다. 이 기록은 채용 결과를 보장하지 않습니다.

**실패·재개·관련 경로:** 팀 동의나 개인 evidence가 없으면 공개 claim을 **보존 → 사람 확인 → 재개**합니다. [CA-T08](use-cases/concept-scenarios.md#ca-t08-실무-경험이-없는-신입), [portfolio 구축](skills/build-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 참고합니다.

### Q04. 현재 공고가 서로 다를 때 반복 요구를 어떻게 찾는가?

**결론:** 현재 공고의 반복 요구는 각 공식 source record를 먼저 보존한 뒤 제한된 표본 안에서만 비교해 찾고, 반복 문구를 시장 전체의 사실로 바꾸지 않습니다.

**언제·왜:** 지원 지역·직무·시점이 다른 공고를 읽을 때 required·preferred와 role context를 같은 필드로 정리합니다. 공고는 자주 바뀌므로 retrievalDate와 reviewAfter가 지난 record는 current claim에 쓰지 않습니다.

**실행 요청:**

```text
@Game Design Career 내가 제공한 공개 공식 공고의 required·preferred를 sourceUrl, location, retrievalDate, region, sample boundary로 기록하고 반복 신호와 gap을 분리해.
```

```text
$game-design-career:research-game-design-jobs artifact=game-design-career/<career-id>/job-posting-evidence/ region=<region>
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/job-posting-evidence/content.md → game-design-career/<career-id>/job-posting-evidence/evidence.yml → game-design-career/<career-id>/job-posting-evidence/decisions/README.md → game-design-career/<career-id>/job-posting-evidence/assets/README.md → game-design-career/<career-id>/job-posting-evidence/export-manifest.yml` 순서로 `source-url`, `retrieval-date`, `sample-geography`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Research Owner가 공식 근거·지역·표본과 `explicit gaps`를 검토하고, 권리 또는 접근 제한이 있는 원문은 복제하지 않습니다. 반복 신호는 채용 가능성이나 전체 시장 경향을 보장하지 않습니다.

**실패·재개·관련 경로:** source가 stale이거나 누락되면 기존 record와 이유를 **보존 → 사람 확인 → 재개**합니다. [CA-C03](use-cases/competency-paths.md#ca-c03-현재-채용공고-조사), [공고 조사](skills/research-game-design-jobs.md), [공고 gap 레시피](recipes/job-research-gap.md)를 따릅니다.

### Q05. 적은 공고 표본을 시장 전체처럼 일반화하지 않으려면 어떻게 하는가?

**결론:** 표본 수·지역·확인일·제외 기준을 함께 기록하고, 결론을 해당 표본의 관찰 또는 가설로만 쓰면 시장 전체 일반화를 피할 수 있습니다.

**언제·왜:** 두세 개 공고처럼 작은 표본에서 ‘모든 회사’라는 문장을 피하고 다음 재검색 날짜를 잡을 때 사용합니다. 2026-08-06 확인일은 문서의 조사 기준일일 뿐, 이후 공고의 최신성을 보장하지 않습니다.

**실행 요청:**

```text
@Game Design Career 공고 표본의 수, 지역, 확인일, 제외 기준과 reviewAfter를 명시하고 market-wide claim 없이 evidence summary를 만들어.
```

```text
$game-design-career:research-game-design-jobs artifact=game-design-career/<career-id>/job-posting-evidence/ sampleBoundary=<declared-boundary>
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/job-posting-evidence/content.md → game-design-career/<career-id>/job-posting-evidence/evidence.yml → game-design-career/<career-id>/job-posting-evidence/decisions/README.md → game-design-career/<career-id>/job-posting-evidence/assets/README.md → game-design-career/<career-id>/job-posting-evidence/export-manifest.yml` 순서로 `sample-geography`, `freshness`, `source-url`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Research Owner가 근거의 표본, `explicit gaps`와 재검증 시점을 검토하고, 권리 제한 원문은 location만 보존합니다. 적은 표본은 시장 전체·합격 가능성·회사 평가를 보장하지 않습니다.

**실패·재개·관련 경로:** 표본 경계가 빠지면 결론을 historical record로 **보존 → 사람 확인 → 재개**합니다. [CA-C03](use-cases/competency-paths.md#ca-c03-현재-채용공고-조사), [공고 조사](skills/research-game-design-jobs.md), [공고 gap 레시피](recipes/job-research-gap.md)를 읽습니다.

### Q06. 역기획에서 관찰, 추론과 추측을 어떻게 분리하는가?

**결론:** 직접 확인한 행동·화면·문구는 관찰, 그 원인 설명은 추론, 아직 검증하지 못한 가능성은 추측 또는 unknown으로 기록해 서로 바꾸지 않습니다.

**언제·왜:** 공개 build나 허용된 자료에서 기능을 분석할 때 observation locator와 counterexample을 먼저 남기면 내부 구현을 사실처럼 말하는 일을 줄입니다. 추론의 confidence는 검증을 대신하지 않습니다.

**실행 요청:**

```text
@Game Design Career 공개 build 관찰을 observation, inference, unknown과 counterexample으로 분리하고 다음 validation queue를 만들어.
```

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/<career-id>/reverse-design-document/ source=public-observation-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/reverse-design-document/content.md → game-design-career/<career-id>/reverse-design-document/evidence.yml → game-design-career/<career-id>/reverse-design-document/decisions/README.md → game-design-career/<career-id>/reverse-design-document/assets/README.md → game-design-career/<career-id>/reverse-design-document/export-manifest.yml` 순서로 `observation`, `inference`, `validation-method`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Design Reviewer가 근거와 추론의 `falsifiable` 경계를 검토하고, 권리 없는 화면·비공개 정보는 사용하지 않습니다. 문서의 해석은 실제 내부 설계·채용 역량을 보장하지 않습니다.

**실패·재개·관련 경로:** observation이 없으면 추측을 사실로 채우지 않고 unknown을 **보존 → 사람 확인 → 재개**합니다. [CA-C05](use-cases/competency-paths.md#ca-c05-관찰-기반-역기획), [역기획](skills/reverse-engineer-game-design.md), [역기획 레시피](recipes/reverse-design.md)를 봅니다.

### Q07. 플레이 화면을 사용하지 않고도 역기획서를 만들 수 있는가?

**결론:** 플레이 화면이 없어도 공개 설명·규칙 문구처럼 허용된 관찰 가능한 자료의 범위를 명시하면 제한된 역기획을 만들 수 있지만, 보지 못한 상호작용은 inference로 확정하지 않습니다.

**언제·왜:** screenshot·영상·build 접근 권한이 없을 때 자료의 location, 관찰 가능한 문장과 unknown을 남깁니다. 원문을 복제하거나 비공개 자료를 입력하는 대신, 확인 가능한 공개 source만 사용합니다.

**실행 요청:**

```text
@Game Design Career 플레이 화면 없이 공개 설명과 허용된 문구에서 직접 관찰 가능한 내용만 기록하고, 확인 불가 항목은 unknown과 validation queue로 남겨.
```

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/<career-id>/reverse-design-document/ source=public-text-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/reverse-design-document/content.md → game-design-career/<career-id>/reverse-design-document/evidence.yml → game-design-career/<career-id>/reverse-design-document/decisions/README.md → game-design-career/<career-id>/reverse-design-document/assets/README.md → game-design-career/<career-id>/reverse-design-document/export-manifest.yml` 순서로 `source-address`, `scope`, `validation-method`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Rights Reviewer가 근거의 공개 권리, 인용 범위와 `falsifiable` 경계를 검토하며, 권리 없는 화면은 추가하지 않습니다. 제한된 관찰은 완전한 역기획이나 채용 결과를 보장하지 않습니다.

**실패·재개·관련 경로:** 공개 source가 부족하면 허용 범위와 unknown을 **보존 → 사람 확인 → 재개**합니다. [CA-C05](use-cases/competency-paths.md#ca-c05-관찰-기반-역기획), [역기획](skills/reverse-engineer-game-design.md), [역기획 레시피](recipes/reverse-design.md)를 연결합니다.

### Q08. 포트폴리오 문서는 몇 개가 적절한가?

**결론:** 적절한 개수는 고정 숫자가 아니라 읽는 사람이 관련 claim·근거·판단 과정을 확인할 수 있는 선별된 문서 수이며, 많은 문서가 더 높은 품질을 뜻하지 않습니다.

**언제·왜:** 역할별 공고와 현재 proof를 비교해 중복 case를 줄이고, 각 문서가 다른 문제를 보여 주는지 검토할 때 사용합니다. 확인일 **2026-08-06**의 단일 회사 공식 source인 [Ubisoft Hiring Process](https://www.ubisoft.com/en-us/company/careers/locations/articles/our-hiring-process)는 **Ubisoft Sofia / Bulgaria** 범위의 안내이며 표본은 Ubisoft 한 회사뿐입니다. 제출 전 또는 다음 지원 시 source와 현행 지원 안내를 재확인하며 회사 양식을 복제하지 않습니다.

**실행 요청:**

```text
@Game Design Career 현재 case 목록에서 target role과 연결되지 않거나 evidence가 중복된 문서를 표시하고, 선별 기준과 backlog를 만들어.
```

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/<career-id>/creative-design-portfolio/ evidence=portfolio-index
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/creative-design-portfolio/content.md → game-design-career/<career-id>/creative-design-portfolio/evidence.yml → game-design-career/<career-id>/creative-design-portfolio/decisions/README.md → game-design-career/<career-id>/creative-design-portfolio/assets/README.md → game-design-career/<career-id>/creative-design-portfolio/export-manifest.yml` 순서로 `claim-id`, `target-competency`, `inspectability`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Portfolio Reviewer가 선별 근거, 공개 권리와 `inspectabilityGate`를 검토하고, 근거 없는 양적 기준은 사용하지 않습니다. 문서 수는 평가·합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** selection rationale이 없으면 목록과 중복 표시를 **보존 → 사람 확인 → 재개**합니다. [CA-C06](use-cases/competency-paths.md#ca-c06-창작-기획-포트폴리오), [portfolio 구축](skills/build-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 확인합니다.

### Q09. 최종 결과보다 판단 과정과 반복 개선을 어떻게 보여 주는가?

**결론:** 최종 결과만 제시하지 말고 판단한 문제, 대안, 관찰, 결정, feedback과 반복 개선의 전후 근거를 claim별로 연결해 보여 줍니다.

**언제·왜:** 한 번의 결과물이 왜 그렇게 되었는지 읽기 어려울 때 finding과 minimum repair를 남기며, 보이지 않는 기여나 삭제된 초안을 성과로 발명하지 않습니다. 반복은 횟수가 아니라 확인 가능한 수정의 연결입니다.

**실행 요청:**

```text
@Game Design Career portfolio case의 판단, feedback, 수정 전후 evidence와 minimum repair를 five-axis review로 연결해.
```

```text
$game-design-career:review-game-design-portfolio artifact=game-design-career/<career-id>/five-axis-review/ evidence=portfolio-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/five-axis-review/content.md → game-design-career/<career-id>/five-axis-review/evidence.yml → game-design-career/<career-id>/five-axis-review/decisions/README.md → game-design-career/<career-id>/five-axis-review/assets/README.md → game-design-career/<career-id>/five-axis-review/export-manifest.yml` 순서로 `finding-id`, `evidence-id`, `minimum-repair`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 reviewer가 근거·수정의 사실성과 `observation state`를 검토하고, 권리나 팀 attribution이 불명확한 자료는 공개하지 않습니다. 반복 기록은 능력 점수·합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** 전후 evidence가 없으면 finding과 질문을 **보존 → 사람 확인 → 재개**합니다. [CA-C07](use-cases/competency-paths.md#ca-c07-포트폴리오-검토수정발표), [portfolio 검토](skills/review-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 사용합니다.

### Q10. 팀 프로젝트에서 개인 기여를 어떻게 증명하는가?

**결론:** 팀 결과와 개인 기여를 분리해 내가 맡은 판단, evidence address, 협업 handoff와 수정 범위를 기록하면 개인 기여를 과장하지 않고 증명할 수 있습니다.

**언제·왜:** 공동 산출물을 포트폴리오에 넣기 전 attribution, 팀원 동의, 공개 범위와 실제 역할을 확인합니다. 팀 규모·매출·성과·다른 사람의 작업을 개인 claim으로 바꾸지 않습니다.

**실행 요청:**

```text
@Game Design Career 팀 project의 개인 판단, 팀 attribution, evidence locator, 공개 제외 항목과 reviewer 질문을 분리한 case study를 만들어.
```

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/<career-id>/creative-design-portfolio/ evidence=team-project-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/creative-design-portfolio/content.md → game-design-career/<career-id>/creative-design-portfolio/evidence.yml → game-design-career/<career-id>/creative-design-portfolio/decisions/README.md → game-design-career/<career-id>/creative-design-portfolio/assets/README.md → game-design-career/<career-id>/creative-design-portfolio/export-manifest.yml` 순서로 `claim-id`, `attribution`, `rights`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 팀원과 Portfolio Reviewer가 근거·attribution·공개 권리 및 `inspectabilityGate`를 검토합니다. 개인 기여 기록은 팀 성과 평가나 채용을 보장하지 않습니다.

**실패·재개·관련 경로:** attribution 동의가 없으면 claim과 공개 제외 목록을 **보존 → 사람 확인 → 재개**합니다. [CA-T08](use-cases/concept-scenarios.md#ca-t08-실무-경험이-없는-신입), [portfolio 구축](skills/build-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 읽습니다.

### Q11. NDA 프로젝트는 어떻게 다루는가?

**결론:** NDA 프로젝트는 비공개 사실·자료를 입력하거나 공개하지 않고, 허용된 범위의 추상화된 문제·개인 판단 또는 새 공개 proof로 대체합니다.

**언제·왜:** 계약·회사 정책·팀 동의가 불명확할 때 source와 raw asset을 먼저 제외하고, 실제 공개 권한이 확인된 사실만 evidence로 연결합니다. NDA는 포트폴리오에서 내용의 진실성이나 권리 상태를 자동으로 해결하지 않습니다.

**실행 요청:**

```text
@Game Design Career NDA 프로젝트의 비공개 자료는 제외하고, 공개 가능한 개인 판단과 새 proof task만 가진 transition-ready portfolio outline을 만들어.
```

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/<career-id>/portfolio-project-brief/ evidence=public-proof-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/portfolio-project-brief/content.md → game-design-career/<career-id>/portfolio-project-brief/evidence.yml → game-design-career/<career-id>/portfolio-project-brief/decisions/README.md → game-design-career/<career-id>/portfolio-project-brief/assets/README.md → game-design-career/<career-id>/portfolio-project-brief/export-manifest.yml` 순서로 `target-competency`, `rights`, `retrospective`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Rights Reviewer와 실제 권한 보유자가 근거·NDA·공개 권리 및 `inspectabilityGate`를 검토합니다. 허용 범위의 outline은 법률 판단이나 채용 결과를 보장하지 않습니다.

**실패·재개·관련 경로:** 공개 권한이 불명확하면 자료를 입력하지 않고 boundary를 **보존 → 사람 확인 → 재개**합니다. [CA-T09](use-cases/concept-scenarios.md#ca-t09-비전공자다른-직군-전환자), [portfolio 구축](skills/build-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 참조합니다.

### Q12. 생성 이미지를 포트폴리오에 어떻게 표시하는가?

**결론:** 생성 이미지는 stable asset ID, prompt 또는 source, provider decision, 권리(rights)·provenance와 named human review를 표시하고, 기획 역량의 증거나 자동 승인으로 바꾸지 않습니다.

**언제·왜:** 포트폴리오의 illustration이 claim을 돕지만 사실·개인 기여를 대체할 수 없을 때 image lifecycle의 상태와 placement·alt text를 기록합니다. 이미지 생성 결과와 production-candidate 상태는 제출·권리 승인과 다릅니다.

**실행 요청:**

```text
@Game Design Career portfolio image의 stable asset ID, provenance, rights, placement와 alt text를 검토하고 실제 named-human decision이 없으면 blocker만 남겨.
```

```text
$game-design-career:review-image-assets assetId=portfolio-proof-01 targetState=document-approved reviewer=<named-human> rightsDecision=<decision>
```

**예상 결과·읽는 순서:** `review-image-assets`의 주 산출물은 `image-asset-review`, `lifecycle-receipt`이며, 현재 Artifact의 `assets/image-assets.yml → evidence.yml → decisions/` 순서로 stable asset ID·alt text·decisionReceipt·rights 상태를 읽습니다. 이 review는 `creative-design-portfolio` template을 새로 만들거나 profile을 바꾸지 않습니다.

**사람 검토·근거·권리·비보장:** 실제 named-human 사람 Rights Reviewer가 근거·provenance·권리와 공개 placement를 검토하고, 근거 없는 `approval-state change`를 금지합니다. 생성 이미지는 포트폴리오 claim, 실무 기여, 합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** receipt나 권리가 없으면 current state와 blocker를 **보존 → 사람 확인 → 재개**합니다. [CA-C06](use-cases/competency-paths.md#ca-c06-창작-기획-포트폴리오), [이미지 검토](skills/review-image-assets.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 연결합니다.

### Q13. 5축 검토 결과가 낮으면 능력이 없다는 뜻인가?

**결론:** 5축 검토의 낮은 결과는 해당 evidence와 inspection 범위에서 우선 수리할 finding을 뜻할 뿐, 사람의 능력·잠재력·채용 가능성을 판정하지 않습니다.

**언제·왜:** claim의 근거, 가독성, attribution 또는 scope가 약할 때 점수보다 finding-id와 minimum-repair를 우선 읽습니다. not-observed와 defect-observed를 구분해 빈 evidence를 실패 사실로 과장하지 않습니다.

**실행 요청:**

```text
@Game Design Career 5축 finding을 능력 평가로 바꾸지 말고, evidence locator와 minimum repair·recovery owner가 있는 backlog로 정리해.
```

```text
$game-design-career:review-game-design-portfolio artifact=game-design-career/<career-id>/five-axis-review/ evidence=portfolio-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/five-axis-review/content.md → game-design-career/<career-id>/five-axis-review/evidence.yml → game-design-career/<career-id>/five-axis-review/decisions/README.md → game-design-career/<career-id>/five-axis-review/assets/README.md → game-design-career/<career-id>/five-axis-review/export-manifest.yml` 순서로 `finding-id`, `observation-state`, `minimum-repair`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 reviewer가 근거·finding 범위·권리 공개 상태와 `observation state`를 검토합니다. review 결과는 능력 등급, 회사 평가, 합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** inspectability가 없으면 not-observed와 repair 질문을 **보존 → 사람 확인 → 재개**합니다. [CA-C07](use-cases/competency-paths.md#ca-c07-포트폴리오-검토수정발표), [portfolio 검토](skills/review-game-design-portfolio.md), [portfolio 레시피](recipes/portfolio-build-review.md)를 봅니다.

### Q14. 공고에 맞춰 포트폴리오를 어떻게 선별하는가?

**결론:** 공고의 current requirement와 case의 claim-evidence를 비교해 관련성과 공개 가능성을 우선 선별하고, 키워드만 맞추기 위해 사실·역할·결과를 바꾸지 않습니다.

**언제·왜:** 지원 전에 한 공고의 region, retrievalDate, sample boundary를 확인하고 맞는 proof를 골라 읽는 순서를 제안할 때 사용합니다. 공고가 stale이면 이전 선택 이유를 current requirement처럼 쓰지 않습니다.

**실행 요청:**

```text
@Game Design Career 공개 공식 공고의 current requirement와 내 portfolio claim-evidence를 비교해 관련 case, gap, 공개 제한과 다음 proof task를 선별해.
```

```text
$game-design-career:research-game-design-jobs artifact=game-design-career/<career-id>/job-posting-evidence/ region=<region>
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/job-posting-evidence/content.md → game-design-career/<career-id>/job-posting-evidence/evidence.yml → game-design-career/<career-id>/job-posting-evidence/decisions/README.md → game-design-career/<career-id>/job-posting-evidence/assets/README.md → game-design-career/<career-id>/job-posting-evidence/export-manifest.yml` 순서로 `source-url`, `retrieval-date`, `freshness`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 reviewer가 근거·관련성·권리, `explicit gaps`와 공고 freshness를 검토합니다. 선별은 특정 회사의 평가·지원 성공·합격을 보장하지 않습니다.

**실패·재개·관련 경로:** 공고가 오래되었거나 claim이 약하면 기존 비교와 gap을 **보존 → 사람 확인 → 재개**합니다. [CA-C03](use-cases/competency-paths.md#ca-c03-현재-채용공고-조사), [공고 조사](skills/research-game-design-jobs.md), [공고 gap 레시피](recipes/job-research-gap.md)를 따릅니다.

### Q15. 포트폴리오 근거를 면접 답변에 어떻게 연결하는가?

**결론:** 포트폴리오의 claim-id와 evidence-id를 면접 questionId에 연결해, 답변에서 상황·판단·대안·결과·한계를 같은 근거 주소로 다시 찾게 합니다.

**언제·왜:** 면접 질문이 포트폴리오의 한 결정을 묻거나 follow-up이 생길 때 answer-feedback record를 만듭니다. 문서에 없는 팀 성과·수치·구현 결과는 답변에 추가하지 않고 honest gap으로 남깁니다.

**실행 요청:**

```text
@Game Design Career portfolio claim-evidence를 stable questionId에 연결하고, follow-up과 honest-answer boundary를 포함한 면접 연습 기록을 만들어.
```

```text
$game-design-career:practice-game-design-interview artifact=game-design-career/<career-id>/interview-question-answer-log/ evidence=portfolio-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/interview-question-answer-log/content.md → game-design-career/<career-id>/interview-question-answer-log/evidence.yml → game-design-career/<career-id>/interview-question-answer-log/decisions/README.md → game-design-career/<career-id>/interview-question-answer-log/assets/README.md → game-design-career/<career-id>/interview-question-answer-log/export-manifest.yml` 순서로 `question-id`, `portfolio-evidence-id`, `answer-status`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Interview Coach가 근거·정직성·공개 권리와 `explicit gap`을 검토합니다. 연습 기록은 답변 성과나 합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** 연결할 evidence가 없으면 questionId와 verification task를 **보존 → 사람 확인 → 재개**합니다. [CA-C08](use-cases/competency-paths.md#ca-c08-면접주니어-성장직무-전환), [면접 연습](skills/practice-game-design-interview.md), [면접 레시피](recipes/interview-preparation.md)를 읽습니다.

### Q16. 경험이 없는 질문에 어떻게 정직하게 답하는가?

**결론:** 경험이 없는 질문에는 정직하게 하지 않은 일을 채우지 말고, 관련된 관찰·작은 과제·가정과 다음 verification task를 구분한 honest-answer로 답합니다.

**언제·왜:** 직접 맡은 역할, 수치, 팀 규모 또는 결과를 증명할 수 없을 때 적용합니다. 유사한 개인 과제가 있어도 실무 경험으로 바꾸지 않으며, 질문의 의도를 확인한 뒤 제한을 먼저 말합니다.

**실행 요청:**

```text
@Game Design Career 경험이 없는 면접 질문에 대해 발명 없이 honest-answer, 관련 evidence, 한계와 다음 verification task를 만들어.
```

```text
$game-design-career:practice-game-design-interview artifact=game-design-career/<career-id>/interview-question-answer-log/ evidence=honest-gap-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/interview-question-answer-log/content.md → game-design-career/<career-id>/interview-question-answer-log/evidence.yml → game-design-career/<career-id>/interview-question-answer-log/decisions/README.md → game-design-career/<career-id>/interview-question-answer-log/assets/README.md → game-design-career/<career-id>/interview-question-answer-log/export-manifest.yml` 순서로 `question-id`, `honest-answer`, `verification-task`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Interview Coach가 근거·표현의 정직성·공개 권리와 `explicit gap`을 검토합니다. honest-answer는 경험 부족을 숨기지 않으며 면접 평가·합격·채용을 보장하지 않습니다.

**실패·재개·관련 경로:** 근거가 전혀 없으면 빈칸과 학습 과제를 **보존 → 사람 확인 → 재개**합니다. [CA-C08](use-cases/competency-paths.md#ca-c08-면접주니어-성장직무-전환), [면접 연습](skills/practice-game-design-interview.md), [면접 레시피](recipes/interview-preparation.md)를 활용합니다.

### Q17. 주니어 성장 계획에 어떤 evidence와 feedback을 남기는가?

**결론:** 주니어 성장 계획에는 실제 project event evidence, 개인/팀 attribution, feedback, 목표, owner, cadence, next-review-date와 다음 proof artifact를 함께 남깁니다.

**언제·왜:** 분기 또는 프로젝트 마일스톤에서 목표를 성과 약속으로 바꾸지 않고, 관찰 가능한 evidence와 feedback을 다음 검토에 연결할 때 사용합니다. current role requirement는 sourceUrl, retrievalDate, region, sample boundary와 reviewAfter를 갖춰 재검증합니다.

**실행 요청:**

```text
@Game Design Career 실제 project event와 feedback을 목표, owner, cadence, next-review-date, proof artifact에 연결하고 fresh requirement의 한계를 분리해.
```

```text
$game-design-career:plan-junior-growth artifact=game-design-career/<career-id>/junior-growth-review/ evidence=project-event-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/junior-growth-review/content.md → game-design-career/<career-id>/junior-growth-review/evidence.yml → game-design-career/<career-id>/junior-growth-review/decisions/README.md → game-design-career/<career-id>/junior-growth-review/assets/README.md → game-design-career/<career-id>/junior-growth-review/export-manifest.yml` 순서로 `project-event-evidence`, `next-review-date`, `proof-artifact`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 manager 또는 mentor가 근거·feedback·공개 권리와 다음 `proof artifact`를 검토합니다. 성장 기록은 승진·이직·채용 또는 회사 평가를 보장하지 않습니다.

**실패·재개·관련 경로:** feedback이나 freshness가 없으면 current claim 없이 기록을 **보존 → 사람 확인 → 재개**합니다. [CA-T10](use-cases/concept-scenarios.md#ca-t10-주니어의-성장이직), [주니어 성장](skills/plan-junior-growth.md), [성장·전환 레시피](recipes/junior-growth-transition.md)를 봅니다.

### Q18. 플러그인이 합격 가능성을 판단할 수 있는가?

**결론:** 플러그인은 evidence 정리, gap 질문, 요청문과 검토 순서를 도울 수 있지만 합격 가능성이나 회사의 평가를 판단하거나 보장할 수 없습니다.

**언제·왜:** 공고·포트폴리오·면접 기록을 한 흐름으로 정리할 때 결과 예측 대신 source freshness, 개인 기여, rights와 사람 review가 남았는지 확인합니다. 역할·회사·시점에 따른 결정은 외부 표본이나 자동 점수로 단정하지 않습니다.

**실행 요청:**

```text
@Game Design Career 합격 가능성을 예측하지 말고, 내 public evidence의 gap, 사람 검토 지점, freshness와 다음 smallest proof task를 정리해.
```

```text
$game-design-career:orchestrate-game-design-career artifact=game-design-career/<career-id>/career-stage-goal/ evidence=public-evidence-id
```

**예상 결과·읽는 순서:** `game-design-career/<career-id>/career-stage-goal/content.md → game-design-career/<career-id>/career-stage-goal/evidence.yml → game-design-career/<career-id>/career-stage-goal/decisions/README.md → game-design-career/<career-id>/career-stage-goal/assets/README.md → game-design-career/<career-id>/career-stage-goal/export-manifest.yml` 순서로 `target-role`, `success-evidence`, `review-date`를 읽습니다.

**사람 검토·근거·권리·비보장:** 사람 Career Lead가 근거·권리·공개 경계, `evidence gaps`와 다음 행동을 검토합니다. 플러그인의 초안·점수·정리는 합격, 채용, 승진 또는 회사 평가를 보장하지 않습니다.

**실패·재개·관련 경로:** 근거가 stale이거나 불완전하면 unknown과 재검색 조건을 **보존 → 사람 확인 → 재개**합니다. [CA-C08](use-cases/competency-paths.md#ca-c08-면접주니어-성장직무-전환), [Career 오케스트레이터](skills/orchestrate-game-design-career.md), [성장·전환 레시피](recipes/junior-growth-transition.md)를 연결합니다.

### Q19. 이전 학습·포트폴리오 교훈을 다음 작업에 어떻게 안전하게 쓰는가?

**결론:** 현재 프로젝트에서 이름이 확인된 사람이 승인한 기록만 참고합니다. 자동으로 남는 기록은 후보뿐이며 자동 승인되지 않습니다.

**언제·왜:** 출처 파일, 적용·제외 조건, 검토·만료 시점과 Career 영역을 먼저 확인합니다. 충돌이나 손상이 있으면 어느 쪽도 임의로 고르지 않고 기존 작업은 기억 없이 계속합니다. 기억은 공고, 피드백과 개인 기여 근거를 대신하지 않습니다.

**실행 요청:**

```text
@Game Design Career 기억 후보와 승인 기록을 보여 주고, 현재 포트폴리오 작업에 적용할 수 없는 항목은 이유와 함께 제외해.
```

**비활성화와 관련 문서:** 완전히 끄려면 `GAME_DESIGN_MEMORY_ENABLED=false`를 설정하고, 한 번만 제외하려면 “이번 작업에서는 이전 기억을 사용하지 마.”라고 요청합니다. 자세한 관리와 복구 순서는 [Career 프로젝트 기억](memory.md)을 따릅니다.
