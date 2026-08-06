# Game Design Career 문제 해결

먼저 Canonical Artifact를 복사하거나 덮어쓰지 마세요. 다음 표는 항상 `증상 → 가능한 원인 → 확인 방법 → 안전한 복구 → 재개 요청문 → 보존된 결과` 순서로 읽습니다.

| 증상 | 가능한 원인 | 확인 방법 | 안전한 복구 | 재개 요청문 | 보존된 결과 |
| --- | --- | --- | --- | --- | --- |
| Plugins에서 Career를 찾을 수 없음 | 지원하지 않는 IDE 확장·모바일·일반 Chat을 사용했거나 marketplace가 등록되지 않음 | App은 Work/Codex의 Plugins인지, CLI는 `codex plugin marketplace list`와 `codex plugin list`인지 확인 | `.agents/plugins/marketplace.json`을 포함한 저장소 루트를 등록하고 올바른 표면에서 설치 | `Game Design Career 설치 상태를 확인하고 단계 진단을 시작해줘.` | 입력한 목표와 저장소 파일 |
| 설치했지만 스킬이 호출되지 않음 | 설치 이전 채팅 또는 stale session을 계속 사용 | App의 새 채팅인지, CLI의 새 세션인지 확인 | App은 새 채팅, CLI는 새 세션을 시작 | `설치된 Game Design Career로 현재 역량을 진단해줘.` | 기존 채팅과 로컬 Artifact |
| CLI가 플러그인을 못 고름 | marketplace selector 누락 또는 오타 | `codex plugin list`에서 plugin ID와 marketplace 이름 확인 | `game-design-career@game-design-suite`로 다시 설치하거나 `/plugins`의 해당 marketplace 탭 사용 | `$game-design-career:orchestrate-game-design-career 기존 Artifact를 이어서 진행해줘.` | 설치된 다른 플러그인과 marketplace 등록 |
| 실행 초기에 capability가 누락됨 | Node가 없거나 버전이 맞지 않음, Chromium을 찾지 못함 | SessionStart probe와 오류의 Node·Chromium 상태 확인 | Node 18 이상을 준비하고 새 세션을 시작; Chromium이 없으면 SVG 또는 Markdown까지만 유지 | `로드맵 내용과 SVG 원본을 보존하고 capability 상태를 다시 확인해줘.` | Canonical Markdown, 근거와 source mapping |
| 이미지가 생성되지 않음 | `IMAGE_GEN_MODE`가 `prompt-only`, `select`, `required`, `all` 중 의도와 다르거나 `select`에 stable ID가 없음 | redacted 설정과 `assets/image-assets.yml`의 mode·asset ID 확인 | 탐색은 `prompt-only`; 일부는 `select`와 사용자 지정 ID; 필수/전체는 `required`/`all`로 명시 | `asset-portfolio-cover-01만 select 모드로 생성하고 나머지 prompt는 보존해줘.` | prompt package, placeholder와 성공한 자산 |
| API key 설정 후 Codex 이미지로 전환되지 않음 | non-empty `OPENAI_API_KEY`가 있으면 OpenAI 전용 경로가 선택됨 | provider decision과 redacted 오류 종류 확인 | 인증·quota·정책·network 실패를 숨기지 말고 key/계정을 수정해 같은 provider로 재시도; key를 제거한 새 명시 요청에서만 Codex capability 재평가 | `OpenAI 실패 상태를 유지하고 수정된 설정으로 실패한 stable ID만 재시도해줘.` | prompt, placeholder, 검증된 부분 성공과 실패 상태 |
| 생성 이미지를 포트폴리오에 쓸 수 없음 | 이름 있는 사람의 이미지 승인 또는 권리 근거가 없음 | asset lifecycle, rights evidence와 human decision record 확인 | 원본·라이선스·생성 provenance와 채용 제출 맥락을 검토하고 사람이 승인 또는 반려 | `표지 자산의 권리 근거와 QA finding을 보여주고 사람 결정을 기다려줘.` | 생성 파일은 격리 상태로 보존, 내용과 근거는 유지 |
| PNG/PDF/DOCX/PPTX가 없음 | Chromium 또는 문서 renderer가 없거나 QA 실패 | capability probe와 export manifest의 `unavailable`·`blocked` 원인 확인 | renderer를 준비해 실패 형식만 재실행; MD와 SVG를 새 기준으로 덮어쓰지 않음 | `보존된 Artifact에서 unavailable인 PNG와 PDF만 다시 준비해줘.` | `content.md`, manifest, SVG와 통과한 파생본 |
| 근거·권리·개인정보 검토에서 차단됨 | 공고 출처·날짜, 제3자 저작물 권리, 동의 또는 개인정보 최소화가 부족함 | `evidence.yml`, 원문 사용 범위, 비공개 회사 정보와 개인 식별자를 확인 | 비식별화하고 인용 범위를 줄이며 허용된 공개 자료로 교체; 근거 없는 claim은 gap으로 유지 | `개인정보와 비공개 내용을 제외하고 evidence-gap을 유지한 채 로드맵을 재개해줘.` | 확인 가능한 역량·프로젝트 기록과 비민감 근거 |
| 작업이 중단되어 어디서 이어야 할지 모름 | Artifact 경로, 기준 날짜와 마지막 차단 상태가 요청에 없음 | `content.md`, evidence, decisions, assets와 마지막 상태 보고 확인 | 기존 Artifact와 evidence ID를 지정하고 차단 한 단계만 재개 | `system-designer-12-week-roadmap/content.md를 기준으로 완료된 주차를 보존하고 blocked 항목부터 재개해줘.` | 전체 Canonical Artifact와 완료된 검토 |

이미지 live smoke의 예시 설정은 `gpt-image-2`와 `low`를 사용하지만, 실제 포트폴리오 작업은 검증된 redacted 설정과 비용·권리 결정을 따릅니다. API key 값, 개인 연락처, 타인의 개인정보 또는 회사 비공개 자료를 대화·로그·Artifact에 붙여 넣지 마세요.
