import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateUpdateAdvisory,
  selectLatestStableRelease,
} from "../../shared/scripts/lib/update-advisory.mjs";

const policy = JSON.parse(
  await readFile(new URL("../../shared/updates/update-policy.json", import.meta.url), "utf8"),
);
const checkedAt = "2026-08-15T00:00:00.000Z";

const installed = [
  {
    id: "skillstead",
    installedTag: "svg-infographic/v0.9.0",
    repository: "https://github.com/kyungseo/skillstead",
  },
  {
    id: "archify",
    installedTag: "v2.13.0",
    repository: "https://github.com/tt-a1i/archify",
  },
  {
    id: "im-not-ai",
    installedTag: "v2.3.0",
    repository: "https://github.com/epoko77-ai/im-not-ai",
  },
];

// GitHub keeps the separator of a namespaced tag literal in html_url, so only the segments get
// encoded. Encoding the tag whole would pin these fixtures to a URL the API never returns.
const releaseUrl = (repository, tag) => `${repository}/releases/tag/${tag.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;

const currentReleases = {
  skillstead: [{
    tag: "svg-infographic/v0.9.0",
    draft: false,
    prerelease: false,
    url: releaseUrl("https://github.com/kyungseo/skillstead", "svg-infographic/v0.9.0"),
  }],
  archify: [{
    tag: "v2.13.0",
    draft: false,
    prerelease: false,
    url: releaseUrl("https://github.com/tt-a1i/archify", "v2.13.0"),
  }],
  "im-not-ai": [{
    tag: "v2.3.0",
    draft: false,
    prerelease: false,
    url: releaseUrl("https://github.com/epoko77-ai/im-not-ai", "v2.3.0"),
  }],
};

test("selects only the latest stable svg-infographic release instead of another component tag or prerelease", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [installed[0]],
    releases: {
      skillstead: [
        {
          tag: "writing-quality-editor/v0.11.0",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/kyungseo/skillstead", "writing-quality-editor/v0.11.0"),
        },
        {
          tag: "svg-infographic/v0.9.1-rc.1",
          draft: false,
          prerelease: true,
          url: releaseUrl("https://github.com/kyungseo/skillstead", "svg-infographic/v0.9.1-rc.1"),
        },
        currentReleases.skillstead[0],
      ],
    },
    checkedAt,
  });

  assert.deepEqual(got.components[0], {
    id: "skillstead",
    installedTag: "svg-infographic/v0.9.0",
    latestTag: "svg-infographic/v0.9.0",
    status: "current",
    releaseUrl: "https://github.com/kyungseo/skillstead/releases/tag/svg-infographic/v0.9.0",
  });
});

test("selectLatestStableRelease table keeps literal stable SemVer filtering closed", () => {
  const cases = [
    {
      name: "selects the newest stable archify release rather than a draft or prerelease",
      component: installed[1],
      releases: [
        currentReleases.archify[0],
        {
          tag: "v2.14.0",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14.0"),
        },
        {
          tag: "v2.15.0",
          draft: true,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.15.0"),
        },
        {
          tag: "v2.15.0-rc.1",
          draft: false,
          prerelease: true,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.15.0-rc.1"),
        },
      ],
      want: {
        tag: "v2.14.0",
        url: "https://github.com/tt-a1i/archify/releases/tag/v2.14.0",
      },
    },
    {
      name: "does not turn prerelease-only evidence into a current release",
      component: installed[2],
      releases: [{
        tag: "v2.4.0-rc.1",
        draft: false,
        prerelease: true,
        url: releaseUrl("https://github.com/epoko77-ai/im-not-ai", "v2.4.0-rc.1"),
      }],
      want: null,
    },
  ];

  for (const { name, component, releases, want } of cases) {
    assert.deepEqual(selectLatestStableRelease({ component, releases }), want, name);
  }
});

test("returns unknown rather than current when a matching release response is malformed", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [installed[1]],
    releases: {
      // A one- or two-segment tag is now read as a version, because upstreams keep publishing
      // those and refusing them stranded the whole component forever. A fourth segment is still
      // unreadable, so it must keep forcing unknown rather than being ordered on a guess.
      archify: [
        currentReleases.archify[0],
        {
          tag: "v2.14.0.1",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14.0.1"),
        },
      ],
    },
    checkedAt,
  });

  assert.deepEqual(got, {
    schemaVersion: 1,
    checkedAt,
    status: "unknown",
    components: [{
      id: "archify",
      installedTag: "v2.13.0",
      latestTag: null,
      status: "unknown",
      releaseUrl: null,
    }],
  });
});

test("excludes a well-formed non-SemVer tag without poisoning valid stable evidence", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [installed[1]],
    releases: {
      archify: [
        currentReleases.archify[0],
        {
          tag: "vnot-semver",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "vnot-semver"),
        },
        {
          tag: "v2.14.0",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14.0"),
        },
      ],
    },
    checkedAt,
  });

  assert.deepEqual(got.components[0], {
    id: "archify",
    installedTag: "v2.13.0",
    latestTag: "v2.14.0",
    status: "outdated",
    releaseUrl: "https://github.com/tt-a1i/archify/releases/tag/v2.14.0",
  });
});

test("returns unknown for a malformed numeric prerelease identifier rather than treating installed evidence as current", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [installed[1]],
    releases: {
      archify: [
        currentReleases.archify[0],
        {
          tag: "v2.14.0-01",
          draft: false,
          prerelease: true,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14.0-01"),
        },
      ],
    },
    checkedAt,
  });

  assert.deepEqual(got, {
    schemaVersion: 1,
    checkedAt,
    status: "unknown",
    components: [{
      id: "archify",
      installedTag: "v2.13.0",
      latestTag: null,
      status: "unknown",
      releaseUrl: null,
    }],
  });
});

test("excludes a valid prerelease with build metadata without poisoning stable current evidence", () => {
  const got = evaluateUpdateAdvisory({
    policy,
    installed: [installed[1]],
    releases: {
      archify: [
        currentReleases.archify[0],
        {
          tag: "v2.14.0-rc.1+build.7",
          draft: false,
          prerelease: true,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14.0-rc.1+build.7"),
        },
      ],
    },
    checkedAt,
  });

  assert.deepEqual(got.components[0], {
    id: "archify",
    installedTag: "v2.13.0",
    latestTag: "v2.13.0",
    status: "current",
    releaseUrl: "https://github.com/tt-a1i/archify/releases/tag/v2.13.0",
  });
});

test("returns unknown for a policy with an unrecognized key rather than allowing it into output", () => {
  const got = evaluateUpdateAdvisory({
    policy: { ...policy, untrustedEndpoint: "https://example.test/releases" },
    installed: [installed[2]],
    releases: { "im-not-ai": currentReleases["im-not-ai"] },
    checkedAt,
  });

  assert.deepEqual(got, {
    schemaVersion: 1,
    checkedAt,
    status: "unknown",
    components: [{
      id: "im-not-ai",
      installedTag: "v2.3.0",
      latestTag: null,
      status: "unknown",
      releaseUrl: null,
    }],
  });
  assert.deepEqual(Reflect.ownKeys(got).sort(), ["checkedAt", "components", "schemaVersion", "status"]);
  assert.deepEqual(Reflect.ownKeys(got.components[0]).sort(), ["id", "installedTag", "latestTag", "releaseUrl", "status"]);
});

test("produces a deeply frozen deterministic advisory", () => {
  const got = evaluateUpdateAdvisory({ policy, installed, releases: currentReleases, checkedAt });

  assert.equal(got.status, "current");
  assert.equal(Object.isFrozen(got), true);
  assert.equal(Object.isFrozen(got.components), true);
  assert.ok(got.components.every((component) => Object.isFrozen(component)));
  assert.throws(() => { got.components[0].status = "outdated"; }, TypeError);
});

const SUITE_REPOSITORY = "https://github.com/freelife1191/gamedesign-plugin";
const releaseFor = (repository, tag) => ({
  tag,
  draft: false,
  prerelease: false,
  url: releaseUrl(repository, tag),
});

test("the suite itself is a comparable component with a closed release rule", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "game-design-suite", installedTag: "v0.1.1", repository: SUITE_REPOSITORY }],
    releases: {
      "game-design-suite": [
        releaseFor(SUITE_REPOSITORY, "v0.2.0"),
        releaseFor(SUITE_REPOSITORY, "v0.1.1"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.status, "outdated");
  assert.equal(advisory.components[0].latestTag, "v0.2.0");
  assert.equal(advisory.components[0].releaseUrl, `${SUITE_REPOSITORY}/releases/tag/v0.2.0`);
});

test("a suite draft or prerelease never becomes the latest release", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "game-design-suite", installedTag: "v0.1.1", repository: SUITE_REPOSITORY }],
    releases: {
      "game-design-suite": [
        { ...releaseFor(SUITE_REPOSITORY, "v0.3.0"), draft: true },
        { ...releaseFor(SUITE_REPOSITORY, "v0.2.0"), prerelease: true },
        releaseFor(SUITE_REPOSITORY, "v0.1.1"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.status, "current");
  assert.equal(advisory.components[0].latestTag, "v0.1.1");
});

test("a repository outside the four entry allowlist is refused", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{
      id: "game-design-suite",
      installedTag: "v0.1.1",
      repository: "https://github.com/attacker/gamedesign-plugin",
    }],
    releases: { "game-design-suite": [] },
    checkedAt,
  });

  // A repository the rule table does not know is not merely uncomparable. It is refused before it
  // reaches the component list, so there is nothing to report a version against.
  assert.equal(advisory.status, "unknown");
  assert.deepEqual(advisory.components, []);
});

// The version bump lands before the release is published, so every build made from that commit
// runs ahead of the newest release until it goes out. Calling that unknown would turn the whole
// advisory unknown and silence the bundled upstream notices for the entire window.
test("a suite build that runs ahead of its own newest release is current, not unknown", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "game-design-suite", installedTag: "v0.1.2", repository: SUITE_REPOSITORY }],
    releases: { "game-design-suite": [releaseFor(SUITE_REPOSITORY, "v0.1.1")] },
    checkedAt,
  });

  assert.equal(advisory.status, "current");
  assert.equal(advisory.components[0].status, "current");
  assert.equal(advisory.components[0].latestTag, "v0.1.1");
});

test("a bundled upstream that claims a tag nobody published stays unknown", () => {
  const repository = "https://github.com/tt-a1i/archify";
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{ id: "archify", installedTag: "v2.13.0", repository }],
    releases: { archify: [releaseFor(repository, "v2.12.0")] },
    checkedAt,
  });

  // Only the suite ships ahead of its own release on purpose. For a vendored upstream the same
  // state means the lock file disagrees with the upstream, which is not something to guess about.
  assert.equal(advisory.status, "unknown");
  assert.equal(advisory.components[0].latestTag, null);
});
