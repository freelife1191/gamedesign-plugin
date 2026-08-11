# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:studio-to-career-handoff:case -->
## suite:studio-to-career-handoff:case

**스튜디오 검토 결과를 포트폴리오로 넘기기**

Studio의 검토 결과 가운데 공개 가능한 근거만 추려 Career 포트폴리오로 넘긴다.

### 간단 요청 예시
```text
@Game Design Studio의 검토 결과에서 공개 가능한 근거만 골라 @Game Design Career 포트폴리오 인계 문서로 정리해 줘.
```

### 짧은 흐름
- 작업 순서: review-game-design → build-game-design-portfolio
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
공개용 인계 초안에는 협동 보스전의 문제를 ‘초반 전멸 원인 불명’, 판단을 ‘공격 예고 보강’, 검증을 ‘다음 플레이테스트’로 나눠 적었습니다. 관찰 근거가 부족한 항목은 포트폴리오 공개를 보류했습니다. (ID: suite:studio-to-career-handoff:case; 파일: suite/studio-to-career-handoff/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
Studio에서 정리한 문제·판단·검증 근거를 Career 포트폴리오에 이어 쓸 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 studio-to-career-handoff 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-game-design $game-design-career:build-game-design-portfolio studio-to-career-handoff에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-game-design $game-design-career:build-game-design-portfolio [공개 정보]를 사실·추론·제안으로 나눠 studio-to-career-handoff에 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: review-game-design
- 스킬 흐름: review-game-design → build-game-design-portfolio
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- game-design-review
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- 공개 가능한 문제·판단·검증 summary

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/studio-to-career-handoff/content.md

### 읽는 순서
- suite/studio-to-career-handoff/content.md
- suite/studio-to-career-handoff/evidence.yml
- suite/studio-to-career-handoff/export-manifest.yml

### 도식 바인딩
- 대화형 HTML: [Studio 검토 결과를 Career 포트폴리오로 넘기는 흐름](../../assets/archify/suite/suite-studio-career-handoff.html)
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: Studio 검토 결과를 Career 포트폴리오로 넘기는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 studio-to-career-handoff의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
studio-to-career-handoff에 보존된 파일과 막힌 이유를 먼저 읽고, 공개 정보만 반영해 인계를 재개해.
```

</details>
