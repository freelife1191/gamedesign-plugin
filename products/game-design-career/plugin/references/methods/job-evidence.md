# Current game-design job evidence method

Use this method for current postings, employers, projects, tools, hiring signals, compensation, or market claims.

## Scope first

Record the target role family and level, `sampleGeography`, employment type, retrieval window, `retrievalDate`, and research question. Report the final `sampleSize`, date range, source mix, and `blindSpots`; do not imply that a convenience sample represents the whole market.

## Source priority

1. Prefer official company career pages for current posting facts.
2. Prefer official project or platform sources for project, engine, platform, or live-service facts.
3. Use reputable secondary sources only when a primary source is unavailable, and label the source and limitation.

For every record, assign a stable `sourceId` and retain `sourceUrl`, `postedDate`, `retrievalDate`, `reviewAfter`, and `sourceType`. `reviewAfter` is the last date on which the captured posting may support a current claim without re-retrieval. Every `sourceId` must be non-empty and unique within the collection. If a posted date is unavailable, record `null` and the resulting freshness limitation rather than guessing; that record cannot support a repeated market signal.

## Evidence record

Use `../job-evidence-schema.json`. Preserve `applicantEvidence`, `gaps`, and `nonGeneralizable` as separate fields:

- `applicantEvidence`: supplied artifacts or project records that visibly support a requirement;
- `gaps`: requirements with missing or insufficient candidate evidence;
- `nonGeneralizable`: employer-, project-, location-, seniority-, legal-, or posting-specific constraints that must not become a universal role claim.

Never fabricate candidate experience, team size, metrics, ownership, outcomes, or source content.

## Repeated-signal rule

A posting-specific requirement remains attached to its source. Label a repeated market signal only when the same deterministically normalized requirement appears in at least two distinct official company career postings within the declared scope. Give it a stable `signalId`, set both `signal` and `normalizedValue` to the validator's normalization of the cited requirement, and report its count, denominator, geography, and date range.

Each `sourceRefs` entry must identify one distinct posting with `sourceId`, one allowed `field` (`responsibilities`, `requiredSkills`, or `preferredSkills`), the zero-based `index`, the byte-exact `statement`, the same `normalizedValue`, and `requirementId` equal to `<sourceId>:<field>:<index>`. The validator re-reads the posting item and recomputes normalization; do not paraphrase or invent signal text. Every cited record must be an `official-company-career-page` with an HTTPS URL and real ISO dates satisfying `postedDate <= retrievalDate <= asOfDate <= reviewAfter`.

`sourceRefs` and posting IDs inside a signal must be unique, a repeated signal needs at least two refs, `count` must equal the distinct cited-posting count, `denominator` and every record's `sampleSize` must equal the deduplicated posting count, and every record's `sampleGeography` must exactly equal the collection's distinct regions. “Repeated” means repeated in the sample; it does not prove prevalence outside the sample.

JSON Schema validates one posting record and cannot enforce references across a collection. After collecting or editing records, run the research skill's bundled validator from the `research-game-design-jobs` skill directory. When the collection has repeated signals, the explicit current-claim date is mandatory: `node scripts/validate-job-evidence.mjs <collection.json> --as-of YYYY-MM-DD`. Treat any reported collection error as a completion blocker. Empty `repeatedSignals` arrays remain valid and do not require an as-of argument.

Never infer hiring volume from a single posting. Do not generalize one employer's project, tool, degree, language, location, or experience requirement to all employers. Do not infer demand volume from duplicate, reposted, evergreen, or mirrored listings.

## Candidate comparison

Match requirements only to observable artifacts and attributable project records. Convert every material gap into an observable exercise, proof artifact, review criterion, and feedback point. Missing evidence stays missing; it is not evidence of incapability or suitability.

## Audit questions

- Can every current claim be traced to a source URL and retrieval date?
- Are required and preferred skills separated?
- Are repeated signals reproducible from distinct primary postings?
- Do all repeated-signal `sourceRefs` resolve to exact posting fields, indexes, statements, normalized values, and deterministic requirement IDs?
- Are all cited repeated-signal sources fresh official HTTPS company career postings at the explicit as-of date?
- Are sample size, sample geography, blind spots, and inference limits visible?
- Are applicant evidence, gaps, and non-generalizable constraints independent?
