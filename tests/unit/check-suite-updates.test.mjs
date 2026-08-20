import assert from "node:assert/strict";
import test from "node:test";

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
