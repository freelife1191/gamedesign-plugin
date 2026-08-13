import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  isCompletePng,
  parseViewBox,
  pngDims,
} from "../../shared/vendor/skillstead/svg-infographic/0.9.0/scripts/render.mjs";

export const PRODUCT_IDS = Object.freeze([
  "game-design-career",
  "game-design-studio",
]);
export const SOURCE_BOUND_MEMORY_SKILL_IDS = Object.freeze([
  "capture-game-design-memory",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
]);

const REQUIRED_CONFIGURATION_VALUES = [
  "prompt-only",
  "select",
  "required",
  "all",
  "gpt-image-2",
  "low",
];

function compareIds(left, right) {
  return left.localeCompare(right, "en");
}

async function assertRegularFile(filename) {
  const entry = await lstat(filename);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`expected regular file: ${filename}`);
  }
}

async function directoryIds(root, marker) {
  const entries = await readdir(root, { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const markerPath = path.join(root, entry.name, marker);
    try {
      await assertRegularFile(markerPath);
      ids.push(entry.name);
    } catch (error) {
      if (error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  return ids.sort(compareIds);
}

export async function collectProductInventory(repoRoot, productId) {
  if (!PRODUCT_IDS.includes(productId)) throw new Error("unknown product: " + productId);
  const productRoot = path.join(repoRoot, "products", productId, "plugin");
  const productSkills = await directoryIds(path.join(productRoot, "skills"), "SKILL.md");
  const vendorSkill = path.join(
    repoRoot,
    "shared/vendor/skillstead/svg-infographic/0.9.0/SKILL.md",
  );
  const sharedSkills = [
    ["svg-infographic", vendorSkill],
    ["archify", path.join(repoRoot, "shared/vendor/archify/archify/2.13.0/SKILL.md")],
    ["humanize-korean", path.join(repoRoot, "shared/vendor/im-not-ai/humanize-korean/v2.3.0/SKILL.md")],
    ...SOURCE_BOUND_MEMORY_SKILL_IDS.map((id) => [id, path.join(repoRoot, "shared/memory/skills", id, "SKILL.md")]),
  ];
  for (const [, skillPath] of sharedSkills) await assertRegularFile(skillPath);
  const templateIds = await directoryIds(path.join(productRoot, "assets/templates"), "content.md");
  return {
    skillIds: [...productSkills, ...sharedSkills.map(([id]) => id)].sort(compareIds),
    templateIds: templateIds.sort(compareIds),
  };
}

function githubAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
    .replace(/\s+/g, "-");
}

function escaped(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function inlineCodeSpan(source, start) {
  let length = 1;
  while (source[start + length] === "`") length += 1;
  for (let cursor = start + length; cursor < source.length;) {
    if (source[cursor] === "\0") return undefined;
    if (source[cursor] !== "`" || escaped(source, cursor)) {
      cursor += 1;
      continue;
    }
    let closingLength = 1;
    while (source[cursor + closingLength] === "`") closingLength += 1;
    if (closingLength === length) return { end: cursor + closingLength };
    cursor += closingLength;
  }
  return undefined;
}

function fenceOpener(line) {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/u.exec(line);
  if (!match) return undefined;
  const run = match[2];
  if (run[0] === "`" && match[3].includes("`")) return undefined;
  return { character: run[0], length: run.length };
}

function closesFence(line, fence) {
  return new RegExp(`^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`, "u").test(line);
}

function indentedCode(line) {
  return /^(?: {4}| {0,3}\t)/u.test(line);
}

function setextUnderline(line) {
  return /^(?: {0,3})(=+|-+)[ \t]*$/u.exec(line);
}

function thematicBreak(line) {
  return /^(?: {0,3})(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/u.test(line);
}

function tableDelimiter(line) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = trimmed.replace(/^\|/u, "").replace(/\|$/u, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/u.test(cell));
}

function tableRow(line) {
  return line.includes("|");
}

function htmlBlock(line) {
  return /^ {0,3}(?:<\/?[A-Za-z][A-Za-z\d-]*(?:[ \t][^>]*)?>|<![A-Z]|<\?|<!\[CDATA\[)/iu.test(line);
}

function quotePrefix(source) {
  let cursor = 0;
  let quoteDepth = 0;
  while (true) {
    const match = /^ {0,3}>[ \t]?/u.exec(source.slice(cursor));
    if (!match) break;
    cursor += match[0].length;
    quoteDepth += 1;
  }
  return { length: cursor, depth: quoteDepth };
}

function markdownContainer(source) {
  const quote = quotePrefix(source);
  return {
    contentStart: quote.length,
    quoteDepth: quote.depth,
    listId: undefined,
    scope: quote.depth > 0 ? `quote:${quote.depth}` : "root",
  };
}

function rawHtmlBlockStart(line) {
  const source = line.content;
  const prefix = /^ {0,3}</u.exec(source);
  const opener = prefix ? htmlTagAt(source, prefix[0].length - 1) : undefined;
  if (!opener || opener.closing) return undefined;
  if (["script", "pre", "style", "textarea"].includes(opener.name)) {
    return { tag: opener.name, termination: "tag" };
  }
  if (["div", "details"].includes(opener.name)) return { tag: opener.name, termination: "blank" };
  return undefined;
}

function closesRawHtmlBlock(source, block) {
  return new RegExp(`</${block.tag}[ \t]*>`, "iu").test(source);
}

function initialLineKind(line) {
  if (line.trim() === "") return "blank";
  if (indentedCode(line)) return "indented-code";
  if (fenceOpener(line)) return "fence";
  if (/^(?: {0,3})#{1,6}\s+/u.test(line)) return "atx-heading";
  if (/^ {0,3}>/u.test(line)) return "blockquote";
  if (/^ {0,3}[-+*][ \t]+/u.test(line)) return "unordered-list";
  if (/^ {0,3}\d{1,9}[.)][ \t]+/u.test(line)) return "ordered-list";
  if (/^ {0,3}\[[^\]]+\]:[ \t]*/u.test(line)) return "link-reference";
  if (htmlBlock(line)) return "html-block";
  if (thematicBreak(line)) return "thematic-break";
  return "plain";
}

function structuralLines(markdown) {
  const lines = markdown.split("\n").map((rawLineWithCarriageReturn, index) => {
    const source = rawLineWithCarriageReturn.endsWith("\r")
      ? rawLineWithCarriageReturn.slice(0, -1)
      : rawLineWithCarriageReturn;
    return { line: index + 1, source, container: markdownContainer(source) };
  });

  let activeLists = [];
  for (const line of lines) {
    const source = line.source.slice(line.container.contentStart);
    const list = /^( {0,3})(?:[-+*]|\d{1,9}[.)])[ \t]+/u.exec(source);
    if (list) {
      const outerQuoteDepth = line.container.quoteDepth;
      const indentation = list[1].length;
      activeLists = activeLists.filter((entry) => entry.quoteDepth !== outerQuoteDepth || entry.indentation < indentation);
      line.container.contentStart += list[0].length;
      const nestedQuote = quotePrefix(line.source.slice(line.container.contentStart));
      line.container.contentStart += nestedQuote.length;
      line.container.quoteDepth += nestedQuote.depth;
      const entry = {
        id: `list:${line.line}`,
        quoteDepth: outerQuoteDepth,
        nestedQuoteDepth: nestedQuote.depth,
        indentation,
        contentIndentation: list[0].length,
      };
      entry.scope = [
        outerQuoteDepth > 0 ? `quote:${outerQuoteDepth}` : undefined,
        entry.id,
        nestedQuote.depth > 0 ? `quote:${outerQuoteDepth + nestedQuote.depth}` : undefined,
      ].filter(Boolean).join("/");
      activeLists.push(entry);
      line.container.listId = entry.id;
      line.container.scope = entry.scope;
    } else {
      const indentation = /^ */u.exec(source)[0].length;
      const rawIndentation = /^ */u.exec(line.source)[0].length;
      const entry = [...activeLists].reverse().find((candidate) => {
        const regular = candidate.quoteDepth === line.container.quoteDepth
          && (source.trim() === "" || indentation >= candidate.contentIndentation);
        const nestedQuote = candidate.quoteDepth + candidate.nestedQuoteDepth === line.container.quoteDepth
          && rawIndentation >= candidate.contentIndentation;
        return regular || nestedQuote;
      });
      if (entry) {
        line.container.listId = entry.id;
        const followsNestedQuote = entry.nestedQuoteDepth > 0
          && entry.quoteDepth + entry.nestedQuoteDepth === line.container.quoteDepth
          && rawIndentation >= entry.contentIndentation;
        if (!followsNestedQuote) line.container.contentStart += entry.contentIndentation;
        line.container.scope = entry.scope;
      } else if (source.trim() !== "") {
        activeLists = activeLists.filter((candidate) => candidate.quoteDepth < line.container.quoteDepth);
      }
    }
    if (!line.container.listId) {
      line.container.scope = line.container.quoteDepth > 0 ? `quote:${line.container.quoteDepth}` : "root";
    }
    line.content = line.source.slice(line.container.contentStart);
    line.kind = initialLineKind(line.content);
  }

  for (let index = 1; index < lines.length; index += 1) {
    const underline = setextUnderline(lines[index].content);
    if (underline && lines[index - 1].kind === "plain") {
      lines[index - 1].kind = "setext-heading";
      lines[index].kind = "setext-underline";
    }
  }
  for (let index = 1; index < lines.length; index += 1) {
    if (!tableDelimiter(lines[index].content) || !tableRow(lines[index - 1].content)) continue;
    lines[index - 1].kind = "table";
    lines[index].kind = "table";
    for (let cursor = index + 1; cursor < lines.length && tableRow(lines[cursor].content); cursor += 1) {
      lines[cursor].kind = "table";
    }
  }

  let segment = -1;
  let previousKey;
  for (const line of lines) {
    let key;
    if (line.container.listId) {
      key = line.container.listId;
    } else if (line.kind === "table") {
      key = `table:${line.line}`;
    } else if (line.container.quoteDepth > 0 && line.kind !== "blank") {
      key = `blockquote:${line.container.quoteDepth}`;
    } else if (line.kind === "plain") {
      key = "plain";
    }
    if (!key) {
      previousKey = undefined;
      line.segment = line.kind === "blank" || line.kind === "fence" || line.kind === "indented-code"
        ? undefined
        : ++segment;
      continue;
    }
    if (key !== previousKey) segment += 1;
    line.segment = segment;
    previousKey = key;
  }
  return lines;
}

function inlineCodeRanges(lines) {
  const bySegment = new Map();
  for (const [lineIndex, line] of lines.entries()) {
    if (line.segment === undefined) continue;
    const pieces = bySegment.get(line.segment) ?? [];
    pieces.push({ lineIndex, start: 0, end: line.source.length });
    bySegment.set(line.segment, pieces);
  }
  const ranges = [];
  for (const pieces of bySegment.values()) {
    let source = "";
    const positions = [];
    for (const [pieceIndex, piece] of pieces.entries()) {
      if (pieceIndex > 0) {
        source += "\n";
        positions.push(undefined);
      }
      for (let cursor = piece.start; cursor < piece.end; cursor += 1) {
        source += lines[piece.lineIndex].source[cursor];
        positions.push({ lineIndex: piece.lineIndex, cursor });
        if (lines[piece.lineIndex].kind === "table" && lines[piece.lineIndex].source[cursor] === "|" && !escaped(lines[piece.lineIndex].source, cursor)) {
          source += "\0";
          positions.push(undefined);
        }
      }
    }
    for (let cursor = 0; cursor < source.length;) {
      if (source[cursor] !== "`" || escaped(source, cursor)) {
        cursor += 1;
        continue;
      }
      const runLength = /^`+/u.exec(source.slice(cursor))[0].length;
      const span = inlineCodeSpan(source, cursor);
      if (!span) {
        cursor += runLength;
        continue;
      }
      const range = { positions: positions.slice(cursor, span.end).filter(Boolean) };
      if (range.positions.length > 0) ranges.push(range);
      cursor += runLength;
    }
  }
  return ranges;
}

function maskInlineParagraph(lines, pieces) {
  if (pieces.length === 0) return;
  let paragraph = "";
  const positions = [];
  for (const [pieceIndex, piece] of pieces.entries()) {
    if (pieceIndex > 0) {
      paragraph += "\n";
      positions.push(undefined);
    }
    const block = lines[piece.lineIndex];
    for (let cursor = piece.start; cursor < piece.end; cursor += 1) {
      paragraph += block.source[cursor];
      positions.push({ lineIndex: piece.lineIndex, cursor });
      if (block.kind === "table" && block.source[cursor] === "|" && !escaped(block.source, cursor)) {
        paragraph += "\0";
        positions.push(undefined);
      }
    }
  }
  for (let cursor = 0; cursor < paragraph.length;) {
    if (paragraph[cursor] !== "`" || escaped(paragraph, cursor)) {
      cursor += 1;
      continue;
    }
    const runLength = /^`+/u.exec(paragraph.slice(cursor))[0].length;
    const span = inlineCodeSpan(paragraph, cursor);
    if (!span) {
      cursor += runLength;
      continue;
    }
    for (let hidden = cursor; hidden < span.end; hidden += 1) {
      const position = positions[hidden];
      if (position) lines[position.lineIndex].text[position.cursor] = " ";
    }
    cursor = span.end;
  }
}

export function scanVisibleMarkdown(markdown) {
  const lines = structuralLines(markdown).map((line) => ({
    ...line,
    hidden: Array(line.source.length).fill(false),
    rawHtml: Array(line.source.length).fill(false),
  }));
  const rawRanges = inlineCodeRanges(lines);
  const rangeStartAt = lines.map((line) => Array(line.source.length));
  for (const range of rawRanges) {
    const start = range.positions[0];
    rangeStartAt[start.lineIndex][start.cursor] = range;
  }

  let fence;
  let rawHtml;
  let comment;
  let activeCodeRange;
  let activeSegment;
  for (const [lineIndex, line] of lines.entries()) {
    const hide = (start, end) => line.hidden.fill(true, start, end);
    const markRawHtml = (start, end) => line.rawHtml.fill(true, start, end);
    const source = line.content;
    if (line.segment !== activeSegment) activeCodeRange = undefined;
    activeSegment = line.segment;
    if (fence?.scope !== line.container.scope) fence = undefined;
    if (rawHtml?.scope !== line.container.scope) rawHtml = undefined;
    if (comment?.scope !== line.container.scope) comment = undefined;
    if (fence) {
      activeCodeRange = undefined;
      hide(0, line.source.length);
      if (closesFence(source, fence)) fence = undefined;
      continue;
    }
    if (rawHtml) {
      activeCodeRange = undefined;
      hide(0, line.source.length);
      markRawHtml(0, line.source.length);
      if ((rawHtml.termination === "tag" && closesRawHtmlBlock(source, rawHtml))
        || (rawHtml.termination === "blank" && source.trim() === "")) rawHtml = undefined;
      continue;
    }
    if (!comment && line.kind === "indented-code") {
      activeCodeRange = undefined;
      hide(0, line.source.length);
      continue;
    }
    if (!comment && fenceOpener(source)) {
      activeCodeRange = undefined;
      fence = { ...fenceOpener(source), scope: line.container.scope };
      hide(0, line.source.length);
      continue;
    }
    if (!comment) {
      const html = rawHtmlBlockStart(line);
      if (html) {
        activeCodeRange = undefined;
        hide(0, line.source.length);
        markRawHtml(0, line.source.length);
        if (html.termination === "blank" || !closesRawHtmlBlock(source, html)) rawHtml = { ...html, scope: line.container.scope };
        continue;
      }
    }

    for (let cursor = 0; cursor < line.source.length;) {
      if (comment) {
        const end = line.source.indexOf("-->", cursor);
        if (end === -1) {
          hide(cursor, line.source.length);
          break;
        }
        hide(cursor, end + 3);
        comment = undefined;
        cursor = end + 3;
        continue;
      }
      if (!activeCodeRange) activeCodeRange = rangeStartAt[lineIndex][cursor];
      if (activeCodeRange) {
        const end = activeCodeRange.positions.at(-1);
        if (end.lineIndex === lineIndex && end.cursor === cursor) activeCodeRange = undefined;
        cursor += 1;
        continue;
      }
      if (line.source.startsWith("<!--", cursor) && !escaped(line.source, cursor)) {
        hide(cursor, cursor + 4);
        comment = { scope: line.container.scope };
        cursor += 4;
        continue;
      }
      cursor += 1;
    }
  }

  for (const line of lines) {
    line.blockText = line.source.split("").map((character, cursor) => line.hidden[cursor] ? " " : character).join("");
    line.text = line.blockText.split("");
  }

  const visibleSegments = new Map();
  for (const [lineIndex, line] of lines.entries()) {
    if (line.segment === undefined) continue;
    let start = 0;
    while (start < line.source.length) {
      while (start < line.source.length && line.hidden[start]) start += 1;
      if (start === line.source.length) break;
      let end = start + 1;
      while (end < line.source.length && !line.hidden[end]) end += 1;
      const pieces = visibleSegments.get(line.segment) ?? [];
      const previous = pieces.at(-1);
      const region = previous && previous.lineIndex === lineIndex && previous.end === start
        ? previous.region
        : previous && previous.lineIndex === lineIndex - 1 && start === 0 && previous.end === lines[previous.lineIndex].source.length
          ? previous.region
          : (previous?.region ?? -1) + 1;
      pieces.push({ lineIndex, start, end, region });
      visibleSegments.set(line.segment, pieces);
      start = end + 1;
    }
  }
  for (const pieces of visibleSegments.values()) {
    let region = [];
    let regionId;
    for (const piece of pieces) {
      if (regionId !== undefined && piece.region !== regionId) {
        maskInlineParagraph(lines, region);
        region = [];
      }
      region.push(piece);
      regionId = piece.region;
    }
    maskInlineParagraph(lines, region);
  }

  return lines.map(({ line, text, source, blockText, kind, hidden, rawHtml, container }) => ({
    line,
    text: text.join(""),
    source,
    blockText,
    kind,
    scope: container.scope,
    htmlVisible: hidden.map((masked, cursor) => rawHtml[cursor]
      || (!masked && (source[cursor] === " " || text[cursor] !== " "))),
  }));
}

const RESULT_BOUNDARY_LABELS = [
  ["minimum", /(?:\bminimum\b|최소 결과)/iu],
  ["optional", /(?:\boptional\b|선택 결과)/iu],
  ["expanded", /(?:\bexpanded\b|확장 결과)/iu],
  ["owner", /(?:\bowner\b|승인 주체)/iu],
  ["hold", /(?:\bhold\b|보류 대상)/iu],
  ["resume", /(?:\bresume\b|재개 조건(?:·요청)?)/iu],
  ["safety", /(?:\bsafety\b|안전·증거 경계)/iu],
];

function inlineHtmlEnd(source, start) {
  let quote;
  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === quote && !escaped(source, cursor)) quote = undefined;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return cursor + 1;
  }
  return undefined;
}

function autolinkDestination(raw) {
  return /^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s\u0000-\u001F\u007F<>]+$/u.test(raw)
    || /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/u.test(raw);
}

function renderedBoundaryText(source) {
  let text = "";
  for (let cursor = 0; cursor < source.length;) {
    if (source[cursor] === "`" && !escaped(source, cursor)) {
      const span = inlineCodeSpan(source, cursor);
      if (span) {
        const length = /^`+/u.exec(source.slice(cursor))[0].length;
        text += source.slice(cursor + length, span.end - length);
        cursor = span.end;
        continue;
      }
    }
    if (source[cursor] === "[" && !escaped(source, cursor)) {
      const link = parseLinkAt(source, source, cursor);
      if (link) {
        text += renderedBoundaryText(link.rawLabel);
        cursor = link.end;
        continue;
      }
    }
    if (source[cursor] === "<") {
      const autolinkEnd = source.indexOf(">", cursor + 1);
      if (autolinkEnd !== -1 && autolinkDestination(source.slice(cursor + 1, autolinkEnd))) {
        cursor = autolinkEnd + 1;
        continue;
      }
      const end = inlineHtmlEnd(source, cursor);
      if (end) {
        const raw = source.slice(cursor + 1, end - 1);
        if (autolinkDestination(raw)) {
          cursor = end;
          continue;
        }
        const htmlCandidate = raw.trim();
        if (raw === htmlCandidate && /^\/?[A-Za-z][A-Za-z\d-]*(?:\s|\/|$)/u.test(htmlCandidate)) {
          cursor = end;
          continue;
        }
      }
    }
    if (source[cursor] === "\\" && cursor + 1 < source.length) {
      text += source[cursor + 1];
      cursor += 2;
      continue;
    }
    if ("*_~".includes(source[cursor]) && !escaped(source, cursor)) {
      cursor += 1;
      continue;
    }
    text += source[cursor];
    cursor += 1;
  }
  return text.replace(/(?: {2,}|\\)$/u, "").replace(/\s+/gu, " ").trim();
}

export function assertReadableResultBoundaries(markdown) {
  let paragraph = [];
  const assertParagraph = () => {
    if (paragraph.length === 0) return;
    const rendered = renderedBoundaryText(paragraph.join("\n"));
    const labels = RESULT_BOUNDARY_LABELS
      .filter(([, pattern]) => pattern.test(rendered))
      .map(([label]) => label);
    if (labels.length >= 3) {
      throw new Error(`result-boundary paragraph is too dense: ${labels.join(", ")}`);
    }
    paragraph = [];
  };
  for (const line of scanVisibleMarkdown(markdown)) {
    const rendered = renderedBoundaryText(line.blockText);
    if (line.kind === "plain" && rendered) {
      if (/^ {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+/u.test(line.source)) assertParagraph();
      paragraph.push(line.blockText);
    } else {
      assertParagraph();
    }
  }
  assertParagraph();
}

function unescapeMarkdown(value) {
  let result = "";
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    if (value[cursor] === "\\" && cursor + 1 < value.length) cursor += 1;
    result += value[cursor];
  }
  return result;
}

function renderedLabel(value) {
  let label = "";
  for (let cursor = 0; cursor < value.length;) {
    if (value[cursor] !== "`" || escaped(value, cursor)) {
      label += value[cursor];
      cursor += 1;
      continue;
    }
    const span = inlineCodeSpan(value, cursor);
    if (!span) {
      label += value[cursor];
      cursor += 1;
      continue;
    }
    const length = value.slice(cursor).match(/^`+/u)[0].length;
    label += value.slice(cursor + length, span.end - length);
    cursor = span.end;
  }
  return unescapeMarkdown(label).trim();
}

function normaliseTarget(rawTarget) {
  let hash = -1;
  for (let cursor = 0; cursor < rawTarget.length; cursor += 1) {
    if (rawTarget[cursor] === "#" && !escaped(rawTarget, cursor)) {
      hash = cursor;
      break;
    }
  }
  const filename = unescapeMarkdown(hash === -1 ? rawTarget : rawTarget.slice(0, hash));
  const fragment = hash === -1 ? "" : unescapeMarkdown(rawTarget.slice(hash + 1));
  return { target: hash === -1 ? filename : `${filename}#${fragment}`, fragment };
}

function parseDestination(source, start) {
  let cursor = start;
  while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
  let rawTarget = "";
  if (source[cursor] === "<") {
    const targetStart = ++cursor;
    while (cursor < source.length && (source[cursor] !== ">" || escaped(source, cursor))) cursor += 1;
    if (source[cursor] !== ">") return undefined;
    rawTarget = source.slice(targetStart, cursor);
    cursor += 1;
  } else {
    const targetStart = cursor;
    let parentheses = 0;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === "\\" && cursor + 1 < source.length) {
        cursor += 2;
        continue;
      }
      if (/\s/u.test(character) && parentheses === 0) break;
      if (character === "(") parentheses += 1;
      if (character === ")") {
        if (parentheses === 0) break;
        parentheses -= 1;
      }
      cursor += 1;
    }
    if (parentheses !== 0) return undefined;
    rawTarget = source.slice(targetStart, cursor);
  }
  if (!rawTarget) return undefined;
  while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
  if (source[cursor] !== ")") {
    const opener = source[cursor];
    const closer = opener === "\"" ? "\"" : opener === "'" ? "'" : opener === "(" ? ")" : undefined;
    if (!closer) return undefined;
    cursor += 1;
    let depth = opener === "(" ? 1 : 0;
    while (cursor < source.length) {
      if (source[cursor] === "\\" && cursor + 1 < source.length) {
        cursor += 2;
        continue;
      }
      if (opener !== "(" && source[cursor] === closer) break;
      if (opener === "(" && source[cursor] === "(") depth += 1;
      if (source[cursor] === closer) {
        depth -= 1;
        if (depth === 0) break;
      }
      cursor += 1;
    }
    if (source[cursor] !== closer) return undefined;
    cursor += 1;
    while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
  }
  if (source[cursor] !== ")" || escaped(source, cursor)) return undefined;
  return { end: cursor + 1, rawTarget };
}

function parseLinkAt(source, original, start) {
  if (source[start] !== "[" || escaped(source, start)) return undefined;
  const image = start > 0 && source[start - 1] === "!" && !escaped(source, start - 1);
  let labelEnd = start + 1;
  let bracketDepth = 1;
  while (labelEnd < source.length) {
    if (!escaped(source, labelEnd) && source[labelEnd] === "[") bracketDepth += 1;
    if (!escaped(source, labelEnd) && source[labelEnd] === "]") {
      bracketDepth -= 1;
      if (bracketDepth === 0) break;
    }
    labelEnd += 1;
  }
  if (labelEnd === source.length || source[labelEnd + 1] !== "(" || escaped(source, labelEnd + 1)) return undefined;
  const destination = parseDestination(source, labelEnd + 2);
  if (!destination) return undefined;
  const { target, fragment } = normaliseTarget(destination.rawTarget);
  return {
    end: destination.end,
    image,
    label: renderedLabel(original.slice(start + 1, labelEnd)),
    rawLabel: original.slice(start + 1, labelEnd),
    target,
    fragment,
  };
}

function referenceKey(value) {
  return unescapeMarkdown(value).replace(/\s+/gu, " ").trim().toLowerCase();
}

function parseReferenceDestination(source) {
  let cursor = 0;
  while (/\s/u.test(source[cursor] ?? "")) cursor += 1;
  if (source[cursor] === "<") {
    const start = ++cursor;
    while (cursor < source.length && (source[cursor] !== ">" || escaped(source, cursor))) cursor += 1;
    if (source[cursor] !== ">") return undefined;
    return source.slice(start, cursor);
  }
  const start = cursor;
  while (cursor < source.length && !/\s/u.test(source[cursor])) cursor += 1;
  return cursor === start ? undefined : source.slice(start, cursor);
}

function referenceDefinitions(lines, rendered) {
  const definitions = new Map();
  for (const [lineIndex, { kind, blockText }] of lines.entries()) {
    if (kind !== "link-reference") continue;
    if (!rendered[lineIndex].every(Boolean)) continue;
    const match = /^ {0,3}\[([^\]]+)\]:[ \t]*(.*)$/u.exec(blockText);
    if (!match) continue;
    const target = parseReferenceDestination(match[2]);
    const key = referenceKey(match[1]);
    if (target && key && !definitions.has(key)) definitions.set(key, normaliseTarget(target));
  }
  return definitions;
}

function linkLabelEnd(source, start) {
  let cursor = start + 1;
  let depth = 1;
  while (cursor < source.length) {
    if (!escaped(source, cursor) && source[cursor] === "[") depth += 1;
    if (!escaped(source, cursor) && source[cursor] === "]") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  return undefined;
}

function parseReferenceLinkAt(source, original, start, definitions) {
  if (source[start] !== "[" || escaped(source, start)) return undefined;
  const image = start > 0 && source[start - 1] === "!" && !escaped(source, start - 1);
  const labelEnd = linkLabelEnd(source, start);
  if (labelEnd === undefined || source[labelEnd + 1] === "(") return undefined;
  let end = labelEnd + 1;
  let reference = source.slice(start + 1, labelEnd);
  if (source[end] === "[") {
    const referenceEnd = source.indexOf("]", end + 1);
    if (referenceEnd === -1 || escaped(source, referenceEnd)) return undefined;
    reference = source.slice(end + 1, referenceEnd) || reference;
    end = referenceEnd + 1;
  }
  const destination = definitions.get(referenceKey(reference));
  if (!destination) return undefined;
  return {
    end,
    image,
    label: renderedLabel(original.slice(start + 1, labelEnd)),
    rawLabel: original.slice(start + 1, labelEnd),
    target: destination.target,
    fragment: destination.fragment,
  };
}

function htmlTagAt(source, start) {
  if (source[start] !== "<" || escaped(source, start)) return undefined;
  const end = inlineHtmlEnd(source, start);
  if (!end) return undefined;
  const raw = source.slice(start + 1, end - 1);
  let cursor = 0;
  while (/\s/u.test(raw[cursor] ?? "")) cursor += 1;
  const closing = raw[cursor] === "/";
  if (closing) cursor += 1;
  const nameStart = cursor;
  while (/[A-Za-z\d-]/u.test(raw[cursor] ?? "")) cursor += 1;
  const name = raw.slice(nameStart, cursor).toLowerCase();
  if (!name || (raw[cursor] && !/\s|\//u.test(raw[cursor]))) return undefined;
  const attributes = new Map();
  let selfClosing = false;
  while (cursor < raw.length) {
    while (/\s/u.test(raw[cursor] ?? "")) cursor += 1;
    if (raw[cursor] === "/") {
      selfClosing = true;
      cursor += 1;
      continue;
    }
    const attributeStart = cursor;
    while (/[A-Za-z\d:_-]/u.test(raw[cursor] ?? "")) cursor += 1;
    const attribute = raw.slice(attributeStart, cursor).toLowerCase();
    if (!attribute) return undefined;
    while (/\s/u.test(raw[cursor] ?? "")) cursor += 1;
    let value = "";
    if (raw[cursor] === "=") {
      cursor += 1;
      while (/\s/u.test(raw[cursor] ?? "")) cursor += 1;
      const quote = raw[cursor] === "\"" || raw[cursor] === "'" ? raw[cursor++] : undefined;
      const valueStart = cursor;
      while (cursor < raw.length && (quote ? raw[cursor] !== quote : !/\s/u.test(raw[cursor]))) cursor += 1;
      if (quote && raw[cursor] !== quote) return undefined;
      value = raw.slice(valueStart, cursor);
      if (quote) cursor += 1;
    }
    if (!attributes.has(attribute)) attributes.set(attribute, value);
  }
  return { end, name, closing, selfClosing, attributes };
}

const HTML_VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);
const HTML_INERT_ELEMENTS = new Set(["script", "style", "template", "textarea"]);

function decodedHtmlAttribute(value) {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|apos|gt|lt|quot);/giu, (entity, hexadecimal, decimal) => {
    const numeric = hexadecimal ? Number.parseInt(hexadecimal, 16) : decimal ? Number.parseInt(decimal, 10) : undefined;
    if (numeric !== undefined) return numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
    return ({ "&amp;": "&", "&apos;": "'", "&gt;": ">", "&lt;": "<", "&quot;": "\"" })[entity.toLowerCase()] ?? entity;
  });
}

function hiddenHtmlElement(tag) {
  return HTML_INERT_ELEMENTS.has(tag.name)
    || tag.attributes.has("hidden")
    || tag.attributes.has("inert")
    || decodedHtmlAttribute(tag.attributes.get("aria-hidden") ?? "").trim().toLowerCase() === "true";
}

function joinedHtmlSource(lines) {
  const starts = [];
  const visibility = [];
  let source = "";
  for (const [lineIndex, line] of lines.entries()) {
    starts.push(source.length);
    source += line.source;
    visibility.push(...line.htmlVisible);
    if (lineIndex < lines.length - 1) {
      source += "\n";
      visibility.push(true);
    }
  }
  return { source, starts, visibility };
}

function sourceLineAt(starts, offset) {
  let first = 0;
  let last = starts.length - 1;
  while (first <= last) {
    const middle = Math.floor((first + last) / 2);
    if (starts[middle] <= offset) first = middle + 1;
    else last = middle - 1;
  }
  return Math.max(0, last);
}

function visibleRange(visibility, start, end) {
  for (let cursor = start; cursor < end; cursor += 1) {
    if (!visibility[cursor]) return false;
  }
  return true;
}

function visibleMarkdownLinkRange(visibility, text, start, end) {
  for (let cursor = start; cursor < end; cursor += 1) {
    if (text[cursor] !== " " && !visibility[cursor]) return false;
  }
  return true;
}

function renderedHtmlVisibility(lines) {
  const { source, starts, visibility } = joinedHtmlSource(lines);
  const rendered = Array(source.length).fill(false);
  const ancestry = [];
  let activeScope;
  for (let cursor = 0; cursor < source.length;) {
    const lineIndex = sourceLineAt(starts, cursor);
    if (lines[lineIndex].scope !== activeScope) {
      ancestry.length = 0;
      activeScope = lines[lineIndex].scope;
    }
    const tag = htmlTagAt(source, cursor);
    const visibleBefore = ancestry.every((entry) => !entry.hidden);
    if (tag && visibleRange(visibility, cursor, tag.end)) {
      rendered.fill(visibleBefore, cursor, tag.end);
      if (tag.closing) {
        const index = ancestry.map((entry) => entry.name).lastIndexOf(tag.name);
        if (index !== -1) ancestry.splice(index);
      } else if (!tag.selfClosing && !HTML_VOID_ELEMENTS.has(tag.name)) {
        ancestry.push({ name: tag.name, hidden: hiddenHtmlElement(tag) });
      }
      cursor = tag.end;
      continue;
    }
    if (visibility[cursor] && visibleBefore) rendered[cursor] = true;
    cursor += 1;
  }
  return { source, starts, visibility, rendered, lines };
}

function lineRenderVisibility(lines, state) {
  return lines.map((line, lineIndex) => state.rendered.slice(
    state.starts[lineIndex],
    state.starts[lineIndex] + line.source.length,
  ));
}

function rawHtmlAnchors(state) {
  const links = [];
  const ancestry = [];
  let activeScope;
  for (let cursor = 0; cursor < state.source.length;) {
    const lineIndex = sourceLineAt(state.starts, cursor);
    if (state.lines[lineIndex].scope !== activeScope) {
      ancestry.length = 0;
      activeScope = state.lines[lineIndex].scope;
    }
    const tag = htmlTagAt(state.source, cursor);
    const visibleBefore = ancestry.every((entry) => !entry.hidden);
    if (!tag || !visibleRange(state.visibility, cursor, tag.end)) {
      cursor += 1;
      continue;
    }
    if (tag.closing) {
      const index = ancestry.map((entry) => entry.name).lastIndexOf(tag.name);
      if (index !== -1) ancestry.splice(index);
    } else {
      const hidden = hiddenHtmlElement(tag);
      if (tag.name === "a" && visibleBefore && !hidden) {
        const rawTarget = tag.attributes.get("href");
        if (rawTarget) {
          const { target, fragment } = normaliseTarget(decodedHtmlAttribute(rawTarget).trim());
          links.push({
            label: "",
            target,
            fragment,
            line: lineIndex + 1,
            column: cursor - state.starts[lineIndex],
          });
        }
      }
      if (!tag.selfClosing && !HTML_VOID_ELEMENTS.has(tag.name)) ancestry.push({ name: tag.name, hidden });
    }
    cursor = tag.end;
  }
  return links;
}

export function extractMarkdownLinks(markdown) {
  const links = [];
  const lines = scanVisibleMarkdown(markdown);
  const htmlState = renderedHtmlVisibility(lines);
  const rendered = lineRenderVisibility(lines, htmlState);
  const definitions = referenceDefinitions(lines, rendered);
  for (const [lineIndex, { line, text, source: original, kind }] of lines.entries()) {
    if (kind === "link-reference") continue;
    for (let cursor = 0; cursor < text.length;) {
      const link = parseLinkAt(text, original, cursor) ?? parseReferenceLinkAt(text, original, cursor, definitions);
      if (!link) {
        cursor += 1;
        continue;
      }
      if (!link.image && visibleMarkdownLinkRange(rendered[lineIndex], text, cursor, link.end)) {
        links.push({
          label: link.label,
          target: link.target,
          fragment: link.fragment,
          line,
          column: cursor,
        });
      }
      cursor = link.end;
    }
  }
  links.push(...rawHtmlAnchors(htmlState));
  return links
    .sort((left, right) => left.line - right.line || left.column - right.column)
    .map(({ column, ...link }) => link);
}

function normaliseCodeSpanContent(value) {
  let content = value.replace(/\r\n?|\n/gu, " ");
  if (content.startsWith(" ") && content.endsWith(" ") && /[^ ]/u.test(content)) content = content.slice(1, -1);
  return content;
}

function delimiterFlanking(value, start, length, marker) {
  const before = value[start - 1] ?? "\n";
  const after = value[start + length] ?? "\n";
  const beforeWhitespace = /\s/u.test(before);
  const afterWhitespace = /\s/u.test(after);
  const beforePunctuation = /[\p{P}\p{S}]/u.test(before);
  const afterPunctuation = /[\p{P}\p{S}]/u.test(after);
  const left = !afterWhitespace && (!afterPunctuation || beforeWhitespace || beforePunctuation);
  const right = !beforeWhitespace && (!beforePunctuation || afterWhitespace || afterPunctuation);
  if (marker === "_") {
    return {
      canOpen: left && (!right || beforePunctuation),
      canClose: right && (!left || afterPunctuation),
    };
  }
  return { canOpen: left, canClose: right };
}

function pairedHeadingDelimiters(value) {
  const protectedCharacters = Array(value.length).fill(false);
  for (let cursor = 0; cursor < value.length;) {
    if (value[cursor] === "`" && !escaped(value, cursor)) {
      const span = inlineCodeSpan(value, cursor);
      if (span) {
        protectedCharacters.fill(true, cursor, span.end);
        cursor = span.end;
        continue;
      }
    }
    if (value[cursor] === "[") {
      const link = parseLinkAt(value, value, cursor);
      if (link) {
        protectedCharacters.fill(true, cursor, link.end);
        cursor = link.end;
        continue;
      }
    }
    cursor += 1;
  }

  const stacks = new Map();
  const paired = new Set();
  for (let cursor = 0; cursor < value.length;) {
    if (protectedCharacters[cursor] || escaped(value, cursor)) {
      cursor += 1;
      continue;
    }
    const character = value[cursor];
    if (character !== "*" && character !== "_" && character !== "~") {
      cursor += 1;
      continue;
    }
    let runLength = 1;
    while (value[cursor + runLength] === character && !protectedCharacters[cursor + runLength]) runLength += 1;
    const length = character === "~" ? (runLength === 2 ? 2 : 0) : runLength;
    if (length === 0) {
      cursor += runLength;
      continue;
    }
    const { canOpen, canClose } = delimiterFlanking(value, cursor, length, character);
    const stack = stacks.get(character) ?? [];
    let consumed = 0;
    while (canClose && consumed < length && stack.length > 0) {
      paired.add(stack.pop());
      paired.add(cursor + consumed);
      consumed += 1;
    }
    if (canOpen) {
      for (let offset = consumed; offset < length; offset += 1) stack.push(cursor + offset);
    }
    stacks.set(character, stack);
    cursor += length;
  }
  return paired;
}

function renderHeadingInline(value) {
  let label = "";
  const pairedDelimiters = pairedHeadingDelimiters(value);
  for (let cursor = 0; cursor < value.length;) {
    if (value[cursor] === "`" && !escaped(value, cursor)) {
      const span = inlineCodeSpan(value, cursor);
      if (span) {
        const runLength = /^`+/u.exec(value.slice(cursor))[0].length;
        label += normaliseCodeSpanContent(value.slice(cursor + runLength, span.end - runLength));
        cursor = span.end;
        continue;
      }
    }
    if (value[cursor] === "[") {
      const link = parseLinkAt(value, value, cursor);
      if (link) {
        label += renderHeadingInline(link.rawLabel);
        cursor = link.end;
        continue;
      }
    }
    if (pairedDelimiters.has(cursor)) {
      cursor += 1;
      continue;
    }
    label += value[cursor];
    cursor += 1;
  }
  return unescapeMarkdown(label).trim();
}

function isInlineCodeOnly(value) {
  const trimmed = value.trim();
  if (trimmed[0] !== "`") return false;
  return inlineCodeSpan(trimmed, 0)?.end === trimmed.length;
}

export function collectMarkdownHeadings(markdown) {
  const headings = [];
  const anchors = new Set();
  const lines = scanVisibleMarkdown(markdown);
  for (const [index, { line, blockText: lineText, kind }] of lines.entries()) {
    const match = /^(?: {0,3})(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lineText);
    const setext = kind === "setext-heading" && lines[index + 1]?.kind === "setext-underline"
      ? setextUnderline(lines[index + 1].blockText)
      : undefined;
    const inline = match?.[2] ?? (setext ? lineText.trim() : undefined);
    if (!inline || isInlineCodeOnly(inline)) continue;
    const label = renderHeadingInline(inline);
    const base = githubAnchor(label);
    if (!base) continue;
    let candidate = base;
    let suffix = 1;
    while (anchors.has(candidate)) candidate = `${base}-${suffix++}`;
    anchors.add(candidate);
    headings.push({ label, anchor: candidate, level: match ? match[1].length : setext[1][0] === "=" ? 1 : 2, line });
  }
  return headings;
}

export function collectHeadingAnchors(markdown) {
  return new Set(collectMarkdownHeadings(markdown).map(({ anchor }) => anchor));
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function decodeLinkPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

async function assertContainedRegularFile(repoRoot, filename) {
  if (!isContained(repoRoot, filename)) throw new Error("path escapes repository");
  const relativeParts = path.relative(repoRoot, filename).split(path.sep).filter(Boolean);
  let current = repoRoot;
  for (const part of relativeParts) {
    current = path.join(current, part);
    const entry = await lstat(current);
    if (entry.isSymbolicLink()) throw new Error("symlinked path is not allowed");
  }
  await assertRegularFile(filename);
}

async function collectMarkdownFiles(root, errors) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      const currentEntry = await lstat(current);
      if (currentEntry.isSymbolicLink()) {
        errors.push(`symlinked guide root is not allowed: ${current}`);
        return;
      }
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      errors.push(`unable to read guide root ${current}: ${error.message}`);
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push(`symlinked guide path is not allowed: ${entryPath}`);
      } else if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }
  await walk(root);
  return files.sort();
}

function linkParts(target) {
  const hash = target.indexOf("#");
  if (hash === -1) return { filename: target, anchor: "" };
  return { filename: target.slice(0, hash), anchor: target.slice(hash + 1) };
}

async function validateLinks(repoRoot, markdownPath, markdown, errors) {
  for (const { target, line } of extractMarkdownLinks(markdown)) {
    if (/^https?:/i.test(target)) continue;
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
      errors.push(`${markdownPath}:${line}: unsupported local link scheme: ${target}`);
      continue;
    }
    const { filename: rawFilename, anchor: rawAnchor } = linkParts(target);
    const decodedFilename = decodeLinkPart(rawFilename);
    const anchor = decodeLinkPart(rawAnchor);
    if (decodedFilename === undefined || anchor === undefined) {
      errors.push(`${markdownPath}:${line}: invalid encoded local link: ${target}`);
      continue;
    }
    const filename = decodedFilename.split("?")[0];
    if (path.isAbsolute(filename) || path.win32.isAbsolute(filename)) {
      errors.push(`${markdownPath}:${line}: absolute local link is not allowed: ${target}`);
      continue;
    }
    const targetPath = filename ? path.resolve(path.dirname(markdownPath), filename) : markdownPath;
    if (!isContained(repoRoot, targetPath)) {
      errors.push(`${markdownPath}:${line}: path traversal escapes repository: ${target}`);
      continue;
    }
    try {
      await assertContainedRegularFile(repoRoot, targetPath);
    } catch (error) {
      errors.push(`${markdownPath}:${line}: missing or unsafe local link target ${target}: ${error.message}`);
      continue;
    }
    if (anchor) {
      if (path.extname(targetPath).toLowerCase() !== ".md") {
        errors.push(`${markdownPath}:${line}: anchor target is not Markdown: ${target}`);
        continue;
      }
      const targetMarkdown = targetPath === markdownPath ? markdown : await readFile(targetPath, "utf8");
      if (!collectHeadingAnchors(targetMarkdown).has(anchor)) {
        errors.push(`${markdownPath}:${line}: missing anchor in local link: ${target}`);
      }
    }
  }
}

function findSecrets(markdown, markdownPath, errors) {
  const keyPattern = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/;
  const assignmentPattern = /^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(?!\s*(?:#|$))\S+/m;
  if (keyPattern.test(markdown)) errors.push(`${markdownPath}: possible OpenAI secret key`);
  if (assignmentPattern.test(markdown)) errors.push(`${markdownPath}: nonempty OPENAI_API_KEY assignment`);
}

function nonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pathValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
  return [];
}

async function validateDiagramManifest(repoRoot, errors, counts, useCases) {
  const manifestPath = path.join(repoRoot, "guides/assets/diagram-manifest.json");
  let manifest;
  try {
    await assertContainedRegularFile(repoRoot, manifestPath);
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`unable to read diagram manifest: ${error.message}`);
    return;
  }
  const diagrams = Array.isArray(manifest.diagrams) ? manifest.diagrams : null;
  if (!diagrams) {
    errors.push("diagram manifest must contain a diagrams array");
    return;
  }
  if (useCases?.ok) {
    const registered = useCases.counts.audiencePaths
      + useCases.counts.studioCases
      + useCases.counts.careerCases
      + useCases.counts.studioSkillCases
      + useCases.counts.careerSkillCases;
    const expectedDiagramTotal = 18 + registered;
    if (diagrams.length !== expectedDiagramTotal) {
      errors.push(`diagram manifest must contain exactly ${expectedDiagramTotal} entries, found ${diagrams.length}`);
    }
  }
  const ids = new Set();
  for (const [index, diagram] of diagrams.entries()) {
    const label = `diagram ${index + 1}`;
    if (!diagram || typeof diagram !== "object") {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (!nonemptyString(diagram.id)) {
      errors.push(`${label} must have a nonempty id`);
    } else if (ids.has(diagram.id)) {
      errors.push(`${label} has duplicate id: ${diagram.id}`);
    } else {
      ids.add(diagram.id);
    }
    if (!nonemptyString(diagram.alt)) errors.push(`${label} must have nonempty alt text`);
    const sourcePaths = pathValues(diagram.source ?? diagram.sources);
    if (sourcePaths.length === 0 || sourcePaths.some((source) => !source.trim())) {
      errors.push(`${label} must have nonempty source paths`);
    }
    const usedBy = pathValues(diagram.usedBy);
    if (usedBy.length === 0 || usedBy.some((entry) => !entry.trim())) {
      errors.push(`${label} must have at least one usedBy path`);
    }
    const svgPath = await validateDiagramFile(repoRoot, manifestPath, diagram.svg, ".svg", label, errors);
    const pngPath = await validateDiagramFile(repoRoot, manifestPath, diagram.png, ".png", label, errors);
    if (svgPath) counts.svg += 1;
    if (pngPath) counts.png += 1;
    if (!svgPath || !pngPath) continue;
    try {
      const viewBox = parseViewBox(await readFile(svgPath, "utf8"));
      if (!viewBox) {
        errors.push(`${label} SVG must have a valid viewBox`);
        continue;
      }
      if (!isCompletePng(pngPath)) {
        errors.push(`${label} PNG must be complete and end at IEND`);
        continue;
      }
      const dimensions = pngDims(pngPath);
      if (dimensions.w !== viewBox.w * 2 || dimensions.h !== viewBox.h * 2) {
        errors.push(`${label} PNG dimensions must equal exactly 2× SVG viewBox`);
      }
    } catch (error) {
      errors.push(`${label} image validation failed: ${error.message}`);
    }
  }
}

async function validateDiagramFile(repoRoot, manifestPath, value, extension, label, errors) {
  if (!nonemptyString(value)) {
    errors.push(`${label} must have a ${extension} path`);
    return null;
  }
  const candidate = path.resolve(path.dirname(manifestPath), value);
  if (path.isAbsolute(value) || path.win32.isAbsolute(value) || !isContained(repoRoot, candidate)) {
    errors.push(`${label} has an unsafe ${extension} path: ${value}`);
    return null;
  }
  if (path.extname(candidate).toLowerCase() !== extension) {
    errors.push(`${label} ${extension} path must use the ${extension} extension: ${value}`);
    return null;
  }
  try {
    await assertContainedRegularFile(repoRoot, candidate);
    return candidate;
  } catch (error) {
    errors.push(`${label} missing or unsafe ${extension}: ${value}`);
    return null;
  }
}

export async function validateUserGuides({ repoRoot, requireComplete }) {
  const errors = [];
  const counts = {
    guides: 0,
    skillGuides: 0,
    templates: 0,
    svg: 0,
    png: 0,
    audiencePaths: 0,
    useCases: 0,
    skillCases: 0,
    faq: 0,
  };
  const root = await realpath(repoRoot);
  const guidesRoot = path.join(root, "guides");
  const inventories = new Map(await Promise.all(PRODUCT_IDS.map(async (productId) => [
    productId,
    await collectProductInventory(root, productId),
  ])));
  let useCases;
  if (requireComplete) {
    try {
      const { validateUseCaseGuides } = await import("./use-case-guides.mjs");
      useCases = await validateUseCaseGuides({ repoRoot: root, requireComplete: true, inventories });
      counts.audiencePaths = useCases.counts.audiencePaths;
      counts.useCases = useCases.counts.studioCases + useCases.counts.careerCases;
      counts.skillCases = useCases.counts.studioSkillCases + useCases.counts.careerSkillCases;
      counts.faq = useCases.counts.faq;
      for (const error of useCases.errors) errors.push(`use-case manifest: ${error}`);
    } catch (error) {
      errors.push(`use-case manifest: unable to validate: ${error.message}`);
      useCases = { ok: false };
    }
  }
  const documentedSkillIds = new Map(PRODUCT_IDS.map((productId) => [productId, new Set()]));
  const rootReadmePath = path.join(root, "README.md");
  try {
    await assertContainedRegularFile(root, rootReadmePath);
    findSecrets(await readFile(rootReadmePath, "utf8"), rootReadmePath, errors);
  } catch (error) {
    errors.push(`unable to validate root README ${rootReadmePath}: ${error.message}`);
  }
  const guideFiles = await collectMarkdownFiles(guidesRoot, errors);
  const guideContents = [];
  for (const markdownPath of guideFiles) {
    try {
      const markdown = await readFile(markdownPath, "utf8");
      guideContents.push(markdown);
      counts.guides += 1;
      const relative = path.relative(guidesRoot, markdownPath).split(path.sep);
      if (relative.length === 3 && PRODUCT_IDS.includes(relative[0]) && relative[1] === "skills") {
        const productId = relative[0];
        const skillId = path.basename(relative[2], ".md");
        if (skillId !== "README") {
          documentedSkillIds.get(productId).add(skillId);
          if (inventories.get(productId).skillIds.includes(skillId)) counts.skillGuides += 1;
        }
      }
      if (relative.length === 2 && PRODUCT_IDS.includes(relative[0]) && relative[1] === "memory.md") {
        for (const skillId of SOURCE_BOUND_MEMORY_SKILL_IDS) {
          documentedSkillIds.get(relative[0]).add(skillId);
          counts.skillGuides += 1;
        }
      }
      if (relative.length === 2 && PRODUCT_IDS.includes(relative[0]) && relative[1] === "templates.md") {
        counts.templates += inventories.get(relative[0]).templateIds.length;
      }
      await validateLinks(root, markdownPath, markdown, errors);
      if (relative.join("/") === "use-cases/audience-paths.md") {
        try {
          assertReadableResultBoundaries(markdown);
        } catch (error) {
          errors.push(`${markdownPath}: ${error.message}`);
        }
      }
      findSecrets(markdown, markdownPath, errors);
    } catch (error) {
      errors.push(`unable to validate guide ${markdownPath}: ${error.message}`);
    }
  }
  for (const value of REQUIRED_CONFIGURATION_VALUES) {
    if (!guideContents.some((markdown) => markdown.includes(value))) {
      errors.push(`missing required guide configuration value: ${value}`);
    }
  }
  if (requireComplete) {
    for (const productId of PRODUCT_IDS) {
      const expected = new Set(inventories.get(productId).skillIds);
      const actual = documentedSkillIds.get(productId);
      const matches = actual.size === expected.size && [...expected].every((skillId) => actual.has(skillId));
      if (!matches) {
        errors.push(`${productId} skill guide inventory mismatch: expected ${expected.size} IDs, found ${actual.size}`);
      }
    }
    await validateDiagramManifest(root, errors, counts, useCases);
  }
  return { ok: errors.length === 0, errors, counts };
}
