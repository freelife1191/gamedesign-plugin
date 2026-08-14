# 컷씬 비주얼 프리프로덕션

이 가이드는 컷씬의 brief, beat, shot, continuity bible, 마스터 프롬프트와 이미지 검토를 한 패키지로 정리하는 방법을 설명합니다. 이미지 생성은 기획 작업과 별개입니다. 비용을 확인하고 이름을 기록한 실시간 승인을 받기 전에는 provider를 호출하지 않습니다.

준비할 입력은 컷씬 목적, 플레이어가 조작을 되돌려받는 게임 상태, beat와 shot, 인물·배경·소품의 연속성 조건, 참고 이미지의 권리 상태, 원하는 모델·quality·size, 유한한 USD cap입니다. 결과물은 `cutscene-brief`, `cutscene-shot-package`, `cutscene-prompt-package`, `cutscene-cost-estimate`, `cutscene-continuity-review`로 남깁니다. 기준 기획 결과물과 [이미지 자산 가이드](image-assets.md)의 권리·사람 검토 경계도 함께 확인하세요.

## 컷씬 비주얼 프리프로덕션

## Prompt Only

Prompt Only는 이미지 바이트를 만들지 않습니다. 컷씬 brief, beat sheet, shot list, continuity bible, style/reference master 계획, 프롬프트 패키지와 예상 경로만 작성합니다. provider 호출은 0회이고 USD는 0입니다. 참조 hash, 승인 상태, 생성 receipt를 임의로 만들지 않습니다.

```text
컷씬 brief와 beat만 작성
```

```text
shot list와 continuity bible 작성
```

```text
마스터 프롬프트 패키지만 작성
```

대사만 달라지는 variant는 이미지가 아니라 overlay로 남깁니다. 새 keyframe이나 화면 구성이 필요한 visual variant는 기존 asset을 덮어쓰지 않고 새 derivative ID를 부여합니다.

## Estimate Only

Estimate Only는 현재 wave의 비용을 계산하지만 이미지를 생성하지 않습니다. `style-master`, `reference-masters`, `keyframes`, `storyboard`는 반드시 이 순서로 유료 dispatch합니다. 다음 wave의 기획·견적 초안은 만들 수 있어도, 이전 wave가 현재 승인·완료 상태가 아니면 다음 wave를 provider에 dispatch하지 않습니다.

```text
스타일 마스터 비용과 승인
```

각 estimate에는 다음을 빠짐없이 공개합니다.

- asset ID와 count
- provider와 model, quality, size
- USD minimum, expected, maximum과 유한한 cap
- retryReserve, 가격 출처와 pricing time, `costStatus`
- 현재 estimate·pricing snapshot·request schedule에 연결된 receipt

host가 비용을 알려 주지 못하면 `costStatus`는 `unavailable`입니다. 이 경우 비용을 0으로 간주하지 않으며 provider 호출은 0회로 멈춥니다. cap 또는 최대 비용이 없을 때도 생성할 수 없습니다.

## Generate After Approval

Generate After Approval은 현재 정확한 wave의 estimate를 공개한 뒤에만 쓸 수 있습니다. 승인에는 승인자 이름, 승인 시각, 대상 wave, count, model, quality, size, USD 범위, cap, retryReserve, pricing time과 `costStatus`가 묶여야 합니다. 이전 wave의 승인이나 포괄 승인은 다음 wave에 재사용할 수 없습니다.

```text
승인한 스타일 master 생성
```

`style-master`가 완료되고 receipt가 현재 상태와 일치하면 reference를 다시 묶습니다.

```text
reference master bound prompt 재계산
```

```text
reference master 비용과 승인
```

`reference-masters`가 완료되기 전에는 keyframe을 실행하지 않습니다. 승인·비용·선행 완료 조건이 맞지 않으면 provider 호출 0회로 멈춥니다. provider를 이미 호출한 뒤 실패하면 성공한 bytes와 receipt, 실패한 stable ID의 retryable 또는 terminal outcome을 보존하고 추가 호출 없이 멈춥니다.

```text
keyframe 비용과 승인
```

`keyframes`가 완료되어야 storyboard를 검토할 수 있습니다. visual variant도 새 derivative ID, 별도 estimate, 별도 실시간 승인을 거칩니다. 대사만 바뀌는 variant에는 이미지와 provider 호출이 없습니다.

```text
storyboard와 variant 비용과 승인
```

생성 결과만으로 `document-approved`나 `production-candidate`가 되지 않습니다. 스타일, reference, keyframe, storyboard의 lineage와 output을 점검한 continuity review가 먼저 필요합니다.

```text
continuity 검토와 실패 ID 재시도
```

재시도는 최신 retryable 실패 stable ID만 대상으로 합니다. 성공 asset을 덮어쓰거나 terminal failure를 다시 실행하지 않습니다. subset estimate를 새로 만들지 않고, 여전히 현재인 full-wave estimate·pricing snapshot·request schedule과 남은 retryReserve를 사용합니다. 이전 승인이 오래됐다면 같은 현재 estimate에 이름을 기록한 실시간 승인을 새로 받습니다. estimate, 가격, request schedule이 달라졌거나 만료됐다면 현재 runtime은 새 journal epoch나 재계획을 만들지 않으므로 provider 호출 0회로 중단합니다.

## 작업 순서와 handoff

1. `design-cutscene-visual-preproduction`으로 컷씬 패키지를 만듭니다.
2. `apply-document-quality-profile`에서 `cutscene-visual-preproduction` 구조 기준을 별도로 확인합니다.
3. 각 wave에서 Estimate Only로 비용을 공개하고 승인 대기 상태를 유지합니다.
4. 승인된 현재 wave만 생성한 뒤 completion과 receipt를 보존합니다.
5. immutable manifest는 `validateCutsceneManifestHandoff({manifest})`를 통과한 뒤 `plan-image-assets`로 전달합니다.
6. 현재 wave의 승인된 dispatch는 `generate-image-assets`, continuity finding은 `review-image-assets`로 전달합니다. 두 handoff는 실시간 승인 권한을 대체하지 않습니다.
7. `review-cutscene-continuity.mjs`의 gate를 통과한 뒤에만 문서·제작 후보 상태를 사람이 결정합니다.

컷씬 실무 경로는 [Studio 전체 워크플로](workflow.md), [스킬 레퍼런스](skills/README.md), [이미지 자산](image-assets.md), [Studio FAQ](faq.md)에서 다시 찾을 수 있습니다.
