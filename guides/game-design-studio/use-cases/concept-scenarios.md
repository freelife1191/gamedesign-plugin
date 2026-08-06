# Studio 콘셉트 시나리오

이 문서는 같은 게임 기획 역량이 장르, 플랫폼, 운영 방식에 따라 어떻게 달라지는지 비교합니다. 모든 사례는 가상·중립 예시입니다. 재미, 시장성, KPI, retention과 수치는 결론이 아니라 prototype 또는 telemetry로 검증할 가정이며, 특정 회사의 역할 분담·문서 형식·성공 공식을 복제하지 않습니다.

## ST-G01 모바일 수집형 RPG·라이브서비스

### 현재 상황과 목표

**플레이어 맥락:** 이동 중 모바일 기기로 짧거나 중단되는 세션을 보내며, 캐릭터를 수집하고 조합을 바꾸는 플레이어를 가정합니다.

**설계 제약:** 수집 동기, 전투 준비, 성장 경제와 LiveOps 콘텐츠가 서로를 강제하지 않도록 범위와 보호 기준을 함께 설계해야 합니다.

**전이 가능한 역량:** 핵심 행동과 선택은 `ST-C02`, 성장·경제·실험 경계는 `ST-C07`에서 가져와 콘셉트 제약에 적용합니다.

**지원되지 않는 가정:** D30 retention 수치는 prototype과 telemetry로 검증할 가정입니다. KPI, 매출, 재미나 시장 적합성을 장르 관습만으로 단정하지 않습니다.

**검증 계획:** 전투 준비 prototype에서 조합 선택 이유를 관찰하고, 동의된 telemetry로 source·sink와 이벤트 참여·중단 지점을 검증합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 수집, 성장, 전투 준비와 운영 이벤트의 상호작용을 검토할 때.
- 부적합: 확률·가격·retention 목표를 근거 없이 확정하거나 특정 서비스의 구조를 복제할 때.

### 준비 입력

- player promise, 세션·플랫폼 가정, 수집 대상, 전투 verb, resource ID, 이벤트 목적과 실제 decision owner를 준비합니다.
- 기존 지표가 있다면 정의·수집 동의·기간을 함께 기록하고, 없다면 모두 `assumption`으로 둡니다.

### 10분 미니 실습

1. 수집 → 편성 → 전투 → 성장 → 다음 선택을 한 줄씩 적습니다.
2. 각 단계의 플레이어 선택과 강제 대기를 구분합니다.
3. 실패 후 재편성 또는 자원 회복 경로 하나를 씁니다.

### 표준 실습

1. `game-design-brief`에 player promise와 non-goal을 고정합니다.
2. `economy-balance`에서 source, sink, cap, 보호 기준과 rollback 조건을 연결합니다.
3. `liveops-experiment-event`는 한 변수, 관찰 신호, stop condition과 복구 절차를 갖게 합니다.
4. 이벤트가 본편 선택을 약화시키거나 결제를 강제하는 반례를 review finding으로 남깁니다.

### 포트폴리오·실무 확장

완성된 수치표보다 수집 동기와 경제 보호 기준, 기각한 이벤트 대안, telemetry 정의와 사람의 결정을 공개 가능한 증거로 제시합니다.

### Codex App 요청문

```text
@Game Design Studio 중립적인 모바일 수집형 RPG 아이디어를 전투 준비 루프, 성장 경제, LiveOps 한 변수 실험과 플레이어 보호 기준으로 나누고 모든 수치는 검증할 가정으로 남겨 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-economy-and-liveops artifact=game-design/mobile-collection-rpg/economy-liveops 수집·성장 source와 sink, 이벤트 한 변수, stop condition과 telemetry 질문을 작성해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-game-economy-and-liveops` → `design-game-content` → `review-game-design` 순서입니다. 실제 템플릿은 `game-design-brief`, `economy-balance`, `liveops-experiment-event`이며, 자동 finding은 지정된 사람의 범위·정책 결정을 대신하지 않습니다.

### 결과물

**최소 결과:** `game-design-brief`, `economy-balance`, `liveops-experiment-event` 초안과 연결된 근거.

**선택 결과:** source·sink 표, 이벤트 상태·복구 점검표와 telemetry 정의.

**확장 결과:** 사람 검토를 통과한 실험 범위와 rollback 결정 기록.

**파일 트리:**

```text
game-design/mobile-collection-rpg/economy-liveops/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `EXP-COLLECT-01 | 변수: 이벤트 교환 규칙 | 근거: assumption | stop: 보호 기준 위반 | owner: pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** 지정된 design·economy·policy owner가 경제 규칙, 실험 범위, telemetry 동의와 rollback을 승인·수정·보류합니다. 생성 결과는 자동 승인하지 않습니다.

### 실패·재개

수집 동기와 결제 압력이 구분되지 않거나 지표 정의가 없으면 실험을 `blocked`로 둡니다. **보존:** stable resource ID, 확인된 근거, 기존 결정과 통과한 보호 기준.

**재개 요청문:**

```text
$game-design-studio:design-game-economy-and-liveops 기존 game-design/mobile-collection-rpg/economy-liveops를 보존하고 승인된 telemetry 정의부터 EXP-COLLECT-01을 재개해.
```

### 자기점검과 다음 학습

- 수집·성장·이벤트가 서로 다른 선택을 제공하는가? 수치와 성공 주장을 가정으로 표시했는가?
- 실패 복구와 rollback이 플레이어 보호 기준에 연결되는가? 다음에는 `ST-C07`의 한 변수 실험을 더 깊게 검토합니다.

## ST-G02 캐주얼 퍼즐·방치형

### 현재 상황과 목표

**플레이어 맥락:** 짧은 퍼즐 세션을 즐기고 중단 뒤 복귀하여 이전 선택의 결과를 확인하려는 플레이어를 가정합니다.

**설계 제약:** 방치 시간, 오프라인 진행, 퍼즐 난도와 정보 부하가 복귀를 처벌하거나 행동하지 않음을 강요하지 않아야 합니다.

**전이 가능한 역량:** 관찰 가능한 핵심 루프는 `ST-C02`, 첫 세션·복귀 피드백과 접근성은 `ST-C04`에서 전이합니다.

**지원되지 않는 가정:** 단순한 규칙이나 자동 보상이 곧 재미와 장기 참여를 만든다는 주장은 검증되지 않은 가정으로 남깁니다.

**검증 계획:** 종이 또는 디지털 prototype으로 퍼즐 선택을 관찰하고, 동의된 telemetry에서 중단·복귀와 오프라인 보상 이해를 확인합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 짧은 퍼즐, 중단 가능한 세션과 복귀 상태를 함께 설계할 때.
- 부적합: 알림 빈도나 대기 시간을 참여 공식으로 단정하고 강제 반복을 설계할 때.

### 준비 입력

- 퍼즐 verb, 목표·방해·실패, 세션 중단 상태, 오프라인 진행 규칙, 복귀 cue와 입력 대안을 준비합니다.
- 목표 세션 길이 같은 수치는 측정 전 `assumption`으로 표시합니다.

### 10분 미니 실습

1. 퍼즐 한 판의 선택과 피드백을 세 단계로 적습니다.
2. 앱을 닫는 시점 세 곳과 복귀 상태를 연결합니다.
3. 색상 없이도 이해할 수 있는 cue 하나를 추가합니다.

### 표준 실습

1. `core-motivation-loop`에 퍼즐 선택, 결과와 다음 시도를 기록합니다.
2. `ui-ux-flow-state`에 시작·중단·오프라인 계산·복귀·오류 상태를 넣습니다.
3. 보상 수령이 유일한 복귀 이유가 되는 반례와 오프라인 결과 거부 경로를 검토합니다.
4. `game-design-review`에서 정보 계층, interruption recovery와 sensory alternative를 확인합니다.

### 포트폴리오·실무 확장

퍼즐 규칙의 참신함보다 중단·복귀 상태, 정보 부하를 줄인 대안, 관찰 근거와 수정 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 캐주얼 퍼즐·방치형 예시의 핵심 루프와 중단·오프라인·복귀 상태를 설계하고 강제 알림이나 재미 주장은 가정으로 분리해 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/casual-puzzle-idle/session-loop 퍼즐 규칙과 중단·오프라인·복귀 상태 및 실패 복구를 명세해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-game-systems` → `design-player-experience` → `review-game-design` 순서입니다. `core-motivation-loop`, `ui-ux-flow-state` 템플릿을 사용하며 검토 결과는 사람 결정을 기다립니다.

### 결과물

**최소 결과:** `core-motivation-loop`, `ui-ux-flow-state`, `game-design-review` 내용과 근거.

**선택 결과:** 중단·복귀 test case와 접근 가능한 cue 목록.

**확장 결과:** prototype 관찰을 반영한 상태·예외 변경 기록.

**파일 트리:**

```text
game-design/casual-puzzle-idle/session-loop/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `STATE-RETURN-02 | offline result: pending | recovery: 계산 근거 표시 후 수락 또는 보류`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** design·UX·accessibility owner가 오프라인 규칙, 복귀 cue와 검증 범위를 결정하며 생성물을 자동 승인하지 않습니다.

### 실패·재개

오프라인 시간의 authority나 중단 상태가 불명확하면 추정 구현을 멈춥니다. **보존:** 확인된 state ID, 퍼즐 규칙, 관찰 기록과 결정 이력.

**재개 요청문:**

```text
$game-design-studio:design-game-systems 기존 game-design/casual-puzzle-idle/session-loop의 state ID를 보존하고 오프라인 authority 결정부터 재개해.
```

### 자기점검과 다음 학습

- 중단 위치마다 예측 가능한 복구가 있는가? 복귀 이유가 보상 수령 하나로 축소되지 않았는가?
- 정보와 cue가 입력·감각 대안을 갖는가? 다음에는 `ST-C04`의 usability 관찰로 확인합니다.

## ST-G03 협동 생존 액션

### 현재 상황과 목표

**플레이어 맥락:** 서로 다른 숙련도와 선호 역할을 가진 소규모 그룹이 협동하여 위험을 탐색하고 생존하는 상황을 가정합니다.

**설계 제약:** 공유 자원, 역할 의존, 전투 실패와 복구가 한 플레이어의 지시권이나 반복 노동으로 굳어지지 않아야 합니다.

**전이 가능한 역량:** authoritative rule·state·exception은 `ST-C03`, 전투 역할·telegraph·counterplay는 `ST-C06`에서 가져옵니다.

**지원되지 않는 가정:** 특정 역할 조합이 완주율이나 협동 만족을 높인다는 수치는 관찰 전 가정이며 성공 공식이 아닙니다.

**검증 계획:** 여러 역할 조합의 그룹 플레이테스트에서 자원 충돌, 도움 요청, 쓰러짐과 복구를 관찰하고 발화·행동 기록을 분리합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 역할, 공유 자원, 전투 상태와 팀 복구를 같은 계약으로 검토할 때.
- 부적합: 음성 채팅이나 고정 역할을 모든 플레이어의 전제로 삼을 때.

### 준비 입력

- player promise, 역할별 verb, 공유·개인 resource ID, authoritative state, 적 telegraph, 실패·이탈·재합류 규칙을 준비합니다.
- 채팅·행동 기록은 동의와 비식별화 범위를 먼저 정합니다.

### 10분 미니 실습

1. 탐색 → 채집 → 방어 → 탈출 루프에서 각 역할의 선택을 씁니다.
2. 한 명이 쓰러지거나 연결이 끊기는 예외를 추가합니다.
3. 음성 없이 도움을 요청하는 cue를 설계합니다.

### 표준 실습

1. `system-specification`에 공유 자원 authority와 동시 행동 precedence를 기록합니다.
2. `character-skill-combat-monster`에 역할별 telegraph, counterplay와 구조 행동을 연결합니다.
3. `production-scope-risk`에 동기화, AI 대체, 이탈·재합류 위험과 검증 범위를 둡니다.
4. 자원을 독점하거나 초보자를 배제하는 반례를 `review-game-design`으로 검토합니다.

### 포트폴리오·실무 확장

이상적인 협동 장면보다 자원 충돌과 이탈 예외, 역할 대안, 그룹 관찰에서 바뀐 규칙을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 협동 생존 액션의 역할, 공유 자원 authority, 쓰러짐·이탈·재합류 복구를 중립 사례로 명세하고 음성 채팅 없는 대안도 포함해 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/co-op-survival/shared-survival 공유 자원, 동시 행동, 쓰러짐과 재합류의 rule·state·exception을 작성해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-game-systems` → `design-game-content` → `plan-game-production` → `review-game-design` 순서입니다. `system-specification`, `character-skill-combat-monster`, `production-scope-risk` 템플릿으로 역할·전투·제작 위험을 연결합니다.

### 결과물

**최소 결과:** `system-specification`, `character-skill-combat-monster`, `production-scope-risk` 초안.

**선택 결과:** 역할·자원·복구 test case와 비언어 cue 점검표.

**확장 결과:** 그룹 플레이테스트 evidence와 사람이 승인한 scope 변경 기록.

**파일 트리:**

```text
game-design/co-op-survival/shared-survival/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `RULE-REVIVE-03 | downed → assisted|self-recover|failed | authority: pending | disconnect recovery: required`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** design·engineering·player-safety owner가 authority, 역할 의존, 기록 동의와 제작 범위를 결정합니다. 자동화는 승인하지 않습니다.

### 실패·재개

동기화 authority나 재합류 규칙이 미확정이면 관련 test case를 `blocked`로 둡니다. **보존:** stable rule·entity ID, 관찰 evidence, 결정 이력과 통과한 안전 검토.

**재개 요청문:**

```text
$game-design-studio:design-game-systems 기존 game-design/co-op-survival/shared-survival을 보존하고 재합류 authority 결정과 RULE-REVIVE-03부터 재개해.
```

### 자기점검과 다음 학습

- 모든 역할이 의미 있는 선택과 복구 수단을 갖는가? 한 사람이 정보·자원·진행을 독점하지 않는가?
- 동시성·이탈 예외가 test case에 있는가? 다음에는 `ST-C03`과 `ST-C06`의 경계를 검토합니다.

## ST-G04 경쟁 PvP 아레나

### 현재 상황과 목표

**플레이어 맥락:** 서로 다른 숙련도와 입력 환경을 가진 플레이어가 짧은 PvP 경기에서 선택의 결과와 패배 원인을 이해하려는 상황입니다.

**설계 제약:** 공격과 방어의 counterplay, 전장 가독성, matchmaking 가정과 사회적 위험을 함께 다루되 승패 압력이 괴롭힘을 정당화하지 않아야 합니다.

**전이 가능한 역량:** UI·UX cue와 접근성은 `ST-C04`, 캐릭터 역할·전투 가독성과 대응은 `ST-C06`에서 전이합니다.

**지원되지 않는 가정:** 특정 캐릭터의 승률이 공정성을 증명하거나 경쟁이 재미를 보장한다는 해석은 모집단·버전·표본을 확인하기 전 가정입니다.

**검증 계획:** 제한된 roster prototype과 match telemetry로 선택·피격·이탈 지점을 보고, 숙련도별 플레이테스트에서 읽을 수 있는 대응 시간을 관찰합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 전투 역할, counterplay, 가독성, 패배 피드백과 사회적 보호를 검토할 때.
- 부적합: 단일 승률로 밸런스를 확정하거나 독성 행동을 경쟁의 자연스러운 결과로 취급할 때.

### 준비 입력

- combat role, skill rule, telegraph, counterplay, arena objective, 입력 장치, 경기 상태와 신고·차단·이탈 보호 요구를 준비합니다.
- 기존 match 데이터는 버전, 표본과 수집 조건을 함께 기록합니다.

### 10분 미니 실습

1. 공격 하나의 wind-up, active, recovery와 대응을 적습니다.
2. 승패와 무관한 패배 원인 cue 하나를 설계합니다.
3. 채팅 없이 협력하고 원치 않는 상호작용을 차단하는 경로를 추가합니다.

### 표준 실습

1. `character-skill-combat-monster`에 역할, range, telegraph, counterplay와 provisional 값을 둡니다.
2. `system-specification`에 경기 시작·중단·판정·이탈 상태와 authority를 기록합니다.
3. `ui-ux-flow-state`에 전투 cue, 결과 설명, 신고·차단과 접근 가능한 대안을 연결합니다.
4. `review-game-design`에서 대응 없는 공격, 정보 과부하와 사회적 위해 반례를 찾습니다.

### 포트폴리오·실무 확장

승률 숫자보다 counterplay가 없던 초안, 관찰로 바뀐 telegraph, 공정성 해석의 한계와 보호 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 경쟁 PvP 아레나의 전투 역할, counterplay, 전장 가독성, 패배 피드백과 신고·차단 경계를 명세하고 승률은 검증할 가정으로 유지해 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-systems artifact=game-design/pvp-arena/combat-rules 경기 상태, 판정 authority, 전투 counterplay와 이탈·신고 예외를 작성해.
```

### 스킬·템플릿 흐름

`design-game-systems` → `design-game-content` → `design-player-experience` → `review-game-design` 순서입니다. `character-skill-combat-monster`, `system-specification`, `ui-ux-flow-state` 템플릿을 사용해 전투와 보호 흐름을 함께 검토합니다.

### 결과물

**최소 결과:** `character-skill-combat-monster`, `system-specification`, `ui-ux-flow-state` 내용과 검증 질문.

**선택 결과:** 숙련도별 readability 관찰표와 사회적 위해 test case.

**확장 결과:** 버전이 표시된 match evidence와 사람의 밸런스·보호 결정 기록.

**파일 트리:**

```text
game-design/pvp-arena/combat-rules/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `ATK-ARENA-04 | telegraph: provisional | counterplay: 이동 또는 방어 | evidence: prototype pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** combat·UX·accessibility·player-safety owner가 전투 규칙, 데이터 해석과 보호 정책을 승인·수정·보류하며 출력을 자동 승인하지 않습니다.

### 실패·재개

대응 없는 공격이나 위해 신고 경로가 남아 있으면 release 판단을 중단합니다. **보존:** stable skill ID, 버전이 표시된 evidence, 통과한 readability 항목과 결정 기록.

**재개 요청문:**

```text
$game-design-studio:design-game-systems 기존 game-design/pvp-arena/combat-rules를 보존하고 ATK-ARENA-04의 counterplay 관찰과 보호 검토부터 재개해.
```

### 자기점검과 다음 학습

- 공격마다 읽을 수 있는 cue와 실행 가능한 대응이 있는가? 승률을 공정성의 단일 증거로 쓰지 않았는가?
- 신고·차단·이탈이 플레이어를 추가로 처벌하지 않는가? 다음에는 `ST-C04`와 `ST-C06`을 교차 검토합니다.

## ST-G05 PC·콘솔 액션 로그라이트

### 현재 상황과 목표

**플레이어 맥락:** PC·콘솔 입력 장치로 반복 run에 도전하며 실패 이유를 학습하고 다음 빌드 선택을 바꾸려는 플레이어를 가정합니다.

**설계 제약:** 액션 로그라이트의 run 변동성, 메타 성장, 전투 가독성과 입력 장치 차이가 실패를 불투명하게 만들지 않아야 합니다.

**전이 가능한 역량:** 행동·선택·실패 루프는 `ST-C02`, 전투·적 설계는 `ST-C06`, 제작 가능한 범위는 `ST-C08`에서 전이합니다.

**지원되지 않는 가정:** 높은 난이도나 긴 run이 만족을 높인다는 수치·평가는 prototype 관찰 전 가정이며 장르의 필수 공식이 아닙니다.

**검증 계획:** 짧은 vertical-slice prototype에서 빌드 선택, 피격 원인과 실패 지점을 기록하고 입력 장치별로 재시도 행동을 비교합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: run loop, 전투 변동성, 실패 학습, 메타 성장과 제작 범위를 함께 검토할 때.
- 부적합: 불투명한 무작위성이나 영구 성장을 난도 해결책으로 단정할 때.

### 준비 입력

- player verb, run goal, encounter·reward pool, combat entity ID, death·restart state, 메타 progression과 플랫폼 입력 제약을 준비합니다.
- 난도·시간·드롭 수치는 provisional로 표시합니다.

### 10분 미니 실습

1. 진입 → 전투 → 선택 → 위험 확대 → 실패·완주 루프를 적습니다.
2. 무작위 결과를 바꿀 선택 하나와 받아들일 선택 하나를 구분합니다.
3. 사망 후 배운 정보를 다음 run에 전달하는 cue를 설계합니다.

### 표준 실습

1. `core-motivation-loop`에 run 안팎의 선택과 feedback을 분리합니다.
2. `character-skill-combat-monster`로 적 telegraph와 빌드 counterplay를 명세합니다.
3. `production-scope-risk`에서 encounter·reward 조합 수와 제작 evidence를 연결합니다.
4. 무작위성이 선택을 지우거나 메타 성장이 실패를 구매로만 해결하는 반례를 검토합니다.

### 포트폴리오·실무 확장

콘텐츠 양보다 한 run의 선택 지도, 실패 원인 관찰, 제거한 조합과 scope 결정을 공개 가능한 증거로 제시합니다.

### Codex App 요청문

```text
@Game Design Studio PC·콘솔 액션 로그라이트의 run loop, 빌드 선택, 전투 가독성, 사망 복구와 메타 성장 범위를 설계하고 난도 수치는 provisional로 남겨 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-content artifact=game-design/action-roguelite/run-content encounter와 reward pool, 빌드 선택, 실패 피드백과 replay 변형을 작성해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-game-content` → `design-game-systems` → `plan-game-production` → `review-game-design` 순서입니다. `core-motivation-loop`, `character-skill-combat-monster`, `production-scope-risk` 템플릿으로 run과 제작 범위를 연결합니다.

### 결과물

**최소 결과:** `core-motivation-loop`, `character-skill-combat-monster`, `production-scope-risk` 내용.

**선택 결과:** encounter·reward 조합표와 입력 장치별 관찰 계획.

**확장 결과:** vertical slice evidence와 사람이 승인한 콘텐츠 범위 결정.

**파일 트리:**

```text
game-design/action-roguelite/run-content/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `RUN-05 | 실패 원인: telegraph miss assumption | 다음 선택: 방어 도구 또는 경로 변경 | test: pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** design·combat·production·accessibility owner가 run 규칙, 입력 대응과 콘텐츠 범위를 결정하며 생성 결과는 자동 승인하지 않습니다.

### 실패·재개

실패 원인을 관찰할 수 없거나 조합 수의 제작 근거가 없으면 범위를 확정하지 않습니다. **보존:** stable encounter ID, 검증된 전투 규칙, scope 결정과 evidence.

**재개 요청문:**

```text
$game-design-studio:design-game-content 기존 game-design/action-roguelite/run-content를 보존하고 RUN-05 관찰과 승인된 encounter 범위부터 재개해.
```

### 자기점검과 다음 학습

- 실패가 다음 선택에 사용할 정보를 주는가? 무작위성과 메타 성장이 의미 있는 선택을 지우지 않는가?
- 입력 장치별 가독성과 제작 근거가 있는가? 다음에는 `ST-C08`에서 scope를 검토합니다.

## ST-G06 선택형 내러티브 어드벤처

### 현재 상황과 목표

**플레이어 맥락:** 대화와 행동 선택이 이후 분기 사건과 관계에 어떤 영향을 주는지 이해하며 자신의 이야기를 구성하려는 플레이어입니다.

**설계 제약:** 선택형 내러티브의 분기 상태, consequence, 재진입과 콘텐츠 범위가 연결되어야 하며, 선택 문구와 실제 결과가 거짓 약속이 되어서는 안 됩니다.

**전이 가능한 역량:** authoritative state·exception은 `ST-C03`, 선택·퀘스트·NPC와 제작 계약은 `ST-C05`에서 가져옵니다.

**지원되지 않는 가정:** 분기 수나 대사량이 몰입을 보장한다는 주장은 플레이테스트 전 가정이며, 모든 선택이 고유 콘텐츠를 필요로 하지는 않습니다.

**검증 계획:** 분기 추적표와 state simulation으로 도달 가능성을 확인하고, 플레이테스트에서 선택 해석과 예상 consequence를 관찰합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 선택, 상태, 결과, 재합류와 콘텐츠 제작 범위를 함께 설계할 때.
- 부적합: 선택지 수를 품질 지표로 쓰거나 권리 확인 없는 실제 인물·사건을 재현할 때.

### 준비 입력

- narrative premise, character·quest ID, entry condition, choice, state delta, consequence, 재합류 조건, 권리·민감성 질문을 준비합니다.
- 알려지지 않은 분기 비용은 production assumption으로 둡니다.

### 10분 미니 실습

1. 한 장면의 선택 두 개와 즉시·지연 consequence를 적습니다.
2. 각 선택이 바꾸는 state ID를 연결합니다.
3. 도달 불가·모순·중도 저장 예외를 하나씩 추가합니다.

### 표준 실습

1. `narrative-quest-npc`에 entry, choice, state delta, outcome과 재합류를 작성합니다.
2. `system-specification`에 저장·불러오기와 authoritative narrative state를 둡니다.
3. `rule-exception-matrix`로 모순, 누락, 순환과 migration·rollback을 검토합니다.
4. `visualize-game-design`은 source ID가 있는 분기만 보여 주고 생성 도식 자체를 근거로 쓰지 않습니다.

### 포트폴리오·실무 확장

분기 수보다 플레이어 해석이 어긋난 선택, 상태 모순을 찾은 과정, 합친 분기와 제작 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 선택형 내러티브 장면의 선택, state delta, 즉시·지연 consequence, 재합류와 저장 예외를 설계하고 분기 수와 몰입 주장은 가정으로 남겨 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-content artifact=game-design/branching-adventure/river-crossing 선택, 상태 변화, consequence와 재합류를 narrative-quest-npc 계약으로 작성해.
```

### 스킬·템플릿 흐름

`design-game-content` → `design-game-systems` → `review-game-design` → 필요 시 `visualize-game-design` 순서입니다. `narrative-quest-npc`, `system-specification`, `rule-exception-matrix` 템플릿을 사용합니다.

### 결과물

**최소 결과:** `narrative-quest-npc`, `system-specification`, `rule-exception-matrix` 내용과 evidence.

**선택 결과:** source ID가 연결된 분기 표와 플레이테스트 질문.

**확장 결과:** 권리·민감성 검토와 사람이 승인한 콘텐츠 scope 결정.

**파일 트리:**

```text
game-design/branching-adventure/river-crossing/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `CHOICE-RIVER-06 | state delta: trust_npc + provisional | consequence: route_b opens | evidence: pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** narrative·system·production·rights owner가 선택 의미, 상태 규칙, 민감성·권리와 제작 범위를 결정하며 자동화는 승인하지 않습니다.

### 실패·재개

state source가 없거나 선택 문구와 결과가 어긋나면 해당 분기를 `blocked`로 둡니다. **보존:** stable content·state ID, 확인된 권리, 결정 기록과 통과한 test case.

**재개 요청문:**

```text
$game-design-studio:design-game-content 기존 game-design/branching-adventure/river-crossing을 보존하고 CHOICE-RIVER-06의 state source 결정부터 재개해.
```

### 자기점검과 다음 학습

- 선택마다 state와 이해 가능한 consequence가 있는가? 재합류가 선택을 무효화하지 않는가?
- 분기 범위와 권리 근거가 연결됐는가? 다음에는 `ST-C03`의 예외와 `ST-C05`의 제작 계약을 검토합니다.

## ST-G07 코지 생활 시뮬레이션

### 현재 상황과 목표

**플레이어 맥락:** 코지 분위기 속에서 자신의 속도로 생활 활동과 관계를 선택하고, 중단 뒤에도 자율성을 유지하려는 플레이어입니다.

**설계 제약:** 생활 루틴, 시간 진행, 놓치는 콘텐츠와 접근성이 압박·처벌·감각 장벽으로 변하지 않도록 대안과 복구를 제공해야 합니다.

**전이 가능한 역량:** critical action·온보딩·sensory alternative는 `ST-C04`, NPC·퀘스트·반복 콘텐츠는 `ST-C05`에서 전이합니다.

**지원되지 않는 가정:** 느린 속도와 부드러운 표현이 모든 사람에게 편안하거나 접근 가능하다는 판단은 usability 관찰 전 가정입니다.

**검증 계획:** usability 세션에서 일정 선택, 놓친 이벤트 복구, non-pointer input과 sensory alternative를 관찰하고 접근 요구별 장벽을 기록합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 자율적인 생활 루프, 관계 콘텐츠, 시간 압력과 접근성을 함께 검토할 때.
- 부적합: 특정 미술 양식이나 일일 접속을 코지 장르의 필수 조건으로 단정할 때.

### 준비 입력

- player promise, 생활 verb, 시간·계절 state, NPC·event ID, 놓침·복구 규칙, 입력·시각·청각·인지 접근 요구를 준비합니다.
- 실제 사용자 근거가 없으면 선호와 장벽을 assumption으로 표시합니다.

### 10분 미니 실습

1. 돌보기 → 만들기 → 교류 → 공간 변화 루프를 적습니다.
2. 하루를 건너뛰거나 이벤트를 놓친 복구를 설계합니다.
3. 시간 제한·소리·색상 없이 critical action을 이해하는 대안을 추가합니다.

### 표준 실습

1. `ui-ux-flow-state`에 일정 선택, 중단, 놓침과 복구 상태를 기록합니다.
2. `narrative-quest-npc`에 관계 변화와 반복 대사의 조건을 연결합니다.
3. `accessibility-platform-matrix`로 critical action마다 입력과 감각 대안을 확인합니다.
4. `review-game-design`에서 guilt, 강제 접속, 돌봄 노동 고정관념과 정보 장벽을 검토합니다.

### 포트폴리오·실무 확장

분위기 설명보다 압박을 발견한 usability evidence, 놓침 복구 대안, 접근성 장벽과 사람의 수정 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 코지 생활 시뮬레이션의 자율적 생활 루프, 시간·놓침 복구, NPC 관계와 입력·감각 접근 대안을 설계하고 편안함은 검증할 가정으로 남겨 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-player-experience artifact=game-design/cozy-life/daily-rhythm 생활 활동의 시작·중단·놓침·복구와 critical action 접근성 matrix를 작성해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-player-experience` → `design-game-content` → `review-game-design` 순서입니다. `ui-ux-flow-state`, `narrative-quest-npc`, `accessibility-platform-matrix` 템플릿을 사용합니다.

### 결과물

**최소 결과:** `ui-ux-flow-state`, `narrative-quest-npc`, `accessibility-platform-matrix` 내용.

**선택 결과:** 놓침·복구 test case와 접근 요구별 usability 관찰표.

**확장 결과:** 플레이어 관찰과 사람이 승인한 압박 완화·접근성 결정 기록.

**파일 트리:**

```text
game-design/cozy-life/daily-rhythm/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `ACT-GARDEN-07 | interruption: safe | missed event: replayable | sensory alternative: pending review`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** design·content·accessibility owner가 시간 압력, 관계 표현과 대안을 승인·수정·보류합니다. 자동 생성은 승인을 대신하지 않습니다.

### 실패·재개

critical action의 접근 대안이나 놓침 복구가 없으면 관련 흐름을 `pending`으로 둡니다. **보존:** stable action·event ID, usability evidence, 결정 기록과 통과 항목.

**재개 요청문:**

```text
$game-design-studio:design-player-experience 기존 game-design/cozy-life/daily-rhythm을 보존하고 ACT-GARDEN-07의 sensory alternative 검토부터 재개해.
```

### 자기점검과 다음 학습

- 시간과 관계 시스템이 자율성을 지지하는가? 놓친 콘텐츠를 회복할 수 있는가?
- critical action마다 입력·감각 대안이 있는가? 다음에는 `ST-C04`의 접근성 검토를 반복합니다.

## ST-G08 경영·타이쿤 시뮬레이션

### 현재 상황과 목표

**플레이어 맥락:** 여러 자원과 시설을 비교해 경영 의사결정을 내리고, 시스템 피드백으로 자신의 가설을 수정하려는 플레이어입니다.

**설계 제약:** 경제 source·sink, 지연된 피드백과 연쇄 효과를 보여 주되 정보 부하나 숨은 규칙이 실패 원인을 가리지 않아야 합니다.

**전이 가능한 역량:** 규칙·state·data·exception은 `ST-C03`, 경제·balance·실험과 rollback은 `ST-C07`에서 전이합니다.

**지원되지 않는 가정:** 한 전략이 최적이거나 특정 가격이 수익과 재미를 보장한다는 수치는 simulation·관찰 전 가정입니다.

**검증 계획:** 작은 economy simulation에서 resource flow와 연쇄 실패를 추적하고, prototype telemetry로 선택 전 정보와 결과 해석을 확인합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 경제 규칙, 의사결정 정보, 지연 feedback과 실패 회복을 함께 설계할 때.
- 부적합: spreadsheet 결과를 플레이어 행동의 증거나 보편적 최적 전략으로 취급할 때.

### 준비 입력

- resource·facility ID, source, sink, cap, conversion, tick·event rule, UI 정보 계층, 실패·debt·recovery와 authority를 준비합니다.
- 가격·속도·비율은 provisional 값과 근거를 함께 기록합니다.

### 10분 미니 실습

1. 자원 세 개의 source → conversion → sink를 연결합니다.
2. 시설 결정 하나의 즉시·지연 feedback을 구분합니다.
3. 연쇄 파산을 막거나 복구하는 선택 하나를 추가합니다.

### 표준 실습

1. `economy-balance`에서 resource flow, cap, guardrail과 가정을 표시합니다.
2. `system-specification`에 tick, precedence, debt와 recovery state를 기록합니다.
3. `ui-ux-flow-state`에 결정 전 예상, 결과, 원인과 되돌리기 정보를 연결합니다.
4. 다중 변수를 한 번에 바꾸는 실험과 정보 없는 실패를 `review-game-design`으로 차단합니다.

### 포트폴리오·실무 확장

완성된 경제표보다 잘못된 가설, 연쇄 효과를 발견한 simulation, 정보 계층 대안과 rollback 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 경영·타이쿤 예시의 resource flow, 시설 의사결정, 지연 feedback, 연쇄 실패와 복구를 명세하고 가격·수익 수치는 가정으로 표시해 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-economy-and-liveops artifact=game-design/management-tycoon/resource-network source·sink·conversion, 연쇄 위험, guardrail과 simulation 질문을 작성해.
```

### 스킬·템플릿 흐름

`design-game-economy-and-liveops` → `design-game-systems` → `design-player-experience` → `review-game-design` 순서입니다. `economy-balance`, `system-specification`, `ui-ux-flow-state` 템플릿을 사용합니다.

### 결과물

**최소 결과:** `economy-balance`, `system-specification`, `ui-ux-flow-state` 내용과 가정.

**선택 결과:** economy simulation 기록과 연쇄 실패·복구 test case.

**확장 결과:** telemetry 정의와 사람이 승인한 balance·정보 계층 결정.

**파일 트리:**

```text
game-design/management-tycoon/resource-network/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `RES-POWER-08 | source: generator | sink: facility | cascade guardrail: provisional | simulation: pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** economy·system·UX owner가 규칙, provisional 값, 정보 계층과 rollback을 결정합니다. simulation과 생성 결과는 자동 승인하지 않습니다.

### 실패·재개

resource authority, 연쇄 규칙이나 관찰할 telemetry가 없으면 balance 결론을 보류합니다. **보존:** stable resource ID, simulation evidence, 기존 결정과 통과한 guardrail.

**재개 요청문:**

```text
$game-design-studio:design-game-economy-and-liveops 기존 game-design/management-tycoon/resource-network를 보존하고 RES-POWER-08 simulation과 authority 결정부터 재개해.
```

### 자기점검과 다음 학습

- 선택 전에 필요한 정보를 제공하고 결과 원인을 설명하는가? 연쇄 실패에 회복 경로가 있는가?
- 수치를 사실이나 최적 해법으로 단정하지 않았는가? 다음에는 `ST-C03`과 `ST-C07`을 교차 검토합니다.

## ST-G09 샌드박스·UGC

### 현재 상황과 목표

**플레이어 맥락:** 도구로 콘텐츠를 만드는 창작자와, 공유 공간에서 콘텐츠를 발견·이용·신고하는 참여자가 함께 있는 상황입니다.

**설계 제약:** UGC 제작·게시·발견 전 과정에 moderation, rights, accessibility, ethical review가 필요하며 창작 자유가 위해·침해의 면제가 될 수 없습니다.

**전이 가능한 역량:** 게시 상태와 예외는 `ST-C03`, 접근 가능한 제작·신고 흐름은 `ST-C04`, 콘텐츠 목적·권리 계약은 `ST-C05`에서 전이합니다.

**지원되지 않는 가정:** 커뮤니티가 스스로 안전을 유지하거나 추천이 품질을 보장한다는 판단은 검증되지 않은 가정입니다.

**검증 계획:** moderation queue simulation, 권리·동의 검토, 접근성 usability와 윤리 사람 검토를 거쳐 게시·차단·이의 제기 흐름을 검증합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 창작 도구, 게시 상태, 발견, 권리, moderation과 접근성을 함께 설계할 때.
- 부적합: 신고 기능 하나로 안전을 충족했다고 보거나 권리 불명 자료를 예시로 재사용할 때.

### 준비 입력

- creator·viewer context, content type, tool action, draft·review·published·blocked state, 권리·동의 source, moderation·appeal과 접근 요구를 준비합니다.
- 실제 사용자 콘텐츠나 PII는 허가와 최소 수집 범위 없이 입력하지 않습니다.

### 10분 미니 실습

1. 만들기 → 검사 → 게시 → 발견 → 신고·이의 제기 흐름을 적습니다.
2. 권리 불명, 위해 가능, 접근 불가 콘텐츠 예외를 하나씩 추가합니다.
3. 자동 finding 뒤 사람이 결정하는 지점을 표시합니다.

### 표준 실습

1. `narrative-quest-npc`를 UGC content unit의 목적·source·권리·반복 계약에 적용합니다.
2. `system-specification`에 게시·차단·삭제·appeal 상태와 authority를 명세합니다.
3. `game-design-review`에서 moderation, rights, accessibility, ethical review gate와 evidence를 확인합니다.
4. `design-player-experience`로 제작·신고·appeal critical action의 대안을 검토합니다.

### 포트폴리오·실무 확장

사용자 콘텐츠를 복제하지 않고, 공개 가능한 상태·권리 계약, 위해 시나리오, 접근성 개선과 사람 결정을 증거로 제시합니다.

### Codex App 요청문

```text
@Game Design Studio 샌드박스 UGC의 제작·검사·게시·발견·신고·이의 제기 상태를 설계하고 moderation, rights, accessibility, ethical review와 사람 결정 gate를 포함해 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-game-content artifact=game-design/sandbox-ugc/publishing-flow UGC content unit의 목적, source, 권리, 게시 조건, moderation과 appeal을 작성해.
```

### 스킬·템플릿 흐름

`design-game-content` → `design-game-systems` → `design-player-experience` → `review-game-design` 순서입니다. `narrative-quest-npc`, `system-specification`, `game-design-review` 템플릿으로 콘텐츠·상태·검토 gate를 연결합니다.

### 결과물

**최소 결과:** `narrative-quest-npc`, `system-specification`, `game-design-review` 내용과 rights evidence.

**선택 결과:** moderation queue·appeal test case와 accessibility 검토표.

**확장 결과:** ethical review와 사람이 승인한 게시·차단·복구 결정 기록.

**파일 트리:**

```text
game-design/sandbox-ugc/publishing-flow/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `UGC-STATE-09 | draft → review → published|blocked → appeal | rights source: required | owner: pending`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** moderation·rights·accessibility·ethics owner가 게시, 차단, 삭제와 appeal을 승인·수정·보류합니다. 자동 분류나 생성물은 자동 승인하지 않습니다.

### 실패·재개

권리 source, 위해 처리, 접근 대안이나 appeal이 없으면 게시를 `blocked`로 둡니다. **보존:** stable content ID, 최소화된 evidence, 사람 결정과 통과한 검토.

**재개 요청문:**

```text
$game-design-studio:design-game-content 기존 game-design/sandbox-ugc/publishing-flow를 보존하고 UGC-STATE-09의 rights·moderation·accessibility·ethical review 결정부터 재개해.
```

### 자기점검과 다음 학습

- 제작부터 appeal까지 authority와 복구가 명확한가? moderation·rights·accessibility·ethical review가 모두 있는가?
- 실제 콘텐츠·PII를 불필요하게 복제하지 않았는가? 다음에는 `ST-C03`부터 `ST-C05`까지 교차 검토합니다.

## ST-G10 교육·사회문제·접근성 중심 게임

### 현재 상황과 목표

**플레이어 맥락:** 서로 다른 배경의 학습자와 참여자가 교육 목표, 사회문제 탐구와 다양한 접근 요구를 가진 상태에서 경험에 참여합니다.

**설계 제약:** 학습·사회적 목적을 게임 성과와 혼동하지 않고 moderation, rights, accessibility, ethical review와 안전한 중단·동의를 설계해야 합니다.

**전이 가능한 역량:** 검증 가능한 목적과 non-goal은 `ST-C01`, critical action·접근성은 `ST-C04`, 맥락·표현·권리 계약은 `ST-C05`에서 전이합니다.

**지원되지 않는 가정:** 플레이 완료가 학습 효과나 사회적 효과를 증명한다는 주장은 평가·사람 검토 전 가정이며 참여자의 lived experience를 대신하지 않습니다.

**검증 계획:** 사전 동의, 안전한 철회, 비식별 학습 관찰, 접근성 검토와 윤리 사람 검토로 목적·표현·위해 가능성을 확인합니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 학습 목적, 민감한 맥락, 참여 동의, 접근성과 평가 경계를 함께 설계할 때.
- 부적합: 진단·치료·정책 효과를 주장하거나 당사자 관점과 권리를 검토 없이 대리할 때.

### 준비 입력

- 대상 근거, learning·social objective, non-goal, critical action, 민감한 content source, 동의·철회, moderation·rights·accessibility·ethical review owner를 준비합니다.
- 미성년자·취약 참여자 데이터는 적용 정책과 최소 수집을 먼저 확인합니다.

### 10분 미니 실습

1. 학습 또는 사회적 목적을 관찰 가능한 행동과 reflection 질문으로 바꿉니다.
2. 참여 거부·중단·대체 활동 경로를 추가합니다.
3. 표현의 source, 권리와 검토자를 표시합니다.

### 표준 실습

1. `game-design-brief`에 목적, 대상 근거, anti-pillar와 non-goal을 기록합니다.
2. `ui-ux-flow-state`에 동의, 참여, 중단, 도움 요청과 대체 경로를 연결합니다.
3. `accessibility-platform-matrix`로 critical action의 입력·감각·인지 대안을 검토합니다.
4. `review-game-design`에서 moderation, rights, accessibility, ethical review와 평가 한계를 확인합니다.

### 포트폴리오·실무 확장

효과를 홍보하는 결과보다 당사자·전문가 피드백, 수정한 표현, 철회·대체 경로, 접근성 개선과 사람 결정을 보여 줍니다.

### Codex App 요청문

```text
@Game Design Studio 교육·사회문제·접근성 중심 게임의 목적, non-goal, 동의·철회·대체 활동과 moderation, rights, accessibility, ethical review를 설계하고 효과 주장은 가정으로 남겨 줘.
```

### Codex CLI 요청문

```text
$game-design-studio:design-player-experience artifact=game-design/learning-social/participation-flow 동의·참여·중단·도움·대체 경로와 critical action 접근성 matrix를 작성해.
```

### 스킬·템플릿 흐름

`define-game-vision` → `design-player-experience` → `design-game-content` → `review-game-design` 순서입니다. `game-design-brief`, `ui-ux-flow-state`, `accessibility-platform-matrix` 템플릿을 사용합니다.

### 결과물

**최소 결과:** `game-design-brief`, `ui-ux-flow-state`, `accessibility-platform-matrix` 내용과 source evidence.

**선택 결과:** 동의·철회·대체 test case와 비식별 평가 계획.

**확장 결과:** 당사자·전문가·윤리 사람 검토와 승인된 수정 결정 기록.

**파일 트리:**

```text
game-design/learning-social/participation-flow/
├── content.md
├── evidence.yml
├── decisions/README.md
└── export-manifest.yml
```

**대표 내용:** `ACT-CONSENT-10 | enter: informed choice | exit: always available | alternative: required | effect claim: pending evidence`

### 검토와 승인

**읽는 순서:** `content.md → evidence.yml → decisions/ → export-manifest.yml`. **사람 결정:** 대상 당사자, 교육·domain·rights·accessibility·ethics owner가 목적, 표현, 동의, 평가와 공개 범위를 결정합니다. 자동화는 사람의 승인을 대신하지 않습니다.

### 실패·재개

동의·철회, 대체 경로, 권리 source 또는 윤리 검토가 없으면 참여 흐름을 `blocked`로 둡니다. **보존:** 최소화된 evidence, stable action ID, 접근성 finding과 사람 결정.

**재개 요청문:**

```text
$game-design-studio:design-player-experience 기존 game-design/learning-social/participation-flow를 보존하고 ACT-CONSENT-10의 권리·접근성·윤리 사람 결정부터 재개해.
```

### 자기점검과 다음 학습

- 목적과 검증되지 않은 효과 주장을 구분했는가? 참여 거부·중단·대체 활동이 실질적인가?
- moderation·rights·accessibility·ethical review와 당사자 검토가 있는가? 다음에는 `ST-C01`, `ST-C04`, `ST-C05`를 함께 검토합니다.

## 콘셉트 간 비교

아래 표는 장르를 성공 공식으로 비교하지 않습니다. 같은 문제의 설계 초점과 필요한 증거를 찾고, 연결된 역량 사례에서 검토 방법을 다시 사용하기 위한 지도입니다.

| ID | 핵심 루프 | 실패·복구 | 정보 부하 | 사회적 위험 | 콘텐츠 주기 | 필요한 근거 | 연결 역량 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ST-G01 | 수집→편성→전투→성장 | 재편성·자원 보호·rollback | 편성·경제·이벤트를 계층화 | 결제 압력과 비교 경쟁 | 이벤트는 한 변수·stop 조건 | 조합 관찰, source·sink telemetry | [ST-C02](competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [ST-C07](competency-paths.md#st-c07-성장경제밸런스liveops) |
| ST-G02 | 퍼즐→결과→방치→복귀 | 중단 저장·오프라인 결과 거부 | 첫 세션과 복귀 cue 최소화 | 강제 알림과 놓침 압력 | 작은 퍼즐 변형과 복귀 상태 | 퍼즐 prototype, 중단·복귀 telemetry | [ST-C02](competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [ST-C04](competency-paths.md#st-c04-uiux온보딩접근성) |
| ST-G03 | 탐색→채집→방어→탈출 | 쓰러짐·이탈·재합류 | 역할·자원·위험 cue 분리 | 독점·배제·괴롭힘 | encounter와 역할 변형 | 그룹 관찰, 동기화 test case | [ST-C03](competency-paths.md#st-c03-규칙상태예외데이터), [ST-C06](competency-paths.md#st-c06-캐릭터스킬전투몬스터) |
| ST-G04 | 목표 경쟁→교전→판정 | 패배 설명·이탈 보호 | telegraph와 전장 우선순위 | 독성 행동·신고·차단 | roster·rule 변경은 버전 관리 | 숙련도별 관찰, match telemetry | [ST-C04](competency-paths.md#st-c04-uiux온보딩접근성), [ST-C06](competency-paths.md#st-c06-캐릭터스킬전투몬스터) |
| ST-G05 | run 진입→빌드→위험→재시도 | 사망 원인과 다음 선택 | 전투 cue·reward 선택 분리 | 실패 낙인과 접근 장벽 | encounter·reward pool 범위 | vertical slice, 입력별 실패 관찰 | [ST-C02](competency-paths.md#st-c02-행동핵심-루프의미-있는-선택), [ST-C08](competency-paths.md#st-c08-제작검토이미지출력) |
| ST-G06 | 장면→선택→상태→결과 | 저장·재합류·모순 복구 | 선택 문구와 consequence 연결 | 민감 표현·권리 침해 | 분기 unit과 재사용 범위 | state simulation, 해석 플레이테스트 | [ST-C03](competency-paths.md#st-c03-규칙상태예외데이터), [ST-C05](competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc) |
| ST-G07 | 돌보기→만들기→교류→변화 | 놓침·중단·일정 복구 | 생활 cue와 감각 대안 | guilt·강제 접속·고정관념 | 반복 루틴과 선택 이벤트 | 접근 요구별 usability evidence | [ST-C04](competency-paths.md#st-c04-uiux온보딩접근성), [ST-C05](competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc) |
| ST-G08 | 관찰→투자→운영→피드백 | debt·연쇄 실패·rollback | 원인·예상·결과 계층화 | 조작적 경제 표현 | tick·event 규칙과 scenario | economy simulation, 선택 telemetry | [ST-C03](competency-paths.md#st-c03-규칙상태예외데이터), [ST-C07](competency-paths.md#st-c07-성장경제밸런스liveops) |
| ST-G09 | 제작→검사→게시→발견 | 차단·삭제·appeal | 도구·검토·신고 상태 분리 | 위해·권리·moderation | creator unit과 review queue | 권리 source, 접근성·윤리 검토 | [ST-C03](competency-paths.md#st-c03-규칙상태예외데이터), [ST-C05](competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc) |
| ST-G10 | 동의→참여→reflection→대체 | 철회·도움·안전한 중단 | 목적·활동·지원 정보 분리 | 대리 표현·위해·데이터 권리 | 학습 unit과 사람 검토 주기 | 당사자·전문가·접근성·윤리 evidence | [ST-C01](competency-paths.md#st-c01-플레이어-경험과-게임-비전), [ST-C04](competency-paths.md#st-c04-uiux온보딩접근성) |
