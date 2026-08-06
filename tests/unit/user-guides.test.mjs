import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectHeadingAnchors,
  collectProductInventory,
  extractMarkdownLinks,
} from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("product inventory includes 14 product skills plus vendored Skillstead", async () => {
  const studio = await collectProductInventory(repoRoot, "game-design-studio");
  const career = await collectProductInventory(repoRoot, "game-design-career");
  assert.equal(studio.skillIds.length, 15);
  assert.equal(career.skillIds.length, 15);
  assert.equal(studio.templateIds.length, 15);
  assert.equal(career.templateIds.length, 15);
  assert.ok(studio.skillIds.includes("svg-infographic"));
  assert.ok(career.skillIds.includes("svg-infographic"));
});

test("Markdown helpers preserve Korean anchors and reject no links", () => {
  const markdown = "# 설치 안내\n\n[빠른 시작](quick-start.md#첫-요청)\n";
  assert.deepEqual(extractMarkdownLinks(markdown), [
    { target: "quick-start.md#첫-요청", line: 3 },
  ]);
  assert.ok(collectHeadingAnchors("# 설치 안내\n\n## 첫 요청\n").has("첫-요청"));
});
