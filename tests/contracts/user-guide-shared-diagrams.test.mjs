import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { vendorVersion } from "../lib/vendored.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const manifestDir = path.dirname(manifestPath);
const expectedSharedIds = [
  "app-cli-install-flow",
  "canonical-artifact-lifecycle",
  "document-export-flow",
  "image-asset-lifecycle",
  "image-generation-mode-routing",
  "image-provider-cost-routing",
  "plugin-selection-flow",
  "project-memory-reuse-flow",
  "suite-entry-routing-flow",
  "suite-handoff-ownership-flow",
  "suite-update-approval-flow",
];

function assertContainedRelativePath(value, field) {
  assert.equal(typeof value, "string", field + " must be a string");
  assert.ok(value.length > 0, field + " must be nonempty");
  assert.ok(!path.isAbsolute(value) && !path.win32.isAbsolute(value), field + " must not be absolute");
  const resolved = path.resolve(manifestDir, value);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), field + " must stay inside the repository");
  return resolved;
}

async function assertRegularFile(value, field) {
  const resolved = assertContainedRelativePath(value, field);
  const stats = await lstat(resolved);
  assert.ok(!stats.isSymbolicLink(), field + " must not be a symlink");
  assert.ok(stats.isFile(), field + " must resolve to a regular file");
  return resolved;
}

test("shared diagram manifest declares exactly the eleven canonical shared diagram pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.skillsteadVersion, vendorVersion("skillstead"));
  assert.ok(Array.isArray(manifest.diagrams));
  const shared = manifest.diagrams.filter(({ scope }) => scope === "shared");
  assert.deepEqual(shared.map(({ id }) => id).sort(), expectedSharedIds);
  for (const diagram of shared) {
    for (const field of ["id", "scope", "svg", "png", "alt"]) {
      assert.equal(typeof diagram[field], "string", diagram.id + "." + field);
      assert.ok(diagram[field], diagram.id + "." + field + " must be nonempty");
    }
    for (const field of ["sources", "usedBy"]) {
      assert.ok(Array.isArray(diagram[field]) && diagram[field].length > 0, diagram.id + "." + field);
      for (const value of diagram[field]) await assertRegularFile(value, diagram.id + "." + field);
    }
    assert.equal(diagram.svg, "shared/" + diagram.id + ".svg");
    assert.equal(diagram.png, "shared/" + diagram.id + ".png");
    assert.equal(path.extname(diagram.svg), ".svg", diagram.id + ".svg extension");
    assert.equal(path.extname(diagram.png), ".png", diagram.id + ".png extension");
    const svgPath = await assertRegularFile(diagram.svg, diagram.id + ".svg");
    await assertRegularFile(diagram.png, diagram.id + ".png");
    const svg = await readFile(svgPath, "utf8");
    assert.match(svg, /^\s*<svg\b[^>]*>\s*<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>\s*<desc\b[^>]*>\s*[^<\s][\s\S]*?<\/desc>/u, diagram.id + " requires direct-child title and desc");
  }
});

test("image provider diagram keeps free-first routing, paid approval, and selective quality levels", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/image-provider-cost-routing.svg"), "utf8");
  for (const phrase of [
    "image_gen 먼저",
    "이미지 안에 한글이 필요한가요?",
    "gpt-image-2 사용 제안",
    "low 기본",
    "medium 선택",
    "high 예외",
    "비용·품질 안내",
    "승인 전 유료 호출 0회",
    "프롬프트만 전달",
  ]) assert.match(svg, new RegExp(phrase, "u"), phrase);
  assert.match(svg, /data-paid-provider="gpt-image-2"/u);
  assert.match(svg, /data-human-gate="이름이 확인된 사용자"[^>]*data-gate-role="paid-generation-approval"/u);
  assert.match(svg, /data-flow-edge="imagegen-to-review"[^>]*data-from="imagegen-first"[^>]*data-to="result-review"/u);
  assert.match(svg, /data-flow-edge="paid-proposal-to-approval"[^>]*data-from="paid-proposal"[^>]*data-to="paid-approval"/u);
  assert.doesNotMatch(svg, /자동 전환|항상 high|high 권장/u);
});

test("project memory diagram keeps LLM Wiki reuse local, source-bound, and human-approved", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/project-memory-reuse-flow.svg"), "utf8");
  for (const phrase of [
    "LLM Wiki",
    "GAME_DESIGN_MEMORY_ENABLED",
    "승인 기록 조회",
    "출처·범위 다시 확인",
    "만료·충돌·손상 제외",
    "기억 없이 작업",
    "새 교훈 후보를 기록",
    "승인·거부·폐기",
    ".game-design/memory/",
    "로컬 기록 추가",
    "자동 커밋·원격 전송 없음",
  ]) assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  assert.match(svg, /data-human-gate="승인 담당자"[^>]*data-gate-role="memory-decision"/u);
  assert.match(svg, /data-flow-edge="memory-disabled"[^>]*data-from="memory-config"[^>]*data-to="memory-free-work"[^>]*stroke-dasharray=/u);
  assert.match(svg, /data-flow-edge="approved-memory-reuse"[^>]*data-from="local-memory-event"[^>]*data-to="approved-memory"[^>]*stroke-dasharray=/u);
  assert.doesNotMatch(svg, /자동 승인|채팅 전체 자동 수집|자동 원격 동기화/u);
});

test("entry routing diagram shows one route, the receipt, and the one-way handoff candidate", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-entry-routing-flow.svg"), "utf8");
  for (const phrase of ["사례 ID", "담당 제품", "route-receipt.json", "routeId", "한 번만 전달", "여섯 줄", "오케스트레이터", "최대 세 개"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  // 대표 진입 스킬은 자기 파일을 만들지 않는다. 도식이 산출물을 약속하면 가이드 본문과 어긋난다.
  assert.doesNotMatch(svg, /자동 적용|승인 없이 실행/u, "entry routing must not promise unattended execution");
});

test("handoff diagram names the final owner, the supplier evidence, and the one-way return", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-handoff-ownership-flow.svg"), "utf8");
  for (const phrase of ["최종 owner", "supplier", "단방향 반환", "blocker", "사람 승인"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  // 공급 제품은 다시 인계를 시작할 수 없다. 왕복을 그리면 계약과 어긋난다.
  assert.doesNotMatch(svg, /양방향|다시 인계합니다/u, "handoff must stay one-way");
});

test("update diagram gates every install change behind a user approval", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/suite-update-approval-flow.svg"), "utf8");
  for (const phrase of ["upgrade-game-design-suite", "사용자가 승인한 뒤", "codex plugin add", "새 세션"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  assert.match(svg, /설치본은 그대로 두고/u, "inspection stage changes nothing");
  assert.doesNotMatch(svg, /자동 업데이트|자동 적용/u, "update must never read as unattended");
});

test("install diagram carries the UTF-8 preflight and the marketplace kind before either lane", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/app-cli-install-flow.svg"), "utf8");
  for (const phrase of ["UTF-8 preflight", "BOM", "마켓플레이스 종류", "Windows·Ubuntu", "선택 제거", "전체 정리"]) {
    assert.match(svg, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), phrase);
  }
  // 읽기 순서가 lane보다 앞서야 사용자가 설치 실패를 만나기 전에 인코딩을 확인한다.
  assert.ok(
    svg.indexOf('aria-label="읽기 순서 1: 설치 전 확인"') < svg.indexOf('aria-label="읽기 순서 2: Codex App lane"'),
    "the preflight band precedes the App lane",
  );
});

test("the three suite diagrams are embedded where their decision is actually made", async () => {
  const consumers = [
    ["guides/game-design-studio/skills/game-design-studio.md", "../../assets/shared/suite-entry-routing-flow.png", "../../assets/shared/suite-handoff-ownership-flow.png"],
    ["guides/game-design-career/skills/game-design-career.md", "../../assets/shared/suite-entry-routing-flow.png", "../../assets/shared/suite-handoff-ownership-flow.png"],
    ["guides/use-cases/output-catalog.md", "../assets/shared/suite-handoff-ownership-flow.png"],
    ["guides/game-design-studio/installation.md", "../assets/shared/suite-update-approval-flow.png"],
    ["guides/game-design-career/installation.md", "../assets/shared/suite-update-approval-flow.png"],
  ];
  for (const [filename, ...pngPaths] of consumers) {
    const markdown = await readFile(path.join(root, filename), "utf8");
    for (const pngPath of pngPaths) {
      const svgPath = pngPath.replace(/\.png$/u, ".svg");
      assert.ok(markdown.includes(`](${pngPath})](${svgPath})`), `${filename} embeds ${pngPath} and links its SVG source`);
    }
  }
});

test("shared image and memory diagrams are embedded where readers need their full decision flow", async () => {
  const consumers = [
    ["README.md", "guides/assets/shared/project-memory-reuse-flow.png"],
    ["guides/game-design-studio/image-assets.md", "../assets/shared/image-provider-cost-routing.png"],
    ["guides/game-design-career/image-assets.md", "../assets/shared/image-provider-cost-routing.png"],
    ["guides/project-memory.md", "assets/shared/project-memory-reuse-flow.png"],
    ["guides/game-design-studio/memory.md", "../assets/shared/project-memory-reuse-flow.png"],
    ["guides/game-design-career/memory.md", "../assets/shared/project-memory-reuse-flow.png"],
  ];
  for (const [filename, ...pngPaths] of consumers) {
    const markdown = await readFile(path.join(root, filename), "utf8");
    for (const pngPath of pngPaths) {
      const svgPath = pngPath.replace(/\.png$/u, ".svg");
      assert.ok(markdown.includes(`](${pngPath})](${svgPath})`), `${filename} embeds ${pngPath} and links its SVG source`);
    }
  }
});

test("product visualization skills humanize Korean copy before SVG authoring", async () => {
  const skillPaths = [
    "products/game-design-studio/plugin/skills/visualize-game-design/SKILL.md",
    "products/game-design-career/plugin/skills/visualize-career-roadmap/SKILL.md",
  ];
  for (const filename of skillPaths) {
    const skill = await readFile(path.join(root, filename), "utf8");
    const gate = skill.indexOf("## Korean copy gate");
    const authoring = Math.min(
      ...[skill.indexOf("## Workflow"), skill.indexOf("## Produce and Verify")].filter((index) => index >= 0),
    );
    assert.ok(gate >= 0 && gate < authoring, `${filename}: Korean copy gate precedes SVG authoring`);
    for (const phrase of [
      "skills/humanize-korean/SKILL.md",
      "$humanize-korean",
      "before placing it in the SVG",
      "protected-content check",
      "stop before SVG authoring",
    ]) assert.ok(skill.includes(phrase), `${filename}: preserves the pre-authoring Korean copy contract: ${phrase}`);
  }
});

test("document export puts all shared preparation states on one rail", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/document-export-flow.svg"), "utf8");
  assert.match(svg, /aria-label="읽기 순서 2: 공통 준비 상태"/u);
  for (const status of ["not-requested", "blocked", "pending", "unavailable"]) {
    assert.match(svg, new RegExp(">" + status + "<", "u"));
  }
});
