#!/usr/bin/env node

import { runSnapshotTransaction } from "./lib/snapshot-transaction.mjs";

let nextRequestId = 1;
const replies = new Map();

function requestPhase(phase, payload) {
  const requestId = nextRequestId;
  nextRequestId += 1;
  return new Promise((resolve, reject) => {
    replies.set(requestId, { resolve, reject });
    process.send({ type: "phase", requestId, phase, payload });
  });
}

process.on("message", async (message) => {
  if (message?.type === "phase-result") {
    const reply = replies.get(message.requestId);
    if (!reply) return;
    replies.delete(message.requestId);
    if (message.error) reply.reject(new Error(message.error));
    else reply.resolve();
    return;
  }
  if (message?.type !== "start") return;
  try {
    const recovery = await runSnapshotTransaction(message.config, { phase: requestPhase });
    process.send({ type: "result", recovery });
  } catch (error) {
    process.send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      recovery: error?.recovery,
      preserveStaging: error?.preserveStaging === true,
    });
  }
});

process.send({ type: "spawned" });
