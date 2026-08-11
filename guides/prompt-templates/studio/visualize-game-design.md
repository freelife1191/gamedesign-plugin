# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:visualize-game-design:beginner -->
## studio:visualize-game-design:beginner

**게임 기획 결과: source-backed 규칙 흐름 도식**

검증된 rule state와 recovery 관계만 prose보다 명확할 때 editable SVG 계획으로 표현한다.

### 간단 요청 예시
```text
@Game Design Studio 검증된 system state와 recovery 관계만 source mapping해 규칙 흐름이 prose보다 명확한지 판단하고 editable SVG draft를 준비해.
```

### 짧은 흐름
- 작업 순서: visualize-game-design
- 함께 검토하는 역할: lead-game-designer

### 이 요청으로 받는 결과
가상 문서 조각 — 해저 정원을 돌보는 협동 플레이어의 도식 기록: 현재는 초안입니다. 확인할 점: 추가 입력과 근거 주소. (ID: studio:visualize-game-design:beginner; 파일: game-design/studio-visual/visualize-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
Canonical Artifact의 state·transition·guard 관계가 prose보다 명확할 때 사용한다.

### 사용하지 않는 경우
source 없는 node·edge를 발명하거나 character illustration을 만들 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- artifact version
- stable source IDs
- relationship question
- audience
- output directory

#### 선택 입력
- language
- ratio
- acceptance criteria

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable source IDs]
- [relationship question]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable source IDs]로 [relationship question]을 source mapping해 규칙 흐름이 prose보다 명확할 때만 editable SVG draft를 준비해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:visualize-game-design artifact=game-design/coop/system sources=state-01,recovery-02 relationship=state-transition source-backed rule flow만 준비해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:visualize-game-design artifact=[Canonical Artifact] sources=[stable source IDs] relationship=[relationship question] source-backed rule flow만 준비해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-game-design
- 스킬 흐름: visualize-game-design
- 전문 역할: lead-game-designer

### 중간 산출물
- system-specification

### 예상 결과물
#### 최소 결과물
- diagram decision
- one preset
- source mapping
- editable SVG request
- adjacent alt text

#### 선택 결과물
- rejected alternatives
- diagram-not-warranted

#### 확장 결과물
- review handoff

### 파일 구조
- game-design/studio-visual/visualize-beginner/content.md
- game-design/studio-visual/visualize-beginner/evidence.yml
- game-design/studio-visual/visualize-beginner/export-manifest.yml
- game-design/studio-visual/visualize-beginner/assets/rule-flow.svg

### 읽는 순서
- game-design/studio-visual/visualize-beginner/content.md
- game-design/studio-visual/visualize-beginner/evidence.yml
- game-design/studio-visual/visualize-beginner/export-manifest.yml
- game-design/studio-visual/visualize-beginner/assets/rule-flow.svg

### 도식 바인딩
- ID: st-s15
- SVG: guides/assets/game-design-studio/skills/visualize-game-design.svg
- PNG: guides/assets/game-design-studio/skills/visualize-game-design.png
- 대체 텍스트: 게임 기획 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner가 source mapping과 diagram decision을 승인·수정·보류하며 SVG draft는 문서 승인이나 verified PNG가 아니다.

#### 보류 조건
- stable source IDs가 없음
- 관계가 prose보다 명확하지 않음
- artifact version이 없음

#### 안전 경계
모르는 관계는 미정으로 남기고 source 없는 node·edge는 만들지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
visualize-beginner의 source mapping과 rejected alternative를 보존하고 확인된 relationship question만 반영해 diagram decision부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:visualize-game-design:standard -->
## studio:visualize-game-design:standard

**게임 기획 결과: Archify 우선 구조 도식과 honest fallback**

architecture·workflow·sequence·dataflow·lifecycle 관계에 host Archify가 available이면 우선하고 absent 또는 failure이면 Skillstead editable SVG와 2× PNG fallback을 정확한 상태로 기록한다.

### 간단 요청 예시
```text
@Game Design Studio source-backed workflow 관계를 시각화해. Archify가 available이면 우선하고 absent 또는 failure이면 bundled Skillstead editable SVG와 2× PNG fallback을 Archify 결과로 표시하지 말고 정확한 상태로 기록해.
```

### 짧은 흐름
- 작업 순서: visualize-game-design → svg-infographic
- 함께 검토하는 역할: lead-game-designer → ux-accessibility-reviewer

### 이 요청으로 받는 결과
초안 결과: 핵심 결과 항목에 낡은 우주선을 수리하는 탐사대 맥락을 반영했습니다. 사람의 확인 전까지 값과 결정은 미정입니다. (ID: studio:visualize-game-design:standard; 파일: game-design/studio-visual/visualize-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
source-backed architecture, workflow, sequence, dataflow 또는 lifecycle 관계의 접근 가능한 도식이 필요할 때 사용한다.

### 사용하지 않는 경우
Archify absent/failure fallback을 Archify 결과로 표시하거나 fallback만으로 자동 승인할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- artifact version
- stable source IDs
- relationship type
- Archify capability state
- output directory

#### 선택 입력
- language
- ratio
- accessibility intent

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable source IDs]
- [relationship type]
- [Archify capability state]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable source IDs]로 [relationship type]을 시각화해. [Archify capability state]에서 Archify가 available이면 우선하고 absent 또는 failure이면 Skillstead editable SVG와 2× PNG fallback을 정확히 기록해.
```

### Codex CLI 완성 예시
```text
$game-design-studio:visualize-game-design artifact=game-design/coop/workflow sources=stage-01,gate-02 relationship=workflow archify=absent Skillstead editable SVG와 2x PNG fallback을 non-Archify 상태로 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:visualize-game-design artifact=[Canonical Artifact] sources=[stable source IDs] relationship=[relationship type] archify=[Archify capability state] Archify 우선 또는 Skillstead fallback 상태를 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-game-design
- 스킬 흐름: visualize-game-design → svg-infographic
- 전문 역할: lead-game-designer → ux-accessibility-reviewer

### 중간 산출물
- system-specification

### 예상 결과물
#### 최소 결과물
- Archify capability decision
- selected preset
- source mapping
- editable SVG
- 2× PNG fallback state

#### 선택 결과물
- Archify result receipt
- Skillstead fallback receipt

#### 확장 결과물
- accessibility metadata
- human review handoff

### 파일 구조
- game-design/studio-visual/visualize-standard/content.md
- game-design/studio-visual/visualize-standard/evidence.yml
- game-design/studio-visual/visualize-standard/export-manifest.yml
- game-design/studio-visual/visualize-standard/assets/workflow.svg

### 읽는 순서
- game-design/studio-visual/visualize-standard/content.md
- game-design/studio-visual/visualize-standard/evidence.yml
- game-design/studio-visual/visualize-standard/export-manifest.yml
- game-design/studio-visual/visualize-standard/assets/workflow.svg

### 도식 바인딩
- ID: st-s15
- SVG: guides/assets/game-design-studio/skills/visualize-game-design.svg
- PNG: guides/assets/game-design-studio/skills/visualize-game-design.png
- 대체 텍스트: 게임 기획 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner와 ux-accessibility-reviewer가 Archify decision·source mapping·fallback을 승인·수정·보류하며 Skillstead fallback은 Archify 결과나 자동 승인이 아니다.

#### 보류 조건
- source mapping이 없음
- Archify capability state가 미정
- fallback renderer evidence가 없음

#### 안전 경계
모르는 capability와 renderer 상태는 미정 또는 blocked로 남기며 fallback을 Archify 결과나 자동 승인으로 표시하지 않는다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
visualize-standard의 Archify capability decision과 Skillstead fallback state를 보존하고 변경된 available·absent·failure evidence만 반영해 마지막 검증 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:visualize-game-design:advanced -->
## studio:visualize-game-design:advanced

**게임 기획 결과: source mapping·receipt·visual QA를 갖춘 lifecycle 도식**

lifecycle 관계를 source locator, execution receipt와 independent visual QA로 분리해 verified 상태를 과장하지 않는다.

### 간단 요청 예시
```text
@Game Design Studio source-backed lifecycle의 node·connector·label을 mapping하고 preset, lint·render receipt, exact 2× PNG와 fit-to-page·close-up QA를 각각 기록해. Archify/Skillstead 결과와 human approval은 분리해.
```

### 짧은 흐름
- 작업 순서: visualize-game-design → svg-infographic → review-game-design
- 함께 검토하는 역할: lead-game-designer → ux-accessibility-reviewer → production-feasibility-critic

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 핵심 결과 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: studio:visualize-game-design:advanced; 파일: game-design/studio-visual/visualize-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 lifecycle gate와 owner handoff의 source mapping·lint·render·two-pass QA evidence가 필요할 때 사용한다.

### 사용하지 않는 경우
linted·rendered·verified를 서로 추정하거나 diagram receipt로 human approval을 대체할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- artifact version
- stable source IDs
- lifecycle relationship
- selected preset
- acceptance criteria
- output directory

#### 선택 입력
- Archify capability receipt
- existing SVG
- review question

### 바꿀 자리표시자
- [Canonical Artifact]
- [stable source IDs]
- [lifecycle relationship]
- [selected preset]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Canonical Artifact]의 [stable source IDs]로 [lifecycle relationship]을 [selected preset]에 mapping해. lint·render receipt, exact 2× PNG와 two-pass QA를 분리하고 human approval을 추정하지 마.
```

### Codex CLI 완성 예시
```text
$game-design-studio:visualize-game-design artifact=game-design/coop/lifecycle sources=gate-01,gate-02 relationship=lifecycle preset=state-rule-flow source mapping·receipt·2x PNG·visual QA를 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:visualize-game-design artifact=[Canonical Artifact] sources=[stable source IDs] relationship=[lifecycle relationship] preset=[selected preset] source mapping·receipt·visual QA를 분리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-game-design
- 스킬 흐름: visualize-game-design → svg-infographic → review-game-design
- 전문 역할: lead-game-designer → ux-accessibility-reviewer → production-feasibility-critic

### 중간 산출물
- production-scope-risk

### 예상 결과물
#### 최소 결과물
- source mapping
- requested/generated/linted/rendered/verified states
- lint receipt
- render receipt
- fit-to-page·close-up QA

#### 선택 결과물
- Archify receipt
- Skillstead fallback receipt

#### 확장 결과물
- finding handoff
- export eligibility condition

### 파일 구조
- game-design/studio-visual/visualize-advanced/content.md
- game-design/studio-visual/visualize-advanced/evidence.yml
- game-design/studio-visual/visualize-advanced/export-manifest.yml
- game-design/studio-visual/visualize-advanced/assets/lifecycle.svg

### 읽는 순서
- game-design/studio-visual/visualize-advanced/content.md
- game-design/studio-visual/visualize-advanced/evidence.yml
- game-design/studio-visual/visualize-advanced/export-manifest.yml
- game-design/studio-visual/visualize-advanced/assets/lifecycle.svg

### 도식 바인딩
- ID: st-s15
- SVG: guides/assets/game-design-studio/skills/visualize-game-design.svg
- PNG: guides/assets/game-design-studio/skills/visualize-game-design.png
- 대체 텍스트: 게임 기획 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
lead-game-designer owner와 ux-accessibility-reviewer가 source fidelity·visual QA를 승인·수정·보류하며 lint·render receipt는 document approval 또는 production approval이 아니다.

#### 보류 조건
- source locator가 없음
- preset이 정확히 하나가 아님
- lint·render·QA evidence가 불완전함

#### 안전 경계
모르는 source·QA 상태는 미정 또는 blocked로 남기고 receipt가 human approval을 대체하지 않게 한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
visualize-advanced의 source mapping과 passed evidence를 보존하고 실패한 lint·render·QA 상태 하나만 반영해 해당 검증 단계부터 재개해.
```

</details>
