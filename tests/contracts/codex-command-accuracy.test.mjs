import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

// Every surface a reader copies a command from. The guides and the packaged product READMEs are what a
// user has in front of them at install time; shared/contracts is what the skills are written against.
const DOCUMENT_ROOTS = Object.freeze([
  "README.md",
  "guides",
  "shared/contracts",
  "products/game-design-studio/plugin",
  "products/game-design-career/plugin",
  "plugins/game-design-studio",
  "plugins/game-design-career",
]);

async function markdownDocuments() {
  const found = [];
  const walk = async (relative) => {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOTDIR") {
        if (relative.endsWith(".md")) found.push(relative);
        return;
      }
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile() && entry.name.endsWith(".md")) found.push(next);
    }
  };
  for (const documentRoot of DOCUMENT_ROOTS) await walk(documentRoot);
  return [...new Set(found)].sort();
}

// `--available` is a JSON-output-only flag: `codex plugin list --available` exits non-zero with
// "the following required arguments were not provided: --json". A document that prints the flag
// without its partner hands the reader a command that cannot run.
test("no document prints codex plugin list --available without --json", async () => {
  const offenders = [];
  for (const document of await markdownDocuments()) {
    const text = await readFile(path.join(root, document), "utf8");
    for (const match of text.matchAll(/codex plugin list(?<flags>(?: --[a-z-]+(?: [\w.@/-]+)?)*)/gu)) {
      const flags = match.groups.flags ?? "";
      if (flags.includes("--available") && !flags.includes("--json")) {
        offenders.push(`${document}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
