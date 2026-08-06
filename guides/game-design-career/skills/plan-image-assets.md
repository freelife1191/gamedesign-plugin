# plan-image-assets

## 목적과 최종 산출물

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

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 portfolio case study의 required proof image 1개와 Skillstead process diagram 1개를 prompt-only로 계획해. stable ID, source section, placement, alt text와 권리 검토 owner를 남겨 줘.
```

## Codex CLI 요청 예시

```text
$game-design-career:plan-image-assets artifact=artifacts/system-case-study, mode=prompt-only, requiredCount=1, skillsteadCount=1
```

## 내부 진행 흐름

`apply-document-quality-profile`의 required/recommended image slot과 explicit need를 맞춥니다. packaged planner와 prompt compiler로 stable asset IDs와 declared counts를 보존합니다. Skillstead diagram은 별도 evidence authority로 계획하며 실제 SVG/PNG는 만들지 않습니다.

## 생성 파일과 결과 구조

artifact 안의 `assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`을 만들거나 갱신합니다. 예상 결과 요약: 생성 없이 prompt·placeholder와 다음 review handoff가 준비됩니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 plan이 profile을 바꾸지 않음`.
- Reviewer/role ID: `art-brief-director`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

template의 declared image slot과 finite stable asset ID만 illustration lifecycle에 넣습니다. Skillstead diagram slot은 image plan에서 생성하지 않습니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

planning state는 `concept-draft`입니다. 계획은 portfolio claim, 문서 삽입, 생성 비용 또는 production candidacy를 승인하지 않습니다. prompt와 manifest에는 외부 조직·source project identity를 노출하지 않습니다.

## 실패·fallback·재개 방법

profile-slot mismatch나 count 누락이면 plan을 완성하지 않고 blocker와 placeholder를 남깁니다. 기존 stable IDs, human decisions, generated output과 provenance는 replanning 중에도 보존합니다.

```text
$game-design-career:plan-image-assets 기존 manifest와 stable IDs를 유지하고 누락된 requiredCount=1만 반영해 재개해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 조건부 다음 handoff**

각 조건은 바로 아래 command 하나에만 결합됩니다.

- 조건: `prompt-only`면 생성 handoff 없이 이 planning artifact의 prompt·placeholder만 보존할 때.

- 조건: `select`/`required`/`all`의 finite illustration job일 때.

```text
$game-design-career:generate-image-assets artifact=<artifact-path> 기존 evidence/decision을 보존하고 finite illustration job만 생성해.
```

- 조건: Skillstead diagram slot일 때.

```text
$game-design-career:visualize-career-roadmap artifact=artifacts/system-case-study Skillstead diagram slot의 source mapping·SVG/2× PNG QA만 진행해.
```

`prompt-only`일 때는 생성 handoff 없이 이 planning artifact의 prompt·placeholder만 유지합니다.

## 관련 문서

[템플릿 카탈로그](../templates.md), [generate-image-assets 스킬](./generate-image-assets.md), [visualize-career-roadmap 스킬](./visualize-career-roadmap.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
