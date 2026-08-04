# Studio Export Recipes

Select one recipe from source artifact type and delivery purpose. A recipe controls structure and QA intent, not the renderer implementation.

### Recipe: `gdd`

- Source: canonical multi-discipline design artifact.
- Story: intent and target player → player loop → systems/content/experience → evidence and risks → production gates.
- Formats: MD, PDF, and DOCX; PPTX only with a separate decision narrative.

### Recipe: `system-spec`

- Source: system specification with stable rule, state, failure, UI, and data sections.
- Story: purpose → inputs/preconditions → rules and precedence → states and recovery → runtime/data mapping → evidence and open decisions.
- QA emphasis: tables, identifiers, cross-references, and exception coverage.

### Recipe: `content-spec`

- Source: content specification linked to systems, production resources, player strategy, rewards, and repeatability.
- Story: purpose → dependencies → player-facing progression → outcomes/rewards → production and validation.
- QA emphasis: dependency IDs, content tables, media rights, and production ownership.

### Recipe: `liveops-plan`

- Source: evidence-backed event or experiment artifact.
- Story: goal and cohort → hypothesis/control/treatment → schedule and operations → protection metrics → stop/rollback → decision gate.
- QA emphasis: dates, owners, probability/price disclosure, guardrails, and rollback visibility.

### Recipe: `review-report`

- Source: game-design review with stable findings and decision items.
- Story: scope and verdict → blocker summary → prioritized findings → unresolved decisions → minimum repair plan.
- QA emphasis: finding IDs, evidence locators, severity, affected sections, owners, and status.

### Recipe: `executive-presentation`

- Source: validated canonical artifact and current decision context.
- Require audience, purpose, and an independent story outline before preparation.
- Build a decision story: conclusion → stakes → evidence → alternatives/trade-offs → recommendation → next gate.
- The presentation must not split Markdown headings into slides. Slide titles form a coherent standalone narrative for the named audience and purpose.
- Model every slide independently with a unique stable `id` plus nonempty `title`, `message`, and `purpose`; none may copy a Markdown structural heading.
- QA emphasis: one decision per slide, source traceability, visual legibility, speaker-independent comprehension, and exact slide count.

## Evidence states

For every format, keep `requested`, capability availability, generation status, renderer status, output path, digest, page/slide count, QA status, evidence, and limitations distinct. MD uses packaged `canonical-markdown`; PDF, DOCX, and PPTX bind exactly to the probed `pdf`, `documents`, and `presentations` capabilities. This plugin produces and validates preparation states only: `not-requested`, `blocked`, `unavailable`, and `pending`. Generation, renderer, and QA remain `not-run`; derivative fields remain null; format evidence remains empty. Format-level `passed` and `failed` are downstream-only and this preparation validator rejects them. Failed canonical preflight evidence remains preserved in `preflight` and maps requested jobs to `blocked` without fabricating format execution evidence.
