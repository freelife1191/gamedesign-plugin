import path from "node:path";

const CONTENT_TYPES = Object.freeze({
  docxMain: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  pptxMain: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  notes: "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
});

function decodeXmlEntities(value) {
  return value.replace(/&(?:quot|apos|lt|gt|amp|#\d+|#x[\dA-Fa-f]+);/gu, (entity) => {
    if (entity === "&quot;") return '"';
    if (entity === "&apos;") return "'";
    if (entity === "&lt;") return "<";
    if (entity === "&gt;") return ">";
    if (entity === "&amp;") return "&";
    const hexadecimal = entity.startsWith("&#x");
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new Error(`broken OOXML: invalid XML character reference ${entity}`);
    }
    return String.fromCodePoint(codePoint);
  });
}

function validateXmlEntities(value) {
  const withoutEntities = value.replace(/&(?:quot|apos|lt|gt|amp|#\d+|#x[\dA-Fa-f]+);/gu, "");
  if (withoutEntities.includes("&")) throw new Error("broken OOXML: malformed XML entity");
}

function xmlAttributes(source) {
  const attributes = Object.create(null);
  let offset = 0;
  while (offset < source.length) {
    while (/\s/u.test(source[offset] ?? "")) offset += 1;
    if (offset === source.length) break;
    const name = /^[A-Za-z_][\w:.-]*/u.exec(source.slice(offset))?.[0];
    if (!name) throw new Error("broken OOXML: malformed XML attribute name");
    offset += name.length;
    while (/\s/u.test(source[offset] ?? "")) offset += 1;
    if (source[offset] !== "=") throw new Error(`broken OOXML: malformed XML attribute ${name}`);
    offset += 1;
    while (/\s/u.test(source[offset] ?? "")) offset += 1;
    const quote = source[offset];
    if (quote !== '"' && quote !== "'") throw new Error(`broken OOXML: unquoted XML attribute ${name}`);
    const end = source.indexOf(quote, offset + 1);
    if (end < 0) throw new Error(`broken OOXML: unterminated XML attribute ${name}`);
    const rawValue = source.slice(offset + 1, end);
    if (rawValue.includes("<")) throw new Error(`broken OOXML: invalid XML attribute ${name}`);
    validateXmlEntities(rawValue);
    if (Object.hasOwn(attributes, name)) throw new Error(`broken OOXML: duplicate XML attribute ${name}`);
    attributes[name] = decodeXmlEntities(rawValue);
    offset = end + 1;
  }
  return attributes;
}

function markupEnd(source, start) {
  let quote;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === ">") return index;
    else if (character === "<") throw new Error("broken OOXML: nested XML markup");
  }
  throw new Error("broken OOXML: unterminated XML markup");
}

function elements(xml, localName) {
  let source = String(xml);
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (source.includes("\uFFFD")) throw new Error("broken OOXML: invalid UTF-8 in XML");
  const results = [];
  const stack = [];
  let offset = 0;
  let rootCount = 0;
  let declarationSeen = false;
  while (offset < source.length) {
    const opening = source.indexOf("<", offset);
    const text = opening < 0 ? source.slice(offset) : source.slice(offset, opening);
    validateXmlEntities(text);
    if (stack.length === 0 && text.trim()) throw new Error("broken OOXML: text outside XML root");
    if (opening < 0) { offset = source.length; break; }
    if (source.startsWith("<!--", opening)) throw new Error("broken OOXML: XML comments are unsupported");
    if (source.startsWith("<![CDATA[", opening)) throw new Error("broken OOXML: XML CDATA is unsupported");
    if (/^<!DOCTYPE\b/iu.test(source.slice(opening))) throw new Error("broken OOXML: XML DOCTYPE is unsupported");
    if (source.startsWith("<?xml", opening)) {
      if (declarationSeen || rootCount || stack.length || source.slice(0, opening).trim()) throw new Error("broken OOXML: misplaced XML declaration");
      const end = source.indexOf("?>", opening + 5);
      if (end < 0 || source.slice(opening + 5, end).includes("<")) throw new Error("broken OOXML: malformed XML declaration");
      declarationSeen = true;
      offset = end + 2;
      continue;
    }
    if (source.startsWith("<?", opening)) throw new Error("broken OOXML: XML processing instructions are unsupported");
    if (source.startsWith("<!", opening)) throw new Error("broken OOXML: unsupported XML declaration");
    const end = markupEnd(source, opening + 1);
    let body = source.slice(opening + 1, end).trim();
    const closing = body.startsWith("/");
    if (closing) {
      body = body.slice(1).trim();
      if (!/^[A-Za-z_][\w:.-]*$/u.test(body)) throw new Error("broken OOXML: malformed XML closing tag");
      const expected = stack.pop();
      if (expected !== body) throw new Error(`broken OOXML: XML tag mismatch ${body}; expected ${expected ?? "none"}`);
    } else {
      const selfClosing = body.endsWith("/");
      if (selfClosing) body = body.slice(0, -1).trimEnd();
      const name = /^[A-Za-z_][\w:.-]*/u.exec(body)?.[0];
      if (!name) throw new Error("broken OOXML: malformed XML opening tag");
      const attributes = xmlAttributes(body.slice(name.length));
      if (stack.length === 0) {
        rootCount += 1;
        if (rootCount > 1) throw new Error("broken OOXML: multiple XML roots");
      }
      if (name.split(":").at(-1) === localName) results.push(attributes);
      if (!selfClosing) stack.push(name);
    }
    offset = end + 1;
  }
  if (stack.length) throw new Error(`broken OOXML: unclosed XML tag ${stack.at(-1)}`);
  if (rootCount !== 1) throw new Error("broken OOXML: XML requires one root element");
  return results;
}

function readXml(archive, member) {
  return archive.read(member).toString("utf8");
}

function sourcePartForRelationships(member) {
  if (member === "_rels/.rels") return "";
  const directory = path.posix.dirname(member);
  if (path.posix.basename(directory) !== "_rels" || !member.endsWith(".rels")) throw new Error(`broken OOXML: invalid relationships part ${member}`);
  return path.posix.join(path.posix.dirname(directory), path.posix.basename(member, ".rels"));
}

function resolveInternalTarget(sourcePart, target) {
  if (!target || target.includes("\\") || target.includes("\0")) throw new Error(`broken OOXML: invalid relationship target ${target ?? ""}`);
  const withoutFragment = target.split("#", 1)[0];
  const rooted = withoutFragment.startsWith("/")
    ? withoutFragment.slice(1)
    : path.posix.join(path.posix.dirname(sourcePart), withoutFragment);
  const normalized = path.posix.normalize(rooted);
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`broken OOXML: relationship target escapes package: ${target}`);
  }
  return normalized;
}

function relationships(archive, member, memberSet) {
  if (!memberSet.has(member)) throw new Error(`broken OOXML: missing ${member}`);
  const sourcePart = sourcePartForRelationships(member);
  const identifiers = new Set();
  return elements(readXml(archive, member), "Relationship").map((attributes) => {
    if (!attributes.Id || !attributes.Type || !attributes.Target) throw new Error(`broken OOXML: malformed relationship in ${member}`);
    if (identifiers.has(attributes.Id)) throw new Error(`broken OOXML: duplicate relationship ID ${attributes.Id} in ${member}`);
    identifiers.add(attributes.Id);
    if (attributes.TargetMode?.toLowerCase() === "external") return { ...attributes, external: true };
    const resolvedTarget = resolveInternalTarget(sourcePart, attributes.Target);
    if (!memberSet.has(resolvedTarget)) throw new Error(`broken OOXML: relationship target missing: ${resolvedTarget}`);
    return { ...attributes, resolvedTarget, external: false };
  });
}

function relationWithType(items, suffix) {
  return items.filter((item) => !item.external && item.Type.endsWith(`/${suffix}`));
}

function requireSingle(items, description) {
  if (items.length !== 1) throw new Error(`broken OOXML: expected one ${description}, found ${items.length}`);
  return items[0];
}

function validateContentTypes(archive, memberSet) {
  const member = "[Content_Types].xml";
  if (!memberSet.has(member)) throw new Error(`broken OOXML: missing ${member}`);
  const overrides = new Map();
  for (const override of elements(readXml(archive, member), "Override")) {
    if (!override.PartName || !override.ContentType) throw new Error("broken OOXML: malformed Content Types override");
    const target = override.PartName.startsWith("/") ? override.PartName.slice(1) : override.PartName;
    if (overrides.has(target)) throw new Error(`broken OOXML: duplicate Content Type override for ${target}`);
    if (!memberSet.has(target)) throw new Error(`broken OOXML: Content Types target missing: ${target}`);
    overrides.set(target, override.ContentType);
  }
  return overrides;
}

function requireContentType(overrides, member, expected) {
  const actual = overrides.get(member);
  if (actual !== expected) throw new Error(`broken OOXML: Content Type for ${member} is ${actual ?? "missing"}; expected ${expected}`);
}

function validateDocx(rootRelationships, contentTypes) {
  const root = requireSingle(relationWithType(rootRelationships, "officeDocument"), "root officeDocument relationship");
  if (root.resolvedTarget !== "word/document.xml") throw new Error(`broken OOXML: Word root target is ${root.resolvedTarget}`);
  requireContentType(contentTypes, root.resolvedTarget, CONTENT_TYPES.docxMain);
  return { root: root.resolvedTarget, slides: [], notes: [] };
}

function validatePptx(archive, memberSet, rootRelationships, contentTypes, relationshipParts, options) {
  const root = requireSingle(relationWithType(rootRelationships, "officeDocument"), "root officeDocument relationship");
  if (root.resolvedTarget !== "ppt/presentation.xml") throw new Error(`broken OOXML: presentation root target is ${root.resolvedTarget}`);
  requireContentType(contentTypes, root.resolvedTarget, CONTENT_TYPES.pptxMain);
  const presentationRelationships = relationshipParts.get("ppt/_rels/presentation.xml.rels");
  if (!presentationRelationships) throw new Error("broken OOXML: missing ppt/_rels/presentation.xml.rels");
  const byId = new Map(presentationRelationships.map((item) => [item.Id, item]));
  const slideIds = elements(readXml(archive, root.resolvedTarget), "sldId").map((item) => item["r:id"]);
  if (slideIds.some((id) => !id)) throw new Error("broken OOXML: presentation slide is missing r:id");
  const slides = slideIds.map((id) => {
    const relation = byId.get(id);
    if (!relation || relation.external || !relation.Type.endsWith("/slide")) throw new Error(`broken OOXML: slide relationship ID missing or invalid: ${id}`);
    return relation.resolvedTarget;
  });
  if (new Set(slides).size !== slides.length) throw new Error("broken OOXML: duplicate slide relationship target");
  const packagedSlides = [...memberSet].filter((member) => /^ppt\/slides\/slide\d+\.xml$/u.test(member));
  if (slides.length !== packagedSlides.length) throw new Error("broken OOXML: presentation slide order does not cover packaged slides");
  for (const slide of slides) requireContentType(contentTypes, slide, CONTENT_TYPES.slide);
  if (options.expectedSlides !== undefined && slides.length !== options.expectedSlides) {
    throw new Error(`broken OOXML: slide count ${slides.length} does not match ${options.expectedSlides}`);
  }

  const notes = slides.map((slide) => {
    const slideRels = path.posix.join(path.posix.dirname(slide), "_rels", `${path.posix.basename(slide)}.rels`);
    const noteRelation = requireSingle(relationWithType(relationshipParts.get(slideRels) ?? [], "notesSlide"), `notes relationship for ${slide}`);
    const note = noteRelation.resolvedTarget;
    const noteRels = path.posix.join(path.posix.dirname(note), "_rels", `${path.posix.basename(note)}.rels`);
    const backRelation = requireSingle(relationWithType(relationshipParts.get(noteRels) ?? [], "slide"), `slide back-reference for ${note}`);
    if (backRelation.resolvedTarget !== slide) throw new Error(`broken OOXML: notes back-reference does not match ${slide}`);
    requireContentType(contentTypes, note, CONTENT_TYPES.notes);
    return note;
  });
  if (new Set(notes).size !== notes.length) throw new Error("broken OOXML: duplicate notes relationship target");
  return { root: root.resolvedTarget, slides, notes };
}

export function validateOoxmlArchive(archive, kind, options = {}) {
  if (!archive || !Array.isArray(archive.members) || typeof archive.read !== "function") throw new TypeError("OOXML archive must expose members and read(name)");
  if (kind !== "docx" && kind !== "pptx") throw new TypeError(`unsupported OOXML kind: ${kind}`);
  const memberSet = new Set(archive.members);
  for (const member of archive.members) archive.read(member);
  const contentTypes = validateContentTypes(archive, memberSet);
  const relationshipParts = new Map(
    archive.members
      .filter((member) => member.endsWith(".rels"))
      .map((member) => [member, relationships(archive, member, memberSet)]),
  );
  const rootRelationships = relationshipParts.get("_rels/.rels");
  if (!rootRelationships) throw new Error("broken OOXML: missing _rels/.rels");
  return kind === "docx"
    ? validateDocx(rootRelationships, contentTypes)
    : validatePptx(archive, memberSet, rootRelationships, contentTypes, relationshipParts, options);
}
