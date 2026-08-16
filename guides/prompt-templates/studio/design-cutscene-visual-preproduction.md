# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:design-cutscene-visual-preproduction:beginner -->
## studio:design-cutscene-visual-preproduction:beginner

**생성 전 컷씬 개요와 장면 박자 고정**

컷씬 목적, 플레이어 상태, beat와 조작 반환 지점을 prompt-only 패키지에 고정한다.

### 간단 요청 예시
```text
@Game Design Studio 오프닝 컷씬의 brief와 beat만 작성해. 플레이어 상태와 조작 반환 지점을 기록하고 이미지는 생성하지 마.
```

### 짧은 흐름
- 작업 순서: design-cutscene-visual-preproduction
- 함께 검토하는 역할: content-narrative-designer → lead-game-designer

### 이 요청으로 받는 결과
오프닝 컷씬의 조작 반환은 등대 점화 직후로 잡았고, 두 번째 beat의 감정 전환은 담당자 확인이 남아 있습니다. 이미지와 승인 receipt는 만들지 않았습니다. (ID: studio:design-cutscene-visual-preproduction:beginner; 파일: game-design/studio-cutscene/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
컷씬 이미지나 비용을 논의하기 전에 장면 목적과 감정 변화를 짧은 brief로 합의할 때 사용한다.

### 사용하지 않는 경우
이미지를 만들거나 승인·receipt를 추정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 컷씬 목적
- player state
- beat
- 조작 반환 지점
- decision owner

#### 선택 입력
- 대사
- 참고 작품
- 자막 언어

### 바꿀 자리표시자
- [컷씬 목적]
- [player state]
- [beat]
- [decision owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [컷씬 목적]의 [player state]와 [beat]를 brief로 정리해. [decision owner] 검토 전에는 이미지나 승인을 만들지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=game-design/island/opening mode=prompt-only 오프닝 컷씬의 brief와 beat만 작성하고 provider는 호출하지 마.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=[컷씬 목적] mode=prompt-only [player state]와 [beat]를 기록하고 provider는 호출하지 마.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-cutscene-visual-preproduction
- 스킬 흐름: design-cutscene-visual-preproduction
- 전문 역할: content-narrative-designer → lead-game-designer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- cutscene brief
- beat sheet
- 조작 반환 지점
- 미정 입력 목록

#### 선택 결과물
- 대사 초안
- 자막 언어

#### 확장 결과물
- shot list
- continuity bible

### 파일 구조
- game-design/studio-cutscene/beginner/content.md
- game-design/studio-cutscene/beginner/evidence.yml
- game-design/studio-cutscene/beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-cutscene/beginner/content.md
- game-design/studio-cutscene/beginner/evidence.yml
- game-design/studio-cutscene/beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s16
- SVG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.svg
- PNG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.png
- 대체 텍스트: 컷씬 장면·이미지 사전 설계 흐름

### 사람 검토
#### 승인 경계
content-narrative-designer와 lead-game-designer가 beat와 조작 반환을 검토하며 이 기록은 이미지 승인이나 문서 승인이 아니다.

#### 보류 조건
- 컷씬 목적이 없음
- player state가 없음
- decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
기존 cutscene brief를 보존하고 새로 확인된 player state와 beat만 반영해 미정 입력 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-cutscene-visual-preproduction:standard -->
## studio:design-cutscene-visual-preproduction:standard

**컷씬 장면·연속성·마스터 프롬프트 패키지**

인물·배경·소품의 continuity 조건과 shot별 마스터 프롬프트를 생성 없이 reusable package로 나눈다.

### 간단 요청 예시
```text
@Game Design Studio 컷씬의 shot list와 continuity bible, style/reference master 프롬프트만 작성해. 인물·배경·소품 조건을 stable ID로 연결하고 이미지는 생성하지 마.
```

### 짧은 흐름
- 작업 순서: design-cutscene-visual-preproduction → plan-image-assets
- 함께 검토하는 역할: content-narrative-designer → art-brief-director → lead-game-designer

### 이 요청으로 받는 결과
세 shot의 인물 의상과 등대 내부 조명을 continuity bible에 고정하고 style/reference master 프롬프트를 분리했습니다. reference hash와 이미지 bytes는 아직 없습니다. (ID: studio:design-cutscene-visual-preproduction:standard; 파일: game-design/studio-cutscene/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
컷씬의 shot 수와 시각 연속성 조건이 알려져 있어 마스터 프롬프트 패키지를 검토할 때 사용한다.

### 사용하지 않는 경우
reference hash를 발명하거나 provider 호출을 시작할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 컷씬 brief
- shot list
- continuity bible
- rights 상태
- model
- quality
- size
- decision owner

#### 선택 입력
- 참고 이미지
- camera 참고
- lighting 참고

### 바꿀 자리표시자
- [컷씬 brief]
- [shot list]
- [continuity bible]
- [model]
- [quality]
- [size]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [컷씬 brief]의 [shot list]와 [continuity bible]을 바탕으로 [model] [quality] [size]용 마스터 프롬프트 패키지만 작성해. provider는 호출하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=game-design/island/opening mode=prompt-only style-master와 reference-master prompt, stable ID, continuity 조건만 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=[컷씬 brief] mode=prompt-only shots=[shot list] continuity=[continuity bible] model=[model] quality=[quality] size=[size] prompt package만 작성해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-cutscene-visual-preproduction
- 스킬 흐름: design-cutscene-visual-preproduction → plan-image-assets
- 전문 역할: content-narrative-designer → art-brief-director → lead-game-designer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- shot list
- continuity bible
- style master prompt
- reference master prompt
- stable ID

#### 선택 결과물
- camera reference
- lighting reference

#### 확장 결과물
- assets/image-assets.yml
- assets/prompts/image-prompts.md
- assets/prompts/image-prompts.json

### 파일 구조
- game-design/studio-cutscene/standard/content.md
- game-design/studio-cutscene/standard/evidence.yml
- game-design/studio-cutscene/standard/assets/prompts/image-prompts.md
- game-design/studio-cutscene/standard/assets/prompts/image-prompts.json

### 읽는 순서
- game-design/studio-cutscene/standard/content.md
- game-design/studio-cutscene/standard/evidence.yml
- game-design/studio-cutscene/standard/assets/prompts/image-prompts.md
- game-design/studio-cutscene/standard/assets/prompts/image-prompts.json

### 도식 바인딩
- ID: st-s16
- SVG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.svg
- PNG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.png
- 대체 텍스트: 컷씬 장면·이미지 사전 설계 흐름

### 사람 검토
#### 승인 경계
art-brief-director가 continuity 조건과 권리 상태를 검토하지만 prompt package는 생성 승인이나 production candidacy가 아니다.

#### 보류 조건
- shot list가 없음
- continuity bible이 없음
- rights 상태가 미확정

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
기존 stable ID와 prompt package를 보존하고 확정된 shot과 continuity 조건만 반영해 prompt-only 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-cutscene-visual-preproduction:advanced -->
## studio:design-cutscene-visual-preproduction:advanced

**컷씬 4단계 비용·승인·연속성 관문**

style-master, reference-masters, keyframes, storyboard의 순차 비용·승인·재시도 경계를 검증할 수 있는 계획으로 정리한다.

### 간단 요청 예시
```text
@Game Design Studio 컷씬의 style-master 비용과 승인 계획을 계산해. 한글이 없는 프레임은 host image_gen 우선, 유료 기본은 low, 선택한 master만 medium으로 두고 high는 사용하지 마. count, model, quality, size, USD min/expected/max, finite cap, retryReserve, pricing time, costStatus를 공개하고 이미지는 생성하지 마.
```

### 짧은 흐름
- 작업 순서: design-cutscene-visual-preproduction → plan-image-assets → generate-image-assets → review-image-assets
- 함께 검토하는 역할: art-brief-director → lead-game-designer

### 이 요청으로 받는 결과
style-master 1건의 비용 범위와 cap, retryReserve를 공개했고 costStatus가 unavailable이면 provider 호출 0회로 멈추도록 기록했습니다. style-master는 current estimate와 named approval 뒤에 dispatch하며, keyframes와 storyboard는 같은 조건에 선행 wave 완료가 더 필요합니다. (ID: studio:design-cutscene-visual-preproduction:advanced; 파일: game-design/studio-cutscene/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
현재 컷씬 prompt package에 유한한 비용 cap과 이름 있는 실시간 승인 정보를 붙여 각 wave의 dispatch 조건을 검토할 때 사용한다. 견적 초안은 미리 만들 수 있지만 paid dispatch는 current estimate와 named approval이 필요하고, style-master 뒤의 wave에는 선행 wave 완료도 필요하다.

### 사용하지 않는 경우
가격을 0으로 추정하거나 과거·포괄 승인을 다음 wave에 재사용할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- current wave
- count
- provider
- model
- quality
- size
- USD min/expected/max
- finite cap
- retryReserve
- pricing time
- costStatus
- named approval

#### 선택 입력
- 기존 receipt
- retryable stable ID
- continuity finding

### 바꿀 자리표시자
- [current wave]
- [count]
- [model]
- [quality]
- [size]
- [finite cap]
- [named approval]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [current wave]의 [count], [model], [quality], [size], USD 범위와 [finite cap]을 비용 계획으로 공개해. 한글 픽셀 텍스트는 gpt-image-2, 그 밖에는 host 우선·low 기본·medium 선택·high 예외 정책을 적용하고 [named approval] 전에는 provider를 호출하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=game-design/island/opening mode=estimate-only wave=style-master count=1 provider=codex-first quality=medium size=1536x1024 capUsd=20 비용과 named approval 요구만 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-cutscene-visual-preproduction artifact=[current wave] mode=estimate-only count=[count] provider=[provider] model=[model] quality=[quality] size=[size] capUsd=[finite cap] namedApproval=[named approval] host 우선·low 기본·medium 선택·high 예외 비용 계획만 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-cutscene-visual-preproduction
- 스킬 흐름: design-cutscene-visual-preproduction → plan-image-assets → generate-image-assets → review-image-assets
- 전문 역할: art-brief-director → lead-game-designer

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- 4 wave schedule
- USD min/expected/max
- finite cap
- retryReserve
- named approval boundary
- continuity gate

#### 선택 결과물
- retryable stable ID
- continuity finding

#### 확장 결과물
- assets/image-assets.yml
- assets/receipts/image-generation-<asset-id>-<attempt-id>.json
- decisions/image-review-<event-id>.json

### 파일 구조
- game-design/studio-cutscene/advanced/content.md
- game-design/studio-cutscene/advanced/evidence.yml
- game-design/studio-cutscene/advanced/assets/image-assets.yml
- game-design/studio-cutscene/advanced/assets/receipts/image-generation-<asset-id>-<attempt-id>.json

### 읽는 순서
- game-design/studio-cutscene/advanced/content.md
- game-design/studio-cutscene/advanced/evidence.yml
- game-design/studio-cutscene/advanced/assets/image-assets.yml
- game-design/studio-cutscene/advanced/assets/receipts/image-generation-<asset-id>-<attempt-id>.json

### 도식 바인딩
- ID: st-s16
- SVG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.svg
- PNG: guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.png
- 대체 텍스트: 컷씬 장면·이미지 사전 설계 흐름

### 사람 검토
#### 승인 경계
lead-game-designer가 현재 estimate와 이름 있는 승인 범위를 확인하며 provider 결과와 continuity review가 있어도 사람이 lifecycle 승격을 결정한다.

#### 보류 조건
- finite cap이 없음
- costStatus가 unavailable
- current estimate가 없음
- named approval이 없음
- style-master 뒤 wave의 선행 완료 receipt가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
성공 receipt와 terminal failure를 보존하고 최신 retryable stable ID만 같은 current full-wave estimate와 named live approval으로 재개해.
```

</details>
