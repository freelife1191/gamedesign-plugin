import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

test("Career plan-image-assets preserves profile slots, count evidence, and Skillstead QA handoff", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/plan-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: plan-image-assets\ndescription: Use when /u);
  assert.match(skill, /apply-document-quality-profile/u);
  assert.match(skill, /required_images|recommended_images/u);
  assert.match(skill, /image-assets\.yml/u);
  assert.match(skill, /image-prompts\.md/u);
  assert.match(skill, /image-prompts\.json/u);
  assert.match(skill, /build-image-asset-plan\.mjs/u);
  assert.match(skill, /compile-image-prompts\.mjs/u);
  assert.match(skill, /stable asset ID|stable asset_id/u);
  assert.match(skill, /explicit (?:asset )?count/u);
  assert.match(skill, /placeholder/u);
  assert.match(skill, /character.*NPC.*monster\/boss.*skill\/VFX.*environment.*item.*UI.*story.*key art.*document.*Skillstead/is);
  assert.match(skill, /SVG.*authority|editable SVG/u);
  assert.match(skill, /title.*desc|<title>.*<desc>/is);
  assert.match(skill, /lint.*render.*QA/is);
  assert.doesNotMatch(skill, /OpenAI|Codex image generation/u);
});

test("Career generate-image-assets uses stable user choices and the configured provider truthfully", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/generate-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: generate-image-assets\ndescription: Use when /u);
  assert.match(skill, /validate-image-config\.mjs/u);
  assert.match(skill, /capability-probe\.mjs/u);
  assert.match(skill, /selectGenerationJobs/u);
  assert.match(skill, /stable asset IDs?/u);
  assert.match(skill, /OPENAI_API_KEY/u);
  assert.match(skill, /generate-openai-images\.mjs/u);
  assert.match(skill, /OpenAI only|only.*OpenAI/is);
  assert.match(skill, /never.*Codex fallback|no.*Codex fallback/is);
  assert.match(skill, /host image capability/u);
  assert.match(skill, /prompts.*placeholders/is);
  assert.match(skill, /prompt-only/u);
  assert.match(skill, /select.*explicit.*stable/is);
  assert.match(skill, /do not.*model.*quality|must not.*model.*quality/is);
  assert.match(skill, /concept-draft/u);
});

test("Career review-image-assets keeps approval with named humans and blocks unapproved derivatives", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/review-image-assets/SKILL.md"), "utf8");

  assert.match(skill, /^---\nname: review-image-assets\ndescription: Use when /u);
  assert.match(skill, /validate-image-assets\.mjs/u);
  assert.match(skill, /applyImageReviewTransition/u);
  assert.match(skill, /stable asset ID/u);
  assert.match(skill, /named human/u);
  assert.match(skill, /actual user.*decision|user.*decision evidence/is);
  assert.match(skill, /concept-draft.*document-approved.*production-candidate/is);
  assert.match(skill, /rights|provenance/is);
  assert.match(skill, /artifact-local evidence|evidence.*artifact/is);
  assert.match(skill, /recommend/u);
  assert.match(skill, /not.*approve|cannot.*approve/is);
  assert.match(skill, /final derivative.*document-approved|document-approved.*final derivative/is);
});

test("Career routing and specialist roles expose image workflows without self-approval", async () => {
  const [routingText, orchestrator, artDirector, reviewer] = await Promise.all([
    readFile(path.join(pluginRoot, "references/routing.json"), "utf8"),
    readFile(path.join(pluginRoot, "skills/orchestrate-game-design-career/SKILL.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/art-brief-director.md"), "utf8"),
    readFile(path.join(pluginRoot, "agents/visual-asset-reviewer.md"), "utf8"),
  ]);
  const routing = JSON.parse(routingText);

  assert.ok(routing.skillIds.includes("plan-image-assets"));
  assert.ok(routing.skillIds.includes("generate-image-assets"));
  assert.ok(routing.skillIds.includes("review-image-assets"));
  assert.ok(routing.roleIds.includes("art-brief-director"));
  assert.ok(routing.roleIds.includes("visual-asset-reviewer"));
  assert.match(orchestrator, /apply-document-quality-profile.*plan-image-assets/is);
  assert.match(orchestrator, /generate-image-assets.*review-image-assets/is);
  assert.match(artDirector, /purpose.*readability.*prompt.*variant/is);
  assert.match(reviewer, /visual.*accessibility.*rights.*placement/is);
  assert.match(artDirector, /recommend/is);
  assert.match(reviewer, /recommend/is);
  assert.match(`${artDirector}\n${reviewer}`, /not.*approve|cannot.*approve/is);
});
