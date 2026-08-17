import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoverPackagedTargets } from "../../tooling/validate-packages.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const expectedSkillIdsByProduct = Object.freeze({
  "game-design-career": [
    "analyze-game-design-references", "apply-document-quality-profile", "archify", "build-game-design-portfolio", "export-career-documents",
    "capture-game-design-memory", "game-design-career", "generate-image-assets", "humanize-korean", "maintain-game-design-glossary", "maintain-game-design-memory", "map-game-design-career", "orchestrate-game-design-career",
    "plan-image-assets", "plan-junior-growth", "polish-game-design-writing", "practice-game-design-interview",
    "research-game-design-jobs", "retrieve-approved-design-memory", "reverse-engineer-game-design", "review-game-design-portfolio", "review-image-assets",
    "svg-infographic", "upgrade-game-design-suite", "visualize-career-roadmap",
  ],
  "game-design-studio": [
    "analyze-game-design-references", "apply-document-quality-profile", "archify", "define-game-vision", "design-game-content",
    "design-cutscene-visual-preproduction", "design-game-economy-and-liveops", "design-game-systems", "design-player-experience", "export-game-design-documents",
    "capture-game-design-memory", "game-design-studio", "generate-image-assets", "humanize-korean", "maintain-game-design-glossary", "maintain-game-design-memory", "orchestrate-game-design-project", "plan-game-production",
    "plan-image-assets", "polish-game-design-writing", "retrieve-approved-design-memory", "review-game-design", "review-image-assets",
    "svg-infographic", "upgrade-game-design-suite", "visualize-game-design",
  ],
});

test("package validator discovers the exact two-plugin, 51-skill snapshot", async () => {
  const plugins = await discoverPackagedTargets(repoRoot, "plugins");
  const skills = await discoverPackagedTargets(repoRoot, "skills");

  assert.deepEqual(
    plugins.map((target) => path.relative(repoRoot, target).split(path.sep).join("/")),
    ["plugins/game-design-career", "plugins/game-design-studio"],
  );
  assert.deepEqual(
    skills.map((target) => path.relative(repoRoot, target).split(path.sep).join("/")),
    Object.entries(expectedSkillIdsByProduct)
      .flatMap(([productId, ids]) => ids.map((id) => `plugins/${productId}/skills/${id}`))
      .sort(),
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(expectedSkillIdsByProduct).map(([productId, skillIds]) => [productId, skillIds.length])),
    { "game-design-career": 25, "game-design-studio": 26 },
  );
  assert.equal(Object.values(expectedSkillIdsByProduct).flat().length, 51);
});
