import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const manifestDir = path.dirname(manifestPath);
const recipeHeadings = [
  "완료 목표",
  "준비할 입력",
  "복사 가능한 요청문",
  "단계별 진행",
  "사람이 결정할 지점",
  "예상 결과",
  "실패와 재개",
  "관련 기능",
];
const recipes = [
  ["new-game-gdd", "vision-to-gdd-approval"],
  ["system-feature-spec", "system-rule-state-exception-flow"],
  ["content-quest-design", "content-narrative-quest-map"],
  ["ux-accessibility", "studio-orchestration-map"],
  ["economy-liveops", "economy-balance-liveops-loop"],
  ["production-review-export", "production-risk-review-flow"],
];

function resolveManifestPath(value, field) {
  assert.equal(typeof value, "string", field + " must be a string");
  assert.ok(value.length > 0, field + " must be nonempty");
  assert.ok(!path.isAbsolute(value) && !path.win32.isAbsolute(value), field + " must be relative");
  const resolved = path.resolve(manifestDir, value);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), field + " must stay inside the repository");
  return resolved;
}

async function assertRegularFile(value, field) {
  const resolved = resolveManifestPath(value, field);
  const stats = await lstat(resolved);
  assert.ok(!stats.isSymbolicLink(), field + " must not be a symlink");
  assert.ok(stats.isFile(), field + " must be a regular file");
  return resolved;
}

test("Studio recipes have one primary diagram and the complete handoff contract", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const [recipeId, diagramId] of recipes) {
    const recipePath = path.join(root, "guides/game-design-studio/recipes", recipeId + ".md");
    const markdown = await readFile(recipePath, "utf8");
    for (const heading of recipeHeadings) {
      assert.match(markdown, new RegExp("^## " + heading + "$", "m"), recipeId + ": " + heading);
    }
    const imageLinks = [...markdown.matchAll(/!\[[^\]]+\]\(([^)]+\.png)\)/g)].map((match) => match[1]);
    assert.equal(imageLinks.length, 1, recipeId + " must have exactly one primary diagram image link");
    assert.match(imageLinks[0], new RegExp("game-design-studio/" + diagramId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.png$"));
    const diagram = manifest.diagrams.find(({ id }) => id === diagramId);
    assert.ok(diagram, recipeId + " primary diagram must be declared in the manifest");
    assert.ok(diagram.usedBy.includes("../game-design-studio/recipes/" + recipeId + ".md"), recipeId + " must be a manifest consumer");
  }
});

test("Studio manifest declares exactly six complete Studio diagram pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const studio = manifest.diagrams.filter(({ scope }) => scope === "game-design-studio");
  assert.deepEqual(studio.map(({ id }) => id).sort(), recipes.map(([, id]) => id).sort());
  for (const diagram of studio) {
    assert.equal(diagram.svg, "game-design-studio/" + diagram.id + ".svg");
    assert.equal(diagram.png, "game-design-studio/" + diagram.id + ".png");
    const svgPath = await assertRegularFile(diagram.svg, diagram.id + ".svg");
    await assertRegularFile(diagram.png, diagram.id + ".png");
    for (const field of ["sources", "usedBy"]) {
      assert.ok(Array.isArray(diagram[field]) && diagram[field].length > 0, diagram.id + "." + field);
      for (const value of diagram[field]) await assertRegularFile(value, diagram.id + "." + field);
    }
    const svg = await readFile(svgPath, "utf8");
    assert.match(svg, /^\s*<svg\b[^>]*>\s*<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>\s*<desc\b[^>]*>\s*[^<\s][\s\S]*?<\/desc>/u, diagram.id + " requires title and desc");
  }
});
