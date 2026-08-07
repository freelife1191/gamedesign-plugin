import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  isCompletePng,
  parseViewBox,
  pngDims,
} from "../../shared/vendor/skillstead/svg-infographic/0.8.3/scripts/render.mjs";
import { validateUseCaseGuides } from "./use-case-guides.mjs";

export const PRODUCT_IDS = Object.freeze([
  "game-design-career",
  "game-design-studio",
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
    "shared/vendor/skillstead/svg-infographic/0.8.3/SKILL.md",
  );
  await assertRegularFile(vendorSkill);
  const templateIds = await directoryIds(path.join(productRoot, "assets/templates"), "content.md");
  return {
    skillIds: [...productSkills, "svg-infographic"].sort(compareIds),
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
    return { line: index + 1, source, kind: initialLineKind(source) };
  });

  for (let index = 1; index < lines.length; index += 1) {
    const underline = setextUnderline(lines[index].source);
    if (underline && lines[index - 1].kind === "plain") {
      lines[index - 1].kind = "setext-heading";
      lines[index].kind = "setext-underline";
    }
  }
  for (let index = 1; index < lines.length; index += 1) {
    if (!tableDelimiter(lines[index].source) || !tableRow(lines[index - 1].source)) continue;
    lines[index - 1].kind = "table";
    lines[index].kind = "table";
    for (let cursor = index + 1; cursor < lines.length && tableRow(lines[cursor].source); cursor += 1) {
      lines[cursor].kind = "table";
    }
  }

  let segment = -1;
  let previousFamily;
  for (const line of lines) {
    const family = line.kind === "unordered-list" || line.kind === "ordered-list"
      ? "list"
      : line.kind === "blockquote"
        ? "blockquote"
        : line.kind === "table"
          ? "table"
          : line.kind === "plain"
            ? "plain"
            : undefined;
    if (!family) {
      previousFamily = undefined;
      line.segment = line.kind === "blank" || line.kind === "fence" || line.kind === "indented-code"
        ? undefined
        : ++segment;
      continue;
    }
    if (family !== previousFamily) segment += 1;
    line.segment = segment;
    previousFamily = family;
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
  }));
  const rawRanges = inlineCodeRanges(lines);
  const rangeStartAt = lines.map((line) => Array(line.source.length));
  for (const range of rawRanges) {
    const start = range.positions[0];
    rangeStartAt[start.lineIndex][start.cursor] = range;
  }

  let fence;
  let inComment = false;
  let activeCodeRange;
  let activeSegment;
  for (const [lineIndex, line] of lines.entries()) {
    const hide = (start, end) => line.hidden.fill(true, start, end);
    if (line.segment !== activeSegment) activeCodeRange = undefined;
    activeSegment = line.segment;
    if (fence) {
      activeCodeRange = undefined;
      hide(0, line.source.length);
      if (closesFence(line.source, fence)) fence = undefined;
      continue;
    }
    if (!inComment && line.kind === "indented-code") {
      activeCodeRange = undefined;
      hide(0, line.source.length);
      continue;
    }
    if (!inComment && fenceOpener(line.source)) {
      activeCodeRange = undefined;
      fence = fenceOpener(line.source);
      hide(0, line.source.length);
      continue;
    }

    for (let cursor = 0; cursor < line.source.length;) {
      if (inComment) {
        const end = line.source.indexOf("-->", cursor);
        if (end === -1) {
          hide(cursor, line.source.length);
          break;
        }
        hide(cursor, end + 3);
        inComment = false;
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
        inComment = true;
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

  return lines.map(({ line, text, source, blockText, kind }) => ({ line, text: text.join(""), source, blockText, kind }));
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

export function extractMarkdownLinks(markdown) {
  const links = [];
  for (const { line, text, source: original } of scanVisibleMarkdown(markdown)) {
    for (let cursor = 0; cursor < text.length;) {
      const link = parseLinkAt(text, original, cursor);
      if (!link) {
        cursor += 1;
        continue;
      }
      if (!link.image) {
        links.push({
          label: link.label,
          target: link.target,
          fragment: link.fragment,
          line,
        });
      }
      cursor = link.end;
    }
  }
  return links;
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
    const token = value.slice(cursor, cursor + length);
    const { canOpen, canClose } = delimiterFlanking(value, cursor, length, character);
    const stack = stacks.get(token) ?? [];
    let closed = false;
    if (canClose && stack.length > 0) {
      const opener = stack.pop();
      for (let offset = 0; offset < length; offset += 1) {
        paired.add(opener + offset);
        paired.add(cursor + offset);
      }
      closed = true;
    }
    if (canOpen && !closed) stack.push(cursor);
    stacks.set(token, stack);
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
      if (relative.length === 2 && PRODUCT_IDS.includes(relative[0]) && relative[1] === "templates.md") {
        counts.templates += inventories.get(relative[0]).templateIds.length;
      }
      await validateLinks(root, markdownPath, markdown, errors);
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
