# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:student-mentor-review:case -->
## suite:student-mentor-review:case

**학생 과제와 수정 기록을 멘토에게 넘기기**

Studio에서 만든 과제와 수정 기록을 Career의 포트폴리오 검토 기준에 맞춰 멘토에게 넘긴다.

### 간단 요청 예시
```text
@Game Design Studio의 시스템 기획 과제를 @Game Design Career의 포트폴리오 루브릭으로 검토할 수 있게 멘토 인계 문서를 작성해 줘.
```

### 짧은 흐름
- 작업 순서: design-game-systems → review-game-design-portfolio
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
멘토 검토 초안에는 스태미나 규칙의 예외가 빠졌다는 지적과 학생이 추가한 사망 후 회복 규칙을 나란히 남겼습니다. 루브릭 점수는 멘토가 근거를 확인할 때까지 미정입니다. (ID: suite:student-mentor-review:case; 파일: suite/student-mentor-review/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
학생의 시스템 기획 과제를 루브릭과 수정 기록으로 함께 검토할 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 student-mentor-review 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems $game-design-career:review-game-design-portfolio student-mentor-review에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems $game-design-career:review-game-design-portfolio [공개 정보]를 사실·추론·제안으로 나눠 student-mentor-review에 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems → review-game-design-portfolio
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- system-specification
- five-axis-review

### 예상 결과물
#### 최소 결과물
- 과제, 루브릭, 수정 기록

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/student-mentor-review/content.md

### 읽는 순서
- suite/student-mentor-review/content.md
- suite/student-mentor-review/evidence.yml
- suite/student-mentor-review/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 학생 과제를 멘토의 포트폴리오 검토로 넘기는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 student-mentor-review의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
student-mentor-review에 보존된 과제와 루브릭을 읽고, 학생이 반영한 수정 항목부터 멘토 검토를 재개해.
```

</details>
