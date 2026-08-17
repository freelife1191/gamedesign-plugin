import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  inspectPluginUpdates,
  planApprovedPluginUpdate,
} from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const skillRoot = new URL("../../shared/suite-update/skills/upgrade-game-design-suite/", import.meta.url);
const skill = await readFile(new URL("SKILL.md", skillRoot), "utf8");
const commands = await readFile(new URL("references/codex-commands.md", skillRoot), "utf8");

const MARKETPLACE = "game-design-suite";

function pluginEntry({ plugin, version, installed }) {
  return {
    pluginId: `${plugin}@${MARKETPLACE}`,
    name: plugin,
    marketplaceName: MARKETPLACE,
    version,
    installed,
    enabled: installed,
    source: { source: "local", path: "/private/tmp/marketplace/plugins/game-design-studio" },
    marketplaceSource: { sourceType: "local", source: "/private/tmp/marketplace" },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
  };
}

function listOutput() {
  return JSON.stringify({
    installed: [pluginEntry({ plugin: "game-design-studio", version: "0.1.1", installed: true })],
    available: [pluginEntry({ plugin: "game-design-studio", version: "0.1.2", installed: false })],
  });
}

// The check and plan stages run before anyone has approved anything, so nothing they invoke may
// change an installation. Asserting on the recorded argv is the only way to keep that true as the
// inspection grows.
test("inspection never runs a command that changes an installation", () => {
  const ran = [];
  inspectPluginUpdates({
    marketplaceName: MARKETPLACE,
    runCommand(command, args) {
      ran.push([command, ...args].join(" "));
      return { status: 0, signal: null, error: undefined, stderr: "", stdout: listOutput() };
    },
  });

  assert.ok(ran.length > 0, "the inspection has to actually run something for this to mean anything");
  for (const argv of ran) {
    assert.doesNotMatch(argv, /marketplace upgrade|plugin add|plugin remove/u, `inspection ran a mutating command: ${argv}`);
  }
});

test("a git marketplace plan refreshes once and installs once, in that order", () => {
  const plan = planApprovedPluginUpdate({
    marketplace: { name: MARKETPLACE, sourceType: "git" },
    plugin: "game-design-studio",
    installedVersion: "0.1.1",
    availableVersion: "0.1.2",
  });

  assert.deepEqual(plan, [
    ["plugin", "marketplace", "upgrade", MARKETPLACE, "--json"],
    ["plugin", "add", `game-design-studio@${MARKETPLACE}`, "--json"],
  ]);
});

// Marketplace upgrade fails outright on a local marketplace, so a plan that included it would hand
// the user a command that cannot work.
test("a local marketplace plan never tries to upgrade the marketplace", () => {
  const plan = planApprovedPluginUpdate({
    marketplace: { name: MARKETPLACE, sourceType: "local" },
    plugin: "game-design-studio",
    installedVersion: "0.1.1",
    availableVersion: "0.1.2",
  });

  assert.deepEqual(plan, [["plugin", "add", `game-design-studio@${MARKETPLACE}`, "--json"]]);
});

test("an equal or lower available version produces no plan at all", () => {
  for (const availableVersion of ["0.1.1", "0.1.0"]) {
    assert.throws(() => planApprovedPluginUpdate({
      marketplace: { name: MARKETPLACE, sourceType: "git" },
      plugin: "game-design-studio",
      installedVersion: "0.1.1",
      availableVersion,
    }), `${availableVersion} must not produce an install plan`);
  }
});

test("a prerelease or unparseable available version produces no plan at all", () => {
  for (const availableVersion of ["0.2.0-rc.1", "0.2", "latest", ""]) {
    assert.throws(() => planApprovedPluginUpdate({
      marketplace: { name: MARKETPLACE, sourceType: "git" },
      plugin: "game-design-studio",
      installedVersion: "0.1.1",
      availableVersion,
    }), `${availableVersion} must not produce an install plan`);
  }
});

// The forbidden actions live in prose, which is exactly where a rule can be dropped in an edit and
// nothing notices. Naming each one here makes a quiet reintroduction fail the suite.
test("every destructive recovery command appears only inside its prohibition", () => {
  const prohibition = skill.match(/^- Never run a destructive recovery.*$/mu)?.[0] ?? "";
  for (const forbidden of ["git reset --hard", "rm -rf", ".bak"]) {
    assert.ok(prohibition.includes(forbidden), `${forbidden} must be named in the prohibition`);
    assert.equal(
      skill.split(forbidden).length - 1,
      1,
      `${forbidden} appears outside its prohibition`,
    );
  }
});

test("the skill forbids unattended upgrades and never offers a setting for one", () => {
  assert.doesNotMatch(skill, /auto_upgrade/u);
  assert.match(skill, /Never apply an update without an approval given in this conversation/u);
});

test("the skill refuses to touch a dirty checkout instead of clearing it", () => {
  assert.match(skill, /Never stash or discard local changes/u);
});

test("the skill never leaks a token, a home path, or a response body in a failure", () => {
  assert.match(skill, /Never read a GitHub API token or a user API key/u);
  assert.match(skill, /Never put a token, a user home absolute path, or a remote response body in a failure message/u);
});

test("host commands live only in the reference file", () => {
  assert.doesNotMatch(skill, /codex plugin/u, "the skill body must not name a host command directly");
  assert.match(commands, /codex plugin marketplace upgrade game-design-suite --json/u);
  assert.match(commands, /codex plugin add <plugin>@game-design-suite --json/u);
});

test("the skill offers exactly the four approved choices", () => {
  const choices = [
    "Update now",
    "Later",
    "Do not tell me about this version again",
    "Turn update checks off",
  ];
  for (const choice of choices) assert.ok(skill.includes(choice), `missing choice: ${choice}`);
  assert.match(skill, /GAME_DESIGN_UPDATE_CHECKS=false/u);
});

test("the skill stops for an answer before it applies anything", () => {
  const workflow = skill.slice(skill.indexOf("## Workflow"), skill.indexOf("## Choices"));
  const stopIndex = workflow.indexOf("stop and wait for an answer");
  const applyIndex = workflow.indexOf("Apply only the chosen option");
  assert.ok(stopIndex > 0, "the workflow has to say it stops");
  assert.ok(applyIndex > stopIndex, "applying comes after the stop, not before it");
});
