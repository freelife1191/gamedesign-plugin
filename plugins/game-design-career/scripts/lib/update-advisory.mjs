const COMPONENTS = Object.freeze({
  skillstead: Object.freeze({ prefix: "svg-infographic/v", repository: "https://github.com/kyungseo/skillstead" }),
  archify: Object.freeze({ prefix: "v", repository: "https://github.com/tt-a1i/archify" }),
  "im-not-ai": Object.freeze({ prefix: "v", repository: "https://github.com/epoko77-ai/im-not-ai" }),
  // The suite compares against its own releases, so the advisory can report that the plugin the
  // user installed is behind, not only that a bundled upstream is. It is also the only component
  // whose installed version can legitimately run ahead of the newest published release: the version
  // bump lands before the release is published, so every build from that commit is ahead until it
  // is. A vendored upstream claiming a tag nobody published stays unknown, because there the same
  // state means the lock file disagrees with reality.
  "game-design-suite": Object.freeze({ prefix: "v", repository: "https://github.com/freelife1191/gamedesign-plugin", aheadOfLatestIsCurrent: true }),
});

const POLICY_KEYS = Object.freeze([
  "schemaVersion",
  "checkIntervalDays",
  "totalTimeoutMs",
  "marketplaceName",
  "productIds",
  "components",
  "stableReleasesOnly",
]);
const INSTALLED_KEYS = Object.freeze(["id", "installedTag", "repository"]);
const RELEASE_KEYS = Object.freeze(["tag", "draft", "prerelease", "url"]);
const ADVISORY_KEYS = Object.freeze(["schemaVersion", "checkedAt", "status", "components"]);
const COMPONENT_ADVISORY_KEYS = Object.freeze(["id", "installedTag", "latestTag", "status", "releaseUrl"]);
const SEMVER_IDENTIFIER = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const SEMVER = new RegExp(`^(?<major>0|[1-9]\\d*)\\.(?<minor>0|[1-9]\\d*)\\.(?<patch>0|[1-9]\\d*)(?:-(?<prerelease>${SEMVER_IDENTIFIER}(?:\\.${SEMVER_IDENTIFIER})*))?(?:\\+(?<build>[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`, "u");
const NUMERIC_SEMVER_INTENT = /^\d/u;

function hasExactKeys(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length
    && ownKeys.every((key) => typeof key === "string" && keys.includes(key))
    && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
    });
}

function compareTextIntegers(left, right) {
  if (left.length !== right.length) return left.length - right.length;
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareVersions(left, right) {
  const leftParts = left.match(SEMVER)?.groups;
  const rightParts = right.match(SEMVER)?.groups;
  if (!leftParts || !rightParts) return null;
  for (const key of ["major", "minor", "patch"]) {
    const compared = compareTextIntegers(leftParts[key], rightParts[key]);
    if (compared !== 0) return compared;
  }
  return 0;
}

// Upstreams that predate their own tagging convention keep publishing short tags forever
// (im-not-ai still lists v1.2 and v1.3). Padding those to three segments makes them orderable,
// so one old tag cannot force the whole component to unknown. Anything wider than a bare one- or
// two-segment number is left alone and still fails to parse, which keeps the refuse-to-guess rule.
const SHORT_NUMERIC_VERSION = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?$/u;

function paddedVersion(version) {
  if (!SHORT_NUMERIC_VERSION.test(version)) return version;
  const parts = version.split(".");
  while (parts.length < 3) parts.push("0");
  return parts.join(".");
}

function stableVersionFor(rule, tag) {
  if (typeof tag !== "string" || !tag.startsWith(rule.prefix)) return null;
  const version = paddedVersion(tag.slice(rule.prefix.length));
  const parsed = version.match(SEMVER)?.groups;
  return parsed && parsed.prerelease === undefined ? version : null;
}

export function canonicalReleaseUrl(repository, tag) {
  // GitHub leaves the separators of a namespaced tag literal in html_url, so encoding the tag
  // whole turns svg-infographic/v0.10.0 into svg-infographic%2Fv0.10.0 and no skillstead release
  // ever matches. Encode each segment and rejoin to keep the anchor exact.
  const encodedTag = tag.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${repository}/releases/tag/${encodedTag}`;
}

// A git tag carries no draft or prerelease flag, so evidence taken from tags has to derive the one
// fact the advisory reads: whether the tag names a prerelease. Without this a tag like v1.0.0-rc.1
// would arrive flagged stable, and inspectReleases would refuse the whole component rather than
// skip that one tag. Tags the component's own prefix rule does not cover stay false, because
// inspectReleases already ignores a tag it cannot own.
export function tagIsPrerelease(componentId, tag) {
  const rule = COMPONENTS[componentId];
  if (rule === undefined || typeof tag !== "string" || !tag.startsWith(rule.prefix)) return false;
  return paddedVersion(tag.slice(rule.prefix.length)).match(SEMVER)?.groups?.prerelease !== undefined;
}

function componentRule(component) {
  const id = typeof component === "string" ? component : component?.id;
  const rule = COMPONENTS[id];
  if (!rule) return null;
  if (typeof component === "object" && component !== null && component.repository !== rule.repository) return null;
  return { id, ...rule };
}

function releaseIsWellFormed(release, rule) {
  return hasExactKeys(release, RELEASE_KEYS)
    && typeof release.tag === "string"
    && typeof release.draft === "boolean"
    && typeof release.prerelease === "boolean"
    && typeof release.url === "string"
    && release.url === canonicalReleaseUrl(rule.repository, release.tag);
}

function inspectReleases(component, releases) {
  const rule = componentRule(component);
  if (!rule || !Array.isArray(releases)) return { valid: false, latest: null };
  let latest = null;
  for (const release of releases) {
    if (!releaseIsWellFormed(release, rule)) return { valid: false, latest: null };
    const version = stableVersionFor(rule, release.tag);
    if (version === null) {
      const suffix = release.tag.startsWith(rule.prefix) ? release.tag.slice(rule.prefix.length) : null;
      const parsed = suffix === null ? null : suffix.match(SEMVER)?.groups;
      if (suffix !== null
        && NUMERIC_SEMVER_INTENT.test(suffix)
        && !(release.prerelease && parsed?.prerelease !== undefined)) {
        return { valid: false, latest: null };
      }
      continue;
    }
    if (release.draft || release.prerelease) continue;
    if (latest === null || compareVersions(version, latest.version) > 0) {
      latest = { tag: release.tag, url: release.url, version };
    }
  }
  return { valid: true, latest };
}

function freezeAdvisory(value) {
  for (const component of value.components) Object.freeze(component);
  Object.freeze(value.components);
  return Object.freeze(value);
}

function unknownComponent(component) {
  return {
    id: component.id,
    installedTag: component.installedTag,
    latestTag: null,
    status: "unknown",
    releaseUrl: null,
  };
}

function unknownAdvisory(checkedAt, installed) {
  return freezeAdvisory({
    schemaVersion: 1,
    checkedAt,
    status: "unknown",
    components: installed.map(unknownComponent),
  });
}

export function createDisabledUpdateAdvisory({ checkedAt } = {}) {
  if (!validCheckedAt(checkedAt)) throw new TypeError("checkedAt must be an RFC 3339 instant");
  return freezeAdvisory({
    schemaVersion: 1,
    checkedAt,
    status: "disabled",
    components: [],
  });
}

function validInstalledComponent(component) {
  const rule = componentRule(component);
  return hasExactKeys(component, INSTALLED_KEYS)
    && rule !== null
    && typeof component.installedTag === "string"
    && component.repository === rule.repository
    && stableVersionFor(rule, component.installedTag) !== null;
}

function validPolicy(policy) {
  if (!hasExactKeys(policy, POLICY_KEYS)
    || policy.schemaVersion !== 1
    || policy.checkIntervalDays !== 7
    || !Number.isInteger(policy.totalTimeoutMs) || policy.totalTimeoutMs <= 0
    || policy.marketplaceName !== "game-design-suite"
    || policy.stableReleasesOnly !== true
    || !Array.isArray(policy.productIds)
    || policy.productIds.length !== 2
    || policy.productIds[0] !== "game-design-studio"
    || policy.productIds[1] !== "game-design-career"
    || !Array.isArray(policy.components)
    || policy.components.length !== Object.keys(COMPONENTS).length) return false;

  const ids = new Set();
  for (const component of policy.components) {
    if (!hasExactKeys(component, ["id", "repository"])) return false;
    const rule = COMPONENTS[component.id];
    if (!rule || rule.repository !== component.repository || ids.has(component.id)) return false;
    ids.add(component.id);
  }
  return ids.size === Object.keys(COMPONENTS).length;
}

function validCheckedAt(checkedAt) {
  if (typeof checkedAt !== "string") return false;
  const date = new Date(checkedAt);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === checkedAt;
}

function validReleaseMap(releases, installed) {
  if (releases === null || typeof releases !== "object" || Array.isArray(releases) || Object.getPrototypeOf(releases) !== Object.prototype) return false;
  if (Reflect.ownKeys(releases).some((id) => typeof id !== "string" || !Object.hasOwn(COMPONENTS, id))) return false;
  return installed.every((component) => Object.hasOwn(releases, component.id));
}

export function selectLatestStableRelease({ component, releases } = {}) {
  const inspected = inspectReleases(component, releases);
  if (!inspected.valid || inspected.latest === null) return null;
  return Object.freeze({ tag: inspected.latest.tag, url: inspected.latest.url });
}

export function evaluateUpdateAdvisory({ policy, installed, releases, checkedAt } = {}) {
  if (!validCheckedAt(checkedAt)) throw new TypeError("checkedAt must be an RFC 3339 instant");
  if (!Array.isArray(installed) || !installed.every(validInstalledComponent)) {
    return unknownAdvisory(checkedAt, []);
  }
  if (new Set(installed.map(({ id }) => id)).size !== installed.length || !validPolicy(policy) || !validReleaseMap(releases, installed)) {
    return unknownAdvisory(checkedAt, installed);
  }

  const components = [];
  for (const component of installed) {
    const inspected = inspectReleases(component, releases[component.id]);
    const rule = COMPONENTS[component.id];
    const installedVersion = stableVersionFor(rule, component.installedTag);
    const ahead = inspected.latest !== null && compareVersions(installedVersion, inspected.latest.version) > 0;
    // One unknown component turns the whole advisory unknown, which silences the notice for every
    // other component too. Letting a build that runs ahead of its own release report current keeps
    // the bundled upstream notices alive during the window between the version bump and the release.
    if (!inspected.valid || inspected.latest === null || (ahead && rule.aheadOfLatestIsCurrent !== true)) {
      components.push(unknownComponent(component));
      continue;
    }
    if (ahead) {
      components.push({
        id: component.id,
        installedTag: component.installedTag,
        latestTag: inspected.latest.tag,
        status: "current",
        releaseUrl: inspected.latest.url,
      });
      continue;
    }
    const comparison = compareVersions(installedVersion, inspected.latest.version);
    components.push({
      id: component.id,
      installedTag: component.installedTag,
      latestTag: inspected.latest.tag,
      status: comparison === 0 ? "current" : "outdated",
      releaseUrl: inspected.latest.url,
    });
  }
  const status = components.some((component) => component.status === "unknown")
    ? "unknown"
    : components.some((component) => component.status === "outdated") ? "outdated" : "current";
  const advisory = { schemaVersion: 1, checkedAt, status, components };
  if (!hasExactKeys(advisory, ADVISORY_KEYS) || components.some((component) => !hasExactKeys(component, COMPONENT_ADVISORY_KEYS))) {
    return unknownAdvisory(checkedAt, installed);
  }
  return freezeAdvisory(advisory);
}
