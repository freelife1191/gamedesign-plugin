import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 예시",
  "Codex CLI 예시",
  "진행 흐름",
  "결과와 파일",
  "검토와 승인",
  "실패와 재개",
];

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]).sort();
}

test("Studio documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-studio/skills", skillId + ".md"),
      "utf8",
    );
    for (const heading of requiredHeadings) {
      assert.match(markdown, new RegExp("^## " + heading + "$", "m"), skillId + ": " + heading);
    }
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});

test("Studio indexes every installed skill and template exactly once", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const skillIndex = await readFile(
    path.join(root, "guides/game-design-studio/skills/README.md"),
    "utf8",
  );
  const templates = await readFile(
    path.join(root, "guides/game-design-studio/templates.md"),
    "utf8",
  );

  assert.deepEqual(extractFirstColumnIds(skillIndex), inventory.skillIds);
  assert.deepEqual(extractFirstColumnIds(templates), inventory.templateIds);
  assert.equal(inventory.templateIds.length, 15);
});

test("Studio topical guides preserve image, visualization, and export policies", async () => {
  const topicalGuides = await Promise.all(
    ["document-quality.md", "image-assets.md", "visualization.md", "exports.md"].map((filename) =>
      readFile(path.join(root, "guides/game-design-studio", filename), "utf8"),
    ),
  );
  const joinedGuides = topicalGuides.join("\n");

  for (const phrase of [
    "prompt-only",
    "select",
    "required",
    "all",
    "gpt-image-2",
    "low",
    "OpenAI only",
    "Codex",
    "SVG",
    "정확한 2× PNG",
    "MD",
    "PDF",
    "DOCX",
    "PPTX",
  ]) {
    assert.ok(joinedGuides.includes(phrase), "missing Studio guide contract: " + phrase);
  }
});
