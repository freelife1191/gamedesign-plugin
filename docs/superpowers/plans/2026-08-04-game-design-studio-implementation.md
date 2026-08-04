# Game Design Studio Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `game-design-studio` product overlay as a production-grade game-design workflow with 10 skills, 6 review roles, three composable platform/genre profiles, 15 artifact templates, responsible-design gates, visualization, export orchestration, and three verified E2E scenarios.

**Architecture:** This lane edits only `products/game-design-studio/` and Studio-specific tests. The product entry skill routes work to narrowly scoped specialist skills, which load shared evidence selectively, apply profiles, invoke one to three role prompts in parallel when supported or sequentially otherwise, and finish with a Canonical Artifact plus optional visual/export outputs.

**Tech Stack:** Codex `SKILL.md` packages, Markdown role prompts and references, JSON product/profile/routing contracts, Node.js built-in tests, shared Canonical Artifact and Skillstead contracts from `shared-contract-v1`.

## Global Constraints

- Start only after the suite plan's Task 8 `shared-contract-v1` checkpoint passes.
- Own only `products/game-design-studio/**`, `tests/products/studio/**`, and `tests/e2e/studio/**`. Report required shared-contract changes upward; do not edit shared files or generated `plugins/`.
- Use `plugin-creator` and `skill-creator` conventions already established by the shared plan. Every skill directory must be validation-ready and use progressive reference loading.
- Do not duplicate all shared knowledge inside each Studio skill. Link to the smallest required shared module through product packaging declarations.
- Role prompts are portable orchestration assets. Never claim that the plugin host automatically discovers top-level `agents/`.
- A workflow may use at most three role reviews. It must describe its sequential fallback and deterministic merge order.
- Every completion gate must preserve the canonical artifact when visual or export capabilities fail.
- Write tests before each implementation slice and commit after its focused validation passes.

---

### Task 1: Create the Studio product contract, manifest source, and routing map

**Files:**
- Create: `products/game-design-studio/product.json`
- Create: `products/game-design-studio/plugin/.codex-plugin/plugin.json`
- Create: `products/game-design-studio/plugin/assets/product-mark.svg`
- Create: `products/game-design-studio/plugin/references/product-overview.md`
- Create: `products/game-design-studio/plugin/references/routing.json`
- Test: `tests/products/studio/product-contract.test.mjs`

- [ ] **Step 1: Write a failing Studio product contract test**

Require name `game-design-studio`, exactly 10 product skills, exactly 6 role IDs, profiles `live-service-rpg`, `mobile`, and `pc-console`, all common modules, shared runtime, and all five source-document categories so the installed product preserves the full 49-document reference corpus.

- [ ] **Step 2: Run the test and confirm the overlay is absent**

Run: `node --test tests/products/studio/product-contract.test.mjs`

- [ ] **Step 3: Implement `product.json` and the manifest source**

Use this product contract shape:

```json
{
  "schemaVersion": 1,
  "name": "game-design-studio",
  "displayName": "Game Design Studio",
  "description": "Professional game design, review, visualization, and export workflows.",
  "sharedModules": ["knowledge", "templates", "responsible-design", "export", "vendor"],
  "sharedRuntime": true,
  "sourceRoots": ["plugin"],
  "sourceDocumentCategories": ["career", "fun-intent", "systems", "content", "feedback"]
}
```

Keep `.codex-plugin/plugin.json` within the locally validated schema and omit a `hooks` field.

- [ ] **Step 4: Add the deterministic routing map**

Each route declares trigger intent, required inputs, selected skill, eligible profiles, default role reviewers, maximum reviewers, references, artifact type, and completion gates. Unknown routes must fall back to `orchestrate-game-design-project`, never to a guessed specialist.

- [ ] **Step 5: Run the contract test**

Run: `node --test tests/products/studio/product-contract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the Studio contract**

```bash
git add products/game-design-studio tests/products/studio/product-contract.test.mjs
git commit -m "feat(studio): define product and routing contract"
```

### Task 2: Implement the project orchestrator skill

**Files:**
- Create: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/agents/openai.yaml`
- Create: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/intake.md`
- Create: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/workflow.md`
- Create: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/completion-gates.md`
- Test: `tests/products/studio/orchestrator.test.mjs`

- [ ] **Step 1: Write failing orchestration contract tests**

Test direct routing for vision, system, content, UX, economy/LiveOps, production, review, visualization, and export requests. Test that a mixed launch-readiness request selects no more than three roles and that hosts without subagents receive the same role reviews in the declared sequence.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/studio/orchestrator.test.mjs`

- [ ] **Step 3: Write the orchestrator instructions**

The skill must capture target player/experience, platform, genre, business model, online mode, development stage, team/schedule/technology constraints, scope/non-goals, requested artifact formats, and completion criteria. It may record safe assumptions; it asks only when missing information materially changes the result.

- [ ] **Step 4: Encode role dispatch and fallback**

Use an explicit review envelope:

```json
{
  "artifact": "artifact-name/content.md",
  "role": "lead-game-designer",
  "questions": [],
  "findingsPath": "artifact-name/decisions/review-lead-game-designer.md"
}
```

Parallel mode dispatches independent envelopes; fallback mode runs the same list in `rolePriority` order. Merge findings by severity, affected section ID, and role priority.

- [ ] **Step 5: Validate the skill and tests**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-studio/plugin/skills/orchestrate-game-design-project
node --test tests/products/studio/orchestrator.test.mjs
```

- [ ] **Step 6: Commit the orchestrator**

```bash
git add products/game-design-studio/plugin/skills/orchestrate-game-design-project tests/products/studio/orchestrator.test.mjs
git commit -m "feat(studio): add game design project orchestration"
```

### Task 3: Implement vision, systems, and content design skills

**Files:**
- Create: `products/game-design-studio/plugin/skills/define-game-vision/**`
- Create: `products/game-design-studio/plugin/skills/design-game-systems/**`
- Create: `products/game-design-studio/plugin/skills/design-game-content/**`
- Create: `products/game-design-studio/plugin/references/methods/vision.md`
- Create: `products/game-design-studio/plugin/references/methods/system-specification.md`
- Create: `products/game-design-studio/plugin/references/methods/content-specification.md`
- Test: `tests/products/studio/core-design-skills.test.mjs`

- [ ] **Step 1: Write failing skill-content contracts**

Require vision outputs to include target player, intent, desired emotion, core fun, pillars, core/motivation loops, meaningful choice, success metrics, assumptions, and non-goals. Require system outputs to include input, preconditions, rules, state transitions, output/feedback, exceptions, priority/concurrency, failure/recovery, abuse, UI states, data schema, PK/FK, and table/runtime mapping. Require content outputs to connect purpose, system inputs, production resources, player strategy, telegraph, outcomes, rewards, and repeatability.

- [ ] **Step 2: Run the focused test and confirm failures**

Run: `node --test tests/products/studio/core-design-skills.test.mjs`

- [ ] **Step 3: Implement each skill with minimal progressive references**

Each `SKILL.md` must contain triggers, non-triggers, required input, assumption policy, workflow, output contract, applicable responsible-design gates, role reviewers, and completion checks. Put long methods and examples in `references/` rather than the top-level instruction.

- [ ] **Step 4: Add adversarial examples**

Include one example per skill that catches a plausible failure: fun as an unsupported adjective, rules without precedence, and content disconnected from production cost or system data.

- [ ] **Step 5: Validate all three skills**

Run:

```bash
for skill in define-game-vision design-game-systems design-game-content; do python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "products/game-design-studio/plugin/skills/$skill"; done
node --test tests/products/studio/core-design-skills.test.mjs
```

- [ ] **Step 6: Commit core design skills**

```bash
git add products/game-design-studio/plugin/skills/define-game-vision products/game-design-studio/plugin/skills/design-game-systems products/game-design-studio/plugin/skills/design-game-content products/game-design-studio/plugin/references/methods tests/products/studio/core-design-skills.test.mjs
git commit -m "feat(studio): add vision systems and content design"
```

### Task 4: Implement player experience, economy/LiveOps, and production skills

**Files:**
- Create: `products/game-design-studio/plugin/skills/design-player-experience/**`
- Create: `products/game-design-studio/plugin/skills/design-game-economy-and-liveops/**`
- Create: `products/game-design-studio/plugin/skills/plan-game-production/**`
- Create: `products/game-design-studio/plugin/references/methods/player-experience.md`
- Create: `products/game-design-studio/plugin/references/methods/economy-liveops.md`
- Create: `products/game-design-studio/plugin/references/methods/production.md`
- Test: `tests/products/studio/operational-design-skills.test.mjs`

- [ ] **Step 1: Write failing contract tests**

UX must cover information priority, interaction and UI states, first five minutes/first success, tutorial skip/revisit, input, performance, cross-platform, and accessibility. Economy/LiveOps must cover source/sink, target inventory, progression time, inflation, price/probability/pity, hypothesis/control/single variable/sample/duration/success/guardrail/stop/rollback. Production must cover core-loop contribution, effort, dependencies, maintenance burden, licensing/outsource risk, prototype hypothesis, milestone, owner, definition of done, kill criterion, and MoSCoW scope.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/products/studio/operational-design-skills.test.mjs`

- [ ] **Step 3: Implement the three skills and current-evidence triggers**

Any platform policy, monetization, regulation, AI right, or current accessibility claim must route through the shared Current reference layer and create evidence entries. Do not let generalized local advice satisfy a time-sensitive completion gate.

- [ ] **Step 4: Add explicit blocking gates**

Block release recommendations for missing real-price/probability/rollback information, missing rights/consent for AI or UGC, or missing protection metrics for LiveOps experiments. Production planning may keep a concept draft but must not mark a large commitment approved when the target experience or prototype evidence is absent.

- [ ] **Step 5: Validate the skills and tests**

Run the three `quick_validate.py` commands and `node --test tests/products/studio/operational-design-skills.test.mjs`.

- [ ] **Step 6: Commit operational skills**

```bash
git add products/game-design-studio/plugin/skills/design-player-experience products/game-design-studio/plugin/skills/design-game-economy-and-liveops products/game-design-studio/plugin/skills/plan-game-production products/game-design-studio/plugin/references/methods tests/products/studio/operational-design-skills.test.mjs
git commit -m "feat(studio): add experience liveops and production design"
```

### Task 5: Implement review, visualization, and export skills

**Files:**
- Create: `products/game-design-studio/plugin/skills/review-game-design/**`
- Create: `products/game-design-studio/plugin/skills/visualize-game-design/**`
- Create: `products/game-design-studio/plugin/skills/export-game-design-documents/**`
- Create: `products/game-design-studio/plugin/references/visualization-presets.json`
- Create: `products/game-design-studio/plugin/references/export-recipes.md`
- Create: `products/game-design-studio/plugin/scripts/prepare-studio-export.mjs`
- Test: `tests/products/studio/output-skills.test.mjs`

- [ ] **Step 1: Write failing review/output contracts**

Require review findings to carry severity, evidence, impact, affected stable section ID, and minimal fix. Require visualization to select a diagram only when spatial structure improves understanding and map all presets to the packaged `skills/svg-infographic`. Require export to validate the canonical artifact first and prohibit PPTX without audience, purpose, and slide outline.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/studio/output-skills.test.mjs`

- [ ] **Step 3: Implement game-design visualization presets**

Add presets for core/motivation loop, state/rule flow, quest/content progression, economy source/sink, LiveOps roadmap, and production/role structure. Each preset declares suited inputs, unsuitable inputs, recommended Skillstead archetype, accessibility/alt-text requirements, SVG lint, 2× PNG render, and fallback behavior.

- [ ] **Step 4: Implement export recipes and preflight**

Provide recipes for GDD, system spec, content spec, LiveOps plan, review report, and executive presentation. `prepare-studio-export.mjs` must emit a renderer-neutral job manifest and never fabricate a successful output; the export skill delegates actual PDF/DOCX/PPTX creation to capabilities detected by the shared probe.

- [ ] **Step 5: Validate all output skills and tests**

Run the three `quick_validate.py` commands and `node --test tests/products/studio/output-skills.test.mjs`.

- [ ] **Step 6: Commit output skills**

```bash
git add products/game-design-studio/plugin/skills/review-game-design products/game-design-studio/plugin/skills/visualize-game-design products/game-design-studio/plugin/skills/export-game-design-documents products/game-design-studio/plugin/references products/game-design-studio/plugin/scripts tests/products/studio/output-skills.test.mjs
git commit -m "feat(studio): add review visualization and export"
```

### Task 6: Add the six expert role prompts and deterministic review merge

**Files:**
- Create: `products/game-design-studio/plugin/agents/lead-game-designer.md`
- Create: `products/game-design-studio/plugin/agents/system-economy-designer.md`
- Create: `products/game-design-studio/plugin/agents/content-narrative-designer.md`
- Create: `products/game-design-studio/plugin/agents/ux-accessibility-reviewer.md`
- Create: `products/game-design-studio/plugin/agents/liveops-data-designer.md`
- Create: `products/game-design-studio/plugin/agents/production-feasibility-critic.md`
- Create: `products/game-design-studio/plugin/scripts/merge-role-findings.mjs`
- Test: `tests/products/studio/roles.test.mjs`

- [ ] **Step 1: Write failing role-prompt and merge tests**

Every role must define responsibility, required input, questions, out-of-scope behavior, forbidden assumptions, evidence requirements, finding schema, and completion signal. The merge test must produce the same ordered findings regardless of simulated parallel completion order.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/studio/roles.test.mjs`

- [ ] **Step 3: Write the six bounded role prompts**

Prevent roles from rewriting the entire artifact. They report findings and minimum repairs to the orchestrator. The production critic may block infeasible scope; the UX reviewer may block missing access to a critical action; the economy/LiveOps roles may block unsafe experiments or opaque monetization.

- [ ] **Step 4: Implement deterministic merge and disagreement capture**

Merge exact duplicates, retain conflicting recommendations as a decision item, order `blocker > high > medium > low`, then stable section ID, then role priority. Never silently choose between roles when their assumptions differ.

- [ ] **Step 5: Run tests**

Run: `node --test tests/products/studio/roles.test.mjs`

- [ ] **Step 6: Commit role prompts**

```bash
git add products/game-design-studio/plugin/agents products/game-design-studio/plugin/scripts/merge-role-findings.mjs tests/products/studio/roles.test.mjs
git commit -m "feat(studio): add expert review roles"
```

### Task 7: Add universal core and three composable profiles

**Files:**
- Create: `products/game-design-studio/plugin/references/profiles/universal-core.json`
- Create: `products/game-design-studio/plugin/references/profiles/live-service-rpg.json`
- Create: `products/game-design-studio/plugin/references/profiles/mobile.json`
- Create: `products/game-design-studio/plugin/references/profiles/pc-console.json`
- Create: `products/game-design-studio/plugin/scripts/compose-profiles.mjs`
- Test: `tests/products/studio/profiles.test.mjs`

- [ ] **Step 1: Write failing composition and conflict tests**

Test single and multi-profile composition, deduplication, deterministic order, and explicit conflict records for touch vs controller-first input, short mobile sessions vs long-form RPG sessions, client authority vs server authority, and monetization/platform-policy differences.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/studio/profiles.test.mjs`

- [ ] **Step 3: Encode profiles as additional questions and gates, not absolute rules**

Each profile contains `assumptions`, `questions`, `requiredSections`, `responsibleGates`, `reviewRoles`, `conflicts`, and `evidenceTriggers`. Universal core is always first.

- [ ] **Step 4: Implement `compose-profiles.mjs`**

Return `{ profiles, questions, requiredSections, gates, roles, conflicts }`; do not resolve conflicts without a decision record.

- [ ] **Step 5: Run tests and sample composition**

Run:

```bash
node --test tests/products/studio/profiles.test.mjs
node products/game-design-studio/plugin/scripts/compose-profiles.mjs live-service-rpg mobile
```

Expected: PASS and a non-empty conflicts list for relevant tradeoffs.

- [ ] **Step 6: Commit profiles**

```bash
git add products/game-design-studio/plugin/references/profiles products/game-design-studio/plugin/scripts/compose-profiles.mjs tests/products/studio/profiles.test.mjs
git commit -m "feat(studio): add composable game profiles"
```

### Task 8: Implement all 15 Studio artifact templates

**Files:**
- Create: `products/game-design-studio/plugin/assets/templates/game-design-brief/**`
- Create: `products/game-design-studio/plugin/assets/templates/vision-pillars/**`
- Create: `products/game-design-studio/plugin/assets/templates/core-motivation-loop/**`
- Create: `products/game-design-studio/plugin/assets/templates/system-specification/**`
- Create: `products/game-design-studio/plugin/assets/templates/rule-exception-matrix/**`
- Create: `products/game-design-studio/plugin/assets/templates/ui-ux-flow-state/**`
- Create: `products/game-design-studio/plugin/assets/templates/data-schema-table-contract/**`
- Create: `products/game-design-studio/plugin/assets/templates/narrative-quest-npc/**`
- Create: `products/game-design-studio/plugin/assets/templates/character-skill-combat-monster/**`
- Create: `products/game-design-studio/plugin/assets/templates/economy-balance/**`
- Create: `products/game-design-studio/plugin/assets/templates/liveops-experiment-event/**`
- Create: `products/game-design-studio/plugin/assets/templates/accessibility-platform-matrix/**`
- Create: `products/game-design-studio/plugin/assets/templates/production-scope-risk/**`
- Create: `products/game-design-studio/plugin/assets/templates/game-design-review/**`
- Create: `products/game-design-studio/plugin/assets/templates/decision-change-log/**`
- Test: `tests/products/studio/templates.test.mjs`

- [ ] **Step 1: Write a failing template enumeration and canonical-validation test**

Require exactly the 15 approved template IDs. Instantiate every template with fixture data and validate it with the shared canonical validator.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/studio/templates.test.mjs`

- [ ] **Step 3: Implement each template as a complete artifact seed**

Each template contains `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, and `assets/README.md`. Use stable heading IDs, visible assumptions, owner/approval fields, change history, applicable safety gates, and format-specific story hints.

- [ ] **Step 4: Add template-specific completion checks**

For example, system specifications require rule precedence and data/runtime mapping; economy plans require real-price/probability/rollback fields; UX plans require accessibility; production plans require kill criteria.

- [ ] **Step 5: Run template tests**

Run: `node --test tests/products/studio/templates.test.mjs`

- [ ] **Step 6: Commit templates**

```bash
git add products/game-design-studio/plugin/assets/templates tests/products/studio/templates.test.mjs
git commit -m "feat(studio): add production design templates"
```

### Task 9: Add Studio E2E fixtures and acceptance tests

**Files:**
- Create: `tests/e2e/studio/live-service-rpg-economy/**`
- Create: `tests/e2e/studio/mobile-onboarding-liveops/**`
- Create: `tests/e2e/studio/pc-console-ai-npc/**`
- Create: `tests/e2e/studio/studio-e2e.test.mjs`

- [ ] **Step 1: Write the three failing acceptance tests from the approved design**

The tests must inspect routed skills/roles/profiles, required canonical sections, evidence and blocking gates, and requested output manifest. They must reject a missing economy rollback, missing LiveOps guardrail, or AI NPC without rights/consent/fallback/kill-switch fields.

- [ ] **Step 2: Run the E2E tests and inspect every failure**

Run: `node --test tests/e2e/studio/studio-e2e.test.mjs`

- [ ] **Step 3: Implement only the missing product behavior revealed by the tests**

Fix Studio-owned skills, profiles, roles, templates, or scripts. Escalate shared-contract defects instead of patching around them.

- [ ] **Step 4: Validate every Studio skill and product test**

Run:

```bash
find products/game-design-studio/plugin/skills -name SKILL.md -print0 | xargs -0 -n1 dirname | while read skill_dir; do python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"; done
node --test tests/products/studio/**/*.test.mjs tests/e2e/studio/**/*.test.mjs
```

Expected: 10 skills and all tests PASS.

- [ ] **Step 5: Commit E2E coverage and fixes**

```bash
git add products/game-design-studio tests/e2e/studio
git commit -m "test(studio): cover professional design workflows"
```

### Task 10: Write the Studio README and hand off to suite integration

**Files:**
- Create: `products/game-design-studio/plugin/README.md`
- Create: `products/game-design-studio/plugin/LICENSE`
- Create: `products/game-design-studio/plugin/THIRD_PARTY_NOTICES.md`
- Test: `tests/products/studio/readme.test.mjs`

- [ ] **Step 1: Write a failing README/license contract**

Require installation from the repo marketplace, direct install, update/uninstall, 10-skill table, 6-role table, profile composition, sequential fallback, examples, Canonical Artifact layout, visualization/export behavior, responsible-design blockers, verification commands, Skillstead attribution, limitations, and troubleshooting.

- [ ] **Step 2: Write the README using only tested commands and behavior**

Include concise examples for a new GDD, a system specification, an economy/LiveOps review, AI NPC safety review, diagram request, and MD/PDF/DOCX/PPTX export.

- [ ] **Step 3: Validate product documentation and run the full Studio gate**

Run:

```bash
node --test tests/products/studio/readme.test.mjs
node --test tests/products/studio/**/*.test.mjs tests/e2e/studio/**/*.test.mjs
```

- [ ] **Step 4: Request product review and repair findings**

Use `superpowers:requesting-code-review` focused on routing correctness, domain completeness, safety gates, profile conflicts, role determinism, visualization handoff, export fail-closed behavior, and README truthfulness. Rerun all Studio tests after fixes.

- [ ] **Step 5: Commit the product release source**

```bash
git add products/game-design-studio tests/products/studio
git commit -m "docs(studio): document professional game design plugin"
```

- [ ] **Step 6: Report the handoff contract to the suite lane**

Report the final commit hash, the 10 discovered skills, six role IDs, three profiles, 15 templates, test command, and test counts. Do not generate or edit `plugins/game-design-studio`; the suite integration lane owns the clean build.

## Product Acceptance Checklist

- [ ] All 10 Studio skills pass `quick_validate.py`.
- [ ] The orchestrator selects only relevant skills, profiles, references, and at most three roles.
- [ ] Parallel and sequential role reviews yield deterministic merged findings.
- [ ] All three profiles compose through the universal core and expose conflicts.
- [ ] All 15 templates validate as Canonical Artifacts.
- [ ] The three E2E scenarios satisfy every domain and responsible-design gate.
- [ ] The README accurately documents installation, usage, visualization, export, licensing, and limitations.
