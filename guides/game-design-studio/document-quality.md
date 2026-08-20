# 문서 품질 기준

Game Design Studio는 기준 결과물마다 기본 품질 프로필 하나를 선택합니다. 품질 프로필은 내용을 대신 작성하거나 승인하지 않습니다. 문서를 쓰고 검토하기 전에 필요한 섹션, 표, Skillstead 도식, 이미지와 승인 기준을 정합니다.

## 선택 입력과 우선순위

필수 입력은 `goal`, `audience`, `artifact type`, `requested format`입니다. 먼저 호환되는 템플릿인지 확인한 뒤 결과물 유형, 형식, 독자, 목표가 얼마나 맞는지 차례로 비교합니다. 점수가 같으면 프로필 ID의 사전순으로 결정합니다. 등록된 `override`만 사용할 수 있으며, 알 수 없는 값이 들어오면 가장 가까운 ID와 차이를 보여 주고 명시적인 대체 선택 기록을 요구합니다.

## 기본 품질 프로필

- 결과물마다 기본 프로필은 정확히 하나입니다.
- 서로 호환되지 않는 결과물은 선택 기록을 따로 남깁니다.
- 설치본의 기준 색인은 `references/shared/document-quality/indexes/studio.json`, 템플릿 매핑은 `references/document-quality/template-profile-map.json`입니다.
- 선택 결과에는 기본 프로필·추가 조건·프리셋 ID, 선택 이유, 점수, 동점 처리와 대체 선택을 기록합니다.

## 추가 조건

등록된 추가 조건은 `mobile`, `live-service`, `pc-console`입니다. 필요한 항목을 더할 수 있지만 기본 요구사항이나 근거·권리·책임 있는 설계·출시 승인 조건을 삭제하거나 약화할 수 없습니다. ID가 등록되어 있어도 패키지의 기준 바이트와 식별 정보가 맞지 않으면 거부합니다.

## 중립 프리셋

중립 프리셋은 최대 하나만 더합니다. 설치된 ID는 `competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling`입니다. 참고용 지침일 뿐이며 특정 회사·프로젝트·상표·URL·로고·원본 이미지·레이아웃을 복제하거나 해당 주체의 보증을 받았다고 주장하지 않습니다.

## 확인 목록과 요구사항 명세

선택을 마치면 필수 섹션, 표, 도식, 이미지와 승인 기준을 안정된 ID가 있는 확인 목록으로 복사합니다. Skillstead 도식 자리는 렌더링 품질 검사를 마치기 전까지 `unverified` 상태입니다. 요구사항 명세는 기준 원문 연결, 계약·확인 목록의 다이제스트와 순서가 정해진 전체 필수 ID에 묶입니다. 호출자가 임의로 줄이거나 바꾼 명세는 기준으로 인정하지 않습니다.

## 상태와 승인

상태는 다음 순서로만 전진합니다.

```text
draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved
```

- `structurally-complete`: 외부 검사 기능이 실제 결과물을 확인하고, 다이제스트에 묶인 검증 기록을 남겨야 합니다.
- `evidence-reviewed`: 같은 결과물과 명세에 연결된 근거 검토가 필요합니다.
- `visual-reviewed`: 렌더링 품질 검사와 모든 Skillstead 도식 자리·이미지 권리 근거가 필요합니다.
- `document-approved`: 실명 또는 식별 가능한 담당자의 승인 기록과 모든 책임 검토 기준이 필요합니다.

생성 이미지, 렌더링 파일, 요청한 도식, 자체 확인 문구와 호출자가 넘긴 상태 문자열만으로는 어느 단계도 자동 승인되지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Studio game-design-brief 템플릿으로 모바일 라이브 서비스 RPG의 MD를 만들 품질 기준을 골라 줘. 호환되는 기본 프로필 하나와 mobile·live-service 추가 조건, function-first 프리셋, ID가 고정된 확인 목록을 먼저 보여 줘.
```
