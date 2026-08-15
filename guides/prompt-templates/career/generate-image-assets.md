# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:generate-image-assets:beginner -->
## career:generate-image-assets:beginner

**선택한 포트폴리오 표지 시안 만들기**

실제 사용자가 선택한 stable asset ID의 cover concept를 제한된 생성 경로로 보내고 concept-draft 상태를 보존한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [selection receipt]를 사용해 선택한 포트폴리오 cover concept 생성 경로를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=select.
```

### 짧은 흐름
- 작업 순서: plan-image-assets → generate-image-assets
- 함께 검토하는 역할: art-brief-director → visual-asset-reviewer

### 이 요청으로 받는 결과
표지 자산 ASSET-COVER-01에는 격자 종이 위 규칙 카드와 연필이 놓인 차분한 시안을 선택했습니다. 생성 기록과 프롬프트는 남겼지만 포트폴리오 사용 여부는 시각 담당자 검토 전입니다. (ID: career:generate-image-assets:beginner; 파일: career/visual/generate-image-assets/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
선택한 포트폴리오 cover concept 생성 경로에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [selected stable asset IDs]
- [selection receipt]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [selected stable asset IDs]
- [selection receipt]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [selected stable asset IDs], [selection receipt]를 사용해 선택한 포트폴리오 cover concept 생성 경로를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=select.
```

### Codex CLI 완성 예시
```text
$game-design-career:generate-image-assets artifact=career/sample-artifact inputs="sample-input, [selection receipt]" 선택한 포트폴리오 cover concept 생성 경로를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=select.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:generate-image-assets artifact=[Canonical Artifact] inputs="[selected stable asset IDs], [selection receipt]" 선택한 포트폴리오 cover concept 생성 경로를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=select.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: plan-image-assets → generate-image-assets
- 전문 역할: art-brief-director → visual-asset-reviewer

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- mode·selected IDs·provider decision
- prompt·placeholder·provenance receipt
- concept-draft per-asset result
- named human review handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/generate-image-assets/beginner/content.md
- career/visual/generate-image-assets/beginner/evidence.yml
- career/visual/generate-image-assets/beginner/export-manifest.yml
- career/visual/generate-image-assets/beginner/assets/README.md

### 읽는 순서
- career/visual/generate-image-assets/beginner/content.md
- career/visual/generate-image-assets/beginner/evidence.yml
- career/visual/generate-image-assets/beginner/export-manifest.yml
- career/visual/generate-image-assets/beginner/assets/README.md

### 도식 바인딩
- ID: ca-s04
- SVG: guides/assets/game-design-career/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-career/skills/generate-image-assets.png
- 대체 텍스트: Career 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
generate-image-assets/beginner의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:generate-image-assets:standard -->
## career:generate-image-assets:standard

**증명 이미지의 생성 이력과 출처 기록**

선택한 proof 이미지의 provider result, prompt/output digest, receipt와 provenance를 named human review 이전에 기록한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [source attribution]를 사용해 proof 이미지 receipt와 provenance 기록를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=required.
```

### 짧은 흐름
- 작업 순서: plan-image-assets → generate-image-assets → review-image-assets
- 함께 검토하는 역할: art-brief-director → visual-asset-reviewer

### 이 요청으로 받는 결과
수정 전후 비교 도표 두 장에 선택 자산 ID, 생성 방식, 프롬프트, 원본 근거 주소를 연결했습니다. 두 결과 모두 사람 검토 전 시안이며 실제 작업 증거를 대신하지 않습니다. (ID: career:generate-image-assets:standard; 파일: career/visual/generate-image-assets/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
proof 이미지 receipt와 provenance 기록에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [selected stable asset IDs]
- [source attribution]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [selected stable asset IDs]
- [source attribution]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [selected stable asset IDs], [source attribution]를 사용해 proof 이미지 receipt와 provenance 기록를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=required.
```

### Codex CLI 완성 예시
```text
$game-design-career:generate-image-assets artifact=career/sample-artifact inputs="sample-input, [source attribution]" proof 이미지 receipt와 provenance 기록를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=required.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:generate-image-assets artifact=[Canonical Artifact] inputs="[selected stable asset IDs], [source attribution]" proof 이미지 receipt와 provenance 기록를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=required.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: plan-image-assets → generate-image-assets → review-image-assets
- 전문 역할: art-brief-director → visual-asset-reviewer

### 중간 산출물
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- mode·selected IDs·provider decision
- prompt·placeholder·provenance receipt
- concept-draft per-asset result
- named human review handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/generate-image-assets/standard/content.md
- career/visual/generate-image-assets/standard/evidence.yml
- career/visual/generate-image-assets/standard/export-manifest.yml
- career/visual/generate-image-assets/standard/assets/README.md

### 읽는 순서
- career/visual/generate-image-assets/standard/content.md
- career/visual/generate-image-assets/standard/evidence.yml
- career/visual/generate-image-assets/standard/export-manifest.yml
- career/visual/generate-image-assets/standard/assets/README.md

### 도식 바인딩
- ID: ca-s04
- SVG: guides/assets/game-design-career/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-career/skills/generate-image-assets.png
- 대체 텍스트: Career 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
generate-image-assets/standard의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:generate-image-assets:advanced -->
## career:generate-image-assets:advanced

**이미지 생성 실패 기록과 재시도 인계**

provider failure를 숨기지 않고 prompt·placeholder·provenance를 보존해 재시도 조건과 review handoff를 분리한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [retry owner], [failure receipt]를 사용해 provider failure·provenance·retry handoff를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=all.
```

### 짧은 흐름
- 작업 순서: plan-image-assets → generate-image-assets → review-image-assets
- 함께 검토하는 역할: art-brief-director → visual-asset-reviewer

### 이 요청으로 받는 결과
과정 이미지 ASSET-PROCESS-03 생성이 시간 초과로 멈춰 실패 시각과 사용한 입력을 기록했습니다. 자산 식별자는 유지하고 낮은 해상도 재시도안을 남겼으며 실행 여부는 담당자 검토 뒤 정합니다. (ID: career:generate-image-assets:advanced; 파일: career/visual/generate-image-assets/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
provider failure·provenance·retry handoff에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [failed stable asset ID]
- [retry owner]
- [failure receipt]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [failed stable asset ID]
- [retry owner]
- [failure receipt]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [failed stable asset ID], [retry owner], [failure receipt]를 사용해 provider failure·provenance·retry handoff를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=all.
```

### Codex CLI 완성 예시
```text
$game-design-career:generate-image-assets artifact=career/sample-artifact inputs="sample-input, [retry owner], [failure receipt]" provider failure·provenance·retry handoff를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=all.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:generate-image-assets artifact=[Canonical Artifact] inputs="[failed stable asset ID], [retry owner], [failure receipt]" provider failure·provenance·retry handoff를 수행해. IMAGE_PROVIDER=codex-first와 IMAGE_QUALITY=low를 기본으로 써 host image_gen을 먼저 사용한다. API key 존재는 유료 승인이 아니며 자동 fallback은 금지한다. 한글 문자가 이미지 안에 필요하면 IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR과 explicit OpenAI gpt-image-2 비용을 먼저 안내하고 승인 뒤 실행한다. medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art에만 비용 승인 뒤 사용한다. 생성 결과는 concept-draft이며 portfolio ownership, document use 또는 publication을 증명하지 않는다. IMAGE_GEN_MODE=all.
```

### 스킬·전문 역할 흐름
- 기본 스킬: generate-image-assets
- 스킬 흐름: plan-image-assets → generate-image-assets → review-image-assets
- 전문 역할: art-brief-director → visual-asset-reviewer

### 중간 산출물
- portfolio-backlog

### 예상 결과물
#### 최소 결과물
- mode·selected IDs·provider decision
- prompt·placeholder·provenance receipt
- concept-draft per-asset result
- named human review handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/generate-image-assets/advanced/content.md
- career/visual/generate-image-assets/advanced/evidence.yml
- career/visual/generate-image-assets/advanced/export-manifest.yml
- career/visual/generate-image-assets/advanced/assets/README.md

### 읽는 순서
- career/visual/generate-image-assets/advanced/content.md
- career/visual/generate-image-assets/advanced/evidence.yml
- career/visual/generate-image-assets/advanced/export-manifest.yml
- career/visual/generate-image-assets/advanced/assets/README.md

### 도식 바인딩
- ID: ca-s04
- SVG: guides/assets/game-design-career/skills/generate-image-assets.svg
- PNG: guides/assets/game-design-career/skills/generate-image-assets.png
- 대체 텍스트: Career 이미지 자산 생성 직접 호출 흐름

### 사람 검토
#### 승인 경계
art-brief-director owner가 입력, source, rights/attribution, alt text와 handoff를 승인·수정·보류한다. 생성 또는 actual portfolio publication은 named human reviewer evidence 없이는 승인하지 않는다.

#### 보류 조건
- Canonical Artifact 또는 stable asset ID가 없음
- rights/attribution 또는 source가 미정
- named decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
generate-image-assets/advanced의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
