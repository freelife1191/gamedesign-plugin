# 게임 기획 시각화

도식은 글이나 표보다 관계를 더 분명하게 보여 줄 때만 만듭니다. `visualize-game-design`이 프리셋과 원문 연결 방식을 먼저 고르고, 함께 제공되는 Skillstead `svg-infographic`이 그 구조를 작성·검사·렌더링합니다.

[![Studio 오케스트레이션 예시](../assets/game-design-studio/studio-orchestration-map.png)](../assets/game-design-studio/studio-orchestration-map.svg)

## 도식 사용 기준

반복 흐름, 상태 전환, 진행 구조, 경제의 유입·소비, 로드맵, 의존 관계와 역할 구조는 도식에 적합합니다. 단순 목록은 본문이나 표로 남깁니다. 수치 정확성이 필요한 막대·선·산점·열 지도는 차트 기능을 사용합니다. 캐릭터 원화, 배경 장면, 마스코트, 로고와 마케팅 삽화에는 Skillstead를 사용하지 않습니다.

## 제공 프리셋

| 프리셋 | 적합한 관계 | 부적합한 입력 |
| --- | --- | --- |
| `core-motivation-loop` | 플레이어 행동, 피드백, 보상, 반복 동기 | 근거 없는 예시 반복 흐름이나 잔존율 차트 |
| `state-rule-flow` | 상태, 우선순위, 전환, 보호 조건, 복구 | 근거가 되는 상태나 우선순위가 없는 규칙 |
| `quest-content-progression` | 퀘스트 단계, 분기, 진행 조건, 결과, 반복 경로 | 관계가 드러나지 않는 콘텐츠 목록 |
| `economy-source-sink` | 재화 유입·소비, 교환, 상한, 관리 주체 | 기준 근거가 없는 가격·확률 |
| `liveops-roadmap` | 날짜가 있는 단계, 이정표, 승인 조건, 되돌리기, 담당자 | 근거 없이 만든 일정이나 통계 차트 |
| `production-role-structure` | 역할, 의존 관계, 인계, 이정표, 상위 보고 | 검증되지 않은 인력 추정치 |

프리셋은 정확히 하나만 고릅니다. 표현할 관계, 원문의 고정된 섹션, 제외한 대안과 도식이 필요한 이유를 함께 기록합니다.

## 원문 연결과 SVG 원본

모든 노드, 연결선, 레이블, 날짜와 수치 설명을 원문 위치에 연결합니다. 예시용 자리표시자는 `illustrative`, `non-canonical`로 표시하고 검증 완료 대상에서 제외합니다. 편집 가능한 SVG를 원본으로 삼고, 비어 있지 않은 `<title>`과 `<desc>`, 인접한 대체 텍스트와 안정적인 원문 연결을 갖춥니다. PNG만 따로 수정하지 않습니다.

## 문법 검사와 렌더링

제품에 포함된 실행 스크립트를 사용하고 내부 제공 경로를 직접 호출하지 않습니다.

다음 명령은 **저장소 루트**에서 실행합니다.

`path/to/diagram.svg`와 `path/to/diagram.png`는 실제 파일 경로로 바꿔야 하는 자리표시자입니다.

```bash
node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs lint path/to/diagram.svg
node products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs render path/to/diagram.svg path/to/diagram.png
```

문법 검사는 실행 명령, 종료 코드, 로그, 검사기 식별 정보·다이제스트와 SVG 경로·다이제스트를 보존합니다. 렌더링은 기준 Chromium 실행 파일·버전, 렌더러 다이제스트, 실행 명령, 종료 코드, SVG·PNG 다이제스트, `viewBox`와 실제 크기를 보존하고 정확한 2배 PNG인지 확인합니다.

## Node.js 18 이상이 없을 때

먼저 `node --version`으로 Node.js 18 이상인지 확인합니다. Node.js는 SVG 작성에는 필요하지 않지만, 함께 제공되는 원문 검사와 자동 검사 결과를 인계하려면 필요합니다.

Node.js가 없으면 운영체제와 신뢰할 수 있는 패키지 관리자를 확인하고, 설치 후보가 Node.js 18 이상을 제공하는지 검증합니다. 정확한 설치 명령을 제시하되 사용자가 명시적으로 승인하기 전에는 설치하지 않습니다. `curl | sh`는 사용하지 않으며 관리자 권한이 필요하면 별도로 알립니다. 설치 뒤 버전을 다시 확인하고, 실패하거나 구버전이면 다른 경로를 시도하기 전에 다시 승인을 받습니다.

사용자가 거절하거나 안전한 설치 경로가 없으면 수동 원문 확인 목록을 작성하고 `render.sh`를 호출하지 않습니다. 문서화된 Node.js 없는 Chromium 경로로 정확한 2배 PNG를 렌더링하고 화면 품질을 검사합니다. 이 결과를 자동 검사 완료로 표시하지 않으며, 원문 자동 검사를 실행하지 않았다는 사실과 수동 확인 목록, PNG 렌더링·화면 검사 상태를 각각 밝힙니다.

Chromium도 없으면 SVG 초안만 전달하고 원문 자동 검사와 PNG 화면 검사를 모두 실행하지 않았다고 표시합니다.

## 2단계 품질 검사

1. 전체 화면에서 읽는 순서와 주요 연결선이 바로 보이는지 확인합니다.
2. 확대 화면에서 한글을 포함한 글자, 요소 경계, 화살표 몸통·촉, 명암 대비, 원문 충실도와 대체 텍스트를 확인합니다.

`requested`, `generated`, `linted`, `rendered`, `verified`는 서로 독립된 상태입니다. 문법 검사·브라우저·렌더링·화면 검사가 실패하면 기준 결과물과 통과한 SVG를 보존하고 PNG는 `failed` 또는 `unavailable`로 남깁니다.

## 복사 가능한 요청문

```text
@Game Design Studio 검증된 시스템 상태와 복구 관계만 원문에 연결해 알맞은 프리셋을 골라 줘. 편집 가능한 SVG, 제품 실행 스크립트의 검사 결과, 정확한 2배 PNG와 전체·확대 화면 검사 근거를 남겨 줘.
```
