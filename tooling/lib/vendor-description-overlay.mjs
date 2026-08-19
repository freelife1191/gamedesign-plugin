// A vendored skill reaches the router through its own SKILL.md, and three upstreams write descriptions
// far past the catalog budget: 652, 596, and 289 characters against a ceiling of 119. What the cut
// takes is not decoration. It takes archify's entire "Use when the user asks to visualize…" clause,
// svg-infographic's "Not for photo-heavy… statistical charts" exclusion, and humanize-korean's trigger
// list and "단순 맞춤법 교정·번역은 대상 아님" exclusion — so the router loses both the vocabulary that
// should route work here and the scope that should keep unrelated work out.
//
// Editing the vendored file is not an option: the vendor lock pins every upstream byte, and the
// packaging gate refuses a modified vendored file. So the source tree stays byte-identical to upstream
// and this rewrites one frontmatter field as the build projects the file into a package. The overlay
// pins the upstream description it was written against, which is what keeps it honest — an upstream
// that rewords its description fails the build instead of silently keeping a stale summary of text
// that no longer exists.
//
// The overlays live outside every vendor root, at shared/vendor/description-overlays/<id>.json. Beside
// the lock would read better, but each vendor root is a closed set the packaging gate verifies, and an
// im-not-ai upgrade replaces its whole root by rename — a repository-owned file kept in there would be
// deleted by an upgrade and would have to widen two closure allowlists to exist at all.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { CATALOG_DESCRIPTION_BUDGET } from "./skill-description-budget.mjs";
import { loadVendorComponents } from "./vendor-components.mjs";

const DESCRIPTION_LINE = /^description:[ \t]*(?<scalar>.*)$/gmu;

// A plain YAML scalar cannot open with an indicator character and cannot carry ": " or " #" without
// changing what it parses as. The overlay is repository-authored text that must survive every
// frontmatter reader the two host CLIs use, so it is held to a plain scalar rather than quoted: a
// quoted value would also spend two of its budget characters on punctuation the router never reads.
const PLAIN_SCALAR_OPENERS = new Set(["\"", "'", "#", "-", "?", ":", ",", "[", "]", "{", "}", "&", "*", "!", "|", ">", "%", "@", "`"]);

function overlayError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function assertPlainScalar(id, description) {
  if (typeof description !== "string" || description.length === 0) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay description must be a non-empty string`);
  }
  if (description.length > CATALOG_DESCRIPTION_BUDGET) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_OVER_BUDGET", `${id} overlay description is ${description.length} characters against a ${CATALOG_DESCRIPTION_BUDGET} budget`);
  }
  if (description.trim() !== description) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay description must not carry leading or trailing whitespace`);
  }
  if (/[\n\r\t]/u.test(description)) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay description must be a single line`);
  }
  if (PLAIN_SCALAR_OPENERS.has(description[0]) || description.includes(": ") || description.includes(" #")) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay description must be a plain YAML scalar`);
  }
}

function parseOverlay(id, document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay must be an object`);
  }
  if (document.schemaVersion !== 1) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay must declare schemaVersion 1`);
  }
  const target = document.path;
  if (typeof target !== "string" || target.length === 0 || target.startsWith("/") || target.includes("\\") || target.split("/").includes("..")) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay path must be a contained relative path`);
  }
  if (!/^[a-f0-9]{64}$/u.test(document.upstream?.sha256 ?? "")) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${id} overlay must pin the upstream description with a sha256`);
  }
  assertPlainScalar(id, document.description);
  return Object.freeze({ id, path: target, upstreamSha256: document.upstream.sha256, description: document.description });
}

// Overlays are keyed by shared module name because that is what the build iterates. A component
// without an overlay file simply has none; the routing budget measurement is what fails if a vendored
// description needs one and does not have it, so a missing file cannot quietly become a missing check.
export function loadVendorDescriptionOverlays({ repoRoot } = {}) {
  const absoluteRepoRoot = path.resolve(repoRoot ?? "");
  const overlays = new Map();
  for (const component of loadVendorComponents({ repoRoot: absoluteRepoRoot })) {
    let raw;
    try {
      raw = readFileSync(path.join(absoluteRepoRoot, "shared/vendor/description-overlays", `${component.id}.json`), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    let document;
    try {
      document = JSON.parse(raw);
    } catch {
      throw overlayError("VENDOR_DESCRIPTION_OVERLAY_INVALID", `${component.id} overlay must be valid JSON`);
    }
    overlays.set(component.module, parseOverlay(component.id, document));
  }
  return overlays;
}

// An overlay naming a path the vendored tree does not contain would apply to nothing, and a silent
// no-op here means a packaged description quietly reverts to the upstream text the router truncates.
// The build asserts the target exists before it starts projecting the module.
export function assertVendorDescriptionOverlayTarget(overlay, entries) {
  if (!overlay) return;
  if (!entries.some(({ relativePath }) => relativePath === overlay.path)) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_TARGET_MISSING", `${overlay.id} overlay names ${overlay.path}, which the vendored tree does not contain`);
  }
}

export function applyVendorDescriptionOverlay(entry, overlay) {
  if (!overlay || entry.relativePath !== overlay.path) return entry;
  const source = entry.bytes.toString("utf8");
  const matches = [...source.matchAll(DESCRIPTION_LINE)];
  if (matches.length !== 1) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_TARGET_INVALID", `${overlay.id} ${overlay.path} declares ${matches.length} description lines`);
  }
  const [match] = matches;
  // The field has to be the skill's frontmatter description, not a "description:" line that happens to
  // sit in the body. Requiring the match before the frontmatter terminator is what pins it there.
  const frontmatterEnd = source.startsWith("---\n") ? source.indexOf("\n---\n", 3) : -1;
  if (frontmatterEnd === -1 || match.index > frontmatterEnd) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_TARGET_INVALID", `${overlay.id} ${overlay.path} has no frontmatter description to overlay`);
  }
  const upstream = createHash("sha256").update(match.groups.scalar, "utf8").digest("hex");
  if (upstream !== overlay.upstreamSha256) {
    throw overlayError(
      "VENDOR_DESCRIPTION_OVERLAY_UPSTREAM_CHANGED",
      `${overlay.id} rewrote the description this overlay summarizes; re-read the upstream text, rewrite shared/vendor/description-overlays/${overlay.id}.json, and re-pin upstream.sha256 to ${upstream}`,
    );
  }
  const packaged = `${source.slice(0, match.index)}description: ${overlay.description}${source.slice(match.index + match[0].length)}`;
  if (packaged.split("\n").length !== source.split("\n").length) {
    throw overlayError("VENDOR_DESCRIPTION_OVERLAY_TARGET_INVALID", `${overlay.id} ${overlay.path} overlay changed more than one line`);
  }
  return { ...entry, bytes: Buffer.from(packaged, "utf8") };
}
