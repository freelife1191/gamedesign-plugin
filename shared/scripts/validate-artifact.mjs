#!/usr/bin/env node

import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_FILES = ['content.md', 'evidence.yml', 'export-manifest.yml'];
const REQUIRED_DIRECTORIES = ['assets', 'decisions'];
const FORMATS = ['md', 'pdf', 'docx', 'pptx'];
const FORMAT_STATUSES = ['pending', 'passed', 'failed', 'unavailable'];
const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

class YamlSyntaxError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.name = 'YamlSyntaxError';
  }
}

function rejectUnsupportedYaml(source) {
  let quote = null;
  let escaped = false;
  let syntaxOnly = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === '"') {
      syntaxOnly += character === '\n' ? '\n' : ' ';
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = null;
    } else if (quote === "'") {
      syntaxOnly += character === '\n' ? '\n' : ' ';
      if (character === "'" && source[index + 1] === "'") {
        syntaxOnly += ' ';
        index += 1;
      } else if (character === "'") quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
      syntaxOnly += ' ';
    } else {
      syntaxOnly += character;
    }
  }
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
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/[:]\s|\s#/.test(value)) {
    throw new YamlSyntaxError('plain scalars cannot contain colon-space or inline comments', line);
  }
  return value;
}

function splitMappingEntry(content, line) {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/.exec(content);
  if (!match) throw new YamlSyntaxError('expected a simple mapping key followed by a colon', line);
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
    const result = {};
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

function requireString(object, field, file, errors, context = '') {
  if (typeof object?.[field] !== 'string' || object[field].trim() === '') {
    addError(errors, 'schema.required', file, `${context}${field} must be a nonempty string`);
    return false;
  }
  return true;
}

function validateEvidence(evidence, errors) {
  const file = 'evidence.yml';
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    addError(errors, 'evidence.schema', file, 'evidence must be a mapping');
    return;
  }
  if (evidence.version !== 1) addError(errors, 'evidence.version', file, 'version must be 1');
  if (!Array.isArray(evidence.claims) || evidence.claims.length === 0) {
    addError(errors, 'evidence.claims', file, 'claims must be a nonempty list');
    return;
  }
  evidence.claims.forEach((claim, index) => {
    const context = `claims[${index}].`;
    requireString(claim, 'id', file, errors, context);
    requireString(claim, 'claim_type', file, errors, context);
    requireString(claim, 'claim', file, errors, context);
    if (!claim?.source || typeof claim.source !== 'object' || Array.isArray(claim.source)) {
      addError(errors, 'evidence.source', file, `${context}source must be a mapping`);
    } else {
      requireString(claim.source, 'title', file, errors, `${context}source.`);
      if (!requireString(claim.source, 'url', file, [], '') && !requireString(claim.source, 'locator', file, [], '')) {
        addError(errors, 'evidence.source', file, `${context}source requires url or locator`);
      }
      requireString(claim.source, 'accessed_at', file, errors, `${context}source.`);
    }
    if (!CONFIDENCE_LEVELS.includes(claim?.confidence)) {
      addError(errors, 'evidence.confidence', file, `${context}confidence must be low, medium, or high`);
    }
    requireString(claim, 'limitations', file, errors, context);
  });
}

function validateManifest(manifest, requestedFormats, errors) {
  const file = 'export-manifest.yml';
  requireString(manifest, 'artifact_id', file, errors);
  if (!manifest?.formats || typeof manifest.formats !== 'object' || Array.isArray(manifest.formats)) {
    addError(errors, 'manifest.formats', file, 'formats must be a mapping');
    return;
  }
  for (const format of FORMATS) {
    const config = manifest.formats[format];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      addError(errors, 'manifest.format', file, `formats.${format} must be a mapping`);
    } else if (!FORMAT_STATUSES.includes(config.status)) {
      addError(errors, 'manifest.status', file, `formats.${format}.status must be pending, passed, failed, or unavailable`);
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
  if (requestedFormats.includes('pptx')) {
    const pptx = manifest.formats.pptx;
    requireString(pptx, 'audience', file, errors, 'formats.pptx.');
    requireString(pptx, 'purpose', file, errors, 'formats.pptx.');
    if (!Array.isArray(pptx?.slide_outline) || pptx.slide_outline.length === 0) {
      addError(errors, 'manifest.pptx_outline', file, 'formats.pptx.slide_outline must be a nonempty list');
    } else {
      pptx.slide_outline.forEach((slide, index) => {
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
      requireString(metadata, 'title', file, errors, 'frontmatter.');
      requireString(metadata, 'artifact_id', file, errors, 'frontmatter.');
      if (!Number.isInteger(metadata.version) || metadata.version < 1) {
        addError(errors, 'markdown.frontmatter', file, 'frontmatter.version must be a positive integer');
      }
    } catch (error) {
      addError(errors, 'markdown.frontmatter', file, `invalid frontmatter: ${error.message}`);
    }
  }
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  const h1Count = headings.filter((heading) => heading[1].length === 1).length;
  if (h1Count !== 1) addError(errors, 'markdown.h1', file, `Markdown must contain exactly one H1; found ${h1Count}`);
  const ids = new Set();
  for (const heading of headings) {
    const id = /\s\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/.exec(heading[2])?.[1];
    if (!id) addError(errors, 'markdown.heading_id', file, `heading requires a stable heading ID: ${heading[0]}`);
    else if (ids.has(id)) addError(errors, 'markdown.heading_id', file, `duplicate stable heading ID: ${id}`);
    else ids.add(id);
  }
  for (const image of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const [, alt, assetPath] = image;
    if (alt.trim() === '') addError(errors, 'markdown.image_alt', file, 'images require nonempty alt text');
    const looksRemote = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(assetPath) || assetPath.startsWith('//');
    const resolvedAsset = resolve(artifactDir, assetPath);
    const relativeAsset = relative(artifactDir, resolvedAsset);
    const escapesArtifact = relativeAsset === '..' || relativeAsset.startsWith(`..${sep}`);
    if (isAbsolute(assetPath) || looksRemote || escapesArtifact || !assetPath.startsWith('assets/')) {
      addError(errors, 'markdown.asset_path', file, `image must use a relative local asset path under assets/: ${assetPath}`);
    } else {
      try {
        const stat = await lstat(resolvedAsset);
        if (!stat.isFile()) throw new Error();
      } catch {
        addError(errors, 'markdown.asset_missing', file, `referenced asset does not exist: ${assetPath}`);
      }
    }
  }
  if (/!\[[^\]]*\]\([^)]*\)/.test(body) === false && /<img\b/i.test(body)) {
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

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const artifactDir = process.argv[2];
  if (!artifactDir) {
    console.error('Usage: node shared/scripts/validate-artifact.mjs <artifact-dir> [formats...]');
    process.exitCode = 2;
  } else {
    const result = await validateArtifact(artifactDir, { requestedFormats: process.argv.slice(3) });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }
}
