#!/usr/bin/env node

import { lstat, readFile, readdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FILES = ['content.md', 'evidence.yml', 'export-manifest.yml'];
const REQUIRED_DIRECTORIES = ['assets', 'decisions'];
const FORMATS = ['md', 'pdf', 'docx', 'pptx'];
const FORMAT_STATUSES = ['pending', 'passed', 'failed', 'unavailable'];
const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNSAFE_MAPPING_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

class YamlSyntaxError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.name = 'YamlSyntaxError';
  }
}

function rejectUnsupportedYaml(source) {
  function maskQuotedText(line) {
    let quote = null;
    let escaped = false;
    let masked = '';
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (quote === '"') {
        masked += ' ';
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quote = null;
      } else if (quote === "'") {
        masked += ' ';
        if (character === "'" && line[index + 1] === "'") {
          masked += ' ';
          index += 1;
        } else if (character === "'") quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
        masked += ' ';
      } else {
        masked += character;
      }
    }
    return masked;
  }

  let literalParentIndent = null;
  const syntaxOnly = source.split('\n').map((line) => {
    const indent = line.match(/^ */)[0].length;
    if (literalParentIndent !== null) {
      if (line.trim() === '' || indent > literalParentIndent) return ' '.repeat(line.length);
      literalParentIndent = null;
    }
    const masked = maskQuotedText(line);
    if (/:\s*\|\s*$/.test(masked)) literalParentIndent = indent;
    return masked;
  }).join('\n');
  const checks = [
    [/^\s*---\s*$/m, 'document separators'],
    [/^\s*\.\.\.\s*$/m, 'document terminators'],
    [/^\s*%/m, 'directives'],
    [/(^|[\s:[,{])&[A-Za-z0-9_-]+/, 'anchors'],
    [/(^|[\s:[,{])\*[A-Za-z0-9_-]+/, 'aliases'],
    [/(^|\s)![A-Za-z0-9_!/-]+/, 'tags'],
    [/^\s*<<\s*:/m, 'merge keys'],
    [/^\s*\?/m, 'complex mapping keys'],
    [/(^|:\s*)[\[{]/m, 'flow collections'],
    [/:\s*>[-+]?\s*$/m, 'folded block scalars'],
    [/:\s*\|(?:[+-]|[1-9])[^\s#]*\s*$/m, 'block scalar indicators'],
  ];
  if (source.includes('\t')) throw new YamlSyntaxError('unsupported YAML tabs', 1);
  for (const [pattern, feature] of checks) {
    const match = pattern.exec(syntaxOnly);
    if (match) {
      const line = source.slice(0, match.index).split('\n').length;
      throw new YamlSyntaxError(`unsupported YAML feature: ${feature}`, line);
    }
  }
}

function parseScalar(value, line) {
  if (/^(?:null|~)$/i.test(value)) return null;
  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'string') throw new Error();
      return parsed;
    } catch {
      throw new YamlSyntaxError('invalid double-quoted scalar', line);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length === 1) {
      throw new YamlSyntaxError('invalid single-quoted scalar', line);
    }
    const interior = value.slice(1, -1);
    let parsed = '';
    for (let index = 0; index < interior.length; index += 1) {
      if (interior[index] !== "'") {
        parsed += interior[index];
      } else if (interior[index + 1] === "'") {
        parsed += "'";
        index += 1;
      } else {
        throw new YamlSyntaxError('invalid single-quoted scalar; internal quotes must be doubled', line);
      }
    }
    return parsed;
  }
  if (value.startsWith('|') || value.startsWith('>')) {
    throw new YamlSyntaxError('unsupported YAML scalar indicator; only an exact unquoted | is supported', line);
  }
  if (/[:]\s|\s#/.test(value)) {
    throw new YamlSyntaxError('plain scalars cannot contain colon-space or inline comments', line);
  }
  return value;
}

function splitMappingEntry(content, line) {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/.exec(content);
  if (!match) throw new YamlSyntaxError('expected a simple mapping key followed by a colon', line);
  if (UNSAFE_MAPPING_KEYS.has(match[1])) throw new YamlSyntaxError(`unsafe mapping key ${match[1]}`, line);
  return { key: match[1], rawValue: match[2] ?? '' };
}

export function parseRestrictedYaml(source, sourceName = 'YAML') {
  if (typeof source !== 'string') throw new TypeError(`${sourceName} must be text`);
  rejectUnsupportedYaml(source);
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;

  function details(at = index) {
    const raw = lines[at] ?? '';
    const indent = raw.match(/^ */)[0].length;
    return { raw, indent, content: raw.slice(indent), line: at + 1 };
  }

  function skipIgnored() {
    while (index < lines.length) {
      const { content } = details();
      if (content.trim() !== '' && !content.startsWith('#')) break;
      index += 1;
    }
  }

  function parseBlockScalar(parentIndent) {
    const collected = [];
    let scalarIndent;
    while (index < lines.length) {
      const current = details();
      if (current.content === '') {
        collected.push('');
        index += 1;
        continue;
      }
      if (current.indent <= parentIndent) break;
      scalarIndent ??= current.indent;
      if (current.indent < scalarIndent) {
        throw new YamlSyntaxError('inconsistent block scalar indentation', current.line);
      }
      collected.push(current.raw.slice(scalarIndent));
      index += 1;
    }
    while (collected.at(-1) === '') collected.pop();
    return `${collected.join('\n')}\n`;
  }

  function assignEntry(target, key, rawValue, mappingIndent, line) {
    if (Object.hasOwn(target, key)) throw new YamlSyntaxError(`duplicate key ${key}`, line);
    if (rawValue === '|') {
      target[key] = parseBlockScalar(mappingIndent);
    } else if (rawValue === '') {
      skipIgnored();
      if (index >= lines.length || details().indent <= mappingIndent) {
        throw new YamlSyntaxError(`key ${key} requires an indented value`, line);
      }
      target[key] = parseNode(mappingIndent + 2);
    } else {
      target[key] = parseScalar(rawValue, line);
    }
  }

  function parseMapping(indent, initialEntry) {
    const result = Object.create(null);
    if (initialEntry) {
      assignEntry(result, initialEntry.key, initialEntry.rawValue, indent, initialEntry.line);
    }
    while (index < lines.length) {
      skipIgnored();
      if (index >= lines.length) break;
      const current = details();
      if (current.indent < indent) break;
      if (current.indent > indent) throw new YamlSyntaxError('unexpected indentation', current.line);
      if (current.content.startsWith('- ')) break;
      const entry = splitMappingEntry(current.content, current.line);
      index += 1;
      assignEntry(result, entry.key, entry.rawValue, indent, entry.line);
    }
    return result;
  }

  function parseSequence(indent) {
    const result = [];
    while (index < lines.length) {
      skipIgnored();
      if (index >= lines.length) break;
      const current = details();
      if (current.indent < indent) break;
      if (current.indent > indent) throw new YamlSyntaxError('unexpected sequence indentation', current.line);
      if (!current.content.startsWith('- ')) break;
      const item = current.content.slice(2);
      index += 1;
      if (item === '') {
        result.push(parseNode(indent + 2));
      } else if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(item)) {
        const entry = splitMappingEntry(item, current.line);
        result.push(parseMapping(indent + 2, { ...entry, line: current.line }));
      } else {
        result.push(parseScalar(item, current.line));
      }
    }
    return result;
  }

  function parseNode(indent) {
    skipIgnored();
    if (index >= lines.length) throw new YamlSyntaxError('expected a value', lines.length);
    const current = details();
    if (current.indent !== indent) throw new YamlSyntaxError(`expected indentation of ${indent} spaces`, current.line);
    return current.content.startsWith('- ') ? parseSequence(indent) : parseMapping(indent);
  }

  skipIgnored();
  if (index >= lines.length) throw new YamlSyntaxError('document is empty', 1);
  const result = parseNode(0);
  skipIgnored();
  if (index < lines.length) throw new YamlSyntaxError('unexpected trailing content', index + 1);
  return result;
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...await listFiles(resolve(directory, entry.name), relativePath));
    else if (entry.isFile()) paths.push(relativePath);
  }
  return paths.sort();
}

function addError(errors, code, file, message) {
  errors.push({ code, file, message });
}

function hasOwn(object, field) {
  return object !== null && typeof object === 'object' && Object.hasOwn(object, field);
}

function requireString(object, field, file, errors, context = '') {
  if (!hasOwn(object, field) || typeof object[field] !== 'string' || object[field].trim() === '') {
    addError(errors, 'schema.required', file, `${context}${field} must be a nonempty string`);
    return false;
  }
  return true;
}

function rejectUnknownKeys(object, allowedKeys, file, errors, context = '') {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return;
  for (const key of Object.keys(object)) {
    if (!allowedKeys.includes(key)) addError(errors, 'schema.additional_property', file, `${context}unknown key: ${key}`);
  }
}

function requireKebabCase(object, field, file, errors, context = '') {
  if (requireString(object, field, file, errors, context) && !KEBAB_CASE.test(object[field])) {
    addError(errors, 'schema.pattern', file, `${context}${field} must be kebab-case`);
  }
}

function validateUri(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validateEvidence(evidence, errors) {
  const file = 'evidence.yml';
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    addError(errors, 'evidence.schema', file, 'evidence must be a mapping');
    return;
  }
  rejectUnknownKeys(evidence, ['version', 'claims'], file, errors);
  if (evidence.version !== 1) addError(errors, 'evidence.version', file, 'version must be 1');
  if (!Array.isArray(evidence.claims) || evidence.claims.length === 0) {
    addError(errors, 'evidence.claims', file, 'claims must be a nonempty list');
    return;
  }
  evidence.claims.forEach((claim, index) => {
    const context = `claims[${index}].`;
    rejectUnknownKeys(claim, ['id', 'claim_type', 'claim', 'source', 'confidence', 'limitations'], file, errors, context);
    requireKebabCase(claim, 'id', file, errors, context);
    requireString(claim, 'claim_type', file, errors, context);
    requireString(claim, 'claim', file, errors, context);
    if (!claim?.source || typeof claim.source !== 'object' || Array.isArray(claim.source)) {
      addError(errors, 'evidence.source', file, `${context}source must be a mapping`);
    } else {
      rejectUnknownKeys(claim.source, ['title', 'url', 'locator', 'accessed_at'], file, errors, `${context}source.`);
      requireString(claim.source, 'title', file, errors, `${context}source.`);
      if (!requireString(claim.source, 'url', file, [], '') && !requireString(claim.source, 'locator', file, [], '')) {
        addError(errors, 'evidence.source', file, `${context}source requires url or locator`);
      }
      if (hasOwn(claim.source, 'url') && (!requireString(claim.source, 'url', file, errors, `${context}source.`) || !validateUri(claim.source.url))) {
        addError(errors, 'schema.format', file, `${context}source.url must be an absolute URI`);
      }
      if (requireString(claim.source, 'accessed_at', file, errors, `${context}source.`) && !validateCalendarDate(claim.source.accessed_at)) {
        addError(errors, 'schema.format', file, `${context}source.accessed_at must be an ISO calendar date`);
      }
    }
    if (!CONFIDENCE_LEVELS.includes(claim?.confidence)) {
      addError(errors, 'evidence.confidence', file, `${context}confidence must be low, medium, or high`);
    }
    requireString(claim, 'limitations', file, errors, context);
  });
}

function validateManifest(manifest, requestedFormats, errors) {
  const file = 'export-manifest.yml';
  rejectUnknownKeys(manifest, ['artifact_id', 'formats'], file, errors);
  requireKebabCase(manifest, 'artifact_id', file, errors);
  if (!manifest?.formats || typeof manifest.formats !== 'object' || Array.isArray(manifest.formats)) {
    addError(errors, 'manifest.formats', file, 'formats must be a mapping');
    return;
  }
  rejectUnknownKeys(manifest.formats, FORMATS, file, errors, 'formats.');
  for (const format of FORMATS) {
    const config = manifest.formats[format];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      addError(errors, 'manifest.format', file, `formats.${format} must be a mapping`);
    } else {
      const allowedKeys = format === 'pptx' ? ['status', 'audience', 'purpose', 'slide_outline'] : ['status'];
      rejectUnknownKeys(config, allowedKeys, file, errors, `formats.${format}.`);
      if (!hasOwn(config, 'status') || !FORMAT_STATUSES.includes(config.status)) {
        addError(errors, 'manifest.status', file, `formats.${format}.status must be pending, passed, failed, or unavailable`);
      }
    }
  }
  if (manifest.formats.md && ['failed', 'unavailable'].includes(manifest.formats.md.status)) {
    addError(errors, 'manifest.md_available', file, 'formats.md must remain available (pending or passed)');
  }
  for (const format of requestedFormats) {
    if (!FORMATS.includes(format)) {
      addError(errors, 'manifest.requested_format', file, `unsupported requested format: ${format}`);
    }
  }
  const pptx = manifest.formats.pptx;
  const pptxRequested = requestedFormats.includes('pptx');
  for (const field of ['audience', 'purpose']) {
    if (pptxRequested || hasOwn(pptx, field)) requireString(pptx, field, file, errors, 'formats.pptx.');
  }
  if (pptxRequested || hasOwn(pptx, 'slide_outline')) {
    if (!Array.isArray(pptx?.slide_outline) || pptx.slide_outline.length === 0) {
      addError(errors, 'manifest.pptx_outline', file, 'formats.pptx.slide_outline must be a nonempty list');
    } else {
      pptx.slide_outline.forEach((slide, index) => {
        rejectUnknownKeys(slide, ['title'], file, errors, `formats.pptx.slide_outline[${index}].`);
        requireString(slide, 'title', file, errors, `formats.pptx.slide_outline[${index}].`);
      });
    }
  }
}

async function validateMarkdown(source, artifactDir, errors) {
  const file = 'content.md';
  if (source !== source.normalize('NFC')) addError(errors, 'markdown.nfc', file, 'Markdown must use NFC Unicode normalization');
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!frontmatter) {
    addError(errors, 'markdown.frontmatter', file, 'Markdown must start with YAML frontmatter');
  } else {
    try {
      const metadata = parseRestrictedYaml(frontmatter[1], 'frontmatter');
      rejectUnknownKeys(metadata, ['title', 'artifact_id', 'version'], file, errors, 'frontmatter.');
      requireString(metadata, 'title', file, errors, 'frontmatter.');
      requireKebabCase(metadata, 'artifact_id', file, errors, 'frontmatter.');
      if (!Number.isInteger(metadata.version) || metadata.version < 1) {
        addError(errors, 'markdown.frontmatter', file, 'frontmatter.version must be a positive integer');
      }
    } catch (error) {
      addError(errors, 'markdown.frontmatter', file, `invalid frontmatter: ${error.message}`);
    }
  }
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  const visibleLines = [];
  const headings = [];
  let fence = null;
  for (const line of body.split('\n')) {
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`);
      if (closing.test(line)) fence = null;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const invalidBacktickInfo = opening?.[1][0] === '`' && opening[2].includes('`');
    if (opening && !invalidBacktickInfo) {
      fence = { character: opening[1][0], length: opening[1].length };
      continue;
    }
    visibleLines.push(line);
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+)(.+)$/.exec(line);
    if (heading) headings.push({ hashes: heading[1], text: heading[2], line });
  }
  const visibleBody = visibleLines.join('\n');
  const h1Count = headings.filter((heading) => heading.hashes.length === 1).length;
  if (h1Count !== 1) addError(errors, 'markdown.h1', file, `Markdown must contain exactly one H1; found ${h1Count}`);
  const ids = new Set();
  for (const heading of headings) {
    const id = /\s\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/.exec(heading.text)?.[1];
    if (!id) addError(errors, 'markdown.heading_id', file, `heading requires a stable heading ID: ${heading.line}`);
    else if (ids.has(id)) addError(errors, 'markdown.heading_id', file, `duplicate stable heading ID: ${id}`);
    else ids.add(id);
  }
  if (/!\[[^\]\n]*\](?!\()/.test(visibleBody)) {
    addError(errors, 'markdown.image_syntax', file, 'unsupported reference-style image syntax');
  }
  if (/!\[[^\]\n]*\]\(\s*<[^>\n]*>/.test(visibleBody)) {
    addError(errors, 'markdown.image_syntax', file, 'unsupported angle-bracket image destination');
  }
  for (const image of visibleBody.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const [, alt, assetPath] = image;
    if (alt.trim() === '') addError(errors, 'markdown.image_alt', file, 'images require nonempty alt text');
    const looksRemote = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(assetPath) || assetPath.startsWith('//');
    const resolvedAsset = resolve(artifactDir, assetPath);
    const assetsRoot = resolve(artifactDir, 'assets');
    const relativeAsset = relative(assetsRoot, resolvedAsset);
    const insideAssets = relativeAsset !== '' && !isAbsolute(relativeAsset)
      && relativeAsset !== '..' && !relativeAsset.startsWith(`..${sep}`);
    if (isAbsolute(assetPath) || looksRemote || !insideAssets) {
      addError(errors, 'markdown.asset_path', file, `image must use a relative local asset path inside assets/: ${assetPath}`);
    } else {
      try {
        const stat = await lstat(resolvedAsset);
        if (!stat.isFile()) throw new Error();
      } catch {
        addError(errors, 'markdown.asset_missing', file, `referenced asset does not exist: ${assetPath}`);
      }
    }
  }
  if (/<img\b/i.test(visibleBody)) {
    addError(errors, 'markdown.image_syntax', file, 'HTML images are unsupported; use Markdown image syntax');
  }
}

export async function validateArtifact(artifactDir, { requestedFormats = [] } = {}) {
  const root = resolve(fileURLToPathIfNeeded(artifactDir));
  const errors = [];
  const warnings = [];
  const normalizedFormats = Array.isArray(requestedFormats) ? [...requestedFormats] : [];
  if (!Array.isArray(requestedFormats)) {
    addError(errors, 'options.requested_formats', null, 'requestedFormats must be an array');
  }
  let files = [];
  try {
    files = await listFiles(root);
  } catch (error) {
    addError(errors, 'artifact.directory', null, `cannot read artifact directory: ${error.message}`);
    return { ok: false, errors, warnings, files, requestedFormats: normalizedFormats };
  }
  for (const requiredFile of REQUIRED_FILES) {
    if (!files.includes(requiredFile)) addError(errors, 'artifact.required_file', requiredFile, `missing required file: ${requiredFile}`);
  }
  for (const requiredDirectory of REQUIRED_DIRECTORIES) {
    try {
      const stat = await lstat(resolve(root, requiredDirectory));
      if (!stat.isDirectory()) throw new Error();
    } catch {
      addError(errors, 'artifact.required_directory', requiredDirectory, `missing required directory: ${requiredDirectory}/`);
    }
  }
  if (files.includes('content.md')) {
    const content = await readFile(resolve(root, 'content.md'), 'utf8');
    await validateMarkdown(content, root, errors);
  }
  if (files.includes('evidence.yml')) {
    try {
      validateEvidence(parseRestrictedYaml(await readFile(resolve(root, 'evidence.yml'), 'utf8'), 'evidence.yml'), errors);
    } catch (error) {
      addError(errors, 'yaml.syntax', 'evidence.yml', `invalid evidence.yml: ${error.message}`);
    }
  }
  if (files.includes('export-manifest.yml')) {
    try {
      const manifest = parseRestrictedYaml(await readFile(resolve(root, 'export-manifest.yml'), 'utf8'), 'export-manifest.yml');
      validateManifest(manifest, normalizedFormats, errors);
    } catch (error) {
      addError(errors, 'yaml.syntax', 'export-manifest.yml', `invalid export-manifest.yml: ${error.message}`);
    }
  }
  return { ok: errors.length === 0, errors, warnings, files, requestedFormats: normalizedFormats };
}

function fileURLToPathIfNeeded(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

function cliFailure(code, message) {
  return { ok: false, errors: [{ code, file: null, message }], warnings: [], files: [], requestedFormats: [] };
}

export async function main(argv = process.argv.slice(2)) {
  if (!Array.isArray(argv) || argv.length < 1) {
    process.stderr.write(`${JSON.stringify(cliFailure('cli.usage', 'Usage: node validate-artifact.mjs <artifact-dir> [formats...]'), null, 2)}\n`);
    return 2;
  }
  try {
    const result = await validateArtifact(argv[0], { requestedFormats: argv.slice(1) });
    const output = `${JSON.stringify(result, null, 2)}\n`;
    (result.ok ? process.stdout : process.stderr).write(output);
    return result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify(cliFailure('cli.input', error instanceof Error ? error.message : String(error)), null, 2)}\n`);
    return 1;
  }
}

export function isMainModule(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (typeof argvPath !== 'string' || argvPath.length === 0) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

if (isMainModule()) process.exitCode = await main();
