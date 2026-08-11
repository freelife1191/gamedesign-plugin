# Game Design Studio 5분 빠른 시작

목표는 모바일 협동 RPG 아이디어를 검토 가능한 첫 기획 요약서로 바꾸는 것입니다. App 자연어 호출과 명시적 스킬 호출 중 하나만 사용하세요.

## 시작 전에 준비할 입력

- 한 문장 게임 아이디어와 목표 플랫폼
- 예상 플레이어와 세션 형태
- 반드시 지킬 제약 또는 아직 모르는 항목
- 결과를 저장할 작업 폴더 이름(선택)

모르는 정보는 꾸며내지 말고 `미정`이라고 적습니다. 플러그인은 안전한 가정을 표시하고, 경로가 달라지는 질문만 요청합니다.

## App 자연어 호출

### 복사 가능한 요청문

```text
@Game Design Studio 모바일 협동 RPG의 대상 플레이어, 핵심 재미, 세 가지 설계 원칙과 검증 기준을 게임 기획 요약서로 만들어줘.
```

### 진행 흐름

1. 플러그인이 목표, 대상, 플랫폼과 제약을 정규화합니다.
2. 게임 비전과 적합한 Quality Profile을 선택합니다.
3. 대상 플레이어, 핵심 재미, 세 가지 설계 원칙과 검증 기준을 `content.md`에 작성합니다.
4. 사실·가정·미정 항목과 검토 게이트를 분리합니다.
5. 사용자는 세 가지 원칙, 제외 범위와 검증 기준을 채택할지 결정합니다.

### 예상 결과 요약

경로를 지정했다면 다음 구조의 Canonical Artifact를 예상할 수 있습니다. 경로를 지정하지 않았다면 쓰기 전에 제안 경로를 확인하세요.

```text
mobile-coop-rpg-brief/
├── content.md
├── evidence.yml
├── export-manifest.yml
├── decisions/
└── assets/
```

- `content.md`: 대상 플레이어, 핵심 재미, 설계 원칙, 검증 기준, 가정과 이번에 다루지 않을 목표
- `evidence.yml`: 외부 사실을 사용한 경우 출처·최신성·신뢰도
- `decisions/`: 사용자가 채택하거나 보류한 원칙과 이유
- `assets/`: 아직 생성하지 않은 이미지·도식 슬롯과 상태
- 내보내기 manifest: 요청 형식별 준비·renderer·QA 상태를 기록하며 파일 생성이나 QA 통과를 미리 약속하지 않음

## 명시적 스킬 호출

### 복사 가능한 요청문

```text
$game-design-studio:orchestrate-game-design-project 모바일 협동 RPG 아이디어를 game-design-brief부터 검토 가능한 Canonical Artifact까지 진행해줘.
```

### 진행 흐름

오케스트레이터가 필요한 최소 스킬 순서를 정하고, 각 Artifact에 Quality Profile을 적용한 뒤 비전과 후속 도메인 범위를 연결합니다. 검토 역할은 필요한 질문에만 배정하며, 이미지 계획·생성·승인과 도식·내보내기는 각각 별도 단계로 유지합니다.

사용자는 다음 결정을 맡습니다.

- 게임의 목표 플레이어와 핵심 재미를 채택할지
- 세 가지 설계 원칙 중 충돌하는 우선순위를 어떻게 정할지
- 가정과 미정 항목을 계속 허용할지
- 이미지·도식·파생 형식을 지금 만들지

### 예상 결과 요약

- `game-design-brief/content.md`: 기준 기획 내용
- `game-design-brief/evidence.yml`: 근거와 공백
- `game-design-brief/export-manifest.yml`: 요청 형식별 작업·renderer·QA 상태. 생성과 QA 성공은 실제 검증 뒤에만 기록
- `game-design-brief/decisions/*.md`: 결정, 대안, 부작용과 owner
- `game-design-brief/assets/`: 계획된 자산, prompt와 승인 상태
- 요청 형식 상태와 차단 사유를 포함한 마지막 작업 보고

## 다음 요청

```text
방금 만든 Canonical Artifact의 미정 항목과 차단 게이트를 우선순위로 정리하고, 다음에 확정할 한 가지 설계 결정을 제안해줘.
```
