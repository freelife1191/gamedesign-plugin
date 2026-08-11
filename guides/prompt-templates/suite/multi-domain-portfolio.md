# Game Design Plugin Suite 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: suite:multi-domain-portfolio:case -->
## suite:multi-domain-portfolio:case

**여러 기획 분야를 한 포트폴리오로 묶기**

Studio의 시스템·플레이어 경험·경제 기획을 Career 포트폴리오에서 개인 판단과 근거로 엮는다.

### 간단 요청 예시
```text
@Game Design Studio의 시스템·플레이어 경험·경제 기획을 @Game Design Career 포트폴리오 사례로 연결해 줘.
```

### 짧은 흐름
- 작업 순서: design-game-systems → design-player-experience → design-game-economy-and-liveops → build-game-design-portfolio
- 함께 검토하는 역할: lead-game-designer → career-strategist

### 이 요청으로 받는 결과
포트폴리오 초안은 섬 복구 게임의 자원 순환, 협동 동선, 보상 경제를 한 사례로 묶고 각 결정 옆에 담당한 판단과 근거 위치를 적었습니다. 플레이테스트가 없는 경제 효과 주장은 공개 보류로 남겼습니다. (ID: suite:multi-domain-portfolio:case; 파일: suite/multi-domain-portfolio/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
서로 다른 기획 분야의 작업을 하나의 포트폴리오 사례로 묶을 때 사용한다.

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
@Game Design Studio와 @Game Design Career에서 [공개 정보]를 사실·추론·제안으로 나눠 multi-domain-portfolio 인계 문서를 작성해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-studio:design-game-systems $game-design-studio:design-player-experience $game-design-studio:design-game-economy-and-liveops $game-design-career:build-game-design-portfolio multi-domain-portfolio에 넣을 공개 가능한 근거 요약을 작성해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-studio:design-game-systems $game-design-studio:design-player-experience $game-design-studio:design-game-economy-and-liveops $game-design-career:build-game-design-portfolio [공개 정보]를 사실·추론·제안으로 나눠 multi-domain-portfolio에 기록해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: design-game-systems
- 스킬 흐름: design-game-systems → design-player-experience → design-game-economy-and-liveops → build-game-design-portfolio
- 전문 역할: lead-game-designer → career-strategist

### 중간 산출물
- system-specification
- ui-ux-flow-state
- economy-balance
- creative-design-portfolio

### 예상 결과물
#### 최소 결과물
- 개인 판단과 evidence index

#### 선택 결과물
- 제외 기록

#### 확장 결과물
- 재개 기록

### 파일 구조
- suite/multi-domain-portfolio/content.md

### 읽는 순서
- suite/multi-domain-portfolio/content.md
- suite/multi-domain-portfolio/evidence.yml
- suite/multi-domain-portfolio/export-manifest.yml

### 도식 바인딩
- ID: st-s01
- SVG: guides/assets/game-design-studio/skills/apply-document-quality-profile.svg
- PNG: guides/assets/game-design-studio/skills/apply-document-quality-profile.png
- 대체 텍스트: 여러 기획 분야를 포트폴리오 사례로 묶는 흐름

### 사람 검토
#### 승인 경계
지정된 의사결정권자가 multi-domain-portfolio의 공개 범위를 승인하거나 보류한다.

#### 보류 조건
- 권리, 근거 또는 승인 기록이 없으면 보류

#### 안전 경계
모르는 정보는 미정으로 남긴다. Do not request credentials, personal data, or private materials.

### 실패와 재개
```text
multi-domain-portfolio에 보존된 분야별 파일과 막힌 이유를 읽고, 근거가 확인된 사례부터 포트폴리오 작업을 재개해.
```

</details>
