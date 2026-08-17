import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseSuiteHandoffContract,
  validateHandoffChain,
  validateHandoffRequest,
  validateHandoffReturn,
} from "../../tooling/lib/suite-handoff-contract.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const PRODUCTS = Object.freeze(["game-design-career", "game-design-studio"]);

function packagedContract(product) {
  return path.join(repoRoot, "plugins", product, "skills", product, "references/handoff.md");
}

test("both products ship the same handoff contract bytes", async () => {
  const [career, studio] = await Promise.all(PRODUCTS.map((product) => readFile(packagedContract(product))));
  assert.ok(career.equals(studio), "the two packaged handoff contracts differ");
  const source = await readFile(path.join(repoRoot, "shared/suite-handoff/references/handoff.md"));
  assert.ok(source.equals(career), "the packaged contract is not the shared source");
});

test("the contract lives inside a sentinel block that a parser can find", async () => {
  const contract = await readFile(packagedContract("game-design-studio"), "utf8");
  assert.equal(contract.split("<!-- suite-handoff-contract:start -->").length - 1, 1);
  assert.equal(contract.split("<!-- suite-handoff-contract:end -->").length - 1, 1);
  assert.ok(
    contract.indexOf("<!-- suite-handoff-contract:start -->") < contract.indexOf("<!-- suite-handoff-contract:end -->"),
  );
});

const contractMarkdown = await readFile(
  path.join(repoRoot, "shared/suite-handoff/references/handoff.md"),
  "utf8",
);
const contract = parseSuiteHandoffContract(contractMarkdown);

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-request-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    requestedOutputs: ["system-evidence-summary"],
    sourceArtifactIds: ["combat-spec"],
    returnToSkill: "game-design-career",
    ...overrides,
  };
}

function envelopeReturn(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-return-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    facts: ["combat spec names three damage types"],
    inferences: [],
    recommendations: [],
    unknowns: ["balance targets are not published"],
    ...overrides,
  };
}

test("a well-formed request and return are accepted", () => {
  assert.deepEqual(validateHandoffRequest(request(), contract), { ok: true, errors: [] });
  assert.deepEqual(validateHandoffReturn(envelopeReturn(), contract), { ok: true, errors: [] });
});

// 스펙 C절 테스트 전략이 나열한 여섯 거부 사유다. 하나라도 통과하면 인계가 증거를 지어낼 수 있다.
test("the contract refuses every malformed envelope the spec names", () => {
  const cases = [
    ["owner and supplier swapped", () => validateHandoffRequest(
      request({ ownerProduct: "game-design-studio", returnToSkill: "game-design-career" }), contract)],
    ["returnToSkill does not match the owner", () => validateHandoffRequest(
      request({ returnToSkill: "game-design-studio" }), contract)],
    ["unknown product id", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-suite" }), contract)],
    ["requestedOutputs outside the enum", () => validateHandoffRequest(
      request({ requestedOutputs: ["salary-benchmark"] }), contract)],
    ["owner equals supplier", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-career" }), contract)],
    ["return envelope missing a field", () => validateHandoffReturn(
      { ...envelopeReturn(), unknowns: undefined }, contract)],
  ];
  for (const [name, run] of cases) {
    const result = run();
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.length > 0, name);
  }
});

test("a supplier cannot start a second handoff for the same request", () => {
  const first = request();
  const second = request({ ownerProduct: "game-design-studio", supplierProduct: "game-design-career", returnToSkill: "game-design-studio" });
  assert.equal(validateHandoffChain([first, envelopeReturn()], contract).ok, true);
  const chained = validateHandoffChain([first, envelopeReturn(), second], contract);
  assert.equal(chained.ok, false);
  assert.ok(chained.errors.some((message) => /one handoff/u.test(message)), chained.errors.join("\n"));
});

test("an empty or duplicated requestedOutputs list is refused", () => {
  assert.equal(validateHandoffRequest(request({ requestedOutputs: [] }), contract).ok, false);
  assert.equal(validateHandoffRequest(
    request({ requestedOutputs: ["system-evidence-summary", "system-evidence-summary"] }), contract).ok, false);
});

test("an unknown key in either envelope is refused", () => {
  assert.equal(validateHandoffRequest({ ...request(), priority: "high" }, contract).ok, false);
  assert.equal(validateHandoffReturn({ ...envelopeReturn(), approved: true }, contract).ok, false);
});
