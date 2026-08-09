import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadPromptTemplateCatalog } from "../../tooling/lib/prompt-template-catalog.mjs";
import { renderPromptCard, validateRenderedPromptCard } from "../../tooling/lib/prompt-guides.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const products = new Map([
  ["studio", "game-design-studio"],
  ["career", "game-design-career"],
]);

function count(value, expression) {
  return [...value.matchAll(expression)].length;
}

function renderedCards(markdown) {
  return [...markdown.matchAll(/<!-- PROMPT-CARD: [^>]+ -->[\s\S]*?(?=<!-- PROMPT-CARD: |<!-- PROMPT-TEMPLATES:END |$)/gu)].map(([card]) => card);
}

function detailPath(entry) {
  if (entry.kind === "suite-case") return `guides/prompt-templates/suite/${entry.id.split(":")[1]}.md`;
  return `guides/prompt-templates/${entry.product}/${entry.skill}.md`;
}

async function filesIn(directory) {
  return (await readdir(path.join(root, directory))).filter((name) => name.endsWith(".md")).sort();
}

test("prompt guide library publishes the complete deterministic card graph", async () => {
  const catalog = await loadPromptTemplateCatalog({ repoRoot: root });
  const detailPages = new Set(catalog.entries.filter((entry) => entry.kind === "skill-template" || entry.kind === "suite-case").map(detailPath));
  assert.equal(detailPages.size, 38, "15 Studio + 15 Career + 8 suite detail pages");
  assert.deepEqual(await filesIn("guides/prompt-templates/studio"), [...detailPages].filter((file) => file.includes("/studio/")).map((file) => path.basename(file)).sort());
  assert.deepEqual(await filesIn("guides/prompt-templates/career"), [...detailPages].filter((file) => file.includes("/career/")).map((file) => path.basename(file)).sort());
  assert.deepEqual(await filesIn("guides/prompt-templates/suite"), [...detailPages].filter((file) => file.includes("/suite/")).map((file) => path.basename(file)).sort());

  const targets = ["guides/prompt-templates/README.md", ...detailPages];
  for (const entry of catalog.entries.filter((candidate) => candidate.kind === "skill-template" || candidate.kind === "suite-case")) {
    assert.ok((await readFile(path.join(root, detailPath(entry)), "utf8")).includes(`PROMPT-CARD: ${entry.id}`), entry.id);
  }

  for (const entry of catalog.entries.filter((candidate) => candidate.kind === "use-case" || candidate.kind === "recipe")) {
    targets.push(entry.source_references[0]);
  }
  const documents = await Promise.all([...new Set(targets)].map((file) => readFile(path.join(root, file), "utf8")));
  const markdown = documents.join("\n");
  const cards = documents.flatMap(renderedCards);
  const rendered = cards.join("\n");
  assert.equal(cards.length, 146);
  assert.equal(
    count(rendered, /^#{3,} Codex (?:App|CLI) 완성 예시$/gmu),
    292,
    "146 cards expose one App and one CLI execution path",
  );
  assert.equal(
    count(rendered, /^#{3,} Codex (?:App|CLI) (?:완성 예시|재사용 템플릿)$/gmu),
    584,
    "each execution path has an example and reusable template",
  );
  assert.equal(count(rendered, /^```text$/gmu), 730);
  assert.equal(count(rendered, /^#{3,} 실패와 재개$/gmu), 146);

  for (const skill of catalog.entries.filter((entry) => entry.kind === "skill-template")) {
    const guide = await readFile(path.join(root, `guides/${products.get(skill.product)}/skills/${skill.skill}.md`), "utf8");
    const marker = `<!-- PROMPT-TEMPLATES:START ${products.get(skill.product)}:${skill.skill} -->`;
    assert.equal(count(guide, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu")), 1, skill.id);
    assert.match(guide, /beginner[\s\S]*standard[\s\S]*advanced/u, skill.id);
    assert.equal(count(guide, /^## /gmu), 14, `${skill.id} must preserve the existing 14 H2 headings`);
  }

  for (const entry of catalog.entries) {
    const expectedNamespace = entry.product === "career" ? "$game-design-career:" : "$game-design-studio:";
    const location = entry.kind === "skill-template" || entry.kind === "suite-case"
      ? detailPath(entry)
      : entry.source_references[0];
    const body = await readFile(path.join(root, location), "utf8");
    assert.ok(body.includes(entry.id), `${entry.id} stable ID`);
    assert.ok(body.includes(entry.human_review_boundary), `${entry.id} reviewer`);
    assert.ok(body.includes(entry.diagram_binding.id), `${entry.id} diagram binding`);
    assert.ok(body.includes(expectedNamespace), `${entry.id} CLI namespace`);
  }
});

test("rendered cards reject chain, result, namespace, reviewer, and diagram mutations", async () => {
  const catalog = await loadPromptTemplateCatalog({ repoRoot: root });
  const entry = catalog.entries.find((candidate) => candidate.id === "studio:define-game-vision:standard");
  const card = renderPromptCard(entry);
  validateRenderedPromptCard(entry, card);

  const mutations = [
    ["swapped chain", card.replace(entry.skill_chain.join(" → "), [...entry.skill_chain].reverse().join(" → "))],
    ["missing result layer", card.replace("#### 선택 결과물", "#### 결과물")],
    ["wrong namespace", card.replaceAll("$game-design-studio:", "$game-design-career:")],
    ["removed reviewer", card.replace(entry.human_review_boundary, "검토 경계가 제거됨")],
    ["removed diagram binding", card.replace(entry.diagram_binding.id, "diagram-binding-removed")],
  ];
  for (const [label, mutated] of mutations) {
    assert.throws(() => validateRenderedPromptCard(entry, mutated), undefined, label);
  }
});
