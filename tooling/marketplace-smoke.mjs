#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, cp, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";
import { artifactTreeIdentity, runMarketplaceProof, validateRouteReceipt } from "./lib/marketplace-proof-harness.mjs";
import { posixPermissionBitsMeaningful } from "../shared/scripts/lib/platform-file-hardening.mjs";

const MARKETPLACE = "game-design-suite";
export const RELEASE_PLUGIN_VERSION = "0.2.0";
const VERSION_PREFLIGHT_ERROR = "marketplace version preflight failed";
export const PACKAGED_SKILL_COUNTS = Object.freeze({
  "game-design-career": 25,
  "game-design-studio": 26,
});
export const CODEX_EXEC_TIMEOUT_MS = 300_000;
const PRODUCTS = Object.freeze([
  {
    name: "game-design-career",
    displayName: "Game Design Career",
    request: "신입 게임 기획자의 4주 학습 계획을 주차별 목표와 점검 기준이 있는 한 장 계획으로 정리해 주세요. 본문에 '4주 학습 계획'을 그대로 한 번 포함하세요.",
    contentPatterns: [/4주 학습 계획/u, /주차/u, /(?:목표|점검 기준)/u],
    expectedRoute: "junior-growth-plan",
    expectedSkill: "plan-junior-growth",
    representative: {
      id: "career-entry-orchestration",
      entrySkill: "game-design-career",
      request: "게임 기획 입문자가 어떤 역할을 먼저 검토하고, 4주 학습 계획과 포트폴리오 증거를 어떻게 연결할지 함께 정리해 주세요.",
      contentPatterns: [/4주/u, /(?:학습|주차)/u, /(?:역할|직무)/u, /(?:포트폴리오|증거)/u],
      expectedRoute: "entry-intake",
      expectedSkill: "orchestrate-game-design-career",
      mergeKeys: ["severity", "evidence-gap-id", "artifact-section-id", "role-priority"],
    },
  },
  {
    name: "game-design-studio",
    displayName: "Game Design Studio",
    request: "모바일 협동 RPG의 핵심 재미를 짧은 기획 요약서로 정리해 주세요. 본문 문장에 '모바일 협동 RPG의 핵심 재미'를 그대로 한 번 포함하세요.",
    contentPatterns: [/모바일 협동 RPG의 핵심 재미/u],
    expectedRoute: "vision",
    expectedSkill: "define-game-vision",
    representative: {
      id: "studio-entry-orchestration",
      entrySkill: "game-design-studio",
      request: "모바일 협동 RPG의 핵심 경험, 첫 튜토리얼, 출시 범위를 함께 정리해 주세요. 핵심 경험과 출시 범위는 서로 영향을 주므로 하나의 복합 기획으로 다뤄야 합니다.",
      contentPatterns: [/모바일/u, /(?:협동|협력)/u, /RPG/u, /(?:튜토리얼|첫 세션)/u, /(?:출시 범위|범위)/u],
      expectedRoute: "project-orchestration",
      expectedSkill: "orchestrate-game-design-project",
      mergeKeys: ["severity", "affectedSectionId", "rolePriority"],
    },
  },
]);
export const PROOF_HARNESS_PATH = fileURLToPath(new URL("./lib/marketplace-proof-harness.mjs", import.meta.url));
const TOOLING_ROOT = fileURLToPath(new URL(".", import.meta.url));

function safeJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildProofCommand(nodePath, proofPath, ...args) {
  return [nodePath, proofPath, ...args].map(shellQuote).join(" ");
}

export function buildMarketplacePrompt(product, artifactPath) {
  return [
    `설치된 ${product.displayName} 플러그인으로 다음 요청을 처리하세요.`,
    `요청: ${product.request}`,
    "사용자가 스킬 이름이나 사례 ID를 모른다고 가정하고, 요청에 맞는 작업 경로를 스스로 고르세요.",
    `검토할 수 있는 게임 기획 결과물을 ${artifactPath} 에 생성하세요.`,
    "설치 플러그인의 assets/shared/templates/canonical-artifact 기준 템플릿은 실행 도구가 결과물 루트에 미리 복사했습니다.",
    "파일을 새로 만들거나 구조를 다시 쓰지 말고 content.md의 본문만 요청에 맞게 짧게 고치세요. frontmatter, 제목, 소제목과 {#heading-id}는 그대로 둡니다.",
    "export-manifest.yml의 artifact_id, formats, status 구조와 evidence.yml, decisions/, assets/는 바꾸지 마세요.",
    "기존 route-receipt.json의 schemaVersion, requestSha256, bindingNonce는 그대로 보존하고 설치된 routing registry에서 선택한 routeId만 채운 뒤 결과물을 작성하세요.",
    "설치 안내 문서의 경로·SHA-256과 선택 경로의 검증은 runner가 설치본에서 직접 수행합니다.",
    "검증용 작업이므로 필요한 파일만 짧게 작성하세요. 외부 조사, 이미지 생성, 추가 형식 생성, 사용자 질문은 하지 마세요.",
    "작업을 마친 뒤 짧게 완료만 보고하세요.",
  ].join("\n");
}

export function buildRepresentativeMarketplacePrompt(product, artifactPath) {
  return [
    `설치된 ${product.displayName} 플러그인의 대표 진입점 \`${`$${product.name}:${product.entrySkill}`}\`으로 다음 복합 요청을 처리하세요.`,
    `요청: ${product.request}`,
    "대표 진입점이 선택한 실제 스킬 또는 오케스트레이터를 실행하고, 설치된 routing registry 밖의 경로를 만들지 마세요.",
    "첫 번째 최종 메시지는 분석이나 조언보다 먼저 아래 형식을 그대로 복사해 줄마다 한 항목씩 출력하세요. 각 줄 앞의 `- `는 선택 사항이지만, 항목 이름과 순서는 바꾸지 마세요.",
    `소유 제품: ${product.name}`,
    `선택 스킬: ${product.expectedSkill}`,
    `선택 스킬 줄에는 대표 진입점 ${product.entrySkill} 자체가 아니라, route-receipt.json이 가리키는 실제 전달 대상 ${product.expectedSkill}만 적으세요.`,
    "교차 제품 핸드오프: 없음 또는 확인한 handoff 경로",
    `결과물 경로: ${artifactPath}`,
    "현재 사실·가정·차단 요인: 확인한 사실과 미정 항목",
    "다음 사람 결정: 사람이 결정할 다음 항목",
    "검토 역할: <1명 이상 3명 이하의 역할 ID>",
    "역할 근거: <역할 ID> | evidence: <검토한 경로> | findings: <한 줄 결과>",
    `결정적 병합: ${product.mergeKeys.join(" > ")}`,
    "검증: route-receipt.json 요청 바인딩과 artifact validator를 통과",
    "선택 스킬과 역할은 실제로 실행한 설치본 경로만 적으세요. 위 형식의 값이 실제 route-receipt.json과 다르면 검증이 실패합니다.",
    "검토 역할은 1명 이상 3명 이하로 지정하고, 모든 역할에 역할 근거 줄을 하나씩 남기세요.",
    `검토할 수 있는 게임 기획 결과물을 ${artifactPath} 에 생성하세요.`,
    "설치 플러그인의 assets/shared/templates/canonical-artifact 기준 템플릿은 실행 도구가 결과물 루트에 미리 복사했습니다.",
    "파일을 새로 만들거나 구조를 다시 쓰지 말고 content.md의 본문만 요청에 맞게 짧게 고치세요. frontmatter, 제목, 소제목과 {#heading-id}는 그대로 둡니다.",
    "export-manifest.yml의 artifact_id, formats, status 구조와 evidence.yml, decisions/, assets/는 바꾸지 마세요.",
    "기존 route-receipt.json의 schemaVersion, requestSha256, bindingNonce는 그대로 보존하고 설치된 routing registry에서 선택한 routeId만 채운 뒤 결과물을 작성하세요.",
    "검증용 작업이므로 필요한 파일만 짧게 작성하세요. 외부 조사, 이미지 생성, 추가 형식 생성, 사용자 질문은 하지 마세요.",
  ].join("\n");
}

const REPRESENTATIVE_RECEIPT_LABELS = Object.freeze([
  "소유 제품:",
  "선택 스킬:",
  "교차 제품 핸드오프:",
  "결과물 경로:",
  "현재 사실·가정·차단 요인:",
  "다음 사람 결정:",
]);

export function describeRepresentativeReceiptFormat(message) {
  if (typeof message !== "string") return [];
  return message.split(/\r?\n/u).filter(Boolean).slice(0, 6).map((line) => {
    const trimmed = line.trim();
    const bullet = /^(?:[-*+]|\d+\.)\s+/u.test(trimmed);
    const normalized = trimmed.replace(/^(?:[-*+]|\d+\.)\s+/u, "");
    const label = REPRESENTATIVE_RECEIPT_LABELS.find((candidate) => normalized.startsWith(candidate)) ?? "unrecognized";
    return `${bullet ? "bullet" : "plain"}:${label}`;
  });
}

export function describeRepresentativeReceiptIdentity(message, { product, selectedSkill, entrySkill }) {
  if (typeof message !== "string") return { product: "missing", skill: "missing" };
  const lines = message.split(/\r?\n/u)
    .map((line) => line.trim().replace(/^(?:[-*+]|\d+\.)\s+/u, "")).filter(Boolean);
  const valueFor = (label) => {
    const line = lines.find((candidate) => candidate.startsWith(label));
    return line ? line.slice(label.length).trim() : "";
  };
  const unwrap = (value) => {
    const code = /^`([^`\r\n]+)`$/u.exec(value);
    if (code) return code[1];
    const emphasis = /^(?:\*\*|__)([^\r\n]+)(?:\*\*|__)$/u.exec(value);
    return emphasis ? emphasis[1] : value;
  };
  const classify = (value, expected, entry, namespace) => {
    const normalized = unwrap(value);
    if (!normalized) return "missing";
    if (normalized === expected) return "expected";
    if (normalized === entry) return "entry-skill";
    if ([`${namespace}:${expected}`, `$${namespace}:${expected}`].includes(normalized)) return "namespaced-expected";
    if ([`${namespace}:${entry}`, `$${namespace}:${entry}`].includes(normalized)) return "namespaced-entry-skill";
    if (normalized.includes(expected)) return "contains-expected";
    if (normalized.includes(entry)) return "contains-entry-skill";
    return "other";
  };
  return {
    product: classify(valueFor("소유 제품:"), product, product, product),
    skill: classify(valueFor("선택 스킬:"), selectedSkill, entrySkill, product),
  };
}

export function summarizeCodexExecEvents(source) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  const messages = events.filter((event) => event.type === "item.completed" && event.item?.type === "agent_message"
    && typeof event.item.text === "string").map((event) => event.item.text);
  const installedSkillRead = events.some((event) => event.type === "item.completed" && event.item?.type === "command_execution"
    && typeof event.item.command === "string" && /(?:^|[/\\])skills[/\\][a-z0-9-]+[/\\]SKILL\.md\b/iu.test(event.item.command));
  return {
    agentMessageCount: messages.length,
    agentMessageFormats: messages.map((message) => describeRepresentativeReceiptFormat(message)),
    installedSkillRead,
  };
}

function representativeReceiptError(kind) {
  return new Error(`representative ${kind} contract mismatch`);
}

function normalizeReceiptIdentifier(value) {
  const match = /^`([^`\r\n]+)`$/u.exec(value);
  return match ? match[1] : value;
}

export function assertRepresentativeReceipt(message, {
  product, productDisplayName, selectedSkill, allowedRoles, mergeKeys,
}) {
  if (typeof message !== "string") throw representativeReceiptError("routing receipt");
  const lines = message.split(/\r?\n/u)
    .map((line) => line.trim().replace(/^(?:[-*+]|\d+\.)\s+/u, "")).filter(Boolean);
  if (lines.length < REPRESENTATIVE_RECEIPT_LABELS.length
      || REPRESENTATIVE_RECEIPT_LABELS.some((label, index) => !lines[index].startsWith(label))) {
    throw representativeReceiptError("routing receipt");
  }
  const values = REPRESENTATIVE_RECEIPT_LABELS.map((label, index) => lines[index].slice(label.length).trim());
  if (values.some((value) => value.length === 0)) throw representativeReceiptError("routing receipt values");
  const productValue = normalizeReceiptIdentifier(values[0]);
  const skillValue = normalizeReceiptIdentifier(values[1]);
  const normalizedSkillValue = [
    `${product}:${selectedSkill}`,
    `$${product}:${selectedSkill}`,
  ].includes(skillValue) ? selectedSkill : skillValue;
  if (productValue !== product) {
    if (productValue === productDisplayName) throw representativeReceiptError("routing product display name");
    throw representativeReceiptError("routing product");
  }
  if (normalizedSkillValue !== selectedSkill) throw representativeReceiptError("routing skill");

  const roleLine = lines.find((line) => line.startsWith("검토 역할:"));
  if (!roleLine) throw representativeReceiptError("role");
  const roleValue = roleLine.slice("검토 역할:".length).trim();
  const roles = allowedRoles.filter((role) => new RegExp(`(?:^|[^a-z0-9-])${role}(?:$|[^a-z0-9-])`, "u").test(roleValue));
  const unknownRoleIds = (roleValue.match(/[a-z][a-z0-9]*(?:-[a-z0-9]+)+/gu) ?? [])
    .filter((role) => role !== product && !allowedRoles.includes(role));
  if (roles.length < 1 || roles.length > 3 || new Set(roles).size !== roles.length
      || unknownRoleIds.length > 0) throw representativeReceiptError("role");
  const evidenceLines = lines.filter((line) => line.startsWith("역할 근거:"));
  for (const role of roles) {
    const evidenceLine = evidenceLines.find((line) => new RegExp(`(?:^|[^a-z0-9-])${role}(?:$|[^a-z0-9-])`, "u").test(line));
    if (!evidenceLine || !/\| evidence: (?!미정(?:\s|$))\S+/u.test(evidenceLine)
        || !/\| findings: \S+/u.test(evidenceLine)) throw representativeReceiptError("role evidence");
  }

  const expectedMerge = mergeKeys.join(" > ");
  if (!lines.includes(`결정적 병합: ${expectedMerge}`)) throw representativeReceiptError("merge");
  const proofLine = lines.find((line) => line.startsWith("검증:"));
  if (!proofLine || !/route-receipt\.json/u.test(proofLine) || !/artifact validator/u.test(proofLine)) {
    throw representativeReceiptError("proof");
  }
  return {
    roles,
    receipt: Object.fromEntries(REPRESENTATIVE_RECEIPT_LABELS.map((label, index) => [
      label.slice(0, -1),
      index === 0 ? normalizeReceiptIdentifier(values[index])
        : index === 1 ? normalizedSkillValue : values[index],
    ])),
  };
}

export function firstAgentMessage(source) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  const message = events.find((event) => event.type === "item.completed" && event.item?.type === "agent_message"
    && typeof event.item.text === "string" && event.item.text.trim().length > 0)?.item.text;
  if (!message) throw representativeReceiptError("agent message");
  return message;
}

export function firstRoutingReceiptMessage(source) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  const messages = events.filter((event) => event.type === "item.completed" && event.item?.type === "agent_message"
    && typeof event.item.text === "string").map((event) => event.item.text);
  const receipt = messages.find((message) => {
    const lines = message.split(/\r?\n/u)
      .map((line) => line.trim().replace(/^(?:[-*+]|\d+\.)\s+/u, "")).filter(Boolean);
    return REPRESENTATIVE_RECEIPT_LABELS.every((label, index) => lines[index]?.startsWith(label));
  });
  if (!receipt) throw representativeReceiptError("routing receipt");
  return receipt;
}

export function selectSmokeScenarios(scenarios, scenarioIds) {
  if (scenarioIds === undefined) return scenarios;
  if (!Array.isArray(scenarioIds) || scenarioIds.length === 0
      || scenarioIds.some((id) => typeof id !== "string" || id.length === 0)
      || new Set(scenarioIds).size !== scenarioIds.length) throw new Error("scenario selection contract mismatch");
  const selected = scenarios.filter((scenario) => scenarioIds.includes(scenario.id));
  if (selected.length !== scenarioIds.length) throw new Error("scenario selection contract mismatch");
  return selected;
}

export function representativeReceiptExpectation(product, scenario) {
  if (typeof product?.name !== "string" || product.name.length === 0
      || typeof product?.displayName !== "string" || product.displayName.length === 0
      || scenario === null || typeof scenario !== "object" || Array.isArray(scenario)) {
    throw new Error("representative receipt expectation mismatch");
  }
  return {
    ...scenario,
    product: product.name,
    productDisplayName: product.displayName,
    selectedSkill: scenario.expectedSkill,
  };
}

export async function installedRoleIds(cacheRoot) {
  const routing = safeJson(await readFile(path.join(cacheRoot, "references/routing.json"), "utf8"), "installed routing registry");
  if (!Array.isArray(routing.roleIds) || routing.roleIds.length === 0
      || routing.roleIds.some((role) => typeof role !== "string" || !/^[a-z][a-z0-9-]*$/u.test(role))
      || new Set(routing.roleIds).size !== routing.roleIds.length) {
    throw new Error("installed role registry mismatch");
  }
  return routing.roleIds;
}

function simpleShellWords(source) {
  if (typeof source !== "string" || /[\u0000\r\n]/u.test(source)) return null;
  const words = [];
  let word = "";
  let started = false;
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      word += character;
      started = true;
      escaped = false;
    } else if (quote === "'") {
      if (character === "'") quote = null;
      else word += character;
    } else if (quote === '"') {
      if (character === '"') quote = null;
      else if (character === "\\") escaped = true;
      else if (character === "$" || character === "`") return null;
      else word += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (character === "\\") {
      escaped = true;
      started = true;
    } else if (/\s/u.test(character)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else if (/[;|&<>$`]/u.test(character)) return null;
    else {
      word += character;
      started = true;
    }
  }
  if (quote || escaped) return null;
  if (started) words.push(word);
  return words;
}

async function isExactProofCommand(command, expected, trustedShellPaths) {
  const expectedWords = simpleShellWords(expected);
  const outer = simpleShellWords(command);
  if (!expectedWords || !outer) return false;
  if (JSON.stringify(outer) === JSON.stringify(expectedWords)) return true;
  if (outer.length !== 3 || outer[1] !== "-lc") return false;
  const shell = await realpath(outer[0]).catch(() => null);
  if (!shell || !trustedShellPaths.includes(shell)) return false;
  const inner = simpleShellWords(outer[2]);
  return inner !== null && JSON.stringify(inner) === JSON.stringify(expectedWords);
}

export async function captureFileIdentity(target) {
  const before = await lstat(target);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("proof identity requires a regular file");
  const digest = sha256(await readFile(target));
  const after = await lstat(target);
  if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode) throw new Error("proof identity changed during capture");
  return { dev: after.dev, ino: after.ino, mode: after.mode, sha256: digest };
}

async function identityMatches(target, expected) {
  try {
    const actual = await captureFileIdentity(target);
    return ["dev", "ino", "mode", "sha256"].every((key) => actual[key] === expected?.[key]);
  } catch { return false; }
}

async function isCanonicalRegularFile(target, root) {
  const [stats, canonicalTarget, canonicalRoot] = await Promise.all([
    lstat(target).catch(() => null),
    realpath(target).catch(() => null),
    realpath(root).catch(() => null),
  ]);
  if (!stats?.isFile() || stats.isSymbolicLink() || !canonicalTarget || !canonicalRoot) return false;
  const relative = path.relative(canonicalRoot, canonicalTarget);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function isCanonicalDirectory(target, root) {
  const [stats, canonical, canonicalRoot] = await Promise.all([
    lstat(target).catch(() => null), realpath(target).catch(() => null), realpath(root).catch(() => null),
  ]);
  if (!stats?.isDirectory() || stats.isSymbolicLink() || !canonical || !canonicalRoot) return false;
  const relative = path.relative(canonicalRoot, canonical);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function parseExecJsonl(source, {
  cacheRoot, workspaceRoot, proofIdentity, trustedShellPaths = [], nodePath = process.execPath,
  validatorPath: expectedValidator, validatorSha256, artifactPath, requestSha256, requireProofHarness = true,
}) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  if (events.some((event) => event.type === "turn.failed" || event.type === "error")) {
    throw new Error("codex exec incomplete: failure event");
  }
  if (!events.some((event) => event.type === "turn.completed")) throw new Error("codex exec incomplete: no completed turn");
  if (!requireProofHarness) return { completed: true, proofHarness: false };
  if (!await isCanonicalRegularFile(PROOF_HARNESS_PATH, TOOLING_ROOT)
      || !await isCanonicalRegularFile(expectedValidator, cacheRoot)
      || !await isCanonicalDirectory(artifactPath, workspaceRoot)
      || !await identityMatches(PROOF_HARNESS_PATH, proofIdentity)
      || sha256(await readFile(expectedValidator)) !== validatorSha256) {
    throw new Error("codex exec unverifiable: installed skill or canonical paths");
  }
  const proofArgs = [cacheRoot, workspaceRoot, expectedValidator, validatorSha256, artifactPath, requestSha256];
  const expectedCommand = buildProofCommand(nodePath, PROOF_HARNESS_PATH, ...proofArgs);
  const matches = [];
  for (const event of events) {
    if (event.type === "item.completed" && event.item?.type === "command_execution"
        && event.item.status === "completed" && event.item.exit_code === 0
        && await isExactProofCommand(event.item.command, expectedCommand, trustedShellPaths)) matches.push(event);
  }
  if (matches.length !== 1) throw new Error("codex exec unverifiable: exact proof command missing");
  let receipt;
  try { receipt = safeJson(String(matches[0].item.aggregated_output ?? "").trim(), "proof harness"); }
  catch { throw new Error("codex exec unverifiable: proof receipt malformed"); }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)
      || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(["schemaVersion", "ok", "validatorSha256", "artifactSha256", "requestedFormats", "routeReceipt"].sort())) {
    throw new Error("codex exec unverifiable: proof receipt mismatch");
  }
  const artifactIdentity = await artifactTreeIdentity(artifactPath).catch(() => null);
  const routeReceipt = receipt.routeReceipt;
  if (!routeReceipt || typeof routeReceipt !== "object" || Array.isArray(routeReceipt)
      || !routeReceipt.loadedInstruction || typeof routeReceipt.loadedInstruction !== "object" || Array.isArray(routeReceipt.loadedInstruction)
      || JSON.stringify(Object.keys(routeReceipt).sort()) !== JSON.stringify(["schemaVersion", "requestSha256", "bindingNonce", "routeId", "loadedInstruction"].sort())
      || JSON.stringify(Object.keys(routeReceipt.loadedInstruction).sort()) !== JSON.stringify(["relativePath", "sha256"].sort())
      || routeReceipt.schemaVersion !== 1 || routeReceipt.requestSha256 !== requestSha256 || typeof routeReceipt.bindingNonce !== "string"
      || typeof routeReceipt.routeId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(routeReceipt.routeId)
      || typeof routeReceipt.loadedInstruction.relativePath !== "string"
      || typeof routeReceipt.loadedInstruction.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(routeReceipt.loadedInstruction.sha256)
      || receipt.schemaVersion !== 1 || receipt.ok !== true || receipt.validatorSha256 !== validatorSha256 || receipt.artifactSha256 !== artifactIdentity?.sha256
      || JSON.stringify(receipt.requestedFormats) !== '["md"]') {
    throw new Error("codex exec unverifiable: proof receipt mismatch");
  }
  const verifiedRoute = await validateRouteReceipt({ cacheRoot, artifactPath, requestSha256 }).catch(() => null);
  if (!verifiedRoute || JSON.stringify(routeReceipt) !== JSON.stringify(verifiedRoute.routeReceipt)) {
    throw new Error("codex exec unverifiable: route receipt mismatch");
  }
  return { completed: true, proofHarness: true, routeReceipt, selectedSkill: verifiedRoute.selectedSkill };
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} contract mismatch`);
  }
}

function mismatch(kind) {
  throw new Error(`${kind} contract mismatch`);
}

function manifestVersion(manifest, productName) {
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const hasExactKeys = (value, keys) => isObject(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
  const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
  const interfaceKeys = ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "defaultPrompt"];
  const brandKeys = ["brandColor", "composerIcon", "logo"];
  if (!hasExactKeys(manifest, ["author", "description", "interface", "name", "skills", "version"])
      || manifest.name !== productName || manifest.version !== RELEASE_PLUGIN_VERSION
      || !nonEmptyString(manifest.description) || !hasExactKeys(manifest.author, ["name"])
      || !nonEmptyString(manifest.author.name) || manifest.skills !== "./skills/" || !isObject(manifest.interface)) return null;
  const hasBranding = brandKeys.every((key) => Object.hasOwn(manifest.interface, key));
  if (!hasExactKeys(manifest.interface, hasBranding ? [...interfaceKeys, ...brandKeys] : interfaceKeys)
      || interfaceKeys.slice(0, 5).some((key) => !nonEmptyString(manifest.interface[key]))
      || !Array.isArray(manifest.interface.capabilities) || manifest.interface.capabilities.some((value) => !nonEmptyString(value))
      || !Array.isArray(manifest.interface.defaultPrompt) || manifest.interface.defaultPrompt.length < 1 || manifest.interface.defaultPrompt.length > 3
      || manifest.interface.defaultPrompt.some((value) => !nonEmptyString(value) || value.length > 128)
      || (hasBranding && (!/^#[0-9a-f]{6}$/iu.test(manifest.interface.brandColor)
        || manifest.interface.composerIcon !== "./assets/product-mark.svg" || manifest.interface.logo !== "./assets/product-mark.svg"))) return null;
  return manifest.version;
}

export async function resolveExpectedPluginVersion({ repoRoot, productName }) {
  try {
    const [source, snapshot] = await Promise.all([
      readFile(path.join(repoRoot, "products", productName, "plugin", ".codex-plugin", "plugin.json"), "utf8"),
      readFile(path.join(repoRoot, "plugins", productName, ".codex-plugin", "plugin.json"), "utf8"),
    ]);
    const sourceManifest = safeJson(source, "source plugin manifest");
    const snapshotManifest = safeJson(snapshot, "snapshot plugin manifest");
    const sourceVersion = manifestVersion(sourceManifest, productName);
    const snapshotVersion = manifestVersion(snapshotManifest, productName);
    if (sourceVersion === RELEASE_PLUGIN_VERSION && snapshotVersion === RELEASE_PLUGIN_VERSION
        && sourceVersion === snapshotVersion && JSON.stringify(sourceManifest) === JSON.stringify(snapshotManifest)) {
      return RELEASE_PLUGIN_VERSION;
    }
  } catch {
    // Report one safe error without exposing a local path or malformed manifest bytes.
  }
  throw new Error(VERSION_PREFLIGHT_ERROR);
}

export function validateCliJson(kind, payload, { repoRoot, productName, cacheRoot, expectedVersion = RELEASE_PLUGIN_VERSION }) {
  const pluginId = `${productName}@${MARKETPLACE}`;
  const version = expectedVersion;
  try {
    if (kind === "marketplaceAdd") {
      assertExactKeys(payload, ["marketplaceName", "installedRoot", "alreadyAdded"], kind);
      if (payload.marketplaceName !== MARKETPLACE || payload.installedRoot !== repoRoot || payload.alreadyAdded !== false) mismatch(kind);
    } else if (kind === "pluginAdd") {
      assertExactKeys(payload, ["pluginId", "name", "marketplaceName", "version", "installedPath", "authPolicy"], kind);
      if (payload.pluginId !== pluginId || payload.name !== productName || payload.marketplaceName !== MARKETPLACE
          || payload.version !== version || payload.installedPath !== cacheRoot || payload.authPolicy !== "ON_USE") mismatch(kind);
    } else if (kind === "pluginList") {
      assertExactKeys(payload, ["installed", "available"], kind);
      if (!Array.isArray(payload.installed) || payload.installed.length !== 1 || !Array.isArray(payload.available) || payload.available.length !== 0) mismatch(kind);
      const plugin = payload.installed[0];
      assertExactKeys(plugin, ["pluginId", "name", "marketplaceName", "version", "installed", "enabled", "source", "marketplaceSource", "installPolicy", "authPolicy"], kind);
      assertExactKeys(plugin.source, ["source", "path"], kind);
      assertExactKeys(plugin.marketplaceSource, ["sourceType", "source"], kind);
      if (plugin.pluginId !== pluginId || plugin.name !== productName || plugin.marketplaceName !== MARKETPLACE
          || plugin.version !== version || plugin.installed !== true || plugin.enabled !== true
          || plugin.source.source !== "local" || plugin.source.path !== path.join(repoRoot, "plugins", productName)
          || plugin.marketplaceSource.sourceType !== "local" || plugin.marketplaceSource.source !== repoRoot
          || plugin.installPolicy !== "AVAILABLE" || plugin.authPolicy !== "ON_USE") mismatch(kind);
    } else if (kind === "pluginRemove") {
      assertExactKeys(payload, ["pluginId", "name", "marketplaceName"], kind);
      if (payload.pluginId !== pluginId || payload.name !== productName || payload.marketplaceName !== MARKETPLACE) mismatch(kind);
    } else if (kind === "marketplaceRemove") {
      assertExactKeys(payload, ["marketplaceName", "installedRoot"], kind);
      if (payload.marketplaceName !== MARKETPLACE || payload.installedRoot !== null) mismatch(kind);
    } else if (kind === "marketplaceList") {
      assertExactKeys(payload, ["marketplaces"], kind);
      if (!Array.isArray(payload.marketplaces) || payload.marketplaces.length !== 0) mismatch(kind);
    } else mismatch(kind);
  } catch (error) {
    if (error instanceof Error && /contract mismatch/u.test(error.message)) throw error;
    mismatch(kind);
  }
  return payload;
}

export function redactFailure(message, environment = process.env) {
  const source = String(message);
  if (/(?:401|unauthorized)/iu.test(source)) return "authentication failed (401)";
  if (/turn\.failed/iu.test(source)) return "codex turn failed";
  void environment;
  return "command failed (details redacted)";
}

function failureCode(error, stage) {
  const source = String(error instanceof Error ? error.message : error);
  if (stage === "natural-language-exec") {
    return /ETIMEDOUT|timed out|timeout/iu.test(source) ? "natural-language-exec-timeout" : "natural-language-exec-failed";
  }
  if (stage === "route-receipt") {
    if (/scenario route selection mismatch/iu.test(source)) return "route-selection-mismatch";
    const representative = /representative (routing receipt(?: values)?|routing product display name|routing product|routing skill|role evidence|role|merge|proof|agent message) contract mismatch/iu.exec(source)?.[1];
    if (representative) return `representative-${representative.replaceAll(" ", "-")}-invalid`;
    if (/exact proof command missing/iu.test(source)) return "route-proof-command-missing";
    if (/proof receipt malformed/iu.test(source)) return "route-proof-receipt-malformed";
    if (/proof receipt mismatch/iu.test(source)) return "route-proof-receipt-mismatch";
    if (/route receipt mismatch/iu.test(source)) return "route-receipt-mismatch";
    const subcode = /route receipt (unavailable|invalid-json|changed-during-capture|contract-mismatch|nonce-mismatch|request-mismatch|selected-route-mismatch|instruction-mismatch)/iu.exec(source)?.[1];
    if (subcode) return `route-receipt-${subcode.toLowerCase()}`;
    return "route-receipt-invalid";
  }
  if (stage === "artifact-missing") return "artifact-missing";
  if (stage === "artifact-scaffold") return "artifact-scaffold-failed";
  if (stage === "artifact-validation") return "artifact-validation-failed";
  if (stage === "route-proof") {
    if (/path escaped boundary|root type mismatch/iu.test(source)) return "route-proof-path-boundary";
    if (/artifact tree/iu.test(source)) return "route-proof-artifact-tree";
    if (/proof input hash/iu.test(source)) return "route-proof-input";
    if (/artifact validator execution/iu.test(source)) return "route-proof-validator-exec";
    if (/artifact validator result/iu.test(source)) return "route-proof-validator-result";
    if (/proof file changed/iu.test(source)) return "route-proof-file-changed";
    if (/artifact tree changed/iu.test(source)) return "route-proof-artifact-changed";
    if (/selection mismatch/iu.test(source)) return "route-proof-selection-mismatch";
    return "route-proof-failed";
  }
  if (stage === "plugin-install") return "plugin-install-failed";
  if (stage === "plugin-package") return "plugin-package-invalid";
  if (stage === "plugin-list") return "plugin-list-failed";
  if (stage === "plugin-remove") return "plugin-remove-failed";
  if (stage === "marketplace-add") return "marketplace-add-failed";
  if (stage === "marketplace-remove") return "marketplace-remove-failed";
  if (stage === "marketplace-list") return "marketplace-list-failed";
  return "command-failed";
}

export function createSmokeFailure(error, { product = null, stage = "command" } = {}) {
  const failure = { code: failureCode(error, stage), product, stage };
  if (Array.isArray(error?.diagnosticCodes) && error.diagnosticCodes.length > 0) failure.diagnosticCodes = error.diagnosticCodes;
  return failure;
}

export function preservePrimarySmokeFailure(current, candidate, { override = false } = {}) {
  return current === null || override ? candidate : current;
}

const DIAGNOSTIC_CODE = /^[a-z][a-z0-9_.-]{0,63}$/u;

export function runArtifactValidation(validator, artifactPath, { cwd, env, execute = spawnSync } = {}) {
  const result = execute(process.execPath, [validator, artifactPath, "md"], {
    cwd, env, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024, shell: false,
  });
  if (result.error || result.signal) throw new Error("artifact validator execution failed");
  let payload;
  try { payload = JSON.parse(result.stdout || result.stderr || ""); }
  catch { throw new Error("artifact validator invalid JSON"); }
  const diagnosticCodes = [...new Set((Array.isArray(payload?.errors) ? payload.errors : [])
    .map((entry) => entry?.code).filter((code) => typeof code === "string" && DIAGNOSTIC_CODE.test(code)))].slice(0, 8);
  if (result.status !== 0 || payload?.ok !== true || JSON.stringify(payload?.requestedFormats) !== '["md"]') {
    const error = new Error("artifact validation failed");
    error.diagnosticCodes = diagnosticCodes;
    throw error;
  }
  return payload;
}

class SmokeStageError extends Error {
  constructor(error, context) {
    super("marketplace smoke stage failed");
    this.cause = error;
    this.context = context;
  }
}

async function runStage(context, action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SmokeStageError) throw error;
    throw new SmokeStageError(error, context);
  }
}

export async function bridgeLocalAuth({ source, destination }) {
  const before = await lstat(source);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("local session auth source is not a regular file");
  const sourceIdentity = { dev: before.dev, ino: before.ino, mode: before.mode };
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
  const [afterSource, copied] = await Promise.all([lstat(source), lstat(destination)]);
  if (afterSource.dev !== sourceIdentity.dev || afterSource.ino !== sourceIdentity.ino || afterSource.mode !== sourceIdentity.mode) {
    throw new Error("local session auth source identity changed");
  }
  // The mode check is only a check where the mode is a POSIX permission set. Windows synthesises it from
  // a single read-only attribute, so a file `chmod`ed to 0600 there reads back as 0666 and the throw would
  // fire on every run while telling the user nothing they could act on. The copy is still required to be a
  // regular non-symlink file, and it still lands under a guarded temp root that no other user can reach.
  if (!copied.isFile() || copied.isSymbolicLink()) throw new Error("temporary session auth is not a regular file");
  if (posixPermissionBitsMeaningful() && (copied.mode & 0o777) !== 0o600) {
    throw new Error("temporary session auth is not a regular 0600 file");
  }
  return { authSource: "local-session" };
}

async function findExecutable(name) {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      const stats = await lstat(candidate).catch(() => null);
      if (!stats?.isFile() && !stats?.isSymbolicLink()) continue;
      const canonical = await realpath(candidate).catch(() => null);
      if (!canonical || !(await lstat(canonical)).isFile()) continue;
      try {
        await access(canonical, constants.X_OK);
        return canonical;
      } catch {}
    }
  }
  throw new Error(`${name} executable unavailable`);
}

export async function findTrustedShells() {
  const trusted = new Set();
  for (const candidate of ["/bin/sh", "/bin/bash", "/bin/zsh"]) {
    const canonical = await realpath(candidate).catch(() => null);
    const stats = canonical ? await lstat(canonical).catch(() => null) : null;
    if (!canonical || !stats?.isFile()) continue;
    try {
      await access(canonical, constants.X_OK);
      trusted.add(canonical);
    } catch {}
  }
  return [...trusted];
}

async function validatorPath() {
  const homes = [process.env.CODEX_HOME, path.join(homedir(), ".codex")].filter(Boolean);
  for (const home of homes) {
    const candidate = path.resolve(home, "skills/.system/plugin-creator/scripts/validate_plugin.py");
    const stats = await lstat(candidate).catch(() => null);
    if (stats?.isFile() && !stats.isSymbolicLink()) return realpath(candidate);
  }
  throw new Error("official plugin validator unavailable");
}

async function fingerprintProductionState() {
  const realHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const targets = ["config.toml", "plugins/installed.json", "plugins/marketplaces.json"];
  const state = {};
  for (const relative of targets) {
    const target = path.join(realHome, relative);
    const stats = await lstat(target).catch(() => null);
    state[relative] = stats?.isFile() && !stats.isSymbolicLink() ? sha256(await readFile(target)) : null;
  }
  return state;
}

function run(command, args, { cwd, env, input, timeout = 30000, json = false }) {
  const result = spawnSync(command, args, { cwd, env, input, timeout, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`command failed to start: ${result.error.message}`);
  if (result.signal) throw new Error(`command terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`command exited ${result.status}: ${result.stderr || result.stdout}`);
  return json ? safeJson(result.stdout, args.join(" ")) : result.stdout;
}

export function runCodexExec(command, args, options, execute = run) {
  return execute(command, args, { ...options, timeout: CODEX_EXEC_TIMEOUT_MS });
}

export async function seedRouteReceipt(artifactPath, { request }) {
  const bindingNonce = randomBytes(32).toString("hex");
  await mkdir(artifactPath, { recursive: true });
  await writeFile(path.join(artifactPath, "route-receipt.json"), `${JSON.stringify({
    schemaVersion: 1,
    requestSha256: sha256(Buffer.from(request, "utf8")),
    bindingNonce,
    routeId: null,
  })}\n`);
  return bindingNonce;
}

async function assertRegularTree(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) throw new Error("artifact starter contains a symbolic link");
    if (stats.isDirectory()) await assertRegularTree(target);
    else if (!stats.isFile()) throw new Error("artifact starter contains an unsupported entry");
  }
}

const EDITABLE_ARTIFACT_FILES = new Set(["content.md", "route-receipt.json"]);

async function captureArtifactScaffold(root) {
  const entries = [];
  const visit = async (directory, relativeDirectory = "") => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const relative = path.join(relativeDirectory, child.name);
      const portable = relative.split(path.sep).join("/");
      if (EDITABLE_ARTIFACT_FILES.has(portable)) continue;
      const target = path.join(directory, child.name);
      const before = await lstat(target);
      if (before.isSymbolicLink()) throw new Error("artifact scaffold contains a symbolic link");
      if (before.isDirectory()) {
        entries.push({ path: portable, type: "directory" });
        await visit(target, relative);
      } else if (before.isFile()) {
        const bytes = await readFile(target);
        const after = await lstat(target);
        if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino
            || before.mode !== after.mode || before.size !== after.size || bytes.length !== after.size) {
          throw new Error("artifact scaffold changed during capture");
        }
        entries.push({ path: portable, type: "file", sha256: sha256(bytes) });
      } else {
        throw new Error("artifact scaffold contains an unsupported entry");
      }
    }
  };
  await visit(root);
  return entries;
}

function parseProtectedContent(source) {
  const frontmatter = /^---\n[\s\S]*?\n---\n/u.exec(source);
  if (!frontmatter) throw new Error("canonical artifact frontmatter unavailable");
  const headings = [];
  const visibleLines = [];
  let fence = null;
  for (const line of source.slice(frontmatter[0].length).split("\n")) {
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`, "u");
      if (closing.test(line)) fence = null;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    const invalidBacktickInfo = opening?.[1][0] === "`" && opening[2].includes("`");
    if (opening && !invalidBacktickInfo) {
      fence = { character: opening[1][0], length: opening[1].length };
      continue;
    }
    if (/^#{1,6}\s+.+?\s+\{#[a-z0-9]+(?:-[a-z0-9]+)*\}\s*$/u.test(line)) headings.push(line);
    else visibleLines.push(line);
  }
  const stripHtmlComments = (text) => {
    let visible = "";
    let cursor = 0;
    while (cursor < text.length) {
      const opening = text.indexOf("<!--", cursor);
      if (opening === -1) return visible + text.slice(cursor);
      visible += text.slice(cursor, opening);
      const closing = text.indexOf("-->", opening + 4);
      if (closing === -1) return visible;
      cursor = closing + 3;
    }
    return visible;
  };
  return {
    frontmatter: frontmatter[0],
    headings,
    visibleBody: stripHtmlComments(visibleLines.join("\n")),
  };
}

function generatedContentError(code, message) {
  const error = new Error(message);
  error.diagnosticCodes = [code];
  return error;
}

export async function seedArtifactStarter(cacheRoot, artifactPath) {
  const templateRoot = path.join(cacheRoot, "assets", "shared", "templates", "canonical-artifact");
  if (!await isCanonicalDirectory(templateRoot, cacheRoot)) throw new Error("canonical artifact starter unavailable");
  if (await lstat(artifactPath).catch(() => null)) throw new Error("artifact destination already exists");
  await assertRegularTree(templateRoot);
  await cp(templateRoot, artifactPath, { recursive: true, errorOnExist: true, force: false });
  await assertArtifactDirectory(artifactPath);
  await artifactTreeIdentity(artifactPath);
  const contentPath = path.join(artifactPath, "content.md");
  if (!await isCanonicalRegularFile(contentPath, artifactPath)) throw new Error("canonical artifact content unavailable");
  const content = await readFile(contentPath, "utf8");
  const protectedContent = parseProtectedContent(content);
  return {
    contentSha256: sha256(Buffer.from(content, "utf8")),
    contentFrontmatter: protectedContent.frontmatter,
    contentHeadings: protectedContent.headings,
    scaffold: await captureArtifactScaffold(artifactPath),
  };
}

export async function assertGeneratedContent(artifactPath, {
  contentSha256, contentFrontmatter, contentHeadings, scaffold, requiredPatterns,
}) {
  const contentPath = path.join(artifactPath, "content.md");
  if (!await isCanonicalRegularFile(contentPath, artifactPath)) throw new Error("generated content unavailable");
  const content = await readFile(contentPath, "utf8");
  const protectedContent = parseProtectedContent(content);
  if (protectedContent.frontmatter !== contentFrontmatter
      || JSON.stringify(protectedContent.headings) !== JSON.stringify(contentHeadings)) {
    throw generatedContentError("artifact.content_envelope", "protected content envelope changed");
  }
  if (JSON.stringify(await captureArtifactScaffold(artifactPath)) !== JSON.stringify(scaffold)) {
    throw generatedContentError("artifact.scaffold_changed", "artifact scaffold changed");
  }
  if (sha256(Buffer.from(content, "utf8")) === contentSha256) {
    throw generatedContentError("artifact.content_unchanged", "generated content unchanged");
  }
  if (!Array.isArray(requiredPatterns) || requiredPatterns.length === 0
      || requiredPatterns.some((pattern) => !(pattern instanceof RegExp))) {
    throw generatedContentError("artifact.pattern_contract", "generated content pattern contract mismatch");
  }
  const matchesEveryPattern = requiredPatterns.every((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(protectedContent.visibleBody);
  });
  if (!matchesEveryPattern) throw generatedContentError("artifact.request_mismatch", "generated content request mismatch");
}

export async function assertArtifactDirectory(artifactPath) {
  const artifactStats = await lstat(artifactPath).catch(() => null);
  if (!artifactStats?.isDirectory() || artifactStats.isSymbolicLink()) throw new Error("artifact missing");
}

async function countSkills(cacheRoot) {
  const entries = await readdir(path.join(cacheRoot, "skills"), { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if ((await lstat(path.join(cacheRoot, "skills", entry.name, "SKILL.md"))).isFile()) count += 1;
  }
  return count;
}

function isolatedEnvironment(registration) {
  const env = {
    HOME: path.join(registration.root, "home"),
    CODEX_HOME: path.join(registration.root, "codex-home"),
    TMPDIR: path.join(registration.root, "tmp"),
    PATH: process.env.PATH ?? "",
  };
  if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  return env;
}

export async function runMarketplaceSmoke({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  tempParent = tmpdir(),
  findExecutableImpl = findExecutable,
  scenarioIds,
} = {}) {
  const validScenarioIds = PRODUCTS.flatMap((product) => [
    `${product.name}-direct`, product.representative.id,
  ]).map((id) => ({ id }));
  selectSmokeScenarios(validScenarioIds, scenarioIds);
  const before = await fingerprintProductionState();
  const registration = await createGuardedTempRoot({ parent: tempParent, prefix: "game-design-marketplace-" });
  const env = isolatedEnvironment(registration);
  const isolatedValidator = path.join(registration.root, "official-validate-plugin.py");
  const results = [];
  let status = "INCOMPLETE";
  let failure = null;
  let authSource = process.env.OPENAI_API_KEY ? "api-key-env" : "unavailable";
  let temporaryStateCleanup = false;
  let productionStateUnchanged = false;
  try {
    await Promise.all([env.HOME, env.CODEX_HOME, env.TMPDIR].map((directory) => mkdir(directory, { recursive: true })));
    const canonicalRepoRoot = path.resolve(repoRoot);
    const expectedVersions = new Map(await Promise.all(PRODUCTS.map(async ({ name }) => [
      name,
      await resolveExpectedPluginVersion({ repoRoot: canonicalRepoRoot, productName: name }),
    ])));
    const realCodexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
    const localAuth = path.join(realCodexHome, "auth.json");
    const localAuthStats = await lstat(localAuth).catch(() => null);
    if (localAuthStats?.isFile() && !localAuthStats.isSymbolicLink()) {
      ({ authSource } = await bridgeLocalAuth({ source: localAuth, destination: path.join(env.CODEX_HOME, "auth.json") }));
      delete env.OPENAI_API_KEY;
    }
    const codex = await runStage({ product: null, stage: "plugin-install" }, () => findExecutableImpl("codex"));
    const python = await runStage({ product: null, stage: "plugin-install" }, () => findExecutableImpl("python3"));
    const trustedShellPaths = await findTrustedShells();
    const proofIdentity = await captureFileIdentity(PROOF_HARNESS_PATH);
    await runStage({ product: null, stage: "plugin-install" }, async () => {
      await writeFile(isolatedValidator, await readFile(await validatorPath()));
    });
    const marketplace = await runStage({ product: null, stage: "marketplace-add" }, () => {
      const result = run(codex, ["plugin", "marketplace", "add", canonicalRepoRoot, "--json"], { cwd: repoRoot, env, json: true });
      return validateCliJson("marketplaceAdd", result, { repoRoot: canonicalRepoRoot });
    });

    for (const product of PRODUCTS) {
      const packagedSkillCount = PACKAGED_SKILL_COUNTS[product.name];
      if (!Number.isInteger(packagedSkillCount)) throw new Error("packaged skill inventory missing");
      const expectedVersion = expectedVersions.get(product.name);
      if (expectedVersion !== RELEASE_PLUGIN_VERSION) throw new Error(VERSION_PREFLIGHT_ERROR);
      const added = await runStage({ product: product.name, stage: "plugin-install" }, () => run(
        codex, ["plugin", "add", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true },
      ));
      const cacheRoot = path.join(env.CODEX_HOME, "plugins/cache", MARKETPLACE, product.name, expectedVersion);
      const cliContext = { repoRoot: canonicalRepoRoot, productName: product.name, cacheRoot, expectedVersion };
      await runStage({ product: product.name, stage: "plugin-install" }, () => validateCliJson("pluginAdd", added, cliContext));
      await runStage({ product: product.name, stage: "plugin-package" }, async () => {
        if (await realpath(cacheRoot) !== cacheRoot || await countSkills(cacheRoot) !== packagedSkillCount) throw new Error("cache mismatch");
        run(python, [isolatedValidator, cacheRoot], { cwd: registration.root, env });
      });
      await runStage({ product: product.name, stage: "plugin-list" }, () => validateCliJson(
        "pluginList", run(codex, ["plugin", "list", "--json"], { cwd: repoRoot, env, json: true }), cliContext,
      ));

      const scenarios = [
        {
          ...product, id: `${product.name}-direct`, representative: false,
        },
        { ...product.representative, representative: true },
      ];
      for (const scenario of (scenarioIds === undefined ? scenarios : scenarios.filter((candidate) => scenarioIds.includes(candidate.id)))) {
        const workspace = path.join(registration.root, `workspace-${scenario.id}`);
        await mkdir(workspace);
        const artifactPath = path.join(workspace, `${product.name}-artifact`);
        const starter = await runStage(
          { product: product.name, stage: "artifact-scaffold", scenarioId: scenario.id },
          () => seedArtifactStarter(cacheRoot, artifactPath),
        );
        const bindingNonce = await runStage(
          { product: product.name, stage: "route-receipt", scenarioId: scenario.id },
          () => seedRouteReceipt(artifactPath, scenario),
        );
        const packageValidator = path.join(cacheRoot, "scripts/validate-artifact.mjs");
        const validatorSha256 = sha256(await readFile(packageValidator));
        const requestSha256 = sha256(Buffer.from(scenario.request, "utf8"));
        const prompt = scenario.representative
          ? buildRepresentativeMarketplacePrompt({ ...product, ...scenario }, artifactPath)
          : buildMarketplacePrompt(scenario, artifactPath);
        const jsonl = await runStage({ product: product.name, stage: "natural-language-exec", scenarioId: scenario.id }, () => runCodexExec(
          codex, ["exec", "--ephemeral", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", workspace, prompt], { cwd: workspace, env },
        ));
        await runStage({ product: product.name, stage: "natural-language-exec", scenarioId: scenario.id }, () => parseExecJsonl(jsonl, {
          cacheRoot, workspaceRoot: workspace, proofIdentity, trustedShellPaths, nodePath: process.execPath,
          validatorPath: packageValidator, validatorSha256, artifactPath, requestSha256, requireProofHarness: false,
        }));
        await runStage(
          { product: product.name, stage: "artifact-missing", scenarioId: scenario.id },
          () => assertArtifactDirectory(artifactPath),
        );
        const selectedRoute = await runStage({ product: product.name, stage: "route-receipt", scenarioId: scenario.id }, () => validateRouteReceipt({
          cacheRoot, artifactPath, requestSha256, bindingNonce,
        }));
        if (selectedRoute.selectedSkill !== scenario.expectedSkill || selectedRoute.routeReceipt.routeId !== scenario.expectedRoute) {
          process.stderr.write(`[marketplace-smoke] route-selection=${JSON.stringify({ scenario: scenario.id, expectedRoute: scenario.expectedRoute, actualRoute: selectedRoute.routeReceipt.routeId, expectedSkill: scenario.expectedSkill, actualSkill: selectedRoute.selectedSkill })}\n`);
          throw new SmokeStageError(new Error("scenario route selection mismatch"), {
            product: product.name, stage: "route-receipt", scenarioId: scenario.id,
          });
        }
        if (scenario.representative) {
          const allowedRoles = await runStage(
            { product: product.name, stage: "route-receipt", scenarioId: scenario.id },
            () => installedRoleIds(cacheRoot),
          );
          await runStage({ product: product.name, stage: "route-receipt", scenarioId: scenario.id }, () => {
            const message = firstRoutingReceiptMessage(jsonl);
            try {
              return assertRepresentativeReceipt(message, {
                ...representativeReceiptExpectation(product, scenario),
                allowedRoles,
              });
            }
            catch (error) {
              process.stderr.write(`[marketplace-smoke] event-summary=${JSON.stringify({
                ...summarizeCodexExecEvents(jsonl),
                receiptIdentity: describeRepresentativeReceiptIdentity(message, {
                  product: product.name,
                  selectedSkill: scenario.expectedSkill,
                  entrySkill: scenario.entrySkill,
                }),
              })}\n`);
              throw error;
            }
          });
        }
        await runStage({ product: product.name, stage: "artifact-validation", scenarioId: scenario.id }, () => {
          runArtifactValidation(packageValidator, artifactPath, { cwd: workspace, env });
        });
        await runStage({ product: product.name, stage: "artifact-validation", scenarioId: scenario.id }, () => assertGeneratedContent(
          artifactPath,
          { ...starter, requiredPatterns: scenario.contentPatterns },
        ));
        const proof = await runStage({ product: product.name, stage: "route-proof", scenarioId: scenario.id }, () => runMarketplaceProof([
          cacheRoot, workspace, packageValidator, validatorSha256, artifactPath, requestSha256,
        ], { bindingNonce }));
        if (selectedRoute.selectedSkill !== proof.selectedSkill || JSON.stringify(selectedRoute.routeReceipt) !== JSON.stringify(proof.routeReceipt)) {
          throw new SmokeStageError(new Error("route proof selection mismatch"), {
            product: product.name, stage: "route-proof", scenarioId: scenario.id,
          });
        }
        results.push({ scenario: scenario.id, product: product.name, pluginId: added.pluginId, selectedSkill: proof.selectedSkill, route: proof.routeReceipt.routeId, skills: packagedSkillCount, artifact: "validated-md", exec: "completed" });
      }
      const removedPlugin = await runStage({ product: product.name, stage: "plugin-remove" }, () => run(
        codex, ["plugin", "remove", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true },
      ));
      await runStage({ product: product.name, stage: "plugin-remove" }, async () => {
        validateCliJson("pluginRemove", removedPlugin, cliContext);
        if (await lstat(cacheRoot).catch(() => null)) throw new Error("plugin removal mismatch");
      });
    }
    await runStage({ product: null, stage: "marketplace-remove" }, () => validateCliJson(
      "marketplaceRemove", run(codex, ["plugin", "marketplace", "remove", MARKETPLACE, "--json"], { cwd: repoRoot, env, json: true }),
      { repoRoot: canonicalRepoRoot },
    ));
    await runStage({ product: null, stage: "marketplace-list" }, () => validateCliJson(
      "marketplaceList", run(codex, ["plugin", "marketplace", "list", "--json"], { cwd: repoRoot, env, json: true }),
      { repoRoot: canonicalRepoRoot },
    ));
    status = "PASS";
  } catch (error) {
    if (error instanceof SmokeStageError && typeof error.context.scenarioId === "string") {
      process.stderr.write(`[marketplace-smoke] scenario=${error.context.scenarioId}\n`);
    }
    failure = error instanceof SmokeStageError
      ? createSmokeFailure(error.cause, error.context)
      : createSmokeFailure(error, { product: null, stage: "command" });
  } finally {
    const after = await fingerprintProductionState();
    productionStateUnchanged = JSON.stringify(after) === JSON.stringify(before);
    if (!productionStateUnchanged) {
      status = "INCOMPLETE";
      failure = preservePrimarySmokeFailure(
        failure,
        { code: "production-state-changed", product: null, stage: "production-state" },
        { override: true },
      );
    }
    try {
      await cleanupGuardedTempRoot(registration);
      temporaryStateCleanup = true;
    } catch (error) {
      status = "INCOMPLETE";
      failure = preservePrimarySmokeFailure(
        failure,
        { code: "temporary-cleanup-failed", product: null, stage: "temporary-cleanup" },
      );
    }
  }
  return { status, marketplace: MARKETPLACE, products: results, authSource, productionStateUnchanged, temporaryStateCleanup, failure };
}

async function main() {
  let tempParent = tmpdir();
  const scenarioIds = [];
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--temp-parent" && typeof args[index + 1] === "string") tempParent = args[++index];
    else if (args[index] === "--scenario" && typeof args[index + 1] === "string") scenarioIds.push(args[++index]);
    else throw new Error("Usage: node tooling/marketplace-smoke.mjs [--temp-parent <directory>] [--scenario <id>]...");
  }
  const result = await runMarketplaceSmoke({ tempParent, scenarioIds: scenarioIds.length === 0 ? undefined : scenarioIds });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
