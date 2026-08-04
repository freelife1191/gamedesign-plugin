# Third-Party Notices and Source Provenance

## Skillstead svg-infographic

- Upstream: https://github.com/kyungseo/skillstead
- Component: `svg-infographic`
- Version: 0.8.3
- License: Apache-2.0
- Copyright 2026 Kyungseo Park

The vendored component retains its upstream `LICENSE.txt`. Game Design Studio selects game-design diagram presets and invokes the vendored lint and render scripts; it does not relicense the upstream component.

## Project-provided game-design documents

The knowledge pipeline indexes 49 Korean Markdown documents below the repository `docs/` directory in five categories: career, fun and intent, systems, content, and feedback. The source index records repository-relative path, title, SHA-256, word count, claim classes, and derived-Core links.

Those documents originated in the user-provided workspace and are included only because the user explicitly requested local plugin construction and use. The per-document [rights and provenance manifest](references/source-document-rights.json) records all 49 exact package paths and SHA-256 digests, the inclusion basis, review date, current clearance status, and required action.

The plugin's MIT License excludes these source documents. They are not sublicensed, including their original text, examples, screenshots, trademarks, or other third-party material. Public redistribution rights are not established. A local or private snapshot may retain the documents for the requested use, but the documents must not be included in a public or otherwise distributable release until every manifest entry carries reviewed, package-contained evidence of an explicit redistributable license or permission. The packaged release guard enforces this boundary and currently fails closed for `public` and `distributable` modes.

Derived Core guidance distinguishes evergreen, contextual, and time-sensitive claims. Time-sensitive claims require current primary evidence before use; the local documents are provenance, not proof that an old market, platform, policy, accessibility, monetization, or production statement is still true.
