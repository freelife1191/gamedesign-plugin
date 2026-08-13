import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FORMAT_COVERAGE,
  commitGeneratedTrees,
  preparePresentationWorkspace,
  renderDocxQa,
  renderSavedPptxQa,
  resolveChrome,
  resolvePluginSkill,
  resolveQuickLook,
  writeManifest,
} from "./generate-formats.mjs";

async function makeTransactionFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "formats-transaction-"));
  const stagingRoot = path.join(root, ".stage-test");
  const outputRoot = path.join(root, "output");
  const qaRoot = path.join(root, "qa");
  await Promise.all([
    mkdir(path.join(stagingRoot, "output"), { recursive: true }),
    mkdir(path.join(stagingRoot, "qa"), { recursive: true }),
    mkdir(outputRoot, { recursive: true }),
    mkdir(qaRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(stagingRoot, "output", "marker.txt"), "new-output"),
    writeFile(path.join(stagingRoot, "qa", "marker.txt"), "new-qa"),
    writeFile(path.join(outputRoot, "marker.txt"), "old-output"),
    writeFile(path.join(qaRoot, "marker.txt"), "old-qa"),
  ]);
  return { root, stagingRoot, outputRoot, qaRoot };
}

test("successful commit replaces output and qa as one generated pair", async (t) => {
  const fixture = await makeTransactionFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));

  await commitGeneratedTrees(fixture);

  assert.equal(await readFile(path.join(fixture.outputRoot, "marker.txt"), "utf8"), "new-output");
  assert.equal(await readFile(path.join(fixture.qaRoot, "marker.txt"), "utf8"), "new-qa");
  await assert.rejects(readFile(path.join(fixture.stagingRoot, "output", "marker.txt")));
});

test("failed second install restores both previously verified destinations", async (t) => {
  const fixture = await makeTransactionFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const stagedQa = path.join(fixture.stagingRoot, "qa");

  await assert.rejects(
    commitGeneratedTrees(fixture, {
      renameImpl: async (from, to) => {
        if (from === stagedQa && to === fixture.qaRoot) throw new Error("injected qa install failure");
        await rename(from, to);
      },
    }),
    /injected qa install failure/,
  );

  assert.equal(await readFile(path.join(fixture.outputRoot, "marker.txt"), "utf8"), "old-output");
  assert.equal(await readFile(path.join(fixture.qaRoot, "marker.txt"), "utf8"), "old-qa");
});

test("CODEX_HOME overrides the user-home plugin cache", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-codex-home-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = path.join(root, "plugins", "cache", "openai-primary-runtime", "presentations", "26.9.0", "skills", "presentations");
  await mkdir(skill, { recursive: true });

  assert.equal(await resolvePluginSkill("presentations", { env: { CODEX_HOME: root }, home: "/unused" }), skill);
});

test("current presentation layout prepares a writable artifact-tool workspace without the removed setup helper", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-presentation-workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const presentations = path.join(root, "presentations");
  const dependenciesRoot = path.join(root, "dependencies");
  const nodeModules = path.join(dependenciesRoot, "node", "node_modules");
  const runtimeBinDir = path.join(dependenciesRoot, "bin", "override");
  const workspace = path.join(root, "build");
  const artifactTool = path.join(nodeModules, "@oai", "artifact-tool");
  await Promise.all([
    mkdir(path.join(presentations, "container_tools"), { recursive: true }),
    mkdir(artifactTool, { recursive: true }),
    mkdir(runtimeBinDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(artifactTool, "package.json"), JSON.stringify({ name: "@oai/artifact-tool", type: "module", exports: "./index.mjs" })),
    writeFile(path.join(artifactTool, "index.mjs"), "export const runtimeMarker = 'artifact-tool-loaded';\n"),
  ]);

  const env = await preparePresentationWorkspace({
    presentations,
    runtime: { dependenciesRoot, commands: { node: process.execPath } },
    workspace,
  });

  assert.equal(await realpath(path.join(workspace, "node_modules")), await realpath(nodeModules));
  assert.equal(env.RUNTIME_NODE, process.execPath);
  assert.equal(env.RUNTIME_NODE_MODULES, nodeModules);
  assert.equal(env.RUNTIME_BIN_DIR, runtimeBinDir);
  const generator = path.join(workspace, "generator.mjs");
  await writeFile(generator, "import { runtimeMarker } from '@oai/artifact-tool'; console.log(runtimeMarker, process.env.RUNTIME_NODE_MODULES);\n");
  const generated = spawnSync(process.execPath, [generator], { encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(generated.stdout.trim(), `artifact-tool-loaded ${nodeModules}`);
});

test("older presentation layout keeps using its packaged workspace setup helper", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-legacy-presentation-workspace-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const presentations = path.join(root, "presentations");
  const dependenciesRoot = path.join(root, "dependencies");
  const helper = path.join(presentations, "container_tools", "setup_artifact_tool_workspace.mjs");
  const workspace = path.join(root, "build");
  await Promise.all([
    mkdir(path.dirname(helper), { recursive: true }),
    mkdir(path.join(dependenciesRoot, "node", "node_modules"), { recursive: true }),
    mkdir(path.join(dependenciesRoot, "bin", "override"), { recursive: true }),
  ]);
  await writeFile(helper, `
    import { mkdir, writeFile } from "node:fs/promises";
    const workspace = process.argv[process.argv.indexOf("--workspace") + 1];
    await mkdir(workspace, { recursive: true });
    await writeFile(new URL("legacy-helper-ran", new URL(\`file://\${workspace}/\`)), "yes");
  `);

  await preparePresentationWorkspace({
    presentations,
    runtime: { dependenciesRoot, commands: { node: process.execPath } },
    workspace,
  });

  assert.equal(await readFile(path.join(workspace, "legacy-helper-ran"), "utf8"), "yes");
});

test("Chrome resolution honors CHROME_BIN then portable PATH candidates", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-chrome-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const explicit = path.join(root, "explicit-chrome");
  const portable = path.join(root, "chromium");
  await Promise.all([writeFile(explicit, "#!/bin/sh\nprintf 'Chromium 123.0\\n'\n"), writeFile(portable, "#!/bin/sh\nprintf 'Chromium 123.0\\n'\n")]);
  await Promise.all([chmod(explicit, 0o755), chmod(portable, 0o755)]);

  assert.equal(await resolveChrome({ env: { CHROME_BIN: explicit, PATH: root }, platform: "linux" }), await realpath(explicit));
  assert.equal(await resolveChrome({ env: { PATH: root }, platform: "linux" }), await realpath(portable));
});

test("Quick Look fails explicitly outside macOS", async () => {
  await assert.rejects(resolveQuickLook({ platform: "linux", env: { PATH: "" } }), /macOS.*Quick Look/i);
});

test("exported DOCX renderer lets the verifier recreate QA from the saved artifact", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-saved-docx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const docx = path.join(root, "brief.docx");
  const qaDir = path.join(root, "qa", "docx");
  const previewBase = path.join(root, "preview");
  const quickLook = path.join(root, "qlmanage");
  const chrome = path.join(root, "chromium");
  const pdftoppm = path.join(root, "pdftoppm");
  await mkdir(qaDir, { recursive: true });
  await writeFile(docx, "saved-document");
  await writeFile(quickLook, "#!/bin/sh\nmkdir -p \"$3/brief.docx.qlpreview\"\nprintf '<html><head></head><body><div><div><p><span>저장된 문서</span></p></div><p>본문</p><p><span>Task 11 · format harness</span></p></div></body></html>' > \"$3/brief.docx.qlpreview/Preview.html\"\n");
  await writeFile(chrome, "#!/bin/sh\nfor arg in \"$@\"; do case \"$arg\" in --print-to-pdf=*) printf 'pdf' > \"${arg#*=}\";; esac; done\n");
  await writeFile(pdftoppm, "#!/bin/sh\nprintf 'png' > \"$5-1.png\"\n");
  await Promise.all([chmod(quickLook, 0o755), chmod(chrome, 0o755), chmod(pdftoppm, 0o755)]);

  await renderDocxQa({
    chrome,
    quickLook,
    docx,
    qaDir,
    previewBase,
    runtime: { commands: { pdftoppm } },
    caseInfo: { caseId: "case", title: "저장된 문서", expectedPages: { docx: 1 } },
  });

  assert.equal(await readFile(path.join(qaDir, "brief.pdf"), "utf8"), "pdf");
  assert.equal(await readFile(path.join(qaDir, "page-1.png"), "utf8"), "png");
});

test("PPTX QA renders the saved presentation artifact rather than generator memory", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-saved-pptx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pptx = path.join(root, "brief.pptx");
  const qaDir = path.join(root, "qa", "pptx");
  const previewBase = path.join(root, "preview");
  const quickLook = path.join(root, "qlmanage");
  const chrome = path.join(root, "chromium");
  const pdftoppm = path.join(root, "pdftoppm");
  const trace = path.join(root, "trace.txt");
  await writeFile(pptx, "saved-presentation");
  await writeFile(quickLook, `#!/bin/sh\nprintf '%s' \"$4\" > '${trace}'\nmkdir -p \"$3/brief.pptx.qlpreview\"\nprintf '<html><head><style>div.slide{width:960;height:540}.t{font-size:24}</style></head><body><div class=\"slide\" style=\"top:0;left:0\"><p class=\"t\">저장된 발표</p><img src=\"Attachment1.pdf\"></div></body></html>' > \"$3/brief.pptx.qlpreview/Preview.html\"\nprintf 'shape' > \"$3/brief.pptx.qlpreview/Attachment1.pdf\"\n`);
  await writeFile(pdftoppm, "#!/bin/sh\nprintf 'attachment' > \"$6.png\"\n");
  await writeFile(chrome, "#!/bin/sh\nfor arg in \"$@\"; do case \"$arg\" in --screenshot=*) printf 'png' > \"${arg#*=}\";; esac; done\n");
  await Promise.all([chmod(quickLook, 0o755), chmod(chrome, 0o755), chmod(pdftoppm, 0o755)]);

  await renderSavedPptxQa({
    pptx,
    qaDir,
    previewBase,
    quickLook,
    chrome,
    runtime: { commands: { pdftoppm } },
    caseInfo: { caseId: "case", expectedSlides: 1 },
  });

  assert.equal(await readFile(trace, "utf8"), pptx);
  assert.equal(await readFile(path.join(qaDir, "slide-1.png"), "utf8"), "png");
  const printable = await readFile(path.join(previewBase, "case", "brief.pptx.qlpreview", "Printable-1.html"), "utf8");
  assert.match(printable, /저장된 발표/u);
  assert.match(printable, /Attachment1\.png/u);
  assert.match(printable, /width:\s*960px/u);
});

test("manifest binds every review image to the staged artifact set", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "formats-render-binding-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "output");
  const qaDir = path.join(root, "qa");
  const artifacts = ["brief.md", "brief.pdf", "brief.docx", "brief.pptx", "visualization.svg", "visualization.png"];
  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(path.join(qaDir, "pdf"), { recursive: true }), mkdir(path.join(qaDir, "docx"), { recursive: true }), mkdir(path.join(qaDir, "pptx"), { recursive: true })]);
  for (const name of artifacts) await writeFile(path.join(outputDir, name), `artifact:${name}`);
  for (const name of ["pdf/page-1.png", "docx/brief.pdf", "docx/page-1.png", "pptx/slide-1.png", "visualization.svg", "visualization.png"]) {
    await writeFile(path.join(qaDir, name), `qa:${name}`);
  }

  await writeManifest(
    { caseId: "case", sources: [], sourcePointers: [], expectedPages: { pdf: 1, docx: 1 }, expectedSlides: 1 },
    outputDir,
    qaDir,
    {},
    {},
  );
  const manifest = JSON.parse(await readFile(path.join(outputDir, "artifact-manifest.json"), "utf8"));
  const sha = (value) => createHash("sha256").update(value).digest("hex");
  const expectedArtifactSet = sha(artifacts.sort().map((name) => `${name}:${sha(`artifact:${name}`)}`).join("\n"));
  const expectedQaSet = sha([
    "docx/brief.pdf", "docx/page-1.png", "pdf/page-1.png", "pptx/slide-1.png", "visualization.png", "visualization.svg",
  ].map((name) => `${name}:${sha(`qa:${name}`)}`).join("\n"));

  assert.deepEqual(manifest.renderBinding.pptx.qaFiles.map((entry) => entry.path), ["pptx/slide-1.png"]);
  assert.deepEqual(manifest.renderBinding.docx.qaFiles.map((entry) => entry.path), ["docx/brief.pdf", "docx/page-1.png"]);
  assert.equal(manifest.renderBinding.pdf.artifactSha256, sha("artifact:brief.pdf"));
  assert.deepEqual(manifest.formatCoverage, FORMAT_COVERAGE);
  assert.equal(manifest.visualAttestation.artifactSetSha256, expectedArtifactSet);
  assert.equal(manifest.visualAttestation.qaSetSha256, expectedQaSet);
});
