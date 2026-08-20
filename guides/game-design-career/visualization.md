# Career 시각화

Career 도식은 역할, 역량, 학습, 포트폴리오와 성장의 관계를 글이나 표보다 더 분명하게 보여 줄 때만 사용합니다. `visualize-career-roadmap`이 프리셋과 원문 연결 방식을 고르고, 함께 제공되는 Skillstead가 SVG를 작성·검사·렌더링합니다.

[![Career 역할·학습 로드맵 예시](../assets/game-design-career/role-gap-learning-roadmap.png)](../assets/game-design-career/role-gap-learning-roadmap.svg)

## 프리셋 선택

| 프리셋 | 관계 | 제외 조건 |
| --- | --- | --- |
| `role-map` | 역할군·책임·근거·인접 경로 | 역할 하나를 글로 충분히 설명할 수 있음 |
| `competency-map` | 역량 사이의 의존·지원 관계 | 순서가 없는 확인 목록뿐임 |
| `learning-roadmap` | 근거 과제의 선행 조건·단계 순서 | 기간·순서·선행 조건의 근거가 없음 |
| `development-process` | 인계·피드백·결정·승인 조건의 순서 | 의미 있는 인계나 분기가 없음 |
| `portfolio-information-architecture` | 탐색·사례 중첩·근거 배치 구조 | 순서가 있는 짧은 섹션 목록만으로 충분함 |
| `growth-path` | 여러 임시 경로·차이·검토 지점 | 원문이 행동 하나만 뒷받침하거나 확정된 성장 경로처럼 보임 |

각 프리셋의 선택 질문과 제외 조건을 모두 비교하고 `selectedPresetId`, 선택 이유와 제외한 모든 프리셋의 이유를 기록합니다. 수치형 막대·선·산점·열 지도는 데이터 정확성을 보장하는 차트 작업으로 넘깁니다.

## 근거 사용 범위

모든 노드, 연결선, 레이블과 정성적 순서는 안정적인 원문 위치와 연결합니다. 현재 역할·채용 공고·도구에 관한 주장에는 사실·추론·제안, 검색일, 지역, 표본과 일반화 한계를 함께 남깁니다. 수치·점수·기간은 원문, 비교 기준, 담당자와 검증 방법이 모두 갖춰지지 않으면 비워 둡니다. 배치만으로 채용 가능성, 역량 수준이나 진행도를 암시하지 않으며 합격을 보장하지 않습니다.

편집 가능한 SVG를 원본으로 삼습니다. 루트의 바로 아래에는 비어 있지 않은 `<title>`과 `<desc>`, 일치하는 `aria-label`, 인접한 대체 텍스트가 있어야 합니다. 실행 가능한 `<script>`·`<style>` 요소와 잘못된 XML 문자는 거부합니다.

## 제품 실행 스크립트

내부 제공 경로를 직접 호출하지 않고 제품에 포함된 실행 스크립트를 사용합니다.

다음 명령은 **저장소 루트**에서 실행합니다.

`path/to/diagram.svg`와 `path/to/diagram.png`는 실제 파일 경로로 바꿔야 하는 자리표시자입니다.

```bash
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs lint path/to/diagram.svg
node products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs render path/to/diagram.svg path/to/diagram.png
```

실행 명령, 종료 결과, 파일·다이제스트, 검사기·렌더러 식별 정보, Chromium 실행 파일·버전, `viewBox`와 실제 크기를 보존합니다. PNG는 정확한 2배 크기여야 하며 전체 화면과 확대 화면 검사를 모두 통과해야 합니다.

## Node.js 18 이상이 없을 때

먼저 `node --version`으로 Node.js 18 이상인지 확인합니다. Node.js는 SVG 작성에는 필요하지 않지만, 함께 제공되는 원문 검사와 자동 검사 결과를 인계하려면 필요합니다.

Node.js가 없으면 운영체제와 신뢰할 수 있는 패키지 관리자를 확인하고, 설치 후보가 Node.js 18 이상을 제공하는지 검증합니다. 정확한 설치 명령을 제시하되 명시적인 승인 전에는 설치하지 않습니다. `curl | sh`는 사용하지 않으며 관리자 권한이 필요하면 알립니다. 설치 뒤 버전을 다시 확인하고, 실패하거나 구버전이면 다른 경로를 시도하기 전에 새 승인을 받습니다.

사용자가 거절하거나 안전한 설치 경로가 없으면 수동 원문 확인 목록을 작성하고 `render.sh`를 호출하지 않습니다. 문서화된 Node.js 없는 Chromium 경로로 정확한 2배 PNG를 렌더링하고 화면 품질을 검사합니다. 이 결과를 자동 검사 완료로 표시하지 않으며, 원문 자동 검사 미실행과 수동 확인 목록, 렌더링·화면 검사 상태를 각각 기록합니다.

Chromium도 없으면 SVG 초안만 전달하고 원문 자동 검사와 PNG 화면 검사를 모두 실행하지 않았다고 명시합니다.

## 상태와 승인

`requested`, `planned`, `generated`, `linted`, `rendered`, `verified`는 서로 독립된 상태입니다. 명령을 계획했다고 해서 실행된 것은 아니며, 렌더링 결과가 담당자의 문서·권리 승인을 뜻하지도 않습니다. 실패하면 기준 결과물과 통과한 SVG 근거를 보존합니다.

## 복사 가능한 요청문

```text
@Game Design Career 최신 근거에 연결된 시스템 기획 역량과 12주 증거 프로젝트의 의존 관계만 도식화해 줘. 프리셋 선택·제외 이유, 편집 가능한 SVG, 정확한 2배 PNG와 2단계 품질 검사 근거를 남겨 줘.
```
