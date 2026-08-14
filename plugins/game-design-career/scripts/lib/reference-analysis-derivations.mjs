export const priorityDimensions = Object.freeze([
  "relevance", "playerExperienceImpact", "economyProgressionImpact", "differentiationPotential", "evidenceStrength", "uncertainty", "researchCost",
]);

const positivePriorityDimensions = priorityDimensions.slice(0, 6);
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

/** The six positive dimensions determine score; lower research cost is the inverse tie-break. */
export function priorityScore(value) {
  return positivePriorityDimensions.reduce((sum, field) => sum + value[field], 0);
}

/** Canonical priority order shared by construction and persisted-analysis validation. */
export function comparePriorityEntries(left, right) {
  return priorityScore(right) - priorityScore(left) || left.researchCost - right.researchCost || compareUtf8(left.systemId, right.systemId);
}

export function evidenceVerificationId(evidenceId) { return `verify-evidence-${evidenceId}`; }
export function systemVerificationId(systemId) { return `verify-system-${systemId}`; }
export function systemVerificationQuestion(systemId) { return `What independent observation can verify ${systemId}?`; }

/** Canonical comparison presentation; insufficient or unknown evidence never reads as ready. */
export function deriveComparisonPresentation({ systemId, coverageCount, claimKind }) {
  const state = coverageCount < 2 || claimKind === "unknown" ? "hold" : "ready";
  return {
    state,
    subject: systemId.split("-").join(" "),
    finding: state === "hold"
      ? "Hold comparison conclusion pending sufficient observed reference coverage."
      : "Comparison remains evidence-bounded and pending review.",
  };
}
