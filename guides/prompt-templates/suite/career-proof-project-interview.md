# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:career-proof-project-interview:case -->
## suite:career-proof-project-interview:case

**게임 기획 결과: career-proof-project-interview suite case**

career-proof-project-interview의 Studio와 Career ordered handoff를 public/evidence-safe하게 연결한다.

### 간단 요청 예시
```text
@Game Design Studio와 @Game Design Career에서 career-proof-project-interview handoff를 public/evidence-safe하게 작성해.
```

### 짧은 흐름
- 작업 순서: map-game-design-career → design-game-systems → practice-game-design-interview
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
가상 결과 기록: 도서관의 잃은 지도를 찾는 모험가 맥락에서 필요한 근거 기록 항목을 먼저 적었습니다. 확인할 점: 적용 범위와 검토자 결정. (ID: suite:career-proof-project-interview:case; 파일: suite/career-proof-project-interview/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
두 제품의 canonical artifact handoff가 필요할 때 사용한다.

### 사용하지 않는 경우
비공개 자료, raw 개인 정보, 또는 미승인 결과를 전달할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 공개 가능한 evidence summary

#### 선택 입력
- named human approval receipt

### 바꿀 자리표시자
- [공개 정보]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 fact, inference, recommendation으로 분리해 career-proof-project-interview handoff를 작성해.
```

### Codex CLI 완성 예시
```text
$game-design-career:map-game-design-career $game-design-studio:design-game-systems $game-design-career:practice-game-design-interview career-proof-project-interview handoff의 공개 가능한 evidence summary를 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:map-game-design-career $game-design-studio:design-game-systems $game-design-career:practice-game-design-interview [공개 정보] career-proof-project-interview handoff의 fact, inference, recommendation을 작성해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: map-game-design-career
- 스킬 흐름: map-game-design-career → design-game-systems → practice-game-design-interview
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- game-design-role-map
- system-specification
- interview-question-answer-log

### 예상 결과물
#### 최소 결과물
- 12주 proof와 evidence-linked 답변

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- resume receipt

### 파일 구조
- suite/career-proof-project-interview/content.md

### 읽는 순서
- suite/career-proof-project-interview/content.md
- suite/career-proof-project-interview/evidence.yml
- suite/career-proof-project-interview/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: Suite handoff flow

### 사람 검토
#### 승인 경계
named human decision owner가 career-proof-project-interview handoff의 공개 범위를 승인 또는 보류한다.

#### 보류 조건
- rights, evidence, 또는 approval receipt가 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
career-proof-project-interview의 보존 파일과 blocker를 읽고 공개 정보만으로 재개해.
```

</details>
