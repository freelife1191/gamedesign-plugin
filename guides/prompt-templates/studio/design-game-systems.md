# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:design-game-systems:beginner -->
## studio:design-game-systems:beginner

**게임 기획 결과: 규칙과 상태를 정의하는 게임 시스템**

단일 mechanic의 input, rule, state transition, output, failure recovery를 실행 가능한 초안으로 만든다.

### 간단 요청 예시
```text
@Game Design Studio 협동 섬 복구 게임의 나무 수집 규칙을 actor, input, state transition, output, 실패와 recovery로 명세해 줘. 승인 근거가 없는 수치는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-systems
- 함께 검토하는 역할: system-economy-designer → ux-accessibility-reviewer

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 규칙 적용 순서 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: studio:design-game-systems:beginner; 파일: game-design/studio-foundations/systems-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
스태미나·제작처럼 한 시스템의 실행 규칙과 실패 복구를 명확히 해야 할 때 사용한다.

### 사용하지 않는 경우
player promise가 아직 모호하거나 전체 콘텐츠 제작 범위를 정해야 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 목적
- actor
- input
- constraints
- current rules
- authoritative data
- owner

#### 선택 입력
- UI surface
- 기존 spec
- failure expectation

### 바꿀 자리표시자
- [system Artifact]
- [mechanic]
- [actor]
- [failure case]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [mechanic]의 [actor] 규칙을 input, state transition, output, [failure case]와 recovery로 명세해 줘. 승인 근거가 없는 수치는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems artifact=game-design/island/gathering 나무 수집의 input, state transition, output과 failure recovery를 system-specification으로 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems artifact=[system Artifact] [mechanic]의 input, state transition, output과 recovery를 system-specification으로 작성해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems
- 전문 역할: system-economy-designer → ux-accessibility-reviewer

### 중간 산출물
- system-specification

### 예상 결과물
#### 최소 결과물
- ordered rule
- state transition
- failure recovery
- authoritative data note

#### 선택 결과물
- UI feedback
- test case

#### 확장 결과물
- rule ID
- validation task

### 파일 구조
- game-design/studio-foundations/systems-beginner/content.md
- game-design/studio-foundations/systems-beginner/evidence.yml
- game-design/studio-foundations/systems-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/systems-beginner/content.md
- game-design/studio-foundations/systems-beginner/evidence.yml
- game-design/studio-foundations/systems-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s05
- SVG: guides/assets/game-design-studio/skills/design-game-systems.svg
- PNG: guides/assets/game-design-studio/skills/design-game-systems.png
- 대체 텍스트: 게임 시스템 직접 호출 흐름

### 사람 검토
#### 승인 경계
system owner가 rule과 state transition을 결정하고 engineering handoff는 별도 구현 승인으로 남긴다.

#### 보류 조건
- authoritative data가 없음
- failure recovery가 정의되지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
systems-beginner의 rule과 transition을 보존하고 확인된 authoritative data만 연결해 실패 복구 섹션부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-systems:standard -->
## studio:design-game-systems:standard

**게임 기획 결과: 예외와 데이터를 연결하는 게임 시스템**

concurrency exception, rule precedence, authoritative state와 test case를 rule·state·exception·data 계약으로 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 두 플레이어가 같은 수리 재료를 동시에 쓰는 상황의 rule precedence, authoritative state, exception, recovery와 test case를 데이터 ID에 연결해 줘. 검증되지 않은 값은 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-systems → review-game-design
- 함께 검토하는 역할: system-economy-designer → ux-accessibility-reviewer → lead-game-designer

### 이 요청으로 받는 결과
예시 산출물 조각: 핵심 결과 항목은 눈 덮인 마을을 지키는 초보 수비대에 관한 임시 제안입니다. 근거가 확인되기 전에는 확정하지 않습니다. (ID: studio:design-game-systems:standard; 파일: game-design/studio-foundations/systems-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
동시 행동, rule precedence, state authority와 검증 가능한 exception 처리까지 정해야 할 때 사용한다.

### 사용하지 않는 경우
balance 근거 없는 확률을 확정하거나 cross-system economy를 단일 mechanic처럼 다룰 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- rule set
- state model
- concurrency case
- authoritative data
- owner

#### 선택 입력
- network model
- UI feedback
- balance evidence

### 바꿀 자리표시자
- [system Artifact]
- [rule set]
- [concurrency case]
- [data ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [rule set]의 [concurrency case]를 rule precedence, authoritative state, exception, recovery와 [data ID]에 연결해 줘. 검증되지 않은 값은 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems artifact=game-design/island/shared-material 동시 수리의 concurrency exception, rule precedence, authoritative state와 test case를 rule-exception-matrix에 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems artifact=[system Artifact] [concurrency case]의 precedence와 exception을 rule-exception-matrix와 [data ID]에 연결해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems → review-game-design
- 전문 역할: system-economy-designer → ux-accessibility-reviewer → lead-game-designer

### 중간 산출물
- system-specification
- rule-exception-matrix
- data-schema-table-contract

### 예상 결과물
#### 최소 결과물
- rule precedence
- exception matrix
- authoritative state
- test case

#### 선택 결과물
- UI feedback mapping
- network assumption

#### 확장 결과물
- PK/FK contract
- review question

### 파일 구조
- game-design/studio-foundations/systems-standard/content.md
- game-design/studio-foundations/systems-standard/evidence.yml
- game-design/studio-foundations/systems-standard/decisions/README.md
- game-design/studio-foundations/systems-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/systems-standard/content.md
- game-design/studio-foundations/systems-standard/evidence.yml
- game-design/studio-foundations/systems-standard/export-manifest.yml
- game-design/studio-foundations/systems-standard/decisions/README.md

### 도식 바인딩
- ID: st-s05
- SVG: guides/assets/game-design-studio/skills/design-game-systems.svg
- PNG: guides/assets/game-design-studio/skills/design-game-systems.png
- 대체 텍스트: 게임 시스템 rule·state·exception 흐름

### 사람 검토
#### 승인 경계
system owner가 exception precedence와 authoritative data를 승인·수정·보류하고 UX reviewer는 feedback 영향을 검토한다.

#### 보류 조건
- precedence가 결정되지 않음
- authoritative state와 UI state가 다름

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
systems-standard의 exception matrix를 보존하고 새로 확인된 concurrency evidence만 연결해 미해결 precedence부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-systems:advanced -->
## studio:design-game-systems:advanced

**게임 기획 결과: 상호 시스템 반례와 engineering handoff**

여러 시스템의 상호작용, 반례, runtime mapping과 engineering 검토 경계를 명시한다.

### 간단 요청 예시
```text
@Game Design Studio 공동 창고와 제작 대기열이 동시에 재료를 소비하는 반례를 분석해 rule·state·exception·data mapping과 engineering 검토 질문으로 정리해 줘. unknown schema는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-systems → review-game-design
- 함께 검토하는 역할: system-economy-designer → lead-game-designer → production-feasibility-critic

### 이 요청으로 받는 결과
가상 결과 조각: 상호 시스템: 등대섬을 함께 복구하는 두 명의 탐험가 기준의 검토 전 초안입니다. 확인할 점: 근거 연결 여부. (ID: studio:design-game-systems:advanced; 파일: game-design/studio-foundations/systems-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
제작·인벤토리·동기화 등 서로 다른 system의 authority와 data contract가 충돌할 수 있을 때 사용한다.

### 사용하지 않는 경우
unknown schema를 완성된 runtime mapping으로 선언하거나 engineering 구현 승인을 자동으로 내릴 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- interacting systems
- counterexample
- authoritative data
- runtime constraint
- engineering owner

#### 선택 입력
- abuse case
- existing schema
- review finding

### 바꿀 자리표시자
- [system Artifact]
- [system A]
- [system B]
- [engineering owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [system A]와 [system B]의 반례를 rule·state·exception·data mapping과 [engineering owner] 검토 질문으로 정리해 줘. unknown schema는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems artifact=game-design/island/shared-inventory 확인된 runtime mapping만 data-schema-table-contract에 넣고 공동 창고·제작 대기열의 unknown schema는 provisional로 보존해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems artifact=[system Artifact] [system A]와 [system B]의 확인된 mapping만 data-schema-table-contract에 넣고 [engineering owner] 검토를 기다려.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems → review-game-design
- 전문 역할: system-economy-designer → lead-game-designer → production-feasibility-critic

### 중간 산출물
- system-specification
- rule-exception-matrix
- data-schema-table-contract

### 예상 결과물
#### 최소 결과물
- 상호 시스템 counterexample
- provisional schema
- engineering question

#### 선택 결과물
- abuse case
- runtime constraint

#### 확장 결과물
- implementation handoff boundary
- review blocker

### 파일 구조
- game-design/studio-foundations/systems-advanced/content.md
- game-design/studio-foundations/systems-advanced/evidence.yml
- game-design/studio-foundations/systems-advanced/decisions/README.md
- game-design/studio-foundations/systems-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/systems-advanced/content.md
- game-design/studio-foundations/systems-advanced/evidence.yml
- game-design/studio-foundations/systems-advanced/export-manifest.yml
- game-design/studio-foundations/systems-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s05
- SVG: guides/assets/game-design-studio/skills/design-game-systems.svg
- PNG: guides/assets/game-design-studio/skills/design-game-systems.png
- 대체 텍스트: 게임 시스템 상호작용과 engineering handoff 흐름

### 사람 검토
#### 승인 경계
engineering owner가 runtime feasibility와 implementation을 결정하며 시스템 카탈로그 항목은 engineering 승인이나 schema 생성 권한을 갖지 않는다.

#### 보류 조건
- counterexample의 authority가 없음
- unknown schema가 구현 계약으로 오인됨
- engineering owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
systems-advanced의 counterexample과 provisional schema를 보존하고 engineering owner가 확인한 runtime mapping만 추가해 handoff 질문부터 재개해.
```

</details>
