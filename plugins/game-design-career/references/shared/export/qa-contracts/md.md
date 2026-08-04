# Markdown QA contract

Markdown is the canonical, always-available export. It passes only when `content.md` has valid frontmatter, exactly one H1, unique explicit stable heading IDs, NFC text, and existing relative assets under `assets/` with nonempty alt text. Its manifest status cannot be `failed` or `unavailable`; generation starts `pending` and successful validation sets it to `passed`.
