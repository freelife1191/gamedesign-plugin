# 컷씬 비주얼 프리프로덕션 설계

## 문서 상태

- 작성일: 2026-08-13
- 상태: 사용자 승인
- 대상: Game Design Studio와 공통 이미지 자산 파이프라인
- 채택 범위: 마스터 레퍼런스 세트, 주요 키프레임과 전체 스토리보드 패키지
- 생성 원칙: 비용·범위 설명과 단계별 사용자 승인 전에는 이미지 생성 호출을 하지 않는다.

## 결정 요약

컷씬 이미지 작업을 단일 이미지 프롬프트 생성으로 처리하지 않는다. 먼저 컷씬의
서사 목적, 플레이어가 알아야 할 정보, 진입·종료 게임 상태와 감정 변화를
정의한다. 이를 beat와 shot으로 나누고 카메라, 블로킹, 시선·화면 방향, 조명,
대사·자막, 음향, 전환과 게임 복귀 상태를 설계한다.

이미지 일관성은 한 장의 “마스터 이미지”에만 의존하지 않는다. 스타일, 캐릭터와
의상, 환경, 핵심 소품, 색·조명 기준을 마스터 레퍼런스 세트로 관리한다. 스타일
마스터를 먼저 사람이 승인하고 캐릭터·환경·소품 마스터, 주요 키프레임, 연결
shot과 조건부 variant를 순서대로 만든다. 이전 단계가 바뀌면 영향받는 후속
자산만 다시 계획하고 비용을 다시 계산한다.

작업 시작 시 사용자는 `prompt-only`, `estimate-only`,
`generate-after-approval` 중 하나를 선택할 수 있다. 생성하지 않으면 완성된
프롬프트 패키지와 나중에 순서대로 이미지를 요청하는 가이드를 제공한다. 생성할
경우에도 마스터, 키프레임, 스토리보드 각 단계의 예상 비용과 최대 한도를 먼저
보여 주고 해당 단계가 승인된 뒤에만 외부 이미지 생성 호출을 한다.

## 배경과 현재 기능

현재 플러그인에는 컷씬 시각 설계를 확장할 수 있는 기반이 있다.

- `cinematic-narrative` 문서 품질 preset이 내러티브·시네마틱 문서의 기본 구조를
  제공한다.
- `design-game-content`, `plan-image-assets`, `generate-image-assets`,
  `review-image-assets`가 콘텐츠와 이미지 자산 수명주기를 연결한다.
- `story-storyboard` 자산 유형과 storyboard prompt pattern이 존재한다.
- 이미지 자산 스키마는 `asset_set_id`, `derivative_of`,
  `reference_asset_ids`, reference image SHA-256, style·character anchor와
  `prompt_lineage`를 기록할 수 있다.
- 이미지 상태는 `concept-draft → document-approved → production-candidate`의
  사람 검토 경계를 가진다.

하지만 현재 storyboard pattern은 순차 beat 수준에 머문다. 다음 정보가 구조화돼
있지 않다.

- 컷씬 진입·종료 게임 상태와 skip 이후 상태
- beat, shot, 카메라, 블로킹, 화면 방향과 연속성
- 스타일·캐릭터·환경·소품 마스터의 승인 순서
- 마스터에서 shot으로 이어지는 생성 의존성 그래프
- 조건부 대사·캐릭터·퀘스트 상태 variant와 부분 재생성
- 대사, 자막 안전 영역, 음향과 전환을 포함한 production handoff
- 프롬프트만 받는 흐름과 실제 생성 전 비용·승인 계약

## 목표

1. 컷씬의 서사 목적과 게임 상태 변화를 이미지 생성보다 먼저 설계한다.
2. beat와 shot을 카메라·블로킹·연속성 정보가 있는 실행 가능한 storyboard
   계약으로 만든다.
3. 스타일, 캐릭터, 환경, 소품과 조명의 마스터 레퍼런스를 단계적으로 승인한다.
4. 모든 shot 프롬프트가 승인된 마스터 ID와 byte hash에 결속된다.
5. 캐릭터·퀘스트 상태에 따른 variant는 base 컷씬을 복제하지 않고 변경된
   beat·shot만 overlay한다.
6. 프롬프트만 필요한 사용자에게도 완전한 패키지와 순차 생성 가이드를 제공한다.
7. 실제 생성 전 예상 비용, 생성 범위와 최대 한도를 설명하고 명시적 승인 후에만
   호출한다.
8. 마스터 변경, 부분 실패와 재시도에도 성공한 자산과 결정 이력을 보존한다.

## 비목표

- 1차 구현에서 완성된 영상, 애니매틱, 음성, 음악이나 엔진 timeline을 생성하지
  않는다.
- Unreal, Unity 등 특정 엔진의 시퀀서 데이터나 카메라 리그 포맷을 만들지 않는다.
- 승인되지 않은 프롬프트를 자동 생성 호출로 넘기지 않는다.
- 한 번의 대량 생성으로 마스터, 키프레임과 모든 shot을 동시에 만들지 않는다.
- 생성된 이미지를 곧바로 최종 production 자산으로 승인하지 않는다.
- 공급자 가격을 영구 상수로 고정하거나 비용을 확인할 수 없는 host 기능을
  무료라고 표시하지 않는다.
- 조건부 variant마다 base 컷씬 전체를 복제하지 않는다.

## 검토한 접근

### 기존 storyboard prompt만 확장

변경량은 작지만 서사 상태, shot 설계, 마스터 승인, variant와 비용 승인 책임이
하나의 prompt pattern에 섞인다. 단순 컷에는 쓸 수 있어도 프로젝트 단위 컷씬의
연속성과 재작업 범위를 안정적으로 관리하기 어렵다.

### 컷씬 비주얼 프리프로덕션 스킬 추가

전용 Studio 스킬이 컷씬 brief, beat, shot, 연속성, master reference, 생성 DAG,
비용과 승인 패키지를 만든다. 기존 이미지 스킬은 실제 계획·생성·검토를 담당한다.
역할이 명확하고 기존 자산 스키마를 재사용할 수 있어 이 방식을 채택한다.

### 완성 영상 파이프라인 구축

편집, 음성, 음악, 영상 전환과 엔진 연동까지 처리할 수 있지만 현재 요청보다
범위와 비용·권리·품질 검증이 크게 늘어난다. 이번 단계에서는 production handoff가
가능한 storyboard 패키지까지만 만든다.

## 전체 흐름

```text
design-game-content
  → design-cutscene-visual-preproduction
      1. Cutscene Brief
      2. Beat Sheet
      3. Shot List
      4. Continuity Bible
      5. Master Reference Plan
      6. Prompt Package + Generation DAG
      7. Mode and Cost Preflight
  → plan-image-assets
  → 단계별 비용 승인
  → generate-image-assets
  → review-image-assets
  → document-approved storyboard package
```

새 Studio 스킬 이름은 `design-cutscene-visual-preproduction`으로 한다.

## 컷씬 설계 단계

### 1. Cutscene Brief

이미지보다 먼저 다음을 정한다.

- 컷씬 ID, 기획 목적과 이야기 기능
- 플레이어가 장면 전후로 알아야 할 정보
- 목표 감정과 감정 변화
- 시작 위치, 시간, 등장인물과 퀘스트·캐릭터 상태
- 스킵 가능 여부와 스킵 시 보존할 정보
- 컷씬 종료 후 게임 상태, 제어권과 다음 목표
- 대상 플랫폼, 화면비, 자막·접근성 요구
- 전체 길이와 자산 예산 가설

### 2. Beat Sheet

기본 구조는 setup, conflict, turn, climax, result, return-to-play로 시작하되 장면에
불필요한 beat는 제거할 수 있다. 각 beat는 다음을 가진다.

- `beatId`, 목적과 전달 정보
- 시작·종료 감정과 상태 변화
- 필요한 등장인물, 장소와 소품
- 대사·행동·시각 정보의 우선순위
- 분기 조건과 base·variant 관계
- 예상 길이와 다음 beat

### 3. Shot List

각 shot은 다음 필드를 가진다.

- `sceneId`, `beatId`, `shotId`
- shot 목적과 반드시 읽혀야 하는 정보
- 등장인물, 의상, 표정, 자세와 상태
- 카메라 크기, 각도, 렌즈 감각, 움직임과 초점
- 인물·소품 블로킹, 시선과 화면 진행 방향
- 장소, 시간, 날씨, 조명과 색
- 대사·자막 안전 영역과 UI 겹침 금지 영역
- 시작·종료 프레임, 예상 duration과 transition
- 음향·음악 cue와 침묵 구간
- 앞뒤 shot과 이어지는 연속성
- 컷씬 종료·게임 복귀 상태에 미치는 영향

이 정보는 엔진 timeline 값이 아니라 기획·아트·시네마틱 팀에 전달하는 중립
계약이다.

### 4. Continuity Bible

다음 연속성 기준을 장면 전체에서 고정한다.

- 캐릭터 체형, 얼굴, 머리, 의상, 손상과 소지품
- 환경 구조, 출입구, 지형과 랜드마크
- 소품의 형태, 위치, 소유와 상태
- 광원 방향, 시간대, 날씨와 색 흐름
- 화면 방향, 시선, 이동 방향과 180도 축
- 감정·부상·오염·파괴 등 시간에 따라 변하는 상태
- 의도적으로 바뀌는 항목과 바뀌면 안 되는 항목

### 5. Master Reference Set

마스터는 한 장이 아니라 역할별 세트다.

1. 스타일 마스터: 재질, 선·형태, 렌더링, 색, 대비와 금지 스타일
2. 캐릭터 마스터: 인물별 얼굴·체형·의상·후면·표정·상태
3. 환경 마스터: 공간 구조, 주요 시점, 시간·조명 상태
4. 소품 마스터: 이야기와 연속성에 중요한 물체
5. 색·조명 마스터: 장면별 팔레트와 감정 전환
6. 선택 항목: 표정 시트, 크기 비교와 상호작용 기준

승인 순서는 스타일 마스터 → 캐릭터·환경·소품 마스터 → 주요 키프레임 → 연결
shot과 variant다. 앞 단계가 승인되지 않으면 다음 단계 프롬프트는 준비할 수 있어도
생성 승인을 받을 수 없다.

### 6. Shot Prompt Compiler

각 shot prompt는 다음 내용을 결정적 순서로 조합한다.

1. shot 목적과 전달 정보
2. 참조할 master asset ID와 SHA-256
3. 보존할 캐릭터, 의상, 환경, 소품과 상태
4. 카메라, 구도, 블로킹, 행동, 표정과 시선
5. 조명, 색, 깊이와 분위기
6. 앞뒤 shot과 연결되는 continuity
7. 제외할 요소와 금지 표현
8. 크기, 화면비, 자막·UI 안전 영역

프롬프트는 참고 이미지의 외형을 막연히 “비슷하게” 요구하지 않고 정확한 자산
ID와 hash, 보존 항목과 변경 항목을 분리한다.

## 생성 의존성 그래프

```text
Style Master
  ├─ Character Masters
  ├─ Environment Masters
  └─ Prop Masters
          │
          ▼
Major Keyframes
          │
          ├─ Connective Storyboard Shots
          └─ Conditional Variant Shots
                    │
                    ▼
Continuity Review and Contact Sheet
```

각 자산은 `asset_set_id`, `derivative_of`, `reference_asset_ids`, reference SHA-256,
`consistency_profile`과 `prompt_lineage`를 사용한다. master hash가 바뀌면 의존
그래프를 따라 영향받는 prompt와 비용 승인만 무효화한다. 관계없는 성공 자산은
삭제하거나 재생성하지 않는다.

## 조건부 컷씬 variant

base 컷씬 위에 상태별 차이만 overlay한다.

```text
CUTSCENE-ESCAPE-01/
  base/
  variant-companion-alive/
  variant-companion-absent/
  variant-quest-failed/
```

variant는 다음 정보를 가진다.

- trigger state ID와 우선순위
- base beat·shot ID
- 변경되는 요소와 반드시 보존할 continuity
- 대체 대사, 표정, 블로킹, 소품과 환경 상태
- 다음 장면과 게임 복귀 상태
- 별도 이미지가 필요한지 여부

대사만 바뀌고 화면이 같은 variant는 별도 이미지를 만들지 않는다. 인물 배치,
상태 또는 소품이 바뀌는 shot만 새 파생 자산을 만든다.

## 작업 모드

### Prompt Only

이미지 API 호출 수는 0이고 예상 이미지 API 비용은 USD 0이다. 다음 패키지를
제공한다.

```text
cutscene/
  cutscene-brief.md
  beat-sheet.yml
  shot-list.yml
  continuity-bible.yml
  master-reference-plan.yml
  prompts/
    01-style-master.md
    02-character-masters.md
    03-environment-masters.md
    04-keyframes.md
    05-storyboard-shots.md
    prompt-manifest.json
  generation-guide.md
```

`generation-guide.md`는 다음 순서의 복사 가능한 App·CLI 요청 예시를 제공한다.

1. 스타일 마스터 생성 요청과 선택 방법
2. 선택한 스타일 자산 등록과 hash 확인
3. 캐릭터·환경·소품 마스터 생성 요청
4. 주요 키프레임 생성 요청
5. 연결 shot과 필요한 variant 생성 요청
6. contact sheet와 continuity 감사 요청
7. 실패한 안정 ID만 재시도하는 요청

생성하지 않은 파일은 이미지 대신 예상 상대 경로와 asset ID를 manifest에 남긴다.

### Estimate Only

이미지를 생성하지 않고 다음 비용 패키지만 만든다.

- 단계, asset ID와 개수
- 모델, 품질, 크기와 화면비
- reference image 개수와 입력 비용 가정
- 정상 생성 예상 범위와 재시도 reserve
- 사용자 지정 최대 비용
- 통화, 가격 출처와 조회 시점
- 가격을 확정할 수 없는 항목과 이유

### Generate After Approval

Estimate Only의 결과에 승인 receipt를 결속한 뒤 해당 단계만 생성한다. 마스터,
키프레임, 스토리보드는 각각 별도 승인한다.

## 비용 추정과 승인 계약

### 생성 예산 선언

프로젝트는 단계별로 다음 수량을 선언한다.

- 스타일·캐릭터·환경·소품 마스터 수
- 주요 키프레임 수
- 연결 storyboard shot 수
- 조건부 variant 수
- 단계별 재시도 reserve
- 품질, 크기와 최대 허용 비용

기본값은 스킬이 제안할 수 있지만 사용자 프로젝트 설정이 우선한다. 수량과 품질을
모르면 범위로 제시하고 생성 승인을 받지 않는다.

### 가격 조회

현재 기본 이미지 모델 후보는 `gpt-image-2`다. 설계 작성 시점의 공식 문서는 이미지
입력, 캐시 입력, 이미지 출력과 텍스트 입력을 토큰 단위로 구분한다.

- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [GPT Image 2 model](https://developers.openai.com/api/docs/models/gpt-image-2)
- [Images API usage fields](https://platform.openai.com/docs/api-reference/images-streaming/image_generation/partial_image)

가격은 실행 시점에 공식 출처에서 다시 확인하며 코드에 영구 상수로 고정하지
않는다. 예상 비용은 선택한 모델·품질·크기·수량과 reference 입력을 바탕으로
최소·예상·최대 USD로 표시한다. 원화는 환율과 조회 시점을 함께 적는 참고값일
뿐 승인 기준은 기본적으로 USD다.

호스트 앱의 이미지 생성 기능처럼 API 단가와 usage를 확인할 수 없는 경로는
`비용 확인 불가 — 호스트 구독 또는 사용량 정책이 적용될 수 있음`으로 표시한다.
무료라고 추정하지 않으며 이 경우에도 생성 전 승인을 받는다.

### 단계별 승인 receipt

승인은 다음 항목에 결속된다.

- 컷씬·장면 ID와 생성 단계
- 생성할 asset ID exact set
- prompt package hash
- reference asset ID와 SHA-256
- 모델, 품질, 크기와 화면비
- 예상 비용 범위, 최대 비용과 재시도 reserve
- 승인자와 승인 시점

다음 항목이 바뀌면 재승인을 요구한다.

- 자산 수 또는 ID
- prompt 또는 master reference
- 모델, 품질, 크기나 화면비
- 비용 최대 한도
- variant 범위

provider 호출 직전에 receipt와 실제 요청을 다시 비교한다. 승인된 최대 비용을 넘을
가능성이 있거나 가격 정보를 다시 확인할 수 없으면 호출 전 차단한다.

호출 뒤에는 usage, 실제 비용 또는 비용 산정 불가 사유, 성공·실패 asset ID와
provider request ID를 별도 receipt로 남긴다.

## 상태 모델

```text
planned
  → prompt-ready
  → cost-estimated
  → approval-pending
  → generation-approved
  → generated
  → continuity-review
  → document-approved
  → production-candidate
```

- `prompt-only`는 `prompt-ready`에서 정상 완료할 수 있다.
- 비용만 요청하면 `cost-estimated`에서 완료한다.
- 사람이 승인하지 않으면 `approval-pending`을 넘지 않는다.
- 생성 성공은 `document-approved`나 `production-candidate`를 뜻하지 않는다.
- master 또는 prompt 변경은 영향받는 자산을 `cost-estimated`로 되돌린다.

## 결과물 구조

```text
cutscene/
  cutscene-brief.md
  beat-sheet.yml
  shot-list.yml
  continuity-bible.yml
  master-reference-plan.yml
  generation-dag.json
  cost-estimates/
  approval-receipts/
  prompts/
  generated/
    masters/
    keyframes/
    storyboard/
    variants/
  contact-sheet/
  review-findings.md
  usage-receipts/
  decisions/
  generation-guide.md
```

## Continuity QA

검토는 이미지별 미감 점수만 주지 않는다.

- 캐릭터 얼굴, 체형, 의상과 상태
- 환경 구조, 소품 위치와 광원
- 화면 방향, 시선, 블로킹과 카메라 축
- 시간·날씨·색·손상 상태의 진행
- 대사·자막 안전 영역과 정보 가독성
- beat 목적과 shot에서 실제 보이는 정보
- base와 variant의 보존·변경 항목
- 앞뒤 shot의 행동과 감정 연속성

결함은 영향받는 asset ID와 원인 master·prompt를 연결한다. retry는 실패 자산만
대상으로 하고 성공한 자산을 덮어쓰지 않는다.

## 오류와 부분 실패 처리

- 모델이나 가격 정보를 확인할 수 없으면 estimate를 확정하지 않고 호출하지 않는다.
- 승인 receipt가 없거나 실제 요청과 다르면 호출 전 차단한다.
- 일부 자산이 실패하면 성공 자산과 receipt를 보존하고 실패 ID만 재시도 후보로 둔다.
- 생성 결과가 안전 정책에 의해 거부되면 프롬프트를 임의 완화하지 않고 finding을
  남긴다.
- master가 불승인되면 후속 자산 생성은 중단하지만 prompt-only 산출물은 보존한다.
- reference hash가 달라지면 영향 그래프에 있는 자산만 stale로 표시한다.
- 외부 서비스 장애는 기존 콘텐츠·기획 문서 작성과 prompt-only 흐름을 막지 않는다.
- 진단에는 API key, 원본 비공개 프롬프트, 절대 경로나 불필요한 provider 응답을
  노출하지 않는다.

## 테스트와 수용 기준

### 승인과 비용

- 비용·범위 설명과 승인 receipt 전에는 provider 호출이 0회다.
- `prompt-only`는 이미지 파일을 만들지 않고 이미지 API 비용 USD 0으로 완료한다.
- `estimate-only`는 usage를 발생시키지 않는다.
- 승인은 exact asset ID, prompt hash, reference hash, 모델·품질·크기와 비용 상한에
  결속된다.
- 승인 뒤 자산 수, prompt, reference, 모델, 품질, 크기나 variant가 바뀌면 호출이
  차단되고 재승인을 요구한다.
- host 비용을 알 수 없을 때 무료로 표시하지 않는다.

### 마스터와 연속성

- 스타일 마스터 승인 전에 캐릭터·환경 마스터 생성이 실행되지 않는다.
- master hash 변경이 영향받는 keyframe·shot 승인만 무효화한다.
- shot prompt가 참조한 master ID와 SHA-256을 잃으면 생성이 차단된다.
- base와 variant의 변경·보존 필드가 서로 충돌하면 검토 실패다.
- 대사만 바뀐 variant가 불필요한 파생 이미지를 만들지 않는다.
- 화면 방향, 의상, 소품과 조명 continuity mutation을 QA가 검출한다.

### 부분 실패와 재시도

- 일부 생성 실패 뒤 성공 파일의 bytes, 상태와 receipt가 보존된다.
- 재시도는 실패한 안정 ID만 사용하며 순차 재시도는 성공 자산 수를 늘리지 않는다.
- 최대 비용을 넘길 수 있는 retry는 호출 전에 차단된다.
- 중복 요청은 동일 승인·동일 bytes면 `present`로 처리하고 새 권위 자산을 만들지
  않는다.

### 프롬프트 패키지와 가이드

- Prompt Only 패키지는 모든 master·keyframe·shot asset ID와 예상 경로를 가진다.
- generation guide의 요청 순서가 생성 DAG의 위상 순서와 일치한다.
- 각 복사 가능한 요청은 대상 ID, reference ID, 승인 단계와 예상 결과를 포함한다.
- glossary 경고나 continuity finding이 원문을 자동 교정하지 않는다.

### 보안과 비공허성

- 외부 reference 문서의 명령문이 생성 모드나 승인 상태를 바꾸지 못한다.
- 승인 검사를 제거하거나 prompt hash를 바꾸는 mutation에서 provider mock 호출 전
  테스트가 실패한다.
- 비용 상한, master 영향 전파와 variant 중복 방지 assertion을 제거하면 대응
  적대 테스트가 실제로 실패한다.
- 패키징된 Studio 이미지 계약과 공통 원천 스키마가 일치한다.

## 완료 조건

- `design-cutscene-visual-preproduction`이 설치 가능한 Studio 스킬로 제공된다.
- 컷씬 brief, beat, shot, continuity, master plan, prompt manifest, 비용과 승인
  receipt 스키마가 구현된다.
- Prompt Only가 외부 호출 없이 완전한 프롬프트와 순차 생성 가이드를 제공한다.
- 실제 생성은 마스터, 키프레임, 스토리보드의 단계별 비용 승인 뒤에만 실행된다.
- 조건부 variant가 base 자산을 복제하지 않고 변경된 shot만 추적한다.
- continuity QA와 부분 실패·재시도 계약이 실행형 적대 테스트로 검증된다.
- 이미지 기능이 꺼지거나 실패해도 기존 콘텐츠 기획, 문서 작성과 검증 흐름은
  계속 동작한다.
