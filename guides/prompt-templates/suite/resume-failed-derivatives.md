# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:resume-failed-derivatives:case -->
## suite:resume-failed-derivatives:case

**실패한 이미지와 문서 작업 이어서 하기**

이미지나 문서 내보내기가 실패해도 원본과 실패 원인을 보존하고 안전한 단계부터 다시 시작한다.

### 간단 요청 예시
```text
@Game Design Studio와 @Game Design Career에서 실패한 이미지·문서 작업의 원본과 막힌 이유를 보존하고 재개 지점을 정리해 줘.
```

### 짧은 흐름
- 작업 순서: plan-image-assets → generate-image-assets → review-image-assets → export-game-design-documents → export-career-documents
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
이미지 생성 실패 뒤 원본 기획서와 프롬프트는 보존했고, 내보내기 단계는 실행하지 않은 채 보류했습니다. 재개 기록에는 권리 확인이 끝나면 이미지 검토부터 다시 시작한다고 적었습니다. (ID: suite:resume-failed-derivatives:case; 파일: suite/resume-failed-derivatives/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
이미지 생성이나 문서 내보내기가 중단되어 보존 파일과 재개 지점을 함께 넘길 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 resume-failed-derivatives 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:plan-image-assets $game-design-studio:generate-image-assets $game-design-studio:review-image-assets $game-design-studio:export-game-design-documents $game-design-career:export-career-documents 원본 산출물을 보존하고 이미지·내보내기가 막힌 이유를 기록한 뒤 재시도 기록부터 재개해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:plan-image-assets $game-design-studio:generate-image-assets $game-design-studio:review-image-assets $game-design-studio:export-game-design-documents $game-design-career:export-career-documents [공개 정보]의 원본 산출물, 이미지·내보내기 실패 원인, 재시도 기록을 사실·추론·제안으로 나눠 적어.
```

### 스킬·전문 역할 흐름
- 기본 스킬: plan-image-assets
- 스킬 흐름: plan-image-assets → generate-image-assets → review-image-assets → export-game-design-documents → export-career-documents
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- game-design-brief
- decision-change-log
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- 보존 파일, blocker, resume receipt

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/resume-failed-derivatives/content.md

### 읽는 순서
- suite/resume-failed-derivatives/content.md
- suite/resume-failed-derivatives/evidence.yml
- suite/resume-failed-derivatives/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 실패한 파생 산출물을 보존하고 안전한 단계부터 재개하는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 resume-failed-derivatives의 공개 범위와 재개 지점을 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
resume-failed-derivatives에 남은 원본, 실패 원인, 재개 기록을 읽고 마지막으로 안전했던 단계부터 다시 시작해.
```

</details>
