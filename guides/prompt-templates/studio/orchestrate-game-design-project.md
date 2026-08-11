# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:orchestrate-game-design-project:beginner -->
## studio:orchestrate-game-design-project:beginner

**제한된 brief를 한 route로 라우팅**

제한된 게임 brief를 최소 specialist route, Canonical Artifact와 completion gate로 정리한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 섬 복구 게임의 아이디어, 목표 산출물, 대상과 제약을 bounded brief로 정리하고 다음 specialist route 하나와 completion gate를 골라 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-project
- 함께 검토하는 역할: lead-game-designer

### 이 요청으로 받는 결과
예: `game-design/studio-production/orchestrate-beginner/content.md`에 bounded brief, 선택 route 하나, completion gate, next owner을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
아이디어·대상·제약은 있으나 하나의 다음 specialist route를 정해야 할 때 사용한다.

### 사용하지 않는 경우
분명한 한 도메인 요청을 불필요하게 여러 route로 확장하거나 intent를 추측할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 게임 아이디어
- 목표 산출물
- 대상
- known constraint
- decision owner

#### 선택 입력
- 기존 Artifact
- platform
- review question

### 바꿀 자리표시자
- [게임 아이디어]
- [목표 산출물]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [게임 아이디어]의 [목표 산출물]을 bounded brief로 정리하고 [decision owner]가 검토할 specialist route 하나와 completion gate를 골라 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/coop/brief 협동 섬 복구의 아이디어, 대상, 제약과 decision owner를 받아 최소 route와 completion gate를 정해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:orchestrate-game-design-project artifact=[목표 산출물] [게임 아이디어]와 [decision owner]를 받아 최소 route와 completion gate를 정해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-project
- 스킬 흐름: orchestrate-game-design-project
- 전문 역할: lead-game-designer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- bounded brief
- 선택 route 하나
- completion gate
- next owner

#### 선택 결과물
- 미해결 질문
- safe assumption

#### 확장 결과물
- route handoff record
- hold 상태

### 파일 구조
- game-design/studio-production/orchestrate-beginner/content.md
- game-design/studio-production/orchestrate-beginner/evidence.yml
- game-design/studio-production/orchestrate-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-production/orchestrate-beginner/content.md
- game-design/studio-production/orchestrate-beginner/evidence.yml
- game-design/studio-production/orchestrate-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s09
- SVG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.svg
- PNG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.png
- 대체 텍스트: 제한된 게임 기획 프로젝트 라우팅 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer decision owner가 route와 completion gate를 승인·수정·보류하며 routing record는 디자인·출시 성공을 보장하지 않는다.

#### 보류 조건
- 목표 산출물이 없음
- decision owner가 없음
- intent가 여러 도메인에서 충돌함

#### 안전 경계
모르는 정보는 미정으로 남기며 승인이나 사실을 발명하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-beginner의 bounded brief와 선택 route를 보존하고 새로 확인된 제약만 반영해 completion gate 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:orchestrate-game-design-project:standard -->
## studio:orchestrate-game-design-project:standard

**여러 Artifact를 연결하는 프로젝트 라우팅**

선택된 domain Artifact를 exact route, role, gate와 최대 세 review finding으로 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 RPG의 vision, economy, production Artifact를 exact route와 owner·gate로 연결하고 최대 세 review finding을 분리해 줘. 승인되지 않은 연결은 blocked로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-project → review-game-design
- 함께 검토하는 역할: lead-game-designer → production-feasibility-critic → document-quality-editor

### 이 요청으로 받는 결과
예: `game-design/studio-production/orchestrate-standard/content.md`에 exact route 목록, Artifact 연결, role·gate record, 최대 세 finding을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
vision·system·economy·production처럼 여러 Artifact의 순서와 owner를 정리해야 할 때 사용한다.

### 사용하지 않는 경우
한 실행에서 모든 specialist를 호출하거나 selection record 없이 artifact를 승인할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 기존 Artifact 목록
- requested domain
- known gate
- role boundary
- decision owner

#### 선택 입력
- image requirement
- format request
- 기존 finding

### 바꿀 자리표시자
- [프로젝트 Artifact]
- [domain route]
- [role boundary]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [프로젝트 Artifact]의 여러 Artifact를 [domain route]와 [role boundary]에 연결하고 최대 세 review finding을 분리해 줘. 승인되지 않은 연결은 blocked로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/coop/brief 협동 RPG의 vision, economy, production Artifact를 route·role·gate와 최대 세 review finding으로 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:orchestrate-game-design-project artifact=[프로젝트 Artifact] [domain route]와 [role boundary]를 route·role·gate에 연결하고 finding을 분리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-project
- 스킬 흐름: orchestrate-game-design-project → review-game-design
- 전문 역할: lead-game-designer → production-feasibility-critic → document-quality-editor

### 중간 산출물
- game-design-brief
- decision-change-log
- game-design-review

### 예상 결과물
#### 최소 결과물
- exact route 목록
- Artifact 연결
- role·gate record
- 최대 세 finding

#### 선택 결과물
- image planning handoff
- export hold

#### 확장 결과물
- route별 next owner
- blocked capability 목록

### 파일 구조
- game-design/studio-production/orchestrate-standard/content.md
- game-design/studio-production/orchestrate-standard/evidence.yml
- game-design/studio-production/orchestrate-standard/decisions/README.md
- game-design/studio-production/orchestrate-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-production/orchestrate-standard/content.md
- game-design/studio-production/orchestrate-standard/evidence.yml
- game-design/studio-production/orchestrate-standard/export-manifest.yml
- game-design/studio-production/orchestrate-standard/decisions/README.md

### 도식 바인딩
- ID: st-s09
- SVG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.svg
- PNG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.png
- 대체 텍스트: 여러 게임 기획 Artifact 라우팅 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer와 각 route owner가 Artifact 연결과 gate를 승인·수정·보류하며 orchestration은 모든 output의 완료·성공·출시를 보장하지 않는다.

#### 보류 조건
- Artifact version이 없음
- role boundary가 없음
- 선택 route가 installed skill과 일치하지 않음

#### 안전 경계
모르는 정보와 capability 부재는 미정 또는 blocked로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-standard의 route·role·gate record와 기존 finding을 보존하고 해소된 gate 하나만 반영해 다음 owner handoff부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:orchestrate-game-design-project:advanced -->
## studio:orchestrate-game-design-project:advanced

**역할 검토와 결정 병합을 갖춘 재개 라우팅**

blocked gate만 재개하며 역할별 finding과 disagreement를 named decision owner의 병합 queue로 보존한다.

### 간단 요청 예시
```text
@Game Design Studio 기존 Canonical Artifact의 blocked gate만 재개하고 역할별 finding·disagreement를 named decision owner의 decision queue로 병합해 줘. 미해결 route는 그대로 hold로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-project → review-game-design
- 함께 검토하는 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 이 요청으로 받는 결과
예: `game-design/studio-production/orchestrate-advanced/content.md`에 blocked route receipt, role finding 병합, disagreement queue, resume 조건을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
기존 route가 blocked이고 여러 role finding의 우선순위·disagreement·재개 조건을 정해야 할 때 사용한다.

### 사용하지 않는 경우
사람의 disagreement를 자동 해소하거나 모든 blocked route를 한 번에 다시 실행할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact version
- blocked gate
- role findings
- decision queue
- named decision owner

#### 선택 입력
- 기존 routing record
- capability snapshot
- approved exception

### 바꿀 자리표시자
- [Canonical Artifact]
- [blocked gate]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [blocked gate]만 재개하고 역할별 finding·disagreement를 [decision owner]의 decision queue로 병합해 줘. 미해결 route는 hold로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:orchestrate-game-design-project artifact=game-design/coop/brief 기존 Canonical Artifact를 보존하고 blocked gate만 재개하며 role finding과 disagreement를 decision queue로 병합해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:orchestrate-game-design-project artifact=[Canonical Artifact] [blocked gate]만 재개하고 [decision owner]의 decision queue로 finding을 병합해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-project
- 스킬 흐름: orchestrate-game-design-project → review-game-design
- 전문 역할: lead-game-designer → production-feasibility-critic → ux-accessibility-reviewer

### 중간 산출물
- game-design-brief
- game-design-review
- decision-change-log

### 예상 결과물
#### 최소 결과물
- blocked route receipt
- role finding 병합
- disagreement queue
- resume 조건

#### 선택 결과물
- capability snapshot
- approved exception 참조

#### 확장 결과물
- named decision receipt
- one-route handoff

### 파일 구조
- game-design/studio-production/orchestrate-advanced/content.md
- game-design/studio-production/orchestrate-advanced/evidence.yml
- game-design/studio-production/orchestrate-advanced/decisions/README.md
- game-design/studio-production/orchestrate-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-production/orchestrate-advanced/content.md
- game-design/studio-production/orchestrate-advanced/evidence.yml
- game-design/studio-production/orchestrate-advanced/export-manifest.yml
- game-design/studio-production/orchestrate-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s09
- SVG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.svg
- PNG: guides/assets/game-design-studio/skills/orchestrate-game-design-project.png
- 대체 텍스트: 게임 기획 역할 검토와 결정 병합 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer named decision owner가 finding 병합·disagreement·재개를 승인·수정·보류하며 automation receipt는 사람 승인, 출시 또는 성공을 보장하지 않는다.

#### 보류 조건
- blocked gate가 식별되지 않음
- named decision owner가 없음
- role finding에 direct evidence가 없음

#### 안전 경계
모르는 정보와 미해결 disagreement는 미정 또는 hold로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
orchestrate-advanced의 blocked route receipt와 disagreement queue를 보존하고 사람 결정으로 해소된 gate 하나만 반영해 one-route handoff부터 재개해.
```

</details>
