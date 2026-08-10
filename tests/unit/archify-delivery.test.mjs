import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
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
  await write(home, ".agents/skills/archify/renderers/shared/resource.mjs", 'export const artifactSuffix = "";\n');
  await mkdir(path.join(home, ".agents/skills/archify/schemas"), { recursive: true });
  await mkdir(path.join(home, ".agents/skills/archify/assets"), { recursive: true });
  await mkdir(path.join(home, ".agents/skills/archify/scripts"), { recursive: true });
  await write(home, ".agents/skills/archify/SKILL.md", "---\nname: archify\n---\n");
  await write(home, ".agents/skills/archify/package.json", '{"version":"2.13.0"}\n');
  return { root, selected, cli, env: { CODEX_HOME: path.join(home, ".missing-codex") }, archifyOptions: { home }, seam };
}

function fakeCli() {
  return `#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { artifactSuffix } from "../renderers/shared/resource.mjs";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const checks = ["single_svg","finite_svg","orthogonal_arrows","label_route_clearance","relationship_crossings","relationship_corridors","container_border_runs","route_rhythm","legend_clearance"].map((name) => ({ name, ok: true }));
const [, , command, type, input, output] = process.argv;
const spec = await readFile(input);
let stateSuffix = artifactSuffix;
if (process.env.ARCHIFY_TEST_COUNTER) {
  const current = Number((await readFile(process.env.ARCHIFY_TEST_COUNTER, "utf8").catch(() => "0")).trim());
  await writeFile(process.env.ARCHIFY_TEST_COUNTER, String(current + 1));
  stateSuffix += "-" + current;
}
if (command === "validate") console.log(JSON.stringify({ schemaVersion: 1, ok: true, command, type, input, checks, composition: { schemaVersion: 1, profile: "showcase", status: "pass", summary: { errors: 0, warnings: 0 } } }));
else { const artifact = Buffer.from("<!doctype html><title>verified" + stateSuffix + "</title>\\n"); await writeFile(output, artifact); console.log(JSON.stringify({ schemaVersion: 1, ok: true, command, type, input, output, specification: { sha256: sha(spec), bytes: spec.length }, artifact: { sha256: sha(artifact), bytes: artifact.length }, validation: { checksPassed: 9, checkCount: 9, errors: 0, warnings: 0, compositionProfile: "showcase", compositionStatus: "pass" } })); }
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

test("check rejects a stale production managed tree even when no entry is publishable", async (t) => {
  const f = await fixture(t);
  await stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions });
  await write(f.root, "guides/assets/archify/stale.html", "untrusted\n");
  await assert.rejects(() => checkCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /exact set|stale/i);
});

test("a scoped check still verifies every published receipt and artifact binding", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" });
  const secondSource = "# Another source\n\n## Another heading\n\nBody.\n";
  const secondSpec = `${JSON.stringify({ schema_version: 1, diagram_type: "workflow", meta: { title: "다른 검토", quality_profile: "showcase" }, lanes: [{ id: "main", label: "주 경로" }], nodes: [{ id: "start", lane: "main", col: 0, type: "backend", label: "시작" }, { id: "finish", lane: "main", col: 1, type: "backend", label: "종료" }], edges: [{ from: "start", to: "finish" }], mainPath: ["start", "finish"] })}\n`;
  const catalogPath = path.join(f.root, "guides/archify-diagrams/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const second = {
    ...f.selected, id: "career-id", product: "career", source_document: "guides/second.md", source_section: "Another heading", source_digest: DIGEST(secondSource),
    question: "무엇이 다른가?", priority: "primary", spec: "guides/archify-diagrams/specs/career/career-id.json",
    html: "guides/assets/archify/career/career-id.html", receipt: "guides/assets/archify/career/career-id.receipt.json",
    visual_system: "career",
  };
  catalog.entries.push(second);
  await writeFile(catalogPath, `${JSON.stringify(catalog)}\n`);
  await write(f.root, second.source_document, secondSource);
  await write(f.root, second.spec, secondSpec);
  const qaPath = path.join(f.root, "guides/archify-diagrams/visual-qa/manifest.json");
  const qa = JSON.parse(await readFile(qaPath, "utf8"));
  qa.entries.push({ id: second.id, reviewer: "reviewer", specification_sha256: DIGEST(secondSpec), artifact_sha256: DIGEST(Buffer.from("<!doctype html><title>verified</title>\n")) });
  await writeFile(qaPath, `${JSON.stringify(qa)}\n`);
  await stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions });
  await publishCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions });
  await stageCuratedArchify({ repoRoot: f.root, ids: [f.selected.id], env: f.env, archifyOptions: f.archifyOptions });
  await writeFile(path.join(f.root, second.html), "corrupted\n");
  await assert.rejects(() => checkCuratedArchify({
    repoRoot: f.root, ids: [f.selected.id], env: f.env, archifyOptions: f.archifyOptions,
  }), /published receipt|managed bytes/u);
});

test("delivery runs a repo-private CLI copy when the source CLI is replaced after validate", async (t) => {
  const f = await fixture(t);
  const sentinel = path.join(f.root, "external-sentinel");
  await writeFile(sentinel, "sentinel-before\n");
  const replacement = `${fakeCli()}\nawait (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(f.root, "external-sentinel"))}, "executed replacement\\n");\n`;
  await writeFile(`${f.cli}.replacement`, replacement);
  await stageCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "after-validate": async () => rename(`${f.cli}.replacement`, f.cli) },
  });
  assert.equal(await readFile(sentinel, "utf8"), "sentinel-before\n");
});

test("a private snapshot of the installed Archify execution closure validates and delivers", async (t) => {
  const home = process.env.HOME;
  const installedSpec = path.join(home, ".agents/skills/archify/examples/agent-tool-call.workflow.json");
  try { await access(installedSpec); } catch { t.skip("installed Archify example is unavailable"); return; }
  const f = await fixture(t);
  await writeFile(path.join(f.root, f.selected.spec), await readFile(installedSpec));
  await stageCuratedArchify({
    repoRoot: f.root,
    env: { CODEX_HOME: path.join(f.root, ".missing-codex-home") },
    archifyOptions: { home },
  });
  assert.match((await readFile(path.join(f.root, ".tmp/curated-archify/current/studio/stable-id.html"), "utf8")), /<svg\b/u);
});

test("delivery rejects validate and deliver receipts not bound to exact type, input, and output", async (t) => {
  for (const [needle, replacement, expected] of [
    ["command, type, input, checks", 'command, type: "architecture", input, checks', /receipt type/i],
    ["command, type, input, checks", 'command, type, input: "wrong-input", checks', /receipt input/i],
    ["command, type, input, output, specification", 'command, type, input, output: "wrong-output", specification', /receipt output/i],
  ]) {
    const f = await fixture(t);
    await writeFile(f.cli, fakeCli().replace(needle, replacement));
    await assert.rejects(() => stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), expected);
  }
});

test("commit refuses source or spec bytes changed after delivery", async (t) => {
  for (const relative of ["README.md", "guides/archify-diagrams/specs/studio/stable-id.json"]) {
    const f = await fixture(t);
    await assert.rejects(() => stageCuratedArchify({
      repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
      __testHooks: { "after-validate": async () => writeFile(path.join(f.root, relative), "changed\n") },
    }), /pinned input changed|invalid JSON/u);
    await assert.rejects(access(path.join(f.root, ".tmp/curated-archify/current")), { code: "ENOENT" });
  }
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

async function oldManagedTree(f) {
  await write(f.root, "guides/assets/archify/old/one.html", "old-html\n");
  await write(f.root, "guides/assets/archify/old/one.receipt.json", "old-receipt\n");
}

async function assertOldTree(f) {
  assert.equal((await readFile(path.join(f.root, "guides/assets/archify/old/one.html"))).toString(), "old-html\n");
  assert.equal((await readFile(path.join(f.root, "guides/assets/archify/old/one.receipt.json"))).toString(), "old-receipt\n");
}

test("swap-and-restore of a workflow ancestor is detected while it is swapped", async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => stageCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "after-validate": async ({ workflow, assertAncestors }) => {
      const parent = path.dirname(workflow); const parked = `${parent}.parked`;
      await rename(parent, parked); await symlink(path.join(f.root, "README.md"), parent);
      try { await assertAncestors(); } finally { await rm(parent); await rename(parked, parent); }
    } },
  }), /identity changed/u);
  await assert.rejects(access(path.join(f.root, ".tmp/curated-archify/current")), { code: "ENOENT" });
});

test("a delivered HTML symlink is rejected", async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => stageCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "after-deliver": async ({ html }) => { await rm(html); await symlink(path.join(f.root, "README.md"), html); } },
  }), /regular non-symlink/u);
});

test("check rejects a fresh re-delivery drift from stateful identical private CLI snapshots", async (t) => {
  const f = await fixture(t);
  const counter = path.join(f.root, "delivery-counter");
  await writeFile(counter, "0");
  const prior = process.env.ARCHIFY_TEST_COUNTER;
  process.env.ARCHIFY_TEST_COUNTER = counter;
  t.after(() => {
    if (prior === undefined) delete process.env.ARCHIFY_TEST_COUNTER;
    else process.env.ARCHIFY_TEST_COUNTER = prior;
  });
  await stageCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions });
  await assert.rejects(() => checkCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions }), /bytes drift/u);
});

test("backup rename refuses a target replaced by a symlink and preserves the old tree", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-backup-rename": async ({ target }) => { const parked = `${target}.parked`; await rename(target, parked); await symlink(path.join(f.root, "README.md"), target); await rm(target); await rename(parked, target); } },
  }));
  await assertOldTree(f);
});

test("a publish target swapped after rename is preserved for forensics and never committed", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "after-rename": async ({ source, target, label }) => {
      if (label !== "publish backup") return;
      const parked = `${target}.parked`;
      await rename(target, parked);
      await mkdir(target);
      await rename(parked, source);
    } },
  }), /moved identity mismatch|forensic/u);
  await assertOldTree(f);
  const siblings = await readdir(path.join(f.root, "guides/assets"));
  assert.ok(siblings.some((name) => name.startsWith(".curated-archify-backup-")));
});

test("publish rename failure restores exact prior bytes", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-publish-rename": async ({ candidate }) => rename(candidate, `${candidate}.moved`) },
  }));
  await assertOldTree(f);
});

test("post-publish verification failure restores exact prior bytes with no private siblings", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-publish-rename": async ({ candidate }) => writeFile(path.join(candidate, "studio/stable-id.html"), "mutated\n") },
  }), /bytes drift/u);
  await assertOldTree(f);
  const siblings = await readdir(path.join(f.root, "guides/assets"));
  assert.equal(siblings.some((name) => name.startsWith(".curated-archify-")), false);
});

test("successful commit survives a temporary cleanup identity failure", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" });
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-temp-cleanup": async ({ temp }) => { const parked = `${temp}.parked`; await rename(temp, parked); await symlink(path.join(f.root, "README.md"), temp); } },
  }), /cleanup/u);
  assert.equal((await readFile(path.join(f.root, "guides/assets/archify/studio/stable-id.html"))).toString(), "<!doctype html><title>verified</title>\n");
});

test("a primary transaction failure and a temp cleanup identity failure retain ordered causes", async (t) => {
  const f = await fixture(t);
  let failure;
  try {
    await stageCuratedArchify({
      repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
      __testHooks: {
        "after-validate": async () => writeFile(path.join(f.root, "README.md"), "changed\n"),
        "before-temp-cleanup": async ({ temp }) => { const parked = `${temp}.parked`; await rename(temp, parked); await symlink(path.join(f.root, "README.md"), temp); },
      },
    });
  } catch (error) { failure = error; }
  assert.ok(failure instanceof AggregateError);
  assert.equal(failure.errors.length, 2);
  assert.match(failure.errors[0].message, /pinned input changed/u);
  assert.match(failure.errors[1].message, /identity changed|cleanup/u);
});

test("partial backup cleanup failure keeps the new canonical tree", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-backup-cleanup": async ({ backup }) => { const parked = `${backup}.forensic`; await rename(backup, parked); await symlink(path.join(f.root, "README.md"), backup); } },
  }), /backup cleanup/u);
  assert.equal((await readFile(path.join(f.root, "guides/assets/archify/studio/stable-id.html"))).toString(), "<!doctype html><title>verified</title>\n");
});

test("restore loss reports both causes and preserves forensic paths", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" }); await oldManagedTree(f);
  let failure;
  try {
    await publishCuratedArchify({ repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions, __testHooks: {
      "before-publish-rename": async ({ candidate }) => writeFile(path.join(candidate, "studio/stable-id.html"), "mutated\n"),
      "before-rollback-restore": async ({ backup }) => rename(backup, `${backup}.forensic`),
    } });
  } catch (error) { failure = error; }
  assert.ok(failure instanceof AggregateError); assert.equal(failure.errors.length, 2);
  const siblings = await readdir(path.join(f.root, "guides/assets"));
  const forensic = siblings.find((name) => name.includes("forensic"));
  assert.ok(forensic);
  assert.equal(await readFile(path.join(f.root, "guides/assets", forensic, "old/one.html"), "utf8"), "old-html\n");
  assert.equal(await readFile(path.join(f.root, "guides/assets", forensic, "old/one.receipt.json"), "utf8"), "old-receipt\n");
});

test("failed publication without prior output leaves no new output", async (t) => {
  const f = await fixture(t, { status: "passed", visual: "passed" });
  await assert.rejects(() => publishCuratedArchify({
    repoRoot: f.root, env: f.env, archifyOptions: f.archifyOptions,
    __testHooks: { "before-publish-rename": async ({ candidate }) => writeFile(path.join(candidate, "studio/stable-id.html"), "mutated\n") },
  }), /bytes drift/u);
  await assert.rejects(access(path.join(f.root, "guides/assets/archify")), { code: "ENOENT" });
});
