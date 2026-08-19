import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const checkerUrl = new URL("../../tooling/check-suite-updates.mjs", import.meta.url);

function component(id, status, installedTag = "v1.0.0", latestTag = "v1.0.0") {
  return { id, status, installedTag, latestTag, updateAvailable: status === "outdated" };
}

function diagramResult(statuses) {
  return statuses.map(([name, status, installedTag, latestTag]) => ({
    name,
    status,
    installedTag,
    latestTag,
    updateAvailable: status === "outdated",
  }));
}

function parseWorkflowYaml(source) {
  const parsed = { triggers: { schedule: [], workflowDispatch: false }, permissions: {}, commands: [] };
  let section = null;
  let commandBlock = false;
  for (const line of source.split("\n")) {
    if (/^on:\s*$/u.test(line)) {
      section = "on";
      commandBlock = false;
      continue;
    }
    if (/^permissions:\s*$/u.test(line)) {
      section = "permissions";
      commandBlock = false;
      continue;
    }
    if (/^[A-Za-z][A-Za-z0-9_-]*:\s*$/u.test(line)) {
      section = null;
      commandBlock = false;
    }
    if (section === "on" && /^  workflow_dispatch:\s*$/u.test(line)) parsed.triggers.workflowDispatch = true;
    if (section === "on") {
      const cron = line.match(/^    - cron: ['"]([^'"]+)['"]\s*$/u);
      if (cron) parsed.triggers.schedule.push({ cron: cron[1] });
    }
    if (section === "permissions") {
      const contents = line.match(/^  contents: ([A-Za-z-]+)\s*$/u);
      if (contents) parsed.permissions.contents = contents[1];
    }
    if (/^        run: \|\s*$/u.test(line)) {
      commandBlock = true;
      continue;
    }
    if (commandBlock && /^          /u.test(line)) parsed.commands.push(line.trim());
    else if (commandBlock && line.trim() !== "") commandBlock = false;
  }
  return parsed;
}

test("aggregate checker returns current and exit zero only when every component is current", async () => {
  const { checkSuiteUpdates, exitCodeForUpdateStatus } = await import(checkerUrl.href);
  const result = await checkSuiteUpdates({
    checkDiagramSkills: async () => diagramResult([
      ["skillstead", "current", "svg-infographic/v0.9.0", "svg-infographic/v0.9.0"],
      ["archify", "current", "v2.14.0", "v2.14.0"],
    ]),
    checkImNotAi: async () => ({ status: "current", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false }),
  });

  assert.deepEqual(result, {
    schemaVersion: 1,
    status: "current",
    components: [
      component("skillstead", "current", "svg-infographic/v0.9.0", "svg-infographic/v0.9.0"),
      component("archify", "current", "v2.14.0", "v2.14.0"),
      component("im-not-ai", "current", "v2.3.0", "v2.3.0"),
    ],
  });
  assert.equal(exitCodeForUpdateStatus(result.status), 0);
});

test("aggregate checker returns outdated and exit two when a verified component is behind", async () => {
  const { checkSuiteUpdates, exitCodeForUpdateStatus } = await import(checkerUrl.href);
  const result = await checkSuiteUpdates({
    checkDiagramSkills: async () => diagramResult([
      ["skillstead", "current", "svg-infographic/v0.9.0", "svg-infographic/v0.9.0"],
      ["archify", "outdated", "v2.13.0", "v2.14.0"],
    ]),
    checkImNotAi: async () => ({ status: "current", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false }),
  });

  assert.equal(result.status, "outdated");
  assert.deepEqual(result.components[1], component("archify", "outdated", "v2.13.0", "v2.14.0"));
  assert.equal(exitCodeForUpdateStatus(result.status), 2);
});

test("aggregate checker treats malformed or failed component checks as unknown and exit one", async () => {
  const { checkSuiteUpdates, exitCodeForUpdateStatus } = await import(checkerUrl.href);
  const result = await checkSuiteUpdates({
    checkDiagramSkills: async () => diagramResult([
      ["skillstead", "current", "svg-infographic/v0.9.0", "svg-infographic/v0.9.0"],
      ["archify", "current", "v2.14.0", "v2.14.0"],
    ]),
    checkImNotAi: async () => ({ status: "unexpected", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false }),
  });

  assert.equal(result.status, "unknown");
  assert.deepEqual(result.components.at(-1), component("im-not-ai", "unknown", null, null));
  assert.equal(exitCodeForUpdateStatus(result.status), 1);
});

test("aggregate checker records rejected dependency evidence without leaking its raw failure", async () => {
  const { checkSuiteUpdates, exitCodeForUpdateStatus } = await import(checkerUrl.href);
  const stderr = [];
  const result = await checkSuiteUpdates({
    checkDiagramSkills: async () => { throw new Error("403 forbidden body: secret-token=/private/repo"); },
    checkImNotAi: async () => ({ status: "current", installedTag: "v2.3.0", latestTag: "v2.3.0", updateAvailable: false }),
    writeStderr: (message) => stderr.push(message),
  });

  assert.equal(result.status, "unknown");
  assert.equal(exitCodeForUpdateStatus(result.status), 1);
  assert.deepEqual(stderr, [
    "UPDATE_CHECK_FAILED component=skillstead code=DEPENDENCY_REJECTED\n",
    "UPDATE_CHECK_FAILED component=archify code=DEPENDENCY_REJECTED\n",
  ]);
  assert.equal(stderr.join("").includes("secret-token"), false);
});

test("weekly workflow is a read-only scheduled audit without an update command", async () => {
  const workflowPath = path.join(repoRoot, ".github/workflows/check-bundled-skill-updates.yml");
  const workflow = parseWorkflowYaml(await readFile(workflowPath, "utf8"));

  assert.equal(workflow.triggers.workflowDispatch, true);
  assert.equal(workflow.triggers.schedule.length, 1);
  assert.match(workflow.triggers.schedule[0].cron, /^\S+(?:\s+\S+){4}$/u);
  assert.equal(workflow.permissions.contents, "read");
  // The audit may print the upgrade command in its summary — telling a maintainer what to run is the
  // point of a recommendation. What it may never do is run one, so the guard reads the lines that
  // execute and skips the ones that only write text into the step summary.
  const executed = workflow.commands.filter((command) => !/^echo\b/u.test(command));
  assert.ok(executed.length > 0, "the audit has to run something for this guard to mean anything");
  assert.equal(executed.some((command) => /(?:^|\s)(?:npm\s+run\s+)?update:|--update\b/u.test(command)), false);
  assert.equal(workflow.commands.some((command) => /(?:write-all|contents:\s*write|pull-requests:\s*write)/u.test(command)), false);
  // The recommendation has to name the command a person runs, and has to say it changes nothing here.
  assert.ok(workflow.commands.some((command) => command.includes("npm run update:vendors")), "the summary has to name the upgrade command");
  assert.ok(workflow.commands.some((command) => command.includes("아무것도 바꾸지 않습니다")), "the summary has to say the audit changes nothing");
});
