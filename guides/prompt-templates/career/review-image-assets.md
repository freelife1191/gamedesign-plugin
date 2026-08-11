# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:review-image-assets:beginner -->
## career:review-image-assets:beginner

**문서용 이미지 시안 검토 요청**

concept-draft 이미지를 문서 삽입 후보로 검토하되 portfolio publication이나 실제 game resource를 승인하지 않는다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [placement], [named human reviewer]를 사용해 문서 concept 이미지 검토 요청를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다.
```

### 짧은 흐름
- 작업 순서: review-image-assets
- 함께 검토하는 역할: visual-asset-reviewer → art-brief-director

### 이 요청으로 받는 결과
표지 시안은 문서 주제와 맞지만 작은 화면에서 부제가 읽히지 않는다는 의견을 남겼습니다. 글자 크기를 키운 수정안과 권리 근거를 사람이 확인하기 전에는 보류 상태입니다. (ID: career:review-image-assets:beginner; 파일: career/visual/review-image-assets/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
문서 concept 이미지 검토 요청에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [stable asset ID]
- [placement]
- [named human reviewer]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [placement]
- [named human reviewer]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [stable asset ID], [placement], [named human reviewer]를 사용해 문서 concept 이미지 검토 요청를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-image-assets artifact=career/sample-artifact inputs="sample-input, [placement], [named human reviewer]" 문서 concept 이미지 검토 요청를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-image-assets artifact=[Canonical Artifact] inputs="[stable asset ID], [placement], [named human reviewer]" 문서 concept 이미지 검토 요청를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- stable asset ID finding
- named human decision receipt
- rights/provenance·alt text·readability record
- accepted or held lifecycle transition

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/review-image-assets/beginner/content.md
- career/visual/review-image-assets/beginner/evidence.yml
- career/visual/review-image-assets/beginner/export-manifest.yml
- career/visual/review-image-assets/beginner/assets/README.md

### 읽는 순서
- career/visual/review-image-assets/beginner/content.md
- career/visual/review-image-assets/beginner/evidence.yml
- career/visual/review-image-assets/beginner/export-manifest.yml
- career/visual/review-image-assets/beginner/assets/README.md

### 도식 바인딩
- ID: ca-s13
- SVG: guides/assets/game-design-career/skills/review-image-assets.svg
- PNG: guides/assets/game-design-career/skills/review-image-assets.png
- 대체 텍스트: Career 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
named human reviewer와 rights/visual reviewer owner가 stable asset ID, evidence, rights, alt text와 readability를 검토해 승인·수정·보류한다. actual portfolio publication과 game resource 승인은 별도 named human reviewer evidence가 필요하다.

#### 보류 조건
- named human reviewer evidence가 없음
- rights/provenance 또는 attribution/source가 미정
- alt text 또는 readability evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
review-image-assets/beginner의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:review-image-assets:standard -->
## career:review-image-assets:standard

**이미지 공개 권리와 문서 가독성 검토**

공개 권리, source·attribution, alt text, readability와 named human reviewer evidence로 document-approved 전이를 검토한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [placement], [alt text], [readability evidence]를 사용해 공개 권리·가독성 document approval를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=document-approved 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### 짧은 흐름
- 작업 순서: review-image-assets
- 함께 검토하는 역할: visual-asset-reviewer → art-brief-director

### 이 요청으로 받는 결과
검토한 ASSET-CASE-02는 출처 표기가 확인됐지만 대체 문구가 화면의 핵심 변화를 설명하지 못합니다. 문구 수정과 배치 확인이 끝난 뒤에만 문서 사용 여부를 결정합니다. (ID: career:review-image-assets:standard; 파일: career/visual/review-image-assets/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
공개 권리·가독성 document approval에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- stable asset ID
- targetState=document-approved
- actual user decision
- reviewedAt
- immutable structured host-user-image-decision receipt
- named human reviewer
- rightsDecision
- placement
- alt text
- readability evidence
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [targetState]
- [actual user decision]
- [reviewedAt]
- [immutable host-user-image-decision receipt]
- [named human reviewer]
- [rightsDecision]
- [placement]
- [alt text]
- [readability evidence]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [stable asset ID], [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [placement], [alt text], [readability evidence]를 사용해 공개 권리·가독성 document approval를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=document-approved 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-image-assets artifact=career/sample-artifact inputs="sample-input, [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [placement], [alt text], [readability evidence]" 공개 권리·가독성 document approval를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=document-approved 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-image-assets artifact=[Canonical Artifact] inputs="[stable asset ID], [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [placement], [alt text], [readability evidence]" 공개 권리·가독성 document approval를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=document-approved 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- portfolio-project-brief

### 예상 결과물
#### 최소 결과물
- stable asset ID finding
- named human decision receipt
- rights/provenance·alt text·readability record
- accepted or held lifecycle transition

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/review-image-assets/standard/content.md
- career/visual/review-image-assets/standard/evidence.yml
- career/visual/review-image-assets/standard/export-manifest.yml
- career/visual/review-image-assets/standard/assets/README.md

### 읽는 순서
- career/visual/review-image-assets/standard/content.md
- career/visual/review-image-assets/standard/evidence.yml
- career/visual/review-image-assets/standard/export-manifest.yml
- career/visual/review-image-assets/standard/assets/README.md

### 도식 바인딩
- ID: ca-s13
- SVG: guides/assets/game-design-career/skills/review-image-assets.svg
- PNG: guides/assets/game-design-career/skills/review-image-assets.png
- 대체 텍스트: Career 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
named human reviewer와 rights/visual reviewer owner가 stable asset ID, evidence, rights, placement, alt text와 readability를 검토해 승인·수정·보류한다. actual portfolio publication과 game resource 승인은 별도 named human reviewer evidence가 필요하다.

#### 보류 조건
- evidenceKey=targetState — targetState가 누락·불일치
- evidenceKey=actualUserDecision — actual user decision이 누락·불일치
- evidenceKey=reviewedAt — reviewedAt이 누락·불일치
- evidenceKey=hostUserImageDecisionReceipt — immutable structured host-user-image-decision receipt가 누락·불일치
- evidenceKey=namedHumanReviewer — named human reviewer가 없음
- evidenceKey=rightsDecision — rightsDecision evidence가 없음
- evidenceKey=placement — placement가 미정
- evidenceKey=altText — alt text가 미정
- evidenceKey=readability — readability evidence가 미정

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
review-image-assets/standard의 검증된 evidence만 보존하고, repair/verify evidenceKeys=[targetState,actualUserDecision,reviewedAt,hostUserImageDecisionReceipt,namedHumanReviewer,rightsDecision,placement,altText,readability]의 실제 누락·불일치를 각각 보완·검증한 뒤 current state의 hold 지점부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:review-image-assets:advanced -->
## career:review-image-assets:advanced

**제작 후보 이미지의 반복 검토 기록**

production-candidate 검토 주기를 기록하되 실제 portfolio publication·game resource 승격·legal approval을 자동 승인하지 않는다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [active-rights evidence], [technical fit evidence], [alt text], [readability evidence]를 사용해 production candidate·review cycle 증빙를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=production-candidate 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt, rightsDecision, active-rights evidence, technical fit evidence, alt text와 readability evidence가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### 짧은 흐름
- 작업 순서: review-image-assets
- 함께 검토하는 역할: visual-asset-reviewer → art-brief-director

### 이 요청으로 받는 결과
세 번째 검토본은 색 대비 기준을 통과했지만 원본 라이선스의 유효 기간을 다시 확인해야 합니다. 기술 규격은 적합 후보로 표시했고 실제 포트폴리오 공개 승인은 별도로 남겨 뒀습니다. (ID: career:review-image-assets:advanced; 파일: career/visual/review-image-assets/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
production candidate·review cycle 증빙에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- stable asset ID
- targetState=production-candidate
- actual user decision
- reviewedAt
- immutable structured host-user-image-decision receipt
- named human reviewer
- rightsDecision
- active-rights evidence
- technical fit evidence
- alt text
- readability evidence
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [targetState]
- [actual user decision]
- [reviewedAt]
- [immutable host-user-image-decision receipt]
- [named human reviewer]
- [rightsDecision]
- [active-rights evidence]
- [technical fit evidence]
- [alt text]
- [readability evidence]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [stable asset ID], [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [active-rights evidence], [technical fit evidence], [alt text], [readability evidence]를 사용해 production candidate·review cycle 증빙를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=production-candidate 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt, rightsDecision, active-rights evidence, technical fit evidence, alt text와 readability evidence가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:review-image-assets artifact=career/sample-artifact inputs="sample-input, [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [active-rights evidence], [technical fit evidence], [alt text], [readability evidence]" production candidate·review cycle 증빙를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=production-candidate 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt, rightsDecision, active-rights evidence, technical fit evidence, alt text와 readability evidence가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:review-image-assets artifact=[Canonical Artifact] inputs="[stable asset ID], [targetState], [actual user decision], [reviewedAt], [immutable host-user-image-decision receipt], [named human reviewer], [rightsDecision], [active-rights evidence], [technical fit evidence], [alt text], [readability evidence]" production candidate·review cycle 증빙를 수행해. existing asset와 immutable receipt만 검토하고 provider/image generation 호출 금지다. concept-draft → document-approved → production-candidate를 건너뛰지 않는다. generation은 승인 아님이며 actual portfolio publication과 game resource는 named human reviewer evidence 없이는 자동 승인 금지다. targetState=production-candidate 전이는 actual user decision, reviewedAt, immutable structured host-user-image-decision receipt, rightsDecision, active-rights evidence, technical fit evidence, alt text와 readability evidence가 모두 일치할 때만 검토한다. 누락 또는 불일치면 current state 유지·hold하고 evidence를 보존해 재개한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- stable asset ID finding
- named human decision receipt
- rights/provenance·alt text·readability record
- accepted or held lifecycle transition

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/review-image-assets/advanced/content.md
- career/visual/review-image-assets/advanced/evidence.yml
- career/visual/review-image-assets/advanced/export-manifest.yml
- career/visual/review-image-assets/advanced/assets/README.md

### 읽는 순서
- career/visual/review-image-assets/advanced/content.md
- career/visual/review-image-assets/advanced/evidence.yml
- career/visual/review-image-assets/advanced/export-manifest.yml
- career/visual/review-image-assets/advanced/assets/README.md

### 도식 바인딩
- ID: ca-s13
- SVG: guides/assets/game-design-career/skills/review-image-assets.svg
- PNG: guides/assets/game-design-career/skills/review-image-assets.png
- 대체 텍스트: Career 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
named human reviewer와 production reviewer owner가 stable asset ID, evidence, rights와 active-rights, technical fit, alt text와 readability를 검토해 승인·수정·보류한다. actual portfolio publication과 game resource 승인은 별도 named human reviewer evidence가 필요하다.

#### 보류 조건
- evidenceKey=targetState — targetState가 누락·불일치
- evidenceKey=actualUserDecision — actual user decision이 누락·불일치
- evidenceKey=reviewedAt — reviewedAt이 누락·불일치
- evidenceKey=hostUserImageDecisionReceipt — immutable structured host-user-image-decision receipt가 누락·불일치
- evidenceKey=namedHumanReviewer — named human reviewer가 없음
- evidenceKey=rightsDecision — rightsDecision이 누락·불일치
- evidenceKey=activeRights — active-rights evidence가 누락·불일치
- evidenceKey=technicalFit — technical fit evidence가 누락·불일치
- evidenceKey=altText — alt text가 미정
- evidenceKey=readability — readability evidence가 누락·불일치

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
review-image-assets/advanced의 검증된 evidence만 보존하고, repair/verify evidenceKeys=[targetState,actualUserDecision,reviewedAt,hostUserImageDecisionReceipt,namedHumanReviewer,rightsDecision,activeRights,technicalFit,altText,readability]의 실제 누락·불일치를 각각 보완·검증한 뒤 current state의 hold 지점부터 재개해.
```

</details>
