import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as marketplaceSmoke from "../../tooling/marketplace-smoke.mjs";
import {
  assertArtifactDirectory,
  assertRepresentativeReceipt,
  bridgeLocalAuth,
  buildMarketplacePrompt,
  buildRepresentativeMarketplacePrompt,
  buildProofCommand,
  captureFileIdentity,
  createSmokeFailure,
  describeRepresentativeReceiptFormat,
  describeRepresentativeReceiptIdentity,
  firstRoutingReceiptMessage,
  findTrustedShells,
  installedRoleIds,
  PACKAGED_SKILL_COUNTS,
  parseExecJsonl,
  preservePrimarySmokeFailure,
  PROOF_HARNESS_PATH,
  redactFailure,
  representativeReceiptExpectation,
  resolveExpectedPluginVersion,
  runArtifactValidation,
  selectSmokeScenarios,
  summarizeCodexExecEvents,
  validateCliJson,
} from "../../tooling/marketplace-smoke.mjs";
import { artifactTreeIdentity, runMarketplaceProof } from "../../tooling/lib/marketplace-proof-harness.mjs";
import { PERMISSION_BITS_MEANINGFUL } from "../lib/platform-support.mjs";

const product = "game-design-career";
const pluginId = `${product}@game-design-suite`;

test("codex exec uses the slow marketplace timeout through its runner seam", () => {
  const calls = [];
  const result = marketplaceSmoke.runCodexExec(
    "codex",
    ["exec", "--json"],
    { cwd: "/workspace", env: { CODEX_HOME: "/isolated" } },
    (...args) => {
      calls.push(args);
      return "jsonl";
    },
  );

  assert.equal(marketplaceSmoke.CODEX_EXEC_TIMEOUT_MS, 300_000);
  assert.equal(result, "jsonl");
  assert.deepEqual(calls, [[
    "codex",
    ["exec", "--json"],
    { cwd: "/workspace", env: { CODEX_HOME: "/isolated" }, timeout: 300_000 },
  ]]);
});

test("marketplace smoke expects each product's exact installed skill inventory", () => {
  assert.deepEqual(PACKAGED_SKILL_COUNTS, {
    "game-design-career": 25,
    "game-design-studio": 26,
  });
});

test("marketplace smoke starts from an ordinary Korean request without naming a skill", () => {
  const prompt = buildMarketplacePrompt({
    displayName: "Game Design Studio",
    request: "모바일 협동 RPG의 목표와 핵심 재미를 한 장으로 정리해 주세요.",
  }, "/tmp/artifact", "node proof.mjs");

  assert.match(prompt, /모바일 협동 RPG의 목표와 핵심 재미/u);
  assert.match(prompt, /스킬 이름이나 사례 ID를 모른다고 가정/u);
  assert.match(prompt, /assets\/shared\/templates\/canonical-artifact/u);
  assert.match(prompt, /기준 템플릿은 실행 도구가 결과물 루트에 미리 복사/u);
  assert.match(prompt, /content\.md의 본문만/u);
  assert.match(prompt, /artifact_id.*formats.*status/u);
  assert.match(prompt, /runner가 설치본에서 직접 수행/u);
  assert.doesNotMatch(prompt, /\$game-design|orchestrate-game-design|skillPath|skills\/orchestrate/u);
});

test("representative smoke explicitly invokes the installed entry skill and requires the six-line routing receipt first", () => {
  const prompt = buildRepresentativeMarketplacePrompt({
    name: "game-design-studio",
    displayName: "Game Design Studio",
    entrySkill: "game-design-studio",
    request: "모바일 협동 RPG의 핵심 경험, 튜토리얼, 출시 범위를 함께 정리해 주세요.",
    expectedSkill: "orchestrate-game-design-project",
    mergeKeys: ["severity", "affectedSectionId", "rolePriority"],
  }, "/tmp/artifact");

  assert.match(prompt, /\$game-design-studio:game-design-studio/u);
  assert.match(prompt, /복합 요청/u);
  assert.match(prompt, /첫 번째 최종 메시지/u);
  assert.match(prompt, /소유 제품.*선택 스킬.*교차 제품 핸드오프.*결과물 경로.*현재 사실.*다음 사람 결정/us);
  assert.match(prompt, /검토 역할은 1명 이상 3명 이하/u);
  assert.match(prompt, /결정적 병합/u);
  assert.match(prompt, /route-receipt\.json/u);
  assert.match(prompt, /소유 제품: game-design-studio/u);
  assert.match(prompt, /선택 스킬: orchestrate-game-design-project/u);
  assert.match(prompt, /대표 진입점.*자체가 아니라.*실제 전달 대상/u);
  assert.match(prompt, /검토 역할: <1명 이상 3명 이하의 역할 ID>/u);
});

test("representative receipt accepts the ordered six-line route contract with bounded role evidence and deterministic merge proof", () => {
  const message = [
    "소유 제품: game-design-studio",
    "선택 스킬: orchestrate-game-design-project",
    "교차 제품 핸드오프: 없음",
    "결과물 경로: /tmp/artifact",
    "현재 사실·가정·차단 요인: 제공된 플랫폼과 장르는 확인했고 출시 범위는 미정",
    "다음 사람 결정: 범위 승인",
    "검토 역할: lead-game-designer, production-feasibility-critic",
    "역할 근거: lead-game-designer | evidence: content.md#core-fun | findings: 핵심 경험과 플레이어 목표를 분리",
    "역할 근거: production-feasibility-critic | evidence: content.md#scope | findings: 출시 범위를 미정으로 유지",
    "결정적 병합: severity > affectedSectionId > rolePriority",
    "검증: route-receipt.json 요청 바인딩과 artifact validator를 통과",
  ].join("\n");

  assert.doesNotThrow(() => assertRepresentativeReceipt(message, {
    product: "game-design-studio",
    selectedSkill: "orchestrate-game-design-project",
    routeId: "project-orchestration",
    allowedRoles: ["lead-game-designer", "production-feasibility-critic", "system-economy-designer"],
    mergeKeys: ["severity", "affectedSectionId", "rolePriority"],
  }));
  assert.doesNotThrow(() => assertRepresentativeReceipt(message.replace(/^/gmu, "- "), {
    product: "game-design-studio",
    selectedSkill: "orchestrate-game-design-project",
    routeId: "project-orchestration",
    allowedRoles: ["lead-game-designer", "production-feasibility-critic", "system-economy-designer"],
    mergeKeys: ["severity", "affectedSectionId", "rolePriority"],
  }));
});

test("representative receipt rejects reordered route fields, extra roles, missing evidence, or a non-deterministic merge", () => {
  const valid = [
    "소유 제품: game-design-career",
    "선택 스킬: orchestrate-game-design-career",
    "교차 제품 핸드오프: 없음",
    "결과물 경로: /tmp/artifact",
    "현재 사실·가정·차단 요인: 포트폴리오 증거는 미정",
    "다음 사람 결정: 목표 역할 확인",
    "검토 역할: career-strategist",
    "역할 근거: career-strategist | evidence: content.md#career-stage | findings: 증거 공백을 기록",
    "결정적 병합: severity > evidence-gap-id > artifact-section-id > role-priority",
    "검증: route-receipt.json 요청 바인딩과 artifact validator를 통과",
  ].join("\n");
  const options = {
    product: "game-design-career",
    productDisplayName: "Game Design Career",
    selectedSkill: "orchestrate-game-design-career",
    routeId: "entry-intake",
    allowedRoles: ["career-strategist", "game-design-mentor", "portfolio-reviewer"],
    mergeKeys: ["severity", "evidence-gap-id", "artifact-section-id", "role-priority"],
  };

  assert.doesNotThrow(() => assertRepresentativeReceipt(valid, options));
  assert.doesNotThrow(() => assertRepresentativeReceipt(
    valid
      .replace("검토 역할: career-strategist", "검토 역할: `career-strategist` / `game-design-mentor`")
      .replace(
        "역할 근거: career-strategist | evidence: content.md#career-stage | findings: 증거 공백을 기록",
        [
          "역할 근거: `career-strategist` | evidence: content.md#career-stage | findings: 증거 공백을 기록",
          "역할 근거: `game-design-mentor` | evidence: content.md#plan | findings: 학습 순서를 검토",
        ].join("\n"),
      ),
    options,
  ));
  assert.doesNotThrow(() => assertRepresentativeReceipt(
    valid
      .replace("소유 제품: game-design-career", "소유 제품: `game-design-career`")
      .replace("선택 스킬: orchestrate-game-design-career", "선택 스킬: `orchestrate-game-design-career`"),
    options,
  ));
  assert.doesNotThrow(() => assertRepresentativeReceipt(
    valid.replace(
      "선택 스킬: orchestrate-game-design-career",
      "선택 스킬: $game-design-career:orchestrate-game-design-career",
    ),
    options,
  ));
  assert.throws(() => assertRepresentativeReceipt(valid.replace("선택 스킬", "선택한 스킬"), options), /routing receipt/u);
  assert.throws(() => assertRepresentativeReceipt(valid.replace("game-design-career", "Game Design Career"), options), /routing product display name/u);
  assert.throws(() => assertRepresentativeReceipt(valid.replace("orchestrate-game-design-career", "game-design-career"), options), /routing skill/u);
  assert.throws(() => assertRepresentativeReceipt(valid.replace("career-strategist", "career-strategist, game-design-mentor, portfolio-reviewer, evidence-auditor"), options), /role contract/u);
  assert.throws(() => assertRepresentativeReceipt(valid.replace("evidence: content.md#career-stage", "evidence: 미정"), options), /role evidence/u);
  assert.throws(() => assertRepresentativeReceipt(valid.replace("severity > evidence-gap-id > artifact-section-id > role-priority", "arrival order"), options), /merge contract/u);
});

test("representative receipt diagnostics retain only six safe line shapes", () => {
  assert.deepEqual(describeRepresentativeReceiptFormat([
    "- 소유 제품: game-design-career",
    "- 선택 스킬: orchestrate-game-design-career",
    "- 교차 제품 핸드오프: 없음",
    "- 결과물 경로: /private/secret/artifact",
    "- 현재 사실·가정·차단 요인: 비공개 입력",
    "- 다음 사람 결정: 승인",
  ].join("\n")), [
    "bullet:소유 제품:",
    "bullet:선택 스킬:",
    "bullet:교차 제품 핸드오프:",
    "bullet:결과물 경로:",
    "bullet:현재 사실·가정·차단 요인:",
    "bullet:다음 사람 결정:",
  ]);
});

test("representative receipt identity diagnostics classify values without returning their text", () => {
  const options = {
    product: "game-design-career",
    selectedSkill: "orchestrate-game-design-career",
    entrySkill: "game-design-career",
  };
  const receipt = (skill) => [
    "소유 제품: game-design-career",
    `선택 스킬: ${skill}`,
  ].join("\n");
  assert.deepEqual(describeRepresentativeReceiptIdentity(receipt("orchestrate-game-design-career"), options), {
    product: "expected", skill: "expected",
  });
  assert.equal(describeRepresentativeReceiptIdentity(receipt("$game-design-career:game-design-career"), options).skill, "namespaced-entry-skill");
  assert.equal(describeRepresentativeReceiptIdentity(receipt("orchestrate-game-design-career (entry-intake)"), options).skill, "contains-expected");
  assert.equal(describeRepresentativeReceiptIdentity(receipt("비공개 값"), options).skill, "other");
});

test("Codex JSONL diagnostics distinguish agent-message ordering from installed-skill reads without exposing text", () => {
  const source = [
    { type: "item.completed", item: { type: "agent_message", text: "완료했습니다." } },
    { type: "item.completed", item: { type: "command_execution", command: "sed -n '1,80p' /tmp/cache/skills/game-design-career/SKILL.md" } },
    { type: "item.completed", item: { type: "agent_message", text: [
      "소유 제품: game-design-career",
      "선택 스킬: orchestrate-game-design-career",
      "교차 제품 핸드오프: 없음",
      "결과물 경로: artifact",
      "현재 사실·가정·차단 요인: 미정",
      "다음 사람 결정: 승인",
    ].join("\n") } },
  ].map(JSON.stringify).join("\n");
  assert.deepEqual(summarizeCodexExecEvents(source), {
    agentMessageCount: 2,
    agentMessageFormats: [["plain:unrecognized"], ["plain:소유 제품:", "plain:선택 스킬:", "plain:교차 제품 핸드오프:", "plain:결과물 경로:", "plain:현재 사실·가정·차단 요인:", "plain:다음 사람 결정:"]],
    installedSkillRead: true,
  });
  assert.equal(firstRoutingReceiptMessage(source).startsWith("소유 제품: game-design-career"), true);
});

test("both entry skills prescribe the six literal Korean routing-receipt labels", async () => {
  for (const productName of ["game-design-studio", "game-design-career"]) {
    const skill = await readFile(path.join("products", productName, "plugin", "skills", productName, "SKILL.md"), "utf8");
    for (const label of ["소유 제품:", "선택 스킬:", "교차 제품 핸드오프:", "결과물 경로:", "현재 사실·가정·차단 요인:", "다음 사람 결정:"]) {
      assert.equal(skill.includes(`\`${label}`), true, `${productName}: ${label}`);
    }
    assert.equal(skill.includes(`\`소유 제품: ${productName}\``), true, `${productName}: literal product ID`);
  }
});

test("targeted smoke selection preserves only requested scenario IDs and rejects unknown IDs", () => {
  const scenarios = [{ id: "career-direct" }, { id: "career-entry" }, { id: "studio-entry" }];
  assert.deepEqual(selectSmokeScenarios(scenarios, ["studio-entry", "career-entry"]), [
    { id: "career-entry" }, { id: "studio-entry" },
  ]);
  assert.throws(() => selectSmokeScenarios(scenarios, ["missing"]), /scenario selection/u);
});

test("representative receipt expectations keep the owning product after scenario flattening", () => {
  const representative = { expectedSkill: "orchestrate-game-design-career", allowedRoles: ["career-strategist"] };
  assert.deepEqual(representativeReceiptExpectation({
    name: "game-design-career",
    displayName: "Game Design Career",
  }, representative), {
    ...representative,
    product: "game-design-career",
    productDisplayName: "Game Design Career",
    selectedSkill: "orchestrate-game-design-career",
  });
  assert.throws(() => representativeReceiptExpectation({}, representative), /expectation mismatch/u);
});

test("representative role validation reads the exact installed routing registry", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-role-registry-"));
  try {
    await mkdir(path.join(root, "references"));
    await writeFile(path.join(root, "references/routing.json"), JSON.stringify({
      roleIds: ["lead-game-designer", "ux-accessibility-reviewer"],
    }));
    assert.deepEqual(await installedRoleIds(root), ["lead-game-designer", "ux-accessibility-reviewer"]);
    await writeFile(path.join(root, "references/routing.json"), JSON.stringify({ roleIds: ["duplicate", "duplicate"] }));
    await assert.rejects(installedRoleIds(root), /role registry mismatch/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("marketplace runner owns the canonical artifact scaffold and verifies a real content edit", async () => {
  assert.equal(typeof marketplaceSmoke.seedArtifactStarter, "function");
  assert.equal(typeof marketplaceSmoke.assertGeneratedContent, "function");
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-starter-"));
  try {
    const cacheRoot = path.join(root, "cache");
    const templateRoot = path.join(cacheRoot, "assets/shared/templates/canonical-artifact");
    await mkdir(path.join(templateRoot, "assets"), { recursive: true });
    await mkdir(path.join(templateRoot, "decisions"), { recursive: true });
    const originalContent = "---\ntitle: 기준 결과물\nartifact_id: smoke-artifact\nversion: 1\n---\n# 기준 결과물 {#smoke-artifact}\n\n## 핵심 재미 {#core-fun}\n\n초기 본문\n";
    const editedContent = "---\ntitle: 기준 결과물\nartifact_id: smoke-artifact\nversion: 1\n---\n# 기준 결과물 {#smoke-artifact}\n\n## 핵심 재미 {#core-fun}\n\n모바일 협동 RPG의 핵심 재미를 정리했다.\n";
    await writeFile(path.join(templateRoot, "content.md"), originalContent);
    await writeFile(path.join(templateRoot, "evidence.yml"), "version: 1\nclaims: []\n");
    await writeFile(path.join(templateRoot, "export-manifest.yml"), "artifact_id: smoke-artifact\nformats:\n  md:\n    status: pending\n");
    const artifactPath = path.join(root, "artifact");
    const starter = await marketplaceSmoke.seedArtifactStarter(cacheRoot, artifactPath);
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
      }),
      /unchanged/u,
    );
    await writeFile(path.join(artifactPath, "content.md"), editedContent);
    await marketplaceSmoke.assertGeneratedContent(artifactPath, {
      ...starter,
      requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
    });

    await writeFile(path.join(artifactPath, "content.md"), editedContent.replace("artifact_id: smoke-artifact", "artifact_id: changed-artifact"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /protected content envelope changed/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), editedContent.replace("{#core-fun}", "{#changed-heading}"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /protected content envelope changed/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), editedContent);
    await writeFile(path.join(artifactPath, "evidence.yml"), "version: 1\nclaims:\n  - invented\n");
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /artifact scaffold changed/u,
    );

    await writeFile(path.join(artifactPath, "evidence.yml"), "version: 1\nclaims: []\n");
    await writeFile(path.join(artifactPath, "unexpected.md"), "extra\n");
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /artifact scaffold changed/u,
    );
    await rm(path.join(artifactPath, "unexpected.md"));

    await writeFile(path.join(artifactPath, "content.md"), originalContent.replace("초기 본문", "요청과 무관한 본문 변경"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/기준 결과물/u] }),
      /request mismatch/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), originalContent.replace("초기 본문", "모바일 게임 기획"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );

    await writeFile(
      path.join(artifactPath, "content.md"),
      originalContent.replace("초기 본문", "요청과 무관한 본문\n\n```text\n```junk\n모바일 협동 RPG 핵심 재미\n```"),
    );
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동/u, /RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );

    await writeFile(
      path.join(artifactPath, "content.md"),
      originalContent.replace("초기 본문", "요청과 무관한 본문\n\n<!--\n모바일 협동 RPG 핵심 재미"),
    );
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동/u, /RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function traceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-trace-"));
  const cacheRoot = path.join(root, "cache", product, "0.1.1");
  const skillPath = path.join(cacheRoot, "skills/orchestrate-game-design-career/SKILL.md");
  const validatorPath = path.join(cacheRoot, "scripts/validate-artifact.mjs");
  const routingPath = path.join(cacheRoot, "references/routing.json");
  const artifactPath = path.join(root, "workspace/artifact");
  const workspaceProver = path.join(root, "workspace/prove-installed-skill.mjs");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, "fixture\n");
  await mkdir(path.dirname(validatorPath), { recursive: true });
  await writeFile(validatorPath, 'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: [], requestedFormats: ["md"] }));\n');
  await mkdir(path.dirname(routingPath), { recursive: true });
  await writeFile(routingPath, JSON.stringify({ routes: [{ id: "entry-intake", skill: "orchestrate-game-design-career" }] }));
  await mkdir(artifactPath, { recursive: true });
  await writeFile(workspaceProver, "fixture proof\n");
  const skillSha256 = createHash("sha256").update("fixture\n").digest("hex");
  const validatorSha256 = createHash("sha256").update(await readFile(validatorPath)).digest("hex");
  const requestSha256 = createHash("sha256").update("ordinary Korean request\n").digest("hex");
  const bindingNonce = "a".repeat(64);
  await writeFile(path.join(artifactPath, "route-receipt.json"), JSON.stringify({
    schemaVersion: 1,
    requestSha256,
    bindingNonce,
    routeId: "entry-intake",
  }));
  // The fixture's trusted shells are whatever the smoke tool itself would find on this host, resolved by
  // the tool's own function rather than by a second copy of the rule. On Windows that list is empty —
  // there is no /bin/sh to canonicalise — and the one test that needs a trusted shell to exist says so.
  const [proofIdentity, artifactIdentity, trustedShellPaths] = await Promise.all([
    captureFileIdentity(PROOF_HARNESS_PATH), artifactTreeIdentity(artifactPath), findTrustedShells(),
  ]);
  return {
    root, cacheRoot, workspaceRoot: path.dirname(artifactPath), skillPath, skillSha256,
    validatorPath, validatorSha256, artifactPath, proofIdentity, artifactSha256: artifactIdentity.sha256, requestSha256, bindingNonce,
    trustedShellPaths, workspaceProver,
  };
}

function proofArgs(fixture) {
  return [
    fixture.cacheRoot, fixture.workspaceRoot, fixture.validatorPath, fixture.validatorSha256,
    fixture.artifactPath, fixture.requestSha256,
  ];
}

function events(fixture) {
  const receipt = {
    schemaVersion: 1,
    ok: true,
    validatorSha256: fixture.validatorSha256,
    artifactSha256: fixture.artifactSha256,
    requestedFormats: ["md"],
    routeReceipt: {
      schemaVersion: 1,
      requestSha256: fixture.requestSha256,
      bindingNonce: fixture.bindingNonce,
      routeId: "entry-intake",
      loadedInstruction: {
        relativePath: "skills/orchestrate-game-design-career/SKILL.md",
        sha256: fixture.skillSha256,
      },
    },
  };
  return [
    { type: "thread.started", thread_id: "redacted" },
    { type: "turn.started" },
    { type: "item.completed", item: {
      type: "command_execution",
      command: buildProofCommand(process.execPath, PROOF_HARNESS_PATH, ...proofArgs(fixture)),
      exit_code: 0, status: "completed", aggregated_output: `${JSON.stringify(receipt)}\n`,
    } },
    { type: "item.completed", item: { type: "agent_message", text: "self-report is supplemental only" } },
    { type: "turn.completed" },
  ];
}

test("exec JSONL requires one exact trusted proof-harness command and receipt", async () => {
  const fixture = await traceFixture();
  try {
    const result = await parseExecJsonl(events(fixture).map(JSON.stringify).join("\n"), {
      ...fixture,
    });
    assert.deepEqual(result, {
      completed: true,
      proofHarness: true,
      selectedSkill: "orchestrate-game-design-career",
      routeReceipt: {
        schemaVersion: 1,
        requestSha256: fixture.requestSha256,
        bindingNonce: fixture.bindingNonce,
        routeId: "entry-intake",
        loadedInstruction: {
          relativePath: "skills/orchestrate-game-design-career/SKILL.md",
          sha256: fixture.skillSha256,
        },
      },
    });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("exec JSONL accepts the exact command inside the current shell wrapper", async () => {
  const fixture = await traceFixture();
  try {
    // A host with no trusted shell cannot wrap a command in one. The rejection half of this pair — an
    // untrusted `sh` is refused — runs everywhere, including there, and is the half that guards anything.
    if (fixture.trustedShellPaths.length === 0) return;
    const source = events(fixture);
    source[2].item.command = `${fixture.trustedShellPaths[0]} -lc ${JSON.stringify(source[2].item.command)}`;
    const result = await parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture });
    assert.equal(result.routeReceipt.routeId, "entry-intake");
    assert.equal(result.selectedSkill, "orchestrate-game-design-career");
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("forged printf output cannot impersonate installed-skill and validator execution", async () => {
  const fixture = await traceFixture();
  try {
    const source = events(fixture);
    source[2].item.command = `printf forged ${PROOF_HARNESS_PATH} ${fixture.skillPath} ${fixture.validatorPath} ${fixture.artifactPath}`;
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("workspace prover transient overwrite and restore cannot preserve trust", async () => {
  const fixture = await traceFixture();
  try {
    const original = await readFile(fixture.workspaceProver);
    await writeFile(fixture.workspaceProver, "forged prover\n");
    await writeFile(fixture.workspaceProver, original);
    const source = events(fixture);
    source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, fixture.workspaceProver);
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("an arbitrary executable named sh cannot impersonate a trusted shell wrapper", async () => {
  const fixture = await traceFixture();
  try {
    const fakeShell = path.join(fixture.root, "attacker/sh");
    await mkdir(path.dirname(fakeShell), { recursive: true });
    await writeFile(fakeShell, "#!/bin/sh\n", { mode: 0o700 });
    const source = events(fixture);
    source[2].item.command = `${fakeShell} -lc ${JSON.stringify(source[2].item.command)}`;
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness accepts one request- and nonce-bound installed route receipt", async () => {
  const fixture = await traceFixture();
  try {
    const result = await runMarketplaceProof(proofArgs(fixture), { bindingNonce: fixture.bindingNonce });
    assert.equal(result.routeReceipt.routeId, "entry-intake");
    assert.equal(result.routeReceipt.loadedInstruction.sha256, fixture.skillSha256);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const [mutation, expected] of [
  ["missing", /route receipt unavailable/u],
  ["wrong-request", /route receipt request-mismatch/u],
  ["wrong-nonce", /route receipt nonce-mismatch/u],
  ["null-route", /route receipt selected-route-mismatch/u],
  ["unknown-route", /route receipt selected-route-mismatch/u],
  ["extra-field", /route receipt contract-mismatch/u],
]) {
  test(`proof harness rejects the exact ${mutation} route receipt mutation`, async () => {
    const fixture = await traceFixture();
    try {
      const receiptPath = path.join(fixture.artifactPath, "route-receipt.json");
      const valid = JSON.parse(await readFile(receiptPath, "utf8"));
      if (mutation === "missing") await rm(receiptPath);
      else {
        if (mutation === "wrong-request") valid.requestSha256 = "0".repeat(64);
        if (mutation === "wrong-nonce") valid.bindingNonce = "b".repeat(64);
        if (mutation === "null-route") valid.routeId = null;
        if (mutation === "unknown-route") valid.routeId = "not-installed";
        if (mutation === "extra-field") valid.loadedInstruction = {};
        await writeFile(receiptPath, JSON.stringify(valid));
      }
      await assert.rejects(
        runMarketplaceProof(proofArgs(fixture), { bindingNonce: fixture.bindingNonce }),
        expected,
        mutation,
      );
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

test("proof harness rejects artifact file mutation performed by the validator", async () => {
  const fixture = await traceFixture();
  try {
    const contentPath = path.join(fixture.artifactPath, "content.md");
    await writeFile(contentPath, "A\n");
    await writeFile(fixture.validatorPath, [
      'import { writeFile } from "node:fs/promises";',
      `await writeFile(${JSON.stringify(contentPath)}, "B\\n");`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] }, null, 2));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness rejects a structural hash-stream collision", async () => {
  const fixture = await traceFixture();
  try {
    const firstPath = path.join(fixture.artifactPath, "a");
    const secondPath = path.join(fixture.artifactPath, "b");
    await writeFile(firstPath, "A");
    await writeFile(secondPath, "B");
    const secondMode = (await lstat(secondPath)).mode;
    const forgedSuffix = `${JSON.stringify(["b", secondMode, "file"])}B`;
    await writeFile(fixture.validatorPath, [
      'import { rm, writeFile } from "node:fs/promises";',
      `await writeFile(${JSON.stringify(firstPath)}, ${JSON.stringify(`A${forgedSuffix}`)});`,
      `await rm(${JSON.stringify(secondPath)});`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["a"], requestedFormats: ["md"] }));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness rejects delete and recreate with identical bytes and mode", async () => {
  const fixture = await traceFixture();
  try {
    const contentPath = path.join(fixture.artifactPath, "content.md");
    await writeFile(contentPath, "same bytes\n");
    const permissions = (await lstat(contentPath)).mode & 0o777;
    await writeFile(fixture.validatorPath, [
      'import { readFile, rm, writeFile } from "node:fs/promises";',
      `const bytes = await readFile(${JSON.stringify(contentPath)});`,
      `await rm(${JSON.stringify(contentPath)});`,
      `await writeFile(${JSON.stringify(contentPath)}, bytes, { mode: ${permissions} });`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] }));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const invalid of ["prose", "array", "trailing-malformed", "duplicate-receipt"]) {
  test(`proof harness rejects ${invalid} output`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      if (invalid === "prose") source[2].item.aggregated_output = `noise\n${source[2].item.aggregated_output}`;
      if (invalid === "array") source[2].item.aggregated_output += "[]\n";
      if (invalid === "trailing-malformed") source[2].item.aggregated_output += "{\n";
      if (invalid === "duplicate-receipt") source[2].item.aggregated_output += source[2].item.aggregated_output;
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

test("echo-only completed turn is unverifiable", async () => {
  const fixture = await traceFixture();
  try {
    const echoOnly = [
      { type: "item.completed", item: { type: "command_execution", command: `echo ${fixture.skillPath}`, exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { type: "agent_message", text: `SKILL_PROVENANCE=${fixture.skillPath}\nARTIFACT_PATH=${fixture.artifactPath}` } },
      { type: "turn.completed" },
    ];
    await assert.rejects(parseExecJsonl(echoOnly.map(JSON.stringify).join("\n"), {
      ...fixture,
    }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const mutation of ["missing-route-receipt", "wrong-route-request", "wrong-route-skill", "wrong-route-hash"]) {
  test(`proof trace rejects ${mutation}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      const receipt = JSON.parse(source[2].item.aggregated_output);
      if (mutation === "missing-route-receipt") delete receipt.routeReceipt;
      if (mutation === "wrong-route-request") receipt.routeReceipt.requestSha256 = "0".repeat(64);
      if (mutation === "wrong-route-skill") receipt.routeReceipt.loadedInstruction.relativePath = "skills/map-game-design-career/SKILL.md";
      if (mutation === "wrong-route-hash") receipt.routeReceipt.loadedInstruction.sha256 = "0".repeat(64);
      source[2].item.aggregated_output = `${JSON.stringify(receipt)}\n`;
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

for (const mutation of [
  "missing-proof", "failed-proof", "wrong-skill-hash", "prefix-trick", "extra-arg", "separator",
  "redirection", "workspace-proof", "wrong-proof-identity",
  "symlink-skill", "symlink-validator", "symlink-artifact", "outside-artifact", "modified-skill", "modified-validator",
]) {
  test(`proof trace rejects ${mutation}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      if (mutation === "missing-proof") source.splice(2, 1);
      if (mutation === "failed-proof") source[2].item.exit_code = 1;
      if (mutation === "wrong-skill-hash") source[2].item.aggregated_output = source[2].item.aggregated_output.replace(fixture.skillSha256, "0".repeat(64));
      if (mutation === "prefix-trick") source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, `${PROOF_HARNESS_PATH}-suffix`);
      if (mutation === "extra-arg") source[2].item.command += " extra";
      if (mutation === "separator") source[2].item.command += " ; printf forged";
      if (mutation === "redirection") source[2].item.command += " > receipt.json";
      if (mutation === "workspace-proof") source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, fixture.workspaceProver);
      if (mutation === "wrong-proof-identity") fixture.proofIdentity = { ...fixture.proofIdentity, sha256: "0".repeat(64) };
      if (mutation === "modified-skill") await writeFile(fixture.skillPath, "modified skill\n");
      if (mutation === "modified-validator") await writeFile(fixture.validatorPath, "modified validator\n");
      if (mutation === "symlink-skill" || mutation === "symlink-validator") {
        const target = mutation === "symlink-skill" ? fixture.skillPath : fixture.validatorPath;
        const real = `${target}.real`;
        await writeFile(real, "fixture\n");
        await rm(target);
        await symlink(real, target);
      }
      if (mutation === "symlink-artifact") {
        const real = `${fixture.artifactPath}.real`;
        await mkdir(real);
        await rm(fixture.artifactPath, { recursive: true });
        await symlink(real, fixture.artifactPath);
      }
      if (mutation === "outside-artifact") {
        fixture.artifactPath = path.join(fixture.root, "outside-artifact");
        await mkdir(fixture.artifactPath);
      }
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), {
        ...fixture,
      }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

const cliContext = {
  repoRoot: "/repo",
  productName: product,
  cacheRoot: "/temp/cache/game-design-career/0.1.1",
  expectedVersion: "0.1.1",
};
// The validator compares the host's reported plugin path against path.join(repoRoot, ...), which is
// right: on a real host both sides come from that host. The fixture has to be built the same way, or
// it only matches on platforms whose separator happens to be the one written here.
const cliSamples = {
  marketplaceAdd: { marketplaceName: "game-design-suite", installedRoot: "/repo", alreadyAdded: false },
  pluginAdd: { pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.1", installedPath: cliContext.cacheRoot, authPolicy: "ON_USE" },
  pluginList: { installed: [{ pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.1", installed: true, enabled: true, source: { source: "local", path: path.join(cliContext.repoRoot, "plugins", product) }, marketplaceSource: { sourceType: "local", source: "/repo" }, installPolicy: "AVAILABLE", authPolicy: "ON_USE" }], available: [] },
  pluginRemove: { pluginId, name: product, marketplaceName: "game-design-suite" },
  marketplaceRemove: { marketplaceName: "game-design-suite", installedRoot: null },
  marketplaceList: { marketplaces: [] },
};

for (const [kind, sample] of Object.entries(cliSamples)) {
  test(`${kind} accepts only the exact current CLI JSON contract`, () => {
    assert.doesNotThrow(() => validateCliJson(kind, structuredClone(sample), cliContext));
    const missing = structuredClone(sample);
    delete missing[Object.keys(missing)[0]];
    assert.throws(() => validateCliJson(kind, missing, cliContext), /contract mismatch/u);
    assert.throws(() => validateCliJson(kind, { ...structuredClone(sample), unknown: true }, cliContext), /contract mismatch/u);
    const mutated = structuredClone(sample);
    const key = Object.keys(mutated).find((candidate) => typeof mutated[candidate] === "string");
    if (key) mutated[key] = "mutated";
    else if (kind === "pluginList") mutated.installed[0].enabled = false;
    else mutated.marketplaces = [{}];
    assert.throws(() => validateCliJson(kind, mutated, cliContext), /contract mismatch/u);
  });
}

test("marketplace version preflight requires matching release manifests", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-version-"));
  const sourceManifest = path.join(root, "products", product, "plugin", ".codex-plugin", "plugin.json");
  const snapshotManifest = path.join(root, "plugins", product, ".codex-plugin", "plugin.json");
  try {
    await Promise.all([mkdir(path.dirname(sourceManifest), { recursive: true }), mkdir(path.dirname(snapshotManifest), { recursive: true })]);
    const manifest = JSON.parse(await readFile(path.join("products", product, "plugin", ".codex-plugin", "plugin.json"), "utf8"));
    await Promise.all([
      writeFile(sourceManifest, JSON.stringify(manifest)),
      writeFile(snapshotManifest, JSON.stringify(manifest)),
    ]);
    // 릴리스 상수에 묶는다. 버전을 올릴 때마다 이 fixture를 손으로 따라 옮기던 자리다.
    assert.equal(await resolveExpectedPluginVersion({ repoRoot: root, productName: product }), marketplaceSmoke.RELEASE_PLUGIN_VERSION);
    const missingDescription = structuredClone(manifest); delete missingDescription.description;
    await writeFile(sourceManifest, JSON.stringify(missingDescription));
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
    const wrongAuthor = structuredClone(manifest); wrongAuthor.author = "not-an-object";
    await writeFile(sourceManifest, JSON.stringify(wrongAuthor));
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
    await writeFile(sourceManifest, JSON.stringify(manifest));
    const missingPrompt = structuredClone(manifest); delete missingPrompt.interface.defaultPrompt;
    await writeFile(snapshotManifest, JSON.stringify(missingPrompt));
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
    await writeFile(snapshotManifest, "{");
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
    await rm(snapshotManifest);
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
    await writeFile(snapshotManifest, JSON.stringify({ name: product, version: "0.1.1" }));
    await writeFile(sourceManifest, JSON.stringify({ name: product, version: "0.1.2" }));
    await assert.rejects(resolveExpectedPluginVersion({ repoRoot: root, productName: product }), /marketplace version preflight failed/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("marketplace preflight rejects a corrupt product manifest before executable lookup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-preflight-"));
  let executableLookups = 0;
  try {
    for (const productName of ["game-design-career", "game-design-studio"]) {
      const manifest = JSON.parse(await readFile(path.join("products", productName, "plugin", ".codex-plugin", "plugin.json"), "utf8"));
      for (const relative of [
        path.join("products", productName, "plugin", ".codex-plugin", "plugin.json"),
        path.join("plugins", productName, ".codex-plugin", "plugin.json"),
      ]) {
        const target = path.join(root, relative);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(manifest));
      }
    }
    const corrupt = JSON.parse(await readFile(path.join(root, "products", "game-design-career", "plugin", ".codex-plugin", "plugin.json"), "utf8"));
    delete corrupt.interface;
    await writeFile(path.join(root, "products", "game-design-career", "plugin", ".codex-plugin", "plugin.json"), JSON.stringify(corrupt));
    const result = await marketplaceSmoke.runMarketplaceSmoke({
      repoRoot: root,
      tempParent: root,
      findExecutableImpl: () => { executableLookups += 1; throw new Error("executable lookup must not run"); },
    });
    assert.equal(result.status, "INCOMPLETE");
    assert.deepEqual(result.failure, { code: "command-failed", product: null, stage: "command" });
    assert.equal(executableLookups, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("marketplace validator rejects a previous installed plugin version", () => {
  const stale = structuredClone(cliSamples.pluginAdd);
  stale.version = "0.1.0";
  assert.throws(() => validateCliJson("pluginAdd", stale, cliContext), /contract mismatch/u);
});

test("local session auth is copied as an opaque regular 0600 file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auth-bridge-"));
  const source = path.join(root, "source-auth.json");
  const destination = path.join(root, "temp-home/auth.json");
  try {
    await writeFile(source, "dummy-secret-that-must-not-be-reported\n", { mode: 0o600 });
    assert.deepEqual(await bridgeLocalAuth({ source, destination }), { authSource: "local-session" });
    const stats = await lstat(destination);
    assert.equal(stats.isFile(), true);
    if (PERMISSION_BITS_MEANINGFUL) assert.equal(stats.mode & 0o777, 0o600);
    assert.equal(await readFile(destination, "utf8"), "dummy-secret-that-must-not-be-reported\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("failure redaction never reports environment secret material", () => {
  const secret = "DUMMY_CREDENTIAL_MATERIAL_NEVER_LOG";
  const redacted = redactFailure(`401 Unauthorized ${secret}`, { OPENAI_API_KEY: secret });
  assert.equal(redacted, "authentication failed (401)");
  assert.doesNotMatch(redacted, /DUMMY_CREDENTIAL|NEVER_LOG|OPENAI_API_KEY/u);
});

test("marketplace smoke failure receipts expose only exact safe code, product, and stage", () => {
  const cases = [
    [new Error("spawnSync codex ETIMEDOUT"), { code: "natural-language-exec-timeout", product: "game-design-studio", stage: "natural-language-exec" }],
    [new Error("codex exec unverifiable: route receipt mismatch"), { code: "route-receipt-mismatch", product: "game-design-career", stage: "route-receipt" }],
    [new Error("game-design-career artifact validation failed"), { code: "artifact-validation-failed", product: "game-design-career", stage: "artifact-validation" }],
    [new Error("game-design-studio cache mismatch"), { code: "plugin-package-invalid", product: "game-design-studio", stage: "plugin-package" }],
    [new Error("representative routing receipt contract mismatch"), { code: "representative-routing-receipt-invalid", product: "game-design-career", stage: "route-receipt" }],
    [new Error("representative routing product contract mismatch"), { code: "representative-routing-product-invalid", product: "game-design-career", stage: "route-receipt" }],
    [new Error("representative routing skill contract mismatch"), { code: "representative-routing-skill-invalid", product: "game-design-career", stage: "route-receipt" }],
    [new Error("scenario route selection mismatch"), { code: "route-selection-mismatch", product: "game-design-career", stage: "route-receipt" }],
    [new Error("representative role evidence contract mismatch"), { code: "representative-role-evidence-invalid", product: "game-design-career", stage: "route-receipt" }],
  ];
  for (const [error, expected] of cases) {
    assert.deepEqual(createSmokeFailure(error, { product: expected.product, stage: expected.stage }), expected);
  }
  const receipt = createSmokeFailure(new Error("/private/secret/token=never"), {
    product: "game-design-studio",
    stage: "plugin-install",
  });
  assert.deepEqual(receipt, { code: "plugin-install-failed", product: "game-design-studio", stage: "plugin-install" });
  assert.equal(JSON.stringify(receipt).includes("secret"), false);
});

test("artifact absence is detected before route receipt inspection", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-artifact-stage-"));
  try {
    await assert.rejects(assertArtifactDirectory(path.join(root, "missing")), /artifact missing/u);
    const regularFile = path.join(root, "artifact.txt");
    await writeFile(regularFile, "not a directory\n");
    await assert.rejects(assertArtifactDirectory(regularFile), /artifact missing/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("cleanup failure never overwrites the primary cause while state drift remains authoritative", () => {
  const primary = { code: "artifact-validation-failed", product: "game-design-studio", stage: "artifact-validation" };
  const cleanup = { code: "temporary-cleanup-failed", product: null, stage: "temporary-cleanup" };
  const stateDrift = { code: "production-state-changed", product: null, stage: "production-state" };

  assert.deepEqual(preservePrimarySmokeFailure(primary, cleanup), primary);
  assert.deepEqual(preservePrimarySmokeFailure(null, cleanup), cleanup);
  assert.deepEqual(preservePrimarySmokeFailure(primary, stateDrift, { override: true }), stateDrift);
});

test("artifact validation exposes only allowlisted diagnostic codes", () => {
  const output = JSON.stringify({ ok: false, requestedFormats: ["md"], errors: [
    { code: "artifact.required_file", message: "/private/secret.md TOKEN=never" },
    { code: "../escape", message: "ignored" },
    { code: "artifact.required_file", message: "duplicate" },
  ] });
  assert.throws(() => runArtifactValidation("validator", "artifact", {
    execute: () => ({ status: 1, stdout: output, stderr: "" }),
  }), (error) => {
    assert.deepEqual(error.diagnosticCodes, ["artifact.required_file"]);
    assert.doesNotMatch(JSON.stringify(error.diagnosticCodes), /secret|private|TOKEN/u);
    return true;
  });
  assert.throws(() => runArtifactValidation("validator", "artifact", {
    execute: () => ({ status: 1, stdout: "not-json", stderr: "" }),
  }), /invalid JSON/u);
});

test("failure redaction makes authentication-path failures generic", () => {
  assert.equal(
    redactFailure("command exited 1: unable to access /Users/example/.codex/auth.json", {}),
    "command failed (details redacted)",
  );
  assert.equal(
    redactFailure("unable to access C:\\Users\\example\\.codex\\auth.json", {}),
    "command failed (details redacted)",
  );
});

test("failure redaction replaces HOME, CODEX_HOME, and arbitrary encoded absolute paths", () => {
  const environment = {
    HOME: "/Users/게임 사용자",
    CODEX_HOME: "/Users/게임 사용자/Codex Home",
  };
  assert.equal(redactFailure(
    "failed at /Users/게임 사용자/Codex Home/plugins/cache; temp=/tmp/%EA%B2%8C%EC%9E%84%20%EA%B8%B0%ED%9A%8D/file.md; win=C:\\work space\\file.md",
    environment,
  ), "command failed (details redacted)");
});

test("failure redaction removes bracket-leading Korean POSIX paths and encoded user paths", () => {
  assert.equal(redactFailure(
    "failed [/tmp/게임 경로/file.md] and %2FUsers%2Fexample%2Fprivate%2Fplan.md",
    {},
  ), "command failed (details redacted)");
});

test("failure redaction makes credential-shaped failures generic", () => {
  for (const message of [
    "Authorization: Basic ZHVtbXk6c2VjcmV0",
    "Authorization Basic ZHVtbXk6c2VjcmV0",
    "request failed secret=dummy-private-value",
    "request failed password=dummy-private-value",
  ]) {
    assert.equal(redactFailure(message, {}), "command failed (details redacted)");
  }
});

test("failure redaction removes UNC paths", () => {
  assert.equal(redactFailure("failed at \\\\server\\share\\private\\file.md", {}), "command failed (details redacted)");
});

test("failure redaction is fail-closed for all non-allowlisted details", () => {
  for (const message of [
    "Cookie: session=dummy-private-value",
    "Auth: Basic dummy-private-value",
    "credential=dummy-private-value",
    "secret=dummy-private-value",
    "password=dummy-private-value",
    "/tmp/private/file.md",
    "C:\\private\\file.md",
    "file:///Users/example/private.md",
    "%252FUsers%252Fexample%252Fprivate.md",
    "ordinary command failure with internal details",
  ]) {
    assert.equal(redactFailure(message, {}), "command failed (details redacted)");
  }
  assert.equal(redactFailure("turn.failed: private detail", {}), "codex turn failed");
});
