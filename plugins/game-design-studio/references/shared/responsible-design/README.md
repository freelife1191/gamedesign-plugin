# Responsible-design gates

These gates turn responsible-design questions into explicit review evidence. They support human decisions; they do not replace legal, safety, accessibility, production, or product ownership.

## Flow

1. Ask every gate's `applicability_questions` and record why it is applicable or `not-applicable`.
2. Set applicable gates to `pending` while the named `evidence_fields` are gathered.
3. Set a gate to `blocked` when any `blocking_findings` condition is true. A blocked gate stops approval of the affected scope, not unrelated work.
4. The declared `approver` reviews the evidence, residual risk, and decision log. Only that accountable human role may set `approved`.
5. Link approval evidence and any review finding from the canonical artifact. Re-open the gate when scope, evidence, audience, economy, model behavior, or operating conditions materially change.

The allowed lifecycle is `not-applicable`, `pending`, `blocked`, or `approved`. Do not treat missing evidence as approval, average findings into a score, or automatically waive a blocker.

## Avoid over-automation

Automation may ask questions, detect missing fields, run bounded tests, and summarize evidence. It must not infer consent, grant rights, approve experiments, accept residual risk, or silently expand scope. Uncertainty becomes a visible finding for the named human approver. Hooks are advisory runtime helpers: correctness remains grounded in the canonical artifact, validator, recorded evidence, and human approval even when hooks or optional tools are unavailable.
