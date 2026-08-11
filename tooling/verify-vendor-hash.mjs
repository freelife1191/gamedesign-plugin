import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyDiagramSkillVendor } from "./sync-diagram-skills.mjs";

function parseArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === "--root" && args[1]) return { root: args[1] };
  throw new Error("Usage: node tooling/verify-vendor-hash.mjs [--root <repository-root>]");
}

export async function verifyVendorRoot(vendorRoot) {
  return (await verifyDiagramSkillVendor({ root: vendorRoot, name: "skillstead" })).verifiedFiles;
}

export async function verifyVendorHash(repositoryRoot) {
  return verifyVendorRoot(path.join(repositoryRoot, "shared/vendor/skillstead"));
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    const { root } = parseArgs(process.argv.slice(2));
    const repositoryRoot = root ? path.resolve(root) : path.resolve(path.dirname(modulePath), "..");
    const count = await verifyVendorHash(repositoryRoot);
    console.log(`Skillstead vendor verified ${count} files`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
