# Reference analysis flow

Use the stages in this order: 0) brief, 1) role reference set, 2) evidence register, 3) Atlas selection, 4) system inventory without evaluation, 5) maps and loops, 6) priority, 7) deep dives, 8) comparison, 9) transfer proposals and verification queue.

Each role appears once: `direct-competitor`, `core-system-exemplar`, and `operations-monetization-comparator`. One game may fill several roles. When sources are offline, unavailable, not observed, or reference coverage is insufficient, record a limitation and open a verification item; do not infer a fact.

Evidence IDs, source tiers, and claim kinds are preserved by the registry. Claims cannot be upgraded. Unknown systems, orphan maps, invalid IDs, and unverified cycles are rejected before projection. A priority candidate is scored only when all seven dimensions are explicit integers from 1 through 5: relevance, player-experience impact, economy-progression impact, differentiation potential, evidence strength, uncertainty, and research cost. The first six dimensions rank candidates; lower research cost breaks a tie.

Transfers are proposals only: `adopt`, `adapt`, `reject`, or `hold`. Every transfer remains `pending-review`; this analysis never mutates a system specification. Use `hold` for insufficient independent evidence or reference coverage.

`writeReferenceAnalysisWorkspace` writes fixed root artifacts plus safe-ID-derived `system-maps/` and `deep-dives/` children. YAML artifacts contain canonical JSON, which is JSON-compatible YAML. All artifact writing uses the safe writer and is limited to 2 MiB per document.
