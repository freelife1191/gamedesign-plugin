# 대표 진입 스킬과 Studio ↔ Career 인계 구현 계획 (계획 3/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제품마다 대표 진입 스킬 하나(`game-design-studio`, `game-design-career`)를 두어 넓거나 모호한 요청과 사례 ID를 라우팅 영수증과 함께 실제 전문 스킬·오케스트레이터로 연결하고, 두 제품이 함께 필요한 요청을 단방향 인계 계약 한 번으로 처리한다.

**Architecture:** 새 라우팅 엔진을 만들지 않는다. 대표 스킬은 네 가지(intake 정규화, route 판정, 사례 ID 해석, 영수증 공개)만 소유하는 얇은 Markdown 스킬이며, 실제 결정론은 이미 있는 `references/routing.json`의 `routes`와 `tooling/lib/marketplace-proof-harness.mjs`의 route receipt 검증이 담당한다. 인계 계약은 새 스키마 파일이 아니라 `shared/suite-handoff/references/handoff.md`의 sentinel JSON 블록 하나이며, `tooling/lib/build-product.mjs`가 이를 각 제품 대표 스킬의 `references/`로 동일 바이트 투영한다. 상대 제품 설치 여부는 새 스크립트 없이 `shared/scripts/inspect-game-design-plugin-updates.mjs`의 기존 폐쇄 파싱을 감싼 얇은 조회 함수로 확인한다.

**Tech Stack:** Node.js ESM (`"type": "module"`), `node:test` + `node:assert/strict`, 외부 의존성 없음. 스킬·계약 본문은 Markdown.

**Spec:** `docs/superpowers/specs/2026-08-17-suite-entry-upgrade-and-windows-encoding-design.md` (B절·C절 = 구현 순서 4·5단계)

## 선행 상태

착수 시점에 이미 끝나 있는 것이다. 다시 하지 않는다.

- 계획 1(인코딩·경로 게이트)과 계획 2(스위트 업데이트 스킬)는 `main`에 병합돼 있다. HEAD `2b70ae1`, `origin/main`과 동일.
- `npm test`가 `main`에서 2348개 중 0 실패다.
- 업데이트 안내는 실제로 동작한다. 릴리스가 없는 저장소는 tag로 폴백하고, 설치본 비교는 마켓플레이스 스냅샷 manifest를 읽는다.

## 스펙 정정 (계획서가 기준이다)

스펙 B절 "배치"는 `upgrade-game-design-suite`가 `shared/updates/skills/`에 있다고 적었다. 실제 위치는 `shared/suite-update/skills/`다. 계획 2가 옮겼고 이유는 두 가지다. `shared/updates`는 `references/shared/updates`로 디렉터리 통째 복사되므로 그 아래 `skills/`를 두면 패키지에 중복 트리가 생기고, 파일 단위 인벤토리로 바꾸면 advisory가 자기 설정을 찾는 저장소 레이아웃 폴백이 깨진다. 스펙 문장을 근거로 이 경로를 "고치면" 빌드가 깨진다. 건드리지 않는다.

## Global Constraints

- Node `>=18` (`package.json`의 `engines`). 로컬 개발 환경은 v24.19.0.
- ESM 전용. `require` 금지, `import` 사용.
- 외부 의존성 0. `package.json`에 `dependencies`가 없다. 표준 라이브러리만 사용한다.
- 테스트는 `node:test`의 `test()`와 `node:assert/strict`를 쓰고, 기존 파일의 표 기반 케이스 스타일을 따른다.
- 새로 만드는 모든 파일은 BOM 없는 UTF-8, LF 줄바꿈, 마지막 줄 개행 포함. 계획 1의 게이트가 위반을 빌드에서 차단한다.
- 패키지 상대 경로 예산 150자. 이 계획의 최장 신규 경로는 `skills/game-design-studio/references/handoff.md`(46자)다.
- 스킬 ID는 `^[a-z0-9-]+$`, 64자 이하. description은 1024자 이하이며 `<`, `>`를 포함할 수 없다.
- 커밋 메시지는 영어로 쓰고 Conventional Commits 접두사(`feat:`, `fix:`, `test:`, `docs:`, `chore:`)를 사용한다.
- 대표 스킬은 전문 스킬의 안전·근거·승인 규칙을 완화하지 않는다. 자동 라우팅은 자동 승인이 아니다.
- 검사 단계에서 provider 명령(`marketplace upgrade`, `plugin add`)을 호출하지 않는다. 상대 제품 조회는 `plugin list --json` 읽기 하나뿐이다.
- 사용자 파일을 자동으로 고치지 않는다. 진단하고 안내만 한다.
- 실패 메시지에 토큰, 사용자 홈 절대 경로, 원격 응답 본문을 넣지 않는다.

---

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `products/game-design-studio/plugin/skills/game-design-studio/SKILL.md` | Studio 대표 진입 스킬 | 신규 |
| `products/game-design-career/plugin/skills/game-design-career/SKILL.md` | Career 대표 진입 스킬 | 신규 |
| `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md` | Studio 오케스트레이터 | 수정 — description에서 `has ambiguous scope` 조각 제거 |
| `shared/suite-handoff/references/handoff.md` | 인계 계약 단일 소스 (sentinel JSON) | 신규 |
| `tooling/lib/suite-handoff-contract.mjs` | 계약 파서와 봉투 검증기 | 신규 |
| `tooling/lib/build-product.mjs` | 제품 빌드 | 수정 — `suite-handoff` 제품별 매핑, 정확 인벤토리 |
| `tooling/lib/product-contract.mjs` | 제품 계약 로더 | 수정 — `allowedModules`에 `suite-handoff` 추가 |
| `shared/contracts/product.schema.json` | 제품 스키마 | 수정 — `sharedModules` enum 확장 |
| `products/*/product.json` | 제품 정의 | 수정 — `sharedModules`에 `suite-handoff` 추가 |
| `products/*/plugin/references/routing.json` | 라우팅 레지스트리 | 수정 — `skillIds`, `plannedPaths.skills`, Career는 `directUseReviewOwners`도 |
| `tooling/isolation-smoke.mjs` | 격리 스모크 | 수정 — `EXACT_SKILL_IDS` 두 제품 |
| `tooling/marketplace-smoke.mjs` | 설치 스모크 | 수정 — `PACKAGED_SKILL_COUNTS` |
| `tooling/lib/prompt-template-catalog.mjs` | 프롬프트 카탈로그 | 수정 — `PROMPT_KIND_COUNTS["skill-template"]` |
| `tooling/lib/archify-catalog.mjs` | 패키지 미러 매핑 | 수정 — `suite-handoff` 매핑 두 건 |
| `shared/scripts/inspect-game-design-plugin-updates.mjs` | 설치 조회 | 수정 — `inspectInstalledSuiteProducts`와 `--products` |
| `guides/prompt-templates/catalog/studio-entry.json` | Studio 대표 스킬 프롬프트 3개 | 신규 |
| `guides/prompt-templates/catalog/career-entry.json` | Career 대표 스킬 프롬프트 3개 | 신규 |
| `guides/prompt-templates/catalog.json` | 카탈로그 소스 목록 | 수정 — 두 소스 추가 |
| `guides/game-design-studio/skills/game-design-studio.md` | Studio 대표 스킬 가이드 | 신규 |
| `guides/game-design-career/skills/game-design-career.md` | Career 대표 스킬 가이드 | 신규 |
| `tests/contracts/suite-entry-skills.test.mjs` | 대표 스킬 계약 | 신규 |
| `tests/contracts/suite-handoff-contract.test.mjs` | 인계 계약과 봉투 검증 | 신규 |
| `tests/unit/installed-suite-products.test.mjs` | 상대 제품 조회 | 신규 |

### 폐쇄 인벤토리 목록

새 스킬 하나가 건드리는 폐쇄 목록이다. 계획 2의 `ed17a01`이 같은 목록을 한 번 통과했으니, 실패하면 그 커밋의 diff가 정답 모양이다.

1. `products/<p>/plugin/references/routing.json` — `skillIds`, `plannedPaths.skills`
2. `tooling/isolation-smoke.mjs:31-49` — `EXACT_SKILL_IDS`
3. `tooling/marketplace-smoke.mjs:19-22` — `PACKAGED_SKILL_COUNTS`
4. `tests/products/studio/product-contract.test.mjs:17-44` — `skillIds`, `directSkillIds` 슬라이스, `installedSkillIds`, `plannedPaths`
5. `tests/products/career/product-contract.test.mjs:12-40` — 같은 네 값
6. `tests/unit/validate-packages.test.mjs:8-26` — `expectedSkillIdsByProduct`, 그리고 테스트 이름의 `49-skill`
7. `tests/unit/prompt-template-catalog.test.mjs:1905-1906` — 제품별 인벤토리 24 → 25
8. `tests/contracts/shared-contract.test.mjs:495-503, 598-605` — 공유 스킬 목록과 Career `skillIds` 기대값
9. `tests/contracts/user-guides-studio.test.mjs:60-101` — lane 매핑, source-bound 경로 목록
10. `tests/contracts/user-guides-career.test.mjs:15, 700-720` — 같은 두 값
11. `tests/contracts/user-guide-use-case-manifest.test.mjs:36-46` — `DIRECT_USE_EXCLUDED_SKILL_IDS`, `ROUTE_BOUNDARY_SKILL_IDS`
12. `tests/contracts/root-readme-user-guides.test.mjs` — 스킬 표 행(103, 412, 438, 467, 493행 인근)
13. `tests/products/*/readme.test.mjs` — 제품 README의 직접 스킬 개수 문장
14. `guides/game-design-*/skills/README.md` — 스킬 목록 표
15. `guides/game-design-*/use-cases/skill-workbench.md` — lane 표
16. `guides/archify-diagrams/catalog.json` — 패키지 미러 origin 항목과 `source_digest`
17. `plugins/*/BUILD-MANIFEST.json`과 `plugins/*` 트리 — `npm run build`로 재생성

---

### Task 1: 두 제품 대표 진입 스킬을 착지시킨다

대표 스킬 두 개를 소스에 만들고, 그 존재를 요구하는 모든 폐쇄 인벤토리를 함께 갱신한다. 스킬만 추가하면 `npm run validate`가 열 군데 넘게 빨개지므로 한 태스크로 묶는다.

**Files:**
- Create: `products/game-design-studio/plugin/skills/game-design-studio/SKILL.md`
- Create: `products/game-design-career/plugin/skills/game-design-career/SKILL.md`
- Create: `tests/contracts/suite-entry-skills.test.mjs`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md:3`
- Modify: `products/game-design-studio/plugin/references/routing.json` (`skillIds`, `plannedPaths.skills`)
- Modify: `products/game-design-career/plugin/references/routing.json` (`skillIds`, `plannedPaths.skills`, `directUseReviewOwners`)
- Modify: `tooling/isolation-smoke.mjs:31-49`
- Modify: `tooling/marketplace-smoke.mjs:19-22`
- Modify: `tests/products/studio/product-contract.test.mjs:17-44`
- Modify: `tests/products/career/product-contract.test.mjs:12-40`
- Modify: `tests/unit/validate-packages.test.mjs:8-26`
- Modify: `tests/contracts/shared-contract.test.mjs:598-605`
- Modify: `tests/contracts/user-guide-use-case-manifest.test.mjs:36-46`
- Test: `tests/contracts/suite-entry-skills.test.mjs`

**Interfaces:**
- Consumes: 없음.
- Produces: 스킬 ID `game-design-studio`와 `game-design-career`. 두 ID는 각각 자기 제품에만 존재한다. Task 2가 이 스킬 본문의 영수증·사례 ID 규칙을 고정하고, Task 3이 두 스킬의 `references/handoff.md`를 투영하며, Task 5가 본문의 미설치 degrade 문구를 참조한다.

- [ ] **Step 1: 실패하는 계약 테스트를 먼저 쓴다**

`tests/contracts/suite-entry-skills.test.mjs`를 새로 만든다.

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// 대표 스킬 ID는 제품 ID와 같다. 사용자가 제품 이름으로 부르는 것이 진입점이고, 인계 계약의
// returnToSkill도 이 동일성 위에서 성립한다.
const ENTRY_SKILLS = Object.freeze([
  Object.freeze({
    product: "game-design-studio",
    orchestrator: "orchestrate-game-design-project",
    counterpart: "game-design-career",
  }),
  Object.freeze({
    product: "game-design-career",
    orchestrator: "orchestrate-game-design-career",
    counterpart: "game-design-studio",
  }),
]);

const REQUIRED_HEADINGS = Object.freeze([
  "## Overview",
  "## Triggers",
  "## Non-triggers",
  "## What this skill owns",
  "## Intake normalization",
  "## Route decision",
  "## Case ID resolution",
  "## Routing receipt",
  "## Cross-product handoff",
  "## Operating rules",
  "## Completion report",
]);

async function entrySkill(product) {
  return readFile(path.join(repoRoot, "products", product, "plugin/skills", product, "SKILL.md"), "utf8");
}

test("each product ships one entry skill named after the product itself", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    assert.match(skill, new RegExp(`^---\\nname: ${product}\\ndescription: [^\\n]+\\n---\\n`, "u"));
    const description = /^description: (.+)$/mu.exec(skill)[1];
    assert.ok(description.length <= 1024, `${product}: description is too long`);
    assert.doesNotMatch(description, /[<>]/u, `${product}: description must not contain angle brackets`);
  }
});

test("the entry skill body carries every section the routing contract depends on", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    for (const heading of REQUIRED_HEADINGS) {
      assert.ok(skill.includes(`\n${heading}\n`), `${product}: missing ${heading}`);
    }
  }
});

// 대표 스킬은 자기 제품 오케스트레이터에만 위임하고, 상대 제품 전용 스킬 이름을 본문에 담지 않는다.
// 담는 순간 설치되지 않은 스킬을 부르라는 지시가 되기 때문이다.
test("an entry skill delegates to its own orchestrator and never names the other product's skills", async () => {
  for (const { product, orchestrator, counterpart } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    const own = new Set((await collectProductInventory(repoRoot, product)).skillIds);
    const other = (await collectProductInventory(repoRoot, counterpart)).skillIds;
    assert.ok(skill.includes(orchestrator), `${product}: must delegate to ${orchestrator}`);
    for (const id of other.filter((candidate) => !own.has(candidate))) {
      assert.ok(!skill.includes(id), `${product}: names a skill it does not ship: ${id}`);
    }
  }
});

test("every skill the entry skill names is in its own routing registry", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    const routing = JSON.parse(await readFile(
      path.join(repoRoot, "products", product, "plugin/references/routing.json"),
      "utf8",
    ));
    const named = [...skill.matchAll(/`([a-z][a-z0-9-]{3,})`/gu)].map((match) => match[1]);
    const skillLike = named.filter((id) => routing.skillIds.includes(id) || id.startsWith("orchestrate-"));
    for (const id of skillLike) {
      assert.ok(routing.skillIds.includes(id), `${product}: ${id} is not in routing.skillIds`);
    }
  }
});

// 대표 스킬로 옮긴 트리거가 오케스트레이터 description에 남아 있으면 두 스킬이 같은 요청을 두고
// 경쟁한다. 조각 하나만 옮기고 다분야 조정 문구는 그대로 둔다.
test("the ambiguous-scope trigger moved to the Studio entry skill and left the orchestrator", async () => {
  const orchestrator = await readFile(
    path.join(repoRoot, "products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md"),
    "utf8",
  );
  const description = /^description: (.+)$/mu.exec(orchestrator)[1];
  assert.doesNotMatch(description, /ambiguous scope/u);
  assert.match(description, /spans multiple disciplines/u);
  assert.match(description, /launch-readiness coordination/u);

  const entry = await entrySkill("game-design-studio");
  assert.match(entry, /ambiguous/u);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/contracts/suite-entry-skills.test.mjs`

Expected: 다섯 테스트가 모두 `ENOENT ... products/game-design-studio/plugin/skills/game-design-studio/SKILL.md`로 실패한다. 마지막 테스트만 오케스트레이터 description을 먼저 읽으므로 `ambiguous scope` 단언에서 실패한다.

- [ ] **Step 3: Studio 대표 스킬을 쓴다**

`products/game-design-studio/plugin/skills/game-design-studio/SKILL.md`:

```markdown
---
name: game-design-studio
description: Use when a game-design request is broad, mixed, or ambiguous, names a Studio case ID, or the user does not know which skill to call, and it has to become one owning product, one route, and one published routing receipt.
---

# Game Design Studio

## Overview

Turn an ordinary request into one owner, one route, and one receipt. This skill produces no design artifact of its own. It normalizes intake, picks the smallest safe route, publishes what it picked, and hands the work to the skill or orchestrator that owns it.

## Triggers

- A request is broad, mixed, or ambiguous and no single skill obviously owns it.
- The user names a case ID such as `ST-G04` instead of a skill.
- The user does not know which skill to call.
- A request needs evidence from both products and an owner has to be chosen.

## Non-triggers

- A request with one clear result belongs to the specialist skill that owns it. Call that skill directly.
- Multi-discipline project coordination that already has a bounded brief belongs to `orchestrate-game-design-project`.
- Career-domain requests belong to the Career product's entry skill.

## What this skill owns

1. Intake normalization.
2. Route decision.
3. Case ID resolution.
4. Routing receipt publication.

Nothing else. Every safety, evidence, and approval rule belongs to the receiving skill and is applied there unchanged. Automatic routing is not automatic approval. Image generation, glossary approval, memory approval, and document publication still stop for a human.

## Intake normalization

Record five fields before routing: the desired final result, the materials the user already has, the publication scope, the human decision owner, and the output format. Leave a field the user did not give as `미정` and continue. Never fill a field with a guess, and never ask more than one round of questions before routing.

## Route decision

- One clear result: route straight to the specialist skill that owns it.
- Mixed, broad, or ambiguous: delegate to `orchestrate-game-design-project`.
- Needs Career evidence: this product stays the owner only when it produces the final artifact. Otherwise the Career entry skill owns the request and this product supplies evidence. Read [handoff.md](references/handoff.md) before starting either direction.

Route only to a skill listed in [routing.json](../../references/routing.json) `skillIds`. A skill that is not in that list is not installed.

## Case ID resolution

A case ID such as `ST-G04` is not a runtime skill ID and must never be passed to a skill as one. Look the ID up in the prompt template catalog and convert it into the route it names. When the ID does not exist, do not guess a neighbouring case: ask once for the missing input, or fall back to normal natural-language routing and say which one you did.

## Routing receipt

Publish this before starting the work:

- the owning product
- the actual skill or orchestrator ID that was selected
- whether a cross-product handoff is required
- the artifact paths that will be created or updated
- current facts, assumptions, and blockers
- the next step that needs a human decision

When the workspace carries a `route-receipt.json`, keep its `schemaVersion`, `requestSha256`, and `bindingNonce` exactly as written and fill `routeId` with the id of a route that exists in [routing.json](../../references/routing.json) `routes`. Never claim a skill ran that did not run.

## Cross-product handoff

One request carries at most one handoff, and only the owner starts it. The supplier returns the requested evidence and nothing else: it does not conclude, approve, or start a handoff of its own. Re-check returned evidence against this product's own rules before using it. Read [handoff.md](references/handoff.md) for the request and return envelopes and for what to do when the other product is not installed.

## Operating rules

- Never relax a specialist skill's approval, evidence, or safety rule.
- Never route to a skill that is absent from `skillIds`.
- Never invent a value the user did not give. Unknown stays `미정`.
- Never report a skill, an artifact, or a validation that did not actually run.

## Completion report

Report the skill that actually ran, the artifact paths it produced, the validation result, and the decisions still open.
```

- [ ] **Step 4: Career 대표 스킬을 쓴다**

`products/game-design-career/plugin/skills/game-design-career/SKILL.md`:

```markdown
---
name: game-design-career
description: Use when a game-design career request is broad, mixed, or ambiguous, names a Career case ID, or the user does not know which skill to call, and it has to become one owning product, one route, and one published routing receipt.
---

# Game Design Career

## Overview

Turn an ordinary career request into one owner, one route, and one receipt. This skill produces no career artifact of its own. It normalizes intake, picks the smallest evidence-safe route, publishes what it picked, and hands the work to the skill or orchestrator that owns it.

## Triggers

- A request is broad, mixed, or ambiguous and no single skill obviously owns it.
- The user names a case ID such as `CA-C07` instead of a skill.
- The user does not know which skill to call.
- A request needs evidence from both products and an owner has to be chosen.

## Non-triggers

- A request with one clear result belongs to the specialist skill that owns it. Call that skill directly.
- Career-stage diagnosis that already has its evidence belongs to `orchestrate-game-design-career`.
- Game-design production requests belong to the Studio product's entry skill.

## What this skill owns

1. Intake normalization.
2. Route decision.
3. Case ID resolution.
4. Routing receipt publication.

Nothing else. Every safety, evidence, and approval rule belongs to the receiving skill and is applied there unchanged. Automatic routing is not automatic approval. This skill never promises an outcome, never invents experience the user does not have, and never declares one universally correct career.

## Intake normalization

Record five fields before routing: the desired final result, the materials the user already has, the publication scope, the human decision owner, and the output format. Leave a field the user did not give as `미정` and continue. Never fill a field with a guess, and never ask more than one round of questions before routing.

## Route decision

- One clear result: route straight to the specialist skill that owns it.
- Mixed, broad, or ambiguous: delegate to `orchestrate-game-design-career`.
- Needs Studio evidence: this product stays the owner when it produces the final artifact, which is the usual case for career work. Read [handoff.md](references/handoff.md) before starting either direction.

Route only to a skill listed in [routing.json](../../references/routing.json) `skillIds`. A skill that is not in that list is not installed.

## Case ID resolution

A case ID such as `CA-C07` is not a runtime skill ID and must never be passed to a skill as one. Look the ID up in the prompt template catalog and convert it into the route it names. When the ID does not exist, do not guess a neighbouring case: ask once for the missing input, or fall back to normal natural-language routing and say which one you did.

## Routing receipt

Publish this before starting the work:

- the owning product
- the actual skill or orchestrator ID that was selected
- whether a cross-product handoff is required
- the artifact paths that will be created or updated
- current facts, assumptions, and blockers
- the next step that needs a human decision

When the workspace carries a `route-receipt.json`, keep its `schemaVersion`, `requestSha256`, and `bindingNonce` exactly as written and fill `routeId` with the id of a route that exists in [routing.json](../../references/routing.json) `routes`. Never claim a skill ran that did not run.

## Cross-product handoff

One request carries at most one handoff, and only the owner starts it. The supplier returns the requested evidence and nothing else: it does not conclude, approve, or start a handoff of its own. Re-check returned evidence against this product's own rules before using it. Read [handoff.md](references/handoff.md) for the request and return envelopes and for what to do when the other product is not installed.

## Operating rules

- Never relax a specialist skill's approval, evidence, or safety rule.
- Never route to a skill that is absent from `skillIds`.
- Never invent a value the user did not give. Unknown stays `미정`.
- Never report a skill, an artifact, or a validation that did not actually run.

## Completion report

Report the skill that actually ran, the artifact paths it produced, the validation result, and the decisions still open.
```

두 본문은 `references/handoff.md`를 링크한다. 그 파일은 Task 3에서 투영되므로, Task 1 시점에는 소스 트리에 없다. 소스 트리 링크 검사는 패키지 빌드 결과에서 수행되므로 Task 3 이전에 링크 검사가 도는지 Step 9에서 확인한다.

- [ ] **Step 5: Studio 오케스트레이터 description에서 조각 하나를 뺀다**

`products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md:3`을 다음으로 바꾼다.

```markdown
description: Use when a game-design request spans multiple disciplines, needs a project brief or roadmap, or requires launch-readiness coordination.
```

`, has ambiguous scope`만 지운다. 다른 문구는 그대로 둔다.

- [ ] **Step 6: 라우팅 레지스트리 두 개를 갱신한다**

`products/game-design-studio/plugin/references/routing.json`:
- `skillIds` 배열 맨 앞에 `"game-design-studio"`를 넣는다.
- `plannedPaths.skills` 배열 맨 앞에 `"skills/game-design-studio/SKILL.md"`를 넣는다.
- `unknownIntentFallback`은 `"orchestrate-game-design-project"` 그대로 둔다. 이 값은 route 선택기의 폴백이지 진입점이 아니며, 스펙은 이 값을 바꾸라고 하지 않았다.

`products/game-design-career/plugin/references/routing.json`:
- `skillIds` 배열 맨 앞에 `"game-design-career"`를 넣는다.
- `plannedPaths.skills` 배열 맨 앞에 `"skills/game-design-career/SKILL.md"`를 넣는다.
- `directUseReviewOwners` 배열에 다음 항목을 `skill` 사전순 위치에 넣는다. Career 계약은 스킬마다 소유자를 요구한다.

```json
{ "skill": "game-design-career", "owners": ["career-strategist"], "conditionalOwners": [] }
```

기존 포맷(들여쓰기 2칸, 배열 요소 줄바꿈 방식)을 그대로 따른다. 계획 2에서 이 파일이 통째로 재포맷돼 diff가 1600줄로 부풀었던 적이 있다. `git diff --stat`이 두 파일에서 각각 10줄 미만이어야 한다.

- [ ] **Step 7: 스킬 인벤토리 폐쇄 목록을 갱신한다**

`tooling/isolation-smoke.mjs:31-49`의 `EXACT_SKILL_IDS`에서 career 배열에 `"game-design-career"`를, studio 배열에 `"game-design-studio"`를 추가한다. 배열은 `.sort()`로 정렬되므로 넣는 위치는 자유다.

`tooling/marketplace-smoke.mjs:19-22`:

```javascript
export const PACKAGED_SKILL_COUNTS = Object.freeze({
  "game-design-career": 24,
  "game-design-studio": 25,
});
```

`tests/products/studio/product-contract.test.mjs`:
- `skillIds` 배열 맨 앞에 `"game-design-studio"`를 넣는다.
- `const directSkillIds = skillIds.slice(0, 16);`을 `slice(0, 17)`로 바꾼다. 앞에 하나를 넣었으므로 슬라이스를 늘리지 않으면 `polish-game-design-writing`이 직접 스킬 집합에서 빠진다.
- `installedSkillIds`는 `directSkillIds`에서 파생되므로 추가 수정이 필요 없다.
- `plannedPaths.skills`도 `skillIds`에서 파생되므로 추가 수정이 필요 없다.

`tests/products/career/product-contract.test.mjs`:
- `skillIds` 배열 맨 앞에 `"game-design-career"`를 넣는다.
- 38행의 `const directSkillIds = skillIds.slice(0, 15);`를 `slice(0, 16)`으로 바꾼다. 같은 이유다.

`tests/unit/validate-packages.test.mjs`:
- `expectedSkillIdsByProduct["game-design-career"]`에 `"game-design-career"`를, `["game-design-studio"]`에 `"game-design-studio"`를 사전순 위치에 넣는다.
- 테스트 이름 `"package validator discovers the exact two-plugin, 49-skill snapshot"`을 `51-skill`로 바꾼다.

`tests/contracts/shared-contract.test.mjs:598-605` 근처의 `expectedCareerSkillIds`에 `"game-design-career"`를 맨 앞에 넣는다. 이 배열은 `routing.skillIds`와 `deepEqual`로 비교되므로 순서가 routing.json과 같아야 한다.

`tests/contracts/user-guide-use-case-manifest.test.mjs:36-46`의 두 집합에 두 ID를 모두 넣는다.

```javascript
const DIRECT_USE_EXCLUDED_SKILL_IDS = new Set([
  "archify", "humanize-korean", "polish-game-design-writing",
  "capture-game-design-memory", "maintain-game-design-memory", "retrieve-approved-design-memory",
  "analyze-game-design-references", "maintain-game-design-glossary",
  "upgrade-game-design-suite",
  // 대표 진입 스킬은 자기 산출물을 만들지 않고 언제나 다른 스킬로 위임하므로 직접 사용 사례가 없다.
  "game-design-career", "game-design-studio",
]);
const ROUTE_BOUNDARY_SKILL_IDS = new Set([
  "archify", "humanize-korean", "polish-game-design-writing",
  "capture-game-design-memory", "maintain-game-design-memory", "retrieve-approved-design-memory",
  "upgrade-game-design-suite",
  // 대표 진입 스킬은 canonical route를 갖지 않는다. 하나를 고르는 쪽이기 때문이다.
  "game-design-career", "game-design-studio",
]);
```

- [ ] **Step 8: 계약 테스트를 통과시킨다**

Run: `node --test tests/contracts/suite-entry-skills.test.mjs`
Expected: 5개 테스트 모두 PASS.

Run: `node --test tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs tests/unit/validate-packages.test.mjs`
Expected: 0 fail.

- [ ] **Step 9: 가이드와 프롬프트 카탈로그를 채운다**

`npm run validate:guides`와 프롬프트 카탈로그 cardinality가 아직 빨갛다. 순서대로 채운다.

먼저 프롬프트 카탈로그. `guides/prompt-templates/catalog/studio-entry.json`을 만든다. 배열 하나에 항목 세 개(`beginner`, `standard`, `advanced`)를 담고, 필드 구성은 `guides/prompt-templates/catalog/studio-production.json`의 `skill-template` 항목과 동일한 키 집합을 쓴다. 세 항목의 고정값은 다음과 같다.

| 필드 | 값 |
| --- | --- |
| `id` | `studio:game-design-studio:beginner` / `:standard` / `:advanced` |
| `kind` | `skill-template` |
| `product` | `studio` |
| `level` | 각각 `beginner`, `standard`, `advanced` |
| `skill` | `game-design-studio` |
| `skill_chain` | `["game-design-studio", "orchestrate-game-design-project"]` |
| `specialist_roles` | `["lead-game-designer"]` |
| `app_prompt.example` | `@Game Design Studio` 로 시작 |
| `cli_prompt.example` | `$game-design-studio:game-design-studio` 로 시작 |
| `human_review_boundary` | 라우팅 결과는 사람이 승인·수정·보류하며 자동 승인이 아니라는 문장 |
| `safety_boundary` | `Do not request credentials, personal data, or private materials.` |

`beginner`는 "무엇을 써야 할지 모르는 요청을 route 하나와 영수증으로 바꾼다", `standard`는 "여러 도메인이 섞인 요청을 owner 하나와 route 하나로 좁힌다", `advanced`는 "사례 ID와 교차 제품 인계가 필요한 요청을 owner·supplier·영수증으로 정리한다"를 `purpose`로 쓴다. `expected_file_tree`와 `read_order`는 `["game-design/studio-entry/<level>/content.md"]` 한 항목으로 맞춘다.

`guides/prompt-templates/catalog/career-entry.json`도 같은 구조로 만든다. `product`는 `career`, `skill`은 `game-design-career`, `skill_chain`은 `["game-design-career", "orchestrate-game-design-career"]`, `specialist_roles`는 `["career-strategist"]`, App 호출은 `@Game Design Career`, CLI 호출은 `$game-design-career:game-design-career`, 파일 트리는 `game-design-career/career-entry/<level>/content.md`로 쓴다.

`guides/prompt-templates/catalog.json`의 `sources` 배열에 `"catalog/studio-entry.json"`과 `"catalog/career-entry.json"`을 추가한다.

`tooling/lib/prompt-template-catalog.mjs:14`의 `"skill-template": 99`를 `105`로 바꾼다.

`tests/unit/prompt-template-catalog.test.mjs:1905-1906`의 `24`를 각각 `25`로 바꾼다.

Run: `node --test tests/unit/prompt-template-catalog.test.mjs`
Expected: 0 fail. 실패하면 메시지가 위반한 필드 이름을 직접 말한다. `safety_boundary`는 금지 표현을 직접 금지하는 형태여야 통과한다.

Run: `npm run build:prompt-guides`
Expected: `guides/prompt-templates/studio/game-design-studio.md`와 `guides/prompt-templates/career/game-design-career.md`가 생성된다.

- [ ] **Step 10: 스킬 가이드 두 개를 쓴다**

`guides/game-design-studio/skills/game-design-studio.md`를 만든다. 섹션 구성은 같은 디렉터리의 `define-game-vision.md`와 동일한 H2 순서를 따른다.

```
# game-design-studio
## 목적과 최종 산출물
## 사용할 때
### 직접 호출 활용 — game-design-studio
## 사용하지 않을 때
## 필수 입력과 선택 입력
## Codex App 요청 예시
## Codex CLI 요청 예시
## 내부 진행 흐름
## 생성 파일과 결과 구조
## 관련 템플릿·품질 프로필·전문 역할
## 이미지·도식화 조건
## 검토·승인 기준
## 실패·fallback·재개 방법
## 다음 작업 요청문
## 관련 문서
### 재사용 프롬프트 템플릿
```

내용은 SKILL.md와 같은 사실만 쓴다. 목적은 "요청을 owner 하나, route 하나, 영수증 하나로 바꾼다", 최종 산출물은 "라우팅 영수증과 위임된 스킬의 산출물"이다. 생성 파일 섹션에는 이 스킬 자체가 만드는 파일이 없고 `route-receipt.json`의 `routeId`만 채운다고 적는다. 이미지·도식화 조건은 "이 스킬은 이미지를 만들지 않는다"로 닫는다. 검토·승인 기준은 "라우팅은 승인이 아니며 위임된 스킬의 승인 규칙이 그대로 적용된다"로 쓴다. 관련 문서에는 `../installation.md`와 상대 제품 가이드를 링크한다.

`guides/game-design-career/skills/game-design-career.md`도 같은 구조로 쓰고, 오케스트레이터는 `orchestrate-game-design-career`, 역할은 `career-strategist`, 사례 ID 예시는 `CA-C07`로 맞춘다.

두 가이드를 목록에 등록한다.
- `guides/game-design-studio/skills/README.md`와 `guides/game-design-career/skills/README.md`의 스킬 표에 행을 추가한다.
- `guides/game-design-studio/use-cases/skill-workbench.md`와 Career 쪽 같은 파일의 lane 표에 추가한다. lane을 새로 만들지 않는다. Studio는 기존 `오케스트레이션` lane, Career는 기존 `역할·근거 lane`에 넣는다. 진입점은 결국 오케스트레이션·진단 lane의 앞단이기 때문이다.
- `tests/contracts/user-guides-studio.test.mjs:68`의 `WORKBENCH_LANES`에 `"game-design-studio": "오케스트레이션"`을, `tests/contracts/user-guides-career.test.mjs:700-720`의 `expectedGroups["역할·근거 lane"]` 배열에 `"game-design-career"`를 추가한다.
- 같은 Studio 파일의 `DIRECT_USE_HANDOFFS`(51행)와 `DIRECT_USE_OUTPUTS`(33행)가 새 스킬 키를 요구하면 넣는다. 대표 스킬의 직접 호출 결과는 위임이므로 handoff는 `[["선택된 route", "<selected-skill>"]]`, 출력은 `orchestrate-game-design-project`와 같은 라우팅 산출물 항목을 쓴다. Career 쪽도 같은 방식으로 `orchestrate-game-design-career`의 값을 따른다.
- `tests/contracts/root-readme-user-guides.test.mjs`의 스킬 표 기대값에 두 행을 추가한다. 실패 메시지가 어떤 배열의 어느 위치인지 말해 준다. 표시 문구는 Studio가 `["대표 진입", "요청을 소유 제품 하나와 실행 경로 하나로 정리하고 라우팅 영수증을 남깁니다."]`, Career가 같은 문구의 Career판이다.
- `tests/products/studio/readme.test.mjs`와 `tests/products/career/readme.test.mjs`가 세는 직접 스킬 개수 문장을 제품 README에서 하나씩 올린다.

Run: `npm run validate:guides`
Expected: `ok`. 실패하면 요구 사항 이름이 그대로 출력되므로 해당 섹션을 채운다.

- [ ] **Step 11: 패키지를 다시 만들고 전체 검증한다**

Run: `npm run build`
Expected: `plugins/game-design-studio`와 `plugins/game-design-career`에 새 스킬이 들어가고 `BUILD-MANIFEST.json`이 갱신된다.

Run: `npm run validate:archify-catalog`
Expected: 새 패키지 미러 때문에 실패한다. `guides/archify-diagrams/catalog.json`에 새 파일의 origin 항목이 필요하거나 기존 항목의 `source_digest`가 낡았다고 말한다. 출력이 지목한 항목만 고친다. 요약 digest는 다음으로 계산한다.

```bash
shasum -a 256 <파일 경로>
```

Run: `npm run validate`
Expected: 전 단계 통과, 마지막 줄 `Suite release readiness: COMPLETE`.

- [ ] **Step 12: 커밋**

```bash
git add products shared tooling tests guides plugins
git commit -m "feat: give each product one entry skill that routes and publishes a receipt"
```

---

### Task 2: 영수증과 사례 ID 해석을 기계 검증 가능한 형태로 고정한다

Task 1은 대표 스킬이 존재하고 필요한 섹션을 갖췄다는 것까지만 보장한다. 이 태스크는 영수증 항목과 사례 ID 규칙이 사라져도 테스트가 잡도록 만든다. 라이브 응답에는 단언을 걸 수 없으므로 검증 대상은 스킬 본문과 기존 route receipt 계약이다.

**Files:**
- Modify: `tests/contracts/suite-entry-skills.test.mjs`
- Test: `tests/contracts/suite-entry-skills.test.mjs`

**Interfaces:**
- Consumes: Task 1의 두 SKILL.md, `tooling/lib/marketplace-proof-harness.mjs`의 route receipt 키 집합 `["schemaVersion", "requestSha256", "bindingNonce", "routeId"]`.
- Produces: 없음. 이 태스크는 계약을 고정만 한다.

- [ ] **Step 1: 영수증 항목 테스트를 추가한다**

`tests/contracts/suite-entry-skills.test.mjs` 끝에 추가한다.

```javascript
// 영수증은 새 포맷을 만들지 않는다. 기계 검증은 이미 있는 route-receipt.json이 담당하고, 나머지
// 여섯 항목은 사람이 읽는 블록으로 같은 메시지에 실린다. 항목이 하나라도 사라지면 사용자는 어떤
// 스킬이 무엇을 근거로 골랐는지 확인할 방법을 잃는다.
const RECEIPT_ITEMS = Object.freeze([
  "the owning product",
  "the actual skill or orchestrator ID that was selected",
  "whether a cross-product handoff is required",
  "the artifact paths that will be created or updated",
  "current facts, assumptions, and blockers",
  "the next step that needs a human decision",
]);

test("the routing receipt names every item the user needs before work starts", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    const section = skill.slice(skill.indexOf("## Routing receipt"), skill.indexOf("## Cross-product handoff"));
    for (const item of RECEIPT_ITEMS) {
      assert.ok(section.includes(item), `${product}: receipt is missing "${item}"`);
    }
  }
});

test("the entry skill preserves the three fields the route receipt already owns", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    for (const field of ["schemaVersion", "requestSha256", "bindingNonce"]) {
      assert.match(skill, new RegExp(`\`${field}\``, "u"), `${product}: must preserve ${field}`);
    }
    assert.match(skill, /fill `routeId` with the id of a route that exists/u, product);
  }
});
```

- [ ] **Step 2: 사례 ID 테스트를 추가한다**

같은 파일에 추가한다.

```javascript
// 사례 ID를 스킬 ID처럼 넘기는 것이 이 진입점의 가장 쉬운 실수다. 존재하지 않는 ID를 이웃 사례로
// 추측하는 것이 두 번째다. 둘 다 본문에 금지로 남아 있어야 한다.
test("a case ID is resolved through the catalog and never guessed", async () => {
  const examples = { "game-design-studio": "ST-G04", "game-design-career": "CA-C07" };
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    const section = skill.slice(skill.indexOf("## Case ID resolution"), skill.indexOf("## Routing receipt"));
    assert.ok(section.includes(examples[product]), `${product}: must show a real case ID`);
    assert.match(section, /is not a runtime skill ID/u, product);
    assert.match(section, /do not guess/iu, product);
    assert.match(section, /ask once|fall back to normal natural-language routing/u, product);
  }
});

test("automatic routing is never described as automatic approval", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    assert.match(skill, /Automatic routing is not automatic approval/u, product);
    assert.doesNotMatch(skill, /auto[- ]?approve/iu, product);
    assert.match(skill, /Never relax a specialist skill's approval, evidence, or safety rule/u, product);
  }
});
```

- [ ] **Step 3: 테스트를 돌린다**

Run: `node --test tests/contracts/suite-entry-skills.test.mjs`
Expected: 9개 테스트 PASS. 실패하면 Task 1의 본문 문구가 위 정규식과 어긋난 것이므로 본문을 고친다. 테스트를 본문에 맞추지 않는다. 여기 적힌 문구가 계약이다.

- [ ] **Step 4: 커밋**

```bash
git add tests/contracts/suite-entry-skills.test.mjs
git commit -m "test: pin the routing receipt items and case ID resolution rules"
```

---

### Task 3: 인계 계약 파일을 공유 모듈로 두고 두 제품에 투영한다

계약 본문은 두 제품에서 동일 바이트여야 한다. 소스를 하나만 두고 빌드가 각 제품 대표 스킬의 `references/`로 복사한다. 목적지가 제품마다 다르므로 매핑을 제품 이름으로 계산한다.

**Files:**
- Create: `shared/suite-handoff/references/handoff.md`
- Modify: `tooling/lib/build-product.mjs:11-35, 36-41, 503, 512-514`
- Modify: `tooling/lib/product-contract.mjs:17`
- Modify: `shared/contracts/product.schema.json:28`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Modify: `tooling/lib/archify-catalog.mjs:105-115`
- Modify: `tests/contracts/archify-catalog.test.mjs:269-283`
- Modify: `tests/contracts/shared-contract.test.mjs:495-503`
- Create: `tests/contracts/suite-handoff-contract.test.mjs`
- Test: `tests/contracts/suite-handoff-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1의 대표 스킬 두 개. 목적지 경로가 `skills/<productName>/references`이므로 대표 스킬 ID가 제품 이름과 같다는 사실에 의존한다.
- Produces: 공유 모듈 이름 `suite-handoff`. 패키지 경로 `skills/game-design-studio/references/handoff.md`와 `skills/game-design-career/references/handoff.md`. Task 4의 검증기가 이 파일을 파싱한다.

- [ ] **Step 1: 투영과 동일성을 요구하는 테스트를 먼저 쓴다**

`tests/contracts/suite-handoff-contract.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const PRODUCTS = Object.freeze(["game-design-career", "game-design-studio"]);

function packagedContract(product) {
  return path.join(repoRoot, "plugins", product, "skills", product, "references/handoff.md");
}

test("both products ship the same handoff contract bytes", async () => {
  const [career, studio] = await Promise.all(PRODUCTS.map((product) => readFile(packagedContract(product))));
  assert.ok(career.equals(studio), "the two packaged handoff contracts differ");
  const source = await readFile(path.join(repoRoot, "shared/suite-handoff/references/handoff.md"));
  assert.ok(source.equals(career), "the packaged contract is not the shared source");
});

test("the contract lives inside a sentinel block that a parser can find", async () => {
  const contract = await readFile(packagedContract("game-design-studio"), "utf8");
  assert.equal(contract.split("<!-- suite-handoff-contract:start -->").length - 1, 1);
  assert.equal(contract.split("<!-- suite-handoff-contract:end -->").length - 1, 1);
  assert.ok(
    contract.indexOf("<!-- suite-handoff-contract:start -->") < contract.indexOf("<!-- suite-handoff-contract:end -->"),
  );
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/contracts/suite-handoff-contract.test.mjs`
Expected: `ENOENT ... plugins/game-design-career/skills/game-design-career/references/handoff.md`.

- [ ] **Step 3: 계약 파일을 쓴다**

`shared/suite-handoff/references/handoff.md`:

````markdown
# Suite Handoff Contract

두 제품이 함께 필요한 요청을 처리하는 단방향 계약이다. 최종 산출물을 내는 제품만 owner이고, 상대 제품은 요청받은 증거만 돌려준다. 한 요청에 인계는 한 번이다.

<!-- suite-handoff-contract:start -->
```json
{
  "schemaVersion": 1,
  "requestKind": "suite-handoff-request-v1",
  "returnKind": "suite-handoff-return-v1",
  "products": ["game-design-career", "game-design-studio"],
  "entrySkills": {
    "game-design-career": "game-design-career",
    "game-design-studio": "game-design-studio"
  },
  "requestedOutputs": [
    "system-evidence-summary",
    "content-evidence-summary",
    "production-constraint-summary",
    "career-target-profile"
  ],
  "requestKeys": [
    "schemaVersion",
    "kind",
    "ownerProduct",
    "supplierProduct",
    "requestedOutputs",
    "sourceArtifactIds",
    "returnToSkill"
  ],
  "returnKeys": [
    "schemaVersion",
    "kind",
    "ownerProduct",
    "supplierProduct",
    "facts",
    "inferences",
    "recommendations",
    "unknowns"
  ],
  "maxHandoffsPerRequest": 1
}
```
<!-- suite-handoff-contract:end -->

## 요청 봉투

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-request-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "requestedOutputs": ["system-evidence-summary"],
  "sourceArtifactIds": ["combat-spec"],
  "returnToSkill": "game-design-career"
}
```

## 반환 봉투

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-return-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "facts": [],
  "inferences": [],
  "recommendations": [],
  "unknowns": []
}
```

## 규칙

1. 최종 산출물을 내는 제품만 owner다. `returnToSkill`은 owner 제품의 대표 스킬과 같아야 한다.
2. 공급 제품은 요청받은 증거만 반환한다. 상대 도메인 결론을 내리거나 승인하지 않는다.
3. 공급 제품은 다시 인계를 시작할 수 없다. 한 요청당 인계는 한 번이다.

소유 제품은 반환된 증거를 자기 기준으로 사실·추론·제안으로 다시 나눈 뒤에만 쓴다. 공급 제품이 붙인 라벨을 그대로 승격하지 않는다.

## 상대 제품이 없을 때

교차가 실제로 필요해진 시점에만 한 번 확인한다. 세션 시작 훅을 건드리지 않는다.

```
node scripts/inspect-game-design-plugin-updates.mjs --products
```

- 둘 다 설치됨: 인계를 진행한다.
- 상대 미설치: 증거를 지어내지 않는다. 자기 제품이 가진 것만으로 부분 완성하고 빠진 근거를 blocker로 남긴다. 설치 명령 한 줄과, 사용자가 직접 근거를 제공하는 대체 경로를 함께 제시한다.
- 확인 불가: 미설치와 같은 degrade를 적용하되 "확인 불가"라고 구분해 말한다.

조회 자체가 실패하면 사용자 환경의 marketplace JSON에 BOM이 있을 수 있다고 진단만 안내한다. 사용자 파일을 자동으로 고치지 않는다.
````

- [ ] **Step 4: 공유 모듈을 빌드에 연결한다**

`tooling/lib/build-product.mjs`의 `staticSharedMappings`(11-35행) 아래에 제품별 매핑 함수와 정확 인벤토리를 추가한다.

```javascript
// 인계 계약은 두 제품에서 동일 바이트여야 하지만 목적지는 제품마다 다르다. 대표 스킬 ID가 제품
// 이름과 같으므로 목적지를 이름에서 계산할 수 있고, 그래서 소스를 하나만 둔다.
function suiteHandoffMappings(productName) {
  return { "suite-handoff": [["shared/suite-handoff/references", `skills/${productName}/references`]] };
}
const sharedSuiteHandoffInventory = Object.freeze({
  "shared/suite-handoff/references": Object.freeze(["handoff.md"]),
});

function assertExactSharedSuiteHandoffInventory(sourceRelative, entries) {
  const expected = sharedSuiteHandoffInventory[sourceRelative];
  if (!expected) throw new Error(`Unknown shared suite-handoff package root: ${sourceRelative}`);
  const actual = entries.map(({ relativePath }) => relativePath).sort(comparePaths);
  if (actual.length !== expected.length || actual.some((relativePath, index) => relativePath !== expected[index])) {
    throw new Error(`Unexpected shared suite-handoff package file in ${sourceRelative}`);
  }
}
```

503행의 매핑 병합을 바꾼다.

```javascript
  const sharedMappings = {
    ...staticSharedMappings,
    ...vendorMappings({ repoRoot: absoluteRepoRoot }),
    ...suiteHandoffMappings(productName),
  };
```

512-514행의 인벤토리 검사 옆에 한 줄을 더한다.

```javascript
      if (moduleName === "suite-handoff") assertExactSharedSuiteHandoffInventory(sourceRelative, entries);
```

- [ ] **Step 5: 모듈 이름을 허용 목록 세 곳에 등록한다**

`tooling/lib/product-contract.mjs:17`의 `allowedModules` Set 끝에 `"suite-handoff"`를 넣는다.

`shared/contracts/product.schema.json:28`의 enum 끝에 `"suite-handoff"`를 넣는다.

`products/game-design-studio/product.json`과 `products/game-design-career/product.json`의 `sharedModules` 배열 끝(`"suite-update-skill"` 다음)에 `"suite-handoff"`를 넣는다.

- [ ] **Step 6: 패키지 미러 매핑을 등록한다**

`tooling/lib/archify-catalog.mjs`의 미러 매핑 배열(105-115행 사이, `suite-update-skill` 항목 다음)에 두 항목을 넣는다.

```javascript
  Object.freeze({
    id: "suite-handoff",
    module: "suite-handoff",
    sourceRoot: "shared/suite-handoff/references",
    destinationRoot: "skills/game-design-studio/references",
  }),
  Object.freeze({
    id: "suite-handoff",
    module: "suite-handoff",
    sourceRoot: "shared/suite-handoff/references",
    destinationRoot: "skills/game-design-career/references",
  }),
```

`tests/contracts/archify-catalog.test.mjs`의 `mappings` Map은 매핑 하나당 목적지 하나를 가정한다. `suite-handoff`는 제품마다 목적지가 다르므로 `memory`·`reference-intelligence`와 같은 분기를 하나 더 넣는다.

```javascript
    const [sourceRoot, destinationRoot] = entry.origin_source.build_mapping === "memory"
      ? (entry.source_document.includes("/references/shared/memory/")
        ? ["shared/memory", "references/shared/memory"]
        : ["shared/memory/skills", "skills"])
      : entry.origin_source.build_mapping === "suite-handoff"
        ? ["shared/suite-handoff/references", `skills/game-design-${entry.product}/references`]
      : (entry.origin_source.build_mapping === "reference-intelligence" && entry.source_document.includes("/skills/"))
        ? ["shared/reference-intelligence/skills", "skills"]
      : (mappings.get(entry.origin_source.build_mapping) ?? []);
```

- [ ] **Step 7: 공유 스킬 목록 기대값을 맞춘다**

`tests/contracts/shared-contract.test.mjs:495-503`의 공유 스킬 목록은 "제품 소스에 없는데 패키지에 있는 스킬"을 센다. 대표 스킬은 제품 소스에 있으므로 이 목록에 추가하지 않는다. 다만 같은 테스트가 공유 모듈이 만든 패키지 파일을 함께 검사하므로, 실패하면 출력이 `skills/game-design-*/references/handoff.md`를 지목한다. 그 경우 해당 기대 목록에 두 경로를 추가한다.

Run: `node --test tests/contracts/shared-contract.test.mjs`
Expected: 0 fail.

- [ ] **Step 8: 빌드하고 투영을 확인한다**

Run: `npm run build`

Run: `node --test tests/contracts/suite-handoff-contract.test.mjs`
Expected: 2개 PASS.

Run: `npm run validate:archify-catalog`
Expected: 새 미러의 origin 항목과 digest를 요구하면 출력이 지목한 항목만 채운다.

- [ ] **Step 9: 커밋**

```bash
git add shared/suite-handoff tooling shared/contracts products tests plugins guides
git commit -m "feat: ship one handoff contract projected into both entry skills"
```

---

### Task 4: 봉투 검증기와 거부 규칙

계약 문서가 있는 것과 잘못된 봉투를 거부하는 것은 다르다. sentinel 블록을 파싱하고 두 봉투를 검사하는 순수 함수를 만들고, 스펙이 나열한 여섯 거부 사유를 표로 고정한다.

**Files:**
- Create: `tooling/lib/suite-handoff-contract.mjs`
- Modify: `tests/contracts/suite-handoff-contract.test.mjs`
- Test: `tests/contracts/suite-handoff-contract.test.mjs`

**Interfaces:**
- Consumes: Task 3의 `shared/suite-handoff/references/handoff.md`.
- Produces:
  - `parseSuiteHandoffContract(markdown: string) => Readonly<Contract>` — sentinel 블록의 JSON을 폐쇄 키 검사와 함께 반환한다. 실패하면 던진다.
  - `validateHandoffRequest(value: unknown, contract: Contract) => { ok: boolean, errors: string[] }`
  - `validateHandoffReturn(value: unknown, contract: Contract) => { ok: boolean, errors: string[] }`
  - `validateHandoffChain(envelopes: unknown[], contract: Contract) => { ok: boolean, errors: string[] }`

- [ ] **Step 1: 거부 표를 테스트로 먼저 쓴다**

`tests/contracts/suite-handoff-contract.test.mjs`에 추가한다.

```javascript
import {
  parseSuiteHandoffContract,
  validateHandoffChain,
  validateHandoffRequest,
  validateHandoffReturn,
} from "../../tooling/lib/suite-handoff-contract.mjs";

const contractMarkdown = await readFile(
  path.join(repoRoot, "shared/suite-handoff/references/handoff.md"),
  "utf8",
);
const contract = parseSuiteHandoffContract(contractMarkdown);

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-request-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    requestedOutputs: ["system-evidence-summary"],
    sourceArtifactIds: ["combat-spec"],
    returnToSkill: "game-design-career",
    ...overrides,
  };
}

function envelopeReturn(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-return-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    facts: ["combat spec names three damage types"],
    inferences: [],
    recommendations: [],
    unknowns: ["balance targets are not published"],
    ...overrides,
  };
}

test("a well-formed request and return are accepted", () => {
  assert.deepEqual(validateHandoffRequest(request(), contract), { ok: true, errors: [] });
  assert.deepEqual(validateHandoffReturn(envelopeReturn(), contract), { ok: true, errors: [] });
});

// 스펙 C절 테스트 전략이 나열한 여섯 거부 사유다. 하나라도 통과하면 인계가 증거를 지어낼 수 있다.
test("the contract refuses every malformed envelope the spec names", () => {
  const cases = [
    ["owner and supplier swapped", () => validateHandoffRequest(
      request({ ownerProduct: "game-design-studio", returnToSkill: "game-design-career" }), contract)],
    ["returnToSkill does not match the owner", () => validateHandoffRequest(
      request({ returnToSkill: "game-design-studio" }), contract)],
    ["unknown product id", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-suite" }), contract)],
    ["requestedOutputs outside the enum", () => validateHandoffRequest(
      request({ requestedOutputs: ["salary-benchmark"] }), contract)],
    ["owner equals supplier", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-career" }), contract)],
    ["return envelope missing a field", () => validateHandoffReturn(
      { ...envelopeReturn(), unknowns: undefined }, contract)],
  ];
  for (const [name, run] of cases) {
    const result = run();
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.length > 0, name);
  }
});

test("a supplier cannot start a second handoff for the same request", () => {
  const first = request();
  const second = request({ ownerProduct: "game-design-studio", supplierProduct: "game-design-career", returnToSkill: "game-design-studio" });
  assert.equal(validateHandoffChain([first, envelopeReturn()], contract).ok, true);
  const chained = validateHandoffChain([first, envelopeReturn(), second], contract);
  assert.equal(chained.ok, false);
  assert.ok(chained.errors.some((message) => /one handoff/u.test(message)), chained.errors.join("\n"));
});

test("an empty or duplicated requestedOutputs list is refused", () => {
  assert.equal(validateHandoffRequest(request({ requestedOutputs: [] }), contract).ok, false);
  assert.equal(validateHandoffRequest(
    request({ requestedOutputs: ["system-evidence-summary", "system-evidence-summary"] }), contract).ok, false);
});

test("an unknown key in either envelope is refused", () => {
  assert.equal(validateHandoffRequest({ ...request(), priority: "high" }, contract).ok, false);
  assert.equal(validateHandoffReturn({ ...envelopeReturn(), approved: true }, contract).ok, false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/contracts/suite-handoff-contract.test.mjs`
Expected: `Cannot find module ... tooling/lib/suite-handoff-contract.mjs`.

- [ ] **Step 3: 검증기를 구현한다**

`tooling/lib/suite-handoff-contract.mjs`:

```javascript
const CONTRACT_KEYS = Object.freeze([
  "schemaVersion", "requestKind", "returnKind", "products", "entrySkills",
  "requestedOutputs", "requestKeys", "returnKeys", "maxHandoffsPerRequest",
]);
const START = "<!-- suite-handoff-contract:start -->";
const END = "<!-- suite-handoff-contract:end -->";
const RETURN_LISTS = Object.freeze(["facts", "inferences", "recommendations", "unknowns"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isObject(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function stringList(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.trim().length > 0)
    && new Set(value).size === value.length;
}

// 계약은 문서 안에 산다. 문서를 사람이 고치는 이상, 파서는 sentinel이 정확히 한 쌍이고 그 사이에
// JSON 코드 블록이 하나뿐일 때만 값을 돌려줘야 한다. 두 벌이 있으면 어느 쪽이 계약인지 알 수 없다.
export function parseSuiteHandoffContract(markdown) {
  if (typeof markdown !== "string") throw new Error("handoff contract must be text");
  if (markdown.split(START).length !== 2 || markdown.split(END).length !== 2) {
    throw new Error("handoff contract sentinel must appear exactly once");
  }
  const body = markdown.slice(markdown.indexOf(START) + START.length, markdown.indexOf(END));
  const blocks = [...body.matchAll(/```json\n([\s\S]*?)\n```/gu)];
  if (blocks.length !== 1) throw new Error("handoff contract must hold exactly one JSON block");
  let contract;
  try {
    contract = JSON.parse(blocks[0][1]);
  } catch {
    throw new Error("handoff contract JSON is malformed");
  }
  if (!hasExactKeys(contract, CONTRACT_KEYS)
    || contract.schemaVersion !== 1
    || !stringList(contract.products)
    || !stringList(contract.requestedOutputs)
    || !stringList(contract.requestKeys)
    || !stringList(contract.returnKeys)
    || !isObject(contract.entrySkills)
    || contract.maxHandoffsPerRequest !== 1
    || contract.products.some((product) => typeof contract.entrySkills[product] !== "string")) {
    throw new Error("handoff contract is not well formed");
  }
  return Object.freeze({
    ...contract,
    products: Object.freeze([...contract.products]),
    requestedOutputs: Object.freeze([...contract.requestedOutputs]),
    requestKeys: Object.freeze([...contract.requestKeys]),
    returnKeys: Object.freeze([...contract.returnKeys]),
    entrySkills: Object.freeze({ ...contract.entrySkills }),
  });
}

function sharedEnvelopeErrors(value, contract, keys, kind) {
  const errors = [];
  if (!hasExactKeys(value, keys)) {
    errors.push("envelope keys do not match the contract");
    return errors;
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.kind !== kind) errors.push(`kind must be ${kind}`);
  if (!contract.products.includes(value.ownerProduct)) errors.push("ownerProduct is not a suite product");
  if (!contract.products.includes(value.supplierProduct)) errors.push("supplierProduct is not a suite product");
  if (value.ownerProduct === value.supplierProduct) errors.push("ownerProduct and supplierProduct must differ");
  return errors;
}

export function validateHandoffRequest(value, contract) {
  const errors = sharedEnvelopeErrors(value, contract, contract.requestKeys, contract.requestKind);
  if (errors.length === 0) {
    if (!stringList(value.requestedOutputs)) errors.push("requestedOutputs must be a unique non-empty list");
    else if (value.requestedOutputs.some((output) => !contract.requestedOutputs.includes(output))) {
      errors.push("requestedOutputs holds a value outside the contract enum");
    }
    if (!stringList(value.sourceArtifactIds)) errors.push("sourceArtifactIds must be a unique non-empty list");
    if (value.returnToSkill !== contract.entrySkills[value.ownerProduct]) {
      errors.push("returnToSkill must be the owner product's entry skill");
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateHandoffReturn(value, contract) {
  const errors = sharedEnvelopeErrors(value, contract, contract.returnKeys, contract.returnKind);
  if (errors.length === 0) {
    for (const key of RETURN_LISTS) {
      const list = value[key];
      if (!Array.isArray(list) || list.some((item) => typeof item !== "string" || item.trim().length === 0)) {
        errors.push(`${key} must be a list of non-empty strings`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// 재귀 인계는 봉투 하나만 봐서는 잡히지 않는다. 공급 제품이 답례로 요청을 시작하면 두 제품이
// 서로의 결론을 근거로 삼게 되고, 그때부터는 어느 쪽도 사실을 소유하지 않는다.
export function validateHandoffChain(envelopes, contract) {
  const errors = [];
  if (!Array.isArray(envelopes) || envelopes.length === 0) {
    return { ok: false, errors: ["a handoff chain needs at least one envelope"] };
  }
  const requests = envelopes.filter((envelope) => isObject(envelope) && envelope.kind === contract.requestKind);
  if (requests.length > contract.maxHandoffsPerRequest) {
    errors.push("a request carries one handoff at most");
  }
  for (const envelope of envelopes) {
    const result = isObject(envelope) && envelope.kind === contract.returnKind
      ? validateHandoffReturn(envelope, contract)
      : validateHandoffRequest(envelope, contract);
    errors.push(...result.errors);
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `node --test tests/contracts/suite-handoff-contract.test.mjs`
Expected: 7개 테스트 PASS(Task 3의 두 개 + 이 태스크의 다섯 개).

- [ ] **Step 5: 커밋**

```bash
git add tooling/lib/suite-handoff-contract.mjs tests/contracts/suite-handoff-contract.test.mjs
git commit -m "feat: refuse malformed and recursive suite handoff envelopes"
```

---

### Task 5: 상대 제품 미설치를 지연 감지한다

교차가 실제로 필요한 순간에만 한 번 조회한다. 새 스크립트를 만들지 않고, 이미 폐쇄 검증을 끝낸 `plugin list --json` 파서를 감싼다. 조회 실패는 던지지 않고 `unknown`으로 닫는다.

**Files:**
- Modify: `shared/scripts/inspect-game-design-plugin-updates.mjs:145-159, 209-230`
- Create: `tests/unit/installed-suite-products.test.mjs`
- Modify: `shared/suite-update/skills/upgrade-game-design-suite/references/codex-commands.md`
- Modify: `shared/contracts/README.md`
- Test: `tests/unit/installed-suite-products.test.mjs`

**Interfaces:**
- Consumes: 기존 `inspectPluginUpdates({ codexPath, marketplaceName, runCommand, readText })`.
- Produces: `inspectInstalledSuiteProducts(options) => Readonly<{ status: "known" | "unknown", products: readonly string[] }>`와 CLI 인자 `--products`.

- [ ] **Step 1: 테스트를 먼저 쓴다**

`tests/unit/installed-suite-products.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

import { inspectInstalledSuiteProducts } from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const MARKETPLACE = "game-design-suite";

function pluginEntry({ plugin, installed }) {
  return {
    pluginId: `${plugin}@${MARKETPLACE}`,
    name: plugin,
    marketplaceName: MARKETPLACE,
    version: "0.1.1",
    installed,
    enabled: installed,
    source: { source: "local", path: `/private/tmp/marketplace/plugins/${plugin}` },
    marketplaceSource: { sourceType: "local", source: "/private/tmp/marketplace" },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
  };
}

function hostOutput({ installed, available }) {
  return JSON.stringify({
    installed: installed.map((plugin) => pluginEntry({ plugin, installed: true })),
    available: available.map((plugin) => pluginEntry({ plugin, installed: false })),
  });
}

function inspectWith(receipt) {
  return inspectInstalledSuiteProducts({
    runCommand: () => receipt,
    readText: () => { throw new Error("the product lookup must not read a snapshot manifest"); },
  });
}

test("both installed products are reported in a stable order", () => {
  const result = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-studio", "game-design-career"], available: [] }),
  });

  assert.deepEqual(result, { status: "known", products: ["game-design-career", "game-design-studio"] });
});

// 상대 제품이 없다는 것과 확인하지 못했다는 것은 다른 사실이고, 사용자에게 다른 문장을 만든다.
// 조회가 성공했는데 목록에 없으면 미설치가 확정이다.
test("a product missing from a successful listing is absent, not unknown", () => {
  const result = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-career"], available: ["game-design-studio"] }),
  });

  assert.equal(result.status, "known");
  assert.deepEqual(result.products, ["game-design-career"]);
});

test("every way the host call can fail closes to unknown instead of throwing", () => {
  const receipts = [
    ["non-zero exit", { status: 1, signal: null, error: undefined, stderr: "boom", stdout: "" }],
    ["killed by a signal", { status: null, signal: "SIGKILL", error: undefined, stderr: "", stdout: "" }],
    ["spawn error", { status: null, signal: null, error: new Error("ENOENT"), stderr: "", stdout: "" }],
    ["malformed JSON", { status: 0, signal: null, error: undefined, stderr: "", stdout: "not json" }],
    ["unexpected keys", { status: 0, signal: null, error: undefined, stderr: "", stdout: '{"installed":[]}' }],
    ["empty listing", { status: 0, signal: null, error: undefined, stderr: "", stdout: '{"installed":[],"available":[]}' }],
  ];
  for (const [name, receipt] of receipts) {
    assert.deepEqual(inspectWith(receipt), { status: "unknown", products: [] }, name);
  }
});

test("the lookup runs one read-only listing and no mutating command", () => {
  const ran = [];
  inspectInstalledSuiteProducts({
    runCommand(command, args) {
      ran.push([command, ...args].join(" "));
      return {
        status: 0,
        signal: null,
        error: undefined,
        stderr: "",
        stdout: hostOutput({ installed: ["game-design-career"], available: [] }),
      };
    },
    readText: () => { throw new Error("unused"); },
  });

  assert.equal(ran.length, 1);
  assert.doesNotMatch(ran[0], /marketplace upgrade|plugin add|plugin remove/u);
  assert.match(ran[0], /plugin list --marketplace game-design-suite --available --json/u);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/unit/installed-suite-products.test.mjs`
Expected: `SyntaxError: The requested module ... does not provide an export named 'inspectInstalledSuiteProducts'`.

- [ ] **Step 3: 조회 함수를 구현한다**

`shared/scripts/inspect-game-design-plugin-updates.mjs`의 `inspectPluginUpdates` 정의 바로 아래에 추가한다.

```javascript
// 인계는 상대 제품이 실제로 설치돼 있을 때만 성립한다. 업데이트 검사와 같은 목록을 읽지만 결과가
// 다르다. 업데이트는 못 읽으면 실패지만, 인계는 못 읽어도 자기 제품 몫을 끝내야 하므로 여기서는
// 던지지 않고 unknown으로 닫는다. 미설치와 확인 불가는 사용자에게 다른 문장을 만든다.
export function inspectInstalledSuiteProducts(options = {}) {
  try {
    const inspection = inspectPluginUpdates(options);
    const products = inspection.installed
      .map(({ plugin }) => plugin)
      .filter((plugin) => PLUGINS.has(plugin))
      .sort();
    return Object.freeze({ status: "known", products: Object.freeze(products) });
  } catch {
    return Object.freeze({ status: "unknown", products: Object.freeze([]) });
  }
}
```

`cli()`의 인자 검사(211-216행)를 `--products`까지 받도록 넓힌다.

```javascript
  if (!(args.length === 1 && (args[0] === "--inspect" || args[0] === "--products"))
    && !(args.length === 2 && args[0] === "--plan" && PLUGINS.has(args[1]))) {
```

그리고 `--inspect` 분기 앞에 다음을 넣는다. `--products`는 조회 실패도 결과이므로 `try` 밖에서 처리한다.

```javascript
  if (args[0] === "--products") {
    const lookup = inspectInstalledSuiteProducts({ codexPath: process.env.CODEX_PATH ?? "codex" });
    process.stdout.write(`${JSON.stringify(lookup)}\n`);
    return;
  }
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `node --test tests/unit/installed-suite-products.test.mjs`
Expected: 4개 테스트 PASS.

`readText`를 던지게 두었으므로, 조회가 스냅샷 manifest를 읽지 않는다는 사실도 함께 고정된다. 만약 실패하면 `inspectInstalledSuiteProducts`가 비교까지 하고 있는 것이다. 비교는 이 함수의 일이 아니다.

- [ ] **Step 5: 문서 두 곳을 맞춘다**

`shared/suite-update/skills/upgrade-game-design-suite/references/codex-commands.md`의 "Read-only, safe before approval" 목록에 한 줄을 넣는다.

```markdown
- Installed suite products: `node scripts/inspect-game-design-plugin-updates.mjs --products`
```

그 아래 문단으로 다음을 덧붙인다.

```markdown
The products command answers which suite products this host has installed. It reports
`"status":"known"` with the installed product ids, and `"status":"unknown"` with an empty list when
the host listing cannot be read at all. Unknown is a result to report as "확인 불가", not an error to
retry.
```

`shared/contracts/README.md`에 인계 계약 한 문단을 추가한다. 계약 파일 위치(`shared/suite-handoff/references/handoff.md`), 두 제품 동일 바이트 투영, 봉투 두 종류, `requestedOutputs` 폐쇄 enum, 한 요청당 인계 한 번, 미설치·확인 불가 degrade 구분을 적는다.

- [ ] **Step 6: 빌드와 전체 검증**

Run: `npm run build`
Run: `npm run validate`
Expected: `Suite release readiness: COMPLETE`.

- [ ] **Step 7: 커밋**

```bash
git add shared tests plugins guides
git commit -m "feat: look up the counterpart product only when a handoff needs it"
```

---

### Task 6: 설치본에서 왕복으로 확인하고 계획을 닫는다

소스 계약이 맞아도 설치된 패키지에서 같은 파일이 같은 바이트로 나오는지는 별개다. 격리 스모크와 e2e로 확인한다.

**Files:**
- Modify: `tests/e2e/suite/natural-language-routing.e2e.test.mjs`
- Test: `tests/e2e/suite/natural-language-routing.e2e.test.mjs`, `tooling/isolation-smoke.mjs`

**Interfaces:**
- Consumes: Task 1~5의 산출물 전부.
- Produces: 없음. 계획 3의 완료 조건을 증명한다.

- [ ] **Step 1: 설치 트리 계약 테스트를 추가한다**

`tests/e2e/suite/natural-language-routing.e2e.test.mjs` 끝에 추가한다.

```javascript
// 대표 스킬은 설치본에서 자기 제품 라우팅 레지스트리와 인계 계약을 함께 갖고 있어야 한다. 둘 중
// 하나만 설치되면 진입점은 존재하지만 갈 곳이 없거나, 갈 곳은 있는데 규칙이 없다.
test("each installed product carries its entry skill next to the routing registry and the handoff contract", async () => {
  for (const [root, product] of [[studioRoot, "game-design-studio"], [careerRoot, "game-design-career"]]) {
    const skill = await readFile(path.join(root, "skills", product, "SKILL.md"), "utf8");
    const handoff = await readFile(path.join(root, "skills", product, "references/handoff.md"), "utf8");
    const routing = JSON.parse(await readFile(path.join(root, "references/routing.json"), "utf8"));

    assert.match(skill, new RegExp(`^---\\nname: ${product}\\n`, "u"));
    assert.ok(routing.skillIds.includes(product), `${product}: entry skill is missing from the installed registry`);
    assert.ok(handoff.includes("<!-- suite-handoff-contract:start -->"), `${product}: handoff contract is not installed`);
    assert.ok(routing.plannedPaths.skills.includes(`skills/${product}/SKILL.md`), product);
  }
});

test("the installed handoff contract is byte-identical across the two products", async () => {
  const [studio, career] = await Promise.all([
    readFile(path.join(studioRoot, "skills/game-design-studio/references/handoff.md")),
    readFile(path.join(careerRoot, "skills/game-design-career/references/handoff.md")),
  ]);
  assert.ok(studio.equals(career));
});
```

- [ ] **Step 2: e2e를 돌린다**

Run: `node --test tests/e2e/suite/natural-language-routing.e2e.test.mjs`
Expected: 0 fail. 실패하면 `npm run build`를 먼저 돌리지 않은 것이다.

- [ ] **Step 3: 격리 스모크를 돌린다**

Run: `node tooling/isolation-smoke.mjs`
Expected: 두 제품 모두 정확 스킬 집합과 경로 게이트를 통과한다. 실패 메시지가 정확 집합의 차이를 직접 보여 준다.

- [ ] **Step 4: 전체 검증**

Run: `npm test`
Expected: `fail 0`.

Run: `npm run validate`
Expected: 마지막 줄 `Suite release readiness: COMPLETE`.

- [ ] **Step 5: 커밋**

```bash
git add tests/e2e/suite/natural-language-routing.e2e.test.mjs
git commit -m "test: verify the entry skill and handoff contract in the installed tree"
```

---

## 계획 4로 넘기는 것

이 계획은 스펙 4·5단계만 담는다. 다음은 의도적으로 남긴다.

- 루트 README의 설치·첫 요청·업데이트 섹션 개편, 인계 도식과 설치·업데이트 도식 갱신 (스펙 7단계).
- Windows·Linux CI 신설과 설치 왕복 검증 (스펙 6단계).
- `0.2.0` 릴리스와 `v0.2.0` 태그, 릴리스 노트의 번들 구성 요소 버전 표 (스펙 7단계).
- 계획 2가 넘긴 항목: 로컬 fixture `0.1.1 → 0.1.2`에서 `plugin add`가 새 버전을 설치하고 이전 캐시를 제거하는지, Git 경로에서 승인 전 refresh 0회·승인 뒤 1회인지. 실제 버전 증가가 필요하므로 릴리스 절차와 묶는다.
- 벤더된 `skillstead`가 upstream보다 한 마이너 뒤(`svg-infographic/v0.9.0` 설치, `v0.10.0` 공개)인 vendor-sync 결정.

## Self-Review

**1. 스펙 커버리지.** B절 배치(Task 1), 소유 도메인(Task 1의 SKILL.md 트리거·비트리거), 트리거 소유권과 오케스트레이터 description 이관(Task 1 Step 5, Task 2의 마지막 테스트), 대표 스킬이 소유하는 네 가지(Task 1 본문, Task 2 테스트), 라우팅 영수증(Task 2), 결정론 확보(Task 6의 설치 레지스트리 검사), C절 계약 위치(Task 3), 봉투(Task 3 문서 + Task 4 검증기), 규칙 세 개(Task 4의 거부 표와 chain 검사), 상대 제품 미설치 처리(Task 5), 대표 사례(Task 3 문서의 요청 봉투 예시가 `career-proof-project-interview`와 같은 방향인 Career owner·Studio supplier다). B절 테스트 전략 다섯 항목은 Task 1의 첫 테스트(대표 스킬 부재 시 실패), Task 1의 라우팅 레지스트리 검사(단일·복합 route), Task 2(영수증 항목, 사례 ID 두 규칙)가 덮는다. C절 테스트 전략 네 항목은 Task 4의 거부 표, Task 3·6의 byte 동일성, Task 5의 unknown 폐쇄, Task 6의 두 제품 동시 설치 검사가 덮는다.

**2. 빈칸 점검.** `TBD`, `적절히`, `필요하면`류 없음. Task 1 Step 9와 Step 10만 문서 내용을 표와 섹션 목록으로 지시하는데, 값은 모두 확정돼 있고 생성기(`npm run build:prompt-guides`)와 검증기(`npm run validate:guides`)가 나머지를 강제한다.

**3. 타입 일관성.** `inspectInstalledSuiteProducts`는 Task 5의 정의와 테스트에서 모두 `{ status, products }`를 쓴다. `parseSuiteHandoffContract`/`validateHandoffRequest`/`validateHandoffReturn`/`validateHandoffChain` 네 이름은 Task 4의 Interfaces, 테스트, 구현에서 동일하다. 계약 JSON의 키 아홉 개는 Task 3의 문서와 Task 4의 `CONTRACT_KEYS`가 같다. 봉투 키는 문서의 `requestKeys`/`returnKeys`가 유일한 출처이고 검증기는 그 값을 읽는다. 대표 스킬 ID는 제품 ID와 같다는 사실을 Task 1(테스트), Task 3(빌드 매핑), Task 4(`entrySkills`)가 공유한다.
