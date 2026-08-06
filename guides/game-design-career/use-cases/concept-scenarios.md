# Game Design Career 대상별 사례

이 문서는 가상·중립 사례로 목표 직무 또는 준비 단계를 작은 증거 과제로 바꿉니다. 역할 분담은 회사마다 다를 수 있으며, 실제 경험·팀 기여·채용·이직·승진·시장 성공을 발명하거나 보장하지 않습니다. Studio 연결은 공개 가능한 evidence summary와 proof project 링크뿐이며, Studio 원본 Artifact를 Career 문서에 병합하거나 복제하지 않습니다.

## CA-T01 시스템 기획 입문 학생

### 현재 상황과 목표

**목표 직무:** 시스템 기획의 규칙·상태·예외를 작은 관찰과 학습 과제로 설명하는 입문 학생 경로입니다.

**관찰 가능한 증거:** 상태 전이와 예외 표에서 입력, 조건, 결과를 구분해 기록한 관찰입니다.

**가장 작은 증명 프로젝트:** 잠금 해제 기능 하나의 상태 전이와 규칙표를 작성하고 반례 하나를 붙입니다.

**review owner:** 시스템 기획 멘토가 규칙과 예외의 범위를 읽고 질문을 남깁니다.

**portfolio result:** 상태표, 규칙표, 반례와 결정 기록을 가진 짧은 개인 사례입니다.

**non-guarantee:** 이 사례는 시스템 기획 직무 합격이나 실제 팀 기여를 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 규칙을 말로만 설명하지 않고 상태와 예외로 분리하는 첫 연습이 필요할 때.
- 부적합: 보지 못한 내부 구현이나 특정 회사의 시스템 문서를 사실처럼 복제할 때입니다.

### 준비 입력

공개적으로 관찰 가능한 기능 하나, 입력과 결과, 모르는 규칙, 개인 작업 범위와 시스템 기획 멘토를 준비합니다.

### 10분 미니 실습

버튼을 누르기 전·후 상태를 두 줄로 쓰고, 실패하는 조건 하나를 “unknown”으로 남겨 가정과 사실을 섞지 않습니다.

### 표준 실습

1. 입력·상태·전이·예외를 `competency-matrix`에 나눕니다.
2. 잠금 해제 한 개의 규칙표와 반례를 `learning-roadmap`의 proof task로 둡니다.
3. 다음 검토 날짜와 모르는 구현을 기록해 결론 대신 학습 경로로 보존합니다.

### 포트폴리오·실무 확장

[ST-C03 규칙·상태·예외·데이터](../../game-design-studio/use-cases/competency-paths.md#st-c03-규칙상태예외데이터)의 공개 가능한 evidence summary를 참고해 proof project의 질문만 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 잠금 해제 기능 하나를 입력, 상태, 전이, 예외와 반례로 나눠 시스템 기획 학습 과제를 만들어. 보이지 않는 구현은 unknown으로 남기고 멘토 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:map-game-design-career artifact=game-design-career/system-student 규칙·상태·예외를 competency-matrix와 learning-roadmap으로 연결해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `build-game-design-portfolio` → `plan-junior-growth` 순서입니다. 템플릿은 `game-design-role-map`, `competency-matrix`, `learning-roadmap`이며 실제 범위는 멘토가 검토합니다.

### 결과물

**최소 결과:** `game-design-role-map`, `competency-matrix`, `learning-roadmap`의 상태와 예외 기록입니다.

**선택 결과:** 반례와 다음 검토 날짜가 있는 규칙표입니다.

**확장 결과:** 개인 기여와 공개 범위가 확인된 짧은 설명입니다.

### 검토와 승인

**읽는 순서:** 상태표 → 규칙표 → 반례 → 다음 질문입니다. **사람 결정:** 시스템 기획 멘토가 규칙과 예외의 범위를 읽고 질문을 남깁니다. 스킬 실행은 자동 승인을 하지 않으며 실제 역할 적합성을 확정하지 않습니다.

### 실패·재개

관찰하지 못한 전이나 예외는 채우지 않고 unknown과 질문을 보존합니다. 공개 범위와 개인 기여를 확인한 뒤 더 작은 규칙 하나에서 재개합니다.

### 자기점검과 다음 학습

규칙을 내부 구현처럼 단정했는가? 콘텐츠 흐름은 CA-T02, 전투 선택은 CA-T03으로 이동합니다.

## CA-T02 콘텐츠·퀘스트 기획 준비생

### 현재 상황과 목표

**목표 직무:** 콘텐츠·퀘스트 기획에서 제작 가능성과 플레이어 선택을 짧은 흐름으로 보이는 준비생 경로입니다.

**관찰 가능한 증거:** 퀘스트 상태, 분기 조건, NPC 정보와 완료·실패 조건을 분리한 기록입니다.

**가장 작은 증명 프로젝트:** 짧은 의뢰 하나와 NPC 한 명의 분기, 보상, 실패 복구를 설계합니다.

**review owner:** 콘텐츠 기획 멘토가 분기와 제작 범위의 질문을 검토합니다.

**portfolio result:** 퀘스트 플로우, 조건 표, 기각한 대안을 담은 개인 사례입니다.

**non-guarantee:** 이 사례는 콘텐츠·퀘스트 기획 채용이나 제작 완료를 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 이야기를 길게 쓰기 전에 조건·보상·실패 복구를 검토할 때.
- 부적합: 팀의 서사 자산이나 실제 제작 일정을 자기 경험으로 주장할 때입니다.

### 준비 입력

공개 가능한 장면, 플레이어 목표, NPC 역할, 분기 조건, 보상 가정과 콘텐츠 기획 멘토를 준비합니다.

### 10분 미니 실습

의뢰 시작·선택·완료·실패를 네 칸으로 그리고 각 칸에 플레이어가 아는 정보만 적습니다.

### 표준 실습

1. `game-design-role-map`에 콘텐츠·퀘스트 문제를 역할 후보로 기록합니다.
2. `portfolio-project-brief`에 분기 조건과 제작 가능한 범위를 적습니다.
3. `creative-design-portfolio`에 반례와 수정 질문을 남깁니다.

### 포트폴리오·실무 확장

[ST-C05 콘텐츠·내러티브·퀘스트·NPC](../../game-design-studio/use-cases/competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc)의 공개 가능한 evidence summary로 의뢰의 조건을 검토합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career NPC 한 명과 짧은 의뢰를 시작, 분기, 보상, 실패 복구로 나눠. 보이지 않는 제작 정보는 가정으로 표시하고 콘텐츠 멘토의 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/quest-prep 퀘스트 분기와 제작 범위를 portfolio-project-brief로 작성해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-design-role-map`, `portfolio-project-brief`, `creative-design-portfolio`입니다.

### 결과물

**최소 결과:** `game-design-role-map`, `portfolio-project-brief`, `creative-design-portfolio`의 짧은 흐름입니다.

**선택 결과:** 분기 조건 표와 보상 가정입니다.

**확장 결과:** 사람 검토를 거친 개인 수정 기록입니다.

### 검토와 승인

**읽는 순서:** 목표 → 분기 → 실패 복구 → 대안입니다. **사람 결정:** 콘텐츠 기획 멘토가 분기와 제작 범위의 질문을 검토합니다. 생성 내용은 자동 승인을 하지 않으며 실제 제작 성과를 대신하지 않습니다.

### 실패·재개

분기 조건이 모호하면 문장을 늘리지 않고 질문과 조건 표를 보존합니다. 확인된 한 분기에서 다시 시작합니다.

### 자기점검과 다음 학습

NPC 대사를 시스템처럼 단정했는가? 협업 계약은 CA-T06, 공간 흐름은 CA-T07으로 이동합니다.

## CA-T03 전투·캐릭터 기획 준비생

### 현재 상황과 목표

**목표 직무:** 전투·캐릭터 기획의 선택과 피드백을 관찰·가설로 분리하는 준비생 경로입니다.

**관찰 가능한 증거:** cooldown, 피해 판정, 피격 피드백과 선택 결과를 분리한 장면 기록입니다.

**가장 작은 증명 프로젝트:** 스킬 하나의 비용·cooldown·피해 판정과 반례를 만든 뒤 짧게 점검합니다.

**review owner:** 전투 기획 멘토가 선택의 이유와 반례를 검토합니다.

**portfolio result:** 스킬 명세, playtest 관찰과 수정 이유를 담은 개인 사례입니다.

**non-guarantee:** 이 사례는 전투 기획 합격이나 재미의 결과를 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 스킬 이름이나 숫자보다 선택·비용·피드백을 먼저 설명할 때.
- 부적합: 공개 장면만으로 내부 피해 공식이나 팀 성과를 추정할 때입니다.

### 준비 입력

공개 장면, 캐릭터 행동, cooldown 관찰, 피해 판정 가정, 반례와 전투 기획 멘토를 준비합니다.

### 10분 미니 실습

스킬을 쓰는 이유, 비용, 성공 피드백, 실패 피드백을 한 줄씩 적고 모르는 수치는 unknown으로 둡니다.

### 표준 실습

1. `game-analysis-report`에 공개 관찰과 해석을 분리합니다.
2. `portfolio-project-brief`에 스킬 하나와 반례 하나를 둡니다.
3. `creative-design-portfolio`에 playtest 질문과 수정 이유를 남깁니다.

### 포트폴리오·실무 확장

[ST-C06 캐릭터·스킬·전투·몬스터](../../game-design-studio/use-cases/competency-paths.md#st-c06-캐릭터스킬전투몬스터)의 공개 가능한 evidence summary를 proof project 질문으로만 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 스킬 하나를 비용, cooldown, 피해 판정, 피드백과 반례로 분리해. 관찰과 가설을 섞지 말고 전투 멘토가 확인할 질문을 만들어.
```

### Codex CLI 요청문

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/combat-prep 공개 장면의 관찰과 가설을 game-analysis-report로 분리해.
```

### 스킬·템플릿 흐름

`reverse-engineer-game-design` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-analysis-report`, `portfolio-project-brief`, `creative-design-portfolio`입니다.

### 결과물

**최소 결과:** `game-analysis-report`, `portfolio-project-brief`, `creative-design-portfolio`의 스킬 사례입니다.

**선택 결과:** playtest 질문과 반례 표입니다.

**확장 결과:** 공개·개인 기여 경계를 확인한 수정 기록입니다.

### 검토와 승인

**읽는 순서:** 관찰 → 스킬 명세 → 반례 → 수정입니다. **사람 결정:** 전투 기획 멘토가 선택의 이유와 반례를 검토합니다. 자동 승인을 하지 않으며 재미나 직무 적합성을 보장하지 않습니다.

### 실패·재개

피해 판정이 보이지 않으면 숫자를 채우지 않고 관찰과 질문을 보존합니다. 한 스킬의 피드백에서 재개합니다.

### 자기점검과 다음 학습

관찰을 내부 공식으로 바꾸었는가? 경제 가설은 CA-T04, 공간 playtest는 CA-T07으로 이동합니다.

## CA-T04 경제·밸런스·LiveOps 준비생

### 현재 상황과 목표

**목표 직무:** 경제·밸런스·LiveOps의 수치를 결론 대신 가설과 보호 기준으로 다루는 준비생 경로입니다.

**관찰 가능한 증거:** source, sink, 지출 선택과 이벤트 관찰을 범위와 함께 적은 기록입니다.

**가장 작은 증명 프로젝트:** 재화 흐름 하나에 source·sink, guardrail, rollback 가정을 붙입니다.

**review owner:** 경제·밸런스 검토자가 가설과 보호 기준의 질문을 확인합니다.

**portfolio result:** 경제 가설, guardrail, rollback과 수정 이유를 담은 개인 사례입니다.

**non-guarantee:** 이 사례는 시장 성공, 매출 또는 채용 결과를 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 수치의 정답 대신 재화 흐름과 실패 시 보호 기준을 검토할 때.
- 부적합: 실제 KPI, 가격, 시장 성과를 근거 없이 작성하거나 약속할 때입니다.

### 준비 입력

공개적으로 보이는 재화 흐름, source·sink 가정, 이벤트 목적, guardrail, rollback과 검토자를 준비합니다.

### 10분 미니 실습

재화 하나의 들어오는 경로와 나가는 경로를 적고, 플레이어 보호가 필요한 실패 한 가지를 표시합니다.

### 표준 실습

1. `game-analysis-report`에 관찰과 수치 가설을 분리합니다.
2. `portfolio-project-brief`에 한 변수와 rollback 조건을 기록합니다.
3. `five-axis-review`에 guardrail과 보류할 결론을 남깁니다.

### 포트폴리오·실무 확장

[ST-C07 성장·경제·밸런스·LiveOps](../../game-design-studio/use-cases/competency-paths.md#st-c07-성장경제밸런스liveops)의 공개 가능한 evidence summary로 guardrail 질문을 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 재화 하나의 source와 sink, 한 변수 가설, guardrail과 rollback을 정리해. 수치와 시장 결과는 검증 전 가정으로 남기고 검토 질문을 써.
```

### Codex CLI 요청문

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/economy-prep 공개 관찰을 source, sink와 가설로 분리한 game-analysis-report로 정리해.
```

### 스킬·템플릿 흐름

`reverse-engineer-game-design` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-analysis-report`, `portfolio-project-brief`, `five-axis-review`입니다.

### 결과물

**최소 결과:** `game-analysis-report`, `portfolio-project-brief`, `five-axis-review`의 경제 가설입니다.

**선택 결과:** source·sink 표와 rollback 질문입니다.

**확장 결과:** 검토된 guardrail과 변경 기록입니다.

### 검토와 승인

**읽는 순서:** source·sink → 가설 → guardrail → rollback입니다. **사람 결정:** 경제·밸런스 검토자가 가설과 보호 기준의 질문을 확인합니다. 자동 승인을 하지 않으며 시장 성공을 확정하지 않습니다.

### 실패·재개

근거 없는 수치는 지우지 않고 가설과 출처 공백을 보존합니다. 한 재화 흐름과 rollback 질문에서 재개합니다.

### 자기점검과 다음 학습

가설을 실제 KPI처럼 썼는가? 규칙 모델은 CA-T01, 성장 기록은 CA-T10으로 이동합니다.

## CA-T05 UI·UX 기획 준비생

### 현재 상황과 목표

**목표 직무:** UI·UX 기획에서 접근성과 사용성의 실패 경로를 관찰하는 준비생 경로입니다.

**관찰 가능한 증거:** 오류 상태, focus 이동, 안내 문구와 대체 입력의 관찰 기록입니다.

**가장 작은 증명 프로젝트:** 온보딩 화면 하나에 오류 상태, focus 순서와 대체 입력을 붙입니다.

**review owner:** UX·접근성 검토자가 사용성 관찰과 누락을 확인합니다.

**portfolio result:** 사용성 흐름, 관찰 기록, 수정 전후를 가진 개인 사례입니다.

**non-guarantee:** 이 사례는 UI·UX 기획 채용이나 접근성 적합성을 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 보기 좋은 화면보다 오류·복구·대체 입력을 함께 검토할 때.
- 부적합: 사용자 조사 결과나 접근성 인증을 실제로 했다고 주장할 때입니다.

### 준비 입력

공개 화면, 주요 행동, 오류 상태, focus 순서, 대체 입력 가정과 UX·접근성 검토자를 준비합니다.

### 10분 미니 실습

온보딩 한 화면에서 첫 행동, 오류, 복구, 키보드 또는 대체 입력을 한 줄씩 씁니다.

### 표준 실습

1. `competency-matrix`에 화면 흐름과 접근성 gap을 적습니다.
2. `portfolio-project-brief`에 온보딩 한 장면의 오류 상태를 둡니다.
3. `five-axis-review`에 사용성 관찰과 다음 수정 질문을 남깁니다.

### 포트폴리오·실무 확장

[ST-C04 UI·UX·온보딩·접근성](../../game-design-studio/use-cases/competency-paths.md#st-c04-uiux온보딩접근성)의 공개 가능한 evidence summary로 대체 입력 질문을 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 온보딩 화면 하나를 첫 행동, 오류 상태, focus 순서, 대체 입력과 복구로 나눠. 사용자 조사는 하지 않은 가정으로 남기고 접근성 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/uiux-prep 온보딩 한 장면의 오류와 대체 입력을 portfolio-project-brief로 작성해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `competency-matrix`, `portfolio-project-brief`, `five-axis-review`입니다.

### 결과물

**최소 결과:** `competency-matrix`, `portfolio-project-brief`, `five-axis-review`의 사용성 흐름입니다.

**선택 결과:** 오류·복구와 focus 점검표입니다.

**확장 결과:** 공개 가능한 관찰과 수정 기록입니다.

### 검토와 승인

**읽는 순서:** 행동 → 오류 → focus → 대체 입력입니다. **사람 결정:** UX·접근성 검토자가 사용성 관찰과 누락을 확인합니다. 자동 승인을 하지 않으며 접근성 적합성을 보장하지 않습니다.

### 실패·재개

관찰하지 못한 사용자는 대표하지 않고 가정으로 보존합니다. 한 오류 상태와 대체 입력에서 재개합니다.

### 자기점검과 다음 학습

사용성 가정을 조사 결과처럼 썼는가? 콘텐츠 흐름은 CA-T02, 첫 사례의 반복은 CA-T08로 이동합니다.

## CA-T06 내러티브 기획 준비생

### 현재 상황과 목표

**목표 직무:** 내러티브 기획의 협업 계약과 선택 분기를 공개 가능한 범위에서 연습하는 준비생 경로입니다.

**관찰 가능한 증거:** 등장인물 목표, 장면 분기, 정보 공개 순서와 협업 handoff 기록입니다.

**가장 작은 증명 프로젝트:** 대화 장면 하나에 선택 분기와 협업 handoff를 붙여 만듭니다.

**review owner:** 내러티브 기획 멘토가 장면 목적과 협업 경계를 검토합니다.

**portfolio result:** 내러티브 브리프, 분기표, 권리 경계를 담은 개인 사례입니다.

**non-guarantee:** 이 사례는 내러티브 기획 합격이나 실제 협업 경험을 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 대사 양보다 장면 목적, 선택, 전달할 정보를 검토할 때.
- 부적합: 타인의 세계관 자료나 팀 대본을 개인 포트폴리오로 옮길 때입니다.

### 준비 입력

가상 등장인물 목표, 장면 목적, 선택 분기, 공개 범위, 협업 handoff와 내러티브 기획 멘토를 준비합니다.

### 10분 미니 실습

대화 한 장면을 목표·선택·결과로 세 줄에 나누고, 아직 정해지지 않은 정보는 unknown으로 둡니다.

### 표준 실습

1. `game-design-role-map`에 내러티브 기획의 협업 경계를 적습니다.
2. `portfolio-project-brief`에 장면 목적과 분기 조건을 기록합니다.
3. `creative-design-portfolio`에 공개 제외 항목과 대안을 남깁니다.

### 포트폴리오·실무 확장

[ST-C05 콘텐츠·내러티브·퀘스트·NPC](../../game-design-studio/use-cases/competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc)의 공개 가능한 evidence summary로 장면 목적을 점검합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 가상 대화 장면 하나를 등장인물 목표, 선택 분기, 결과와 협업 handoff로 나눠. 타인의 설정과 실제 협업 경험은 만들지 말고 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/narrative-prep 대화 장면의 목적과 분기를 portfolio-project-brief로 정리해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-design-role-map`, `portfolio-project-brief`, `creative-design-portfolio`입니다.

### 결과물

**최소 결과:** `game-design-role-map`, `portfolio-project-brief`, `creative-design-portfolio`의 장면 사례입니다.

**선택 결과:** 분기표와 공개 제외 목록입니다.

**확장 결과:** 권리 경계를 확인한 개인 수정 기록입니다.

### 검토와 승인

**읽는 순서:** 장면 목적 → 선택 → handoff → 공개 경계입니다. **사람 결정:** 내러티브 기획 멘토가 장면 목적과 협업 경계를 검토합니다. 자동 승인을 하지 않으며 실제 협업 경험을 대신하지 않습니다.

### 실패·재개

권리나 기여가 불명확하면 공개하지 않고 장면 목적과 질문을 보존합니다. 가상 장면 하나에서 재개합니다.

### 자기점검과 다음 학습

대사를 실제 팀 기여로 바꾸었는가? 퀘스트 흐름은 CA-T02, 공간 연출은 CA-T07으로 이동합니다.

## CA-T07 레벨 디자인 준비생

### 현재 상황과 목표

**목표 직무:** 레벨 디자인의 공간, 동선, 시야와 반복 playtest를 작은 구역에서 연습하는 준비생 경로입니다.

**관찰 가능한 증거:** 동선, 시야, 막힘과 선택 지점의 관찰 및 playtest 메모입니다.

**가장 작은 증명 프로젝트:** 한 구역의 동선과 시야를 그리고 한 번의 playtest 질문을 둡니다.

**review owner:** 레벨 디자인 멘토가 공간 의도와 관찰의 범위를 검토합니다.

**portfolio result:** 동선 분석, playtest 메모, 수정 로그를 가진 개인 사례입니다.

**non-guarantee:** 이 사례는 레벨 디자인 실무 경험이나 채용을 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 맵의 크기보다 플레이어가 보고 선택하고 막히는 지점을 관찰할 때.
- 부적합: 팀 레벨 파일이나 플레이테스트 결과를 개인 작업처럼 주장할 때입니다.

### 준비 입력

공개 공간 장면, 동선·시야 관찰, 한 구역 가정, playtest 질문, 개인 기여 경계와 멘토를 준비합니다.

### 10분 미니 실습

한 구역에서 시작점, 선택점, 막힘, 복구 경로를 표시하고 확인하지 못한 동선은 unknown으로 둡니다.

### 표준 실습

1. `game-analysis-report`에 동선과 시야의 관찰을 기록합니다.
2. `portfolio-project-brief`에 한 구역과 playtest 질문을 둡니다.
3. `five-axis-review`에 막힘과 수정 로그의 우선순위를 남깁니다.

### 포트폴리오·실무 확장

[ST-C02 행동·핵심 루프·의미 있는 선택](../../game-design-studio/use-cases/competency-paths.md#st-c02-행동핵심-루프의미-있는-선택)의 공개 가능한 evidence summary로 공간 선택 질문을 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 한 구역의 시작점, 동선, 시야, 막힘과 복구를 관찰·가설로 나눠. playtest는 하지 않은 경우 질문으로 남기고 멘토 검토를 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:reverse-engineer-game-design artifact=game-design-career/level-prep 공간 관찰을 game-analysis-report와 playtest 질문으로 정리해.
```

### 스킬·템플릿 흐름

`reverse-engineer-game-design` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `game-analysis-report`, `portfolio-project-brief`, `five-axis-review`입니다.

### 결과물

**최소 결과:** `game-analysis-report`, `portfolio-project-brief`, `five-axis-review`의 공간 사례입니다.

**선택 결과:** 동선 그림과 playtest 질문입니다.

**확장 결과:** 개인 기여를 확인한 수정 로그입니다.

### 검토와 승인

**읽는 순서:** 동선 → 시야 → 막힘 → 수정입니다. **사람 결정:** 레벨 디자인 멘토가 공간 의도와 관찰의 범위를 검토합니다. 자동 승인을 하지 않으며 실무 경험을 보장하지 않습니다.

### 실패·재개

playtest가 없으면 결과를 만들지 않고 질문과 관찰을 보존합니다. 한 구역의 막힘에서 재개합니다.

### 자기점검과 다음 학습

관찰을 실제 사용자 결과처럼 썼는가? 전투 선택은 CA-T03, 첫 사례 반복은 CA-T08로 이동합니다.

## CA-T08 실무 경험이 없는 신입

### 현재 상황과 목표

**목표 직무:** 실무 경험이 없는 신입 기획 준비에서 개인 기여와 수정 가능한 판단을 남기는 경로입니다.

**관찰 가능한 증거:** 판단 근거, 수정 전후, 받은 질문과 개인이 실제로 한 작업의 기록입니다.

**가장 작은 증명 프로젝트:** 한 페이지 기획을 쓰고 피드백 뒤 수정 한 번을 남깁니다.

**review owner:** 포트폴리오 검토자가 개인 기여와 수정 근거를 확인합니다.

**portfolio result:** 작은 사례, 수정 전후, honest gap을 담은 개인 포트폴리오입니다.

**non-guarantee:** 이 사례는 신입 채용이나 직무 준비 완료를 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 경험 부족을 감추지 않고 작고 검토 가능한 판단을 보여 줄 때.
- 부적합: 팀 프로젝트 결과나 멘토의 작업을 자신의 실무 경험으로 만들 때입니다.

### 준비 입력

작은 문제 하나, 개인 작업 범위, 판단 근거, 피드백 질문, 공개 가능 여부와 포트폴리오 검토자를 준비합니다.

### 10분 미니 실습

한 페이지에 문제, 선택, 근거, 모르는 점을 쓰고 “다음에 확인할 질문” 하나를 붙입니다.

### 표준 실습

1. `career-stage-goal`에 현재의 honest gap과 다음 질문을 기록합니다.
2. `portfolio-project-brief`에 한 페이지 proof와 수정 한 번을 계획합니다.
3. `portfolio-backlog`에 받은 질문과 다음 검토 순서를 남깁니다.

### 포트폴리오·실무 확장

[ST-C08 제작·검토·이미지·출력](../../game-design-studio/use-cases/competency-paths.md#st-c08-제작검토이미지출력)의 공개 가능한 evidence summary로 검토 순서만 참고합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 실무 경험이 없는 신입의 한 페이지 기획을 문제, 선택, 근거, honest gap과 수정 한 번으로 정리해. 팀 성과를 만들지 말고 포트폴리오 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:build-game-design-portfolio artifact=game-design-career/new-hire-proof 한 페이지 proof와 수정 한 번을 portfolio-project-brief로 작성해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `build-game-design-portfolio` → `review-game-design-portfolio` 순서입니다. 템플릿은 `career-stage-goal`, `portfolio-project-brief`, `portfolio-backlog`입니다.

### 결과물

**최소 결과:** `career-stage-goal`, `portfolio-project-brief`, `portfolio-backlog`의 작은 사례입니다.

**선택 결과:** 수정 전후와 받은 질문 목록입니다.

**확장 결과:** 공개 가능한 개인 기여 설명입니다.

### 검토와 승인

**읽는 순서:** 문제 → 근거 → 수정 전후 → honest gap입니다. **사람 결정:** 포트폴리오 검토자가 개인 기여와 수정 근거를 확인합니다. 자동 승인을 하지 않으며 신입 채용을 보장하지 않습니다.

### 실패·재개

개인 기여가 분명하지 않으면 claim을 줄이고 작업 범위와 질문을 보존합니다. 한 페이지 proof에서 재개합니다.

### 자기점검과 다음 학습

수정 이유 없이 완성도만 주장했는가? 역할별 첫 과제는 CA-T01, 전환 경로는 CA-T09로 이동합니다.

## CA-T09 비전공자·다른 직군 전환자

### 현재 상황과 목표

**목표 직무:** 비전공자·다른 직군 전환에서 전이 가능한 역량과 새 증거 과제를 구분하는 경로입니다.

**관찰 가능한 증거:** 이전 경험의 사실, 전이 가능한 역량, 새 evidence와 공개 경계를 나눈 기록입니다.

**가장 작은 증명 프로젝트:** 전환 지도 하나와 새 과제 하나를 연결해 가정과 사실을 구분합니다.

**review owner:** Career 검토자가 이전 경험의 사실과 새 과제의 경계를 확인합니다.

**portfolio result:** transition-readiness, 역할 지도, 공개 경계를 담은 개인 사례입니다.

**non-guarantee:** 이 사례는 직군 전환 성공이나 이직을 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 이전 일을 과장하지 않고 어떤 역량이 새 증거를 더 필요로 하는지 정할 때.
- 부적합: NDA 자료, 팀 PII, 실제 고객 결과를 공개 증거로 옮길 때입니다.

### 준비 입력

이전 경험의 사실, 전이 가능한 역량, 새 evidence 과제, 공개 제외 목록, current requirement와 Career 검토자를 준비합니다.

### 10분 미니 실습

이전 경험 한 줄을 사실·전이 가능한 역량·새로 증명할 점으로 나눠 세 칸에 기록합니다.

### 표준 실습

1. `transition-readiness`에 사실과 가정을 분리합니다.
2. `game-design-role-map`에 역할 후보와 새 evidence를 연결합니다.
3. `portfolio-project-brief`에 새 과제의 공개·권리 경계를 적습니다.

### 포트폴리오·실무 확장

[ST-C01 플레이어 경험과 게임 비전](../../game-design-studio/use-cases/competency-paths.md#st-c01-플레이어-경험과-게임-비전)의 공개 가능한 evidence summary로 문제 정의 질문만 연결합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 비전공자 또는 다른 직군 전환자의 이전 경험을 사실, 전이 가능한 역량, 새 evidence 과제와 공개 경계로 나눠. 이직 결과는 가정으로 남기고 Career 검토 질문을 붙여.
```

### Codex CLI 요청문

```text
$game-design-career:map-game-design-career artifact=game-design-career/transition-map 이전 경험과 새 proof task를 game-design-role-map으로 분리해.
```

### 스킬·템플릿 흐름

`map-game-design-career` → `research-game-design-jobs` → `build-game-design-portfolio` → `plan-junior-growth` 순서입니다. 템플릿은 `transition-readiness`, `game-design-role-map`, `portfolio-project-brief`입니다.

### 결과물

**최소 결과:** `transition-readiness`, `game-design-role-map`, `portfolio-project-brief`의 전환 기록입니다.

**선택 결과:** 공개 제외 목록과 새 evidence 계획입니다.

**확장 결과:** 사람 검토를 거친 전환 설명입니다.

### 검토와 승인

**읽는 순서:** 이전 사실 → 전이 역량 → 새 evidence → 공개 경계입니다. **사람 결정:** Career 검토자가 이전 경험의 사실과 새 과제의 경계를 확인합니다. 자동 승인을 하지 않으며 이직을 보장하지 않습니다.

### 실패·재개

이전 경험의 공개 권한이 없으면 세부를 제거하고 전이 가능한 역량과 새 과제를 보존합니다. 작은 새 evidence에서 재개합니다.

### 자기점검과 다음 학습

이전 팀 성과를 개인 기여로 썼는가? 전투·분석 proof는 CA-T03, 성장·이직 검토는 CA-T10으로 이동합니다.

## CA-T10 주니어의 성장·이직

### 현재 상황과 목표

**목표 직무:** 주니어의 성장·이직 준비에서 준비도와 현재 요구를 사실로 확정하지 않는 경로입니다.

**관찰 가능한 증거:** growth review, 현재 공고, 수정 사례와 면접 답변의 날짜 있는 기록입니다.

**가장 작은 증명 프로젝트:** 수정 사례 하나와 면접 답변 하나를 연결해 다음 review를 정합니다.

**review owner:** manager 또는 career reviewer가 성장 기록과 다음 질문을 검토합니다.

**portfolio result:** junior-growth-review, transition-readiness, honest gap을 담은 개인 기록입니다.

**non-guarantee:** 이 사례는 승진·이직, 채용 또는 시장 성공을 보장하지 않습니다.

### 적합한 경우와 적합하지 않은 경우

- 적합: 경력 단계가 아니라 최근 수정·근거·다음 검토로 준비도를 점검할 때.
- 부적합: 오래된 공고나 팀 성과로 승진·이직 가능성을 확정할 때입니다.

### 준비 입력

날짜 있는 growth review, current requirement 표본, 수정 사례, honest gap, 면접 답변과 manager 또는 career reviewer를 준비합니다.

### 10분 미니 실습

수정 사례 하나를 문제·내 행동·근거·다음 질문으로 쓰고, 공고 정보의 날짜를 같이 적습니다.

### 표준 실습

1. `junior-growth-review`에 수정 사례와 성장 가설을 기록합니다.
2. `transition-readiness`에 current requirement 표본과 honest gap을 둡니다.
3. `interview-question-answer-log`에 확인할 수 있는 답변과 다음 review를 남깁니다.

### 포트폴리오·실무 확장

[ST-C08 제작·검토·이미지·출력](../../game-design-studio/use-cases/competency-paths.md#st-c08-제작검토이미지출력)의 공개 가능한 evidence summary로 수정 기록의 순서만 참고합니다. Studio 원본 Artifact를 병합하거나 복제하지 않습니다.

### Codex App 요청문

```text
@Game Design Career 주니어의 수정 사례, current requirement 표본, honest gap과 면접 답변을 날짜와 검토자로 연결해. 승진·이직 결과를 확정하지 말고 다음 review를 정리해.
```

### Codex CLI 요청문

```text
$game-design-career:plan-junior-growth artifact=game-design-career/growth-transition junior-growth-review와 transition-readiness의 다음 review를 정리해.
```

### 스킬·템플릿 흐름

`plan-junior-growth` → `research-game-design-jobs` → `practice-game-design-interview` → `visualize-career-roadmap` → `export-career-documents` 순서입니다. 템플릿은 `junior-growth-review`, `transition-readiness`, `interview-question-answer-log`입니다.

### 결과물

**최소 결과:** `junior-growth-review`, `transition-readiness`, `interview-question-answer-log`의 날짜 있는 기록입니다.

**선택 결과:** current requirement 표본과 다음 review 계획입니다.

**확장 결과:** 공개·개인 기여 경계를 확인한 성장 설명입니다.

### 검토와 승인

**읽는 순서:** 수정 사례 → current requirement → honest gap → 답변입니다. **사람 결정:** manager 또는 career reviewer가 성장 기록과 다음 질문을 검토합니다. 자동 승인을 하지 않으며 승진·이직을 보장하지 않습니다.

### 실패·재개

오래된 requirement나 권리 불명 자료는 current claim에 쓰지 않고 날짜와 gap을 보존합니다. 확인 가능한 수정 사례와 다음 review에서 재개합니다.

### 자기점검과 다음 학습

준비도를 확정 사실처럼 썼는가? 경제 가설의 검토는 CA-T04, 전환 경계는 CA-T09로 이동합니다.

## 직무별 비교

직무 이름과 역할 분담은 조직마다 다릅니다. 아래는 단일 회사의 role split이 아니라, 각 사례가 다루는 문제·증거·검토 질문·경계를 비교한 중립 요약입니다.

| ID | 목표 직무 | problem types | evidence artifacts | common review questions | boundaries | 관련 사례 |
| --- | --- | --- | --- | --- | --- | --- |
| CA-T01 | 시스템 기획 | 규칙·상태·예외 | 상태 전이, 예외 표 | 시스템 기획 멘토: 반례가 있는가? | 합격을 보장하지 않음 | [CA-T01](#ca-t01-시스템-기획-입문-학생) |
| CA-T02 | 콘텐츠·퀘스트 기획 | 분기·보상·제작 범위 | 퀘스트 상태, 분기 조건 | 콘텐츠 기획 멘토: 조건이 구현 가능한가? | 채용을 보장하지 않음 | [CA-T02](#ca-t02-콘텐츠퀘스트-기획-준비생) |
| CA-T03 | 전투·캐릭터 기획 | 선택·비용·피드백 | cooldown, 피해 판정 | 전투 기획 멘토: 반례가 있는가? | 합격을 보장하지 않음 | [CA-T03](#ca-t03-전투캐릭터-기획-준비생) |
| CA-T04 | 경제·밸런스·LiveOps | source·sink·보호 기준 | source, sink 기록 | 경제·밸런스 검토자: guardrail이 있는가? | 시장 성공을 보장하지 않음 | [CA-T04](#ca-t04-경제밸런스liveops-준비생) |
| CA-T05 | UI·UX 기획 | 오류·focus·대체 입력 | 오류 상태, focus 기록 | UX·접근성 검토자: 복구가 가능한가? | 채용을 보장하지 않음 | [CA-T05](#ca-t05-uiux-기획-준비생) |
| CA-T06 | 내러티브 기획 | 장면 목적·협업 경계 | 등장인물 목표, 분기표 | 내러티브 기획 멘토: handoff가 명확한가? | 합격을 보장하지 않음 | [CA-T06](#ca-t06-내러티브-기획-준비생) |
| CA-T07 | 레벨 디자인 | 공간·동선·시야 | 동선, 시야 메모 | 레벨 디자인 멘토: playtest 질문이 있는가? | 실무 경험을 보장하지 않음 | [CA-T07](#ca-t07-레벨-디자인-준비생) |

## 경험·전환·성장 단계 비교

이 세 사례는 개인의 실제 경력이나 결과를 판정하지 않습니다. 증거의 범위, 다음 proof project, 사람 검토를 비교합니다.

| ID | 목표 직무 | problem types | evidence artifacts | common review questions | boundaries | 관련 사례 |
| --- | --- | --- | --- | --- | --- | --- |
| CA-T08 | 신입 기획 준비 | 개인 기여·수정 | 판단 근거, 수정 전후 | 포트폴리오 검토자: 실제로 무엇을 했는가? | 채용을 보장하지 않음 | [CA-T08](#ca-t08-실무-경험이-없는-신입) |
| CA-T09 | 직군 전환 | 전이 가능한 역량·공개 경계 | 이전 경험, 새 evidence | Career 검토자: 사실과 가정을 분리했는가? | 이직을 보장하지 않음 | [CA-T09](#ca-t09-비전공자다른-직군-전환자) |
| CA-T10 | 주니어의 성장·이직 | 준비도·current requirement | growth review, 현재 공고 | manager 또는 career reviewer: 다음 review가 있는가? | 승진·이직을 보장하지 않음 | [CA-T10](#ca-t10-주니어의-성장이직) |
