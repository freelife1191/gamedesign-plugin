# Renderer-neutral Job Manifest

`prepare-studio-export.mjs` emits JSON with these top-level records:

- `schemaVersion`, `artifact`, `preflight`, and `recipe`;
- `capabilityProbe` as the received capability snapshot plus its own evidence;
- `formats.md|pdf|docx|pptx` as independent jobs;
- optional `presentation` brief for PPTX;
- `artifactPreservation` confirming that preparation did not mutate source or owner outputs.

Each format job separates `requested`, `extension`, `capability`, `status`, terminal `statusHistory`, `generationStatus`, `rendererStatus`, `qaStatus`, `plannedOutputPath`, actual `outputPath`, `digest`, `pageOrSlideCount`, `evidence`, and `limitations`. Preparation never emits `passed`.

Allowed terminal transitions are `pending → passed|failed|unavailable`. `not-requested`, `blocked`, `unavailable`, `passed`, and `failed` do not reopen inside one job. Run `validate-studio-export.mjs` after downstream generation and QA; it returns normalized output only when every object, transition, derivative, digest, and evidence record passes.

Run from an installed plugin by providing the packaged validator path in the job JSON:

```json
{
  "artifactDir": "artifact-name",
  "outputDir": "artifact-name/exports",
  "recipeId": "gdd",
  "requestedFormats": ["md", "pdf"],
  "capabilities": {},
  "validatorPath": "<PLUGIN_ROOT>/scripts/validate-artifact.mjs"
}
```

Invoke `node skills/export-game-design-documents/scripts/prepare-studio-export.mjs job.json`. The script reads but never overwrites the job file or target outputs, and writes the manifest to stdout.
