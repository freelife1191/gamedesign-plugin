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

const releaseUrl = (repository, tag) => `${repository}/releases/tag/${encodeURIComponent(tag)}`;

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
    releaseUrl: "https://github.com/kyungseo/skillstead/releases/tag/svg-infographic%2Fv0.9.0",
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
      archify: [
        currentReleases.archify[0],
        {
          tag: "v2.14",
          draft: false,
          prerelease: false,
          url: releaseUrl("https://github.com/tt-a1i/archify", "v2.14"),
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
