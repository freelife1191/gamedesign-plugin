import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectTree, copyTree } from "./lib/copy-tree.mjs";
import { sha256 } from "./lib/hash.mjs";
import { verifyVendorHash } from "./verify-vendor-hash.mjs";

const VERSION = "0.8.3";
const REQUIRED_FILES = ["SKILL.md", "LICENSE.txt", "scripts/check-svg.mjs", "scripts/render.mjs"];
const PACKAGE = Object.freeze({
  name: "svg-infographic",
  version: VERSION,
  upstream: "https://github.com/kyungseo/skillstead",
  license: "Apache-2.0",
  copyright: "Copyright 2026 Kyungseo Park",
});

function parseArgs(args) {
  if (args.length === 0) return { update: false };
  if (args.length === 4 && args[0] === "--update-from" && args[1] && args[2] === "--version" && args[3]) {
    return { source: path.resolve(args[1]), update: true, version: args[3] };
  }
  throw new Error(
    "Usage: node tooling/vendor-skillstead.mjs [--update-from <source> --version 0.8.3]",
  );
}

function declaredVersion(skill) {
  const frontMatter = skill.match(/^---\n([\s\S]*?)\n---/);
  return frontMatter?.[1].match(/^\s*version:\s*([^\s]+)\s*$/m)?.[1];
}

async function validateSource(source, requestedVersion) {
  if (requestedVersion !== VERSION) {
    throw new Error(`version mismatch: this vendor lock only permits ${VERSION}, received ${requestedVersion}`);
  }
  const entries = await collectTree(source, { label: "Skillstead update source" });
  const paths = new Set(entries.map((entry) => entry.relativePath));
  for (const required of REQUIRED_FILES) {
    if (!paths.has(required)) throw new Error(`missing required upstream file: ${required}`);
  }
  const skill = await readFile(path.join(source, "SKILL.md"), "utf8");
  const sourceVersion = declaredVersion(skill);
  if (sourceVersion !== requestedVersion) {
    throw new Error(`version mismatch: source declares ${sourceVersion ?? "no version"}, expected ${requestedVersion}`);
  }
  return entries;
}

async function updateVendor(repositoryRoot, source, requestedVersion) {
  const sourceEntries = await validateSource(source, requestedVersion);
  const vendorRoot = path.join(repositoryRoot, "shared/vendor/skillstead");
  const packageParent = path.join(vendorRoot, PACKAGE.name);
  const destination = path.join(packageParent, VERSION);
  await mkdir(packageParent, { recursive: true });
  const stagingRoot = await mkdtemp(path.join(packageParent, ".0.8.3-update-"));

  try {
    await copyTree(source, stagingRoot, { label: "Skillstead update source" });
    await rm(destination, { recursive: true, force: true });
    await rename(stagingRoot, destination);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }

  const files = sourceEntries.map((entry) => ({
    path: entry.relativePath,
    sha256: sha256(entry.bytes),
    size: entry.bytes.length,
  }));
  const lock = { package: PACKAGE, files };
  const notices = `# Third-Party Notices

## Skillstead svg-infographic

- Upstream: ${PACKAGE.upstream}
- Version: ${PACKAGE.version}
- License: ${PACKAGE.license}
- ${PACKAGE.copyright}

The complete Apache License 2.0 text is preserved in \`${PACKAGE.name}/${PACKAGE.version}/LICENSE.txt\`.
`;
  await writeFile(path.join(vendorRoot, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  await writeFile(path.join(vendorRoot, "THIRD_PARTY_NOTICES.md"), notices);
}

const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(modulePath), "..");

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.update) {
    await updateVendor(repositoryRoot, options.source, options.version);
    console.log(`Updated Skillstead ${VERSION} vendor tree`);
  }
  const count = await verifyVendorHash(repositoryRoot);
  console.log(`Skillstead vendor verified ${count} files`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
