# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:svg-infographic:beginner -->
## studio:svg-infographic:beginner

**간단한 source-mapped SVG 흐름**

wrapper가 선택한 구조 관계를 간단한 editable SVG, title·desc와 adjacent alt text로 작성한다.

### 사용하는 경우
visualize-game-design이 선택한 preset과 source mapping으로 간단한 flow를 authoring할 때 사용한다.

### 사용하지 않는 경우
illustration·logo·statistical chart를 만들거나 source 없이 SVG를 검증 완료로 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- selected preset
- stable source IDs
- relationship structure
- audience
- output directory

#### 선택 입력
- language
- ratio
- style preference

### 바꿀 자리표시자
- [Canonical Artifact]
- [selected preset]
- [stable source IDs]
- [relationship structure]

### Codex App 완성 예시
```text
@Game Design Studio wrapper가 고른 state-rule-flow preset과 source mapping으로 간단한 editable SVG를 작성해. nonempty title·desc와 adjacent alt text를 넣고 PNG나 승인을 주장하지 마.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [selected preset]과 [stable source IDs]로 [relationship structure] editable SVG를 작성해. title·desc와 adjacent alt text를 넣고 PNG나 승인을 주장하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:svg-infographic artifact=game-design/coop/system preset=state-rule-flow sources=state-01,recovery-02 source-mapped SVG와 title·desc·alt text만 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:svg-infographic artifact=[Canonical Artifact] preset=[selected preset] sources=[stable source IDs] structure=[relationship structure] SVG와 title·desc·alt text만 작성해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: svg-infographic
- 스킬 흐름: visualize-game-design → svg-infographic
- 전문 역할: lead-game-designer

### 중간 산출물
- rule-exception-matrix

### 예상 결과물
#### 최소 결과물
- editable SVG
- nonempty title
- nonempty desc
- adjacent alt text
- stable source mapping

#### 선택 결과물
- numeric layout plan
- SVG-only draft state

#### 확장 결과물
- visualize-game-design handoff

### 파일 구조
- game-design/studio-visual/svg-beginner/content.md
- game-design/studio-visual/svg-beginner/evidence.yml
- game-design/studio-visual/svg-beginner/export-manifest.yml
- game-design/studio-visual/svg-beginner/assets/rule-flow.svg

### 읽는 순서
- game-design/studio-visual/svg-beginner/content.md
- game-design/studio-visual/svg-beginner/evidence.yml
- game-design/studio-visual/svg-beginner/export-manifest.yml
- game-design/studio-visual/svg-beginner/assets/rule-flow.svg

### 도식 바인딩
- ID: st-s14
- SVG: guides/assets/game-design-studio/skills/svg-infographic.svg
- PNG: guides/assets/game-design-studio/skills/svg-infographic.png
- 대체 텍스트: SVG 인포그래픽 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner가 structure와 accessibility metadata를 승인·수정·보류하며 editable SVG는 linted, rendered, verified 또는 human-approved가 아니다.

#### 보류 조건
- selected preset이 없음
- stable source IDs가 없음
- title·desc 또는 alt text가 없음

#### 안전 경계
모르는 structure는 미정으로 남기고 SVG-only draft를 verified PNG로 표시하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
svg-beginner의 editable SVG와 source mapping을 보존하고 누락된 title·desc·alt text만 반영해 source checklist부터 재개해.
```
<!-- PROMPT-CARD: studio:svg-infographic:standard -->
## studio:svg-infographic:standard

**source-backed 2× PNG가 있는 SVG handoff**

source-mapped editable SVG를 product wrapper lint와 canonical renderer를 통해 정확한 2× PNG handoff로 분리한다.

### 사용하는 경우
source-backed topology·flow·roadmap의 SVG와 검증 가능한 2× PNG handoff가 필요할 때 사용한다.

### 사용하지 않는 경우
PNG만 수정하거나 wrapper를 우회해 vendored path를 직접 호출할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- selected preset
- stable source IDs
- numeric layout plan
- output directory
- acceptance criteria

#### 선택 입력
- language
- ratio
- existing SVG

### 바꿀 자리표시자
- [Canonical Artifact]
- [selected preset]
- [stable source IDs]
- [acceptance criteria]

### Codex App 완성 예시
```text
@Game Design Studio source-backed flow SVG를 numeric layout으로 작성하고 product wrapper lint와 canonical renderer로 exact 2× PNG를 준비해. SVG authority와 PNG derivative를 분리하고 renderer evidence를 남겨.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [selected preset]과 [stable source IDs]로 SVG를 작성해. [acceptance criteria]에 따라 wrapper lint와 canonical renderer exact 2× PNG evidence를 남기고 SVG authority를 유지해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:svg-infographic artifact=game-design/coop/roadmap preset=liveops-roadmap sources=phase-01,gate-02 wrapper lint와 canonical renderer 2x PNG evidence를 준비해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:svg-infographic artifact=[Canonical Artifact] preset=[selected preset] sources=[stable source IDs] acceptance=[acceptance criteria] wrapper lint와 canonical renderer 2x PNG evidence를 준비해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: svg-infographic
- 스킬 흐름: visualize-game-design → svg-infographic
- 전문 역할: lead-game-designer → ux-accessibility-reviewer

### 중간 산출물
- production-scope-risk

### 예상 결과물
#### 최소 결과물
- editable SVG authority
- source mapping
- wrapper lint result
- canonical renderer result
- exact 2× PNG

#### 선택 결과물
- browser identity
- manual fallback status

#### 확장 결과물
- fit-to-page·close-up QA handoff

### 파일 구조
- game-design/studio-visual/svg-standard/content.md
- game-design/studio-visual/svg-standard/evidence.yml
- game-design/studio-visual/svg-standard/export-manifest.yml
- game-design/studio-visual/svg-standard/assets/roadmap.svg

### 읽는 순서
- game-design/studio-visual/svg-standard/content.md
- game-design/studio-visual/svg-standard/evidence.yml
- game-design/studio-visual/svg-standard/export-manifest.yml
- game-design/studio-visual/svg-standard/assets/roadmap.svg

### 도식 바인딩
- ID: st-s14
- SVG: guides/assets/game-design-studio/skills/svg-infographic.svg
- PNG: guides/assets/game-design-studio/skills/svg-infographic.png
- 대체 텍스트: SVG 인포그래픽 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner와 ux-accessibility-reviewer가 source mapping·renderer evidence를 승인·수정·보류하며 2× PNG render는 document approval이 아니다.

#### 보류 조건
- source mapping이 없음
- lint warning 또는 error가 미처리
- renderer 또는 dimensions evidence가 없음

#### 안전 경계
모르는 lint·renderer 상태는 미정 또는 blocked로 남기고 PNG만 patch하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
svg-standard의 editable SVG와 renderer evidence를 보존하고 실패한 lint 또는 render 단계만 반영해 2× PNG handoff부터 재개해.
```
<!-- PROMPT-CARD: studio:svg-infographic:advanced -->
## studio:svg-infographic:advanced

**lint 0 warning/error·접근성·human approval SVG QA**

고급 구조 SVG의 lint 0 warning/error, exact 2× PNG render, accessibility metadata와 human approval을 독립 evidence로 검증한다.

### 사용하는 경우
source-mapped SVG의 machine lint, render, two-pass visual QA와 human approval evidence를 모두 관리할 때 사용한다.

### 사용하지 않는 경우
warning/error가 남은 lint를 통과로 표시하거나 fallback을 Archify 결과·자동 승인으로 표시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- selected preset
- stable source IDs
- numeric layout plan
- accessibility metadata
- human approval owner
- output directory

#### 선택 입력
- Archify capability state
- Node-free fallback evidence
- existing SVG

### 바꿀 자리표시자
- [Canonical Artifact]
- [selected preset]
- [stable source IDs]
- [human approval owner]

### Codex App 완성 예시
```text
@Game Design Studio source-mapped structural SVG를 lint 0 warning/error로 정리하고 exact 2× PNG, title·desc·alt 접근성 metadata, fit-to-page·close-up QA와 named human approval을 각각 evidence로 남겨. Archify available이면 우선하고 absent 또는 failure이면 Skillstead fallback을 Archify 결과로 표시하지 마.
```

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [selected preset]과 [stable source IDs]로 structural SVG를 작성해. lint 0 warning/error, exact 2× PNG, accessibility metadata와 [human approval owner]의 human approval을 각각 evidence로 남겨.
```

### Codex CLI 완성 예시
```text
$game-design-studio:svg-infographic artifact=game-design/coop/system preset=state-rule-flow sources=state-01,gate-02 lint=0-warnings-0-errors render=2x accessibility=title-desc-alt humanApproval=Jin full QA evidence를 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:svg-infographic artifact=[Canonical Artifact] preset=[selected preset] sources=[stable source IDs] humanApproval=[human approval owner] lint 0 warning/error, 2x render와 accessibility evidence를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: svg-infographic
- 스킬 흐름: visualize-game-design → svg-infographic → review-game-design
- 전문 역할: lead-game-designer → ux-accessibility-reviewer → production-feasibility-critic

### 중간 산출물
- rule-exception-matrix

### 예상 결과물
#### 최소 결과물
- lint 0 warning/error result
- exact 2× PNG render
- title·desc·adjacent alt accessibility metadata
- fit-to-page·close-up visual QA
- named human approval record

#### 선택 결과물
- Archify priority receipt
- Skillstead fallback state

#### 확장 결과물
- verified or blocked evidence state
- review finding handoff

### 파일 구조
- game-design/studio-visual/svg-advanced/content.md
- game-design/studio-visual/svg-advanced/evidence.yml
- game-design/studio-visual/svg-advanced/export-manifest.yml
- game-design/studio-visual/svg-advanced/assets/state-flow.svg

### 읽는 순서
- game-design/studio-visual/svg-advanced/content.md
- game-design/studio-visual/svg-advanced/evidence.yml
- game-design/studio-visual/svg-advanced/export-manifest.yml
- game-design/studio-visual/svg-advanced/assets/state-flow.svg

### 도식 바인딩
- ID: st-s14
- SVG: guides/assets/game-design-studio/skills/svg-infographic.svg
- PNG: guides/assets/game-design-studio/skills/svg-infographic.png
- 대체 텍스트: SVG 인포그래픽 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner와 ux-accessibility-reviewer가 lint 0 warning/error, accessibility metadata와 visual QA를 승인·수정·보류하고 named human approval 없이는 verified handoff를 승인하지 않는다.

#### 보류 조건
- lint warning 또는 error가 0이 아님
- 2× render·visual QA evidence가 없음
- accessibility metadata 또는 named human approval이 없음

#### 안전 경계
모르는 lint·render·approval 상태는 미정 또는 blocked로 남기고 fallback을 Archify 결과나 자동 승인으로 표시하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
svg-advanced의 editable SVG와 통과한 evidence를 보존하고 해결된 lint·render·accessibility·human approval gate 하나만 반영해 해당 QA 단계부터 재개해.
```
