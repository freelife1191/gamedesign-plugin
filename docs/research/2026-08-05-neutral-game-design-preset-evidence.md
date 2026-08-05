# 중립 게임 디자인 preset 근거 지도

## 목적과 경계

이 문서는 승인된 설계 문서에 이미 인용된 공개 자료와 중립 preset의 내부 연결을 기록하는 authoring-only evidence다. 공개 자료에서 일반 원칙만 의역하며, 원문의 고유 문구·도표·이미지·페이지 구성·시각 언어를 복제하지 않는다. 이 연결은 특정 회사의 공식 양식, 인증된 절차 또는 재배포 허가를 뜻하지 않는다.

직접 인용, 원본 도표나 이미지를 산출물에 사용해야 한다면 preset과 분리된 evidence·rights 절차에서 출처, 이용 근거와 승인을 기록한다. 배포 preset과 생성 결과에는 중립 preset ID만 남기고 이 문서의 출처 이름과 URL을 추가하지 않는다. 사용자 입력에 이미 포함된 고유명사를 삭제하는 규칙이 아니라, preset이 새로운 참고 주체의 정체성을 결과에 더하지 않는 규칙이다.

## 승인 출처와 중립 연결

| 승인 설계에 인용된 공개 자료 | 설계에서 이미 추출한 일반 원칙 | 의역·권리 경계 | 연결되는 중립 preset |
| --- | --- | --- | --- |
| [Prince of Persia 2 Project Bible](https://www.jordanmechner.com/downloads/library/pop2bible.pdf) | 버전, 교체 페이지와 공통 참조 구조로 문서 간 일관성을 유지한다. | 원문 표현, 페이지 구성, 삽화와 고유 명칭을 가져오지 않는다. | `cinematic-narrative`, `evolving-world` |
| [GDC Single-Player RTS Design](https://media.gdcvault.com/gdc07/slides/S4607i1.pdf) | 짧은 방향 정의에서 상세 설계와 반복 검토로 진행한다. | 발표 순서, 슬라이드 구성, 문장과 시각 요소를 재현하지 않는다. | `player-validated-small-team`, `function-first` |
| [GDC Level and Quest Design Collaboration](https://media.gdcvault.com/gdc2024/Slides/GDC%2Bslide%2Bpresentations/Shen_Will_LevelandQuest.pdf) | 퀘스트, 공간, 전투, 인물과 서사의 교차 의존성을 검토한다. | 발표 자료의 사례, 장면, 도식과 표현을 복제하지 않는다. | `cinematic-narrative`, `replayable-coop` |
| [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/xbox/accessibility/guidelines) | 목표, 범위 질문, 구현 지침과 플레이어 영향을 연결해 검토한다. | 지침의 예시나 문구를 preset 문장으로 옮기지 않는다. | `function-first`, `player-validated-small-team` |
| [Steamworks Microtransactions Implementation Guide](https://partner.steamgames.com/doc/features/microtransactions/implementation?l=english) | 주문, 항목, 통화, 환불, 회수와 감사 상태를 실행 계약으로 명시한다. | 플랫폼 고유 용어, 화면, 흐름과 구현 예시를 복제하지 않는다. | `competitive-live-service`, `ugc-production-tooling` |
| [Valve Left 4 Dead GDC 발표](https://steamcdn-a.akamaihd.net/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf) | 플레이 약속에서 핵심 반복, 읽을 신호와 검증 질문을 연결한다. | 게임 고유 상황, 명칭, 문구, 도식과 슬라이드 구성을 사용하지 않는다. | `replayable-coop` |
| [Riot Champion Insights: Rell](https://www.leagueoflegends.com/en-us/news/dev/champion-insights-rell/) | 설계 의도와 기능, 플레이어가 읽을 신호와 검토 결과를 연결한다. | 캐릭터, 세계관, 능력, 이미지와 고유 표현을 사용하지 않는다. | `function-first`, `cinematic-narrative` |
| [Blizzard Overwatch 2 Beta Analysis](https://news.blizzard.com/en-us/article/23787377/overwatch-2-pvp-beta-analysis-how-data-and-community-feedback-inform-game-balance) | 플레이 관찰과 지표를 조정 판단 및 후속 검증과 연결한다. | 게임 수치, 화면, 영웅, 고유 분류와 분석 문구를 재사용하지 않는다. | `competitive-live-service`, `player-validated-small-team` |
| [Bungie Director's Cut](https://www.bungie.net/7/en/News/article/48758) | 단기 변화와 장기 목표, 출시 후 조정 이유를 함께 설명한다. | 세계관, 콘텐츠명, 고유 문구와 편집 구성을 재현하지 않는다. | `evolving-world`, `competitive-live-service` |
| [Epic UEFN Notes](https://dev.epicgames.com/documentation/fortnite/using-notes-in-unreal-editor-for-fortnite) | 제작 단계의 전달, 검토와 완료 조건을 실행 흐름에 연결한다. | 도구 이름, 화면, 아이콘, 예제와 사용 절차를 preset에 옮기지 않는다. | `ugc-production-tooling` |

## 배포 연결

이 문서는 `shared/knowledge/reference-index.json`의 대상이 아니며 shared module에 포함되지 않는다. 배포 가능한 것은 `shared/document-quality/presets/`의 중립 계약과 `shared/document-quality/schema/reference-preset.schema.json`뿐이다. preset은 emphasis, review question, 권장 diagram, story hint와 추가 acceptance criterion만 더하며 primary profile의 필수 항목이나 안전 게이트를 제거하지 않는다.
