import { readFile } from "node:fs/promises";
import path from "node:path";

export const evidenceRelativePath = "docs/research/2026-08-05-neutral-game-design-preset-evidence.md";

function unique(values, label, { caseFold = false } = {}) {
  if (values.length === 0) throw new Error(`neutral preset evidence contains no ${label}`);
  const keys = caseFold ? values.map((value) => value.toLowerCase()) : values;
  if (new Set(keys).size !== values.length) throw new Error(`neutral preset evidence contains duplicate ${label}`);
  return values;
}

export function parseNeutralPresetPolicy(markdown, evidenceFilename = path.basename(evidenceRelativePath)) {
  const rows = [...markdown.matchAll(/^\| \[([^\]]+)\]\((https?:\/\/[^)]+)\) \| ([^|]+) \|/gmu)]
    .map(([, label, url, aliasCell]) => {
      const rawAliases = [...aliasCell.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
      if (rawAliases.some((alias) => alias.trim().length === 0)) {
        throw new Error("neutral preset identity aliases must be non-empty");
      }
      if (rawAliases.some((alias) => alias !== alias.trim())) {
        throw new Error("neutral preset identity aliases must be trimmed");
      }
      if (rawAliases.some((alias) => alias !== alias.normalize("NFC"))) {
        throw new Error("neutral preset identity aliases must be NFC");
      }
      return { aliases: rawAliases, label: label.normalize("NFC"), url };
    });
  const labels = unique(rows.map(({ label }) => label), "source labels");
  const urls = unique(rows.map(({ url }) => url), "source URLs");
  if (rows.some(({ aliases }) => aliases.length === 0)) throw new Error("every neutral preset evidence row requires identity aliases");
  const aliases = unique(rows.flatMap((row) => row.aliases), "identity aliases", { caseFold: true });
  return { evidenceFilename, labels, urls, aliases };
}

export async function readNeutralPresetPolicy(repoRoot) {
  const markdown = await readFile(path.join(repoRoot, evidenceRelativePath), "utf8");
  return parseNeutralPresetPolicy(markdown);
}

export function allStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}

function policyIdentities(policy, { includeAliases = true } = {}) {
  return [...policy.labels, ...policy.urls, ...(includeAliases ? policy.aliases : [])];
}

export function findPolicyLeak(strings, policy, options) {
  const folded = strings.map((value) => value.normalize("NFC").toLowerCase());
  return policyIdentities(policy, options).find((identity) => {
    const needle = identity.normalize("NFC").toLowerCase();
    return folded.some((value) => value.includes(needle));
  });
}

export function findPolicyLeakInBytes(bytes, policy, options) {
  return policyIdentities(policy, options).find((identity) => bytes.includes(Buffer.from(identity)));
}
