import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory, extractMarkdownLinks } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const guideRoot = path.join(root, "guides");
const products = ["game-design-studio", "game-design-career"];

function localMarkdownTargets(markdownPath, markdown) {
  return extractMarkdownLinks(markdown)
    .map(({ target }) => target.split("#", 1)[0].split("?", 1)[0])
    .filter((target) => target && !/^[a-z][a-z\d+.-]*:/i.test(target))
    .map((target) => path.resolve(path.dirname(markdownPath), target));
}

async function reachableMarkdownPaths(entryPath) {
  const seen = new Set();
  const queue = [entryPath];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const markdown = await readFile(current, "utf8");
    for (const target of localMarkdownTargets(current, markdown)) {
      if (path.extname(target) === ".md" && target.startsWith(guideRoot + path.sep)) queue.push(target);
    }
  }
  return seen;
}

test("root README is a beginner landing page for both plugins", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const headings = [
    "어떤 플러그인을 설치할까",
    "지원 환경",
    "Codex App 설치",
    "Codex CLI 설치",
    "5분 빠른 시작",
    "기획 문서 템플릿",
    "이미지와 도식화",
    "문서 내보내기",
    "상세 사용 가이드",
    "문제 해결",
  ];
  let previous = -1;
  for (const heading of headings) {
    const match = new RegExp("^## " + heading + "$", "m").exec(readme);
    assert.ok(match, "missing root README heading: " + heading);
    assert.ok(match.index > previous, "root README headings must preserve beginner order");
    previous = match.index;
  }
  assert.match(readme, /guides\/game-design-studio\/README\.md/);
  assert.match(readme, /guides\/game-design-career\/README\.md/);
  assert.match(readme, /Codex App/);
  assert.match(readme, /Codex CLI/);
  assert.match(readme, /제품 스킬 14개.*Skillstead.*15개/s);
});

test("global and product indexes reach every guide inventory", async () => {
  const reachable = await reachableMarkdownPaths(path.join(guideRoot, "README.md"));
  for (const product of products) {
    const inventory = await collectProductInventory(root, product);
    const productRoot = path.join(guideRoot, product);
    const expected = [
      "README.md",
      "installation.md",
      "quick-start.md",
      "workflow.md",
      "document-quality.md",
      "image-assets.md",
      "visualization.md",
      "exports.md",
      "templates.md",
      "troubleshooting.md",
      "skills/README.md",
      ...inventory.skillIds.map((id) => `skills/${id}.md`),
    ];
    const recipes = product === "game-design-studio"
      ? ["new-game-gdd", "system-feature-spec", "content-quest-design", "ux-accessibility", "economy-liveops", "production-review-export"]
      : ["role-learning-roadmap", "job-research-gap", "reverse-design", "portfolio-build-review", "interview-preparation", "junior-growth-transition"];
    expected.push(...recipes.map((id) => `recipes/${id}.md`));

    for (const relative of expected) {
      assert.ok(reachable.has(path.join(productRoot, relative)), `${product} index path is unreachable: ${relative}`);
    }
  }
});
