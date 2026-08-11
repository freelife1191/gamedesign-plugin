#!/usr/bin/env node

import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SOURCE_ROOTS = [
  "shared/templates",
  "shared/knowledge/trends",
  "guides/prompt-templates/catalog",
  "products/game-design-studio/plugin/assets/templates",
  "products/game-design-career/plugin/assets/templates",
];
const TEXT_EXTENSIONS = new Set([".md", ".json", ".yml", ".yaml"]);
const EXCLUDED_SEGMENTS = new Set(["plugins", "vendor", "node_modules", ".git"]);
const STANDARD_TERMS = new Set(["UX", "UI", "LiveOps", "API", "prompt", "token", "Markdown", "PDF", "DOCX", "PPTX", "SVG"]);

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function isExcluded(relativePath) {
  return relativePath.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

async function collectFiles(repoRoot, roots) {
  const output = [];
  async function visit(absolute) {
    const stats = await lstat(absolute).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats || stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      for (const entry of await readdir(absolute)) await visit(path.join(absolute, entry));
      return;
    }
    if (!stats.isFile() || !TEXT_EXTENSIONS.has(path.extname(absolute))) return;
    const pathname = relative(repoRoot, absolute);
    if (!isExcluded(pathname)) output.push(pathname);
  }
  for (const sourceRoot of roots) await visit(path.join(repoRoot, sourceRoot));
  return [...new Set(output)].sort();
}

function englishFirstLabel(text) {
  if (!/^#{1,6}\s+/u.test(text)) return false;
  const label = text.replace(/^#{1,6}\s+/u, "").trim();
  if (/^[a-z][a-z0-9-]*$/u.test(label)) return false;
  if (!/^[A-Za-z][A-Za-z0-9 /&-]*$/u.test(label)) return false;
  return !label.split(/[ /&-]+/u).every((word) => STANDARD_TERMS.has(word));
}

function issuesForLine(line, lineNumber, pathname, conclusions) {
  const issues = [];
  const visible = line.trim();
  if (englishFirstLabel(visible)) issues.push({ code: "ENGLISH_FIRST_LABEL", path: pathname, line: lineNumber, severity: "high", text: visible.replace(/^#{1,6}\s+/u, "") });
  if (/자동으로\s+[^.!?\n]{0,40}(?:됩니다|되었다|되었습니다|된다)\./u.test(visible)) issues.push({ code: "TRANSLATION_LIKE_PASSIVE", path: pathname, line: lineNumber, severity: "high", text: visible });
  if (/(?:최고(?:의)?|완벽(?:한)?|혁신(?:적)?)[^.!?\n]{0,50}(?:결과|품질|성공)?[^.!?\n]{0,20}보장(?:합니다|한다)\./u.test(visible)) issues.push({ code: "UNSUPPORTED_HYPE", path: pathname, line: lineNumber, severity: "high", text: visible });
  if (visible.includes("결론적으로")) {
    conclusions += 1;
    if (conclusions > 1) issues.push({ code: "REPEATED_CONCLUSION", path: pathname, line: lineNumber, severity: "high", text: "결론적으로" });
  }
  return { issues, conclusions };
}

export async function auditGameDesignDocs({ repoRoot, roots = SOURCE_ROOTS } = {}) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) throw new Error("repoRoot is required");
  if (!Array.isArray(roots) || roots.some((root) => typeof root !== "string" || root.length === 0)) throw new Error("roots must be a non-empty string array");
  const files = await collectFiles(repoRoot, roots);
  const issues = [];
  const fileResults = [];
  for (const pathname of files) {
    const markdown = await readFile(path.join(repoRoot, pathname), "utf8");
    let conclusions = 0;
    const fileIssues = [];
    for (const [index, line] of markdown.split("\n").entries()) {
      const result = issuesForLine(line, index + 1, pathname, conclusions);
      conclusions = result.conclusions;
      fileIssues.push(...result.issues);
    }
    issues.push(...fileIssues);
    fileResults.push({ path: pathname, issueCount: fileIssues.length });
  }
  return { files: fileResults, issues };
}

export function formatAuditReport(result) {
  if (!result || !Array.isArray(result.files) || !Array.isArray(result.issues)) throw new Error("audit result must contain files and issues arrays");
  const lines = [
    "# 게임 기획 문서 언어 감사",
    "",
    `검사 파일: ${result.files.length}개`,
    `고심각도 이슈: ${result.issues.length}개`,
    "",
  ];
  const grouped = new Map();
  for (const issue of result.issues) grouped.set(issue.path, [...(grouped.get(issue.path) ?? []), issue]);
  for (const [pathname, issues] of grouped) {
    lines.push(`## ${pathname}`, "");
    for (const issue of issues) lines.push(`- L${issue.line} \`${issue.code}\`: ${issue.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await auditGameDesignDocs({ repoRoot });
  process.stdout.write(formatAuditReport(result));
  if (result.issues.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
