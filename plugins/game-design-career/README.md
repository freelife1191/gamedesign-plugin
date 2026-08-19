# Game Design Career

Game Design Career는 게임 기획 입문, 첫 취업, 주니어 성장, 이직 준비를 검증 가능한 산출물로 바꾸는 Codex 플러그인입니다. 진로를 단정하거나 합격을 보장하지 않고, 현재 자료와 제약에서 확인할 수 있는 근거·공백·다음 실험을 분리합니다.

플러그인은 제품 스킬 16개, 전문 역할 10개, 15개 Canonical Artifact 템플릿과 문서·이미지·내보내기 계약을 하나의 독립 패키지에 포함합니다. 공통 스킬 9개는 Archify, humanize-korean, Skillstead `svg-infographic` 0.10.0, 프로젝트 기억 스킬 3개, [레퍼런스 분석 스킬](skills/analyze-game-design-references/SKILL.md), [용어 사전 스킬](skills/maintain-game-design-glossary/SKILL.md), [스위트 업데이트 스킬](skills/upgrade-game-design-suite/SKILL.md)입니다. 제품 스킬과 합친 설치 스킬은 25개입니다.

## 대표 작업 경로

| 목표 | 시작 스킬 |
| --- | --- |
| 직무 탐색·학습 | `map-game-design-career` |
| 역기획 | `reverse-engineer-game-design` |
| 포트폴리오 | `build-game-design-portfolio` |
| 면접·성장·전환 | `practice-game-design-interview` 또는 `plan-junior-growth` |

### 직무 탐색·학습

#### 준비 입력

- 현재 경험, 목표 역할, 공개 가능한 관찰과 멘토

#### 연결 흐름

- `map-game-design-career` → `build-game-design-portfolio` → `plan-junior-growth`

#### 예상 결과

- 최소: `game-design-role-map`, `competency-matrix`, `learning-roadmap`
- 선택: 공개 가능한 evidence summary와 다음 proof task
- 확장: 검토자가 확인한 Career Artifact

#### 사람 검토

- 사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류

### 역기획·포트폴리오·면접

#### 준비 입력

- `evidence ID`, 관찰 범위, 개인 기여, 권리 검토자와 feedback owner

#### 연결 흐름

- `reverse-engineer-game-design` 또는 `build-game-design-portfolio` → `review-game-design-portfolio` → 필요 시 면접·내보내기

#### 예상 결과

- 최소: `reverse-design-document`, `creative-design-portfolio`, `five-axis-review`, `interview-question-answer-log`
- 선택: timestamp 관찰, review queue, 발표 질문과 도식·export 준비 상태
- 확장: public-rights review와 사람 피드백을 거친 portfolio 또는 성장 evidence package

#### 사람 검토

- 작성자, 멘토·manager·career reviewer, portfolio reviewer와 public-rights reviewer가 claim·asset·공개 범위와 다음 task를 결정

## 활용 시작점

취업 준비 학생, 주니어, 직무 전환자와 멘토는 `@Game Design Career` 뒤에 현재 상황, 가진 자료와 원하는 결과를 자연어로 적으면 됩니다. 스킬 이름이나 사례 ID를 먼저 고를 필요는 없습니다. 한 산출물과 입력이 분명하면 해당 전문 스킬로 직접 보냅니다. 여러 Career 단계와 산출물이 함께 남거나 목표가 불명확하면 [`orchestrate-game-design-career`](skills/orchestrate-game-design-career/SKILL.md)가 필요한 최소 경로를 고릅니다. 작업이 끝나면 선택한 스킬과 검토 역할, 결과 파일, 남은 결정을 알려 줍니다. 이 자동 선택은 자동 승인이 아니며 합격을 보장하지 않습니다.

같은 작업 경로를 재현하거나 특정 단계부터 재개할 때만 아래의 명시적 직접 요청을 사용합니다. 전체 스킬 경로는 기준 사례의 순서를 보존하며, 일상적인 한 문장 요청과 구분합니다. 18개 사례, 16개 직접 스킬, 19개 FAQ와 33개 도식 쌍은 설치된 스킬·템플릿·근거 경계를 설명하며 합격이나 채용 결과를 보장하지 않습니다.

### 목표별 대표 결과

아래는 원하는 결과를 빠르게 고르는 시작점입니다. 최소 결과는 Canonical Artifact에 남고, 선택·확장 결과와 사람 검토 경계는 근거와 검토가 갖춰진 뒤에만 연결합니다.

- **직무 탐색·학습** — 대표 요청: `$game-design-career:map-game-design-career 현재 제약과 목표 역할을 비교해 학습 우선순위를 정리해.`; 최소 결과: `game-design-role-map`, `learning-roadmap`; 선택 결과: 사람 검토를 위한 공개 가능한 evidence summary; 확장 결과: 검토자가 다음 proof task를 확인한 Career Artifact; 사람 검토 경계: 사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류합니다.
- **역기획** — 대표 요청: `$game-design-career:reverse-engineer-game-design 공개 관찰을 사실과 추론으로 분리해 역기획해.`; 최소 결과: `reverse-design-document`; 선택 결과: timestamp가 있는 공개 가능한 관찰 목록; 확장 결과: 권리 검토를 거친 분석 사례; 사람 검토 경계: 작성자와 멘토가 관찰의 정확성, 공개 범위와 다음 검증을 결정합니다.
- **창작 포트폴리오** — 대표 요청: `$game-design-career:build-game-design-portfolio 문제, 설계 제약과 개인 기여를 보존해 창작 사례를 작성해.`; 최소 결과: `creative-design-portfolio`; 선택 결과: 개인 기여와 공개 범위의 review queue; 확장 결과: public-rights review를 통과한 portfolio case study; 사람 검토 경계: 작성자, portfolio reviewer, public-rights reviewer가 공개 가능한 claim과 asset을 결정합니다.
- **포트폴리오 검토** — 대표 요청: `$game-design-career:review-game-design-portfolio 문제 정의, 기획 판단, 구현 연결, 근거와 회고를 검토해.`; 최소 결과: `five-axis-review`; 선택 결과: 발표 연습용 질문과 공개 전 권리 체크; 확장 결과: 사람 검토 뒤의 public-ready presentation package; 사람 검토 경계: 작성자, portfolio reviewer, public-rights reviewer와 멘토가 수정·발표·공개 범위를 결정합니다.
- **면접** — 대표 요청: `$game-design-career:practice-game-design-interview 공고와 포트폴리오 evidence ID로 기본·후속·반론 질문을 만들어.`; 최소 결과: `interview-question-answer-log`; 선택 결과: feedback cadence, proof task, 도식·export 준비 상태; 확장 결과: public-rights review와 사람 피드백을 거친 성장·전환 evidence package; 사람 검토 경계: 작성자와 멘토·manager·career reviewer, public-rights reviewer가 공개 범위와 다음 task를 결정합니다.
- **성장·전환** — 대표 요청: `$game-design-career:plan-junior-growth 최근 프로젝트 사건과 피드백을 목표 역할 요구사항에 연결해.`; 최소 결과: `junior-growth-review`, `transition-readiness`; 선택 결과: current requirement 표본과 다음 review 계획; 확장 결과: 공개·개인 기여 경계를 확인한 성장 설명; 사람 검토 경계: manager 또는 career reviewer가 성장 기록과 다음 질문을 검토합니다.

| 사례 ID · 제목 · 대상 | 정확한 준비 입력 | 전체 스킬 경로 | 명시적 직접 요청 | 결과 ID · owner · root | 사례 읽는 순서 |
| --- | --- | --- | --- | --- | --- |
| `CA-T01` — 시스템 기획 입문 학생 — AUD-01 · AUD-02 | 공개적으로 관찰 가능한 기능 하나, 입력과 결과, 모르는 규칙, 개인 작업 범위와 시스템 기획 멘토를 준비합니다. | $game-design-career:map-game-design-career → $game-design-career:build-game-design-portfolio → $game-design-career:plan-junior-growth | $game-design-career:map-game-design-career artifact=game-design-career/system-student 규칙·상태·예외를 competency-matrix와 learning-roadmap으로 연결해. | `game-design-role-map` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/game-design-role-map`<br>`competency-matrix` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/competency-matrix`<br>`learning-roadmap` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/learning-roadmap` | 상태표 → 규칙표 → 반례 → 다음 질문 |
| `CA-T04` — 경제·밸런스·LiveOps 준비생 — AUD-01 · AUD-02 | 공개적으로 보이는 재화 흐름, source·sink 가정, 이벤트 목적, guardrail, rollback과 검토자를 준비합니다. | $game-design-career:reverse-engineer-game-design → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:reverse-engineer-game-design artifact=game-design-career/economy-prep 공개 관찰을 source, sink와 가설로 분리한 game-analysis-report로 정리해. | `game-analysis-report` ($game-design-career:reverse-engineer-game-design) → `game-design-career/<career-id>/game-analysis-report`<br>`portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`five-axis-review` ($game-design-career:review-game-design-portfolio) → `game-design-career/<career-id>/five-axis-review` | source·sink → 가설 → guardrail → rollback |
| `CA-T05` — UI·UX 기획 준비생 — AUD-01 · AUD-02 | 공개 화면, 주요 행동, 오류 상태, focus 순서, 대체 입력 가정과 UX·접근성 검토자를 준비합니다. | $game-design-career:map-game-design-career → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:build-game-design-portfolio artifact=game-design-career/uiux-prep 온보딩 한 장면의 오류와 대체 입력을 portfolio-project-brief로 작성해. | `competency-matrix` ($game-design-career:map-game-design-career) → `game-design-career/<career-id>/competency-matrix`<br>`portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`five-axis-review` ($game-design-career:review-game-design-portfolio) → `game-design-career/<career-id>/five-axis-review` | 행동 → 오류 → focus → 대체 입력 |
| `CA-C05` — 관찰 기반 역기획 — AUD-01 · AUD-02 · AUD-03 · AUD-04 · AUD-05 | - 최소 입력: 공개 location, `evidence ID`, 관찰 범위, 개인 기여 경계, 공개·권리 검토자.<br>- 선택 입력: version, timestamp, counterexample, 재관찰 날짜. | $game-design-career:apply-document-quality-profile → $game-design-career:reverse-engineer-game-design → $game-design-career:export-career-documents | $game-design-career:reverse-engineer-game-design artifact=game-design-career/reverse-design EVID-RD-01 관찰을 보존하고 reverse-design-document를 작성해. | `reverse-design-document` ($game-design-career:reverse-engineer-game-design) → `game-design-career/<career-id>/reverse-design-document`<br>`game-analysis-report` ($game-design-career:reverse-engineer-game-design) → `game-design-career/<career-id>/game-analysis-report` | observation evidence ID → inference → proposal → 개인 기여 → public-rights review |
| `CA-C06` — 창작 기획 포트폴리오 — AUD-02 · AUD-03 · AUD-04 · AUD-05 · AUD-06 | - 최소 입력: 문제, 설계 제약, `evidence ID`, 실제 개인 기여, public-rights review owner.<br>- 선택 입력: feedback, prototype 관찰, 기각한 대안, 공개 목표. | $game-design-career:apply-document-quality-profile → $game-design-career:build-game-design-portfolio → $game-design-career:review-game-design-portfolio | $game-design-career:build-game-design-portfolio artifact=game-design-career/creative-case EVID-CP-01과 개인 기여 경계를 보존해 creative-design-portfolio를 작성해. | `portfolio-project-brief` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/portfolio-project-brief`<br>`creative-design-portfolio` ($game-design-career:build-game-design-portfolio) → `game-design-career/<career-id>/creative-design-portfolio` | evidence ID → observation → inference → proposal → 개인 기여 → public-rights review |
| `CA-C08` — 면접·주니어 성장·직무 전환 — AUD-03 · AUD-05 · AUD-06 | - 최소 입력: posting 또는 portfolio `evidence ID`, 개인 기여 경계, feedback owner, public-rights review owner.<br>- 선택 입력: target role, reviewAfter, 실험할 proof task, 공개 가능 여부. | $game-design-career:practice-game-design-interview → $game-design-career:plan-junior-growth → $game-design-career:visualize-career-roadmap → $game-design-career:export-career-documents | $game-design-career:practice-game-design-interview artifact=game-design-career/growth-transition EVID-GR-01을 보존하고 interview-question-answer-log와 다음 proof task를 연결해. | `interview-question-answer-log` ($game-design-career:practice-game-design-interview) → `game-design-career/<career-id>/interview-question-answer-log`<br>`junior-growth-review` ($game-design-career:plan-junior-growth) → `game-design-career/<career-id>/junior-growth-review`<br>`transition-readiness` ($game-design-career:plan-junior-growth) → `game-design-career/<career-id>/transition-readiness` | evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → feedback |

### CA-T01 — 시스템 기획 입문 학생 — AUD-01 · AUD-02

- **준비 입력:** 공개적으로 관찰 가능한 기능 하나, 입력과 결과, 모르는 규칙, 개인 작업 범위와 시스템 기획 멘토를 준비합니다.
- **전체 스킬 경로:** `$game-design-career:map-game-design-career` → `$game-design-career:build-game-design-portfolio` → `$game-design-career:plan-junior-growth`
- **직접 요청문:** `$game-design-career:map-game-design-career artifact=game-design-career/system-student 규칙·상태·예외를 competency-matrix와 learning-roadmap으로 연결해.`
- **결과 ID · owner · root:** `game-design-role-map` (`$game-design-career:map-game-design-career`) → `game-design-career/<career-id>/game-design-role-map`; `competency-matrix` (`$game-design-career:map-game-design-career`) → `game-design-career/<career-id>/competency-matrix`; `learning-roadmap` (`$game-design-career:map-game-design-career`) → `game-design-career/<career-id>/learning-roadmap`
- **읽는 순서:** 상태표 → 규칙표 → 반례 → 다음 질문

### CA-T04 — 경제·밸런스·LiveOps 준비생 — AUD-01 · AUD-02

- **준비 입력:** 공개적으로 보이는 재화 흐름, source·sink 가정, 이벤트 목적, guardrail, rollback과 검토자를 준비합니다.
- **전체 스킬 경로:** `$game-design-career:reverse-engineer-game-design` → `$game-design-career:build-game-design-portfolio` → `$game-design-career:review-game-design-portfolio`
- **직접 요청문:** `$game-design-career:reverse-engineer-game-design artifact=game-design-career/economy-prep 공개 관찰을 source, sink와 가설로 분리한 game-analysis-report로 정리해.`
- **결과 ID · owner · root:** `game-analysis-report` (`$game-design-career:reverse-engineer-game-design`) → `game-design-career/<career-id>/game-analysis-report`; `portfolio-project-brief` (`$game-design-career:build-game-design-portfolio`) → `game-design-career/<career-id>/portfolio-project-brief`; `five-axis-review` (`$game-design-career:review-game-design-portfolio`) → `game-design-career/<career-id>/five-axis-review`
- **읽는 순서:** source·sink → 가설 → guardrail → rollback

### CA-T05 — UI·UX 기획 준비생 — AUD-01 · AUD-02

- **준비 입력:** 공개 화면, 주요 행동, 오류 상태, focus 순서, 대체 입력 가정과 UX·접근성 검토자를 준비합니다.
- **전체 스킬 경로:** `$game-design-career:map-game-design-career` → `$game-design-career:build-game-design-portfolio` → `$game-design-career:review-game-design-portfolio`
- **직접 요청문:** `$game-design-career:build-game-design-portfolio artifact=game-design-career/uiux-prep 온보딩 한 장면의 오류와 대체 입력을 portfolio-project-brief로 작성해.`
- **결과 ID · owner · root:** `competency-matrix` (`$game-design-career:map-game-design-career`) → `game-design-career/<career-id>/competency-matrix`; `portfolio-project-brief` (`$game-design-career:build-game-design-portfolio`) → `game-design-career/<career-id>/portfolio-project-brief`; `five-axis-review` (`$game-design-career:review-game-design-portfolio`) → `game-design-career/<career-id>/five-axis-review`
- **읽는 순서:** 행동 → 오류 → focus → 대체 입력

### CA-C05 — 관찰 기반 역기획 — AUD-01 · AUD-02 · AUD-03 · AUD-04 · AUD-05

- **준비 입력:** 최소 입력: 공개 location, `evidence ID`, 관찰 범위, 개인 기여 경계, 공개·권리 검토자; - 선택 입력: version, timestamp, counterexample, 재관찰 날짜.
- **전체 스킬 경로:** `$game-design-career:apply-document-quality-profile` → `$game-design-career:reverse-engineer-game-design` → `$game-design-career:export-career-documents`
- **직접 요청문:** `$game-design-career:reverse-engineer-game-design artifact=game-design-career/reverse-design EVID-RD-01 관찰을 보존하고 reverse-design-document를 작성해.`
- **결과 ID · owner · root:** `reverse-design-document` (`$game-design-career:reverse-engineer-game-design`) → `game-design-career/<career-id>/reverse-design-document`; `game-analysis-report` (`$game-design-career:reverse-engineer-game-design`) → `game-design-career/<career-id>/game-analysis-report`
- **읽는 순서:** observation evidence ID → inference → proposal → 개인 기여 → public-rights review

### CA-C06 — 창작 기획 포트폴리오 — AUD-02 · AUD-03 · AUD-04 · AUD-05 · AUD-06

- **준비 입력:** 최소 입력: 문제, 설계 제약, `evidence ID`, 실제 개인 기여, public-rights review owner; - 선택 입력: feedback, prototype 관찰, 기각한 대안, 공개 목표.
- **전체 스킬 경로:** `$game-design-career:apply-document-quality-profile` → `$game-design-career:build-game-design-portfolio` → `$game-design-career:review-game-design-portfolio`
- **직접 요청문:** `$game-design-career:build-game-design-portfolio artifact=game-design-career/creative-case EVID-CP-01과 개인 기여 경계를 보존해 creative-design-portfolio를 작성해.`
- **결과 ID · owner · root:** `portfolio-project-brief` (`$game-design-career:build-game-design-portfolio`) → `game-design-career/<career-id>/portfolio-project-brief`; `creative-design-portfolio` (`$game-design-career:build-game-design-portfolio`) → `game-design-career/<career-id>/creative-design-portfolio`
- **읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review

### CA-C08 — 면접·주니어 성장·직무 전환 — AUD-03 · AUD-05 · AUD-06

- **준비 입력:** 최소 입력: posting 또는 portfolio `evidence ID`, 개인 기여 경계, feedback owner, public-rights review owner; - 선택 입력: target role, reviewAfter, 실험할 proof task, 공개 가능 여부.
- **전체 스킬 경로:** `$game-design-career:practice-game-design-interview` → `$game-design-career:plan-junior-growth` → `$game-design-career:visualize-career-roadmap` → `$game-design-career:export-career-documents`
- **직접 요청문:** `$game-design-career:practice-game-design-interview artifact=game-design-career/growth-transition EVID-GR-01을 보존하고 interview-question-answer-log와 다음 proof task를 연결해.`
- **결과 ID · owner · root:** `interview-question-answer-log` (`$game-design-career:practice-game-design-interview`) → `game-design-career/<career-id>/interview-question-answer-log`; `junior-growth-review` (`$game-design-career:plan-junior-growth`) → `game-design-career/<career-id>/junior-growth-review`; `transition-readiness` (`$game-design-career:plan-junior-growth`) → `game-design-career/<career-id>/transition-readiness`
- **읽는 순서:** evidence ID → observation → inference → proposal → 개인 기여 → public-rights review → feedback

각 결과는 원본과 evidence를 먼저 읽고, 이미지·도식·MD/PDF/DOCX/PPTX 같은 파생 결과는 capability와 사람 검토가 갖춰진 뒤에만 확인합니다. `IMAGE_GEN_MODE`는 계획·provider 경로를 고를 뿐 이미지 권리·품질 승인이나 공개 권한을 대신하지 않습니다.

## 설치

요구 사항은 Codex CLI와 Node.js 18 이상입니다. 배포 대상은 저장소의 `plugins/game-design-career` 스냅샷이며, `products/game-design-career/plugin`은 개발 원천입니다.

### marketplace 등록

등록 방법은 둘이고 갱신 방법이 다릅니다. 공개 릴리스를 최신 판정 근거로 쓰려면 GitHub 저장소를 Git marketplace로 등록합니다.

```bash
codex plugin marketplace add freelife1191/gamedesign-plugin
```

저장소를 직접 고치며 쓸 때만 저장소 루트를 로컬 marketplace로 한 번 등록합니다. 이 경우 공개 릴리스로 갱신되지 않습니다. `<path-to-repository-root>`에는 `.agents/plugins/marketplace.json`이 들어 있는 디렉터리의 실제 경로를 넣습니다.

```bash
codex plugin marketplace add <path-to-repository-root>
```

등록 결과에서 marketplace 이름 `game-design-suite`와 플러그인을 확인합니다.

```bash
codex plugin marketplace list
codex plugin list
```

### 개별 플러그인 직접 설치

같은 marketplace의 Studio 플러그인과 독립적으로 Career 플러그인만 설치합니다.

```bash
codex plugin add game-design-career@game-design-suite
```

설치 후 새 Codex 작업을 시작해야 새 스킬과 도구가 확실히 로드됩니다. Codex CLI는 임의 디렉터리를 `plugin add` 인자로 받지 않으므로, 로컬 경로를 직접 복사하거나 설정 파일을 수동 편집하지 마십시오.

## 업데이트와 제거

`SessionStart`는 처음 시작할 때와 마지막 확인 뒤 7일이 지난 뒤에만 번들 업데이트를 확인합니다. 결과는 “플러그인 업데이트를 확인해 줘”라는 **알림**일 뿐이며, 플러그인을 자동으로 업데이트하거나 다시 설치하지 않습니다. 확인을 끄려면 `GAME_DESIGN_UPDATE_CHECKS=false`를 설정하세요. Skillstead·Archify·im-not-ai 번들은 다음 suite release 전까지 현재 버전으로 고정됩니다. 설치된 캐시 폴더는 직접 편집하지 마세요.

설치한 제품의 `$upgrade-game-design-suite`를 호출하면 아래 명령을 대신 안내받을 수 있습니다. 설치된 버전과 공개된 최신 릴리스를 비교한 결과를 먼저 보여 주고 승인을 기다리며, 검사와 계획 단계에서는 어떤 설치도 바꾸지 않습니다. 승인 없이 적용되는 업데이트는 없습니다. 선택지 표는 저장소의 `guides/game-design-career/installation.md`에 있습니다.

아래는 스킬 없이 손으로 처리할 때의 명령입니다.

`codex plugin list --available`은 설치하지 않은 플러그인 목록만 보여 줍니다. Codex 0.147.0에서는 이미 설치한 Career의 새 원천 버전을 판별하지 않습니다. 알림을 본 뒤에만 아래 명령을 명시적으로 실행하고, 재설치가 끝나면 새 채팅 또는 새 세션을 열어 새 설치본을 사용하세요.

Git marketplace로 등록했다면 스냅샷을 갱신한 뒤 다시 설치합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin add game-design-career@game-design-suite
```

로컬 marketplace(저장소 경로 등록)는 Git fetch 대상이 아닙니다. 저장소를 갱신하고 배포 스냅샷을 다시 만든 다음, 설치된 Career를 제거하고 다시 추가합니다. `marketplace.json`, Codex 설정 또는 설치된 캐시를 손으로 수정하지 마십시오.

제거 명령은 다음과 같습니다.

```bash
codex plugin remove game-design-career@game-design-suite
```

marketplace 자체도 더 이상 사용하지 않을 때만 별도로 제거합니다.

```bash
codex plugin marketplace remove game-design-suite
```

## 플러그인 구조

저장소에는 편집 원천과 배포 결과가 분리되어 있습니다.

- `products/game-design-career/plugin`은 Career 전용 source overlay입니다. 제품 스킬·역할·references·템플릿·문서만 여기서 편집합니다.
- `shared/`는 지식, 책임 있는 설계, 내보내기 계약, hooks, shared runtime scripts와 vendored Skillstead의 공동 원천입니다.
- `buildProduct()`는 두 원천을 깨끗한 staging 디렉터리의 `game-design-career/`로 합성합니다. 이 product clean build는 다른 플러그인이나 저장소 상대 경로 없이 단독 실행할 수 있어야 합니다.
- `plugins/game-design-career`는 이후 suite 통합 빌드가 marketplace용으로 생성·관리하는 generated independent snapshot 경로입니다.

`plugins/game-design-career` 생성은 suite build가 소유합니다. 생성 결과를 직접 편집하지 마십시오. 변경은 `products/` 또는 `shared/` 원천에 적용하고 테스트한 뒤 다시 빌드합니다.

현재 `buildProduct()` product clean build의 구조는 다음과 같습니다. 괄호의 개수는 Career release 계약에서 고정한 수입니다.

```text
<staging>/game-design-career/
├── .codex-plugin/plugin.json
├── skills/ (25개)
│   ├── <16개 Career 제품 스킬>/
│   │   └── scripts/                 # 필요한 스킬에만 있는 product helper
│   ├── analyze-game-design-references/ # 근거를 분리해 레퍼런스를 분석
│   ├── archify/                      # vendored Archify 2.15.0
│   ├── capture-game-design-memory/   # 검증한 교훈을 후보로 기록
│   ├── humanize-korean/              # vendored im-not-ai
│   ├── maintain-game-design-glossary/ # 용어 후보와 사람 검토 결정 관리
│   ├── maintain-game-design-memory/  # 후보와 승인 이력 관리
│   ├── retrieve-approved-design-memory/ # 승인된 관련 기억 조회
│   └── svg-infographic/              # vendored Skillstead 0.10.0
├── agents/ (10개)                   # 이식 가능한 전문 역할 프롬프트
├── hooks/
│   └── hooks.json
├── scripts/                         # shared runtime
│   ├── capability-probe.mjs
│   ├── data-only-snapshot.mjs
│   ├── quality-source-anchors.mjs
│   ├── resolve-quality-profile.mjs
│   ├── stop-artifact-review.mjs
│   ├── validate-artifact.mjs
│   ├── validate-quality-profile.mjs
│   └── validate-reference-preset.mjs
├── references/
│   ├── <Career routing, methods, rubric, product schemas>
│   ├── shared/
│   │   ├── knowledge/
│   │   │   ├── core/
│   │   │   └── trends/
│   │   ├── responsible-design/
│   │   ├── document-quality/        # indexes, profiles, overlays, presets, schemas, render contracts
│   │   └── export/
│   │       ├── schema/
│   │       ├── qa-contracts/
│   │       └── themes/
│   └── source/docs/                 # 원문 49개
├── assets/
│   ├── product-mark.svg
│   ├── templates/                   # Career Canonical Artifact 15개
│   └── shared/templates/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── README.md
```

저수준 `buildProduct()` 출력에는 `BUILD-MANIFEST.json`이 없습니다. 이 suite distribution snapshot에는 `BUILD-MANIFEST.json`이 있으며, suite 통합 빌드가 marketplace package를 만들 때 현재 원천에서 생성합니다.

경로 계약을 검색하기 쉽게 요약하면 `references/shared/knowledge/core/`는 검토된 Core 지식, `references/shared/knowledge/trends/`는 Current 근거와 갱신 정책, `references/source/docs/ (49개)`는 원문 provenance입니다. 내보내기 스키마는 `references/shared/export/schema/`에 있고, 문서 품질 계약은 `references/shared/document-quality/`와 `references/document-quality/template-profile-map.json`에 있으며, Career 전용 job·fact/inference·evidence schemas는 제품 references에 있습니다.

`assets/templates/ (15개)`와 `assets/product-mark.svg`는 Career source overlay에서 옵니다. 최종 `skills/ (25개)`는 제품 스킬 16개와 공통 스킬 9개입니다. 공통 스킬은 [레퍼런스 분석 스킬](skills/analyze-game-design-references/SKILL.md) `analyze-game-design-references`, `archify`, `humanize-korean`, `svg-infographic`, `retrieve-approved-design-memory`, `capture-game-design-memory`, `maintain-game-design-memory`, [용어 사전 스킬](skills/maintain-game-design-glossary/SKILL.md) `maintain-game-design-glossary`, [스위트 업데이트 스킬](skills/upgrade-game-design-suite/SKILL.md) `upgrade-game-design-suite`이며, `agents/ (10개)`는 네이티브 발견 여부와 무관하게 오케스트레이터가 전달할 수 있는 전문 역할 프롬프트입니다.

## 설치된 top-level scripts

| 파일 | 역할 |
| --- | --- |
| `analyze-game-design-references.mjs` | 근거를 분리해 레퍼런스 분석 산출물을 검증 |
| `build-image-asset-plan.mjs` | profile과 artifact에서 image asset plan 생성 |
| `capability-probe.mjs` | 선택 renderer capability 점검 |
| `capture-design-memory.mjs` | 검증한 작업의 교훈을 검토 대기 후보로 기록 |
| `check-game-design-updates.mjs` | 고정 번들의 업데이트 정보를 7일 주기 안내로 확인 |
| `compile-image-prompts.mjs` | Markdown/JSON prompt package 생성 |
| `data-only-snapshot.mjs` | 신뢰 경계의 data-only snapshot 검증 |
| `estimate-cutscene-image-cost.mjs` | 현재 컷씬 wave의 비용 범위와 cap 계산 |
| `generate-openai-images.mjs` | OpenAI Images API bounded adapter |
| `inspect-game-design-plugin-updates.mjs` | inventory의 비교 가능 여부와 명시적 재설치 계획 확인 |
| `load-memory-config.mjs` | 프로젝트 기억 설정을 안전한 값으로 읽기 |
| `maintain-design-memory.mjs` | 후보·사람 결정·충돌·복구 관리 |
| `manage-game-design-glossary.mjs` | 용어 후보·오버레이·사람 결정 기록 관리 |
| `plan-cutscene-visual-preproduction.mjs` | 컷씬 brief, shot, 프롬프트와 serial wave 계획 생성 |
| `quality-source-anchors.mjs` | canonical quality source byte·semantic anchor |
| `resolve-quality-profile.mjs` | profile 선택·합성·manifest·상태 전이 |
| `retrieve-design-memory.mjs` | 승인된 관련 기억과 적용·제외 기록 조회 |
| `review-cutscene-continuity.mjs` | 컷씬 결과의 continuity receipt와 gate 검토 |
| `run-approved-cutscene-image-stage.mjs` | 현재 승인된 컷씬 wave만 provider dispatch로 전달 |
| `run-game-design-writing-polish.mjs` | writing specialist와 bundled humanize-korean을 거치는 bounded revision 실행 |
| `run-image-asset-workflow.mjs` | image workflow composition |
| `stop-artifact-review.mjs` | one-retry Stop artifact review |
| `validate-artifact.mjs` | Canonical Artifact 검증 |
| `validate-cutscene-visual-preproduction.mjs` | 컷씬 계획, wave 순서와 approval binding 검증 |
| `validate-design-memory.mjs` | 기억 원본·상태 전이·출처 연결 검증 |
| `validate-game-design-writing-language.mjs` | 게임 기획 문서의 용어·문체 검증 |
| `validate-image-assets.mjs` | image manifest/lifecycle 검증 |
| `validate-image-config.mjs` | redacted image configuration 검증 |
| `validate-quality-profile.mjs` | closed Quality Profile 검증 |
| `validate-reference-intelligence.mjs` | 레퍼런스 분석과 용어 사전 산출물의 경계 검증 |
| `validate-reference-preset.mjs` | neutral reference preset 검증 |
| `validate-writing-revision.mjs` | protected content와 bounded writing revision 검증 |

이 표는 기존 16개와 기억 스크립트 5개, 레퍼런스 인텔리전스 스크립트 4개, 컷씬 프리프로덕션 스크립트 5개, 업데이트 검사 스크립트 2개를 합친 최상위 실행 스크립트 32개입니다. `scripts/lib/*.mjs`는 최상위 스크립트가 쓰는 내부 도구이며 직접 실행 목록에 포함하지 않습니다.

## 프로젝트 기억

프로젝트 기억은 이전 학습·포트폴리오·면접 작업에서 확인한 교훈을 출처·범위·상태와 함께 로컬에 보관합니다. 현재 프로젝트를 뜻하는 `project`가 기본 범위이며 `.game-design/`을 자동으로 Git에 커밋하거나 원격 저장소로 보내지 않습니다. 설치·업데이트·제거도 이 폴더를 만들거나 지우지 않습니다.

자동으로 남는 것은 검토 대기 후보뿐입니다. 후보를 자동 승인하지 않으며 이름이 확인된 사람이 출처와 적용 조건을 검증한 뒤 승인·거부·폐기합니다. 출처가 달라지거나 검토·만료 시점을 지난 기록, 충돌한 기록은 적용하지 않습니다. `GAME_DESIGN_MEMORY_ENABLED=false` 또는 “이번 작업에서는 이전 기억을 사용하지 마.”라는 요청으로 제외할 수 있고, 기억 기능에 문제가 생겨도 기존 Career 작업은 기억 없이 계속합니다.

사용법과 복구 절차는 저장소 checkout의 `guides/game-design-career/memory.md`에서 확인합니다. 설치 패키지 안에서는 `retrieve-approved-design-memory`, `capture-game-design-memory`, `maintain-game-design-memory` 스킬을 직접 호출할 수 있습니다.

## 설치된 document-quality 경로

아래 경로는 `references/shared/document-quality/` 아래에 설치됩니다.

| 상대 경로 | 내용 |
| --- | --- |
| `indexes/career.json` | Career closed selection index |
| `indexes/studio.json` | Studio closed selection index |
| `profiles/career/` | Career 13-profile catalog |
| `profiles/studio/` | Studio 17-profile catalog |
| `overlays/` | additive overlay 3개 |
| `presets/` | neutral reference preset 7개 |
| `render-contracts/long-form-document.json` | 장문 문서 render contract |
| `render-contracts/presentation.json` | presentation render contract |
| `render-contracts/review-report.json` | review report render contract |
| `schema/quality-profile-selection.schema.json` | profile selection schema |
| `schema/quality-profile.schema.json` | Quality Profile schema |
| `schema/reference-preset.schema.json` | neutral preset schema |

`hooks/hooks.json`은 두 shared runtime 진입점을 연결합니다.

- `SessionStart`는 `scripts/capability-probe.mjs`를 실행하는 capability-probe hook입니다. Node, Chromium, LibreOffice와 Codex 문서·PDF·프레젠테이션 capability를 감지하되 선택 기능 부재로 작업을 중단하지 않습니다.
- `Stop`은 `scripts/stop-artifact-review.mjs`를 실행하는 one-retry artifact review hook입니다. 최종 artifact sentinel이 있을 때 Canonical Artifact를 검증하고, 실패하면 교정 패스를 한 번만 요청합니다. hook 재진입 상태에서는 다시 차단하지 않습니다.

최상위 `scripts/`는 이 두 hook과 Canonical Artifact 검증을 위한 shared runtime입니다. Career 전용 product helper는 필요한 제품 스킬의 `skills/<skill-id>/scripts/`에 있으며, 역할 병합, E2E 시나리오, 채용 근거, 시각화 상태와 내보내기 job을 검증합니다. `BUILD-MANIFEST.json`은 제품 원천이나 저수준 clean build 파일이 아니라 suite 통합 빌드가 distribution snapshot에 추가하는 생성물입니다.

## 작동 방식

1. [오케스트레이터](skills/orchestrate-game-design-career/SKILL.md)가 목표, 경력 단계, 보유 자료, 제약, 요청 형식을 정규화합니다.
2. 가장 작은 순서형 스킬 체인을 선택합니다. 현재 채용 공고·회사·프로젝트·도구·시장 사실이 필요하면 조사 스킬을 먼저 실행합니다.
3. 검토가 필요하면 전문 역할을 최대 3개 선택합니다. 서로 독립적인 검토는 병렬 실행하고, 호스트가 병렬 서브에이전트를 지원하지 않으면 동일한 질문과 역할을 고정 우선순위로 순차 fallback 실행합니다.
4. 결과는 `severity → evidence-gap-id → artifact-section-id → role-priority` 순서로 결정론적으로 병합합니다. 충돌하는 권고는 지우지 않고 명시적 결정으로 남깁니다.
5. 내용은 Canonical Artifact에 보존하고, 도식화와 내보내기는 선택적 파생 작업으로 실행합니다.

`agents/*.md`는 오케스트레이션에 전달하는 이식 가능한 역할 자산입니다. 이 자산은 네이티브 자동 발견을 보장하지 않습니다. 호스트의 자동 발견이 없어도 현재 에이전트가 같은 프롬프트를 순차 실행해야 합니다.

### 경력 단계

| 단계 | 적용 신호 | 기본 결과 |
| --- | --- | --- |
| `entry` | 게임 기획 탐색, 목표 레벨 미정 | 목표와 제약을 기록한 입문 계획 |
| `new-hire` | 신입·첫 게임 기획 직무 준비 | 채용 근거, 역할 맵, 포트폴리오 |
| `junior-growth` | 현직 주니어의 프로젝트 영향·성장 증명 | 분기별 증거 프로젝트와 피드백 계획 |
| `transition` | 회사·직무 전환 준비 | 채용 근거, 면접, 성장·전환 준비도 |

단계나 목표 직무가 불명확하면 `unclear`로 처리하고, 여러 임시 경로와 기회비용을 비교합니다. 하나의 정답 진로를 선언하지 않습니다.

## Document Quality Profiles

`apply-document-quality-profile`은 goal, audience, artifact type, requested format, template ID를 정규화해 정확히 하나의 primary profile을 선택합니다. 설치된 `references/document-quality/template-profile-map.json`이 canonical template map이고 production 호출은 caller-authored production map을 받지 않습니다. 알려진 명시적 override는 호환성을 검증합니다. 알 수 없는 요청은 결정론적 `nearest profile`과 차이를 기록하며, 알려진 호환 `fallback`을 명시한 경우에만 그 profile로 진행합니다. 호환 profile이 없거나 override/fallback이 잘못되면 fail-closed로 중단합니다.

| 프로필 ID | 대표 문서 목적 |
| --- | --- |
| `career-stage-role-map` | 경력 단계·역할 경로 맵 |
| `competency-matrix` | 역량·증거 매트릭스 |
| `learning-roadmap` | 학습·검토·증거 로드맵 |
| `job-posting-evidence` | 채용 공고 근거 분석 |
| `reverse-design-document` | 관찰·추론 분리 역기획서 |
| `game-analysis-report` | 범위·근거가 있는 게임 분석 |
| `portfolio-project-brief` | 포트폴리오 프로젝트 브리프 |
| `portfolio-case-study` | 판단·기여·결과 사례 연구 |
| `portfolio-review-backlog` | 포트폴리오 수정 백로그 |
| `interview-question-answer-report` | 질문·답변·근거 보고서 |
| `junior-growth-review` | 주니어 성장 검토 |
| `transition-readiness` | 이직 준비도 점검 |
| `recruiter-portfolio-presentation` | 채용 의사결정형 발표 자료 |

primary 요구사항에는 additive overlay `mobile`, `pc-console`, `live-service`를 중복 없이 더할 수 있고, neutral reference preset은 `competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling` 중 최대 하나만 더할 수 있습니다. overlay와 preset은 primary requirement나 안전 게이트를 삭제·약화할 수 없습니다. 이 reference-only preset은 회사나 프로젝트의 형식 복제가 아니며 결과에 authoring-only source, 회사·프로젝트명, 상표, URL, 로고, 원본 이미지·레이아웃을 노출하지 않고 공식 studio endorsement를 주장하지 않습니다.

선택 결과는 primary/overlay/preset ID, 이유, 점수, tie-break와 fallback 기록을 보존합니다. 요구사항 manifest와 stable section/table/Skillstead diagram/image/acceptance checklist ID는 canonical source bytes와 artifact digest에 결합됩니다. 상태는 `draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved`로만 전진합니다. 외부 artifact inspection, evidence reviewer, renderer/visual·rights·책임 게이트 reviewer, 이름 있는 human approval의 digest-bound receipt가 각각 필요하며 상태를 건너뛸 수 없습니다. Skillstead diagram slot은 renderer/visual review 전까지 unverified이고, generated image와 render는 자동 승인하지 않습니다.

설치 후 고급 사용자는 `references/shared/document-quality/schema/quality-profile.schema.json`, `references/shared/document-quality/schema/quality-profile-selection.schema.json`, `references/shared/document-quality/schema/reference-preset.schema.json`, `references/shared/document-quality/render-contracts/`, `references/shared/document-quality/profiles/career/`, `references/shared/document-quality/indexes/career.json`을 검사할 수 있습니다. 이 경로는 패키지 내부 canonical source이며 저장소의 authoring-only evidence로 fallback하지 않습니다. 렌더 계약은 후속 renderer가 지켜야 할 계약이지 현재 플러그인이 PDF/DOCX/PPTX/image를 자동 완성한다는 뜻이 아닙니다.

정확한 intent 예시는 다음과 같습니다.

```text
apply-document-quality-profile: portfolio-case-study를 recruiter 대상 MD로 만들고 pc-console overlay와 function-first preset을 적용해. section/table/diagram/image/acceptance checklist와 선택 기록을 먼저 반환해.
```

## 스킬 카탈로그

| 스킬 ID | 사용하는 때 | 핵심 결과 |
| --- | --- | --- |
| `game-design-career` | 어떤 스킬이 요청의 소유자인지 모를 때 | 소유 제품 하나, 실행 경로 하나, 라우팅 영수증 |
| `orchestrate-game-design-career` | 단계 진단과 복합 작업 라우팅 | 단계·목표 브리프, 스킬 체인, 검토 envelope |
| `apply-document-quality-profile` | 산출물 유형·대상·형식에 맞는 문서 품질 계약 적용 | 선택 기록, 요구사항 manifest, stable checklist와 상태 envelope |
| `map-game-design-career` | 역할군 비교와 역량 공백 계획 | 복수 임시 경로, 교환조건, 증거 과제 |
| `research-game-design-jobs` | 현재 채용·회사·프로젝트 사실이 필요할 때 | 날짜·지역·표본 한계가 있는 채용 근거 세트 |
| `build-game-design-portfolio` | 프로젝트를 검토 가능한 사례로 만들 때 | 주장-근거 색인, 기여도, 복구 큐 |
| `reverse-engineer-game-design` | 기존 게임의 규칙·UI·경제·운영을 역기획할 때 | 관찰/추론 분리, 대안, 반증 방법 |
| `practice-game-design-interview` | 공고와 포트폴리오 기반 면접 연습 | 4종 질문, 근거 연결 답변, 정직한 답변 패턴 |
| `review-game-design-portfolio` | 포트폴리오를 5축으로 검토할 때 | 관찰 상태, 근거 한정 점수, 최소 수정 큐 |
| `plan-junior-growth` | 분기 성장 목표와 이직 준비도를 계획할 때 | 요구사항 레지스터, 증거 프로젝트, 재평가 결정 |
| `visualize-career-roadmap` | 관계·의존·순서가 공간적으로 더 명확할 때 | 접근 가능한 SVG, 선택 근거, 검증 상태 |
| `export-career-documents` | MD/PDF/DOCX/PPTX 파생본이 필요할 때 | Canonical Artifact digest와 capability probe를 담은 non-terminal preflight manifest |
| `plan-image-assets` | 이미지가 필요한 profile/brief를 계획할 때 | stable asset ID, placeholders, `assets/image-assets.yml`, Markdown/JSON prompts |
| `generate-image-assets` | 명시적으로 선택/허용된 asset만 생성할 때 | provider policy, immutable selection receipt, truthful provenance 또는 placeholder |
| `review-image-assets` | 사람의 이미지 검토를 기록할 때 | named human evidence, rights/provenance review와 approval transition |
| `polish-game-design-writing` | 기획 문장을 전문적으로 점검·최소 수정할 때 | protected content receipt, revision findings, human review handoff |

## 전문 역할 프롬프트

| 역할 ID | 검토 책임 | 경계 |
| --- | --- | --- |
| `career-strategist` | 근거 기반 진로 방향과 교환조건 | 작은 표본을 보편 규칙으로 만들지 않음 |
| `document-quality-editor` | 문서 구조, section/slot, story contract의 최소 수정 검토 | evidence·visual·rights·production·release·human 승인 권한 없음 |
| `game-design-mentor` | 연습이 검토 가능한 기획 판단과 산출물을 만드는지 확인 | 활동량을 능력 증거로 대체하지 않음 |
| `portfolio-reviewer` | 각 주장이 증명하는 역량과 근거 위치 확인 | 시각적 완성도에서 역량을 추론하지 않음 |
| `reverse-design-critic` | 관찰·사실·추론과 반증 경로 검토 | 내부 의도나 구현을 사실로 단정하지 않음 |
| `interview-coach` | 답변의 주장·근거·선택·대안·결과·성찰 연결 확인 | 경험이나 성과를 조작하지 않음 |
| `evidence-auditor` | 최신성, 1차 출처, 범위, 일반화 한계 감사 | 누락·오래됨·비1차 근거를 승인하지 않음 |
| `game-design-writing-editor` | 번역투·반복·문맥 단절을 찾아 최소 수정안 기록 | 사실·수치·근거·승인 상태를 바꾸지 않음 |

## 이미지 전문 역할 레지스트리

| 역할 ID | 책임 | 경계 |
| --- | --- | --- |
| `art-brief-director` | art brief, prompt constraint, character/NPC/monster-boss/skill-VFX/environment/item/UI/story/key-art/document 요구사항 검토 | 일반 역할 priority/merge registry를 바꾸지 않고 approval authority가 없음 |
| `visual-asset-reviewer` | 가독성, provenance, Skillstead 증거와 rights/privacy 누락 검토 | immutable receipt 또는 사람의 document/production decision을 대신하지 않음 |

일반 역할 registry와 image specialist registry는 의도적으로 분리됩니다. 기존 7개 일반 역할의 병합 순서와 권한은 그대로이며, image specialist는 image workflow에만 명시적으로 연결됩니다.

## 근거와 최신성 정책

- 현재 채용 공고, 회사·프로젝트, 지역, 고용 형태, 보상, 도구 선호, 정책과 시장 전망은 시점 의존 주장입니다. 최신 1차 출처, 게시일 또는 갱신일, 검색일, 적용 지역을 기록합니다.
- 한 공고나 편의 표본은 시장 전체를 대표하지 않습니다. 반복 신호는 중복을 제거한 출처 ID, 분자, 분모, 표본 크기, 지역, source mix, blind spot과 일반화 한계를 함께 남깁니다.
- 관찰된 사실, 사용자 진술, 해석과 미확인 주장을 분리합니다. 새 근거가 로컬 문서와 충돌하면 충돌을 기록하고 최신 1차 근거를 우선합니다.
- 지원자의 경력, 기여, 팀 규모, 매출, 리텐션, 구현 상태, 결과를 조작하지 않습니다. 누락은 검증 과제나 정직한 답변 패턴이 됩니다.
- 학력, 나이, 전공, 배경, 공백, 명성만으로 적합성이나 경로 순위를 판단하지 않습니다. 비교 기준은 관찰 가능한 근거, 사용자의 목표와 제약입니다.
- 결과는 취업, 합격, 승진, 특정 역량 수준을 보장하지 않습니다.

기본 지식은 프로젝트가 제공한 한국어 원문 49개를 다섯 범주로 색인한 자료와 검토된 Core/Current references에서 옵니다. 원문의 시점 의존 조언은 현재 사실로 재사용하지 않습니다.

## Canonical Artifact

주요 결과는 다음 구조를 기준 원본으로 사용합니다.

```text
artifact-name/
├── content.md
├── evidence.yml
├── decisions/
│   └── README.md
├── assets/
│   └── README.md
└── export-manifest.yml
```

`content.md`는 유일한 내용 기준입니다. `evidence.yml`은 주장·출처·한계를, `decisions/`는 선택·대안·부작용·승인을, `assets/`는 출처·권리를, `export-manifest.yml`은 형식별 작업과 QA 상태를 기록합니다. 파생 파일이 실패해도 기준 원본은 덮어쓰지 않습니다.

## Canonical Artifact 템플릿

| 템플릿 ID | 용도 |
| --- | --- |
| `career-stage-goal` | 단계, 목표, 제약, 다음 검증 과제 |
| `game-design-role-map` | 역할군, 교환조건, 증거 공백 비교 |
| `competency-matrix` | 목표 역량과 현재 증거·학습 과제 연결 |
| `job-posting-evidence` | 공고별 1차 근거와 표본 한계 |
| `portfolio-project-brief` | 문제, 판단, 구현, 테스트, 결과의 검토 경로 |
| `reverse-design-document` | 관찰, 추론, 대안, 반증 계획 |
| `five-axis-review` | 5축 관찰 상태, 근거 점수, 최소 수정 |
| `interview-question-answer-log` | 4종 질문, 답변 근거, 피드백 |
| `junior-growth-review` | 프로젝트 사건, 분기 목표, 재평가 결정 |
| `transition-readiness` | 목표 요구사항, 현재 근거, 전환 공백 |
| `learning-roadmap` | 학습·연습·피드백·증거의 순서 |
| `portfolio-backlog` | 포트폴리오 증거 복구 우선순위 |
| `creative-design-portfolio` | 창의 기획의 의도·대안·검증 증거 |
| `introduction-motivation` | 사실 기반 자기소개와 지원 동기 |
| `game-analysis-report` | 범위가 명확한 게임 분석과 검증 큐 |

각 템플릿은 `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, `assets/README.md`를 포함합니다. [템플릿 디렉터리](assets/templates/)에서 원본을 확인할 수 있습니다.

## 이미지 asset workflow

설치된 plugin root `.env.example`만 안전하게 추적합니다. tracked `.env`나 어떤 문서에도 실제 `OPENAI_API_KEY`를 붙여넣지 마십시오. 로컬 작업공간 root의 비추적 `.env`는 다음 안전한 기본값을 참고합니다.

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_PROVIDER=codex-first
IMAGE_EMBEDDED_TEXT_LOCALE=none
# 다음 값은 IMAGE_PROVIDER=openai를 명시적으로 선택했을 때만 사용합니다.
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
OPENAI_API_KEY=
```

`IMAGE_GEN_MODE`는 정확히 `prompt-only`(기본값), `select`, `required`, `all`만 허용합니다. `IMAGE_PROVIDER=codex-first`는 API key가 있어도 available Codex/host `image_gen`을 먼저 쓰며 유료 API로 자동 전환하지 않습니다. `IMAGE_PROVIDER=openai`는 비용 안내와 현재 사용자 승인 뒤에만 선택합니다. 이미지 안 한글은 `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`과 `IMAGE_MODEL=gpt-image-2`가 필수입니다. 유료 quality는 `low`가 기본, `medium`은 선택된 마스터, `high`는 예외적인 영상 핵심 프레임·게임 원화에만 비용 승인 뒤 사용합니다.

| mode | 실행 | provider/실패 경계 |
| --- | --- | --- |
| `prompt-only` | 외부 호출 0회, 계획·prompt·placeholder 생성 | 안전한 기본값; 모든 실패와 무관하게 package 유지 |
| `select` | 실제 user stable IDs만 | 이름/순번/agent 추측은 안 되며 ordered IDs의 immutable receipt 전에는 호출 0회 |
| `required` | manifest의 required asset만 | 유한 declared count만 처리 |
| `all` | declared required/recommended/variant asset만 | 선언되지 않은 variant를 만들지 않음 |

모든 mode는 `assets/image-assets.yml`, `assets/prompts/image-prompts.md`, `assets/prompts/image-prompts.json`, expected count와 placeholders를 유지합니다. 지원 유형은 character, NPC, monster/boss, skill/VFX, environment/landmark, item/equipment, UI icon, story/storyboard, key art/pitch concept, document illustration/cover, Skillstead diagram입니다.

생성은 승인과 다릅니다. 승인 lifecycle은 `concept-draft → document-approved → production-candidate`이며 새 asset은 `concept-draft`로 시작합니다. 이름 있는 사람의 placement, alt text, evidence, rights/provenance 검토가 있어야 `document-approved`가 됩니다. 기술 적합성·게임 가독성·권리 검토가 더해진 상태가 `production-candidate`이며, **production-candidate는 release/legal/production approval이 아님**입니다. generated/host provenance와 applied model/quality는 host가 실제로 보고한 값만 기록합니다. 사람 검토는 저작권, 개인정보, 제3자 자료, 민감 정보, 접근성과 맥락을 별도로 확인합니다.

Skillstead SVG는 권위 있는 도식 원본입니다. 하나의 title/desc와 alt text를 제공하고 product wrapper lint, renderer, 정확한 @2x PNG, visual QA, evidence를 분리합니다. SVG/PNG가 생성됐다는 사실은 approval이 아닙니다. MD/PDF/DOCX/PPTX의 final derivative는 document-approved 이상 asset만 참조하고, PPTX는 독립 story와 visual QA를 별도로 통과해야 합니다.

`npm run smoke:image:live`는 한 장의 실제 외부 generation을 위한 explicit opt-in입니다. 기본 test, build, marketplace smoke는 no-network이며 이를 실행하지 않습니다. image capability가 없으면 plan만 남기고 capability를 확인합니다. renderer가 없으면 linted SVG와 실패 근거를 보존하고 PNG 성공을 주장하지 않습니다. manifest 또는 prompt가 없으면 `plan-image-assets`를 먼저 실행하고, select가 멈추면 실제 user stable IDs와 immutable receipt를 확인합니다.

## 사용 예시

아래 문장은 입력 예시입니다. 플러그인은 없는 자료를 채우지 않고 필요한 근거 공백을 결과에 남깁니다.

### 진로 미결정 입문자

> 시스템, 콘텐츠 기획 중 어느 쪽이 맞는지 아직 모르겠어. 주 8시간, 작은 솔로 프로토타입만 가능해. 복수 경로와 12주 검증 계획을 만들어 줘.

결과는 최소 두 경로, 교환조건, 역량 공백, 작은 연습, 증거 산출물과 피드백 시점을 포함합니다.

### 목표 채용 공고 근거 매트릭스

> 한국의 주니어 시스템 기획 공고를 공식 회사 채용 페이지에서 조사해. 공고별 요구사항과 반복 신호를 분리하고 게시일·검색일·표본·지역·일반화 한계를 기록해 줘.

### 역기획 포트폴리오

> 이 게임의 업그레이드 UI와 비용 규칙을 관찰 근거로 역기획해. 사실과 추론을 분리하고, 각 추론에 반례·대안·검증 방법을 넣어 포트폴리오 사례로 만들어 줘.

사용법 설명만 나열한 문서는 완료로 보지 않습니다.

### 5축 포트폴리오 리뷰

> 이 포트폴리오를 문제 정의, 기획 판단, 구현 연결, 근거와 검증, 회고 관점에서 검토해. 보이지 않은 능력을 0점으로 단정하지 말고 가장 작은 수정부터 제안해 줘.

### 면접 연습

> 이 공고와 내 포트폴리오 근거 ID로 기본·후속·반론·상황 질문을 만들어 줘. 확인할 수 없는 팀 성과는 정직한 답변 패턴으로 바꿔 줘.

### 주니어 성장 계획

> 최근 프로젝트 사건과 피드백을 목표 역할 요구사항에 연결해 두 분기 성장 계획을 만들어 줘. 각 목표에 담당자, 피드백 주기, 증거 산출물과 재평가 결정을 넣어 줘.

### 시각적 로드맵

> 검증된 역량 공백, 학습 의존성과 증거 산출물의 관계를 시각적 로드맵으로 만들어 줘. 적합한 프리셋 선택과 제외 이유도 기록해 줘.

### 문서 내보내기

> 이 Canonical Artifact를 MD와 PDF로, 리뷰어 발표용 PPTX로 내보내 줘. 먼저 preflight manifest를 만들고, trusted bundled renderer와 형식 QA가 원본·파생본 artifact digest를 결합해 검증한 뒤에만 terminal 결과를 기록해 줘.

## Repository checkout only guides

아래 문서는 설치 패키지에 포함되지 않습니다. repository checkout only에서 다음 plain code path를 사용하며, 패키지 밖 상대 Markdown 링크나 외부 URL을 약속하지 않습니다.

| 문서 | repository checkout only path |
| --- | --- |
| Career 활용 사례 인덱스 | `guides/game-design-career/use-cases/README.md` |
| Career 역량 사례 | `guides/game-design-career/use-cases/competency-paths.md` |
| Career 콘셉트 사례 | `guides/game-design-career/use-cases/concept-scenarios.md` |
| Career 스킬 워크벤치 | `guides/game-design-career/use-cases/skill-workbench.md` |
| Career FAQ | `guides/game-design-career/faq.md` |
| 공통 결과물 카탈로그 | `guides/use-cases/output-catalog.md` |

## Skillstead 도식화

[visualize-career-roadmap](skills/visualize-career-roadmap/SKILL.md)는 관계가 실제로 더 명확해질 때만 Skillstead `svg-infographic` 0.10.0을 사용합니다. 역할 맵, 역량 의존도, 학습 순서, 개발 프로세스, 포트폴리오 정보 구조, 복수 성장 경로 프리셋을 비교하고 선택·제외 이유를 남깁니다. 단순 목록이나 근거 없는 수치는 표 또는 본문으로 유지합니다.

SVG에는 `<title>`, `<desc>`, 결론을 설명하는 alt text가 필요합니다. 패키지의 SVG lint는 정확한 SVG bytes와 digest를 다시 검사합니다. Chromium이 있으면 2× PNG 렌더를 준비할 수 있지만, terminal 성공은 downstream trusted bundled renderer와 visual QA가 실제 SVG/PNG 파일, 정확한 크기와 artifact digest를 결합해 확인한 뒤에만 기록합니다. 브라우저가 없으면 편집 가능한 lint 통과 SVG를 보존하고 PNG를 `unavailable`로 표시하며, 렌더·검증 성공을 주장하지 않습니다.

색, 면적, 위치나 진행률처럼 보이는 표현으로 채용 가능성·역량 수준·일정·결과를 암시하지 않습니다. 모든 수치에는 source, baseline, owner, validation이 필요합니다.

## MD, PDF, DOCX, PPTX 내보내기

[export-career-documents](skills/export-career-documents/SKILL.md)의 `prepare-career-export.mjs`는 preflight 전용입니다. Canonical Artifact 검증이 없거나 실패하면 fail-closed로 중단합니다. 검증에 성공하면 digest를 기록하고 형식별 capability probe를 정규화하지만, 파생 파일을 생성하거나 terminal 결과를 판정하지 않습니다. 준비 단계가 기록할 수 있는 format status는 `not-requested`, `blocked`, `pending`, `unavailable`뿐입니다.

Preflight는 `passed` 또는 `failed`를 수용하거나 생성하지 않으며, caller가 제시한 generation·QA·derivative terminal evidence도 겉보기에 유효한 파일이나 명령과 관계없이 거부합니다. 따라서 preflight manifest 자체는 MD/PDF/DOCX/PPTX 생성 성공이나 실패의 증거가 아닙니다.

준비가 끝난 뒤에만 downstream trusted bundled renderer가 파생본을 만들고 format/visual QA를 실행합니다. 이 downstream 단계는 canonical source, 생성된 derivative, 검사 결과와 artifact digest를 결합해야 terminal `passed` 또는 `failed`를 판정할 수 있습니다. 실제 MD/PDF/DOCX/PPTX/SVG/PNG 성공 판정과 대표 출력 검증은 suite Task 11이 수행합니다.

| 형식 | downstream terminal QA 계약 |
| --- | --- |
| MD | frontmatter, H1 하나, 안정 heading ID, NFC, 상대 자산과 alt text 검증 |
| PDF | 텍스트 의미 비교와 모든 페이지 렌더 시각 QA |
| DOCX | OOXML package·relationship, 의미 비교, 모든 페이지 렌더 시각 QA |
| PPTX | 청중·목적·슬라이드별 메시지가 있는 독립적인 스토리, overflow 검사, 모든 슬라이드 렌더 QA |

PPTX는 Markdown 제목을 기계적으로 나누지 않습니다. Preflight의 capability `unknown`, `available`, `unavailable`과 준비 status `not-requested`, `blocked`, `pending`, `unavailable`을 downstream terminal status와 섞지 않습니다. Terminal promotion은 trusted renderer와 QA 경계 밖에서 추측하거나 대리 입력으로 만들 수 없습니다.

## 권리, 개인정보와 공정성

- 포트폴리오의 게임 화면, 아트, 데이터, 인용문과 제3자 자료는 출처, 사용 목적, 권리 또는 인용 근거를 `assets/README.md`에 기록합니다.
- 지원자·동료·면접관의 이름, 연락처, 비공개 회사 자료, NDA 정보와 개인 식별 정보는 필요한 최소 범위만 사용하고 공개 산출물에서는 제거하거나 비식별화합니다.
- 팀 결과와 개인 기여를 분리합니다. 승인받지 않은 내부 수치, 소유권, 구현 또는 성과를 추정하지 않습니다.
- 민감 특성이나 대리 변수를 근거로 적합성, 우선순위, 채용 가능성을 판단하지 않습니다.
- 법률·노무·저작권 판단은 제공하지 않습니다. 공개·배포 전 권리 보유자, 회사 정책과 필요한 전문가 검토를 확인하십시오.

## 제한 사항

- 플러그인은 채용, 합격, 승진, 연봉, 일정 또는 포트폴리오 평가 결과를 예측하거나 보장하지 않습니다.
- 채용 표본은 선택한 지역·시점·공고에 한정됩니다. 조사 결과는 전체 시장 통계가 아닙니다.
- 네이티브 역할 자동 발견과 병렬 서브에이전트 지원은 호스트에 따라 다릅니다. 순차 fallback은 동일 질문과 병합 순서를 유지합니다.
- PDF/DOCX/PPTX 생성과 PNG 렌더는 설치 환경의 renderer에 의존합니다. capability probe는 preflight 상태만 바꾸며 성공 증거가 아닙니다. Trusted downstream renderer·format/visual QA와 artifact digest 결합이 없으면 terminal 성공으로 표시하지 않습니다.
- 로컬 원문과 템플릿은 출발점이며, 시점 의존 사실을 대체하지 않습니다.

## 문제 해결

| 증상 | 확인 및 복구 |
| --- | --- |
| marketplace가 보이지 않음 | `codex plugin marketplace list`로 `game-design-suite`와 루트를 확인하고, 저장소 루트를 다시 등록합니다. |
| 업데이트가 반영되지 않음 | 올바른 로컬 marketplace가 설치되어 있는지 `codex plugin list`로 확인하고, cachebuster 갱신 후 재설치한 다음 새 작업을 시작합니다. |
| 현재 채용 주장을 만들 수 없음 | 공식 공고 URL, 게시일, 검색일, 지역을 제공하거나 조사 범위를 좁힙니다. 근거가 없으면 검증 과제로 남깁니다. |
| PNG가 생성되지 않음 | SVG lint 결과를 보존하고 Chromium probe 실패 근거를 기록합니다. SVG만 전달하고 PNG 검증을 주장하지 않습니다. |
| 내보내기가 `blocked`임 | Canonical validation과 형식별 capability evidence를 확인합니다. renderer가 준비되면 같은 preflight manifest를 trusted downstream 생성·QA 단계로 넘기고, 검증된 terminal 결과는 별도 증거로 기록합니다. |
| 포트폴리오 점수가 비어 있음 | 해당 축의 section/evidence ID가 관찰 가능한지 확인합니다. 미관이나 서술만으로 점수를 채우지 않습니다. |

## 검증

저장소 루트에서 다음 계약을 실행합니다.

```bash
node --test tests/products/career/readme.test.mjs
node --test tests/products/career/*.test.mjs tests/e2e/career/*.test.mjs
```

11개 source skill의 공식 구조를 확인합니다.

```bash
CODEX_SKILL_CREATOR_ROOT="${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator"
find products/game-design-career/plugin/skills -name SKILL.md -print0 |
  while IFS= read -r -d '' skill_file; do
    python3 "$CODEX_SKILL_CREATOR_ROOT/scripts/quick_validate.py" "${skill_file%/SKILL.md}"
  done
```

source plugin manifest를 확인합니다.

```bash
CODEX_PLUGIN_CREATOR_ROOT="${CODEX_HOME:-$HOME/.codex}/skills/.system/plugin-creator"
python3 "$CODEX_PLUGIN_CREATOR_ROOT/scripts/validate_plugin.py" products/game-design-career/plugin
```

두 명령은 `CODEX_HOME`이 설정되면 그 값을 우선하고, 없으면 `$HOME/.codex`를 사용합니다. 모든 경로 변수를 따옴표로 감싸므로 Codex 홈에 공백이 있어도 동작합니다. 배포 스냅샷 생성·독립 설치 smoke와 전체 형식 렌더 검증은 suite 통합 검증에서 실행합니다.

## 라이선스

Game Design Career 자체는 [MIT License](LICENSE)로 배포됩니다. 포함된 Skillstead `svg-infographic` 0.10.0은 Apache-2.0이며 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 패키지 안의 원본 라이선스가 적용됩니다. 프로젝트 제공 원문과 제3자 자료의 권리는 각각의 권리자에게 남습니다.
