# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:career-proof-project-interview:case -->
## suite:career-proof-project-interview:case

**역할 목표를 프로젝트와 면접 답변으로 잇기**

Career의 역할 목표를 Studio 프로젝트로 증명하고, 그 근거를 다시 면접 답변으로 이어 준다.

### 간단 요청 예시
```text
@Game Design Career의 목표 역할을 @Game Design Studio 프로젝트로 증명하고, 그 근거를 면접 답변까지 이어 줘.
```

### 짧은 흐름
- 작업 순서: map-game-design-career → design-game-systems → practice-game-design-interview
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
12주 프로젝트 초안은 전투 규칙 명세와 플레이테스트 회고를 시스템 기획 역량의 근거로 연결했습니다. ‘충돌 규칙을 직접 설계했다’는 답변은 담당 범위 확인 전까지 면접 검토 보류로 표시했습니다. (ID: suite:career-proof-project-interview:case; 파일: suite/career-proof-project-interview/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
목표 역할, 실습 프로젝트, 면접 답변을 하나의 근거 흐름으로 연결할 때 사용한다.

### 사용하지 않는 경우
비공개 자료, 가공하지 않은 개인 정보, 미승인 결과를 넘길 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- 공개 가능한 근거 요약

#### 선택 입력
- 지정된 사람의 승인 기록

### 바꿀 자리표시자
- [공개 정보]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 career-proof-project-interview 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:map-game-design-career $game-design-studio:design-game-systems $game-design-career:practice-game-design-interview career-proof-project-interview에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:map-game-design-career $game-design-studio:design-game-systems $game-design-career:practice-game-design-interview [공개 정보]를 사실·추론·제안으로 나눠 career-proof-project-interview에 기록해.
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
- 재개 기록

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
- 대체 텍스트: 역할 목표를 프로젝트 근거와 면접 답변으로 잇는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 career-proof-project-interview의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
career-proof-project-interview에 보존된 역할 목표와 프로젝트 근거를 읽고, 확인된 경험부터 면접 답변 작성을 재개해.
```

</details>
