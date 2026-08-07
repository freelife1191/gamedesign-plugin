# generate-image-assets

## 목적과 최종 산출물

검증된 Career image manifest에서 mode와 실제 사용자 선택이 허용한 stable asset ID만 provider로 라우팅하고 generation evidence를 남깁니다.

## 사용할 때

- portfolio illustration 또는 document image의 prompt-ready job을 생성할 때
- provider가 없거나 실패한 asset의 prompt·placeholder와 재개 경로를 보존할 때

### Career 직접 호출 활용 — generate-image-assets

#### 직접 호출 조건

선택 receipt가 있는 finite image job만 직접 호출합니다. 여러 artifact의 image·review 범위가 섞였을 때만 `$game-design-career:orchestrate-game-design-career`로 범위를 나눕니다. AI 생성 결과는 자동 최종 승인되지 않습니다.

#### 입문 App 요청문

```text
@Game Design Career 선택한 asset ID 하나의 provider routing과 prompt-only 결과를 기록해.
```

#### 입문 CLI 요청문

```text
$game-design-career:generate-image-assets artifact=artifacts/portfolio assetId=portfolio-proof-01 IMAGE_GEN_MODE=select
```

#### 응용 App 요청문

```text
@Game Design Career finite selected job만 생성하고 provenance와 named human approval blocker를 남겨.
```

#### 응용 CLI 요청문

```text
$game-design-career:generate-image-assets artifact=artifacts/portfolio mode=required IMAGE_GEN_MODE=required
```

#### 고급 App 요청문

```text
@Game Design Career provider failure를 placeholder와 재개 receipt로 보존해.
```

#### 고급 CLI 요청문

```text
$game-design-career:generate-image-assets artifact=artifacts/portfolio IMAGE_GEN_MODE=all
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → assets/image-assets.yml → assets/prompts/image-prompts.md` 순서로 읽습니다. `image-generation-result`, `image-generation-provenance`을 반환합니다. 검토 owner: `visual-asset-reviewer`.

#### 실패·재개와 다음 스킬 조건

provider 또는 selection receipt가 없으면 prompt·placeholder와 lifecycle을 보존합니다. 재개: provider routing과 실제 사용자 decision을 추가한 stable asset ID에서 재개합니다. named human approval 전에는 final binding하지 않고, review가 필요할 때만 `$game-design-career:review-image-assets`로 넘깁니다.

## 사용하지 않을 때

- manifest와 prompt package가 없으면 `plan-image-assets`를 먼저 사용합니다.
- 생성 결과를 portfolio evidence, `document-approved` 또는 `production-candidate`로 승인할 때

## 필수 입력과 선택 입력

- 필수: validated `assets/image-assets.yml`, 두 prompt 파일, `IMAGE_GEN_MODE`, redacted config, capability snapshot
- `select` 필수: 실제 사용자의 ordered stable asset IDs와 closed `host-user-image-selection` receipt
- 선택: `OPENAI_API_KEY`; key, authorization, base64와 raw bytes는 public output에 포함하지 않습니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career select mode에서 내가 고른 portfolio-proof-01만 생성해. provider evidence와 실패 상태를 분리하고 결과는 concept-draft로 유지해.
```

## Codex CLI 요청 예시

```text
$game-design-career:generate-image-assets artifact=artifacts/system-portfolio, mode=select, assetIds=portfolio-proof-01
```

## 내부 진행 흐름

packaged preflight로 private config를 내부에 유지한 채 manifest와 finite jobs를 검증합니다. `prompt-only`는 0 jobs, `select`는 user receipt의 stable IDs만 처리합니다. key가 있으면 OpenAI only, key 없이 host image capability가 available이면 selected jobs만 전달하며, 둘 다 없으면 generator를 호출하지 않습니다.

## 생성 파일과 결과 구조

선택된 IDs, mode, redacted provider decision, asset별 result, prompt/placeholder와 named-human review handoff를 반환합니다. 사용자는 stable asset ID와 실제 선택 결정을 입력하고, host adapter가 immutable structured selection receipt를 공급합니다. 임의 JSON·문자열 receipt는 거부됩니다. 생성 파일은 `concept-draft`입니다. 예상 결과 요약: 승인과 분리된 provider provenance와 재개 가능한 상태가 남습니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 generation이 profile을 바꾸지 않음`.
- Reviewer/role ID: `art-brief-director`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

검증 manifest의 finite stable asset ID만 illustration lifecycle로 생성하며 결과는 `concept-draft`입니다. 구조 도식은 생성 이미지가 아니라 Skillstead lane입니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

OpenAI API/auth/quota/policy/invalid-request/network 실패 뒤 Codex fallback을 사용하지 않습니다. host가 반환하지 않은 model/quality를 주장하지 않으며 생성은 ownership, 권리 또는 문서 사용 승인이 아닙니다.

## 실패·fallback·재개 방법

부분 성공과 실패를 asset별로 보존합니다. provider가 unavailable이면 prompt와 placeholder를 유지하고 동일 stable ID로 재개합니다.

```text
$game-design-career:generate-image-assets 성공한 asset은 유지하고 failed인 portfolio-proof-01만 같은 provider 정책으로 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Career review-image-assets로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-career:review-image-assets artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[템플릿 카탈로그](../templates.md), [review-image-assets 스킬](./review-image-assets.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
