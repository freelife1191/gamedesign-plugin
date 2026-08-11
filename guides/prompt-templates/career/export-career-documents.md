# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:export-career-documents:beginner -->
## career:export-career-documents:beginner

**게임 기획 결과: MD 요약 preflight**

canonical artifact의 MD 요약을 canonical preflight, capability, renderer, format QA와 human review 전 non-terminal job으로 준비한다.

### 간단 요청 예시
```text
@Game Design Career canonical artifact의 MD 요약을 canonical preflight, capability, renderer, format QA와 human review로 준비해. actual output 전 전달 완료를 표시하지 말고 fact, inference, recommendation을 구분해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 짧은 흐름
- 작업 순서: export-career-documents
- 함께 검토하는 역할: document-quality-editor → evidence-auditor

### 이 요청으로 받는 결과
가상 문서 조각 — 해저 정원을 돌보는 협동 플레이어의 내보내기 전 점검: 현재는 초안입니다. 확인할 점: 추가 입력과 근거 주소. (ID: career:export-career-documents:beginner; 파일: game-design-career/career-evidence/export-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
canonical portfolio 또는 growth artifact의 MD 파생본을 준비할 때 사용한다.

### 사용하지 않는 경우
canonical validation이나 human review 전에 actual output 또는 전달 완료를 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical artifact ID
- MD audience
- canonical preflight

#### 선택 입력
- renderer capability

### 바꿀 자리표시자
- [canonical artifact ID]
- [MD audience]
- [canonical preflight]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [canonical artifact ID]의 [MD audience]용 MD를 [canonical preflight]로 준비해. capability, renderer, format QA, human review와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:export-career-documents artifact=career/portfolio format=md canonicalPreflight=passed MD job을 준비해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:export-career-documents artifact=[canonical artifact ID] format=md audience=[MD audience] canonicalPreflight=[canonical preflight] capability renderer format QA human review와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-career-documents
- 스킬 흐름: export-career-documents
- 전문 역할: document-quality-editor → evidence-auditor

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- canonical preflight와 MD capability/renderer/format QA 상태
- human review 전 non-terminal job, fact/inference/recommendation

#### 선택 결과물
- resumable action

#### 확장 결과물
- downstream handoff

### 파일 구조
- game-design-career/career-evidence/export-beginner/content.md
- game-design-career/career-evidence/export-beginner/evidence.yml
- game-design-career/career-evidence/export-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/export-beginner/content.md
- game-design-career/career-evidence/export-beginner/evidence.yml
- game-design-career/career-evidence/export-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s03
- SVG: guides/assets/game-design-career/skills/export-career-documents.svg
- PNG: guides/assets/game-design-career/skills/export-career-documents.png
- 대체 텍스트: Career 문서 출력 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor는 구조/format finding만 검토한다. evidence-auditor는 evidence completion gate를 검토한다. named human decision owner가 승인/보류한다. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다.

#### 보류 조건
- canonical preflight가 passed가 아님
- renderer capability가 unknown

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-beginner의 canonical preflight와 MD job을 보존하고 capability probe 후 재개해.
```

</details>
<!-- PROMPT-CARD: career:export-career-documents:standard -->
## career:export-career-documents:standard

**게임 기획 결과: PDF·DOCX preflight**

PDF·DOCX 요청을 canonical preflight, capability probe, renderer, format QA와 human review의 non-terminal job으로 정리한다.

### 간단 요청 예시
```text
@Game Design Career canonical artifact의 PDF·DOCX를 preflight하고 capability probe, renderer, format QA, human review를 정리해. actual output 전 전달 완료를 표시하지 말고 fact, inference, recommendation을 구분해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 짧은 흐름
- 작업 순서: export-career-documents
- 함께 검토하는 역할: document-quality-editor → evidence-auditor

### 이 요청으로 받는 결과
초안 결과: 내보내기 전 점검에 낡은 우주선을 수리하는 탐사대 맥락을 반영했습니다. 사람의 확인 전까지 값과 결정은 미정입니다. (ID: career:export-career-documents:standard; 파일: game-design-career/career-evidence/export-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
검증된 canonical artifact의 PDF와 DOCX 파생본을 준비할 때 사용한다.

### 사용하지 않는 경우
renderer capability나 format QA 없이 generated file·전달 완료를 주장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical artifact ID
- PDF DOCX formats
- canonical preflight
- capability probes

#### 선택 입력
- human reviewer

### 바꿀 자리표시자
- [canonical artifact ID]
- [PDF DOCX formats]
- [canonical preflight]
- [capability probes]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [canonical artifact ID]의 [PDF DOCX formats]를 [canonical preflight], [capability probes]로 준비해. renderer, format QA, human review와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:export-career-documents artifact=career/interview formats=pdf,docx canonicalPreflight=passed probes=pdf:available,docx:unknown job을 준비해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:export-career-documents artifact=[canonical artifact ID] formats=[PDF DOCX formats] canonicalPreflight=[canonical preflight] probes=[capability probes] renderer format QA human review와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-career-documents
- 스킬 흐름: export-career-documents
- 전문 역할: document-quality-editor → evidence-auditor

### 중간 산출물
- interview-question-answer-log

### 예상 결과물
#### 최소 결과물
- PDF·DOCX canonical preflight, capability, renderer, format QA
- human review 전 non-terminal status와 fact/inference/recommendation

#### 선택 결과물
- per-format resume action

#### 확장 결과물
- trusted downstream handoff

### 파일 구조
- game-design-career/career-evidence/export-standard/content.md
- game-design-career/career-evidence/export-standard/evidence.yml
- game-design-career/career-evidence/export-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/export-standard/content.md
- game-design-career/career-evidence/export-standard/evidence.yml
- game-design-career/career-evidence/export-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s03
- SVG: guides/assets/game-design-career/skills/export-career-documents.svg
- PNG: guides/assets/game-design-career/skills/export-career-documents.png
- 대체 텍스트: Career 문서 출력 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor는 구조/format finding만 검토한다. evidence-auditor는 evidence completion gate를 검토한다. named human decision owner가 승인/보류한다. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다.

#### 보류 조건
- canonical preflight가 incomplete
- 요청 format의 capability probe가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-standard의 PDF·DOCX preflight를 보존하고 capability probe 결과 후 재개해.
```

</details>
<!-- PROMPT-CARD: career:export-career-documents:advanced -->
## career:export-career-documents:advanced

**게임 기획 결과: recruiter PPTX·format QA·재개**

recruiter PPTX를 canonical preflight와 renderer capability, format QA, human review로 fail-closed 준비하고 재개 조건을 남긴다.

### 간단 요청 예시
```text
@Game Design Career recruiter PPTX를 canonical preflight, renderer capability, format QA, human review와 resumable hold로 준비해. actual output 전 전달 완료를 표시하지 말고 fact, inference, recommendation을 구분해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 짧은 흐름
- 작업 순서: export-career-documents
- 함께 검토하는 역할: document-quality-editor → evidence-auditor

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 내보내기 전 점검 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: career:export-career-documents:advanced; 파일: game-design-career/career-evidence/export-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
recruiter audience용 PPTX와 복수 포맷의 downstream QA handoff를 준비할 때 사용한다.

### 사용하지 않는 경우
canonical preflight·renderer·format QA·human review 전 actual output 또는 전달 완료를 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- canonical artifact ID
- recruiter PPTX purpose
- canonical preflight
- renderer capability

#### 선택 입력
- format QA owner

### 바꿀 자리표시자
- [canonical artifact ID]
- [recruiter PPTX purpose]
- [canonical preflight]
- [renderer capability]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [canonical artifact ID]의 [recruiter PPTX purpose]를 [canonical preflight], [renderer capability]로 준비해. format QA, human review, hold/resume와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:export-career-documents artifact=career/transition format=pptx purpose=recruiter canonicalPreflight=passed renderer=unknown fail-closed job을 준비해. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:export-career-documents artifact=[canonical artifact ID] format=pptx purpose=[recruiter PPTX purpose] canonicalPreflight=[canonical preflight] renderer=[renderer capability] format QA human review와 fact, inference, recommendation을 기록하고 actual output 전 전달 완료를 표시하지 마. canonical preflight, capability, renderer, format QA, human review가 모두 통과하기 전 actual output과 delivery completion 모두 표시 금지. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다. document-quality-editor는 구조/format finding만, evidence-auditor는 evidence completion gate를 검토하고 named human decision owner가 승인/보류한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: export-career-documents
- 스킬 흐름: export-career-documents
- 전문 역할: document-quality-editor → evidence-auditor

### 중간 산출물
- transition-readiness

### 예상 결과물
#### 최소 결과물
- recruiter PPTX canonical preflight, capability, renderer, format QA
- human review와 hold/resume non-terminal job
- fact/inference/recommendation; actual output 전 전달 완료 금지

#### 선택 결과물
- PPTX story outline

#### 확장 결과물
- trusted downstream renderer handoff

### 파일 구조
- game-design-career/career-evidence/export-advanced/content.md
- game-design-career/career-evidence/export-advanced/evidence.yml
- game-design-career/career-evidence/export-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-evidence/export-advanced/content.md
- game-design-career/career-evidence/export-advanced/evidence.yml
- game-design-career/career-evidence/export-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s03
- SVG: guides/assets/game-design-career/skills/export-career-documents.svg
- PNG: guides/assets/game-design-career/skills/export-career-documents.png
- 대체 텍스트: Career 문서 출력 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor는 구조/format finding만 검토한다. evidence-auditor는 evidence completion gate를 검토한다. named human decision owner가 승인/보류한다. downstream workflow가 actual output을 소유하며 이 prompt는 preparation/hold만 소유한다.

#### 보류 조건
- canonical preflight가 passed가 아님
- renderer capability 또는 format QA owner가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. fact, inference, recommendation을 분리하며 실제 경험·기여·성과·채용 가능성·합격을 발명하거나 보장하지 않는다. 현재 job, company, 고용주, 공고를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 기록한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
export-advanced의 canonical preflight와 PPTX hold를 보존하고 renderer capability와 human review 확인 후 재개해.
```

</details>
