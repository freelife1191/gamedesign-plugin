import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function section(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => /^#{2,4} /u.test(line) && line.slice(line.indexOf(" ") + 1) === heading);
  assert.notEqual(start, -1, `missing ${heading} section`);
  const level = lines[start].indexOf(" ");
  const end = lines.findIndex((line, index) => index > start && /^#{2,4} /u.test(line) && line.indexOf(" ") <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

function parseUpdateGuide(markdown, heading) {
  const lines = section(markdown, heading);
  const prose = lines.filter((line) => line.trim() && !line.startsWith("```")).join("\n");
  const fencedCommands = markdown.split("```").filter((_, index) => index % 2 === 1)
    .flatMap((block) => block.split("\n").filter((line) => line.startsWith("codex plugin ")));
  const inlineCommands = [...markdown.matchAll(/`(codex plugin [^`]+)`/gmu)].map((match) => match[1]);
  return {
    advisory: prose.includes("알림") && prose.includes("자동으로 업데이트") && prose.includes("다시 설치하지 않"),
    firstRunAndInterval: prose.includes("처음") && prose.includes("7일"),
    optOut: prose.includes("GAME_DESIGN_UPDATE_CHECKS=false"),
    localAndGit: /Git (?:marketplace|마켓플레이스)/u.test(prose) && /로컬 (?:marketplace|마켓플레이스)/u.test(prose),
    handoff: prose.includes("새 채팅") || prose.includes("새 세션"),
    pinnedBundles: prose.includes("고정") && prose.includes("suite release"),
    cacheBoundary: prose.includes("설치된 캐시") && prose.includes("직접 편집하지 마"),
    explicitCommands: [...fencedCommands, ...inlineCommands],
  };
}

test("update guides express advisory-only lifecycle semantics through their parsed sections", async () => {
  const sources = [
    ["products/game-design-studio/plugin/README.md", "업데이트와 제거"],
    ["products/game-design-career/plugin/README.md", "업데이트와 제거"],
    ["shared/contracts/README.md", "업데이트 알림 계약"],
  ];
  for (const [filename, heading] of sources) {
    const guide = parseUpdateGuide(await readFile(path.join(root, filename), "utf8"), heading);
    assert.equal(guide.advisory, true, `${filename}: notification remains advisory-only`);
    assert.equal(guide.firstRunAndInterval, true, `${filename}: explains first run and seven-day interval`);
    assert.equal(guide.optOut, true, `${filename}: explains opt-out`);
    assert.equal(guide.localAndGit, true, `${filename}: distinguishes local and Git marketplaces`);
    assert.equal(guide.handoff, true, `${filename}: requires a new conversation/session handoff`);
    assert.equal(guide.pinnedBundles, true, `${filename}: keeps bundles pinned until a suite release`);
    assert.equal(guide.cacheBoundary, true, `${filename}: never asks users to edit installed cache folders`);
    assert.equal(guide.explicitCommands.some((command) => command.includes("marketplace upgrade")), true, `${filename}: update execution stays an explicit command`);
  }
});

test("root README summarizes the safe update path and delegates lifecycle details", async () => {
  const markdown = await readFile(path.join(root, "README.md"), "utf8");
  const installation = section(markdown, "설치하기").join("\n");
  assert.match(installation, /upgrade-game-design-suite/u);
  assert.match(installation, /비교 단계에서는 설치본을 바꾸지 않습니다/u);
  assert.match(installation, /사용자가 승인하면/u);
  assert.match(installation, /새 세션에서 재개/u);
  assert.match(installation, /guides\/game-design-studio\/installation\.md/u);
  assert.match(installation, /guides\/game-design-career\/installation\.md/u);
  assert.doesNotMatch(installation, /codex plugin remove/u);
});

for (const product of ["game-design-studio", "game-design-career"]) {
  test(product + " entry guide separates App and CLI workflows", async () => {
    const base = path.join(root, "guides", product);
    const installation = await readFile(path.join(base, "installation.md"), "utf8");
    const quickStart = await readFile(path.join(base, "quick-start.md"), "utf8");
    for (const heading of ["Codex App 설치", "Codex CLI 설치", "설치 확인", "업데이트", "제거"]) {
      assert.match(installation, new RegExp("^## " + heading + "$", "m"));
    }
    assert.match(installation, /새 채팅/);
    assert.match(installation, /새 세션/);
    assert.match(installation, /Git marketplace/);
    assert.doesNotMatch(installation, /plugin 자동 업데이트/);
    assert.match(installation, /\.agents\/plugins\/marketplace\.json/);
    assert.match(installation, /로컬 프로젝트 또는 작업 폴더/);
    assert.match(installation, /top-level `name`/);
    assert.doesNotMatch(installation, /ChatGPT 데스크톱 앱에 로컬 marketplace를 등록/);
    assert.match(installation, /https:\/\/developers\.openai\.com\/plugins\/build\/plugins#install-a-local-plugin-manually/);
    assert.match(installation, /codex plugin list --marketplace game-design-suite --available --json/);
    for (const phrase of ["Windows", "PowerShell", "USERPROFILE", "LOCALAPPDATA", "npm run verify:install-roundtrip"]) {
      assert.match(installation, new RegExp(phrase), `${product}: Windows install and cleanup guidance includes ${phrase}`);
    }
    const update = section(installation, "업데이트").join("\n");
    assert.doesNotMatch(update, /codex plugin remove/u, `${product}: normal update is add-only; removal belongs to recovery or uninstall`);
    assert.match(update, /codex plugin add/u, `${product}: normal update reapplies the selected product`);
    const removal = section(installation, "제거").join("\n");
    assert.match(removal, /codex plugin remove/u, `${product}: uninstall keeps an explicit product removal command`);
    assert.match(removal, /codex plugin marketplace remove/u, `${product}: full cleanup keeps an explicit marketplace removal command`);
    assert.match(removal, /codex plugin list/u, `${product}: removal is verified through the installed plugin list`);
    assert.match(removal, /codex plugin marketplace list/u, `${product}: removal is verified through the marketplace list`);
    assert.match(quickStart, /복사 가능한 요청문/);
    assert.match(quickStart, /예상 결과/);
    assert.equal(quickStart.match(/export-manifest\.yml/g)?.length, 2);
  });
}
