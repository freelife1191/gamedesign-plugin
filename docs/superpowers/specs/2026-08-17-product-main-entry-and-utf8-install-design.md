# 제품 대표 진입 스킬과 UTF-8 설치 계약 설계

## 목적

Game Design Studio와 Game Design Career를 처음 사용하는 사람이 사례 ID나 전문 스킬 이름을 몰라도 제품의 대표 진입점 하나로 작업을 시작할 수 있게 한다. 대표 진입점은 요청을 가장 작은 전문 스킬 체인으로 연결하고, Studio와 Career가 함께 필요한 요청은 한 번의 명시적 인계로 결합한다.

설치 과정에서는 한국어 경로, 한국어 문서와 제한적인 시스템 로케일에서도 UTF-8 바이트가 손상되지 않음을 자동 검증한다. 업데이트는 [플러그인·번들 스킬 업데이트 안내 설계](2026-08-15-plugin-and-bundled-skill-update-advisory-design.md)의 `upgrade-game-design-suite` 계약을 사용한다.

## 사용자 표면

스킬 ID는 소문자·숫자·하이픈만 허용하므로 공백과 대문자를 포함한 `$Game Design Studio` 또는 `$Game Design Career`는 실제 ID가 될 수 없다. 사용자 표면을 다음처럼 구분한다.

| 환경 | Studio 대표 진입 | Career 대표 진입 | 업데이트 |
| --- | --- | --- | --- |
| Codex App | `@Game Design Studio` | `@Game Design Career` | 제품을 선택한 뒤 “Game Design Suite를 업데이트해 줘” |
| CLI 명시 호출 | `$game-design-studio:game-design-studio` | `$game-design-career:game-design-career` | `$game-design-studio:upgrade-game-design-suite` 또는 `$game-design-career:upgrade-game-design-suite` |

`agents/openai.yaml`의 표시 이름은 각각 `Game Design Studio`, `Game Design Career`, `Upgrade Game Design Suite`로 쓴다. 기존 `orchestrate-game-design-project`와 `orchestrate-game-design-career`는 호환성을 위해 유지하며 대표 진입 스킬이 내부에서 사용한다.

## 검토한 접근

### 기존 오케스트레이터 이름 변경

대표 이름은 짧아지지만 기존 문서, 프롬프트, route와 설치 사용자의 호출을 깨뜨린다. 채택하지 않는다.

### manifest 문구만 강화

App의 기본 프롬프트는 좋아지지만 어떤 스킬이 선택되는지 실행 계약으로 고정할 수 없다. README 예시와 실제 동작 차이를 닫지 못하므로 단독으로 채택하지 않는다.

### 대표 진입 스킬을 호환 alias로 추가

채택한다. 두 새 스킬은 넓은 제품 요청을 소유하고 기존 오케스트레이터와 전문 스킬을 호출한다. 기존 스킬 ID는 그대로 유지하므로 현재 사용자를 깨뜨리지 않는다.

## 대표 진입 스킬 계약

### 공통 intake

두 대표 스킬은 다음 순서로 요청을 정규화한다.

1. 사용자가 원하는 최종 결과를 하나 이상 식별한다.
2. 입력 자료, 공개 범위, 근거 수준, 사람 결정권자와 출력 형식을 기록한다.
3. 사실, 추론, 제안과 확인할 항목을 분리한다.
4. 한 전문 스킬이 결과를 완성할 수 있으면 그 스킬을 직접 선택한다.
5. 여러 단계, 여러 도메인 또는 불명확한 범위면 기존 제품 오케스트레이터를 선택한다.
6. Studio와 Career가 모두 필요하면 최종 산출물의 소유 제품을 하나만 정하고 상대 제품에 한 번만 인계한다.

대표 스킬은 전문 스킬의 안전·근거·승인 규칙을 완화하지 않는다. 자동 라우팅은 자동 승인이 아니며, 이미지 생성·용어 승인·기억 승인·문서 공개처럼 사람 결정이 필요한 단계는 그대로 멈춘다.

### Studio 대표 진입

`game-design-studio`는 프로젝트 방향, 시스템, 콘텐츠, UX, 경제·라이브 운영, 제작, 검토, 도식화, 이미지, 컷씬, 레퍼런스 분석, 용어집과 내보내기 요청을 소유한다.

- 명확한 단일 결과: 해당 Studio 전문 스킬로 직접 전달한다.
- 복합 기획: `orchestrate-game-design-project`로 전달한다.
- 취업·포트폴리오·면접 결과가 최종 산출물이면 Career에 인계할 Studio 증거만 작성한다.

### Career 대표 진입

`game-design-career`는 역할 탐색, 공고 조사, 역량 차이, 학습 계획, 포트폴리오, 면접, 성장과 Career 문서 출력을 소유한다.

- 명확한 단일 결과: 해당 Career 전문 스킬로 직접 전달한다.
- 복합 경력 준비: `orchestrate-game-design-career`로 전달한다.
- 게임 시스템이나 프로젝트 명세가 근거로 필요하면 Studio에 증거 패키지를 한 번 요청하고 Career가 최종 결과를 완성한다.

## Studio와 Career 인계

교차 제품 호출은 재귀 오케스트레이션을 금지한다. 최종 소유 제품이 한 번의 `suite-handoff-v1` envelope를 만들고, 공급 제품은 요청받은 증거만 반환한다.

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "requestedOutputs": ["system-evidence-summary"],
  "sourceArtifactIds": ["combat-spec"],
  "factIds": [],
  "inferenceIds": [],
  "recommendationIds": [],
  "unknowns": [],
  "returnToSkill": "game-design-career"
}
```

필드는 폐쇄형이며 제품 ID와 `returnToSkill`이 최종 소유 제품과 일치해야 한다. 공급 제품은 Career 결론을 만들거나 승인하지 않는다. 최종 소유 제품은 인계 결과를 다시 사실·추론·제안으로 검증한 뒤에만 사용한다.

`career-proof-project-interview`는 Career가 소유한다. Studio는 공개 가능한 전투·시스템 명세의 사실과 확인할 항목을 반환하고, Career가 공고 비교, 역량 차이, 12주 계획과 면접 연습을 완성한다.

`CA-C07`, `ST-G04` 같은 사례 ID는 실행 스킬 ID가 아니다. 대표 진입 스킬은 prompt-template catalog에서 사례를 찾아 실제 route와 전문 스킬 체인으로 해석한다. 존재하지 않는 ID는 임의로 추정하지 않고 필요한 입력을 한 번 요청하거나 일반 자연어 route로 되돌린다.

## 라우팅 결과

대표 진입 스킬은 작업을 시작할 때 다음 정보를 짧게 공개한다.

- 선택한 최종 소유 제품
- 선택한 전문 스킬 또는 기존 오케스트레이터
- 필요한 교차 제품 인계
- 만들거나 갱신할 기준 산출물
- 현재 사실, 가정과 blocker
- 사람 승인이 필요한 다음 단계

작업 완료 뒤에는 실제 실행한 스킬, 산출물 경로, 검증 결과와 남은 결정을 보고한다. 선택하지 않은 스킬을 실행했다고 주장하지 않는다.

## UTF-8 설치 계약

### 현재 확인 결과

Codex CLI `0.147.0`을 빈 격리 `HOME`과 `CODEX_HOME`, `LANG=C`, `LC_ALL=C`, 한글 임시 경로에서 실행해 두 제품을 설치했다. 두 제품의 한국어 README는 source와 설치 cache가 SHA-256과 바이트 단위로 같았고 대체 문자 `U+FFFD`는 없었다. 현재 source·shared 텍스트에서도 잘못된 UTF-8과 BOM은 발견되지 않았다.

따라서 현재 macOS 설치 결함은 재현되지 않았다. 다만 이 경계가 기존 자동 테스트에 포함되지 않아 회귀 가능성이 남아 있다.

### 패키지 전 조건

- 배포되는 Markdown, JSON, YAML, JavaScript, SVG와 텍스트 설정은 엄격한 UTF-8이어야 한다.
- UTF-8 BOM을 허용하지 않는다. YAML frontmatter와 JSON 시작 토큰 앞의 BOM도 거부한다.
- 생성 파일의 줄바꿈은 LF를 사용한다.
- 파일 경로는 NFC로 정규화하며 정규화 뒤 중복되는 경로를 거부한다.
- 잘못된 UTF-8을 대체 문자로 복구하거나 조용히 다시 인코딩하지 않는다.

### 설치·실행 조건

- 한글을 포함한 marketplace root, `HOME`, `CODEX_HOME`, workspace와 artifact 경로를 허용한다.
- 자식 프로세스의 JSON stdout/stderr는 명시적으로 `utf8`로 읽고 `shell: false`를 유지한다.
- locale이 `C`여도 한글 manifest, README, SKILL과 사용자 프롬프트가 byte-exact로 왕복해야 한다.
- Windows에서는 상대 `LOCALAPPDATA`, 공백·한글 경로와 기본 코드 페이지에 의존하지 않고 Node의 UTF-8 파일 API와 절대 경로를 사용한다.
- 설치 실패 메시지는 토큰, 사용자 홈 절대 경로와 원격 응답 본문을 노출하지 않는다.

## 패키징

- Studio source에 `skills/game-design-studio/`를 추가한다.
- Career source에 `skills/game-design-career/`를 추가한다.
- `shared/updates/skills/upgrade-game-design-suite/`를 두 제품의 `skills/`에 동일 바이트로 투영한다.
- 새 스킬마다 `SKILL.md`와 `agents/openai.yaml`을 포함한다.
- routing `skillIds`, `plannedPaths`, 사용자 가이드 인벤토리와 생성 plugin snapshot을 함께 갱신한다.
- 대표 스킬은 기존 오케스트레이터의 reference와 validator를 복제하지 않고 링크와 명시적 handoff 계약만 소유한다.

## 테스트 전략

### 스킬 RED/GREEN

- 대표 스킬이 없는 상태에서 Studio·Career 일반 요청이 명시적 대표 route를 찾지 못해 실패해야 한다.
- 단일 요청은 전문 스킬 하나, 복합 요청은 기존 오케스트레이터 하나를 선택해야 한다.
- `career-proof-project-interview`는 Career owner와 Studio supplier 한 번만 포함해야 한다.
- 교차 제품 owner swap, 재귀 handoff, 알 수 없는 제품·스킬과 사실·추론·제안 필드 누락을 거부해야 한다.
- `CA-C07`을 runtime scenario ID로 직접 넘기는 mutation을 거부하고 catalog route로 해석해야 한다.

### 업데이트 RED/GREEN

- `upgrade-game-design-suite`는 검사·계획 단계에서 `marketplace upgrade`와 `plugin add`를 호출하지 않아야 한다.
- 사용자 승인 뒤 local은 `plugin add`만, Git은 `marketplace upgrade` 뒤 `plugin add`만 호출해야 한다.
- source manifest가 설치 버전보다 높지 않거나 경로·이름·SemVer·UTF-8 계약이 틀리면 provider 명령 0회여야 한다.
- 성공 뒤 이전·새 버전과 검증 결과를 표시하고 새 세션 재개 지침을 반환해야 한다.

### UTF-8 RED/GREEN

- invalid UTF-8, BOM과 NFC 충돌 fixture는 package audit에서 실패해야 한다.
- `LANG=C`, `LC_ALL=C`, 한글 marketplace/HOME/CODEX_HOME/workspace에서 두 제품을 실제 설치한다.
- source와 설치 cache의 한국어 README, 대표 SKILL과 metadata SHA-256이 같아야 한다.
- 한글 자연어 요청과 route receipt JSON을 왕복하고 `U+FFFD`가 없어야 한다.
- 설치·업데이트·재설치 전후 workspace, `.game-design/`, 관련 없는 sibling 파일의 바이트와 mode가 같아야 한다.

### 전체 게이트

- 공식 `quick_validate.py`로 새 스킬 세 개를 검증한다.
- 공식 plugin validator, package·skill validator, products, contracts, isolation, marketplace lifecycle을 통과한다.
- authoritative snapshot build와 `--check`가 같아야 한다.
- README·설치·문제 해결·스킬 가이드, prompt catalog와 도식 inventory가 새 대표 진입점과 업데이트 스킬을 정확히 한 번 포함해야 한다.

## 문서와 도식

- 루트 README의 “어떤 플러그인인가요?”, “이 플러그인으로 할 수 있는 일”, 설치, 첫 요청과 업데이트 섹션에 대표 진입점을 설명한다.
- 제품 README와 설치·문제 해결 가이드에 App `@` 호출과 CLI `$` 호출을 구분한다.
- 기존 사례 ID 예시는 대표 진입 스킬이 catalog를 해석한다는 설명과 실제 CLI 호출을 함께 둔다.
- Studio→Career 인계 도식에 최종 owner, supplier evidence와 단방향 반환을 표시한다.
- 플러그인 설치·업데이트 도식에 UTF-8 preflight, marketplace 종류, 사용자 승인, `plugin add`, 검증과 새 세션 재개 단계를 추가한다.
- Archify catalog와 source digest를 갱신하고 변경된 PNG를 원본 해상도로 다시 검수한다.

## 완료 조건

- App에서 제품을 선택한 일반 요청과 CLI 대표 스킬 호출이 같은 route 결정을 만든다.
- Studio와 Career가 함께 필요한 예시는 실제 `suite-handoff-v1`과 전문 스킬 체인으로 실행된다.
- `CA-C07`과 `career-proof-project-interview`가 문서 ID에 머물지 않고 대표 진입점에서 실제 route로 해석된다.
- 업데이트는 `$gstack-upgrade`와 같은 짧은 확인·적용·변경 요약 UX를 제공하되 무승인 자동 적용과 cache 직접 수정은 하지 않는다.
- 한글 경로·문서·프롬프트가 설치 전후 byte-exact이며 UTF-8 오류는 배포 전에 차단된다.
- 새 기능과 문서, 생성 package, 도식과 검증 결과가 서로 일치한다.
