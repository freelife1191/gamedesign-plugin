import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CATALOG_DESCRIPTION_BUDGET } from "../../tooling/lib/skill-description-budget.mjs";
import { loadVendorComponents } from "../../tooling/lib/vendor-components.mjs";
import { applyVendorDescriptionOverlay, assertVendorDescriptionOverlayTarget, loadVendorDescriptionOverlays } from "../../tooling/lib/vendor-description-overlay.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const UPSTREAM = "Long upstream text that runs well past what the router will ever read from a catalog entry.";
const SHORT = "Use when the packaged description has to fit the budget the router actually reads.";

function skillDocument(description = UPSTREAM) {
  return `---\nname: vendored\ndescription: ${description}\nlicense: MIT\n---\n\n# Vendored\n\nBody text mentioning description: something in prose.\n`;
}

function overlay(overrides = {}) {
  return { id: "archify", path: "SKILL.md", upstreamSha256: sha256(UPSTREAM), description: SHORT, ...overrides };
}

function entry(document = skillDocument()) {
  return { relativePath: "SKILL.md", bytes: Buffer.from(document, "utf8") };
}

test("the overlay rewrites the frontmatter description and leaves every other byte alone", () => {
  const source = skillDocument();
  const packaged = applyVendorDescriptionOverlay(entry(source), overlay()).bytes.toString("utf8");
  assert.equal(packaged, source.replace(`description: ${UPSTREAM}`, `description: ${SHORT}`));
  // The body's own "description:" prose survives, so the rewrite is the frontmatter field, not a
  // blanket replacement of every line that happens to start the same way.
  assert.match(packaged, /Body text mentioning description: something in prose\./u);
  assert.equal(packaged.split("\n").length, source.split("\n").length);
});

test("a file the overlay does not name passes through untouched", () => {
  const other = { relativePath: "references/guide.md", bytes: Buffer.from(skillDocument(), "utf8") };
  assert.equal(applyVendorDescriptionOverlay(other, overlay()), other);
});

test("a component with no overlay file leaves its entry untouched", () => {
  const original = entry();
  assert.equal(applyVendorDescriptionOverlay(original, undefined), original);
});

// This is the whole reason the overlay pins a digest. An upstream that rewords its description leaves
// the summary written against the old text describing a skill that no longer says that, and nothing
// else in the pipeline would notice — the vendor lock moves with the bump by design.
test("an upstream that reworded its description fails the build and names the digest to re-pin", () => {
  const reworded = "Upstream rewrote this description in the release we just pulled.";
  assert.throws(
    () => applyVendorDescriptionOverlay(entry(skillDocument(reworded)), overlay()),
    (error) => error.code === "VENDOR_DESCRIPTION_OVERLAY_UPSTREAM_CHANGED" && error.message.includes(sha256(reworded)),
  );
});

test("the overlay refuses a target with no frontmatter description to replace", () => {
  for (const document of [
    "# Vendored\n\nBody text mentioning description: something in prose.\n",
    `---\nname: vendored\n---\n\ndescription: ${UPSTREAM}\n`,
  ]) {
    assert.throws(
      () => applyVendorDescriptionOverlay(entry(document), overlay()),
      (error) => error.code === "VENDOR_DESCRIPTION_OVERLAY_TARGET_INVALID",
    );
  }
});

test("the overlay refuses a target that declares the field twice", () => {
  const document = `---\nname: vendored\ndescription: ${UPSTREAM}\ndescription: ${UPSTREAM}\n---\n`;
  assert.throws(
    () => applyVendorDescriptionOverlay(entry(document), overlay()),
    (error) => error.code === "VENDOR_DESCRIPTION_OVERLAY_TARGET_INVALID" && error.message.includes("2 description lines"),
  );
});

// The loader reads every vendored component, so the fixture has to carry all three locks even though
// only one of them is given an overlay.
const FIXTURE_COMPONENTS = Object.freeze([
  Object.freeze({ id: "skillstead", repository: "https://github.com/kyungseo/skillstead", tag: "svg-infographic/v0.10.0", treeRoot: "svg-infographic/0.10.0" }),
  Object.freeze({ id: "archify", repository: "https://github.com/tt-a1i/archify", tag: "v2.15.0", treeRoot: "archify/2.15.0" }),
  Object.freeze({ id: "im-not-ai", repository: "https://github.com/epoko77-ai/im-not-ai", tag: "v2.3.2", treeRoot: "humanize-korean/v2.3.2" }),
]);

async function overlayFixture(t, document) {
  const root = await mkdtemp(path.join(tmpdir(), "vendor-description-overlay-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const component of FIXTURE_COMPONENTS) {
    const vendor = path.join(root, "shared/vendor", component.id);
    await mkdir(path.join(vendor, ...component.treeRoot.split("/")), { recursive: true });
    await writeFile(path.join(vendor, "vendor.lock.json"), `${JSON.stringify({
      schemaVersion: 1,
      upstream: { repository: component.repository, tag: component.tag, commit: "0".repeat(40) },
      tree: { root: component.treeRoot, files: [] },
    })}\n`);
  }
  await mkdir(path.join(root, "shared/vendor/description-overlays"), { recursive: true });
  await writeFile(path.join(root, "shared/vendor/description-overlays/archify.json"), document);
  return root;
}

// A component whose lock does not parse is a different failure with its own code, so the loader is
// given a valid lock and only the overlay is malformed. Each case below is a way an overlay could look
// plausible and still put text the router cannot read, or cannot parse, into a packaged skill.
for (const [label, document] of [
  ["a description over the catalog budget", { description: "x".repeat(CATALOG_DESCRIPTION_BUDGET + 1) }],
  ["a description that opens a quoted scalar", { description: '"Use when the router reads a quoted value."' }],
  ["a description carrying a YAML key separator", { description: "Use when this happens: the value stops being one scalar." }],
  ["a description spanning two lines", { description: "Use when the value\nbreaks the frontmatter." }],
  ["a description with a trailing space", { description: "Use when the value keeps its trailing space. " }],
  ["a path that climbs out of the vendored tree", { path: "../../../etc/SKILL.md" }],
  ["an absent upstream pin", { upstream: {} }],
  ["an unknown schema version", { schemaVersion: 2 }],
]) {
  test(`the overlay loader refuses ${label}`, async (t) => {
    const base = { schemaVersion: 1, path: "SKILL.md", upstream: { sha256: sha256(UPSTREAM) }, description: SHORT };
    const root = await overlayFixture(t, `${JSON.stringify({ ...base, ...document })}\n`);
    assert.throws(
      () => loadVendorDescriptionOverlays({ repoRoot: root }),
      (error) => typeof error.code === "string" && error.code.startsWith("VENDOR_DESCRIPTION_OVERLAY_"),
    );
  });
}

test("the overlay loader refuses a document that is not valid JSON", async (t) => {
  const root = await overlayFixture(t, "{ not json\n");
  assert.throws(
    () => loadVendorDescriptionOverlays({ repoRoot: root }),
    (error) => error.code === "VENDOR_DESCRIPTION_OVERLAY_INVALID",
  );
});

// The unit cases above run against fixtures. This one runs against the vendored trees this repo ships,
// so an upstream bump that moved a description fails here as well as in the build.
test("every shipped overlay applies cleanly to the vendored source it was written against", async () => {
  const overlays = loadVendorDescriptionOverlays({ repoRoot });
  const components = new Map(loadVendorComponents({ repoRoot }).map((component) => [component.module, component]));
  assert.equal(overlays.size, components.size);
  for (const [module, shipped] of overlays) {
    const component = components.get(module);
    const source = await readFile(path.join(repoRoot, component.sourceRoot, ...shipped.path.split("/")));
    const packaged = applyVendorDescriptionOverlay({ relativePath: shipped.path, bytes: source }, shipped).bytes.toString("utf8");
    assert.match(packaged, new RegExp(`^description: ${shipped.description.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"));
    assert.notEqual(packaged, source.toString("utf8"), `${component.id} overlay changed nothing`);
  }
});

// An overlay whose path the vendored tree does not contain applies to nothing. Left unguarded, the
// packaged description silently reverts to the upstream text the router truncates, and the build
// reports success — so the build asserts the target exists before projecting the module.
test("an overlay naming a path the vendored tree does not contain fails rather than applying to nothing", () => {
  assert.throws(
    () => assertVendorDescriptionOverlayTarget(overlay(), [{ relativePath: "references/guide.md" }]),
    (error) => error.code === "VENDOR_DESCRIPTION_OVERLAY_TARGET_MISSING",
  );
  assert.equal(assertVendorDescriptionOverlayTarget(overlay(), [{ relativePath: "SKILL.md" }]), undefined);
  assert.equal(assertVendorDescriptionOverlayTarget(undefined, []), undefined);
});
