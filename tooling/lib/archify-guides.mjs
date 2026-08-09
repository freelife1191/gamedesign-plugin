import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createGuardedTempRoot, cleanupGuardedTempRoot } from "./guarded-temp.mjs";
import { loadPromptTemplateCatalog } from "./prompt-template-catalog.mjs";
import { joinWithin } from "./paths.mjs";

const ARCHIFY_ROOT = "guides/assets/archify";
const SHOWCASE_ARGS = Object.freeze(["--quality", "showcase", "--json"]);
const WORKFLOW_KINDS = new Set(["skill-template", "recipe", "suite-case"]);

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function identifier(value) {
  return String(value).replace(/[^A-Za-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "flow";
}

function pick(values, fallback) {
  return Array.isArray(values) && values.length > 0 && typeof values[0] === "string" ? values[0] : fallback;
}

function workflowEntries(value) {
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length === 0 || entries.some((entry) => !entry || typeof entry !== "object")) {
    throw new Error("Archify workflow requires at least one catalog entry");
  }
  return entries;
}

/** Build one bounded workflow from a skill's three levels or one scenario entry. */
export function buildArchifyWorkflowSpec(value) {
  const entries = workflowEntries(value);
  const primary = entries[0];
  const skills = [...new Set(entries.flatMap((entry) => entry.skill_chain ?? [entry.skill]).filter(Boolean))];
  const roles = [...new Set(entries.flatMap((entry) => entry.specialist_roles ?? []))];
  const levels = entries.filter((entry) => entry.kind === "skill-template").map((entry) => entry.level).sort(compare);
  const hasSkillLevels = levels.length > 0;
  const views = hasSkillLevels
    ? ["beginner", "standard", "advanced"].map((level) => ({
      id: level,
      label: ({ beginner: "입문 경로", standard: "표준 경로", advanced: "고급 경로" })[level],
      focus: level === "beginner" ? ["input", "skill", "artifact"] : level === "standard"
        ? ["skill", "artifact", "review", "result"] : ["input", "skill", "review", "resume"],
      note: `${level} 프롬프트의 입력·검토·재개 경계를 확인합니다.`,
    }))
    : [{
      id: "workflow",
      label: "실행 흐름",
      focus: ["input", "skill", "artifact", "review", "result", "resume"],
      note: "입력, 역할, 검토와 재개 경계를 확인합니다.",
    }];
  const skillLabel = `${skills.length}개 스킬`;
  const roleLabel = `${roles.length}개 전문 역할`;
  return {
    schema_version: 1,
    diagram_type: "workflow",
    meta: {
      title: primary.title,
      subtitle: "입력에서 스킬·사람 검토·결과물로 이어지는 실행 흐름",
      animation: "none",
      visual_preset: "editorial",
      quality_profile: "showcase",
      views,
      viewBox: [960, 900],
    },
    lanes: [
      { id: "input-lane", label: "입력·Artifact" },
      { id: "execution-lane", label: "스킬·전문 역할" },
      { id: "review-lane", label: "검토·승인" },
      { id: "result-lane", label: "결과·재개", variant: "exception" },
    ],
    mainPath: ["input", "skill", "artifact", "review", "result"],
    nodes: [
      { id: "input", lane: "input-lane", col: 0, type: "external", label: "준비 입력", sublabel: "공개 가능한 입력" },
      { id: "skill", lane: "execution-lane", col: 1, type: "backend", label: "스킬 체인", sublabel: skillLabel },
      { id: "artifact", lane: "execution-lane", col: 3, type: "database", label: "중간 Artifact", sublabel: "작업 기록" },
      { id: "review", lane: "review-lane", col: 4, type: "security", label: "사람 검토", sublabel: roleLabel },
      { id: "result", lane: "result-lane", col: 5, type: "cloud", label: "최소 결과", sublabel: "결과 계약" },
      { id: "resume", lane: "result-lane", col: 2, type: "messagebus", label: "보류·재개", sublabel: "재개 요청" },
    ],
    edges: [
      { id: "input-skill", from: "input", to: "skill", role: "main", variant: "default" },
      { id: "skill-artifact", from: "skill", to: "artifact", role: "main", variant: "emphasis" },
      { id: "artifact-review", from: "artifact", to: "review", role: "main", variant: "default" },
      { id: "review-result", from: "review", to: "result", role: "main", variant: "emphasis" },
      { id: "review-resume", from: "review", to: "resume", role: "branch", variant: "dashed", fromSide: "bottom", toSide: "top", route: "drop" },
    ],
  };
}

function workflowId(entries) {
  const entry = entries[0];
  if (entry.kind === "skill-template") return `${entry.product}:${entry.skill}`;
  return entry.id;
}

function workflowDirectory(entries) {
  const entry = entries[0];
  if (entry.kind === "skill-template") return `${entry.product}/${entry.skill}`;
  if (entry.kind === "recipe") return `${entry.product}/recipes/${identifier(entry.id.split(":").at(-1))}`;
  return `suite/${identifier(entry.id.split(":")[1])}`;
}

function collectWorkflows(catalog, ids) {
  const selected = new Set(ids ?? []);
  const groups = new Map();
  for (const entry of catalog.entries ?? []) {
    if (!WORKFLOW_KINDS.has(entry.kind)) continue;
    const key = entry.kind === "skill-template" ? `${entry.kind}:${entry.product}:${entry.skill}` : `${entry.kind}:${entry.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const workflows = [...groups.values()].map((entries) => entries.sort((left, right) => compare(left.id, right.id))).sort((left, right) => compare(workflowId(left), workflowId(right)));
  for (const entries of workflows) {
    const primary = entries[0];
    if (primary.kind === "skill-template") {
      const levels = entries.map((entry) => entry.level).sort(compare);
      if (levels.join(",") !== "advanced,beginner,standard") throw new Error(`Archify skill workflow must have beginner, standard, advanced: ${workflowId(entries)}`);
    }
  }
  return selected.size === 0 ? workflows : workflows.filter((entries) => selected.has(workflowId(entries)) || selected.has(entries[0].id));
}

function receiptValidation(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("Archify receipt must be a JSON object");
  const validation = receipt.validation ?? receipt;
  const checks = validation.artifactChecks ?? validation.artifact_checks ?? receipt.artifactChecks ?? receipt.checks;
  const errors = validation.errors ?? receipt.errors ?? receipt.composition?.summary?.errors;
  const warnings = validation.warnings ?? receipt.warnings ?? receipt.composition?.summary?.warnings;
  const checkCount = Array.isArray(checks) ? checks.length : validation.checksPassed;
  if (checkCount !== 9 || (!Array.isArray(checks) && validation.checkCount !== 9)) throw new Error("Archify receipt must contain exactly 9 artifact checks");
  if (!(Array.isArray(errors) ? errors.length === 0 : errors === 0)) throw new Error("Archify receipt must contain 0 errors");
  if (!(Array.isArray(warnings) ? warnings.length === 0 : warnings === 0)) throw new Error("Archify receipt must contain 0 warnings");
}

/** Validate a CLI receipt and, when supplied, its immutable output bytes. */
export function validateArchifyReceipt(receipt, files = undefined) {
  receiptValidation(receipt);
  if (!files) return true;
  for (const [key, contents] of [["specification", files.specification], ["artifact", files.artifact]]) {
    const record = receipt[key];
    if (!record || typeof record.sha256 !== "string" || record.sha256 !== sha256(contents)) {
      throw new Error(`Archify ${key} digest mismatch`);
    }
    if (record.bytes !== Buffer.byteLength(contents)) throw new Error(`Archify ${key} byte count mismatch`);
  }
  return true;
}

function parseReceipt(stdout, command) {
  let receipt;
  try {
    receipt = JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`Archify ${command} must emit JSON stdout: ${error.message}`);
  }
  try {
    validateArchifyReceipt(receipt);
  } catch (error) {
    throw new Error(`${error.message}: ${stdout.trim()}`);
  }
  return receipt;
}

async function defaultRunCli(cli, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function regularFile(filename, label) {
  const stats = await lstat(filename).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats || !stats.isFile() || stats.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file: ${filename}`);
  return stats;
}

async function safeDirectory(filename, label) {
  const stats = await lstat(filename);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} must be a non-symlink directory: ${filename}`);
  return { filename, dev: stats.dev, ino: stats.ino, canonical: await realpath(filename) };
}

async function assertDirectoryStable(record, label) {
  const stats = await lstat(record.filename);
  if (!stats.isDirectory() || stats.isSymbolicLink() || stats.dev !== record.dev || stats.ino !== record.ino || await realpath(record.filename) !== record.canonical) {
    throw new Error(`${label} identity changed: ${record.filename}`);
  }
}

async function existingOutput(root, relative, label) {
  const target = joinWithin(root, relative, label);
  await regularFile(target, label);
  if (!isWithin(root, await realpath(target))) throw new Error(`${label} escapes repository: ${relative}`);
  return target;
}

export async function resolveArchifyCli({ env = process.env, home = os.homedir() } = {}) {
  const roots = [];
  if (typeof env.CODEX_HOME === "string" && env.CODEX_HOME.length > 0) roots.push(path.join(env.CODEX_HOME, "skills", "archify"));
  roots.push(path.join(home, ".agents", "skills", "archify"));
  for (const root of roots) {
    try {
      const rootRecord = await safeDirectory(root, "Archify host skill");
      const skill = path.join(rootRecord.filename, "SKILL.md");
      const manifest = path.join(rootRecord.filename, "package.json");
      const cli = path.join(rootRecord.filename, "bin", "archify.mjs");
      await Promise.all([regularFile(skill, "Archify SKILL.md"), regularFile(manifest, "Archify package manifest"), regularFile(cli, "Archify CLI")]);
      const version = JSON.parse(await readFile(manifest, "utf8")).version;
      if (!/^2\.(?:1[3-9]|[2-9][0-9])(?:\.|$)/u.test(String(version))) continue;
      return cli;
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      if (/must be a regular|must be a non-symlink/u.test(String(error?.message))) continue;
      throw error;
    }
  }
  throw new Error("Archify host capability is unavailable; preserve the Skillstead fallback");
}

async function execute(cli, runCli, command, specPath, htmlPath = undefined) {
  const args = command === "validate"
    ? ["validate", "workflow", specPath, ...SHOWCASE_ARGS]
    : ["deliver", "workflow", specPath, htmlPath, ...SHOWCASE_ARGS];
  const result = await (runCli ? runCli(args) : defaultRunCli(cli, args));
  if (!result || result.code !== 0) {
    const diagnostic = String(result?.stderr || result?.stdout || "non-zero exit").trim();
    throw new Error(`Archify ${command} failed: ${diagnostic}`);
  }
  return parseReceipt(String(result.stdout ?? ""), command);
}

async function writeWorkflow(stageRoot, workflow) {
  const relativeDirectory = workflowDirectory(workflow.entries);
  const outputDirectory = path.join(stageRoot, "archify", relativeDirectory);
  await mkdir(outputDirectory, { recursive: true });
  const specPath = path.join(outputDirectory, "flow.json");
  const htmlPath = path.join(outputDirectory, "flow.html");
  const specification = stableJson(buildArchifyWorkflowSpec(workflow.entries));
  await writeFile(specPath, specification, "utf8");
  return { ...workflow, relativeDirectory, specPath, htmlPath, specification };
}

function workflowManifest(records) {
  return {
    schema_version: 1,
    workflows: records.map((record) => ({
      id: workflowId(record.entries),
      kind: record.entries[0].kind,
      product: record.entries[0].product,
      spec: `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.json`,
      html: `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.html`,
      receipt: `${ARCHIFY_ROOT}/${record.relativeDirectory}/receipt.json`,
    })).sort((left, right) => compare(left.id, right.id)),
  };
}

function persistedReceipt(receipt, relativeDirectory) {
  const stable = JSON.parse(JSON.stringify(receipt));
  stable.input = `${ARCHIFY_ROOT}/${relativeDirectory}/flow.json`;
  stable.output = `${ARCHIFY_ROOT}/${relativeDirectory}/flow.html`;
  return stable;
}

async function compareCurrent(root, relative, candidate) {
  const currentPath = await existingOutput(root, relative, "Archify output");
  const current = await readFile(currentPath);
  if (!current.equals(Buffer.from(candidate))) throw new Error(`Archify generated output drift: ${relative}`);
}

async function assertExistingOutputsSafe(root, records) {
  for (const record of records) {
    await existingOutput(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.json`, "Archify output");
    await existingOutput(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.html`, "Archify output");
    await existingOutput(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/receipt.json`, "Archify output");
  }
  await existingOutput(root, `${ARCHIFY_ROOT}/manifest.json`, "Archify output");
}

/** Build or verify all Archify workflow artifacts in one guarded transaction. */
export async function buildArchifyGuides({ repoRoot, check = false, ids = undefined, runCli = undefined, __testCatalog = undefined, cliPath = undefined } = {}) {
  const root = await realpath(repoRoot);
  const catalog = __testCatalog ?? await loadPromptTemplateCatalog({ repoRoot: root });
  const workflows = collectWorkflows(catalog, ids);
  if (workflows.length === 0) throw new Error("Archify workflow catalog is empty");
  const guides = await safeDirectory(joinWithin(root, "guides", "guides directory"), "guides directory");
  const assets = await safeDirectory(joinWithin(root, "guides/assets", "assets directory"), "assets directory");
  const existingRoot = path.join(assets.filename, "archify");
  const existingStats = await lstat(existingRoot).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (existingStats && (!existingStats.isDirectory() || existingStats.isSymbolicLink())) throw new Error(`Archify output root must be a non-symlink directory: ${existingRoot}`);
  const originalOutput = existingStats ? { dev: existingStats.dev, ino: existingStats.ino } : null;
  const temp = await createGuardedTempRoot({ parent: assets.filename, prefix: ".archify-guides-" });
  let backup;
  let failure;
  try {
    const cli = runCli ? undefined : (cliPath ?? await resolveArchifyCli());
    const records = [];
    for (const entries of workflows) {
      const record = await writeWorkflow(temp.root, { entries });
      await execute(cli, runCli, "validate", record.specPath);
      const receipt = await execute(cli, runCli, "deliver", record.specPath, record.htmlPath);
      await regularFile(record.htmlPath, "Archify delivered HTML");
      const artifact = await readFile(record.htmlPath, "utf8");
      validateArchifyReceipt(receipt, { specification: record.specification, artifact });
      const receiptPath = path.join(path.dirname(record.specPath), "receipt.json");
      const savedReceipt = stableJson(persistedReceipt(receipt, record.relativeDirectory));
      await writeFile(receiptPath, savedReceipt, "utf8");
      records.push({ ...record, artifact, receipt: savedReceipt });
    }
    const manifest = stableJson(workflowManifest(records));
    const stagedRoot = path.join(temp.root, "archify");
    await writeFile(path.join(stagedRoot, "manifest.json"), manifest, "utf8");
    const publishedManifest = path.join(existingRoot, "manifest.json");
    const publishedManifestStats = await lstat(publishedManifest).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (publishedManifestStats) await assertExistingOutputsSafe(root, records);
    if (check) {
      for (const record of records) {
        await compareCurrent(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.json`, record.specification);
        await compareCurrent(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/flow.html`, record.artifact);
        await compareCurrent(root, `${ARCHIFY_ROOT}/${record.relativeDirectory}/receipt.json`, record.receipt);
      }
      await compareCurrent(root, `${ARCHIFY_ROOT}/manifest.json`, manifest);
      return { workflows: records.length, checked: true };
    }
    await assertDirectoryStable(guides, "guides directory");
    await assertDirectoryStable(assets, "assets directory");
    const currentStats = await lstat(existingRoot).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (originalOutput && (!currentStats || !currentStats.isDirectory() || currentStats.isSymbolicLink() || currentStats.dev !== originalOutput.dev || currentStats.ino !== originalOutput.ino)) {
      throw new Error(`Archify output root identity changed: ${existingRoot}`);
    }
    if (!originalOutput && currentStats) throw new Error(`Archify output root appeared during build: ${existingRoot}`);
    if (originalOutput) {
      backup = path.join(assets.filename, `.archify-guides-backup-${randomUUID()}`);
      await rename(existingRoot, backup);
    }
    await assertDirectoryStable(assets, "assets directory");
    await rename(stagedRoot, existingRoot);
    if (backup) await rm(backup, { recursive: true, force: false });
    return { workflows: records.length, checked: false };
  } catch (error) {
    failure = error;
    if (backup) {
      const current = await lstat(existingRoot).catch(() => null);
      if (!current) await rename(backup, existingRoot).catch(() => {});
    }
    throw error;
  } finally {
    await cleanupGuardedTempRoot(temp).catch((cleanupError) => {
      if (!failure) throw cleanupError;
    });
  }
}
