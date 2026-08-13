import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { hashArchifySource, loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { findStructuralDuplicates } from "../../tooling/lib/archify-signature.mjs";
import { sha256 } from "../../tooling/lib/hash.mjs";
import { validateArchifyDeliverReceipt } from "../../tooling/lib/archify-receipt.mjs";
import { resolveArchifyInstallation } from "../../shared/scripts/capability-probe.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const execFile = promisify(execFileCallback);
let archifyInstallation;

function semanticNodeIds(spec) {
  return (spec.nodes ?? spec.components ?? []).map((node) => node.id).sort();
}

async function markdownHasHeading(filename, heading) {
  const source = await readFile(filename, "utf8");
  return new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "mu").test(source);
}

async function loadProductionSpecs(repoRoot, product) {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const specsById = new Map();
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === product)) {
    specsById.set(entry.id, JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8")));
  }
  return { catalog, specsById };
}

async function validateInstalledSpec(spec, type) {
  const directory = await mkdtemp(path.join(tmpdir(), "studio-archify-spec-"));
  const filename = path.join(directory, "candidate.json");
  try {
    await writeFile(filename, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    const installation = await (archifyInstallation ??= resolveArchifyInstallation(process.env));
    assert.equal(installation.status, "available", `Archify is required for this production contract (resolver status: ${installation.status}).`);
    assert.equal(typeof installation.cli?.realpath, "string", "The resolved Archify installation must provide a pinned CLI path.");
    return await execFile(process.execPath, [
      installation.cli.realpath,
      "validate",
      type,
      filename,
      "--quality",
      "showcase",
      "--json",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function validateInstalledWorkflowSpec(spec) {
  return validateInstalledSpec(spec, "workflow");
}

async function installedValidationError(spec, type = "workflow") {
  try {
    await validateInstalledSpec(spec, type);
  } catch (error) {
    return `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }
  assert.fail("the installed workflow validator accepted an invalid candidate");
}

function studioWorkflowSpec(specsById) {
  const spec = specsById.get("studio-project-workflow");
  assert.ok(spec, "studio-project-workflow spec is required");
  return spec;
}

function careerWorkflowSpec(specsById) {
  const spec = specsById.get("career-evidence-workflow");
  assert.ok(spec, "career-evidence-workflow spec is required");
  return spec;
}

function assertEdge(spec, from, to) {
  assert.ok(spec.edges.some((edge) => edge.from === from && edge.to === to), `${from} -> ${to} is required`);
}

function assertFlow(spec, from, to) {
  assert.ok(spec.flows.some((flow) => flow.from === from && flow.to === to), `${from} -> ${to} is required`);
}

function assertPrimaryNodeBound(spec) {
  assert.ok(spec.nodes.length <= 12, `workflow has ${spec.nodes.length} primary nodes; at most 12 are allowed`);
}

function assertNoGroupLabelNodeOverlap(spec) {
  const overlaps = (spec.groups ?? []).flatMap((group) => spec.nodes
    .filter((node) => node.lane === group.lane && node.col >= group.fromCol && node.col <= group.toCol)
    .map((node) => `${group.id}:${node.id}`));
  assert.deepEqual(overlaps, [], "workflow group labels must not occupy the same lane-and-column cells as nodes");
}

function assertResumeReturnsToBlockedImageReview(spec) {
  const branch = spec.edges.find((edge) => edge.from === "image_asset_review" && edge.to === "resume_context");
  assert.deepEqual(branch && { role: branch.role, label: branch.label }, { role: "branch", label: "보류" });
  const resume = spec.edges.find((edge) => edge.from === "resume_context");
  assert.deepEqual(resume && { to: resume.to, role: resume.role, label: resume.label }, {
    to: "image_asset_review",
    role: "return",
    label: "재개",
  });
  assert.equal(spec.edges.some((edge) => edge.from === "resume_context" && edge.to === "canonical_artifact"), false);
}

function assertCareerHoldResumesEvidenceResearch(spec) {
  const hold = spec.edges.find((edge) => edge.from === "evidence_research" && edge.to === "held_context");
  assert.deepEqual(hold && { role: hold.role, label: hold.label }, { role: "branch", label: "보류" });
  const resume = spec.edges.find((edge) => edge.from === "held_context");
  assert.deepEqual(resume && { to: resume.to, role: resume.role, label: resume.label }, {
    to: "evidence_research",
    role: "return",
    label: "재개",
  });
  const resumeView = spec.meta.views.find((view) => view.id === "resume-contract");
  assert.deepEqual(resumeView?.focus, ["held_context", "evidence_research"]);
}

function assertCareerRouteAndReviewTopology(spec) {
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "portfolio_case",
    "growth_experiment",
    "human_review",
  ]) assert.ok(ids.has(id), `${id} is required`);
  const branch = (from, to) => {
    const edge = spec.edges.find((item) => item.from === from && item.to === to);
    assert.equal(edge?.role, "branch", `${from} -> ${to} must be a real branch`);
  };
  assertEdge(spec, "evidence_project", "portfolio_case");
  branch("evidence_project", "growth_experiment");
  assertEdge(spec, "portfolio_case", "human_review");
  branch("growth_experiment", "human_review");
  assertEdge(spec, "human_review", "export_prepare");
  const careerRoutes = spec.cards.find((card) => card.title === "경력 경로");
  assert.ok(careerRoutes?.items.some((item) => /면접/u.test(item) && item.includes("근거 ID")), "면접 경로 카드가 필요합니다");
  const reviewLayers = spec.cards.find((card) => card.title === "검토 층");
  assert.ok(reviewLayers, "검토 층 카드가 필요합니다");
  for (const layer of ["내용", "근거", "문서 품질"]) {
    assert.ok(reviewLayers.items.some((item) => item.includes(layer)), `${layer} review layer is required`);
  }
}

function assertCareerSafetyLanguage(spec) {
  const visibleText = JSON.stringify(spec);
  assert.match(visibleText, /채용 결과를 보장하지 않습니다/u);
  assert.doesNotMatch(
    visibleText,
    /approval\s+is\s+automatic|automatic\s+approval|hiring\s+is\s+guaranteed|guaranteed\s+hiring|자동\s*승인|승인이\s*자동|채용\s*보장|채용이\s*보장/iu,
  );
}

function primaryNodeCount(spec) {
  return (spec.nodes ?? spec.components ?? []).length;
}

function suitePluginSystemArchitecture(specsById) {
  const spec = specsById.get("suite-plugin-system-architecture");
  assert.ok(spec, "suite-plugin-system-architecture spec is required");
  return spec;
}

function assertArchitectureConnection(spec, from, to) {
  assert.ok(spec.connections.some((connection) => connection.from === from && connection.to === to), `${from} -> ${to} is required`);
}

const suiteInterfaceCards = [
  {
    title: "전문 작업 도구",
    items: [
      "게임 제작 기획 플러그인(Studio)은 기획서를 만들고 전문 작업을 연결합니다.",
      "취업·학습 플러그인(Career)은 승인된 자료만 포트폴리오와 학습에 활용합니다.",
    ],
  },
  {
    title: "결과물과 검토 기록",
    items: [
      "기준 기획 결과물(Canonical Artifact)은 본문·근거·결정 기록을 함께 보관합니다.",
      "내보내기 목록(export-manifest.yml)은 전달 전 점검 맥락을 기록합니다.",
    ],
  },
];

function architecturePathExists(spec, from, to, excluded = new Set()) {
  const adjacent = new Map();
  for (const connection of spec.connections) {
    adjacent.set(connection.from, [...(adjacent.get(connection.from) ?? []), connection.to]);
  }
  const pending = [from];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.shift();
    if (excluded.has(current)) continue;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(adjacent.get(current) ?? []));
  }
  return false;
}

function assertSuitePluginSystemArchitecture(spec) {
  assert.equal(spec.diagram_type, "architecture");
  assert.equal(spec.meta.quality_profile, "showcase");
  assert.equal(spec.meta.title, "게임 기획 플러그인 모음 전체 시스템 구조");
  assert.deepEqual(spec.meta.views.map((view) => view.label), ["플러그인 선택과 경계", "기준 결과물과 자동 검증", "사람 검토·승인과 재개"]);
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "app_cli", "marketplace", "studio_plugin", "career_plugin", "studio_artifact",
    "career_evidence", "visual_lane", "export_lane", "automated_validation", "held_lane",
    "human_approval", "delivered_result",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assert.equal(spec.components.length, 12, "architecture must retain exactly 12 primary components");
  const boundaryByLabel = new Map(spec.boundaries.map((boundary) => [boundary.label, boundary]));
  for (const label of ["Studio 결과물 저장소", "Career 활용 자료 저장소", "검토·승인 경계"]) {
    assert.ok(boundaryByLabel.has(label), `${label} is required`);
  }
  const studioStorage = new Set(boundaryByLabel.get("Studio 결과물 저장소").wraps);
  const careerStorage = new Set(boundaryByLabel.get("Career 활용 자료 저장소").wraps);
  assert.equal(studioStorage.has("studio_artifact"), true, "Studio owns its Canonical Artifact");
  assert.equal(careerStorage.has("career_evidence"), true, "Career owns its evidence candidate");
  assert.deepEqual([...studioStorage], ["studio_artifact"], "Studio storage owns only its Artifact");
  assert.deepEqual([...careerStorage], ["career_evidence"], "Career storage owns only its evidence candidate");
  assert.equal([...studioStorage].some((id) => careerStorage.has(id)), false, "Studio and Career storage must not overlap");
  const byId = new Map(spec.components.map((component) => [component.id, component]));
  assert.match(`${byId.get("app_cli").label} ${byId.get("app_cli").sublabel}`, /사용자 진입점.*Codex App·CLI/u);
  assert.match(`${byId.get("studio_plugin").label} ${byId.get("studio_plugin").sublabel}`, /게임 제작 기획 플러그인.*Studio/u);
  assert.match(`${byId.get("career_plugin").label} ${byId.get("career_plugin").sublabel}`, /취업·학습 플러그인.*Career/u);
  assert.match(`${byId.get("studio_artifact").label} ${byId.get("studio_artifact").sublabel}`, /기준 기획 결과물.*Canonical Artifact/u);
  assert.match(`${byId.get("studio_artifact").label} ${byId.get("studio_artifact").sublabel}`, /content\.md.*evidence\.yml.*decisions\//u);
  assert.match(`${byId.get("career_evidence").label} ${byId.get("career_evidence").sublabel}`, /포트폴리오 활용용 검토 완료 자료/u);
  const visibleText = JSON.stringify({
    meta: { title: spec.meta.title, subtitle: spec.meta.subtitle, views: spec.meta.views.map(({ label, note }) => ({ label, note })) },
    components: spec.components.map(({ label, sublabel }) => ({ label, sublabel })),
    boundaries: spec.boundaries.map(({ label }) => ({ label })),
    cards: spec.cards,
  });
  assert.doesNotMatch(visibleText, /증거 후보|lane|namespace|orchestrator/iu, "visible suite copy must stay Korean-first");
  assert.deepEqual(
    spec.cards.map(({ title, items }) => ({ title, items })),
    suiteInterfaceCards,
    "interface cards must remain two independent visible contracts",
  );
  assert.equal(spec.components.some((component) => suiteInterfaceCards.some((card) => card.title === component.label)), false, "interface cards must not masquerade as topology nodes");
  for (const [from, to] of [
    ["app_cli", "marketplace"], ["marketplace", "studio_plugin"], ["marketplace", "career_plugin"],
    ["studio_plugin", "studio_artifact"], ["career_plugin", "career_evidence"],
    ["studio_artifact", "visual_lane"], ["studio_artifact", "export_lane"],
    ["visual_lane", "automated_validation"], ["export_lane", "automated_validation"],
    ["automated_validation", "human_approval"],
    ["human_approval", "delivered_result"], ["studio_plugin", "human_approval"],
    ["human_approval", "career_evidence"], ["career_evidence", "career_plugin"],
    ["automated_validation", "held_lane"], ["held_lane", "studio_artifact"],
  ]) assertArchitectureConnection(spec, from, to);
  const visualValidation = spec.connections.find((connection) => connection.from === "visual_lane" && connection.to === "automated_validation");
  const exportValidation = spec.connections.find((connection) => connection.from === "export_lane" && connection.to === "automated_validation");
  assert.notEqual(visualValidation?.toSide, exportValidation?.toSide, "visual and export validation ingress must be distinguishable");
  assert.equal(architecturePathExists(spec, "studio_plugin", "career_evidence", new Set(["human_approval"])), false, "Studio may reach Career evidence only after human approval");
  assert.equal(architecturePathExists(spec, "automated_validation", "studio_artifact", new Set(["held_lane"])), false, "validation failure may return to the Artifact only through held_lane");
  assert.equal(spec.connections.some((connection) => connection.from === "studio_artifact" && connection.to === "career_evidence"), false, "Artifact must not bypass approval into Career evidence");
  assert.equal(spec.connections.some((connection) => connection.from === "studio_plugin" && connection.to === "career_evidence"), false, "Studio must not bypass approval into Career evidence");
  assert.equal(spec.connections.some((connection) => connection.from === "automated_validation" && connection.to === "studio_artifact"), false, "validation must not bypass held_lane");
  assert.equal(spec.connections.some((connection) => connection.to === "delivered_result" && connection.from !== "human_approval"), false, "derived output must not bypass human approval");
  const approvalView = spec.meta.views.find((view) => view.id === "human-approval");
  for (const id of ["human_approval", "held_lane", "studio_artifact", "automated_validation", "delivered_result"]) {
    assert.ok(approvalView.focus.includes(id), `approval view retains ${id} in its visible path`);
  }
}

function hasNamedProductBoundary(spec, product) {
  const labels = { Studio: "스튜디오 경계", Career: "커리어 경계" };
  return spec.nodes.some((node) => node.label === labels[product]);
}

function containsCompleteProductGraph(spec, product) {
  const normalized = product.toLowerCase();
  const nodeIds = new Set(semanticNodeIds(spec));
  const completeGraphs = {
    studio: [
      "vision_approval", "canonical_artifact", "domain_design", "specialist_review",
      "finding_decision", "image_asset_plan", "image_asset_review", "format_qa_export",
    ],
    career: [
      "stage_diagnosis", "disclosure_approval", "evidence_research", "evidence_project",
      "portfolio_case", "growth_experiment", "human_review", "export_prepare",
    ],
  };
  return (completeGraphs[normalized] ?? []).every((id) => nodeIds.has(id));
}

function assertSuiteHandoffSemantics(spec) {
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "studio_boundary", "public_evidence_summary", "decision_owner", "career_boundary",
    "career_portfolio_input", "held_handoff", "resume_receipt",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertFlow(spec, "studio_boundary", "public_evidence_summary");
  assertFlow(spec, "public_evidence_summary", "decision_owner");
  assertFlow(spec, "decision_owner", "career_boundary");
  assertFlow(spec, "career_boundary", "career_portfolio_input");
  assert.equal(spec.nodes.find((node) => node.id === "decision_owner")?.type, "external");
  const hold = spec.flows.find((flow) => flow.from === "decision_owner" && flow.to === "held_handoff");
  assert.equal(hold?.classification, "보류");
  assertFlow(spec, "held_handoff", "resume_receipt");
  const resume = spec.flows.find((flow) => flow.from === "resume_receipt" && flow.to === "decision_owner");
  assert.deepEqual(resume && { to: resume.to, classification: resume.classification }, {
    to: "decision_owner",
    classification: "재개",
  });
}

function assertSuiteSafetyLanguage(spec) {
  const visibleText = JSON.stringify(spec);
  for (const phrase of [
    "공개 가능한 문제·결정·대안·검증한 근거 요약만 보냅니다",
    "이름이 있는 사람 결정 담당자가 공개 범위를 승인하거나 보류합니다",
    "승인은 자동이 아니며",
    "채용 결과를 보장하지 않습니다",
  ]) assert.ok(visibleText.includes(phrase), `${phrase} is required`);
  assert.doesNotMatch(
    visibleText,
    /approval\s+is\s+automatic|automatic\s+approval|hiring\s+is\s+guaranteed|guaranteed\s+hiring|자동\s*승인|승인이\s*자동|채용\s*보장|채용이\s*보장/iu,
  );
}

function assertSuiteReceiptContract(receipt, entry, specification, artifact) {
  assert.equal(receipt.schemaVersion, 1, "receipt schemaVersion");
  assert.equal(receipt.ok, true, "receipt ok");
  assert.equal(receipt.command, "deliver", "receipt command");
  assert.equal(receipt.type, "dataflow", "receipt type");
  assert.equal(receipt.quality, "showcase", "receipt quality");
  assert.equal(receipt.input, entry.spec, "receipt input");
  assert.equal(receipt.output, entry.html, "receipt output");
  assert.deepEqual({ checksPassed: receipt.checksPassed, checkCount: receipt.checkCount, errors: receipt.errors, warnings: receipt.warnings }, {
    checksPassed: 9, checkCount: 9, errors: 0, warnings: 0,
  });
  assert.equal(receipt.compositionProfile, "showcase", "receipt compositionProfile");
  assert.equal(receipt.compositionStatus, "pass", "receipt compositionStatus");
  validateArchifyDeliverReceipt({
    ...receipt,
    validation: {
      checksPassed: receipt.checksPassed,
      checkCount: receipt.checkCount,
      errors: receipt.errors,
      warnings: receipt.warnings,
      compositionProfile: receipt.compositionProfile,
      compositionStatus: receipt.compositionStatus,
    },
  }, { specification, artifact });
}

async function publishedSuiteArtifact(entry) {
  return readFile(path.join(repoRoot, entry.html));
}

test("every selected Studio entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const studio = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "studio");
  for (const entry of studio) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "studio");
    assert.ok(entry.composition_rationale.length >= 20);
  }
});

test("every selected Career entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const career = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "career");
  for (const entry of career) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "career");
    assert.match(entry.composition_rationale, /증거|검토|학습|승인|재개/u);
  }
});

test("Suite plugin system architecture preserves product boundaries, artifact lanes, and approval", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  const entry = catalog.entries.find((item) => item.id === "suite-plugin-system-architecture");
  const spec = suitePluginSystemArchitecture(specsById);
  assert.equal(entry?.delivery_status, "published");
  assert.equal(entry?.visual_review, "passed");
  assert.equal(entry?.reviewer, "Codex 헤드리스 시각 QA");
  await assert.doesNotReject(() => validateInstalledSpec(spec, "architecture"));
  assertSuitePluginSystemArchitecture(spec);
});

test("Suite plugin system architecture rejects approval and hold bypasses plus storage ownership swaps", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = suitePluginSystemArchitecture(specsById);
  const withoutApproval = {
    ...spec,
    components: spec.components.filter((component) => component.id !== "human_approval"),
    connections: spec.connections.filter((connection) => connection.from !== "human_approval" && connection.to !== "human_approval"),
  };
  const directDelivery = {
    ...spec,
    connections: [...spec.connections, { from: "visual_lane", to: "delivered_result" }],
  };
  const swappedStorageOwnership = {
    ...spec,
    boundaries: spec.boundaries.map((boundary) => boundary.label === "Studio 결과물 저장소"
      ? { ...boundary, wraps: ["career_evidence"] }
      : boundary.label === "Career 활용 자료 저장소"
        ? { ...boundary, wraps: ["studio_artifact"] }
        : boundary),
  };
  const studioArtifactBypass = {
    ...spec,
    connections: [...spec.connections, { from: "studio_artifact", to: "career_evidence" }],
  };
  const studioPluginBypass = {
    ...spec,
    connections: [...spec.connections, { from: "studio_plugin", to: "career_evidence" }],
  };
  const validationBypass = {
    ...spec,
    connections: [...spec.connections, { from: "automated_validation", to: "studio_artifact" }],
  };
  const withoutHeldLane = {
    ...spec,
    components: spec.components.filter((component) => component.id !== "held_lane"),
    connections: spec.connections.filter((connection) => connection.from !== "held_lane" && connection.to !== "held_lane"),
  };
  assert.throws(() => assertSuitePluginSystemArchitecture(withoutApproval), /human_approval/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(directDelivery), /bypass human approval/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(swappedStorageOwnership), /Studio owns its Canonical Artifact/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(studioArtifactBypass), /Studio may reach Career evidence only after human approval/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(studioPluginBypass), /Studio may reach Career evidence only after human approval/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(validationBypass), /validation failure may return to the Artifact only through held_lane/u);
  assert.throws(() => assertSuitePluginSystemArchitecture(withoutHeldLane), /held_lane/u);
});

test("Suite plugin system architecture rejects missing, swapped, merged, or sublabel-only interface cards", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = suitePluginSystemArchitecture(specsById);
  const withoutSkillCard = { ...spec, cards: spec.cards.filter((card) => card.title !== "전문 작업 도구") };
  const swappedCards = {
    ...spec,
    cards: suiteInterfaceCards.map((card, index) => ({ ...card, items: suiteInterfaceCards[1 - index].items })),
  };
  const mergedCards = {
    ...spec,
    cards: [{ ...suiteInterfaceCards[0], items: [...suiteInterfaceCards[0].items, ...suiteInterfaceCards[1].items] }],
  };
  const sublabelOnly = {
    ...spec,
    cards: suiteInterfaceCards.map((card) => ({ ...card, items: [] })),
    components: spec.components.map((component) => component.id === "studio_plugin"
      ? { ...component, sublabel: "Studio 전문 스킬과 game-design-studio namespace" }
      : component.id === "career_plugin"
        ? { ...component, sublabel: "Career 전문 스킬과 game-design-career namespace" }
        : component.id === "studio_artifact"
          ? { ...component, sublabel: "content.md, evidence.yml, decisions/, export-manifest.yml" }
          : component),
  };
  for (const mutated of [withoutSkillCard, swappedCards, mergedCards, sublabelOnly]) {
    assert.throws(() => assertSuitePluginSystemArchitecture(mutated), /interface cards|Expected values|기준 기획 결과물/u);
  }
});

test("Suite specs exist only for questions that cross both product boundaries", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.id === "suite-studio-career-handoff")) {
    assert.match(entry.decision_reason, /Studio/u);
    assert.match(entry.decision_reason, /Career/u);
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.ok(hasNamedProductBoundary(spec, "Studio"));
    assert.ok(hasNamedProductBoundary(spec, "Career"));
    assertSuiteHandoffSemantics(spec);
    assertSuiteSafetyLanguage(spec);
  }
});

test("Suite specs stay bounded and do not concatenate both product graphs", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    const spec = specsById.get(entry.id);
    assert.ok(primaryNodeCount(spec) <= 12, entry.id);
    if (spec.diagram_type === "dataflow") {
      assert.equal(containsCompleteProductGraph(spec, "studio"), false, entry.id);
      assert.equal(containsCompleteProductGraph(spec, "career"), false, entry.id);
    }
  }
});

test("Suite dataflow publishes a current localized artifact and exact receipt after visual review", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  const entry = catalog.entries.find((item) => item.id === "suite-studio-career-handoff");
  const spec = specsById.get("suite-studio-career-handoff");
  assert.equal(entry?.delivery_status, "published");
  assert.equal(entry?.visual_review, "passed");
  assert.deepEqual(entry?.diagnostics, []);
  await assert.doesNotReject(() => validateInstalledSpec(spec, "dataflow"));
  const specification = await readFile(path.join(repoRoot, entry.spec));
  const artifact = await publishedSuiteArtifact(entry);
  const receipt = JSON.parse(await readFile(path.join(repoRoot, entry.receipt), "utf8"));
  assertSuiteReceiptContract(receipt, entry, specification, artifact);
  assert.deepEqual(receipt.specification, { sha256: sha256(specification), bytes: specification.byteLength });
  assert.deepEqual(receipt.artifact, { sha256: sha256(artifact), bytes: artifact.byteLength });
  assert.match(artifact.toString("utf8"), /<html lang="ko"/u);
  assert.match(artifact.toString("utf8"), /data-archify-ko-localizer/u);
});

test("Suite dataflow contract rejects schema, unsafe approval, and held-route mutations", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = specsById.get("suite-studio-career-handoff");
  const invalidSchema = { ...spec, diagram_type: "workflow" };
  const automaticApproval = structuredClone(spec);
  automaticApproval.cards[1].items.push("Approval is automatic");
  const wrongResume = {
    ...spec,
    flows: spec.flows.map((flow) => flow.from === "resume_receipt" ? { ...flow, to: "career_portfolio_input" } : flow),
  };
  const missingHeldReceipt = {
    ...spec,
    flows: spec.flows.filter((flow) => !(flow.from === "held_handoff" && flow.to === "resume_receipt")),
  };
  assert.match(await installedValidationError(invalidSchema, "dataflow"), /schema|diagram_type/u);
  assert.throws(() => assertSuiteSafetyLanguage(automaticApproval), /automatic/u);
  assert.throws(() => assertSuiteHandoffSemantics(wrongResume), /decision_owner/u);
  assert.throws(() => assertSuiteHandoffSemantics(missingHeldReceipt), /held_handoff/u);
});

test("Suite safety contract rejects removal and bilingual approval or hiring guarantees", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = specsById.get("suite-studio-career-handoff");
  const replaceVisibleText = (value, target, replacement) => {
    if (typeof value === "string") return value.replaceAll(target, replacement);
    if (Array.isArray(value)) return value.map((item) => replaceVisibleText(item, target, replacement));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceVisibleText(item, target, replacement)]));
    return value;
  };
  for (const phrase of [
    "공개 가능한 문제·결정·대안·검증한 근거 요약만 보냅니다",
    "이름이 있는 사람 결정 담당자가 공개 범위를 승인하거나 보류합니다",
    "승인은 자동이 아니며",
    "채용 결과를 보장하지 않습니다",
  ]) {
    assert.throws(() => assertSuiteSafetyLanguage(replaceVisibleText(spec, phrase, "redacted")), new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  for (const contradiction of ["Approval is automatic", "자동 승인", "Hiring is guaranteed", "채용 보장"]) {
    const mutated = structuredClone(spec);
    mutated.cards[1].items.push(contradiction);
    assert.throws(() => assertSuiteSafetyLanguage(mutated));
  }
});

test("Suite published receipt rejects exact provenance mutations", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  const entry = catalog.entries.find((item) => item.id === "suite-studio-career-handoff");
  assert.ok(specsById.get("suite-studio-career-handoff"));
  const receipt = JSON.parse(await readFile(path.join(repoRoot, entry.receipt), "utf8"));
  const candidate = await readFile(path.join(repoRoot, entry.spec));
  const artifact = await publishedSuiteArtifact(entry);
  for (const [field, value] of [
    ["command", "validate"], ["type", "workflow"], ["quality", "standard"],
    ["input", "wrong-input"], ["output", "wrong-output"], ["compositionProfile", "standard"],
    ["compositionStatus", "failed"], ["artifact", { sha256: "0".repeat(64), bytes: artifact.byteLength }],
  ]) {
    const mutated = { ...receipt, [field]: value };
    assert.throws(() => assertSuiteReceiptContract(mutated, entry, candidate, artifact), new RegExp(field === "artifact" ? "artifact" : field, "iu"));
  }
});

test("Suite specs remain source-bound and structurally distinct", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const specsById = new Map();
  for (const entry of catalog.entries.filter((item) => item.decision === "selected")) {
    specsById.set(entry.id, JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8")));
  }
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});

test("selected Career workflow is published only after schema and visual review pass", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "career");
  const entry = catalog.entries.find((item) => item.id === "career-evidence-workflow");
  const spec = careerWorkflowSpec(specsById);
  assertPrimaryNodeBound(spec);
  assert.equal(entry.delivery_status, "published");
  assert.equal(entry.visual_review, "passed");
  assert.equal(entry.reviewer, "Codex 헤드리스 시각 QA");
  assert.deepEqual(entry.diagnostics, []);
  await assert.doesNotReject(() => validateInstalledWorkflowSpec(spec));
});

test("Career workflow preserves evidence, human review, disclosure, and the actual resume target", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "stage_diagnosis",
    "disclosure_approval",
    "evidence_research",
    "evidence_project",
    "export_prepare",
    "held_context",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertEdge(spec, "stage_diagnosis", "disclosure_approval");
  assertEdge(spec, "disclosure_approval", "evidence_research");
  assertEdge(spec, "evidence_research", "evidence_project");
  assertCareerRouteAndReviewTopology(spec);
  assertCareerHoldResumesEvidenceResearch(spec);
  assert.equal(spec.nodes.find((node) => node.id === "human_review")?.type, "external");
  assertCareerSafetyLanguage(spec);
});

test("selected workflow group labels never share node cells", async () => {
  for (const product of ["career", "studio"]) {
    const { specsById } = await loadProductionSpecs(repoRoot, product);
    for (const spec of specsById.values()) assertNoGroupLabelNodeOverlap(spec);
  }
});

test("Career workflow contract rejects a resume mutation that changes the held work", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const wrongResume = {
    ...spec,
    edges: spec.edges.map((edge) => edge.from === "held_context" ? { ...edge, to: "evidence_project" } : edge),
  };
  assert.throws(() => assertCareerHoldResumesEvidenceResearch(wrongResume), /evidence_research/u);
});

test("Career workflow contract rejects removal of growth or document-quality review", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const withoutGrowth = {
    ...spec,
    nodes: spec.nodes.filter((node) => node.id !== "growth_experiment"),
    edges: spec.edges.filter((edge) => edge.from !== "growth_experiment" && edge.to !== "growth_experiment"),
    mainPath: spec.mainPath.filter((id) => id !== "growth_experiment"),
  };
  assert.throws(() => assertCareerRouteAndReviewTopology(withoutGrowth), /growth_experiment/u);
  const withoutDocumentQuality = structuredClone(spec);
  const reviewLayers = withoutDocumentQuality.cards.find((card) => card.title === "검토 층");
  reviewLayers.items = reviewLayers.items.filter((item) => !item.includes("문서 품질"));
  assert.throws(() => assertCareerRouteAndReviewTopology(withoutDocumentQuality), /문서 품질/u);
});

test("Career workflow contract rejects automatic approval and guaranteed hiring contradictions", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  for (const contradiction of ["Approval is automatic", "Hiring is guaranteed", "자동 승인", "채용 보장"]) {
    const mutated = structuredClone(spec);
    mutated.cards[1].items.push(contradiction);
    assert.throws(() => assertCareerSafetyLanguage(mutated));
  }
});

test("selected Studio workflow is published only after validation and visual review pass", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "studio");
  const entry = catalog.entries.find((item) => item.id === "studio-project-workflow");
  const spec = studioWorkflowSpec(specsById);
  assertPrimaryNodeBound(spec);
  assert.equal(entry.delivery_status, "published");
  assert.equal(entry.visual_review, "passed");
  assert.equal(entry.reviewer, "Codex 헤드리스 시각 QA");
  assert.deepEqual(entry.diagnostics, []);
  await assert.doesNotReject(() => validateInstalledWorkflowSpec(spec));
});

test("Studio workflow preserves the source-backed vision, review, asset, export, and resume sequence", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "vision_approval",
    "canonical_artifact",
    "domain_design",
    "specialist_review",
    "finding_decision",
    "image_asset_plan",
    "image_asset_review",
    "format_qa_export",
    "resume_context",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertEdge(spec, "vision_approval", "canonical_artifact");
  assertEdge(spec, "canonical_artifact", "domain_design");
  assertEdge(spec, "domain_design", "specialist_review");
  assertEdge(spec, "specialist_review", "finding_decision");
  assertEdge(spec, "finding_decision", "image_asset_plan");
  assertEdge(spec, "image_asset_plan", "image_asset_review");
  assertEdge(spec, "image_asset_review", "format_qa_export");
  assertEdge(spec, "image_asset_review", "resume_context");
  assertResumeReturnsToBlockedImageReview(spec);
});

test("Studio workflow contract rejects a resume mutation that restarts the canonical document", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const wrongResume = {
    ...spec,
    edges: spec.edges.map((edge) => edge.from === "resume_context" ? { ...edge, to: "canonical_artifact" } : edge),
  };
  assert.throws(() => assertResumeReturnsToBlockedImageReview(wrongResume), /image_asset_review/u);
});

test("Studio workflow contract rejects invalid-schema and thirteen-node mutations", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const invalidSchema = { ...spec, diagram_type: "architecture" };
  const overflow = {
    ...spec,
    nodes: [
      ...spec.nodes,
      ...["a", "b", "c", "d"].map((suffix) => ({
        id: `overflow_${suffix}`,
        lane: "studio",
        col: 5,
        type: "backend",
        label: `Overflow ${suffix}`,
      })),
    ],
  };
  assert.match(await installedValidationError(invalidSchema), /schema|diagram_type/u);
  assert.throws(() => assertPrimaryNodeBound(overflow), /at most 12/u);
});

test("published Studio entry exposes its exact HTML and receipt", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const entry = catalog.entries.find((item) => item.id === "studio-project-workflow");
  assert.equal(entry.delivery_status, "published");
  await access(path.join(repoRoot, entry.html));
  await access(path.join(repoRoot, entry.receipt));
  const html = await readFile(path.join(repoRoot, entry.html), "utf8");
  assert.match(html, /<html lang="ko"/u);
  assert.match(html, /data-archify-ko-localizer/u);
});

test("Studio specs remain source-bound and do not recreate the retired six-node template", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "studio");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "studio")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});

test("Career specs remain source-bound and do not recreate the retired six-node template", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "career");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "career")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});
