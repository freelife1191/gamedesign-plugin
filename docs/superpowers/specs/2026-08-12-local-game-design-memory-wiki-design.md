# 로컬 게임 기획 기억 위키 설계

## 문서 상태

- 작성일: 2026-08-12
- 상태: 사용자 승인
- 대상: Game Design Studio, Game Design Career, 공통 런타임과 사용자 가이드
- 기본 정책: 프로젝트별·로컬 전용·승인 기반 기억
- 1차 검색 계층: append-only Markdown 이벤트와 재생성 가능한 JSON 색인 세대

## 결정 요약

Studio와 Career에 가벼운 장기 기억 기능을 추가한다. 기억은 LLM의 내부
상태나 채팅 기록이 아니라 프로젝트 작업 공간에 보관하는 Markdown 위키다.
기준 기획 결과물, 사람이 승인한 결정, 근거가 연결된 플레이테스트와 검토
결과만 기억의 출처가 될 수 있다.

기본 범위는 현재 프로젝트다. 기억 문서는 로컬에만 보관하고 Git, 플러그인
패키지, 원격 서비스로 자동 전송하지 않는다. AI가 추론한 교훈은 후보로만
기록하며 사람이 승인하기 전에는 다음 작업에 적용하지 않는다. 사용자가 직접
밝힌 지속적인 표현·작업 선호는 명시적 사용자 지시라는 근거와 함께 승인된
선호로 기록할 수 있다.

한 번만 추가하는 Markdown 이벤트를 기억의 원본으로 사용하고 JSON 색인 세대는
삭제 후 재생성할 수 있는 검색 캐시로 둔다. SQLite는 1차 구현에서 제외한다. 기억이 없거나 손상돼도 기존
기획, 검토, 이미지, 도식화, 한국어 문장 검수와 내보내기는 계속 동작한다.

## 배경과 설계 근거

`docs/llm-wiki.md`와 `docs/llm-wiki-know-how.md`가 설명하는 원문, 생성 위키,
스키마의 세 계층을 게임 기획 작업에 맞게 축소 적용한다.

- 기준 기획 결과물과 연결된 근거는 변경하지 않는 원문 계층이다.
- `.game-design/memory/`는 LLM이 정리하지만 사람이 읽을 수 있는 기억 위키다.
- 공통 스키마, 검사기와 스킬 계약은 위키의 구조와 상태 전이를 제한한다.

일반적인 개인 위키와 달리 이 기능은 LLM이 모든 내용을 자유롭게 합성하도록
두지 않는다. 기획 결정과 프로젝트 사실을 잘못 기억하면 이후 작업의
할루시네이션을 강화할 수 있기 때문이다. 따라서 출처 해시, 적용 범위, 상태,
만료, 충돌과 사람 승인을 기계적으로 검사한다.

## 목표

1. 연속된 기획 작업에서 승인된 결정과 검증된 교훈을 다시 찾을 수 있다.
2. 사용자가 별도 기억 명령을 배우지 않아도 관련 기억이 조용히 작동한다.
3. 기억이 결과에 영향을 준 경우에는 사용 내역을 짧고 투명하게 알린다.
4. Studio 기획 교훈과 Career 학습·취업 교훈이 잘못 섞이지 않는다.
5. 승인되지 않았거나 오래되거나 출처가 바뀐 기록은 적용하지 않는다.
6. 기억 기능을 환경 설정이나 일회성 요청으로 완전히 끌 수 있다.
7. 기억 장애가 기존 기획 결과물의 작성·검증·내보내기를 막지 않는다.
8. 향후 검색 규모가 커져도 원본 형식을 바꾸지 않고 검색 계층만 교체할 수
   있다.

## 비목표

- 채팅 전체를 자동으로 수집하거나 사용자 행동을 몰래 기록하지 않는다.
- AI가 스스로 만든 교훈을 승인된 사실로 승격하지 않는다.
- 플러그인 설치 폴더에 프로젝트 기억을 저장하지 않는다.
- 기억 문서를 자동 커밋하거나 원격 저장소·클라우드로 동기화하지 않는다.
- 기억을 근거 대신 사용하거나 사람의 기획 승인을 대신하지 않는다.
- 1차 구현에 SQLite, 임베딩, 벡터 검색, 별도 검색 서버를 넣지 않는다.
- 프로젝트별 기억을 자동으로 작업 공간·전역 기억으로 승격하지 않는다.
- 새 기억 전용 에이전트를 추가하지 않는다.

## 검토한 접근

### Markdown 위키만 사용

`index.md`, `log.md`와 기억 이벤트만 읽는 가장 단순한 방식이다. 사람이 바로
열어볼 수 있고 추가 런타임이 없지만, 문서가 늘어나면 매번 전체 파일에서 ID,
상태, 범위와 출처를 확인해야 한다. 작은 실험에는 적합하지만 제품 계약으로는
검색과 중복 검사가 약하다.

### Markdown 원본과 재생성 가능한 JSON 색인

Markdown 이벤트를 유일한 원본으로 두고 결정적 접기(`fold`)가 현재 `head`와 JSON 색인
세대를 생성한다. 사람이 읽는 기록과 기계 검색을 분리하며, 색인이 손상돼도
원본에서 다시 만들 수 있다. Node `>=18` 표준 라이브러리만 사용하고 런타임
compiler나 외부 의존성을 추가하지 않는다. 이 방식을 채택한다.

### Markdown과 SQLite를 처음부터 사용

복합 검색과 대규모 자료에는 유리하지만 DB 잠금, 손상 복구, 마이그레이션,
플랫폼별 설치와 Node 버전 호환 계약이 추가된다. 현재 제품의 Node 요구 사항은
`>=18`이고 내장 `node:sqlite`는 이 범위를 모두 지원하지 않으므로 1차 범위에서
제외한다.

## 전체 아키텍처

```text
사용자 요청
   │
   ▼
기억 설정과 일회성 제외 요청 확인
   │
   ├─ 기억 끔 ───────────────────────────────┐
   │                                         │
   ▼                                         │
승인된 관련 기억 검색                        │
- 현재 범위                                  │
- 출처·만료·충돌 검증                       │
- 최대 5개                                   │
   │                                         │
   └─────────────────────┬───────────────────┘
                         ▼
기존 Studio·Career 오케스트레이터
- 전문 스킬과 검토 역할 선택
- 기준 기획 결과물 작성
- 한국어 문장 검수
- 도식·이미지·내보내기 처리
                         │
                         ▼
기준 기획 결과물 검증과 사람 결정
                         │
                         ▼
의미 있는 사건만 기억 후보로 정리
- 명시적 지속 선호
- 승인·수정·보류된 결정
- 근거가 있는 플레이테스트·검토 결과
- 기존 교훈을 대체하거나 반박하는 결과
                         │
                         ▼
로컬 기억 이벤트 append·색인 세대 생성·짧은 사용 기록
```

기억은 검색 보조 계층이다. 결과 문서가 로컬 기억에만 의존하면 안 된다.
프로젝트 사실이나 결정이 결과에 영향을 주면 원래의 `evidence.yml` 또는
`decisions/` 근거를 결과물에도 연결한다. 기억이 삭제돼도 기준 기획 결과물은
독립적으로 이해하고 검증할 수 있어야 한다.

## 저장 위치와 범위

### 프로젝트와 작업 공간

프로젝트와 작업 공간 범위는 현재 작업 공간 안의 같은 기억 저장소를 사용한다.
`project_id` 필터가 적용 범위를 구분한다.

`project_id`는 기존 기준 기획 결과물의 프로젝트 ID를 우선 사용하고, 없으면
사용자가 명시한 프로젝트 ID를 사용한다. 둘 다 없으면 새 ID를 추측하거나
대화 내용에서 임의 생성하지 않는다. 해당 실행에서는 프로젝트 기억 검색과
후보 작성을 건너뛰고 프로젝트 식별이 필요하다는 비차단 안내만 남긴다.

```text
<store-root>/
└── v1/
    ├── events/
    │   └── <memory-shard>/<memory-id>/<event-id>/
    │       ├── instances/<instance-id>.md
    │       ├── claims/<instance-id>.json
    │       └── commit.json
    ├── controls/
    │   └── quarantine/<target-shard>/<target-event-id>/<marker-event-id>/
    │       ├── instances/<instance-id>.md
    │       ├── claims/<instance-id>.json
    │       └── commit.json
    └── derived/
        ├── .reservations/global/<00000..09999>.json
        ├── indexes/<source-tree-sha256>/<index-sha256>/
        │   ├── instances/<instance-id>.json
        │   └── _slots/<000..255>.json
        ├── receipts/<request-sha256>/<receipt-sha256>/
        │   ├── instances/<instance-id>.json
        │   └── _slots/<000..255>.json
        ├── views/<source-tree-sha256>/<view-sha256>/
        │   ├── instances/<instance-id>.md
        │   └── _slots/<000..255>.json
        └── logs/<source-tree-sha256>/<log-sha256>/
            ├── instances/<instance-id>.md
            └── _slots/<000..255>.json
```

`memory-shard`는 `sha256(memory_id).slice(0, 2)`다. 이벤트 ID는 정규화한 UTF-8
Markdown bytes에서 계산한 `mev1-<sha256>`이다. 논리 record에는 `event_id`와
`event_sha256`을 넣지 않으며 validator는 두 필드를 알 수 없는 key로 거부한다.
이렇게 해야 event ID를 계산할 Markdown이 자기 해시를 포함하는 순환을 피한다.
`instance-id`는 `randomUUID()`로 만든다. 같은 논리 결과를 여러 프로세스가 동시에
생성할 때 물리 파일을 구분할 뿐 record, event ID와 색인 내용에는 들어가지
않는다. 상태별 디렉터리와 current pointer는 두지 않는다. 경로는 권한이나
상태를 나타내지 않으며, 유효한 이벤트 DAG를 fold한 head가 현재 상태다.

Markdown 이벤트와 quarantine marker만 감사 가능한 영구 기록이다. `derived/`
아래 JSON과 Markdown 세대는 모두 삭제 가능한 캐시이며 원본을 대신하지 않는다.

- `project`: 현재 `project_id`와 공통 프로젝트 사실만 검색한다.
- `workspace`: 같은 작업 공간에 있는 여러 `project_id`의 승인 기록을 검색할
  수 있다. 기록의 `scope`가 `workspace`인 경우만 공유한다.
- `global`: 사용자가 명시적으로 전역 범위를 선택한 기록만 운영체제별 로컬
  데이터 디렉터리에서 검색한다. 프로젝트 기록을 자동 복사하지 않는다.

전역 저장소는 네트워크 위치를 허용하지 않는 고정 로컬 경로를 사용한다.
운영체제별 사용자 데이터 디렉터리를 결정할 수 없으면 전역 범위를 사용하지
않고 `project`로 축소한다. 사용자가 임의 절대 경로를 환경 변수로 주입하는
기능은 제공하지 않는다.

### 로컬 Git 제외

기본 `local` 모드에서는 기억 이벤트 append가 성공한 뒤 별도 best-effort 단계로
현재 Git 저장소의 `.git/info/exclude`에 플러그인 소유 표식 블록만 추가한다.

```gitignore
# game-design-plugin:memory:start
/.game-design/
# game-design-plugin:memory:end
```

- 기존 제외 규칙을 수정하거나 정렬하지 않는다.
- 같은 표식 블록을 중복 추가하지 않는다.
- Git 저장소가 아니면 아무 Git 설정도 변경하지 않는다.
- 플러그인 업데이트·제거는 `.game-design/`을 삭제하지 않는다.
- `tracked` 모드는 기억을 자동 커밋하지 않는다.
- 표식 제거는 명시적인 기억 관리 작업에서만 수행한다.

repo별 `.git/info/.game-design-memory-exclude.lock`를 `open('wx')`로 만든
프로세스만 기존 파일을 제한된 크기로 읽고 표식이 없을 때 끝에 한 번 append한
뒤 sync한다. lock 충돌·stale lock·사용자 파일 변화·잘못된 표식은 warning으로
건너뛴다. Git 제외 실패는 이미 저장한 기억 이벤트를 rollback하거나 다시 쓰지
않는다. 이 경로는 기억 이벤트 저장 계약과 신뢰 경계를 공유하지 않는다.

### 변경 불가 추가와 동시 실행

권한이 있는 final 경로를 `O_EXCL`로 직접 쓰지 않는다. write·sync 도중 프로세스가
중단되면 partial 파일이 content-addressed 경로를 영구 점유해 같은 event를 다시
쓸 수 없기 때문이다. `appendMemoryEvent`와 `appendQuarantineMarker`는 다음 sealed
instance protocol을 사용한다.

1. 경로와 크기를 검사하고 기존 ancestor를 `lstat`과 `realpath`로 확인한다.
2. `randomUUID()`로 고른 `instances/<instance-id>.md`를 mode `0o600`,
   `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW`로 연다. write loop, `FileHandle.sync()`,
   close를 마친 뒤 bytes의 event ID·schema를 다시 검증한다.
3. event ID, instance ID, file SHA-256과 byte length만 담은 canonical JSON claim을
   `claims/<instance-id>.json`에 같은 방식으로 완전히 쓰고 sync한다. claim은
   key 순서가 `schemaVersion`, `eventId`, `instanceId`, `fileSha256`, `byteLength`인
   공백 없는 JSON object와 trailing LF 한 개다. `schemaVersion`은 1이다.
4. 완전히 sync한 claim에 `link(claimPath, commit.json)`을 호출한다. 같은
   filesystem의 hard link 생성은 create-once commit 지점이다. 성공 후 event
   디렉터리를 best-effort sync하고 read-back 검증을 통과해야 `created`다.
5. `EEXIST`이면 기존 `commit.json`, 가리키는 instance와 canonical bytes를 bounded
   read로 검증한다. 모두 같으면 `present`, 하나라도 다르면 conflict다.

instance나 claim 쓰기 중 중단되면 `commit.json`이 없으므로 scanner가 무시한다.
재시도는 새 instance ID를 사용한다. claim이 완전히 sync된 뒤 hard link가
생기므로 partial commit marker는 존재할 수 없다. commit 뒤 instance·claim·marker
중 하나라도 없거나 hash·length·schema가 다르면 해당 memory를 fail-closed한다.
scanner는 유효한 `commit.json`이 seal한 instance만 논리 event나 control로 인정한다.

Studio와 Career가 동시에 같은 이벤트를 쓰면 한 프로세스만 hard link 생성에
성공해 `created`를 받고 loser는 기존 commit을 검증해 `present`를 받는다. 서로
다른 이벤트는 모두 남아 fold에서 선형 head나 branch로 판정한다. plugin API는
source event와 control에 truncate, rename, unlink를 호출하지 않는다.

### 공개 저장·접기 API

다음 공개 형태를 사용한다.

```js
memoryEventRelativePath({ memoryId, eventId }) -> string
stageImmutableMemoryFile({ store, relativePath, bytes }) -> Promise<{ instancePath, fileSha256, byteLength }>
parseMemoryEventDocument(source, { sourceName, eventId }) -> { event, record, sections }
appendMemoryEvent({ store, eventDocument }) -> Promise<{ status, eventId, relativePath, fileSha256 }>
scanMemoryEvents({ store, maxEventBytes = 262144, maxEvents = 10000 }) -> Promise<MemoryEventScan>
foldMemoryEvents(scan, { now }) -> MemoryFold
appendQuarantineMarker({ store, targetMemoryId, targetEventId, targetRelativePath, observedSha256, reasonCode, actor, now }) -> Promise<AppendResult>
publishMemoryIndexGeneration({ store, indexBytes, sourceTreeSha256, limits }) -> Promise<{ complete, status: "created"|"present"|null, generationPath: string|null, indexSha256: string|null, warnings }>
loadCurrentMemoryIndex({ store, fold, limits }) -> Promise<{ complete, index: object|null, bytes: Buffer|null, sourceTreeSha256: string|null, indexSha256: string|null, warnings }>
publishMemoryReceiptGeneration({ store, receiptBytes, requestSha256, limits }) -> Promise<{ complete, status: "created"|"present"|null, generationPath: string|null, receiptSha256: string|null, warnings }>
loadMemoryReceipt({ store, requestSha256, receiptSha256, limits }) -> Promise<{ complete, status: "ready"|"missing"|"corrupt"|null, receipt: object|null, bytes: Buffer|null, warnings }>
listMemoryReceipts({ store, requestSha256, maxItems = 256, limits }) -> Promise<{ complete, items: ReceiptHistoryMetadata[], warnings }>
publishMemoryViewGeneration({ store, viewBytes, sourceTreeSha256, limits }) -> Promise<DerivedPublishResult>
loadMemoryView({ store, sourceTreeSha256, viewSha256, limits }) -> Promise<DerivedLoadResult>
publishMemoryLogGeneration({ store, logBytes, sourceTreeSha256, limits }) -> Promise<DerivedPublishResult>
loadMemoryLog({ store, sourceTreeSha256, logSha256, limits }) -> Promise<DerivedLoadResult>
scanDerivedGenerations({ store, limits }) -> Promise<DerivedGenerationScan>
rebuildMemoryIndex({ workspaceRoot, config, now }) -> Promise<MemoryIndex>
```

`DerivedPublishResult`는 `{ complete, status: "created"|"present"|null,
generationPath: string|null, generationSha256: string|null, warnings }`, `DerivedLoadResult`는
`{ complete, status: "ready"|"missing"|"corrupt"|null, bytes: Buffer|null,
generationPath: string|null, warnings }`로 닫는다. census 또는 quota가 불완전하면
`complete:false`, status와 path는 `null`이며 loader/list의 object·bytes·items는
각각 `null`, `null`, `[]`다.

`resolveMemoryStore`, immutable bounded `readMemoryFile`, `parseMemoryDocument`,
`validateMemoryRecord`, `validateMemoryTransition`, `validateMemorySourceBindings`는
유지한다. `captureDesignMemory` 결과의 `created|present|conflict` 의미도 유지한다.
`maintainDesignMemory`의 approve·reject·sweep는 transition 이벤트를 append하고,
quarantine은 marker를 append한다.

`MEMORY_PLATFORM_CAPABILITIES`, `createMemoryStorePlatformAdapter`,
`writeMemoryFileAtomic`, `moveMemoryFileAtomic`, `memoryRecordRelativePath`와
`memory-store-posix-helper.c`는 구현 후 공개 surface에 남기지 않는다. runtime
C compiler, 외부 helper, replace, move, 상태별 경로 또는 current pointer에
의존하지 않는다. `ensureMemoryGitExclusion`은 별도 best-effort trust path로만
유지한다.

### 손상, 논리 격리와 색인 세대

scanner는 손상 항목의 안전한 상대 `path`, `reasonCode`, 가능한 경우
`observedSha256`만 보고한다. raw bytes와 절대 경로를 오류에 넣지 않는다. 유효한
이벤트가 손상되면 그 memory 전체를 검색에서 제외하지만 관련 없는 memory는
계속 fold한다.

`maxEvents` 기본값과 hard maximum은 모두 10,000이다. 호출자는 1~10,000만 줄일
수 있고 그 밖의 값은 scan 전에 거부한다. 이 예산은 `events/`와
`controls/quarantine/` 아래에서 만난 directory, regular file, symlink와 special
entry를 유효 여부와 seal 여부에 관계없이 하나씩 센다. 10,001번째 entry를
처리하기 전에 `complete:false`, `memory.scan_limit_exceeded`로 중단한다. scan이
불완전하면 그 store 전체를 승인 검색·색인 publish에 사용하지 않는다. 한도 뒤에
있는 무효화 transition을 놓치고 이전 approved head를 되살리는 경로는 없다.
`MemoryEventScan`은 `complete`, `entriesScanned`, `events`, `controls`, `diagnostics`를
반환하며 `entriesScanned`는 10,000을 넘지 않는다.

격리는 원본 이동이 아니라 `controls/quarantine/`에 sealed immutable Markdown
marker를 append하는 작업이다. marker에는 target memory ID, target event ID와
상대 경로, observed digest 또는 `null`, reason code, actor, `recorded_at`만 둔다.
marker ID는 canonical marker Markdown bytes의
`qmv1-<sha256>`이며 event와 같은 sealed instance protocol을 쓴다.
유효한 marker 하나가 있으면 해당 `memory_id` 전체를 영구 fail-closed 격리한다.
이전 approved ancestor와 이후 event도 검색·
색인·resolution 입력으로 돌아올 수 없다. v1에는 `unquarantine`과 `repair`가
없다. 복구가 필요하면 출처와 감사 연결을 갖춘 새 `memory_id`의 capture event를
만들어야 하며, 격리된 DAG를 parent로 참조할 수 없다. 원본 bytes와 marker는
그대로 보존한다.

`sourceTreeSha256`은 정렬된 `(relativePath, observedSha256, classification)`
tuple의 canonical JSON hash다. `v1/events/`와 `v1/controls/`만 입력이며 손상
항목도 트리 정체성에 포함한다. `v1/derived/indexes|receipts|views|logs`는
`sourceTreeSha256`에서 제외해 파생물이 자기 source identity를 바꾸지 않게 한다.
`rebuildMemoryIndex`는 매번 raw 이벤트와 marker를 scan/fold해 canonical index
bytes와 `indexSha256`을 만들고 새 generation을 create-once로 publish한다. current
pointer는 없다. fresh fold의 두 hash와 모두 일치하는 valid generation만 현재
색인으로 보며 여러 instance가 있으면 bytewise-lowest 경로를 읽는다. 없거나
모두 손상됐으면 새 instance를 append한다. `index.md`와 `log.md`도 같은 규칙을
따르며 UUID와 실행 시각은 논리 bytes에 넣지 않는다.

### JSON receipt와 Markdown log 분리

retrieval 사용 기록은 JSON receipt generation이다. receipt의 논리 identity는
`(requestSha256, receiptSha256)` pair다. `requestSha256`은 정규화된 사용자 request
context만 식별하며 다음 canonical JSON bytes의 SHA-256이다.

```json
{"schemaVersion":1,"projectId":"wind-island","lane":"studio","artifactIds":["combat-loop-v3"],"artifactTypes":["character-skill-combat-monster"],"tags":["boss","counterplay"]}
```

request identity와 receipt는 NFC string, UTF-8, 정렬·중복 제거 array, schema key
순서, 공백 없는 JSON object와 trailing LF 한 개로 직렬화한다. receipt key 순서는
`schemaVersion`, `requestSha256`, `sourceTreeSha256`, `projectId`, `lane`, `policy`,
`observations`, `applied`, `excluded`다. `policy`는 `scope`, `maxItems`,
`candidateTtlDays` 순서다. `observations` 항목은 `memoryId`, `artifactId`, `locator`,
`expectedSha256`, `observedSha256`, `status` 순서다. `observedSha256`은 source가
없을 때만 `null`이고 status는 `current|missing|drift|symlink|unreadable` 중 하나다.
`applied` 항목은 `memoryId`, `headEventId`, `fileSha256`, `excluded` 항목은
`memoryId`, `reason` 순서다. observations는 `(memoryId, artifactId, locator)`, 나머지
두 array는 `memoryId`의 UTF-8 byte 순으로 정렬한다. schema validation을 통과한
canonical receipt 전체 bytes에서 `receiptSha256`을 계산한다.

```json
{"schemaVersion":1,"requestSha256":"0968f05ea689b0628fd0e7857c397c5c40d6662f3b7eaeb250e37999a4aba4e6","sourceTreeSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","projectId":"wind-island","lane":"studio","policy":{"scope":"project","maxItems":5,"candidateTtlDays":30},"observations":[{"memoryId":"memory-studio-design-lesson-0f2a4c61d9ab34ef","artifactId":"playtest-session-04","locator":"evidence.yml#finding-07","expectedSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","observedSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","status":"current"}],"applied":[{"memoryId":"memory-studio-design-lesson-0f2a4c61d9ab34ef","headEventId":"mev1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","fileSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}],"excluded":[{"memoryId":"memory-studio-design-lesson-old","reason":"stale-source"}]}
```

위 request fixture의 exact `requestSha256`은
`0968f05ea689b0628fd0e7857c397c5c40d6662f3b7eaeb250e37999a4aba4e6`이다. 같은
request hash를 receipt 본문에 넣어 schema와 canonical key order를 적용한 예시의
exact `receiptSha256`은
`bd0c7ff75debd6e3abdc1607cde38b2e249f0cb5eba2d930b46b5ea3e96de358`이다.

receipt는
`derived/receipts/<request-sha256>/<receipt-sha256>/instances/<randomUUID>.json`에
create-once publish한다. 앞선 publish가 끝난 뒤 같은 pair를 순차 재시도하면 bounded
census에서 valid canonical bytes를 찾아 새 파일 없이 `present`와 기존
bytewise-lowest path를 반환한다. 없을 때만 새 UUID instance를 만든다.

같은 request 아래 서로 다른 `receiptSha256`는 정상 append-only history다. maxItems,
관찰한 source tree, source digest drift, expiry boundary나 적용 결과가 달라지면 새
receipt가 공존한다. receipt는 실제 판단에 사용한 `sourceTreeSha256`, `policy`와
source binding별 expected/observed digest·상태, applied/excluded 결과를 기록한다.
반면 request identity에는 관찰 상태, runtime config, `now`와 결과를 넣지 않아
request hash를 현재값 권한으로 오인하지 않는다.

`loadMemoryReceipt`는 exact `(requestSha256, receiptSha256)`만 읽는다. path에 적힌
receipt hash와 canonical bytes hash·schema가 모두 맞는 valid instance가 있으면
`ready`, instance가 없으면 `missing`, instance는 있지만 모두 hash/schema가 틀리면
`corrupt`다. 다른 receipt hash는 이 결과에 영향을 주지 않는다.
`listMemoryReceipts`는 request 아래 receipt hash별 valid/corrupt instance count와
bytewise-lowest valid 상대 path만 UTF-8 byte 순으로 반환한다. 각
`ReceiptHistoryMetadata`는 `receiptSha256`, `status: "valid"|"corrupt"`,
`validInstanceCount`, `corruptInstanceCount`, `firstValidRelativePath: string|null`만
포함한다. valid instance가 하나라도 있으면 `valid`, 없으면 `corrupt`다. winner나
현재값은 선택하지 않는다.

Markdown log는 receipt가 아니다. raw event/control fold에서 source
`effective_at|recorded_at` 오름차순, 동률이면 event/marker ID의 UTF-8 byte 순으로
만든 상태 변경 view이며
`derived/logs/<source-tree-sha256>/<log-sha256>/instances/<randomUUID>.md`에 publish한다.
request context, applied/excluded 목록과 derived 실행 시각을 log에 넣지 않는다.

### Derived generation 한도·검증·동시성

파생 내용의 기본값과 hard maximum은 index JSON 1 MiB(1,048,576 bytes), receipt
JSON 256 KiB(262,144 bytes), Markdown view 1 MiB, Markdown log 1 MiB다. index
`entries`는 최대 10,000개, receipt의 `observations`, `applied`, `excluded`는 각각
최대 256개, receipt history 반환은 최대 256개다. 한 logical generation identity의
instance는 최대 256개, 전체 derived cache의 generation instance는 최대 10,000개다.
byte 상한은 JavaScript string length가 아니라 `Buffer.byteLength`와 filesystem
`size` 기준이며 정확히 상한인 값은 허용한다.

API의 `limits`는 `{ maxDirectoryEntries, maxCensusEntries,
maxIdentityInstances, maxGenerationInstances, maxIndexBytes, maxReceiptBytes,
maxViewBytes, maxLogBytes, maxIndexEntries, maxReceiptObservationItems,
maxReceiptAppliedItems, maxReceiptExcludedItems }`다. 생략하면 차례로 256, 100,000,
256, 10,000, 1,048,576, 262,144, 1,048,576, 1,048,576, 10,000, 256, 256,
256을 쓴다. 모두 기본값과 hard maximum이 같으며 호출자는 1 이상의 정수로 낮출
수만 있다. `listMemoryReceipts.maxItems`도 기본값과 hard maximum이 256이다.

index, receipt, view와 log publisher·loader·list는 먼저 공통 bounded census를
완료한다. 모든 directory, regular file, symlink, special entry와 corrupt·oversize
entry를 하나씩 센다. `.reservations/global`은 정확한 5자리 slot 이름을 최대
10,000개까지 허용하는 전용 namespace다. 그 밖의 모든 directory는 direct child
256개, 전체 physical census는 100,000 entries가 hard maximum이다. 257번째 direct
child나 100,001번째 physical entry 전에 `complete:false`와 각각
`memory.derived_directory_limit_exceeded`, `memory.derived_census_limit_exceeded`를
반환한다. global namespace의 잘못된 이름이나 10,001번째 entry도 불완전 scan이다.
불완전하면 publisher는 쓰지 않고 loader/list는 앞서 본 valid generation이나
history도 선택하지 않는다.

count-then-create만으로는 cross-process 상한을 지킬 수 없으므로 publisher는 다음
quota reservation을 사용한다. 입력 byte·array·canonical/schema 검증, bounded
census와 sequential 동일 bytes 탐색을 차례로 마친 뒤 reservation으로 들어간다.

1. `randomUUID()` instance ID를 고르고 `.reservations/global/00000.json`부터
   `09999.json`까지 `open('wx')`로 첫 빈 global slot을 선점한다.
2. global file descriptor를 연 채 해당 identity의 `_slots/000.json`부터
   `255.json`까지 `open('wx')`로 첫 빈 local slot을 선점한다.
3. global reservation에 `globalSlot`, `localSlot:null`, local reservation에 두
   slot 번호를 넣은 canonical JSON을 완전히 쓰고 sync한다. 공통 key 순서는
   `schemaVersion`, `kind`, `identitySha256`, `generationSha256`, `globalSlot`,
   `localSlot`, `instanceId`이며 trailing LF 한 개를 포함해 4 KiB 이하여야 한다.
4. 두 reservation이 sync된 뒤에만 `instances/<instance-id>.(json|md)`를
   `O_CREAT|O_EXCL|O_NOFOLLOW`로 완전히 쓰고 sync한 뒤 read-back 검증한다.

global slot이 없거나 local slot을 잡지 못하면 `complete:false`, status와
generation path는 `null`, warning은 `memory.derived_limit_exceeded`이며 generation
파일을 만들지 않는다. global 선점 뒤 crash, local 선점 실패나 generation write
실패로 남은 reservation은 재사용·삭제하지 않는다. 누수는 사용 가능한 용량만
줄이고 identity 256개·전체 10,000개 상한을 늘리지 못한다. sparse local
reservation 수는 global reservation 수를 넘지 않는다. 회복은 raw event/control을
보존한 채 `derived/` cache 전체를 reset하는 작업으로만 한다.
비어 있거나 oversize·malformed인 reservation과 generation이 없는 reservation도
occupied leak로 세고 `memory.derived_reservation_invalid` warning만 남긴다.
generation 권한은 얻지 못하지만 census 자체를 불완전하게 만들지는 않는다.

reservation의 `kind`는 `index|receipt|view|log`다. `identitySha256`은 각 값을
8-byte unsigned big-endian length로 구분한 tuple
`["memory-derived-identity-v1", kind, ...pathIdentityParts]`의 SHA-256이다.
`pathIdentityParts`는 index/view/log에서 `sourceTreeSha256, generationSha256`,
receipt에서 `requestSha256, receiptSha256`이다. `generationSha256`은 canonical
content hash다.

generation은 짝을 이룬 global/local reservation이 모두 존재하고 kind·identity·
generation·global slot·instance와 path가 맞을 때만 valid다. local reservation의
`localSlot`은 자기 filename과 같아야 한다.
reservation이 하나뿐이거나 불일치·malformed인 instance는 census budget을
소비하는 corrupt generation이며 선택하지 않는다. warning에는 slot 번호, 안전한
상대 path와 reason code만 넣는다.

앞선 동일 bytes publish가 끝난 뒤의 순차 호출은 census에서 valid instance를 찾아
`present`와 bytewise-lowest path를 반환하고 reservation이나 파일을 늘리지 않는다.
반면 같은 census에서 기존 instance를 보지 못한 동시 contender는 각자 quota를
선점해 UUID instance를 만들 수 있다. 여유 quota 안에서 성공한 결과는 모두
`created|present`이고, 같은 bytes instance는 논리적으로 동등하다. 물리 중복은
contender 수를 넘지 않으며 결함이나 conflict가 아니다. loader는 bytewise-lowest
valid path를 읽고, 동시 publish 뒤 순차 재시도는 `present`로 끝난다. identity가
255 slots, global이 9,999 slots인 상태에서 두 contender가 경쟁하면 정확히 하나만
`created`이고 loser는 `complete:false`, `memory.derived_limit_exceeded`다.

publisher는 reservation 전에 입력 byte length와 array 수를 검사한다. 상한을
넘기면 `complete:false`, `memory.derived_input_limit_exceeded`를 반환하고
reservation이나 generation 파일을 만들지 않는다. loader는 entry를 census
budget에 먼저 포함한 뒤 `lstat`으로
regular file과 size를 확인하고, 상한 이하면 `limit + 1` bounded read로 race 중
증가도 잡는다. 이어 UTF-8, JSON/Markdown parse, schema와 array bounds, canonical
bytes, content hash와 claimed path 순으로 검사한다. oversize·symlink·special·
invalid UTF-8·parse/schema/hash 오류는 안전한 상대 path와 reason code만 담은
corrupt warning이며 raw bytes와 절대 경로를 노출하지 않는다. oversize generation의
reason code는 `memory.derived_generation_oversize`다.

census가 완전할 때 exact receipt의 모든 instance가 oversize면
`loadMemoryReceipt`는 `status:corrupt`를 반환한다. index, view와 log loader도
oversize instance를 corrupt로 제외하고 exact logical hash의 다른 valid instance만
bytewise-lowest path로 읽는다. `listMemoryReceipts.maxItems`는 scan hard limit을
늘리지 않고 반환 metadata만 줄인다.

## 기억 이벤트 계약

각 상태 변경은 새 Markdown 이벤트 한 파일로 append한다. 닫힌 envelope에는
`schema_version`, `event_type`, `action`, `memory_id`, `operation_id`, 정렬되고
중복 없는 `parent_event_ids`, `effective_at`, `actor`, `reason`을 둔다.
`resolution`에만 `chosen_parent_event_id`를 허용한다. `action`은 capture에서
`capture`, transition에서 실제 전이 이름, resolution에서 `resolution`이다. 그
아래에는 현재 기억 레코드와 본문 전체를 snapshot으로 넣는다. logical record는
`event_sha256`과 `event_id`를 포함하지 않으며 schema, template과 validator가 두
필드를 거부한다. 여러 출처는 정렬된 `sources` 목록으로 기록한다.

```markdown
---
schema_version: 1
event_type: "capture"
action: "capture"
memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef"
operation_id: "playtest-session-04-finding-07"
parent_event_ids: []
effective_at: "2026-08-12T00:00:00.000Z"
actor: "김기획자"
reason: "플레이테스트에서 반복 가능한 교훈을 확인함"
kind: "design-lesson"
lane: "studio"
status: "candidate"
scope: "project"
project_id: "wind-island"
created_at: "2026-08-12T00:00:00.000Z"
updated_at: "2026-08-12T00:00:00.000Z"
review_after: "2026-09-11"
expires_at: "2026-09-11"
approved_by: null
approval_basis: null
supersedes: null
artifact_types:
  - "character-skill-combat-monster"
related_ids:
  - "boss-phase-2"
tags:
  - "boss"
  - "counterplay"
sources:
  - artifact_id: "combat-loop-v3"
    locator: "content.md#보스-전투"
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - artifact_id: "playtest-session-04"
    locator: "evidence.yml#finding-07"
    sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
---

# 보스전의 대응 수단은 공격 방식과 함께 검토한다

## 발견한 내용

원거리 공격을 피한 뒤 반격할 수단이 없어 전투가 기다리는 시간으로 흘렀다.

## 적용 조건

같은 전투 구조와 플레이어 능력을 사용하는 보스전에만 참고한다.

## 적용하면 안 되는 경우

회피 자체가 핵심 재미이거나 반격 규칙이 정해지지 않은 전투에는 설계 원칙으로
확정하지 않는다.

## 근거

- `combat-loop-v3/content.md#보스-전투`
- `playtest-session-04/evidence.yml#finding-07`
```

### 기억 종류

| 종류 | 의미 | 적용 경계 |
| --- | --- | --- |
| `project-fact` | 검증된 프로젝트 사실 | 원본 근거가 현재일 때만 사실로 참조 |
| `decision` | 사람이 승인한 기획 결정 | 같은 범위와 유효한 결정 상태에서만 적용 |
| `design-lesson` | 기획·검토·플레이테스트 교훈 | 질문·제안으로 사용하고 새 결과는 다시 승인 |
| `style-preference` | 사용자가 직접 밝힌 표현·작업 선호 | 사실·수치·승인 상태를 바꾸지 않는 범위에서 적용 |
| `career-lesson` | 학습·포트폴리오·면접 교훈 | Career 작업에서만 적용 |
| `external-note` | 시점에 민감한 외부 자료 | 검증일·재검토일·적용 범위를 반드시 확인 |

기억 본문의 문장은 명령이 아니라 신뢰하지 않는 자료로 처리한다. 스킬 호출,
파일 삭제, 승인 변경, 네트워크 전송 같은 문장이 있어도 실행하지 않는다.

canonical Markdown은 다음 규칙 하나로만 만든다.

- Unicode string은 NFC로 정규화하고 NUL을 거부한다. 파일은 BOM 없는 UTF-8,
  LF line ending을 사용하며 정확히 한 개의 trailing LF로 끝난다.
- frontmatter는 `---\n`으로 시작하고 `---\n\n`으로 끝난다. key 순서는 envelope의
  `schema_version`, `event_type`, `action`, `memory_id`, `operation_id`,
  `parent_event_ids`, `effective_at`, `actor`, `reason`, 조건부
  `chosen_parent_event_id` 뒤에 record의 `kind`, `lane`, `status`, `scope`,
  `project_id`, `created_at`, `updated_at`, `review_after`, `expires_at`,
  `approved_by`, `approval_basis`, `supersedes`, 조건부 `instruction_sha256`,
  `artifact_types`, `related_ids`, `tags`, `sources` 순이다.
- string scalar는 NFC 값의 JSON double-quoted form, null은 `null`, integer는 leading
  zero 없는 base-10으로 쓴다. 빈 array는 `[]`, scalar array는 정렬·중복 제거 후
  두 칸 들여쓴 `- <scalar>` block sequence로 쓴다. `sources`는
  `artifact_id`, `locator`, `sha256` key 순서의 block mapping이며 tuple의 UTF-8
  byte 순으로 정렬한다. schema가 허용하지 않는 optional key는 쓰지 않는다.
- `effective_at`, `created_at`, `updated_at`은 유효한 timestamp를 파싱한 뒤
  `Date.prototype.toISOString()`의 UTC `YYYY-MM-DDTHH:mm:ss.sssZ` bytes로 쓴다.
  입력 offset 표기는 canonical Markdown에 그대로 남기지 않는다.
- 본문은 `# 제목`, `## 발견한 내용`, `## 적용 조건`,
  `## 적용하면 안 되는 경우`, `## 근거` 순서다. 각 값은 NFC와 LF로 바꾸고 각
  line의 trailing space·tab과 앞뒤 blank line을 제거하되 내부 blank line은
  보존한다. heading과 section 사이에는 빈 줄 하나만 둔다.

event ID는 이 canonical Markdown 전체 bytes의 SHA-256이다. capture의
`operation_id`는 검증된 upstream `eventId`다. transition과 resolution은 다음
length-prefixed tuple로 `mop1-<sha256>`을 만든다. 각 tuple element는 UTF-8 byte
앞에 unsigned 64-bit big-endian byte length를 붙이며, tuple 전체는 별도 구분자
없이 이어 붙인다.

```text
[
  "memory-operation-v1", memory_id, event_type, action, effective_at, actor, reason,
  decimal(parent_count), ...sorted_parent_event_ids, chosen_parent_event_id_or_empty
]
```

operation uniqueness 범위는 `(memory_id, operation_id)`다. 같은 memory 안에서
같은 operation ID와 다른 event bytes가 발견되면 `duplicate-operation` 충돌이며,
다른 memory가 같은 upstream ID를 쓰는 것은 충돌이 아니다. 같은 이벤트 ID와
같은 canonical bytes는 멱등이고, 같은 ID에 다른 bytes가 있거나 commit 경로와
내용 해시가 다르면 `memory.event_conflict`로 제외한다. 기존 bytes는 plugin API로
고치지 않는다.

## 상태 모델

```text
candidate ──근거 확인──> verified ──사람 승인──> approved
    │                         │                     │
    ├─30일 경과──────────────> expired              ├─충돌──> disputed
    └─근거 오류──────────────> rejected             └─대체──> superseded
```

- AI가 추론한 선호와 교훈은 `candidate`까지만 만들 수 있다.
- 사용자가 직접 밝힌 지속적 선호는 `approval_basis`를
  `explicit-user-instruction`으로 기록해 `approved`로 만들 수 있다.
- 기억의 승인은 기준 기획 결과물의 승인과 별개다.
- 플레이테스트·검토 결과는 출처가 있어도 먼저 `candidate`가 된다.
- 승인된 기억이 새 근거와 충돌하면 `disputed`로 바꾸고 양쪽을 적용하지 않는다.
- 다른 기록이 대체하면 원본을 삭제하지 않고 `superseded`로 보존한다.
- 승인되지 않은 후보는 기본 30일 뒤 `expired`가 된다.
- 외부 정보는 `review_after`가 지나면 `stale`로 간주해 검색에서 제외한다.
- 삭제 대신 transition 이벤트와 파생 log 세대를 남긴다. 명시적인 개인정보 삭제 요청은
  별도 안전 삭제 절차로 처리한다.

허용 상태는 `candidate`, `verified`, `approved`, `expired`, `rejected`,
`disputed`, `superseded`, `stale`로 닫는다. capture는 parent가 없는 유일한
root이고 transition은 parent 하나를 참조한다. 동시에 생긴 transition은 두
head로 모두 보존하며 해당 기억 전체를 `concurrent-conflict`로 검색에서 제외한다.
사람이 actor와 reason을 명시한 `resolution`은 작성 시 관찰한 head 집합만 정렬된
parent로 기록하고 `chosen_parent_event_id`를 선택한다. parent는 최소 두 개이며
서로의 ancestor일 수 없다. resolution은 기록한 parent만 소비한다. 작성자가
관찰하지 못한 동시 transition은 별도 head로 남으므로 memory는 계속
`concurrent-conflict`다. 같은 parent 집합에서 두 resolution이 동시에 생겨도 두
resolution head가 모두 남아 conflict다. 새 snapshot은 선택한 head와 같거나, 그
head에서 허용된 전이 하나를 적용한 값이어야 한다.

접기(`fold`)는 sealed event 경로를 NFC/UTF-8 byte 순으로 읽고 commit claim,
파일 이름 해시, 닫힌 schema, 출처와 상태 전이를 검사한다. snapshot의 기억
identity와 본문은 parent와 같아야
하며 허용된 상태·provenance 필드만 바꿀 수 있다. orphan parent, duplicate root,
`(memory_id, operation_id)` 충돌, 불법 전이, supersedes cycle은 excluded conflict다. 순회 순서,
mtime이나 wall clock으로 승자를 정하지 않는다.

## 적용 자격과 검색 순서

다음 조건을 모두 만족하는 기억만 사용할 수 있다.

1. `GAME_DESIGN_MEMORY_ENABLED`가 `true`다.
2. 현재 요청에 일회성 기억 제외 지시가 없다.
3. 상태가 `approved`다.
4. 현재 프로젝트·작업 공간·전역 범위와 일치한다.
5. Studio·Career 작업 영역이 맞다.
6. 모든 출처가 작업 공간 경계 안의 일반 파일이며 SHA-256이 일치한다.
7. 재검토일과 만료일이 지나지 않았다.
8. 해결되지 않은 충돌이 없다.
9. 현재 요청과 연결되는 프로젝트, 결과물 유형, 태그 또는 안정 ID가 있다.

검색 우선순위는 프로젝트 사실, 승인된 결정, 명시적 사용자 선호, 기획 교훈,
외부 자료 순이다. 기본 최대 다섯 건만 읽는다. 단순 키워드 일치만으로 전역
기억을 적용하지 않고 범위와 안정 ID 필터를 먼저 통과시킨다.

## Studio와 Career의 경계

- 프로젝트 목표, 승인된 결정, 검증된 사실과 공통 용어는 두 제품이 함께
  참조할 수 있다.
- 시스템, 콘텐츠, 전투, 경제, 제작 교훈은 Studio 기록으로 분류한다.
- 역량 개발, 포트폴리오, 면접, 학습 계획 교훈은 Career 기록으로 분류한다.
- Career는 승인된 Studio 결과를 근거로 참조할 수 있지만 Studio 원본이나
  기획 결정을 수정하지 않는다.
- Studio는 Career의 취업 전략과 학습 선호를 게임 설계 원칙으로 사용하지
  않는다.
- 공통으로 승격할 때는 새 범위와 적용 한계를 사람이 명시해야 한다.

## 내부 스킬

### `retrieve-approved-design-memory`

- 기억 설정, 프로젝트 ID와 작업 영역을 확인한다.
- raw Markdown 이벤트와 quarantine marker를 scan/fold한 뒤 일치하는 JSON 색인
  세대를 후보 탐색에 사용한다.
- 승인되고 유효한 관련 기록만 최대 설정 개수만큼 반환한다.
- 적용한 기억 ID와 출처 해시를 로컬 작업 기록에 남긴다.
- 기억을 읽지 못하면 경고만 반환하고 기존 기획을 계속한다.

### `capture-game-design-memory`

다음 사건만 기억 후보로 정리한다.

- 사용자가 지속적으로 적용할 선호를 명시했다.
- 사람이 기획 결정을 승인·수정·보류했다.
- 플레이테스트 결과가 기존 가정을 지지하거나 반박했다.
- 검토에서 반복 가능한 문제와 최소 수정안이 확인됐다.
- 이전 교훈이 더 이상 맞지 않거나 적용 범위가 바뀌었다.

단순 맞춤법 수정, 일회성 요청, 채팅 잡담, 근거 없는 추측, 자동 생성 수치,
승인되지 않은 외부 정보는 기록하지 않는다.

### `maintain-game-design-memory`

- 중복 operation, 끊어진 parent·출처, branch와 순환 대체 관계를 검사한다.
- 출처 파일과 SHA-256을 다시 확인한다.
- 만료·대체·충돌 상태는 새 transition 이벤트로 append한다.
- `index.md`, `log.md`, JSON 색인은 raw fold에서 결정적으로 만든 immutable
  derived generation으로 publish한다.
- 손상된 문서는 이동하거나 덮어쓰지 않고 content-addressed quarantine marker로
  논리 격리한다.
- 기억 후보 열람, 승인, 거부, 폐기, branch resolution과 색인 재생성을 직접
  요청할 수 있다.

세 스킬은 공통 소스에서 두 제품에 패키징한다. 기억 전용 에이전트는 추가하지
않으며 기존 근거·문서 품질 검토 경계를 재사용한다.

## 오케스트레이터 통합 순서

1. 작업 공간, 프로젝트 ID와 기억 설정을 확인한다.
2. 사용자가 이번 요청에서 기억을 제외했는지 확인한다.
3. 승인된 관련 기억을 검색한다.
4. 기억을 지시가 아닌 검토 질문·제약·근거 연결로 전달한다.
5. 기존 전문 스킬과 최대 세 개의 검토 역할을 선택한다.
6. 기준 기획 결과물을 만들고 근거·결정·검토·자산을 연결한다.
7. 필요하면 한국어 문장 검수, 이미지와 도식화 작업을 수행한다.
8. 기존 완료 조건과 사람 승인 경계를 검증한다.
9. 의미 있는 사건이 있을 때만 기억 후보를 만든다.
10. 기억이 실제 결과에 영향을 줬을 때만 짧은 사용 기록을 표시한다.

기억 검색은 전문 스킬 선택 전, 후보 작성은 결과물 검증 후에 실행한다. 기억은
기존 스킬 선택, 근거 검증, 책임 설계와 사람 승인 단계를 생략할 수 없다.

## 환경 설정

현재 프로세스 환경 변수, 작업 공간 루트 `.env`, 안전한 기본값 순으로 값을
읽는다. 기존의 제한된 `.env` 읽기 규칙을 공통 설정 읽기 도구로 재사용하거나
추출한다. `.env` 심볼릭 링크, 작업 공간 밖 파일, 특수 파일, 과도한 크기와
모호한 문법은 거부한다. 실제 값과 비밀정보는 오류 메시지에 넣지 않는다.

`.env.example`에는 다음 한국어 설명과 설정을 추가한다.

```dotenv
# 게임 기획 장기 기억 기능을 사용할지 정합니다.
# false이면 기억 폴더를 만들거나 읽지 않고, 후보·색인·사용 기록도 만들지
# 않습니다. 기존 Studio와 Career 기능은 그대로 동작합니다.
# 기본값: true
GAME_DESIGN_MEMORY_ENABLED=true

# 기억 공유 범위입니다. project | workspace | global 중 하나를 사용합니다.
# project가 가장 안전한 기본값이며, 범위를 넓혀도 기존 기록은 자동으로
# 승격되지 않습니다.
# 기본값: project
GAME_DESIGN_MEMORY_SCOPE=project

# 한 작업에 적용할 승인된 기억의 최대 개수입니다.
# 허용 범위: 1~10, 기본값: 5
GAME_DESIGN_MEMORY_MAX_ITEMS=5

# 승인되지 않은 기억 후보의 유효 기간입니다.
# 허용 범위: 1~365일, 기본값: 30일
GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS=30

# local은 .game-design/을 로컬에만 보관합니다.
# tracked는 사용자가 명시적으로 선택한 경우에만 Git 추적을 허용하지만
# 플러그인이 자동 커밋하지는 않습니다.
# 기본값: local
GAME_DESIGN_MEMORY_GIT_MODE=local
```

`GAME_DESIGN_MEMORY_ENABLED`는 정확한 `true` 또는 `false`만 허용한다. 값이
있지만 형식이 잘못됐으면 기억 기능만 끄고 경고한다. 잘못된 범위는 `project`,
잘못된 최대 개수와 후보 기간은 각각 5와 30, 잘못된 Git 모드는 `local`로
축소한다. 설정 오류 때문에 더 넓은 공유나 Git 추적이 켜지는 경우는 없다.

### 완전 비활성화 계약

`GAME_DESIGN_MEMORY_ENABLED=false` 또는 이번 요청의 명시적 기억 제외 지시는
해당 실행에서 다음을 보장한다.

- 기억 저장소를 생성·검색·수정하지 않는다.
- 기존 기억을 프롬프트 문맥에 넣지 않는다.
- 기억 후보, 색인과 사용 기록을 만들지 않는다.
- 기억 관련 Hook 작업을 실행하지 않는다.
- 기억 안내를 출력하지 않는다.
- 기존 Studio·Career 기능과 결과물 형식은 그대로 동작한다.

비활성 상태에서는 범위와 기억 관련 부가 설정 오류로 작업을 막지 않는다.
활성 상태의 잘못된 범위 값은 `global`로 확대하지 않고 `project`로 축소한 뒤
경고한다.

## 로컬 사용 기록

기억이 실제 결과에 영향을 줬을 때만 다음 정보를 짧게 표시한다.

```text
기억 활용: 승인된 프로젝트 교훈 2개 적용
새 기억: 검토가 필요한 후보 1개 생성
제외: 만료 1개, 출처 변경 1개
```

세부 기록은 `v1/derived/receipts/`의 immutable JSON generation으로 append한다.
기억 ID, head event ID와 해시, 적용 정책, source binding 관찰값과 적용·제외 이유만
포함하며 기억 본문, `.env` 원문, 비밀정보와 derived 생성·실행 시각을 복제하지
않는다. 허용 필드는
`schemaVersion`, `requestSha256`, `sourceTreeSha256`, `projectId`, `lane`,
`policy{scope,maxItems,candidateTtlDays}`, `applied`의
`memoryId|headEventId|fileSha256`, `excluded`의 `memoryId|reason`, `observations`의
`memoryId|artifactId|locator|expectedSha256|observedSha256|status`로 닫는다.
기억을 사용하지 않았으면 별도 안내나 영수증을 만들지 않는다.

event의 `effective_at`, record의 `created_at|updated_at`, quarantine marker의
`recorded_at`은 입력 Markdown에 포함된 원천 시간이라 source ID와 fold의 일부다.
derived log가 사건 순서를 보여 줄 때는 이 원천 값을 그대로 투영할 수 있다.
반면 rebuild·retrieve·publish 실행 시각,
`now`, `generatedAt`, `recordedAt`, `sourceUpdatedAt`은 receipt·log·index·view의
논리 bytes에 넣지 않는다.

## 오류 처리

| 상황 | 처리 |
| --- | --- |
| 기억 폴더 없음 | 첫 기록이 생길 때만 초기화 |
| JSON 색인 세대 없음·손상 | raw Markdown 이벤트 fold에서 새 세대 생성 |
| Markdown 이벤트 손상 | 원본은 그대로 두고 marker로 논리 격리 |
| 원본 파일 없음 | `stale`로 표시하고 제외 |
| 출처 해시 불일치 | 자동 갱신하지 않고 재검토 대상으로 전환 |
| 승인 기록끼리 충돌 | 둘 다 적용하지 않고 결정 항목 생성 |
| 기억 저장 실패 | 완성된 기획 결과물을 보존하고 경고 |
| 잘못된 환경 설정 | 범위를 축소하거나 기억 기능만 중지 |
| 비밀정보·개인정보 탐지 | 저장을 거부하고 값을 출력하지 않음 |
| 저장소가 너무 큼 | scan 중단, `complete:false`, 해당 store 전체의 승인 검색·색인 publish 제외, 유지 관리 필요 상태 표시 |

기억 장애는 기본적으로 기존 기획을 계속하는 `fail-open` 보조 기능이다. 다만
기억을 적용했다고 주장하는 경로는 ID, 상태, 범위와 출처 검증이 하나라도
실패하면 `fail-closed`한다. 손상된 기억을 조용히 사용하지 않는다.

## Hook 경계

현재 `SessionStart`와 `Stop` Hook은 선택 기능이며 출력 구조가 엄격히 고정돼
있다. 1차 구현은 Hook 계약을 변경하거나 기억 쓰기를 Stop Hook에 넣지 않는다.
기억 검색과 후보 작성은 오케스트레이터와 내부 스킬만으로 완결한다. 향후 Hook
지원이 필요하면 별도 계약 버전에서 읽기 전용 준비 작업만 검토한다.

## 공통 패키지 배치

```text
shared/memory/
├── skills/
│   ├── retrieve-approved-design-memory/
│   ├── capture-game-design-memory/
│   └── maintain-game-design-memory/
├── schema/
│   ├── memory-record.schema.json
│   ├── memory-event.schema.json
│   ├── memory-index.schema.json
│   └── memory-receipt.schema.json
├── references/
│   ├── memory-policy.md
│   └── memory-lifecycle.md
└── templates/
    ├── memory-record.md
    ├── index.md
    └── log.md

shared/scripts/
├── load-memory-config.mjs
├── retrieve-design-memory.mjs
├── capture-design-memory.mjs
├── maintain-design-memory.mjs
└── validate-design-memory.mjs
```

공통 계약과 빌더에 `memory` 모듈을 추가한다. 두 제품은 같은 스키마·스크립트·
스킬을 설치하며 제품별 라우팅과 오케스트레이터에서 lane만 구분한다. 생성본인
`plugins/*`는 원천과 빌더를 수정한 뒤 표준 빌드로 한 번에 갱신한다.

## 보안과 개인정보

- 반드시 차단한다: 절대 경로, `..`, 역슬래시, NUL, 비-NFC 경로와 lexical
  escape, 기존 root·ancestor·final symlink, 특수 파일, 크기·항목 수 고갈.
- plugin API는 source event·control을 overwrite·delete하는 기능을 제공하지 않고
  truncate·rename·unlink를 호출하지 않는다. 외부 프로세스의 파일 변경이나 삭제
  자체를 막는다고 주장하지 않으며, 사전·사후에 관찰한 identity·hash·seal 변화는
  fail-closed한다.
- 같은 이벤트 ID의 bytes 불일치, `(memory_id, operation_id)` 중복 충돌, 잘못된
  DAG·상태 전이·provenance·source binding을 거부한다.
- Studio와 Career 동시 append에서 이벤트를 잃지 않는다. 손상된 derived index가
  권한을 얻거나 Git 표식 갱신이 사용자 파일을 truncate하지 못하게 한다.
- derived quota는 global-first/local-second create-once reservation으로
  count-then-create race에서도 identity 256개·전체 10,000개를 넘지 않는다.
- 파일은 lstat size 뒤 제한된 크기로 읽고 기억 항목 수, 파생 array와 전체 문맥
  바이트를 제한한다. 오류에는 raw bytes와 절대 경로를 넣지 않는다.
- API 키, 토큰, 자격 증명, 개인 식별 정보와 원문 전체 복사를 저장하지 않는다.
- 기억 본문을 실행 가능한 명령, 스킬 선택 강제 또는 승인 지시로 해석하지
  않는다.
- 상태 변경은 허용된 전이와 명시적 사용자 결정만 수락한다.
- 전역 범위는 명시적으로 승인된 기록만 포함하고 프로젝트 기록을 자동
  전송하지 않는다.
- 로컬 기억은 이미지 생성, Archify, Skillstead, 외부 API의 입력으로 자동
  전달하지 않는다.

같은 OS 계정의 악의적 프로세스가 `lstat`, `realpath`, `mkdir`, `open` syscall
사이에 디렉터리를 rename하거나 symlink로 바꾸는 공격은 명시적 non-goal이다.
그 프로세스는 같은 계정의 파일을 직접 수정할 권한도 있으므로 Node 18 path
API만으로 descriptor-relative 보장을 제공하지 않는다. 관찰 가능한 사전·사후
identity 변화는 계속 fail-closed하지만, 이 syscall 사이 race까지 차단한다고
테스트나 문서에서 주장하지 않는다.

## 테스트 전략

### 설정

- 설정 없음에서 `enabled=true`, `scope=project`, 최대 5개, 후보 30일,
  `gitMode=local`을 반환한다.
- 프로세스 환경, `.env`, 기본값의 우선순위를 확인한다.
- `enabled=false`와 일회성 제외에서 기억 저장소 입출력이 0회다.
- 잘못된 값이 전역 범위나 과도한 한도로 확대되지 않는다.
- `.env.example`의 설명·허용 값과 실제 스키마가 일치한다.

### 저장소와 상태

- 동일 이벤트를 두 프로세스가 append하면 하나는 `created`, 하나는 `present`이며
  bytes가 같은지 확인한다. 같은 경로의 다른 bytes는 원본을 보존하고 conflict다.
- instance·claim write와 sync, commit hard link 전후에 프로세스를 중단한다. unsealed
  partial은 권한을 얻지 못하며 같은 event 재시도가 `created|present`로 회복되는지
  확인한다.
- 서로 다른 동시 이벤트가 모두 남고, 같은 parent의 approve/reject branch는
  검색에서 제외되며 사람이 만든 resolution이 기록한 branch head만 소비하는지
  확인한다.
- transition과 resolution, resolution 두 개가 동시에 생기면 resolution이 기록한
  parent만 소비하고 새 event는 별도 head로 남아 conflict인지 확인한다.
- 중복 operation, 알 수 없는 필드·상태·종류, orphan parent와 순환 대체 관계를
  거부한다.
- 후보가 적용되지 않고 승인 기록만 적용되는지 확인한다.
- 만료, 출처 변경, 충돌과 대체 기록이 검색에서 제외되는지 확인한다.
- 손상·누락·복수 색인 세대는 raw fold에서 byte-identical 논리 색인으로 복구하고
  기존 세대를 수정하지 않는지 확인한다.
- receipt canonical JSON의 schema·key order·trailing LF와
  `requestSha256|receiptSha256`를 exact 비교한다. 같은 request/same bytes generation은
  순차 재시도에서 기존 valid instance를 `present`로 반환해 물리 파일이 늘지 않는지
  확인한다. 같은 request에서 적어도 한 건은 계속 적용한 채 maxItems 변경, source
  digest drift와 expiry boundary로 생긴 서로 다른 valid receipt는 정상 이력으로
  공존한다. 각 receipt의 policy와 source observation이 실제 판단 입력과 일치하고
  exact pair loader와 bounded history list가 winner나 현재값을 고르지 않는지
  확인한다.
- index·receipt·view·log의 동일 bytes를 quota 여유 상태에서 동시에 publish하면
  결과가 모두 `created|present`, instance bytes가 동일하고 물리 중복 수가 contender
  수 이내인지 확인한다. 이어 순차 재시도하면 `present`이며 파일이 더 늘지 않는다.
- identity slot 255개와 global slot 9,999개를 점유한 뒤 두 publisher를 경쟁시키면
  정확히 하나만 `created`, loser는 `complete:false`와
  `memory.derived_limit_exceeded`이고 상한을 넘는 generation이 없는지 확인한다.
- global/local reservation이 같은 kind·length-prefixed identity hash·generation
  hash·slot·instance ID를 canonical JSON 4 KiB 이하로 결속하고 둘 다 sync되기 전에는
  generation을 만들지 않는지 확인한다.
- receipt path가 주장한 hash와 canonical bytes hash·schema가 어긋나면 해당 logical
  receipt의 instance만 corrupt로 세고, 같은 request의 다른 receipt를 conflict로
  취급하지 않는지 확인한다.
- index·receipt·view·log의 byte 상한과 index entries 10,000개, receipt 세 array
  각각 256개의 경계값은 허용하고 limit+1은 reservation·파일 생성 전에 거부한다.
  loader가 `lstat` size 뒤 bounded read, UTF-8, parse, schema/array, canonical bytes,
  hash/path 순으로 검사하는지도 확인한다.
- global reservation 10,001번째, 일반 directory 257번째 direct child와 전체 physical
  census 100,001번째 entry 앞에서 `complete:false`와 전용 warning을 반환한다.
  directory·regular·symlink·special·corrupt·oversize entry를 모두 세며 불완전한
  census에서는 publisher·loader·list가 generation이나 history를 선택하지 않는다.
- census가 완전한 exact receipt의 oversize instance는 `corrupt`이고, warning에는
  raw bytes와 절대 경로가 없는지 확인한다. global 선점 뒤 crash·local 선점 실패로
  생긴 empty/malformed reservation은 generation 권한 없이 slot만 소비하고 cache
  reset 전까지 용량만 줄인다.
- receipt·log generation 추가가 `sourceTreeSha256`을 바꾸지 않고, Markdown log에
  request context나 applied/excluded receipt data가 섞이지 않는지 확인한다.
- hash·schema·본문이 손상된 이벤트는 이동·overwrite하지 않으며 marker append 뒤
  해당 `memory_id` 전체가 영구 제외되고 approved ancestor가 되살아나지 않는지
  확인한다. 복구는 새 memory ID만 허용한다.
- source scan의 10,001번째 entry 앞에서 `complete:false`로 중단하고, 한도 뒤의
  invalidating transition을 놓쳐도 이전 approved head를 반환하거나 색인을
  publish하지 않는지 확인한다.

### 제품 경계

- 공통 사실과 결정만 Studio·Career 사이에서 공유된다.
- Studio 교훈이 Career 취업 판단으로 바뀌지 않는다.
- Career 선호가 Studio 설계 원칙으로 적용되지 않는다.
- 기억을 적용한 결과물은 원래 근거·결정 링크를 독립적으로 보존한다.

### 실제 작업 흐름

- 짧은 자연어 기획 요청에서 승인된 기억을 검색한다.
- 플레이테스트 결과에서 승인 전 교훈 후보를 만든다.
- 사용자의 명시적 지속 선호를 승인 근거와 함께 기록한다.
- 맞춤법 수정과 일회성 대화에서는 후보를 만들지 않는다.
- 기억 저장 실패 후에도 기준 기획 결과물 검증과 내보내기가 통과한다.
- Hook 지원 여부와 관계없이 같은 핵심 결과를 만든다.

### 적대적 경계

- `APPEND-IDEMPOTENT`, `APPEND-CONFLICT`, `APPEND-PARALLEL`, `BRANCH` 시나리오로
  append와 fold의 보수적 동시 실행 계약을 검증한다.
- `PATH` 시나리오로 절대 경로, `..`, 역슬래시, NUL, 비-NFC, ancestor·final
  symlink, FIFO·socket과 oversize를 거부한다.
- `CORRUPT`와 `INDEX` 시나리오로 손상 이벤트의 logical quarantine과 derived
  generation 재생성을 검증한다.
- `GIT` 시나리오로 두 플러그인의 lock 직렬화, malformed marker·사용자 변경·
  stale lock의 warning-only 처리를 확인한다. 기억 이벤트는 그대로 남아야 한다.
- `FAILPOINT`로 open·write·fsync·close 실패에서 성공을 보고하지 않고 기존
  이벤트가 바뀌지 않는지 확인한다. 생성된 partial instance·claim은 권한을 얻지
  못하며 재시도가 성공한다.
- 기억 문서의 프롬프트 주입, 승인 변경과 파일 삭제 명령을 실행하지 않는다.
- 다른 프로젝트 ID 위장, 출처 해시 조작과 만료일 우회를 거부한다.
- 비밀정보와 개인정보가 기억·영수증·오류에 남지 않는다.
- 대용량 파일, 과도한 항목 수와 검색 문맥을 제한한다.
- 사전에 존재하거나 사후 관찰되는 swap은 fail-closed로 검증한다. 같은 OS 계정의
  악의적 between-syscall directory swap은 `THREAT-BOUNDARY`에서 skipped non-goal로
  기록하며 보장되는 보안 테스트로 세지 않는다.

### 패키징과 생명주기

- Studio와 Career 설치본에 정확히 같은 공통 기억 런타임이 포함된다.
- 원천, 생성 패키지와 빌드 manifest의 파일·해시가 일치한다.
- 설치·업데이트·제거가 작업 공간의 `.game-design/`을 변경하지 않는다.
- 로컬 Git 제외 표식은 중복되지 않고 기존 규칙을 보존한다.
- 기억을 끈 상태에서 기존 단위·계약·제품·E2E·형식 테스트가 통과한다.

## 사용자 문서

- 루트 README에 장기 기억의 목적, 기본 로컬 보관, 승인 경계와 끄는 방법을
  설명한다.
- Studio·Career 설치 가이드에 `.env` 설정과 실제 비밀정보를 커밋하지 않는
  규칙을 추가한다.
- 빠른 시작은 기억이 전혀 없어도 같은 요청으로 시작할 수 있음을 밝힌다.
- 워크플로 가이드에 검색, 적용, 결과 검증, 후보 작성 순서를 추가한다.
- FAQ에 기억 삭제, 프로젝트 이동, Git 제외, 충돌, 손상 복구를 설명한다.
- 기억 관리 가이드에 후보 열람, 승인, 거부, 폐기와 색인 재생성 예시를 둔다.
- 한국어 의미를 먼저 쓰고 `memory`, `candidate`, `stale` 같은 내부 상태 ID는
  코드 표기로 보조한다.

## SQLite 도입 기준

SQLite는 구현하지 않지만 검색 저장소 인터페이스는 Markdown 원본과 분리한다.
다음 조건 중 하나가 실제 측정으로 확인될 때 별도 설계를 시작한다.

- 활성 기억이 수백 건을 넘어 색인 검색이 반복해서 사용자 체감 지연을 만든다.
- 여러 작업 공간의 복합 필터 검색이 필요하다.
- Markdown 색인의 재생성·검색 시간이 정한 성능 예산을 지속적으로 넘는다.

SQLite를 도입해도 Markdown이 원본이다. DB와 WAL 파일은 로컬 검색 캐시이며
삭제·손상 시 Markdown에서 재생성할 수 있어야 한다. Node 최소 버전 변경이나
외부 패키지 추가는 별도 호환성 결정으로 다룬다.

## 구현 순서 경계

1. 실패 테스트로 설정, 문서 스키마, 상태 전이와 비활성화 계약을 고정한다.
2. 공통 Markdown 저장소와 결정적 JSON 색인을 구현한다.
3. 검색·후보 작성·유지 관리 스킬과 검사기를 구현한다.
4. Studio와 Career 오케스트레이터·라우팅에 같은 공통 기능을 연결한다.
5. 공통 패키징과 생성 snapshot을 갱신한다.
6. README, `.env.example`과 제품별 가이드를 현행화한다.
7. 단위, 계약, 제품, E2E, 설치·제거와 적대적 테스트를 실행한다.

Hook 변경과 SQLite는 이 구현 순서에 포함하지 않는다.

## 완료 기준

- 기본값은 프로젝트별·로컬 전용 기억이다.
- `GAME_DESIGN_MEMORY_ENABLED=false`와 일회성 제외 요청은 기억 저장소 입출력,
  후보, 색인과 영수증을 만들지 않는다.
- 승인되지 않은 기억은 어떤 기획 결과에도 적용되지 않는다.
- 사용한 기억은 현재 출처와 해시가 일치하고 결과물에도 원래 근거가 연결된다.
- Studio와 Career의 공통·전용 기억 경계가 동적 테스트로 확인된다.
- 만료, 출처 변경, 충돌과 대체 기록은 자동 적용되지 않는다.
- 기억 장애에도 기존 기획 결과물과 요청한 형식이 정상 생성된다.
- 설치·업데이트·제거가 로컬 기억을 손상하거나 원격으로 전송하지 않는다.
- 원천과 생성 패키지가 표준 빌드에서 일치한다.
- 관련 단위·계약·제품·E2E·설치·제거·적대적 테스트와 전체 회귀가 통과한다.
