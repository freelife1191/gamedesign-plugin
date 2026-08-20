# Game Design Studio 문제 해결

먼저 Canonical Artifact를 복사하거나 덮어쓰지 마세요. 다음 표는 항상 `증상 → 가능한 원인 → 확인 방법 → 안전한 복구 → 재개 요청문 → 보존된 결과` 순서로 읽습니다.

| 증상 | 가능한 원인 | 확인 방법 | 안전한 복구 | 재개 요청문 | 보존된 결과 |
| --- | --- | --- | --- | --- | --- |
| Plugins에서 Studio를 찾을 수 없음 | 지원하지 않는 IDE 확장·모바일·일반 Chat을 사용했거나 marketplace가 등록되지 않음 | App은 Work/Codex의 Plugins인지, CLI는 `codex plugin marketplace list`와 `codex plugin list`인지 확인 | `.agents/plugins/marketplace.json`을 포함한 저장소 루트를 등록하고 올바른 표면에서 설치 | `Game Design Studio 설치 상태를 확인하고 첫 brief를 시작해줘.` | 설치 전 작성한 사용자 원문과 저장소 파일 |
| 설치했지만 스킬이 호출되지 않음 | 설치 전부터 열어 둔 채팅이나 오래된 세션을 계속 사용 | App의 새 채팅인지, CLI의 새 세션인지 확인 | App은 새 채팅, CLI는 새 세션을 시작 | `설치된 Game Design Studio로 이 아이디어를 기획 요약서로 정리해 줘.` | 기존 채팅과 로컬 결과물 |
| CLI가 플러그인을 못 고름 | 마켓플레이스 선택자 누락 또는 오타 | `codex plugin list`에서 플러그인 ID와 마켓플레이스 이름 확인 | `game-design-studio@game-design-suite`로 다시 설치하거나 `/plugins`의 해당 마켓플레이스 탭 사용 | `$game-design-studio:orchestrate-game-design-project 기존 결과물을 이어서 진행해 줘.` | 설치된 다른 플러그인과 마켓플레이스 등록 |
| 실행 초기에 capability가 누락됨 | Node가 없거나 버전이 맞지 않음, Chromium을 찾지 못함 | SessionStart probe와 오류의 Node·Chromium 상태 확인 | Node 18 이상을 준비하고 새 세션을 시작; Chromium이 없으면 SVG까지만 유지 | `content.md와 SVG 원본을 보존하고 capability 상태를 다시 확인해줘.` | Canonical Markdown, SVG와 source mapping |
| 이미지가 생성되지 않음 | `IMAGE_GEN_MODE`가 `prompt-only`, `select`, `required`, `all` 중 의도와 다르거나 `select`에 stable ID가 없음 | redacted 설정과 `assets/image-assets.yml`의 mode·asset ID 확인 | 탐색은 `prompt-only`; 일부는 `select`와 사용자 지정 ID; 필수/전체는 `required`/`all`로 명시 | `asset-hero-01만 select 모드로 생성하고 나머지 prompt는 보존해줘.` | prompt package, placeholder와 성공한 자산 |
| API 키가 있는데도 호스트 이미지가 선택됨 | 기본값인 `IMAGE_PROVIDER=codex-first`는 키 보유 여부와 유료 사용 승인을 구분함 | 이미지 생성 경로와 호스트 기능 상태 확인 | 호스트 결과를 먼저 검토하고, 필요할 때만 비용 안내 뒤 `IMAGE_PROVIDER=openai`를 명시해 새 승인을 받음 | `호스트 결과를 보존하고 gpt-image-2 low의 예상 비용을 알려 준 뒤 승인 전에는 실행하지 마.` | 프롬프트, 호스트 결과, 유료 전환 제안과 승인 상태 |
| 한글 문자가 이미지에 나오지 않음 | 한글 삽입 경로를 지정하지 않았거나 호스트 경로를 사용함 | `IMAGE_EMBEDDED_TEXT_LOCALE`, 이미지 생성 경로와 모델 확인 | `ko-KR`, OpenAI, `gpt-image-2`를 명시하고 새 비용 안내와 승인을 받은 뒤 실행 | `이미지 안에 '출격 준비'를 넣어야 해. gpt-image-2 low의 예상 비용을 먼저 알려 주고 승인 전에는 생성하지 마.` | 정확한 한글 문구, 비용·승인과 생성 기록 |
| 생성 이미지를 문서에 쓸 수 없음 | 이름 있는 사람의 이미지 승인 또는 권리 근거가 없음 | asset lifecycle, rights evidence와 human decision record 확인 | 원본·라이선스·생성 provenance를 검토하고 사람이 승인 또는 반려 | `asset-hero-01의 권리 근거와 QA finding을 보여주고 사람 결정을 기다려줘.` | 생성 파일은 격리 상태로 보존, Canonical 내용은 유지 |
| PNG/PDF/DOCX/PPTX가 없음 | Chromium 또는 문서 renderer가 없거나 QA 실패 | capability probe와 export manifest의 `unavailable`·`blocked` 원인 확인 | renderer를 준비해 실패 형식만 재실행; MD와 SVG를 새 기준으로 덮어쓰지 않음 | `보존된 Artifact에서 unavailable인 PNG와 PDF만 다시 준비해줘.` | `content.md`, manifest, SVG와 통과한 파생본 |
| 근거·권리·개인정보 검토에서 차단됨 | 출처, 이용 권한, 최신성, 동의 또는 민감정보 처리 근거가 부족함 | `evidence.yml`, 결정 기록, 자산 출처와 공유 범위 확인 | 민감정보를 제거·비식별화하고 허용된 자료로 교체. 근거가 없으면 해당 주장을 가정으로 낮춤 | `개인정보를 제외하고 근거 공백을 유지한 채 검토 가능한 범위만 재개해 줘.` | 검증 가능한 섹션, 결정과 비민감 근거 |
| 작업이 중단되어 어디서 이어야 할지 모름 | 결과물 경로와 마지막 차단 상태가 요청에 없음 | `content.md`, `decisions/`, `assets/`와 마지막 상태 보고 확인 | 기존 결과물을 지정하고 완료한 부분은 보존한 채 차단된 한 단계만 재개 | `mobile-coop-rpg-brief/content.md를 기준으로 결정 기록을 보존하고 보류된 항목부터 재개해 줘.` | 전체 기준 결과 폴더와 완료된 검토 |
| 설치는 됐는데 어떤 스킬을 불러야 할지 모름 | 요청이 넓거나 여러 영역이 섞여 담당 스킬이 하나로 정해지지 않음 | 요청에 원하는 결과가 하나로 정해져 있는지 확인 | 대표 진입 스킬에 요청이나 사례 ID를 그대로 넘겨 담당 제품과 실행 경로를 먼저 선택 | `$game-design-studio:game-design-studio 이 요청을 다섯 항목으로 정리하고 실행 경로 하나를 골라 선택 근거를 남겨.` | 사용자 원문과 기존 결과물 |
| 새 스킬이나 고쳐진 문서가 보이지 않음 | 설치본이 이전 릴리스이거나 설치 뒤 새 세션을 열지 않음 | `codex plugin list`의 버전과 `$upgrade-game-design-suite`의 비교 결과 확인 | 승인 뒤에만 다시 설치하고 App은 새 채팅, CLI는 새 세션에서 재개. 설치 캐시를 직접 고치지 않음 | `$upgrade-game-design-suite 설치된 버전과 최신 릴리스를 비교해서 보여 줘.` | 설치된 다른 플러그인, 마켓플레이스 등록과 로컬 결과물 |

이미지 live smoke의 예시 설정은 `gpt-image-2`와 `low`를 사용하지만, 실제 작업의 모델·품질은 검증된 redacted 설정과 비용·권리 결정을 따릅니다. API key 값 자체를 대화, 로그 또는 Artifact에 붙여 넣지 마세요.
