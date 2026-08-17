# 대표 진입 스킬·업데이트 스킬·Windows 인코딩 계약 설계

## 목적

Game Design Studio와 Game Design Career 사용자가 스킬 이름이나 사례 ID를 몰라도 제품별 대표 스킬 하나로 작업을 시작할 수 있게 한다. 대표 스킬은 요청을 가장 작은 전문 스킬 체인으로 연결하고, 두 제품이 함께 필요한 요청은 한 번의 단방향 인계로 결합한다. 정밀 작업을 위한 전문 스킬 직접 호출은 그대로 유지한다.

동시에 설치 사용자가 새 릴리스를 확인하고 명시적 승인 아래 업데이트할 수 있는 공용 스킬을 제공하고, 주 사용자 환경인 Windows에서 인코딩·경로 문제로 설치가 깨지지 않도록 계약을 고정한다.

## 이전 설계와의 관계

이 문서는 다음 두 설계를 대체한다.

- [플러그인·번들 스킬 업데이트 안내 설계](2026-08-15-plugin-and-bundled-skill-update-advisory-design.md) — 런타임 advisory, 정책 파일, 캐시, SessionStart 통합, 저장소 유지보수 흐름은 이미 구현됐다. 미구현으로 남은 `upgrade-game-design-suite` 스킬을 이 문서가 이어받는다. 해당 문서의 "공식 원격 저장소가 정해지지 않았으므로 원격 suite 최신 여부를 사실처럼 표시하지 않는다"는 제약은 폐기한다.
- [제품 대표 진입 스킬과 UTF-8 설치 계약 설계](2026-08-17-product-main-entry-and-utf8-install-design.md) — 방향은 유지하되 트리거 소유권, 인계 봉투 구조, UTF-8 범위, Windows 검증을 이 문서가 개정한다.

## 확인된 사실

착수 전 실측한 내용이다. 설계 판단의 근거이므로 함께 남긴다.

- 원격 릴리스 권위가 생겼다. `origin`은 `https://github.com/freelife1191/gamedesign-plugin`이고 태그 `v0.1.0`, `v0.1.1`과 GitHub Release가 실재한다.
- Codex CLI는 Git 마켓플레이스를 지원한다. `codex plugin marketplace add <owner/repo[@ref]>`와 `--ref` 옵션이 있다.
- 실사용 설치는 Git 마켓플레이스 경로를 쓴다. `game-design-suite → freelife1191/gamedesign-plugin`으로 두 제품 `v0.1.1`이 `installed: true`, `enabled: true` 상태로 설치됐고, 이 설치는 Windows에서 이루어졌다.
- BOM은 설치를 깨뜨린다. 사용자 환경의 다른 marketplace JSON에 UTF-8 BOM이 있어 `codex plugin list` 로딩이 막힌 사례가 확인됐다. 내용을 그대로 두고 BOM 없는 UTF-8로 재인코딩해 해결했다.
- 새 플러그인은 새 세션 또는 앱 재시작 뒤에 스킬 목록에 나타난다.
- 스킬 ID는 `^[a-z0-9-]+$`, 64자 이하다. description은 1024자 이하이며 `<`, `>`를 포함할 수 없다(`quick_validate.py`).
- `codex plugin list --marketplace <name> --json --available` 플래그가 모두 실재한다(CLI 0.147.0).
- 저장소에 PR·push CI가 없다. 워크플로는 주간 번들 업데이트 확인 하나뿐이다.
- 플러그인 패키지에 바이너리 파일이 없다. 전부 텍스트이므로 전수 UTF-8 감사가 안전하다.
- 플러그인 상대 경로 최장값은 100자다. Windows `MAX_PATH`는 문자 기준이므로 설치 캐시 접두사를 더해도 여유가 크고, Windows 실설치도 통과했다. 파일명 축약은 하지 않는다.
- 현재 두 패키지에 BOM, CR, NFC 충돌, 대소문자 충돌이 각각 0건이다. 새 게이트를 사전 정리 없이 도입할 수 있다.

## 범위

선행 작업 하나와 기능 네 덩어리로 구성한다.

- 선행: 이미지 생성 모드 표 계약 복구 (현재 `npm run validate`가 유닛 단계에서 실패한다)
- A: `upgrade-game-design-suite` 공용 스킬
- B: 제품별 대표 범용 스킬 2개
- C: Studio ↔ Career 단방향 인계
- D: UTF-8·Windows 계약과 CI 신설

Claude Code 이식은 이번 범위에서 제외한다. 근거와 이식 대비 규칙은 "범위 밖"에 기록한다.

## 선행: 이미지 생성 모드 표 계약 복구

`tests/unit/prompt-template-catalog.test.mjs`의 `policyModes` 추출 정규식은 `| \`mode\` |` 형태의 셀만 인식한다. `guides/game-design-studio/image-assets.md`와 `guides/game-design-career/image-assets.md`가 기본값 모드를 `**\`prompt-only\`**`로 강조하면서 행이 누락됐고, 카탈로그의 폐쇄 모드 집합 계약이 깨져 Studio·Career 두 테스트가 실패한다.

강조 표기를 유지하고 정규식이 셀 내부의 `*`·`**` 래핑을 허용하도록 완화한다. 문서 서식 변경이 계약을 깨뜨리지 않음을 고정하는 회귀 테스트를 함께 추가한다.

## A. `upgrade-game-design-suite`

### 릴리스 권위

suite 자체의 최신 판정 근거는 `https://github.com/freelife1191/gamedesign-plugin`의 GitHub Release다. 안정 SemVer 태그 `vX.Y.Z`만 비교하고 draft와 prerelease는 제외한다.

`shared/updates/update-policy.json`에 suite 항목을 추가한다. 업스트림 allowlist는 기존 번들 세 개와 suite 하나로 폐쇄한다. `tooling/lib/tree-audit.mjs`가 정책 파일과 `update-advisory.mjs` 내용에 정규식 identity matcher를 걸고 있으므로 정책 구조 변경 시 matcher도 함께 갱신한다.

### SessionStart 안내 확장

기존 7일 주기 검사에 suite를 추가해 네 대상을 조회한다. 전체 제한 시간 5초를 유지하고 초과 시 전체를 `unknown`으로 끝낸다. 업데이트가 없으면 사용자에게 아무 문장도 출력하지 않는다.

캐시 키 목록은 폐쇄돼 있다. "이 버전은 다시 알리지 않기" 상태를 담기 위해 키를 추가하고 `schemaVersion`을 2로 올린다. 버전 1 캐시는 신뢰하지 않고 첫 실행으로 재검사한다. 캐시는 재생성 가능한 데이터이므로 마이그레이션 코드를 만들지 않는다.

### 실행 계약

검사와 계획 단계에서는 provider 명령을 호출하지 않는다. 사용자 승인 뒤에만 다음을 실행한다.

- Git 마켓플레이스(주 경로): `codex plugin marketplace upgrade game-design-suite --json` → 갱신된 snapshot manifest 재확인 → `codex plugin add <plugin>@game-design-suite --json`
- 로컬 마켓플레이스(개발자용): source manifest를 비교해 더 높은 안정 SemVer일 때만 `codex plugin add`

로컬 마켓플레이스인데 GitHub에 더 높은 릴리스가 있으면 자동 갱신이 불가능하다. `codex plugin marketplace add freelife1191/gamedesign-plugin` 전환 방법을 안내만 하고 파일을 직접 조작하지 않는다.

manifest 이름 불일치, 같거나 낮은 버전, prerelease, 잘못된 UTF-8, BOM, symlink, marketplace 밖 경로는 `current` 또는 `unknown`으로 끝내며 설치 명령을 만들지 않는다.

### 사용자 선택

- 지금 업데이트: 검증된 계획을 적용한다.
- 나중에: 기존 7일 advisory 상태를 유지한다.
- 이 버전은 다시 알리지 않기: 해당 최신 버전 조합에 대해서만 알림을 억제한다.
- 업데이트 알림 끄기: `GAME_DESIGN_UPDATE_CHECKS=false` 계약을 안내하고 검사·캐시 쓰기를 중단한다.

### 결과 보고

성공 뒤 이전 버전, 새 버전, 갱신된 제품, 번들 구성 요소 변화, 검증 결과를 5~7개 이하 항목으로 요약하고 새 세션 재개 지침을 반환한다. 변경 내역의 근거가 없으면 기능을 추측하지 않고 버전과 검증 결과만 표시한다.

### 금지 동작

- 무승인 자동 업데이트와 `auto_upgrade` 설정
- 설치 디렉터리에서 `git reset --hard`, `rm -rf`, 직접 교체, `.bak` 복원
- 설치된 플러그인 캐시나 번들 스킬 직접 수정
- 저장소 checkout의 로컬 변경 자동 stash·삭제. dirty local marketplace는 업데이트를 중단하고 현재 상태를 보고한다.

### 재사용

`shared/scripts/inspect-game-design-plugin-updates.mjs`가 이미 `plugin list --json`의 폐쇄 필드 검증과 재설치 계획 생성을 수행한다. 스킬은 이를 호출하는 얇은 층과 승인 UX, 요약만 소유한다.

### 호스트 명령 격리

Codex 전용 명령은 스킬의 `references/` 파일 하나에 모은다. 다른 호스트로 이식할 때 그 파일만 교체한다.

## B. 대표 범용 스킬

### 배치

| 항목 | Studio | Career |
| --- | --- | --- |
| 대표 스킬 ID | `game-design-studio` | `game-design-career` |
| 소스 경로 | `products/game-design-studio/plugin/skills/game-design-studio/` | `products/game-design-career/plugin/skills/game-design-career/` |
| App 호출 | `@Game Design Studio` | `@Game Design Career` |
| CLI 호출 | `$game-design-studio:game-design-studio` | `$game-design-career:game-design-career` |
| 위임 오케스트레이터 | `orchestrate-game-design-project` | `orchestrate-game-design-career` |

각 대표 스킬은 자기 플러그인에만 존재하며 상대 제품 스킬을 복제하지 않는다. `upgrade-game-design-suite`만 `shared/updates/skills/`에 한 벌 두고 두 제품에 동일 바이트로 투영한다. 제품당 설치되는 신규 스킬은 두 개, 소스 기준 신규 스킬 디렉터리는 세 개다.

### 소유 도메인

- `game-design-studio`: 프로젝트 방향, 시스템, 콘텐츠, UX, 경제·라이브 운영, 제작, 검토, 도식화, 이미지, 컷씬, 레퍼런스 분석, 용어집, 내보내기
- `game-design-career`: 역할 탐색, 공고 조사, 역량 차이, 학습 계획, 포트폴리오, 리버스 설계, 면접, 주니어 성장, 경력 문서 출력

### 트리거 소유권

진입 경로를 세 층으로 나눈다.

| 층 | 소유 범위 | 호출 |
| --- | --- | --- |
| 대표 스킬 | 넓은·모호·다도메인 요청, 사례 ID, 무엇을 써야 할지 모르는 요청 | `@` 또는 `$<plugin>:<대표 스킬>` |
| 오케스트레이터 | 대표 스킬이 위임한 복합 기획·경력 준비 | `$<plugin>:orchestrate-*` 직접 호출 유지 |
| 전문 스킬 | 결과가 명확한 단일 작업 | `$<plugin>:<전문 스킬>` 직접 호출 유지 |

Studio 오케스트레이터 description의 `has ambiguous scope` 조각만 대표 스킬로 이관한다. 다분야 복합 조정 문구는 유지한다. Career 오케스트레이터 description은 구체 트리거만 나열하므로 수정하지 않는다.

### 대표 스킬이 소유하는 것

기존 오케스트레이터의 reference와 validator를 복제하지 않는다. 대표 스킬은 네 가지만 소유한다.

1. intake 정규화 — 원하는 최종 결과, 가진 자료, 공개 범위, 사람 결정권자, 출력 형식을 기록한다. 모르는 값은 `미정`으로 두고 진행한다.
2. route 판정 — 단일 결과는 전문 스킬로 직행하고, 복합·모호는 오케스트레이터로 위임하며, 교차가 필요하면 소유 제품을 하나 정한다.
3. 사례 ID 해석 — `CA-C07`, `ST-G04` 같은 ID는 실행 스킬 ID가 아니다. prompt-template catalog에서 찾아 실제 route로 변환한다. 존재하지 않는 ID는 추측하지 않고 필요한 입력을 한 번 요청하거나 자연어 route로 되돌린다.
4. 라우팅 영수증 공개.

대표 스킬은 전문 스킬의 안전·근거·승인 규칙을 완화하지 않는다. 자동 라우팅은 자동 승인이 아니다. 이미지 생성, 용어 승인, 기억 승인, 문서 공개처럼 사람 결정이 필요한 단계는 그대로 멈춘다.

### 라우팅 영수증

라이브 세션 응답은 비결정적이므로 산문에 단언을 걸 수 없다. 대표 스킬은 작업 시작 시 다음을 기계 검증 가능한 형태로 공개한다.

- 선택한 최종 소유 제품
- 선택한 전문 스킬 또는 오케스트레이터의 실제 스킬 ID
- 교차 인계 필요 여부
- 만들거나 갱신할 기준 산출물 경로
- 현재 사실, 가정, blocker
- 사람 승인이 필요한 다음 단계

완료 시에는 실제 실행한 스킬, 산출물 경로, 검증 결과, 남은 결정을 보고한다. 선택하지 않은 스킬을 실행했다고 주장하지 않는다.

영수증 포맷은 새로 만들지 않는다. `tooling/marketplace-smoke.mjs`가 검증하는 기존 route receipt 구조(`routeId`와 로드된 지시문의 상대 경로·SHA-256 대조)를 재사용한다.

### 결정론 확보

`tests/e2e/suite/natural-language-routing.e2e.test.mjs`는 `routing.json`의 `triggerIntents`와 각 오케스트레이터의 시나리오 validator로 의도에서 route까지의 결정론을 이미 검증한다. 대표 스킬도 같은 validator를 재사용한다. 모델이 개입하는 단계는 자연어에서 정규화된 의도까지 한 단계뿐이며, 그 단계는 라이브 스모크에서 영수증으로 확인한다.

## C. Studio ↔ Career 인계

### 계약 위치

별도 스키마 파일을 만들지 않는다. 이 저장소는 SKILL.md와 references 안의 sentinel로 감싼 JSON 블록을 폐쇄 계약으로 쓰고 계약 테스트가 이를 파싱한다. 인계 계약도 대표 스킬의 `references/handoff.md`에 `<!-- suite-handoff-contract:start -->` 블록으로 둔다. 두 제품에 동일 바이트로 투영한다.

### 봉투

요청과 반환을 분리한다. 요청 시점에는 사실·추론·제안을 채울 수 없기 때문이다.

요청(소유 제품 → 공급 제품):

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-request-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "requestedOutputs": ["system-evidence-summary"],
  "sourceArtifactIds": ["combat-spec"],
  "returnToSkill": "game-design-career"
}
```

반환(공급 제품 → 소유 제품):

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-return-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "facts": [],
  "inferences": [],
  "recommendations": [],
  "unknowns": []
}
```

`requestedOutputs`는 폐쇄 enum이며 초기값은 `system-evidence-summary`, `content-evidence-summary`, `production-constraint-summary`, `career-target-profile`이다. 목록 밖 값은 거부한다.

### 규칙

1. 최종 산출물을 내는 제품만 owner다. `returnToSkill`은 owner 제품의 대표 스킬과 일치해야 한다.
2. 공급 제품은 요청받은 증거만 반환한다. 상대 도메인 결론을 내리거나 승인하지 않는다.
3. 공급 제품은 다시 인계를 시작할 수 없다. 한 요청당 인계는 한 번이다.

소유 제품은 반환된 증거를 자기 기준으로 사실·추론·제안으로 재검증한 뒤에만 사용한다. 공급 제품이 붙인 라벨을 그대로 승격하지 않는다.

### 상대 제품 미설치 처리

감지는 지연 실행한다. SessionStart 훅을 건드리지 않고 교차가 실제로 필요해진 시점에만 한 번 조회한다. `inspect-game-design-plugin-updates.mjs`의 `plugin list --json` 폐쇄 파싱에 얇은 조회 함수를 추가하며 새 스크립트 파일을 만들지 않는다.

- 둘 다 설치: 인계를 진행한다.
- 상대 미설치: 증거를 지어내지 않는다. 자기 제품이 가진 것만으로 부분 완성하고 빠진 근거를 blocker로 명시한다. 설치 명령 한 줄과 사용자가 직접 근거를 제공하는 대체 경로를 제시한다.
- 감지 불가: 미설치와 같은 degrade를 적용하되 문구를 "확인 불가"로 구분한다.

`plugin list` 자체가 실패하면 사용자 환경의 marketplace JSON BOM 가능성을 진단으로 안내한다. 사용자 파일을 자동으로 수정하지 않는다.

### 대표 사례

`career-proof-project-interview`는 Career가 owner다. Studio는 공개 가능한 전투·시스템 명세의 사실과 확인할 항목만 반환하고, 공고 비교, 역량 차이, 12주 계획, 면접 연습은 Career가 완성한다.

## D. UTF-8과 Windows 계약

### 이미 강제되는 것

`tooling/lib/tree-audit.mjs`는 패키지 트리를 전수 순회하며 symlink, 비정규 파일, 패키지 루트 탈출을 거부하고 파일마다 `fatal` UTF-8 디코더로 검사한다. `tooling/isolation-smoke.mjs`가 두 제품 패키지에 이를 실행하고 isolation smoke는 `npm run validate` 체인에 포함된다.

### tree-audit 확장

1. BOM 거부. 선두 `U+FEFF`를 금지하며 YAML frontmatter와 JSON 시작 토큰 앞도 동일하게 거부한다. BOM은 `codex plugin list` 로딩을 막아 설치를 불가능하게 만들므로 릴리스 차단 게이트로 취급한다.
2. NFC 정규화 후 중복 경로 거부. 대소문자만 다른 경로 충돌도 함께 거부한다. Windows 파일 시스템이 대소문자를 구분하지 않기 때문이다.
3. LF 강제. CRLF를 발견하면 거부한다.
4. 경로 길이 예산. 플러그인 상대 경로를 150자로 제한한다. 현재 최장값은 100자이므로 파일명 축약 없이 통과하며, 이후 증가를 막는 회귀 방지 장치로 동작한다.

잘못된 UTF-8을 대체 문자로 복구하거나 조용히 재인코딩하지 않는 조건은 기존 `fatal` 디코더로 이미 충족된다.

### 커밋 단계 차단

`.gitattributes`에 `* text=auto eol=lf`를 추가한다. Windows 체크아웃에서 LF 파일이 CRLF로 바뀌면 LF 검사가 전부 실패하기 때문이다. 메모장과 PowerShell 기본 출력이 BOM을 붙이므로 BOM 유입도 커밋 단계에서 막는다.

### 설치 왕복 검증

격리 `HOME`, `CODEX_HOME`과 `LANG=C`, `LC_ALL=C`, 한글 marketplace root·workspace 경로에서 두 제품을 실제 설치한 뒤 확인한다.

- source와 설치 캐시의 한국어 README, 대표 SKILL.md, `plugin.json`을 내용 SHA-256으로 대조한다.
- 경로는 NFC 정규화 후 비교한다. macOS는 `readdir`에서 한글 파일명을 NFD로 반환할 수 있어 경로 바이트를 직접 비교하면 플랫폼 간 오탐이 발생한다.
- 한글 자연어 요청과 라우팅 영수증 JSON을 왕복하고 `U+FFFD`가 없어야 한다.
- 설치·업데이트·재설치 전후 workspace, `.game-design/`, 무관한 sibling 파일의 바이트와 mode가 같아야 한다.

### 자식 프로세스와 경로

자식 프로세스의 JSON stdout·stderr는 명시적으로 `utf8`로 읽고 `shell: false`를 유지한다. Windows에서는 상대 `LOCALAPPDATA`, 공백·한글 경로, 기본 코드 페이지에 의존하지 않고 Node의 UTF-8 파일 API와 절대 경로를 사용한다.

설치 실패 메시지는 토큰, 사용자 홈 절대 경로, 원격 응답 본문을 노출하지 않는다.

### CI 신설

저장소에 PR·push CI가 없으므로 새로 만든다.

| 레인 | 실행 환경 | 내용 | 인증 |
| --- | --- | --- | --- |
| 오프라인 게이트 | `ubuntu-latest`, `windows-latest` | reference drift, evidence audit, vendor hash, update manifest, 유닛, 계약, 제품, 빌드 드리프트, isolation smoke | 불필요 |
| 설치 게이트 | `ubuntu-latest`, `windows-latest` | `@openai/codex` 설치 → 마켓플레이스 등록 → `plugin add` → `plugin list --json` 검증. 한글·공백 포함 `CODEX_HOME`과 workspace 사용 | 불필요 |
| 라이브 스모크 | 로컬·수동 | `npm run smoke:marketplace` | 필요 |

`@openai/codex`는 `win32-x64`와 `win32-arm64` 바이너리를 배포하므로 Windows 러너에서 설치 게이트를 실행할 수 있다. 모델을 호출하지 않으므로 인증이 필요 없다.

CI에서 실행할 수 없는 스테이지는 조용히 통과시키지 않고 `SKIPPED`로 기록하며 릴리스 전 로컬 실행을 필수로 문서화한다. 해당 스테이지는 두 가지다.

- 공식 plugin·skill validator: `tooling/validate-packages.mjs`가 검증기 부재 시 예외를 던진다. 검증기는 Codex 설치 산출물이므로 CI에서 실제로 배치되는지 먼저 확인한다.
- format smoke: `tests/formats/generators/generate_presentation.mjs`가 `package.json`에 없는 호스트 제공 모듈을 임포트한다.

## 테스트 전략

### 선행

- 강조 표기된 모드 셀을 포함한 모드 표가 폐쇄 집합 계약을 통과해야 한다.
- 목록 밖 모드가 추가되면 여전히 실패해야 한다.

### A: 업데이트

- Release 응답 mock에서 draft, prerelease, 다른 구성 요소 태그, malformed SemVer를 제외한다.
- allowlist는 네 엔드포인트로 폐쇄된다.
- timeout, 403, 404, 429, 500, malformed JSON을 fail-open `unknown`으로 처리한다.
- 7일 이내 캐시는 네트워크 호출이 0이고, 경계와 그 이후에는 정확히 한 번 재검사한다.
- 캐시 suppress 상태를 저장하고 존중하며, schemaVersion 1 캐시는 첫 실행으로 취급한다.
- 정책 파일과 스킬의 source가 Studio·Career 패키지와 byte-exact이다.
- 검사·계획 단계에서 `marketplace upgrade`와 `plugin add`를 호출하지 않는다.
- 로컬 fixture `0.1.1 → 0.1.2`에서 `plugin add`가 새 버전을 설치하고 이전 캐시를 제거한다.
- Git 경로는 로컬 bare 저장소로 승인 전 refresh 0회, 승인 뒤 refresh 1회를 검증한다.

### B: 대표 스킬

- 대표 스킬이 없으면 일반 요청이 명시적 대표 route를 찾지 못해 실패한다.
- 단일 요청은 전문 스킬 하나, 복합 요청은 오케스트레이터 하나를 선택한다.
- 라우팅 영수증이 필수 항목을 모두 포함한다.
- `CA-C07`을 runtime scenario ID로 직접 넘기는 시도를 거부하고 catalog route로 해석한다.
- 존재하지 않는 사례 ID를 추측하지 않는다.

### C: 인계

- owner와 supplier 뒤바뀜, `returnToSkill` 불일치, 알 수 없는 제품 ID, `requestedOutputs` enum 밖 값, 반환 봉투 필드 누락, 재귀 인계를 거부한다.
- 두 제품의 `handoff.md`가 byte-exact이다.
- 상대 제품 미설치 시 blocker를 남기고 증거를 지어내지 않는다.
- 두 제품 동시 설치 환경에서 `career-proof-project-interview`가 인계를 정확히 한 번 포함한다.

### D: UTF-8과 Windows

- invalid UTF-8, BOM, NFC 충돌, 대소문자 충돌, CRLF, 경로 길이 초과 fixture가 audit에서 실패한다.
- `LANG=C`와 한글 경로에서 설치 왕복이 byte-exact이며 `U+FFFD`가 없다.
- Windows 러너에서 설치 게이트가 통과한다.

## 문서와 도식

- 루트 README의 설치, 첫 요청, 업데이트 섹션에 대표 진입점과 Git 마켓플레이스 우선 안내를 추가한다.
- 제품 README와 설치·문제 해결 가이드에서 App `@` 호출과 CLI `$` 호출을 구분한다.
- 기존 사례 ID 예시 옆에 대표 진입 스킬이 catalog를 해석한다는 설명과 실제 CLI 호출을 함께 둔다.
- Studio ↔ Career 인계 도식에 최종 owner, supplier evidence, 단방향 반환을 표시한다.
- 설치·업데이트 도식에 UTF-8 preflight, 마켓플레이스 종류, 사용자 승인, `plugin add`, 검증, 새 세션 재개 단계를 추가한다.
- 신규 스킬마다 `guides/<product>/skills/<id>.md` 가이드, prompt-templates 카탈로그 엔트리, use-case diagram manifest, README 표, `routing.json`의 `skillIds`와 `plannedPaths`를 갱신한다.
- BUILD-MANIFEST와 snapshot을 재생성하고 Archify catalog와 변경된 도식을 다시 검수한다.

## 릴리스

`plugin.json`을 `0.1.1`에서 `0.2.0`으로 올린다. 신규 스킬 세 개와 진입점 변경이 포함되기 때문이다. GitHub Release 태그 `v0.2.0`을 발행하며, 업그레이드 스킬은 이 태그를 최신 판정 근거로 읽는다. 릴리스 노트에 번들 구성 요소 버전 표를 남긴다.

## 구현 순서

단계마다 `npm run validate`가 통과한 뒤 다음으로 넘어간다.

1. 선행. 모드 표 계약을 복구해 유닛 단계를 통과시킨다. 이후 단계의 검증이 가능해진다.
2. D의 커밋 단계 차단과 tree-audit 확장. 이후 추가되는 모든 파일이 BOM·CRLF·경로 길이 게이트를 통과한 상태로 들어온다.
3. A. `upgrade-game-design-suite`와 정책·캐시 확장. B와 C가 이 스킬의 존재를 문서에서 참조하므로 먼저 착지한다.
4. B. 대표 스킬 두 개와 Studio 오케스트레이터 description 조정.
5. C. 인계 계약과 미설치 degrade.
6. D의 나머지. CI 신설과 설치 왕복 검증.
7. 문서, 도식, snapshot 재생성과 `0.2.0` 릴리스.

## 완료 조건

- `npm run validate`가 전 단계를 통과한다.
- 제품별 대표 스킬 하나로 시작한 일반 요청이 라우팅 영수증과 함께 전문 스킬 또는 오케스트레이터로 연결된다.
- 전문 스킬과 오케스트레이터 직접 호출이 이전과 동일하게 동작한다.
- Studio와 Career가 함께 필요한 요청이 단방향 인계 한 번으로 처리되고, 상대 제품이 없으면 blocker를 남긴다.
- 업데이트는 사용자 승인 없이 적용되지 않으며, 성공 뒤 이전·새 버전과 검증 결과, 새 세션 재개 지침을 반환한다.
- 패키지에 BOM, invalid UTF-8, CRLF, NFC·대소문자 충돌, 150자 초과 경로가 없다.
- Windows와 Linux CI의 오프라인 게이트와 설치 게이트가 통과한다.
- 오프라인에서도 플러그인 본래 기능이 정상 동작하며 update status만 `unknown`이 된다.

## 범위 밖

### Claude Code 이식

이번 사이클에서 다루지 않는다. 손대는 층(진입 스킬, 훅, 업그레이드 스킬)이 호스트 의존이 가장 짙어 내용과 추상화를 동시에 설계하면 둘 다 흔들린다. 이번 작업이 끝나면 진입점이 스킬 열여섯 개가 아니라 대표 문 두 개로 줄어 이식 비용이 내려간다.

이식 대비로 두 가지 작성 규칙만 지킨다. 호스트 추상화 계층이나 빌드 치환 장치는 만들지 않는다.

- SKILL.md 본문을 호스트 중립으로 유지한다. 호출 표기는 references와 guides에만 둔다. 현재 위반은 0건이다.
- 업그레이드 스킬의 호스트 명령을 references 파일 하나로 격리한다.

이식 시 갈라지는 지점은 매니페스트 경로, 에이전트 frontmatter, 훅 환경 변수, 업그레이드 명령 세트, 검증 파이프라인이다.

### 내보내기 산출물 BOM

확인된 문제는 BOM이 설치를 깨뜨린다는 것이지 BOM이 필요하다는 것이 아니다. 내보낸 문서를 Windows 도구에서 열 때의 실제 깨짐이 보고되면 별건으로 다룬다.

### Windows 경로 축약

플러그인 상대 경로 최장값이 100자이고 Windows 실설치도 통과했으므로 파일명을 줄이지 않는다. 경로 길이 예산만 두어 증가를 막는다.
