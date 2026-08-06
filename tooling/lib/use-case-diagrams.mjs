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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
  const lines = [];
  let line = "";
  for (const character of characters) {
    if (line.length >= maxLength) {
      lines.push(line);
      line = character.trimStart();
    } else {
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function layoutFor(type, count) {
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
  }
  for (const field of ["source_paths", "used_by"]) {
    if (!Array.isArray(source[field]) || source[field].length === 0 || source[field].some((value) => !isNonemptyString(value))) {
      throw new TypeError(`diagram source ${field} must contain nonempty paths`);
    }
  }
}

export function renderDiagramSvg(source) {
  validateDiagramSource(source);
  const cards = layoutFor(source.type, source.steps.length);
  const cardMarkup = source.steps.map((step, index) => {
    const card = cards[index];
    const colors = cardColor(index);
    const titleLines = splitLines(step.label);
    const detailLines = splitLines(step.detail, 11);
    return [
      `  <g aria-label="읽기 순서 ${index + 1}: ${escapeXml(step.label)}">`,
      `    <rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="18" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`,
      `    <rect x="${card.x + 28}" y="${card.y + 28}" width="52" height="32" rx="16" fill="${colors.stroke}"/>`,
      `    <text x="${card.x + 54}" y="${card.y + 50}" text-anchor="middle" fill="#FFFFFF" font-size="18" font-weight="700">${index + 1}</text>`,
      textLines(titleLines, { x: card.x + 28, y: card.y + 96, fill: colors.accent, fontSize: 22, weight: 700 }),
      textLines(detailLines, { x: card.x + 28, y: card.y + 158, fill: "#354152", fontSize: 18 }),
      "  </g>",
    ].join("\n");
  }).join("\n");
  const connectors = cards.slice(0, -1).map((card, index) => {
    const next = cards[index + 1];
    const startX = card.x + card.width + 12;
    const endX = next.x - 12;
    const startY = card.y + card.height / 2;
    const endY = next.y + next.height / 2;
    return `  <path d="M ${startX} ${startY} L ${endX} ${endY}" fill="none" stroke="#5B6675" stroke-width="2" stroke-linecap="round" marker-end="url(#open-arrow)"/>`;
  }).join("\n");

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
    cardMarkup,
    '  <rect x="52" y="704" width="1296" height="132" rx="20" fill="#E8F1FB" stroke="#1F6FB2" stroke-width="2"/>',
    '  <text x="84" y="758" fill="#124267" font-size="18" font-weight="700">다음 경계</text>',
    `  <text x="84" y="798" fill="#1F2733" font-size="24">${escapeXml(source.conclusion)}</text>`,
    '</svg>',
    '',
  ].join("\n");
}
