#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const MARKETPLACE_NAME = "game-design-suite";
const PLUGINS = new Set(["game-design-studio", "game-design-career"]);
const VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const LIST_KEYS = ["installed", "available"];
const PLUGIN_KEYS = ["pluginId", "name", "marketplaceName", "version", "installed", "enabled", "source", "marketplaceSource", "installPolicy", "authPolicy"];
const LOCAL_SOURCE_KEYS = ["source", "path"];
const MARKETPLACE_SOURCE_KEYS = ["sourceType", "source"];

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return plainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validVersion(value) {
  return typeof value === "string" && VERSION.test(value);
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
    sourceType: validateMarketplace(value.marketplaceSource),
  };
}

function freezeInspection({ sourceType, installed, available }) {
  const result = {
    marketplace: { name: MARKETPLACE_NAME, sourceType },
    installed: installed.map(({ plugin, version }) => ({ plugin, version })),
    available: available.map(({ plugin, version }) => ({ plugin, version })),
  };
  return Object.freeze({
    marketplace: Object.freeze(result.marketplace),
    installed: Object.freeze(result.installed.map(Object.freeze)),
    available: Object.freeze(result.available.map(Object.freeze)),
  });
}

function parseInspection(stdout) {
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
  const pluginIds = entries.map(({ plugin }) => plugin);
  if (new Set(pluginIds).size !== pluginIds.length) fail("marketplace inspection");
  return freezeInspection({ sourceType: entries[0].sourceType, installed, available });
}

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, options);
}

export function inspectPluginUpdates({ codexPath = "codex", marketplaceName = MARKETPLACE_NAME, runCommand = defaultRunCommand } = {}) {
  if (marketplaceName !== MARKETPLACE_NAME || typeof codexPath !== "string" || codexPath.length === 0 || typeof runCommand !== "function") fail("marketplace inspection");
  let receipt;
  try {
    receipt = runCommand(codexPath, ["plugin", "list", "--marketplace", MARKETPLACE_NAME, "--available", "--json"], {
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
    });
  } catch {
    fail("marketplace inspection");
  }
  if (!receipt || receipt.error !== undefined || receipt.signal !== null || receipt.status !== 0 || typeof receipt.stdout !== "string") fail("marketplace inspection");
  return parseInspection(receipt.stdout);
}

export function planApprovedPluginUpdate({ marketplace, plugin, installedVersion, availableVersion } = {}) {
  if (!exactKeys(marketplace, ["name", "sourceType"])
    || marketplace.name !== MARKETPLACE_NAME
    || !["local", "git"].includes(marketplace.sourceType)
    || !PLUGINS.has(plugin)
    || !validVersion(installedVersion)
    || !validVersion(availableVersion)) fail("update plan");
  const add = ["plugin", "add", `${plugin}@${MARKETPLACE_NAME}`, "--json"];
  const plan = marketplace.sourceType === "git"
    ? [["plugin", "marketplace", "upgrade", MARKETPLACE_NAME, "--json"], add]
    : [add];
  return Object.freeze(plan.map((argv) => Object.freeze([...argv])));
}

function selectedInstalledVersion(inspection, plugin) {
  const installed = inspection.installed.find((entry) => entry.plugin === plugin);
  if (!installed) fail("update plan");
  const available = inspection.available.find((entry) => entry.plugin === plugin);
  return { installedVersion: installed.version, availableVersion: available?.version ?? installed.version };
}

function cli() {
  const args = process.argv.slice(2);
  if (!(args.length === 1 && args[0] === "--inspect")
    && !(args.length === 2 && args[0] === "--plan" && PLUGINS.has(args[1]))) {
    process.stdout.write('{"error":"invalid arguments"}\n');
    process.exitCode = 1;
    return;
  }
  try {
    const inspection = inspectPluginUpdates({ codexPath: process.env.CODEX_PATH ?? "codex" });
    const result = args[0] === "--inspect"
      ? inspection
      : planApprovedPluginUpdate({ marketplace: inspection.marketplace, plugin: args[1], ...selectedInstalledVersion(inspection, args[1]) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stdout.write('{"error":"plugin inspection failed"}\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
