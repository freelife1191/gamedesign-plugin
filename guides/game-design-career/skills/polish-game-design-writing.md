# 커리어 기획 문장 윤문 (polish-game-design-writing)

## 목적과 최종 산출물

제공한 경력 증거와 주장 경계를 바꾸지 않고 포트폴리오·학습 문서의 한국어 문장을 다듬습니다. 수정본, 변경 기록과 증거 보존 확인표를 남깁니다.

## 사용할 때

포트폴리오나 학습 기록의 표현을 다듬되 경험·성과를 새로 만들지 않아야 할 때 사용합니다.

## 사용하지 않을 때

지원 전략, 역할 적합성, 면접 답변 내용을 판단해야 하면 Career 전문 스킬과 멘토 검토를 먼저 사용합니다.

## 필수 입력과 선택 입력

- 필수: 원문, 독자, 증거 ID와 바꾸면 안 되는 주장.
- 선택: 지원 직무, 포트폴리오 톤, 멘토 피드백.

## Codex App 요청 예시

**복사 가능한 요청문**

`@Game Design Career 아래 포트폴리오 설명을 문장만 자연스럽게 다듬어 줘. 경험과 수치, 증거 ID는 바꾸지 말고 변경 이유를 표시해 줘.`

## Codex CLI 요청 예시

`$game-design-career:polish-game-design-writing 포트폴리오 설명을 문장만 다듬고 경험·수치·증거 ID·보류 claim은 보존해.`

## 내부 진행 흐름

원문과 증거 경계 확인 → 문체·용어 점검 → 수정안과 변경 기록 작성 → 멘토 또는 작성자가 사실을 확인합니다.

## 생성 파일과 결과 구조

예상 결과는 수정한 `content.md`, 증거 경계를 확인한 기록, 사람이 검토할 변경 목록입니다.

## 관련 템플릿·품질 프로필·전문 역할

[포트폴리오 템플릿](../templates.md)과 문서 품질 프로필을 함께 사용하며, 주장 타당성은 포트폴리오 검토자나 멘토에게 확인합니다.

## 이미지·도식화 조건

문장 윤문만으로 충분하면 이미지를 만들지 않습니다. 경력 흐름을 설명해야 할 때만 [구조 HTML 도식](archify.md) 또는 `svg-infographic`을 별도로 요청합니다.

## 검토·승인 기준

수정 후에도 경험, 수치, 증거 ID, 공개·보류 판단이 원문과 같아야 합니다. 최종 공개는 작성자 또는 멘토가 결정합니다.

## 실패·fallback·재개 방법

근거가 빠졌거나 의미가 불명확하면 문장을 꾸며 쓰지 않고 질문을 남깁니다. 증거와 피드백을 보완한 뒤 다시 요청합니다.

## 다음 작업 요청문

자리표시자 `<원문 경로>`와 `<수정본 경로>`은 실제 경로로 바꾸고 [공통 규칙](../../README.md#용어)을 따릅니다.

`<수정본 경로>`에서 증거 없이 강해진 표현이 없는지 확인하고, 확인이 필요한 문장만 질문으로 남겨 줘.

## 관련 문서

- [Career 스킬 레퍼런스](README.md)
- [문서 품질 안내](../document-quality.md)

<!-- PROMPT-TEMPLATES:START game-design-career:polish-game-design-writing -->
### 재사용 프롬프트 템플릿

- [beginner — 커리어 문장 윤문 초안](../../prompt-templates/career/polish-game-design-writing.md#careerpolish-game-design-writingbeginner)
- [standard — 증거 기록을 갖춘 커리어 문장 검수](../../prompt-templates/career/polish-game-design-writing.md#careerpolish-game-design-writingstandard)
- [advanced — 보류 주장을 지키는 커리어 윤문](../../prompt-templates/career/polish-game-design-writing.md#careerpolish-game-design-writingadvanced)
<!-- PROMPT-TEMPLATES:END game-design-career:polish-game-design-writing -->
