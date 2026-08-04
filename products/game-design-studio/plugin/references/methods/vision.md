# Game Vision Method

Use this method to turn intent into a falsifiable vision artifact. Keep claims distinguishable as `provided`, `sourced`, `assumption`, or `provisional`.

## Output schema

| Field | Required evidence |
| --- | --- |
| Target player | Player need or context; never infer age or demographic identity from genre alone |
| Experience intent | Player-facing promise and excluded experiences |
| Desired emotion | Emotional progression tied to moments and observable signals |
| Core fun | Player verb, decision, tension, feedback, and variation |
| Design pillars | Three to five testable rules with counterexamples |
| Core loop | Action, feedback, reward, and re-entry |
| Motivation loop | Short-, medium-, and long-horizon reasons to return |
| Meaningful choice | Options, information, trade-off, consequence, and recovery |
| Success metrics | Source, baseline, calibration owner, validation plan, and decision threshold |
| Assumptions | Claim, confidence, impact, owner, and validation task |
| Non-goals | Explicit exclusions and the decision owner who can change them |

## Claim policy

- Tag an unsupported age band, demographic segment, or quantitative success threshold as an assumption or provisional hypothesis. Never present it as a fact.
- For each target or metric, record the source, baseline, calibration owner, validation plan, and when the result will change the design.
- Define core fun through a verb, decision, tension, and feedback cycle. An unsupported fun adjective such as “addictive,” “deep,” or “satisfying” is not a pillar and blocks completion until operationalized.
- Replace false precision with a measurement range or a question. Missing evidence is not approval.

## Adversarial example

**Reject:** “The game is fun and targets ages 18–35; success is 70% day-one retention.” The fun adjective is unsupported, the demographic is invented, and the threshold has no source or baseline.

**Repair:** Mark both audience and threshold provisional; name the research source, baseline, calibration owner, validation plan, and decision date. Rewrite fun as the specific player verb, decision tension, system feedback, and expected observable behavior.

## Responsible-design gate record

For every gate, record `applicable`, `not-applicable`, `pending`, `blocked`, or `approved`, plus evidence and owner. Check `accessibility` for core experience paths, `scope-control` for feasibility, `ugc-safety` for player expression, `ai-npc-safety` for generated characters, and `economy-transparency` when the vision includes monetized progression. Missing evidence is never approved.
