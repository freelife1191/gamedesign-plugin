import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const harnessPath = fileURLToPath(new URL("./memory-retrieval-mutation-harness.mjs", import.meta.url));
const PASSTHROUGH_KEYS = ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME", "DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH", "DESIGN_MEMORY_RETRIEVAL_HOSTILE_SENTINEL"];
const BLOCKED_NODE_KEYS = ["NODE_OPTIONS", "NODE_PATH", "NODE_INSPECT_RESUME_ON_START", "NODE_V8_COVERAGE", "NODE_TEST_CONTEXT"];

function allowlistedEnvironment(source) {
  const environment = {};
  for (const key of PASSTHROUGH_KEYS) if (typeof source[key] === "string") environment[key] = source[key];
  return environment;
}

export function launchMemoryRetrievalMutationHarness(args, { cwd, env = process.env } = {}) {
  const saved = new Map();
  for (const key of BLOCKED_NODE_KEYS) if (Object.hasOwn(process.env, key)) { saved.set(key, process.env[key]); delete process.env[key]; }
  try { return spawn(process.execPath, [harnessPath, ...args], { cwd, env: allowlistedEnvironment(env), stdio: ["ignore", "pipe", "pipe"] }); }
  finally { for (const [key, value] of saved) process.env[key] = value; }
}
