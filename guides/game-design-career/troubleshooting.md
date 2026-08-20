# Game Design Career 문제 해결

먼저 Canonical Artifact를 복사하거나 덮어쓰지 마세요. 다음 표는 항상 `증상 → 가능한 원인 → 확인 방법 → 안전한 복구 → 재개 요청문 → 보존된 결과` 순서로 읽습니다.

| 증상 | 가능한 원인 | 확인 방법 | 안전한 복구 | 재개 요청문 | 보존된 결과 |
| --- | --- | --- | --- | --- | --- |
| Plugins에서 Career를 찾을 수 없음 | 지원하지 않는 IDE 확장·모바일·일반 Chat을 사용했거나 marketplace가 등록되지 않음 | App은 Work/Codex의 Plugins인지, CLI는 `codex plugin marketplace list`와 `codex plugin list`인지 확인 | `.agents/plugins/marketplace.json`을 포함한 저장소 루트를 등록하고 올바른 표면에서 설치 | `Game Design Career 설치 상태를 확인하고 단계 진단을 시작해줘.` | 입력한 목표와 저장소 파일 |
| 설치했지만 스킬이 호출되지 않음 | 설치 전부터 열어 둔 채팅이나 오래된 세션을 계속 사용 | App의 새 채팅인지, CLI의 새 세션인지 확인 | App은 새 채팅, CLI는 새 세션을 시작 | `설치된 Game Design Career로 현재 역량을 진단해 줘.` | 기존 채팅과 로컬 결과물 |
| CLI가 플러그인을 못 고름 | 마켓플레이스 선택자 누락 또는 오타 | `codex plugin list`에서 플러그인 ID와 마켓플레이스 이름 확인 | `game-design-career@game-design-suite`로 다시 설치하거나 `/plugins`의 해당 마켓플레이스 탭 사용 | `$game-design-career:orchestrate-game-design-career 기존 결과물을 이어서 진행해 줘.` | 설치된 다른 플러그인과 마켓플레이스 등록 |
| 실행 초기에 capability가 누락됨 | Node가 없거나 버전이 맞지 않음, Chromium을 찾지 못함 | SessionStart probe와 오류의 Node·Chromium 상태 확인 | Node 18 이상을 준비하고 새 세션을 시작; Chromium이 없으면 SVG 또는 Markdown까지만 유지 | `로드맵 내용과 SVG 원본을 보존하고 capability 상태를 다시 확인해줘.` | Canonical Markdown, 근거와 source mapping |
| 이미지가 생성되지 않음 | `IMAGE_GEN_MODE`가 `prompt-only`, `select`, `required`, `all` 중 의도와 다르거나 `select`에 stable ID가 없음 | redacted 설정과 `assets/image-assets.yml`의 mode·asset ID 확인 | 탐색은 `prompt-only`; 일부는 `select`와 사용자 지정 ID; 필수/전체는 `required`/`all`로 명시 | `asset-portfolio-cover-01만 select 모드로 생성하고 나머지 prompt는 보존해줘.` | prompt package, placeholder와 성공한 자산 |
| API 키가 있는데도 호스트 이미지가 선택됨 | 기본값인 `IMAGE_PROVIDER=codex-first`는 키 보유 여부와 유료 사용 승인을 구분함 | 이미지 생성 경로와 호스트 기능 상태 확인 | 호스트 결과를 먼저 검토하고 필요할 때만 비용 안내 뒤 OpenAI 사용을 명시적으로 승인 | `호스트 결과를 보존하고 gpt-image-2 low의 예상 비용을 알려 준 뒤 승인 전에는 실행하지 마.` | 프롬프트, 호스트 결과, 유료 전환 제안과 승인 상태 |
| 포트폴리오 이미지에 정확한 한글 문구가 필요함 | 일반 이미지 생성 경로에는 한글 삽입을 맡기지 않음 | 정확한 문구와 `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR` 확인 | OpenAI `gpt-image-2`의 비용·품질을 먼저 승인 | `표지 안에 '시스템 기획' 문구가 필요해. low 비용을 먼저 알려주고 승인 전에는 생성하지 마.` | 정확한 한글 문구, 비용·승인, 생성 검증 기록 |
| 생성 이미지를 포트폴리오에 쓸 수 없음 | 이름 있는 사람의 이미지 승인 또는 권리 근거가 없음 | asset lifecycle, rights evidence와 human decision record 확인 | 원본·라이선스·생성 provenance와 채용 제출 맥락을 검토하고 사람이 승인 또는 반려 | `표지 자산의 권리 근거와 QA finding을 보여주고 사람 결정을 기다려줘.` | 생성 파일은 격리 상태로 보존, 내용과 근거는 유지 |
| PNG/PDF/DOCX/PPTX가 없음 | Chromium 또는 문서 renderer가 없거나 QA 실패 | capability probe와 export manifest의 `unavailable`·`blocked` 원인 확인 | renderer를 준비해 실패 형식만 재실행; MD와 SVG를 새 기준으로 덮어쓰지 않음 | `보존된 Artifact에서 unavailable인 PNG와 PDF만 다시 준비해줘.` | `content.md`, manifest, SVG와 통과한 파생본 |
| 근거·권리·개인정보 검토에서 차단됨 | 공고 출처·날짜, 제3자 저작물 권리, 동의 또는 개인정보 최소화가 부족함 | `evidence.yml`, 원문 사용 범위, 비공개 회사 정보와 개인 식별자를 확인 | 비식별화하고 인용 범위를 줄이며 허용된 공개 자료로 교체. 근거 없는 주장은 공백으로 유지 | `개인정보와 비공개 내용을 제외하고 근거 공백을 유지한 채 로드맵을 재개해 줘.` | 확인 가능한 역량·프로젝트 기록과 비민감 근거 |
| 작업이 중단되어 어디서 이어야 할지 모름 | 결과물 경로, 기준 날짜와 마지막 차단 상태가 요청에 없음 | `content.md`, `evidence.yml`, `decisions/`, `assets/`와 마지막 상태 보고 확인 | 기존 결과물과 근거 ID를 지정하고 차단된 한 단계만 재개 | `system-designer-12-week-roadmap/content.md를 기준으로 완료된 주차를 보존하고 보류된 항목부터 재개해 줘.` | 전체 기준 결과 폴더와 완료된 검토 |
| 설치는 됐는데 어떤 스킬을 불러야 할지 모름 | 요청이 넓거나 여러 영역이 섞여 담당 스킬이 하나로 정해지지 않음 | 요청에 원하는 결과가 하나로 정해져 있는지 확인 | 대표 진입 스킬에 요청이나 사례 ID를 그대로 넘겨 담당 제품과 실행 경로를 먼저 선택 | `$game-design-career:game-design-career 이 요청을 다섯 항목으로 정리하고 실행 경로 하나를 골라 선택 근거를 남겨.` | 사용자 원문과 기존 결과물 |
| 새 스킬이나 고쳐진 문서가 보이지 않음 | 설치본이 이전 릴리스이거나 설치 뒤 새 세션을 열지 않음 | `codex plugin list`의 버전과 `$upgrade-game-design-suite`의 비교 결과 확인 | 승인 뒤에만 다시 설치하고 App은 새 채팅, CLI는 새 세션에서 재개. 설치 캐시를 직접 고치지 않음 | `$upgrade-game-design-suite 설치된 버전과 최신 릴리스를 비교해서 보여 줘.` | 설치된 다른 플러그인, 마켓플레이스 등록과 로컬 결과물 |

이미지 live smoke의 예시 설정은 `gpt-image-2`와 `low`를 사용하지만, 실제 포트폴리오 작업은 검증된 redacted 설정과 비용·권리 결정을 따릅니다. API key 값, 개인 연락처, 타인의 개인정보 또는 회사 비공개 자료를 대화·로그·Artifact에 붙여 넣지 마세요.
