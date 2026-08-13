export const tierBySourceType = Object.freeze({
  "direct-play": "primary",
  "official-site": "primary",
  "official-patch-note": "primary",
  "official-odds": "primary",
  "official-store": "primary",
  "developer-talk": "supporting",
  "curated-wiki": "supporting",
  "expert-guide": "supporting",
  community: "discovery",
  video: "discovery",
  review: "discovery",
  "unofficial-tracker": "discovery",
});

export const evidenceSourceTypes = Object.freeze(Object.keys(tierBySourceType));
export const evidenceClaimKinds = Object.freeze(["observation", "inference", "hypothesis", "unknown"]);
export const evidenceRecordKeys = Object.freeze([
  "evidenceId", "referenceId", "contextId", "systemIds", "sourceType", "tier", "claimKind", "claim",
  "availability", "limitation", "verificationQuestion",
]);

export function tierForSourceType(sourceType) {
  return tierBySourceType[sourceType];
}
