# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:apply-document-quality-profile:beginner -->
## studio:apply-document-quality-profile:beginner

**게임 기획 결과: 문서 목적과 대상에 맞는 품질 프로필 선택**

짧은 기획 브리프에 필요한 primary profile과 누락 입력을 안전하게 선택한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 섬 복구 게임의 신규 플레이어용 기획 브리프에 맞는 목적, 대상, Markdown 형식을 정리하고 적용할 품질 profile과 빠진 입력을 골라 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile
- 함께 검토하는 역할: document-quality-editor

### 이 요청으로 받는 결과
초안 결과: 문서 품질 프로필에 낡은 우주선을 수리하는 탐사대 맥락을 반영했습니다. 사람의 확인 전까지 값과 결정은 미정입니다. (ID: studio:apply-document-quality-profile:beginner; 파일: game-design/studio-foundations/profile-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
한 Artifact의 목적·대상·형식이 정해졌고 본문 작성 전에 구조 계약이 필요할 때 사용한다.

### 사용하지 않는 경우
본문·이미지·도식을 만들거나 여러 도메인의 실행 순서를 결정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 문서 goal
- audience
- artifact type
- requested format
- template ID
- artifact ID

#### 선택 입력
- platform 가정
- 기존 checklist

### 바꿀 자리표시자
- [artifact ID]
- [template ID]
- [문서 목적]
- [대상 독자]
- [형식]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [문서 목적]의 [대상 독자]용 [형식] Artifact에 맞는 품질 profile과 누락 입력을 선택해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:apply-document-quality-profile artifact=game-design/island/brief template=game-design-brief 신규 플레이어용 협동 섬 복구 게임 브리프의 대상과 Markdown 형식을 기록하고 profile과 누락 입력만 선택해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:apply-document-quality-profile artifact=[artifact ID] template=[template ID] [문서 목적]의 대상과 [형식]을 기록하고 profile과 누락 입력만 선택해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile
- 전문 역할: document-quality-editor

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- 선택한 primary profile
- 누락 입력 목록
- stable checklist

#### 선택 결과물
- platform 가정
- neutral preset 후보

#### 확장 결과물
- requirement manifest
- 선택 이유

### 파일 구조
- game-design/studio-foundations/profile-beginner/content.md
- game-design/studio-foundations/profile-beginner/evidence.yml
- game-design/studio-foundations/profile-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/profile-beginner/content.md
- game-design/studio-foundations/profile-beginner/evidence.yml
- game-design/studio-foundations/profile-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 문서 품질 프로필 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor가 profile 선택을 검토하지만 선택 기록 자체는 문서 승인이나 게임 디자인 승인이 아니다.

#### 보류 조건
- template ID가 없음
- 서로 다른 deliverable에 하나의 primary profile을 공유하려 함

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
기존 profile-beginner selection record를 보존하고 새로 확인된 대상 독자와 형식만 반영해 누락 입력 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:apply-document-quality-profile:standard -->
## studio:apply-document-quality-profile:standard

**게임 기획 결과: Overlay와 preset manifest를 갖춘 품질 프로필 선택**

시스템 명세의 primary profile, additive overlay, neutral preset과 requirement manifest를 일관되게 정한다.

### 간단 요청 예시
```text
@Game Design Studio 라이브 서비스 RPG 스태미나 시스템 명세에 system-feature-specification profile을 고르고 live-service overlay와 호환 preset을 manifest로 정리해 줘. 충돌과 미확정 값은 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → design-game-systems
- 함께 검토하는 역할: document-quality-editor → system-economy-designer

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 문서 품질 프로필 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: studio:apply-document-quality-profile:standard; 파일: game-design/studio-foundations/profile-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
명세 템플릿과 플랫폼·live-service 제약이 알려져 있고 overlay의 호환성을 검토해야 할 때 사용한다.

### 사용하지 않는 경우
unknown override를 강제로 적용하거나 rule/state 자체를 설계할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- system artifact ID
- system-specification template
- audience
- requested format
- known overlay

#### 선택 입력
- neutral preset
- 기존 selection record
- 기존 requirement manifest

### 바꿀 자리표시자
- [시스템 Artifact]
- [overlay ID]
- [preset ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [시스템 Artifact]에 [overlay ID]와 [preset ID]를 검토해 primary profile, additive overlay, requirement manifest를 정리해 줘. 충돌은 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:apply-document-quality-profile artifact=game-design/island/stamina template=system-specification overlayIds=live-service 스태미나 규칙·상태 검토용 checklist와 requirement manifest를 갱신해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:apply-document-quality-profile artifact=[시스템 Artifact] template=system-specification overlayIds=[overlay ID] [preset ID]를 검토하고 manifest와 checklist를 갱신해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile → design-game-systems
- 전문 역할: document-quality-editor → system-economy-designer

### 중간 산출물
- system-specification
- rule-exception-matrix

### 예상 결과물
#### 최소 결과물
- primary profile
- 허용된 overlay 목록
- requirement manifest

#### 선택 결과물
- neutral preset
- profile 차이 설명

#### 확장 결과물
- section/table/diagram/image checklist
- routing handoff record

### 파일 구조
- game-design/studio-foundations/profile-standard/content.md
- game-design/studio-foundations/profile-standard/evidence.yml
- game-design/studio-foundations/profile-standard/decisions/README.md
- game-design/studio-foundations/profile-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/profile-standard/content.md
- game-design/studio-foundations/profile-standard/evidence.yml
- game-design/studio-foundations/profile-standard/export-manifest.yml
- game-design/studio-foundations/profile-standard/decisions/README.md

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 문서 품질 프로필과 시스템 route 흐름

### 사람 검토
#### 승인 경계
document-quality-editor가 additive source의 호환성을 확인하고 system owner가 선택된 route의 설계 범위를 결정한다.

#### 보류 조건
- overlay가 primary profile과 호환되지 않음
- 요청된 preset이 설치되지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
profile-standard의 기존 manifest와 digest-bound selection record를 보존하고 확인된 live-service overlay만 다시 합성해 재개해.
```

</details>
<!-- PROMPT-CARD: studio:apply-document-quality-profile:advanced -->
## studio:apply-document-quality-profile:advanced

**게임 기획 결과: Fallback과 state receipt를 가진 품질 프로필 검토**

profile 충돌을 fail-closed로 분리하고 사람 승인 전까지 state receipt를 보존한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 보스 전투 검토 문서의 profile 충돌을 분리하고 fallback, immutable state receipt, blocked requirement와 사람 승인 대기 지점을 정리해 줘. 근거 없는 값은 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → review-game-design
- 함께 검토하는 역할: document-quality-editor → lead-game-designer → production-feasibility-critic

### 이 요청으로 받는 결과
예시 산출물 조각: 핵심 결과 항목은 눈 덮인 마을을 지키는 초보 수비대에 관한 임시 제안입니다. 근거가 확인되기 전에는 확정하지 않습니다. (ID: studio:apply-document-quality-profile:advanced; 파일: game-design/studio-foundations/profile-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
review Artifact에서 profile 충돌, blocked requirement, evidence 상태와 named decision owner를 함께 다뤄야 할 때 사용한다.

### 사용하지 않는 경우
사람 receipt 없이 document-approved 상태를 주장하거나 호환되지 않는 profile을 자동 병합할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- review artifact ID
- game-design-review template
- 현재 selection record
- decision owner
- 근거 상태

#### 선택 입력
- fallback profile 후보
- blocked requirement 목록
- 기존 state receipt

### 바꿀 자리표시자
- [검토 Artifact]
- [decision owner]
- [fallback profile]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [검토 Artifact]의 profile 충돌을 [fallback profile]로 비교하고 state receipt, blocked requirement, [decision owner] 승인 대기를 정리해 줘. 근거 없는 값은 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:apply-document-quality-profile artifact=game-design/island/review template=game-design-review profile=design-review-decision-log 근거 상태와 named decision owner를 보존하고 profile 충돌과 blocked requirement를 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:apply-document-quality-profile artifact=[검토 Artifact] template=game-design-review profile=[fallback profile] state receipt를 보존하고 [decision owner] 승인을 기다려.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile → review-game-design
- 전문 역할: document-quality-editor → lead-game-designer → production-feasibility-critic

### 중간 산출물
- game-design-review
- decision-change-log

### 예상 결과물
#### 최소 결과물
- fail-closed fallback
- blocked requirement
- immutable state receipt

#### 선택 결과물
- profile conflict matrix
- owner별 검토 질문

#### 확장 결과물
- 승인 가능한 routing record
- document state transition 근거

### 파일 구조
- game-design/studio-foundations/profile-advanced/content.md
- game-design/studio-foundations/profile-advanced/evidence.yml
- game-design/studio-foundations/profile-advanced/decisions/README.md
- game-design/studio-foundations/profile-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/profile-advanced/content.md
- game-design/studio-foundations/profile-advanced/evidence.yml
- game-design/studio-foundations/profile-advanced/export-manifest.yml
- game-design/studio-foundations/profile-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 문서 품질 프로필 fallback과 승인 경계 흐름

### 사람 검토
#### 승인 경계
named decision owner가 fallback과 document-approved 전이를 승인·수정·보류하며 자동화된 state receipt는 승인 receipt가 아니다.

#### 보류 조건
- named decision owner가 없음
- fallback이 설치된 profile과 호환되지 않음
- 승인 receipt가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
profile-advanced의 immutable state receipt와 blocked requirement를 그대로 두고 사람 결정으로 해소된 충돌 하나만 반영해 재개해.
```

</details>
