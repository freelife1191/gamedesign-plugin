---
name: research-game-design-jobs
description: Use when game-design career work depends on current postings, employer or project facts, required or preferred skills, regional hiring signals, tool preferences, or evidence-backed candidate gaps.
---

# Research Game Design Jobs

## Overview

Build a dated evidence set before making current-job claims. Keep each posting's facts, repeated signals, candidate evidence, gaps, and generalization limits independently inspectable.

## Load References

1. Read `../../references/methods/job-evidence.md` before collecting or comparing sources.
2. Read `../../references/job-evidence-schema.json` before creating the evidence artifact. Preserve every required field exactly.
3. Use the bundled `scripts/validate-job-evidence.mjs` after assembling or changing a posting collection.

## Research

1. Define the target role, level, region, employment type, retrieval date, and evidence question. If these are unclear, label the scope provisional rather than silently broadening it.
2. Prefer official company career pages for postings and official project or platform sources for project facts. Use secondary sources only as leads or explicitly labeled context.
3. Create one schema-valid record per posting with a stable, collection-unique `sourceId`. Keep `applicantEvidence`, `gaps`, and `nonGeneralizable` as independent fields; never collapse them into fit notes.
4. Mark a requirement posting-specific unless it appears in distinct primary postings. Cross-reference every repeated-signal `sourceIds` member to an existing posting `sourceId`. Require unique IDs, `count` equal to the unique source count, `denominator` equal to the deduplicated posting sample, and `count <= denominator`.
5. Compare the posting evidence with supplied candidate artifacts. Do not fabricate experience, metrics, ownership, results, applicant evidence, or missing evidence. A missing claim remains a gap or verification task.
6. Do not infer hiring volume, market growth, compensation, suitability, or universal role requirements from a single posting or a convenience sample.
7. From this skill directory, run `node scripts/validate-job-evidence.mjs <collection.json>`. Stop completion when it reports a missing or duplicate posting ID, orphan signal ID, duplicate signal ID, count mismatch, denominator mismatch, or count above denominator.

## Output Contract

Return:

- research scope and retrieval date;
- schema-valid posting records;
- posting-specific requirements;
- repeated signals with numerator, denominator, and source IDs;
- independent `applicantEvidence`, `gaps`, and `nonGeneralizable` findings;
- sample size, sample geography, source mix, blind spots, and inference limits;
- gap-to-exercise-to-proof-artifact recommendations that do not promise hiring outcomes.

## Completion

Finish only when current claims cite fresh primary sources, every record preserves required metadata, collection validation passes, repeated signals are reproducible from linked distinct sources, and unsupported candidate or market claims remain explicit gaps.
