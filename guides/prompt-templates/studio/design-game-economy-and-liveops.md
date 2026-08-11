# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:design-game-economy-and-liveops:beginner -->
## studio:design-game-economy-and-liveops:beginner

**게임 기획 결과: Source·sink 가설을 기록하는 경제 기초**

한 자원의 source·sink와 보유 한도를 근거 상태와 함께 economy-balance에 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 탐험 게임의 골드 source·sink와 보유 한도를 economy-balance로 정리해 줘. 근거 없는 수치는 provisional 또는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-economy-and-liveops
- 함께 검토하는 역할: system-economy-designer

### 이 요청으로 받는 결과
가상 문서 조각 — 해저 정원을 돌보는 협동 플레이어의 · 표: 현재는 초안입니다. 확인할 점: 추가 입력과 근거 주소. (ID: studio:design-game-economy-and-liveops:beginner; 파일: game-design/studio-production/economy-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
한 자원의 유입·소비와 플레이어 보호 질문을 처음 정리할 때 사용한다.

### 사용하지 않는 경우
근거 없이 가격·확률·pity를 확정하거나 이벤트 성과를 예측할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- resource ID
- known source
- known sink
- 보유 한도
- economy owner

#### 선택 입력
- 기존 economy Artifact
- player observation
- region

### 바꿀 자리표시자
- [Artifact 경로]
- [자원 ID]
- [보유 한도]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [Artifact 경로]의 [자원 ID] source·sink와 [보유 한도]를 economy-balance로 정리해 줘. 근거 없는 수치는 provisional 또는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-economy-and-liveops artifact=game-design/coop/economy resource=gold 골드의 source·sink와 cap을 기록하고 근거 없는 수치는 provisional로 남겨.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-economy-and-liveops artifact=[Artifact 경로] resource=[자원 ID] cap=[보유 한도] source·sink를 기록하고 근거 없는 수치는 provisional로 남겨.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-economy-and-liveops
- 스킬 흐름: design-game-economy-and-liveops
- 전문 역할: system-economy-designer

### 중간 산출물
- economy-balance

### 예상 결과물
#### 최소 결과물
- source·sink 표
- source·sink 보유 한도 기록
- source·sink 미정 근거 목록

#### 선택 결과물
- 보유 한도 질문
- player consequence 메모

#### 확장 결과물
- review handoff 조건
- economy owner 확인 기록

### 파일 구조
- game-design/studio-production/economy-beginner/content.md
- game-design/studio-production/economy-beginner/evidence.yml
- game-design/studio-production/economy-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-production/economy-beginner/content.md
- game-design/studio-production/economy-beginner/evidence.yml
- game-design/studio-production/economy-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s04
- SVG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.svg
- PNG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.png
- 대체 텍스트: 게임 경제 source와 sink 직접 호출 흐름

### 사람 검토
#### 승인 경계
system-economy-designer owner가 자원 정의를 승인·수정·보류하며 초안은 가격 또는 수익 승인이나 성공 보장이 아니다.

#### 보류 조건
- economy owner가 없음
- source 또는 sink 근거가 없음
- 실가격을 확정하려 함

#### 안전 경계
모르는 정보와 근거 없는 economy metric은 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
economy-beginner의 source·sink 표와 미정 근거를 보존한 뒤 새 관찰 근거만 연결해 provisional 가설 확인부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-economy-and-liveops:standard -->
## studio:design-game-economy-and-liveops:standard

**게임 기획 결과: Progression·guardrail·rollback을 갖춘 경제 계획**

progression target을 guardrail, stop과 tested rollback에 연결해 economy-balance의 안전한 변경 경계를 기록한다.

### 간단 요청 예시
```text
@Game Design Studio 협동 탐험 게임의 초반 progression target을 guardrail, stop과 tested rollback에 연결해 economy-balance로 정리해 줘. 근거 없는 수치는 provisional로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-economy-and-liveops → review-game-design
- 함께 검토하는 역할: liveops-data-designer → system-economy-designer → ux-accessibility-reviewer

### 이 요청으로 받는 결과
초안 결과: 핵심 결과 항목에 낡은 우주선을 수리하는 탐사대 맥락을 반영했습니다. 사람의 확인 전까지 값과 결정은 미정입니다. (ID: studio:design-game-economy-and-liveops:standard; 파일: game-design/studio-production/economy-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
progression target과 guardrail이 있고 되돌릴 수 있는 economy 변경을 준비할 때 사용한다.

### 사용하지 않는 경우
telemetry 기반 experiment 설계를 이 단계의 progression·guardrail·rollback 계획으로 대체할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- progression target
- guardrail
- stop 조건
- tested rollback
- economy owner

#### 선택 입력
- 기존 economy Artifact
- progression evidence
- region constraint

### 바꿀 자리표시자
- [경제 Artifact]
- [progression target]
- [guardrail]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [경제 Artifact]의 [progression target]을 [guardrail], stop과 tested rollback에 연결해 economy-balance로 정리해 줘. 근거 없는 수치는 provisional로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-economy-and-liveops artifact=game-design/coop/economy 초반 progression target, guardrail, stop과 tested rollback을 economy-balance에 기록해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-economy-and-liveops artifact=[경제 Artifact] [progression target]을 [guardrail], stop과 tested rollback에 연결해 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-economy-and-liveops
- 스킬 흐름: design-game-economy-and-liveops → review-game-design
- 전문 역할: liveops-data-designer → system-economy-designer → ux-accessibility-reviewer

### 중간 산출물
- economy-balance

### 예상 결과물
#### 최소 결과물
- progression·guardrail·rollback target
- progression·guardrail·rollback stop 조건
- progression·guardrail·rollback tested 상태

#### 선택 결과물
- provisional progression 범위
- region constraint

#### 확장 결과물
- progression review 질문
- rollback No-Go blocker

### 파일 구조
- game-design/studio-production/economy-standard/content.md
- game-design/studio-production/economy-standard/evidence.yml
- game-design/studio-production/economy-standard/decisions/README.md
- game-design/studio-production/economy-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-production/economy-standard/content.md
- game-design/studio-production/economy-standard/evidence.yml
- game-design/studio-production/economy-standard/export-manifest.yml
- game-design/studio-production/economy-standard/decisions/README.md

### 도식 바인딩
- ID: st-s04
- SVG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.svg
- PNG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.png
- 대체 텍스트: Progression·guardrail·rollback 경제 계획 직접 호출 흐름

### 사람 검토
#### 승인 경계
system-economy-designer owner와 liveops-data-designer가 progression·guardrail·stop·rollback을 승인·수정·보류하며 자동화는 economy 결과, 수익 또는 출시를 보장하지 않는다.

#### 보류 조건
- progression target이 없음
- tested rollback 증거가 없음
- guardrail owner가 없음

#### 안전 경계
모르는 정보와 검증 전 economy metric은 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
economy-standard의 progression·guardrail·rollback 기록과 현재 stop 상태를 보존하고 새 rollback rehearsal 증거만 반영해 guardrail 검토부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:design-game-economy-and-liveops:advanced -->
## studio:design-game-economy-and-liveops:advanced

**게임 기획 결과: Experiment·telemetry·player protection을 분리하는 경제 검토**

experiment의 telemetry 근거 공백과 player protection을 blocked decision으로 분리한다.

### 간단 요청 예시
```text
@Game Design Studio 기존 economy Artifact의 experiment hypothesis, telemetry 정의와 price·probability·pity 근거 공백을 분리하고 player protection owner의 blocked decision queue를 만들어 줘. 근거 없는 metric은 provisional로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: design-game-economy-and-liveops → review-game-design
- 함께 검토하는 역할: system-economy-designer → liveops-data-designer → ux-accessibility-reviewer

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 근거 기록 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: studio:design-game-economy-and-liveops:advanced; 파일: game-design/studio-production/economy-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 region 또는 실험의 telemetry, odds와 player protection을 함께 검토해야 할 때 사용한다.

### 사용하지 않는 경우
근거 공백을 채우기 위해 가격·확률·pity·수익·성공률을 임의로 만들 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- economy Artifact version
- experiment hypothesis
- telemetry 정의
- price/probability/pity 근거 상태
- player protection owner
- decision owner

#### 선택 입력
- odds 공개 자료
- region policy
- 기존 decision log

### 바꿀 자리표시자
- [경제 Artifact]
- [telemetry 정의]
- [보호 owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [경제 Artifact]의 experiment와 [telemetry 정의] 근거 공백을 분리하고 [보호 owner]의 player protection decision queue를 만들어 줘. 근거 없는 metric은 provisional로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-economy-and-liveops artifact=game-design/coop/economy experiment=weekend-bonus telemetry=inventory-delta 기존 experiment telemetry와 player protection owner를 보존하고 price·probability·pity 근거 공백을 blocked로 남겨.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-economy-and-liveops artifact=[경제 Artifact] experiment=provisional telemetry=[telemetry 정의] [보호 owner] 승인 전 experiment·telemetry·player protection 근거 공백을 blocked로 남겨.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-economy-and-liveops
- 스킬 흐름: design-game-economy-and-liveops → review-game-design
- 전문 역할: system-economy-designer → liveops-data-designer → ux-accessibility-reviewer

### 중간 산출물
- economy-balance
- liveops-experiment-event
- decision-change-log

### 예상 결과물
#### 최소 결과물
- experiment·telemetry·player protection evidence gap
- experiment·telemetry·player protection blocked decision
- experiment·telemetry·player protection No-Go receipt
- experiment·telemetry·player protection owner

#### 선택 결과물
- provisional metric 범위
- region별 policy 질문

#### 확장 결과물
- No-Go receipt
- review-ready decision queue

### 파일 구조
- game-design/studio-production/economy-advanced/content.md
- game-design/studio-production/economy-advanced/evidence.yml
- game-design/studio-production/economy-advanced/decisions/README.md
- game-design/studio-production/economy-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-production/economy-advanced/content.md
- game-design/studio-production/economy-advanced/evidence.yml
- game-design/studio-production/economy-advanced/export-manifest.yml
- game-design/studio-production/economy-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s04
- SVG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.svg
- PNG: guides/assets/game-design-studio/skills/design-game-economy-and-liveops.png
- 대체 텍스트: Experiment·telemetry·player protection 경제 검토 직접 호출 흐름

### 사람 검토
#### 승인 경계
system-economy-designer player protection owner와 named decision owner가 blocker 해소를 승인·수정·보류하며 telemetry receipt는 수익·성공률·출시를 보장하지 않는다.

#### 보류 조건
- telemetry 정의가 없음
- price·probability·pity 근거가 없음
- player protection owner가 없음

#### 안전 경계
모르는 정보, price, probability, pity와 economy metric은 미정 또는 provisional로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
economy-advanced의 blocked decision queue와 telemetry evidence gap을 보존하고 공개된 근거 하나만 연결해 해당 blocker 확인부터 재개해.
```

</details>
