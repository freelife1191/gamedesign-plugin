# Career MD·PDF·DOCX·PPTX 내보내기

Career export skill은 canonical artifact를 검증하고 renderer-neutral 작업을 준비합니다. 실제 generation, renderer와 terminal QA는 trusted downstream document/PDF/presentation workflow가 소유합니다.

플러그인이 보장하는 끝점은 renderer-neutral preflight manifest까지입니다. `npm run test:formats`와 테스트는 개발자가 이 계약을 검증하는 절차이지, 설치 사용자가 실행할 downstream renderer가 아닙니다. 플러그인이 PDF·DOCX·PPTX 완성 파일을 단독 생성한다고 해석하지 말고 **내보내기 준비** 상태로 사용합니다.

[![문서 내보내기 준비 상태 흐름](../assets/shared/document-export-flow.png)](../assets/shared/document-export-flow.svg)

## 공통 preflight

document type, audience, purpose, artifact root/ID, requested formats와 capability snapshot을 수집합니다. canonical validation이 failed, pending 또는 unevidenced이면 모든 derivative preparation을 중단하고 source와 evidence를 보존합니다.

현재 job·role claim은 사실·추론·제안, 검색일, 지역, 표본과 source freshness를 유지합니다. export가 합격을 보장하지 않으며 privacy·fairness·rights와 employer confidential boundary를 제거하지 않습니다.

## 형식 비교

| 형식 | 준비 상태 | Downstream 검증 | Career 경계 |
| --- | --- | --- | --- |
| MD | renderer capability와 무관하게 `pending`에서 downstream validation `passed` | frontmatter, 한 H1, stable IDs, NFC, relative assets와 alt text | 항상 사용 가능하며 canonical evidence/decision record 유지 |
| PDF | capability별 `pending`/`unavailable` | extracted semantics와 모든 page render/visual QA | source와 page 의미 비교 |
| DOCX | capability별 `pending`/`unavailable` | OOXML relationships, semantics, 모든 page visual QA | 역기획 등 허용 profile만 요청 |
| PPTX | capability별 `pending`/`unavailable` | 독립 story, overflow, 모든 slide visual QA | recruiter presentation profile 또는 별도 호환 artifact 필요 |

## Presentation story

PPTX는 audience, purpose와 nonempty independent story outline이 필수입니다. Markdown heading을 기계적으로 slide로 나누지 않습니다. target role/level, current evidence, decision·alternative, limitations, next verification을 audience-specific message로 구성합니다.

## Asset binding

final derivative는 `document-approved` 이상 image asset만 참조합니다. Skillstead diagram은 editable SVG authority, source mapping, alt text, lint, Chromium identity, 정확한 2× PNG와 two-pass visual QA evidence가 필요합니다. 생성·렌더 사실은 approval이 아닙니다.

## Preparation 상태

- `not-requested`: 요청하지 않은 형식
- `blocked`: canonical validation 실패 또는 증거 부재
- `pending`: probe 전 `unknown`, 또는 passed probe의 `available`
- `unavailable`: failed probe 하나와 generation/QA 없음

MD는 renderer capability와 무관하게 항상 사용 가능하며 `unavailable`이나 `failed`를 사용하지 않습니다. canonical export는 `pending`으로 시작하고 downstream validation을 통과하면 `passed`가 됩니다. `unavailable`은 renderer probe가 실패한 PDF·DOCX·PPTX에만 씁니다. 실제 파일이 보이더라도 해당 형식의 validation·QA evidence 없이 성공 상태로 올리지 않습니다.

## 보존과 재개

canonical artifact를 덮어쓰지 않습니다. unknown capability를 unavailable로 바꾸지 않고 형식별 probe를 분리합니다. 지원하지 못한 형식만 resumable action으로 남기며 다른 verified source와 decision을 폐기하지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Career 승인 가능한 portfolio 원본의 MD·PDF와 recruiter용 PPTX 작업을 준비해. PPTX는 독립 story로 만들고 renderer-neutral manifest에는 passed/failed나 생성 파일 경로를 넣지 마.
```

## 실제 파일·형식 QA를 요청할 때

같은 채팅/세션에서 host capability probe가 `pdf`, `documents`, `presentations` 중 필요한 capability를 `available`로 보고한 뒤에만 별도 요청합니다.

```text
이 세션에서 probe가 available로 보고한 pdf/documents/presentations capability만 사용해, 이미 준비된 export manifest의 PDF·DOCX·PPTX를 실제 파일로 생성하고 형식별 semantic·page/slide visual QA evidence와 output path를 반환해. capability가 없거나 QA가 실패한 형식은 unavailable/failed evidence와 재개 조건만 남기고 다른 형식은 주장하지 마.
```

예상 output은 실제 생성 파일, renderer identity, 형식별 QA evidence와 실패 형식의 resumable action입니다. capability가 unavailable이면 canonical Markdown과 preflight manifest를 보존하고, capability를 제공하는 host의 새 동일 작업 세션에서 이 요청문과 artifact ID를 다시 사용합니다.
