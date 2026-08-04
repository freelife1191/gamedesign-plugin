# Game Design Career Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `game-design-career` product overlay as an evidence-centered workflow for game-design entry, junior hiring, on-the-job growth, and job transitions, with 10 skills, 6 review roles, 15 artifact templates, visualization/export support, and three verified E2E scenarios.

**Architecture:** This lane edits only `products/game-design-career/` and Career-specific tests. The career orchestrator diagnoses stage, target role, evidence, time, and constraints; routes to research, learning, portfolio, reverse-design, interview, review, or growth workflows; separates facts from inference; and produces Canonical Career Artifacts reviewed by bounded expert roles.

**Tech Stack:** Codex `SKILL.md` packages, Markdown role prompts/references, JSON stage/routing/rubric contracts, Node.js built-in tests, shared Canonical Artifact and Skillstead contracts from `shared-contract-v1`.

## Global Constraints

- Start only after the suite plan's Task 8 `shared-contract-v1` checkpoint passes.
- Own only `products/game-design-career/**`, `tests/products/career/**`, and `tests/e2e/career/**`. Escalate shared-contract changes; do not edit `shared/`, `tooling/`, `.agents/`, root docs, or generated `plugins/`.
- Current job postings, company/project facts, engine/tool preferences, hiring volume, compensation, law, and market outlook require fresh primary evidence. Never let undated local advice pass a time-sensitive evidence gate.
- Do not promise hiring outcomes or infer suitability from age, education, major, or employment gaps. Do not fabricate experience, metrics, or interview stories.
- Third-party game data and images in portfolios must carry source, use purpose, and rights/quotation notes.
- Role prompts are orchestrated assets with a sequential fallback; do not assume native top-level agent discovery.
- Visualization uses the packaged Skillstead skill only when relationships benefit from spatial representation; statistical charts need a data-accurate chart path.
- Write tests before implementation and commit only Career-owned paths.

---

### Task 1: Create the Career product contract, manifest source, and routing map

**Files:**
- Create: `products/game-design-career/product.json`
- Create: `products/game-design-career/plugin/.codex-plugin/plugin.json`
- Create: `products/game-design-career/plugin/assets/product-mark.svg`
- Create: `products/game-design-career/plugin/references/product-overview.md`
- Create: `products/game-design-career/plugin/references/routing.json`
- Test: `tests/products/career/product-contract.test.mjs`

- [ ] **Step 1: Write a failing Career contract test**

Require name `game-design-career`, exactly 10 product skills, exactly 6 role IDs, stages `entry`, `new-hire`, `junior-growth`, and `transition`, all shared modules, shared runtime, and all five source-document categories so the installed product preserves the full 49-document reference corpus.

- [ ] **Step 2: Run the test and confirm the expected failure**

Run: `node --test tests/products/career/product-contract.test.mjs`

- [ ] **Step 3: Implement `product.json` and the manifest source**

```json
{
  "schemaVersion": 1,
  "name": "game-design-career",
  "displayName": "Game Design Career",
  "description": "Evidence-centered game design learning, portfolio, interview, and growth workflows.",
  "sharedModules": ["knowledge", "templates", "responsible-design", "export", "vendor"],
  "sharedRuntime": true,
  "sourceRoots": ["plugin"],
  "sourceDocumentCategories": ["career", "fun-intent", "systems", "content", "feedback"]
}
```

Keep `.codex-plugin/plugin.json` inside the current local validator schema and omit `hooks`.

- [ ] **Step 4: Add deterministic routing by goal and career stage**

Each route declares stage, intent, required evidence, skill, roles, current-research trigger, artifact type, and completion gates. If stage is unclear, the orchestrator produces a role map and provisional paths instead of declaring one correct career.

- [ ] **Step 5: Run the contract test**

Run: `node --test tests/products/career/product-contract.test.mjs`

- [ ] **Step 6: Commit the Career contract**

```bash
git add products/game-design-career tests/products/career/product-contract.test.mjs
git commit -m "feat(career): define product and routing contract"
```

### Task 2: Implement the career orchestrator skill and stage model

**Files:**
- Create: `products/game-design-career/plugin/skills/orchestrate-game-design-career/**`
- Create: `products/game-design-career/plugin/references/career-stages.json`
- Create: `products/game-design-career/plugin/references/intake.md`
- Create: `products/game-design-career/plugin/references/completion-gates.md`
- Test: `tests/products/career/orchestrator.test.mjs`

- [ ] **Step 1: Write failing route and fallback tests**

Cover an undecided entrant, a new graduate targeting system design, a junior documenting project impact, and a two-year designer changing jobs. Verify that research is selected for current employer/job facts, portfolio review selects Reviewer plus Evidence Auditor, and no request selects more than three roles.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/career/orchestrator.test.mjs`

- [ ] **Step 3: Implement stage diagnosis and assumption policy**

Capture stage, target role, target industry/company/project, current artifacts/projects, available time, constraints, and desired outputs. Proceed with explicit safe assumptions; ask only when a missing choice materially branches the work.

- [ ] **Step 4: Encode role dispatch and sequential fallback**

Use the shared review envelope. Parallel mode may run independent reviewers; sequential mode uses fixed priority and the same questions. Merge results by severity, evidence gap, artifact section, and role priority.

- [ ] **Step 5: Validate the skill and tests**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-career/plugin/skills/orchestrate-game-design-career
node --test tests/products/career/orchestrator.test.mjs
```

- [ ] **Step 6: Commit the orchestrator**

```bash
git add products/game-design-career/plugin/skills/orchestrate-game-design-career products/game-design-career/plugin/references tests/products/career/orchestrator.test.mjs
git commit -m "feat(career): add career workflow orchestration"
```

### Task 3: Implement career mapping and current job research skills

**Files:**
- Create: `products/game-design-career/plugin/skills/map-game-design-career/**`
- Create: `products/game-design-career/plugin/skills/research-game-design-jobs/**`
- Create: `products/game-design-career/plugin/references/methods/role-map.md`
- Create: `products/game-design-career/plugin/references/methods/job-evidence.md`
- Create: `products/game-design-career/plugin/references/job-evidence-schema.json`
- Test: `tests/products/career/research-skills.test.mjs`

- [ ] **Step 1: Write failing contracts for role maps and job evidence**

Role maps must distinguish role families, current evidence, target level, gaps, learning tasks, feedback cadence, and proof artifacts. Job research must record company, project, region, employment type, posted date, source URL, responsibilities, required/preferred skills, repeated signals, applicant evidence, gaps, and non-generalizable requirements.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/products/career/research-skills.test.mjs`

- [ ] **Step 3: Implement career mapping without deterministic career claims**

Offer multiple plausible role paths and tradeoffs. Do not rank a path solely by education, age, major, or background. Convert gaps into observable exercises and artifacts.

- [ ] **Step 4: Implement research with primary-source and freshness gates**

Prefer official company career pages and project/platform sources. Record retrieval date, sample size, geography, and blind spots. Separate a posting-specific requirement from a repeated market signal; never infer hiring volume from a single posting.

- [ ] **Step 5: Validate both skills and tests**

Run both `quick_validate.py` commands and `node --test tests/products/career/research-skills.test.mjs`.

- [ ] **Step 6: Commit mapping and research skills**

```bash
git add products/game-design-career/plugin/skills/map-game-design-career products/game-design-career/plugin/skills/research-game-design-jobs products/game-design-career/plugin/references tests/products/career/research-skills.test.mjs
git commit -m "feat(career): add role mapping and job research"
```

### Task 4: Implement portfolio and reverse-design skills

**Files:**
- Create: `products/game-design-career/plugin/skills/build-game-design-portfolio/**`
- Create: `products/game-design-career/plugin/skills/reverse-engineer-game-design/**`
- Create: `products/game-design-career/plugin/references/methods/portfolio-evidence.md`
- Create: `products/game-design-career/plugin/references/methods/reverse-design.md`
- Create: `products/game-design-career/plugin/references/fact-inference-schema.json`
- Test: `tests/products/career/portfolio-skills.test.mjs`

- [ ] **Step 1: Write failing artifact contracts**

Portfolio projects must follow `target competency → problem/user → evidence → hypothesis/intent → rules/UI/data/content → constraints/alternatives → implementation/test → result/decision → retrospective`. Reverse-design documents must separate observation, inference, confidence, counterexample, alternative, and validation method.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/career/portfolio-skills.test.mjs`

- [ ] **Step 3: Implement the portfolio workflow as evidence design**

Avoid visual polish as a substitute for competence. Require the artifact to make one or more capabilities inspectable: design judgment, implementation handoff, data reasoning, playtest learning, scope control, collaboration, or iteration.

- [ ] **Step 4: Implement reverse design with falsifiability**

Reject pure user manuals. Observed game behavior and cited material are facts; internal intent, data structures, economy purpose, and production constraints are inferences with confidence and validation plans. Include UI state, rules/exceptions, data, operations, alternatives, and uncertainty.

- [ ] **Step 5: Validate both skills and tests**

Run both `quick_validate.py` commands and `node --test tests/products/career/portfolio-skills.test.mjs`.

- [ ] **Step 6: Commit portfolio and reverse-design skills**

```bash
git add products/game-design-career/plugin/skills/build-game-design-portfolio products/game-design-career/plugin/skills/reverse-engineer-game-design products/game-design-career/plugin/references tests/products/career/portfolio-skills.test.mjs
git commit -m "feat(career): add evidence-based portfolio workflows"
```

### Task 5: Implement interview, portfolio review, and junior growth skills

**Files:**
- Create: `products/game-design-career/plugin/skills/practice-game-design-interview/**`
- Create: `products/game-design-career/plugin/skills/review-game-design-portfolio/**`
- Create: `products/game-design-career/plugin/skills/plan-junior-growth/**`
- Create: `products/game-design-career/plugin/references/methods/interview.md`
- Create: `products/game-design-career/plugin/references/methods/five-axis-review.md`
- Create: `products/game-design-career/plugin/references/methods/junior-growth.md`
- Test: `tests/products/career/development-skills.test.mjs`

- [ ] **Step 1: Write failing contracts**

Interview practice must create base, follow-up, objection, and situational questions grounded in the posting and portfolio; answer feedback must connect claim, evidence, choice, alternative, result, and reflection. Portfolio review must implement the approved five axes and separately penalize contradiction, unsupported certainty, duplication, unclear scope, and missing sources. Growth planning must turn project events into evidence and quarterly goals.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/career/development-skills.test.mjs`

- [ ] **Step 3: Implement anti-fabrication and uncertainty behavior**

When evidence is missing, the workflow creates a verification task or honest answer pattern. It must never invent team size, revenue, retention, personal ownership, or implementation results.

- [ ] **Step 4: Implement prioritized minimum repairs**

Reviews provide scores only with evidence, then list highest-impact repairs in order and a minimal repair for each. Growth plans connect the next role's required depth and breadth to observable projects and feedback cycles.

- [ ] **Step 5: Validate the three skills and tests**

Run the three `quick_validate.py` commands and `node --test tests/products/career/development-skills.test.mjs`.

- [ ] **Step 6: Commit development skills**

```bash
git add products/game-design-career/plugin/skills/practice-game-design-interview products/game-design-career/plugin/skills/review-game-design-portfolio products/game-design-career/plugin/skills/plan-junior-growth products/game-design-career/plugin/references tests/products/career/development-skills.test.mjs
git commit -m "feat(career): add interview review and growth workflows"
```

### Task 6: Implement career visualization and export skills

**Files:**
- Create: `products/game-design-career/plugin/skills/visualize-career-roadmap/**`
- Create: `products/game-design-career/plugin/skills/export-career-documents/**`
- Create: `products/game-design-career/plugin/references/visualization-presets.json`
- Create: `products/game-design-career/plugin/references/export-recipes.md`
- Create: `products/game-design-career/plugin/scripts/prepare-career-export.mjs`
- Test: `tests/products/career/output-skills.test.mjs`

- [ ] **Step 1: Write failing visualization/export tests**

Require presets for role map, competency map, learning roadmap, development process, portfolio information architecture, and growth path. Require delegation to packaged `skills/svg-infographic`, SVG lint, alt text, 2× PNG verification, and data-accurate chart routing for quantitative statistics. Require PPTX audience/purpose/story outline.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/career/output-skills.test.mjs`

- [ ] **Step 3: Implement visualization selection and fallbacks**

Use diagrams only when hierarchy, dependency, sequence, or mapping is materially clearer than prose. If browser rendering is unavailable, preserve verified editable SVG and mark PNG unavailable. Never use an infographic to imply statistical precision.

- [ ] **Step 4: Implement career export recipes**

Provide renderer-neutral recipes for learning plans, portfolio documents, reverse-design documents, reviews, interview reports, and transition reports. Portfolio PPTX must optimize short recruiter review with a distinct story, not split Markdown by headings.

- [ ] **Step 5: Validate both skills and tests**

Run both `quick_validate.py` commands and `node --test tests/products/career/output-skills.test.mjs`.

- [ ] **Step 6: Commit output skills**

```bash
git add products/game-design-career/plugin/skills/visualize-career-roadmap products/game-design-career/plugin/skills/export-career-documents products/game-design-career/plugin/references products/game-design-career/plugin/scripts tests/products/career/output-skills.test.mjs
git commit -m "feat(career): add visualization and export workflows"
```

### Task 7: Add the six Career expert role prompts and deterministic merge

**Files:**
- Create: `products/game-design-career/plugin/agents/career-strategist.md`
- Create: `products/game-design-career/plugin/agents/game-design-mentor.md`
- Create: `products/game-design-career/plugin/agents/portfolio-reviewer.md`
- Create: `products/game-design-career/plugin/agents/reverse-design-critic.md`
- Create: `products/game-design-career/plugin/agents/interview-coach.md`
- Create: `products/game-design-career/plugin/agents/evidence-auditor.md`
- Create: `products/game-design-career/plugin/scripts/merge-role-findings.mjs`
- Test: `tests/products/career/roles.test.mjs`

- [ ] **Step 1: Write failing role and merge tests**

Each role defines responsibility, required evidence, questions, scope boundaries, forbidden assumptions, finding schema, and completion signal. The Evidence Auditor must flag stale, missing, generalized, or non-primary evidence. Merge order must be deterministic across parallel completion order.

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/products/career/roles.test.mjs`

- [ ] **Step 3: Write bounded role prompts**

Roles report findings and minimum repairs; they do not rewrite the whole portfolio or invent a candidate narrative. The Career Strategist offers tradeoffs, the Mentor ties study to artifacts, the Reviewer identifies inspectable competency evidence, the Reverse Critic separates fact/inference, the Interview Coach challenges unsupported claims, and the Auditor enforces freshness.

- [ ] **Step 4: Implement deterministic finding merge**

Order `blocker > high > medium > low`, then evidence gap ID, stable section ID, and role priority. Preserve disagreements as explicit decisions.

- [ ] **Step 5: Run tests**

Run: `node --test tests/products/career/roles.test.mjs`

- [ ] **Step 6: Commit roles**

```bash
git add products/game-design-career/plugin/agents products/game-design-career/plugin/scripts/merge-role-findings.mjs tests/products/career/roles.test.mjs
git commit -m "feat(career): add expert career review roles"
```

### Task 8: Implement all 15 Career artifact templates and the review rubric

**Files:**
- Create: `products/game-design-career/plugin/assets/templates/career-stage-goal/**`
- Create: `products/game-design-career/plugin/assets/templates/game-design-role-map/**`
- Create: `products/game-design-career/plugin/assets/templates/competency-matrix/**`
- Create: `products/game-design-career/plugin/assets/templates/learning-roadmap/**`
- Create: `products/game-design-career/plugin/assets/templates/job-posting-evidence/**`
- Create: `products/game-design-career/plugin/assets/templates/portfolio-backlog/**`
- Create: `products/game-design-career/plugin/assets/templates/portfolio-project-brief/**`
- Create: `products/game-design-career/plugin/assets/templates/reverse-design-document/**`
- Create: `products/game-design-career/plugin/assets/templates/creative-design-portfolio/**`
- Create: `products/game-design-career/plugin/assets/templates/game-analysis-report/**`
- Create: `products/game-design-career/plugin/assets/templates/five-axis-review/**`
- Create: `products/game-design-career/plugin/assets/templates/interview-question-answer-log/**`
- Create: `products/game-design-career/plugin/assets/templates/introduction-motivation/**`
- Create: `products/game-design-career/plugin/assets/templates/junior-growth-review/**`
- Create: `products/game-design-career/plugin/assets/templates/transition-readiness/**`
- Create: `products/game-design-career/plugin/references/five-axis-rubric.json`
- Test: `tests/products/career/templates.test.mjs`

- [ ] **Step 1: Write a failing enumeration and canonical-validation test**

Require exactly the 15 approved IDs. Instantiate every template, validate canonical structure, and assert appropriate evidence/freshness/rights fields.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/products/career/templates.test.mjs`

- [ ] **Step 3: Implement complete artifact seeds**

Every template includes `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, and `assets/README.md`. The job matrix records source dates/regions; portfolio templates record third-party sources/rights; interview templates prohibit fabricated answers.

- [ ] **Step 4: Encode the five-axis rubric**

Axes: intent/problem definition, player experience/fun, implementation/data/validation, readability/navigation, and differentiation/decision rationale/reflection. Each score level needs observable evidence; add separate contradiction, unsupported certainty, duplication, scope, and source penalties.

- [ ] **Step 5: Run template tests**

Run: `node --test tests/products/career/templates.test.mjs`

- [ ] **Step 6: Commit templates and rubric**

```bash
git add products/game-design-career/plugin/assets/templates products/game-design-career/plugin/references/five-axis-rubric.json tests/products/career/templates.test.mjs
git commit -m "feat(career): add career artifact templates"
```

### Task 9: Add Career E2E fixtures and acceptance tests

**Files:**
- Create: `tests/e2e/career/entry-12-week-roadmap/**`
- Create: `tests/e2e/career/reverse-design-portfolio/**`
- Create: `tests/e2e/career/junior-transition/**`
- Create: `tests/e2e/career/career-e2e.test.mjs`

- [ ] **Step 1: Write three failing acceptance tests from the approved design**

The entry test requires role candidates, evidence gaps, weekly learning/practice/feedback, a first portfolio brief, competency-map SVG, and PDF request. The reverse-design test rejects user-manual prose and requires fact/inference/rules/exceptions/UI/data/economy/operations/alternatives/validation plus DOCX/PPTX. The transition test requires current job evidence, project impact, evidence gaps, question types, answer feedback, quarterly plan, and zero unverified current claims.

- [ ] **Step 2: Run E2E and inspect failures**

Run: `node --test tests/e2e/career/career-e2e.test.mjs`

- [ ] **Step 3: Implement only missing Career-owned behavior**

Fix skills, roles, references, templates, or scripts inside the lane. Report shared issues upward.

- [ ] **Step 4: Validate all Career skills and tests**

Run:

```bash
find products/game-design-career/plugin/skills -name SKILL.md -print0 | xargs -0 -n1 dirname | while read skill_dir; do python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"; done
node --test tests/products/career/**/*.test.mjs tests/e2e/career/**/*.test.mjs
```

Expected: 10 skills and all tests PASS.

- [ ] **Step 5: Commit E2E coverage and fixes**

```bash
git add products/game-design-career tests/e2e/career
git commit -m "test(career): cover career design workflows"
```

### Task 10: Write the Career README and hand off to suite integration

**Files:**
- Create: `products/game-design-career/plugin/README.md`
- Create: `products/game-design-career/plugin/LICENSE`
- Create: `products/game-design-career/plugin/THIRD_PARTY_NOTICES.md`
- Test: `tests/products/career/readme.test.mjs`

- [ ] **Step 1: Write a failing README/license contract**

Require repo marketplace and direct installation, update/uninstall, 10-skill and 6-role tables, four career stages, evidence/freshness policy, fallback behavior, examples, Canonical Artifact, visualization/export, rights/privacy boundaries, verification, Skillstead attribution, limitations, and troubleshooting.

- [ ] **Step 2: Write README examples using tested workflows**

Include an undecided-entry roadmap, a target-job evidence matrix, a reverse-design portfolio, five-axis review, interview practice, junior growth, a visual roadmap, and MD/PDF/DOCX/PPTX export.

- [ ] **Step 3: Run documentation and full Career tests**

Run:

```bash
node --test tests/products/career/readme.test.mjs
node --test tests/products/career/**/*.test.mjs tests/e2e/career/**/*.test.mjs
```

- [ ] **Step 4: Request product review and fix findings**

Use `superpowers:requesting-code-review` focused on evidence freshness, non-generalization, anti-fabrication, fairness boundaries, reverse-design fact/inference separation, deterministic roles, visualization accuracy, export fail-closed behavior, and README truthfulness. Rerun all Career tests.

- [ ] **Step 5: Commit the Career release source**

```bash
git add products/game-design-career tests/products/career
git commit -m "docs(career): document game design career plugin"
```

- [ ] **Step 6: Report the handoff contract to the suite lane**

Report commit hash, 10 discovered skills, six role IDs, four stages, 15 templates, test command, and test counts. Do not generate or edit `plugins/game-design-career`; suite integration owns the clean build.

## Product Acceptance Checklist

- [ ] All 10 Career skills pass `quick_validate.py`.
- [ ] The orchestrator routes by stage and goal without deterministic career promises.
- [ ] Time-sensitive claims require fresh primary evidence and record sample/region/date limitations.
- [ ] Portfolio and interview workflows never fabricate experience or metrics.
- [ ] Parallel and sequential role reviews yield deterministic findings.
- [ ] All 15 templates validate as Canonical Artifacts.
- [ ] The three E2E scenarios satisfy evidence, rights, safety, visualization, and export contracts.
- [ ] The README accurately documents installation, usage, visualization, export, licensing, and limitations.
