# plan-image-assets

## 목적과 산출물

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

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 이 협동 RPG brief의 profile slot에 맞는 concept art와 UI key screen을 계획해. stable asset ID, 명시적 수량, alt text, preserve/exclude와 placeholder를 작성하고 생성은 하지 마.
```

## Codex CLI 예시

```text
$game-design-studio:plan-image-assets artifact=artifacts/coop-rpg-brief, profile=game-design-brief, needs=design-context-image:1, mode=prompt-only
```

## 진행 흐름

`apply-document-quality-profile` 결과를 검증하고 slot별 manifest를 만든 뒤 Markdown/JSON prompt를 모두 컴파일합니다. Skillstead slot은 별도 source mapping·lint·renderer·QA handoff를 만듭니다. 관련 역할은 `art-brief-director`, 주 템플릿/profile은 현재 canonical artifact의 선택값, 다음 스킬은 `generate-image-assets` 또는 `visualize-game-design`입니다.

## 결과와 파일

`assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`을 생성·갱신합니다. 기존 stable ID, 결정, output과 provenance는 보존합니다. 예상 결과 요약: provider 호출 전 비용과 검토 범위가 유한하게 고정됩니다.

## 검토와 승인

새 자산은 모두 `concept-draft`이며 계획은 승인 증거가 아닙니다. 문서 삽입이나 production candidacy에는 이름 있는 사람의 검토와 artifact-local evidence가 필요합니다.

## 실패와 재개

slot mismatch나 필수 입력 누락 시 manifest를 억지로 완성하지 않고 기존 결과와 placeholder를 보존합니다.

```text
$game-design-studio:plan-image-assets 기존 image-assets.yml과 stable IDs를 보존하고, 새로 확정한 image slot·수량·source section만 반영해 prompt package를 다시 작성해.
```
