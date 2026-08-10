import assert from "node:assert/strict";
import test from "node:test";

import {
  findStructuralDuplicates,
  structuralSignature,
} from "../../tooling/lib/archify-signature.mjs";

function workflowFixture({
  ids = ["a", "b", "c"],
  labels = ["입력", "검토", "완료"],
} = {}) {
  return {
    lanes: [{ id: "author" }, { id: "reviewer" }],
    nodes: ids.map((id, index) => ({
      id,
      label: labels[index],
      type: index === 1 ? "approval" : "task",
      variant: index === 1 ? "decision" : "default",
      lane: index === 1 ? "reviewer" : "author",
      position: { x: index * 240, y: index === 1 ? 140 : 0 },
    })),
    edges: [
      { from: ids[0], to: ids[1], variant: "default" },
      { from: ids[1], to: ids[2], variant: "default" },
    ],
    mainPath: ids,
  };
}

function lifecycleFixture() {
  return {
    lanes: [{ id: "active" }],
    states: [
      { id: "draft", label: "초안", type: "state", variant: "default", lane: "active", position: { x: 0, y: 0 } },
      { id: "review", label: "검토", type: "state", variant: "default", lane: "active", position: { x: 200, y: 0 } },
      { id: "done", label: "완료", type: "terminal", variant: "success", lane: "active", position: { x: 400, y: 0 } },
    ],
    transitions: [
      { from: "draft", to: "review", variant: "advance" },
      { from: "review", to: "done", variant: "advance" },
    ],
  };
}

function architectureFixture() {
  return {
    boundaries: [{ id: "client" }, { id: "service" }],
    components: [
      { id: "ui", label: "UI", type: "client", variant: "default", boundary: "client", position: { x: 0, y: 0 } },
      { id: "api", label: "API", type: "service", variant: "default", boundary: "service", position: { x: 300, y: 0 } },
    ],
    connections: [{ from: "ui", to: "api", variant: "request" }],
  };
}

function sequenceFixture() {
  return {
    segments: [{ id: "request" }],
    participants: [
      { id: "caller", label: "호출자", type: "actor", variant: "default", position: { x: 0, y: 0 } },
      { id: "service", label: "서비스", type: "service", variant: "default", position: { x: 240, y: 0 } },
    ],
    messages: [{ from: "caller", to: "service", variant: "request" }],
  };
}

function addBranch(spec) {
  spec.nodes.push({
    id: "reject", label: "반려", type: "task", variant: "default", lane: "reviewer", position: { x: 480, y: 140 },
  });
  spec.edges.push({ from: "b", to: "reject", variant: "reject" });
}

function addRetryCycle(spec) {
  spec.edges.push({ from: "c", to: "b", variant: "retry" });
}

function extendMainPath(spec) {
  spec.nodes.push({
    id: "archive", label: "보관", type: "task", variant: "default", lane: "author", position: { x: 720, y: 0 },
  });
  spec.edges[1].to = "archive";
  spec.edges.push({ from: "archive", to: "c", variant: "default" });
  spec.mainPath.push("archive");
}

function addHoldResumeLoop(spec) {
  spec.states.push({
    id: "hold", label: "보류", type: "state", variant: "hold", lane: "active", position: { x: 200, y: 160 },
  });
  spec.transitions.push(
    { from: "review", to: "hold", variant: "hold" },
    { from: "hold", to: "review", variant: "resume" },
  );
}

function addLane(spec) {
  spec.lanes.push({ id: "compliance" });
  spec.nodes[2].lane = "compliance";
}

function addBoundary(spec) {
  spec.boundaries.push({ id: "audit" });
  spec.components[1].boundary = "audit";
}

function addParticipant(spec) {
  spec.participants.push({
    id: "store", label: "저장소", type: "database", variant: "default", position: { x: 480, y: 0 },
  });
  spec.messages.push({ from: "service", to: "store", variant: "write" });
}

function duplicateCatalog({ firstException = null, secondException = null } = {}) {
  return {
    entries: [
      { id: "first", decision: "selected", diagram_type: "workflow", shared_process_with: null, shared_process_reason: null, ...firstException },
      { id: "second", decision: "selected", diagram_type: "workflow", shared_process_with: null, shared_process_reason: null, ...secondException },
    ],
  };
}

function duplicateSpecs() {
  return new Map([
    ["first", workflowFixture({ ids: ["first-a", "first-b", "first-c"] })],
    ["second", workflowFixture({ ids: ["second-a", "second-b", "second-c"] })],
  ]);
}

test("label-only workflow clones have the same structural signature", () => {
  const first = workflowFixture({ ids: ["a", "b", "c"], labels: ["입력", "검토", "완료"] });
  const second = workflowFixture({ ids: ["x", "y", "z"], labels: ["자료", "승인", "출력"] });

  assert.equal(
    structuralSignature({ type: "workflow", spec: first }),
    structuralSignature({ type: "workflow", spec: second }),
  );
});

for (const [name, type, fixture, mutate] of [
  ["branch count", "workflow", workflowFixture, addBranch],
  ["cycle", "workflow", workflowFixture, addRetryCycle],
  ["main-path length", "workflow", workflowFixture, extendMainPath],
  ["hold-resume loop", "lifecycle", lifecycleFixture, addHoldResumeLoop],
  ["lane count", "workflow", workflowFixture, addLane],
  ["boundary count", "architecture", architectureFixture, addBoundary],
  ["participant count", "sequence", sequenceFixture, addParticipant],
]) {
  test(`${name} changes the structural signature`, () => {
    const original = fixture();
    const changed = structuredClone(original);
    mutate(changed);

    assert.notEqual(
      structuralSignature({ type, spec: original }),
      structuralSignature({ type, spec: changed }),
    );
  });
}

test("diagram type participates in the signature", () => {
  assert.notEqual(
    structuralSignature({ type: "workflow", spec: workflowFixture() }),
    structuralSignature({ type: "lifecycle", spec: lifecycleFixture() }),
  );
});

test("duplicates require a symmetric documented shared-process exception", () => {
  assert.throws(
    () => findStructuralDuplicates({
      catalog: duplicateCatalog({
        firstException: { shared_process_with: "second", shared_process_reason: null },
        secondException: { shared_process_with: "first", shared_process_reason: null },
      }),
      specsById: duplicateSpecs(),
    }),
    /shared_process_reason/u,
  );
});

test("unexceptioned structural duplicates are returned for catalog rejection", () => {
  const findings = findStructuralDuplicates({ catalog: duplicateCatalog(), specsById: duplicateSpecs() });

  assert.deepEqual(findings.map((finding) => finding.ids), [["first", "second"]]);
});

test("a symmetric evidence-backed shared-process exception approves a duplicate", () => {
  const exceptions = {
    firstException: { shared_process_with: "second", shared_process_reason: "두 문서는 같은 승인 프로세스의 서로 다른 근거를 기록한다." },
    secondException: { shared_process_with: "first", shared_process_reason: "두 문서는 같은 승인 프로세스의 서로 다른 근거를 기록한다." },
  };

  assert.deepEqual(
    findStructuralDuplicates({ catalog: duplicateCatalog(exceptions), specsById: duplicateSpecs() }),
    [],
  );
});

test("one-sided shared-process exception does not approve a duplicate", () => {
  const exceptions = {
    firstException: { shared_process_with: "second", shared_process_reason: "공통 절차의 source evidence가 있다." },
    secondException: { shared_process_with: "unrelated", shared_process_reason: "공통 절차의 source evidence가 있다." },
  };

  assert.throws(
    () => findStructuralDuplicates({ catalog: duplicateCatalog(exceptions), specsById: duplicateSpecs() }),
    /symmetric shared-process exception/u,
  );
});

test("exact pixel changes do not alter the quantized relative layout", () => {
  const original = workflowFixture();
  const changed = structuredClone(original);
  for (const node of changed.nodes) {
    node.position.x = node.position.x * 3 + 17;
    node.position.y = node.position.y * 3 + 17;
  }

  assert.equal(
    structuralSignature({ type: "workflow", spec: original }),
    structuralSignature({ type: "workflow", spec: changed }),
  );
});
