# Completion gates

Apply only relevant gates, but record the disposition of every considered gate.

## Canonical Artifact

Validate the Canonical Artifact before review-derived approval, visualization, or export. Require:

- `content.md` as the authoritative Markdown document with valid frontmatter, one H1, NFC text, and unique explicit stable section IDs;
- `evidence.yml` for material external or current claims;
- `export-manifest.yml` for requested output status;
- `decisions/` for decisions, role findings, owners, and unresolved disagreements;
- `assets/` for referenced local assets with nonempty alt text.

Keep assumptions, non-goals, completion criteria, risks, responsible-design states, and human approvals visible. Preserve the canonical artifact whenever visualization or export fails or is unavailable.

## Document quality

Require one validated quality-profile selection record per compatible artifact and apply it before content generation and asset planning. Use the exact trusted upper-apply application with canonical source-body bindings; re-derive its full manifest at every boundary and reject cloned, shrunk, injected, reordered, or recomputed caller manifests. Advance only `draft -> structurally-complete -> evidence-reviewed -> visual-reviewed -> document-approved`; do not skip states. Carry the full manifest digest in the immutable state envelope and receipts, and require an artifact-digest-bound external artifact-inspection receipt covering every canonical required ID before `structurally-complete`; requirements or caller state strings cannot complete it. Reject Proxy, accessor, unsafe-Unicode, custom-prototype, repeated-reference, hidden-property, symbol, and cyclic public data before use.

Generated images and rendered files do not grant approval. Requested diagrams remain unverified until Skillstead output and renderer QA pass. Evidence, image rights, responsible-design, release, and named human approvals remain separate gates; `document-quality-editor` may report structural findings but cannot approve them.

## Responsible design

Ask each packaged gate's applicability question and use only the lifecycle `not-applicable`, `pending`, `blocked`, `approved`:

- `ai-rights-human-approval`
- `accessibility`
- `economy-transparency`
- `liveops-experiment`
- `ugc-safety`
- `ai-npc-safety`
- `scope-control`

Set an applicable gate to `pending` while evidence is gathered. Missing evidence is never approval. Set it to `blocked` when a packaged blocking condition holds. A blocked gate stops approval of the affected scope, while unrelated scope may continue. Require the named human approver and linked evidence before `approved`; never infer consent, grant rights, accept residual risk, or approve an experiment automatically.

## Domain and route gates

Require every selected route's inputs, artifact type, and completion gates from `../../../references/routing.json`. Do not replace a specialist's domain gate with a general review score. Keep blockers and unresolved owner decisions visible in the Canonical Artifact.

## Requested formats

- **MD:** Validate canonical Markdown structure, links, referenced assets, alt text, and NFC content. MD remains the always-available canonical format.
- **PDF:** Compare extracted semantics with canonical Markdown and render every page for visual inspection. Use `failed` for defects and `unavailable` when a required check cannot run.
- **DOCX:** Validate the OOXML package and relationships, compare extracted semantics, and render every page. Use `failed` or `unavailable` rather than claiming success without the checks.
- **PPTX:** Require audience, purpose, and a nonempty slide outline before generation. Validate overflow and render every slide for visual inspection; a section-for-slide transcription is not a presentation plan.

Leave unfinished format checks `pending`. Mark a requested format `passed` only after its full packaged QA contract succeeds. A failed or unavailable optional format never invalidates an otherwise valid Canonical Artifact.

## Completion record

Report selected routes and roles, fulfilled criteria, artifact paths, gate states with evidence or blockers, format states, unresolved decisions with owners, and preserved canonical output. Claim completion only for the scope whose required gates passed.

## Memory evidence boundary

When applying a `project-fact` or `decision`, bind the original `artifact_id`, locator, and SHA in `evidence.yml` or `decisions/`; a memory ID is never the independent source of truth. A `design-lesson` is a question or proposal and creates no new decision state. A `style-preference` changes expression only: it never changes a fact, number, ID, or approval state. On source drift, exclude the memory and continue the existing workflow.
