import assert from "node:assert/strict";
import test from "node:test";

import {
  issueCaptureClassificationReceipt,
  issueMaintenanceHumanReceipt,
} from "../../shared/scripts/lib/design-memory-capabilities.mjs";

const event = {
  eventId: "playtest-session-04-finding-07",
  type: "playtest-finding",
  summary: "회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.",
  applicability: "같은 전투 구조를 사용하는 보스전",
  exclusions: "회피 자체가 핵심 재미인 전투",
  artifactTypes: ["combat"],
  relatedIds: ["boss"],
  tags: ["counterplay"],
  sources: [{ artifact_id: "playtest-session-04", locator: "evidence.yml#finding-07", sha256: "a".repeat(64) }],
  actor: "김기획자",
};

function captureArgs(overrides = {}) {
  return {
    projectId: "wind-island",
    lane: "studio",
    scope: "project",
    candidateTtlDays: 30,
    event,
    classification: { classification: "durable-finding" },
    now: new Date("2026-08-12T00:00:00Z"),
    ...overrides,
  };
}

test("capability issuers return opaque null-prototype frozen tokens", () => {
  const capture = issueCaptureClassificationReceipt(captureArgs());
  const maintenance = issueMaintenanceHumanReceipt({
    projectId: "wind-island",
    scope: "project",
    action: "approve",
    memoryId: "memory-studio-design-lesson-abc",
    actor: "reviewer",
    reason: "reviewed",
    observedParentEventIds: [`mev1-${"a".repeat(64)}`],
    now: new Date("2026-08-13T00:00:00Z"),
  });
  for (const token of [capture, maintenance]) {
    assert.equal(Object.getPrototypeOf(token), null);
    assert.equal(Object.isFrozen(token), true);
    assert.deepEqual(Reflect.ownKeys(token), []);
  }
});

test("capture issuer rejects non-data graphs, ambiguous arrays, and noncanonical strings", () => {
  const invalidEvents = [];
  invalidEvents.push(new Proxy(event, {}));
  invalidEvents.push(Object.defineProperty({ ...event }, "summary", { enumerable: true, get: () => event.summary }));
  invalidEvents.push(Object.assign({ ...event }, { [Symbol("hidden")]: true }));
  invalidEvents.push(Object.assign(Object.create({ inherited: true }), event));
  invalidEvents.push({ ...event, tags: new Array(1) });
  const cyclic = { ...event }; cyclic.self = cyclic; invalidEvents.push(cyclic);
  const shared = { artifact_id: "playtest-session-04", locator: "evidence.yml#finding-07", sha256: "a".repeat(64) };
  invalidEvents.push({ ...event, sources: [shared, shared] });
  invalidEvents.push({ ...event, summary: "e\u0301" });
  invalidEvents.push({ ...event, summary: "bad\u0001text" });
  invalidEvents.push({ ...event, tags: ["counterplay", "counterplay"] });
  for (const hostile of invalidEvents) assert.throws(
    () => issueCaptureClassificationReceipt(captureArgs({ event: hostile })),
    (error) => error?.code === "memory.capability_request",
  );
});

test("classification issuer rejects typo, chat, source-less, and type-mismatched claims", () => {
  const cases = [
    { event: { ...event, type: "typo" }, classification: { classification: "durable-finding" } },
    { event, classification: { classification: "chat" } },
    { event: { ...event, sources: [] }, classification: { classification: "durable-finding" } },
    { event, classification: { classification: "explicit-user-preference", instructionContext: "user said so" } },
    { event: { ...event, type: "explicit-preference", sources: [] }, classification: { classification: "explicit-user-preference" } },
  ];
  for (const item of cases) assert.throws(
    () => issueCaptureClassificationReceipt(captureArgs(item)),
    (error) => error?.code === "memory.classification_rejected",
  );
});

test("maintenance issuer rejects copied authority inputs and invalid resolution observations", () => {
  const base = {
    projectId: "wind-island",
    scope: "project",
    action: "resolution",
    memoryId: "memory-studio-design-lesson-abc",
    actor: "reviewer",
    reason: "resolve",
    observedParentEventIds: [`mev1-${"a".repeat(64)}`, `mev1-${"b".repeat(64)}`],
    chosenParentEventId: `mev1-${"a".repeat(64)}`,
    now: new Date("2026-08-13T00:00:00Z"),
  };
  assert.doesNotThrow(() => issueMaintenanceHumanReceipt(base));
  for (const hostile of [
    { ...base, observedParentEventIds: [base.observedParentEventIds[0], base.observedParentEventIds[0]] },
    { ...base, observedParentEventIds: [...base.observedParentEventIds].reverse() },
    { ...base, chosenParentEventId: `mev1-${"c".repeat(64)}` },
    { ...base, actor: "" },
    { ...base, reason: "" },
  ]) assert.throws(
    () => issueMaintenanceHumanReceipt(hostile),
    (error) => error?.code === "memory.capability_request",
  );
});

test("sweep and quarantine receipts bind complete observed-head snapshots", () => {
  const common = { projectId: "wind-island", scope: "project", actor: "reviewer", reason: "scheduled", now: new Date("2026-08-13T00:00:00Z") };
  assert.doesNotThrow(() => issueMaintenanceHumanReceipt({ ...common, action: "sweep", observedParentEventIds: [] }));
  assert.doesNotThrow(() => issueMaintenanceHumanReceipt({ ...common, action: "quarantine", memoryId: "memory-studio-design-lesson-abc", observedParentEventIds: [`mev1-${"a".repeat(64)}`, `mev1-${"b".repeat(64)}`] }));
});
