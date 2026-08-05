import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as workflow from "../../shared/scripts/resolve-quality-profile.mjs";

const qualityRoot = new URL("../../shared/document-quality/", import.meta.url);
const studioTemplateMapUrl = new URL("../../products/game-design-studio/plugin/references/document-quality/template-profile-map.json", import.meta.url);
const artifactDigest = "a".repeat(64);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, qualityRoot), "utf8"));
}

async function text(relativePath) {
  return readFile(new URL(relativePath, qualityRoot), "utf8");
}

function digest(value) {
  const canonical = (item) => Array.isArray(item)
    ? `[${item.map(canonical).join(",")}]`
    : item && typeof item === "object"
      ? `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`).join(",")}}`
      : JSON.stringify(item);
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function signed(value) {
  return { ...value, receiptDigest: digest(value) };
}

function inspectionReceipt(manifest) {
  return signed({
    schemaVersion: 1,
    artifactDigest,
    manifestDigest: manifest.manifestDigest,
    contractDigest: manifest.contractDigest,
    checklistDigest: manifest.checklistDigest,
    observations: manifest.requiredItemIds.map((itemId) => ({ itemId, observed: true, passed: true })),
    verifierIdentity: "artifact-inspector:round-4",
  });
}

async function applyBrief(options = {}) {
  const selectionIndex = await json("indexes/studio.json");
  const primaryText = await text("profiles/studio/game-design-brief.json");
  const templateMapSource = { sourceText: await readFile(studioTemplateMapUrl, "utf8") };
  return workflow.applyDocumentQualityProfile({
    namespace: "studio",
    selectionIndex,
    testOnlyLoaders: true,
    profileLoader: async () => ({ sourceText: primaryText }),
    templateMapSource,
    request: {
      artifactId: "brief",
      goal: "game design brief",
      audience: ["production"],
      artifactType: "design-document",
      requestedFormat: "md",
    },
    ...options,
  });
}

test("trusted application re-derives the complete manifest and rejects caller shrink plus recomputation", async () => {
  const application = await applyBrief();
  assert.ok(application.requirementManifest.requiredItemIds.length > 1);
  assert.equal(application.requirementManifest.sourceBindings.length, 2);
  assert.equal(application.requirementManifest.sourceBindings[0].sourceId, "studio-template-map");
  assert.equal(application.requirementManifest.sourceBindings[1].sourceId, "game-design-brief");

  const shrunkApplication = structuredClone(application);
  shrunkApplication.requirementManifest.requiredItemIds = [shrunkApplication.requirementManifest.requiredItemIds[0]];
  const unsignedManifest = structuredClone(shrunkApplication.requirementManifest);
  delete unsignedManifest.manifestDigest;
  shrunkApplication.requirementManifest.manifestDigest = digest(unsignedManifest);
  const matchingReceipt = inspectionReceipt(shrunkApplication.requirementManifest);

  assert.throws(
    () => workflow.createStructuralCompletionEvidence({ application: shrunkApplication, inspectionReceipt: matchingReceipt }),
    /trusted application|manifest|canonical|required/i,
  );
  const validReceipt = inspectionReceipt(application.requirementManifest);
  assert.equal(workflow.createStructuralCompletionEvidence({ application, inspectionReceipt: validReceipt }).schemaVersion, 1);
});

test("upper apply rejects canonical overlay and preset IDs with mutated bodies", async () => {
  const mobile = await json("overlays/mobile.json");
  const preset = await json("presets/function-first.json");
  const mutatedMobile = structuredClone(mobile);
  mutatedMobile.acceptance_criteria[0] = `${mutatedMobile.acceptance_criteria[0]} spoofed`;
  const mutatedPreset = structuredClone(preset);
  mutatedPreset.emphasis[0] = `${mutatedPreset.emphasis[0]} spoofed`;

  await assert.rejects(
    () => applyBrief({ overlayIds: ["mobile"], sourceLoader: async () => ({ sourceText: JSON.stringify(mutatedMobile) }) }),
    /canonical|digest|source body/i,
  );
  await assert.rejects(
    () => applyBrief({ presetId: "function-first", sourceLoader: async () => ({ sourceText: JSON.stringify(mutatedPreset) }) }),
    /canonical|digest|source body/i,
  );

  const selectionIndex = await json("indexes/studio.json");
  const primary = await json("profiles/studio/game-design-brief.json");
  await assert.rejects(() => workflow.applyDocumentQualityProfile({
    namespace: "studio",
    selectionIndex,
    profileLoader: async () => primary,
    request: { artifactId: "brief", goal: "brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" },
  }), /packaged pluginRoot|test-only/i);
});

test("selection and source inputs reject Proxy and accessors before spoof values are consumed", async () => {
  const index = await json("indexes/studio.json");
  let proxyReads = 0;
  const proxied = new Proxy(index, { get(target, key, receiver) { proxyReads += 1; return Reflect.get(target, key, receiver); } });
  assert.throws(() => workflow.selectQualityProfiles({
    selectionIndex: proxied,
    requests: [{ artifactId: "brief", goal: "brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" }],
  }), /proxy|data-only|snapshot/i);
  assert.equal(proxyReads, 0);

  let accessorReads = 0;
  const accessorIndex = structuredClone(index);
  Object.defineProperty(accessorIndex, "profiles", {
    enumerable: true,
    get() { accessorReads += 1; return index.profiles; },
  });
  assert.throws(() => workflow.validateQualitySelectionIndex(accessorIndex), /accessor|data-only|snapshot/i);
  assert.equal(accessorReads, 0);

  const mobile = await json("overlays/mobile.json");
  const bodyReadKeys = [];
  const mobileText = await text("overlays/mobile.json");
  const bodyProxy = new Proxy({ sourceText: mobileText }, { get(target, key, receiver) { bodyReadKeys.push(key); return Reflect.get(target, key, receiver); } });
  await assert.rejects(() => applyBrief({ overlayIds: ["mobile"], sourceLoader: async () => bodyProxy }), /proxy|data-only|snapshot/i);
  assert.deepEqual(bodyReadKeys, ["then"]);
});

test("manifest, inspection, envelope, and transition receipts reject Proxy/accessor TOCTOU", async () => {
  const application = await applyBrief();
  const receipt = inspectionReceipt(application.requirementManifest);
  for (const [label, target, invoke] of [
    ["inspection", receipt, (value) => workflow.createStructuralCompletionEvidence({ application, inspectionReceipt: value })],
    ["application", application, (value) => workflow.createStructuralCompletionEvidence({ application: value, inspectionReceipt: receipt })],
    ["manifest", application.requirementManifest, (value) => workflow.createStructuralCompletionEvidence({ requirementManifest: value, inspectionReceipt: receipt })],
  ]) {
    let reads = 0;
    const value = new Proxy(target, { get(source, key, receiver) { reads += 1; return Reflect.get(source, key, receiver); } });
    assert.throws(() => invoke(value), /proxy|trusted application|data-only|snapshot/i, label);
    assert.equal(reads, 0, label);
  }

  const structuralReceipt = workflow.createStructuralCompletionEvidence({ application, inspectionReceipt: receipt });
  const envelope = workflow.createDocumentQualityStateEnvelope({ artifactDigest, application });
  let proxyEnvelopeReads = 0;
  const proxyEnvelope = new Proxy(envelope, { get(source, key, receiver) { proxyEnvelopeReads += 1; return Reflect.get(source, key, receiver); } });
  assert.throws(() => workflow.transitionDocumentQualityState({
    application,
    stateEnvelope: proxyEnvelope,
    targetState: "structurally-complete",
    structuralReceipt,
  }), /proxy|data-only|snapshot/i);
  assert.equal(proxyEnvelopeReads, 0);
  let envelopeReads = 0;
  const accessorEnvelope = structuredClone(envelope);
  Object.defineProperty(accessorEnvelope, "state", { enumerable: true, get() { envelopeReads += 1; return "draft"; } });
  assert.throws(() => workflow.transitionDocumentQualityState({
    application,
    stateEnvelope: accessorEnvelope,
    targetState: "structurally-complete",
    structuralReceipt,
  }), /accessor|data-only|snapshot/i);
  assert.equal(envelopeReads, 0);

  let receiptReads = 0;
  const accessorReceipt = structuredClone(structuralReceipt);
  Object.defineProperty(accessorReceipt, "artifactDigest", { enumerable: true, get() { receiptReads += 1; return artifactDigest; } });
  assert.throws(() => workflow.transitionDocumentQualityState({
    application,
    stateEnvelope: envelope,
    targetState: "structurally-complete",
    structuralReceipt: accessorReceipt,
  }), /accessor|data-only|snapshot/i);
  assert.equal(receiptReads, 0);
});

test("recursive snapshots reject non-data shapes and unsafe Unicode before selection", async () => {
  const index = await json("indexes/studio.json");
  const base = { artifactId: "brief", goal: "brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" };
  const candidates = [];
  const customPrototype = Object.assign(Object.create({ inherited: true }), base);
  candidates.push(customPrototype);
  const hidden = structuredClone(base);
  Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
  candidates.push(hidden);
  const symbol = structuredClone(base);
  symbol[Symbol("spoof")] = true;
  candidates.push(symbol);
  const cycle = structuredClone(base);
  cycle.self = cycle;
  candidates.push(cycle);
  candidates.push({ ...base, goal: "unsafe\u202Egoal" });
  candidates.push({ ...base, goal: "Cafe\u0301" });
  candidates.push({ ...base, goal: "unsafe\uD800" });

  for (const request of candidates) {
    assert.throws(
      () => workflow.selectQualityProfiles({ selectionIndex: index, requests: [request] }),
      /prototype|non-enumerable|symbol|cycle|repeated|bidirectional|normalization|surrogate|data-only/i,
    );
  }
});

test("packaged loaders reject semantically equal but byte-mutated canonical sources", async (t) => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "quality-canonical-bytes-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "overlays"), { recursive: true });
  const mobile = await json("overlays/mobile.json");
  await writeFile(path.join(root, "overlays/mobile.json"), JSON.stringify(mobile));
  const loader = workflow.createQualitySourceLoader({ documentQualityRoot: root });
  await assert.rejects(
    () => loader({ sourceType: "overlay", sourceId: "mobile", purpose: "byte-mutation-probe" }),
    /canonical source bytes digest mismatch/i,
  );
});

test("injected upper apply rejects reordered primary, overlay, and preset source bytes", async () => {
  const reorderedText = async (relativePath) => {
    const body = await json(relativePath);
    return JSON.stringify(Object.fromEntries(Object.entries(body).reverse()));
  };
  await assert.rejects(
    () => applyBrief({ profileLoader: async () => ({ sourceText: await reorderedText("profiles/studio/game-design-brief.json") }) }),
    /canonical source bytes digest mismatch/i,
  );
  await assert.rejects(
    () => applyBrief({ overlayIds: ["mobile"], sourceLoader: async () => ({ sourceText: await reorderedText("overlays/mobile.json") }) }),
    /canonical source bytes digest mismatch/i,
  );
  await assert.rejects(
    () => applyBrief({ presetId: "function-first", sourceLoader: async () => ({ sourceText: await reorderedText("presets/function-first.json") }) }),
    /canonical source bytes digest mismatch/i,
  );
});
