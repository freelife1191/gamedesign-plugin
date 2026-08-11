# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:work-to-public-case:case -->
## suite:work-to-public-case:case

**실무 기획을 공개 포트폴리오 사례로 바꾸기**

Studio의 실무 기획에서 공개 가능한 판단과 근거만 남겨 Career의 포트폴리오 사례로 바꾼다.

### 간단 요청 예시
```text
@Game Design Studio의 실무 기획에서 공개 가능한 판단만 골라 @Game Design Career 포트폴리오 사례로 정리해 줘.
```

### 짧은 흐름
- 작업 순서: review-game-design → build-game-design-portfolio
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
공개본 초안에는 ‘협동 임무의 중도 이탈을 줄이려 재합류 규칙을 설계했다’는 판단만 남기고 사내 지표와 미출시 기능명은 제외 기록으로 옮겼습니다. 권리 담당자의 검토 전까지 배포는 보류했습니다. (ID: suite:work-to-public-case:case; 파일: suite/work-to-public-case/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
실무 산출물의 기밀 내용을 덜어 내고 공개 포트폴리오 사례로 정리할 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 work-to-public-case 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:review-game-design $game-design-career:build-game-design-portfolio work-to-public-case에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:review-game-design $game-design-career:build-game-design-portfolio [공개 정보]를 사실·추론·제안으로 나눠 work-to-public-case에 기록해.
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
- 공개 요약과 제외 기록

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/work-to-public-case/content.md

### 읽는 순서
- suite/work-to-public-case/content.md
- suite/work-to-public-case/evidence.yml
- suite/work-to-public-case/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 실무 기획에서 공개 가능한 포트폴리오 사례를 만드는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 work-to-public-case의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
work-to-public-case에 보존된 공개 요약과 제외 기록을 읽고, 공개 허가가 확인된 항목만 반영해 재개해.
```

</details>
