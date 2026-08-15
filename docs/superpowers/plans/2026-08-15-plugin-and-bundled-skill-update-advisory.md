# Plugin And Bundled Skill Update Advisory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설치 뒤 첫 세션과 이후 7일 간격으로 플러그인·번들 스킬의 최신 버전을 안전하게 확인하고, 업데이트가 있으면 자동 적용 없이 명시적 재설치·유지보수 절차를 안내한다.

**Architecture:** 순수 update evaluator와 파일시스템·네트워크 adapter를 분리한다. 기존 `SessionStart` capability probe는 캐시된 advisory를 추가하되 본래 capability/image 계약과 작업 성공 여부를 유지한다. 저장소 측 updater는 vendor lock을 단일 권위로 사용하고, 정기 CI와 release gate가 최신 상태를 검사한 뒤 검증된 plugin snapshot만 배포한다.

**Tech Stack:** Node.js 18+ ESM, `node:test`, JSON Schema, Codex plugin hooks/CLI, GitHub Releases API, 기존 snapshot build·vendor updater·Archify QA 도구.

**Spec:** `docs/superpowers/specs/2026-08-15-plugin-and-bundled-skill-update-advisory-design.md`

## Global Constraints

- 사용자 승인 없이 `codex plugin add`, `codex plugin marketplace upgrade`, vendor updater 또는 원격 코드 적용을 실행하지 않는다.
- `SessionStart` 검사는 최초 실행 또는 정상 캐시가 7일보다 오래됐을 때만 네트워크를 사용한다.
- `GAME_DESIGN_UPDATE_CHECKS=false`이면 네트워크와 update cache 쓰기를 모두 생략한다.
- GitHub allowlist는 `kyungseo/skillstead`, `tt-a1i/archify`, `epoko77-ai/im-not-ai`만 허용한다.
- draft, prerelease, malformed SemVer와 다른 component tag는 최신 안정 버전 후보에서 제외한다.
- 네트워크·캐시 오류는 본래 플러그인 기능을 막지 않고 `unknown`으로 반환한다.
- 설치 cache 안의 bundled skill을 개별 수정하지 않는다. end user update 단위는 Game Design Suite plugin이다.
- 두 제품은 update policy, installed vendor manifest, cache와 notification identity를 공유한다.
- 사용자 프로젝트 경로·프롬프트·API key·GitHub token을 원격 요청 또는 cache에 기록하지 않는다.
- 기존 `docs/LLM WIKI/` 사용자 파일을 읽기·수정·stage하지 않는다.

---

### Task 1: Closed Update Policy And Pure Release Evaluator

**Files:**
- Create: `shared/updates/update-policy.json`
- Create: `shared/updates/update-advisory.schema.json`
- Create: `shared/scripts/lib/update-advisory.mjs`
- Create: `tests/unit/update-advisory.test.mjs`
- Modify: `tooling/lib/product-contract.mjs`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`

**Interfaces:**
- Consumes: update policy JSON and installed component records `{ id, installedTag, repository }`.
- Produces: `evaluateUpdateAdvisory({ policy, installed, releases, checkedAt })` returning a deeply frozen `{ schemaVersion: 1, checkedAt, status, components }` object.
- Produces: `selectLatestStableRelease({ component, releases })` with literal stable SemVer filtering.

- [ ] **Step 1: Write failing evaluator tests**

Add table-driven tests with hand-written expected values. Name the protected production break in each test: selecting another component tag, accepting prerelease, treating malformed responses as current, and allowing unknown output keys.

```js
test("selects only the latest stable svg-infographic release", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "skillstead", installedTag: "svg-infographic/v0.9.0", repository: "https://github.com/kyungseo/skillstead" }],
    releases: { skillstead: [
      { tag: "writing-quality-editor/v0.11.0", draft: false, prerelease: false, url: "https://github.com/kyungseo/skillstead/releases/tag/writing-quality-editor%2Fv0.11.0" },
      { tag: "svg-infographic/v0.9.1-rc.1", draft: false, prerelease: true, url: "https://github.com/kyungseo/skillstead/releases/tag/svg-infographic%2Fv0.9.1-rc.1" },
      { tag: "svg-infographic/v0.9.0", draft: false, prerelease: false, url: "https://github.com/kyungseo/skillstead/releases/tag/svg-infographic%2Fv0.9.0" },
    ] },
    checkedAt: "2026-08-15T00:00:00.000Z",
  });
  assert.deepEqual(got.components[0], {
    id: "skillstead",
    installedTag: "svg-infographic/v0.9.0",
    latestTag: "svg-infographic/v0.9.0",
    status: "current",
    releaseUrl: "https://github.com/kyungseo/skillstead/releases/tag/svg-infographic%2Fv0.9.0",
  });
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/update-advisory.test.mjs`

Expected: FAIL because `shared/scripts/lib/update-advisory.mjs` and the closed schemas do not exist.

- [ ] **Step 3: Implement minimal policy and evaluator**

Use exact component rules:

```js
const COMPONENTS = Object.freeze({
  skillstead: Object.freeze({ prefix: "svg-infographic/v", repository: "https://github.com/kyungseo/skillstead" }),
  archify: Object.freeze({ prefix: "v", repository: "https://github.com/tt-a1i/archify" }),
  "im-not-ai": Object.freeze({ prefix: "v", repository: "https://github.com/epoko77-ai/im-not-ai" }),
});
```

Reject unknown policy keys and return `unknown`, never `current`, when release evidence is unavailable or malformed.

- [ ] **Step 4: Run GREEN and schema parse checks**

Run:

```bash
node --test tests/unit/update-advisory.test.mjs
node -e 'JSON.parse(require("fs").readFileSync("shared/updates/update-policy.json")); JSON.parse(require("fs").readFileSync("shared/updates/update-advisory.schema.json"))'
```

Expected: all tests pass and both JSON files parse.

- [ ] **Step 5: Commit Task 1**

```bash
git add shared/updates shared/scripts/lib/update-advisory.mjs tests/unit/update-advisory.test.mjs tooling/lib/product-contract.mjs products/game-design-studio/product.json products/game-design-career/product.json
git commit -m "feat: define plugin update advisory contract"
```

### Task 2: Installed Version Manifest And Lock-Driven Vendor Paths

**Files:**
- Create: `tooling/lib/vendor-components.mjs`
- Create: `tooling/generate-update-manifest.mjs`
- Create: `shared/updates/installed-components.json`
- Create: `tests/unit/vendor-components.test.mjs`
- Modify: `tooling/lib/build-product.mjs`
- Modify: `tooling/lib/user-guides.mjs`
- Modify: `tooling/lib/archify-catalog.mjs`
- Modify: `tooling/isolation-smoke.mjs`
- Modify: `tests/contracts/shared-contract.test.mjs`
- Modify: `tests/contracts/archify-catalog.test.mjs`
- Modify: `tests/unit/user-guides.test.mjs`
- Modify: `tests/unit/diagram-skill-vendor.test.mjs`

**Interfaces:**
- Produces: `loadVendorComponents({ repoRoot })` returning exact records from the three `vendor.lock.json` files.
- Produces: `vendorMappings({ repoRoot })` returning source→package mappings without hard-coded current version directories.
- Produces: deterministic `shared/updates/installed-components.json` with plugin-independent installed tags, commits and official repositories.

- [ ] **Step 1: Write failing lock-driven path tests**

Create a temp repository fixture whose Archify lock points at `archify/2.14.0`. Assert build and guide/catalog resolvers use that root without any `2.13.0` literal fixture rewrite.

```js
assert.deepEqual(
  vendorMappings({ repoRoot: fixtureRoot }).archify,
  [["shared/vendor/archify/archify/2.14.0", "skills/archify"]],
);
```

Also mutate a tree root to `../../outside` and assert a stable containment error before any copy.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/vendor-components.test.mjs tests/unit/build-product.test.mjs tests/unit/user-guides.test.mjs`

Expected: FAIL because production still embeds version directories.

- [ ] **Step 3: Implement the lock loader and deterministic manifest generator**

`loadVendorComponents()` must validate repository, stable tag, commit SHA and contained tree root before returning:

```js
{
  id: "archify",
  repository: "https://github.com/tt-a1i/archify",
  installedTag: "v2.13.0",
  commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3",
  sourceRoot: "shared/vendor/archify/archify/2.13.0",
  destinationRoot: "skills/archify"
}
```

Historical design documents remain unchanged; only active production, tests and generated catalogs move to lock-driven resolution.

- [ ] **Step 4: Generate manifest and run GREEN**

Run:

```bash
node tooling/generate-update-manifest.mjs
node --test tests/unit/vendor-components.test.mjs tests/unit/build-product.test.mjs tests/unit/user-guides.test.mjs tests/contracts/shared-contract.test.mjs tests/contracts/archify-catalog.test.mjs
node tooling/generate-update-manifest.mjs --check
```

Expected: exact current versions are generated and a temp 2.14 fixture passes without production source replacement.

- [ ] **Step 5: Commit Task 2**

```bash
git add tooling/lib/vendor-components.mjs tooling/generate-update-manifest.mjs shared/updates/installed-components.json tooling/lib/build-product.mjs tooling/lib/user-guides.mjs tooling/lib/archify-catalog.mjs tooling/isolation-smoke.mjs tests/unit/vendor-components.test.mjs tests/unit/build-product.test.mjs tests/unit/user-guides.test.mjs tests/unit/diagram-skill-vendor.test.mjs tests/contracts/shared-contract.test.mjs tests/contracts/archify-catalog.test.mjs
git commit -m "refactor: derive bundled skill paths from vendor locks"
```

### Task 3: Safe Network Check, Shared Seven-Day Cache And Opt-Out

**Files:**
- Create: `shared/scripts/check-game-design-updates.mjs`
- Create: `tests/unit/game-design-update-check.test.mjs`
- Modify: `shared/scripts/lib/update-advisory.mjs`

**Interfaces:**
- Produces: `checkGameDesignUpdates({ pluginRoot, env, home, now, fetchFn, fsOps })`.
- Produces: `resolveUpdateCachePath({ env, home, platform })`.
- Produces: CLI JSON with exact top-level keys `schemaVersion`, `checkedAt`, `cache`, `status`, `components`, `notification`.

- [ ] **Step 1: Write failing cache and hostile-network tests**

Use real temp files and a narrow `fetchFn` only at the external HTTP boundary. Assert literal URLs, call counts and full response shapes.

```js
test("reuses a six-day cache without network access", async () => {
  const fetchFn = () => { throw new Error("network must not run"); };
  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse("2026-08-21T00:00:00Z"), fetchFn });
  assert.equal(result.cache, "hit");
  assert.equal(result.checkedAt, "2026-08-15T00:00:00.000Z");
});
```

Required cases: no cache, exact seven-day boundary, older cache, Studio/Career concurrent calls, symlink cache, future timestamp, partial JSON, unknown key, 403/404/429/500, timeout, malformed response, redirects to untrusted host, disabled env and atomic cache publication.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/game-design-update-check.test.mjs`

Expected: FAIL because the checker does not exist.

- [ ] **Step 3: Implement the smallest safe checker**

Use `AbortController`, exact official endpoints and one shared operation lock. Read and write cache with no-follow regular-file checks. The public result must not include cache paths, HOME, workspace paths or raw response bodies.

```js
if (env.GAME_DESIGN_UPDATE_CHECKS === "false") {
  return disabledAdvisory(now);
}
```

On lock contention, read the winner's cache after a bounded wait; do not issue a duplicate network request.

- [ ] **Step 4: Run GREEN and mutation probes**

Run:

```bash
node --test tests/unit/game-design-update-check.test.mjs tests/unit/update-advisory.test.mjs
node --check shared/scripts/check-game-design-updates.mjs
node --check shared/scripts/lib/update-advisory.mjs
```

Temporarily mutate the cache age comparison from `>=` to `>` and confirm the exact seven-day test fails; restore the file before continuing.

- [ ] **Step 5: Commit Task 3**

```bash
git add shared/scripts/check-game-design-updates.mjs shared/scripts/lib/update-advisory.mjs tests/unit/game-design-update-check.test.mjs
git commit -m "feat: add cached bundled skill update checks"
```

### Task 4: SessionStart Advisory Without Breaking Capability Detection

**Files:**
- Modify: `shared/scripts/capability-probe.mjs`
- Modify: `shared/hooks/hooks.json`
- Modify: `tests/unit/capability-probe.test.mjs`
- Modify: `tests/contracts/shared-contract.test.mjs`

**Interfaces:**
- `runCapabilityProbe({ updateOptions } = {})` includes public `updates` and serializes the same value inside `hookSpecificOutput.additionalContext`.
- Existing `capabilities`, `imageConfig`, `warnings` and hook event meaning remain intact.

- [ ] **Step 1: Write failing hook contract tests**

Add a real script-spawn test with an isolated HOME and controlled local HTTP fixture or injected module test. Assert:

```js
assert.deepEqual(Object.keys(output).sort(), [
  "capabilities", "hookSpecificOutput", "imageConfig", "updates", "warnings",
]);
assert.deepEqual(JSON.parse(output.hookSpecificOutput.additionalContext).updates, output.updates);
```

Cover first advisory, cache hit, same-version notification suppression, newer-version notification, offline `unknown`, opt-out and zero project-tree writes.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/capability-probe.test.mjs tests/contracts/shared-contract.test.mjs`

Expected: FAIL because `updates` is absent.

- [ ] **Step 3: Integrate the checker**

Keep one SessionStart command. Increase its timeout only to the smallest value proven by the bounded checker. Do not add a second hook that could race the shared cache.

The notification object is data, not a self-executing command:

```js
{
  kind: "update-available",
  prompt: "플러그인 업데이트를 확인해 줘",
  componentIds: ["archify"]
}
```

- [ ] **Step 4: Run GREEN and package hook smoke**

Run:

```bash
node --test tests/unit/capability-probe.test.mjs tests/contracts/shared-contract.test.mjs
node --check shared/scripts/capability-probe.mjs
```

Expected: existing capability tests and new advisory tests pass; offline hook exit is 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add shared/scripts/capability-probe.mjs shared/hooks/hooks.json tests/unit/capability-probe.test.mjs tests/contracts/shared-contract.test.mjs
git commit -m "feat: surface update advice at session start"
```

### Task 5: Explicit Plugin Marketplace Update Inspection

**Files:**
- Create: `shared/scripts/inspect-game-design-plugin-updates.mjs`
- Create: `tests/unit/plugin-update-inspection.test.mjs`
- Modify: `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`

**Interfaces:**
- Produces: `inspectPluginUpdates({ codexPath, marketplaceName, runCommand })` using only `plugin list --marketplace game-design-suite --available --json`.
- Produces: `planApprovedPluginUpdate({ marketplace, plugin, installedVersion, availableVersion })` returning literal argv arrays; it never executes them.
- CLI flags: `--inspect` is read-only; `--plan <game-design-studio|game-design-career>` prints the proposed commands.

- [ ] **Step 1: Write failing real-CLI inspection tests**

Use isolated HOME/CODEX_HOME and the real local marketplace. Install `0.1.0`, change only the temp marketplace source manifest to `0.1.1`, then assert inspection reports installed and available versions without reinstalling or changing cache bytes.

For a Git marketplace fixture, assert the proposed argv begins with:

```js
[
  ["plugin", "marketplace", "upgrade", "game-design-suite", "--json"],
  ["plugin", "add", "game-design-studio@game-design-suite", "--json"],
]
```

For a local marketplace, assert only the second command is proposed.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/plugin-update-inspection.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`

Expected: FAIL because the inspection API is absent.

- [ ] **Step 3: Implement inspection and plan-only output**

Use `spawnSync`/`execFile` with argv arrays and `shell: false`. Reject unknown marketplace names, plugin IDs, extra JSON keys, malformed versions and non-local/non-Git sources. Do not expose absolute cache paths.

- [ ] **Step 4: Run GREEN and prove no implicit update**

Run:

```bash
node --test tests/unit/plugin-update-inspection.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
node --check shared/scripts/inspect-game-design-plugin-updates.mjs
```

Snapshot isolated HOME/CODEX_HOME before and after `--inspect` and `--plan`; only the explicit test setup may differ.

- [ ] **Step 5: Commit Task 5**

```bash
git add shared/scripts/inspect-game-design-plugin-updates.mjs tests/unit/plugin-update-inspection.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
git commit -m "feat: inspect game design plugin updates"
```

### Task 6: Scheduled Maintainer Check And Verified Archify 2.14 Update

**Files:**
- Create: `.github/workflows/check-bundled-skill-updates.yml`
- Create: `tooling/check-suite-updates.mjs`
- Create: `tests/unit/check-suite-updates.test.mjs`
- Modify: `package.json`
- Modify: `shared/vendor/archify/vendor.lock.json`
- Replace: `shared/vendor/archify/archify/2.13.0/**` with trusted `shared/vendor/archify/archify/2.14.0/**`
- Modify: active Archify catalog entries, notices and generated diagrams required by validation

**Interfaces:**
- `npm run check:updates` returns structured current/outdated/unknown JSON and exit 0 for current, exit 2 for outdated, exit 1 for invalid/unknown.
- `npm run validate:release:latest` runs a fresh update audit followed by the existing release validation.
- Weekly workflow runs read-only and writes the JSON summary to the GitHub step summary; it never commits.

- [ ] **Step 1: Write failing aggregate and workflow contract tests**

Test exact exit classification with injected diagram/im-not-ai results. Parse the workflow YAML and assert weekly `schedule` plus `workflow_dispatch`, read-only contents permission, no write token and no update command.

- [ ] **Step 2: Run RED**

Run: `node --test tests/unit/check-suite-updates.test.mjs`

Expected: FAIL because the aggregate command and workflow are absent.

- [ ] **Step 3: Implement aggregate commands and run current latest check**

Add scripts:

```json
{
  "check:updates": "node tooling/check-suite-updates.mjs",
  "validate:release:latest": "node tooling/check-suite-updates.mjs --require-current && node tooling/validate-suite.mjs --release"
}
```

Run `npm run check:updates` and preserve its expected `outdated` result for Archify 2.13.0→2.14.0 as RED evidence.

- [ ] **Step 4: Update Archify with the existing trusted updater**

Run: `npm run update:diagram-archify`

Expected: official repository, stable tag `v2.14.0`, immutable tag commit, release asset, license and complete file closure are verified before publish.

Do not hand-edit the downloaded vendor tree. Review changelog and exact tree diff before regenerating dependent artifacts.

- [ ] **Step 5: Regenerate and verify Archify consumers**

Run:

```bash
npm run check:diagram-skills
npm run validate:archify-catalog
npm run build:curated-archify
npm run check:curated-archify
node tooling/build-archify-contact-sheets.mjs --check
npm run check:updates
```

Expected: Archify reports current at `v2.14.0`; all curated diagrams pass structural and visual gates. Inspect every changed PNG at original resolution and correct overlaps/clipping before accepting.

- [ ] **Step 6: Run GREEN**

Run:

```bash
node --test tests/unit/check-suite-updates.test.mjs tests/unit/diagram-skill-vendor.test.mjs tests/contracts/archify-catalog.test.mjs
npm run validate:release:latest
```

Expected: all current, no unknown component, release validation passes.

- [ ] **Step 7: Commit Task 6**

```bash
git add .github/workflows/check-bundled-skill-updates.yml tooling/check-suite-updates.mjs tests/unit/check-suite-updates.test.mjs tests/unit/diagram-skill-vendor.test.mjs tests/contracts/archify-catalog.test.mjs package.json shared/vendor/archify/vendor.lock.json shared/vendor/archify/archify/2.14.0 shared/vendor/archify/THIRD_PARTY_NOTICES.md guides/archify-diagrams/catalog.json guides/assets/archify products/game-design-studio/plugin/THIRD_PARTY_NOTICES.md products/game-design-career/plugin/THIRD_PARTY_NOTICES.md shared/contracts/README.md
git add -u shared/vendor/archify/archify/2.13.0
git commit -m "chore: track and update bundled skill releases"
```

Before committing, inspect `git diff --cached --name-only` and unstage any file not caused by the Archify update or update advisory contracts.

### Task 7: Documentation, Snapshot Build And Full Lifecycle Closure

**Files:**
- Modify: `README.md`
- Modify: `products/game-design-studio/plugin/README.md`
- Modify: `products/game-design-career/plugin/README.md`
- Modify: `shared/contracts/README.md`
- Modify: `products/game-design-studio/plugin/.codex-plugin/plugin.json`
- Modify: `products/game-design-career/plugin/.codex-plugin/plugin.json`
- Regenerate: `plugins/game-design-studio/**`
- Regenerate: `plugins/game-design-career/**`
- Create: `tests/e2e/suite/plugin-update-advisory.e2e.test.mjs`
- Modify: package, guide and marketplace contract tests whose exact inventory changes

**Interfaces:**
- Both product manifests move from `0.1.0` to `0.1.1` for this backward-compatible update channel feature.
- User docs expose `플러그인 업데이트를 확인해 줘`, opt-out and explicit approval boundary.

- [ ] **Step 1: Write failing documentation and E2E contracts**

E2E must install both freshly built products into one isolated HOME/CODEX_HOME, run first SessionStart, reuse the shared cache, simulate offline status and prove no plugin add/marketplace upgrade occurs before explicit execution.

```js
assert.equal(first.updates.notification.kind, "update-available");
assert.equal(second.updates.cache, "hit");
assert.equal(networkRequests.length, 3);
assert.deepEqual(await snapshotProjectTree(workspace), before);
```

Documentation tests must validate meaning through the parsed guide model: first-run check, seven-day interval, opt-out, no automatic update, local/Git marketplace distinction and new-thread handoff.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tests/e2e/suite/plugin-update-advisory.e2e.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/package-contents.test.mjs
```

Expected: FAIL because docs, version bump and generated snapshots are stale.

- [ ] **Step 3: Write concise Korean documentation and bump source manifests**

Document that the check is advisory, bundles stay pinned until suite release, and users should never edit installed cache folders. Keep the same facts in root, Studio and Career docs without copying implementation details into beginner sections.

- [ ] **Step 4: Build snapshots once and check drift**

Run:

```bash
npm run build
npm run build -- --check
```

Expected: Career and Studio snapshots contain byte-exact update policy, installed manifest, scripts, schema and Archify 2.14 bundle.

- [ ] **Step 5: Run targeted and full verification**

Run:

```bash
node --test tests/unit/update-advisory.test.mjs tests/unit/game-design-update-check.test.mjs tests/unit/plugin-update-inspection.test.mjs tests/unit/capability-probe.test.mjs tests/e2e/suite/plugin-update-advisory.e2e.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
npm run test:unit
npm run test:contracts
npm run test:products
node tooling/validate-packages.mjs plugins
node tooling/validate-packages.mjs skills
npm run validate:guides
npm run build -- --check
npm run check:updates
git diff --check
```

Expected: all tests pass, both plugin validators pass, all skills validate, update status is current and no ignored/user file is staged.

- [ ] **Step 6: Verify installed behavior in a clean temporary environment**

Run the local marketplace lifecycle:

```text
marketplace add → Studio add → Career add → list → advisory first run → advisory cache hit → Studio remove/re-add → both remove → marketplace remove
```

Assert exact plugin versions `0.1.1`, Career/Studio skill and agent inventories, shared cache cleanup policy, project memory and unrelated files unchanged, and zero `codex exec` calls.

- [ ] **Step 7: Commit Task 7**

```bash
git add README.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md products/game-design-studio/plugin/.codex-plugin/plugin.json products/game-design-career/plugin/.codex-plugin/plugin.json shared/contracts/README.md plugins/game-design-studio plugins/game-design-career tests/e2e/suite/plugin-update-advisory.e2e.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/package-contents.test.mjs tests/isolation/plugin-smoke.test.mjs tests/unit/marketplace-smoke.test.mjs
git commit -m "feat: advise verified game design suite updates"
```

- [ ] **Step 8: Final completion review**

Review the cumulative diff against the approved spec. Confirm no pending placeholders, no direct fetch outside the allowlisted checker, no shell command construction, no automatic update call, no `docs/LLM WIKI/` staging and a clean tracked worktree.

Record the exact test counts, build hashes, installed plugin versions, bundled component versions, offline limitation and unavailable formal diagnostics in the final handoff.
