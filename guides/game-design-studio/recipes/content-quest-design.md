# 콘텐츠·퀘스트를 플레이 가능한 제작 계약으로 만들기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![콘텐츠·내러티브·퀘스트 연결](../../assets/game-design-studio/content-narrative-quest-map.png)

## 완료 목표

퀘스트 stage, NPC, 선택, 보상, 시스템 state와 제작 범위를 한 artifact에 연결하고 권리·동의·production risk를 드러냅니다.

## 준비할 입력

- 콘텐츠 목적, system/data ID, narrative boundary, NPC/UGC 권리 정보와 제작 제약
- Canonical Artifact 경로 family: `game-design/<project-id>/narrative-quest-npc/`
- 템플릿: `narrative-quest-npc`; 전투 콘텐츠면 `character-skill-combat-monster`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 폐광 퀘스트의 stage, branch, NPC, choice, reward와 실패 복구를 시스템 state ID에 연결해. 외부 원작·UGC·AI 대사는 rights와 consent가 없으면 blocker로 남겨.
```

Codex CLI 명시 호출:

```text
$game-design-studio:design-game-content game-design/<project-id>/narrative-quest-npc/를 작성하고 $game-design-studio:design-game-systems 및 $game-design-studio:plan-game-production으로 의존성과 제작 위험을 검토해.
```

## 단계별 진행

1. template과 quality profile을 선택하고 퀘스트의 source stable section과 system/data ID를 고정합니다.
2. `design-game-content`로 stage, gate, branch, outcome, repeat path와 failure-recovery를 작성합니다.
3. `design-game-systems`으로 state·reward·condition 연결을 검증하고 `plan-game-production`으로 capacity와 kill criteria를 기록합니다.
4. `review-game-design` finding에 narrative consistency, fairness, rights/consent, production risk를 분리해 남깁니다.
5. 퀘스트 관계는 `visualize-game-design` SVG로만 도식화합니다. 권리·동의가 아직 없으므로 이 사례의 권장 mode는 `prompt-only`이며 prompt/placeholder만 남깁니다. 실제 illustration을 선택할 때만 사람 `select` receipt의 stable asset ID 범위로 재개합니다. `required`는 finite required asset만, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Narrative Owner **최유진**이 player choice와 ending boundary를, Production Owner **한지훈**이 제작 범위와 kill criteria를 승인합니다. 권리·동의 증거가 없으면 두 사람 모두 승인할 수 없습니다.

## 예상 결과

`game-design/<project-id>/narrative-quest-npc/content.md`에 quest contract, asset placeholder, dependency와 blocked gate가 남습니다. Chromium renderer가 없으면 SVG source와 alt text만 보존하고 PNG는 fallback 상태로 기록합니다.

## 실패와 재개

system ID가 바뀌거나 rights evidence가 빠지면 해당 stage를 `blocked`로 두고 나머지 canonical text를 덮어쓰지 않습니다. artifact path와 blocked decision ID로 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [콘텐츠 스킬](../skills/design-game-content.md), [제작 스킬](../skills/plan-game-production.md), [이미지 자산](../image-assets.md)
- [이미지 자산 수명주기](../../assets/shared/image-asset-lifecycle.png)는 illustration 승인 경계를 설명합니다.
