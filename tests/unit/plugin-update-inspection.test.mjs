import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectPluginUpdates,
  planApprovedPluginUpdate,
} from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const marketplace = "game-design-suite";

function localPlugin({ plugin, version, installed }) {
  return {
    pluginId: `${plugin}@${marketplace}`,
    name: plugin,
    marketplaceName: marketplace,
    version,
    installed,
    enabled: installed,
    source: { source: "local", path: "/private/tmp/marketplace/plugins/game-design-studio" },
    marketplaceSource: { sourceType: "local", source: "/private/tmp/marketplace" },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
  };
}

test("inspects only the marketplace available-list command and removes cache paths from the result", () => {
  const calls = [];
  const got = inspectPluginUpdates({
    codexPath: "/opt/local/bin/codex",
    marketplaceName: marketplace,
    runCommand(command, args, options) {
      calls.push({ command, args, options });
      return {
        status: 0,
        signal: null,
        error: undefined,
        stderr: "",
        stdout: JSON.stringify({
          installed: [localPlugin({ plugin: "game-design-studio", version: "0.1.0", installed: true })],
          available: [localPlugin({ plugin: "game-design-career", version: "0.1.1", installed: false })],
        }),
      };
    },
  });

  assert.deepEqual(calls, [{
    command: "/opt/local/bin/codex",
    args: ["plugin", "list", "--marketplace", marketplace, "--available", "--json"],
    options: { encoding: "utf8", shell: false, timeout: 30_000 },
  }]);
  assert.deepEqual(got, {
    marketplace: { name: marketplace, sourceType: "local" },
    installed: [{ plugin: "game-design-studio", version: "0.1.0" }],
    available: [{ plugin: "game-design-career", version: "0.1.1" }],
    comparisons: [{
      plugin: "game-design-studio",
      installedVersion: "0.1.0",
      availableVersion: null,
      status: "not-comparable",
    }],
  });
  assert.equal(JSON.stringify(got).includes("/private/tmp"), false, "inspection result does not expose absolute cache or marketplace paths");
});

test("rejects unclosed marketplace list JSON before producing any update advice", () => {
  const malformed = localPlugin({ plugin: "game-design-studio", version: "0.1.0", installed: true });
  malformed.extra = true;

  assert.throws(() => inspectPluginUpdates({
    codexPath: "codex",
    marketplaceName: marketplace,
    runCommand: () => ({
      status: 0,
      signal: null,
      error: undefined,
      stderr: "",
      stdout: JSON.stringify({ installed: [malformed], available: [] }),
    }),
  }), /Invalid plugin marketplace inspection/u);
});

test("rejects an unsupported marketplace source and malformed listed version", () => {
  const unsupported = localPlugin({ plugin: "game-design-studio", version: "0.1.0", installed: true });
  unsupported.marketplaceSource.sourceType = "registry";
  const malformedVersion = localPlugin({ plugin: "game-design-career", version: "v0.1.1", installed: false });

  for (const entry of [unsupported, malformedVersion]) {
    assert.throws(() => inspectPluginUpdates({
      codexPath: "codex",
      marketplaceName: marketplace,
      runCommand: () => ({
        status: 0,
        signal: null,
        error: undefined,
        stderr: "",
        stdout: JSON.stringify({ installed: entry.installed ? [entry] : [], available: entry.installed ? [] : [entry] }),
      }),
    }), /Invalid plugin marketplace inspection/u);
  }
});

test("plans Git updates with marketplace refresh first and local updates with plugin add only", () => {
  const base = {
    plugin: "game-design-studio",
    installedVersion: "0.1.0",
    availableVersion: "0.1.1",
  };

  assert.deepEqual(planApprovedPluginUpdate({
    ...base,
    marketplace: { name: marketplace, sourceType: "git" },
  }), [
    ["plugin", "marketplace", "upgrade", marketplace, "--json"],
    ["plugin", "add", "game-design-studio@game-design-suite", "--json"],
  ]);
  assert.deepEqual(planApprovedPluginUpdate({
    ...base,
    marketplace: { name: marketplace, sourceType: "local" },
  }), [
    ["plugin", "add", "game-design-studio@game-design-suite", "--json"],
  ]);
});

test("refuses equal, downgrade, prerelease, and non-canonical semantic versions", () => {
  const base = {
    marketplace: { name: marketplace, sourceType: "local" },
    plugin: "game-design-studio",
    installedVersion: "0.1.0",
  };
  for (const availableVersion of ["0.1.0", "0.0.9", "0.1.1-rc.1", "0.1.1-01", "01.1.1"]) {
    assert.throws(() => planApprovedPluginUpdate({ ...base, availableVersion }), /Invalid plugin update plan/u, availableVersion);
  }
});

test("rejects an unknown approval target or malformed version instead of constructing argv", () => {
  assert.throws(() => planApprovedPluginUpdate({
    marketplace: { name: marketplace, sourceType: "git" },
    plugin: "untrusted-plugin",
    installedVersion: "0.1.0",
    availableVersion: "0.1.1",
  }), /Invalid plugin update plan/u);
  assert.throws(() => planApprovedPluginUpdate({
    marketplace: { name: marketplace, sourceType: "local" },
    plugin: "game-design-studio",
    installedVersion: "v0.1.0",
    availableVersion: "0.1.1",
  }), /Invalid plugin update plan/u);
});
