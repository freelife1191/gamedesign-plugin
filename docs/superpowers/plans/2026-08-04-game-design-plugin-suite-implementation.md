# Game Design Plugin Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared knowledge, artifact, visualization, export, packaging, and validation foundation that produces two independently installable Codex plugins from one monorepo.

**Architecture:** Human-edited common files live under `shared/`; product-owned overlays live under `products/game-design-studio/` and `products/game-design-career/`; deterministic tooling merges them into clean `plugins/` snapshots. Shared work is split into a foundation phase, after which the Studio and Career plans may run in parallel, and an integration phase that builds, validates, installs, and renders both products.

**Tech Stack:** Node.js 24 built-in modules and test runner, Python 3 for official plugin scaffolding/validation, Codex plugin and skill validators, bundled Codex document/PDF/presentation runtimes, Skillstead `svg-infographic` 0.8.3, Markdown/JSON/YAML/SVG/OOXML.

## Global Constraints

- Execute Tasks 1–8 before starting the two product plans. Run the Studio and Career implementation plans in parallel only after the `shared-contract-v1` checkpoint in Task 8.
- Product lanes own only `products/<plugin-name>/` and their matching product-specific tests. They must not edit `shared/`, `tooling/`, `.agents/`, root `README.md`, or generated `plugins/` snapshots.
- `plugins/` is generated. Never fix a packaged file directly; fix its source and rebuild from a clean staging directory.
- Preserve all existing untracked user documents under `docs/`. Do not normalize, rename, or commit those source documents as part of repository setup.
- Use `apply_patch` for edits. Use formatting/generation tools only for deterministic generated output.
- Keep the deployed plugins self-contained: no symlink, `../shared`, sibling-plugin dependency, workspace absolute path, or unvendored runtime import.
- Do not add a `hooks` property to `.codex-plugin/plugin.json`; the current local `plugin-creator` validator rejects it. Use the default `hooks/hooks.json` discovery path.
- Keep Skillstead files byte-for-byte unchanged. Add wrappers outside its vendored directory and preserve Apache-2.0 attribution.
- Treat Canonical Markdown as the source of truth. A failed PDF/DOCX/PPTX/SVG/PNG conversion must preserve the canonical artifact and fail closed for that format.
- Run targeted tests first, then the full relevant suite. Commit only files owned by the current task.

---

## Phase A — Shared Foundation

### Task 1: Bootstrap the repository and official plugin skeletons

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `.agents/plugins/marketplace.json` (through the official scaffolder)
- Generate: `plugins/game-design-studio/.codex-plugin/plugin.json`
- Generate: `plugins/game-design-career/.codex-plugin/plugin.json`
- Test: `tests/contracts/marketplace.test.mjs`

- [ ] **Step 1: Write a failing marketplace contract test**

```js
// tests/contracts/marketplace.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("repo marketplace exposes exactly the two independent plugins", async () => {
  const marketplace = JSON.parse(await readFile(new URL(".agents/plugins/marketplace.json", root), "utf8"));
  assert.equal(typeof marketplace.name, "string");
  assert.deepEqual(
    marketplace.plugins.map(({ name, source }) => [name, source]).sort(),
    [
      ["game-design-career", "./plugins/game-design-career"],
      ["game-design-studio", "./plugins/game-design-studio"],
    ],
  );
});
```

- [ ] **Step 2: Run the test and confirm the expected missing-file failure**

Run: `node --test tests/contracts/marketplace.test.mjs`

Expected: FAIL because `.agents/plugins/marketplace.json` does not exist.

- [ ] **Step 3: Add repository hygiene and a dependency-free test harness**

```json
// package.json
{
  "name": "game-design-plugin-suite",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "test:unit": "node --test tests/unit/*.test.mjs",
    "test:contracts": "node --test tests/contracts/*.test.mjs",
    "build": "node tooling/build-snapshots.mjs",
    "validate": "node tooling/validate-suite.mjs"
  },
  "engines": { "node": ">=18" }
}
```

`.gitignore` must ignore `.omx/`, `.superpowers/`, `.build/`, `.tmp/`, `node_modules/`, and generated test outputs, but must not ignore `plugins/`, `shared/`, `products/`, or `docs/superpowers/`.

- [ ] **Step 4: Scaffold both plugins using `plugin-creator`**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py game-design-studio --path /Users/freelife/game/gamedesign-plugin/plugins --with-skills --with-hooks --with-scripts --with-assets --with-marketplace --marketplace-path /Users/freelife/game/gamedesign-plugin/.agents/plugins/marketplace.json --marketplace-name game-design-suite --install-policy AVAILABLE --auth-policy ON_USE --category productivity
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py game-design-career --path /Users/freelife/game/gamedesign-plugin/plugins --with-skills --with-hooks --with-scripts --with-assets --with-marketplace --marketplace-path /Users/freelife/game/gamedesign-plugin/.agents/plugins/marketplace.json --install-policy AVAILABLE --auth-policy ON_USE --category education
```

Then remove only scaffolder placeholder content that the later clean build will replace; keep the valid manifest shape and marketplace entries as fixtures for the next tasks.

- [ ] **Step 5: Verify both manifests and the marketplace contract**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/game-design-studio
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/game-design-career
node --test tests/contracts/marketplace.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Commit the bootstrap**

```bash
git add .gitignore package.json .agents/plugins/marketplace.json plugins tests/contracts/marketplace.test.mjs
git commit -m "chore: scaffold game design plugin suite"
```

### Task 2: Define the deterministic product overlay and build contract

**Files:**
- Create: `shared/contracts/product.schema.json`
- Create: `tests/fixtures/minimal-product/product.json`
- Create: `tests/fixtures/minimal-product/plugin/.codex-plugin/plugin.json`
- Create: `tooling/lib/paths.mjs`
- Create: `tooling/lib/hash.mjs`
- Create: `tooling/lib/copy-tree.mjs`
- Create: `tooling/lib/product-contract.mjs`
- Create: `tooling/lib/build-product.mjs`
- Create: `tests/unit/build-product.test.mjs`

- [ ] **Step 1: Write failing tests for merge order, collision rejection, and path safety**

The tests must prove:

```js
assert.deepEqual(result.sources, ["shared", "product"]);
await assert.rejects(() => buildProduct(conflictingFixture), /content collision/i);
await assert.rejects(() => buildProduct(traversalFixture), /unsafe path/i);
assert.equal(await hasSymlink(result.outputDir), false);
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/unit/build-product.test.mjs`

Expected: FAIL because the build library does not exist.

- [ ] **Step 3: Implement the product contract**

`product.schema.json` and `product-contract.mjs` must require:

```json
{
  "schemaVersion": 1,
  "name": "minimal-product",
  "displayName": "Minimal Product",
  "description": "Fixture",
  "sharedModules": ["knowledge", "templates", "responsible-design", "export", "vendor"],
  "sharedRuntime": true,
  "sourceRoots": ["plugin"],
  "sourceDocuments": []
}
```

Reject unknown top-level keys, invalid plugin names, missing source roots, absolute paths, `..`, NUL bytes, symlinks, and duplicate normalized paths. Normalize filenames to Unicode NFC before comparing them.

- [ ] **Step 4: Implement a clean, deterministic build function**

Use this fixed deployment mapping so every product lane targets the same package paths:

| Source | Packaged destination |
| --- | --- |
| `shared/knowledge/**` | `references/shared/knowledge/**` |
| `shared/templates/**` | `assets/shared/templates/**` |
| `shared/responsible-design/**` | `references/shared/responsible-design/**` |
| `shared/export/**` | `references/shared/export/**` |
| `shared/vendor/skillstead/svg-infographic/0.8.3/**` | `skills/svg-infographic/**` |
| `shared/hooks/**` | `hooks/**` |
| `shared/scripts/**` | `scripts/**` |
| indexed `docs/**` selected by the product | `references/source/docs/**` |
| `products/<name>/plugin/**` | package root |

`sharedRuntime: true` is mandatory and enables the shared hooks/scripts rows. `sourceDocuments` or `sourceDocumentCategories` must resolve only through `shared/knowledge/reference-index.json`; a missing or ambiguous source ID is a build failure.

```js
export async function buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch = 0 }) {
  // 1. validate products/<name>/product.json
  // 2. create a new empty staging/<name>
  // 3. copy declared shared modules, selected indexed source docs, shared runtime, and product roots
  // 4. map them to the fixed deployment paths in stable lexical order
  // 5. reject different bytes targeting the same relative path
  // 6. normalize mtimes for reproducible output
  // 7. return { name, outputDir, files, sha256, sources }
}
```

Do not make `buildProduct` know Studio or Career skill names. Product-specific content belongs to the overlay.

- [ ] **Step 5: Run the focused test and add reproducibility coverage**

Run: `node --test tests/unit/build-product.test.mjs`

Expected: PASS, including equal tree hashes across two clean builds.

- [ ] **Step 6: Commit the product contract**

```bash
git add shared/contracts tests/fixtures tooling/lib tests/unit/build-product.test.mjs
git commit -m "feat: define deterministic plugin build contract"
```

### Task 3: Inventory and index all 49 source documents

**Files:**
- Create: `tooling/index-references.mjs`
- Create: `shared/knowledge/reference-index.json`
- Create: `shared/knowledge/reference-index.schema.json`
- Create: `shared/knowledge/source-policy.md`
- Create: `tests/unit/index-references.test.mjs`
- Create: `tests/contracts/reference-coverage.test.mjs`

- [ ] **Step 1: Write failing coverage tests against the actual `docs/` tree**

The contract test must discover Markdown source files under `docs/` while excluding `docs/superpowers/**`, then require exactly 49 unique entries. Each entry must include `id`, repo-relative `sourcePath`, `title`, `category`, `sha256`, `wordCount`, `claimTypes`, and `derivedCore`.

- [ ] **Step 2: Run tests and confirm the index is absent**

Run: `node --test tests/unit/index-references.test.mjs tests/contracts/reference-coverage.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement deterministic source discovery and indexing**

Use `fs.readdir({ recursive: true, withFileTypes: true })`, NFC-normalized relative paths, SHA-256, stable IDs, and stable JSON formatting. Classify the existing top-level source groups into `career`, `fun-intent`, `systems`, `content`, and `feedback`; require an explicit mapping for every source file so new uncategorized documents fail validation.

- [ ] **Step 4: Generate the index and review all exceptions**

Run: `node tooling/index-references.mjs --write`

Expected: reports `49 indexed, 0 missing, 0 duplicate paths` and writes `shared/knowledge/reference-index.json`.

- [ ] **Step 5: Run coverage and drift checks**

Run:

```bash
node tooling/index-references.mjs --check
node --test tests/unit/index-references.test.mjs tests/contracts/reference-coverage.test.mjs
```

Expected: PASS. A byte change, added file, removed file, or title collision must fail `--check` until the index is regenerated and reviewed.

- [ ] **Step 6: Commit the reference index**

```bash
git add tooling/index-references.mjs shared/knowledge tests/unit/index-references.test.mjs tests/contracts/reference-coverage.test.mjs
git commit -m "feat: index all game design source documents"
```

### Task 4: Distill shared game-design knowledge with evidence metadata

**Files:**
- Create: `shared/knowledge/core/design-intent-and-fun.md`
- Create: `shared/knowledge/core/system-design.md`
- Create: `shared/knowledge/core/content-design.md`
- Create: `shared/knowledge/core/player-experience.md`
- Create: `shared/knowledge/core/production-and-feedback.md`
- Create: `shared/knowledge/core/career-and-portfolio.md`
- Create: `shared/knowledge/core/evidence-and-freshness.md`
- Create: `shared/knowledge/trends/2026-current-practices.md`
- Create: `shared/knowledge/trends/source-register.json`
- Create: `tooling/audit-evidence.mjs`
- Create: `tests/contracts/evidence-audit.test.mjs`

- [ ] **Step 1: Write a failing evidence audit contract**

Require every Core section carrying a claim to have a stable claim ID and one of `evergreen`, `contextual`, or `time-sensitive`. Require time-sensitive items to carry `verifiedAt`, at least one primary-source URL, and a `reviewAfter` date; require contextual items to include limitations.

- [ ] **Step 2: Run the evidence test and confirm missing files fail**

Run: `node --test tests/contracts/evidence-audit.test.mjs`

- [ ] **Step 3: Write the seven Core documents from the approved design and indexed sources**

For every principle, separate:

- distilled guidance;
- source document IDs;
- applicability and counterexamples;
- whether the guidance is a source fact, synthesis, or current external claim.

Do not copy long passages from the source documents. Preserve the original files through `references/source/` during packaging.

- [ ] **Step 4: Add the current-practice register using the already researched primary-source set**

Cover at minimum AI rights/human approval, accessibility, LiveOps experiment guardrails, virtual-currency transparency, cross-platform design, UGC/modding safety, AI NPC safety, and scope control. Record title, publisher, URL, publication/update date, retrieval date `2026-08-04`, applicable region, claim IDs, and limitations. Prefer official sources such as NIST, U.S. Copyright Office, SAG-AFTRA, Xbox, Unity, PlayFab, Steam, European Commission CPC, FTC, Apple, ESA, and GDC.

- [ ] **Step 5: Implement and run the audit**

Run:

```bash
node tooling/audit-evidence.mjs --check
node --test tests/contracts/evidence-audit.test.mjs
```

Expected: PASS with a summary by claim type and zero orphan source IDs.

- [ ] **Step 6: Commit the knowledge layer**

```bash
git add shared/knowledge/core shared/knowledge/trends tooling/audit-evidence.mjs tests/contracts/evidence-audit.test.mjs
git commit -m "feat: add evidence-aware game design knowledge"
```

### Task 5: Define Canonical Artifact schemas and validators

**Files:**
- Create: `shared/export/schema/artifact.schema.json`
- Create: `shared/export/schema/evidence.schema.json`
- Create: `shared/export/schema/export-manifest.schema.json`
- Create: `shared/export/qa-contracts/md.md`
- Create: `shared/export/qa-contracts/pdf.md`
- Create: `shared/export/qa-contracts/docx.md`
- Create: `shared/export/qa-contracts/pptx.md`
- Create: `shared/export/themes/professional.json`
- Create: `shared/export/themes/portfolio.json`
- Create: `shared/scripts/validate-artifact.mjs`
- Create: `tests/unit/validate-artifact.test.mjs`
- Create: `tests/fixtures/artifacts/valid/content.md`
- Create: `tests/fixtures/artifacts/valid/evidence.yml`
- Create: `tests/fixtures/artifacts/valid/export-manifest.yml`

- [ ] **Step 1: Write failing tests for the canonical directory contract**

Test one valid artifact and failures for missing frontmatter, multiple H1s, unstable heading IDs, absolute asset paths, missing alt text, missing `claim_type`, and PPTX requests lacking `audience`, `purpose`, or `slide_outline`.

- [ ] **Step 2: Run the validator tests**

Run: `node --test tests/unit/validate-artifact.test.mjs`

Expected: FAIL because no validator exists.

- [ ] **Step 3: Implement a dependency-free validator for the constrained YAML contracts**

The parser only needs to support the documented mappings, lists, scalars, and block text. It must reject unsupported YAML features with a clear error instead of guessing. Export:

```js
export async function validateArtifact(artifactDir, { requestedFormats = [] } = {}) {
  return { ok, errors, warnings, files, requestedFormats };
}
```

- [ ] **Step 4: Encode format-specific fail-closed QA contracts**

MD is always available. PDF requires text extraction and all-page render; DOCX requires OOXML relationship validation plus semantic comparison and render; PPTX requires a separate story outline, overflow checks, and all-slide render. The schema must track `status: pending | passed | failed | unavailable` per format.

- [ ] **Step 5: Run tests and the valid fixture CLI check**

Run:

```bash
node --test tests/unit/validate-artifact.test.mjs
node shared/scripts/validate-artifact.mjs tests/fixtures/artifacts/valid
```

Expected: PASS and JSON output with `"ok": true`.

- [ ] **Step 6: Commit the artifact contract**

```bash
git add shared/export shared/scripts tests/unit/validate-artifact.test.mjs tests/fixtures/artifacts
git commit -m "feat: define canonical game design artifact"
```

### Task 6: Vendor and lock Skillstead `svg-infographic` 0.8.3

**Files:**
- Copy unchanged: `shared/vendor/skillstead/svg-infographic/0.8.3/**`
- Create: `shared/vendor/skillstead/THIRD_PARTY_NOTICES.md`
- Create: `shared/vendor/skillstead/vendor.lock.json`
- Create: `tooling/vendor-skillstead.mjs`
- Create: `tooling/verify-vendor-hash.mjs`
- Create: `tests/contracts/vendor-integrity.test.mjs`

- [ ] **Step 1: Write a failing integrity test**

The test must assert version `0.8.3`, upstream `https://github.com/kyungseo/skillstead`, license `Apache-2.0`, copyright `2026 Kyungseo Park`, required files, and an exact SHA-256 for every vendored file.

- [ ] **Step 2: Run the test and confirm the vendor tree is absent**

Run: `node --test tests/contracts/vendor-integrity.test.mjs`

- [ ] **Step 3: Implement a guarded vendor sync command**

`vendor-skillstead.mjs` must default to check-only. `--update-from /Users/freelife/.codex/skills/svg-infographic --version 0.8.3` may copy only after confirming `SKILL.md`, `LICENSE.txt`, `scripts/check-svg.mjs`, and `scripts/render.mjs`. It must reject a different declared version unless the lock and notices are deliberately updated.

- [ ] **Step 4: Copy the installed skill and generate the lock**

Run:

```bash
node tooling/vendor-skillstead.mjs --update-from /Users/freelife/.codex/skills/svg-infographic --version 0.8.3
node tooling/verify-vendor-hash.mjs
```

Expected: all files verified, zero modified upstream files.

- [ ] **Step 5: Run upstream tests and suite integrity tests**

Run:

```bash
node --test shared/vendor/skillstead/svg-infographic/0.8.3/scripts/check-svg.test.mjs shared/vendor/skillstead/svg-infographic/0.8.3/scripts/render.test.mjs
node --test tests/contracts/vendor-integrity.test.mjs
```

If Chromium is unavailable, the upstream render test may report a capability-specific skip; the SVG checker must still pass.

- [ ] **Step 6: Commit vendored Skillstead with attribution**

```bash
git add shared/vendor tooling/vendor-skillstead.mjs tooling/verify-vendor-hash.mjs tests/contracts/vendor-integrity.test.mjs
git commit -m "feat: vendor Skillstead visualization skill"
```

### Task 7: Add shared templates, responsible-design gates, hooks, and runtime probes

**Files:**
- Create: `shared/templates/canonical-artifact/**`
- Create: `shared/templates/decision-log.md`
- Create: `shared/templates/review-finding.md`
- Create: `shared/responsible-design/gates.json`
- Create: `shared/responsible-design/README.md`
- Create: `shared/hooks/hooks.json`
- Create: `shared/scripts/capability-probe.mjs`
- Create: `shared/scripts/stop-artifact-review.mjs`
- Create: `tests/unit/capability-probe.test.mjs`
- Create: `tests/unit/stop-artifact-review.test.mjs`
- Create: `tests/contracts/hooks.test.mjs`

- [ ] **Step 1: Write failing hook and re-entry tests**

Prove that SessionStart emits only detected capabilities and never mutates files. Prove that Stop ignores artifacts without the plugin marker, requests at most one corrective pass, and exits without looping when `GAME_DESIGN_REVIEW_ATTEMPT=1`.

- [ ] **Step 2: Run the focused tests**

Run: `node --test tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs`

- [ ] **Step 3: Define the responsible-design gate schema and common templates**

Required gates: `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. Each gate must declare applicability questions, blocking findings, evidence fields, approver, and allowed states.

- [ ] **Step 4: Implement hooks using stdin/stdout JSON only**

Both scripts must tolerate missing optional binaries and return structured warnings. The capability probe detects Node, Chromium, `soffice`, and the Codex bundled document/PDF/presentation capability hints without hardcoding a user-specific runtime path. The Stop hook delegates canonical validation to `validate-artifact.mjs`.

- [ ] **Step 5: Run focused and contract tests**

Run: `node --test tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs`

Expected: PASS, including the one-retry invariant.

- [ ] **Step 6: Commit hooks and shared policy**

```bash
git add shared/templates shared/responsible-design shared/hooks shared/scripts tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs
git commit -m "feat: add responsible design runtime gates"
```

### Task 8: Publish the `shared-contract-v1` checkpoint

**Files:**
- Create: `shared/contracts/README.md`
- Create: `tests/contracts/shared-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a single contract test that product lanes can run**

It must verify the product schema, canonical artifact validator, hook protocol, reference index, responsible-design gate IDs, vendor lock, and required build exports.

- [ ] **Step 2: Run all Phase A tests**

Run:

```bash
node --test tests/unit/**/*.test.mjs tests/contracts/**/*.test.mjs
node tooling/index-references.mjs --check
node tooling/audit-evidence.mjs --check
node tooling/verify-vendor-hash.mjs
```

Expected: PASS with 49 documents indexed and all vendor hashes verified.

- [ ] **Step 3: Document the exact product-lane interface**

`shared/contracts/README.md` must list the required `product.json`, plugin source root layout, role prompt contract, skill metadata contract, source-document selection, template naming, E2E fixture contract, and generated snapshot rules.

- [ ] **Step 4: Tag the checkpoint in Git history without creating a Git tag**

```bash
git add shared/contracts/README.md tests/contracts/shared-contract.test.mjs package.json
git commit -m "test: lock shared plugin contract v1"
```

**Parallelization gate:** After this commit, start the Studio and Career implementation plans concurrently. Do not begin Phase B until both plans report all product tests passing.

---

## Phase B — Integration After Both Product Plans

### Task 9: Build clean self-contained plugin snapshots

**Files:**
- Create: `tooling/sync-shared.mjs`
- Create: `tooling/build-snapshots.mjs`
- Create: `tooling/lib/tree-audit.mjs`
- Regenerate: `plugins/game-design-studio/**`
- Regenerate: `plugins/game-design-career/**`
- Test: `tests/contracts/package-contents.test.mjs`
- Test: `tests/isolation/no-cross-package-paths.test.mjs`

- [ ] **Step 1: Write failing snapshot content and path audits**

Require each plugin to contain its manifest, 10 product skills, vendored `svg-infographic`, 6 role prompts, hooks, scripts, assets, Core/Source/Current references, product profiles, templates, README, license, notices, and vendor lock. Scan UTF-8 text and symlinks for sibling names, `../shared`, and `/Users/freelife/game/gamedesign-plugin`.

- [ ] **Step 2: Implement clean snapshot generation**

`build-snapshots.mjs` must build in `mkdtemp()` staging, run tree audits, atomically replace only the two explicit plugin directories, and emit a deterministic `BUILD-MANIFEST.json` per plugin. It must accept `--check` to compare a clean temporary build with committed snapshots without modifying them.

- [ ] **Step 3: Build and inspect both snapshots**

Run:

```bash
node tooling/build-snapshots.mjs --clean
node tooling/build-snapshots.mjs --check
node --test tests/contracts/package-contents.test.mjs tests/isolation/no-cross-package-paths.test.mjs
```

Expected: PASS and no drift.

- [ ] **Step 4: Validate plugin manifests and every packaged skill**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/game-design-studio
python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/game-design-career
find plugins/game-design-studio/skills plugins/game-design-career/skills -name SKILL.md -print0 | xargs -0 -n1 dirname | while read skill_dir; do python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"; done
```

Expected: every validator exits 0.

- [ ] **Step 5: Commit generated snapshots and build tooling**

```bash
git add tooling plugins tests/contracts/package-contents.test.mjs tests/isolation/no-cross-package-paths.test.mjs
git commit -m "build: generate independent game design plugins"
```

### Task 10: Add package, isolation, hook, and install smoke validation

**Files:**
- Create: `tooling/isolation-smoke.mjs`
- Create: `tooling/validate-suite.mjs`
- Create: `tests/isolation/plugin-smoke.test.mjs`
- Create: `tests/e2e/install-marketplace-smoke.md`
- Modify: `package.json`

- [ ] **Step 1: Write a failing isolated-extraction smoke test**

For each plugin, copy only that plugin into a fresh temporary directory and prove manifest validation, skill enumeration, vendored visualization checksum, hook JSON parsing, canonical artifact generation, and MD validation without access to the repository or sibling plugin.

- [ ] **Step 2: Implement `isolation-smoke.mjs` and the suite orchestrator**

`validate-suite.mjs` must run, in order: reference drift, evidence audit, vendor hash, unit tests, contract tests, product tests, clean-build drift, official plugin validators, skill quick validators, isolation smoke, and format smoke. Stop at the first failing stage and print the exact rerun command.

- [ ] **Step 3: Run isolated and full validation**

Run:

```bash
node --test tests/isolation/plugin-smoke.test.mjs
node tooling/isolation-smoke.mjs
node tooling/validate-suite.mjs
```

Expected: all stages PASS.

- [ ] **Step 4: Perform the repo marketplace install smoke in a temporary Codex home**

Follow `tests/e2e/install-marketplace-smoke.md`: point a fresh temporary Codex home at `.agents/plugins/marketplace.json`, install one plugin at a time, start a new task, confirm skill discovery and a representative canonical MD request, then destroy only the explicit temporary directory. Record commands and observed output in the test document.

- [ ] **Step 5: Commit validation orchestration**

```bash
git add tooling/isolation-smoke.mjs tooling/validate-suite.mjs tests/isolation tests/e2e/install-marketplace-smoke.md package.json
git commit -m "test: verify standalone plugin installation"
```

### Task 11: Render and inspect all required output formats

**Files:**
- Create: `tests/formats/fixtures/studio-sample/**`
- Create: `tests/formats/fixtures/career-sample/**`
- Create: `tests/formats/verify-formats.mjs`
- Create: `tests/formats/FORMAT-RESULTS.md`
- Generate: `tests/formats/output/**`

- [ ] **Step 1: Create one valid Studio and one valid Career canonical artifact fixture**

Each fixture must include evidence, a decision log, one SVG designed through the packaged visualization wrapper, and an export manifest requesting MD, PDF, DOCX, PPTX, SVG, and 2× PNG.

- [ ] **Step 2: Produce MD, PDF, DOCX, and PPTX with the bundled Codex artifact runtimes**

Use the available `documents`, `pdf`, and `presentations` skill workflows with the bundled runtime discovered by `codex_app__load_workspace_dependencies`. Use `soffice` only as a documented fallback. Do not hardcode the current bundle version into plugin runtime code.

- [ ] **Step 3: Render and lint SVG/PNG through the packaged Skillstead copy**

Run each packaged `scripts/check-svg.mjs`, then render PNG at 2×. Assert the exact expected dimensions and preserve SVG as the editable source.

- [ ] **Step 4: Run structural and visual QA**

`verify-formats.mjs` must check file signatures, non-empty extracted text, page/slide counts, OOXML relationships, local asset existence, and expected SVG/PNG dimensions. Render every PDF page, DOCX page, and PPTX slide to images; visually inspect for overflow, clipping, broken Korean fonts, missing diagrams, and empty pages/slides. Record results and capability versions in `FORMAT-RESULTS.md`.

- [ ] **Step 5: Run format verification**

Run: `node tests/formats/verify-formats.mjs tests/formats/output`

Expected: all requested formats PASS. If a renderer is unavailable, mark that format `unavailable` and do not claim completion until the capability is restored or the approved design is revised.

- [ ] **Step 6: Commit fixtures and verified representative outputs**

```bash
git add tests/formats
git commit -m "test: verify game design document exports"
```

### Task 12: Write the complete suite README and final verification

**Files:**
- Create: `README.md`
- Create: `docs/architecture/plugin-suite.md`
- Create: `docs/architecture/export-pipeline.md`
- Create: `docs/architecture/knowledge-and-evidence.md`
- Modify: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Write a failing documentation contract**

Add `tests/contracts/readme.test.mjs` requiring README sections for purpose, plugin comparison, architecture tree, Mermaid workflow, prerequisites, repo marketplace installation, individual plugin installation, updates, uninstall, skill catalog, role behavior, parallel/fallback behavior, knowledge provenance, visualization, export formats, examples, validation, troubleshooting, licenses, limitations, and contribution workflow.

- [ ] **Step 2: Write the root README and architecture guides**

Use the approved architecture diagrams and actual commands from the validated implementation. Make clear that `agents/*.md` are role prompts orchestrated by skills, not a guaranteed native plugin component. Include a visual map of common source → product overlays → independent packages and an export pipeline diagram.

- [ ] **Step 3: Validate all README commands and links**

Run every local validation/install command shown in the README against a clean checkout or temporary directory. Run a link/path checker and confirm every relative file reference exists.

- [ ] **Step 4: Run the complete release gate**

Run:

```bash
node tooling/validate-suite.mjs
node --test tests/e2e/**/*.test.mjs tests/formats/**/*.test.mjs
git status --short
```

Expected: all tests PASS; only intentionally untracked original `docs/` source directories remain outside the implementation commit set; no generated drift.

- [ ] **Step 5: Request independent review and fix findings**

Use `superpowers:requesting-code-review` for a full suite review focused on independent installation, source/evidence integrity, hook safety, export fail-closed behavior, Skillstead licensing, and README truthfulness. Apply fixes and rerun the release gate.

- [ ] **Step 6: Commit final documentation**

```bash
git add README.md docs/architecture .agents/plugins/marketplace.json tests/contracts/readme.test.mjs
git commit -m "docs: document game design plugin suite"
```

## Final Acceptance Checklist

- [ ] The marketplace contains exactly `game-design-studio` and `game-design-career`, each pointing to its own package.
- [ ] All 49 source documents are indexed and, because both v1 products declare all five source categories, copied into each independent product under `references/source/docs/`.
- [ ] Every time-sensitive claim has current primary-source metadata and a review date.
- [ ] Both plugins pass official manifest validation and every skill passes `quick_validate.py`.
- [ ] Each plugin passes extraction and execution without the repository or sibling plugin.
- [ ] Both plugins contain an unmodified, hash-locked `svg-infographic` 0.8.3 with full attribution.
- [ ] Canonical MD is always produced; PDF, DOCX, PPTX, SVG, and PNG are only reported successful after structural and visual QA.
- [ ] Studio and Career each pass their three product E2E scenarios.
- [ ] Root and product READMEs match the verified install and usage flow.
