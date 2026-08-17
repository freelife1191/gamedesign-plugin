import assert from "node:assert/strict";
import test from "node:test";

import { inspectInstalledSuiteProducts } from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const MARKETPLACE = "game-design-suite";

function pluginEntry({ plugin, installed }) {
  return {
    pluginId: `${plugin}@${MARKETPLACE}`,
    name: plugin,
    marketplaceName: MARKETPLACE,
    version: "0.1.1",
    installed,
    enabled: installed,
    source: { source: "local", path: `/private/tmp/marketplace/plugins/${plugin}` },
    marketplaceSource: { sourceType: "local", source: "/private/tmp/marketplace" },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
  };
}

function hostOutput({ installed, available }) {
  return JSON.stringify({
    installed: installed.map((plugin) => pluginEntry({ plugin, installed: true })),
    available: available.map((plugin) => pluginEntry({ plugin, installed: false })),
  });
}

function inspectWith(receipt) {
  return inspectInstalledSuiteProducts({
    runCommand: () => receipt,
    readText: () => { throw new Error("the product lookup must not read a snapshot manifest"); },
  });
}

test("both installed products are reported in a stable order", () => {
  const result = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-studio", "game-design-career"], available: [] }),
  });

  assert.deepEqual(result, { status: "known", products: ["game-design-career", "game-design-studio"] });
});

// 상대 제품이 없다는 것과 확인하지 못했다는 것은 다른 사실이고, 사용자에게 다른 문장을 만든다.
// 조회가 성공했는데 목록에 없으면 미설치가 확정이다.
test("a product missing from a successful listing is absent, not unknown", () => {
  const result = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-career"], available: ["game-design-studio"] }),
  });

  assert.equal(result.status, "known");
  assert.deepEqual(result.products, ["game-design-career"]);
});

test("every way the host call can fail closes to unknown instead of throwing", () => {
  const receipts = [
    ["non-zero exit", { status: 1, signal: null, error: undefined, stderr: "boom", stdout: "" }],
    ["killed by a signal", { status: null, signal: "SIGKILL", error: undefined, stderr: "", stdout: "" }],
    ["spawn error", { status: null, signal: null, error: new Error("ENOENT"), stderr: "", stdout: "" }],
    ["malformed JSON", { status: 0, signal: null, error: undefined, stderr: "", stdout: "not json" }],
    ["unexpected keys", { status: 0, signal: null, error: undefined, stderr: "", stdout: '{"installed":[]}' }],
    ["empty listing", { status: 0, signal: null, error: undefined, stderr: "", stdout: '{"installed":[],"available":[]}' }],
  ];
  for (const [name, receipt] of receipts) {
    assert.deepEqual(inspectWith(receipt), { status: "unknown", products: [] }, name);
  }
});

test("the lookup runs one read-only listing and no mutating command", () => {
  const ran = [];
  inspectInstalledSuiteProducts({
    runCommand(command, args) {
      ran.push([command, ...args].join(" "));
      return {
        status: 0,
        signal: null,
        error: undefined,
        stderr: "",
        stdout: hostOutput({ installed: ["game-design-career"], available: [] }),
      };
    },
    readText: () => { throw new Error("unused"); },
  });

  assert.equal(ran.length, 1);
  assert.doesNotMatch(ran[0], /marketplace upgrade|plugin add|plugin remove/u);
  assert.match(ran[0], /plugin list --marketplace game-design-suite --available --json/u);
});
