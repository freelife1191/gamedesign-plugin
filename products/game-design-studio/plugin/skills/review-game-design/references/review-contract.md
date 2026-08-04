# Review Contract

## Finding record

```json
{
  "id": "finding-input-recovery",
  "severity": "high",
  "evidence": [{ "claimId": "claim-critical-action", "locator": "content.md#input" }],
  "impact": "Players can lose progress when the critical action fails without recovery.",
  "affectedSectionId": "input",
  "minimalFix": "Specify and test the recovery transition for the failed critical action.",
  "owner": "system-design-owner",
  "status": "open",
  "reviewerRole": "lead-game-designer"
}
```

Allowed severity values are `critical`, `high`, `medium`, and `low`. Do not infer severity from tone. Base it on the stated consequence and evidence.

## Decision item

Use a decision item when sound recommendations conflict. Record:

- `id`, affected stable section IDs, and decision owner;
- each alternative and its originating finding or reviewer role;
- supporting and contradicting evidence;
- player, production, safety, and reversibility trade-offs;
- due gate, chosen alternative, rationale, and status.

Do not average incompatible recommendations or silently choose the highest-priority role.

## Review status

- `blocked`: source is unavailable/invalid or a blocking finding is unresolved.
- `changes-required`: source is reviewable and at least one actionable non-blocking finding remains.
- `decision-required`: the next material action depends on an unresolved decision item.
- `approved`: all scoped blockers and required decisions are resolved with evidence.

Approval applies only to the declared review scope and artifact version.
