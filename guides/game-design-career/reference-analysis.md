# 레퍼런스 분석을 포트폴리오 근거로 정리하기

이 가이드는 공개 자료와 직접 플레이 관찰을 게임 기획 포트폴리오의 분석 근거로 정리합니다. 관찰, 추론, 가설, 미정을 구분해 기록하며, 다른 게임의 시스템을 내 경험이나 성과처럼 쓰지 않습니다. 사람 검토 전에는 포트폴리오 문서나 지원 자료를 자동으로 바꾸지 않습니다.

분석과 전송 제안은 자동 승인하지 않습니다.

## 분석 범위와 근거 등급

직접 경쟁작, 핵심 시스템 우수 사례, 운영·수익화 비교작을 각각 고릅니다. 공식 자료와 직접 플레이는 1차 근거, 개발자 발표와 검증된 가이드는 보조 근거, 커뮤니티 글·영상·리뷰는 탐색 근거로 구분합니다. 탐색 근거는 다음 조사 질문을 찾는 데만 쓰고, 수익화·확률·유지율·인과를 확정하지 않습니다.

플레이 시간, 스크린샷, 유료 접근이나 네트워크가 없으면 제한과 확인 질문을 기록합니다. 접근하지 못한 자료는 없는 것으로 처리하지 않으며, 제한을 남긴 채 분석을 계속합니다.

## 단계별 요청문

각 요청문은 앞 단계의 결과를 이어서 사용합니다. App에서는 제품 이름으로 요청하고, CLI에서는 설치된 공개 스킬을 호출합니다.

### 포트폴리오에서 답할 질문 정하기

```text
@Game Design Career 이번 분석으로 결정할 질문 정의: 시스템 기획 포트폴리오에서 보스전 성장 설계를 어떤 관찰 근거로 설명할지 정리해 줘. 모르는 항목은 미정으로 남겨 줘.
```

### 비교작 역할 정하기

```text
$game-design-career:analyze-game-design-references 직접 경쟁작·핵심 우수 사례·운영 비교작 선정: 각 역할, 선정 이유, 접근 제한을 reference set에 기록해 줘.
```

### 관찰 근거 등록하기

```text
@Game Design Career 공식 자료와 사용자 플레이·스크린샷 등록: 출처가 직접 뒷받침하는 관찰만 기록하고, 추론·가설·미정과 한계를 분리해 줘.
```

### 평가 전에 시스템 정리하기

```text
$game-design-career:analyze-game-design-references 평가 없이 시스템 목록화: 시스템 ID, 이름, 연결 근거만 정리하고 우열 판단은 하지 마.
```

### 반복과 경제를 지도에 남기기

```text
@Game Design Career core/session/meta loop와 economy source-transform-sink 작성: 입력, 과정, 출력, 상태 전이와 확인할 공백을 시스템 지도에 남겨 줘.
```

### 심층 분석 순서 정하기

```text
$game-design-career:analyze-game-design-references 심층 분석 우선순위 확인: 플레이 경험, 경제·성장, 차별성, 근거 강도, 불확실성, 조사 비용을 점수와 이유로 보여 줘.
```

### 게임별 원리 비교하기

```text
@Game Design Career 게임별 해결 원리 비교: 같은 시스템이 각 게임에서 해결하는 문제와 관찰 근거를 비교하고, 근거가 부족하면 hold로 남겨 줘.
```

### 포트폴리오 적용 제안을 검토받기

```text
$game-design-career:analyze-game-design-references adopt/adapt/reject/hold 제안과 사람 검토: 각 제안을 pending-review와 validationState: not-run으로 기록하고, 승인 없이 포트폴리오 문서나 지원 자료를 수정하지 마.
```

## 결과 파일을 포트폴리오 근거와 분리하기

다음 파일은 선택한 결과 폴더 아래 `reference-intelligence/`에 기록합니다. 이 분석 파일은 개인 기여, 구현 경험, 공개 권한을 증명하지 않습니다.

- `reference-intelligence/brief.md`: 포트폴리오가 답할 결정 질문
- `reference-intelligence/reference-set.yml`: 비교작 역할과 접근 제한
- `reference-intelligence/evidence-register.yml`: 맥락, 관찰 근거와 제한
- `reference-intelligence/system-inventory.json`: 평가 전 시스템 목록
- `reference-intelligence/analysis-priority.md`: 심층 분석 우선순위
- `reference-intelligence/comparison-matrix.md`: 게임별 비교와 hold 상태
- `reference-intelligence/transfer-decisions.md`: adopt, adapt, reject, hold 제안
- `reference-intelligence/verification-queue.md`: 다시 확인할 질문

전송 제안은 모두 `pending-review`로 시작하고 `validationState: not-run`입니다. 사람은 관찰 근거, 개인 기여 경계, 권리·공개 범위와 다음 검증 방법을 확인한 뒤에만 포트폴리오에 반영할지를 결정합니다.

## 용어 후보를 별도로 확인하기

분석에서 발견한 용어는 [용어 사전 검토](glossary.md)에 후보로만 전달합니다. 용어 ID와 선호 표현이 원문이나 포트폴리오 문장을 자동 치환하지 않습니다.
