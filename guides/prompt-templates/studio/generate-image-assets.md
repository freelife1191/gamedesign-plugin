# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:generate-image-assets:beginner -->
## studio:generate-image-assets:beginner

**사용자 선택 stable asset 하나 생성**

select mode의 실제 user receipt가 지정한 stable asset ID 하나만 생성 경로에 넣고 concept-draft provenance를 보존한다.

### 간단 요청 예시
```text
@Game Design Studio 실제 user selection receipt의 hero-keyart-01만 select mode로 생성해. provider decision과 digest를 분리하고 결과는 concept-draft로 유지해.
```

### 짧은 흐름
- 작업 순서: generate-image-assets → review-image-assets
- 함께 검토하는 역할: visual-asset-reviewer

### 이 요청으로 받는 결과
예: `game-design/studio-visual/generate-beginner/content.md`에 selected stable asset ID, redacted provider decision, per-asset result, concept-draft provenance을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
실제 사용자가 선택한 stable asset ID 하나와 immutable selection receipt가 있을 때 사용한다.

### 사용하지 않는 경우
label·순번·agent 추측으로 asset을 고르거나 document-approved를 주장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- compiled prompt package
- IMAGE_GEN_MODE=select
- actual user selection receipt
- ordered stable asset ID
- capability snapshot

#### 선택 입력
- redacted configuration
- existing failure state

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [selection event ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]에서 selection event [selection event ID]가 고른 [stable asset ID]만 select mode로 생성해. 결과는 concept-draft와 provenance로 유지해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:generate-image-assets artifact=game-design/coop/brief mode=select assetIds=hero-keyart-01 selectionEvent=host-event-17 selected stable ID 하나만 concept-draft로 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:generate-image-assets artifact=[Canonical Artifact] mode=select assetIds=[stable asset ID] selectionEvent=[selection event ID] 선택된 stable ID 하나만 concept-draft로 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: generate-image-assets → review-image-assets
- 전문 역할: visual-asset-reviewer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- selected stable asset ID
- redacted provider decision
- per-asset result
- concept-draft provenance

#### 선택 결과물
- output digest
- failed state

#### 확장 결과물
- named human review handoff

### 파일 구조
- game-design/studio-visual/generate-beginner/content.md
- game-design/studio-visual/generate-beginner/evidence.yml
- game-design/studio-visual/generate-beginner/export-manifest.yml
- game-design/studio-visual/generate-beginner/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/generate-beginner/content.md
- game-design/studio-visual/generate-beginner/evidence.yml
- game-design/studio-visual/generate-beginner/export-manifest.yml
- game-design/studio-visual/generate-beginner/assets/image-assets.yml

### 도식 바인딩
- ID: st-s08
- SVG: guides/assets/game-design-studio/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/generate-image-assets.png
- 대체 텍스트: 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
visual-asset-reviewer owner가 생성 결과의 검토 handoff를 승인·수정·보류하며 생성은 승인이 아니고 상태는 concept-draft에 머문다.

#### 보류 조건
- actual user selection receipt가 없음
- stable asset ID가 manifest에 없음
- mode가 select가 아님

#### 안전 경계
모르는 provider 결과는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
generate-beginner의 selection receipt와 concept-draft provenance를 보존하고 같은 stable asset ID의 명시된 실패 상태부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:generate-image-assets:standard -->
## studio:generate-image-assets:standard

**required mode receipt와 no-key capability 경계**

required mode의 declared finite jobs만 처리하고 key가 없는 host capability unavailable 경로에서는 호출 없이 prompt와 placeholder를 보존한다.

### 간단 요청 예시
```text
@Game Design Studio required finite assets만 처리해. key가 없고 host capability가 available이면 해당 jobs만 사용하고 unknown 또는 unavailable이면 호출하지 말고 prompt와 placeholder를 보존해.
```

### 짧은 흐름
- 작업 순서: generate-image-assets → review-image-assets
- 함께 검토하는 역할: visual-asset-reviewer → art-brief-director

### 이 요청으로 받는 결과
예: `game-design/studio-visual/generate-standard/content.md`에 required finite job selection, capability decision, unavailable 또는 per-asset result, preserved prompts and placeholders을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
manifest의 required finite jobs와 redacted capability snapshot이 있을 때 사용한다.

### 사용하지 않는 경우
선언 밖 variant를 만들거나 host capability unknown·unavailable에서 generation call을 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- compiled prompt package
- IMAGE_GEN_MODE=required
- redacted configuration
- capability snapshot
- declared required stable IDs

#### 선택 입력
- partial success receipt
- resume target

### 바꿀 자리표시자
- [Canonical Artifact]
- [declared required stable IDs]
- [capability snapshot]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [declared required stable IDs]를 required mode로 처리해. [capability snapshot]에서 key가 없고 host가 available일 때만 jobs를 사용하고 unknown 또는 unavailable이면 호출하지 말고 prompt와 placeholder를 보존해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:generate-image-assets artifact=game-design/coop/brief mode=required capability=unavailable required declared jobs는 unavailable로 두고 prompt와 placeholder를 보존해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:generate-image-assets artifact=[Canonical Artifact] mode=required assetIds=[declared required stable IDs] capability=[capability snapshot] key가 없고 host가 available일 때만 jobs를 사용하고 아니면 호출 없이 보존해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: generate-image-assets → review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- required finite job selection
- capability decision
- unavailable 또는 per-asset result
- preserved prompts and placeholders

#### 선택 결과물
- partial success state
- resumable handoff

#### 확장 결과물
- redacted no-key receipt
- concept-draft provenance

### 파일 구조
- game-design/studio-visual/generate-standard/content.md
- game-design/studio-visual/generate-standard/evidence.yml
- game-design/studio-visual/generate-standard/export-manifest.yml
- game-design/studio-visual/generate-standard/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/generate-standard/content.md
- game-design/studio-visual/generate-standard/evidence.yml
- game-design/studio-visual/generate-standard/export-manifest.yml
- game-design/studio-visual/generate-standard/assets/image-assets.yml

### 도식 바인딩
- ID: st-s08
- SVG: guides/assets/game-design-studio/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/generate-image-assets.png
- 대체 텍스트: 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
visual-asset-reviewer owner가 provider result와 review handoff를 승인·수정·보류하며 unavailable·생성 결과는 document-approved가 아니다.

#### 보류 조건
- required stable ID가 선언되지 않음
- capability snapshot이 없음
- manifest validation 실패

#### 안전 경계
모르는 host capability는 미정으로 남기고 no-key unknown 또는 unavailable에서는 호출하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
generate-standard의 prompt·placeholder와 unavailable receipt를 보존하고 available로 바뀐 capability 또는 실패 stable ID만 반영해 해당 job부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:generate-image-assets:advanced -->
## studio:generate-image-assets:advanced

**all mode OpenAI-only failure와 provenance 분리**

all mode의 declared required·recommended·variant jobs만 실행하고 API key가 있으면 OpenAI only failure를 Codex fallback 없이 provenance에 남긴다.

### 간단 요청 예시
```text
@Game Design Studio all mode에서 declared required·recommended·variant jobs만 처리해. OPENAI_API_KEY가 있으면 OpenAI only로 시도하고 auth·quota·policy·network 실패 후 Codex fallback은 금지하며 provenance를 분리해.
```

### 짧은 흐름
- 작업 순서: generate-image-assets → review-image-assets
- 함께 검토하는 역할: art-brief-director → visual-asset-reviewer

### 이 요청으로 받는 결과
예: `game-design/studio-visual/generate-advanced/content.md`에 all declared finite job list, OpenAI only or host decision, per-asset provenance, explicit failure state, concept-draft result을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
all mode로 manifest에 이미 선언된 finite jobs의 provider 결과를 asset별로 기록할 때 사용한다.

### 사용하지 않는 경우
API key가 있을 때 다른 provider로 fallback하거나 선언되지 않은 asset을 만들 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- compiled prompt package
- IMAGE_GEN_MODE=all
- redacted provider configuration
- capability snapshot
- declared finite jobs

#### 선택 입력
- partial failure state
- provenance receipt

### 바꿀 자리표시자
- [Canonical Artifact]
- [declared finite jobs]
- [provider failure state]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [declared finite jobs]만 all mode로 처리해. [provider failure state]를 asset별 provenance로 보존하고 key가 있으면 OpenAI only이며 실패 후 Codex fallback은 금지해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:generate-image-assets artifact=game-design/coop/brief mode=all declared=required,recommended,variant provider=OpenAI OpenAI only failure를 보존하고 fallback 없이 provenance를 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:generate-image-assets artifact=[Canonical Artifact] mode=all assetIds=[declared finite jobs] failureState=[provider failure state] OpenAI only failure를 보존하고 Codex fallback 없이 provenance를 분리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: generate-image-assets → review-image-assets
- 전문 역할: art-brief-director → visual-asset-reviewer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- all declared finite job list
- OpenAI only or host decision
- per-asset provenance
- explicit failure state
- concept-draft result

#### 선택 결과물
- partial successes
- prompt digest

#### 확장 결과물
- named human review handoff
- resumable same-provider retry

### 파일 구조
- game-design/studio-visual/generate-advanced/content.md
- game-design/studio-visual/generate-advanced/evidence.yml
- game-design/studio-visual/generate-advanced/export-manifest.yml
- game-design/studio-visual/generate-advanced/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/generate-advanced/content.md
- game-design/studio-visual/generate-advanced/evidence.yml
- game-design/studio-visual/generate-advanced/export-manifest.yml
- game-design/studio-visual/generate-advanced/assets/image-assets.yml

### 도식 바인딩
- ID: st-s08
- SVG: guides/assets/game-design-studio/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/generate-image-assets.png
- 대체 텍스트: 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
visual-asset-reviewer owner가 provenance와 failure handoff를 승인·수정·보류하며 provider 성공은 document-approved나 production-candidate가 아니다.

#### 보류 조건
- declared finite job이 없음
- provider policy가 불명확함
- manifest validation 실패

#### 안전 경계
기본 IMAGE_MODEL은 gpt-image-2, IMAGE_QUALITY는 low이며 실제 credential 값은 미정으로 다루고 노출하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
generate-advanced의 successful concept-draft와 provider failure provenance를 보존하고 같은 provider 정책에서 failed stable ID만 재개해.
```

</details>
