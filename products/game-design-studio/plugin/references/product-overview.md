# Game Design Studio

Task 1 defines the planned contract for ten focused Game Design Studio skills. Follow-up tasks activate those skills at the exact paths declared in `references/routing.json`; until then, ambiguous or mixed intent is only a routing contract and falls back to the planned `orchestrate-game-design-project` entry point.

## Workflow boundary

- Apply any selected profiles as additional questions and gates, never as universal truths.
- Use no more than three reviewers from the six declared role IDs.
- Load only the references declared by the selected route.
- Preserve the canonical Markdown artifact if optional visualization or export fails.
- Treat `references/routing.json` as the deterministic routing contract; never infer an unknown specialist route.
- Treat `plannedPaths` as the exact future allowlist. Later implementation tasks must materialize those paths and add existence validation rather than changing aliases silently.

## Packaged shared material

The Task 1 product build includes shared knowledge, templates, responsible-design gates, export guidance, runtime hooks/scripts, the currently available vendored SVG skill, and the complete five-category source corpus selected by `product.json`.
