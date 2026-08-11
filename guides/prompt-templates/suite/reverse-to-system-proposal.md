# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:reverse-to-system-proposal:case -->
## suite:reverse-to-system-proposal:case

**역기획에서 시스템 제안 만들기**

Career에서 분리한 역기획의 사실과 추론을 Studio의 시스템 제안으로 차례대로 넘긴다.

### 간단 요청 예시
```text
@Game Design Career의 역기획을 @Game Design Studio의 시스템 제안으로 넘길 수 있게 사실과 추론을 분리해 줘.
```

### 짧은 흐름
- 작업 순서: reverse-engineer-game-design → design-game-systems → review-game-design
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
역기획 검토에서는 ‘회피 뒤 반격’이 핵심 규칙이라는 사실과, 스태미나 회복 지연이 긴장감을 만든다는 추론을 분리했습니다. 회복 규칙 제안은 Studio 담당자의 검토 전이라 보류했습니다. (ID: suite:reverse-to-system-proposal:case; 파일: suite/reverse-to-system-proposal/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
역기획에서 찾은 규칙을 새 시스템 명세와 검토안으로 발전시킬 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 reverse-to-system-proposal 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:reverse-engineer-game-design $game-design-studio:design-game-systems $game-design-studio:review-game-design reverse-to-system-proposal에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:reverse-engineer-game-design $game-design-studio:design-game-systems $game-design-studio:review-game-design [공개 정보]를 사실·추론·제안으로 나눠 reverse-to-system-proposal에 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: reverse-engineer-game-design
- 스킬 흐름: reverse-engineer-game-design → design-game-systems → review-game-design
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- reverse-design-document
- system-specification
- game-design-review

### 예상 결과물
#### 최소 결과물
- fact/inference 역기획과 system specification

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/reverse-to-system-proposal/content.md

### 읽는 순서
- suite/reverse-to-system-proposal/content.md
- suite/reverse-to-system-proposal/evidence.yml
- suite/reverse-to-system-proposal/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 역기획 근거를 시스템 제안으로 넘기는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 reverse-to-system-proposal의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
reverse-to-system-proposal에 보존된 역기획과 막힌 이유를 읽고, 확인된 규칙부터 시스템 제안으로 다시 연결해.
```

</details>
