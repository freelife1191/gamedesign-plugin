# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:plan-game-production:beginner -->
## studio:plan-game-production:beginner

**게임 기획 결과: 범위와 제외 항목을 갖춘 최소 제작 계획**

vertical slice의 포함·제외 범위, 알려진 위험과 decision owner를 production-scope-risk에 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 4인 협동 탐험 RPG의 target experience, Must 범위, 제외 항목, 알려진 위험과 decision owner를 최소 production-scope-risk로 정리해 줘. 근거 없는 일정은 provisional로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: plan-game-production
- 함께 검토하는 역할: production-feasibility-critic → lead-game-designer

### 이 요청으로 받는 결과
예시 산출물 조각: 범위 항목은 눈 덮인 마을을 지키는 초보 수비대에 관한 임시 제안입니다. 근거가 확인되기 전에는 확정하지 않습니다. (ID: studio:plan-game-production:beginner; 파일: game-design/studio-production/production-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
target experience가 있고 가장 작은 prototype 범위를 정해야 할 때 사용한다.

### 사용하지 않는 경우
core loop 없이 일정·인원·비용을 확정하거나 제작 성공을 약속할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- target experience
- core loop
- 팀 제약
- 포함 범위
- decision owner

#### 선택 입력
- prototype evidence
- 기존 plan
- known risk

### 바꿀 자리표시자
- [제작 Artifact]
- [target experience]
- [팀 제약]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [제작 Artifact]의 [target experience]을 위해 [팀 제약] 아래 Must 범위, 제외 항목과 위험을 정리해 줘. 근거 없는 일정은 provisional로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-game-production artifact=game-design/coop/production 4인 협동 탐험의 target experience, Must 범위, 제외 항목, 위험과 decision owner를 production-scope-risk에 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-game-production artifact=[제작 Artifact] [target experience]을 위해 [팀 제약] 아래 범위·제외·위험과 decision owner를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-game-production
- 스킬 흐름: plan-game-production
- 전문 역할: production-feasibility-critic → lead-game-designer

### 중간 산출물
- production-scope-risk

### 예상 결과물
#### 최소 결과물
- Must 범위
- 제외 항목
- known risk
- decision owner

#### 선택 결과물
- provisional 일정 범위
- prototype 질문

#### 확장 결과물
- review handoff 조건
- scope 변경 기록

### 파일 구조
- game-design/studio-production/production-beginner/content.md
- game-design/studio-production/production-beginner/evidence.yml
- game-design/studio-production/production-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-production/production-beginner/content.md
- game-design/studio-production/production-beginner/evidence.yml
- game-design/studio-production/production-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s10
- SVG: guides/assets/game-design-studio/skills/plan-game-production.svg
- PNG: guides/assets/game-design-studio/skills/plan-game-production.png
- 대체 텍스트: 최소 게임 제작 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
production-feasibility-critic owner와 lead-game-designer가 scope를 승인·수정·보류하며 초안은 일정·채용·출시 성공을 보장하지 않는다.

#### 보류 조건
- target experience가 없음
- decision owner가 없음
- 제외 항목을 정하지 못함

#### 안전 경계
모르는 정보와 근거 없는 인원·일정·비용은 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
production-beginner의 Must 범위와 제외 항목을 보존하고 새 prototype 근거만 연결해 위험 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:plan-game-production:standard -->
## studio:plan-game-production:standard

**게임 기획 결과: Milestone 의존성과 owner를 갖춘 제작 계획**

승인된 scope를 observable milestone, dependency, owner와 definition of done으로 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 승인된 협동 RPG vertical slice를 milestone, dependency, owner, definition of done과 risk gate로 연결해 줘. capacity 근거가 약한 일정은 provisional로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: plan-game-production → review-game-design
- 함께 검토하는 역할: production-feasibility-critic → lead-game-designer

### 이 요청으로 받는 결과
가상 결과 조각: 와: 등대섬을 함께 복구하는 두 명의 탐험가 기준의 검토 전 초안입니다. 확인할 점: 근거 연결 여부. (ID: studio:plan-game-production:standard; 파일: game-design/studio-production/production-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
scope와 prototype 근거가 있고 milestone별 dependency와 done 기준을 검토할 때 사용한다.

### 사용하지 않는 경우
throughput 근거 없이 마감일을 확정하거나 dependency owner를 자동 배정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- approved scope
- prototype evidence
- dependency
- capacity basis
- milestone owner

#### 선택 입력
- maintenance horizon
- 기존 throughput
- review question

### 바꿀 자리표시자
- [제작 Artifact]
- [승인 scope]
- [capacity 근거]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [제작 Artifact]의 [승인 scope]를 milestone·dependency·owner·DoD로 연결해 줘. [capacity 근거]가 약한 일정은 provisional로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-game-production artifact=game-design/coop/production scope=vertical-slice 협동 탐험 slice의 milestone, dependency, owner, DoD와 risk gate를 production-scope-risk에 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-game-production artifact=[제작 Artifact] scope=[승인 scope] [capacity 근거]를 기록하고 milestone·dependency·owner·DoD를 연결해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-game-production
- 스킬 흐름: plan-game-production → review-game-design
- 전문 역할: production-feasibility-critic → lead-game-designer

### 중간 산출물
- production-scope-risk
- decision-change-log

### 예상 결과물
#### 최소 결과물
- milestone와 dependency
- named owner
- definition of done
- risk gate

#### 선택 결과물
- provisional effort range
- maintenance horizon

#### 확장 결과물
- scope reduction 후보
- review finding handoff

### 파일 구조
- game-design/studio-production/production-standard/content.md
- game-design/studio-production/production-standard/evidence.yml
- game-design/studio-production/production-standard/decisions/README.md
- game-design/studio-production/production-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-production/production-standard/content.md
- game-design/studio-production/production-standard/evidence.yml
- game-design/studio-production/production-standard/export-manifest.yml
- game-design/studio-production/production-standard/decisions/README.md

### 도식 바인딩
- ID: st-s10
- SVG: guides/assets/game-design-studio/skills/plan-game-production.svg
- PNG: guides/assets/game-design-studio/skills/plan-game-production.png
- 대체 텍스트: 게임 제작 milestone과 dependency 직접 호출 흐름

### 사람 검토
#### 승인 경계
milestone owner와 production-feasibility-critic가 dependency·DoD·risk gate를 승인·수정·보류하며 plan은 일정·채용·출시 성공을 보장하지 않는다.

#### 보류 조건
- approved scope가 없음
- dependency owner가 없음
- capacity basis가 없음

#### 안전 경계
모르는 정보와 근거 없는 인원·일정·비용·throughput은 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
production-standard의 milestone·dependency·DoD를 보존하고 새 throughput 근거만 반영해 provisional effort range 검토부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:plan-game-production:advanced -->
## studio:plan-game-production:advanced

**게임 기획 결과: Kill criteria와 외주·license 위험을 검토하는 제작 계획**

변경 요청의 core-loop 기여를 kill criteria, outsource·license 위험과 사람 결정에 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 기존 vertical slice plan의 변경 요청을 core-loop 기여, kill criteria, outsourcing·license 위험과 decision owner에 연결해 줘. 확정되지 않은 비용과 일정은 provisional로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: plan-game-production → review-game-design
- 함께 검토하는 역할: production-feasibility-critic → lead-game-designer → document-quality-editor

### 이 요청으로 받는 결과
가상의 검토 기록 — 핵심 결과 항목: 폐역의 신호를 해독하는 소규모 팀에 맞춰 임시로 정리했습니다. 사람 검토 전에는 미정으로 둡니다. (ID: studio:plan-game-production:advanced; 파일: game-design/studio-production/production-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
기존 production plan의 변경 요청, outsourcing 또는 license 조건을 재평가할 때 사용한다.

### 사용하지 않는 경우
procurement·staffing·license 계약을 자동 승인하거나 irreversible scope expansion을 실행할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 기존 decision log
- 변경 요청
- kill criteria
- outsource/license 조건
- decision owner

#### 선택 입력
- maintenance horizon
- prototype result
- legal review status

### 바꿀 자리표시자
- [제작 Artifact]
- [변경 요청]
- [kill criteria]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [제작 Artifact]의 [변경 요청]을 core-loop 기여와 [kill criteria]에 비교하고 outsource·license 위험과 owner 결정을 기록해 줘. 확정되지 않은 비용과 일정은 provisional로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-game-production artifact=game-design/coop/production 신규 보스 외주 요청을 core-loop 기여, kill criteria, license risk와 decision owner에 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-game-production artifact=[제작 Artifact] [변경 요청]을 [kill criteria]와 비교하고 outsource·license risk와 owner 결정을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-game-production
- 스킬 흐름: plan-game-production → review-game-design
- 전문 역할: production-feasibility-critic → lead-game-designer → document-quality-editor

### 중간 산출물
- production-scope-risk
- decision-change-log

### 예상 결과물
#### 최소 결과물
- kill criteria
- outsource·license risk
- named decision owner

#### 선택 결과물
- provisional cost range
- legal review 상태

#### 확장 결과물
- commit·defer·reduce 후보
- No-Go decision receipt

### 파일 구조
- game-design/studio-production/production-advanced/content.md
- game-design/studio-production/production-advanced/evidence.yml
- game-design/studio-production/production-advanced/decisions/README.md
- game-design/studio-production/production-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-production/production-advanced/content.md
- game-design/studio-production/production-advanced/evidence.yml
- game-design/studio-production/production-advanced/export-manifest.yml
- game-design/studio-production/production-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s10
- SVG: guides/assets/game-design-studio/skills/plan-game-production.svg
- PNG: guides/assets/game-design-studio/skills/plan-game-production.png
- 대체 텍스트: 게임 제작 kill criteria와 외부 위험 직접 호출 흐름

### 사람 검토
#### 승인 경계
named decision owner와 production-feasibility-critic가 kill criteria·outsource·license 결정을 승인·수정·보류하며 자동화는 계약, 채용, 출시 또는 성공을 보장하지 않는다.

#### 보류 조건
- kill criteria가 없음
- outsource 또는 license 조건이 미정
- decision owner가 없음

#### 안전 경계
모르는 정보와 근거 없는 비용·인원·일정·license 상태는 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
production-advanced의 kill criteria와 license risk 기록을 보존하고 확인된 계약 검토 상태 하나만 반영해 보류 결정부터 재개해.
```

</details>
