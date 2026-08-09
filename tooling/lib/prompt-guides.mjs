const LEVEL_ORDER = Object.freeze({ beginner: 0, standard: 1, advanced: 2 });
const PRODUCT_ORDER = Object.freeze({ studio: 0, career: 1, suite: 2 });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function orderedEntries(entries) {
  return [...entries].sort((left, right) => (
    (PRODUCT_ORDER[left.product] ?? Number.MAX_SAFE_INTEGER) - (PRODUCT_ORDER[right.product] ?? Number.MAX_SAFE_INTEGER)
    || compareText(left.skill ?? "", right.skill ?? "")
    || (LEVEL_ORDER[left.level] ?? Number.MAX_SAFE_INTEGER) - (LEVEL_ORDER[right.level] ?? Number.MAX_SAFE_INTEGER)
    || compareText(left.id, right.id)
  ));
}

function list(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function textBlock(value) {
  const longestFence = Math.max(0, ...[...value.matchAll(/`+/gu)].map(([fence]) => fence.length));
  const fence = "`".repeat(Math.max(3, longestFence + 1));
  return `${fence}text\n${value}\n${fence}`;
}

function countTextBlocks(markdown) {
  const lines = markdown.split("\n");
  let blocks = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^(?<fence>`{3,})text\s*$/u.exec(lines[index]);
    if (!opening) continue;
    const closing = new RegExp(`^${opening.groups.fence}\\s*$`, "u");
    let cursor = index + 1;
    while (cursor < lines.length && !closing.test(lines[cursor])) cursor += 1;
    if (cursor === lines.length) throw new Error("rendered prompt card has an unterminated matching text fence");
    blocks += 1;
    index = cursor;
  }
  return blocks;
}

function heading(level, value) {
  return `${"#".repeat(level)} ${value}`;
}

function detailLink(entry) {
  if (entry.kind === "use-case" || entry.kind === "recipe") {
    return `../${entry.source_references[0].replace(/^guides\//u, "")}#${entryAnchor(entry)}`;
  }
  const segment = entry.kind === "suite-case" ? `suite/${entry.id.split(":")[1]}` : `${entry.product}/${entry.skill}`;
  return `${segment}.md#${entryAnchor(entry)}`;
}

function entryAnchor(entry) {
  return entry.id.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s+/gu, "-");
}

function indexSection(title, entries, label) {
  return [
    `## ${title}`,
    "",
    ...entries.map((entry) => `- [${label(entry)}](${detailLink(entry)})`),
    "",
  ].join("\n");
}

export function renderPromptCard(entry, { headingLevel = 2 } = {}) {
  if (!entry || typeof entry !== "object") throw new Error("prompt template entry must be an object");
  const section = headingLevel + 1;
  const subSection = section + 1;
  return [
    `<!-- PROMPT-CARD: ${entry.id} -->`,
    heading(headingLevel, entry.id),
    "",
    `**${entry.title}**`,
    "",
    entry.purpose,
    "",
    heading(section, "사용하는 경우"),
    entry.when_to_use,
    "",
    heading(section, "사용하지 않는 경우"),
    entry.when_not_to_use,
    "",
    heading(section, "준비 입력"),
    heading(subSection, "필수 입력"),
    list(entry.required_inputs),
    "",
    heading(subSection, "선택 입력"),
    list(entry.optional_inputs),
    "",
    heading(section, "바꿀 자리표시자"),
    list(entry.placeholders),
    "",
    heading(section, "Codex App 완성 예시"),
    textBlock(entry.app_prompt.example),
    "",
    heading(section, "Codex App 재사용 템플릿"),
    textBlock(entry.app_prompt.template),
    "",
    heading(section, "Codex CLI 완성 예시"),
    textBlock(entry.cli_prompt.example),
    "",
    heading(section, "Codex CLI 재사용 템플릿"),
    textBlock(entry.cli_prompt.template),
    "",
    heading(section, "스킬·전문 역할 흐름"),
    `- 기본 스킬: ${entry.skill}`,
    `- 스킬 흐름: ${entry.skill_chain.join(" → ")}`,
    `- 전문 역할: ${entry.specialist_roles.join(" → ")}`,
    "",
    heading(section, "중간 산출물"),
    list(entry.intermediate_artifacts),
    "",
    heading(section, "예상 결과물"),
    heading(subSection, "최소 결과물"),
    list(entry.minimum_outputs),
    "",
    heading(subSection, "선택 결과물"),
    list(entry.optional_outputs),
    "",
    heading(subSection, "확장 결과물"),
    list(entry.extended_outputs),
    "",
    heading(section, "파일 구조"),
    list(entry.expected_file_tree),
    "",
    heading(section, "읽는 순서"),
    list(entry.read_order),
    "",
    heading(section, "도식 바인딩"),
    `- ID: ${entry.diagram_binding.id}`,
    `- SVG: ${entry.diagram_binding.svg}`,
    `- PNG: ${entry.diagram_binding.png}`,
    `- 대체 텍스트: ${entry.diagram_binding.alt}`,
    "",
    heading(section, "사람 검토"),
    heading(subSection, "승인 경계"),
    entry.human_review_boundary,
    "",
    heading(subSection, "보류 조건"),
    list(entry.hold_conditions),
    "",
    heading(subSection, "안전 경계"),
    entry.safety_boundary,
    "",
    heading(section, "실패와 재개"),
    textBlock(entry.resume_prompt),
  ].join("\n");
}

export function validateRenderedPromptCard(entry, markdown) {
  if (typeof markdown !== "string") throw new Error(`rendered prompt card must be text: ${entry.id}`);
  const required = [
    `<!-- PROMPT-CARD: ${entry.id} -->`,
    `- 스킬 흐름: ${entry.skill_chain.join(" → ")}`,
    "최소 결과물",
    "선택 결과물",
    "확장 결과물",
    entry.human_review_boundary,
    entry.diagram_binding.id,
    entry.diagram_binding.svg,
    entry.diagram_binding.png,
    entry.app_prompt.example,
    entry.app_prompt.template,
    entry.cli_prompt.example,
    entry.cli_prompt.template,
    entry.resume_prompt,
  ];
  for (const fragment of required) {
    if (!markdown.includes(fragment)) throw new Error(`rendered prompt card is missing required contract: ${entry.id}`);
  }
  if (countTextBlocks(markdown) !== 5) {
    throw new Error(`rendered prompt card must have five matching text fences: ${entry.id}`);
  }
  const expectedNamespace = entry.product === "studio" ? "$game-design-studio:" : entry.product === "career" ? "$game-design-career:" : null;
  if (expectedNamespace && (!entry.cli_prompt.example.includes(expectedNamespace) || !entry.cli_prompt.template.includes(expectedNamespace))) {
    throw new Error(`rendered prompt card has an invalid CLI namespace: ${entry.id}`);
  }
  return true;
}

export function renderPromptGuideSummary(entries) {
  const ordered = orderedEntries(entries);
  return [
    "### 재사용 프롬프트 템플릿",
    "",
    ...ordered.map((entry) => `- [${entry.level} — ${entry.title}](../../prompt-templates/${entry.product}/${entry.skill}.md#${entryAnchor(entry)})`),
  ].join("\n");
}

export function renderPromptDetailPage(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("prompt detail page needs entries");
  const first = orderedEntries(entries)[0];
  const cards = orderedEntries(entries).map((entry) => {
    const markdown = renderPromptCard(entry);
    validateRenderedPromptCard(entry, markdown);
    return markdown;
  });
  return [
    `# ${first.product === "studio" ? "Game Design Studio" : first.product === "career" ? "Game Design Career" : "Game Design Plugin Suite"} 프롬프트`,
    "",
    "모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.",
    "",
    ...cards,
    "",
  ].join("\n");
}

export function renderPromptLibrary(catalog) {
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error("prompt catalog must contain an entries array");
  const entries = orderedEntries(catalog.entries);
  const sections = [
    indexSection("사용자 유형", entries, (entry) => `${entry.audiences.join(", ")} — ${entry.id}`),
    indexSection("목표", entries, (entry) => `${entry.intents.join(", ")} — ${entry.id}`),
    indexSection("난이도", entries, (entry) => `${entry.level} — ${entry.id}`),
    indexSection("플러그인", entries, (entry) => `${entry.product} — ${entry.id}`),
    indexSection("스킬", entries, (entry) => `${entry.skill} — ${entry.id}`),
    indexSection("결과 문서 형식", entries, (entry) => `${[...entry.minimum_outputs, ...entry.optional_outputs, ...entry.extended_outputs].join(", ")} — ${entry.id}`),
    indexSection("이미지·도식 필요 여부", entries, (entry) => `${entry.diagram_binding.id} — ${entry.id}`),
    indexSection("사람 검토 유형", entries, (entry) => `${entry.human_review_boundary} — ${entry.id}`),
  ];
  return `${[
    "# 재사용 프롬프트 라이브러리",
    "",
    "이 라이브러리는 검증된 카탈로그에서 결정론적으로 생성됩니다. 아래 탐색 축에서 카드의 목적에 맞는 상세 페이지를 선택하세요. 모르는 정보는 `미정`으로 남기고 승인 경계를 넘지 마세요.",
    "",
    ...sections,
  ].join("\n").trimEnd()}\n`;
}

function assertManagedMarkerPairs(markdown) {
  const openMarkers = [...markdown.matchAll(/<!-- PROMPT-TEMPLATES:(START|END) ([^\s]+) -->/gu)];
  const markerStack = [];
  for (const [, kind, id] of openMarkers) {
    if (kind === "START") {
      markerStack.push(id);
      continue;
    }
    const expected = markerStack.pop();
    if (expected !== id) throw new Error(`mismatched prompt-template marker pair: expected ${expected ?? "START"}, found ${id}`);
  }
  if (markerStack.length > 0) throw new Error(`mismatched prompt-template marker pair: missing END for ${markerStack.at(-1)}`);
}

export function assertManagedSection(markdown, markerId) {
  assertManagedMarkerPairs(markdown);
  const start = `<!-- PROMPT-TEMPLATES:START ${markerId} -->`;
  const end = `<!-- PROMPT-TEMPLATES:END ${markerId} -->`;
  if (markdown.split(start).length !== 2 || markdown.split(end).length !== 2) {
    throw new Error(`expected exactly one prompt-template marker pair: ${markerId}`);
  }
  const startOffset = markdown.indexOf(start);
  const endOffset = markdown.indexOf(end);
  if (endOffset < startOffset) throw new Error(`prompt-template marker pair must be ordered: ${markerId}`);
}

export function replaceManagedSection(markdown, markerId, body) {
  assertManagedSection(markdown, markerId);
  const start = `<!-- PROMPT-TEMPLATES:START ${markerId} -->`;
  const end = `<!-- PROMPT-TEMPLATES:END ${markerId} -->`;
  const startOffset = markdown.indexOf(start);
  const endOffset = markdown.indexOf(end);
  return markdown.slice(0, startOffset + start.length)
    + `\n${body.trim()}\n`
    + markdown.slice(endOffset);
}

export function renderProductPromptProjection(catalog, productId, entries) {
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error("prompt catalog must contain an entries array");
  if (!Array.isArray(entries)) throw new Error("product prompt projection entries must be an array");
  return `${JSON.stringify({ version: 1, product: productId, entries: orderedEntries(entries) }, null, 2)}\n`;
}
