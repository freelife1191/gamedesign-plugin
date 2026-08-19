import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  findStructuralDuplicates,
  structuralSignature,
} from "../../tooling/lib/archify-signature.mjs";
import { CHILD_DEADLINE_SCALE } from "../lib/platform-support.mjs";

function meta(title) {
  return { title, quality_profile: "showcase" };
}

function workflowFixture({
  ids = ["a", "b", "c"],
  labels = ["입력", "검토", "완료"],
} = {}) {
  return {
    schema_version: 1,
    diagram_type: "workflow",
    meta: meta("검토 흐름"),
    lanes: [{ id: "author", label: "작성" }, { id: "review", label: "검토" }],
    nodes: ids.map((id, index) => ({
      id,
      lane: index === 1 ? "review" : "author",
      col: index,
      type: index === 1 ? "security" : "backend",
      label: labels[index],
    })),
    edges: [
      { from: ids[0], to: ids[1], variant: "default", role: "main" },
      { from: ids[1], to: ids[2], variant: "emphasis", role: "main" },
    ],
    mainPath: ids,
  };
}

function lifecycleFixture() {
  return {
    schema_version: 1,
    diagram_type: "lifecycle",
    meta: meta("검토 상태"),
    lanes: [{ id: "main", label: "주 상태" }, { id: "wait", label: "대기" }],
    states: [
      { id: "draft", type: "start", label: "초안", lane: "main", col: 0 },
      { id: "review", type: "active", label: "검토", lane: "main", col: 1 },
      { id: "done", type: "success", label: "완료", lane: "main", col: 2 },
    ],
    transitions: [
      { from: "draft", to: "review", variant: "default" },
      { from: "review", to: "done", variant: "emphasis" },
    ],
  };
}

function architectureFixture() {
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: meta("서비스 경계"),
    components: [
      { id: "client", type: "external", label: "클라이언트", pos: [0, 0] },
      { id: "api", type: "backend", label: "API", pos: [200, 0] },
      { id: "store", type: "database", label: "저장소", pos: [400, 0] },
    ],
    boundaries: [{ kind: "region", label: "서비스", wraps: ["api", "store"] }],
    connections: [
      { from: "client", to: "api", variant: "default" },
      { from: "api", to: "store", variant: "emphasis" },
    ],
  };
}

function sequenceFixture() {
  return {
    schema_version: 1,
    diagram_type: "sequence",
    meta: meta("요청 왕복"),
    participants: [
      { id: "client", type: "external", label: "클라이언트" },
      { id: "api", type: "backend", label: "API" },
      { id: "store", type: "database", label: "저장소" },
    ],
    messages: [
      { from: "client", to: "api", y: 180, label: "요청", variant: "default" },
      { from: "api", to: "store", y: 240, label: "저장", variant: "emphasis" },
    ],
  };
}

function dataflowFixture() {
  return {
    schema_version: 1,
    diagram_type: "dataflow",
    meta: meta("자료 흐름"),
    stages: [{ label: "수집" }, { label: "저장" }],
    nodes: [
      { id: "source", type: "frontend", label: "소스", stage: 0, row: 0 },
      { id: "warehouse", type: "database", label: "웨어하우스", stage: 1, row: 1 },
    ],
    flows: [{ from: "source", to: "warehouse", label: "이벤트", variant: "emphasis" }],
  };
}

function addBranch(spec) {
  spec.nodes.push({ id: "reject", lane: "review", col: 2, type: "backend", label: "반려" });
  spec.edges.push({ from: "b", to: "reject", variant: "security", role: "branch" });
}

function addRetryCycle(spec) {
  spec.edges.push({ from: "c", to: "b", variant: "dashed", role: "return" });
}

function extendMainPath(spec) {
  spec.nodes.push({ id: "archive", lane: "author", col: 3, type: "database", label: "보관" });
  spec.edges[1].to = "archive";
  spec.edges.push({ from: "archive", to: "c", variant: "emphasis", role: "main" });
  spec.mainPath.push("archive");
}

function addHoldResumeLoop(spec) {
  spec.states.push({ id: "hold", type: "waiting", label: "보류", lane: "wait", col: 1 });
  spec.transitions.push(
    { from: "review", to: "hold", variant: "security" },
    { from: "hold", to: "review", variant: "emphasis" },
  );
}

function addLane(spec) {
  spec.lanes.push({ id: "compliance", label: "준수" });
  spec.nodes[2].lane = "compliance";
}

function addBoundary(spec) {
  spec.boundaries.push({ kind: "security-group", label: "격리", wraps: ["store"] });
}

function addParticipant(spec) {
  spec.participants.push({ id: "audit", type: "cloud", label: "감사" });
  spec.messages.push({ from: "api", to: "audit", y: 300, label: "기록", variant: "dashed" });
}

function workflowGraph(name, undirectedEdges) {
  const ids = ["a", "b", "c", "d", "e", "f"];
  return {
    schema_version: 1,
    diagram_type: "workflow",
    meta: meta(name),
    lanes: [{ id: "core", label: "핵심" }],
    nodes: ids.map((id) => ({ id, lane: "core", col: 0, type: "backend", label: id })),
    mainPath: ids,
    edges: undirectedEdges.flatMap(([from, to]) => [
      { from, to, variant: "default", role: "main" },
      { from: to, to: from, variant: "default", role: "main" },
    ]),
  };
}

function symmetricWorkflow(ids, complete = false) {
  return {
    schema_version: 1,
    diagram_type: "workflow",
    meta: meta(complete ? "완전 그래프" : "빈 그래프"),
    lanes: [{ id: "core", label: "핵심" }],
    nodes: ids.map((id) => ({ id, lane: "core", col: 0, type: "backend", label: "동일 노드" })),
    mainPath: ids,
    edges: complete ? ids.flatMap((from) => ids.filter((to) => to !== from).map((to) => ({ from, to, variant: "default", role: "main" }))) : [],
  };
}

function boundedWorkflowSignatures(specs) {
  const signatureModule = new URL("../../tooling/lib/archify-signature.mjs", import.meta.url).href;
  const program = [
    `import { structuralSignature } from ${JSON.stringify(signatureModule)};`,
    `const specs = ${JSON.stringify(specs)};`,
    'console.log(JSON.stringify(specs.map((spec) => structuralSignature({ type: "workflow", spec }))));',
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
    encoding: "utf8",
    // The claim is that the signature stays bounded, not that a whole Node start-up plus the work fits
    // in three seconds on every host. Windows spends most of that budget before the program runs.
    timeout: 3_000 * CHILD_DEADLINE_SCALE,
  });
  assert.equal(result.error?.code, undefined, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function minimalArchitectureFixture() {
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: meta("단일 컴포넌트"),
    components: [{ id: "api", type: "backend", label: "API" }],
  };
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
  assert.equal(structuralSignature({ type: "workflow", spec: first }), structuralSignature({ type: "workflow", spec: second }));
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
    assert.notEqual(structuralSignature({ type, spec: original }), structuralSignature({ type, spec: changed }));
  });
}

test("non-isomorphic regular directed graphs have different signatures", () => {
  const k33 = workflowGraph("K3,3", [["a", "d"], ["a", "e"], ["a", "f"], ["b", "d"], ["b", "e"], ["b", "f"], ["c", "d"], ["c", "e"], ["c", "f"]]);
  const prism = workflowGraph("triangular prism", [["a", "b"], ["b", "c"], ["c", "a"], ["d", "e"], ["e", "f"], ["f", "d"], ["a", "d"], ["b", "e"], ["c", "f"]]);
  assert.notEqual(structuralSignature({ type: "workflow", spec: k33 }), structuralSignature({ type: "workflow", spec: prism }));
});

test("12-node empty workflow is bounded and invariant to IDs and array order", () => {
  const first = symmetricWorkflow(Array.from({ length: 12 }, (_, index) => `node${index}`));
  const second = symmetricWorkflow(Array.from({ length: 12 }, (_, index) => `renamed${11 - index}`));
  second.nodes.reverse();
  const [firstSignature, secondSignature] = boundedWorkflowSignatures([first, second]);
  assert.equal(firstSignature, secondSignature);
});

test("12-node complete workflow is bounded and invariant to IDs and array order", () => {
  const first = symmetricWorkflow(Array.from({ length: 12 }, (_, index) => `node${index}`), true);
  const second = symmetricWorkflow(Array.from({ length: 12 }, (_, index) => `renamed${11 - index}`), true);
  second.nodes.reverse();
  const [firstSignature, secondSignature] = boundedWorkflowSignatures([first, second]);
  assert.equal(firstSignature, secondSignature);
});

test("components-only architecture follows the official optional collection contract", () => {
  const minimal = minimalArchitectureFixture();
  assert.doesNotThrow(() => structuralSignature({ type: "architecture", spec: minimal }));
  for (const field of ["connections", "boundaries"]) {
    const malformed = structuredClone(minimal);
    malformed[field] = {};
    assert.throws(() => structuralSignature({ type: "architecture", spec: malformed }), /array when present/u);
  }
});

test("architecture boundary wraps and positions participate without labels", () => {
  const original = architectureFixture();
  const membershipChanged = structuredClone(original);
  membershipChanged.boundaries[0].wraps = ["client", "api"];
  const positionChanged = structuredClone(original);
  [positionChanged.components[0].pos, positionChanged.components[2].pos] = [positionChanged.components[2].pos, positionChanged.components[0].pos];
  assert.notEqual(structuralSignature({ type: "architecture", spec: original }), structuralSignature({ type: "architecture", spec: membershipChanged }));
  assert.notEqual(structuralSignature({ type: "architecture", spec: original }), structuralSignature({ type: "architecture", spec: positionChanged }));
});

test("sequence participant order and message y participate in the signature", () => {
  const original = sequenceFixture();
  const reordered = structuredClone(original);
  [reordered.participants[0], reordered.participants[2]] = [reordered.participants[2], reordered.participants[0]];
  const movedMessage = structuredClone(original);
  movedMessage.messages[1].y = 160;
  assert.notEqual(structuralSignature({ type: "sequence", spec: original }), structuralSignature({ type: "sequence", spec: reordered }));
  assert.notEqual(structuralSignature({ type: "sequence", spec: original }), structuralSignature({ type: "sequence", spec: movedMessage }));
});

test("workflow roles and variant placement participate in canonical adjacency", () => {
  const original = workflowFixture({ ids: ["a", "b", "c", "d", "e"], labels: ["a", "b", "c", "d", "e"] });
  original.nodes.forEach((node, index) => { node.col = index; node.type = "backend"; node.lane = "author"; });
  original.edges = [
    { from: "a", to: "b", variant: "emphasis", role: "main" },
    { from: "a", to: "c", variant: "default", role: "branch" },
    { from: "b", to: "d", variant: "default", role: "main" },
    { from: "c", to: "d", variant: "emphasis", role: "main" },
    { from: "d", to: "e", variant: "default", role: "main" },
  ];
  const roleChanged = structuredClone(original);
  roleChanged.edges[0].role = "branch";
  const variantRepositioned = structuredClone(original);
  [variantRepositioned.edges[0].variant, variantRepositioned.edges[1].variant] = [variantRepositioned.edges[1].variant, variantRepositioned.edges[0].variant];
  assert.notEqual(structuralSignature({ type: "workflow", spec: original }), structuralSignature({ type: "workflow", spec: roleChanged }));
  assert.notEqual(structuralSignature({ type: "workflow", spec: original }), structuralSignature({ type: "workflow", spec: variantRepositioned }));
});

test("dataflow stage and row participate in the signature", () => {
  const original = dataflowFixture();
  const changed = structuredClone(original);
  changed.nodes[1].row = 3;
  assert.notEqual(structuralSignature({ type: "dataflow", spec: original }), structuralSignature({ type: "dataflow", spec: changed }));
});

test("diagram type participates in the signature", () => {
  assert.notEqual(structuralSignature({ type: "workflow", spec: workflowFixture() }), structuralSignature({ type: "lifecycle", spec: lifecycleFixture() }));
});

test("duplicates require a symmetric documented shared-process exception", () => {
  assert.throws(() => findStructuralDuplicates({
    catalog: duplicateCatalog({
      firstException: { shared_process_with: "second", shared_process_reason: null },
      secondException: { shared_process_with: "first", shared_process_reason: null },
    }),
    specsById: duplicateSpecs(),
  }), /shared_process_reason/u);
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
  assert.deepEqual(findStructuralDuplicates({ catalog: duplicateCatalog(exceptions), specsById: duplicateSpecs() }), []);
});

test("mutual exceptions with different signatures are rejected before duplicate grouping", () => {
  const catalog = duplicateCatalog({
    firstException: { shared_process_with: "second", shared_process_reason: "공통 근거" },
    secondException: { shared_process_with: "first", shared_process_reason: "공통 근거" },
  });
  const specsById = duplicateSpecs();
  specsById.get("second").nodes.push({ id: "extra", lane: "author", col: 3, type: "backend", label: "추가" });
  specsById.get("second").edges.push({ from: "second-c", to: "extra", variant: "default", role: "main" });
  assert.throws(() => findStructuralDuplicates({ catalog, specsById }), /same structural signature/u);
});

test("declared shared-process exception requires an existing selected target", () => {
  const catalog = duplicateCatalog({
    firstException: { shared_process_with: "missing", shared_process_reason: "공통 근거" },
  });
  assert.throws(() => findStructuralDuplicates({ catalog, specsById: new Map() }), /target does not exist/u);
});

test("only a fully non-materialized shared-process pair is deferred", () => {
  const catalog = duplicateCatalog({
    firstException: { shared_process_with: "second", shared_process_reason: "공통 근거" },
    secondException: { shared_process_with: "first", shared_process_reason: "공통 근거" },
  });
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById: new Map() }), []);
  assert.throws(() => findStructuralDuplicates({
    catalog,
    specsById: new Map([["first", workflowFixture()]]),
  }), /both have materialized specs/u);
});

for (const [name, mutate, pattern] of [
  ["missing endpoint", (spec) => { delete spec.edges[0].from; }, /from/u],
  ["unresolved endpoint", (spec) => { spec.edges[0].to = "missing"; }, /unresolved/u],
  ["object endpoint", (spec) => { spec.edges[0].from = { id: "a" }; }, /string/u],
  ["duplicate node ID", (spec) => { spec.nodes.push({ ...spec.nodes[0], label: "복제" }); }, /duplicate node id/u],
]) {
  test(`workflow rejects ${name} instead of silently omitting topology`, () => {
    const spec = workflowFixture();
    mutate(spec);
    assert.throws(() => structuralSignature({ type: "workflow", spec }), pattern);
  });
}
