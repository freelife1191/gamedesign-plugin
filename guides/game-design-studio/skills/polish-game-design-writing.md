# 게임 기획 문장 윤문 (polish-game-design-writing)

<a id="직접-호출-활용-polish-game-design-writing"></a>

## 목적과 최종 산출물

확정된 기획의 뜻, 수치, ID와 승인 상태는 그대로 두고 문장만 읽기 쉽게 다듬습니다. 수정본과 변경 기록, 보호 항목 확인표를 함께 남깁니다.

## 사용할 때

기획 검토가 끝난 뒤 공유용 초안의 어색한 표현, 반복, 번역투를 정리할 때 사용합니다.

## 사용하지 않을 때

규칙·밸런스·일정 자체를 바꾸거나 승인 결정을 내려야 할 때는 관련 설계·검토 스킬을 먼저 사용합니다.

## 필수 입력과 선택 입력

- 필수: 원문, 독자, 바꾸면 안 되는 수치·ID·결정.
- 선택: 팀 용어집, 원하는 분량, 검토자의 피드백.

## Codex App 요청 예시

**복사 가능한 요청문**

`@Game Design Studio 아래 전투 튜토리얼 초안을 문장만 자연스럽게 다듬어 줘. 수치와 규칙 ID는 바꾸지 말고 수정 이유를 남겨 줘.`

## Codex CLI 요청 예시

`$game-design-studio:polish-game-design-writing 전투 튜토리얼 초안을 문장만 다듬고 수치·규칙 ID·승인 상태는 보존해.`

## 내부 진행 흐름

원문과 보호 항목 확인 → 문체·용어 점검 → 수정안과 변경 기록 작성 → 사람이 뜻과 공개 범위를 확인합니다.

## 생성 파일과 결과 구조

예상 결과는 `content.md`의 수정안, `decisions/`의 변경 기록, 검토자가 확인할 보호 항목 목록입니다.

## 관련 템플릿·품질 프로필·전문 역할

긴 문서는 [문서 품질 안내](../document-quality.md)와 함께 사용하고, 사실이나 구현 타당성은 담당 기획자·전문 검토자에게 확인합니다.

## 이미지·도식화 조건

문장 윤문만으로 충분하면 이미지를 만들지 않습니다. 구조 설명이 필요할 때만 [구조 HTML 도식](archify.md) 또는 `svg-infographic`으로 별도 도식을 요청합니다.

## 검토·승인 기준

문체가 자연스러워도 원래의 의미, 수치, ID, 승인·보류 상태가 같아야 합니다. 원문과 수정안은 각각 UTF-8 기준 128KiB, 문자 단위(code point) 65,536개까지 검토합니다. 이를 넘으면 비교하지 않고 문서를 목적·규칙·검토 메모처럼 의미 있는 단위로 나눠 다시 요청합니다. 변경률은 반올림 전 값으로 판정하고 영수증에는 소수점 여섯째 자리까지 표시합니다. 30%를 넘으면 사람이 다시 살피고, 50%를 넘으면 수정안을 버리고 원문에서 다시 시작합니다. 반복 문자가 지나치게 많은 긴 문서는 비교 횟수가 100만 번을 넘기기 전에 중단하므로, 이 경우에도 문서를 나눠 다시 요청합니다. 최종 공유 여부는 문서 책임자가 결정합니다.

## 실패·fallback·재개 방법

보호 항목이 없거나 의미가 불명확하면 수정하지 않고 질문과 보류 문장을 남깁니다. 원문과 피드백을 보완한 뒤 같은 요청으로 다시 시작합니다.

## 다음 작업 요청문

자리표시자 `<원문 경로>`와 `<수정본 경로>`은 실제 경로로 바꾸고 [공통 규칙](../../README.md#용어)을 따릅니다.

`<수정본 경로>`과 `<원문 경로>`을 비교해 바뀐 표현만 검토하고, 의미가 달라진 문장은 보류로 표시해 줘.

## 관련 문서

### 직접 호출 활용 — polish-game-design-writing

아래 요청문은 보호 항목을 보존하며 문장만 다듬습니다.

- [Studio 스킬 레퍼런스](README.md)
- [문서 품질 안내](../document-quality.md)

<!-- PROMPT-TEMPLATES:START game-design-studio:polish-game-design-writing -->
### 재사용 프롬프트 템플릿

- [beginner: 게임 기획 문장 윤문 초안](../../prompt-templates/studio/polish-game-design-writing.md#studiopolish-game-design-writingbeginner)
- [standard: 보호 기록을 갖춘 기획 문장 검수](../../prompt-templates/studio/polish-game-design-writing.md#studiopolish-game-design-writingstandard)
- [advanced: 보류 상태를 지키는 기획 윤문](../../prompt-templates/studio/polish-game-design-writing.md#studiopolish-game-design-writingadvanced)
<!-- PROMPT-TEMPLATES:END game-design-studio:polish-game-design-writing -->
