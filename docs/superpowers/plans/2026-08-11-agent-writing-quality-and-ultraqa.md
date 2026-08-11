# Agent, Writing Quality, Sample Results, and UltraQA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add only evidence-backed game-design review roles, introduce a portable Korean game-design writing polish skill and agent, connect all 18 README prompts to sample results, verify the image path, and complete adversarial UltraQA.

**Architecture:** Product source remains under `products/*/plugin` and shared deterministic validation remains under `shared/`. Studio gains two domain review roles; both products gain one writing specialist and one direct writing-polish skill. README sample results are standalone guide artifacts bound to production prompt IDs. Generated `plugins/*` trees are rebuilt, never edited by hand.

**Tech Stack:** Markdown skills and agents, JSON routing registries, Node.js ESM validators and tests, repository snapshot builder, Codex plugin manifests, UltraQA state and temporary harnesses.

## Global Constraints

- Do not copy BUG-specific assumptions, Steam promises, fixed team sizes, playtime, currency counts, shop counts, Higgsfield routing, or project-specific scores.
- Review agents return findings and minimum repairs; they do not rewrite source artifacts or grant approval.
- Preserve the three-reviewer bound for one review stage. The writing specialist runs as a separate direct skill stage.
- Preserve facts, numbers, dates, identifiers, links, tables, file paths, fact/inference/recommendation boundaries, and approval states during writing polish.
- `IMAGE_GEN_MODE=prompt-only`, `IMAGE_MODEL=gpt-image-2`, and `IMAGE_QUALITY=low` remain the defaults.
- A non-empty `OPENAI_API_KEY` means OpenAI only; failures never fall back to Codex.
- No live image call in default QA. Live smoke remains explicit and credential-gated.
- Human review is required for document, image, production, publication, hiring, and release decisions.

---

### Task 1: Lock the selective agent-adoption contract

**Files:**
- Modify: `tests/products/studio/roles.test.mjs`
- Modify: `tests/products/studio/orchestrator.test.mjs`
- Modify: `tests/contracts/package-contents.test.mjs`

**Interfaces:**
- Consumes: current Studio `routing.json`, role finding schema, three-reviewer bound.
- Produces: failing contracts for `combat-encounter-reviewer`, `level-puzzle-reviewer`, and no copied BUG constraints.

- [ ] **Step 1: Write failing role inventory tests**

Assert that Studio `roleIds` and `rolePriority` include the two new domain roles. Assert Career does not contain the two Studio roles. The separate `writingSpecialistIds` contract belongs to Task 3 so Task 2 can reach GREEN without implementing Task 4 early.

- [ ] **Step 2: Write failing behavior tests**

Add fixtures requiring the combat role to inspect telegraph, counterplay, recovery, dominant combinations, and boss trivialization. Add level/puzzle fixtures requiring mandatory/optional paths, feedback, reset/retry, soft lock, hard progression block, and accessibility alternatives.

- [ ] **Step 3: Write mutation guards**

Reject copied terms `BUG`, `V1`, `4-8 person`, `8-12 hour`, `three currencies`, `three shops`, `Higgsfield`, and automatic approval language.

- [ ] **Step 4: Run RED tests**

Run:

```bash
node --test \
  tests/products/studio/roles.test.mjs \
  tests/products/studio/orchestrator.test.mjs \
  tests/contracts/package-contents.test.mjs
```

Expected: failures for missing roles, routing, and new package counts.

- [ ] **Step 5: Commit RED contracts**

```bash
git add tests/products/studio/roles.test.mjs \
  tests/products/studio/orchestrator.test.mjs \
  tests/contracts/package-contents.test.mjs
git commit -m "test: define selective game design review roles"
```

### Task 2: Implement the two Studio domain reviewers and routing

**Files:**
- Create: `products/game-design-studio/plugin/agents/combat-encounter-reviewer.md`
- Create: `products/game-design-studio/plugin/agents/level-puzzle-reviewer.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/workflow.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/merge-role-findings.mjs`
- Modify: `products/game-design-studio/plugin/skills/design-game-content/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/review-game-design/SKILL.md`
- Modify: `products/game-design-studio/plugin/agents/lead-game-designer.md`
- Modify: `products/game-design-studio/plugin/agents/system-economy-designer.md`
- Modify: `products/game-design-studio/plugin/agents/production-feasibility-critic.md`
- Modify: `products/game-design-studio/plugin/agents/art-brief-director.md`

**Interfaces:**
- Consumes: Task 1 role contracts.
- Produces: two findings-only roles selected only for matching intent/profile, plus minimal useful questions absorbed into existing roles.

- [ ] **Step 1: Add the combat reviewer**

Use the existing Studio finding schema. Set `applicableGate` to `none`, prohibit blocker severity, invented balance values, invented playtest evidence, whole-artifact rewrites, and approval changes.

- [ ] **Step 2: Add the level/puzzle reviewer**

Use the same schema and authority limits. Require stable level, puzzle, rule, gate, reward, path, feedback, reset, retry, recovery, and accessibility evidence or explicit gap records.

- [ ] **Step 3: Add conditional routing**

Extend content intents with combat, boss, encounter, puzzle, level design, soft lock, secret route, reset, and retry. Select the matching role without exceeding three reviewers.

- [ ] **Step 4: Update deterministic merge authority**

Allow both roles in routing order but omit them from blocker authority. Any `blocker` emitted by either role must fail closed.

- [ ] **Step 5: Absorb only non-duplicated candidate questions**

Add alternative/tradeoff checks to `lead-game-designer`, build/reselection/grind/inventory-friction checks to `system-economy-designer`, strongest-counterargument/tooling/test-seam/low-complexity checks to `production-feasibility-critic`, and visual style anchors to `art-brief-director`.

- [ ] **Step 6: Run GREEN tests and commit**

Run `tests/products/studio/roles.test.mjs` and `tests/products/studio/orchestrator.test.mjs` to GREEN and commit the product source changes. The generated-package count contract remains intentionally RED until Task 8 runs the standard build; Task 8 must make `tests/contracts/package-contents.test.mjs` GREEN.

### Task 3: Define the writing-polish skill with RED preservation tests

**Files:**
- Create: `tests/unit/writing-revision.test.mjs`
- Create: `tests/products/studio/writing-quality.test.mjs`
- Create: `tests/products/career/writing-quality.test.mjs`

**Interfaces:**
- Consumes: raw and revised Markdown strings plus product skill/agent registries.
- Produces: failing tests for protected-content preservation, human-readable Korean, direct skill discovery, and no approval mutation.

- [ ] **Step 1: Add preservation fixtures**

Include Korean prose with code spans, stable IDs, numeric values and units, Markdown links, tables, paths, URLs, `fact/inference/recommendation`, named gate states, and a prompt-injection sentence inside the document.

- [ ] **Step 2: Add positive style fixture**

Require a revised document to replace translation-like and machine-like prose without changing protected values.

- [ ] **Step 3: Add hostile mutations**

Reject changed numbers, IDs, links, table rows, paths, approval states, removed uncertainty, invented evidence, and `approved` substituted for `pending` or `blocked`.

- [ ] **Step 4: Add product discovery contracts**

Require `polish-game-design-writing`, `game-design-writing-editor`, `writingSpecialistIds` containing only that specialist, the direct command, output files, and a host `humanize-korean` optional path with a bundled fallback.

- [ ] **Step 5: Run RED tests and commit**

Run the three new test files. Expected: missing module, skill, agent, and registry failures.

### Task 4: Implement the writing validator, skill, and specialist

**Files:**
- Create: `shared/scripts/validate-writing-revision.mjs`
- Create: `shared/document-quality/game-design-writing-style.md`
- Create: `products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/polish-game-design-writing/agents/openai.yaml`
- Create: `products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md`
- Create: `products/game-design-career/plugin/skills/polish-game-design-writing/agents/openai.yaml`
- Create: `products/game-design-studio/plugin/agents/game-design-writing-editor.md`
- Create: `products/game-design-career/plugin/agents/game-design-writing-editor.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/career-stages.json`
- Modify: both product orchestrator `SKILL.md` files

**Interfaces:**
- Consumes: before/after Markdown, optional host `humanize-korean`, bundled style rules.
- Produces: separate revised draft, findings file, protected-content receipt, human-review handoff.

- [ ] **Step 1: Implement protected-content capture**

Capture and compare code spans, URLs, Markdown destinations, stable IDs, numeric tokens with units, table rows, explicit file paths, fact/inference/recommendation labels, and gate states. Reject control characters, non-NFC identifiers, prototype data, and path traversal.

- [ ] **Step 2: Implement product skill contracts**

Describe the exact sequence: lock protected content, diagnose, revise minimally, validate, return changed draft and receipt, wait for human review. Do not modify the canonical source in place.

- [ ] **Step 3: Implement the writing specialist**

The agent reports awkward phrases, context breaks, unexplained code terms, and minimum repairs. It cannot verify truth, invent evidence, change approval, or overwrite the document.

- [ ] **Step 4: Add direct routing and orchestrator placement**

Run writing polish after content/domain review and before export. Keep it outside the primary three-role stage as a dedicated specialist pass.

- [ ] **Step 5: Validate skill metadata**

Run the installed skill validator against both skill folders and the Task 3 tests.

- [ ] **Step 6: Commit GREEN implementation**

Commit shared validator, both product skills, agents, and routing updates.

### Task 5: Add 18 source-bound Sample result documents

**Files:**
- Create: `guides/sample-results/README.md`
- Create: `guides/sample-results/studio/*.md` for 7 representative Studio cases
- Create: `guides/sample-results/career/*.md` for 7 representative Career cases
- Create: `guides/sample-results/suite/*.md` for 4 Suite cases
- Create: `tests/contracts/readme-sample-results.test.mjs`
- Modify: `README.md`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: the exact 18 `data-prompt-id` cards and production prompt catalog.
- Produces: one sample result per card and a visible README link.

- [ ] **Step 1: Write RED sample binding tests**

Require exact 18 IDs, regular non-symlink Markdown files, unique paths, source prompt ID, route, protected assumptions, artifact list, human review state, and no outcome guarantee.

- [ ] **Step 2: Author Studio samples**

Use one clearly fictional project and vary the actual deliverable: vision brief, loop/system spec, rule/exception matrix, UX flow, content spec, economy/LiveOps plan, production scope review.

- [ ] **Step 3: Author Career samples**

Use fictional candidate data and separate role exploration, 12-week evidence plan, reverse design, creative portfolio, five-axis review, interview/growth, and full path planning.

- [ ] **Step 4: Author Suite samples**

Cover public handoff, project-to-interview evidence, image/presentation preparation, and failed derivative resume.

- [ ] **Step 5: Link every README card**

Add a `Sample 결과 보기` field and keep the simple natural-language request first. Advanced App/CLI templates remain collapsible.

- [ ] **Step 6: Run contracts and commit**

Run the new sample test and root README contract.

### Task 6: Audit and improve the remaining product documentation

**Files:**
- Create: `tooling/audit-game-design-docs.mjs`
- Create: `tests/unit/audit-game-design-docs.test.mjs`
- Create: `guides/reviews/2026-08-11-document-language-audit.md`
- Modify: user-facing Korean labels and instructions under `shared/templates` and `products/*/plugin/assets/templates`
- Modify: `tooling/lib/prompt-template-catalog.mjs`
- Modify: `tooling/lib/prompt-guides.mjs`
- Modify: prompt catalog sources under `guides/prompt-templates/catalog/*.json`
- Modify: source Markdown files reported as high-severity under `products/*/plugin`, `shared`, `guides`, and root `README.md`
- Modify: `shared/knowledge/trends/2026-current-practices.md`
- Modify: `shared/knowledge/trends/source-register.json`

**Interfaces:**
- Consumes: source-of-truth documentation inventory and the game-design writing style rules.
- Produces: deterministic audit report, Korean-first result templates, beginner-readable prompt cards, high-severity corrections, and current-practice evidence updates.

- [ ] **Step 1: Write RED audit tests**

Test translation-like passive forms, unsupported hype, unexplained English-first labels, repeated conclusion phrases, generated-snapshot exclusion, and standard game terms such as UX, UI, LiveOps, API, prompt, token remaining allowed.

- [ ] **Step 2: Scan all source documents**

Record each inspected file and issue count. Do not treat generated `plugins/*`, vendor files, or copied source documents as authoring roots.

- [ ] **Step 3: Localize the actual result templates**

Convert the user-facing headings, guidance, table labels, and review instructions in the shared and product artifact templates to Korean-first wording. Preserve canonical file names, IDs, YAML/JSON keys, Markdown structure, and standard terms such as UX, UI, LiveOps, API, prompt, and token. Add behavior tests that render representative Studio and Career artifacts and verify that the resulting `content.md`, `decisions/README.md`, and `assets/README.md` are understandable without reading the English schema.

- [ ] **Step 4: Split prompt cards into simple and advanced views**

Extend the prompt catalog and renderer with a beginner-facing view containing one natural-language request, a short Korean workflow explanation, and a concrete sample-result excerpt. Keep exact skill IDs, CLI commands, safety contracts, and recovery receipts under a collapsed advanced section. Do not replace stable IDs or code fields with translated aliases.

- [ ] **Step 5: Fix only high-value source issues**

Use `humanize-korean` rules conservatively. Preserve facts, citations, IDs, code, links, and document genre. Record why other files were left unchanged.

- [ ] **Step 6: Refresh current practices**

Add or reverify official evidence for playtesting, Xbox accessibility, LiveOps event entry/recovery, Steam Early Access claims, economy/loot-box disclosure, UGC moderation, and student portfolio boundaries. Store verification date, review date, scope, and limitation.

- [ ] **Step 7: Rebuild generated guides and verify**

Run `npm run build:prompt-guides`, the representative artifact render tests, prompt-guide checks, and guide validation. Generated `plugins/*` output remains a later standard-build responsibility and is never edited by hand.

- [ ] **Step 8: Run the audit and commit**

Require zero unresolved high-severity issues in owned source documents.

### Task 7: Close image runtime gaps without changing provider policy

**Files:**
- Modify: `shared/scripts/generate-openai-images.mjs`
- Modify: `tests/unit/generate-openai-images.test.mjs`
- Modify: `tooling/smoke-openai-image.mjs`
- Create: `tests/unit/smoke-openai-image.test.mjs`
- Modify: `.env.example` only if the audit finds a mismatch

**Interfaces:**
- Consumes: validated config and injectable `fetchFn`.
- Produces: bounded Abort/timeout behavior and live smoke that respects redacted model/quality overrides.

- [ ] **Step 1: Write RED never-resolving fetch test**

Use a bounded test timeout. Expect Abort, an explicit failed receipt, no partial PNG, no provider fallback, and no leaked key.

- [ ] **Step 2: Implement request timeout**

Use an AbortController and a documented finite default. Preserve the retry cap and fail closed.

- [ ] **Step 3: Test live-smoke configuration wiring**

Verify that the smoke runner uses validated `IMAGE_MODEL` and `IMAGE_QUALITY` instead of hard-coded values while never printing secrets.

- [ ] **Step 4: Run image unit and product E2E tests**

Do not run a live network call.

- [ ] **Step 5: Commit the bounded runtime fix**

### Task 8: Update inventories, guides, and generated products

**Files:**
- Modify: `README.md`
- Modify: product and guide agent/skill indexes under `products/*/plugin/README.md`, `guides/game-design-*/README.md`, and `guides/game-design-*/skills/README.md`
- Modify: relevant guide contract tests
- Generate: `plugins/game-design-studio/**`
- Generate: `plugins/game-design-career/**`
- Generate: `products/*/BUILD-MANIFEST.json`

**Interfaces:**
- Consumes: completed source roles, skills, samples, and docs.
- Produces: consistent counts, links, file trees, generated snapshots, and package inventories.

- [ ] **Step 1: Update human-readable inventories**

List Korean name first, English ID in parentheses, use case, result, direct command, agent boundary, and detailed guide link.

- [ ] **Step 2: Update exact package and guide counts**

Studio: 12 agents, 15 product skills, and one packaged Skillstead skill, for 16 installed skills in total. Career: 10 agents, 15 product skills, and one packaged Skillstead skill, for 16 installed skills in total. Keep template and script counts derived from the actual build.

- [ ] **Step 3: Run the standard build**

```bash
npm run build
npm run build -- --check
```

- [ ] **Step 4: Run guide and package contracts**

Run root, product, package, guide, prompt, diagram, and Archify validation.

- [ ] **Step 5: Commit source and generated snapshots**

### Task 9: Execute UltraQA cycle 1 and diagnose failures

**Files:**
- Create: `tests/e2e/suite/natural-language-routing.e2e.test.mjs`
- Create: `tests/e2e/suite/document-writing-polish.e2e.test.mjs`
- Create: `tests/e2e/suite/interruption-resume.e2e.test.mjs`
- Create: `tests/e2e/suite/dirty-worktree-preservation.e2e.test.mjs`
- Create: `guides/reviews/2026-08-11-ultraqa-report.md`

**Interfaces:**
- Consumes: installed clean-built plugins and sample results.
- Produces: scenario matrix evidence for normal, malformed, injection, cancel/resume, stale, dirty, hung, flaky, and misleading-output paths.

- [ ] **Step 1: Materialize the required scenario matrix**

Track ID, intent, user/attacker, setup, command/harness, expected, actual, fix, evidence, and cleanup.

- [ ] **Step 2: Run baseline verification**

Run targeted tests, product E2E, build check, guide validation, suite validation, and package smoke without external writes.

- [ ] **Step 3: Run dynamic adversarial E2E**

Use temporary HOME, CODEX_HOME, workspace, isolated state, bounded child timeouts, prompt-injection sentinel, dirty-tree sentinel, repeated continue/cancel/resume, stale receipts, and false-success exits.

- [ ] **Step 4: Diagnose and fix failures**

For each product failure, record root cause, user impact, safety impact, smallest fix, and regression test. Harness setup failures are recorded separately and rerun.

- [ ] **Step 5: Clean temporary artifacts and update the report**

Verify no child process, temporary file, state, or unrelated worktree change remains.

### Task 10: Final regression, flake pass, independent review, and state cleanup

**Files:**
- Modify: `guides/reviews/2026-08-11-ultraqa-report.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: complete UltraQA evidence and a clean branch.

- [ ] **Step 1: Run targeted new tests three times**

Compare route IDs, ordered skills, role IDs, artifact files, protected-content digests, gate states, and exit codes. Do not compare prose bytes.

- [ ] **Step 2: Run complete verification**

```bash
npm run build -- --check
npm run validate:guides
npm run validate:archify-catalog
npm run check:guide-diagrams
npm run check:prompt-guides
npm run check:curated-archify
npm run validate
npm test
git diff --check
```

- [ ] **Step 3: Request independent code and documentation review**

Require Critical 0 and Important 0. Fix findings and rerun affected tests.

- [ ] **Step 4: Finalize the UltraQA report**

Include commands, exits, durations/timeouts, failures, fixes, cleanup, residual risks, and the live-image-smoke limitation.

- [ ] **Step 5: Clear UltraQA state**

```bash
omx state clear --input '{"mode":"ultraqa"}' --json
```

- [ ] **Step 6: Confirm branch cleanliness**

`git status --short` must be empty in the feature worktree. The unrelated untracked `docs/에이전트/` and `package-lock.json` in the main worktree must remain unchanged.
