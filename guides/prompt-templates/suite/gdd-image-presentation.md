# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:gdd-image-presentation:case -->
## suite:gdd-image-presentation:case

**기획서와 이미지를 발표 자료로 엮기**

Studio의 기획서와 검토된 이미지를 발표 자료로 내보내기 전에 순서와 공개 범위를 점검한다.

### 간단 요청 예시
```text
@Game Design Studio의 기획 본문과 검토된 이미지를 발표 자료 순서로 묶고 공개 전 확인 항목을 남겨 줘. @Game Design Career에는 공개 가능한 결과만 인계해.
```

### 짧은 흐름
- 작업 순서: orchestrate-game-design-project → plan-image-assets → review-image-assets → export-game-design-documents
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
발표 자료 초안은 게임 목표, 핵심 순환, 보스전 흐름 뒤에 검토된 콘셉트 이미지를 배치했습니다. 이미지 권리 기록이 비어 있어 내보내기는 보류 상태로 남겼습니다. (ID: suite:gdd-image-presentation:case; 파일: suite/gdd-image-presentation/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
기획 본문과 이미지가 준비되어 발표 자료의 흐름과 내보내기 상태를 함께 확인할 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 gdd-image-presentation 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:orchestrate-game-design-project $game-design-studio:plan-image-assets $game-design-studio:review-image-assets $game-design-studio:export-game-design-documents gdd-image-presentation에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:orchestrate-game-design-project $game-design-studio:plan-image-assets $game-design-studio:review-image-assets $game-design-studio:export-game-design-documents [공개 정보]를 사실·추론·제안으로 나눠 gdd-image-presentation에 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: orchestrate-game-design-project
- 스킬 흐름: orchestrate-game-design-project → plan-image-assets → review-image-assets → export-game-design-documents
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- game-design-brief
- game-design-review

### 예상 결과물
#### 최소 결과물
- content.md, approved images, PPTX preflight

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/gdd-image-presentation/content.md

### 읽는 순서
- suite/gdd-image-presentation/content.md
- suite/gdd-image-presentation/evidence.yml
- suite/gdd-image-presentation/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 기획서와 이미지를 발표 자료로 내보내는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 gdd-image-presentation의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
gdd-image-presentation에 보존된 본문과 이미지 검토 기록을 읽고, 해소된 내보내기 항목부터 재개해.
```

</details>
