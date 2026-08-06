# generate-image-assets

## 목적과 최종 산출물

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

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

검증된 manifest의 유한 stable asset ID가 허용할 때만 삽화를 생성합니다. 구조 도식은 생성 이미지가 아닌 [Skillstead 도식화](../visualization.md)의 영역이며, 생성 결과는 `concept-draft`로 남습니다. mode와 provider 경계는 [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 검토·승인 기준

OpenAI API/auth/quota/policy/invalid-request/network 실패 뒤 Codex fallback을 사용하지 않습니다. host가 반환하지 않은 model/quality를 주장하지 않으며 생성은 ownership, 권리 또는 문서 사용 승인이 아닙니다.

## 실패·fallback·재개 방법

부분 성공과 실패를 asset별로 보존합니다. provider가 unavailable이면 prompt와 placeholder를 유지하고 동일 stable ID로 재개합니다.

```text
$game-design-career:generate-image-assets 성공한 asset은 유지하고 failed인 portfolio-proof-01만 같은 provider 정책으로 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:generate-image-assets 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [이미지 자산 흐름](../image-assets.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
