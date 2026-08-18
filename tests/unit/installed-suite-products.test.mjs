import assert from "node:assert/strict";
import test from "node:test";

import { inspectInstalledSuiteProducts } from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const MARKETPLACE = "game-design-suite";

function pluginEntry({ plugin, installed, enabled = installed }) {
  return {
    pluginId: `${plugin}@${MARKETPLACE}`,
    name: plugin,
    marketplaceName: MARKETPLACE,
    version: "0.1.1",
    installed,
    enabled,
    source: { source: "local", path: `/private/tmp/marketplace/plugins/${plugin}` },
    marketplaceSource: { sourceType: "local", source: "/private/tmp/marketplace" },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
  };
}

// 설치 목록 항목은 보통 제품 이름 하나면 충분하다. enabled를 따로 정해야 하는 사례만
// { plugin, enabled } 객체로 적는다.
function installedFields(entry) {
  return typeof entry === "string" ? { plugin: entry } : entry;
}

function hostOutput({ installed, available }) {
  return JSON.stringify({
    installed: installed.map((entry) => pluginEntry({ ...installedFields(entry), installed: true })),
    available: available.map((plugin) => pluginEntry({ plugin, installed: false })),
  });
}

// snapshotVersion (inspect-game-design-plugin-updates.mjs) calls readText once per installed
// product absent from `available`, as part of the shared parser's own version comparison — not
// because this wrapper reads snapshots itself. snapshotVersion always wraps that call in its own
// try/catch, so a throwing readText cannot escape it and cannot change what the wrapper returns.
// Recording every path it is asked for, rather than trusting the throw to propagate, is the only
// way to pin both facts: that the reads happen, and that a throwing one stays harmless.
function inspectWith(receipt) {
  const readPaths = [];
  const result = inspectInstalledSuiteProducts({
    runCommand: () => receipt,
    readText: (filePath) => {
      readPaths.push(filePath);
      throw new Error("the snapshot manifest is unreadable in this fixture");
    },
  });
  return { result, readPaths };
}

test("both installed products are reported in a stable order", () => {
  const { result, readPaths } = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-studio", "game-design-career"], available: [] }),
  });

  assert.deepEqual(result, { status: "known", products: ["game-design-career", "game-design-studio"] });
  assert.deepEqual(readPaths, [
    "/private/tmp/marketplace/plugins/game-design-studio/.codex-plugin/plugin.json",
    "/private/tmp/marketplace/plugins/game-design-career/.codex-plugin/plugin.json",
  ]);
});

// 상대 제품이 없다는 것과 확인하지 못했다는 것은 다른 사실이고, 사용자에게 다른 문장을 만든다.
// 조회가 성공했는데 목록에 없으면 미설치가 확정이다.
test("a product missing from a successful listing is absent, not unknown", () => {
  const { result, readPaths } = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({ installed: ["game-design-career"], available: ["game-design-studio"] }),
  });

  assert.equal(result.status, "known");
  assert.deepEqual(result.products, ["game-design-career"]);
  assert.deepEqual(readPaths, ["/private/tmp/marketplace/plugins/game-design-career/.codex-plugin/plugin.json"]);
});

// 비활성 제품은 파일만 디스크에 있고 호스트가 그 스킬을 싣지 않는다. 인계를 보내면 조용한 막다른
// 길이 되므로 목록에서 빠져야 한다. 그렇다고 확인 불가는 아니다 — 조회는 성공했고 상태는 여전히
// known이다. 없다는 사실과 모른다는 사실은 사용자에게 다른 문장을 만든다.
test("a disabled product is absent from the handoff list while the status stays known", () => {
  const { result, readPaths } = inspectWith({
    status: 0,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: hostOutput({
      installed: ["game-design-studio", { plugin: "game-design-career", enabled: false }],
      available: [],
    }),
  });

  assert.deepEqual(result, { status: "known", products: ["game-design-studio"] });
  // 호스트는 비활성 제품도 installed로 돌려줬다. 걸러낸 근거가 목록에 없어서가 아니라 enabled가
  // false여서라는 것을, 그 제품의 스냅샷을 실제로 읽었다는 사실로 고정한다.
  assert.deepEqual(readPaths, [
    "/private/tmp/marketplace/plugins/game-design-studio/.codex-plugin/plugin.json",
    "/private/tmp/marketplace/plugins/game-design-career/.codex-plugin/plugin.json",
  ]);
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
    const { result, readPaths } = inspectWith(receipt);
    assert.deepEqual(result, { status: "unknown", products: [] }, name);
    // None of these fail inside comparisonFor, so no snapshot read is ever attempted before the
    // wrapper closes to unknown — a stronger claim than the old stub's message could actually prove.
    assert.deepEqual(readPaths, [], `${name}: no snapshot read before failing`);
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
    readText: () => { throw new Error("the snapshot manifest is unreadable in this fixture"); },
  });

  assert.equal(ran.length, 1);
  assert.match(ran[0], /plugin list --marketplace game-design-suite --available --json/u);
});
