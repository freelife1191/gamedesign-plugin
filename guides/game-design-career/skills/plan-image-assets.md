# plan-image-assets

## 목적과 산출물

Career canonical artifact의 profile slot에 맞는 image manifest, reusable prompt package, placeholder와 Skillstead diagram QA handoff를 계획합니다.

## 사용할 때

- portfolio proof image, roadmap diagram 또는 document cover slot을 계획할 때
- provider 호출 전에 stable ID·수량·placement·alt text·권리 경계를 고정할 때

## 사용하지 않을 때

- 이미지를 실제 생성하거나 lifecycle state를 승인할 때
- quality profile을 선택하지 않았거나 required/recommended slot이 불명확할 때

## 필수 입력과 선택 입력

- 필수: canonical artifact root, profile/selection record, explicit image needs와 category별 count, stable source section IDs, viewer, placement, accessibility intent, named decision owner
- 선택: requested variants, prior manifest, preserve/exclude constraints
- employer·project·character·brand identity와 누락된 count를 추론하지 않습니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 portfolio case study의 required proof image 1개와 Skillstead process diagram 1개를 prompt-only로 계획해. stable ID, source section, placement, alt text와 권리 검토 owner를 남겨 줘.
```

## Codex CLI 예시

```text
$game-design-career:plan-image-assets artifact=artifacts/system-case-study, mode=prompt-only, requiredCount=1, skillsteadCount=1
```

## 진행 흐름

`apply-document-quality-profile`의 required/recommended image slot과 explicit need를 맞춥니다. packaged planner와 prompt compiler로 stable asset IDs와 declared counts를 보존합니다. Skillstead diagram은 별도 evidence authority로 계획하며 실제 SVG/PNG는 만들지 않습니다.

## 결과와 파일

artifact 안의 `assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`을 만들거나 갱신합니다. 예상 결과 요약: 생성 없이 prompt·placeholder와 다음 review handoff가 준비됩니다.

## 검토와 승인

planning state는 `concept-draft`입니다. 계획은 portfolio claim, 문서 삽입, 생성 비용 또는 production candidacy를 승인하지 않습니다. prompt와 manifest에는 외부 조직·source project identity를 노출하지 않습니다.

## 실패와 재개

profile-slot mismatch나 count 누락이면 plan을 완성하지 않고 blocker와 placeholder를 남깁니다. 기존 stable IDs, human decisions, generated output과 provenance는 replanning 중에도 보존합니다.

```text
$game-design-career:plan-image-assets 기존 manifest와 stable IDs를 유지하고 누락된 requiredCount=1만 반영해 재개해.
```
