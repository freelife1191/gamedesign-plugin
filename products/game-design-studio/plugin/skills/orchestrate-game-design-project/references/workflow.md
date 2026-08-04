# Routing and review workflow

Use `../../../references/routing.json` as the authoritative route and role registry. Match normalized trigger intent; never infer a role or skill outside that registry.

## Direct routing

Route a direct request to the corresponding skill. Economy and LiveOps are separate variants of one domain skill because their inputs, artifacts, and gates differ.

<!-- direct-routing:start -->
```json
{
  "vision": "define-game-vision",
  "systems": "design-game-systems",
  "content": "design-game-content",
  "player-experience": "design-player-experience",
  "economy": "design-game-economy-and-liveops",
  "liveops": "design-game-economy-and-liveops",
  "production": "plan-game-production",
  "review": "review-game-design",
  "visualization": "visualize-game-design",
  "export": "export-game-design-documents"
}
```
<!-- direct-routing:end -->

Keep unknown or ambiguous intent with `orchestrate-game-design-project`; never guess a specialist. For mixed intent, select only the routes necessary to produce the requested artifact and make each route's required inputs and completion gates visible.

## Review selection

Choose roles that answer distinct material questions. Use one to three declared roles. For a mixed launch-readiness review, select design integrity, critical-action accessibility, and production feasibility as shown below; replace roles only when the brief makes another declared specialty more relevant.

<!-- review-policy:start -->
```json
{
  "maxRoles": 3,
  "rolePriority": [
    "lead-game-designer",
    "system-economy-designer",
    "content-narrative-designer",
    "ux-accessibility-reviewer",
    "liveops-data-designer",
    "production-feasibility-critic"
  ],
  "selectedRoles": [
    "lead-game-designer",
    "ux-accessibility-reviewer",
    "production-feasibility-critic"
  ],
  "envelope": {
    "artifact": "artifact-name/content.md",
    "role": "lead-game-designer",
    "questions": [],
    "findingsPath": "artifact-name/decisions/review-lead-game-designer.md"
  },
  "parallel": {
    "mode": "independent-envelopes",
    "envelopeList": "selectedReviews"
  },
  "fallback": {
    "when": "host-without-subagents",
    "envelopeList": "selectedReviews",
    "order": "rolePriority",
    "preserveRolesAndQuestions": true
  },
  "mergeKeys": [
    "severity",
    "affectedSectionId",
    "rolePriority"
  ],
  "severityOrder": [
    "blocker",
    "high",
    "medium",
    "low"
  ]
}
```
<!-- review-policy:end -->

Create one envelope per selected role by changing `role`, its targeted `questions`, and `findingsPath`. Keep `artifact` identical. Ensure every findings path is unique.

When subagents are available, dispatch all `selectedReviews` as independent envelopes. Do not give a reviewer another reviewer's findings. On a host without subagents, execute the same envelope list with the same roles and questions in `rolePriority` order. Host capability may change concurrency, never review coverage.

## Deterministic merge

Require each finding to include severity, evidence, impact, affected stable section ID, minimal fix, role, and applicable responsible-design gate. Merge exact duplicates without discarding contributing roles. Sort first by severity (`blocker`, `high`, `medium`, `low`), then lexically by affected stable section ID, then by `rolePriority`.

Retain conflicting recommendations as a decision item with both assumptions and a named decision owner. Never silently choose a winner or use arrival order as a merge key.
