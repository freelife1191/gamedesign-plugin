#!/usr/bin/env node

// What the model is actually told about this suite's skills, measured rather than assumed.
//
// Routing is a prompt contract: the entry skill asks the model to pick one owning product, one route,
// and to publish a receipt. No static test can check the model's judgment, which is why this layer sat
// unverified — verifying it seemed to need credentials, and copying ~/.codex/auth.json into an isolated
// home rotates the refresh token and logs the real user out.
//
// It does not need credentials. codex talks to whatever model provider its config names, so this points
// it at a local stub that records the request and answers nothing useful. That is enough to read the
// skill catalog codex built: which skills it found, and the exact description text it sent for each.
//
// The catalog is where routing is decided. SKILL.md bodies are not in the prompt — the model only reads
// one after it has already chosen the skill. So a trigger that lives past the catalog's per-description
// budget is a trigger the router never sees.
//
// This probe never reads the user's real CODEX_HOME, and never reads or writes auth.json. It builds its
// own CODEX_HOME under a fresh temp root, installs from a staged copy of this repo's marketplace, and
// removes the whole root when it is done.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export const PRODUCTS = Object.freeze(["game-design-studio", "game-design-career"]);
const MARKETPLACE = "game-design-suite";
// Every route this suite advertises starts at one of these. A catalog missing one of them is a suite
// whose documented entry point the model was never told about.
export const REQUIRED_SKILLS = Object.freeze(["game-design-studio", "game-design-career", "upgrade-game-design-suite"]);

// A catalog line reads `- <plugin>:<skill>: <description> (file: <root>/<skill>/SKILL.md)`. Descriptions
// hold colons and parentheses of their own, so the trailing file reference anchors the split, not the
// first colon.
const CATALOG_LINE = /^- (?<id>[^\s:]+:[^\s:]+): (?<description>.*) \(file: (?<file>r\d+\/.*?)\)$/u;

export function parseSkillCatalog(payload) {
  const catalog = new Map();
  for (const raw of payload.split(/\\n|\n/u)) {
    const match = CATALOG_LINE.exec(raw.trim());
    if (!match) continue;
    const { id, description, file } = match.groups;
    // A duplicate id would make every later measurement ambiguous about which entry it described.
    if (catalog.has(id)) throw new Error(`the catalog lists ${id} twice`);
    catalog.set(id, { description, file });
  }
  return catalog;
}

// The packaged tree, not products/*/plugin/skills: shared skills are projected into the package at build
// time, so the source tree holds 33 of the 51 skills a user actually installs. Measuring the 33 would
// have reported a clean catalog for eighteen skills nobody checked.

// Five of the descriptions are quoted YAML scalars. Comparing the raw line against the value codex
// delivered charges those five for their own quote characters: the source reads two characters longer
// than the delivered text, which this probe would otherwise report as two characters of lost trigger.
export function unquoteScalar(value) {
  if (!value.startsWith('"') || !value.endsWith('"') || value.length < 2) return value;
  return JSON.parse(value);
}

export async function skillDescriptions(root) {
  const sources = new Map();
  for (const product of PRODUCTS) {
    const skillsRoot = path.join(root, "plugins", product, "skills");
    for (const name of (await readdir(skillsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
      const file = path.join(skillsRoot, name.name, "SKILL.md");
      if (!existsSync(file)) continue;
      const match = /^description:\s*(?<description>.*)$/mu.exec(await readFile(file, "utf8"));
      if (!match) throw new Error(`${product}/${name.name}: SKILL.md declares no description`);
      sources.set(`${product}:${name.name}`, unquoteScalar(match.groups.description.trim()));
    }
  }
  return sources;
}

export function catalogFindings({ catalog, sources }) {
  const absent = [...sources.keys()].filter((id) => !catalog.has(id)).sort();
  const truncated = [];
  for (const [id, source] of sources) {
    const entry = catalog.get(id);
    if (!entry || entry.description.length >= source.length) continue;
    truncated.push({
      id,
      sourceLength: source.length,
      deliveredLength: entry.description.length,
      lost: source.slice(entry.description.length),
    });
  }
  truncated.sort((left, right) => right.lost.length - left.lost.length || left.id.localeCompare(right.id));
  const missingRequired = REQUIRED_SKILLS.filter((name) => !PRODUCTS.some((product) => catalog.has(`${product}:${name}`))).sort();
  return { absent, truncated, missingRequired, delivered: [...sources.keys()].filter((id) => catalog.has(id)).length };
}

// The probe needs the request, not a conversation. Trying to satisfy codex with a well-formed answer
// ties this tool to the response protocol of one CLI version — and getting it subtly wrong hangs the run
// rather than failing it, because codex keeps asking. So the stub records the first request, reports it,
// and the caller stops codex there. Nothing downstream of the request is simulated.
function stubProvider(capturePath, port) {
  let announce;
  const captured = new Promise((resolve) => {
    announce = resolve;
  });
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      await writeFile(capturePath, Buffer.concat(chunks).toString("utf8"), "utf8");
      announce();
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      response.end("data: [DONE]\n\n");
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, captured }));
  });
}

function run(command, args, { cwd, env }) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  return result;
}

// Run codex only as far as its first request to the model, then stop it. A codex that has been answered
// by a stub has nowhere useful to go, and waiting for it to decide that costs minutes.
function runUntilFirstRequest(args, { cwd, env, captured, timeoutMs }) {
  const child = spawn("codex", args, { cwd, env, stdio: "ignore", shell: false });
  return new Promise((resolve, reject) => {
    const stop = (settle) => {
      clearTimeout(timer);
      child.kill("SIGKILL");
      settle();
    };
    const timer = setTimeout(() => stop(() => reject(new Error("codex never reached the model provider; nothing to measure"))), timeoutMs);
    captured.then(() => stop(resolve));
    child.once("error", (error) => stop(() => reject(error)));
    // codex exiting before the request lands means the run failed for its own reasons — a rejected
    // config, an install that did not take — and the timeout would only delay saying so.
    child.once("exit", () => setTimeout(() => stop(() => reject(new Error("codex exited before it sent a request"))), 500));
  });
}

export async function probeSkillRouting({
  root = repoRoot,
  request = "게임 디자인 요청을 어디서 시작해야 할지 모르겠어",
  port = 8731,
  timeoutMs = 90_000,
  withHostSkills = false,
  keepWorkspace = false,
  writeStdout = (message) => process.stdout.write(message),
} = {}) {
  if (!run("codex", ["--version"], { cwd: root, env: process.env }).stdout?.includes("codex")) {
    throw new Error("codex CLI not found; this probe measures what the real CLI sends");
  }
  const probeRoot = await mkdtemp(path.join(os.tmpdir(), "skill-routing-probe-"));
  // Hangul and a space in every path: the suite's own QA installs that way, and a probe that only ever
  // ran under an ASCII path would agree with a CLI that cannot start under the real one.
  const codexHome = path.join(probeRoot, "코덱스 홈");
  const marketplaceRoot = path.join(probeRoot, "마켓플레이스 소스");
  const workspace = path.join(probeRoot, "작업 공간");
  const capturePath = path.join(probeRoot, "captured.json");
  const { server, captured } = await stubProvider(capturePath, port);
  try {
    await Promise.all([codexHome, workspace].map((directory) => mkdir(directory, { recursive: true })));
    await mkdir(marketplaceRoot, { recursive: true });
    await cp(path.join(root, ".agents"), path.join(marketplaceRoot, ".agents"), { recursive: true });
    await cp(path.join(root, "plugins"), path.join(marketplaceRoot, "plugins"), { recursive: true });
    await writeFile(path.join(codexHome, "config.toml"), [
      'model = "gpt-5-codex"',
      'model_provider = "probe-stub"',
      "",
      "[model_providers.probe-stub]",
      'name = "probe-stub"',
      `base_url = "http://127.0.0.1:${port}/v1"`,
      'wire_api = "responses"',
      'env_key = "SKILL_ROUTING_PROBE_KEY"',
      "",
    ].join("\n"), "utf8");

    // No auth.json is written and none is read: the stub provider authenticates on an env key that is
    // not a credential, and OPENAI_API_KEY is dropped so a real one cannot leak into the run.
    //
    // Two measurements, because the per-description budget is not a constant: codex spends a fixed
    // catalog allowance across every skill it can see, so each skill's share shrinks as more are
    // installed. A redirected HOME measures this suite alone; --with-host-skills leaves HOME in place so
    // the machine's own skills compete for the same allowance, which is the pressure a real user's
    // install actually runs under. CODEX_HOME stays isolated either way, and no credential is read.
    const env = {
      ...process.env,
      CODEX_HOME: codexHome,
      SKILL_ROUTING_PROBE_KEY: "probe-stub-not-a-credential",
    };
    if (!withHostSkills) env.HOME = probeRoot;
    delete env.OPENAI_API_KEY;

    run("codex", ["plugin", "marketplace", "add", marketplaceRoot, "--json"], { cwd: workspace, env });
    for (const product of PRODUCTS) {
      run("codex", ["plugin", "add", `${product}@${MARKETPLACE}`, "--json"], { cwd: workspace, env });
    }
    await runUntilFirstRequest(["exec", "--skip-git-repo-check", request], { cwd: workspace, env, captured, timeoutMs });

    const payload = await readFile(capturePath, "utf8");
    const body = JSON.parse(payload);
    const catalog = parseSkillCatalog(`${body.instructions ?? ""}\n${JSON.stringify(body.input ?? [])}`);
    const sources = await skillDescriptions(root);
    const findings = catalogFindings({ catalog, sources });
    writeStdout(`${JSON.stringify({ schemaVersion: 1, request, withHostSkills, skills: sources.size, catalogTotal: catalog.size, ...findings }, null, 2)}\n`);
    return findings;
  } finally {
    server.close();
    if (!keepWorkspace) await rm(probeRoot, { recursive: true, force: true });
  }
}

export function parseProbeArgs(args) {
  const options = { request: undefined, keepWorkspace: false, withHostSkills: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--keep") options.keepWorkspace = true;
    else if (args[index] === "--with-host-skills") options.withHostSkills = true;
    else if (args[index] === "--request") {
      options.request = args[index + 1];
      index += 1;
      if (typeof options.request !== "string" || options.request === "") throw new Error("--request needs the text to send");
    } else throw new Error("Usage: node tooling/probe-skill-routing.mjs [--request <text>] [--with-host-skills] [--keep]");
  }
  return options;
}

async function main() {
  const { request, ...options } = parseProbeArgs(process.argv.slice(2));
  const findings = await probeSkillRouting(request ? { ...options, request } : options);
  // A missing entry skill breaks routing outright. A truncated description degrades it, and is reported
  // rather than failed here: which triggers may be lost is an editorial call, not this probe's.
  process.exitCode = findings.missingRequired.length === 0 && findings.absent.length === 0 ? 0 : 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
