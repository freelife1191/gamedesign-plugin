# 제작 위험을 검토하고 안전하게 내보내기 준비하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![제작 위험·검토·내보내기 흐름](../../assets/game-design-studio/production-risk-review-flow.png)

## 완료 목표

제작 scope·risk·owner·kill criteria를 review finding과 export preflight에 연결해, 승인된 Canonical Artifact만 delivery 준비 상태로 만듭니다.

## 준비할 입력

- 목표 경험, capacity, dependency, milestone, risk, decision owner, 요청 format과 audience
- Canonical Artifact 경로 family: `game-design/<project-id>/production-scope-risk/` 및 `game-design/<project-id>/game-design-review/`
- 템플릿: `production-scope-risk`, `game-design-review`, 필요 시 `decision-change-log`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Studio 현재 feature set의 scope, capacity, dependency, milestone, hard No-Go와 kill criteria를 검토해. blocker를 owner와 최소 수정으로 남기고, 승인된 content.md만 MD·PDF·DOCX·PPTX 준비 manifest로 보내 줘.
```

Codex CLI 명시 호출:

```text
$game-design-studio:plan-game-production game-design/<project-id>/production-scope-risk/를 작성하고 $game-design-studio:review-game-design, $game-design-studio:plan-image-assets, $game-design-studio:visualize-game-design 뒤 $game-design-studio:export-game-design-documents로 renderer-neutral export manifest를 준비해.
```

## 단계별 진행

1. `plan-game-production`으로 scope, prototype, dependency, capacity, milestone, owner, kill criteria와 hard No-Go를 기록합니다.
2. `review-game-design`으로 traceable finding, severity, direct evidence, minimal fix와 decision owner를 만듭니다.
3. named human이 blocker의 수용·수정·예외 승인·보류를 결정하기 전에는 export를 성공으로 선언하지 않습니다.
4. `export-game-design-documents`가 `content.md` preflight, capability snapshot, safe output directory와 MD/PDF/DOCX/PPTX job manifest를 준비합니다. renderer와 terminal QA가 없으면 형식 상태는 `pending`, `blocked` 또는 `unavailable`로 남습니다.
5. production handoff 관계는 `visualize-game-design` SVG로, diagram 아닌 illustration은 `plan-image-assets`로 분리합니다. 이 delivery 사례는 `document-approved` asset만 필요하므로 새 생성은 `prompt-only`로 보류하고, 필요해지면 receipt와 finite manifest로 `select`를 재개합니다. `required`는 finite required asset만, `all`은 declared asset만 생성합니다. [이미지 자산 흐름](../image-assets.md)을 따릅니다.

## 사람이 결정할 지점

Production Owner **한지훈**이 scope와 kill criteria를, Review Decision Owner **김서윤**이 blocker disposition을, Export Owner **오지은**이 실제 renderer QA evidence를 승인합니다. 생성 파일 존재나 PNG render는 어느 승인도 대체하지 않습니다.

## 예상 결과

`production-scope-risk/content.md`, `game-design-review/content.md`, 그리고 renderer-neutral export manifest가 남습니다. SVG lint를 통과해도 Chromium renderer가 없으면 SVG source, fallback reason, PNG `unavailable`을 보존합니다.

## 실패와 재개

unsafe output, preflight failure 또는 unavailable renderer는 canonical text와 기존 owner output을 변경하지 않습니다. Artifact path, finding ID, requested format을 지정해 실패한 gate부터 재개합니다. Chromium 또는 필요한 renderer/capability가 unavailable이면 PNG는 `unavailable` 상태로 남기고 Canonical Artifact와 기존 owner output을 보존합니다.

## 관련 기능

- [제작 스킬](../skills/plan-game-production.md), [검토 스킬](../skills/review-game-design.md), [내보내기](../exports.md)
- [공통 내보내기 흐름](../../assets/shared/document-export-flow.png), [이미지 자산](../image-assets.md)
