import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
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

function uniqueValues(entries, field) {
  return [...new Set(entries.flatMap((entry) => Array.isArray(entry[field]) ? entry[field] : [entry[field]]).filter((value) => typeof value === "string" && value.length > 0))];
}

function visibleList(values, fallback = "미정") {
  return values.length > 0 ? values.join(" · ") : fallback;
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
  const inputs = uniqueValues(entries, "required_inputs");
  const skills = entries.map((entry) => `${entry.level ?? entry.id}: ${entry.skill_chain.join(" → ")}`);
  const roles = uniqueValues(entries, "specialist_roles");
  const artifacts = uniqueValues(entries, "intermediate_artifacts");
  const minimum = uniqueValues(entries, "minimum_outputs");
  const optional = uniqueValues(entries, "optional_outputs");
  const extended = uniqueValues(entries, "extended_outputs");
  const reviews = uniqueValues(entries, "human_review_boundary");
  const holds = uniqueValues(entries, "hold_conditions");
  const resumes = uniqueValues(entries, "resume_prompt");
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
      { id: "input", lane: "input-lane", col: 0, type: "external", label: "준비 입력" },
      { id: "skill", lane: "execution-lane", col: 1, type: "backend", label: "순서 스킬 체인" },
      { id: "artifact", lane: "execution-lane", col: 3, type: "database", label: "중간 Artifact" },
      { id: "review", lane: "review-lane", col: 4, type: "security", label: "사람 검토·승인" },
      { id: "result", lane: "result-lane", col: 5, type: "cloud", label: "결과 계약" },
      { id: "hold", lane: "review-lane", col: 2, type: "security", label: "보류 조건" },
      { id: "resume", lane: "result-lane", col: 0, type: "messagebus", label: "재개 요청" },
    ],
    edges: [
      { id: "input-skill", from: "input", to: "skill", role: "main", variant: "default" },
      { id: "skill-artifact", from: "skill", to: "artifact", role: "main", variant: "emphasis" },
      { id: "artifact-review", from: "artifact", to: "review", role: "main", variant: "default" },
      { id: "review-result", from: "review", to: "result", role: "main", variant: "emphasis" },
      { id: "review-hold", from: "review", to: "hold", label: "승인 보류", role: "branch", variant: "dashed", fromSide: "left", toSide: "right", route: "return-left" },
      { id: "hold-resume", from: "hold", to: "resume", label: "보존 후 재개", role: "return", variant: "dashed", fromSide: "bottom", toSide: "top", route: "drop" },
      { id: "resume-skill", from: "resume", to: "skill", role: "return", variant: "emphasis", fromSide: "top", toSide: "bottom", route: "up-channel" },
    ],
    cards: [
      { dot: "cyan", title: "준비 입력", items: inputs },
      { dot: "violet", title: "순서 스킬 체인", items: skills },
      { dot: "emerald", title: "전문 역할과 중간 Artifact", items: [...roles, ...artifacts] },
      { dot: "amber", title: "사람 검토와 결과 계약", items: [...reviews, ...minimum, ...optional, ...extended] },
      { dot: "rose", title: "보류와 재개", items: [...holds, ...resumes] },
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

export function collectArchifyWorkflows(catalog, ids) {
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

function receiptValidation(receipt, expectedCommand = undefined) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("Archify receipt must be a JSON object");
  if (receipt.schemaVersion !== 1 || receipt.ok !== true) throw new Error("Archify receipt schemaVersion=1 and ok=true are required");
  const validation = receipt.validation ?? receipt;
  const command = expectedCommand ?? receipt.command;
  if (!(["validate", "deliver"].includes(command)) || receipt.command !== command) throw new Error("Archify receipt command is invalid");
  if (receipt.type !== "workflow") throw new Error("Archify receipt type must be workflow");
  const checks = validation.artifactChecks ?? validation.artifact_checks ?? receipt.artifactChecks ?? receipt.checks;
  const errors = validation.errors ?? receipt.errors ?? receipt.composition?.summary?.errors;
  const warnings = validation.warnings ?? receipt.warnings ?? receipt.composition?.summary?.warnings;
  if (!(Array.isArray(errors) ? errors.length === 0 : errors === 0)) throw new Error("Archify receipt must contain 0 errors");
  if (!(Array.isArray(warnings) ? warnings.length === 0 : warnings === 0)) throw new Error("Archify receipt must contain 0 warnings");
  if (command === "validate") {
    if (!Array.isArray(checks) || checks.length !== 9) throw new Error("Archify validate receipt must contain exactly 9 artifact checks");
    const names = new Set();
    for (const check of checks) {
      if (!check || typeof check.name !== "string" || check.name.length === 0 || check.ok !== true || names.has(check.name)) throw new Error("Archify validate receipt has an invalid artifact check");
      names.add(check.name);
    }
    if (receipt.composition?.profile !== "showcase" || receipt.composition?.status !== "pass") throw new Error("Archify validate receipt must use showcase composition");
  } else {
    if (validation.checksPassed !== 9 || validation.checkCount !== 9) throw new Error("Archify deliver receipt must contain exactly 9 artifact checks");
    if (validation.compositionProfile !== "showcase") throw new Error("Archify deliver receipt must use showcase composition");
    if (validation.compositionStatus !== "pass") throw new Error("Archify deliver receipt must pass composition");
  }
}

/** Validate a CLI receipt and, when supplied, its immutable output bytes. */
export function validateArchifyReceipt(receipt, files = undefined, { command = undefined } = {}) {
  receiptValidation(receipt, command);
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
    validateArchifyReceipt(receipt, undefined, { command });
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

async function assertContainedRegularPath(root, filename, label) {
  const canonicalRoot = await realpath(root);
  const relative = path.relative(canonicalRoot, filename);
  if (!isWithin(canonicalRoot, filename)) throw new Error(`${label} escapes its guarded root: ${filename}`);
  let current = canonicalRoot;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) throw new Error(`${label} contains a symlink: ${current}`);
  }
  await regularFile(filename, label);
  if (!isWithin(canonicalRoot, await realpath(filename))) throw new Error(`${label} escapes its guarded root: ${filename}`);
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

async function execute(cli, runCli, command, specPath, htmlPath = undefined, stageRoot = undefined) {
  if (stageRoot) await assertContainedRegularPath(stageRoot, specPath, "Archify specification");
  if (!runCli) await assertContainedRegularPath(path.dirname(path.dirname(cli)), cli, "Archify CLI");
  const args = command === "validate"
    ? ["validate", "workflow", specPath, ...SHOWCASE_ARGS]
    : ["deliver", "workflow", specPath, htmlPath, ...SHOWCASE_ARGS];
  const result = await (runCli ? runCli(args) : defaultRunCli(cli, args));
  if (!result || result.code !== 0) {
    const diagnostic = String(result?.stderr || result?.stdout || "non-zero exit").trim();
    throw new Error(`Archify ${command} failed: ${diagnostic}`);
  }
  if (stageRoot) {
    await assertContainedRegularPath(stageRoot, specPath, "Archify specification");
    if (htmlPath) await assertContainedRegularPath(stageRoot, htmlPath, "Archify delivered HTML");
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
  const validation = receipt.validation ?? {};
  const stable = {
    schemaVersion: receipt.schemaVersion,
    ok: receipt.ok,
    command: receipt.command,
    type: receipt.type,
    input: `${ARCHIFY_ROOT}/${relativeDirectory}/flow.json`,
    output: `${ARCHIFY_ROOT}/${relativeDirectory}/flow.html`,
    validation: {
      checksPassed: validation.checksPassed,
      checkCount: validation.checkCount,
      compositionProfile: validation.compositionProfile,
      compositionStatus: validation.compositionStatus,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    specification: { sha256: receipt.specification?.sha256, bytes: receipt.specification?.bytes },
    artifact: { sha256: receipt.artifact?.sha256, bytes: receipt.artifact?.bytes },
  };
  const rejectUnsafe = (value) => {
    if (typeof value === "string" && (path.isAbsolute(value) || value.includes(".archify-guides-") || value.includes("/tmp/"))) throw new Error("Archify persisted receipt contains an unsafe path");
    if (Array.isArray(value)) value.forEach(rejectUnsafe);
    else if (value && typeof value === "object") Object.values(value).forEach(rejectUnsafe);
  };
  rejectUnsafe(stable);
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

async function assertExactManagedSet(root, records) {
  const expected = new Set(["manifest.json"]);
  for (const record of records) for (const filename of ["flow.json", "flow.html", "receipt.json"]) expected.add(`${record.relativeDirectory}/${filename}`);
  const base = joinWithin(root, ARCHIFY_ROOT, "Archify output root");
  const found = new Set();
  async function walk(directory, relative = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      const target = path.join(directory, entry.name);
      const stats = await lstat(target);
      if (stats.isSymbolicLink()) throw new Error(`Archify managed output contains symlink: ${next}`);
      if (stats.isDirectory()) await walk(target, next);
      else if (stats.isFile()) found.add(next);
      else throw new Error(`Archify managed output contains unsafe entry: ${next}`);
    }
  }
  await walk(base);
  if (found.size !== expected.size || [...found].some((item) => !expected.has(item))) throw new Error("Archify managed output has stale or unexpected files");
}

/** Build or verify all Archify workflow artifacts in one guarded transaction. */
export async function buildArchifyGuides({ repoRoot, check = false, ids = undefined, runCli = undefined, __testCatalog = undefined, cliPath = undefined, __testHooks = undefined } = {}) {
  const root = await realpath(repoRoot);
  const catalog = __testCatalog ?? await loadPromptTemplateCatalog({ repoRoot: root });
  const workflows = collectArchifyWorkflows(catalog, ids);
  if (workflows.length === 0) throw new Error("Archify workflow catalog is empty");
  const guides = await safeDirectory(joinWithin(root, "guides", "guides directory"), "guides directory");
  const assets = await safeDirectory(joinWithin(root, "guides/assets", "assets directory"), "assets directory");
  const existingRoot = path.join(assets.filename, "archify");
  const existingStats = await lstat(existingRoot).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (existingStats && (!existingStats.isDirectory() || existingStats.isSymbolicLink())) throw new Error(`Archify output root must be a non-symlink directory: ${existingRoot}`);
  const originalOutput = existingStats ? { dev: existingStats.dev, ino: existingStats.ino } : null;
  const temp = await createGuardedTempRoot({ parent: assets.filename, prefix: ".archify-guides-" });
  let backup;
  let quarantine;
  let failure;
  let published = false;
  let tempCleaned = false;
  try {
    const cli = runCli ? undefined : (cliPath ?? await resolveArchifyCli());
    const records = [];
    for (const entries of workflows) {
      const record = await writeWorkflow(temp.root, { entries });
      await execute(cli, runCli, "validate", record.specPath, undefined, temp.root);
      const receipt = await execute(cli, runCli, "deliver", record.specPath, record.htmlPath, temp.root);
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
      await assertExactManagedSet(root, records);
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
      const backupTarget = path.join(assets.filename, `.archify-guides-backup-${randomUUID()}`);
      await __testHooks?.beforeRename?.({ phase: "backup", target: existingRoot });
      await rename(existingRoot, backupTarget);
      backup = backupTarget;
    }
    await assertDirectoryStable(assets, "assets directory");
    await __testHooks?.beforeRename?.({ phase: "publish", target: existingRoot });
    await rename(stagedRoot, existingRoot);
    published = true;
    await __testHooks?.afterPublish?.({ target: existingRoot });
    await __testHooks?.beforeTempCleanup?.();
    await cleanupGuardedTempRoot(temp);
    tempCleaned = true;
    await __testHooks?.beforeBackupCleanup?.({ backup });
    if (backup) await rm(backup, { recursive: true, force: false });
    return { workflows: records.length, checked: false };
  } catch (error) {
    failure = error;
    const recovery = [];
    try {
      if (published) {
        const current = await lstat(existingRoot).catch(() => null);
        if (current) {
          quarantine = path.join(assets.filename, `.archify-guides-quarantine-${randomUUID()}`);
          await rename(existingRoot, quarantine);
        }
      }
      if (backup) {
        await __testHooks?.beforeRestore?.({ backup, target: existingRoot });
        await rename(backup, existingRoot);
      }
      if (quarantine) await rm(quarantine, { recursive: true, force: false });
    } catch (rollbackError) { recovery.push(rollbackError); }
    if (recovery.length) throw new AggregateError([error, ...recovery], "Archify publication failed and rollback preserved forensic paths");
    throw error;
  } finally {
    if (!tempCleaned) await cleanupGuardedTempRoot(temp).catch((cleanupError) => {
      if (!failure) throw cleanupError;
    });
  }
}
