# Source reference policy

The canonical source inventory is `reference-index.json`. It covers Markdown files below `docs/` except implementation material in `docs/superpowers/`.

## Deterministic identity and drift

- `sourcePath` is repository-relative, starts below `docs/`, uses `/`, and is normalized to Unicode NFC.
- `id` combines the explicit category with the first 12 hexadecimal characters of the SHA-256 of `sourcePath`. Content edits therefore retain identity; moves intentionally receive a new identity.
- `sha256` hashes the original file bytes. `wordCount` counts non-empty Unicode-whitespace-delimited tokens in the UTF-8 text.
- `title` is the source filename with its leading numeric sequence removed. Titles and NFC paths must be unique.
- Generated JSON uses two-space indentation, deterministic path ordering, and one trailing newline.

Run `node tooling/index-references.mjs --write` after an approved source change. CI and local validation use `--check`; byte changes, additions, removals, title collisions, path collisions, and unmapped top-level groups fail until reviewed and regenerated.

## Classification and use

Source groups map explicitly to `career`, `fun-intent`, `systems`, `content`, or `feedback`. A new group is rejected until the mapping is reviewed. Career sources may contain evergreen, contextual, and time-sensitive claims; other categories default to evergreen and contextual claims. Time-sensitive claims require current primary evidence before use.

`derivedCore` lists shared Core knowledge entries derived from a source. It remains empty until a reviewed Core entry is created; an empty list must not be interpreted as absence of useful source material.
