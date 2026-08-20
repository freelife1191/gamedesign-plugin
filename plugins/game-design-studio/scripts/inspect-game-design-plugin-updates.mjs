#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MARKETPLACE_NAME = "game-design-suite";
const PLUGINS = new Set(["game-design-studio", "game-design-career"]);
const STABLE_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const LIST_KEYS = ["installed", "available"];
const PLUGIN_KEYS = ["pluginId", "name", "marketplaceName", "version", "installed", "enabled", "source", "marketplaceSource", "installPolicy", "authPolicy"];
const LOCAL_SOURCE_KEYS = ["source", "path"];
const MARKETPLACE_SOURCE_KEYS = ["sourceType", "source"];
const COMPARISON_KEYS = ["plugin", "installedVersion", "availableVersion", "status"];

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return plainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validVersion(value) {
  return typeof value === "string" && STABLE_VERSION.test(value);
}

function fail(kind) {
  throw new Error(`Invalid plugin ${kind}`);
}

function validateMarketplace(value) {
  if (!exactKeys(value, MARKETPLACE_SOURCE_KEYS)
    || !["local", "git"].includes(value.sourceType)
    || typeof value.source !== "string"
    || value.source.length === 0) fail("marketplace inspection");
  return value.sourceType;
}

const SNAPSHOT_MANIFEST = [".codex-plugin", "plugin.json"];

function defaultReadText(filePath) {
  return readFileSync(filePath, "utf8");
}

// The host lists a plugin under `available` only while it is not installed, so the version an
// installed plugin could move to never appears there and every comparison came out
// not-comparable — no plan, no way to reach the approved update at all. The marketplace snapshot
// directory for that plugin is named in the host's own output, and its manifest carries the version
// the snapshot holds. Reading it is the only way to compare like with like. This reads one file and
// writes nothing, so it stays on the safe side of the approval gate; anything unreadable, mislabeled
// or not a stable version yields null and the comparison stays not-comparable exactly as before.
function snapshotVersion({ plugin, sourcePath, readText }) {
  if (typeof sourcePath !== "string" || !path.isAbsolute(sourcePath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readText(path.join(sourcePath, ...SNAPSHOT_MANIFEST)));
  } catch {
    return null;
  }
  if (!plainObject(manifest) || manifest.name !== plugin || !validVersion(manifest.version)) return null;
  return manifest.version;
}

function validatePlugin(value, installed) {
  if (!exactKeys(value, PLUGIN_KEYS)
    || typeof value.pluginId !== "string"
    || typeof value.name !== "string"
    || value.pluginId !== `${value.name}@${MARKETPLACE_NAME}`
    || value.marketplaceName !== MARKETPLACE_NAME
    || !PLUGINS.has(value.name)
    || !validVersion(value.version)
    || value.installed !== installed
    || typeof value.enabled !== "boolean"
    || typeof value.installPolicy !== "string"
    || typeof value.authPolicy !== "string"
    || !exactKeys(value.source, LOCAL_SOURCE_KEYS)
    || value.source.source !== "local"
    || typeof value.source.path !== "string"
    || value.source.path.length === 0) fail("marketplace inspection");
  return {
    plugin: value.name,
    version: value.version,
    enabled: value.enabled,
    sourcePath: value.source.path,
    sourceType: validateMarketplace(value.marketplaceSource),
  };
}

function comparisonFor(installed, available, readText) {
  const availableByPlugin = new Map(available.map((entry) => [entry.plugin, entry.version]));
  return installed.map(({ plugin, version, sourcePath }) => {
    const availableVersion = availableByPlugin.get(plugin)
      ?? snapshotVersion({ plugin, sourcePath, readText });
    return {
      plugin,
      installedVersion: version,
      availableVersion,
      status: availableVersion === null ? "not-comparable" : "comparable",
    };
  });
}

function freezeInspection({ sourceType, installed, available, readText }) {
  const result = {
    marketplace: { name: MARKETPLACE_NAME, sourceType },
    installed: installed.map(({ plugin, version }) => ({ plugin, version })),
    available: available.map(({ plugin, version }) => ({ plugin, version })),
    comparisons: comparisonFor(installed, available, readText),
  };
  return Object.freeze({
    marketplace: Object.freeze(result.marketplace),
    installed: Object.freeze(result.installed.map(Object.freeze)),
    available: Object.freeze(result.available.map(Object.freeze)),
    comparisons: Object.freeze(result.comparisons.map(Object.freeze)),
  });
}

function parseInspection(stdout, readText) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    fail("marketplace inspection");
  }
  if (!exactKeys(parsed, LIST_KEYS)
    || !Array.isArray(parsed.installed)
    || !Array.isArray(parsed.available)) fail("marketplace inspection");
  const installed = parsed.installed.map((entry) => validatePlugin(entry, true));
  const available = parsed.available.map((entry) => validatePlugin(entry, false));
  const entries = [...installed, ...available];
  if (entries.length === 0 || new Set(entries.map(({ sourceType }) => sourceType)).size !== 1) fail("marketplace inspection");
  if (new Set(installed.map(({ plugin }) => plugin)).size !== installed.length
    || new Set(available.map(({ plugin }) => plugin)).size !== available.length) fail("marketplace inspection");
  // freezeInspection is the closed public shape and deliberately drops `enabled`; the validated
  // entries are returned alongside it so the handoff lookup can read that field without widening it.
  return { inspection: freezeInspection({ sourceType: entries[0].sourceType, installed, available, readText }), installed };
}

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, options);
}

function codexInvocation(codexPath, args) {
  return /\.[cm]?js$/u.test(codexPath)
    ? [process.execPath, [codexPath, ...args]]
    : [codexPath, args];
}

function runMarketplaceInspection({ codexPath = "codex", marketplaceName = MARKETPLACE_NAME, runCommand = defaultRunCommand, readText = defaultReadText } = {}) {
  if (marketplaceName !== MARKETPLACE_NAME || typeof codexPath !== "string" || codexPath.length === 0 || typeof runCommand !== "function" || typeof readText !== "function") fail("marketplace inspection");
  let receipt;
  try {
    const [command, args] = codexInvocation(codexPath, ["plugin", "list", "--marketplace", MARKETPLACE_NAME, "--available", "--json"]);
    receipt = runCommand(command, args, {
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
    });
  } catch {
    fail("marketplace inspection");
  }
  if (!receipt || receipt.error !== undefined || receipt.signal !== null || receipt.status !== 0 || typeof receipt.stdout !== "string") fail("marketplace inspection");
  return parseInspection(receipt.stdout, readText);
}

export function inspectPluginUpdates(options = {}) {
  return runMarketplaceInspection(options).inspection;
}

// 인계는 상대 제품이 실제로 설치돼 있을 때만 성립한다. 업데이트 검사와 같은 목록을 읽지만 결과가
// 다르다. 업데이트는 못 읽으면 실패지만, 인계는 못 읽어도 자기 제품 몫을 끝내야 하므로 여기서는
// 던지지 않고 unknown으로 닫는다. 미설치와 확인 불가는 사용자에게 다른 문장을 만든다.
// 인계가 묻는 것은 파일이 디스크에 있느냐가 아니라 상대 제품이 실제로 돌 수 있느냐다. 설치돼 있어도
// 비활성이면 호스트가 그 스킬을 싣지 않으므로, 인계를 보내면 조용한 막다른 길이 된다. enabled가
// true인 제품만 목록에 넣는다 — 조회는 성공했으니 status는 known이고, 그 제품은 없는 것으로 센다.
export function inspectInstalledSuiteProducts(options = {}) {
  try {
    const { installed } = runMarketplaceInspection(options);
    const products = installed
      .filter(({ plugin, enabled }) => PLUGINS.has(plugin) && enabled === true)
      .map(({ plugin }) => plugin)
      .sort();
    return Object.freeze({ status: "known", products: Object.freeze(products) });
  } catch {
    return Object.freeze({ status: "unknown", products: Object.freeze([]) });
  }
}

function compareNumeric(left, right) {
  if (left.length !== right.length) return left.length > right.length ? 1 : -1;
  return left === right ? 0 : left > right ? 1 : -1;
}

function compareStableVersions(left, right) {
  const leftParts = left.split("+", 1)[0].split(".");
  const rightParts = right.split("+", 1)[0].split(".");
  for (const index of [0, 1, 2]) {
    const compared = compareNumeric(leftParts[index], rightParts[index]);
    if (compared !== 0) return compared;
  }
  return 0;
}

export function planApprovedPluginUpdate({ marketplace, plugin, installedVersion, availableVersion } = {}) {
  if (!exactKeys(marketplace, ["name", "sourceType"])
    || marketplace.name !== MARKETPLACE_NAME
    || !["local", "git"].includes(marketplace.sourceType)
    || !PLUGINS.has(plugin)
    || !validVersion(installedVersion)
    || !validVersion(availableVersion)
    || compareStableVersions(availableVersion, installedVersion) <= 0) fail("update plan");
  const add = ["plugin", "add", `${plugin}@${MARKETPLACE_NAME}`, "--json"];
  const plan = marketplace.sourceType === "git"
    ? [["plugin", "marketplace", "upgrade", MARKETPLACE_NAME, "--json"], add]
    : [add];
  return Object.freeze(plan.map((argv) => Object.freeze([...argv])));
}

function selectedComparison(inspection, plugin) {
  const comparison = inspection.comparisons.find((entry) => entry.plugin === plugin);
  if (!comparison || !exactKeys(comparison, COMPARISON_KEYS)) fail("update plan");
  return comparison;
}

function notComparablePlan(plugin) {
  return { status: "not-comparable", plugin, reason: "same-plugin available version is absent" };
}

// Now that a snapshot version is always available for an installed plugin, "already newest" is a
// reachable outcome rather than an impossible one, and it is a result the skill reports, not a
// failure. Saying so plainly keeps it out of the generic error path, which would have claimed the
// inspection broke.
function currentPlan(plugin, installedVersion) {
  return { status: "current", plugin, installedVersion, reason: "the marketplace snapshot is not newer than the installed version" };
}

function cli() {
  const args = process.argv.slice(2);
  if (!(args.length === 1 && (args[0] === "--inspect" || args[0] === "--products"))
    && !(args.length === 2 && args[0] === "--plan" && PLUGINS.has(args[1]))) {
    process.stdout.write('{"error":"invalid arguments"}\n');
    process.exitCode = 1;
    return;
  }
  if (args[0] === "--products") {
    const lookup = inspectInstalledSuiteProducts({ codexPath: process.env.CODEX_PATH ?? "codex" });
    process.stdout.write(`${JSON.stringify(lookup)}\n`);
    return;
  }
  try {
    const inspection = inspectPluginUpdates({ codexPath: process.env.CODEX_PATH ?? "codex" });
    if (args[0] === "--inspect") {
      process.stdout.write(`${JSON.stringify(inspection)}\n`);
      return;
    }
    const comparison = selectedComparison(inspection, args[1]);
    if (comparison.status === "not-comparable") {
      process.stdout.write(`${JSON.stringify(notComparablePlan(args[1]))}\n`);
      process.exitCode = 1;
      return;
    }
    if (compareStableVersions(comparison.availableVersion, comparison.installedVersion) <= 0) {
      process.stdout.write(`${JSON.stringify(currentPlan(args[1], comparison.installedVersion))}\n`);
      return;
    }
    const result = planApprovedPluginUpdate({
      marketplace: inspection.marketplace,
      plugin: args[1],
      installedVersion: comparison.installedVersion,
      availableVersion: comparison.availableVersion,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stdout.write('{"error":"plugin inspection failed"}\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
