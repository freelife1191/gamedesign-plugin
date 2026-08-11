# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:export-game-design-documents:beginner -->
## studio:export-game-design-documents:beginner

**마크다운(Markdown) 터미널 인계를 준비하는 문서 출력**

승인 가능한 Canonical Artifact의 MD preparation과 downstream terminal validation ownership을 export manifest에 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 승인 가능한 Canonical Artifact의 MD export preparation을 만들고 canonical preflight와 downstream terminal validation owner를 기록해 줘. 이 단계에서는 actual output이나 passed/failed를 주장하지 마.
```

### 짧은 흐름
- 작업 순서: export-game-design-documents
- 함께 검토하는 역할: production-feasibility-critic

### 이 요청으로 받는 결과
등대섬 비전 문서를 마크다운 출력 대상으로 등록하고 안전한 출력 폴더와 검증 책임자를 명세에 적었습니다. 실제 변환과 터미널 검증은 아직 실행하지 않았습니다. (ID: studio:export-game-design-documents:beginner; 파일: game-design/studio-production/export-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
사람이 검토할 source Artifact와 Markdown 형식이 정해졌을 때 사용한다.

### 사용하지 않는 경우
source blocker를 무시하거나 preparation 단계에서 실제 MD 생성·terminal validation 결과를 주장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact directory/version
- MD format
- recipe ID
- safe output directory
- audience

#### 선택 입력
- locale
- overwrite policy
- existing manifest

### 바꿀 자리표시자
- [Canonical Artifact]
- [recipe ID]
- [안전 출력 경로]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 MD export preparation을 만들고 [recipe ID]와 [안전 출력 경로]의 canonical preflight·downstream terminal validation owner를 기록해 줘. 이 단계에서는 actual output이나 passed/failed를 주장하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:export-game-design-documents artifact=game-design/coop/brief formats=md recipe=game-design-brief output=deliverables/coop-md MD preparation, canonical preflight와 downstream terminal validation owner를 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:export-game-design-documents artifact=[Canonical Artifact] formats=md recipe=[recipe ID] output=[안전 출력 경로] canonical preflight와 downstream terminal validation owner를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-game-design-documents
- 스킬 흐름: export-game-design-documents
- 전문 역할: production-feasibility-critic

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- MD preparation manifest
- canonical preflight 상태
- downstream terminal validation owner

#### 선택 결과물
- safe output path 검증
- pending MD job

#### 확장 결과물
- renderer-neutral handoff
- source preservation receipt

### 파일 구조
- game-design/studio-production/export-beginner/content.md
- game-design/studio-production/export-beginner/evidence.yml
- game-design/studio-production/export-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-production/export-beginner/content.md
- game-design/studio-production/export-beginner/evidence.yml
- game-design/studio-production/export-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s07
- SVG: guides/assets/game-design-studio/skills/export-game-design-documents.svg
- PNG: guides/assets/game-design-studio/skills/export-game-design-documents.png
- 대체 텍스트: Markdown 문서 출력 준비 직접 호출 흐름

### 사람 검토
#### 승인 경계
production-feasibility-critic owner가 source eligibility와 handoff를 승인·수정·보류하며 actual MD generation·terminal validation·QA는 downstream workflow가 소유하고 preparation은 결과를 보장하지 않는다.

#### 보류 조건
- canonical preflight가 실패함
- safe output directory가 없음
- source Artifact blocker가 남음

#### 안전 경계
모르는 source 상태는 미정 또는 blocked로 남기고 preparation에서 actual output, digest, count 또는 QA 결과를 발명하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-beginner의 source preservation receipt와 MD preparation을 보존하고 해결된 safe output path만 반영해 preflight 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:export-game-design-documents:standard -->
## studio:export-game-design-documents:standard

**문서 기능 사전 점검을 갖춘 출력 (PDF·DOCX)**

PDF·DOCX 요청을 format별 capability snapshot, preflight와 downstream renderer·QA handoff로 분리한다.

### 간단 요청 예시
```text
@Game Design Studio 승인 가능한 Artifact의 PDF·DOCX format jobs를 준비해 줘. capability snapshot과 canonical preflight를 기록하고, renderer와 format QA를 통과할 때만 downstream이 결과를 표시하도록 해 줘.
```

### 짧은 흐름
- 작업 순서: export-game-design-documents
- 함께 검토하는 역할: production-feasibility-critic → document-quality-editor

### 이 요청으로 받는 결과
폐역 기획서의 PDF 변환기는 사용 가능, DOCX 변환기는 확인 대기로 기록했습니다. 두 형식 모두 렌더링과 품질 검사는 실행 전이며 후속 담당자가 배정돼야 합니다. (ID: studio:export-game-design-documents:standard; 파일: game-design/studio-production/export-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
승인 가능한 source Artifact에 PDF 또는 DOCX의 형식별 handoff가 필요할 때 사용한다.

### 사용하지 않는 경우
capability 부재나 preflight failure를 무시하고 PDF·DOCX 파일, digest, passed/failed QA 결과를 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact directory/version
- PDF/DOCX formats
- capability evidence
- safe output directory
- audience/purpose

#### 선택 입력
- locale
- theme
- accessibility need

### 바꿀 자리표시자
- [Canonical Artifact]
- [요청 형식]
- [capability 근거]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [요청 형식] format jobs를 준비해 줘. [capability 근거]와 canonical preflight를 기록하고 renderer와 format QA를 통과할 때만 downstream이 결과를 표시하도록 해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:export-game-design-documents artifact=game-design/coop/review formats=pdf,docx output=deliverables/coop-review capabilityEvidence=host-probe PDF·DOCX capability snapshot, preflight와 downstream renderer·QA handoff를 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:export-game-design-documents artifact=[Canonical Artifact] formats=[요청 형식] capabilityEvidence=[capability 근거] capability snapshot, preflight와 downstream renderer·QA handoff를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-game-design-documents
- 스킬 흐름: export-game-design-documents
- 전문 역할: production-feasibility-critic → document-quality-editor

### 중간 산출물
- game-design-review

### 예상 결과물
#### 최소 결과물
- format별 capability snapshot
- canonical preflight
- pending·unavailable·blocked jobs
- downstream renderer·QA handoff

#### 선택 결과물
- PDF/DOCX accessibility 질문
- source profile inheritance

#### 확장 결과물
- format evidence 빈 상태
- output null receipt

### 파일 구조
- game-design/studio-production/export-standard/content.md
- game-design/studio-production/export-standard/evidence.yml
- game-design/studio-production/export-standard/decisions/README.md
- game-design/studio-production/export-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-production/export-standard/content.md
- game-design/studio-production/export-standard/evidence.yml
- game-design/studio-production/export-standard/export-manifest.yml
- game-design/studio-production/export-standard/decisions/README.md

### 도식 바인딩
- ID: st-s07
- SVG: guides/assets/game-design-studio/skills/export-game-design-documents.svg
- PNG: guides/assets/game-design-studio/skills/export-game-design-documents.png
- 대체 텍스트: PDF와 DOCX capability preflight 직접 호출 흐름

### 사람 검토
#### 승인 경계
production-feasibility-critic owner가 capability·preflight·handoff를 승인·수정·보류하며 PDF·DOCX generation, renderer 결과와 format QA는 downstream workflow가 소유하고 세 gate 통과 전 결과를 표시하지 않는다.

#### 보류 조건
- capability evidence가 없음
- canonical preflight가 실패함
- source approval 또는 rights 상태가 미정

#### 안전 경계
모르는 capability와 preflight 상태는 미정 또는 blocked로 남긴다. PDF·DOCX 형식은 capability, canonical preflight, renderer와 format QA gate를 모두 통과한 뒤에만 downstream workflow가 actual output을 표시한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-standard의 capability snapshot과 blocked format job을 보존하고 available로 바뀐 capability 근거만 반영해 preflight 이전 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:export-game-design-documents:advanced -->
## studio:export-game-design-documents:advanced

**이야기 구성·형식 품질 검사와 부분 재개를 갖춘 문서 출력 (PPTX)**

PPTX 독립 story와 format별 partial resume 조건을 capability·preflight·renderer·QA ownership에 맞춰 준비한다.

### 간단 요청 예시
```text
@Game Design Studio 의사결정자용 PPTX 독립 story와 PDF·DOCX job의 partial resume 조건을 준비해 줘. capability·preflight·renderer·format QA를 통과할 때만 downstream이 형식 결과를 표시하고, 이 단계는 not-run 상태를 유지해 줘.
```

### 짧은 흐름
- 작업 순서: export-game-design-documents
- 함께 검토하는 역할: production-feasibility-critic → lead-game-designer → ux-accessibility-reviewer

### 이 요청으로 받는 결과
계절 시장 발표 자료는 문제·플레이 흐름·경제 위험 순서로 독립적인 이야기 개요를 잡았습니다. PPTX 렌더링은 실행 전이고, PDF만 끝난 경우의 재개 지점도 따로 남겼습니다. (ID: studio:export-game-design-documents:advanced; 파일: game-design/studio-production/export-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
의사결정자용 PPTX story와 여러 형식 job의 capability 변화·부분 재개 조건을 관리할 때 사용한다.

### 사용하지 않는 경우
Markdown heading만으로 PPTX story를 대체하거나 renderer/format QA 증거 없이 PPTX·PDF·DOCX 결과를 완료로 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact directory/version
- requested formats
- PPTX story outline
- capability evidence
- safe output directory

#### 선택 입력
- slide accessibility need
- theme
- existing preparation manifest

### 바꿀 자리표시자
- [Canonical Artifact]
- [PPTX story]
- [capability 근거]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [PPTX story]와 형식별 partial resume 조건을 준비해 줘. [capability 근거], preflight, renderer·format QA를 통과할 때만 downstream이 결과를 표시하고 이 단계는 not-run 상태를 유지해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:export-game-design-documents artifact=game-design/coop/brief formats=pptx,pdf,docx output=deliverables/coop capabilityEvidence=host-probe 독립 PPTX story, partial resume, preflight와 downstream renderer·format QA handoff를 준비해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:export-game-design-documents artifact=[Canonical Artifact] formats=pptx,pdf,docx story=[PPTX story] capabilityEvidence=[capability 근거] partial resume, preflight와 downstream renderer·format QA handoff를 준비해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-game-design-documents
- 스킬 흐름: export-game-design-documents
- 전문 역할: production-feasibility-critic → lead-game-designer → ux-accessibility-reviewer

### 중간 산출물
- game-design-brief
- game-design-review

### 예상 결과물
#### 최소 결과물
- PPTX independent story
- format별 capability·preflight 상태
- not-run renderer·QA receipt
- partial resume 조건

#### 선택 결과물
- slide accessibility 질문
- approved asset binding 조건

#### 확장 결과물
- pending·unavailable·blocked job 분리
- downstream format QA handoff

### 파일 구조
- game-design/studio-production/export-advanced/content.md
- game-design/studio-production/export-advanced/evidence.yml
- game-design/studio-production/export-advanced/decisions/README.md
- game-design/studio-production/export-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-production/export-advanced/content.md
- game-design/studio-production/export-advanced/evidence.yml
- game-design/studio-production/export-advanced/export-manifest.yml
- game-design/studio-production/export-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s07
- SVG: guides/assets/game-design-studio/skills/export-game-design-documents.svg
- PNG: guides/assets/game-design-studio/skills/export-game-design-documents.png
- 대체 텍스트: PPTX story와 부분 재개 문서 출력 직접 호출 흐름

### 사람 검토
#### 승인 경계
production-feasibility-critic와 lead-game-designer owner가 PPTX story·capability·preflight·partial resume를 승인·수정·보류하며 PPTX·PDF·DOCX renderer와 format QA는 downstream workflow가 소유하고 모든 gate 통과 전 결과를 표시하지 않는다.

#### 보류 조건
- PPTX independent story가 없음
- capability evidence가 없음
- preflight 또는 source approval이 blocked임

#### 안전 경계
모르는 capability·preflight·QA 상태는 미정 또는 blocked로 남긴다. PPTX·PDF·DOCX 형식은 capability, canonical preflight, renderer와 format QA gate를 모두 통과한 뒤에만 downstream workflow가 actual output을 표시한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-advanced의 independent story와 not-run format jobs를 보존하고 available capability 또는 해소된 preflight 하나만 반영해 해당 format의 partial resume부터 재개해.
```

</details>
