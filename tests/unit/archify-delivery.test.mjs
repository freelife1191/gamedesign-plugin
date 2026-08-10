import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkCuratedArchify,
  publishCuratedArchify,
  stageCuratedArchify,
} from "../../tooling/lib/archify-delivery.mjs";
import { parseCuratedArchifyArguments } from "../../tooling/build-curated-archify.mjs";

const SOURCE = "# Source\n\n## Exact heading\n\nBody.\n";
const SPEC = `${JSON.stringify({ schema_version: 1, diagram_type: "workflow", meta: { title: "검토", quality_profile: "showcase" }, lanes: [{ id: "main", label: "주 경로" }], nodes: [{ id: "start", lane: "main", col: 0, type: "backend", label: "시작" }], edges: [], mainPath: ["start"] })}\n`;
const DIGEST = (bytes) => createHash("sha256").update(bytes).digest("hex");

function entry({ status = "planned", visual = "pending", reviewer = null } = {}) {
  return {
    id: "stable-id", product: "studio", source_document: "README.md", source_section: "Exact heading",
    source_digest: DIGEST(SOURCE), question: "무엇을 검토하는가?", decision: "selected",
    decision_reason: "관계가 핵심이다.", diagram_type: "workflow", diagram_type_reason: "단계가 핵심이다.",
    priority: "primary", secondary_reason: null, visual_system: "studio", composition_rationale: "한 경로.",
    shared_process_with: null, shared_process_reason: null, diagnostics: [],
    spec: "guides/archify-diagrams/specs/studio/stable-id.json",
    html: "guides/assets/archify/studio/stable-id.html",
    receipt: "guides/assets/archify/studio/stable-id.receipt.json",
    delivery_status: status, visual_review: visual, reviewer,
  };
}

async function write(root, relative, contents) {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
  return file;
}

async function fixture(t, { withSpec = true, status = "planned", visual = "pending", seam = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "archify-delivery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, "README.md", SOURCE);
  for (const directory of ["guides", "products/game-design-studio", "products/game-design-career", "plugins/game-design-studio", "plugins/game-design-career"]) await mkdir(path.join(root, directory), { recursive: true });
  const selected = entry({ status, visual, reviewer: visual === "passed" ? "reviewer" : null });
  await write(root, "guides/archify-diagrams/catalog.json", `${JSON.stringify({ schema_version: 1, scan_roots: ["README.md", "guides", "products/game-design-studio", "products/game-design-career", "plugins/game-design-studio", "plugins/game-design-career"], scan_excludes: ["guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build"], entries: [selected] })}\n`);
  if (withSpec) await write(root, selected.spec, SPEC);
  if (status === "passed") {
    const artifact = Buffer.from("<!doctype html><title>verified</title>\n");
    await write(root, "guides/archify-diagrams/visual-qa/manifest.json", `${JSON.stringify({ schema_version: 1, entries: [{ id: selected.id, reviewer: "reviewer", specification_sha256: DIGEST(SPEC), artifact_sha256: DIGEST(artifact) }] })}\n`);
  }
  const home = await mkdtemp(path.join(os.tmpdir(), "archify-delivery-home-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const cli = await write(home, ".agents/skills/archify/bin/archify.mjs", fakeCli());
  await write(home, ".agents/skills/archify/SKILL.md", "---\nname: archify\n---\n");
  await write(home, ".agents/skills/archify/package.json", '{"version":"2.13.0"}\n');
  return { root, selected, cli, env: { CODEX_HOME: path.join(home, ".missing-codex") }, archifyOptions: { home }, seam };
}

function fakeCli() {
  return `#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const checks = ["single_svg","finite_svg","orthogonal_arrows","label_route_clearance","relationship_crossings","relationship_corridors","container_border_runs","route_rhythm","legend_clearance"].map((name) => ({ name, ok: true }));
const [, , command, type, input, output] = process.argv;
const spec = await readFile(input);
if (command === "validate") console.log(JSON.stringify({ schemaVersion: 1, ok: true, command, type, input, checks, composition: { schemaVersion: 1, profile: "showcase", status: "pass", summary: { errors: 0, warnings: 0 } } }));
else { const artifact = Buffer.from("<!doctype html><title>verified</title>\\n"); await writeFile(output, artifact); console.log(JSON.stringify({ schemaVersion: 1, ok: true, command, type, input, output, specification: { sha256: sha(spec), bytes: spec.length }, artifact: { sha256: sha(artifact), bytes: artifact.length }, validation: { checksPassed: 9, checkCount: 9, errors: 0, warnings: 0, compositionProfile: "showcase", compositionStatus: "pass" } })); }
`;
}

test("delivery cannot synthesize topology when a selected spec is missing", async (t) => {
  const f = await fixture(t, { withSpec: false });
  await assert.rejects(() => stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /missing committed Archify spec/u);
  await assert.rejects(access(path.join(f.root, ".tmp/curated-archify/current")), { code: "ENOENT" });
});

test("catalog wording changes never create or rewrite a spec", async (t) => {
  const f = await fixture(t);
  const specPath = path.join(f.root, f.selected.spec);
  const before = await readFile(specPath);
  const catalogPath = path.join(f.root, "guides/archify-diagrams/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.entries[0].source_digest = "0".repeat(64);
  await writeFile(catalogPath, `${JSON.stringify(catalog)}\n`);
  await assert.rejects(() => stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /source|stale-source|catalog drift/u);
  assert.deepEqual(await readFile(specPath), before);
});

test("stage creates only an exact staged managed set and check rejects stale extras", async (t) => {
  const f = await fixture(t);
  await stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions });
  const current = path.join(f.root, ".tmp/curated-archify/current");
  assert.deepEqual((await readFile(path.join(current, "studio/stable-id.html"))).toString(), "<!doctype html><title>verified</title>\n");
  await writeFile(path.join(current, "extra.html"), "stale\n");
  await assert.rejects(() => checkCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /exact managed set|stale/i);
});

test("publication rejects a passed record whose visual-QA digests do not bind the re-delivered artifact", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" });
  const manifestPath = path.join(f.root, "guides/archify-diagrams/visual-qa/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.entries[0].artifact_sha256 = "0".repeat(64);
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(() => publishCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /visual QA binding/u);
  await assert.rejects(access(path.join(f.root, "guides/assets/archify")), { code: "ENOENT" });
});

test("thin CLI accepts only an explicit delivery mode, repeated ids, and one product", () => {
  assert.deepEqual(parseCuratedArchifyArguments(["--stage", "--id", "one", "--id", "two", "--product", "studio"]), {
    mode: "stage", ids: ["one", "two"], product: "studio",
  });
  for (const argv of [["--open"], ["--stage", "--check"], ["--stage", "--product", "unknown"], ["--stage", "--id", "one", "--id", "one"]]) {
    assert.throws(() => parseCuratedArchifyArguments(argv));
  }
});

for (const seam of [
  "replace-cli-after-validate", "swap-stage-parent-and-restore", "symlink-delivered-html", "nondeterministic-deliver",
  "fail-backup-rename", "fail-publish-rename", "fail-post-publish-verification", "fail-temp-cleanup",
  "partially-fail-backup-cleanup", "fail-rollback-restore", "fail-without-prior-output", "rollback-without-private-siblings",
]) {
  test(`delivery fails closed at ${seam}`, async (t) => {
    const f = await fixture(t, { status: "passed", visual: "passed" });
    const hooks = { [seam]: async (context) => {
      if (seam === "replace-cli-after-validate") await rename(f.cli, `${f.cli}.replaced`);
      if (seam === "symlink-delivered-html") { await rm(context.html); await symlink(path.join(f.root, "README.md"), context.html); }
      if (seam === "nondeterministic-deliver") await writeFile(context.html, "different\n");
      if (!["replace-cli-after-validate", "symlink-delivered-html", "nondeterministic-deliver"].includes(seam)) throw new Error(seam);
    } };
    const needsPrior = ["fail-backup-rename", "partially-fail-backup-cleanup", "fail-rollback-restore"].includes(seam);
    if (needsPrior) await write(f.root, "guides/assets/archify/old.txt", "trusted-old\n");
    if (seam === "fail-rollback-restore") hooks["fail-post-publish-verification"] = async () => { throw new Error("force rollback"); };
    await assert.rejects(() => publishCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions, __testHooks: hooks }));
    const managed = path.join(f.root, "guides/assets/archify");
    const stats = await lstat(managed).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
    if (["partially-fail-backup-cleanup", "fail-temp-cleanup"].includes(seam)) assert.ok(stats, "committed publication must survive cleanup failure");
    else if (needsPrior && seam !== "fail-rollback-restore") assert.equal((await readFile(path.join(managed, "old.txt"))).toString(), "trusted-old\n");
    else if (seam !== "fail-rollback-restore") assert.equal(stats, null, `${seam} must not publish a new trusted tree`);
  });
}
