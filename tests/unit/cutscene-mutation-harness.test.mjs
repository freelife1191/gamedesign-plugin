import assert from "node:assert/strict";
import test from "node:test";

import { MUTATIONS, launchMutationEvidence } from "../fixtures/cutscene/cutscene-mutation-harness.mjs";

test("eleven cutscene mutation scenarios emit one bounded dedicated-FD record", { timeout: 60_000 }, async () => {
  assert.equal(MUTATIONS.length, 11);
  for (const name of MUTATIONS) {
    const result = await launchMutationEvidence(name);
    assert.equal(result.code, 0, name);
    assert.equal(result.evidence.split("\n").filter(Boolean).length, 1, name);
    const evidence = JSON.parse(result.evidence);
    assert.deepEqual({ name: evidence.name, providerCalls: evidence.providerCalls, writeObserved: evidence.writeObserved, protocol: evidence.protocol }, { name, providerCalls: 0, writeObserved: false, protocol: "fd-json-v1" });
    assert.equal(typeof evidence.code, "string"); assert.equal(typeof evidence.path, "string");
  }
});
