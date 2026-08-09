import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  renderPromptCard,
  renderPromptLibrary,
  replaceManagedSection,
  validateRenderedPromptCard,
} from "../../tooling/lib/prompt-guides.mjs";
import { buildPromptGuides } from "../../tooling/build-prompt-guides.mjs";

function validSkillEntry({ id = "PT-001", title = "Vision prompt", product = "studio", skill = "define-game-vision" } = {}) {
  return {
    id,
    kind: "skill-template",
    product,
    title,
    purpose: "A concise purpose.",
    audiences: ["game designer"],
    intents: ["create a game vision"],
    level: "beginner",
    when_to_use: "Use when a game vision needs a first draft.",
    when_not_to_use: "Do not use for unapproved production changes.",
    required_inputs: ["target player"],
    optional_inputs: ["reference game"],
    placeholders: ["{{target_player}}"],
    app_prompt: {
      example: "@Game Design Studio create a game vision for cozy players.",
      template: "@Game Design Studio create a game vision for {{target_player}}.",
    },
    cli_prompt: {
      example: "$game-design-studio:define-game-vision create a game vision for cozy players.",
      template: "$game-design-studio:define-game-vision create a game vision for {{target_player}}.",
    },
    skill,
    skill_chain: [skill, "review-game-design"],
    specialist_roles: ["lead-game-designer"],
    intermediate_artifacts: ["vision-pillars"],
    minimum_outputs: ["game vision"],
    optional_outputs: ["decision log"],
    extended_outputs: ["review plan"],
    expected_file_tree: ["artifacts/vision/content.md"],
    read_order: ["artifacts/vision/content.md"],
    human_review_boundary: "A design lead approves the direction.",
    hold_conditions: ["Hold when target players are unknown."],
    resume_prompt: "Resume with confirmed non-sensitive target-player evidence only.",
    safety_boundary: "Leave unknown information as 미정; do not request secrets, API keys, personal data, or private materials.",
    diagram_binding: {
      id: "prompt-flow-001",
      svg: "guides/assets/prompt-flow/PT-001.svg",
      png: "guides/assets/prompt-flow/PT-001.png",
      alt: "Vision prompt flow",
    },
    related_use_cases: [],
    related_recipes: [],
    source_references: ["guides/game-design-studio/skills/define-game-vision.md"],
  };
}

function assertOrdered(value, fragments) {
  let offset = -1;
  for (const fragment of fragments) {
    const next = value.indexOf(fragment);
    assert.ok(next > offset, `expected ${JSON.stringify(fragment)} after offset ${offset}`);
    offset = next;
  }
}

async function temporaryRepo(t) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "prompt-guides-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(path.join(repoRoot, "guides", "prompt-templates"), { recursive: true });
  await mkdir(path.join(repoRoot, "products", "game-design-studio", "plugin", "references"), { recursive: true });
  await mkdir(path.join(repoRoot, "products", "game-design-career", "plugin", "references"), { recursive: true });
  return repoRoot;
}

test("renderPromptCard emits the fixed readable order and exactly five text blocks", () => {
  const markdown = renderPromptCard(validSkillEntry());

  assertOrdered(markdown, [
    "### 사용하는 경우", "### 준비 입력", "### 바꿀 자리표시자",
    "### Codex App 완성 예시", "### Codex App 재사용 템플릿",
    "### Codex CLI 완성 예시", "### Codex CLI 재사용 템플릿",
    "### 스킬·전문 역할 흐름", "### 예상 결과물",
    "### 사람 검토", "### 실패와 재개",
  ]);
  assert.equal((markdown.match(/^```text$/gmu) ?? []).length, 5);
  assert.match(markdown, /#### 최소 결과물[\s\S]*#### 선택 결과물[\s\S]*#### 확장 결과물/u);
  assert.match(markdown, /#### 승인 경계[\s\S]*#### 보류 조건[\s\S]*#### 안전 경계/u);
});

test("renderPromptCard validates five dynamically fenced text blocks", () => {
  const entry = validSkillEntry();
  entry.app_prompt.example = "@Game Design Studio keep ``` and ```` inside this prompt.";
  const markdown = renderPromptCard(entry);
  assert.match(markdown, /^`````text$/mu, "the outer fence must exceed the longest prompt fence");
  assert.doesNotThrow(() => validateRenderedPromptCard(entry, markdown));
  assert.throws(
    () => validateRenderedPromptCard(entry, markdown.replace(/^`````$/mu, "```")),
    /matching text fence/u,
  );
});

test("renderPromptLibrary keeps cards in stable product, skill, level and ID order", () => {
  const catalog = {
    entries: [
      validSkillEntry({ id: "PT-003", title: "Zed", skill: "z-skill" }),
      validSkillEntry({ id: "PT-002", title: "Alpha", skill: "a-skill" }),
      { ...validSkillEntry({ id: "PT-001", product: "career", title: "Career", skill: "career-skill" }), cli_prompt: {
        example: "$game-design-studio:define-game-vision example",
        template: "$game-design-studio:define-game-vision template",
      } },
    ],
  };

  const markdown = renderPromptLibrary(catalog);
  assertOrdered(markdown, ["PT-002", "PT-003", "PT-001"]);
});

test("managed sections require one exact ordered marker pair", () => {
  assert.throws(() => replaceManagedSection("no markers", "studio:vision", "new"), /exactly one|mismatched/u);
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:START studio:vision --><!-- PROMPT-TEMPLATES:START studio:vision --><!-- PROMPT-TEMPLATES:END studio:vision -->", "studio:vision", "new"),
    /exactly one|mismatched/u,
  );
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:END studio:vision --><!-- PROMPT-TEMPLATES:START studio:vision -->", "studio:vision", "new"),
    /ordered|mismatched/u,
  );
  assert.equal(
    replaceManagedSection("before\n<!-- PROMPT-TEMPLATES:START studio:vision -->\nstale\n<!-- PROMPT-TEMPLATES:END studio:vision -->\nafter", "studio:vision", "fresh\nbody"),
    "before\n<!-- PROMPT-TEMPLATES:START studio:vision -->\nfresh\nbody\n<!-- PROMPT-TEMPLATES:END studio:vision -->\nafter",
  );
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:START studio:vision -->\n<!-- PROMPT-TEMPLATES:END studio:other -->\n<!-- PROMPT-TEMPLATES:END studio:vision -->", "studio:vision", "fresh"),
    /mismatched/u,
  );
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:START game-design-studio:recipe:new-game-gdd -->\n<!-- PROMPT-TEMPLATES:END game-design-studio:recipe:other -->", "game-design-studio:recipe:new-game-gdd", "fresh"),
    /mismatched/u,
  );
});

test("buildPromptGuides writes all derived files only after an in-memory graph is complete and check detects byte drift", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };

  const result = await buildPromptGuides({ repoRoot, __testCatalog: catalog });
  assert.deepEqual(result, { markdown: 2, managed: 0, projections: 2, checked: false });

  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  const projectionPath = path.join(repoRoot, "products", "game-design-studio", "plugin", "references", "prompt-templates.json");
  assert.match(await readFile(libraryPath, "utf8"), /PT-001/u);
  assert.deepEqual(JSON.parse(await readFile(projectionPath, "utf8")).entries.map(({ id }) => id), ["PT-001"]);

  assert.deepEqual(await buildPromptGuides({ repoRoot, __testCatalog: catalog, check: true }), { markdown: 2, managed: 0, projections: 2, checked: true });
  await writeFile(libraryPath, "drift\n");
  await assert.rejects(
    () => buildPromptGuides({ repoRoot, __testCatalog: catalog, check: true }),
    /generated prompt guide differs/u,
  );
});

test("buildPromptGuides rejects an incomplete graph before it writes any target", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry(), validSkillEntry()] };

  await assert.rejects(
    () => buildPromptGuides({ repoRoot, __testCatalog: catalog }),
    /duplicate entry ID/u,
  );
  await assert.rejects(
    () => readFile(path.join(repoRoot, "guides", "prompt-templates", "README.md")),
    { code: "ENOENT" },
  );
});

test("buildPromptGuides rolls back every target and removes temporary paths when a promotion rename fails", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  const studioProjection = path.join(repoRoot, "products", "game-design-studio", "plugin", "references", "prompt-templates.json");
  const careerProjection = path.join(repoRoot, "products", "game-design-career", "plugin", "references", "prompt-templates.json");
  await Promise.all([
    writeFile(libraryPath, "old library\n"),
    writeFile(studioProjection, "old studio projection\n"),
    writeFile(careerProjection, "old career projection\n"),
  ]);
  let renameCount = 0;

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        beforeRename: () => {
          renameCount += 1;
          if (renameCount === 3) throw new Error("injected promotion rename failure");
        },
      },
    }),
    /injected promotion rename failure/u,
  );

  assert.equal(await readFile(libraryPath, "utf8"), "old library\n");
  assert.equal(await readFile(studioProjection, "utf8"), "old studio projection\n");
  assert.equal(await readFile(careerProjection, "utf8"), "old career projection\n");
  await assert.rejects(() => readFile(path.join(repoRoot, "guides", "prompt-templates", "studio", "define-game-vision.md")), { code: "ENOENT" });
  assert.deepEqual((await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-")), []);
  assert.deepEqual((await readdir(path.join(repoRoot, "guides", "prompt-templates"))).filter((name) => name === "studio"), []);
});

test("buildPromptGuides rejects a parent symlink swap before it can publish outside the repository", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const promptDirectory = path.join(repoRoot, "guides", "prompt-templates");
  const preservedDirectory = path.join(repoRoot, "preserved-prompt-templates");
  const outside = path.join(repoRoot, "outside");
  const studioProjection = path.join(repoRoot, "products", "game-design-studio", "plugin", "references", "prompt-templates.json");
  await writeFile(studioProjection, "old studio projection\n");
  await mkdir(outside);

  try {
    await assert.rejects(
      () => buildPromptGuides({
        repoRoot,
        __testCatalog: catalog,
        __testHooks: {
          beforePublish: async () => {
            await rename(promptDirectory, preservedDirectory);
            await symlink(outside, promptDirectory);
          },
        },
      }),
      /identity changed|symlink/u,
    );
    assert.deepEqual(await readdir(outside), []);
    assert.equal(await readFile(studioProjection, "utf8"), "old studio projection\n");
    assert.deepEqual((await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-")), []);
  } finally {
    await rm(promptDirectory, { recursive: true, force: true });
    await rename(preservedDirectory, promptDirectory).catch(() => {});
  }
});

test("buildPromptGuides revalidates after every promotion hook before a rename can escape the repository", async (t) => {
  const catalog = { entries: [validSkillEntry()] };

  for (const phase of ["backup", "publish"]) {
    await t.test(phase, async (t) => {
      const repoRoot = await temporaryRepo(t);
      const promptDirectory = path.join(repoRoot, "guides", "prompt-templates");
      const preservedDirectory = path.join(repoRoot, `preserved-${phase}`);
      const outside = await mkdtemp(path.join(os.tmpdir(), "prompt-guides-outside-"));
      const libraryPath = path.join(promptDirectory, "README.md");
      await writeFile(libraryPath, "old library\n");
      t.after(() => rm(outside, { recursive: true, force: true }));

      try {
        await assert.rejects(
          () => buildPromptGuides({
            repoRoot,
            __testCatalog: catalog,
            __testHooks: {
              beforeRename: async (operation) => {
                if (operation.phase !== phase || operation.index !== 0) return;
                await rename(promptDirectory, preservedDirectory);
                await symlink(outside, promptDirectory);
              },
            },
          }),
          (error) => /identity changed|symlink|missing/u.test(error.message)
            || error.errors?.some((item) => /identity changed|symlink|missing/u.test(item.message)),
        );
        assert.deepEqual(await readdir(outside), []);

        if (phase === "backup") {
          assert.equal(await readFile(path.join(preservedDirectory, "README.md"), "utf8"), "old library\n");
        } else {
          const [stageRoot] = (await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-"));
          assert.ok(stageRoot, "a failed recovery must retain its forensic backup");
          assert.equal(await readFile(path.join(repoRoot, stageRoot, "0.backup"), "utf8"), "old library\n");
        }
      } finally {
        await rm(promptDirectory, { recursive: true, force: true });
        await rename(preservedDirectory, promptDirectory).catch(() => {});
      }
    });
  }
});

test("buildPromptGuides fails closed when a target is replaced before publish identity validation", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  const outside = await mkdtemp(path.join(os.tmpdir(), "prompt-guides-external-replacement-"));
  const replacement = path.join(outside, "replacement.md");
  await writeFile(libraryPath, "old library\n");
  await writeFile(replacement, "external replacement\n");
  t.after(() => rm(outside, { recursive: true, force: true }));

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        afterRename: async (operation) => {
          if (operation.phase !== "publish" || operation.index !== 0) return;
          await rename(libraryPath, path.join(repoRoot, "displaced-library"));
          await rename(replacement, libraryPath);
        },
      },
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((item) => /published prompt guide identity changed/u.test(item.message))
      && error.errors.some((item) => /published target identity changed/u.test(item.message)),
  );

  assert.equal(await readFile(libraryPath, "utf8"), "external replacement\n");
  const [stageRoot] = (await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-"));
  assert.equal(await readFile(path.join(repoRoot, stageRoot, "0.backup"), "utf8"), "old library\n");
});

test("buildPromptGuides preserves a concurrently replaced validated target and its backup", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  await writeFile(libraryPath, "old library\n");

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        afterPublishValidation: async (operation) => {
          if (operation.phase !== "publish" || operation.index !== 0) return;
          await rename(libraryPath, path.join(repoRoot, "displaced-library"));
          await writeFile(libraryPath, "concurrent replacement\n");
        },
        beforeRename: (operation) => {
          if (operation.phase === "publish" && operation.index === 1) {
            throw new Error("later promotion failure");
          }
        },
      },
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((item) => /later promotion failure/u.test(item.message))
      && error.errors.some((item) => /published target identity changed/u.test(item.message)),
  );

  assert.equal(await readFile(libraryPath, "utf8"), "concurrent replacement\n");
  const [stageRoot] = (await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-"));
  assert.equal(await readFile(path.join(repoRoot, stageRoot, "0.backup"), "utf8"), "old library\n");
  await assert.rejects(() => readFile(path.join(repoRoot, "guides", "prompt-templates", "studio", "define-game-vision.md")), { code: "ENOENT" });
});

test("buildPromptGuides retains recoverable backups when target restoration fails, while removing safe empty directories", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  await writeFile(libraryPath, "old library\n");

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        beforeRename: (operation) => {
          if (operation.phase === "publish" && operation.index === 1) {
            throw new Error("original promotion failure");
          }
        },
        beforeRollbackRename: (operation) => {
          if (operation.phase === "restore" && operation.index === 0) {
            throw new Error("injected target restoration failure");
          }
        },
      },
    }),
    (error) => error instanceof AggregateError
      && error.errors.some((item) => /original promotion failure/u.test(item.message))
      && error.errors.some((item) => /target restoration failure/u.test(item.message)),
  );

  const [stageRoot] = (await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-"));
  assert.equal(await readFile(path.join(repoRoot, stageRoot, "0.backup"), "utf8"), "old library\n");
  await assert.rejects(() => readFile(libraryPath), { code: "ENOENT" });
  await assert.rejects(() => readdir(path.join(repoRoot, "guides", "prompt-templates", "studio")), { code: "ENOENT" });
});

test("buildPromptGuides removes a newly published target when a later promotion fails", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        beforeRename: (operation) => {
          if (operation.phase === "publish" && operation.index === 1) {
            throw new Error("later promotion failure");
          }
        },
      },
    }),
    /later promotion failure/u,
  );

  await assert.rejects(() => readFile(libraryPath), { code: "ENOENT" });
  assert.deepEqual((await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-")), []);
});

test("buildPromptGuides does not roll back committed targets when final stage cleanup fails", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const expectedRepoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };
  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  const generatedTargets = [
    "guides/prompt-templates/README.md",
    "guides/prompt-templates/studio/define-game-vision.md",
    "products/game-design-studio/plugin/references/prompt-templates.json",
    "products/game-design-career/plugin/references/prompt-templates.json",
  ];
  await buildPromptGuides({ repoRoot: expectedRepoRoot, __testCatalog: catalog });
  const expectedBytes = await Promise.all(generatedTargets.map((relative) => readFile(path.join(expectedRepoRoot, relative))));
  await writeFile(libraryPath, "old library\n");

  await assert.rejects(
    () => buildPromptGuides({
      repoRoot,
      __testCatalog: catalog,
      __testHooks: {
        beforeStageCleanup: () => {
          throw new Error("injected final cleanup failure");
        },
      },
    }),
    /published but stage cleanup failed/u,
  );

  for (const [index, relative] of generatedTargets.entries()) {
    assert.deepEqual(await readFile(path.join(repoRoot, relative)), expectedBytes[index], relative);
  }
  const [stageRoot] = (await readdir(repoRoot)).filter((name) => name.startsWith(".prompt-guides-"));
  assert.equal(await readFile(path.join(repoRoot, stageRoot, "0.backup"), "utf8"), "old library\n");
});
