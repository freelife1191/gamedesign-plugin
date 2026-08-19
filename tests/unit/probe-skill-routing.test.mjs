import assert from "node:assert/strict";
import test from "node:test";

import { PRODUCTS, REQUIRED_SKILLS, catalogFindings, parseProbeArgs, parseSkillCatalog, skillDescriptions, unquoteScalar } from "../../tooling/probe-skill-routing.mjs";

const repoRoot = new URL("../..", import.meta.url).pathname;

// A catalog line as codex writes it. Descriptions carry colons, parentheses, and Hangul of their own, so
// these fixtures keep the shapes that a naive split on ": " or "(" would get wrong.
const CATALOG = [
  "### Available skills",
  "- game-design-studio:define-game-vision: Use when a team needs a vision (draft or final) for a game. (file: r3/define-game-vision/SKILL.md)",
  "- game-design-career:game-design-career: Use when 요청이 넓거나 모호할 때: 경력 사례 ID를 포함한다. (file: r2/game-design-career/SKILL.md)",
  "- imagegen: Generate or edit raster images when the task benefits (file: r1/imagegen/SKILL.md)",
  "not a catalog line at all",
].join("\n");

test("the catalog parser keeps descriptions that carry colons, parentheses, and Hangul", () => {
  const catalog = parseSkillCatalog(CATALOG);
  assert.deepEqual([...catalog.keys()], ["game-design-studio:define-game-vision", "game-design-career:game-design-career"]);
  assert.equal(catalog.get("game-design-studio:define-game-vision").description, "Use when a team needs a vision (draft or final) for a game.");
  assert.equal(catalog.get("game-design-career:game-design-career").description, "Use when 요청이 넓거나 모호할 때: 경력 사례 ID를 포함한다.");
  assert.equal(catalog.get("game-design-studio:define-game-vision").file, "r3/define-game-vision/SKILL.md");
});

// An id listed twice would make every later measurement ambiguous about which entry it described, and
// silently keeping the last one reports a clean catalog for a broken install.
test("the catalog parser refuses a duplicate skill id rather than picking one", () => {
  const line = "- game-design-studio:x: one (file: r3/x/SKILL.md)";
  assert.throws(() => parseSkillCatalog(`${line}\n${line}`), /lists game-design-studio:x twice/u);
});

// The payload arrives as JSON, so the catalog reaches this parser with its newlines still escaped.
test("the catalog parser reads a payload whose newlines are still escaped", () => {
  assert.equal(parseSkillCatalog(JSON.stringify(CATALOG)).size, 2);
});

test("findings separate a skill the catalog never listed from one it cut short", () => {
  const catalog = parseSkillCatalog(CATALOG);
  const sources = new Map([
    ["game-design-studio:define-game-vision", "Use when a team needs a vision (draft or final) for a game. It also covers pillars."],
    ["game-design-career:game-design-career", "Use when 요청이 넓거나 모호할 때: 경력 사례 ID를 포함한다."],
    ["game-design-studio:never-installed", "Use when nothing installed this."],
  ]);
  const findings = catalogFindings({ catalog, sources });
  assert.deepEqual(findings.absent, ["game-design-studio:never-installed"]);
  assert.equal(findings.delivered, 2);
  assert.deepEqual(findings.truncated.map(({ id, lost }) => [id, lost]), [
    ["game-design-studio:define-game-vision", " It also covers pillars."],
  ]);
});

// Routing starts at these. A catalog without one of them is a suite whose documented entry point the
// model was never told about, which no amount of correct SKILL.md text can recover.
test("findings name a missing entry skill even when every other skill arrived", () => {
  const catalog = parseSkillCatalog(CATALOG);
  const findings = catalogFindings({ catalog, sources: new Map() });
  assert.deepEqual(findings.missingRequired, ["game-design-studio", "upgrade-game-design-suite"]);
  assert.ok(!findings.missingRequired.includes("game-design-career"), "the career entry skill is in the fixture catalog");
});

test("the argument parser accepts only the documented flags", () => {
  assert.deepEqual(parseProbeArgs([]), { request: undefined, keepWorkspace: false, withHostSkills: false });
  assert.deepEqual(parseProbeArgs(["--with-host-skills", "--keep"]), { request: undefined, keepWorkspace: true, withHostSkills: true });
  assert.deepEqual(parseProbeArgs(["--request", "케이스 ST-G04"]).request, "케이스 ST-G04");
  assert.throws(() => parseProbeArgs(["--request"]), /--request needs the text/u);
  assert.throws(() => parseProbeArgs(["--model", "x"]), /Usage/u);
});

// Shared skills are projected into the package at build time, so products/*/plugin/skills holds fewer
// skills than a user installs. Reading the source tree would report a clean catalog for every skill that
// only exists in the package.
test("descriptions are read from the packaged tree, which is what a user installs", async () => {
  const sources = await skillDescriptions(repoRoot);
  for (const product of PRODUCTS) {
    for (const name of REQUIRED_SKILLS) {
      if (name === "upgrade-game-design-suite" || name === product) {
        assert.ok(sources.has(`${product}:${name}`), `${product}:${name} has to reach the catalog measurement`);
      }
    }
  }
  // The projected skills are the point: the packaged tree carries strictly more than the source tree.
  assert.ok(sources.size >= 50, `expected the packaged skill set, got ${sources.size}`);
  for (const [id, description] of sources) assert.ok(description.length > 0, `${id} declares an empty description`);
});

// Five SKILL.md files quote their description. Charging those five for their own quote characters
// reported two characters of lost trigger on descriptions the catalog carried in full — a false
// positive precisely on the skills that had nothing wrong with them.
test("a quoted description is measured by its value, not by its YAML punctuation", () => {
  assert.equal(unquoteScalar('"Use when 요청이 \\"인용\\"을 포함한다."'), 'Use when 요청이 "인용"을 포함한다.');
  assert.equal(unquoteScalar("Use when the value is a bare scalar."), "Use when the value is a bare scalar.");
  // A description that merely ends with a quotation mark is not a quoted scalar.
  assert.equal(unquoteScalar('Use when the user says "ship it"'), 'Use when the user says "ship it"');
});

test("no packaged description reaches the measurement still wearing its quotes", async () => {
  const sources = await skillDescriptions(repoRoot);
  for (const [id, description] of sources) {
    assert.ok(!(description.startsWith('"') && description.endsWith('"')), `${id} is measured as a quoted scalar`);
  }
});
