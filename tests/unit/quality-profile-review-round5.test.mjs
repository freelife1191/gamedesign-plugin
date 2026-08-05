import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as workflow from "../../shared/scripts/resolve-quality-profile.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const qualityRoot = new URL("../../shared/document-quality/", import.meta.url);
const studioMapUrl = new URL("../../products/game-design-studio/plugin/references/document-quality/template-profile-map.json", import.meta.url);
const careerMapUrl = new URL("../../products/game-design-career/plugin/references/document-quality/template-profile-map.json", import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function injectedApply(namespace, templateMapSource, request) {
  const selectionIndex = await json(new URL(`indexes/${namespace}.json`, qualityRoot));
  const profileLoader = workflow.createQualityProfileBodyLoader({ documentQualityRoot: fileURLToPath(qualityRoot) });
  return workflow.applyDocumentQualityProfile({
    namespace,
    selectionIndex,
    testOnlyLoaders: true,
    profileLoader,
    templateMapSource,
    request,
  });
}

const studioRequest = {
  artifactId: "brief",
  goal: "game design brief",
  audience: ["production"],
  artifactType: "design-document",
  requestedFormat: "md",
  templateId: "game-design-brief",
};

test("production upper apply rejects a caller-authored template map before trusting the application", async (t) => {
  const stagingRoot = await mkdtemp(path.join(await realpath(tmpdir()), "quality-map-production-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const selectionIndex = await json(new URL("indexes/studio.json", qualityRoot));
  const spoof = await json(studioMapUrl);
  spoof.templates["game-design-brief"] = "master-gdd";

  await assert.rejects(
    () => workflow.applyDocumentQualityProfile({
      namespace: "studio",
      selectionIndex,
      pluginRoot: build.outputDir,
      templateMap: spoof,
      request: studioRequest,
    }),
    /caller.*template map|templateMap.*forbidden|packaged.*template map/i,
  );
});

test("test-only template-map injection accepts only exact canonical sourceText bytes", async () => {
  const studioText = await readFile(studioMapUrl, "utf8");
  const careerText = await readFile(careerMapUrl, "utf8");
  const studio = JSON.parse(studioText);
  const career = JSON.parse(careerText);
  const mutations = [
    { label: "reordered Studio", namespace: "studio", text: JSON.stringify(Object.fromEntries(Object.entries(studio).reverse())), request: studioRequest },
    { label: "whitespace-mutated Career", namespace: "career", text: `${careerText}\n`, request: { ...studioRequest, artifactId: "case-study", artifactType: "career-document", templateId: "creative-design-portfolio" } },
    { label: "cross-product", namespace: "studio", text: careerText, request: studioRequest },
    { label: "product spoof", namespace: "studio", text: JSON.stringify({ ...studio, product: "game-design-career" }), request: studioRequest },
    { label: "extra template", namespace: "studio", text: JSON.stringify({ ...studio, templates: { ...studio.templates, injected: "game-design-brief" } }), request: studioRequest },
    { label: "unknown mapped profile", namespace: "studio", text: JSON.stringify({ ...studio, templates: { ...studio.templates, "game-design-brief": "unknown-profile" } }), request: studioRequest },
    { label: "wrong-namespace profile", namespace: "studio", text: JSON.stringify({ ...studio, templates: { ...studio.templates, "game-design-brief": "portfolio-case-study" } }), request: studioRequest },
  ];
  for (const mutation of mutations) {
    await assert.rejects(
      () => injectedApply(mutation.namespace, { sourceText: mutation.text }, mutation.request),
      /canonical|template map|digest|product|profile/i,
      mutation.label,
    );
  }
  await assert.rejects(
    () => injectedApply("studio", studio, studioRequest),
    /sourceText|closed|template map/i,
  );
});

test("canonical injected maps select documented profiles and bind map identity into the manifest", async () => {
  const studioText = await readFile(studioMapUrl, "utf8");
  const careerText = await readFile(careerMapUrl, "utf8");
  const studio = await injectedApply("studio", { sourceText: studioText }, studioRequest);
  const career = await injectedApply("career", { sourceText: careerText }, {
    artifactId: "case-study",
    goal: "portfolio case study",
    audience: ["recruiter"],
    artifactType: "career-document",
    requestedFormat: "md",
    templateId: "creative-design-portfolio",
  });

  assert.equal(studio.selection.primaryProfileId, "game-design-brief");
  assert.equal(career.selection.primaryProfileId, "portfolio-case-study");
  for (const [application, namespace, sourceId] of [
    [studio, "studio", "studio-template-map"],
    [career, "career", "career-template-map"],
  ]) {
    assert.equal(application.requirementManifest.sourceBindings[0].kind, "template-map");
    assert.equal(application.requirementManifest.sourceBindings[0].namespace, namespace);
    assert.equal(application.requirementManifest.sourceBindings[0].sourceId, sourceId);
    assert.equal(application.requirementManifest.sourceBindings[1].kind, "primary");
  }
});

test("canonical template maps preserve deterministic unknown and fallback selection", async () => {
  const studioText = await readFile(studioMapUrl, "utf8");
  const { templateId: _templateId, ...requestWithoutTemplate } = studioRequest;
  const unknown = await injectedApply("studio", { sourceText: studioText }, {
    ...requestWithoutTemplate,
    explicitPrimaryId: "executive-pich",
  });
  assert.equal(unknown.selection.status, "fallback-required");
  assert.equal(unknown.selection.fallbackRecord.nearestProfileId, "executive-pitch");

  const fallback = await injectedApply("studio", { sourceText: studioText }, {
    ...requestWithoutTemplate,
    explicitPrimaryId: "executive-pich",
    fallbackPrimaryId: "executive-pitch",
    artifactType: "presentation",
    requestedFormat: "pptx",
    audience: ["executive"],
  });
  assert.equal(fallback.selection.primaryProfileId, "executive-pitch");
  assert.equal(fallback.selection.fallbackRecord.selectedFallbackProfileId, "executive-pitch");
});

test("safe packaged loading rejects an explicit symlink ancestor and the first filesystem segment", async (t) => {
  const canonicalBytes = await readFile(new URL("profiles/studio/game-design-brief.json", qualityRoot));
  const base = await mkdtemp(path.join(await realpath(tmpdir()), "quality-symlink-policy-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const realRoot = path.join(base, "real", "document-quality");
  await mkdir(path.join(realRoot, "profiles/studio"), { recursive: true });
  await writeFile(path.join(realRoot, "profiles/studio/game-design-brief.json"), canonicalBytes);
  const alias = path.join(base, "alias");
  await symlink(path.join(base, "real"), alias);
  const explicitLoader = workflow.createQualityProfileBodyLoader({ documentQualityRoot: path.join(alias, "document-quality") });
  await assert.rejects(
    () => explicitLoader({ namespace: "studio", profileId: "game-design-brief", purpose: "explicit-symlink-ancestor" }),
    /symlink ancestor|non-symlink|symlink.*path/i,
  );

  if ((await lstat("/tmp")).isSymbolicLink()) {
    const firstSegmentRoot = await mkdtemp("/tmp/quality-first-segment-");
    t.after(() => rm(firstSegmentRoot, { recursive: true, force: true }));
    await mkdir(path.join(firstSegmentRoot, "profiles/studio"), { recursive: true });
    await writeFile(path.join(firstSegmentRoot, "profiles/studio/game-design-brief.json"), canonicalBytes);
    const firstSegmentLoader = workflow.createQualityProfileBodyLoader({ documentQualityRoot: firstSegmentRoot });
    await assert.rejects(
      () => firstSegmentLoader({ namespace: "studio", profileId: "game-design-brief", purpose: "first-segment-symlink" }),
      /symlink ancestor|non-symlink|symlink.*path/i,
    );
  }
});
