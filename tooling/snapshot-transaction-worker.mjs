#!/usr/bin/env node

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runSnapshotTransaction } from "./lib/snapshot-transaction.mjs";

let nextRequestId = 1;
const replies = new Map();
const startupFaults = JSON.parse(process.env.CODEX_SNAPSHOT_TRANSACTION_TEST_FAULTS ?? "[]");
let sendCallbackFault;

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
    process.send(message, (error) => {
      const injected = sendCallbackFault;
      sendCallbackFault = undefined;
      if (error || injected) reject(error ?? new Error(injected));
      else resolve();
    });
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
    const workerFaults = (message.config.workerFaults ?? []).map((fault) => ({ ...fault, used: false }));
    const registerFault = workerFaults.find((fault) => fault.phase === "register");
    async function phase(phaseName, payload) {
      const fault = protocolFaults.find((candidate) => !candidate.used
        && candidate.phase === phaseName
        && (candidate.productName ?? null) === (payload.productName ?? null));
      if (fault) {
        fault.used = true;
        if (fault.action === "malformed") {
          await send({ type: "malformed", phase: phaseName });
          throw new Error(`Injected malformed IPC at ${phaseName}`);
        } else if (fault.action === "disconnect") {
          process.disconnect();
        } else if (fault.action === "send-failure" || fault.action === "send-callback-error") {
          sendCallbackFault = `Injected process.send callback error at ${phaseName}`;
        }
      }
      return request("phase", { phase: phaseName, payload });
    }
    const recovery = await runSnapshotTransaction(message.config, {
      register: async (registration) => {
        if (registerFault?.action === "withhold") return new Promise(() => {});
        let reported = registration;
        if (registerFault?.action === "malformed-registration") reported = { recoveryRoot: registration.recoveryRoot };
        if (registerFault?.action === "wrong-staging-registration") reported = { ...registration, stagingRoot: `${registration.stagingRoot}-wrong` };
        if (registerFault?.action === "missing-journal") {
          await rm(path.join(registration.recoveryRoot, "SNAPSHOT-TRANSACTION-JOURNAL.json"));
        }
        if (registerFault?.action === "wrong-product-journal") {
          const journalPath = path.join(registration.recoveryRoot, "SNAPSHOT-TRANSACTION-JOURNAL.json");
          const journal = JSON.parse(await readFile(journalPath, "utf8"));
          journal.products["game-design-career"].originalLocation = registration.recoveryRoot;
          await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
        }
        return request("registered", { registration: reported });
      },
      phase,
    });
    if (workerFaults.some((fault) => fault.phase === "final" && fault.action === "withhold")) {
      await new Promise(() => {});
    }
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

if (!startupFaults.some((fault) => fault.phase === "spawn" && fault.action === "withhold")) {
  await send({ type: "spawned" });
}
