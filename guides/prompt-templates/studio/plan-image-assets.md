# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:plan-image-assets:beginner -->
## studio:plan-image-assets:beginner

**프롬프트 전용 이미지 자리와 대체 표시 계획**

생성 없이 profile slot 하나의 stable asset ID·alt text·명시적 count·placeholder를 concept-draft 계획으로 고정한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 RPG brief의 design-context-image slot 하나를 prompt-only로 계획해. stable asset ID, count, alt text와 placeholder만 기록하고 생성이나 승인은 하지 마.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets
- 함께 검토하는 역할: art-brief-director

### 이 요청으로 받는 결과
글라이더 조작 설명 옆에 들어갈 바람길 개념도 1개를 `concept-draft`로 계획하고 대체 텍스트 초안을 붙였습니다. 이미지는 생성하지 않았으며 배치와 문구는 담당자 검토가 필요합니다. (ID: studio:plan-image-assets:beginner; 파일: game-design/studio-visual/plan-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
선택된 profile에 맞는 한 개의 이미지 slot을 생성 전에 안전하게 기록할 때 사용한다.

### 사용하지 않는 경우
이미지 bytes를 만들거나 승인 상태를 변경할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- selected quality profile
- profile slot
- stable source section ID
- 명시적 count
- placement
- alt text
- decision owner

#### 선택 입력
- dimensions
- accessibility intent

### 바꿀 자리표시자
- [Canonical Artifact]
- [profile slot]
- [stable source section ID]
- [명시적 count]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [profile slot]을 prompt-only로 계획해. [stable source section ID]에 연결한 [명시적 count]개의 stable asset ID, alt text와 placeholder만 기록하고 생성이나 승인은 하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-image-assets artifact=game-design/coop/brief profile=game-design-brief needs=design-context-image:1 IMAGE_GEN_MODE=prompt-only stable ID, alt text, count와 placeholder만 계획해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-image-assets artifact=[Canonical Artifact] needs=[profile slot] source=[stable source section ID] count=[명시적 count] IMAGE_GEN_MODE=prompt-only stable ID, alt text와 placeholder만 계획해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets
- 전문 역할: art-brief-director

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- profile-slot preflight
- stable asset ID
- 명시적 count
- alt text와 placeholder
- concept-draft 계획

#### 선택 결과물
- dimensions
- accessibility intent

#### 확장 결과물
- assets/image-assets.yml
- assets/prompts/image-prompts.md
- assets/prompts/image-prompts.json

### 파일 구조
- game-design/studio-visual/plan-beginner/content.md
- game-design/studio-visual/plan-beginner/evidence.yml
- game-design/studio-visual/plan-beginner/export-manifest.yml
- game-design/studio-visual/plan-beginner/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/plan-beginner/content.md
- game-design/studio-visual/plan-beginner/evidence.yml
- game-design/studio-visual/plan-beginner/export-manifest.yml
- game-design/studio-visual/plan-beginner/assets/image-assets.yml

### 도식 바인딩
- ID: st-s11
- SVG: guides/assets/game-design-studio/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/plan-image-assets.png
- 대체 텍스트: 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 slot·placement를 승인·수정·보류하며 계획은 생성 또는 document-approved가 아니다.

#### 보류 조건
- profile slot이 없음
- 명시적 count가 미정
- stable source section ID가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
plan-beginner의 stable ID와 placeholder를 보존하고 확정된 profile slot과 count만 반영해 preflight부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:plan-image-assets:standard -->
## studio:plan-image-assets:standard

**고정 식별자(ID)·대체 텍스트·수량을 갖춘 이미지 명세 계획**

여러 profile slot의 stable ID, alt text, count와 preserve/exclude를 reusable prompt package에 분리한다.

### 간단 요청 예시
```text
@Game Design Studio 승인 전 GDD의 required·recommended image slot을 계획해. stable ID, alt, count, preserve/exclude와 Markdown/JSON prompt를 분리하고 미정 count는 placeholder로 남겨.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets
- 함께 검토하는 역할: art-brief-director → ux-accessibility-reviewer

### 이 요청으로 받는 결과
해저 정원 문서에 수질 순환도 1개와 협동 작업 삽화 2개를 배정하고 각각 고정 자산 ID를 붙였습니다. 보존·제외 대상과 대체 텍스트는 편집자가 확인해야 합니다. (ID: studio:plan-image-assets:standard; 파일: game-design/studio-visual/plan-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
선택된 profile의 required·recommended slot을 유한 수량으로 계획할 때 사용한다.

### 사용하지 않는 경우
profile 밖 slot을 발명하거나 provider 호출을 시작할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- quality-profile selection record
- profile slots
- stable source IDs
- slot별 count
- placement와 alt text
- decision owner

#### 선택 입력
- dimensions
- variants
- preserve/exclude

### 바꿀 자리표시자
- [Canonical Artifact]
- [profile slots]
- [stable source IDs]
- [slot별 count]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [profile slots]을 계획해. [stable source IDs]에 연결한 [slot별 count], alt, preserve/exclude와 [decision owner] handoff를 Markdown/JSON prompt로 분리해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-image-assets artifact=game-design/coop/brief profile=game-design-brief needs=design-context-image:1,ui-key-screen:2 stable ID, alt, count와 prompt package를 계획해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-image-assets artifact=[Canonical Artifact] needs=[profile slots] sources=[stable source IDs] counts=[slot별 count] decisionOwner=[decision owner] manifest와 prompt package를 계획해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets
- 전문 역할: art-brief-director → ux-accessibility-reviewer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- slot별 stable asset ID
- alt text
- 명시적 count
- Markdown/JSON prompt
- placeholder 목록

#### 선택 결과물
- preserve/exclude
- variant 수량

#### 확장 결과물
- required·recommended·variant count receipt
- review handoff

### 파일 구조
- game-design/studio-visual/plan-standard/content.md
- game-design/studio-visual/plan-standard/evidence.yml
- game-design/studio-visual/plan-standard/export-manifest.yml
- game-design/studio-visual/plan-standard/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/plan-standard/content.md
- game-design/studio-visual/plan-standard/evidence.yml
- game-design/studio-visual/plan-standard/export-manifest.yml
- game-design/studio-visual/plan-standard/assets/image-assets.yml

### 도식 바인딩
- ID: st-s11
- SVG: guides/assets/game-design-studio/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/plan-image-assets.png
- 대체 텍스트: 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner와 ux-accessibility-reviewer가 count·alt·placement를 승인·수정·보류하며 manifest 계획은 사람 승인이나 생성 결과가 아니다.

#### 보류 조건
- selection record가 없음
- slot별 count가 없음
- alt text가 없음

#### 안전 경계
모르는 수량·identity는 미정과 placeholder로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
plan-standard의 stable ID와 prompt package를 보존하고 새로 확정된 slot별 count와 alt text만 반영해 manifest 검증부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:plan-image-assets:advanced -->
## studio:plan-image-assets:advanced

**프로필 자리·권리 조건·도식 인계를 포함한 자산 계획**

권리 제약과 Skillstead diagram slot을 illustration과 분리해 finite manifest와 visualization handoff로 기록한다.

### 간단 요청 예시
```text
@Game Design Studio profile slot의 finite image manifest와 rights gap을 계획해. 구조 diagram slot은 source mapping·editable SVG·2× PNG QA handoff로 분리하고 생성·승인·게임 리소스 승격은 하지 마.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile → plan-image-assets → visualize-game-design
- 함께 검토하는 역할: art-brief-director → visual-asset-reviewer → lead-game-designer

### 이 요청으로 받는 결과
우주선 수리 절차도는 도식 작업으로 넘기고 승무원 삽화는 별도 자산 자리에 배정했습니다. 참고 사진의 권리와 철회 조건이 비어 있어 두 자산 모두 기획 초안 상태입니다. (ID: studio:plan-image-assets:advanced; 파일: game-design/studio-visual/plan-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
profile slot별 rights gap과 source-mapped diagram handoff를 함께 계획할 때 사용한다.

### 사용하지 않는 경우
Skillstead SVG·PNG를 여기서 생성하거나 plan만으로 game resource를 자동 승격할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- quality-profile selection record
- finite profile slots
- rights constraint
- stable source IDs
- decision owner

#### 선택 입력
- revocation state
- diagram preset
- accessibility intent

### 바꿀 자리표시자
- [Canonical Artifact]
- [finite profile slots]
- [rights constraint]
- [stable source IDs]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [finite profile slots]을 계획해. [rights constraint], [stable source IDs], [decision owner]을 기록하고 diagram slot은 editable SVG·2× PNG QA handoff로 분리해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-image-assets artifact=game-design/coop/system profile=system-specification needs=skillstead-design-flow-diagram:1 mode=required rights=unreviewed diagram handoff와 finite manifest만 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-image-assets artifact=[Canonical Artifact] needs=[finite profile slots] rights=[rights constraint] sources=[stable source IDs] decisionOwner=[decision owner] diagram handoff와 finite manifest만 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: apply-document-quality-profile → plan-image-assets → visualize-game-design
- 전문 역할: art-brief-director → visual-asset-reviewer → lead-game-designer

### 중간 산출물
- system-specification

### 예상 결과물
#### 최소 결과물
- finite slot manifest
- rights·revocation gap
- stable source ID
- Skillstead visualization handoff
- concept-draft 상태

#### 선택 결과물
- diagram preset
- accessibility intent

#### 확장 결과물
- separate illustration·diagram provenance
- named review handoff

### 파일 구조
- game-design/studio-visual/plan-advanced/content.md
- game-design/studio-visual/plan-advanced/evidence.yml
- game-design/studio-visual/plan-advanced/export-manifest.yml
- game-design/studio-visual/plan-advanced/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/plan-advanced/content.md
- game-design/studio-visual/plan-advanced/evidence.yml
- game-design/studio-visual/plan-advanced/export-manifest.yml
- game-design/studio-visual/plan-advanced/assets/image-assets.yml

### 도식 바인딩
- ID: st-s11
- SVG: guides/assets/game-design-studio/skills/plan-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/plan-image-assets.png
- 대체 텍스트: 이미지 자산 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
visual-asset-reviewer owner가 rights gap과 handoff를 승인·수정·보류하며 plan은 document-approved, production-candidate 또는 game resource 승격이 아니다.

#### 보류 조건
- rights constraint가 미정
- finite slot count가 없음
- diagram source mapping이 없음

#### 안전 경계
모르는 rights·revocation 상태는 미정으로 남기고 game resource 자동 승격을 금지한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
plan-advanced의 finite manifest와 rights gap을 보존하고 확인된 source ID나 named owner만 반영해 diagram handoff 이전 단계부터 재개해.
```

</details>
