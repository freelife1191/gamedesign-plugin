---
name: upgrade-game-design-suite
description: Use when a Game Design Suite update notice appears, or the user asks to check, install, or stop update notices.
---

# Upgrade Game Design Suite

## Overview

Report what is installed, what is available, and what changing it would cost. Never change an installation without an explicit human decision made in this conversation.

## Workflow

1. Read the current advisory. Run the packaged update check and read its JSON. Call no provider command in this step.
2. Report the bundled components alongside the suite version. The advisory carries the installed tag of every bundled skill. A bundled skill is part of the suite package and is never installed or upgraded on its own, so report an available bundled release as something a later suite release delivers, and never as a separate thing to install.
3. Read [codex-commands.md](references/codex-commands.md) for the exact host commands. Never invent a command that is absent from that file.
4. Inspect the installation with the packaged inspection script. It validates the marketplace snapshot and produces a reinstall plan without executing it.
5. Present the four choices below, then stop and wait for an answer.
6. Apply only the chosen option and report the result.

## Choices

- Update now. Apply the verified plan.
- Later. Leave the seven-day advisory state untouched.
- Do not tell me about this version again. Record the answer with the suppress command in the reference file, which covers only this exact installed and latest version pair. Never hand-edit the advisory cache instead.
- Turn update checks off. Explain the `GAME_DESIGN_UPDATE_CHECKS=false` contract, then stop checking and stop writing the cache.

## Operating Rules

- A local marketplace cannot be upgraded from a published release. Explain how to switch to the Git marketplace and never edit marketplace files directly.
- A manifest name mismatch, an equal or lower version, a prerelease, invalid UTF-8, a byte order mark, a symlink, or a path outside the marketplace ends the run as `current` or `unknown` with no install command.
- A dirty local marketplace checkout stops the update and reports the state. Never stash or discard local changes.
- Never run a destructive recovery in an install directory. That includes `git reset --hard`, `rm -rf`, replacing files in place, and restoring from a `.bak` copy.
- Never edit an installed plugin cache or a bundled vendor directory. A bundled skill moves only when a new suite release moves it.
- Never read a GitHub API token or a user API key.
- Never put a token, a user home absolute path, or a remote response body in a failure message.
- Never apply an update without an approval given in this conversation. There is no unattended upgrade setting and adding one is out of scope.

## Result Report

After a successful update, report the previous version, the new version, the products that changed, bundled component changes with their installed tags, and the verification outcome in no more than seven items, then give the instruction to start a new session. Without evidence for a change list, report versions and verification results only and do not guess at features.

## Completion Signal

Stop when the person has chosen and the chosen action has either completed with a verified result or stopped with a visible blocker. An unavailable release, an unreachable network, and an unsupported marketplace layout are all results. None of them is a reason to retry silently.
