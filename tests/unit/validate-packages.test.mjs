import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoverPackagedTargets } from "../../tooling/validate-packages.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const expectedSkillIdsByProduct = Object.freeze({
  "game-design-career": [
    "apply-document-quality-profile", "archify", "build-game-design-portfolio", "export-career-documents",
    "generate-image-assets", "humanize-korean", "map-game-design-career", "orchestrate-game-design-career",
    "plan-image-assets", "plan-junior-growth", "polish-game-design-writing", "practice-game-design-interview",
    "research-game-design-jobs", "reverse-engineer-game-design", "review-game-design-portfolio", "review-image-assets",
    "svg-infographic", "visualize-career-roadmap",
  ],
  "game-design-studio": [
    "apply-document-quality-profile", "archify", "define-game-vision", "design-game-content",
    "design-game-economy-and-liveops", "design-game-systems", "design-player-experience", "export-game-design-documents",
    "generate-image-assets", "humanize-korean", "orchestrate-game-design-project", "plan-game-production",
    "plan-image-assets", "polish-game-design-writing", "review-game-design", "review-image-assets",
    "svg-infographic", "visualize-game-design",
  ],
});

test("package validator discovers the exact two-plugin, 36-skill snapshot", async () => {
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
});
