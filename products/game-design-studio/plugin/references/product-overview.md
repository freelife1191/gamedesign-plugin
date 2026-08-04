# Game Design Studio

Game Design Studio turns a design request into a canonical, reviewable artifact. It routes explicit intent to one of ten focused skills and sends ambiguous or mixed intent to `orchestrate-game-design-project`.

## Workflow boundary

- Apply any selected profiles as additional questions and gates, never as universal truths.
- Use no more than three reviewers from the six declared role IDs.
- Load only the references declared by the selected route.
- Preserve the canonical Markdown artifact if optional visualization or export fails.
- Treat `references/routing.json` as the deterministic routing contract; never infer an unknown specialist route.

## Packaged shared material

The product build includes shared knowledge, templates, responsible-design gates, export guidance, runtime hooks/scripts, the vendored SVG skill, and the complete five-category source corpus selected by `product.json`.
