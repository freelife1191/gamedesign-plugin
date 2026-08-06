# export-game-design-documents

## 목적과 최종 산출물

승인 가능한 Canonical Artifact를 MD·PDF·DOCX·PPTX로 전달하기 위한 renderer-neutral job manifest를 준비합니다.

## 사용할 때

- GDD, system/content spec, LiveOps plan, review report의 형식별 handoff가 필요할 때
- 의사결정자용 PPTX의 독립 story와 capability 상태를 준비할 때

## 사용하지 않을 때

- source 내용이 불완전하면 해당 design skill을 먼저 사용합니다.
- 도식이 아직 없거나 검증되지 않았다면 `visualize-game-design`을 먼저 사용합니다.

## 필수 입력과 선택 입력

- 필수: artifact directory/version, requested formats, recipe ID, safe output directory, capability evidence, audience와 purpose
- PPTX 필수: Markdown heading과 독립적인 story outline, slide별 stable id/title/message/purpose
- 선택: locale, theme, accessibility needs, deadline, overwrite policy, 기존 준비 manifest

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 승인된 Artifact의 MD·PDF·DOCX와 의사결정자용 PPTX 작업을 준비해. PPTX는 독립 story로 만들고 이 단계에서는 passed/failed를 주장하지 마.
```

## Codex CLI 요청 예시

```text
$game-design-studio:export-game-design-documents artifact=artifacts/coop-rpg-gdd, recipe=gdd, formats=md,pdf,docx,pptx, output=deliverables/coop-rpg
```

## 내부 진행 흐름

canonical preflight와 capability probe를 실행하고 recipe를 선택합니다. PPTX story를 별도로 검증한 뒤 prepare/validate script로 renderer-neutral jobs를 만듭니다. 관련 역할은 `production-feasibility-critic`, 필요 시 `lead-game-designer`와 `ux-accessibility-reviewer`; 주 profile/template은 source artifact 선택값; 다음 단계는 별도 trusted renderer-and-QA workflow입니다.

## 생성 파일과 결과 구조

preflight, recipe, capability snapshot, format jobs와 artifact preservation을 담은 preparation manifest를 반환합니다. 지원 요청은 `pending`, capability 부재는 `unavailable`, preflight 실패는 `blocked`입니다. 예상 결과 요약: source를 보존한 채 각 형식의 실행 전 상태가 정직하게 준비됩니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `current artifact profile` — [템플릿 카탈로그](../templates.md).
- Quality Profile ID: `current artifact profile을 상속하며 export가 새 profile을 선택하지 않음`.
- Reviewer/role ID: `production-feasibility-critic`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

새 illustration이나 구조 도식을 만들지 않습니다. `document-approved` image asset과 검증된 Skillstead SVG/2× PNG만 downstream 형식 작업에 binding할 수 있습니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

generation·renderer·QA는 모두 `not-run`, derivative path/digest/count는 null, format evidence는 빈 배열이어야 합니다. final derivative는 `document-approved` 이상 asset만 binding합니다. 이 단계는 format-level `passed`나 `failed`를 거부합니다.

## 실패·fallback·재개 방법

unsafe traversal, symlink, overwrite와 canonical preflight 실패는 fail-closed이며 기존 source와 output을 바꾸지 않습니다.

```text
$game-design-studio:export-game-design-documents 기존 artifact와 준비 manifest를 보존하고, 해결된 capability 또는 safe output path만 반영해 pending 이전 단계부터 재개해.
```

## 다음 작업 요청문

**복사 가능한 다음 handoff**

@Game Design Studio host probe가 available로 보고한 MD/PDF/DOCX/PPTX capability만 사용해 이 export manifest의 실제 파일을 생성하고 format QA evidence를 반환해.

```text
같은 세션에서 built-in canonical-markdown으로 MD terminal validation을 실행해. 이어 available pdf/documents/presentations capability로 요청한 PDF/DOCX/PPTX 생성·format QA를 실행해.
```

이 요청은 플러그인 재호출이 아니라 host의 **downstream workflow** handoff이며, bundled renderer를 뜻하지 않습니다.

## 관련 문서

[템플릿 카탈로그](../templates.md), [내보내기 안내](../exports.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
