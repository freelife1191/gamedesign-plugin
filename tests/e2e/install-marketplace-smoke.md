# Temporary marketplace installation smoke

Last verified: 2026-08-05 (Asia/Seoul)

## Portable runner

Run from the repository root:

```bash
npm run smoke:marketplace
```

To exercise encoded paths, create any private temporary parent containing spaces, Korean, and NFC Unicode, then pass it without exposing credentials:

```bash
npm run smoke:marketplace -- --temp-parent "<temporary-parent>/게임 기획 é space"
```

`tooling/marketplace-smoke.mjs` performs the entire test. It discovers `codex`, `python3`, and the installed official plugin validator through runtime paths rather than hardcoded user directories. It creates a cryptographically named guarded root, registers parent/root filesystem identities, and deletes only an atomically quarantined matching identity.

The runner uses a fresh temporary `HOME` and `CODEX_HOME`. When local session authentication is available, it copies `auth.json` opaquely into the guarded Codex home, sets mode `0600`, verifies source identity and destination type/mode, removes `OPENAI_API_KEY` from the child environment, and reports only `authSource: local-session`. Credential contents, size, hashes, and paths are never printed or persisted in repository output.

For each plugin independently, the runner:

1. Adds marketplace `game-design-suite` and asserts exact JSON.
2. Installs only one plugin and asserts `pluginId`, version, installed/enabled state, and cache path.
3. Confirms exactly 11 packaged skills and runs a temporary copy of the official plugin validator.
4. Starts one bounded `codex exec --ephemeral --json --sandbox workspace-write` turn in an isolated workspace.
5. Explicitly invokes the installed orchestrator skill and requires completed JSONL, skill provenance, artifact path, real artifact bytes, and package-local `{ "ok": true, "requestedFormats": ["md"] }` validation.
6. Removes the plugin before installing the other product, then removes the marketplace and asserts an empty final list.
7. Compares production config/plugin-state byte hashes before and after and performs guarded cleanup.

Any nonzero process, timeout, signal, `turn.failed`, 401, missing provenance, missing artifact, failed validator, state drift, or cleanup identity mismatch produces `status: INCOMPLETE` and a nonzero exit.

## Observed structured result

The encoded Korean/NFC/space-path run completed with this secret-free result:

```json
{
  "status": "PASS",
  "marketplace": "game-design-suite",
  "products": [
    {
      "product": "game-design-career",
      "pluginId": "game-design-career@game-design-suite",
      "skill": "$game-design-career:orchestrate-game-design-career",
      "skills": 11,
      "artifact": "validated-md",
      "exec": "completed"
    },
    {
      "product": "game-design-studio",
      "pluginId": "game-design-studio@game-design-suite",
      "skill": "$game-design-studio:orchestrate-game-design-project",
      "skills": 11,
      "artifact": "validated-md",
      "exec": "completed"
    }
  ],
  "authSource": "local-session",
  "productionStateUnchanged": true,
  "temporaryStateCleanup": true,
  "failure": null
}
```

Post-run process inspection found zero marketplace/Codex-exec children, and the encoded temporary parent was empty before its caller removed it.
