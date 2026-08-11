# Agent, Writing Quality, Sample Results, and UltraQA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add only evidence-backed game-design review roles, introduce a portable Korean game-design writing polish skill and agent, bundle verified Skillstead and Archify diagram skills, connect all 18 README prompts to sample results, support `gpt-image-2` master-image derivatives, and complete adversarial UltraQA.

**Architecture:** Product source remains under `products/*/plugin` and shared deterministic validation remains under `shared/`. Studio gains two domain review roles; both products gain one writing specialist and one direct writing-polish skill. Official im-not-ai, Skillstead, and Archify releases are pinned as offline vendor closures and copied into both products by the standard build. README sample results are standalone guide artifacts bound to production prompt IDs. Image manifests carry master/derivative lineage before any provider call. Generated `plugins/*` trees are rebuilt, never edited by hand.

**Tech Stack:** Markdown skills and agents, JSON routing registries, Node.js ESM validators and tests, repository snapshot builder, Codex plugin manifests, UltraQA state and temporary harnesses.

## Global Constraints

- Do not copy BUG-specific assumptions, Steam promises, fixed team sizes, playtime, currency counts, shop counts, Higgsfield routing, or project-specific scores.
- Review agents return findings and minimum repairs; they do not rewrite source artifacts or grant approval.
- Preserve the three-reviewer bound for one review stage. The writing specialist runs as a separate direct skill stage.
- Preserve facts, numbers, dates, identifiers, links, tables, file paths, fact/inference/recommendation boundaries, and approval states during writing polish.
- `IMAGE_GEN_MODE=prompt-only`, `IMAGE_MODEL=gpt-image-2`, and `IMAGE_QUALITY=low` remain the defaults.
- A non-empty `OPENAI_API_KEY` means OpenAI only; failures never fall back to Codex.
- No live image call in default QA. Live smoke remains explicit and credential-gated.
- Vendor updates use only official stable release tags, exact commits, licenses, regular-file closures, and SHA-256 locks. Plugin installation never runs unpinned remote code.
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
- Create: `tests/unit/im-not-ai-vendor.test.mjs`
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

- [ ] **Step 4: Add official im-not-ai vendor contracts**

Require the bundled `humanize-korean` skill to come from `https://github.com/epoko77-ai/im-not-ai`, use the latest verified release at implementation time (`v2.3.0` on 2026-08-11), preserve the upstream MIT license, contain regular non-symlink `SKILL.md` and reference files, and record repository, tag, commit, release time, file hashes, and license in a vendor lock. Require an offline-safe bundled install and a separate release-time latest-version check/update command; plugin installation itself must not execute unpinned remote code.

- [ ] **Step 5: Add product discovery contracts**

Require `polish-game-design-writing`, `humanize-korean`, `game-design-writing-editor`, `writingSpecialistIds` containing only that specialist, both direct commands, output files, and the bundled upstream skill path. The game-design wrapper must call the bundled skill and then apply its stricter protected-content validator.

- [ ] **Step 6: Run RED tests and commit**

Run the four new test files. Expected: missing validator, vendor bundle, updater, skill, agent, and registry failures.

### Task 4: Implement the writing validator, skill, and specialist

**Files:**
- Create: `shared/scripts/validate-writing-revision.mjs`
- Create: `shared/document-quality/game-design-writing-style.md`
- Create: `shared/vendor/im-not-ai/vendor.lock.json`
- Create: `shared/vendor/im-not-ai/LICENSE`
- Create: `shared/vendor/im-not-ai/humanize-korean/v2.3.0/**`
- Create: `tooling/sync-im-not-ai.mjs`
- Create: `products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/polish-game-design-writing/agents/openai.yaml`
- Create: `products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md`
- Create: `products/game-design-career/plugin/skills/polish-game-design-writing/agents/openai.yaml`
- Create: `products/game-design-studio/plugin/agents/game-design-writing-editor.md`
- Create: `products/game-design-career/plugin/agents/game-design-writing-editor.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/career-stages.json`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Modify: both product `THIRD_PARTY_NOTICES.md` files
- Modify: `tooling/lib/build-product.mjs`
- Modify: `package.json`
- Modify: both product orchestrator `SKILL.md` files

**Interfaces:**
- Consumes: before/after Markdown, the verified bundled `humanize-korean`, and game-design-specific protected-content rules.
- Produces: separate revised draft, findings file, protected-content receipt, human-review handoff.

- [ ] **Step 1: Implement protected-content capture**

Capture and compare code spans, URLs, Markdown destinations, stable IDs, numeric tokens with units, table rows, explicit file paths, fact/inference/recommendation labels, and gate states. Reject control characters, non-NFC identifiers, prototype data, and path traversal.

- [ ] **Step 2: Vendor the official im-not-ai Codex skill**

Fetch only the official repository during the explicit update command, select the highest stable SemVer tag, verify the expected tag and commit, materialize the official Codex `SKILL.md` plus the referenced rule files as regular files, preserve the MIT license, and write a deterministic vendor lock. `--check` must compare the lock and bundled tree without network; `--check-latest` may query the official remote and report a newer release without changing files. The standard plugin build packages the verified bundle as `skills/humanize-korean` for both products.

- [ ] **Step 3: Implement product skill contracts**

Describe the exact sequence: lock protected content, run the bundled `humanize-korean`, apply game-design terminology and protected-content validation, return changed draft and receipt, wait for human review. Do not modify the canonical source in place.

- [ ] **Step 4: Implement the writing specialist**

The agent reports awkward phrases, context breaks, unexplained code terms, and minimum repairs. It cannot verify truth, invent evidence, change approval, or overwrite the document.

- [ ] **Step 5: Add direct routing and orchestrator placement**

Run writing polish after content/domain review and before export. Keep it outside the primary three-role stage as a dedicated specialist pass.

- [ ] **Step 6: Validate skill metadata and vendor integrity**

Run the installed skill validator against the product wrapper and bundled upstream skill, then run the Task 3 tests and the offline vendor integrity check.

- [ ] **Step 7: Commit GREEN implementation**

Commit shared validator, both product skills, agents, and routing updates.

### Task 4A: Upgrade Skillstead and bundle Archify in both products

**Files:**
- Modify: `shared/vendor/skillstead/vendor.lock.json`
- Replace: `shared/vendor/skillstead/svg-infographic/0.8.3/**` with `shared/vendor/skillstead/svg-infographic/0.9.0/**`
- Create: `shared/vendor/archify/vendor.lock.json`
- Create: `shared/vendor/archify/archify/2.13.0/**`
- Create: `tooling/sync-diagram-skills.mjs`
- Create: `tests/unit/diagram-skill-vendor.test.mjs`
- Modify: `tooling/lib/build-product.mjs`
- Modify: both product `product.json`, `THIRD_PARTY_NOTICES.md`, routing registries, and orchestrator skills
- Modify: `package.json`

**Interfaces:**
- Consumes: official Skillstead `svg-infographic/v0.9.0` and Archify `v2.13.0` release closures.
- Produces: offline `skills/svg-infographic` and `skills/archify` packages in both products, deterministic vendor verification, and natural-language routing.

- [ ] **Step 1: Write RED exact-closure tests**

Require Skillstead 55 regular files and Archify 60 regular files, exact relative paths, byte sizes, SHA-256 hashes, no symlinks, no extra files, pinned tag/commit/release metadata, and preserved Apache-2.0/MIT notices. Reject an extra executable, changed payload byte, altered lock entry, missing renderer/schema, or updater copied into a product package.

- [ ] **Step 2: Vendor official stable releases**

Pin Skillstead `svg-infographic/v0.9.0` at `6e5b850f66716af9eb3c6a79f60e4f8ff5716dee`. Pin Archify `v2.13.0` at `2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3` and release asset SHA-256 `9aca2bc07812cbef2a7c177f4d3ef74669814c980621daea6e0fd9ee7ed8fd21`. Materialize only regular files inside the canonical shared vendor roots.

- [ ] **Step 3: Implement offline check and explicit latest/update modes**

`--check` is pure local verification and cannot access network or spawn package installers. `--check-latest` may query only the two official repositories and must not change files. `--update <skill>` stages a verified future stable release, validates exact closure/license/hash, and atomically replaces the vendor root and lock. Tests inject a fake future release and prove check-latest is read-only.

- [ ] **Step 4: Package and route both skills**

Copy Skillstead to `skills/svg-infographic` and Archify to `skills/archify` for Studio and Career. Add direct discovery and Korean guidance: use Skillstead for document-friendly static flows/comparisons; use Archify for component boundaries, state, data flow, and explorable system architecture. Natural-language orchestration may select either skill, but diagram validation never grants document approval.

- [ ] **Step 5: Validate real packaged runtimes**

Run Skillstead lint/render smoke with its canonical Chromium contract and Archify `doctor`, typed schema validation, and one temporary `deliver` smoke from each installed product. Assert no network fetch during normal validation/delivery, no persistent temp files, and no writes outside the temporary artifact root.

- [ ] **Step 6: Commit vendor and packaging implementation**

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

### Task 7: Add bounded `gpt-image-2` master-image generation

**Files:**
- Modify: `shared/image-assets/schema/image-assets.schema.json`
- Modify: `shared/image-assets/schema/image-review.schema.json`
- Modify: `shared/scripts/build-image-asset-plan.mjs`
- Modify: `shared/scripts/run-image-asset-workflow.mjs`
- Modify: `shared/scripts/lib/image-provider.mjs`
- Modify: `shared/scripts/generate-openai-images.mjs`
- Modify: `tests/unit/generate-openai-images.test.mjs`
- Modify: `tests/unit/image-provider.test.mjs`
- Modify: `tests/products/studio/image-assets.test.mjs`
- Modify: `tooling/smoke-openai-image.mjs`
- Create: `tests/unit/smoke-openai-image.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Consumes: validated config, artifact-local master/reference images, and injectable OpenAI/Codex provider adapters.
- Produces: bounded `gpt-image-2` generation/edit requests, master/derivative lineage, reviewable receipts, and approved-only export bindings.

- [ ] **Step 1: Write RED lineage and reference-boundary tests**

Add `asset_set_id`, `derivative_of`, ordered reference IDs, artifact-local paths and SHA-256 hashes, style/character anchors, and prompt lineage. Reject missing sources, stale hashes, self-reference, cycles, traversal, symlinks, unknown parents, and references to unapproved external material before any provider call.

- [ ] **Step 2: Write RED OpenAI and Codex adapter tests**

For a master image plus multiple derivatives, require OpenAI to use multipart `POST /v1/images/edits` with `model=gpt-image-2`, ordered `image[]` inputs, prompt, quality, and size. Do not send `input_fidelity` for `gpt-image-2`. Require the Codex host callback to receive the same reference metadata and bounded bytes. Preserve prompt-only no-call and API-key no-fallback policies.

- [ ] **Step 3: Write RED never-resolving fetch test**

Use a bounded test timeout. Expect Abort, an explicit failed receipt, no partial PNG, no provider fallback, and no leaked key.

- [ ] **Step 4: Implement master/derivative planning and receipts**

Validate and topologically order an asset set. Generate or select the master first, then create derivative jobs that bind reference IDs, exact input digests, parent relation, prompt digest, model/quality, output digest, and named review state. Preserve the relationship through retry/resume.

- [ ] **Step 5: Implement the two OpenAI request shapes**

Use `/v1/images/generations` only for independent text-only assets and `/v1/images/edits` for master/reference workflows. Build multipart bodies without buffering unbounded files, permit only validated image formats/sizes, and keep the API-key route API-only.

- [ ] **Step 6: Implement request timeout**

Use an AbortController and a documented finite default. Preserve the retry cap and fail closed.

- [ ] **Step 7: Preserve human review and document insertion boundaries**

Generated master and derivatives remain `concept-draft`. Only exact digest-bound `document-approved` assets may be attached to a document/export manifest. Changing the master invalidates descendant approvals until regeneration and named-human re-review.

- [ ] **Step 8: Test `.env` and live-smoke configuration wiring**

Document `OPENAI_API_KEY`, `IMAGE_GEN_MODE`, `IMAGE_MODEL=gpt-image-2`, `IMAGE_QUALITY`, request timeout, and explicit cost-bearing smoke behavior. Verify that the smoke runner uses validated model/quality without printing secrets. `.env.example` contains placeholders only.

- [ ] **Step 9: Run image unit and product E2E tests**

Do not run a live network call.

- [ ] **Step 10: Commit the master-image implementation**

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

List Korean name first, English ID in parentheses, use case, result, direct command, agent boundary, bundled im-not-ai/Skillstead/Archify status, and detailed guide link.

- [ ] **Step 2: Update exact package and guide counts**

Studio: 12 agents, 17 routed product skills including bundled `humanize-korean` and `archify`, plus packaged Skillstead `svg-infographic`, for 18 installed skills in total. Career: 10 agents, 17 routed product skills including bundled `humanize-korean` and `archify`, plus packaged Skillstead `svg-infographic`, for 18 installed skills in total. Keep template and script counts derived from the actual build.

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

Use temporary HOME, CODEX_HOME, workspace, isolated state, bounded child timeouts, prompt-injection sentinel, dirty-tree sentinel, repeated continue/cancel/resume, stale receipts, false-success exits, vendor payload tampering, master-image cycles, stale reference hashes, and diagram renderer failures.

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
