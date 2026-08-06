# export-game-design-documents

## 목적과 최종 산출물

승인 가능한 Canonical Artifact를 MD·PDF·DOCX·PPTX로 전달하기 위한 renderer-neutral job manifest를 준비합니다.

## 사용할 때

- GDD, system/content spec, LiveOps plan, review report의 형식별 handoff가 필요할 때
- 의사결정자용 PPTX의 독립 story와 capability 상태를 준비할 때

### 직접 호출 활용 — export-game-design-documents

#### 직접 호출 조건

사람이 검토할 Canonical Artifact와 요청 format이 이미 정해졌을 때 직접 호출합니다. source Artifact의 blocker나 권리·승인 상태가 미확정이면 먼저 review에서 보류합니다.

#### 입문 요청문

```text
$game-design-studio:export-game-design-documents artifact=game-design/island/vision formats=MD audience=design-owner canonical preflight, renderer-neutral preparation과 pending format job을 export manifest에 기록해.
```

#### 응용 요청문

```text
$game-design-studio:export-game-design-documents artifact=game-design/island/review formats=PDF,DOCX audience=reviewer 형식별 preflight와 capability 결과를 기록하고 실패한 job은 downstream workflow로 넘겨.
```

#### 고급 요청문

```text
$game-design-studio:export-game-design-documents artifact=game-design/island/brief formats=PPTX audience=decision-owner 독립 story, capability snapshot, provenance와 미승인 이미지 경계를 유지해 export preparation을 작성해.
```

#### 예상 파일과 읽는 순서

`content.md → evidence.yml → export-manifest.yml` 순서로 읽습니다. preparation의 format job은 `pending`·`unavailable`·`blocked`만 기록하고 generation·renderer·QA는 모두 `not-run`, output/digest/count는 null, format evidence는 비어 있음으로 유지합니다. `export-preparation-manifest`, `format-jobs`는 별도 파일명이 아니라 이 preparation의 논리 결과입니다.

#### 다음 스킬 조건

정상적으로 검증된 preparation manifest의 요청 job이 `pending`일 때만 downstream renderer-and-QA workflow로 handoff하며, 실제 generation·terminal validation·format QA·terminal outcome은 그 downstream workflow가 소유합니다. `unavailable` job의 capability가 `available`로 바뀌었을 때만 `$game-design-studio:export-game-design-documents`로 preparation을 resume하고, 새 `pending` job은 앞의 정상 handoff 조건을 따릅니다. MD는 built-in canonical-markdown preparation을 별도 capability probe로 막지 않습니다.

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

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Studio built-in canonical-markdown으로 MD를 capability와 무관하게 생성·terminal validation해. 이어 host probe가 available로 보고한 pdf/documents/presentations capability만 사용해 PDF/DOCX/PPTX 실제 파일과 format QA evidence를 반환해.

```text
같은 세션에서 built-in canonical-markdown으로 MD terminal validation을 실행해. 이어 available pdf/documents/presentations capability로 요청한 PDF/DOCX/PPTX 생성·format QA를 실행해.
```

이 요청은 플러그인 재호출이 아니라 host의 **downstream workflow** handoff이며, bundled renderer를 뜻하지 않습니다.

## 관련 문서

[템플릿 카탈로그](../templates.md), [내보내기 안내](../exports.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
