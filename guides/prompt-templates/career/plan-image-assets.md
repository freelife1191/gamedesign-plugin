# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:plan-image-assets:beginner -->
## career:plan-image-assets:beginner

**게임 기획 결과: 포트폴리오 placeholder 이미지 슬롯 계획**

생성 없이 포트폴리오 사례의 placeholder 이미지 슬롯, stable asset ID, count와 alt text를 concept-draft로 기록한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [source section ID], [명시적 count]를 사용해 포트폴리오 placeholder 이미지 슬롯 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets
- 함께 검토하는 역할: art-brief-director

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 내보내기 전 점검 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: career:plan-image-assets:beginner; 파일: career/visual/plan-image-assets/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
포트폴리오 placeholder 이미지 슬롯 계획에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [profile slot]
- [source section ID]
- [명시적 count]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [profile slot]
- [source section ID]
- [명시적 count]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [profile slot], [source section ID], [명시적 count]를 사용해 포트폴리오 placeholder 이미지 슬롯 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 완성 예시
```text
$game-design-career:plan-image-assets artifact=career/sample-artifact inputs="sample-input, [source section ID], [명시적 count]" 포트폴리오 placeholder 이미지 슬롯 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:plan-image-assets artifact=[Canonical Artifact] inputs="[profile slot], [source section ID], [명시적 count]" 포트폴리오 placeholder 이미지 슬롯 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets
- 전문 역할: art-brief-director

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- profile-slot preflight
- stable asset ID·count·placeholder
- alt text·rights/attribution handoff
- concept-draft plan

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/plan-image-assets/beginner/content.md
- career/visual/plan-image-assets/beginner/evidence.yml
- career/visual/plan-image-assets/beginner/export-manifest.yml
- career/visual/plan-image-assets/beginner/assets/README.md

### 읽는 순서
- career/visual/plan-image-assets/beginner/content.md
- career/visual/plan-image-assets/beginner/evidence.yml
- career/visual/plan-image-assets/beginner/export-manifest.yml
- career/visual/plan-image-assets/beginner/assets/README.md

### 도식 바인딩
- ID: ca-s07
- SVG: guides/assets/game-design-career/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-career/skills/plan-image-assets.png
- 대체 텍스트: Career 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
plan-image-assets/beginner의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:plan-image-assets:standard -->
## career:plan-image-assets:standard

**게임 기획 결과: proof 이미지·alt·권리 manifest 계획**

proof 이미지의 source·attribution·rights 상태, alt text와 readability 목표를 prompt package와 분리해 기록한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [source IDs], [rights owner]를 사용해 proof 이미지·alt·권리 manifest 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets
- 함께 검토하는 역할: art-brief-director

### 이 요청으로 받는 결과
예시 산출물 조각: 내보내기 전 점검 항목은 눈 덮인 마을을 지키는 초보 수비대에 관한 임시 제안입니다. 근거가 확인되기 전에는 확정하지 않습니다. (ID: career:plan-image-assets:standard; 파일: career/visual/plan-image-assets/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
proof 이미지·alt·권리 manifest 계획에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [profile slots]
- [source IDs]
- [rights owner]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [profile slots]
- [source IDs]
- [rights owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [profile slots], [source IDs], [rights owner]를 사용해 proof 이미지·alt·권리 manifest 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 완성 예시
```text
$game-design-career:plan-image-assets artifact=career/sample-artifact inputs="sample-input, [source IDs], [rights owner]" proof 이미지·alt·권리 manifest 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:plan-image-assets artifact=[Canonical Artifact] inputs="[profile slots], [source IDs], [rights owner]" proof 이미지·alt·권리 manifest 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets
- 전문 역할: art-brief-director

### 중간 산출물
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- profile-slot preflight
- stable asset ID·count·placeholder
- alt text·rights/attribution handoff
- concept-draft plan

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/plan-image-assets/standard/content.md
- career/visual/plan-image-assets/standard/evidence.yml
- career/visual/plan-image-assets/standard/export-manifest.yml
- career/visual/plan-image-assets/standard/assets/README.md

### 읽는 순서
- career/visual/plan-image-assets/standard/content.md
- career/visual/plan-image-assets/standard/evidence.yml
- career/visual/plan-image-assets/standard/export-manifest.yml
- career/visual/plan-image-assets/standard/assets/README.md

### 도식 바인딩
- ID: ca-s07
- SVG: guides/assets/game-design-career/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-career/skills/plan-image-assets.png
- 대체 텍스트: Career 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
plan-image-assets/standard의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:plan-image-assets:advanced -->
## career:plan-image-assets:advanced

**게임 기획 결과: profile 슬롯과 presentation handoff 계획**

profile 슬롯, presentation placement, 권리·privacy hold와 named human reviewer evidence 요청을 가진 handoff를 계획한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [decision owner], [reviewer evidence path]를 사용해 profile 슬롯과 presentation handoff 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets → review-image-assets
- 함께 검토하는 역할: art-brief-director

### 이 요청으로 받는 결과
가상 결과 조각: 내보내기 전 점검: 등대섬을 함께 복구하는 두 명의 탐험가 기준의 검토 전 초안입니다. 확인할 점: 근거 연결 여부. (ID: career:plan-image-assets:advanced; 파일: career/visual/plan-image-assets/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
profile 슬롯과 presentation handoff 계획에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [presentation slot]
- [decision owner]
- [reviewer evidence path]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [presentation slot]
- [decision owner]
- [reviewer evidence path]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [presentation slot], [decision owner], [reviewer evidence path]를 사용해 profile 슬롯과 presentation handoff 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 완성 예시
```text
$game-design-career:plan-image-assets artifact=career/sample-artifact inputs="sample-input, [decision owner], [reviewer evidence path]" profile 슬롯과 presentation handoff 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:plan-image-assets artifact=[Canonical Artifact] inputs="[presentation slot], [decision owner], [reviewer evidence path]" profile 슬롯과 presentation handoff 계획를 수행해. prompt와 placeholder와 manifest, generation handoff만 준비하고 provider/image generation 호출 0회다. provider 전달은 generate-image-assets handoff 뒤에만 가능하다. 계획은 concept-draft만 만들며 image bytes, portfolio publication, document-approved를 만들지 않는다. IMAGE_GEN_MODE=prompt-only.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets → review-image-assets
- 전문 역할: art-brief-director

### 중간 산출물
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- profile-slot preflight
- stable asset ID·count·placeholder
- alt text·rights/attribution handoff
- concept-draft plan

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/plan-image-assets/advanced/content.md
- career/visual/plan-image-assets/advanced/evidence.yml
- career/visual/plan-image-assets/advanced/export-manifest.yml
- career/visual/plan-image-assets/advanced/assets/README.md

### 읽는 순서
- career/visual/plan-image-assets/advanced/content.md
- career/visual/plan-image-assets/advanced/evidence.yml
- career/visual/plan-image-assets/advanced/export-manifest.yml
- career/visual/plan-image-assets/advanced/assets/README.md

### 도식 바인딩
- ID: ca-s07
- SVG: guides/assets/game-design-career/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-career/skills/plan-image-assets.png
- 대체 텍스트: Career 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
plan-image-assets/advanced의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
