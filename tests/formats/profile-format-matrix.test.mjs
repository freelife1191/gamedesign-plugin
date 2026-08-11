import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { selectQualityProfiles } from "../../shared/scripts/resolve-quality-profile.mjs";
import { parseRestrictedYaml } from "../../shared/scripts/validate-artifact.mjs";

const FORMATS = ["md", "pdf", "docx", "pptx"];
const EXPECTED = {
  studio: { templates: 15, required: { md: 15, pdf: 15, docx: 8, pptx: 0 } },
  career: { templates: 15, required: { md: 14, pdf: 15, docx: 1, pptx: 1 } },
};
const FORMAT_COVERAGE = {
  scope: "representative-renderer-e2e",
  actualCases: 2,
  mappedTemplates: 30,
  allMappedTemplateDerivativesGenerated: false,
  profileMatrixValidation: "required-and-incompatible-formats",
};

function productName(namespace) {
  return namespace === "studio" ? "game-design-studio" : "game-design-career";
}

function frontmatterValue(source, key) {
  const match = String(source).match(new RegExp(`^${key}:\\s*([^\\n]+)$`, "mu"));
  if (!match) throw new Error(`missing frontmatter field: ${key}`);
  return match[1].trim();
}

async function loadNamespace(namespace) {
  const product = productName(namespace);
  const map = JSON.parse(await readFile(path.resolve(`products/${product}/plugin/references/document-quality/template-profile-map.json`), "utf8"));
  const index = JSON.parse(await readFile(path.resolve(`shared/document-quality/indexes/${namespace}.json`), "utf8"));
  return { product, map, index };
}

for (const namespace of ["studio", "career"]) {
  test(`${namespace} templates bind every declared format to the exact quality profile matrix`, async () => {
    const { product, map, index } = await loadNamespace(namespace);
    assert.equal(Object.keys(map.templates).length, EXPECTED[namespace].templates);
    const counts = Object.fromEntries(FORMATS.map((format) => [format, 0]));

    for (const [templateId, profileId] of Object.entries(map.templates)) {
      const profile = JSON.parse(await readFile(path.resolve(`shared/document-quality/profiles/${namespace}/${profileId}.json`), "utf8"));
      const indexEntry = index.profiles.find((entry) => entry.profile_id === profileId);
      assert.ok(indexEntry, `${profileId}: selection index entry`);
      assert.deepEqual(indexEntry.required_formats, profile.export_rules.required_formats, `${profileId}: required formats`);
      assert.deepEqual(indexEntry.forbidden_formats, profile.export_rules.forbidden_formats, `${profileId}: forbidden formats`);

      const templateRoot = path.resolve(`products/${product}/plugin/assets/templates/${templateId}`);
      const content = await readFile(path.join(templateRoot, "content.md"), "utf8");
      assert.equal(frontmatterValue(content, "quality_profile"), profileId, `${templateId}: profile frontmatter`);
      const manifest = parseRestrictedYaml(await readFile(path.join(templateRoot, "export-manifest.yml"), "utf8"), `${templateId}/export-manifest.yml`);
      assert.deepEqual(Object.keys(manifest.formats), FORMATS, `${templateId}: seed format inventory`);
      assert.equal(manifest.formats.md.status, "pending", `${templateId}: Markdown seed status`);
      for (const format of FORMATS.slice(1)) assert.equal(manifest.formats[format].status, "unavailable", `${templateId}: ${format} seed status`);

      for (const format of FORMATS) {
        const request = {
          artifactId: templateId,
          goal: templateId,
          audience: profile.audiences[0],
          artifactType: profile.artifact_types[0],
          requestedFormat: format,
          templateId,
          explicitPrimaryId: profileId,
        };
        if (profile.export_rules.required_formats.includes(format)) {
          counts[format] += 1;
          const [selection] = selectQualityProfiles({ selectionIndex: index, templateMap: map, requests: [request] });
          assert.equal(selection.status, "selected", `${templateId}: ${format} selection status`);
          assert.equal(selection.primaryProfileId, profileId, `${templateId}: ${format} selected profile`);
        } else {
          assert.throws(
            () => selectQualityProfiles({ selectionIndex: index, templateMap: map, requests: [request] }),
            /incompatible/i,
            `${templateId}: ${format} must not be claimed by this profile`,
          );
        }
      }
    }

    assert.deepEqual(counts, EXPECTED[namespace].required);
  });
}

test("representative binary manifests state that they do not cover all 30 mapped templates", async () => {
  for (const caseId of ["studio-live-service-rpg-economy", "career-entry-12-week-roadmap"]) {
    const manifest = JSON.parse(await readFile(path.resolve(`tests/formats/output/${caseId}/artifact-manifest.json`), "utf8"));
    assert.deepEqual(manifest.formatCoverage, FORMAT_COVERAGE, `${caseId}: format coverage boundary`);
    assert.equal("canonicalExportManifest" in manifest, false, `${caseId}: renderer fixture must not claim a canonical product export set`);
    assert.deepEqual(manifest.representativeHarnessExportSet, { formats: FORMATS }, `${caseId}: renderer fixture format set`);
  }
});

test("format report distinguishes the 30-template declaration matrix from two generated binary cases", async () => {
  const report = await readFile(path.resolve("tests/formats/FORMAT-RESULTS.md"), "utf8");
  assert.match(report, /Studio 15개:\s*MD 15 · PDF 15 · DOCX 8 · PPTX 0/u);
  assert.match(report, /Career 15개:\s*MD 14 · PDF 15 · DOCX 1 · PPTX 1/u);
  assert.match(report, /실제 바이너리 생성은 대표 사례 2건/u);
  assert.match(report, /30개 템플릿 전체를 네 형식으로 생성했다는 뜻은 아니다/u);
  assert.match(report, /Studio 대표 사례의 PPTX는 호스트 렌더러 자체를 검증하기 위한 시험 산출물/u);
  assert.match(report, /representativeHarnessExportSet/u);
});
