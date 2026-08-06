# Game Design Studio 설치

App와 CLI는 설치·확인·활성화·제거 표면이 다릅니다. 사용하는 환경의 절차만 따르세요. 공식 기준은 [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins), [Codex CLI plugin](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin), [Codex CLI marketplace](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace)입니다.

## Codex App 설치

1. 저장소 루트를 로컬 프로젝트 또는 작업 폴더로 열어 해당 repo context를 사용합니다.
2. 저장소 루트의 `.agents/plugins/marketplace.json`이 있고 top-level `name`이 `game-design-suite`인지 확인합니다.
3. ChatGPT 데스크톱 앱을 다시 시작해 로컬 marketplace를 다시 읽게 합니다. 로컬 원본을 바꾼 뒤에도 앱을 다시 시작합니다.
4. 앱에서 **Codex**를 선택하거나 **ChatGPT → Work**를 켠 뒤 **Plugins**를 엽니다.
5. Plugins Directory에서 marketplace `game-design-suite`가 보이는지 확인하고 **Game Design Studio**를 설치합니다.
6. 설치가 끝나면 **새 채팅**을 열어 번들 스킬을 로드합니다.

App에 임의의 marketplace 경로를 입력하지 않습니다. repo marketplace 배치는 [공식 로컬 플러그인 수동 설치 안내](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)를 따릅니다.

App에서는 프롬프트 입력창에서 `@Game Design Studio`를 선택해 호출합니다. CLI `/plugins`에서 사용하는 `Space` 활성화 키를 App UI에 적용하지 마세요.

## Codex CLI 설치

`<path-to-repository-root>`는 `.agents/plugins/marketplace.json`이 들어 있는 디렉터리의 실제 경로로 바꿉니다.

```bash
codex plugin marketplace add <path-to-repository-root>
codex plugin marketplace list
codex plugin list
codex plugin add game-design-studio@game-design-suite
```

`PLUGIN@MARKETPLACE` 선택자인 `game-design-studio@game-design-suite`를 그대로 사용합니다. 또는 Codex CLI 세션에서 `/plugins`를 열고 `game-design-suite` 탭의 Studio 항목을 설치할 수 있습니다. `/plugins`의 `Space` 키는 설치된 항목의 활성화 상태를 전환하는 CLI 전용 조작입니다. 설치 뒤에는 **새 세션**을 시작합니다.

## 설치 확인

- App: 새 채팅의 Plugins 목록에서 Game Design Studio가 설치되어 있는지 확인한 뒤 `@Game Design Studio`를 선택합니다.
- CLI: `codex plugin list`에서 `game-design-studio`, marketplace `game-design-suite`, 설치·활성 상태를 확인합니다.
- 플러그인이 보이지만 스킬이 선택되지 않으면 기존 대화를 이어 쓰지 말고 App은 새 채팅, CLI는 새 세션에서 다시 확인합니다.

## 업데이트

로컬 marketplace는 Git refresh 대상이 아닙니다. checkout을 갱신하고 저장소 루트에서 다음 검증을 마친 뒤 Studio를 제거하고 다시 설치합니다.

```bash
npm run build
npm run validate
codex plugin remove game-design-studio@game-design-suite
codex plugin add game-design-studio@game-design-suite
```

Git marketplace를 등록했다면 설치 가능한 snapshot을 확인하기 전에 다음 명령으로 해당 Git 원본을 갱신합니다.

```bash
codex plugin marketplace upgrade game-design-suite
codex plugin list --marketplace game-design-suite --available --json
```

`codex plugin marketplace upgrade`는 구성된 **Git marketplace**를 refresh하는 명령입니다. 다음 명령은 그 marketplace의 설치 가능 항목을 확인합니다. 같은 확인은 `/plugins`의 `game-design-suite` 탭에서도 할 수 있습니다. 기본 `codex plugin list`는 설치 상태 확인용이며 설치 가능 snapshot 조회를 대신하지 않습니다. refresh는 설치된 Studio 자체를 새 snapshot으로 교체하지 않으므로, 필요한 버전을 확인한 뒤 명시적으로 다시 설치합니다.

## 제거

CLI에서 Studio만 제거합니다.

```bash
codex plugin remove game-design-studio@game-design-suite
```

marketplace 등록은 플러그인과 별도입니다. 두 제품 모두 더 이상 필요 없을 때만 다음 명령으로 marketplace를 제거합니다.

```bash
codex plugin marketplace remove game-design-suite
```

App에서는 Plugins의 설치된 Studio 상세 화면에서 **Uninstall plugin**을 사용합니다. workspace 설치 또는 관리자가 제공한 기본 플러그인은 사용자가 제거할 수 없을 수 있으므로 관리자에게 문의합니다. 플러그인을 제거해도 번들 connector 연결은 남을 수 있습니다. connector 연결 해제는 ChatGPT의 연결 관리에서 별도로 처리합니다.
