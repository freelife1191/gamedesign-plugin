# Game Design Studio 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: studio:define-game-vision:beginner -->
## studio:define-game-vision:beginner

**대상 플레이어와 플레이 약속을 정하는 게임 비전**

한 문장 게임 아이디어를 대상 플레이어, 플레이어에게 약속할 경험, 설계 원칙과 검증 질문이 있는 짧은 기획 요약서로 바꾼다.

### 간단 요청 예시
```text
@Game Design Studio 낯선 섬 협동 복구 게임의 대상 플레이어, 플레이어에게 약속할 경험, 설계 원칙 하나와 검증 질문을 짧은 기획 요약서로 만들어 줘. 모르는 정보는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: define-game-vision
- 함께 검토하는 역할: lead-game-designer → content-narrative-designer

### 이 요청으로 받는 결과
대상 플레이어는 짧은 협동을 선호하는 2인 친구이며, 플레이 약속은 ‘매일 하나씩 등대섬을 되살린다’입니다. 이 가설은 인터뷰 근거와 연결한 뒤 채택 여부를 정합니다. (ID: studio:define-game-vision:beginner; 파일: game-design/studio-foundations/vision-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
새 게임의 핵심 경험과 기능 선택 기준을 처음 정할 때 사용한다.

### 사용하지 않는 경우
실행 규칙·상태 전이나 퀘스트 단위의 상세 설계가 이미 목표일 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 게임 아이디어
- target player 근거
- desired emotion
- 제약
- decision owner

#### 선택 입력
- player research
- platform 제약
- 기존 vision 문서

### 바꿀 자리표시자
- [게임 아이디어]
- [검토자 역할]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [게임 아이디어]의 대상 플레이어, 플레이어에게 약속할 경험, 설계 원칙 하나와 검증 질문을 짧은 기획 요약서로 만들어 줘. 모르는 정보는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:define-game-vision 낯선 섬 협동 복구 게임을 vision-pillars와 game-design-brief로 작성하고 기획 책임자의 결정을 기다려.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:define-game-vision [게임 아이디어]를 vision-pillars와 game-design-brief로 작성하고 [검토자 역할] 결정을 기다려.
```

### 스킬·전문 역할 흐름
- 기본 스킬: define-game-vision
- 스킬 흐름: define-game-vision
- 전문 역할: lead-game-designer → content-narrative-designer

### 중간 산출물
- vision-pillars
- game-design-brief

### 예상 결과물
#### 최소 결과물
- target player
- 플레이어에게 약속할 경험
- 설계 원칙 하나
- 검증 질문

#### 선택 결과물
- desired emotion
- core fun 가설

#### 확장 결과물
- core-motivation-loop
- provisional validation task

### 파일 구조
- game-design/studio-foundations/vision-beginner/content.md
- game-design/studio-foundations/vision-beginner/evidence.yml
- game-design/studio-foundations/vision-beginner/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/vision-beginner/content.md
- game-design/studio-foundations/vision-beginner/evidence.yml
- game-design/studio-foundations/vision-beginner/export-manifest.yml

### 도식 바인딩
- ID: st-s02
- SVG: guides/assets/game-design-studio/skills/define-game-vision.svg
- PNG: guides/assets/game-design-studio/skills/define-game-vision.png
- 대체 텍스트: 게임 비전 직접 호출 흐름

### 사람 검토
#### 승인 경계
수석 게임 기획자가 플레이어에게 약속할 경험과 설계 원칙을 승인·수정·보류하며, 초안 작성만으로 기능 범위가 승인되지는 않는다.

#### 보류 조건
- target player 근거가 없음
- decision owner가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
vision-beginner의 플레이 경험 약속과 질문을 보존하고 새 플레이어 관찰 근거를 evidence.yml에 연결한 뒤 미정 기준부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:define-game-vision:standard -->
## studio:define-game-vision:standard

**핵심 원칙과 배제 원칙을 검증하는 게임 비전**

지킬 설계 원칙, 하지 않을 설계 원칙과 제외 목표를 시험 제작 관찰 질문에 연결해 팀이 기능 선택에 쓸 기준을 만든다.

### 간단 요청 예시
```text
@Game Design Studio 협동 복구 게임의 지킬 설계 원칙, 하지 않을 설계 원칙, 제외 목표를 시험 제작 관찰 질문과 연결하고 각 가정의 근거 상태를 구분해 줘. 확인되지 않은 수치는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: define-game-vision → design-game-systems
- 함께 검토하는 역할: lead-game-designer → content-narrative-designer

### 이 요청으로 받는 결과
핵심 원칙은 ‘관찰로 푸는 협동 추리’, 배제 원칙은 ‘반복 전투로 진행 막기’로 적었습니다. 폐역 신호 해독 프로토타입에서 두 원칙이 실제 선택 기준이 되는지 살펴봐야 합니다. (ID: studio:define-game-vision:standard; 파일: game-design/studio-foundations/vision-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
핵심 재미는 설명할 수 있지만 유사 기능의 포함·제외 기준과 시험 제작 관찰 방법이 필요할 때 사용한다.

### 사용하지 않는 경우
설계 원칙 승인 전에 세부 규칙이나 수치 밸런스를 확정하려 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 기존 게임 방향
- 후보 설계 원칙
- 하지 않을 설계 원칙
- 시험 제작 제약
- 기획 책임자

#### 선택 입력
- 플레이테스트 메모
- business constraint
- 검토 질문

### 바꿀 자리표시자
- [기존 게임 방향]
- [시험 제작 제약]
- [검증 방법]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [기존 게임 방향]의 지킬 설계 원칙, 하지 않을 설계 원칙, 제외 목표를 [검증 방법]과 연결해 줘. 확인되지 않은 수치는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:define-game-vision artifact=game-design/island/vision 협동 복구의 지킬 설계 원칙, 하지 않을 설계 원칙, 제외 목표와 시험 제작 관찰 질문을 vision-pillars에 연결해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:define-game-vision artifact=[기존 게임 방향] [시험 제작 제약] 아래 지킬 설계 원칙, 하지 않을 설계 원칙, 제외 목표를 vision-pillars에 연결해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: define-game-vision
- 스킬 흐름: define-game-vision → design-game-systems
- 전문 역할: lead-game-designer → content-narrative-designer

### 중간 산출물
- vision-pillars
- core-motivation-loop

### 예상 결과물
#### 최소 결과물
- 지킬 설계 원칙
- 하지 않을 설계 원칙
- 제외 목표
- prototype 관찰 질문

#### 선택 결과물
- player verb
- success signal

#### 확장 결과물
- core loop 가설
- system handoff criteria

### 파일 구조
- game-design/studio-foundations/vision-standard/content.md
- game-design/studio-foundations/vision-standard/evidence.yml
- game-design/studio-foundations/vision-standard/decisions/README.md
- game-design/studio-foundations/vision-standard/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/vision-standard/content.md
- game-design/studio-foundations/vision-standard/evidence.yml
- game-design/studio-foundations/vision-standard/export-manifest.yml
- game-design/studio-foundations/vision-standard/decisions/README.md

### 도식 바인딩
- ID: st-s02
- SVG: guides/assets/game-design-studio/skills/define-game-vision.svg
- PNG: guides/assets/game-design-studio/skills/define-game-vision.png
- 대체 텍스트: 게임 방향에서 시스템 설계로 이어지는 설계 원칙 흐름

### 사람 검토
#### 승인 경계
수석 게임 기획자가 제외 목표와 시험 제작 기준을 결정하고 콘텐츠·내러티브 기획자는 표현의 일관성을 검토한다.

#### 보류 조건
- 지킬 설계 원칙과 하지 않을 설계 원칙이 구분되지 않음
- prototype 관찰 방법이 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
vision-standard의 지킬 설계 원칙과 하지 않을 설계 원칙을 유지하고 새 시험 제작 관찰 결과만 evidence.yml에 붙여 검증 질문부터 재개해.
```

</details>
<!-- PROMPT-CARD: studio:define-game-vision:advanced -->
## studio:define-game-vision:advanced

**상충하는 기능과 근거 책임자를 다루는 게임 비전**

상충하는 기능 제안을 설계 원칙·제외 목표와 근거 상태로 비교하고 담당자가 판단할 수 있게 만든다.

### 간단 요청 예시
```text
@Game Design Studio 협동 복구 게임의 경쟁 PvP 기능과 비동기 도움 기능을 설계 원칙·제외 목표·플레이테스트 근거로 비교하고, 결정 담당자가 승인할 질문을 남겨 줘. 불명확한 근거는 미정으로 남겨 줘.
```

### 짧은 흐름
- 작업 순서: define-game-vision → review-game-design
- 함께 검토하는 역할: lead-game-designer → production-feasibility-critic → content-narrative-designer

### 이 요청으로 받는 결과
‘자동 가격 조정’은 시장 운영의 이해도를 낮출 수 있어 ‘직접 흥정’ 기능과 나란히 비교했습니다. 플레이 관찰 자료의 책임자가 근거를 보완한 뒤 기능 채택을 판단합니다. (ID: studio:define-game-vision:advanced; 파일: game-design/studio-foundations/vision-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 기능 제안이 같은 플레이 경험을 약속하지만 범위·근거·게임 방향 적합성이 충돌할 때 사용한다.

### 사용하지 않는 경우
근거가 없는 수치로 기능 우선순위를 정하거나 담당자 없이 게임 방향 결정을 확정할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- vision-pillars
- 기능 후보
- 근거
- 결정 담당자
- 제약

#### 선택 입력
- 플레이테스트 결과
- 제작 위험
- 기존 결정 기록

### 바꿀 자리표시자
- [기능 후보 A]
- [기능 후보 B]
- [결정 담당자]
- [vision ID]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio [기능 후보 A]와 [기능 후보 B]를 설계 원칙·제외 목표·근거 상태로 비교하고 [결정 담당자]의 결정 질문을 남겨 줘. 불명확한 근거는 미정으로 남겨 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:define-game-vision artifact=game-design/island/vision 기존 근거와 결정 담당자를 보존하고 경쟁 PvP와 비동기 도움 제안을 설계 원칙·제외 목표 기준으로 비교해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:define-game-vision artifact=game-design/[vision ID] [기능 후보 A]와 [기능 후보 B]를 비교하고 [결정 담당자] 결정을 기다려.
```

### 스킬·전문 역할 흐름
- 기본 스킬: define-game-vision
- 스킬 흐름: define-game-vision → review-game-design
- 전문 역할: lead-game-designer → production-feasibility-critic → content-narrative-designer

### 중간 산출물
- vision-pillars
- decision-change-log

### 예상 결과물
#### 최소 결과물
- feature 비교
- 근거 상태
- owner 질문

#### 선택 결과물
- scope risk
- prototype follow-up

#### 확장 결과물
- 승인 receipt 대기 record
- system handoff 조건

### 파일 구조
- game-design/studio-foundations/vision-advanced/content.md
- game-design/studio-foundations/vision-advanced/evidence.yml
- game-design/studio-foundations/vision-advanced/decisions/README.md
- game-design/studio-foundations/vision-advanced/export-manifest.yml

### 읽는 순서
- game-design/studio-foundations/vision-advanced/content.md
- game-design/studio-foundations/vision-advanced/evidence.yml
- game-design/studio-foundations/vision-advanced/export-manifest.yml
- game-design/studio-foundations/vision-advanced/decisions/README.md

### 도식 바인딩
- ID: st-s02
- SVG: guides/assets/game-design-studio/skills/define-game-vision.svg
- PNG: guides/assets/game-design-studio/skills/define-game-vision.png
- 대체 텍스트: 게임 비전의 feature 충돌과 사람 결정 흐름

### 사람 검토
#### 승인 경계
기획 책임자가 상충 기능의 채택·수정·보류를 결정하며 근거가 미정인 항목은 자동 승인하지 않는다.

#### 보류 조건
- feature 후보의 근거가 분리되지 않음
- decision owner의 receipt가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
vision-advanced의 비교표와 owner 질문을 보존하고 새로 확인된 플레이테스트 evidence만 연결해 provisional 선택지부터 재개해.
```

</details>
