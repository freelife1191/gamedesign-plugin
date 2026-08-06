# apply-document-quality-profile

## 목적과 산출물

Studio artifact마다 primary profile 하나를 결정하고 additive overlay와 neutral preset을 검증해 선택 기록, stable checklist, requirement manifest를 만듭니다.

## 사용할 때

- live-service RPG 시스템 명세의 profile을 고를 때
- GDD, review report, presentation, MD·PDF·DOCX·PPTX 준비 전에 구조 계약이 필요할 때

## 사용하지 않을 때

- 본문, 이미지, 도식이나 파생 파일 자체를 만들 때
- 두 비호환 deliverable에 primary profile 하나를 공유하려 할 때

## 필수 입력과 선택 입력

- 필수: goal, audience, artifact type, requested format, template ID, artifact ID
- 선택: 알려진 explicit profile override, `mobile`·`live-service`·`pc-console` overlay, neutral preset 하나
- 기존 문서: selection record와 checklist가 있으면 그대로 제공해 digest-bound 상태를 보존합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio live-service RPG의 스태미나 시스템 명세에 맞는 primary profile 하나를 선택하고 live-service overlay를 적용해. 선택 이유와 section/table/diagram/image/acceptance checklist를 먼저 보여 줘.
```

## Codex CLI 예시

```text
$game-design-studio:apply-document-quality-profile goal=live-service RPG 스태미나 시스템 명세, audience=design·engineering·QA, artifactType=design-document, requestedFormat=md, templateId=system-specification, overlayIds=live-service
```

## 진행 흐름

설치된 index와 template-profile map만 읽고 후보를 점수화합니다. primary 하나를 고른 뒤 알려진 additive source만 합성하고 stable ID checklist와 manifest를 만듭니다. 관련 역할은 `document-quality-editor`, 다음 스킬은 `design-game-systems`이며 주 profile은 `system-feature-specification`입니다.

## 결과와 파일

선택 기록, composed requirements, checklist, requirement manifest, immutable state envelope을 반환합니다. 이 단계는 artifact 내용, SVG·PNG, 생성 이미지, PDF·DOCX·PPTX를 만들지 않습니다. 예상 결과 요약: live-service 시스템 명세에 적용할 구조와 검증 항목이 결정됩니다.

## 검토와 승인

근거와 가정을 분리하고 unknown override는 nearest profile 차이와 explicit fallback을 기록합니다. 상태는 `draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved` 순서이며 external inspection, evidence, renderer/rights/gate, 이름 있는 사람 receipt 없이는 전진하지 않습니다.

## 실패와 재개

unknown ID, schema 오류, scalar conflict, raw object, symlink·path escape는 fail-closed입니다. 기존 artifact와 기록을 보존합니다.

```text
$game-design-studio:apply-document-quality-profile 이전 selection record와 오류를 유지하고, unknown override를 제거한 뒤 설치된 호환 profile만으로 같은 artifactId에서 재개해.
```
