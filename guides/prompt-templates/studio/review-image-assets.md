# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:review-image-assets:beginner -->
## studio:review-image-assets:beginner

**concept-draft 문서 적합성 검토**

concept-draft asset의 purpose·placement·alt text·readability gap을 발견하지만 사람 결정 없이 lifecycle을 바꾸지 않는다.

### 사용하는 경우
concept-draft asset의 문서 삽입 전 검토 질문과 evidence gap을 기록할 때 사용한다.

### 사용하지 않는 경우
agent finding만으로 document-approved를 기록하거나 새 이미지를 만들 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- stable asset ID
- current lifecycle state
- placement
- alt text
- artifact-local evidence

#### 선택 입력
- readability finding
- rights question

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [current lifecycle state]

### Codex App 완성 예시
```text
@Game Design Studio concept-draft hero-keyart-01의 purpose, placement, alt text와 readability evidence gap을 검토해. named human 결정 없이는 상태를 바꾸지 마.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable asset ID]가 [current lifecycle state]일 때 purpose, placement, alt text와 readability gap을 검토해. named human 결정 없이는 상태를 바꾸지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-image-assets artifact=game-design/coop/brief assetId=hero-keyart-01 targetState=document-approved concept-draft evidence gap만 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-image-assets artifact=[Canonical Artifact] assetId=[stable asset ID] state=[current lifecycle state] evidence gap만 기록하고 사람 결정 없이는 transition하지 마.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- stable asset ID finding
- placement·alt·readability gap
- blocked document approval
- derivative ineligibility

#### 선택 결과물
- rights question
- recommended revision

#### 확장 결과물
- named human decision handoff

### 파일 구조
- game-design/studio-visual/review-beginner/content.md
- game-design/studio-visual/review-beginner/evidence.yml
- game-design/studio-visual/review-beginner/export-manifest.yml
- game-design/studio-visual/review-beginner/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/review-beginner/content.md
- game-design/studio-visual/review-beginner/evidence.yml
- game-design/studio-visual/review-beginner/export-manifest.yml
- game-design/studio-visual/review-beginner/assets/image-assets.yml

### 도식 바인딩
- ID: st-s13
- SVG: guides/assets/game-design-studio/skills/review-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/review-image-assets.png
- 대체 텍스트: 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
이름 있는 사람인 visual-asset-reviewer owner가 evidence gap을 승인·수정·보류하며 specialist finding은 document-approved가 아니다.

#### 보류 조건
- stable asset ID가 없음
- placement 또는 alt text가 없음
- human decision evidence가 없음

#### 안전 경계
모르는 review evidence는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-beginner의 concept-draft finding을 보존하고 새 artifact-local evidence만 연결해 placement와 alt text 검토부터 재개해.
```
<!-- PROMPT-CARD: studio:review-image-assets:standard -->
## studio:review-image-assets:standard

**rights·readability·placement 문서 승인 검토**

named human decision receipt가 있는 concept-draft asset을 document-approved 전환 요건과 blocker로 분리한다.

### 사용하는 경우
실제 named human의 document approval decision과 artifact-local rights evidence를 검증할 때 사용한다.

### 사용하지 않는 경우
timestamp·agent ID·파일 존재만으로 transition하거나 production-candidate로 건너뛸 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- stable asset ID
- requested transition
- named human decision receipt
- placement·alt·readability evidence
- rights/provenance decision

#### 선택 입력
- restriction
- revocation evidence

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [named human reviewer]
- [requested transition]

### Codex App 완성 예시
```text
@Game Design Studio hero-keyart-01의 named human document-approved receipt, placement, alt text, readability와 rights/provenance를 검토해. 누락 증거는 blocked로 남겨.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable asset ID]에 대해 [named human reviewer]의 [requested transition] receipt, placement, alt text, readability와 rights/provenance를 검토해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-image-assets artifact=game-design/coop/brief assetId=hero-keyart-01 targetState=document-approved reviewer=Jin decision=approve placement·alt·rights evidence를 검토해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-image-assets artifact=[Canonical Artifact] assetId=[stable asset ID] targetState=[requested transition] reviewer=[named human reviewer] placement·alt·rights evidence를 검토해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets → export-game-design-documents
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- requested transition
- named human decision record
- rights·readability·placement findings
- document-approved or blocked state

#### 선택 결과물
- restriction
- revocation handoff

#### 확장 결과물
- derivative eligibility
- export handoff condition

### 파일 구조
- game-design/studio-visual/review-standard/content.md
- game-design/studio-visual/review-standard/evidence.yml
- game-design/studio-visual/review-standard/export-manifest.yml
- game-design/studio-visual/review-standard/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/review-standard/content.md
- game-design/studio-visual/review-standard/evidence.yml
- game-design/studio-visual/review-standard/export-manifest.yml
- game-design/studio-visual/review-standard/assets/image-assets.yml

### 도식 바인딩
- ID: st-s13
- SVG: guides/assets/game-design-studio/skills/review-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/review-image-assets.png
- 대체 텍스트: 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
실제 담당자인 visual-asset-reviewer owner가 named human receipt와 rights를 승인·수정·보류하며 document-approved만 export binding 후보이고 agent는 승인할 수 없다.

#### 보류 조건
- named human receipt가 없음
- rights/provenance가 unreviewed
- placement·alt·readability evidence가 없음

#### 안전 경계
모르는 rights와 결정은 미정 또는 blocked로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-standard의 named human decision과 blocked evidence를 보존하고 해결된 rights 또는 placement 증거 하나만 반영해 document-approved 검토부터 재개해.
```
<!-- PROMPT-CARD: studio:review-image-assets:advanced -->
## studio:review-image-assets:advanced

**production-candidate 재검토와 권리 revocation**

document-approved asset의 active rights·technical fit·gameplay readability를 named human evidence로 재검토해 production-candidate 또는 hold를 결정한다.

### 사용하는 경우
document-approved asset의 production-candidate 요청, revocation 또는 restriction 재검토가 필요할 때 사용한다.

### 사용하지 않는 경우
production-candidate를 release, legal, production approval로 해석하거나 실제 game resource를 자동 승격할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- validated image manifest
- stable asset ID
- document-approved lifecycle receipt
- named human rights reviewer
- technical fit
- gameplay readability
- active rights decision

#### 선택 입력
- restriction
- revocation record
- rework request

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable asset ID]
- [named human rights reviewer]
- [active rights decision]

### Codex App 완성 예시
```text
@Game Design Studio document-approved hero-keyart-01의 active rights, technical fit와 gameplay readability를 named human rights reviewer가 재검토하도록 정리해. production-candidate는 release, legal, production approval이 아니며 게임 리소스 자동 승격은 금지해.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable asset ID]에 대해 [named human rights reviewer]가 [active rights decision], technical fit와 gameplay readability를 재검토하도록 정리해. 자동 승격은 금지해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-image-assets artifact=game-design/coop/brief assetId=hero-keyart-01 targetState=production-candidate reviewer=Jin rights=active document-approved receipt를 재검토하고 release approval로 표시하지 마.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-image-assets artifact=[Canonical Artifact] assetId=[stable asset ID] targetState=production-candidate reviewer=[named human rights reviewer] rights=[active rights decision] 재검토·hold 조건을 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-image-assets
- 스킬 흐름: review-image-assets
- 전문 역할: visual-asset-reviewer → art-brief-director

### 중간 산출물
- game-design-brief

### 예상 결과물
#### 최소 결과물
- concept-draft → document-approved → production-candidate lifecycle receipt
- active rights decision
- technical fit와 gameplay readability
- production-candidate or hold

#### 선택 결과물
- revocation
- restriction
- rework request

#### 확장 결과물
- no game-resource promotion receipt
- re-review handoff

### 파일 구조
- game-design/studio-visual/review-advanced/content.md
- game-design/studio-visual/review-advanced/evidence.yml
- game-design/studio-visual/review-advanced/export-manifest.yml
- game-design/studio-visual/review-advanced/assets/image-assets.yml

### 읽는 순서
- game-design/studio-visual/review-advanced/content.md
- game-design/studio-visual/review-advanced/evidence.yml
- game-design/studio-visual/review-advanced/export-manifest.yml
- game-design/studio-visual/review-advanced/assets/image-assets.yml

### 도식 바인딩
- ID: st-s13
- SVG: guides/assets/game-design-studio/skills/review-image-assets.svg
- PNG: guides/assets/game-design-studio/skills/review-image-assets.png
- 대체 텍스트: 이미지 자산 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
이름 있는 사람인 visual-asset-reviewer owner와 rights reviewer가 active rights·technical fit를 승인·수정·보류하며 production-candidate는 release·legal·production approval이 아니고 game resource 자동 승격을 금지한다.

#### 보류 조건
- document-approved receipt가 없음
- active rights가 아님
- technical fit 또는 gameplay readability evidence가 없음

#### 안전 경계
모르는 rights·lifecycle은 미정 또는 blocked로 남기고 production-candidate를 실제 게임 리소스로 자동 승격하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
review-advanced의 lifecycle receipt와 revocation record를 보존하고 새 named-human rights decision만 반영해 production-candidate 재검토부터 재개해.
```
