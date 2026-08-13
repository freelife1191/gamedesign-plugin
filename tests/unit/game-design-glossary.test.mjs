import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canonicalJson,
  canonicalGlossary,
  sha256Canonical,
  validateGameDesignGlossary,
  validateGlossaryReceipt,
} from "../../shared/scripts/validate-reference-intelligence.mjs";

function validGlossary() {
  return {
    schemaVersion: 1,
    scope: "shared",
    version: 1,
    terms: [{
      termId: "TERM-PLAYER-POWER",
      conceptId: "player-power",
      preferredTerm: "Player power",
      translations: [{ locale: "ko", term: "플레이어 파워" }],
      state: "approved",
    }],
  };
}

test("glossary and receipt require one language-neutral concept binding", () => {
  const glossary = validGlossary();
  assert.equal(validateGameDesignGlossary(glossary).ok, true);
  assert.equal(validateGlossaryReceipt({
    schemaVersion: 1,
    documentId: "system-combat-v1",
    glossaryVersion: glossary.version,
    glossarySha256: sha256Canonical(glossary),
    termIds: ["TERM-PLAYER-POWER"],
  }, { glossary }).ok, true);
});

test("glossary rejects noncanonical, ambiguous, and unknown term bindings", () => {
  for (const mutate of [
    (value) => { value.terms[0].termId = "term-player-power"; },
    (value) => { value.terms[0].conceptId = "player\0power"; },
    (value) => { value.terms[0].preferredTerm = "e\u0301lan"; },
    (value) => { value.terms.push({ ...value.terms[0], termId: "TERM-POWER-ALIAS" }); },
    (value) => { value.terms[0].state = "published"; },
    (value) => { value.extra = true; },
  ]) {
    const glossary = structuredClone(validGlossary());
    mutate(glossary);
    assert.equal(validateGameDesignGlossary(glossary).ok, false);
  }
});

test("glossary receipt fails closed when the binding does not match its supplied glossary", () => {
  const glossary = validGlossary();
  const receipt = {
    schemaVersion: 1,
    documentId: "system-combat-v1",
    glossaryVersion: glossary.version,
    glossarySha256: sha256Canonical(glossary),
    termIds: ["TERM-PLAYER-POWER"],
  };
  for (const mutate of [
    (value) => { value.glossarySha256 = "f".repeat(64); },
    (value) => { value.termIds = ["TERM-MISSING"]; },
    (value) => { value.termIds = ["TERM-PLAYER-POWER", "TERM-PLAYER-POWER"]; },
  ]) {
    const value = structuredClone(receipt);
    mutate(value);
    assert.equal(validateGlossaryReceipt(value, { glossary }).ok, false);
  }
  assert.equal(validateGlossaryReceipt(receipt).ok, false);
  assert.equal(canonicalGlossary(glossary), canonicalJson(glossary));
});

function assertClosedObjects(schema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") assert.equal(schema.additionalProperties, false);
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) value.forEach(assertClosedObjects);
    else assertClosedObjects(value);
  }
}

test("glossary and receipt schemas expose the same closed root, enum, and ID contracts", async () => {
  const [glossary, receipt] = await Promise.all([
    readFile(new URL("../../shared/reference-intelligence/schema/game-design-glossary.schema.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../shared/reference-intelligence/schema/glossary-receipt.schema.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  assertClosedObjects(glossary);
  assertClosedObjects(receipt);
  assert.deepEqual(glossary.required, ["schemaVersion", "scope", "version", "terms"]);
  assert.deepEqual(glossary.properties.scope.enum, ["shared", "project-overlay"]);
  assert.equal(glossary.properties.terms.items.properties.termId.pattern, "^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$");
  assert.deepEqual(receipt.required, ["schemaVersion", "documentId", "glossaryVersion", "glossarySha256", "termIds"]);
  assert.equal(receipt.properties.documentId.pattern, "^[a-z0-9]+(?:-[a-z0-9]+)*$");
  assert.equal(receipt.properties.termIds.items.pattern, "^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$");
});
