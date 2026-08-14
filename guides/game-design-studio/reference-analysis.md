# 경쟁작 분석으로 설계 가설을 검토하기

이 가이드는 공개 자료와 직접 플레이 관찰을 바탕으로 경쟁작 시스템을 비교하고, Studio 설계에 적용할 제안을 준비합니다. 분석은 결론을 확정하지 않습니다. 관찰, 추론, 가설, 미정을 따로 기록하고 사람 검토 전에는 어떤 시스템 명세도 바꾸지 않습니다.

분석과 전송 제안은 자동 승인하지 않습니다.

## 분석을 시작할 자료와 경계

직접 경쟁작, 핵심 시스템 우수 사례, 운영·수익화 비교작을 각각 고릅니다. 한 게임이 여러 역할을 맡을 수 있습니다. 공식 자료와 직접 플레이는 1차 근거, 개발자 발표와 검증된 가이드는 보조 근거, 커뮤니티 글·영상·리뷰는 탐색 근거로 기록합니다. 탐색 근거만으로 수익화·확률·유지율·인과를 확정하지 않습니다.

유료 접근, 네트워크, 스크린샷 또는 플레이 시간이 없으면 제한과 확인 질문을 남깁니다. 자료가 없다는 이유로 부재를 추정하지 않으며, 작업은 제한을 기록한 채 계속합니다.

장르 관례와 오버레이는 조사 질문을 고르는 단서일 뿐입니다. 프로젝트 규칙이나 전송 제안의 자동 의무가 아닙니다.

## 단계별 요청문

각 요청문은 앞 단계의 결과를 이어서 사용합니다. App에서는 제품 이름으로 요청하고, CLI에서는 설치된 공개 스킬을 호출합니다.

### 결정 질문을 정하기

```text
@Game Design Studio 이번 분석으로 결정할 질문 정의: 4인 협동 RPG의 보스전 재도전 동기를 어떤 규칙으로 설계할지 검토해 줘. 아직 모르는 항목은 미정으로 남겨 줘.
```

### 비교 대상을 고르기

```text
$game-design-studio:analyze-game-design-references 직접 경쟁작·핵심 우수 사례·운영 비교작 선정: 각 역할과 선정 이유, 접근 제한을 reference set에 기록해 줘.
```

### 근거를 등록하기

```text
@Game Design Studio 공식 자료와 사용자 플레이·스크린샷 등록: 출처별 관찰만 기록하고, 추론·가설·미정과 한계를 분리해 줘.
```

### 시스템을 목록화하기

```text
$game-design-studio:analyze-game-design-references 평가 없이 시스템 목록화: 시스템 ID, 이름, 연결 근거만 정리하고 우열 판단은 하지 마.
```

### 반복 구조와 경제를 그리기

```text
@Game Design Studio core/session/meta loop와 economy source-transform-sink 작성: 입력, 과정, 출력, 상태 전이와 확인할 공백을 시스템 지도에 남겨 줘.
```

### 심층 분석 대상을 정하기

```text
$game-design-studio:analyze-game-design-references 심층 분석 우선순위 확인: 플레이 경험, 경제·성장, 차별성, 근거 강도, 불확실성, 조사 비용을 점수와 이유로 보여 줘.
```

### 선택한 시스템을 심층 분석하기

```text
$game-design-studio:analyze-game-design-references 선택한 시스템 심층 분석 실행: 우선순위가 높은 시스템의 관찰 근거, 불확실성, 시스템 지도와 확인 질문을 분리해 기록해 줘.
```

### 해결 원리를 비교하기

```text
@Game Design Studio 게임별 해결 원리 비교: 같은 시스템이 각 게임에서 해결하는 문제와 관찰 근거를 비교하고, 근거가 부족하면 hold로 남겨 줘.
```

### 적용 제안을 사람에게 넘기기

```text
$game-design-studio:analyze-game-design-references adopt/adapt/reject/hold 제안과 사람 검토: 각 제안을 pending-review와 validationState: not-run으로 기록하고, 승인 없이 Studio 시스템 명세를 수정하지 마.
```

## 결과 파일을 확인하기

선택한 결과 폴더 아래에 다음 분석 파일을 기록합니다. 이 파일은 Canonical Artifact의 `content.md`나 기존 시스템 명세를 자동으로 바꾸지 않습니다.

- `reference-intelligence/brief.md`: 결정 질문
- `reference-intelligence/reference-set.yml`: 비교작 역할과 접근 제한
- `reference-intelligence/evidence-register.yml`: 맥락, 관찰 근거와 제한
- `reference-intelligence/system-inventory.json`: 평가 전 시스템 목록
- `reference-intelligence/analysis-priority.md`: 심층 분석 우선순위
- `reference-intelligence/comparison-matrix.md`: 비교 결과와 hold 상태
- `reference-intelligence/transfer-decisions.md`: adopt, adapt, reject, hold 제안
- `reference-intelligence/verification-queue.md`: 확인이 필요한 질문
- `reference-intelligence/system-maps/<map-id>.json`: 선택한 시스템의 연결과 반복 구조
- `reference-intelligence/deep-dives/<system-id>.md`: 선택한 시스템의 심층 분석

전송 제안은 모두 `pending-review`로 시작하며 `validationState: not-run`입니다. 사람은 근거, 프로젝트 제약, 위험, 검증 방법을 확인한 뒤에만 채택 여부를 결정합니다.

## 용어 후보를 따로 검토하기

분석에서 낯선 용어가 나오면 [용어 사전 검토](glossary.md)로 후보만 보냅니다. 용어 ID와 선호 표현은 출처 문장을 자동 치환하지 않습니다.
