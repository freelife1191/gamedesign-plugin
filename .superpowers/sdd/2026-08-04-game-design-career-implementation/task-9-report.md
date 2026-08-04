# Career Task 9 Report

## Scope

- Added three executable Career E2E lanes: `entry-12-week-roadmap`, `reverse-design-portfolio`, and `junior-transition`.
- Added a product-bundled `validate-career-scenario.mjs` runner under the Career orchestrator skill.
- Kept shared runtime, tooling, Studio sources, and generated plugins unchanged.

## TDD evidence

- Initial RED: 0/4. The scenario runner did not exist; after the minimum stub, all four tests still failed with `scenario.not-implemented`.
- Workflow GREEN: 5/5 after implementing three acceptances, semantic mutation rejection, and malformed/path-escape fail-closed behavior.
- Built-path RED: 0/1. The clean-built runner exposed a repository-only static import of the canonical artifact validator.
- Final GREEN: 6/6 after resolving the canonical validator from the installed shared runtime first and the repository source path only as a development fallback.

## Executable acceptance boundary

- Resolves each fixture through the real `routing.json` scenario, route, intent-to-skill, required-evidence, completion-gate, and artifact-type contracts.
- Runs the shared production Canonical Artifact validator against every routed source template.
- Runs Career production validators for export states, Skillstead visualization states, and current-job evidence linkage.
- Entry enforces two distinct role candidates, evidence gaps, contiguous weeks 1–12 with learning/practice/feedback, a gap-linked first portfolio brief, a `competency-map` SVG state, PDF request, and zero unverified current claims.
- Reverse design rejects user-manual mode and enforces exact fact/inference claim records plus rules, exceptions, UI, data, economy, operations, alternatives, validation, DOCX, and independently outlined PPTX requests.
- Transition requires official current-job primary evidence with posted/retrieval dates, bounded project impact, evidence gaps, all four grounded question types, six-part answer feedback, requirement-bound quarterly goals, PDF request, and zero unverified current claims.
- Semantic reversals, malformed results, and cross-fixture realpath escapes fail closed.

## Verification

- Focused Career E2E: 6/6.
- All 10 Career skills: official `quick_validate.py` passed.
- Career product plus E2E: 107/107.
- Shared contract: 1/1.
- Repository tests excluding packaged vendor: 248/248.
- Packaged Skillstead vendor: 58/58 (39 SVG lint plus 19 renderer tests).
- Combined inventory: 306/306.
- Source plugin official validator: passed.
- Clean build: 256 files, SHA-256 `29271f2d336880548f35db5d00523f6b9b96144dfae54e4c49ec9177073c1e77`.
- Built plugin official validator: passed; clean-built runner executes the entry E2E contract.
- Node syntax, 19 Career/E2E JSON files, symlink scan, `git diff --check`, and scope status passed.

## Notes

- Requested derivative formats remain fail-closed as `blocked` while capability is `unknown`; the fixtures prove the request and evidence-state contracts without fabricating generated PDF, DOCX, or PPTX files.
- The competency map exercises the verified editable-SVG fallback: SVG generation and lint evidence pass while PNG capability is explicitly unavailable.
