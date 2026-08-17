import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
