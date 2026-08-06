# Task 3 — Studio concept scenarios

## 상태

완료. `ST-G01`부터 `ST-G10`까지의 콘셉트 시나리오를 공통 case-card 계약으로 작성하고, Studio use-case 인덱스의 예정 링크를 실제 문서 anchor로 전환했다.

## 변경

- `guides/game-design-studio/use-cases/concept-scenarios.md`
  - manifest의 정확한 H2 제목·anchor 순서로 콘셉트 사례 10개를 추가했다.
  - 각 사례는 Task 2와 같은 13개 H3 marker를 사용한다.
  - 각 사례의 `현재 상황과 목표` 안에 `플레이어 맥락`, `설계 제약`, `전이 가능한 역량`, `지원되지 않는 가정`, `검증 계획`을 section-local 필드로 넣었다.
  - 모바일 수집형 RPG·LiveOps, 캐주얼 퍼즐·방치형, 협동 생존 액션, 경쟁 PvP 아레나, PC·콘솔 액션 로그라이트, 선택형 내러티브 어드벤처, 코지 생활 시뮬레이션, 경영·타이쿤, 샌드박스·UGC, 교육·사회문제·접근성 중심 게임을 정확히 한 번씩 다뤘다.
  - App/CLI copy block, manifest에 선언된 실제 skill/template/output, Canonical Artifact tree·대표 내용, 사람 결정, 실패·보존·재개, 자기점검을 각 사례에 포함했다.
  - UGC와 교육·사회문제·접근성 사례는 moderation, rights, accessibility, ethical review를 설계 제약과 검증 gate에 모두 포함했다.
  - 재미, 시장, KPI, retention, balance와 효과 수치는 prototype·telemetry·simulation·사람 검토로 확인할 가정으로 유지했다.
  - `콘셉트 간 비교` 표에서 핵심 루프, 실패·복구, 정보 부하, 사회적 위험, 콘텐츠 주기, 필요한 근거를 비교하고 각 행을 `ST-C` 역량 anchor로 연결했다.
  - 특정 회사의 역할 분담·형식·문체나 기존 게임의 성공 공식을 복제하지 않았다.
  - Task 6 소유인 diagram embed는 추가하지 않았다.
- `guides/game-design-studio/use-cases/README.md`
  - 콘셉트 진입점을 실제 `concept-scenarios.md`로 연결했다.
  - `ST-G01..10` 예정 H3와 로컬 예정 링크를 제거하고 실제 파일 anchor 링크 10개로 바꿨다.
- `tests/contracts/user-guide-use-case-manifest.test.mjs`
  - concept guide regular-file, manifest H2 anchor, common 13-part case-card와 다섯 section-local 필드를 검증한다.
  - literal topic semantic matrix로 10개 사례의 의미 교환과 placeholder를 거부한다.
  - 각 CLI block을 파싱해 installed skill, manifest binding과 사례별 exact CLI skill을 검증한다.
  - manifest의 모든 skill/template/output, App/CLI block, artifact tree·대표 내용, 사람 결정·자동 승인 금지, 보존·재개를 검증한다.
  - 비교표의 여섯 비교 축, 10개 행 순서와 `ST-C` anchor link를 검증한다.
  - unsupported numeric claim과 diagram embed를 거부한다.

## TDD 증거

- RED: 문서 작성 전 `node --test tests/contracts/user-guide-use-case-manifest.test.mjs`를 실행했다. 새 concept/index 테스트가 `guides/game-design-studio/use-cases/concept-scenarios.md`의 `ENOENT`로 실패했고 기존 manifest·공통 테스트는 통과했다.
- GREEN: 10개 사례, 비교표와 실제 인덱스 링크를 추가한 뒤 동일 테스트가 18/18 통과했다.
- immutable in-memory mutation으로 원본 파일을 바꾸지 않고 다음 잘못을 각각 실패시켰다.
  - ST-G01과 ST-G02의 유효한 `현재 상황과 목표` 본문 교환: ST-G01의 `모바일` 의미 계약 실패.
  - ST-G01 설계 제약을 `TODO`로 교체: substantive field 계약 실패.
  - ST-G01 CLI를 설치됐지만 해당 사례의 exact 명령이 아닌 `define-game-vision`으로 교체: exact CLI binding 실패.
  - 안전한 D30 retention 가정 문장을 수치 달성 보장으로 교체: unsupported claim gate 실패.

## 검증

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — 18/18 통과.
- `node --test tests/contracts/user-guides-studio.test.mjs` — 11/11 통과.
- `node --test tests/contracts/user-guides-entry.test.mjs tests/contracts/root-readme-user-guides.test.mjs` — 8/8 통과.
- `node tooling/validate-user-guides.mjs` — `guides: PASS`, 72 guides·30 skill guides·30 templates의 partial target validation 통과.
- `npm run test:contracts` — 175/175 통과.
- `git diff --check` — 통과.

## 자체 검토

- brief, manifest literal, Task 2 common case-card와 작성 결과를 다시 비교했다.
- `writing-guidelines` 기준으로 불필요한 filler, 마케팅성 `easy/simple/quick`, em dash, `...`, untagged code fence, TODO/TBD와 diagram embed를 검사했다. 해당 문제는 발견되지 않았다.
- 프로젝트의 기존 Markdown 가이드 관례를 따라 frontmatter와 Vercel 전용 meta 필드는 추가하지 않았다.
- App/CLI 예시는 host plugin surface용 요청문이다. 저장소에서는 문법, 설치 inventory, manifest binding과 exact 사례 스킬을 검증했으며 실제 대화 세션은 시작하지 않았다.

## 남은 경계

- use-case SVG·PNG 생성과 embed는 Task 6 소유다.
- complete guide validation은 아직 생성되지 않은 후속 skill-workbench, FAQ와 전용 diagram target 때문에 이 단계에서 실행하지 않았다. 현재 문서·anchor는 partial validator와 계약 테스트로 검증했다.

## Fix round 1 — 후반부 의미·수치 주장·비교표 계약 강화

### 변경

- `concept-scenarios.md`의 내용은 변경하지 않았다.
- `tests/contracts/user-guide-use-case-manifest.test.mjs`에 10개 사례별 후반부 독립 literal 의미 계약을 추가했다.
  - `포트폴리오·실무 확장`, `결과물`의 대표 내용, `검토와 승인`, `실패·재개`, `자기점검과 다음 학습`의 핵심 용어를 각 ST-G ID에 고정했다.
  - 모든 13개 case-card H3 본문이 40자 이상의 substantive content이며 TODO/TBD가 아닌지 검증한다.
- 수치 결과 주장을 문장 단위로 검사한다.
  - `retention`, `리텐션`, `시장성`, `시장 규모`, `시장 점유율`, `KPI`, `재미`, `밸런스`/`balance`, `효과` 범주를 다룬다.
  - 숫자가 결합된 문장은 prototype, telemetry, simulation, 사람 검토·결정, 가정, 검증, provisional, 관찰, 평가 또는 근거를 가져야 한다.
  - qualifier가 있어도 보장·정답·확정·달성 보장처럼 모순되는 단정은 거부한다.
  - `ST-C03` 같은 역량 ID 숫자를 outcome 값으로 오인하지 않도록 ID를 제거한 문장을 검사한다.
- 비교표에 ST-G ID별 여섯 축의 독립 literal 키워드와 정확한 ST-C ID 집합을 추가했다.
  - 링크 label·target을 파싱하고 exact competency target과 비교한다.
  - `competency-paths.md`의 실제 heading anchor set에 target anchor가 존재하는지 확인한다.

### RED/GREEN 및 변이 증거

- RED에서 후반부 변이 4개가 모두 기존 helper를 통과했다.
  - ST-G01/ST-G02의 검토와 승인 swap.
  - 실패·재개 swap.
  - 자기점검·다음 학습 swap.
  - ST-G01 자기점검 본문 비우기.
- 후반부 literal table과 전체 H3 substantive gate를 추가한 뒤 네 변이가 각각 section-local 의미 또는 본문 길이 오류로 실패했다.
- RED에서 다음 unqualified 숫자 문장 7개가 모두 기존 gate를 통과했다: `retention은 40%`, `시장성은 80%`, `시장 규모는 1조 원`, KPI 70%, 재미 90점, 밸런스 95점, 학습 효과 60%.
- 문장 단위 qualifier gate를 추가한 뒤 일곱 문장이 모두 `unqualified numeric outcome claim`으로 실패했다.
- positive control로 retention 40%+prototype/telemetry, 시장성 80%+사람 검토, 시장 규모 1조 원+simulation 근거 문장을 가정·검증으로 표시했을 때 통과함을 확인했다.
- RED에서 ST-G01/ST-G02 핵심 루프 셀 swap, ST-G01의 wrong-valid ST-C03 교체, ST-C02 nonexistent anchor 교체가 모두 기존 비교표 검증을 통과했다.
- 여섯 축 literal, exact competency set과 실제 anchor resolution을 추가한 뒤 각각 축 의미, ST-C 집합, exact target 오류로 실패했다.

### 회귀 검증

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — 21/21 통과.
- `node --test tests/contracts/user-guides-studio.test.mjs` — 11/11 통과.
- `node --test tests/contracts/user-guides-entry.test.mjs tests/contracts/root-readme-user-guides.test.mjs` — 8/8 통과.
- `node tooling/validate-user-guides.mjs` — `guides: PASS`, partial target validation 통과.
- `npm run test:contracts` — 178/178 통과.
- `git diff --check` — 통과.

## Fix round 2 — numeric claim 문장 분류 강화

### 변경

- `concept-scenarios.md`의 내용은 변경하지 않았다.
- numeric outcome 문장 판정을 `isUnsafeNumericOutcomeSentence(sentence)` 순수 helper로 분리했다.
- 문장 전체에서 claim token과 numeric value를 독립적으로 찾아 숫자가 claim 앞·뒤 어느 쪽에 있든 순서와 거리에 관계없이 pair로 판정한다.
- `ST-C03` 같은 competency ID는 숫자 결과로 오인하지 않도록 정규화 단계에서 제외한다.
- `근거 없이`, `검증 없이`, `관찰 없이`, `평가 없이`, `가정 없이`를 문장에서 제거한 뒤 남은 긍정적 validation context만 인정한다.
- `보장`, `확정`, `정답`, `달성된 사실` 어근으로 활용형을 포괄한다. 따라서 `확정됩니다`, `확정되었습니다`도 단정으로 거부한다.
- `아닙니다`, `아니다`, `아니며`, `아니라`, `금지`가 단정 표현을 명시적으로 부정하면 안전한 문장으로 인정한다.
- 18개 literal decision table을 추가했다.
  - 거부 10개: 기존 7개 범주와 앞선 숫자 retention, negated qualifier KPI 확정, negated qualifier 시장 규모 확정.
  - 허용 8개: 기존 검증 문장 3개, 안전한 정답 부정문, KPI·재미·밸런스·효과의 실제 prototype/telemetry/simulation/사람 평가 문장.
- literal table은 순수 helper의 boolean 결과와 실제 guide mutation 경계의 throw/pass를 모두 검증한다.

### RED/GREEN 증거

- RED: literal table 추가 후 focused test가 `70% retention은 이미 달성된 사실입니다.`에서 “Missing expected exception”으로 실패했다. 기존 구현이 claim 뒤 80자만 숫자를 찾는 결함을 재현했다.
- GREEN: 순수 helper로 교체한 뒤 앞선 숫자, `근거 없이`/`검증 없이`, `확정됩니다`/`확정되었습니다`가 모두 unsafe로 분류됐다.
- 안전한 `retention 40%라는 가정은 검증 전 정답이 아닙니다.`와 KPI·재미·밸런스·효과의 실제 검증 qualifier positive control은 모두 통과했다.

### 회귀 검증

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — 21/21 통과.
- `node --test tests/contracts/user-guides-studio.test.mjs` — 11/11 통과.
- `node --test tests/contracts/user-guides-entry.test.mjs tests/contracts/root-readme-user-guides.test.mjs` — 8/8 통과.
- `node tooling/validate-user-guides.mjs` — `guides: PASS`, partial target validation 통과.
- `git diff --check` — 통과.

## Fix round 3 — qualifier와 assertion의 clause-local 부정

### 변경

- `concept-scenarios.md`의 내용은 변경하지 않았다.
- numeric literal decision table에 reject 11개와 allow 2개를 추가해 총 31개 문장을 검증한다.
- negated qualifier 제거 범위를 모든 validation qualifier로 확장했다.
  - 영문: `prototype`, `telemetry`, `simulation`.
  - 한국어: 사람 검토·결정·평가, 가정, 검증, 관찰, 평가, 근거.
  - 조사 뒤 `없이`와 `없이는` 형태를 모두 제거한 후 남은 긍정적 validation context만 인정한다.
- `보장`, `확정`, `정답`, `달성된 사실` assertion을 각각 독립 match로 수집한다.
- `isLocallyNegatedAssertion` helper는 assertion 뒤 같은 절의 `아닙니다`/`아니다`/`아니며`/`아니라`/`금지`만 해당 assertion의 safe negation으로 인정한다.
- comma, semicolon, `하지만`, `그러나`, `반면`, `이고`, `이며`를 local clause boundary로 사용한다. 앞 절의 부정·금지가 다음 절의 unsupported assertion을 상쇄하지 않는다.

### RED/GREEN 증거

- RED: 새 table을 추가한 뒤 `KPI 70%는 prototype 없이 제시합니다.`가 classifier에서 `false`를 반환해 focused test가 실패했다. 기존 positive qualifier regex가 `없이` 앞의 `prototype`을 잘못 인정하는 결함을 재현했다.
- GREEN: prototype, telemetry, simulation, 사람 검토·결정·평가, 가정, 관찰, 평가의 `없이`/`없이는` 문장과 기존 근거·검증 부정 문장이 모두 reject됐다.
- `KPI 70%는 정답이 아니라 확정된 결과입니다.`는 인접한 `정답`만 safe이며 별도 `확정` assertion이 reject됐다.
- `KPI 70%의 무단 공개는 금지하지만 달성은 확정됩니다.`는 앞 절의 금지가 뒤 절의 확정을 상쇄하지 않아 reject됐다.
- `retention 40%는 확정이 아니라 prototype으로 검증할 가정입니다.`와 `KPI 70% 달성 보장은 금지하며, telemetry로 검증할 가정입니다.`는 allow control로 통과했다.

### 회귀 검증

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — 21/21 통과.
- `node --test tests/contracts/user-guides-studio.test.mjs` — 11/11 통과.
- `node --test tests/contracts/user-guides-entry.test.mjs tests/contracts/root-readme-user-guides.test.mjs` — 8/8 통과.
- `node tooling/validate-user-guides.mjs` — `guides: PASS`, partial target validation 통과.
- `npm run test:contracts` — 178/178 통과.
- `git diff --check` — 통과.

## Fix round 4 — numeric claim pair별 clause 판정

### 변경

- `concept-scenarios.md` 본문은 변경하지 않았다.
- numeric claim 문장을 punctuation, contrast, connective 경계로 fragment화하고, 새 claim+number pair가 나타날 때 독립 판정 clause를 시작하도록 변경했다.
  - pair가 없는 후속 검증 fragment는 직전 claim clause에 귀속한다.
  - 다음 claim+number pair의 validation은 앞 claim clause를 구제하지 못한다.
- local negated assertion 뒤의 조기 안전 반환을 제거했다. 부정된 `보장`·`확정`도 같은 claim clause에 긍정 validation context가 없으면 reject한다.
- `prototype`, `telemetry`, `simulation`, 사람 검토·결정·평가, 가정, 검증, 관찰, 평가, 근거가 `과`, `와`, `및`, `또는`, `/`, `·`로 연결되고 `없이`/`없이는`로 끝나는 qualifier 그룹 전체를 제거한다.
- 대소문자와 무관하게 `ST-C`/`ST-G` ID를 제거해 Markdown anchor의 소문자 ID를 numeric outcome으로 오인하지 않게 했다.
- decision table에 요구된 reject 5개를 추가하고, 모든 오분류를 한 번에 보여 주는 mismatch assertion으로 바꿨다.

### RED/GREEN 증거

- RED command: `node --test --test-name-pattern='Studio concept contract rejects unqualified numeric outcome claims' tests/contracts/user-guide-use-case-manifest.test.mjs`
- RED: 0/1 통과. 기존 classifier가 다음 5개를 모두 allow해 `numeric classifier decision table`이 실패했다.
  - `KPI 70% 달성 보장은 금지하며, telemetry 없이 제시합니다.`
  - `retention 40%는 확정이 아니라 제시합니다.`
  - `KPI 70%는 prototype과 telemetry 없이 제시합니다.`
  - `KPI 70%는 사람 검토와 결정 없이 제시합니다.`
  - `KPI 70%는 근거 없이 제시하고, 재미 90점은 telemetry로 검증합니다.`
- GREEN: 동일 focused command가 1/1 통과했다. 기존 allow control과 실제 guide mutation 경계도 함께 통과했다.
- 첫 GREEN 시도에서 소문자 `st-c07` anchor가 밸런스 수치로 오인되는 회귀가 실제 guide mutation에서 검출됐고, ID 정규화를 대소문자 무관하게 보정한 뒤 다시 GREEN을 확인했다.

### 회귀 검증

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — 21/21 통과.
- `node --test tests/contracts/user-guides-studio.test.mjs` — 11/11 통과.
- `node --test tests/contracts/user-guides-entry.test.mjs tests/contracts/root-readme-user-guides.test.mjs` — 8/8 통과.
- `node tooling/validate-user-guides.mjs` — `guides: PASS`, 72 guides·30 skill guides·30 templates의 partial target validation 통과.
- `npm run test:contracts` — 178/178 통과.
- `git diff --check` — 통과.
