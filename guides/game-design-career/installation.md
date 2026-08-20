# Game Design Career 설치

App와 CLI는 설치·확인·활성화·제거 표면이 다릅니다. 사용하는 환경의 절차만 따르세요. 공식 기준은 [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins), [Codex CLI plugin](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin), [Codex CLI marketplace](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace)입니다.

설치되는 구성은 제품 스킬 16개와 공통 스킬 9개, 모두 25개입니다. 공통 스킬에는 레퍼런스 분석과 용어 사전 관리가 포함됩니다. 설치·업데이트·제거는 프로젝트의 로컬 기억 폴더 `.game-design/`을 만들거나 지우지 않습니다. 기억의 기본값과 완전 비활성화 방법은 [Career 프로젝트 기억](memory.md)을 확인하세요.

## Codex App 설치

1. 저장소 루트를 로컬 프로젝트 또는 작업 폴더로 열어 해당 repo context를 사용합니다.
2. 저장소 루트의 `.agents/plugins/marketplace.json`이 있고 top-level `name`이 `game-design-suite`인지 확인합니다.
3. ChatGPT 데스크톱 앱을 다시 시작해 로컬 marketplace를 다시 읽게 합니다. 로컬 원본을 바꾼 뒤에도 앱을 다시 시작합니다.
4. 앱에서 **Codex**를 선택하거나 **ChatGPT → Work**를 켠 뒤 **Plugins**를 엽니다.
5. Plugins Directory에서 marketplace `game-design-suite`가 보이는지 확인하고 **Game Design Career**를 설치합니다.
6. 설치가 끝나면 **새 채팅**을 열어 번들 스킬을 로드합니다.

App에 임의의 marketplace 경로를 입력하지 않습니다. repo marketplace 배치는 [공식 로컬 플러그인 수동 설치 안내](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)를 따릅니다.

App에서는 프롬프트 입력창에서 `@Game Design Career`를 선택해 호출합니다. CLI `/plugins`에서 사용하는 `Space` 활성화 키를 App UI에 적용하지 마세요.

## Codex CLI 설치

marketplace를 등록하고 제품을 설치합니다. 등록 방법이 둘이고 갱신 방법이 다르므로 먼저 고릅니다.

공개 릴리스를 최신 판정 근거로 쓰려면 GitHub 저장소를 Git marketplace로 등록합니다. `$upgrade-game-design-suite`가 읽는 태그가 이 원본에서 나옵니다.

```bash
codex plugin marketplace add freelife1191/gamedesign-plugin
codex plugin marketplace list
codex plugin add game-design-career@game-design-suite
codex plugin list
```

저장소를 직접 고치며 쓸 때는 로컬 checkout을 등록합니다. 로컬 marketplace는 Git fetch 대상이 아니므로 공개 릴리스로 갱신되지 않고, 갱신하려면 checkout을 직접 최신으로 만들어야 합니다.

```bash
codex plugin marketplace add .
codex plugin marketplace list
codex plugin add game-design-career@game-design-suite
codex plugin list
```

설치 전에 marketplace JSON의 인코딩을 확인합니다. 사용자 환경의 **다른** marketplace JSON에 UTF-8 BOM이 있으면 `codex plugin list` 로딩 자체가 막혀 이 제품도 설치할 수 없습니다. 내용을 그대로 두고 BOM 없는 UTF-8로 다시 저장하면 풀립니다. 이 플러그인 패키지는 BOM·CRLF 게이트를 통과한 상태로만 배포되므로 원인은 항상 바깥 파일입니다.

`PLUGIN@MARKETPLACE` 선택자인 `game-design-career@game-design-suite`를 그대로 사용합니다. 또는 Codex CLI 세션에서 `/plugins`를 열고 `game-design-suite` 탭의 Career 항목을 설치할 수 있습니다. `/plugins`의 `Space` 키는 설치된 항목의 활성화 상태를 전환하는 CLI 전용 조작입니다. 설치 뒤에는 **새 세션**을 시작합니다.

### Windows PowerShell

한글이나 공백이 들어간 체크아웃 경로는 PowerShell에서 절대 경로를 따옴표로 감싸 등록합니다. Codex는 사용자 홈을 `%USERPROFILE%`, 로컬 앱 데이터를 `%LOCALAPPDATA%`에서 찾으므로 `HOME` 환경 변수를 따로 만들 필요가 없습니다.

```powershell
$repoRoot = (Resolve-Path .).Path
codex plugin marketplace add "$repoRoot"
codex plugin marketplace list
codex plugin add game-design-career@game-design-suite
codex plugin list
```

Windows에서는 `.cmd` 실행 파일을 셸 없이 직접 실행한 결과나 POSIX 권한 비트, 디렉터리 `fsync`를 검증 근거로 삼지 않습니다. 대신 JavaScript 진입점을 Node로 실행하고 파일 정체성과 설치된 바이트를 대조합니다. 브라우저는 표준 설치 경로를 대소문자 구분 없이 확인합니다. 저장소 검증은 전체 `npm test`가 아니라 CI와 같은 오프라인 샤드, Windows 하드닝과 설치 왕복 검증을 기준으로 합니다.

```powershell
npm run verify:install-roundtrip
```

## 설치 확인

- App: 새 채팅의 Plugins 목록에서 Game Design Career가 설치되어 있는지 확인한 뒤 `@Game Design Career`를 선택합니다.
- CLI: `codex plugin list`에서 `game-design-career`, marketplace `game-design-suite`, 설치·활성 상태를 확인합니다.
- 플러그인이 보이지만 스킬이 선택되지 않으면 기존 대화를 이어 쓰지 말고 App은 새 채팅, CLI는 새 세션에서 다시 확인합니다.

## 업데이트

[![업데이트 알림에서 승인과 재설치와 검증을 거쳐 새 세션에서 재개하는 흐름](../assets/shared/suite-update-approval-flow.png)](../assets/shared/suite-update-approval-flow.svg)

먼저 `$upgrade-game-design-suite`를 부르는 것을 권합니다. 손으로 하는 절차는 그 아래에 그대로 둡니다.

### `$upgrade-game-design-suite` 스킬로 처리하기

아래의 제거·재설치 명령을 직접 입력하는 대신 `$upgrade-game-design-suite`를 호출하면, 설치된 버전과 공개된 최신 릴리스를 비교한 결과를 먼저 보여 주고 승인을 기다립니다. 검사와 계획 단계에서는 어떤 설치도 바꾸지 않습니다.

선택지는 넷입니다.

| 선택 | 결과 |
| --- | --- |
| 지금 업데이트 | 검증된 계획을 그대로 적용합니다. |
| 나중에 | 7일 주기 안내 상태를 그대로 둡니다. |
| 이 버전은 다시 알리지 않기 | 지금 설치된 버전과 최신 버전 조합에 대해서만 알림을 멈춥니다. 더 새 버전이 나오면 다시 알립니다. |
| 업데이트 알림 끄기 | `GAME_DESIGN_UPDATE_CHECKS=false`를 안내하고 검사와 캐시 기록을 중단합니다. |

승인 없이 적용되는 업데이트는 없습니다. 로컬 marketplace는 공개 릴리스로 갱신할 수 없으므로 Git marketplace 전환 방법을 안내만 하고 파일을 직접 고치지 않습니다. checkout에 커밋하지 않은 변경이 있으면 업데이트를 멈추고 현재 상태를 보고합니다.

업데이트가 끝나면 이전 버전, 새 버전, 바뀐 제품, 번들 구성 요소 변화, 검증 결과를 요약하고 새 세션에서 이어가는 방법을 알려 줍니다. 새 스킬 목록은 세션을 다시 시작한 뒤에 반영됩니다.

### 손으로 업데이트하기

로컬 마켓플레이스는 Git으로 갱신하지 않습니다. 체크아웃을 갱신하고 저장소 루트에서 다음 검증을 마친 뒤 Career를 다시 적용합니다. 정상 업데이트에서는 플러그인을 먼저 제거하지 않습니다.

```bash
npm run build
npm run validate
codex plugin add game-design-career@game-design-suite
```

Git marketplace를 등록했다면 설치 가능한 snapshot을 확인하기 전에 다음 명령으로 해당 Git 원본을 갱신합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin list --marketplace game-design-suite --available --json
codex plugin add game-design-career@game-design-suite
```

`codex plugin marketplace upgrade`는 등록한 **Git 마켓플레이스**를 갱신하는 명령입니다. 다음 명령으로 해당 마켓플레이스에서 설치할 수 있는 항목을 확인합니다. 같은 내용은 `/plugins`의 `game-design-suite` 탭에서도 볼 수 있습니다. 기본 `codex plugin list`는 설치 상태를 확인하는 명령이며, 설치 가능한 스냅숏 조회를 대신하지 않습니다. 마켓플레이스를 갱신해도 설치된 Career가 새 스냅숏으로 자동 교체되지는 않습니다. 필요한 버전을 확인한 뒤 `plugin add`로 다시 적용하세요. `plugin add`가 실패해 설치본을 복구해야 할 때만 아래 제거 절차로 상태를 확인한 뒤 재설치합니다.

## 제거

CLI에서 Career만 제거합니다.

```bash
codex plugin remove game-design-career@game-design-suite
```

marketplace 등록은 플러그인과 별도입니다. 두 제품 모두 더 이상 필요 없을 때만 다음 명령으로 marketplace를 제거합니다.

```bash
codex plugin marketplace remove game-design-suite
```

제거한 뒤에는 두 목록을 다시 확인합니다. Career만 제거했다면 Studio는 그대로 남아 있어야 하며, 두 제품과 마켓플레이스를 모두 제거했다면 두 목록에 `game-design-suite` 항목이 없어야 합니다. `%USERPROFILE%` 아래 Codex 설치 캐시와 `%LOCALAPPDATA%`의 임시 상태에도 제거한 제품 ID나 체크아웃 경로가 남지 않았는지 확인합니다.

```bash
codex plugin list
codex plugin marketplace list
```

App에서는 Plugins의 설치된 Career 상세 화면에서 **Uninstall plugin**을 사용합니다. workspace 설치 또는 관리자가 제공한 기본 플러그인은 사용자가 제거할 수 없을 수 있으므로 관리자에게 문의합니다. 플러그인을 제거해도 번들 connector 연결은 남을 수 있습니다. connector 연결 해제는 ChatGPT의 연결 관리에서 별도로 처리합니다.
