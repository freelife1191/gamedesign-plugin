import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { evaluateUpdateAdvisory } from "../../shared/scripts/lib/update-advisory.mjs";
import { checkGameDesignUpdates } from "../../shared/scripts/check-game-design-updates.mjs";

// The other advisory tests build their fixture URLs with encodeURIComponent, which is the same
// call the source used, so both sides agreed on a form GitHub never returns. These fixtures copy
// the release shapes the three pinned upstreams actually publish today: a tag namespaced with a
// slash, and a repository whose history still carries two-segment tags.
const repositoryRoot = new URL("../../", import.meta.url);
const policy = JSON.parse(
  await readFile(new URL("shared/updates/update-policy.json", repositoryRoot), "utf8"),
);
const checkedAt = "2026-08-17T00:00:00.000Z";

// GitHub leaves the slash of a namespaced tag literal in html_url; it percent-encodes nothing.
const githubReleaseUrl = (repository, tag) => `${repository}/releases/tag/${tag}`;

const release = (repository, tag) => ({
  tag,
  draft: false,
  prerelease: false,
  url: githubReleaseUrl(repository, tag),
});

const SKILLSTEAD = "https://github.com/kyungseo/skillstead";
const ARCHIFY = "https://github.com/tt-a1i/archify";
const IM_NOT_AI = "https://github.com/epoko77-ai/im-not-ai";

test("a namespaced upstream tag resolves against the release URL GitHub actually publishes", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "skillstead", installedTag: "svg-infographic/v0.9.0", repository: SKILLSTEAD }],
    // The real listing interleaves releases for sibling skills in the same monorepo.
    releases: {
      skillstead: [
        release(SKILLSTEAD, "svg-infographic/v0.10.0"),
        release(SKILLSTEAD, "writing-quality-editor/v0.11.0"),
        release(SKILLSTEAD, "svg-infographic/v0.9.0"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.status, "outdated");
  assert.deepEqual(advisory.components, [{
    id: "skillstead",
    installedTag: "svg-infographic/v0.9.0",
    latestTag: "svg-infographic/v0.10.0",
    status: "outdated",
    releaseUrl: `${SKILLSTEAD}/releases/tag/svg-infographic/v0.10.0`,
  }]);
});

test("a legacy two-segment tag in the history does not discard the rest of the component", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "im-not-ai", installedTag: "v2.3.0", repository: IM_NOT_AI }],
    // v1.3 and v1.2 predate the project's move to three-segment tags and never go away.
    releases: {
      "im-not-ai": [
        release(IM_NOT_AI, "v2.3.0"),
        release(IM_NOT_AI, "v1.6.1"),
        release(IM_NOT_AI, "v1.3"),
        release(IM_NOT_AI, "v1.2"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.status, "current");
  assert.equal(advisory.components[0].latestTag, "v2.3.0");
});

test("a sibling project's tag in the same repository is not mistaken for this component", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "archify", installedTag: "v2.14.0", repository: ARCHIFY }],
    // archify-dsh-v0.1.0 belongs to a different artifact and does not carry this component's prefix.
    releases: {
      archify: [
        release(ARCHIFY, "archify-dsh-v0.1.0"),
        release(ARCHIFY, "v2.14.0"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.components[0].latestTag, "v2.14.0");
  assert.equal(advisory.components[0].status, "current");
});

test("a version-shaped tag that cannot be read still forces the component to unknown", () => {
  // Widening the parser for short legacy tags must not turn into guessing at anything numeric.
  // A four-segment tag carries a version this code cannot order, so refusing to answer is correct.
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "archify", installedTag: "v2.14.0", repository: ARCHIFY }],
    releases: {
      archify: [
        release(ARCHIFY, "v2.14.0"),
        release(ARCHIFY, "v1.2.3.4"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.components[0].status, "unknown");
  assert.equal(advisory.components[0].latestTag, null);
});

// A fetch that never resolves a release still proves whether the configuration was found: the
// advisory reports one unknown component per installed component when it was, and an empty
// component list when it was not.
const failingFetch = async () => { throw new Error("offline"); };

test("the default plugin root finds the update configuration in the repository layout", async () => {
  const result = await checkGameDesignUpdates({
    env: { HOME: await mkdtemp(path.join(tmpdir(), "update-advisory-repo-home-")) },
    fetchFn: failingFetch,
  });

  assert.equal(result.components.length, 3);
  assert.deepEqual(result.components.map(({ id }) => id).sort(), ["archify", "im-not-ai", "skillstead"]);
});

test("the default plugin root finds the update configuration in the packaged layout", async (t) => {
  // Packaging moves the scripts to <plugin>/scripts and the configuration to
  // <plugin>/references/shared/updates. Nothing passes pluginRoot at that point, so the default
  // has to resolve there too.
  const root = await mkdtemp(path.join(tmpdir(), "update-advisory-packaged-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pluginRoot = path.join(root, "plugin");
  await mkdir(path.join(pluginRoot, "references", "shared"), { recursive: true });
  await cp(new URL("shared/scripts/", repositoryRoot), path.join(pluginRoot, "scripts"), { recursive: true });
  await cp(new URL("shared/updates/", repositoryRoot), path.join(pluginRoot, "references", "shared", "updates"), { recursive: true });

  const packaged = await import(pathToFileURL(path.join(pluginRoot, "scripts", "check-game-design-updates.mjs")).href);
  const result = await packaged.checkGameDesignUpdates({
    env: { HOME: path.join(root, "home") },
    fetchFn: failingFetch,
  });

  assert.equal(result.components.length, 3);
  assert.deepEqual(result.components.map(({ id }) => id).sort(), ["archify", "im-not-ai", "skillstead"]);
});
