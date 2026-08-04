import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("repo marketplace exposes exactly the two independent plugins", async () => {
  const marketplace = JSON.parse(await readFile(new URL(".agents/plugins/marketplace.json", root), "utf8"));
  assert.equal(typeof marketplace.name, "string");
  assert.deepEqual(
    marketplace.plugins.map(({ name, source }) => [name, source.path]).sort(),
    [
      ["game-design-career", "./plugins/game-design-career"],
      ["game-design-studio", "./plugins/game-design-studio"],
    ],
  );
});
