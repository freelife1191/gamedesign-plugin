# Third-Party Notices and Source Provenance

## Skillstead svg-infographic

- Upstream: https://github.com/kyungseo/skillstead
- Component: `svg-infographic`
- Version: 0.10.0 (`svg-infographic/v0.10.0`, `d46d1443624a7a07773efae213f25dc59bedd358`)
- License: Apache-2.0
- Copyright 2026 Kyungseo Park

The vendored component is preserved with its upstream `LICENSE.txt`. The Game Design Career wrapper selects career-specific diagram presets and invokes the vendored lint and render scripts; it does not relicense the upstream component.

**Modification notice.** This distribution changes one line of one file in this component. `skills/svg-infographic/SKILL.md` carries a Game Design Suite–authored `description` in its YAML frontmatter, replacing the upstream text because the skill router truncates every catalog description past a fixed budget and the upstream wording runs past it. The replacement is declared in `shared/vendor/description-overlays/skillstead.json`, which also pins the SHA-256 of the upstream description it replaces. Every other byte of this component is the upstream release, unchanged, and verified against the vendor lock.

## Archify

- Upstream: https://github.com/tt-a1i/archify
- Version: 2.15.0 (`v2.15.0`, `e1ac748f19cf805e44bf74fb93c796662152e273`)
- License: MIT

The packaged `$archify` skill is a regular-file, SHA-256-locked local release closure. It produces checked architecture HTML and receipts; it does not approve a career decision or portfolio claim.

**Modification notice.** This distribution changes one line of one file in this component. `skills/archify/SKILL.md` carries a Game Design Suite–authored `description` in its YAML frontmatter, replacing the upstream text because the skill router truncates every catalog description past a fixed budget and the upstream wording runs past it. The replacement is declared in `shared/vendor/description-overlays/archify.json`, which also pins the SHA-256 of the upstream description it replaces. Every other byte of this component is the upstream release, unchanged, and verified against the vendor lock.

## im-not-ai humanize-korean

- Upstream: https://github.com/epoko77-ai/im-not-ai
- Version: `v2.3.2` (`bad4ef0a2b514318b2278b65cb4545414ad84d82`)
- License: MIT

The packaged `$humanize-korean` skill is a regular-file, SHA-256-locked copy. Installation uses this local bundle and never runs remote update code.

**Modification notice.** This distribution changes one line of one file in this component. `skills/humanize-korean/SKILL.md` carries a Game Design Suite–authored `description` in its YAML frontmatter, replacing the upstream text because the skill router truncates every catalog description past a fixed budget and the upstream wording runs past it. The replacement is declared in `shared/vendor/description-overlays/im-not-ai.json`, which also pins the SHA-256 of the upstream description it replaces. Every other byte of this component is the upstream release, unchanged, and verified against the vendor lock.

## Project-provided game-design documents

The knowledge pipeline indexes 49 Korean Markdown documents below the repository `docs/` directory in five categories: career, fun and intent, systems, content, and feedback. The source index records repository-relative path, title, SHA-256, word count, claim classes, and derived-Core links.

Those documents were provided as project inputs. This plugin's MIT License does not assert ownership of, or grant additional rights to, their original text, examples, screenshots, trademarks, or other third-party material. Rights remain with their respective owners. A distributor must confirm that it has permission to redistribute any source document copied into a plugin snapshot.

Derived Core guidance distinguishes evergreen, contextual, and time-sensitive claims. Time-sensitive claims require current primary evidence before use; the local documents are provenance, not proof that an old market or hiring statement is still true.
