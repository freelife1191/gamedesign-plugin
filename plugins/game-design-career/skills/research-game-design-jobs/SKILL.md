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
4. Mark a requirement posting-specific unless its deterministic normalized value appears in at least two distinct official company career postings. For every repeated signal, preserve a stable `signalId` and exact `sourceRefs` with posting `sourceId`, allowed field, index, byte-exact statement, matching normalized value, and deterministic `<sourceId>:<field>:<index>` requirement ID. Never invent or paraphrase the signal text.
5. Require every current posting record, including records with empty `repeatedSignals`, to use the `official-company-career-page` source kind, an HTTPS official career URL, and real ISO dates satisfying `postedDate <= retrievalDate <= asOfDate <= reviewAfter`. Re-retrieve evidence after `reviewAfter`; stale, secondary, insecure, future-retrieved, or undated records cannot support current work.
6. Require unique refs from distinct postings, at least two refs, `count` equal to the distinct cited posting count, `denominator` and `sampleSize` equal to the deduplicated collection size, and `sampleGeography` equal to the collection's actual distinct regions.
7. Compare the posting evidence with supplied candidate artifacts. Do not fabricate experience, metrics, ownership, results, applicant evidence, or missing evidence. A missing claim remains a gap or verification task.
8. Do not infer hiring volume, market growth, compensation, suitability, or universal role requirements from a single posting or a convenience sample.
9. From this skill directory, always run `node scripts/validate-job-evidence.mjs <collection.json> --as-of YYYY-MM-DD` for a nonempty posting collection. Bind `--as-of` to the trusted research or scenario snapshot rather than a date supplied by the generated result. Stop completion on any source binding, provenance, freshness, date, scope, count, denominator, or uniqueness error.

## Output Contract

Return:

- the `job-posting-evidence` output;
- research scope and retrieval date;
- schema-valid posting records;
- posting-specific requirements;
- repeated signals with stable IDs, normalized values, numerator, denominator, and exact source refs;
- independent `applicantEvidence`, `gaps`, and `nonGeneralizable` findings;
- sample size, sample geography, source mix, blind spots, and inference limits;
- gap-to-exercise-to-proof-artifact recommendations that do not promise hiring outcomes.

## Completion

Finish only when current claims cite fresh primary sources, every record preserves required metadata, collection validation passes, repeated signals are reproducible from linked distinct sources, and unsupported candidate or market claims remain explicit gaps.
