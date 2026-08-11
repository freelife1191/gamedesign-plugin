# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:design-game-content:beginner -->
## studio:design-game-content:beginner

**퀘스트와 비플레이어 캐릭터(NPC) 하나 설계하기**

한 퀘스트 또는 NPC의 목적, 선택, 상태, 결과, 보상과 실패 복구를 시스템 ID에 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 폭풍 전 등대를 복구하는 퀘스트와 안내 NPC 하나를 목적, player choice, 상태 변화, 결과, 보상과 실패 복구로 정리하고 system ID에 연결해 줘. 모르는 제작 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-content
- 함께 검토하는 역할: content-narrative-designer → lead-game-designer

### 이 요청으로 받는 결과
역무원 NPC는 플레이어에게 세 신호 중 하나를 골라 복구하게 하고, 잘못 고르면 다음 밤에 새 단서를 제공합니다. 보상 수치와 실패 뒤 대사는 콘텐츠 담당자 검토 전까지 비워 둡니다. (ID: studio:design-game-content:beginner; 파일: game-design/studio-foundations/content-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
목적이 분명한 퀘스트·NPC 하나의 player choice와 outcome을 작성할 때 사용한다.

### 사용하지 않는 경우
전체 비전 또는 아직 확정되지 않은 rule authority를 대신 결정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- content purpose
- target player state
- supporting system ID
- player choice
- reward
- owner

#### 선택 입력
- 기존 narrative
- accessibility need
- review question

### 바꿀 자리표시자
- [content Artifact]
- [퀘스트 또는 NPC]
- [system ID]
- [reward]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [퀘스트 또는 NPC]를 목적, player choice, 상태 변화, 결과, [reward]와 실패 복구로 정리하고 [system ID]에 연결해 줘. 모르는 제작 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-content artifact=game-design/island/lighthouse-quest 등대 복구 퀘스트의 목적, player choice, 상태, 실패 복구와 NPC 반응을 narrative-quest-npc로 정리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-content artifact=[content Artifact] [퀘스트 또는 NPC]의 목적, choice, 상태와 [reward]를 narrative-quest-npc로 정리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-content
- 스킬 흐름: design-game-content
- 전문 역할: content-narrative-designer → lead-game-designer

### 중간 산출물
- narrative-quest-npc

### 예상 결과물
#### 최소 결과물
- content purpose
- player choice
- state delta
- outcome
- recovery

#### 선택 결과물
- NPC response
- repeatability goal

#### 확장 결과물
- system/data dependency
- validation task

### 파일 구조
- game-design/studio-foundations/content-beginner/content.md
- game-design/studio-foundations/content-beginner/evidence.yml
- game-design/studio-foundations/content-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/content-beginner/content.md
- game-design/studio-foundations/content-beginner/evidence.yml
- game-design/studio-foundations/content-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s03
- SVG: guides/assets/game-design-studio/skills/design-game-content.svg
- PNG: guides/assets/game-design-studio/skills/design-game-content.png
- 대체 텍스트: 게임 콘텐츠 직접 호출 흐름

### 사람 검토
#### 승인 경계
content-narrative-designer가 choice와 NPC 반응을 검토하고 lead-game-designer가 system dependency를 확인한다.

#### 보류 조건
- supporting system ID가 없음
- player choice의 결과가 정의되지 않음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
content-beginner의 quest state와 NPC 반응을 보존하고 확인된 system ID만 연결해 failure recovery부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-content:standard -->
## studio:design-game-content:standard

**콘텐츠 관계도와 보상을 연결하는 게임 콘텐츠**

퀘스트·캐릭터·보스 encounter의 content graph, 상태, reward와 production resource를 연결한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 섬 복구의 세 퀘스트와 보스 encounter를 content graph로 연결하고, 각 상태·보상·counterplay·monster telegraph·production resource를 system/data ID에 붙여 줘. 불확실한 제작량은 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-content → design-game-systems → review-game-design
- 함께 검토하는 역할: content-narrative-designer → production-feasibility-critic → lead-game-designer

### 이 요청으로 받는 결과
봄 장터 퀘스트를 마치면 씨앗 상점과 여름 의뢰가 열리지만, 희귀 씨앗 보상은 생산 비용 근거가 없어 보류했습니다. 필요한 NPC 표정 3종도 제작 자원 목록에 넣었습니다. (ID: studio:design-game-content:standard; 파일: game-design/studio-foundations/content-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 content node의 흐름, combat role, reward와 생산 자원을 같은 계약으로 검토할 때 사용한다.

### 사용하지 않는 경우
규칙 authority가 없는 행동·보상을 invent하거나 production capacity를 근거 없이 확정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- content graph goal
- character or encounter
- supporting system/data ID
- reward
- production evidence
- owner

#### 선택 입력
- counterplay
- monster telegraph
- accessibility need

### 바꿀 자리표시자
- [content Artifact]
- [content graph goal]
- [encounter]
- [production evidence]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [content graph goal]의 [encounter]를 상태·보상·counterplay·telegraph와 [production evidence]에 연결해 줘. 불확실한 제작량은 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-content artifact=game-design/island/storm-boss character role, skill rule, counterplay, monster telegraph와 production resource를 character-skill-combat-monster에 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-content artifact=[content Artifact] [encounter]의 역할, counterplay, 보상과 [production evidence]를 character-skill-combat-monster에 연결해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-content
- 스킬 흐름: design-game-content → design-game-systems → review-game-design
- 전문 역할: content-narrative-designer → production-feasibility-critic → lead-game-designer

### 중간 산출물
- narrative-quest-npc
- character-skill-combat-monster

### 예상 결과물
#### 최소 결과물
- content graph
- state dependency
- reward
- production resource

#### 선택 결과물
- counterplay
- monster telegraph

#### 확장 결과물
- repeatability criterion
- review finding

### 파일 구조
- game-design/studio-foundations/content-standard/content.md
- game-design/studio-foundations/content-standard/evidence.yml
- game-design/studio-foundations/content-standard/decisions/README.md
- game-design/studio-foundations/content-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/content-standard/content.md
- game-design/studio-foundations/content-standard/evidence.yml
- game-design/studio-foundations/content-standard/export-manifest.yml
- game-design/studio-foundations/content-standard/decisions/README.md

### 도식 바인딩
- ID: st-s03
- SVG: guides/assets/game-design-studio/skills/design-game-content.svg
- PNG: guides/assets/game-design-studio/skills/design-game-content.png
- 대체 텍스트: 게임 콘텐츠 graph와 production 흐름

### 사람 검토
#### 승인 경계
content-narrative-designer가 content graph를 검토하고 production-feasibility-critic이 resource와 repeatability 위험을 검토한다.

#### 보류 조건
- 행동 또는 reward의 system/data ID가 없음
- production evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
content-standard의 graph와 reward 연결을 유지하고 새로 측정된 encounter 제작 근거만 더해 production blocker부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-content:advanced -->
## studio:design-game-content:advanced

**서사·제작·권리 경계를 갖춘 게임 콘텐츠**

narrative choice, production scope, rights·consent·provenance와 사람 승인 조건을 함께 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 분기 퀘스트의 선택 의미와 재합류를 system state에 연결하고, 반복성·제작 비용·AI 보조 대사의 provenance·rights·consent와 사람 승인 gate를 분리해 줘. 근거 없는 상태는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-content → design-game-systems → plan-game-production → review-game-design
- 함께 검토하는 역할: content-narrative-designer → production-feasibility-critic → lead-game-designer

### 이 요청으로 받는 결과
견습생이 금지된 바람길을 공개하는 선택은 다음 지역의 경비 상태와 대사를 바꿉니다. 참고 민요의 사용 권리와 성우 동의가 확인되기 전에는 제작 관문을 넘기지 않습니다. (ID: studio:design-game-content:advanced; 파일: game-design/studio-foundations/content-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
반복성·제작 비용·서사 선택·AI 또는 UGC 자료의 rights 경계가 상충할 때 사용한다.

### 사용하지 않는 경우
provenance·rights·consent 없이 AI·UGC 자료를 승인하거나 사람 approver 없이 콘텐츠 범위를 확정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- narrative choice
- system/data dependency
- production evidence
- rights/provenance status
- human approver

#### 선택 입력
- UGC moderation policy
- repeatability evidence
- scope decision

### 바꿀 자리표시자
- [content Artifact]
- [narrative choice]
- [rights status]
- [human approver]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [narrative choice]를 system state에 연결하고 [rights status], 제작 범위와 [human approver] 승인 gate를 분리해 줘. 근거 없는 상태는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-content artifact=game-design/branching-adventure/river-crossing 기존 evidence와 scope decision을 보존하고 repeatability와 제작 cost가 충돌하는 content 후보, rights와 approval gate를 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-content artifact=[content Artifact] [narrative choice]의 scope·rights·provenance를 보존하고 [human approver] 승인 전 blocker를 비교해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-content
- 스킬 흐름: design-game-content → design-game-systems → plan-game-production → review-game-design
- 전문 역할: content-narrative-designer → production-feasibility-critic → lead-game-designer

### 중간 산출물
- narrative-quest-npc
- production-scope-risk
- decision-change-log

### 예상 결과물
#### 최소 결과물
- narrative state dependency
- production blocker
- rights/provenance status
- approval gate

#### 선택 결과물
- UGC moderation question
- repeatability comparison

#### 확장 결과물
- human approval receipt 대기
- scope decision log

### 파일 구조
- game-design/studio-foundations/content-advanced/content.md
- game-design/studio-foundations/content-advanced/evidence.yml
- game-design/studio-foundations/content-advanced/decisions/README.md
- game-design/studio-foundations/content-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/content-advanced/content.md
- game-design/studio-foundations/content-advanced/evidence.yml
- game-design/studio-foundations/content-advanced/export-manifest.yml
- game-design/studio-foundations/content-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s03
- SVG: guides/assets/game-design-studio/skills/design-game-content.svg
- PNG: guides/assets/game-design-studio/skills/design-game-content.png
- 대체 텍스트: 게임 콘텐츠 서사·제작·권리 승인 흐름

### 사람 검토
#### 승인 경계
narrative·production·rights owner가 선택 의미, 제작 범위와 rights gate를 승인·수정·보류하며 자동 생성 결과는 승인이 아니다.

#### 보류 조건
- system/data dependency가 없음
- rights 또는 consent 상태가 없음
- human approver가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
content-advanced의 narrative dependency와 rights gate를 보존하고 human approver가 확인한 provenance 또는 production evidence만 반영해 blocker부터 재개해.
```

</details>
