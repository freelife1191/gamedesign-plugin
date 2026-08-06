# generate-image-assets

## 목적과 최종 산출물

검증된 image manifest에서 mode와 실제 선택 receipt가 허용한 stable asset ID만 생성 provider로 라우팅합니다.

## 사용할 때

- `select` receipt로 고른 asset ID를 생성할 때
- `required` 또는 `all`의 유한 declared jobs를 실행하거나 unavailable handoff를 기록할 때

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

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

검증된 manifest의 유한 stable asset ID가 허용할 때만 삽화를 생성합니다. 구조 도식은 생성 이미지가 아닌 [Skillstead 도식화](../visualization.md)의 영역이며, 생성 결과는 `concept-draft`로 남습니다. mode와 provider 경계는 [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 검토·승인 기준

API key, authorization, base64와 raw bytes를 출력하지 않습니다. OpenAI API/auth/quota/policy/network 실패는 Codex fallback을 일으키지 않습니다. host가 보고하지 않은 model/quality도 만들지 않습니다.

## 실패·fallback·재개 방법

부분 성공, policy block, unavailable route를 asset별로 기록하고 통과한 file과 prompt를 보존합니다.

```text
$game-design-studio:generate-image-assets 기존 성공 결과와 immutable selection receipt를 유지하고, failed asset ID hero-keyart-01만 동일 provider 정책으로 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:generate-image-assets 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [이미지 자산 흐름](../image-assets.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
