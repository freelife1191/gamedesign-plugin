#!/usr/bin/env node

// One command for the whole bundled-skill upgrade, shaped like the upgrade skill users get: report what
// is installed and what is available, ask, and only then change anything. Nothing here runs unattended —
// without a terminal to answer the question, or an explicit --yes, the run stops before touching a
// vendor tree. Applying an upgrade also carries the regeneration with it, because a vendor tree moved
// without its manifest, its product documents, and its snapshots is a tree that fails the next gate.

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkSuiteUpdates } from "./check-suite-updates.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const UPDATERS = Object.freeze({
  skillstead: Object.freeze(["tooling/sync-diagram-skills.mjs", "--update", "skillstead"]),
  archify: Object.freeze(["tooling/sync-diagram-skills.mjs", "--update", "archify"]),
  "im-not-ai": Object.freeze(["tooling/sync-im-not-ai.mjs", "--update"]),
});

const REGENERATION = Object.freeze([
  Object.freeze({ label: "product documents", argv: ["tooling/sync-vendor-references.mjs"] }),
  Object.freeze({ label: "update manifest", argv: ["tooling/generate-update-manifest.mjs"] }),
  Object.freeze({ label: "package snapshots", argv: ["tooling/build-snapshots.mjs"] }),
]);

export function advisoryLines(report) {
  if (report.status === "unknown") {
    const unresolved = report.components.filter(({ status }) => status === "unknown").map(({ id }) => id);
    return [
      "번들 스킬 상류 상태를 확인하지 못했습니다.",
      `확인 실패: ${unresolved.join(", ") || "알 수 없음"}`,
      "네트워크나 GitHub 응답 문제일 수 있습니다. 아무것도 바꾸지 않았습니다.",
    ];
  }
  const rows = report.components.map(({ id, status, installedTag, latestTag }) =>
    status === "outdated" ? `  ${id}: ${installedTag} → ${latestTag} (업데이트 가능)` : `  ${id}: ${installedTag} (최신)`);
  if (report.status === "current") return ["번들 스킬 3개 모두 최신입니다.", ...rows];
  return [
    "번들 스킬 업데이트가 있습니다.",
    ...rows,
    "",
    "적용하면 벤더 트리, 제품 문서의 버전 표기, 업데이트 매니페스트, 패키지 스냅샷을 함께 다시 씁니다.",
    "적용 뒤에는 `npm run validate:release`로 검증하세요.",
  ];
}

export function outdatedIds(report) {
  return report.components.filter(({ status }) => status === "outdated").map(({ id }) => id);
}

function run(argv, { root, writeStdout }) {
  writeStdout(`$ node ${argv.join(" ")}\n`);
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", shell: false });
  if (result.stdout) writeStdout(result.stdout);
  if (result.stderr) writeStdout(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${argv[0]} exited with ${result.status ?? `signal ${result.signal}`}`);
  return result.stdout ?? "";
}

async function confirm({ prompt, input, output }) {
  const reader = createInterface({ input, output });
  try {
    const answer = (await reader.question(prompt)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    reader.close();
  }
}

export async function updateVendors({
  root = repoRoot,
  assumeYes = false,
  reportOnly = false,
  validate = false,
  check = checkSuiteUpdates,
  writeStdout = (message) => process.stdout.write(message),
  input = process.stdin,
  output = process.stdout,
  interactive = Boolean(process.stdin.isTTY),
  ask = confirm,
} = {}) {
  const report = await check({ root });
  writeStdout(`${advisoryLines(report).join("\n")}\n`);
  if (report.status === "unknown") return { status: "unknown", applied: [] };
  if (report.status === "current") return { status: "current", applied: [] };
  if (reportOnly) return { status: "outdated", applied: [] };

  // An upgrade rewrites vendored third-party code. The decision to do that is a person's, and a run with
  // nobody to ask is not a run that may decide on their behalf.
  if (!assumeYes) {
    if (!interactive) {
      writeStdout("\n대화형 터미널이 아닙니다. 승인 없이는 적용하지 않습니다. 적용하려면 `--yes`를 주세요.\n");
      return { status: "declined", applied: [], reason: "non-interactive" };
    }
    if (!await ask({ prompt: "\n업데이트를 진행할까요? [y/N] ", input, output })) {
      writeStdout("업데이트하지 않았습니다. 설치 상태 그대로입니다.\n");
      return { status: "declined", applied: [], reason: "answered-no" };
    }
  }

  const applied = [];
  for (const id of outdatedIds(report)) {
    run([...UPDATERS[id]], { root, writeStdout });
    applied.push(id);
  }
  for (const { label, argv } of REGENERATION) {
    writeStdout(`\n[${label}]\n`);
    run(argv, { root, writeStdout });
  }
  if (validate) {
    writeStdout("\n[release validation]\n");
    run(["tooling/validate-suite.mjs", "--release"], { root, writeStdout });
  }
  writeStdout(`\n적용 완료: ${applied.join(", ")}\n`);
  if (!validate) writeStdout("다음: `npm run validate:release`로 검증하고, 변경을 커밋하세요.\n");
  return { status: "applied", applied };
}

export function parseUpdateVendorsArgs(args) {
  const options = { assumeYes: false, reportOnly: false, validate: false, from: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--yes") options.assumeYes = true;
    else if (argument === "--report") options.reportOnly = true;
    else if (argument === "--validate") options.validate = true;
    else if (argument === "--from") {
      options.from = args[index + 1];
      index += 1;
      if (typeof options.from !== "string" || options.from === "") throw new Error("--from needs the path of a check-suite-updates JSON result");
    } else throw new Error("Usage: node tooling/update-vendors.mjs [--report [--from <json>]] [--yes] [--validate]");
  }
  if (options.reportOnly && (options.assumeYes || options.validate)) {
    throw new Error("--report only reports; it cannot be combined with --yes or --validate");
  }
  // Rendering someone else's result is a reporting act. Letting it drive an apply would mean upgrading
  // from a file whose contents this run never verified against the upstreams.
  if (options.from && !options.reportOnly) throw new Error("--from is only for --report");
  return options;
}

async function main() {
  const { from, ...options } = parseUpdateVendorsArgs(process.argv.slice(2));
  // A caller that already paid for the network check renders it from the file rather than sweeping
  // GitHub a second time for the same answer.
  const check = from ? async () => JSON.parse(await readFile(path.resolve(from), "utf8")) : undefined;
  const result = await updateVendors(check ? { ...options, check } : options);
  process.exitCode = result.status === "unknown" ? 1 : result.status === "outdated" ? 2 : 0;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
