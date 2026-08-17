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
