# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:review-game-design:beginner -->
## studio:review-game-design:beginner

**누락과 모순을 질문으로 남기는 기획 검토**

작은 Canonical Artifact의 누락·모순을 direct evidence와 owner 질문으로 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 이 시스템 명세의 누락과 모순을 direct evidence가 있는 질문으로 점검해 줘. stable section, 최소 수정 후보와 decision owner를 기록하고 source를 재작성하지 마.
```

### 짧은 흐름
- 작업 순서: review-game-design
- 함께 검토하는 역할: lead-game-designer

### 이 요청으로 받는 결과
예: `game-design/studio-production/review-beginner/content.md`에 evidence-backed 질문, affected section ID, 최소 수정 후보, decision owner을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
명확한 review question이 있는 한 Artifact에서 최소 수정 전 확인할 질문을 만들 때 사용한다.

### 사용하지 않는 경우
source 없이 가상의 finding을 만들거나 source 내용을 다시 작성할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical artifact path
- version
- review question
- stable section ID
- decision owner

#### 선택 입력
- 기존 evidence
- target stage
- review note

### 바꿀 자리표시자
- [검토 Artifact]
- [review question]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [검토 Artifact]의 [review question]을 direct evidence가 있는 질문으로 점검해 줘. stable section, 최소 수정 후보와 [decision owner]를 기록하고 source를 재작성하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-game-design artifact=artifacts/stamina-system questions=규칙 누락과 모순, decisionOwner=lead-designer direct evidence와 owner 질문만 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-game-design artifact=[검토 Artifact] questions=[review question], decisionOwner=[decision owner] direct evidence와 owner 질문만 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design
- 스킬 흐름: review-game-design
- 전문 역할: lead-game-designer

### 중간 산출물
- game-design-review

### 예상 결과물
#### 최소 결과물
- evidence-backed 질문
- affected section ID
- 최소 수정 후보
- decision owner

#### 선택 결과물
- severity 가설
- source-unavailable hold

#### 확장 결과물
- 재검토 조건
- decision log handoff

### 파일 구조
- game-design/studio-production/review-beginner/content.md
- game-design/studio-production/review-beginner/evidence.yml
- game-design/studio-production/review-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-production/review-beginner/content.md
- game-design/studio-production/review-beginner/evidence.yml
- game-design/studio-production/review-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s12
- SVG: guides/assets/game-design-studio/skills/review-game-design.svg
- PNG: guides/assets/game-design-studio/skills/review-game-design.png
- 대체 텍스트: 게임 기획 누락과 모순 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer decision owner가 finding과 최소 수정을 승인·수정·보류하며 review는 readiness·출시 또는 성공을 보장하지 않는다.

#### 보류 조건
- source Artifact가 없음
- version이 없음
- review question 또는 owner가 없음

#### 안전 경계
모르는 정보와 source 없는 내용은 미정 또는 blocked로 남기며 finding을 발명하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-beginner의 evidence-backed 질문과 source-unavailable hold를 보존하고 복구된 version만 연결해 같은 질문부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:review-game-design:standard -->
## studio:review-game-design:standard

**Evidence gap과 severity를 owner에게 배정하는 검토**

stable section 기반 finding을 evidence gap, severity, impact, minimal fix와 responsible owner로 정규화한다.

### 간단 요청 예시
```text
@Game Design Studio 이 Artifact의 evidence gap을 severity, impact, affected section, minimal fix와 responsible owner로 정규화해 줘. reviewer 권고는 승인으로 표시하지 마.
```

### 짧은 흐름
- 작업 순서: review-game-design → export-game-design-documents
- 함께 검토하는 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 이 요청으로 받는 결과
예: `game-design/studio-production/review-standard/content.md`에 finding ID와 severity, direct evidence와 impact, minimal fix, responsible owner을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
Artifact version과 review boundary가 있고 여러 severity의 evidence gap을 우선순위로 정리할 때 사용한다.

### 사용하지 않는 경우
reviewer 권고를 gate 승인으로 선언하거나 owner 없는 finding을 완료로 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical artifact path/version
- evidence locator
- review boundary
- severity 기준
- responsible owner

#### 선택 입력
- target stage
- existing finding
- role envelope

### 바꿀 자리표시자
- [검토 Artifact]
- [evidence locator]
- [responsible owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [검토 Artifact]의 [evidence locator] gap을 severity, impact, affected section, minimal fix와 [responsible owner]로 정규화해 줘. reviewer 권고는 승인으로 표시하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-game-design artifact=artifacts/coop-economy questions=evidence-gap, decisionOwner=economy-owner evidence gap, severity, impact, minimal fix와 owner를 정규화해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-game-design artifact=[검토 Artifact] evidence=[evidence locator], decisionOwner=[responsible owner] evidence gap과 severity·impact·minimal fix를 정규화해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design
- 스킬 흐름: review-game-design → export-game-design-documents
- 전문 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 중간 산출물
- game-design-review
- decision-change-log

### 예상 결과물
#### 최소 결과물
- finding ID와 severity
- direct evidence와 impact
- minimal fix
- responsible owner

#### 선택 결과물
- role disagreement
- target-stage 영향

#### 확장 결과물
- export hold
- 재검토 handoff

### 파일 구조
- game-design/studio-production/review-standard/content.md
- game-design/studio-production/review-standard/evidence.yml
- game-design/studio-production/review-standard/decisions/README.md
- game-design/studio-production/review-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-production/review-standard/content.md
- game-design/studio-production/review-standard/evidence.yml
- game-design/studio-production/review-standard/export-manifest.yml
- game-design/studio-production/review-standard/decisions/README.md

### 도식 바인딩
- ID: st-s12
- SVG: guides/assets/game-design-studio/skills/review-game-design.svg
- PNG: guides/assets/game-design-studio/skills/review-game-design.png
- 대체 텍스트: 게임 기획 evidence gap과 severity 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
responsible owner와 lead-game-designer가 severity·minimal fix·gate 상태를 승인·수정·보류하며 reviewer finding은 readiness·출시·성공을 보장하지 않는다.

#### 보류 조건
- evidence locator가 없음
- responsible owner가 없음
- source version이 invalid임

#### 안전 경계
모르는 정보와 직접 evidence 없는 영향은 미정 또는 blocked로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-standard의 finding ID·severity·evidence gap을 보존하고 최소 수정 반영 증거 하나만 연결해 같은 owner의 재검토부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:review-game-design:advanced -->
## studio:review-game-design:advanced

**교차 도메인 finding과 decision queue를 분리하는 검토**

economy·UX·production 교차 도메인 finding을 evidence, impact, disagreement와 decision queue로 분리한다.

### 간단 요청 예시
```text
@Game Design Studio economy·UX·production Artifact의 교차 도메인 finding을 direct evidence, impact, owner와 decision queue로 분리해 줘. diagram gap과 export readiness는 승인과 별개로 blocked 상태를 유지해 줘.
```

### 짧은 흐름
- 작업 순서: review-game-design → visualize-game-design → export-game-design-documents
- 함께 검토하는 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 이 요청으로 받는 결과
예: `game-design/studio-production/review-advanced/content.md`에 cross-domain finding, direct evidence와 impact, decision queue, blocked handoff 조건을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 domain Artifact의 blocker, diagram gap, export readiness와 disagreement를 함께 점검할 때 사용한다.

### 사용하지 않는 경우
교차 도메인 영향의 evidence 없이 blocker를 해소하거나 decision queue를 자동 승인할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical Artifact versions
- cross-domain evidence
- finding owner
- decision owner
- review gate

#### 선택 입력
- diagram gap
- export request
- previous disagreement

### 바꿀 자리표시자
- [검토 Artifact]
- [교차 도메인]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [검토 Artifact]의 [교차 도메인] finding을 direct evidence, impact, owner와 [decision owner]의 decision queue로 분리해 줘. diagram gap과 export readiness는 blocked 상태를 유지해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-game-design artifact=artifacts/coop-review questions=economy-ux-production, decisionOwner=game-director 교차 도메인 finding, diagram gap, export readiness와 decision queue를 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-game-design artifact=[검토 Artifact] questions=[교차 도메인], decisionOwner=[decision owner] finding·diagram gap·export readiness와 decision queue를 분리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design
- 스킬 흐름: review-game-design → visualize-game-design → export-game-design-documents
- 전문 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 중간 산출물
- game-design-review
- decision-change-log
- economy-balance
- production-scope-risk

### 예상 결과물
#### 최소 결과물
- cross-domain finding
- direct evidence와 impact
- decision queue
- blocked handoff 조건

#### 선택 결과물
- diagram gap
- export readiness 상태

#### 확장 결과물
- disagreement receipt
- 최소 수리 순서

### 파일 구조
- game-design/studio-production/review-advanced/content.md
- game-design/studio-production/review-advanced/evidence.yml
- game-design/studio-production/review-advanced/decisions/README.md
- game-design/studio-production/review-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-production/review-advanced/content.md
- game-design/studio-production/review-advanced/evidence.yml
- game-design/studio-production/review-advanced/export-manifest.yml
- game-design/studio-production/review-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s12
- SVG: guides/assets/game-design-studio/skills/review-game-design.svg
- PNG: guides/assets/game-design-studio/skills/review-game-design.png
- 대체 텍스트: 게임 기획 교차 도메인 finding 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer named decision owner와 affected domain owner가 cross-domain finding·disagreement·handoff를 승인·수정·보류하며 queue는 gate 통과·출시·성공을 보장하지 않는다.

#### 보류 조건
- cross-domain evidence가 없음
- affected owner가 없음
- all blocker 해소 증거가 없음

#### 안전 경계
모르는 정보와 증명되지 않은 readiness는 미정 또는 blocked로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-advanced의 cross-domain finding과 disagreement receipt를 보존하고 승인된 최소 수정 하나만 연결해 decision queue 확인부터 재개해.
```

</details>
