# 프롬프트 템플릿·실행 도식 라이브러리 설계

## 배경

Game Design Plugin Suite에는 Game Design Studio와 Game Design Career의 상세 가이드, 36개 활용 사례, 30개 직접 스킬 사례, 72쌍의 기존 Skillstead SVG·PNG가 있다. 개별 문서 안에는 App·CLI 요청문도 다수 존재한다. 그러나 사용자가 루트 README나 제품 README에서 다음 정보를 한 묶음으로 찾기는 어렵다.

- 그대로 복사해 실행할 수 있는 프롬프트
- 자신의 상황에 맞게 바꿀 자리표시자
- 요청이 호출하는 스킬과 전문 역할
- 입력에서 중간 Artifact와 최종 결과물로 가는 흐름
- 예상 파일과 읽는 순서
- 사람 검토·승인 경계
- 실패하거나 보류됐을 때의 재개 요청문

또한 일부 가이드는 여러 결과 계약을 한 문단이나 긴 표 셀에 이어 붙여 의미 경계를 파악하기 어렵다. 대표 사례는 `최소 결과`, `선택 결과`, `확장 결과`, `승인 주체`, `보류 대상`, `재개 조건`, `안전 경계`가 한 문단에 연속으로 적힌 사용자 경로 문서다.

이 설계는 기존 사례와 스킬 계약을 폐기하지 않는다. 구조화된 프롬프트 카탈로그를 기준 원천으로 추가하고, README·스킬 가이드·사례 문서가 목적에 맞는 깊이로 이를 보여 주도록 연결한다.

## 조사 결과

- 최신 문서 브랜치에는 Markdown 가이드 79개가 있다.
- Studio와 Career는 각각 제품 스킬 14개와 번들 Skillstead `svg-infographic` 1개를 제공한다. 두 제품을 합치면 직접 사용할 수 있는 스킬은 30개다.
- 기존 활용 사례는 36개이고 직접 스킬 사례는 30개다.
- 프롬프트 문자열 수는 충분하지만 README에서 템플릿, 실행 흐름, 결과물과 도식이 하나의 실행 카드로 연결되지 않는다.
- Archify 2.13.0은 로컬에 설치되어 있고 `doctor`의 Node, schema, renderer, preview, safety 검사가 모두 통과했다.
- Skillstead `svg-infographic` 0.8.3은 사용자 환경과 두 플러그인 배포물에 모두 존재한다.
- Archify는 MIT, 번들 Skillstead는 Apache-2.0 라이선스다.
- Archify는 5.8MB의 선택적 외부 스킬이다. 두 제품에 복제하지 않고 설치 감지 방식으로 연동하는 편이 제품 격리와 배포 크기에 유리하다.

## 목표

1. 두 플러그인의 30개 스킬 모두에 입문·표준·고급 프롬프트 템플릿을 제공한다.
2. App와 CLI에서 바로 복사할 수 있는 실행문을 제공한다.
3. 각 템플릿에서 입력, 스킬 체인, 전문 역할, 중간 결과, 최종 결과, 검토 경계와 재개 요청을 연결한다.
4. 스킬 실행 흐름과 아키텍처는 Archify로, 일반 설명형 인포그래픽은 Skillstead로 시각화한다.
5. 루트 README, 제품 README, 스킬 가이드와 사례집이 같은 기준 원천에서 일관된 정보를 보여 준다.
6. 긴 문단과 과밀한 표를 의미별 목록과 카드로 정리한다.
7. 기존 Canonical Artifact, 이미지 생성, 내보내기, 사람 승인과 fail-closed 계약을 유지한다.

## 비목표

- 게임의 재미, 시장성, 성과, 채용 또는 합격을 보장하지 않는다.
- Archify 전체 패키지를 두 플러그인에 복제하지 않는다.
- 생성 이미지·도식·문서를 자동 승인하지 않는다.
- 기존 36개 활용 사례와 30개 스킬 가이드를 별도 체계로 교체하지 않는다.
- README에 전체 146개 사례를 모두 펼쳐 문서를 다시 과밀하게 만들지 않는다.
- 단순 목록까지 무조건 도식화하지 않는다.
- Canonical Artifact의 내용 기준인 `content.md`를 파생 문서나 이미지로 대체하지 않는다.

## 사용자와 성공 기준

주 사용자는 게임 기획을 배우는 학생과 취업 준비생이다. 솔로·인디 기획자, 현업 기획자, 팀 리드, 교육자와 멘토도 포함한다.

완료 후 사용자는 다음 질문에 README와 연결된 가이드만으로 답할 수 있어야 한다.

- 지금 상황에 맞는 플러그인과 스킬은 무엇인가?
- 10분 실습, 단일 과제, 포트폴리오 또는 전체 프로젝트에 어떤 프롬프트를 쓰는가?
- 어떤 부분을 자신의 정보로 바꾸는가?
- 어떤 스킬과 전문 역할이 어떤 순서로 사용되는가?
- 어떤 파일과 문서가 생기고 무엇부터 읽는가?
- 무엇이 자동 결과이고 무엇이 사람의 결정인가?
- 입력, renderer, 이미지 provider 또는 권한이 부족하면 어떻게 재개하는가?

## 선택한 접근

구조화된 계약 기반 분산형 문서 구조를 사용한다.

- 하나의 프롬프트 카탈로그가 템플릿의 기준 원천이다.
- 루트 README는 가장 많이 쓰는 대표 진입점만 보여 준다.
- 제품 README는 해당 제품의 대표·복합 작업을 보여 준다.
- 개별 스킬 가이드는 입문·표준·고급 템플릿을 모두 보여 준다.
- 별도 프롬프트 라이브러리는 전체 사례를 탐색할 수 있게 한다.
- 생성·검증 스크립트와 계약 테스트가 문서 간 불일치를 막는다.

Markdown을 여러 위치에서 독립적으로 직접 작성하는 방식은 초기 작업은 단순하지만 90개 기본 템플릿, App·CLI 변형과 다수 도식의 drift를 막기 어렵다. 모든 내용을 하나의 거대한 사례집에만 두는 방식은 README에서 즉시 복사해 쓰기 어렵다.

## 정보 아키텍처

### 기준 원천

새 기준 원천은 `guides/prompt-templates/catalog.json`이다. 카탈로그는 사람에게 보여 줄 Markdown을 그대로 저장하지 않고 실행 계약을 구조화해 보존한다.

각 기본 템플릿은 다음 필드를 가진다.

- `id`: 제품·스킬·난이도를 포함하는 안정 ID
- `product`: `studio`, `career`, `suite` 중 하나
- `skill`: 실제 설치된 스킬 ID
- `level`: `beginner`, `standard`, `advanced` 중 하나
- `title`, `purpose`, `audiences`, `intents`
- `when_to_use`, `when_not_to_use`
- `required_inputs`, `optional_inputs`
- `placeholders`
- `app_prompt`, `cli_prompt`
- `skill_chain`, `specialist_roles`
- `intermediate_artifacts`
- `minimum_outputs`, `optional_outputs`, `extended_outputs`
- `expected_file_tree`, `read_order`
- `human_review_boundary`
- `hold_conditions`, `resume_prompt`, `safety_boundary`
- `diagram_binding`
- `related_use_cases`, `related_recipes`, `source_references`

문자열 필드의 자유도를 제한한다. 스킬, 역할, 템플릿, profile, diagram과 artifact ID는 각 canonical registry에 존재해야 한다.

### 사용자 문서

```text
guides/prompt-templates/
├── README.md
├── studio/
│   └── <skill-id>.md
├── career/
│   └── <skill-id>.md
└── suite/
    └── <cross-plugin-case-id>.md
```

`guides/prompt-templates/README.md`는 다음 탐색 축을 제공한다.

- 사용자 유형
- 목표
- 난이도
- 플러그인
- 스킬
- 결과 문서 형식
- 이미지·도식 필요 여부
- 사람 검토 유형

### 기존 문서 연결

- 루트 `README.md`: 설치 뒤 바로 쓰는 대표 프롬프트와 상세 라이브러리 링크
- `guides/README.md`: 학습 경로와 프롬프트 탐색 순서
- 제품 가이드 README: 제품별 고빈도 작업, 스킬 선택과 예상 결과
- 제품 source README: 설치된 플러그인에서 접근 가능한 대표 템플릿과 결과 계약
- 개별 스킬 가이드: 해당 스킬의 세 난이도 템플릿과 도식
- 기존 활용 사례: 상황 설명과 실행 가능한 템플릿 연결
- 기존 레시피: 여러 스킬을 연결하는 end-to-end 프롬프트와 도식

배포 위치인 `plugins/*`는 직접 편집하지 않는다. `products/*/plugin`, `shared/`와 문서 기준 원천에서 suite build를 통해 다시 생성한다.

## 사례 범위

### 기본 스킬 템플릿

30개 스킬 각각에 세 난이도를 제공한다.

- 입문: 입력 1~3개, 단일 스킬, 최소 결과, 질문 중심 검토
- 표준: 관련 스킬 2~4개, Canonical Artifact, evidence·decision·review 포함
- 고급: 오케스트레이터, 전문 역할, 이미지·도식·내보내기, 실패·재개와 사람 승인 포함

기본 템플릿은 90개다. 각 템플릿은 App와 CLI 실행 경로를 모두 제공하므로 실행 경로는 180개다. 각 경로에는 완성 예시와 재사용 템플릿이 하나씩 있어 기본 프롬프트 코드 블록은 360개다.

### 활용 사례와 레시피

- 기존 활용 사례 36개를 실행 가능한 프롬프트 카드로 보강한다.
- Studio 레시피 6개와 Career 레시피 6개를 end-to-end 템플릿으로 정규화한다.
- 두 플러그인을 연결하는 suite 사례 8개를 추가한다.

suite 사례는 다음 범위를 다룬다.

1. Studio 기획서를 Career 포트폴리오 근거로 전달
2. 역기획에서 신규 시스템 제안으로 확장
3. 시스템·UX·경제 기획을 포트폴리오 사례로 묶기
4. GDD에서 이미지 계획·검토·PPTX 발표까지 연결
5. 취업 목표에서 증거 프로젝트·기획서·면접 답변까지 연결
6. 학생 과제에서 멘토 검토와 수정 기록까지 연결
7. 현업 문서에서 공개 가능한 요약과 Career Artifact 분리
8. 실패한 내보내기·이미지 생성 작업 재개

기본 스킬 템플릿, 기존 사례, 레시피와 suite 사례를 합친 문서화 단위는 146개다. 146개 모두 App와 CLI 실행 경로를 제공하므로 실행 경로는 292개다. 각 경로에 완성 예시와 재사용 템플릿을 제공해 기본 프롬프트 코드 블록은 584개가 된다. 사례마다 재개 프롬프트도 하나씩 제공하므로 전체 복사 가능 `text` 블록은 730개다. 중복 문구를 복제하지 않고 카탈로그 ID와 관련 문서 링크로 연결한다.

## 프롬프트 카드 규격

모든 카드의 표시 순서는 같다.

1. 제목과 난이도
2. 사용하는 경우와 사용하지 않는 경우
3. 준비 입력
4. 바꿀 자리표시자
5. 완성된 App 예시
6. App 재사용 템플릿
7. 완성된 CLI 예시
8. CLI 재사용 템플릿
9. 스킬·전문 역할 흐름
10. 중간 결과
11. 최소·선택·확장 결과
12. 예상 파일 트리와 읽는 순서
13. 사람 검토·승인 경계
14. 실패·보류 조건
15. 재개 프롬프트
16. 관련 사례·레시피·템플릿

프롬프트는 항상 독립 `text` 코드 블록에 둔다. 템플릿 자리표시자는 대괄호 문법을 사용한다.

```text
[게임 아이디어]
[대상 플레이어]
[플랫폼]
[현재 문서 경로]
[공개 가능한 근거]
[검토자 역할]
[요청 형식: MD|PDF|DOCX|PPTX]
[IMAGE_GEN_MODE]
```

필수 자리표시자와 선택 자리표시자를 분리한다. 값을 모르면 조작하지 않고 `미정`으로 남긴다는 기본 규칙을 모든 카드에 적용한다. secret, API key, 개인정보, 비공개 회사 자료는 자리표시자 값으로 받지 않는다.

## 도식화 설계

### 도구 선택

Archify는 다음에 사용한다.

- 프롬프트 실행 단계
- 스킬 체인과 전문 역할 구성
- 입력에서 Artifact와 결과물로 가는 data flow
- 조건 분기, 실패와 재개 lifecycle
- Studio와 Career의 handoff architecture

Skillstead는 다음에 사용한다.

- 개념 요약
- 학습 단계 비교
- 체크리스트와 루브릭
- 기획 원칙과 역량 지도
- 일반 문서 인포그래픽
- Markdown용 정적 SVG와 2× PNG

### Archify 연동

Archify는 선택적 외부 capability다.

1. authoring 또는 런타임에서 설치 여부와 `doctor` 결과를 확인한다.
2. 설치되어 있고 요청이 architecture, workflow, sequence, dataflow 또는 lifecycle에 해당하면 Archify를 우선 사용한다.
3. 검증은 `showcase` 품질을 사용한다.
4. 9개 artifact 검사를 모두 실행하고 composition 오류와 경고가 0일 때만 완료로 기록한다.
5. 최종 `deliver`가 만든 receipt, spec SHA-256과 artifact SHA-256을 보존한다.
6. 설치되지 않았거나 검증이 실패하면 이유를 기록하고 Skillstead 정적 도식으로 fallback한다.
7. fallback은 성공한 Archify 결과라고 표시하지 않는다.

두 플러그인은 Archify 전체를 번들하지 않는다. 제품 시각화 스킬과 오케스트레이터가 선택적 capability routing과 fallback을 설명한다.

### 자산 구조

```text
guides/assets/archify/
├── studio/
│   └── <skill-id>/
│       ├── flow.json
│       ├── flow.html
│       ├── beginner.svg
│       ├── beginner.png
│       ├── standard.svg
│       ├── standard.png
│       ├── advanced.svg
│       ├── advanced.png
│       └── receipt.json
├── career/
└── suite/
```

30개 스킬은 각각 입문·표준·고급 경로를 포함하는 Archify 통합 명세와 HTML을 가진다. 각 단계의 프롬프트는 해당 뷰 또는 정적 파생본에 연결된다. 복합 사례는 관계가 독립적일 때 별도 Archify artifact를 가진다.

기존 36개 Skillstead 사례 도식은 학습·개념 설명용으로 유지한다. 같은 사례에서 실행 구조가 필요하면 Archify를 추가한다. 한 단계 요청이나 단순 목록에는 새 도식을 강제하지 않지만 스킬 조합, 분기, 승인 또는 재개가 있으면 도식화한다.

브라우저는 자동으로 열지 않는다. HTML과 정적 자산은 headless 경로로 생성·검증한다.

## 가독성 규칙

전체 Markdown 79개를 의미 구조 기준으로 검사한다.

- 한 문단에 여러 계약이 있으면 의미별 목록으로 분리한다.
- 긴 표 셀에 준비 입력, 절차, 결과와 경계가 섞이면 요약표와 상세 카드로 분리한다.
- 비교가 핵심인 표는 유지한다.
- 프롬프트는 독립 코드 블록으로 분리한다.
- 예상 결과는 파일 목록과 설명 목록으로 나눈다.
- 링크는 목적별 목록으로 묶는다.
- 기존 안정 ID, heading anchor와 내부 링크는 보존한다.
- 목록을 늘리는 것만으로 읽기 쉬워지지 않으면 짧은 문단과 소제목을 사용한다.

`결과와 검토·재개 경계`는 다음 하위 구조로 통일한다.

```text
결과와 검토·재개 경계
├── 결과물
│   ├── 최소 결과
│   ├── 선택 결과
│   └── 확장 결과
├── 사람 검토
│   ├── 승인 주체
│   ├── 보류 대상
│   └── 승인 경계
└── 실패와 재개
    ├── 재개 조건
    ├── 재개 요청
    └── 안전·증거 경계
```

## 생성 흐름

1. 카탈로그 JSON을 schema로 검증한다.
2. skill, agent, template, profile과 artifact registry 참조를 해석한다.
3. README·스킬 가이드·사례집의 관리 구간을 결정론적으로 생성한다.
4. Archify 설치와 상태를 확인한다.
5. Archify source를 validate하고 HTML·정적 자산과 receipt를 만든다.
6. 설명형 도식은 Skillstead로 lint·render한다.
7. Markdown 링크, anchor, alt text와 결과물 경로를 검증한다.
8. source plugin README와 suite distribution snapshot을 다시 빌드한다.
9. 독립 제품 빌드와 suite build의 결정론성을 확인한다.

생성 구간은 안정 marker로 구분하고 사람이 작성한 주변 문맥을 덮어쓰지 않는다. 카탈로그 또는 도식 검증이 실패하면 부분 생성물을 배포 snapshot에 반영하지 않는다.

## 오류 처리와 재개

- 필요한 입력, 스킬, 결과물 또는 검토 경계가 빠지면 해당 카드 생성을 실패시킨다.
- 존재하지 않는 skill, agent, template, profile 또는 diagram ID 참조는 실패다.
- App prompt와 CLI prompt의 의도가 서로 다르면 실패다.
- Archify가 없으면 설치되지 않았다는 사실과 Skillstead fallback을 기록한다.
- Archify 경고가 하나라도 있으면 완료 상태를 기록하지 않는다.
- 도식 생성 실패는 프롬프트와 Markdown 본문을 삭제하지 않는다.
- 이미지·renderer·format capability 실패는 Canonical Artifact를 덮어쓰지 않는다.
- 공개 권한, 개인정보, 제3자 권리 또는 사람 승인 evidence가 없으면 해당 결과를 보류한다.
- 재개 프롬프트는 보존할 파일, 새 입력, 다시 실행할 스킬과 사람이 결정할 항목을 명시한다.

## 테스트 설계

### 카탈로그 계약

- 정확히 30개 스킬이 존재한다.
- 각 스킬은 `beginner`, `standard`, `advanced`를 정확히 한 번 가진다.
- 기본 템플릿은 정확히 90개다.
- 146개 모두 App와 CLI prompt, 입력, 흐름, 결과, 검토와 재개를 가진다.
- 전체 문서화 단위는 146개다.
- ID는 중복되지 않고 정렬과 생성 순서는 결정론적이다.

### 의미 계약

- App plugin 이름과 CLI namespace가 제품에 맞다.
- skill chain은 설치되는 실제 스킬만 참조한다.
- 전문 역할은 해당 제품 registry에 존재한다.
- 결과 artifact와 profile은 실제 canonical catalog에 존재한다.
- 최소·선택·확장 결과가 서로 구분된다.
- 자동 승인 표현이 없다.
- secret, API key, 개인정보와 비공개 자료를 prompt 입력으로 요구하지 않는다.
- 이미지와 도식의 provider·rights·human review 경계를 유지한다.

### 문서 계약

- 루트와 제품 README의 대표 카드가 catalog ID와 일치한다.
- 스킬 가이드마다 세 난이도 카드와 대응 diagram binding이 있다.
- 기존 36개 사례와 12개 레시피가 실행 카드에 연결된다.
- 내부 Markdown 링크와 anchor가 유효하다.
- 프롬프트는 보이는 `text` 코드 블록으로 제공된다.
- 긴 결과 계약은 목록형 하위 구조를 따른다.
- source README와 generated README가 byte 또는 semantic contract 기준으로 일치한다.

### 도식 계약

- Archify `doctor`가 통과한다.
- 최종 Archify artifact는 showcase 9검사, 오류 0, 경고 0이다.
- receipt의 spec·artifact 해시가 현재 파일과 일치한다.
- Markdown fallback SVG·PNG와 alt text가 존재한다.
- Skillstead SVG lint 오류·경고가 0이다.
- Skillstead PNG는 정확한 2× 파생본이며 완결된 파일이다.
- 생성 도식은 두 번 빌드해 byte가 동일하다.

### 전체 검증

- 변경 범위 targeted contract tests
- `npm run validate:guides`
- `npm run check:guide-diagrams`
- `npm run validate`
- `npm test`
- Studio·Career product clean build
- suite build 2회와 manifest·README 결정론성 비교
- `git diff --check`

## 구현 경계

구현은 다음 원천을 우선 편집한다.

- `guides/prompt-templates/`
- `guides/use-cases/`
- `guides/game-design-studio/`
- `guides/game-design-career/`
- `products/game-design-studio/plugin/`
- `products/game-design-career/plugin/`
- `shared/`
- 문서·build·contract 테스트

`plugins/game-design-studio`와 `plugins/game-design-career`는 suite build가 생성한다. 생성 snapshot은 검증 결과로만 변경한다.

## 위험과 완화

### 문서 규모 증가

146개 사례를 모두 README에 펼치면 탐색성이 악화된다. README는 대표 사례만 두고 상세 라이브러리에서 필터형 인덱스를 제공한다.

### 내용 중복과 drift

App·CLI와 여러 README에 같은 내용을 손으로 복제하지 않는다. catalog ID와 생성 구간을 사용하고 mutation test로 잘못된 연결을 검출한다.

### 도식 자산 폭증

스킬마다 하나의 Archify 명세에서 세 단계 뷰와 정적 파생본을 만든다. 의미가 같은 도식을 중복 명세로 만들지 않는다. 복합 관계가 새로 생길 때만 별도 artifact를 추가한다.

### 선택적 외부 스킬 의존

Archify 미설치 상태를 정상적인 capability 부재로 처리한다. Skillstead fallback과 재개 정보를 남기며 Archify 성공으로 가장하지 않는다.

### 기존 문서 계약 파손

안정 ID와 heading anchor를 보존하고 기존 링크·manifest 테스트를 먼저 확장한다. 긴 문단을 목록으로 바꿀 때 의미 토큰과 사람 승인 경계를 회귀 테스트로 고정한다.

## 완료 조건

- 30개 스킬의 입문·표준·고급 템플릿 90개가 존재한다.
- 146개 사례마다 App·CLI 실행 경로, 각 경로의 완성 예시·재사용 템플릿과 재개 프롬프트가 있어 292개 실행 경로와 730개 복사 가능 `text` 블록을 제공한다.
- 기존 사례 36개, 레시피 12개와 suite 사례 8개가 연결된다.
- 각 템플릿은 입력, 스킬·역할 흐름, 중간 결과, 최소·선택·확장 결과, 파일 구조, 사람 검토와 재개 요청을 제공한다.
- Archify가 설치된 환경에서는 스킬 흐름·아키텍처 도식이 검증된 artifact로 생성된다.
- Archify가 없는 환경에서는 Skillstead fallback이 사실대로 작동한다.
- 일반 문서 도식은 Skillstead의 editable SVG와 검증된 2× PNG를 사용한다.
- 사용자 경로의 긴 결과 계약과 같은 과밀 문단이 목록형 구조로 정리된다.
- 루트 README와 제품 README에서 대표 프롬프트와 전체 라이브러리를 쉽게 찾을 수 있다.
- 배포 plugin README가 source와 동기화된다.
- targeted tests, guide·diagram validation, 전체 validate, 전체 test와 결정론적 build가 통과한다.
