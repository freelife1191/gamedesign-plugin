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
    if (source[cursor] !== "`") {
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

export function scanVisibleMarkdown(markdown) {
  const lines = [];
  let inComment = false;
  let fence;
  let inlineEnd = -1;
  let offset = 0;
  for (const [index, rawLineWithCarriageReturn] of markdown.split("\n").entries()) {
    const rawLine = rawLineWithCarriageReturn.endsWith("\r")
      ? rawLineWithCarriageReturn.slice(0, -1)
      : rawLineWithCarriageReturn;
    const visible = rawLine.split("");
    const hide = (start, end) => visible.fill(" ", start, end);
    if (fence) {
      if (closesFence(rawLine, fence)) fence = undefined;
      lines.push({ line: index + 1, text: " ".repeat(rawLine.length), source: rawLine });
      offset += rawLineWithCarriageReturn.length + 1;
      continue;
    }
    if (inlineEnd <= offset && !inComment && indentedCode(rawLine)) {
      lines.push({ line: index + 1, text: " ".repeat(rawLine.length), source: rawLine });
      offset += rawLineWithCarriageReturn.length + 1;
      continue;
    }
    if (inlineEnd <= offset && !inComment && fenceOpener(rawLine)) {
      const openingFence = fenceOpener(rawLine);
      fence = openingFence;
      lines.push({ line: index + 1, text: " ".repeat(rawLine.length), source: rawLine });
      offset += rawLineWithCarriageReturn.length + 1;
      continue;
    }
    for (let cursor = 0; cursor < rawLine.length;) {
      const absolute = offset + cursor;
      if (absolute < inlineEnd) {
        visible[cursor] = " ";
        cursor += 1;
        continue;
      }
      if (inlineEnd !== -1 && absolute >= inlineEnd) inlineEnd = -1;
      if (inComment) {
        const end = rawLine.indexOf("-->", cursor);
        if (end === -1) {
          hide(cursor, rawLine.length);
          break;
        }
        hide(cursor, end + 3);
        inComment = false;
        cursor = end + 3;
        continue;
      }
      if (rawLine.startsWith("<!--", cursor)) {
        inComment = true;
        hide(cursor, cursor + 4);
        cursor += 4;
        continue;
      }
      if (rawLine[cursor] === "`" && rawLine[cursor - 1] !== "`" && !escaped(rawLine, cursor)) {
        const span = inlineCodeSpan(markdown, absolute);
        if (span) {
          inlineEnd = span.end;
          visible[cursor] = " ";
          cursor += 1;
          continue;
        }
        let runLength = 1;
        while (rawLine[cursor + runLength] === "`") runLength += 1;
        cursor += runLength;
        continue;
      }
      cursor += 1;
    }
    lines.push({ line: index + 1, text: visible.join(""), source: rawLine });
    offset += rawLineWithCarriageReturn.length + 1;
  }
  return lines;
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

function isInlineCodeOnly(value) {
  const trimmed = value.trim();
  if (trimmed[0] !== "`") return false;
  const span = inlineCodeSpan(trimmed, 0);
  return span?.end === trimmed.length;
}

export function collectMarkdownHeadings(markdown) {
  const headings = [];
  const anchors = new Set();
  for (const { line, text: lineText } of scanVisibleMarkdown(markdown)) {
    const match = /^(?: {0,3})(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lineText);
    if (!match) continue;
    if (isInlineCodeOnly(match[2])) continue;
    const base = githubAnchor(match[2]);
    if (!base) continue;
    let candidate = base;
    let suffix = 1;
    while (anchors.has(candidate)) candidate = `${base}-${suffix++}`;
    anchors.add(candidate);
    headings.push({ label: match[2].trim(), anchor: candidate, level: match[1].length, line });
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
