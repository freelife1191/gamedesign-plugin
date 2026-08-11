# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:apply-document-quality-profile:beginner -->
## career:apply-document-quality-profile:beginner

**목표 역할 문서에 맞는 품질 기준 고르기**

목표 역할 문서 하나에 맞는 template과 primary quality profile을 선택하고 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career 시스템 기획 입문 role map Artifact의 대상 독자와 Markdown 형식에 맞는 template, primary quality profile, 누락 입력을 선택해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile
- 함께 검토하는 역할: document-quality-editor

### 이 요청으로 받는 결과
입문용 시스템 기획 역할 지도에는 ‘경력 탐색 문서’ 품질 기준을 선택했습니다. 독자와 문서 형식은 확인됐지만 역할 근거가 빠져 있어 선택은 편집자 검토 전 상태입니다. (ID: career:apply-document-quality-profile:beginner; 파일: game-design-career/career-foundations/profile-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
role map을 쓰기 전에 목표 역할 문서의 대상과 형식을 고정할 때 사용한다.

### 사용하지 않는 경우
경험·기여·채용 확률이나 합격을 발명하거나 보장해야 하는 요청에는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact ID
- 목표 역할 문서 목적
- 대상 독자
- 형식
- template ID

#### 선택 입력
- 기존 selection record
- 알려진 evidence ID

### 바꿀 자리표시자
- [문서 Artifact]
- [대상 독자]
- [형식]
- [template ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [문서 Artifact]의 [대상 독자]용 [형식] 문서에 [template ID] template과 primary quality profile, 누락 입력을 선택해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:apply-document-quality-profile artifact=career/role-map template=game-design-role-map 시스템 기획 입문 문서의 대상, Markdown 형식과 profile을 선택해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:apply-document-quality-profile artifact=[문서 Artifact] template=[template ID] [대상 독자]용 [형식] 문서 profile과 누락 입력을 선택해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile
- 전문 역할: document-quality-editor

### 중간 산출물
- game-design-role-map

### 예상 결과물
#### 최소 결과물
- primary quality profile
- 선택 이유
- 누락 입력
- fact/inference/recommendation label

#### 선택 결과물
- selection record

#### 확장 결과물
- requirement manifest

### 파일 구조
- game-design-career/career-foundations/profile-beginner/content.md
- game-design-career/career-foundations/profile-beginner/evidence.yml
- game-design-career/career-foundations/profile-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/profile-beginner/content.md
- game-design-career/career-foundations/profile-beginner/evidence.yml
- game-design-career/career-foundations/profile-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s01
- SVG: guides/assets/game-design-career/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-career/skills/apply-document-quality-profile.png
- 대체 텍스트: Career 문서 품질 프로필 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor owner가 profile 선택을 검토하고 승인 또는 보류한다. selection record는 문서 승인 자체가 아니다.

#### 보류 조건
- template ID가 미정
- 서로 다른 Artifact의 profile을 하나로 단정함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
profile-beginner selection record를 보존하고 확인된 대상과 형식만 반영해 누락 입력 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:apply-document-quality-profile:standard -->
## career:apply-document-quality-profile:standard

**독자와 형식에 맞춘 문서 품질 설정**

audience, format, preset을 한 Artifact에 맞추고 fact, inference, recommendation 경계를 기록한다.

### 간단 요청 예시
```text
@Game Design Career portfolio-reviewer audience의 Markdown portfolio brief에 맞게 template, preset, quality checklist와 빠진 입력을 선택해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile
- 함께 검토하는 역할: document-quality-editor → portfolio-reviewer

### 이 요청으로 받는 결과
포트폴리오 검토자용 마크다운 문서에 간결한 사례 중심 설정을 골랐습니다. 첫 화면에서 문제·판단·근거가 보이는지 확인하는 항목을 추가했으며 최종 선택은 검토자가 결정합니다. (ID: career:apply-document-quality-profile:standard; 파일: game-design-career/career-foundations/profile-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
포트폴리오 brief와 reviewer audience에 맞는 preset을 고정할 때 사용한다.

### 사용하지 않는 경우
근거 없는 지원 적합성이나 채용 결과를 평가할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact ID
- audience
- requested format
- template ID
- preset 후보

#### 선택 입력
- 기존 quality checklist
- review question

### 바꿀 자리표시자
- [Artifact]
- [audience]
- [format]
- [preset]
- [template ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Artifact]의 [audience]용 [format] 문서에 [template ID]와 [preset]을 선택하고 quality checklist와 누락 입력을 정리해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:apply-document-quality-profile artifact=career/portfolio template=portfolio-project-brief audience=portfolio-reviewer format=md preset=career-portfolio profile과 checklist를 선택해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:apply-document-quality-profile artifact=[Artifact] template=[template ID] audience=[audience] format=[format] preset=[preset] profile과 checklist를 선택해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile
- 전문 역할: document-quality-editor → portfolio-reviewer

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- audience/format/preset 선택
- quality checklist
- fact/inference/recommendation label

#### 선택 결과물
- additive source 후보

#### 확장 결과물
- requirement manifest
- profile conflict note

### 파일 구조
- game-design-career/career-foundations/profile-standard/content.md
- game-design-career/career-foundations/profile-standard/evidence.yml
- game-design-career/career-foundations/profile-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/profile-standard/content.md
- game-design-career/career-foundations/profile-standard/evidence.yml
- game-design-career/career-foundations/profile-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s01
- SVG: guides/assets/game-design-career/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-career/skills/apply-document-quality-profile.png
- 대체 텍스트: Career 문서 품질 프로필 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor owner와 portfolio-reviewer가 preset을 검토하고 승인 또는 보류한다. profile 선택은 포트폴리오 품질이나 채용 결과를 보장하지 않는다.

#### 보류 조건
- audience와 format이 충돌함
- unknown preset을 사실처럼 적용하려 함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
profile-standard의 preset과 checklist를 보존하고 확인된 audience와 format만 반영해 conflict 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:apply-document-quality-profile:advanced -->
## career:apply-document-quality-profile:advanced

**근거 상태와 대체 기준을 함께 보는 문서 품질 설정**

evidence state, fallback, reviewer boundary를 확인해 profile conflict를 안전하게 보류하고 fact, inference, recommendation을 분리한다.

### 간단 요청 예시
```text
@Game Design Career reverse-design Artifact의 evidence state와 fallback 후보를 확인하고 reviewer가 검토할 profile conflict와 resume 조건을 정리해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: apply-document-quality-profile
- 함께 검토하는 역할: document-quality-editor → evidence-auditor

### 이 요청으로 받는 결과
역기획 문서의 플레이 로그가 일부만 남아 있어 근거 상태를 ‘부분 확인’으로 표시했습니다. 원본 영상을 대신할 캡처 목록은 제안일 뿐이며 근거 감사자의 확인 전에는 적용하지 않습니다. (ID: career:apply-document-quality-profile:advanced; 파일: game-design-career/career-foundations/profile-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
기존 evidence 상태가 불완전하거나 profile fallback이 필요한 Artifact를 검토할 때 사용한다.

### 사용하지 않는 경우
검토자가 없는 상태에서 unknown fallback을 승인하거나 합격을 예측할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- artifact ID
- template ID
- evidence state
- fallback 후보
- reviewer

#### 선택 입력
- selection digest
- conflict record

### 바꿀 자리표시자
- [Artifact]
- [evidence state]
- [fallback]
- [reviewer]
- [template ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Artifact]의 [template ID]에 [evidence state]와 [fallback]을 기록하고 [reviewer] 검토 전 profile conflict와 resume 조건을 정리해 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:apply-document-quality-profile artifact=career/reverse template=reverse-design-document evidenceState=partial fallback=nearest-compatible reviewer=document-quality-editor conflict와 resume 조건을 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:apply-document-quality-profile artifact=[Artifact] template=[template ID] evidenceState=[evidence state] fallback=[fallback] reviewer=[reviewer] conflict와 resume 조건을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: apply-document-quality-profile
- 스킬 흐름: apply-document-quality-profile
- 전문 역할: document-quality-editor → evidence-auditor

### 중간 산출물
- reverse-design-document

### 예상 결과물
#### 최소 결과물
- evidence state
- fallback 조건
- reviewer boundary
- fact/inference/recommendation label

#### 선택 결과물
- selection digest

#### 확장 결과물
- immutable state envelope
- conflict decision record

### 파일 구조
- game-design-career/career-foundations/profile-advanced/content.md
- game-design-career/career-foundations/profile-advanced/evidence.yml
- game-design-career/career-foundations/profile-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/profile-advanced/content.md
- game-design-career/career-foundations/profile-advanced/evidence.yml
- game-design-career/career-foundations/profile-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s01
- SVG: guides/assets/game-design-career/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-career/skills/apply-document-quality-profile.png
- 대체 텍스트: Career 문서 품질 프로필 직접 호출 흐름

### 사람 검토
#### 승인 경계
document-quality-editor owner가 evidence state와 fallback을 검토하고 evidence-auditor와 함께 승인 또는 보류한다. fallback은 source 사실을 대체하지 않는다.

#### 보류 조건
- evidence state가 미정
- fallback이 reviewer 승인 없이 current fact를 변경함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
profile-advanced evidence state와 conflict record를 보존하고 reviewer 확인을 반영해 fallback 검토부터 재개해.
```

</details>
