# game-design-career

## 목적과 최종 산출물

요청에서 담당 제품과 실행 경로를 하나씩 정하고 선택 근거를 기록합니다. 최종 결과는 경로 선택 기록과 위임된 스킬의 산출물입니다. 이 스킬 자체는 커리어 문서를 만들지 않습니다.

## 사용할 때

- 요청이 넓거나 섞여 있거나 모호해서 어떤 스킬이 맡아야 할지 분명하지 않을 때
- `CA-C07`처럼 사례 ID만 있고 실행할 스킬 이름이 없을 때
- 두 제품의 근거가 모두 필요해 최종 담당 제품을 먼저 정해야 할 때

### 직접 호출 활용 — game-design-career

[![대표 진입 스킬이 요청에서 담당 제품과 실행 경로를 하나씩 고르는 흐름](../../assets/shared/suite-entry-routing-flow.png)](../../assets/shared/suite-entry-routing-flow.svg)

#### 직접 호출 조건

무엇을 불러야 할지 모르는 상태에서 시작할 때 직접 호출합니다. 결과가 하나로 분명한 요청은 그 결과를 소유한 전문 스킬을 바로 호출합니다.

#### 입문 App 요청문

```text
@Game Design Career 기획자 준비를 어디서부터 시작할지 모르겠어. 요청을 다섯 항목으로 정리하고 담당 스킬 하나를 골라 경로 선택 기록을 남겨 줘. 모르는 정보는 미정으로 남겨 줘.
```

#### 입문 CLI 요청문

```text
$game-design-career:game-design-career 기획자 준비를 어디서부터 시작할지 모르겠어. 요청을 다섯 항목으로 정리하고 실행 경로 하나를 골라 경로 선택 기록으로 남겨.
```

#### 응용 App 요청문

```text
@Game Design Career 포트폴리오·채용 조사·면접이 한 번에 섞인 요청이야. 최종 결과를 맡을 제품과 실행 경로를 하나씩 정하고 나머지는 후속 결정으로 경로 선택 기록에 적어 줘.
```

#### 응용 CLI 요청문

```text
$game-design-career:game-design-career 포트폴리오·채용 조사·면접이 섞인 요청에서 담당 제품과 실행 경로를 하나씩 고르고 나머지는 후속 결정으로 경로 선택 기록에 적어.
```

#### 고급 App 요청문

```text
@Game Design Career CA-C07로 시작하고 기획 산출물 근거도 있어야 해. 사례 ID를 실행 경로로 바꾸고 담당 제품과 근거 제공 제품을 나눠 경로 선택 기록을 만들어 줘. 상대 제품이 없으면 그 사실을 그대로 적어 줘.
```

#### 고급 CLI 요청문

```text
$game-design-career:game-design-career CA-C07을 실행 경로로 바꾸고 기획 산출물 근거가 필요한 부분은 근거 제공 요청으로 나눠 경로 선택 기록에 적어.
```

사례 ID를 그대로 넘겨도 됩니다. `$game-design-career:game-design-career CA-C01`처럼 ID만 주면 제작용 요청문 카탈로그에서 그 ID를 찾아 실행 경로 하나로 바꿉니다. 없는 ID는 이웃 사례로 추측하지 않고 한 번만 되묻습니다.

#### 예상 결과와 파일 읽는 순서

이 스킬은 별도 파일을 만들지 않습니다. 위임된 스킬이 만든 기준 결과 폴더를 `content.md → evidence.yml → export-manifest.yml` 순서로 읽고, 작업 공간에 `route-receipt.json`이 있으면 그 안의 `routeId`만 채웁니다.

첫 응답에서는 본문을 분석하기 전에 여섯 줄의 경로 선택 기록을 보여 줍니다. 순서는 `최종 담당 제품 → 선택 스킬 → 제품 간 인계 → 결과물 경로 → 현재 사실·가정·차단 요인 → 다음 담당자 결정`입니다. `route-receipt.json`은 요청과 선택 결과가 올바르게 연결됐는지 검사하는 파일이며, 여섯 줄 기록은 사용자가 같은 내용을 바로 확인할 수 있도록 정리한 요약입니다.

Studio가 맡아야 하는 요청은 필요한 근거만 받는 단방향 인계로 나눕니다. 인계는 요청 하나당 한 번만 하며, 상대 제품이 없거나 비활성 상태라면 증거를 지어내지 않고 차단 요인으로 남깁니다.

[![최종 담당 제품과 근거 제공 제품의 역할, 단방향 반환을 나눈 인계 흐름](../../assets/shared/suite-handoff-ownership-flow.png)](../../assets/shared/suite-handoff-ownership-flow.svg)

#### 다음 스킬 조건

선택한 실행 경로가 여러 Career 단계를 함께 다뤄야 할 때만 `$game-design-career:orchestrate-game-design-career`로 넘깁니다. 그 밖에는 실행 경로가 가리키는 `$game-design-career:<selected-skill>`을 직접 호출합니다.

복합 경로는 설치된 전문 역할을 1~3개만 선택하고 역할별 검토 경로와 검토 결과를 남깁니다. 결과는 도착 순서가 아니라 `severity → evidence-gap-id → artifact-section-id → role-priority` 순서로 병합합니다. 한국어 문서를 작성하거나 고쳤다면 분야 검토 뒤 `polish-game-design-writing`과 번들 `$humanize-korean`을 마지막 문장 편집 단계로 실행하고, 이후에는 링크·계약·도식 변경 여부처럼 결과가 정해지는 검사만 수행합니다.

## 사용하지 않을 때

- 결과가 하나로 분명한 요청은 그 결과를 소유한 전문 스킬을 직접 사용합니다.
- 이미 근거가 갖춰진 경력 단계 진단은 `orchestrate-game-design-career`를 사용합니다.
- 게임 기획 산출물 제작 요청은 [Studio 제품 가이드](../../game-design-studio/README.md)의 대표 진입 스킬을 사용합니다.

## 필수 입력과 선택 입력

- 필수: 원하는 최종 결과, 이미 가진 자료, 공개 범위, 최종 결정 담당자, 출력 형식
- 선택: 사례 ID, 현재 경력 단계, 관심 직무, 마감 조건
- 사용자가 주지 않은 값은 만들지 않고 `미정`으로 남기며, 실행 경로를 고르기 전에는 한 번만 질문합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 게임 기획자로 준비를 시작하고 싶은데 어떤 스킬을 불러야 할지 모르겠어. 요청을 다섯 항목으로 정리하고 담당 스킬 하나를 골라 경로 선택 기록을 남겨 줘. 모르는 정보는 미정으로 남겨 줘.
```

## Codex CLI 요청 예시

```text
$game-design-career:game-design-career 포트폴리오와 면접 준비가 섞인 요청에서 최종 결과를 맡을 제품과 실행 경로를 하나씩 정하고 경로 선택 기록을 남겨.
```

## 내부 진행 흐름

요청을 다섯 항목으로 정리하고 사례 ID를 실행 경로로 바꾼 뒤, 여섯 줄의 경로 선택 기록을 먼저 보여 줍니다. 후보는 [스킬 선택표](README.md)에 실린 설치 스킬로 제한하며, 목록에 없는 스킬은 설치되지 않은 것으로 봅니다. 단일 요청은 전문 스킬을 바로 실행하고, 복합 요청은 오케스트레이터가 검토 역할과 병합 순서를 기록합니다.

## 생성 파일과 결과 구조

이 스킬이 직접 만드는 파일은 없습니다. 작업 공간에 `route-receipt.json`이 있으면 `schemaVersion`, `requestSha256`, `bindingNonce`는 그대로 두고 `routeId`만 채웁니다. 결과 요약에는 여섯 줄의 경로 선택 기록, 검토 역할 1~3개와 역할별 근거, 정해진 병합 순서, 위임된 스킬의 산출물 경로를 남깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: 이 스킬은 템플릿을 직접 채우지 않고 위임된 스킬의 템플릿을 그대로 따릅니다 — [템플릿 목록](../templates.md).
- 품질 기준 ID: 위임된 스킬이 선택한 기준을 그대로 유지합니다.
- Reviewer/role ID: `career-strategist`.

## 이미지·도식화 조건

이 스킬은 이미지를 만들지 않습니다. 이미지가 필요하면 계획과 생성을 담당하는 스킬로 넘기고 [이미지 자산 흐름](../image-assets.md)의 승인 경계를 그대로 적용합니다.

## 검토·승인 기준

실행 경로를 골랐다고 해서 결과까지 승인되는 것은 아닙니다. 이 스킬은 합격을 약속하거나 사용자가 하지 않은 경험을 만들지 않으며, 하나의 진로만 정답이라고 말하지 않습니다.

## 실패했을 때와 재개 방법

사례 ID를 찾지 못하면 비슷한 사례를 추측하지 않습니다. 한 번만 되묻거나 일반 자연어 요청으로 다시 판단하고, 어느 쪽을 택했는지 밝힙니다. 상대 제품 조회 결과는 설치·활성, 미설치·비활성, 확인 불가로 나눠 적습니다. 뒤의 두 상태는 같은 제한 절차로 처리하더라도 서로 다른 사실이므로, 확인한 내용과 확인하지 못한 내용을 구분하고 이 제품만으로 가능한 범위를 안내합니다.

```text
$game-design-career:game-design-career 기존 경로 선택 기록에 정리한 항목과 선택한 실행 경로를 보존하고 새로 확인된 입력만 반영해 다시 정리해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 인계 요청문**

@Game Design Career 경로 선택 기록이 지목한 스킬로 이어서 작업을 진행해.

```text
$game-design-career:orchestrate-game-design-career artifact=<artifact-path> 경로 선택 기록에 정리한 항목과 선택한 실행 경로를 보존하고 다음 인계를 실행해.
```

## 관련 문서

[설치 안내](../installation.md), [orchestrate-game-design-career 스킬](./orchestrate-game-design-career.md), [Studio 제품 가이드](../../game-design-studio/README.md), [스킬 선택표](README.md), [제품 작업 흐름](../workflow.md)

<!-- PROMPT-TEMPLATES:START game-design-career:game-design-career -->
### 재사용 프롬프트 템플릿

- [beginner: 어떤 커리어 스킬을 부를지 모르는 요청을 실행 경로 하나로](../../prompt-templates/career/game-design-career.md#careergame-design-careerbeginner)
- [standard: 여러 도메인이 섞인 커리어 요청을 담당 제품 하나로](../../prompt-templates/career/game-design-career.md#careergame-design-careerstandard)
- [advanced: 사례 ID와 교차 제품 인계를 정리하는 커리어 진입](../../prompt-templates/career/game-design-career.md#careergame-design-careeradvanced)
<!-- PROMPT-TEMPLATES:END game-design-career:game-design-career -->
