# Game Design Plugin 활용 사례·학습 가이드 확장 설계

## 1. 결정 요약

Game Design Plugin Suite의 기존 문서는 설치, 스킬 계약, 템플릿, 이미지, 시각화와 내보내기 절차를 정확하게 설명하지만, 사용자가 자신의 상황에서 출발해 어떤 작업을 할 수 있고 어떤 결과물을 얻게 되는지 이해하기 어렵다. 이 작업은 기존 문서를 대체하지 않고 다음 세 가지 탐색 축을 추가한다.

1. **역량 중심**: 규칙, 루프, 시스템, UX, 콘텐츠, 밸런스, 검토처럼 다른 장르에도 전이되는 게임 기획 역량을 학습한다.
2. **콘셉트 중심**: 장르, 플랫폼, 운영 방식과 목표 직무별 사례에서 같은 역량이 어떻게 달라지는지 비교한다.
3. **스킬 중심**: 결과가 명확한 작은 작업에서는 30개 설치 스킬을 직접 호출해 필요한 결과만 만든다.

문서 계층은 공통 활용 허브, Studio 사례집·FAQ, Career 사례집·FAQ로 분리한다. 루트 README와 제품 README에는 대표 사례, 결과물 미리보기와 상세 가이드 링크를 추가한다. 모든 사례는 입력, 스킬 체인, Canonical Artifact, 사람 검토, 최종 결과, 포트폴리오 또는 실무 활용과 실패 시 재개 경로를 보여 준다.

총 범위는 다음과 같다.

- 사용자 유형별 학습·작업 경로 6개
- Studio 역량 사례 8개와 콘셉트 사례 10개
- Career 역량 사례 8개와 대상 사례 10개
- Studio 15개와 Career 15개 설치 스킬의 직접 활용 사례 30개
- 공통, Studio, Career FAQ 최소 48개
- 각 경로와 사례를 위한 전용 Skillstead SVG 72개와 정확한 2× PNG 72개

기존 12개 목적별 레시피는 36개 복합 사례에 편입해 결과 예시와 고유 도식을 보강한다. 기존 공통·제품 도식 18개는 삭제하지 않고 상위 구조와 전체 프로젝트 흐름에 계속 사용한다.

## 2. 배경과 현재 공백

### 2.1 현재 문서의 강점

현재 저장소에는 다음 사용자 문서가 있다.

- 루트 `README.md`의 제품 선택, 설치, 빠른 시작, 템플릿, 이미지, 내보내기와 제한 안내
- `guides/README.md`의 두 제품 선택과 초보자 읽기 경로
- 제품별 설치, 빠른 시작, workflow, 템플릿, 품질, 이미지, 시각화, 내보내기와 문제 해결 문서
- 제품별 6개 목적별 레시피, 합계 12개
- 설치 스킬 30개 각각의 목적, 입력, App·CLI 요청 예시, 결과 구조, 승인과 재개 계약
- Skillstead SVG·PNG 18쌍과 diagram manifest

이 문서들은 스킬이 무엇을 해야 하는지와 안전 경계를 설명하는 레퍼런스로는 충분하다.

### 2.2 보완할 공백

현재 문서는 다음 질문에 빠르게 답하기 어렵다.

- 기획을 공부하는 학생은 오늘 10분, 한 과제, 한 학기 프로젝트에서 각각 무엇을 요청할 수 있는가?
- 규칙, 핵심 루프, 시스템, UX, 콘텐츠와 경제 설계는 어떤 순서로 배우고 연결하는가?
- 모바일 RPG, 협동 게임, 내러티브 게임과 코지 게임에서 같은 설계 원칙이 어떻게 달라지는가?
- 오케스트레이터를 사용할 때와 전문 스킬 하나를 직접 사용할 때의 차이는 무엇인가?
- 요청 뒤에 어떤 파일, 표, 도식, 이미지 prompt와 내보내기 결과가 생기는가?
- 생성된 결과를 학습 과제, 포트폴리오, 팀 검토와 면접에 어떻게 사용하고 어디까지 검증해야 하는가?
- 사용자가 입력, renderer, 현재 근거 또는 권리를 준비하지 못했을 때 무엇이 보존되고 어떻게 재개하는가?

기존 레시피와 스킬 문서는 개별 기능을 설명하지만, 사용자 유형과 학습 수준을 가로지르는 횡단형 사례 지도, 결과물 카탈로그와 FAQ가 없다. 제품 README의 사용 예시는 정확하지만 짧아서 전체 활용 범위를 대표하지 못한다.

## 3. 목표와 비목표

### 3.1 목표

처음 사용하는 학생이나 기획자가 문서만 보고 다음을 수행할 수 있어야 한다.

1. 자신의 사용자 유형과 현재 수준을 고른다.
2. 역량, 콘셉트 또는 직접 스킬 중 적절한 탐색 방식을 선택한다.
3. 복사 가능한 App 또는 CLI 요청문을 실행한다.
4. 어떤 스킬과 템플릿이 어떤 순서로 사용되는지 이해한다.
5. 최소 결과, 선택 결과와 확장 결과를 구분한다.
6. 생성 파일을 올바른 순서로 읽고 사람 검토가 필요한 지점을 찾는다.
7. 결과를 학습 기록, 포트폴리오, 팀 전달 또는 다음 기획 단계로 연결한다.
8. 실패나 capability 부재가 있어도 보존된 결과로 안전하게 재개한다.

### 3.2 비목표

- 플러그인 runtime 스킬, 에이전트 또는 이미지 provider 동작을 변경하지 않는다.
- 재미, 흥행, 매출, 합격, 채용 가능성 또는 회사 평가를 예측하거나 보장하지 않는다.
- 36개의 완성 프로젝트 폴더를 복제해 저장소를 부풀리지 않는다. 사례마다 실제 결과 구조와 대표 내용 예시를 제공한다.
- 공개 회사의 내부 기획서 형식, 문체, 브랜드 스타일이나 비공개 자료를 재현하지 않는다.
- 생성 이미지나 파생 문서를 자동 승인하지 않는다.
- 외부 자료의 공개 예시를 플러그인의 권위 있는 템플릿으로 승격하지 않는다.
- 브라우저 기반 가이드나 인터랙티브 사이트를 추가하지 않는다. Markdown, SVG와 PNG로 완결한다.

## 4. 주요 사용자와 성공 기준

### 4.1 사용자 유형 6개

| ID | 사용자 | 대표 목표 | 권장 시작 |
| --- | --- | --- | --- |
| `AUD-01` | 기획 입문 학생 | 게임 디자인 언어와 작은 실습 습득 | 역량 중심 입문 사례 |
| `AUD-02` | 취업 준비생 | 직무 선택, 역기획, 포트폴리오와 면접 증거 | Career 역량·대상 사례 |
| `AUD-03` | 직무 전환자 | 기존 경험을 기획 증거로 전환하고 공백 검증 | Career 로드맵과 Studio 증거 프로젝트 |
| `AUD-04` | 솔로·인디 개발자 | 제한된 범위에서 제작 가능한 설계와 위험 관리 | Studio 콘셉트·제작 사례 |
| `AUD-05` | 현업 기획자 | 단일 시스템, 콘텐츠, UX, 경제와 검토 작업 가속 | 전문 스킬 직접 호출 |
| `AUD-06` | 팀 리드·교육자·멘토 | 과제, 리뷰 기준, 팀 합의와 피드백 흐름 설계 | 역량 사례와 검토 스킬 |

각 사용자 유형은 한 가지 고정 경로가 아니다. 사용자는 필요에 따라 역량, 콘셉트와 스킬 중심 문서를 오갈 수 있다.

### 4.2 작업 규모 5단계

| 단계 | 범위 | 대표 스킬 조합 | 대표 결과 |
| --- | --- | --- | --- |
| 입문 | 개념 하나와 짧은 관찰·설계 실습 | 전문 스킬 1개 | 규칙표, 루프, UX 흐름, 역할 비교 |
| 기초 | 하나의 기획 문제를 문서화 | 스킬 1~2개 | 기획 브리프, 시스템 명세, 역기획 초안 |
| 응용 | 여러 요소를 연결하고 검토 | 스킬 3~5개 | Canonical Artifact, 도식, 검토·수정 기록 |
| 포트폴리오 | 판단 과정과 검증 증거를 공개 가능한 형태로 구성 | Studio와 Career의 명시적 handoff | 프로젝트 사례, 역기획서, 발표 자료 |
| 전체 프로젝트 | 아이디어부터 검토·이미지·다중 형식 출력까지 통합 | 제품 오케스트레이터 중심 | GDD 또는 Career Artifact와 파생 결과 |

단계는 예상 소요 시간을 보장하지 않는다. 입력의 품질, 프로젝트 범위, 검토 횟수와 renderer capability에 따라 작업량은 달라진다.

### 4.3 성공 기준

- 사용자는 루트 README에서 3회 이내 링크 이동으로 적절한 사례 요청문을 찾을 수 있다.
- 모든 사례는 구체적인 최소 결과와 파일 위치를 명시한다.
- 모든 설치 스킬은 직접 호출하는 것이 유리한 상황, 요청 예시와 결과를 가진다.
- 모든 복합 사례와 단일 스킬 사례는 전용 도식으로 입력에서 결과까지의 흐름을 보여 준다.
- FAQ는 질문마다 실행 가능한 다음 요청문과 관련 사례 링크를 제공한다.
- 사례와 FAQ가 실제 설치 스킬, 템플릿, 이미지 모드와 export 계약을 위반하지 않는다.
- README 요약과 상세 가이드 사이에 링크 단절이나 서로 다른 사실이 없다.

## 5. 조사 근거와 반영 원칙

2026-08-06에 다음 공식 공개 자료를 확인했다.

| 자료 | 확인한 내용 | 문서 반영 |
| --- | --- | --- |
| [Riot Games Game Design Curriculum Guide](https://www.riotgames.com/darkroom/original/193fc45d5c23f82446d55bd283e81140%3Afd98ad9cca9497a87aae831e01471f86/pdf-viewer.pdf) | game feeling, 목표·페이싱, 의미 있는 결정·opposition, 규칙·복잡도, interaction, paper prototype, playtest와 feedback의 입문 학습 구조 | Studio 역량 사례와 학생용 실습·회고 구조 |
| [Unity Learn: Game Design](https://learn.unity.com/pathway/game-development/unit/planning-a-game/tutorial/game-design) | 목표, 규칙·mechanic, challenge, feedback, core loop와 반복 설계 | 일반 기획 문제와 검증 루프 |
| [Unity Learn: Test Your Prototype](https://learn.unity.com/pathway/creative-core/unit/prototyping/tutorial/test-your-prototype-3?version=6.3) | 대상 사용자의 테스트, 피드백, scope 수정과 반복 | 각 사례의 검토·수정·재개 항목 |
| [IGDA Game Education](https://igda.org/sigs/game-education/) | 획일적인 모듈보다 지역, 학습자, 목표와 공동체에 맞는 교육 경로의 필요 | 사용자 유형과 목표별 복수 경로 |
| [Ubisoft Game Design](https://www.ubisoft.com/en-us/company/careers/our-jobs/design-creative-direction/game-design) | 규칙, system, mechanic, economy, difficulty, progression과 player autonomy | Studio 역량 범위의 교차 점검 |
| [Develop at Ubisoft](https://www.ubisoft.com/en-us/company/careers/interns-graduates/develop-at-ubisoft) | design intention과 player experience를 설명하는 pitch, prototype plan, mentorship feedback | 학생 프로젝트와 포트폴리오 전환 사례 |
| [Ubisoft Hiring Process](https://www.ubisoft.com/en-us/company/careers/locations/articles/our-hiring-process) | 관련 프로젝트, prototype, context 설명, quality over quantity | Career 포트폴리오 결과 규격 |
| [Riot Games Portfolio Tips](https://www.riotgames.com/en/news/art-portfolio-tips-internships-study-guide-riot-vol-3) | 관련성, 접근성, 과정, thought process와 선별된 작업 | 포트폴리오 FAQ와 output checklist |
| [Riot Games Interviewing](https://www.riotgames.com/en/work-with-us/interviewing-at-riot) | role-dependent test·portfolio review, 실제 경험에 연결된 답변 | 면접 사례와 경험 발명 금지 |
| [EA Early Careers FAQ](https://www.ea.com/careers/early-careers/faq) | 학교 프로젝트와 포트폴리오도 관심과 역량의 증거가 될 수 있음 | 무경력·학생 FAQ |

이 자료들은 학습·채용 원칙을 확인하는 근거일 뿐, 특정 회사의 프로젝트 양식이나 공식 승인을 뜻하지 않는다. 예시, 템플릿, prompt, 도식과 reference preset은 중립적인 언어와 구조로 작성한다. 사실 주장이 출처에 의존하는 FAQ에는 링크와 확인일을 남기지만, 회사별 양식이나 문체를 복제하지 않는다.

## 6. 정보 구조

### 6.1 새 문서 계층

```text
guides/
├── README.md
├── use-cases/
│   ├── README.md
│   ├── audience-paths.md
│   ├── output-catalog.md
│   └── use-case-manifest.json
├── game-design-studio/
│   ├── README.md
│   ├── use-cases/
│   │   ├── README.md
│   │   ├── competency-paths.md
│   │   ├── concept-scenarios.md
│   │   └── skill-workbench.md
│   ├── faq.md
│   ├── recipes/
│   └── skills/
├── game-design-career/
│   ├── README.md
│   ├── use-cases/
│   │   ├── README.md
│   │   ├── competency-paths.md
│   │   ├── concept-scenarios.md
│   │   └── skill-workbench.md
│   ├── faq.md
│   ├── recipes/
│   └── skills/
└── assets/
    ├── use-cases/audiences/
    ├── game-design-studio/use-cases/
    ├── game-design-studio/skills/
    ├── game-design-career/use-cases/
    └── game-design-career/skills/
```

### 6.2 문서 책임

| 문서 | 책임 | 포함하지 않는 내용 |
| --- | --- | --- |
| `guides/use-cases/README.md` | 사용자 유형과 역량·콘셉트·스킬 탐색 방식 선택 | 개별 사례의 전체 본문 |
| `audience-paths.md` | 6개 사용자군의 시작점, 학습·작업 단계와 handoff | 장르별 세부 설계 |
| `output-catalog.md` | 요청별 최소·선택·확장 결과, 파일과 읽는 순서 | 지원하지 않는 성공 보장 |
| 제품 `competency-paths.md` | 전이 가능한 역량의 초급→고급 사례 | 장르 관습을 정답으로 제시 |
| 제품 `concept-scenarios.md` | 장르·플랫폼·운영 또는 목표 직무별 적용 차이 | 회사 내부 양식과 브랜드 모사 |
| 제품 `skill-workbench.md` | 전문 스킬 직접 선택과 30개 상세 가이드 routing | 스킬 계약의 중복 전문 |
| 제품 `faq.md` | 자주 묻는 질문, 즉시 실행할 요청문과 관련 사례 | 법률·채용 결과의 단정 |
| 기존 `recipes/` | 대표 end-to-end 작업의 상세 실행 | 새로운 병렬 기준 문서 |
| 기존 `skills/` | 각 설치 스킬의 권위 있는 사용자 레퍼런스 | 전체 사용자 여정의 중복 설명 |

### 6.3 중복 방지

- 사례집은 상황과 흐름을 설명하고, 스킬의 정확한 입력·완료·실패 계약은 기존 스킬 가이드에 링크한다.
- skill workbench는 선택표와 간단한 사례를 제공하고, 전체 설명은 기존 30개 스킬 문서를 확장한다.
- 기존 12개 레시피는 36개 복합 사례의 flagship으로 연결한다. 같은 요청문과 결과를 별도 문서에 복사하지 않는다.
- 결과물 이름과 상태는 `use-case-manifest.json`에서 검증한다.
- 제품 README의 사용자 예시는 source-owned `products/<product>/plugin/README.md`에서 편집하고 빌드로 `plugins/<product>/README.md`에 동기화한다.

## 7. 사례 카탈로그

### 7.1 Studio 역량 사례 8개

| ID | 역량 | 대표 작업 | 기존 recipe 연결 |
| --- | --- | --- | --- |
| `ST-C01` | 플레이어 경험과 게임 비전 | 아이디어 한 문장을 대상, 핵심 재미, 원칙과 검증 기준으로 전환 | `new-game-gdd.md` |
| `ST-C02` | 행동·핵심 루프·의미 있는 선택 | player verb, goal, opposition, feedback와 loop 설계 | 신규 |
| `ST-C03` | 규칙·상태·예외·데이터 | 시스템 규칙, 상태 전이, 예외, 변수와 데이터 계약 | `system-feature-spec.md` |
| `ST-C04` | UI/UX·온보딩·접근성 | 첫 입력부터 오류·복구까지의 경험과 접근성 검토 | `ux-accessibility.md` |
| `ST-C05` | 콘텐츠·내러티브·퀘스트·NPC | 콘텐츠 구조, 목표, 분기, 상태와 제작 계약 | `content-quest-design.md` |
| `ST-C06` | 캐릭터·스킬·전투·몬스터 | combat role, skill rule, counterplay, encounter와 readability | 신규 |
| `ST-C07` | 성장·경제·밸런스·LiveOps | source/sink, progression, experiment, guardrail과 rollback | `economy-liveops.md` |
| `ST-C08` | 제작·검토·이미지·출력 | 범위·위험 검토부터 승인된 파생 문서까지 | `production-review-export.md` |

### 7.2 Studio 콘셉트 사례 10개

| ID | 콘셉트 | 강조할 일반 기획 문제 |
| --- | --- | --- |
| `ST-G01` | 모바일 수집형 RPG·라이브서비스 | 성장, 수집 동기, 경제, 반복 콘텐츠, 운영 guardrail |
| `ST-G02` | 캐주얼 퍼즐·방치형 | 짧은 session loop, 난이도 곡선, feedback와 복귀 |
| `ST-G03` | 협동 생존 액션 | 역할 상호의존, 자원 압박, 실패 복구와 griefing 위험 |
| `ST-G04` | 경쟁 PvP 아레나 | counterplay, fairness, 정보 가독성, matchmaking 가정 |
| `ST-G05` | PC·콘솔 액션 로그라이트 | run loop, build diversity, meta progression과 반복 피로 |
| `ST-G06` | 선택형 내러티브 어드벤처 | 선택 가시성, 상태·분기, consequence와 narrative coherence |
| `ST-G07` | 코지 생활 시뮬레이션 | 낮은 압박, 표현·자율성, routine, 접근성과 pacing |
| `ST-G08` | 경영·타이쿤 시뮬레이션 | 경제 모델, feedback delay, 정보 계층과 실패 학습 |
| `ST-G09` | 샌드박스·UGC | 창작 affordance, discovery, moderation 가정과 creator loop |
| `ST-G10` | 교육·사회문제·접근성 중심 게임 | 학습·경험 목표, 대상 맥락, 윤리·접근성 검증 |

장르 사례는 성공 공식을 제공하지 않는다. 같은 역량이 다른 제약과 대상에서 어떻게 달라지는지 보여 주고, 확인되지 않은 시장·매출·retention 수치를 만들지 않는다.

### 7.3 Career 역량 사례 8개

| ID | 역량 | 대표 작업 | 기존 recipe 연결 |
| --- | --- | --- | --- |
| `CA-C01` | 기획 직무와 전문 분야 탐색 | 복수 직무의 업무·교환조건·증거 과제 비교 | `role-learning-roadmap.md` |
| `CA-C02` | 게임 분석 언어와 관찰·추론 분리 | 플레이 관찰을 규칙·루프·UX 언어로 기록 | 신규 |
| `CA-C03` | 현재 채용공고 조사 | 공식 공고에서 반복 요구사항과 표본 경계 추출 | `job-research-gap.md` |
| `CA-C04` | 역량 격차와 학습·증거 계획 | gap을 검토 가능한 1~12주 과제로 전환 | 신규 |
| `CA-C05` | 관찰 기반 역기획 | 사실, 추론, 반례와 검증 방법이 있는 분석서 | `reverse-design.md` |
| `CA-C06` | 창작 기획 포트폴리오 | 문제·판단·구현 연결·검증·회고를 가진 사례 | `portfolio-build-review.md` |
| `CA-C07` | 포트폴리오 검토·수정·발표 | 5축 검토, 최소 수정, 독립적인 발표 스토리 | `interview-preparation.md`의 portfolio handoff |
| `CA-C08` | 면접·주니어 성장·직무 전환 | 근거 연결 답변, 성장 사건과 전환 준비도 | `junior-growth-transition.md` |

`interview-preparation.md`는 `CA-C07`의 포트폴리오 handoff와 `CA-C08`의 면접 실행을 연결한다. 하나의 recipe를 두 번 복제하지 않고 두 사례에서 서로 다른 anchor로 참조한다.

### 7.4 Career 대상 사례 10개

| ID | 대상 | 대표 결과 |
| --- | --- | --- |
| `CA-T01` | 시스템 기획 입문 학생 | 역할 요구, 규칙·상태·예외 증거 과제와 12주 경로 |
| `CA-T02` | 콘텐츠·퀘스트 기획 준비생 | content taxonomy, quest spec와 제작 가능성 증거 |
| `CA-T03` | 전투·캐릭터 기획 준비생 | combat analysis, skill spec, counterplay와 test case |
| `CA-T04` | 경제·밸런스·LiveOps 준비생 | economy model, 가정, simulation·experiment 증거 |
| `CA-T05` | UI/UX 기획 준비생 | user flow, state, accessibility와 usability 검증 증거 |
| `CA-T06` | 내러티브 기획 준비생 | narrative state, choice consequence와 collaboration 계약 |
| `CA-T07` | 레벨 디자인 준비생 | 공간 목표, encounter pacing, metrics와 playtest 증거 |
| `CA-T08` | 실무 경험이 없는 신입 | 학교·개인 프로젝트에서 관련 판단과 반복 개선 추출 |
| `CA-T09` | 비전공자·다른 직군 전환자 | 이전 경험의 전이 가능한 역량과 새 증거 project |
| `CA-T10` | 주니어의 성장·이직 | project incident, feedback, ownership와 transition readiness |

### 7.5 설치 스킬 직접 활용 사례 30개

다음 모든 스킬 가이드에 직접 활용 사례와 전용 도식을 추가한다.

**Studio**

- `apply-document-quality-profile`
- `define-game-vision`
- `design-game-content`
- `design-game-economy-and-liveops`
- `design-game-systems`
- `design-player-experience`
- `export-game-design-documents`
- `generate-image-assets`
- `orchestrate-game-design-project`
- `plan-game-production`
- `plan-image-assets`
- `review-game-design`
- `review-image-assets`
- `visualize-game-design`
- `svg-infographic`

**Career**

- `apply-document-quality-profile`
- `build-game-design-portfolio`
- `export-career-documents`
- `generate-image-assets`
- `map-game-design-career`
- `orchestrate-game-design-career`
- `plan-image-assets`
- `plan-junior-growth`
- `practice-game-design-interview`
- `research-game-design-jobs`
- `reverse-engineer-game-design`
- `review-game-design-portfolio`
- `review-image-assets`
- `visualize-career-roadmap`
- `svg-infographic`

각 스킬 가이드는 다음 내용을 추가하거나 기존 섹션을 확장한다.

1. 오케스트레이터 대신 직접 호출하는 것이 좋은 상황
2. 입문, 응용, 고급 요청 예시
3. 입력 부족 시 안전한 요청 예시
4. 생성 파일과 읽는 순서
5. 다음 스킬로 넘기는 조건
6. 직접 호출 흐름을 보여 주는 고유 SVG·PNG

## 8. 사례 카드 계약

### 8.1 필수 섹션

모든 복합 사례는 다음 섹션을 가진다.

1. 사용자와 현재 상황
2. 학습 목표 또는 해결할 기획 문제
3. 적합한 경우와 적합하지 않은 경우
4. 선수 지식과 최소·선택 입력
5. 10분 미니 실습
6. 표준 실습
7. 포트폴리오·실무 확장
8. Codex App 요청문
9. Codex CLI 요청문
10. 스킬·역할·템플릿 체인
11. 중간 결과와 사람 결정 지점
12. 최소·선택·확장 결과
13. 예상 파일 트리와 대표 내용 예시
14. 결과를 읽고 검토하는 순서
15. 포트폴리오 또는 실무 활용
16. 실패·fallback·재개
17. 자기점검과 다음 학습 과제
18. 관련 문서와 전용 도식

### 8.2 공통 흐름

```text
현재 상황과 목표
→ 역량·콘셉트·스킬 진입점 선택
→ 사례의 입력과 요청문 확인
→ 제품 스킬·템플릿 실행
→ Canonical Artifact 생성
→ 전문 검토와 사람 결정
→ 선택적 이미지·Skillstead 도식
→ 필요한 형식의 파생 출력
→ 학습 기록·팀 전달·Career 증거로 활용
```

### 8.3 학생용 학습 요소

모든 역량 사례는 다음 학습 요소를 포함한다.

- **개념 요약**: 이번 사례의 핵심 게임 디자인 용어와 서로 다른 개념의 경계
- **관찰 과제**: 기존 게임에서 확인 가능한 사실만 기록
- **설계 과제**: 관찰을 새 콘셉트와 제약에 적용
- **반례 과제**: 규칙이나 경험이 실패할 조건을 찾기
- **검토 과제**: 생성 결과의 가정, 누락, 모순과 검증되지 않은 주장을 찾기
- **회고 질문**: 선택한 대안, 근거, 포기한 조건과 다음 실험 설명
- **포트폴리오 전환**: 최종 답보다 문제 정의, 판단 과정과 반복 개선을 보여 주기

교육자·멘토 경로는 정답 예시 대신 평가 질문, 피드백 지점과 학생 스스로 설명해야 하는 항목을 제공한다. 학교 과제 사용 시에는 해당 기관의 AI 사용·인용 정책을 먼저 따르도록 안내한다.

## 9. 결과물 카탈로그 계약

### 9.1 결과 수준

| 수준 | 의미 |
| --- | --- |
| 최소 결과 | 외부 renderer나 이미지 provider와 무관하게 Canonical Artifact에 남아야 하는 내용 |
| 선택 결과 | 요청, mode, capability와 사람 선택에 따라 추가되는 prompt, 이미지, SVG·PNG와 파생 문서 |
| 확장 결과 | 검토와 형식별 QA를 통과한 전달용 문서 또는 공개 가능한 Career 증거 |

### 9.2 Studio 대표 결과

- game design brief와 vision pillars
- player verb, core motivation loop와 feedback model
- system specification, rule/state/exception matrix와 data schema
- UI/UX flow, onboarding, accessibility·platform matrix
- narrative, quest, NPC와 content dependency map
- character, skill, combat와 monster specification
- economy source/sink, progression, balance assumption과 LiveOps experiment
- production scope, dependency, risk, owner와 decision/change log
- game design review report와 unresolved decision queue
- image asset plan, prompt package, lifecycle와 approval record
- editable Skillstead SVG와 검증된 2× PNG
- MD와 capability·QA가 확인된 PDF, DOCX, PPTX

### 9.3 Career 대표 결과

- game design role map와 career-stage goal
- job-posting evidence matrix와 sample boundary
- competency matrix와 learning roadmap
- reverse design document와 game analysis report
- portfolio project brief, portfolio backlog와 creative design portfolio
- five-axis review와 minimal-fix queue
- interview question-answer log와 evidence-linked response
- junior growth review와 transition readiness
- proof image plan, prompt package, lifecycle와 approval record
- career roadmap SVG·PNG와 MD·PDF·DOCX·PPTX

### 9.4 결과 예시 규격

각 사례는 전체 완성 Artifact를 복제하지 않고 다음 세 가지를 제공한다.

1. 예상 파일 트리
2. `content.md`에 들어갈 대표 표 또는 짧은 문단
3. 완료 판단에 필요한 checklist와 미해결 항목 예시

예시의 수치, 회사, 성과와 사용자 반응은 사실처럼 발명하지 않는다. 수치가 필요하면 `가정`, `예시`, `검증 필요`를 표시한다.

## 10. Studio와 Career handoff

Studio와 Career의 Canonical Artifact는 합치지 않는다.

```text
Studio Artifact
→ 공개 가능 여부·권리·개인 기여 검토
→ 문제·판단·대안·검증의 최소 evidence summary
→ Career portfolio project brief에 별도 입력
→ Career 검토·발표·면접 증거로 전환
```

handoff에서 다음을 제외한다.

- NDA 또는 회사 비공개 자료
- 팀원의 개인 식별 정보
- 소유권이 불명확한 원본 이미지·게임 화면
- 확인할 수 없는 매출, retention, 일정과 팀 성과
- 자신의 기여로 확인되지 않은 구현과 결정

Career는 Studio 결과의 공개 가능성이나 품질을 자동 승인하지 않는다. 별도의 사람 검토와 증거 기록이 필요하다.

## 11. FAQ 설계

### 11.1 범위

최소 48개 FAQ를 다음처럼 구성한다.

| 문서 | 최소 문항 | 범주 |
| --- | ---: | --- |
| 공통 FAQ | 12 | 제품 선택, 호출, Artifact, 이미지, 도식, export, handoff, 검증과 권리 |
| Studio FAQ | 18 | 학습, 비전, 시스템, 콘텐츠, UX, 경제·LiveOps, 검토, 제작과 출력 |
| Career FAQ | 18 | 직무, 무경력, 채용 조사, 역기획, 포트폴리오, 팀 기여, 면접과 성장 |

공통 FAQ는 `guides/use-cases/README.md`의 FAQ 섹션에 두고, 긴 답변은 해당 제품 `faq.md`에 둔다. 같은 질문을 두 문서에 전문으로 반복하지 않는다.

### 11.2 답변 계약

각 답변은 다음 순서를 따른다.

```text
짧은 결론
→ 이유와 적용 경계
→ 지금 실행할 요청문
→ 예상 결과물
→ 관련 사례·스킬·템플릿
→ 권리·근거·승인 주의사항
```

시점 의존 정보는 확인일과 공식 출처 또는 재검증 방법을 제공한다. 법률, 채용 가능성, 저작권 상태와 회사 평가를 단정하지 않는다.

### 11.3 반드시 포함할 질문

**공통**

- 어떤 플러그인부터 설치해야 하는가?
- 자연어 요청과 직접 스킬 호출은 언제 구분하는가?
- 아이디어 한 문장만 있어도 시작할 수 있는가?
- 전체 기획과 작은 특화 작업 중 무엇을 선택하는가?
- 기존 PDF·PPTX·DOCX·MD를 개선할 수 있는가?
- Canonical Artifact는 왜 필요한가?
- 이미지 prompt만 받거나 실제 생성 여부를 어떻게 고르는가?
- Skillstead 도식과 표는 언제 구분하는가?
- PDF·DOCX·PPTX가 생성되지 않을 때 무엇이 보존되는가?
- Studio 결과를 Career 포트폴리오로 어떻게 넘기는가?
- 학교·회사·팀 비공개 자료를 입력해도 되는가?
- 플러그인의 결과를 어디까지 믿고 어떻게 검증하는가?

**Studio**

- 규칙, mechanic, system과 core loop는 어떻게 다른가?
- 처음부터 긴 GDD를 만들어야 하는가?
- 장르 관습과 핵심 재미를 어떻게 구분하는가?
- 상태·예외·변수와 데이터 표는 언제 필요한가?
- 캐릭터, 스킬, 전투와 monster spec을 어떻게 연결하는가?
- UX flow, feedback와 접근성을 어떻게 함께 검토하는가?
- 경제·밸런스 수치를 어떤 근거 없이 만들지 않으려면 어떻게 하는가?
- LiveOps experiment에서 guardrail과 rollback은 왜 필요한가?
- AI가 재미를 검증할 수 있는가?
- prototype과 playtest 결과를 문서에 어떻게 반영하는가?
- 범위가 너무 큰 기획을 어떻게 줄이는가?
- 이미지와 도식을 실제 게임 resource로 사용해도 되는가?
- GDD와 PPTX는 같은 내용을 그대로 나누면 되는가?
- 기존 기획서를 review skill만으로 검토할 수 있는가?
- 팀에 전달할 때 어떤 결정과 미해결 위험을 남기는가?
- renderer가 없을 때 어떤 결과를 전달할 수 있는가?
- 학생 과제에서 결과를 그대로 제출해도 되는가?
- 서로 다른 장르 사례를 내 아이디어에 어떻게 적용하는가?

**Career**

- 시스템, 콘텐츠, 전투, 경제, UX, 내러티브와 레벨 기획은 어떻게 비교하는가?
- 비전공·무경력자는 무엇부터 증명해야 하는가?
- 학교 프로젝트도 포트폴리오 증거가 되는가?
- 현재 공고가 서로 다를 때 반복 요구를 어떻게 찾는가?
- 적은 공고 표본을 시장 전체처럼 일반화하지 않으려면 어떻게 하는가?
- 역기획에서 관찰, 추론과 추측을 어떻게 분리하는가?
- 플레이 화면을 사용하지 않고도 역기획서를 만들 수 있는가?
- 포트폴리오 문서는 몇 개가 적절한가?
- 최종 결과보다 판단 과정과 반복 개선을 어떻게 보여 주는가?
- 팀 프로젝트에서 개인 기여를 어떻게 증명하는가?
- NDA 프로젝트는 어떻게 다루는가?
- 생성 이미지를 포트폴리오에 어떻게 표시하는가?
- 5축 검토 결과가 낮으면 능력이 없다는 뜻인가?
- 공고에 맞춰 포트폴리오를 어떻게 선별하는가?
- 포트폴리오 근거를 면접 답변에 어떻게 연결하는가?
- 경험이 없는 질문에 어떻게 정직하게 답하는가?
- 주니어 성장 계획에 어떤 evidence와 feedback을 남기는가?
- 플러그인이 합격 가능성을 판단할 수 있는가?

## 12. README 변경 설계

### 12.1 루트 README

현재 설치와 안전 정보를 유지하면서 앞부분에 다음 섹션을 추가한다.

1. 이 플러그인으로 할 수 있는 일
2. 6개 사용자 유형별 추천 시작점
3. 역량·콘셉트·스킬 탐색 방식 비교
4. Studio 대표 사례 6개와 예상 결과
5. Career 대표 사례 6개와 예상 결과
6. 요청별 최소·선택·확장 결과표
7. 입문, 응용, 포트폴리오와 전체 프로젝트 요청 예시
8. 공통 활용 허브, 제품 사례집과 FAQ 링크

루트 README는 사례 전문을 담지 않는다. 독자가 자신의 경로와 첫 요청을 고를 수 있는 범위만 유지한다.

### 12.2 제품 README

source-owned 다음 파일을 편집한다.

- `products/game-design-studio/plugin/README.md`
- `products/game-design-career/plugin/README.md`

각 README에는 다음을 추가한다.

- 가장 잘 활용할 사용자
- 작은 직접 작업과 전체 orchestration의 차이
- 역량별, 콘셉트별, 스킬별 탐색표
- 대표 요청문과 실제 예상 결과
- 전문 스킬을 직접 호출해야 하는 조건
- 결과 파일을 읽고 검토하는 순서
- 사례집, output catalog와 FAQ 링크

기존 설치, 패키지 구조, 스크립트 inventory, 안전 경계, 검증과 라이선스는 삭제하지 않는다. 빌드 뒤 `plugins/game-design-studio/README.md`와 `plugins/game-design-career/README.md`가 source와 일치해야 한다.

### 12.3 가이드 README

- `guides/README.md`에 공통 활용 허브와 결과물 카탈로그를 추가한다.
- 제품 가이드 README에 역량·콘셉트·스킬 진입점과 FAQ를 추가한다.
- 기존 설치→빠른 시작→workflow 경로는 유지한다.
- 초보자는 README에서 대표 사례로, 숙련자는 skill workbench에서 직접 스킬로 이동할 수 있다.

## 13. Skillstead 도식화 설계

### 13.1 수량과 범위

| 범위 | SVG | PNG | 합계 쌍 |
| --- | ---: | ---: | ---: |
| 사용자 유형 경로 | 6 | 6 | 6 |
| Studio 역량·콘셉트 사례 | 18 | 18 | 18 |
| Career 역량·대상 사례 | 18 | 18 | 18 |
| Studio 설치 스킬 | 15 | 15 | 15 |
| Career 설치 스킬 | 15 | 15 | 15 |
| **새 도식 합계** | **72** | **72** | **72** |

기존 SVG·PNG 18쌍은 유지한다. 구현 완료 후 guide asset 전체는 기존 18쌍과 새 72쌍을 포함한다.

### 13.2 시각 문법

| 유형 | 대상 | 필수 의미 |
| --- | --- | --- |
| 학습 경로 | 사용자 유형 | 현재 수준, 연습, feedback, evidence와 다음 수준 |
| 기획 파이프라인 | 역량 사례 | 입력, 전문 스킬, Artifact, 검토와 출력 |
| 의사결정 흐름 | 콘셉트·대상 사례 | 제약, 선택지, 판단 기준, 결정과 검증 |
| 단일 스킬 흐름 | 스킬 사례 | 사용 조건, 필수 입력, 처리, 결과와 다음 스킬 |

도식마다 내용은 고유하지만 다음 시각 의미는 공통이다.

- 입력과 근거
- agent 또는 skill 처리
- Canonical Artifact와 중간 결과
- 사람 결정·승인
- 선택적 이미지·도식·export
- 실패, 보존과 재개

색만으로 상태를 구분하지 않고 label과 shape를 함께 사용한다.

### 13.3 생성·검증 pipeline

```text
use-case manifest와 사례 본문
→ 도식 목적·노드·관계·alt text 정의
→ vendored Skillstead svg-infographic 0.8.3으로 SVG 작성
→ SVG lint
→ Chromium으로 정확한 2× PNG 렌더
→ 크기·overflow·잘림·가독성 검증
→ 문서 삽입과 편집 가능한 SVG 링크
→ diagram manifest 갱신
```

모든 SVG는 다음을 만족해야 한다.

- 루트 바로 아래 비어 있지 않은 `<title>`과 `<desc>`
- Markdown의 의미 있는 alt text
- 명시적 viewport와 배경
- 텍스트 잘림, 겹침과 canvas overflow 없음
- 장식 요소보다 흐름과 결론이 먼저 읽힘
- 수정 가능한 SVG가 기준이며 PNG는 파생본

PNG는 SVG viewport의 정확한 2배 크기여야 한다. Chromium이나 renderer가 없으면 lint 통과 SVG와 실패 근거를 보존하고 PNG 성공을 주장하지 않는다. 이 작업의 완료 조건은 72개 PNG이므로 최종 구현에서는 사용할 수 있는 bundled Chromium 경로를 확인하고 전체 렌더를 완료해야 한다. 환경상 불가능하면 작업은 완료가 아니라 명시적 validation gap으로 남는다.

### 13.4 asset 경로

```text
guides/assets/use-cases/audiences/<audience-id>.svg|png
guides/assets/game-design-studio/use-cases/<case-id>.svg|png
guides/assets/game-design-studio/skills/<skill-id>.svg|png
guides/assets/game-design-career/use-cases/<case-id>.svg|png
guides/assets/game-design-career/skills/<skill-id>.svg|png
```

`guides/assets/diagram-manifest.json`은 새 scope를 추가해 모든 파일, 연결 사례 또는 스킬, 문서 사용 위치와 접근성 설명을 기록한다. 기존 shared scope의 정확히 6개 canonical pair 계약은 유지한다.

## 14. Manifest와 일관성 계약

### 14.1 `use-case-manifest.json`

manifest는 다음 필드를 가진다.

```json
{
  "version": 1,
  "audience_paths": [
    {
      "id": "AUD-01",
      "document": "guides/use-cases/audience-paths.md",
      "anchor": "aud-01-game-design-student",
      "diagram": {
        "svg": "guides/assets/use-cases/audiences/aud-01.svg",
        "png": "guides/assets/use-cases/audiences/aud-01.png"
      }
    }
  ],
  "cases": [
    {
      "id": "ST-C03",
      "product": "game-design-studio",
      "view": "competency",
      "audiences": ["AUD-01", "AUD-04", "AUD-05"],
      "level": ["foundation", "applied", "portfolio"],
      "document": "guides/game-design-studio/use-cases/competency-paths.md",
      "anchor": "st-c03-rules-states-exceptions-data",
      "skills": ["design-game-systems", "visualize-game-design", "review-game-design"],
      "templates": ["system-specification", "rule-exception-matrix", "data-schema-table-contract"],
      "outputs": ["system-specification", "state-flow", "review-findings"],
      "diagram": {
        "svg": "guides/assets/game-design-studio/use-cases/st-c03.svg",
        "png": "guides/assets/game-design-studio/use-cases/st-c03.png"
      }
    }
  ],
  "skill_cases": []
}
```

실제 manifest의 case와 skill entry는 다음을 만족해야 한다.

- ID와 anchor가 전체에서 유일함
- `audience_paths` 6개, `cases` 36개와 `skill_cases` 30개가 정확히 존재함
- product, skill과 template ID가 설치된 closed catalog에 존재함
- 모든 문서와 diagram 경로가 저장소 내부 regular file임
- 모든 output ID가 문서 본문의 결과 섹션에 등장함
- Studio case는 Career-only skill·template을 직접 소유하지 않음
- Career case는 Studio 결과를 handoff evidence로만 참조함

### 14.2 문서와 manifest 우선순위

- 스킬의 행동 계약은 설치된 `SKILL.md`가 권위 있다.
- 템플릿과 output 구조는 설치된 template과 shared contract가 권위 있다.
- use-case manifest는 문서 coverage와 routing의 기준이다.
- 사례 본문은 교육적 설명의 기준이다.
- diagram manifest는 SVG·PNG asset 관계의 기준이다.

manifest가 스킬 행동을 새로 정의하거나 기존 계약을 완화하지 않는다.

## 15. 오류 처리와 안전 경계

| 상황 | 문서 행동 |
| --- | --- |
| 입력이 부족함 | `미정`, 가정과 추가 조사 항목을 분리하고 사실을 만들지 않음 |
| 현재 채용·제품 정보 확인 불가 | 확인일, 검색 범위와 재검색 요청문을 남기고 단정하지 않음 |
| image provider 부재 | prompt, placeholder와 manifest를 보존하고 generation 성공을 주장하지 않음 |
| API key가 있음 | OpenAI-only 계약을 설명하며 실패 뒤 host fallback을 제안하지 않음 |
| Skillstead SVG lint 실패 | 문서 삽입과 PNG 렌더를 중단하고 해당 도식만 수정 |
| Chromium 부재 | SVG와 실패 근거를 보존하고 PNG를 `unavailable`로 표시 |
| PNG 잘림·overflow | 성공으로 표시하지 않고 해당 도식만 재렌더 |
| document renderer 부재 | Canonical Artifact와 MD를 보존하고 해당 형식만 재개 |
| 비공개·NDA·개인정보 포함 | 공개 사례와 Career 출력에서 제거 또는 비식별화 |
| 제3자 권리 불명 | source, purpose와 permission gap을 기록하고 승인하지 않음 |
| Studio·Career 경계 혼합 | Artifact를 합치지 않고 공개 가능한 evidence summary만 전달 |
| 사례와 실제 skill 계약 불일치 | 계약 테스트 실패로 처리하고 문서를 수정 |

## 16. 구현 단계의 검증 설계

### 16.1 테스트 우선순위

구현은 문서 계약 테스트를 먼저 추가해 실패를 확인한 뒤 문서와 도식을 작성한다.

1. manifest 구조와 정확한 coverage count
2. 문서 필수 섹션과 local link
3. skill·template ID 존재와 제품 경계
4. SVG accessibility와 Skillstead lint
5. PNG 존재, 손상과 정확한 2× 크기
6. README 대표 사례와 상세 가이드 routing
7. source 제품 README와 built plugin README 동기화
8. 기존 guide와 plugin 계약 회귀

### 16.2 필수 자동 검증

- 사용자 경로 6개 존재
- Studio 복합 사례 18개 존재
- Career 복합 사례 18개 존재
- 설치 스킬 30개 모두 skill case와 전용 도식 보유
- FAQ 문항 총 48개 이상
- 복합 사례마다 App·CLI 요청문, 스킬 체인, 결과, 검토, 재개와 자기점검 섹션 존재
- 새 SVG 72개와 새 PNG 72개가 manifest와 일치
- 모든 SVG에 직접 자식 `<title>`과 `<desc>` 존재
- 모든 PNG가 대응 SVG viewport의 정확한 2× 크기
- README와 guide의 모든 local link가 존재
- 모든 skill과 template ID가 실제 catalog에 존재
- 기존 shared diagram 6쌍 계약 유지
- 실제 secret 또는 비어 있지 않은 `OPENAI_API_KEY` 없음
- source 제품 README와 built plugin README 동기화

### 16.3 최종 검증 순서

```text
대상 use-case·FAQ·README 계약 테스트
→ npm run validate:guides
→ Skillstead SVG lint
→ PNG 크기·손상 검증
→ npm run build
→ source/build README 동기화 검증
→ git diff --check
→ npm test
→ 사용자 유형별 대표 도식과 사례 육안 QA
```

대표 육안 QA는 최소 다음을 포함한다.

- 입문 학생 경로
- Studio 시스템 역량 사례
- Studio 모바일 수집형 RPG 사례
- Studio 직접 스킬 사례
- Career 무경력 신입 사례
- Career 역기획 사례
- Career 직접 스킬 사례
- 긴 label과 한글이 많은 도식

72개 전체 파일은 자동 layout·overflow 검증을 통과해야 하며, 대표 표본의 육안 검토는 자동 검증을 대체하지 않는다.

## 17. 구현 순서와 경계

구현 계획은 다음 독립 단위로 분해한다.

1. use-case manifest와 계약 테스트
2. 공통 허브, 사용자 경로와 output catalog
3. Studio 역량·콘셉트 사례와 기존 recipe 확장
4. Career 역량·대상 사례와 기존 recipe 확장
5. Studio 설치 스킬 15개 direct-use 확장
6. Career 설치 스킬 15개 direct-use 확장
7. 공통·Studio·Career FAQ 48개 이상
8. 72개 Skillstead SVG source, lint와 2× PNG render
9. 루트·가이드·제품 README 확장과 built snapshot 동기화
10. 전체 문서·도식·빌드·회귀 검증

공유 파일인 `use-case-manifest.json`, `diagram-manifest.json`, 루트 README와 guide validator는 한 작업 lane에서 순차적으로 통합한다. 제품별 사례와 스킬 문서는 독립 작업 단위로 나눌 수 있지만, 같은 파일을 동시에 편집하지 않는다.

## 18. 완료 조건

다음 조건을 모두 충족할 때 완료다.

1. 공통 활용 허브, 사용자 경로와 결과물 카탈로그가 있다.
2. Studio와 Career에 역량, 콘셉트·대상, 스킬 사례집과 FAQ가 있다.
3. 6개 사용자 경로, 36개 복합 사례와 30개 스킬 사례가 manifest에 등록되어 있다.
4. 기존 12개 recipe가 복합 사례에 연결되고 결과 예시와 고유 도식을 가진다.
5. 새 Skillstead SVG 72개와 검증된 2× PNG 72개가 있다.
6. 루트 README와 두 제품 README가 대표 사례, 결과와 상세 문서 링크를 제공한다.
7. 모든 사례가 입력, 요청문, 스킬 체인, 결과, 검토, 포트폴리오·실무 활용, 실패·재개와 자기점검을 설명한다.
8. FAQ가 최소 48개이고 실행 가능한 요청문과 관련 문서 링크를 제공한다.
9. 모든 링크, skill·template ID, SVG 접근성, PNG 크기, README 동기화와 전체 테스트가 통과한다.
10. API key, 개인정보, NDA 자료, 권리 불명 자산과 회사 고유 양식 복제가 없다.
11. 처음 사용하는 학생이 README에서 사례를 선택하고 요청을 실행한 뒤 결과를 검토하고 다음 학습으로 이동할 수 있다.

## 19. 승인된 결정 기록

- 공통 활용 허브와 제품별 사례집·FAQ를 함께 제공한다.
- 기획 입문 학생, 취업 준비생, 직무 전환자, 솔로·인디, 현업 기획자, 팀 리드·교육자·멘토를 모두 포함한다.
- 역량 중심, 콘셉트 중심과 스킬 중심 콘텐츠를 모두 제공한다.
- 장르·플랫폼·운영 방식은 균형 있게 다루되 취업 준비 학생에게 필요한 규칙·루프·시스템·UX 일반 문제를 충분히 포함한다.
- 모든 복합 사례와 모든 설치 스킬에 전용 Skillstead SVG·PNG를 제공한다.
- 문서 결과를 구체적인 파일, 대표 내용, 검토 순서와 활용법으로 설명한다.
- 공식 교육·채용 자료는 원칙 연구에만 사용하고 회사 고유 양식을 복제하지 않는다.
- 루트 README, 제품 README와 guide README를 확장하되 상세 본문은 `guides/`에 유지한다.
