# 플러그인 스위트 아키텍처

## 결정

Game Design Plugin Suite는 하나의 거대한 플러그인이 아니라 `game-design-studio`와 `game-design-career` 두 제품을 제공합니다. 공통 지식과 계약은 저장소에서 한 번 관리하고, clean build가 각 독립 패키지에 복제합니다.

이 구조의 핵심 불변 조건은 다음과 같습니다.

- 설치된 플러그인은 sibling 플러그인, `shared/`, `products/` 또는 저장소 절대 경로에 의존하지 않습니다.
- `plugins/`에는 symlink가 없고 package-relative 링크만 있습니다.
- 같은 package 경로를 공통 원천과 제품 overlay가 다른 bytes로 제공하면 덮어쓰지 않고 빌드가 실패합니다.
- 배포 스냅샷은 현재 원천과 byte-for-byte 일치해야 합니다.
- 제품 하나를 설치·제거해도 다른 제품의 상태를 바꾸지 않습니다.

## Source에서 설치 패키지까지

```mermaid
flowchart TB
    subgraph Authoring[편집 원천]
        D[docs/ 원문 49개]
        SH[shared/]
        ST[products/game-design-studio/plugin]
        CA[products/game-design-career/plugin]
    end

    D --> IDX[reference index·rights provenance]
    IDX --> SH
    SH --> BUILD[deterministic clean build]
    ST --> BUILD
    CA --> BUILD

    BUILD --> PS[plugins/game-design-studio]
    BUILD --> PC[plugins/game-design-career]

    PS --> VS[package·skill·isolation 검증]
    PC --> VC[package·skill·isolation 검증]
    VS --> IS[Studio 설치]
    VC --> IC[Career 설치]
```

### 편집 책임

| 영역 | 책임 | 직접 편집 여부 |
| --- | --- | --- |
| `docs/` | 사용자 제공 원문과 설계·아키텍처 문서 | 원문 변경은 provenance 갱신과 함께 수행 |
| `shared/` | 지식, export 계약, 책임 게이트, hook, runtime, Skillstead | 예 |
| `products/game-design-studio/plugin/` | Studio 스킬, 역할, 프로필, 템플릿, 제품 helper | 예 |
| `products/game-design-career/plugin/` | Career 스킬, 역할, rubric, 템플릿, 제품 helper | 예 |
| `plugins/game-design-*` | marketplace가 읽는 생성 스냅샷 | 아니오 |

`npm run build`는 clean staging에서 두 제품을 합성한 뒤 검증된 스냅샷을 교체합니다. 실패 시 반쪽짜리 package를 정상 결과로 남기지 않는 transaction/recovery 계약을 사용합니다.

## 독립 패키지 구조

두 패키지는 같은 상위 구조를 갖습니다.

```text
plugins/game-design-<product>/
├── .codex-plugin/plugin.json
├── skills/                         # 제품 10개 + svg-infographic 1개
│   ├── <product-skill>/
│   │   ├── SKILL.md
│   │   ├── agents/openai.yaml      # 필요한 스킬에만 존재
│   │   ├── references/             # 필요한 스킬에만 존재
│   │   └── scripts/                # 필요한 스킬에만 존재
│   └── svg-infographic/            # Skillstead 0.8.3
├── agents/                         # 역할 프롬프트 6개
├── hooks/hooks.json
├── scripts/                        # shared runtime 3개
├── references/
│   ├── shared/                     # Core, Current, export, 책임 게이트
│   ├── source/docs/                # 원문 49개
│   └── <product references>
├── assets/
│   ├── product-mark.svg
│   ├── templates/                  # 제품별 15개
│   └── shared/templates/
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── README.md
└── BUILD-MANIFEST.json
```

`BUILD-MANIFEST.json`은 suite distribution build 결과입니다. 파일 경로, 크기, SHA-256과 전체 tree hash로 snapshot의 재현성을 확인합니다.

## 제품별 확장점

### Studio

- 제품 스킬: 비전, 시스템, 콘텐츠, 플레이어 경험, 경제·LiveOps, 제작, 검토, 도식화, export와 오케스트레이션
- 역할: lead, system/economy, content/narrative, UX/accessibility, LiveOps/data, production feasibility
- 프로필: `universal-core`를 항상 먼저 적용하고 `live-service-rpg`, `mobile`, `pc-console`을 canonical order로 합성
- 제품 helper: 프로필 합성, 역할 finding 병합, 시나리오 검증, source document 공개 재배포 가드, 시각화 증거, export job 검증
- 템플릿: 비전, loop, 시스템·예외, 데이터, 콘텐츠, UX, 경제, LiveOps, 생산·검토 15개

프로필은 장르 관습을 사실로 만들지 않습니다. 추가 질문, 필수 섹션, evidence trigger와 책임 게이트를 더합니다. 프로필이 충돌하면 자동 타협 대신 decision record를 요구합니다.

### Career

- 제품 스킬: 경력 맵, 채용 조사, 포트폴리오, 역기획, 면접, 리뷰, 성장, 도식화, export와 오케스트레이션
- 역할: career strategist, mentor, portfolio reviewer, reverse-design critic, interview coach, evidence auditor
- 경력 단계: `entry`, `new-hire`, `junior-growth`, `transition`; 불명확하면 `unclear`
- 제품 helper: 역할 finding 병합, 시나리오 검증, 현재 채용 evidence, 시각화 상태, export job 검증
- 템플릿: 역할·역량, 공고 근거, 포트폴리오, 역기획, 면접, 성장·전환 15개

Career는 작은 채용 표본을 시장 전체로 일반화하지 않고, 학력·나이·전공·배경만으로 경로를 순위화하지 않습니다.

## 런타임 오케스트레이션

```mermaid
sequenceDiagram
    participant U as 사용자
    participant O as 오케스트레이터 스킬
    participant W as 제품 스킬
    participant R as 역할 프롬프트
    participant C as Canonical Artifact
    participant X as 시각화·내보내기

    U->>O: 목표, 자료, 제약, 완료 조건
    O->>O: 단계·프로필과 최소 스킬 체인 선택
    O->>W: 정규화된 작업 envelope
    W-->>C: 초안·근거·결정
    O->>R: 역할별 독립 검토
    R-->>O: stable finding
    O->>O: 결정론적 병합과 충돌 기록
    O->>C: 최소 수정과 gate 상태 반영
    C->>X: 선택적 SVG/PNG 및 문서 파생본
    X-->>U: 검증된 출력 + 명시적 미검증/실패 상태
```

### 역할 자산의 실제 의미

`agents/*.md`는 네이티브 플러그인 component manifest가 아닙니다. 각 파일은 역할의 책임, 입력, 검토 질문, 금지 행동, blocker 경계와 출력 계약을 정의합니다. 오케스트레이터는 호스트 capability에 맞춰 이 프롬프트를 전달합니다.

- 병렬 subagent 지원: 서로 독립적인 역할을 최대 3개 병렬 실행
- 병렬 지원 없음: 같은 역할과 질문을 고정 우선순위로 순차 실행
- 두 경로 모두: finding을 도착 순서가 아니라 stable key와 role priority로 병합

따라서 네이티브 자동 발견은 성능 최적화이지 정확성의 필수 조건이 아닙니다.

## Hooks

plugin manifest에는 hook 필드를 추가하지 않고 기본 발견 경로 `hooks/hooks.json`을 사용합니다.

### SessionStart

`scripts/capability-probe.mjs`는 Node, Chromium, LibreOffice와 문서·PDF·프레젠테이션 capability를 읽기 전용으로 확인합니다. 선택 renderer가 없어도 설계 작업과 Canonical MD는 계속할 수 있습니다.

### Stop

`scripts/stop-artifact-review.mjs`는 plugin 식별자와 final artifact sentinel이 있는 active artifact만 검사합니다. 검증이 실패하면 한 번만 교정 패스를 요청하고 재진입 상태에서는 다시 차단하지 않습니다. hook이 비활성화되어도 명시적 validator와 스킬 완료 조건으로 같은 계약을 적용할 수 있습니다.

## 검증 경계

| 단계 | 증명하는 것 |
| --- | --- |
| reference/evidence audit | 원문 인덱스, 최신성, source mapping과 drift |
| vendor hash | Skillstead 0.8.3 원본과 lock의 byte 일치 |
| unit/contract/product/E2E | schema, 스킬, 역할, hook, 제품 시나리오 |
| clean build drift | 편집 원천과 committed snapshot 일치 |
| official package/skill validation | plugin manifest와 모든 스킬 구조 |
| isolation smoke | 저장소와 sibling 없이 단독 package 실행 |
| marketplace smoke | 임시 Codex 환경에서 등록·설치·실제 installed skill 증거·제거 |
| format verification | MD/PDF/DOCX/PPTX/SVG/PNG 구조와 렌더 QA |

기본 검증은 `npm run validate`, release gate는 `npm run validate:release`입니다. marketplace smoke는 로컬 인증이 필요한 별도 장기 검증이므로 `npm run smoke:marketplace`로 분리합니다.

## 관련 문서

- [루트 README](../README.md)
- [내보내기 파이프라인](export-pipeline.md)
- [지식·근거 아키텍처](knowledge-and-evidence.md)
- [Game Design Studio](../plugins/game-design-studio/README.md)
- [Game Design Career](../plugins/game-design-career/README.md)
