# design-game-content

## 목적과 최종 산출물

퀘스트·NPC·보스 encounter를 canonical system/data ID와 생산 근거에 연결한 플레이 가능한 콘텐츠 명세로 만듭니다.

## 사용할 때

- quest, level, encounter, character, enemy나 반복 활동을 설계할 때
- telegraph, strategy, reward, repeatability와 production resource를 함께 검토할 때

## 사용하지 않을 때

- 전체 비전은 `define-game-vision`, 미확정 규칙은 `design-game-systems`를 먼저 사용합니다.
- portfolio-wide staffing과 일정은 `plan-game-production`을 사용합니다.

## 필수 입력과 선택 입력

- 필수: content purpose, target player state, supporting system/data ID, strategy, reward, production evidence, owner
- 선택: 반복 목표, accessibility needs, 기존 콘텐츠 문서, 검토 질문
- person-day·capacity·throughput은 team/pipeline 근거가 없으면 provisional입니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 폐허 도시 퀘스트, 안내 NPC와 협동 보스 encounter를 canonical system ID에 연결해. telegraph, 결정점, 결과, 보상, 반복성과 생산 근거를 포함해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:design-game-content 퀘스트·NPC·보스 encounter를 narrative-quest-npc로 명세하고 모든 행동과 보상을 system/data ID에 연결해.
```

## 내부 진행 흐름

purpose와 player context를 정하고 setup, telegraph, decision, outcome, reward, variation, failure/recovery를 ID로 연결합니다. 주 템플릿/profile은 `narrative-quest-npc`/`narrative-quest-npc-specification`, 전투 단위는 `character-skill-combat-monster`가 적합합니다. 관련 역할은 `content-narrative-designer`, `lead-game-designer`, `production-feasibility-critic`; 다음 스킬은 `review-game-design`입니다.

## 생성 파일과 결과 구조

Canonical Artifact에 콘텐츠 계약, evidence, assumptions, validation tasks, gate와 owners를 남깁니다. 예상 결과 요약: 플레이어 전략과 생산 비용이 시스템 계약에 연결된 content spec이 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `narrative-quest-npc` 또는 `character-skill-combat-monster` — [narrative-quest-npc 템플릿](../templates.md#narrative-quest-npc), [character-skill-combat-monster 템플릿](../templates.md#character-skill-combat-monster).
- Quality Profile ID: `narrative-quest-npc-specification` 또는 `character-skill-combat-monster-specification`.
- Reviewer/role ID: `content-narrative-designer · lead-game-designer · production-feasibility-critic`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

`npc-story-beat-image`은 narrative-quest-npc profile에서 production 근거가 있을 때만 illustration lifecycle로 계획합니다. 퀘스트 흐름·NPC 상태·의존성은 `skillstead-quest-flow-diagram`이 prose보다 명확할 때만 Skillstead로 만듭니다. 전투 template을 고르면 그 profile의 required image/diagram slot을 별도 selection record로 사용합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

연결되지 않은 system/data dependency와 근거 없는 비용은 blocker입니다. AI·UGC 자료는 provenance, rights, consent, moderation과 human approver 없이는 승인하지 않습니다.

## 실패·fallback·재개 방법

시스템 ID나 pipeline rate가 없으면 추정치를 채우지 않고 해당 부분을 provisional로 보존합니다.

```text
$game-design-studio:design-game-content 기존 narrative-quest-npc를 보존하고, 새 combat-system ID와 측정된 encounter 제작 rate를 연결해 blocker부터 재검토해.
```

## 다음 작업 요청문

**복사 가능한 다음 handoff**

@Game Design Studio review-game-design로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-studio:review-game-design artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[narrative-quest-npc 템플릿](../templates.md#narrative-quest-npc), [review-game-design 스킬](./review-game-design.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
