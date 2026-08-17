# Codex Host Commands

This file is the only place that names host-specific commands. Replace this file to port the skill to another host; the skill body stays unchanged.

## Read-only, safe before approval

- Advisory: `node scripts/check-game-design-updates.mjs`
- Installation inspection: `node scripts/inspect-game-design-plugin-updates.mjs --inspect`
- Reinstall plan for one plugin: `node scripts/inspect-game-design-plugin-updates.mjs --plan <plugin>`

The plan command prints an ordered argv list. It executes nothing.

## Applied only after an explicit approval

Run the argv list the plan produced, in order, each prefixed with `codex`. For a Git marketplace that is:

1. `codex plugin marketplace upgrade game-design-suite --json`
2. `codex plugin add <plugin>@game-design-suite --json`

For a local marketplace the first entry is absent and only the second runs. Marketplace upgrade fails on a local marketplace, so do not call it there.

## Never run

Plugin removal, any `git` command inside an install directory, and any direct file write under the plugin cache.
