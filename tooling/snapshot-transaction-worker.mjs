#!/usr/bin/env node

import { runSnapshotTransaction } from "./lib/snapshot-transaction.mjs";

let nextRequestId = 1;
const replies = new Map();

function rejectReplies(error) {
  for (const reply of replies.values()) reply.reject(error);
  replies.clear();
}

function send(message) {
  return new Promise((resolve, reject) => {
    if (!process.connected) {
      reject(new Error("snapshot worker IPC is disconnected"));
      return;
    }
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

function request(type, payload) {
  const requestId = nextRequestId;
  nextRequestId += 1;
  return new Promise((resolve, reject) => {
    replies.set(requestId, { resolve, reject });
    send({ type, requestId, ...payload }).catch((error) => {
      replies.delete(requestId);
      reject(error);
    });
  });
}

process.on("disconnect", () => rejectReplies(new Error("snapshot worker parent disconnected")));

process.on("message", async (message) => {
  if (message?.type === "registered-result" || message?.type === "phase-result") {
    const reply = replies.get(message.requestId);
    if (!reply) return;
    replies.delete(message.requestId);
    if (message.error) reply.reject(new Error(message.error));
    else reply.resolve();
    return;
  }
  if (message?.type === "rollback") {
    rejectReplies(new Error(message.reason ?? "Parent requested rollback"));
    return;
  }
  if (message?.type !== "start") return;
  try {
    const protocolFaults = (message.config.protocolFaults ?? []).map((fault) => ({ ...fault, used: false }));
    async function phase(phaseName, payload) {
      const fault = protocolFaults.find((candidate) => !candidate.used
        && candidate.phase === phaseName
        && (candidate.productName ?? null) === (payload.productName ?? null));
      if (fault) {
        fault.used = true;
        if (fault.action === "malformed") {
          await send({ type: "malformed", phase: phaseName });
          throw new Error(`Injected malformed IPC at ${phaseName}`);
        } else if (fault.action === "disconnect" || fault.action === "send-failure") {
          process.disconnect();
        }
      }
      return request("phase", { phase: phaseName, payload });
    }
    const recovery = await runSnapshotTransaction(message.config, {
      register: (registration) => request("registered", { registration }),
      phase,
    });
    await send({ type: "result", recovery });
  } catch (error) {
    await send({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      recovery: error?.recovery,
      preserveStaging: error?.preserveStaging === true,
    }).catch(() => {});
  }
});

await send({ type: "spawned" });
