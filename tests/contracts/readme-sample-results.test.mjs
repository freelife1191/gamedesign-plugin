import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readmePath = path.join(repoRoot, "README.md");
const sampleRoot = path.join(repoRoot, "guides/sample-results");
const sampleRootLabel = "guides/sample-results";
const expectedPromptIds = [
  "studio:case:ST-C01", "studio:case:ST-C02", "studio:case:ST-C03", "studio:case:ST-C04", "studio:case:ST-C05", "studio:case:ST-C07", "studio:case:ST-C08",
  "career:case:CA-C01", "career:case:CA-C04", "career:case:CA-C05", "career:case:CA-C06", "career:case:CA-C07", "career:case:CA-C08", "career:case:CA-T01",
  "suite:studio-to-career-handoff:case", "suite:career-proof-project-interview:case", "suite:gdd-image-presentation:case", "suite:resume-failed-derivatives:case",
];

function contractError(code, target) {
  const error = new Error(`${code}: ${target}`);
  error.code = code;
  error.target = target;
  return error;
}

function parseReadmeCards(markdown) {
  const cards = [];
  for (const match of markdown.matchAll(/<details\s+data-prompt-id="([^"]+)">\n([\s\S]*?)<\/details>/gu)) {
    const links = [...match[2].matchAll(/\[Sample 결과 보기\]\(([^)]+)\)/gu)];
    if (links.length !== 1) throw contractError("SAMPLE_README_LINK", match[1]);
    cards.push({ id: match[1], samplePath: links[0][1] });
  }
  assert.deepEqual(cards.map((card) => card.id), expectedPromptIds, "README keeps the exact approved 18 data-prompt-id cards in source order");
  return cards;
}

function parseFrontmatter(markdown, target) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  if (!match) throw contractError("SAMPLE_FRONTMATTER", target);
  const fields = Object.fromEntries(match[1].split("\n").map((line) => {
    const index = line.indexOf(": ");
    if (index === -1) throw contractError("SAMPLE_FRONTMATTER", target);
    return [line.slice(0, index), line.slice(index + 2)];
  }));
  return { body: markdown.slice(match[0].length), fields };
}

function section(markdown, heading, target) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  if (start === -1) throw contractError("SAMPLE_SECTION_MISSING", `${target}:${heading}`);
  const remainder = markdown.slice(start + marker.length);
  const next = remainder.search(/\n## /u);
  return remainder.slice(0, next === -1 ? remainder.length : next).trim();
}

function codeValues(value) {
  return [...value.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function assertValues(value, expected, label) {
  assert.deepEqual(codeValues(value), expected, label);
}

function normalizedExcerpt(value) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function visibleText(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/u, "").replace(/```[\s\S]*?```/gu, "");
}

async function listSampleFiles(root, prefix = "") {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, entry.name);
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink()) throw contractError("SAMPLE_SYMLINK", relativePath);
    if (stat.isDirectory()) output.push(...await listSampleFiles(absolutePath, relativePath));
    else {
      if (!stat.isFile() || !relativePath.endsWith(".md") || relativePath === "README.md") throw contractError("SAMPLE_UNREGISTERED_FILE", relativePath);
      output.push(relativePath);
    }
  }
  return output.sort();
}

function validateSampleDocument({ entry, markdown, relativePath }) {
  const { body, fields } = parseFrontmatter(markdown, relativePath);
  if (!/[가-힣]/u.test(visibleText(markdown))) throw contractError("SAMPLE_CODE_ONLY", relativePath);
  if (/확인(?:된)?\s*(?:사실|증거)[^\n]*(?:\d+명|완료|증명)/u.test(body)) throw contractError("SAMPLE_INVENTED_EVIDENCE", relativePath);
  if (fields.source_prompt_id !== entry.id) throw contractError("SAMPLE_PROMPT_ID_MISMATCH", relativePath);
  if (fields.route !== entry.product || !relativePath.startsWith(`${entry.product}/`)) throw contractError("SAMPLE_ROUTE_MISMATCH", relativePath);
  const request = section(body, "간단 요청 예시", relativePath);
  if (!/[가-힣]/u.test(request) || /\[[^\]]+\]/u.test(request)) throw contractError("SAMPLE_SIMPLE_REQUEST", relativePath);
  assertValues(section(body, "선택된 작업 순서", relativePath), entry.skill_chain, `${relativePath}: skill order`);
  assertValues(section(body, "참여 역할", relativePath), entry.specialist_roles, `${relativePath}: agent roles`);
  const excerpt = section(body, "이 요청으로 받는 결과", relativePath);
  if (!/[가-힣]/u.test(excerpt) || excerpt.length < 40) throw contractError("SAMPLE_EXCERPT", relativePath);
  if (/확인 정보:[^.\n]*(?:\d|[０-９])/u.test(excerpt) && !/(?:입력 ID|evidence ID):\s*`[^`]+`/u.test(excerpt)) throw contractError("SAMPLE_UNSOURCED_QUANTIFIED_FACT", relativePath);
  assertValues(section(body, "산출물", relativePath), entry.minimum_outputs, `${relativePath}: artifact list`);
  assertValues(section(body, "읽는 순서", relativePath), entry.read_order, `${relativePath}: read order`);
  const assumptions = section(body, "보호한 가정", relativePath);
  if (!/허구 데이터|가상의 사례/u.test(assumptions) || !assumptions.includes("확인되지 않은")) throw contractError("SAMPLE_PROTECTED_ASSUMPTION", relativePath);
  const review = section(body, "사람 결정", relativePath);
  if (!review.includes(entry.human_review_boundary) || !/- 결정 상태:\s*(?:pending|blocked)/u.test(review) || !/- 가능한 행동: 승인·수정·보류/u.test(review) || !review.includes("결과 보장 없음") || /자동 승인(?:됨|한다|완료)|결정 상태:\s*approved/u.test(review)) throw contractError("SAMPLE_HUMAN_DECISION_BOUNDARY", relativePath);
  if (body.includes("## 이미지 계보와 검토 상태\n")) {
    const image = section(body, "이미지 계보와 검토 상태", relativePath);
    if (!/`asset_id`:\s*`[a-z][a-z0-9-]*`/u.test(image) || !/`derivative_of`:\s*`[a-z][a-z0-9-]*`/u.test(image) || !/`approval_state`:\s*`(?:concept-draft|document-approved|production-candidate)`/u.test(image) || !/`review_decision`:\s*`(?:pending|blocked)`/u.test(image)) throw contractError("SAMPLE_IMAGE_LINEAGE", relativePath);
  }
  return { id: fields.source_prompt_id, excerpt: normalizedExcerpt(excerpt) };
}

async function validateSampleResults({ catalog, markdown, root }) {
  const cards = parseReadmeCards(markdown);
  const expectedById = new Map(expectedPromptIds.map((id) => {
    const entry = catalog.byId.get(id);
    if (!entry) throw contractError("SAMPLE_CATALOG_ENTRY_MISSING", id);
    return [id, entry];
  }));
  const files = await listSampleFiles(root);
  if (files.length !== expectedPromptIds.length) throw contractError(files.length > expectedPromptIds.length ? "SAMPLE_EXTRA_FILE" : "SAMPLE_FILE_COUNT", sampleRootLabel);
  const linked = new Set();
  for (const card of cards) {
    if (!card.samplePath.startsWith("guides/sample-results/")) throw contractError("SAMPLE_README_LINK", card.id);
    const relativePath = card.samplePath.slice("guides/sample-results/".length);
    if (!files.includes(relativePath)) throw contractError("SAMPLE_LINK_TARGET_MISSING", card.id);
    linked.add(relativePath);
  }
  if (linked.size !== expectedPromptIds.length) throw contractError("SAMPLE_DUPLICATE_LINK", "README");
  const seen = new Map();
  const excerpts = new Map();
  for (const relativePath of files) {
    const markdownFile = await readFile(path.join(root, relativePath), "utf8");
    const { fields } = parseFrontmatter(markdownFile, relativePath);
    const entry = expectedById.get(fields.source_prompt_id);
    if (!entry) throw contractError("SAMPLE_PROMPT_ID_MISMATCH", relativePath);
    if (seen.has(entry.id)) throw contractError("SAMPLE_DUPLICATE_PROMPT_ID", relativePath);
    seen.set(entry.id, relativePath);
    const result = validateSampleDocument({ entry, markdown: markdownFile, relativePath });
    if (excerpts.has(result.excerpt)) throw contractError("SAMPLE_DUPLICATE_EXCERPT", relativePath);
    excerpts.set(result.excerpt, relativePath);
  }
  for (const id of expectedPromptIds) if (!seen.has(id)) throw contractError("SAMPLE_MISSING_ID", id);
  return { count: files.length, ids: expectedPromptIds };
}

function fixturePath(entry, index) {
  return `${entry.product}/${String(index + 1).padStart(2, "0")}.md`;
}

function sampleMarkdown(entry) {
  const list = (values) => values.map((value) => `- \`${value}\``).join("\n");
  return [
    "---", `source_prompt_id: ${entry.id}`, `route: ${entry.product}`, "---", `# ${entry.id} 예시 결과`, "",
    "## 간단 요청 예시", entry.app_prompt.example, "", "## 선택된 작업 순서", list(entry.skill_chain), "", "## 참여 역할", list(entry.specialist_roles), "",
    "## 이 요청으로 받는 결과", `이 예시는 ${entry.purpose}라는 가상의 상황에서, 확인한 입력과 미정 항목을 분리해 다음 사람이 검토할 수 있는 문장으로 정리한 일부입니다.`, "",
    "## 산출물", list(entry.minimum_outputs), "", "## 읽는 순서", list(entry.read_order), "", "## 보호한 가정", "가상의 사례이며 허구 데이터만 사용합니다.", "확인되지 않은 내용은 사실처럼 채우지 않고 미정으로 남깁니다.", "",
    "## 사람 결정", entry.human_review_boundary, "- 결정 상태: pending", "- 가능한 행동: 승인·수정·보류", "결과 보장 없음: 사람의 승인·보류 결정 전에는 결과를 확정하지 않습니다.", "",
  ].join("\n");
}

async function productionCatalog() {
  const index = JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog.json"), "utf8"));
  const entries = (await Promise.all(index.sources.map(async (source) => JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates", source), "utf8"))))).flat();
  return { byId: new Map(entries.map((entry) => [entry.id, entry])) };
}

async function createValidFixture(t, catalog) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "readme-sample-results-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const root = path.join(temporaryRoot, "guides/sample-results");
  const cards = [];
  for (const [index, id] of expectedPromptIds.entries()) {
    const entry = catalog.byId.get(id);
    const relativePath = fixturePath(entry, index);
    await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
    await writeFile(path.join(root, relativePath), sampleMarkdown(entry));
    cards.push(`<details data-prompt-id="${entry.id}">\n[Sample 결과 보기](guides/sample-results/${relativePath})\n</details>`);
  }
  return { markdown: cards.join("\n"), root };
}

async function assertMutationRejected(t, mutate, expected) {
  const catalog = await productionCatalog();
  const fixture = await createValidFixture(t, catalog);
  await mutate(fixture, catalog);
  await assert.rejects(validateSampleResults({ catalog, markdown: fixture.markdown, root: fixture.root }), (error) => {
    assert.deepEqual({ code: error.code, target: error.target }, expected);
    return true;
  });
}

test("README's exact 18 source cards each link to one production-catalog-bound sample result", async () => {
  const [catalog, markdown] = await Promise.all([productionCatalog(), readFile(readmePath, "utf8")]);
  assert.deepEqual(await validateSampleResults({ catalog, markdown, root: sampleRoot }), { count: 18, ids: expectedPromptIds });
});
test("sample results reject an unregistered extra Markdown file", async (t) => {
  await assertMutationRejected(t, ({ root }) => writeFile(path.join(root, "studio/extra.md"), "# extra\n"), { code: "SAMPLE_EXTRA_FILE", target: "guides/sample-results" });
});
test("sample results reject one missing source-bound prompt ID", async (t) => {
  await assertMutationRejected(t, ({ root }, catalog) => rm(path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0))), { code: "SAMPLE_FILE_COUNT", target: "guides/sample-results" });
});
test("sample results reject duplicate source prompt IDs", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => {
    const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C02"), 1));
    await writeFile(target, (await readFile(target, "utf8")).replace("studio:case:ST-C02", "studio:case:ST-C01"));
  }, { code: "SAMPLE_DUPLICATE_PROMPT_ID", target: "studio/02.md" });
});
test("sample results reject a prompt document in the wrong route", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => { const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)); await writeFile(target, (await readFile(target, "utf8")).replace("route: studio", "route: career")); }, { code: "SAMPLE_ROUTE_MISMATCH", target: "studio/01.md" });
});
test("sample results reject an altered catalog human decision boundary", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => { const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)); await writeFile(target, (await readFile(target, "utf8")).replace(catalog.byId.get("studio:case:ST-C01").human_review_boundary, "다른 담당자가 자동으로 승인합니다.")); }, { code: "SAMPLE_HUMAN_DECISION_BOUNDARY", target: "studio/01.md" });
});
test("sample results reject automatic human approval", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => { const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)); await writeFile(target, (await readFile(target, "utf8")).replace("결정 상태: pending", "결정 상태: approved\n자동 승인됨")); }, { code: "SAMPLE_HUMAN_DECISION_BOUNDARY", target: "studio/01.md" });
});
test("sample results reject invented evidence in a concrete excerpt", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => { const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)); await writeFile(target, `${await readFile(target, "utf8")}\n확인된 증거: 120명이 완료했다.\n`); }, { code: "SAMPLE_INVENTED_EVIDENCE", target: "studio/01.md" });
});
test("sample results reject an unsourced quantified confirmation", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => { const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)); await writeFile(target, (await readFile(target, "utf8")).replace("이 예시는", "확인 정보: 120명 중 87%가 완료했다. 이 예시는")); }, { code: "SAMPLE_UNSOURCED_QUANTIFIED_FACT", target: "studio/01.md" });
});
test("sample results reject a normalized result excerpt copied from another sample", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => {
    const source = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0));
    const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C02"), 1));
    const copied = section((await readFile(source, "utf8")).split("---\n").slice(2).join("---\n"), "이 요청으로 받는 결과", "source");
    await writeFile(target, (await readFile(target, "utf8")).replace(/(## 이 요청으로 받는 결과\n)[\s\S]*?(?=\n## )/u, `$1${copied}`));
  }, { code: "SAMPLE_DUPLICATE_EXCERPT", target: "studio/02.md" });
});
test("sample results reject a code-only document without a visible Korean sample", async (t) => {
  await assertMutationRejected(t, ({ root }, catalog) => writeFile(path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0)), ["---", "source_prompt_id: studio:case:ST-C01", "route: studio", "---", "", "```json", "{\"sample\":true}", "```", ""].join("\n")), { code: "SAMPLE_CODE_ONLY", target: "studio/01.md" });
});
test("sample results allow schema-bound image lineage only with a separate pending human decision", async (t) => {
  const catalog = await productionCatalog();
  const fixture = await createValidFixture(t, catalog);
  const target = path.join(fixture.root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0));
  await writeFile(target, `${await readFile(target, "utf8")}\n## 이미지 계보와 검토 상태\n- \`asset_id\`: \`st-c01-flow\`\n- \`derivative_of\`: \`st-c01-master\`\n- \`approval_state\`: \`concept-draft\`\n- \`review_decision\`: \`pending\`\n`);
  assert.deepEqual(await validateSampleResults({ catalog, markdown: fixture.markdown, root: fixture.root }), { count: 18, ids: expectedPromptIds });
});
test("sample results reject a non-schema image approval state", async (t) => {
  await assertMutationRejected(t, async ({ root }, catalog) => {
    const target = path.join(root, fixturePath(catalog.byId.get("studio:case:ST-C01"), 0));
    await writeFile(target, `${await readFile(target, "utf8")}\n## 이미지 계보와 검토 상태\n- \`asset_id\`: \`st-c01-flow\`\n- \`derivative_of\`: \`st-c01-master\`\n- \`approval_state\`: \`pending\`\n- \`review_decision\`: \`pending\`\n`);
  }, { code: "SAMPLE_IMAGE_LINEAGE", target: "studio/01.md" });
});
