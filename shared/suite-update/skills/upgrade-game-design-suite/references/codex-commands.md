# Codex Host Commands

This file is the only place that names host-specific commands. Replace this file to port the skill to another host; the skill body stays unchanged.

## Read-only, safe before approval

Run these from the installed package root, never as a bare relative path. A `scripts/...` path
resolves only when the package root is the working directory, and the agent works in the user's
workspace, so the bare form fails to find the file. The package root is this file's path with
`skills/upgrade-game-design-suite/references/codex-commands.md` removed. A command that fails to
resolve is not a "nothing to update" answer, and neither is one that fails to run: report the
failure as a failure.

- Advisory: `node <package root>/scripts/check-game-design-updates.mjs`
- Installation inspection: `node <package root>/scripts/inspect-game-design-plugin-updates.mjs --inspect`
- Reinstall plan for one plugin: `node <package root>/scripts/inspect-game-design-plugin-updates.mjs --plan <plugin>`
- Installed suite products: `node <package root>/scripts/inspect-game-design-plugin-updates.mjs --products`
- Silence one version pair: `node <package root>/scripts/check-game-design-updates.mjs --suppress [<component> ...]`

The plan command prints an ordered argv list. It executes nothing. It prints `"status":"current"`
instead when the marketplace snapshot is not newer than the installed version, and
`"status":"not-comparable"` when the snapshot version cannot be read at all. Both are results to
report, not errors to retry.

The products command answers which suite products this host has installed. It reports
`"status":"known"` with the installed product ids, and `"status":"unknown"` with an empty list when
the host listing cannot be read or cannot be trusted (a malformed response counts the same as a
missing one). Unknown is a result to report as "확인 불가", not an error to retry.

The suppress command records the "do not tell me about this version again" answer. It writes only
the suppression list in the advisory cache and changes no installation. With no component named it
answers for every component the last advisory reported as outdated. It reports `unavailable` when
no advisory has been cached yet, so run the advisory first.

A component is one of `skillstead`, `archify`, `im-not-ai`, `game-design-suite`. These are the ids
the advisory reports, and they are the only accepted arguments. The name of an installed product is
not a component and the command refuses it. Prefer naming no component at all, which answers for
exactly the set the notification named.

## Applied only after an explicit approval

Run the argv list the plan produced, in order, each prefixed with `codex`. For a Git marketplace that is:

1. `codex plugin marketplace upgrade game-design-suite --json`
2. `codex plugin add <plugin>@game-design-suite --json`

For a local marketplace the first entry is absent and only the second runs. Marketplace upgrade fails on a local marketplace, so do not call it there.

## Never run

Plugin removal, any `git` command inside an install directory, and any direct file write under the plugin cache.
