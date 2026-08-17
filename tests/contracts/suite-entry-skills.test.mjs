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

// 백틱으로 감싼 하이픈 소문자 토큰은 스킬 ID 모양이다. 이 모양을 쓰면서 스킬이 아닌 낱말은
// 여기에 등록해야 하고, 그 밖에는 전부 자기 제품 레지스트리에 있어야 한다.
const SKILL_ID_SHAPE = /^[a-z]+(?:-[a-z0-9]+)+$/u;
const NON_SKILL_TOKENS = new Set([
  // 워크스페이스가 들고 있는 영수증 파일 이름이지 호출할 스킬이 아니다.
  "route-receipt",
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
    const named = [...skill.matchAll(/`([^`\n]+)`/gu)].map((match) => match[1]);
    const skillLike = named.filter((token) => SKILL_ID_SHAPE.test(token) && !NON_SKILL_TOKENS.has(token));
    assert.ok(skillLike.length > 0, `${product}: body names no skill at all, so this contract proves nothing`);
    for (const id of skillLike) {
      assert.ok(routing.skillIds.includes(id), `${product}: ${id} is not in routing.skillIds`);
    }
  }
});

// 소스 트리에는 references/handoff.md가 없다. 그 파일은 패키지로만 투영되므로 Markdown 링크로
// 적으면 소스 쪽에서 영원히 끊긴 링크가 된다. Studio 패키지에만 전 트리 링크 검사가 있어 Career는
// 무방비이므로, 두 제품을 여기서 함께 고정한다.
test("both entry skills name the handoff contract as a path, never as a Markdown link", async () => {
  for (const { product } of ENTRY_SKILLS) {
    const skill = await entrySkill(product);
    assert.ok(skill.includes("`references/handoff.md`"), `${product}: must name the handoff contract as a backticked path`);
    assert.doesNotMatch(
      skill,
      /\[[^\]]*\]\((?:\.\/)?references\/handoff\.md\)/u,
      `${product}: references/handoff.md exists only in the built package, so a Markdown link cannot resolve`,
    );
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

  // 본문 아무 데나 있으면 통과하는 검사로는 이동을 증명하지 못한다. 특히 ## Non-triggers에
  // 나타나면 뜻이 정반대다. 트리거가 실제로 사는 두 자리, frontmatter description과
  // ## Triggers 목록에 고정한다.
  const entry = await entrySkill("game-design-studio");
  assert.match(/^description: (.+)$/mu.exec(entry)[1], /ambiguous/u, "the entry description must carry the moved trigger");
  const triggers = /\n## Triggers\n([\s\S]*?)\n## /u.exec(entry)[1];
  assert.match(triggers, /ambiguous/u, "the entry Triggers list must carry the moved trigger");
});
