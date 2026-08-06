# plan-image-assets

## 목적과 최종 산출물

선택된 품질 profile의 image·Skillstead slot에 맞춰 stable asset ID, prompt package와 placeholder를 계획합니다.

## 사용할 때

- profile이나 explicit brief가 이미지 자산을 요구할 때
- 생성 전에 수량, placement, alt text와 preserve/exclude 제약을 고정할 때

## 사용하지 않을 때

- 이미지 bytes 생성, provider 호출 또는 승인 상태 변경에는 사용하지 않습니다.
- profile에 없는 slot을 임의로 추가하지 않습니다.

## 필수 입력과 선택 입력

- 필수: artifact root, quality profile/selection record, image need, stable source ID, audience, placement, 수량, decision owner
- 선택: dimensions, variants, accessibility intent, 기존 manifest와 human decisions
- 알려지지 않은 수량과 identity는 placeholder로 남깁니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 이 협동 RPG brief의 profile slot에 맞는 concept art와 UI key screen을 계획해. stable asset ID, 명시적 수량, alt text, preserve/exclude와 placeholder를 작성하고 생성은 하지 마.
```

## Codex CLI 요청 예시

```text
$game-design-studio:plan-image-assets artifact=artifacts/coop-rpg-brief, profile=game-design-brief, needs=design-context-image:1, mode=prompt-only
```

## 내부 진행 흐름

`apply-document-quality-profile` 결과를 검증하고 slot별 manifest를 만든 뒤 Markdown/JSON prompt를 모두 컴파일합니다. Skillstead slot은 별도 source mapping·lint·renderer·QA handoff를 만듭니다. 관련 역할은 `art-brief-director`, 주 템플릿/profile은 현재 canonical artifact의 선택값, 다음 스킬은 `generate-image-assets` 또는 `visualize-game-design`입니다.

## 생성 파일과 결과 구조

`assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`을 생성·갱신합니다. 기존 stable ID, 결정, output과 provenance는 보존합니다. 예상 결과 요약: provider 호출 전 비용과 검토 범위가 유한하게 고정됩니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

이미지 슬롯이 있을 때만 이미지 계획을 만듭니다. 이 스킬은 생성하지 않으며 [이미지 자산 흐름](../image-assets.md)의 `prompt-only|select|required|all` 경계와 stable asset ID를 따릅니다. 구조 관계는 이미지가 아니라 [Skillstead 도식화](../visualization.md)로 분리합니다.

## 검토·승인 기준

새 자산은 모두 `concept-draft`이며 계획은 승인 증거가 아닙니다. 문서 삽입이나 production candidacy에는 이름 있는 사람의 검토와 artifact-local evidence가 필요합니다.

## 실패·fallback·재개 방법

slot mismatch나 필수 입력 누락 시 manifest를 억지로 완성하지 않고 기존 결과와 placeholder를 보존합니다.

```text
$game-design-studio:plan-image-assets 기존 image-assets.yml과 stable IDs를 보존하고, 새로 확정한 image slot·수량·source section만 반영해 prompt package를 다시 작성해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:plan-image-assets 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [이미지 자산 흐름](../image-assets.md), [템플릿 카탈로그](../templates.md), [문제 해결](../troubleshooting.md)
