import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { buildUseCaseDiagrams } from "../../tooling/build-use-case-diagrams.mjs";
import {
  CAREER_DIAGRAM_PRODUCTION_CONTRACT,
  validateCareerDiagramProductionBatch,
  validateCareerDiagramProductionContract,
} from "../../tooling/lib/career-diagram-production-contract.mjs";
import { validateDiagramSource } from "../../tooling/lib/use-case-diagrams.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const expectedIds = [
  ...Array.from({ length: 8 }, (_, index) => `ca-c${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 10 }, (_, index) => `ca-t${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 15 }, (_, index) => `ca-s${String(index + 1).padStart(2, "0")}`),
];

const clone = (value) => structuredClone(value);

function getAt(value, pathParts) {
  return pathParts.reduce((current, part) => current[part], value);
}

function parentAt(value, pathParts) {
  return getAt(value, pathParts.slice(0, -1));
}

function objectPaths(value, prefix = []) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  return [prefix, ...Object.entries(value).flatMap(([key, child]) => objectPaths(child, [...prefix, key]))];
}

function propertyPaths(value, prefix = []) {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((child, index) => propertyPaths(child, [...prefix, index]));
  return Object.entries(value).flatMap(([key, child]) => [[...prefix, key], ...propertyPaths(child, [...prefix, key])]);
}

function arrayPaths(value, prefix = []) {
  if (Array.isArray(value)) return [prefix, ...value.flatMap((child, index) => arrayPaths(child, [...prefix, index]))];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => arrayPaths(child, [...prefix, key]));
}

function primitivePaths(value, prefix = []) {
  if (value === null || typeof value !== "object") return [prefix];
  if (Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => primitivePaths(child, [...prefix, key]));
}

function pathLabel(pathParts) {
  return pathParts.join(".");
}

async function readProductionInputs() {
  const [sourcesText, routingText] = await Promise.all([
    readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"),
    readFile(path.join(repoRoot, "products/game-design-career/plugin/references/routing.json"), "utf8"),
  ]);
  const sources = JSON.parse(sourcesText).filter(({ scope }) => scope.startsWith("game-design-career"));
  return { sources, routing: JSON.parse(routingText) };
}

test("Career production contract owns the exact 33 source IDs and validates the stored batch", async () => {
  assert.deepEqual(Object.keys(CAREER_DIAGRAM_PRODUCTION_CONTRACT), expectedIds);
  const { sources, routing } = await readProductionInputs();
  assert.doesNotThrow(() => validateCareerDiagramProductionBatch(sources, routing));
});

test("Career production contract rejects exhaustive deletion, wrong-valid cross-ID, reorder, duplicate, and extra mutations", () => {
  const entries = Object.entries(CAREER_DIAGRAM_PRODUCTION_CONTRACT);

  for (const [id, expected] of entries) {
    for (const fieldPath of propertyPaths(expected)) {
      const mutated = clone(expected);
      const parent = parentAt(mutated, fieldPath);
      const key = fieldPath.at(-1);
      if (Array.isArray(parent)) parent.splice(key, 1);
      else delete parent[key];
      assert.throws(
        () => validateCareerDiagramProductionContract(mutated),
        { name: "TypeError" },
        `${id} deletion ${pathLabel(fieldPath)}`,
      );
    }

    for (const fieldPath of primitivePaths(expected)) {
      const original = getAt(expected, fieldPath);
      const donor = entries
        .map(([, candidate]) => candidate)
        .find((candidate) => {
          try {
            const value = getAt(candidate, fieldPath);
            return typeof value === typeof original && value !== original;
          } catch {
            return false;
          }
        });
      if (!donor) continue;
      const mutated = clone(expected);
      parentAt(mutated, fieldPath)[fieldPath.at(-1)] = getAt(donor, fieldPath);
      assert.throws(
        () => validateCareerDiagramProductionContract(mutated),
        { name: "TypeError" },
        `${id} cross-ID ${pathLabel(fieldPath)}`,
      );
    }

    for (const fieldPath of arrayPaths(expected)) {
      const original = getAt(expected, fieldPath);
      const donor = entries
        .map(([, candidate]) => candidate)
        .find((candidate) => {
          try {
            const value = getAt(candidate, fieldPath);
            return Array.isArray(value) && !isDeepStrictEqual(value, original);
          } catch {
            return false;
          }
        });
      if (donor) {
        const crossId = clone(expected);
        parentAt(crossId, fieldPath)[fieldPath.at(-1)] = clone(getAt(donor, fieldPath));
        assert.throws(() => validateCareerDiagramProductionContract(crossId), { name: "TypeError" }, `${id} cross-ID array ${pathLabel(fieldPath)}`);
      }
      if (original.length > 1) {
        const reordered = clone(expected);
        getAt(reordered, fieldPath).reverse();
        assert.throws(() => validateCareerDiagramProductionContract(reordered), { name: "TypeError" }, `${id} reorder ${pathLabel(fieldPath)}`);
      }
      if (original.length > 0) {
        const duplicated = clone(expected);
        getAt(duplicated, fieldPath).push(clone(original[0]));
        assert.throws(() => validateCareerDiagramProductionContract(duplicated), { name: "TypeError" }, `${id} duplicate ${pathLabel(fieldPath)}`);
      }
      const extended = clone(expected);
      getAt(extended, fieldPath).push(typeof original[0] === "string" ? "extra-valid-value" : { extra: "valid" });
      assert.throws(() => validateCareerDiagramProductionContract(extended), { name: "TypeError" }, `${id} extra ${pathLabel(fieldPath)}`);
    }

    for (const fieldPath of objectPaths(expected)) {
      const extended = clone(expected);
      getAt(extended, fieldPath).__extra_contract_field = "wrong-valid";
      assert.throws(() => validateCareerDiagramProductionContract(extended), { name: "TypeError" }, `${id} extra object ${pathLabel(fieldPath)}`);
    }
  }
});

test("Career production validator rejects a representative generic-valid cross-ID semantic mutation", async () => {
  const { sources } = await readProductionInputs();
  const mutated = clone(sources.find(({ id }) => id === "ca-c03"));
  mutated.semantic.evidence = sources.find(({ id }) => id === "ca-c04").semantic.evidence;
  assert.doesNotThrow(() => validateDiagramSource(mutated));
  assert.throws(() => validateCareerDiagramProductionContract(mutated), /ca-c03.*semantic/u);
});

test("production builder source loading invokes the Career batch validator", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "career-diagram-production-test-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const { sources, routing } = await readProductionInputs();
  sources.find(({ id }) => id === "ca-s10").semantic.trigger = sources.find(({ id }) => id === "ca-s11").semantic.trigger;
  await mkdir(path.join(fixtureRoot, "guides/assets"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "products/game-design-career/plugin/references"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "guides/assets/use-case-diagram-sources.json"), JSON.stringify(sources));
  await writeFile(path.join(fixtureRoot, "products/game-design-career/plugin/references/routing.json"), JSON.stringify(routing));

  await assert.rejects(
    () => buildUseCaseDiagrams({ repoRoot: fixtureRoot, ids: ["ca-s10"] }),
    /ca-s10.*semantic/u,
  );
});
