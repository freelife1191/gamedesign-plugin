# 문서 품질 profile

Game Design Studio는 Canonical Artifact마다 primary profile 하나를 선택합니다. profile은 내용을 대신 쓰거나 승인하지 않고, 작성·검토 전에 필요한 section, table, Skillstead diagram, image와 acceptance criterion을 고정합니다.

## 선택 입력과 우선순위

필수 입력은 goal, audience, artifact type, requested format입니다. compatible template match를 우선한 뒤 artifact type, format, audience overlap, goal overlap 순으로 점수화하고 마지막 동점은 profile ID lexical order로 결정합니다. 알려진 explicit override만 사용할 수 있으며 unknown override는 가장 가까운 ID와 차이를 보여 준 뒤 explicit fallback record가 있어야 합니다.

## Primary profile

- artifact마다 primary는 정확히 하나입니다.
- 비호환 deliverable은 separate selection record를 사용합니다.
- 설치된 canonical index는 `references/shared/document-quality/indexes/studio.json`, template 매핑은 `references/document-quality/template-profile-map.json`입니다.
- 선택 결과에는 primary/overlay/preset ID, 이유, 점수, tie-break와 fallback을 기록합니다.

## Additive overlay

알려진 overlay는 `mobile`, `live-service`, `pc-console`입니다. 필요한 항목을 추가할 수 있지만 primary requirement나 evidence·rights·responsible-design·release gate를 삭제하거나 약화할 수 없습니다. ID가 알려져 있어도 package의 canonical bytes와 identity가 맞지 않으면 거부합니다.

## Neutral preset

neutral preset은 최대 하나만 더합니다. 설치된 ID는 `competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling`입니다. reference-only guidance이며 특정 회사·프로젝트·상표·URL·logo·원본 image/layout을 복제하거나 endorsement를 주장하지 않습니다.

## Checklist와 manifest

선택 후 required section, table, diagram, image와 acceptance criterion을 stable ID checklist로 복사합니다. Skillstead diagram slot은 renderer QA 전까지 unverified입니다. requirement manifest는 canonical source binding, contract/checklist digest와 전체 ordered required IDs에 묶이며 caller가 축소하거나 대체한 manifest는 authority가 아닙니다.

## 상태와 승인

상태는 다음 순서로만 전진합니다.

```text
draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved
```

- `structurally-complete`: 실제 artifact를 외부 inspection adapter가 검사한 digest-bound receipt가 필요합니다.
- `evidence-reviewed`: 같은 artifact/manifest에 묶인 evidence audit가 필요합니다.
- `visual-reviewed`: renderer QA, 모든 Skillstead slot과 image rights evidence가 필요합니다.
- `document-approved`: 이름 있는 사람의 human receipt와 모든 responsible gate가 필요합니다.

generated image, rendered file, requested diagram, self-attestation과 caller state string은 어느 상태도 자동 승인하지 않습니다.

## 복사 가능한 요청문

```text
@Game Design Studio game-design-brief 템플릿으로 모바일 live-service RPG의 MD를 만들 품질 profile을 선택해. compatible primary 하나, mobile·live-service overlay, function-first preset과 stable checklist를 먼저 반환해.
```
