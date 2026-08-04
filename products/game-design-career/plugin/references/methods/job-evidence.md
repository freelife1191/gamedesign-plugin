# Current game-design job evidence method

Use this method for current postings, employers, projects, tools, hiring signals, compensation, or market claims.

## Scope first

Record the target role family and level, `sampleGeography`, employment type, retrieval window, `retrievalDate`, and research question. Report the final `sampleSize`, date range, source mix, and `blindSpots`; do not imply that a convenience sample represents the whole market.

## Source priority

1. Prefer official company career pages for current posting facts.
2. Prefer official project or platform sources for project, engine, platform, or live-service facts.
3. Use reputable secondary sources only when a primary source is unavailable, and label the source and limitation.

For every record, assign a stable `sourceId` and retain `sourceUrl`, `postedDate`, `retrievalDate`, and `sourceType`. Every `sourceId` must be non-empty and unique within the collection. If a posted date is unavailable, record `null` and the resulting freshness limitation rather than guessing.

## Evidence record

Use `../job-evidence-schema.json`. Preserve `applicantEvidence`, `gaps`, and `nonGeneralizable` as separate fields:

- `applicantEvidence`: supplied artifacts or project records that visibly support a requirement;
- `gaps`: requirements with missing or insufficient candidate evidence;
- `nonGeneralizable`: employer-, project-, location-, seniority-, legal-, or posting-specific constraints that must not become a universal role claim.

Never fabricate candidate experience, team size, metrics, ownership, outcomes, or source content.

## Repeated-signal rule

A posting-specific requirement remains attached to its source. Label a repeated market signal only when the same normalized requirement appears in at least two distinct primary postings within the declared scope. Report its count, denominator, `sourceIds`, geography, and date range. Every `sourceIds` member must cross-reference an existing posting `sourceId`; IDs inside a signal must be unique, `count` must equal the unique `sourceIds` count, `denominator` must equal the deduplicated posting count, and `count` must not exceed `denominator`. “Repeated” means repeated in the sample; it does not prove prevalence outside the sample.

JSON Schema validates one posting record and cannot enforce references across a collection. After collecting or editing records, run the research skill's bundled validator: `node scripts/validate-job-evidence.mjs <collection.json>` from the `research-game-design-jobs` skill directory. Treat any reported collection error as a completion blocker.

Never infer hiring volume from a single posting. Do not generalize one employer's project, tool, degree, language, location, or experience requirement to all employers. Do not infer demand volume from duplicate, reposted, evergreen, or mirrored listings.

## Candidate comparison

Match requirements only to observable artifacts and attributable project records. Convert every material gap into an observable exercise, proof artifact, review criterion, and feedback point. Missing evidence stays missing; it is not evidence of incapability or suitability.

## Audit questions

- Can every current claim be traced to a source URL and retrieval date?
- Are required and preferred skills separated?
- Are repeated signals reproducible from distinct primary postings?
- Do all repeated-signal `sourceIds` resolve to unique posting `sourceId` values with exact counts and denominator?
- Are sample size, sample geography, blind spots, and inference limits visible?
- Are applicant evidence, gaps, and non-generalizable constraints independent?
