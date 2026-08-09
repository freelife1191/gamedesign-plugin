# 문서 근거 기반 Archify 도식 전면 재설계

## 문서 상태

- 작성일: 2026-08-10
- 상태: 구현 전 승인 설계
- 적용 범위: 저장소의 게임 기획 플러그인 가이드용 Archify 도식
- 기준 스킬: 설치된 `tt-a1i/archify` 2.13의 `SKILL.md`, authoring contract, delivery contract
- 선행 결정: 기존 Task 13의 50개 일괄 생성 체계는 전부 제거하고 재사용하지 않는다.

## 1. 배경과 문제 정의

현재 `guides/assets/archify/`에는 50개 워크플로에 대응하는 JSON, HTML, receipt와 manifest가 있다. 구현은 서로 다른 문구를 넣었지만 실제 시각 구조는 사실상 두 종류에 수렴했다. 30개 스킬 도식이 하나의 토폴로지를 공유하고, 20개 recipe·suite 도식이 다른 하나의 토폴로지를 공유했다. 같은 lane, node, edge, card 구성을 반복했기 때문에 문서별 관계를 설명하는 도식이 아니라 내용만 바꾼 공통 템플릿처럼 보였다.

자동 검증도 문제를 놓쳤다. 기존 검증은 다음 항목은 확인했다.

- 카탈로그 항목과 산출물 수의 일치
- 입력, 스킬, 역할, 결과, 검토 경계 문구의 포함 여부
- Archify showcase 자동 검사 결과
- receipt와 digest의 정합성
- 빌드 결정성 및 트랜잭션 안전성

그러나 다음 핵심 품질은 완료 조건에 포함하지 않았다.

- 문서마다 실제로 다른 질문과 관계를 표현하는가
- 도식 유형이 질문에 맞는가
- topology와 layout이 근거에 따라 달라지는가
- 서로 다른 도식이 시각적으로 과도하게 유사하지 않은가
- 전수 시각 검토를 사람이 실제로 완료했는가

이 설계는 산출물 수를 먼저 정한 뒤 템플릿을 채우는 방식을 폐기한다. 문서를 먼저 분석하고, 도식이 설명력을 실질적으로 높이는 경우만 선별하며, 각 도식을 독립적으로 저작하고 전수 시각 검수한다.

## 2. 목표

### 2.1 핵심 목표

1. 기존 Task 13의 잘못된 Archify 생성·검증 계층과 모든 산출물을 제거한다.
2. 문서의 구체적 질문과 근거에서 출발한 선별형 도식 카탈로그를 만든다.
3. 각 Archify JSON spec을 독립 저작한다. 도구는 topology를 만들지 않는다.
4. architecture, workflow, sequence, dataflow, lifecycle을 질문의 관계 유형에 맞게 선택한다.
5. Studio와 Career에 서로 다른 제품 시각 문법을 적용하되, 개별 도식의 실제 관계가 layout보다 우선하도록 한다.
6. 모든 최종 도식에 Archify showcase 9/9 자동 검증과 실제 렌더 전수 시각 검수를 적용한다.
7. 중복·왜곡·충돌·근거 불충분 도식은 완료 산출물로 게시하지 않는다.

### 2.2 성공 기준

완료된 각 도식은 다음 조건을 모두 충족해야 한다.

- 하나 이상의 정확한 source document와 section anchor를 가진다.
- 도식이 답하는 질문이 한 문장으로 명확하다.
- 선택된 diagram type의 사용 이유가 기록되어 있다.
- source evidence가 node, edge, state, message 또는 flow의 의미를 뒷받침한다.
- JSON spec은 다른 항목을 복사해 이름만 바꾼 구조가 아니다.
- Archify `validate`와 `deliver`가 showcase 9/9, composition errors 0, warnings 0으로 성공한다.
- specification과 HTML의 SHA-256 및 byte receipt가 일치한다.
- default READ, light theme, dark theme, guided view가 실제 렌더에서 검수된다.
- clipping, glyph 왜곡, blur, tofu, node·edge·label 충돌, 무의미한 경로가 없다.
- 동일 계열의 다른 도식과 비교했을 때 질문에 필요한 구조적 차이가 식별된다.
- 시각 검수자가 `passed`로 기록하지 않은 도식은 문서에서 완료 산출물로 링크되지 않는다.

### 2.3 비목표

- 모든 스킬, recipe, suite에 Archify 도식을 하나씩 강제로 배정하지 않는다.
- 특정 수량의 HTML 생성을 성공 지표로 삼지 않는다.
- 기존 50개 JSON이나 HTML을 새 도식의 시작점으로 복사하지 않는다.
- builder가 lane, node, edge, card, state 또는 message를 자동 생성하지 않는다.
- Archify를 일반 설명용 그림에 강제하지 않는다. 단순 목록과 한 단계 안내는 Markdown이나 Skillstead가 더 적합하다.
- 자동 검사만으로 시각 검수 완료를 주장하지 않는다.
- 실제 브라우저 창을 자동으로 열지 않는다. 검수는 headless 렌더와 이미지 판독으로 수행한다.

## 3. 확정 결정

### 3.1 제거 범위

기존 Task 13 계층은 별도 제거 커밋에서 완전히 삭제한다.

- `guides/assets/archify/` 아래의 기존 50개 JSON·HTML·receipt
- 기존 `guides/assets/archify/manifest.json`
- 저장소에 섞인 `.DS_Store` 등 비관리 파일
- `tooling/build-archify-guides.mjs`
- `tooling/lib/archify-guides.mjs`
- `tests/unit/archify-guides.test.mjs`
- `package.json`의 `build:archify-guides`, `check:archify-guides`
- 기존 Task 13 산출물 또는 경로를 전제로 하는 문서 링크와 테스트

다음 기능은 유지한다.

- host 환경에서 Archify 설치 상태를 판별하는 capability probe
- Archify 사용 가능·불가·알 수 없음·실패를 구분하는 정직한 상태 계약
- 플러그인 스킬에서 Archify가 적합할 때 선택적으로 라우팅하고, 사용할 수 없으면 Skillstead 또는 텍스트 구조로 폴백하는 기능
- 기존 capability probe의 보안 경계와 관련 테스트

유지 대상은 새 도식을 생성하는 계층이 아니다. 실행 가능성만 판별하는 독립 기반 기능이다.

### 3.2 도식 수량 원칙

도식 수는 구현 전에 고정하지 않는다. 문서 분석 카탈로그가 유일한 source of truth다.

- 한 문서에는 기본적으로 primary diagram을 최대 1개 둔다.
- 서로 완전히 다른 두 질문을 답해야 할 때만 secondary diagram을 최대 1개 추가한다.
- 동일 질문을 Skillstead 도식이 이미 충분히 설명하면 Archify 항목은 제외한다.
- 도식이 없는 문서도 정상 결과다. 제외 이유를 카탈로그에 남긴다.
- 수량 증가는 품질 지표가 아니며, 근거 없는 수량 확대는 회귀로 취급한다.

### 3.3 독립 저작 원칙

각 JSON spec은 담당자가 해당 문서와 section을 읽은 후 새로 작성한다.

- 새로운 stable ID, 문서 고유 용어, 관계, layout을 사용한다.
- Archify example은 field shape를 이해하는 용도로만 사용한다.
- 다른 최종 spec은 복사 템플릿으로 사용하지 않는다.
- 공통 builder는 spec을 읽고 검증·전달·비교할 수만 있다.
- 공통 builder에 node, edge, lane, state, message 생성 함수가 존재하면 실패다.
- 자동 route가 기본이며, 진단 전에는 `via`, `channelX`, `channelY`, `labelAt`을 넣지 않는다.
- 진단 기반 geometry repair는 한 번에 하나의 통제만 적용한다.

## 4. 대상 판별과 도식 유형 선택

### 4.1 Archify 후보가 되는 조건

다음 중 하나 이상을 만족하고 Markdown 표나 Skillstead보다 관계 이해가 명확해지는 경우에만 후보로 선택한다.

- 세 단계 이상의 종속 과정이 있다.
- 두 역할 이상의 책임, 인계 또는 승인 경계가 있다.
- 분기, 실패, 보류, 재개, 반복 또는 복구 루프가 있다.
- 문서, evidence, image, export 등의 artifact가 변환되거나 관리 주체가 바뀐다.
- 여러 시스템, 플러그인, agent, skill, 문서 사이의 구조 관계가 있다.
- 시간 순서와 반환 또는 비동기 상호작용이 핵심이다.
- 상태 변화가 결과 판단에 핵심이다.

다음은 제외한다.

- 단순 기능 목록
- 한 단계 호출 또는 한 방향 링크
- 표나 짧은 문단이 더 명확한 내용
- source evidence가 부족해 관계를 추론해야 하는 내용
- 이미 존재하는 Skillstead 도식과 같은 질문을 반복하는 내용
- 도식을 넣어도 사용자의 결정이나 이해가 개선되지 않는 내용

### 4.2 유형 라우팅

| 유형 | 선택 질문 | 주요 근거 |
| --- | --- | --- |
| `architecture` | 어떤 구성 요소가 어떤 경계와 책임을 갖고 연결되는가 | plugin, agent, skill, 문서, 외부 도구, trust·ownership boundary |
| `workflow` | 어떤 작업과 승인 게이트를 어떤 순서로 통과하는가 | 역할별 단계, 분기, 검토, 실패·재개 runbook |
| `sequence` | 시간 순서상 누가 누구를 호출하고 무엇을 돌려주는가 | agent·tool·API call chain, async, return, handoff |
| `dataflow` | 어떤 artifact 또는 evidence가 어떻게 변환·분류·전달되는가 | 입력, 산출물, custody, export, lineage |
| `lifecycle` | 초안부터 검토·보류·승인·완료까지 상태가 어떻게 변하는가 | 상태, event, retry, waiting, terminal transition |

애매하면 Archify `guide` 결과를 구조 참고로만 사용한다. 사실 관계는 문서 근거에서만 가져온다.

### 4.3 primary와 secondary

- primary는 해당 문서에서 가장 중요한 한 질문을 답한다.
- secondary는 primary와 관계 유형이 실제로 직교할 때만 허용한다.
- 예: primary가 플러그인 architecture이고 secondary가 이미지 승인 lifecycle이면 허용할 수 있다.
- 같은 workflow를 상세도만 바꾼 두 도식은 허용하지 않는다.
- catalog는 secondary가 필요한 이유와 primary로 통합하지 않은 이유를 요구한다.

## 5. 새 저장소 구조와 책임 경계

```text
guides/archify-diagrams/
├── catalog.json
├── specs/
│   ├── studio/
│   ├── career/
│   └── suite/
└── visual-qa/
    ├── manifest.json
    ├── renders/
    └── contact-sheets/

guides/assets/archify/
├── studio/
├── career/
└── suite/

tooling/
├── build-curated-archify.mjs
└── lib/
    └── archify-delivery.mjs
```

### 5.1 `catalog.json`

문서 분석 결과와 발행 상태를 관리한다. 선택 항목과 제외 항목을 모두 포함하며 수량 목표를 포함하지 않는다.

각 항목은 최소한 다음 정보를 가진다.

```json
{
  "id": "stable-diagram-id",
  "product": "studio|career|suite",
  "source_document": "guides/...md",
  "source_section": "정확한 제목 또는 anchor",
  "source_digest": "sha256",
  "question": "이 도식이 답하는 한 문장 질문",
  "decision": "selected|excluded",
  "decision_reason": "선택 또는 제외 근거",
  "diagram_type": "architecture|workflow|sequence|dataflow|lifecycle|null",
  "priority": "primary|secondary|null",
  "spec": "guides/archify-diagrams/specs/...json|null",
  "html": "guides/assets/archify/...html|null",
  "delivery_status": "not-applicable|planned|spec-authored|auto-validated|blocked-schema|blocked-validation|blocked-visual|stale-source|passed|published",
  "visual_review": "pending|passed|failed|stale-source|not-applicable",
  "reviewer": "검수 주체 또는 null"
}
```

규칙은 다음과 같다.

- `selected`는 type, priority, spec, html이 모두 필요하다.
- `excluded`는 구체적인 reason, `delivery_status: not-applicable`, `visual_review: not-applicable`이 필요하다.
- source 문서 또는 section이 바뀌면 digest가 달라지고 `delivery_status`와 `visual_review`는 `stale-source`가 된다.
- `delivery_status: passed|published`이면서 `visual_review: passed`인 항목만 발행 집합에 들어갈 수 있다.
- blocked 항목은 선택 근거와 실패 증거를 보존하지만 발행 집합에는 들어가지 않는다.
- 상태 전이는 `planned → spec-authored → auto-validated → passed → published`가 정상 경로다. blocked와 stale 상태에서 정상 경로로 돌아가려면 원인을 고친 뒤 validation과 visual review를 다시 수행한다.

분석 대상 문서는 catalog 최상위 `scan_roots`와 `scan_excludes`로 고정한다. 초기 범위는 다음과 같다.

- 루트 `README.md`
- `guides/**/*.md`
- `products/game-design-studio/**/*.md`
- `products/game-design-career/**/*.md`
- `plugins/game-design-studio/**/*.md`
- `plugins/game-design-career/**/*.md`

generated asset, vendor, cache, worktree metadata는 제외한다. 파일을 임의로 건너뛰지 않으며, 각 대상 문서는 최소 하나의 selected 또는 excluded 분석 기록을 가져야 한다.

### 5.2 `specs/`

최종 Archify JSON의 저작 원본이다.

- 파일 하나가 질문 하나를 답한다.
- spec은 `meta.quality_profile: "showcase"`를 사용한다.
- 해당 type schema, common schema, 가장 가까운 example을 확인한 뒤 작성한다.
- 최대 12개의 primary node를 기본 상한으로 삼는다.
- main path는 하나가 명확해야 하며 branch는 가장 가까운 main node에서 나간다.
- lifecycle의 회복 가능한 failure는 active 상태로 돌아가는 실제 transition을 가져야 한다.
- spec 바이트는 최종 validation 성공 후 freeze된다.

### 5.3 `archify-delivery.mjs`

이 모듈은 생성기가 아니라 검증·전달 경계다.

허용 책임:

- catalog와 spec의 1:1 정합성 검사
- source document, section, digest 검사
- 설치된 Archify CLI identity 고정 및 실행 가능성 판별
- 각 spec에 대해 validate와 deliver 실행
- showcase 9/9, 0 errors, 0 warnings receipt 검사
- specification·artifact digest와 bytes 검사
- 임시 디렉터리에서 검증 후 managed output을 원자적으로 게시
- `--check`에서 source, spec, HTML, receipt, QA manifest drift 검사
- 기존 capability probe의 상태를 소비하고 정직한 폴백 상태를 보고

금지 책임:

- node, lane, edge, card, state, transition, participant, message 생성
- 모든 spec에 공통 topology 삽입
- 문서 제목이나 prompt ID만 바꿔 spec 복제
- 자동 correction을 이유로 여러 geometry control 동시 추가
- 시각 검수 없이 `passed` 기록

### 5.4 `build-curated-archify.mjs`

명시적 spec 집합을 순회하는 얇은 CLI entrypoint다.

- 기본 모드: selected spec을 검증하고 임시 결과를 만든다.
- `--check`: committed 결과와 새 검증 결과의 byte·receipt·QA 상태를 비교한다.
- `--publish`: 모든 selected 항목이 `passed` 또는 명시적 blocked 상태로 해소되고, 발행 집합의 모든 항목이 자동 검증과 시각 검수를 통과한 경우에만 passed 집합으로 전체 managed tree를 원자 교체한다.
- `--open`은 제공하지 않는다.
- 일부 성공만으로 기존 trusted tree를 바꾸지 않는다.

### 5.5 `visual-qa/`

자동 receipt와 별개인 인간 시각 검수 증거다.

- `renders/`: default READ, light, dark, guided view의 실제 렌더 캡처
- `contact-sheets/`: product별, type별, 전체 비교 시트
- `manifest.json`: 검사 항목, 결과, correction round, 렌더 digest, 검수자 기록

개별 렌더는 원본 판독이 가능한 해상도를 사용한다. contact sheet만 보고 세부 판독을 완료했다고 기록하지 않는다.

## 6. 제품별 시각 문법

제품 문법은 모든 도식을 같은 모양으로 만드는 템플릿이 아니다. 사용자가 어느 제품의 도식을 보고 있는지 인지하게 하는 구성 원칙이며, 실제 source 관계가 우선한다. 색·variant·legend 같은 표현은 선택한 Archify schema가 지원하는 필드만 사용한다.

### 6.1 Studio

Studio는 게임 제작 의사결정과 시스템 연결을 강조한다.

- architecture와 dataflow에서는 시스템·콘텐츠·UX·경제·제작·검증 경계를 명확히 분리한다.
- workflow에서는 기획 → 검토 → 제작 가능성 확인 → 플레이테스트 → 수정의 운영 흐름을 우선한다.
- artifact의 변환과 ownership을 명시한다.
- main path는 대체로 좌→우 진행을 사용하되, 실제 분기와 반복은 외곽 경로로 분리한다.
- 단순 직선 흐름으로 환원할 수 없는 상호작용은 architecture, dataflow, lifecycle 중 적절한 유형으로 표현한다.

### 6.2 Career

Career는 학습, 증거 축적, 멘토 검토, 채용 준비의 진행과 판단 경계를 강조한다.

- workflow와 lifecycle에서는 준비 → 증거 생성 → 사람 피드백 → 보류·보완 → 승인·다음 목표를 구분한다.
- 답안 대행이나 자동 합격 판단이 아니라 사람 승인 경계를 실제 topology로 표현한다.
- 포트폴리오 artifact와 공개 가능 evidence의 custody를 구분한다.
- milestone, review gate, hold, resume가 핵심이면 상태 또는 단계 구조에 드러나야 한다.
- 채용 결과를 보장하지 않는 경계는 설명 카드만이 아니라 흐름이나 상태의 실제 의미로 반영한다.

### 6.3 Suite

Suite는 Studio 결과가 Career evidence로 이동하거나 두 플러그인이 협업하는 경계를 표현한다.

- 서로 다른 제품 책임을 boundary로 분리한다.
- handoff artifact와 승인 주체를 명시한다.
- Studio와 Career의 개별 도식을 합친 거대 도식을 만들지 않는다.
- suite 도식은 양쪽을 함께 봐야만 답할 수 있는 질문이 있을 때만 만든다.

## 7. 문서 분석과 저작 흐름

### 7.1 1단계: 기존 계층 제거

기존 Task 13 파일과 스크립트, 테스트, 링크를 제거한다. 이 커밋에는 새 HTML을 넣지 않는다. 제거 후 테스트는 기존 경로가 남아 있지 않고 capability probe가 유지되는지 확인한다.

### 7.2 2단계: 문서 분석 카탈로그 작성

Studio, Career, suite 관련 README, guide, use-case, prompt template 문서를 읽고 다음 순서로 기록한다.

1. 문서가 답하는 사용자 질문을 찾는다.
2. 관계 이해가 필요한 section을 식별한다.
3. Markdown, Skillstead, Archify 중 가장 적합한 표현을 선택한다.
4. Archify 후보면 type과 primary·secondary를 결정한다.
5. 제외면 왜 도식이 필요하지 않은지 기록한다.
6. 정확한 문서 경로, section, digest를 고정한다.

이 단계의 산출물은 `catalog.json`뿐이다. HTML을 만들지 않는다. 따라서 문서 분석 결정 자체를 별도로 검토할 수 있다.

### 7.3 3단계: spec 개별 저작

selected 항목마다 다음 절차를 반복한다.

1. source document와 section을 다시 읽는다.
2. 해당 type schema, common schema, 가장 가까운 example 하나만 읽는다.
3. 새 spec을 먼저 작성한다.
4. Archify `validate`를 실행한다.
5. 실패하면 diagnostic의 subject, evidence, supported fixes 중 하나만 반영한다.
6. best error count가 두 번 연속 개선되지 않으면 중단하고 `blocked-validation`으로 기록한다.
7. validation이 성공하면 `deliver`로 HTML과 receipt를 만든다.
8. 성공한 spec은 freeze하고, 이후 수정 시 validation과 delivery를 처음부터 다시 실행한다.

### 7.4 4단계: 중복 검사

각 spec에서 의미를 제거한 structural signature를 계산한다.

- diagram type
- primary node 또는 state 수
- lane, boundary, participant, stage 수
- node kind·variant 분포
- directed degree sequence
- branch, merge, cycle, retry, hold·resume 구조
- main-path length
- relationship kind 분포
- layout band·grid의 상대적 패턴

같은 signature가 나오면 자동 실패로 단정하지 않고 다음을 확인한다.

- source가 동일한 실제 공통 프로세스를 설명하는가
- 질문이 달라도 같은 구조를 갖는 것이 근거상 필연적인가
- label만 바뀐 사실상 복제인가

예외는 catalog에 `shared_process_reason`과 비교 대상 ID를 기록해야 한다. 근거 없는 동일 signature는 실패다.

### 7.5 5단계: 전수 시각 검수

각 도식에 대해 headless 방식으로 다음 화면을 실제 렌더한다.

- default READ view
- light theme
- dark theme
- 모든 guided view
- 원본 크기 세부 캡처

검수 항목:

- 텍스트 clipping, 비정상 압축·확장, blur, tofu
- node 내부 제목·본문·badge 겹침
- edge가 무관한 opaque node를 통과하는지
- edge·label·mask 충돌과 모호한 shared corridor
- branch, merge, retry, hold, resume가 실제로 판독되는지
- label이 의미 없는 장식인지
- rail, legend, footer, cards가 읽히는지
- dark·light theme 모두 대비가 충분한지
- focus, search, guided view가 질문을 이해하는 데 도움이 되는지
- 같은 제품과 같은 type의 다른 도식과 과도하게 닮지 않았는지
- Studio와 Career의 제품 문법이 구별되는지

모든 개별 이미지를 원본 크기로 검사한 뒤 product·type·global contact sheet에서 전체 다양성을 다시 검사한다.

### 7.6 6단계: 수정과 발행

- 시각 결함이 있으면 구체적인 defect와 affected subject를 기록한다.
- focused correction은 최대 두 round까지만 허용한다.
- 수정할 때마다 validate와 deliver를 다시 실행한다.
- 두 round 후에도 실패하면 `blocked-visual`로 남기고 발행하지 않는다.
- 모든 selected 항목이 passed 또는 명시적 blocked 상태로 정리된 후, passed 항목만 발행하고 문서에 링크한다. blocked 항목은 성공 수량에서 제외하고 최종 보고에 명시한다.
- managed output tree는 전체 검증이 끝난 한 번의 원자적 publication으로 교체한다.

## 8. 오류와 상태 계약

| 상태 | 의미 | 문서 노출 |
| --- | --- | --- |
| `excluded-insufficient-evidence` | 관계를 뒷받침할 source가 부족함 | Archify 링크 금지 |
| `excluded-better-as-text` | 표·목록·문단이 더 명확함 | Archify 링크 금지 |
| `excluded-skillstead-overlap` | Skillstead가 같은 질문을 이미 충족함 | 기존 Skillstead만 유지 |
| `blocked-schema` | 선택한 type schema로 사실을 정직하게 표현할 수 없음 | 완료 링크 금지 |
| `blocked-validation` | 두 focused repair 후에도 showcase 검증 실패 | 완료 링크 금지 |
| `blocked-visual` | 두 focused correction 후에도 실제 렌더 결함 존재 | 완료 링크 금지 |
| `stale-source` | source document 또는 section digest 변경 | 기존 링크를 완료 상태로 취급 금지 |
| `passed` | 자동 검증과 전수 시각 검수 모두 통과 | 링크 허용 |

추가 규칙:

- Archify가 설치되지 않았으면 capability는 `unavailable`을 반환한다. Skillstead나 텍스트 폴백을 사용할 수 있지만 Archify 결과라고 표시하지 않는다.
- Archify 상태를 확인할 수 없으면 `unknown`, 실행 자체가 실패하면 `failed`로 구분한다.
- 일부 항목 실패를 전체 성공으로 숨기지 않는다.
- visual review는 자동 receipt에 포함되지 않으며 별도 manifest가 유일한 근거다.
- rollback이 실패하면 원본 오류와 복구 오류를 모두 보존하고 forensic backup을 남긴다.

## 9. 검증 설계

### 9.1 제거 회귀 테스트

- 기존 Task 13 builder, library, unit test, npm script가 존재하지 않는다.
- 기존 50개 artifact와 manifest가 존재하지 않는다.
- 기존 경로를 가리키는 Markdown 링크가 없다.
- capability probe와 제품별 선택 라우팅 계약은 계속 통과한다.

### 9.2 catalog 계약 테스트

- 모든 source document가 repository 내부 regular file이다.
- source section이 실제 Markdown heading 또는 명시 anchor와 일치한다.
- source digest가 현재 bytes와 일치한다.
- selected와 excluded의 필수 field가 정확히 다르다.
- 한 문서의 primary는 최대 1개, secondary는 최대 1개다.
- secondary에는 직교 질문과 분리 이유가 있다.
- scan root의 모든 대상 Markdown은 selected 또는 excluded 분석 기록을 가진다.
- delivery status 전이가 허용 순서를 벗어나지 않는다.
- passed가 아닌 항목은 production guide 링크 대상이 아니다.

### 9.3 topology 비생성 계약

- delivery library에 type별 node·edge 생성기가 없다.
- builder fixture가 spec을 주지 않으면 topology를 만들어 성공할 수 없다.
- spec의 topology는 committed JSON bytes에서만 온다.
- catalog label이나 prompt ID를 바꿔도 spec 구조가 자동으로 만들어지지 않는다.

### 9.4 type·schema 계약

- 각 selected spec은 catalog의 diagram type과 실제 schema가 일치한다.
- exact `meta.quality_profile: "showcase"`가 있다.
- schema가 허용하지 않는 field가 없다.
- lifecycle의 recoverable failure는 active state 복귀 transition을 가진다.
- architecture, workflow, dataflow, lifecycle의 endpoint와 route invariant를 검사한다.

### 9.5 중복 방지 계약

- selected spec 전체의 structural signature를 계산한다.
- 동일 signature는 `shared_process_reason` 없이 실패한다.
- 비교 대상이 없는 예외, 빈 이유, source 근거 없는 이유는 실패한다.
- label만 변경한 spec mutation은 중복으로 검출한다.
- Studio와 Career에서 동일 template topology를 대량 복제하는 mutation은 실패한다.

### 9.6 delivery 계약

- 실제 Archify receipt는 schemaVersion, command, type, quality, 9 checks, composition profile·status를 fail-closed로 검사한다.
- errors와 warnings는 각각 0이어야 한다.
- specification·artifact의 digest와 byte count가 실제 파일과 일치한다.
- persisted receipt는 exact allowlist만 저장하고 절대 경로, file URI, Windows path, traversal, 임시 경로를 포함하지 않는다.
- CLI inode, realpath, size, hash identity는 validate와 deliver 경계에서 고정한다.
- stage parent, spec, output의 symlink·swap-and-restore를 거부한다.
- build와 check는 동일 bytes를 재현한다.
- managed output의 stale extra file을 검출한다.
- browser opener는 호출되지 않는다.

### 9.7 visual QA 계약

- passed 항목마다 default READ, light, dark, guided view 렌더가 존재한다.
- render digest와 dimensions가 manifest와 일치한다.
- correction round는 0, 1, 2 중 하나다.
- `passed`는 모든 검사 항목과 검수자 기록이 있을 때만 허용한다.
- contact sheet는 product별, type별, 전체 세 종류가 최신이다.
- failed 또는 stale 항목을 passed로 바꾸는 mutation은 거부한다.
- 모든 selected 항목을 전수한 count가 catalog와 일치한다.

### 9.8 최종 검증 순서

1. 제거 회귀 테스트
2. catalog·source evidence 검사
3. spec schema와 structural signature 검사
4. 개별 Archify validate·deliver
5. receipt·digest·determinism 검사
6. headless 전수 시각 검수와 QA manifest 검사
7. production guide link 검사
8. repository 전체 lint, unit, contract, product test
9. clean rebuild 후 `--check`
10. `git diff --check`와 managed tree exact-set 검사

## 10. 구현 단계와 커밋 경계

### 단계 A — 기존 Task 13 제거

- 기존 artifact, manifest, builder, library, tests, npm scripts, dead links 제거
- capability probe 유지 확인
- 제거 회귀 테스트 추가
- 새 HTML 없음

### 단계 B — 분석 카탈로그

- 전체 대상 문서 목록화
- selected·excluded 결정과 source evidence 기록
- catalog contract tests
- 카탈로그 자체 검토

### 단계 C — 전달 기반 재구축

- topology를 생성하지 않는 delivery library와 thin CLI 구현
- identity, receipt, atomic publication, rollback, deterministic check 계약 복원
- 기존 구현 파일을 복사하지 않고 승인된 책임만 새로 작성

### 단계 D — spec 독립 저작

- product와 type 단위의 작은 묶음으로 spec 작성
- 묶음마다 schema, validation, duplicate review
- 각 spec은 source question에 대한 독립 검토를 거침

### 단계 E — 전수 시각 QA

- 모든 화면 headless render
- 개별 원본 검사
- product·type·global contact sheet 비교
- 최대 두 correction round
- manifest 확정

### 단계 F — 문서 연결과 전체 검증

- passed 도식만 관련 가이드에 연결
- 도식이 답하는 질문과 유형을 링크 주변에 설명
- 전체 테스트와 clean rebuild
- 독립 code review와 visual review에서 Important 이상 0건 확인

각 단계는 별도 검토 가능한 커밋으로 유지한다. 기존 Task 13 제거와 새 산출물 생성은 같은 커밋에 섞지 않는다.

## 11. 완료 조건과 중단 조건

### 11.1 완료 조건

- 기존 Task 13 계층이 완전히 제거되어 있다.
- 새 catalog의 모든 scan 대상 문서에 selected 또는 excluded 결정이 있다.
- selected spec은 문서 근거와 유형 선택 이유를 가진다.
- builder가 topology를 생성하지 않는다는 테스트가 통과한다.
- 모든 published HTML이 showcase 9/9, errors 0, warnings 0이다.
- 모든 published HTML의 전수 시각 검수가 passed다.
- structural duplicate 예외는 근거와 비교 대상이 명시되어 있다.
- Studio와 Career 도식은 제품 문법이 구별되면서도 문서별 topology가 실제 관계를 반영한다.
- failed, stale, excluded 항목은 완료 링크로 노출되지 않는다.
- blocked 항목은 발행 수량에서 제외되고 최종 검증 보고에 ID와 원인이 남는다.
- 브라우저 자동 열기 없이 모든 검증이 재현된다.
- repository 전체 검증이 통과하고 worktree가 clean하다.

### 11.2 중단 조건

- source 근거 없이 관계를 추론해야 하는 경우 해당 항목을 제외한다.
- 두 번의 focused validation repair 후 best error count가 개선되지 않으면 해당 항목을 중단한다.
- 두 번의 focused visual correction 후 결함이 남으면 해당 항목을 중단한다.
- Archify 스키마로 정직하게 표현할 수 없으면 다른 유형을 한 번 재평가하고, 그래도 불가능하면 제외한다.
- 일부 실패 항목 때문에 전체 trusted output을 손상시킬 위험이 있으면 publication을 중단하고 기존 trusted tree를 보존한다.

## 12. 승인된 핵심 원칙 요약

- 기존 50개 Archify 결과는 모두 제거한다.
- 도식 개수는 문서 분석 결과로 정하며 목표 수량을 두지 않는다.
- 문서당 primary 1개, 필요할 때만 직교 secondary 1개를 허용한다.
- JSON spec은 문서 근거를 읽고 모두 개별 저작한다.
- builder는 topology를 만들지 않는다.
- Studio와 Career는 서로 다른 시각 문법을 사용한다.
- 실제 관계에 따라 architecture, workflow, sequence, dataflow, lifecycle을 선택한다.
- 자동 검증과 전수 시각 검수 둘 다 통과해야 완료다.
- 시각 검수는 모든 도식과 모든 주요 보기에서 수행한다.
- 최대 두 번의 focused correction 이후에도 결함이 남으면 실패 상태로 보류한다.
- 설치된 Archify 스킬과 공식 schema·example·delivery 계약을 따르며 브라우저를 자동으로 열지 않는다.
