import { appendMemoryEvent, resolveMemoryStore } from "../../../shared/scripts/lib/safe-memory-store.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;

async function readInputLine() {
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of process.stdin) {
    byteLength += chunk.byteLength;
    if (byteLength > MAX_INPUT_BYTES) throw new Error("invalid child input");
    chunks.push(chunk);
  }
  const lines = Buffer.concat(chunks).toString("utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== 1) throw new Error("invalid child input");
  const value = JSON.parse(lines[0]);
  if (value === null || typeof value !== "object" || Array.isArray(value) || typeof value.workspaceRoot !== "string" || typeof value.eventDocument !== "string") throw new Error("invalid child input");
  return value;
}

try {
  const { workspaceRoot, eventDocument } = await readInputLine();
  const store = await resolveMemoryStore({
    workspaceRoot,
    config: { enabled: true, scope: "project", gitMode: "local", projectId: "wind-island" },
    platform: process.platform,
    home: workspaceRoot,
    initialize: true,
  });
  const { status, eventId, relativePath } = await appendMemoryEvent({ store, eventDocument });
  process.stdout.write(`${JSON.stringify({ status, eventId, relativePath })}\n`);
} catch {
  process.stderr.write('{"code":"memory.child_append_failed"}\n');
  process.exitCode = 1;
}
