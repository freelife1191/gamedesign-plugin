import { readFile } from "node:fs/promises";
import path from "node:path";

export const evidenceRelativePath = "docs/research/2026-08-05-neutral-game-design-preset-evidence.md";

function unique(values, label) {
  if (values.length === 0) throw new Error(`neutral preset evidence contains no ${label}`);
  if (new Set(values).size !== values.length) throw new Error(`neutral preset evidence contains duplicate ${label}`);
  return values;
}

export async function readNeutralPresetPolicy(repoRoot) {
  const markdown = await readFile(path.join(repoRoot, evidenceRelativePath), "utf8");
  const rows = [...markdown.matchAll(/^\| \[([^\]]+)\]\((https?:\/\/[^)]+)\) \|/gmu)]
    .map(([, label, url]) => ({ label: label.normalize("NFC"), url }));
  const labels = unique(rows.map(({ label }) => label), "source labels");
  const urls = unique(rows.map(({ url }) => url), "source URLs");
  return { evidenceFilename: path.basename(evidenceRelativePath), labels, urls };
}

export function allStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

export function findPolicyLeak(strings, policy) {
  const folded = strings.map((value) => value.normalize("NFC").toLowerCase());
  return [...policy.labels, ...policy.urls].find((identity) => {
    const needle = identity.normalize("NFC").toLowerCase();
    return folded.some((value) => value.includes(needle));
  });
}

export function findPolicyLeakInBytes(bytes, policy) {
  return [...policy.labels, ...policy.urls].find((identity) => bytes.includes(Buffer.from(identity)));
}
