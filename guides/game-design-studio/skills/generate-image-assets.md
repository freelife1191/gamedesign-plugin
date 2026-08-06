# generate-image-assets

## 목적과 최종 산출물

검증된 image manifest에서 mode와 실제 선택 receipt가 허용한 stable asset ID만 생성 provider로 라우팅합니다.

## 사용할 때

- `select` receipt로 고른 asset ID를 생성할 때
- `required` 또는 `all`의 유한 declared jobs를 실행하거나 unavailable handoff를 기록할 때

### 직접 호출 활용 — generate-image-assets

#### 직접 호출 조건

`select` receipt 또는 `required`·`all`의 finite declared illustration job을 실행할 때만 직접 호출합니다. `prompt-only`와 Skillstead diagram slot은 생성 대상이 아닙니다.

#### 입문 요청문

```text
$game-design-studio:generate-image-assets artifact=game-design/island/brief asset=design-context-image-01 mode=select 선택된 prompt와 source ID를 보존해 concept-draft 결과와 provenance를 기록해.
```

#### 응용 요청문

```text
$game-design-studio:generate-image-assets artifact=game-design/island/brief assets=design-context-image-01,design-context-image-02 mode=required finite jobs만 생성하고 unavailable capability는 receipt에 남겨.
```

#### 고급 요청문

```text
$game-design-studio:generate-image-assets artifact=game-design/island/brief mode=all declared image jobs만 실행하고 preserve/exclude, rights source, named human review 대기 상태를 provenance에 기록해.
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → decisions/ → assets/image-assets.yml → assets/provenance/` 순서로 읽고 `image-generation-result`, `image-generation-provenance`와 concept-draft 상태를 확인합니다.

#### 다음 스킬 조건

생성 결과를 문서에 쓰거나 production 후보로 올릴 named human approval 검토가 필요할 때만 `$game-design-studio:review-image-assets`로 넘기며, 생성 성공은 승인되지 않습니다.

## 사용하지 않을 때

- asset 계획이 없으면 `plan-image-assets`를 먼저 사용합니다.
- 생성 결과를 `document-approved`나 `production-candidate`로 올리는 데 사용하지 않습니다.

## 필수 입력과 선택 입력

- 필수: validated `assets/image-assets.yml`, prompt package, `IMAGE_GEN_MODE`, redacted config, capability snapshot
- `select` 필수: 실제 사용자가 제공한 ordered stable asset IDs와 immutable host receipt
- label, 순번, agent 추측이나 임의 JSON은 선택 증거가 아닙니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio select receipt의 stable asset ID hero-keyart-01만 생성해. provider 결정, prompt/output digest와 실패 상태를 분리하고 결과는 concept-draft로 유지해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:generate-image-assets artifact=artifacts/coop-rpg-brief, mode=select, assetIds=hero-keyart-01
```

## 내부 진행 흐름

manifest와 finite jobs를 검증합니다. key가 있으면 OpenAI only, key가 없고 host capability가 available이면 Codex 경로, 둘 다 없으면 unavailable로 끝냅니다. 관련 역할은 다음 단계의 `visual-asset-reviewer`; 주 템플릿/profile은 현재 artifact 선택값; 다음 스킬은 `review-image-assets`입니다.

## 생성 파일과 결과 구조

선택 ID, mode, redacted provider decision, per-asset generation 결과와 보존된 prompt/placeholder를 반환합니다. 사용자는 stable asset ID와 실제 선택 결정을 입력하고, host adapter가 immutable structured selection receipt를 공급합니다. 임의 JSON·문자열 receipt는 거부됩니다. 성공한 PNG가 있더라도 `concept-draft`입니다. 예상 결과 요약: 승인과 분리된 진실한 생성 provenance가 남습니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 generation이 profile을 바꾸지 않음`.
- Reviewer/role ID: `art-brief-director`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

검증 manifest의 finite stable asset ID만 illustration lifecycle로 생성하며 결과는 `concept-draft`입니다. 구조 도식은 생성 이미지가 아니라 Skillstead lane이며 이 스킬의 대상이 아닙니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

API key, authorization, base64와 raw bytes를 출력하지 않습니다. OpenAI API/auth/quota/policy/network 실패는 Codex fallback을 일으키지 않습니다. host가 보고하지 않은 model/quality도 만들지 않습니다.

## 실패·fallback·재개 방법

부분 성공, policy block, unavailable route를 asset별로 기록하고 통과한 file과 prompt를 보존합니다.

```text
$game-design-studio:generate-image-assets 기존 성공 결과와 immutable selection receipt를 유지하고, failed asset ID hero-keyart-01만 동일 provider 정책으로 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Studio review-image-assets로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-studio:review-image-assets artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[템플릿 카탈로그](../templates.md), [review-image-assets 스킬](./review-image-assets.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
