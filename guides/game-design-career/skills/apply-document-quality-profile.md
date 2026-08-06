# apply-document-quality-profile

## 목적과 최종 산출물

Career canonical artifact마다 primary profile 하나를 결정하고 additive source를 검증해 selection record, stable checklist와 requirement manifest를 만듭니다.

## 사용할 때

- 역기획서, portfolio case study, 면접 report, 성장 review의 구조를 쓰기 전에 고정할 때
- 서로 다른 대상의 MD·PDF·DOCX·PPTX가 각각 어떤 profile을 써야 하는지 결정할 때

## 사용하지 않을 때

- 본문, 이미지, SVG나 파생 문서를 직접 만들 때
- 비호환 deliverable 두 개에 primary profile 하나를 공유하려 할 때

## 필수 입력과 선택 입력

- 필수: artifact ID, goal, audience, artifact type, requested format, template ID
- 선택: 알려진 explicit profile override, `mobile`·`live-service`·`pc-console` overlay, neutral preset 하나
- 기존 artifact가 있으면 selection record, checklist와 digest-bound state를 제공합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career reverse-design-document와 recruiter용 portfolio presentation을 서로 다른 artifact로 나눠 primary profile을 선택해. 각 selection 이유와 section/table/diagram/image/acceptance checklist를 먼저 보여 줘.
```

## Codex CLI 요청 예시

```text
$game-design-career:apply-document-quality-profile goal=시스템 역기획 case study, audience=portfolio-reviewer, artifactType=career-document, requestedFormat=md, templateId=reverse-design-document
```

## 내부 진행 흐름

packaged Career index와 template-profile map만 읽고 compatible template, artifact type, format, audience, goal 순으로 점수화합니다. primary 하나를 선택한 뒤 알려진 additive source만 합성하고 stable IDs와 digest를 묶습니다. unknown override는 nearest profile과 차이를 보고하고 explicit fallback 전에는 선택하지 않습니다.

## 생성 파일과 결과 구조

selection record, composed requirements, checklist, requirement manifest와 immutable state envelope을 반환합니다. 내용·이미지·SVG·PNG·PDF·DOCX·PPTX는 만들지 않습니다. 예상 결과 요약: Career artifact가 충족해야 할 구조와 검증 항목이 결정됩니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

상태는 `draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved` 순서입니다. external artifact inspection, evidence audit, renderer/rights evidence와 이름 있는 사람의 receipt가 같은 digest에 묶여야 합니다. 생성 이미지, 렌더 파일, self-attestation은 승인 증거가 아닙니다.

## 실패·fallback·재개 방법

unknown ID, raw object, schema 오류, scalar conflict, symlink·path escape는 fail-closed입니다. 기존 artifact와 기록을 보존하고 설치된 호환 profile로 다시 선택합니다.

```text
$game-design-career:apply-document-quality-profile 이전 selection record와 오류를 유지하고 unknown override만 제거해 같은 artifactId에서 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:apply-document-quality-profile 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
