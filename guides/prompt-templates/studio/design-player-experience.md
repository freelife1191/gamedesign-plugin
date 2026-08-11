# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:design-player-experience:beginner -->
## studio:design-player-experience:beginner

**행동과 피드백이 있는 첫 세션 UX**

첫 critical action의 행동, feedback, 오류와 recovery를 QA 가능한 UI 흐름으로 정리한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 섬 복구 게임 첫 세션의 다리 수리 행동을 UI state, feedback, 오류 메시지와 recovery까지 정리해 줘. 검증되지 않은 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-player-experience
- 함께 검토하는 역할: ux-accessibility-reviewer → lead-game-designer

### 이 요청으로 받는 결과
예: `game-design/studio-foundations/ux-beginner/content.md`에 critical action, UI state, feedback, 오류 recovery을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
첫 5분의 first success와 하나의 critical action에 필요한 UI state를 정의할 때 사용한다.

### 사용하지 않는 경우
authoritative rule이 비어 있거나 경제 수치와 확률을 결정해야 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- target experience
- critical action
- players
- platform
- input
- UI surface
- owner

#### 선택 입력
- 기존 flow
- performance observation
- review question

### 바꿀 자리표시자
- [UX Artifact]
- [critical action]
- [플랫폼]
- [오류 상황]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [critical action]의 [플랫폼] UI state, feedback, [오류 상황]과 recovery를 정리해 줘. 검증되지 않은 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-player-experience artifact=game-design/island/first-session 다리 수리의 첫 critical action, feedback, 오류와 recovery를 ui-ux-flow-state로 정리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-player-experience artifact=[UX Artifact] [critical action]의 feedback, 오류와 recovery를 ui-ux-flow-state로 정리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-player-experience
- 스킬 흐름: design-player-experience
- 전문 역할: ux-accessibility-reviewer → lead-game-designer

### 중간 산출물
- ui-ux-flow-state

### 예상 결과물
#### 최소 결과물
- critical action
- UI state
- feedback
- 오류 recovery

#### 선택 결과물
- first success cue
- loading state

#### 확장 결과물
- QA validation task
- cross-platform note

### 파일 구조
- game-design/studio-foundations/ux-beginner/content.md
- game-design/studio-foundations/ux-beginner/evidence.yml
- game-design/studio-foundations/ux-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/ux-beginner/content.md
- game-design/studio-foundations/ux-beginner/evidence.yml
- game-design/studio-foundations/ux-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s06
- SVG: guides/assets/game-design-studio/skills/design-player-experience.svg
- PNG: guides/assets/game-design-studio/skills/design-player-experience.png
- 대체 텍스트: 플레이어 경험 직접 호출 흐름

### 사람 검토
#### 승인 경계
ux-accessibility-reviewer가 critical action의 state와 recovery를 검토하고 product owner가 release 범위를 결정한다.

#### 보류 조건
- critical action이 정의되지 않음
- authoritative rule과 UI feedback이 충돌함

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
ux-beginner의 action과 recovery를 보존하고 실제 관찰된 오류 feedback만 evidence.yml에 연결해 blocked state부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-player-experience:standard -->
## studio:design-player-experience:standard

**Onboarding과 접근성을 검토하는 플레이어 경험**

tutorial skip/revisit, input alternative, sensory cue와 오류 복구를 하나의 onboarding 흐름으로 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 모바일 협동 복구 게임의 onboarding에 tutorial skip/revisit, 터치·controller 대안, sensory cue, 오류 복구와 접근성 검토 질문을 연결해 줘. 최신 근거가 없으면 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-player-experience → review-game-design
- 함께 검토하는 역할: ux-accessibility-reviewer → lead-game-designer → system-economy-designer

### 이 요청으로 받는 결과
예: `game-design/studio-foundations/ux-standard/content.md`에 tutorial skip/revisit, input alternative, sensory cue, error recovery을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
첫 세션의 튜토리얼, platform별 입력과 접근 가능한 대안이 함께 필요할 때 사용한다.

### 사용하지 않는 경우
새 gameplay rule을 UI가 만들어 내거나 접근성 근거 없이 release를 승인하려 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- onboarding goal
- critical actions
- platforms
- devices
- input alternatives
- owner

#### 선택 입력
- accessibility evidence
- controller test
- test participant

### 바꿀 자리표시자
- [UX Artifact]
- [onboarding goal]
- [input alternative]
- [sensory cue]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [onboarding goal]에 [input alternative], [sensory cue], tutorial skip/revisit와 오류 복구를 연결해 줘. 최신 근거가 없으면 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-player-experience artifact=game-design/island/first-session tutorial skip/revisit, input alternative와 sensory cue를 accessibility-platform-matrix에 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-player-experience artifact=[UX Artifact] [input alternative]와 [sensory cue]를 accessibility-platform-matrix에 연결해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-player-experience
- 스킬 흐름: design-player-experience → review-game-design
- 전문 역할: ux-accessibility-reviewer → lead-game-designer → system-economy-designer

### 중간 산출물
- ui-ux-flow-state
- accessibility-platform-matrix

### 예상 결과물
#### 최소 결과물
- tutorial skip/revisit
- input alternative
- sensory cue
- error recovery

#### 선택 결과물
- performance observation
- controller test result

#### 확장 결과물
- inaccessible-critical-action finding
- review handoff

### 파일 구조
- game-design/studio-foundations/ux-standard/content.md
- game-design/studio-foundations/ux-standard/evidence.yml
- game-design/studio-foundations/ux-standard/decisions/README.md
- game-design/studio-foundations/ux-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/ux-standard/content.md
- game-design/studio-foundations/ux-standard/evidence.yml
- game-design/studio-foundations/ux-standard/export-manifest.yml
- game-design/studio-foundations/ux-standard/decisions/README.md

### 도식 바인딩
- ID: st-s06
- SVG: guides/assets/game-design-studio/skills/design-player-experience.svg
- PNG: guides/assets/game-design-studio/skills/design-player-experience.png
- 대체 텍스트: 플레이어 경험 onboarding과 접근성 흐름

### 사람 검토
#### 승인 경계
ux-accessibility-reviewer가 accessible alternative와 test gap을 판정하고 lead-game-designer가 experience 범위를 결정한다.

#### 보류 조건
- 입력 대안이 critical action을 완료하지 못함
- 최신 accessibility evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
ux-standard의 onboarding state를 유지하고 새 controller test 결과와 접근성 근거만 연결해 inaccessible-critical-action부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-player-experience:advanced -->
## studio:design-player-experience:advanced

**멀티모달 UX와 책임 gate를 갖춘 플레이어 경험**

멀티모달 feedback이 authoritative game state를 발명하지 않는지 확인하고 책임 owner의 gate를 남긴다.

### 간단 요청 예시
```text
@Game Design Studio 협동 보스 전투의 화면·진동·사운드 cue가 authoritative state를 발명하지 않는지 검토하고, critical action 접근성 gate와 책임 owner의 승인 대기를 정리해 줘. 증거가 없으면 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-player-experience → design-game-systems → review-game-design
- 함께 검토하는 역할: ux-accessibility-reviewer → system-economy-designer → lead-game-designer

### 이 요청으로 받는 결과
예: `game-design/studio-foundations/ux-advanced/content.md`에 authority finding, multimodal cue mapping, critical action gate을 기록하고, 확인되지 않은 값은 `미정`으로 남깁니다.

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
복수 입력·시각·청각 cue가 있는 UX에서 state authority, accessibility, release gate를 함께 검토할 때 사용한다.

### 사용하지 않는 경우
UI feedback만으로 authoritative state를 확정하거나 근거 없는 threshold로 접근성 승인을 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- authoritative rule reference
- multimodal cue
- critical action
- accessibility evidence
- responsible owner

#### 선택 입력
- offline scenario
- performance measurement
- review finding

### 바꿀 자리표시자
- [UX Artifact]
- [authoritative rule]
- [멀티모달 cue]
- [responsible owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [authoritative rule]의 [멀티모달 cue]를 검토하고 critical action 접근성 gate와 [responsible owner] 승인 대기를 정리해 줘. 증거가 없으면 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-player-experience artifact=game-design/island/boss-ui 기존 관찰 evidence를 보존하고 UI feedback이 authoritative game state를 발명하는 지점을 finding으로 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-player-experience artifact=[UX Artifact] [멀티모달 cue]가 authoritative state를 발명하는 finding을 분리하고 [responsible owner] gate를 기다려.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-player-experience
- 스킬 흐름: design-player-experience → design-game-systems → review-game-design
- 전문 역할: ux-accessibility-reviewer → system-economy-designer → lead-game-designer

### 중간 산출물
- ui-ux-flow-state
- accessibility-platform-matrix
- game-design-review

### 예상 결과물
#### 최소 결과물
- authority finding
- multimodal cue mapping
- critical action gate

#### 선택 결과물
- offline recovery scenario
- performance risk

#### 확장 결과물
- owner approval receipt 대기
- release blocker

### 파일 구조
- game-design/studio-foundations/ux-advanced/content.md
- game-design/studio-foundations/ux-advanced/evidence.yml
- game-design/studio-foundations/ux-advanced/decisions/README.md
- game-design/studio-foundations/ux-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/ux-advanced/content.md
- game-design/studio-foundations/ux-advanced/evidence.yml
- game-design/studio-foundations/ux-advanced/export-manifest.yml
- game-design/studio-foundations/ux-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s06
- SVG: guides/assets/game-design-studio/skills/design-player-experience.svg
- PNG: guides/assets/game-design-studio/skills/design-player-experience.png
- 대체 텍스트: 플레이어 경험 authority와 책임 gate 흐름

### 사람 검토
#### 승인 경계
responsible UX·system owner가 authority finding과 release gate를 승인·수정·보류하며 자동 UX 검토는 release 승인으로 전환되지 않는다.

#### 보류 조건
- cue의 source state가 불명확함
- 책임 owner가 없음
- 접근성 blocker가 해소되지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
ux-advanced의 authority finding과 멀티모달 mapping을 보존하고 owner가 확인한 source state만 반영해 blocked critical action부터 재개해.
```

</details>
