const SUPPORTED_TYPES = new Set(["learning-path", "design-pipeline", "decision-flow", "skill-flow"]);
const REQUIRED_FIELDS = [
  "id",
  "scope",
  "title",
  "description",
  "alt",
  "type",
  "eyebrow",
  "conclusion",
  "steps",
  "source_paths",
  "used_by",
];
const MAX_CARD_LABEL_LENGTH = 20;
const MAX_CARD_DETAIL_LENGTH = 22;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function characterLength(value) {
  return [...value.trim()].length;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function splitLines(value, maxLength = 10) {
  const characters = [...value.trim()];
  return Array.from(
    { length: Math.ceil(characters.length / maxLength) },
    (_, index) => characters.slice(index * maxLength, (index + 1) * maxLength).join(""),
  );
}

function layoutFor(type, count, source) {
  if (type === "decision-flow" && Array.isArray(source?.branches) && source.branches.length >= 2) {
    return [
      { x: 80, y: 370, width: 200, height: 150 },
      { x: 320, y: 370, width: 200, height: 150 },
      { x: 800, y: 370, width: 200, height: 150 },
      { x: 1040, y: 282, width: 200, height: 160 },
      { x: 1040, y: 465, width: 200, height: 160 },
    ];
  }
  const width = 220;
  const gap = count === 3 ? 120 : count === 4 ? 60 : 35;
  const totalWidth = width * count + gap * (count - 1);
  const firstX = Math.round((1400 - totalWidth) / 2);
  const yOffsets = type === "design-pipeline"
    ? [0, 24, 0, 24, 0]
    : type === "decision-flow"
      ? [0, -42, 42, -42, 0]
      : type === "skill-flow"
        ? [0, 42, 0, 42, 0]
        : Array(count).fill(0);
  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * (width + gap),
    y: 342 + yOffsets[index],
    width,
    height: 216,
  }));
}

function isStudioSource(source) {
  return source.scope === "game-design-studio-use-case" || source.scope === "game-design-studio-skill";
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonemptyString(item))) {
    throw new TypeError(`${label} must contain nonempty strings`);
  }
}

function validateStudioSemanticContract(source) {
  if (!isStudioSource(source)) return;
  if (source.steps.length !== 5) throw new TypeError("Studio diagram source must contain exactly five stages");
  if (!isObject(source.semantic)) throw new TypeError("Studio diagram source semantic must be an object");
  assertStringArray(source.semantic.outputs, "Studio diagram source semantic.outputs");
  const stages = source.steps.map(({ stage }) => stage);
  const expectedStages = source.scope === "game-design-studio-skill"
    ? ["trigger", "필수 입력", "skill-owned work", "output", "next route"]
    : source.type === "design-pipeline"
      ? ["입력", "전문 스킬", "Canonical Artifact", "검토", "출력"]
      : ["제약", "선택지", "판단 기준", "결정", "검증"];
  if (stages.some((stage) => !isNonemptyString(stage)) || stages.join("\u0000") !== expectedStages.join("\u0000")) {
    throw new TypeError(`Studio diagram source stages must be: ${expectedStages.join(" → ")}`);
  }
  if (source.scope === "game-design-studio-skill") {
    if (!isNonemptyString(source.semantic.skill)) throw new TypeError("Studio skill semantic.skill must be a nonempty string");
    if (!isNonemptyString(source.semantic.required_input)) throw new TypeError("Studio skill semantic.required_input must be a nonempty string");
    if (!Array.isArray(source.semantic.next_routes) || source.semantic.next_routes.some((route) => !isNonemptyString(route))) {
      throw new TypeError("Studio skill semantic.next_routes must be an array of strings");
    }
    if (source.semantic.next_routes.length === 0 && !isNonemptyString(source.semantic.next_condition)) {
      throw new TypeError("Studio skill semantic needs a next route or conditional route");
    }
    return;
  }
  if (!isNonemptyString(source.semantic.specialist)) throw new TypeError("Studio case semantic.specialist must be a nonempty string");
  if (source.type === "design-pipeline") {
    if (!isObject(source.semantic.review) || !isNonemptyString(source.semantic.review.skill) || !isNonemptyString(source.semantic.review.condition)) {
      throw new TypeError("Studio competency semantic.review must contain skill and condition");
    }
    return;
  }
  if (!isNonemptyString(source.semantic.validation)) throw new TypeError("Studio concept semantic.validation must be a nonempty string");
  if (!Array.isArray(source.branches) || source.branches.length < 2) throw new TypeError("Studio decision-flow must contain at least two branches");
  for (const [index, branch] of source.branches.entries()) {
    if (!isObject(branch) || !isNonemptyString(branch.label) || !isNonemptyString(branch.detail)) {
      throw new TypeError(`Studio decision branch ${index} must have label and detail`);
    }
  }
}

function cardColor(index) {
  return [
    { fill: "#E8F1FB", stroke: "#1F6FB2", accent: "#124267" },
    { fill: "#ECEBFB", stroke: "#534AB7", accent: "#3C3489" },
    { fill: "#E7F5EF", stroke: "#0F7A5F", accent: "#085041" },
    { fill: "#FFF3DF", stroke: "#A75B00", accent: "#814600" },
    { fill: "#FCECF3", stroke: "#A52B5D", accent: "#7A1942" },
  ][index];
}

function textLines(lines, { x, y, fill, fontSize, weight = 400 }) {
  return lines.map((line, index) => `      <text x="${x}" y="${y + index * (fontSize + 8)}" fill="${fill}" font-size="${fontSize}" font-weight="${weight}">${escapeXml(line)}</text>`).join("\n");
}

function exactTextLines(values, { x, y, fill }) {
  return values.map((value, index) => {
    const length = characterLength(value);
    const fontSize = length > 36 ? 7 : length > 28 ? 8 : 10;
    return `      <text x="${x}" y="${y + index * 16}" fill="${fill}" font-size="${fontSize}" textLength="164" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text>`;
  }).join("\n");
}

function visibleStep(source, step, index) {
  if (!isStudioSource(source)) return step;
  if (source.type === "design-pipeline") {
    if (index === 1) return { ...step, exact: [source.semantic.specialist] };
    if (index === 2) return { ...step, exact: source.semantic.outputs };
    if (index === 3) return { ...step, exact: [source.semantic.review.skill] };
    return step;
  }
  if (source.type === "decision-flow") {
    if (index === 1) return { ...step, label: source.branches[0].label, detail: source.branches[1].label };
    if (index === 4) return { ...step, label: "검증", exact: [source.semantic.validation] };
    return step;
  }
  if (index === 1) return { ...step, label: "입력 계약", exact: [source.semantic.required_input] };
  if (index === 2) return { ...step, exact: [source.semantic.skill] };
  if (index === 3) return { ...step, exact: source.semantic.outputs };
  if (index === 4) return { ...step, label: "다음 route", exact: source.semantic.next_routes.length ? [source.semantic.next_routes[0]] : [source.semantic.next_condition] };
  return step;
}

function semanticRailLines(source) {
  if (!isStudioSource(source)) return [];
  if (source.type === "design-pipeline") {
    return [`specialist: ${source.semantic.specialist}`, `outputs: ${source.semantic.outputs.join(" · ")}`, `review: ${source.semantic.review.skill}`];
  }
  if (source.type === "decision-flow") {
    return [`specialist: ${source.semantic.specialist}`, `outputs: ${source.semantic.outputs.join(" · ")}`, `validation: ${source.semantic.validation}`];
  }
  const routes = source.semantic.next_routes.length ? source.semantic.next_routes : [source.semantic.next_condition];
  const lines = [`skill: ${source.semantic.skill}`, `outputs: ${source.semantic.outputs.join(" · ")}`];
  let current = "next: ";
  for (const route of routes) {
    if (current.length > 6 && current.length + route.length + 3 > 150) {
      lines.push(current);
      current = "next: ";
    }
    current += current === "next: " ? route : ` · ${route}`;
  }
  lines.push(current);
  return lines;
}

export function validateDiagramSource(source) {
  if (!isObject(source)) throw new TypeError("diagram source must be an object");
  for (const field of REQUIRED_FIELDS) {
    if (!(field in source)) throw new TypeError(`diagram source is missing ${field}`);
  }
  for (const field of REQUIRED_FIELDS.filter((field) => !["steps", "source_paths", "used_by"].includes(field))) {
    if (!isNonemptyString(source[field])) throw new TypeError(`diagram source ${field} must be a nonempty string`);
  }
  if (!SUPPORTED_TYPES.has(source.type)) throw new TypeError(`diagram source type is unsupported: ${source.type}`);
  if (!Array.isArray(source.steps) || source.steps.length < 3 || source.steps.length > 5) {
    throw new TypeError("diagram source steps must contain three to five entries");
  }
  for (const [index, step] of source.steps.entries()) {
    if (!isObject(step) || !isNonemptyString(step.label) || !isNonemptyString(step.detail)) {
      throw new TypeError(`diagram source steps[${index}] must have nonempty label and detail`);
    }
    if (characterLength(step.label) > MAX_CARD_LABEL_LENGTH) {
      throw new TypeError(`diagram source steps[${index}].label length exceeds the card fit limit`);
    }
    if (characterLength(step.detail) > MAX_CARD_DETAIL_LENGTH) {
      throw new TypeError(`diagram source steps[${index}].detail length exceeds the card fit limit`);
    }
  }
  for (const field of ["source_paths", "used_by"]) {
    if (!Array.isArray(source[field]) || source[field].length === 0 || source[field].some((value) => !isNonemptyString(value))) {
      throw new TypeError(`diagram source ${field} must contain nonempty paths`);
    }
  }
  validateStudioSemanticContract(source);
}

export function renderDiagramSvg(source) {
  validateDiagramSource(source);
  const cards = layoutFor(source.type, source.steps.length, source);
  const isBranchedDecision = source.type === "decision-flow" && Array.isArray(source.branches) && source.branches.length >= 2;
  const cardMarkup = source.steps.map((rawStep, index) => {
    const step = visibleStep(source, rawStep, index);
    const card = cards[index];
    const colors = cardColor(index);
    const titleLines = splitLines(step.label);
    const detailLines = splitLines(step.detail, 11);
    const compact = card.height <= 160;
    const titleY = card.y + (compact ? 80 : 96);
    const detailY = card.y + (compact ? 118 : 158);
    const titleFontSize = compact ? 17 : 22;
    const detailFontSize = compact ? 13 : 18;
    const stageMarkup = isStudioSource(source)
      ? `    <text x="${card.x + 88}" y="${card.y + 50}" fill="${colors.accent}" font-size="14" font-weight="700">${escapeXml(step.stage)}</text>`
      : "";
    return [
      `  <g aria-label="읽기 순서 ${index + 1}: ${escapeXml(step.label)}">`,
      `    <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="18" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`,
      `    <rect x="${card.x + 28}" y="${card.y + 28}" width="52" height="32" rx="16" fill="${colors.stroke}"/>`,
      `    <text x="${card.x + 54}" y="${card.y + 50}" text-anchor="middle" fill="#FFFFFF" font-size="18" font-weight="700">${index + 1}</text>`,
      stageMarkup,
      textLines(titleLines, { x: card.x + 28, y: titleY, fill: colors.accent, fontSize: titleFontSize, weight: 700 }),
      step.exact
        ? exactTextLines(step.exact, { x: card.x + 28, y: detailY, fill: "#354152" })
        : textLines(detailLines, { x: card.x + 28, y: detailY, fill: "#354152", fontSize: detailFontSize }),
      "  </g>",
    ].filter(Boolean).join("\n");
  }).join("\n");
  const connectorPairs = isBranchedDecision ? [[0, 1], [2, 3], [3, 4]] : cards.slice(0, -1).map((_, index) => [index, index + 1]);
  const connectors = connectorPairs.map(([index, nextIndex]) => {
    const card = cards[index];
    const next = cards[nextIndex];
    const vertical = isBranchedDecision && card.x === next.x && card.y + card.height <= next.y;
    const startX = vertical ? card.x + card.width / 2 : card.x + card.width + 12;
    const endX = vertical ? next.x + next.width / 2 : next.x - 12;
    const startY = vertical ? card.y + card.height : card.y + card.height / 2;
    const endY = vertical ? next.y - 12 : next.y + next.height / 2;
    return `  <path d="M ${startX} ${startY} L ${endX} ${endY}" fill="none" stroke="#5B6675" stroke-width="2" stroke-linecap="round" marker-end="url(#open-arrow)"/>`;
  }).join("\n");
  const decisionBranches = isBranchedDecision ? source.branches.slice(0, 2).map((branch, index) => {
    const y = index === 0 ? 298 : 505;
    const branchCenterY = y + 30;
    const sourceCard = cards[1];
    const targetCard = cards[2];
    return [
      `  <path class="decision-branch" d="M ${sourceCard.x + sourceCard.width + 12} ${sourceCard.y + sourceCard.height / 2} L 548 ${branchCenterY}" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" marker-end="url(#open-arrow)"/>`,
      `  <g class="decision-branch" aria-label="선택지 ${index + 1}: ${escapeXml(branch.label)}">`,
      `    <rect x="560" y="${y}" width="180" height="60" rx="14" fill="#F8F6FF" stroke="#534AB7" stroke-width="2"/>`,
      `    <text x="574" y="${y + 25}" fill="#3C3489" font-size="15" font-weight="700">${escapeXml(branch.label)}</text>`,
      `    <text x="574" y="${y + 46}" fill="#354152" font-size="13">${escapeXml(branch.detail)}</text>`,
      "  </g>",
      `  <path class="decision-branch" d="M 752 ${branchCenterY} L ${targetCard.x - 12} ${targetCard.y + targetCard.height / 2}" fill="none" stroke="#0F7A5F" stroke-width="2" stroke-linecap="round" marker-end="url(#open-arrow)"/>`,
    ].join("\n");
  }).join("\n") + `\n  <text x="800" y="354" fill="#0F7A5F" font-size="14" font-weight="700">재결합: 판단 기준</text>` : "";
  const railLines = semanticRailLines(source);
  const semanticRail = railLines.length ? [
    '  <rect x="52" y="636" width="1296" height="60" rx="14" fill="#F2F6FB" stroke="#C9D8E8" stroke-width="1"/>',
    ...railLines.map((line, index) => `  <text x="72" y="${650 + index * 12}" fill="#354152" font-size="9">${escapeXml(line)}</text>`),
  ].join("\n") : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" width="1400" height="900" role="img" aria-label="${escapeXml(source.alt)}">`,
    `  <title>${escapeXml(source.title)}</title>`,
    `  <desc>${escapeXml(source.alt)}</desc>`,
    '  <defs>',
    '    <marker id="open-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">',
    '      <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke="#5B6675" stroke-width="2" stroke-linecap="round"/>',
    '    </marker>',
    '  </defs>',
    '  <rect width="1400" height="900" fill="#F7FAFD"/>',
    '  <rect x="52" y="52" width="8" height="138" rx="4" fill="#1F6FB2"/>',
    `  <text x="88" y="86" fill="#1F6FB2" font-size="18" font-weight="700">${escapeXml(source.eyebrow)}</text>`,
    `  <text x="88" y="148" fill="#1F2733" font-size="54" font-weight="700">${escapeXml(source.title)}</text>`,
    `  <text x="88" y="192" fill="#5B6675" font-size="24">${escapeXml(source.description)}</text>`,
    '  <rect x="52" y="274" width="1296" height="356" rx="28" fill="#FFFFFF" stroke="#D6E0EC" stroke-width="2"/>',
    connectors,
    decisionBranches,
    cardMarkup,
    semanticRail,
    '  <rect x="52" y="704" width="1296" height="132" rx="20" fill="#E8F1FB" stroke="#1F6FB2" stroke-width="2"/>',
    '  <text x="84" y="758" fill="#124267" font-size="18" font-weight="700">다음 경계</text>',
    `  <text x="84" y="798" fill="#1F2733" font-size="24">${escapeXml(source.conclusion)}</text>`,
    '</svg>',
    '',
  ].filter(Boolean).join("\n") + "\n";
}
