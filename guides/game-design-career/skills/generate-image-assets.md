# generate-image-assets

## 목적과 산출물

검증된 Career image manifest에서 mode와 실제 사용자 선택이 허용한 stable asset ID만 provider로 라우팅하고 generation evidence를 남깁니다.

## 사용할 때

- portfolio illustration 또는 document image의 prompt-ready job을 생성할 때
- provider가 없거나 실패한 asset의 prompt·placeholder와 재개 경로를 보존할 때

## 사용하지 않을 때

- manifest와 prompt package가 없으면 `plan-image-assets`를 먼저 사용합니다.
- 생성 결과를 portfolio evidence, `document-approved` 또는 `production-candidate`로 승인할 때

## 필수 입력과 선택 입력

- 필수: validated `assets/image-assets.yml`, 두 prompt 파일, `IMAGE_GEN_MODE`, redacted config, capability snapshot
- `select` 필수: 실제 사용자의 ordered stable asset IDs와 closed `host-user-image-selection` receipt
- 선택: `OPENAI_API_KEY`; key, authorization, base64와 raw bytes는 public output에 포함하지 않습니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career select mode에서 내가 고른 portfolio-proof-01만 생성해. provider evidence와 실패 상태를 분리하고 결과는 concept-draft로 유지해.
```

## Codex CLI 예시

```text
$game-design-career:generate-image-assets artifact=artifacts/system-portfolio, mode=select, assetIds=portfolio-proof-01, selectionEvent=host-event-42
```

## 진행 흐름

packaged preflight로 private config를 내부에 유지한 채 manifest와 finite jobs를 검증합니다. `prompt-only`는 0 jobs, `select`는 user receipt의 stable IDs만 처리합니다. key가 있으면 OpenAI only, key 없이 host image capability가 available이면 selected jobs만 전달하며, 둘 다 없으면 generator를 호출하지 않습니다.

## 결과와 파일

선택된 IDs, mode, redacted provider decision, asset별 result, prompt/placeholder와 named-human review handoff를 반환합니다. 생성 파일은 `concept-draft`입니다. 예상 결과 요약: 승인과 분리된 provider provenance와 재개 가능한 상태가 남습니다.

## 검토와 승인

OpenAI API/auth/quota/policy/invalid-request/network 실패 뒤 Codex fallback을 사용하지 않습니다. host가 반환하지 않은 model/quality를 주장하지 않으며 생성은 ownership, 권리 또는 문서 사용 승인이 아닙니다.

## 실패와 재개

부분 성공과 실패를 asset별로 보존합니다. provider가 unavailable이면 prompt와 placeholder를 유지하고 동일 stable ID로 재개합니다.

```text
$game-design-career:generate-image-assets 성공한 asset은 유지하고 failed인 portfolio-proof-01만 같은 provider 정책으로 재개해.
```
