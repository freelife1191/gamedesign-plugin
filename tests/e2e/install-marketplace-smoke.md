# Temporary marketplace installation smoke

Last verified: 2026-08-05 (Asia/Seoul)

Codex command: `codex plugin` (`add`, not the obsolete `install` spelling)

Marketplace: `game-design-suite`

## Safety boundary

The smoke used a newly created canonical directory below the OS temporary root. Both `HOME` and `CODEX_HOME` pointed inside it for every Codex invocation. The real `/Users/freelife/.codex/config.toml` SHA-256 was captured before and after; both values were:

```text
ac4153126e33984927891b3d86a0d8657f70a4dc019f3f39a3cdd3f1ed54cbc5
```

After the smoke, a recursive text search found no `game-design-suite`, `game-design-career`, or `game-design-studio` entry in the production config or production plugin state. The temporary root used for the recorded run was `/private/var/folders/99/kpfx0mdj3fvbczqpbncjl0bm0000gn/T/game-design-marketplace-bvaTK6`; it was retained only long enough to inspect the removed state and then deleted by the exact canonical path guard described below.

## Reproduction commands

Run these from the repository root. The guard deliberately requires the canonical temporary prefix before any cleanup.

```bash
canonical_tmp="$(cd "${TMPDIR%/}" && pwd -P)"
smoke_root="$(mktemp -d "$canonical_tmp/game-design-marketplace-XXXXXX")"
mkdir -p "$smoke_root/home" "$smoke_root/codex-home" "$smoke_root/workspace"
smoke_root="$(cd "$smoke_root" && pwd -P)"
case "$smoke_root" in "$canonical_tmp"/game-design-marketplace-*) ;; *) exit 1;; esac

smoke_env=(env HOME="$smoke_root/home" CODEX_HOME="$smoke_root/codex-home" TMPDIR="$smoke_root" PATH="$PATH")
"${smoke_env[@]}" codex plugin marketplace add "$PWD" --json
"${smoke_env[@]}" codex plugin marketplace list --json

for plugin_name in game-design-career game-design-studio; do
  "${smoke_env[@]}" codex plugin add "$plugin_name@game-design-suite" --json
  "${smoke_env[@]}" codex plugin list --json

  cache_root="$smoke_root/codex-home/plugins/cache/game-design-suite/$plugin_name/0.1.0"
  test -d "$cache_root"
  test "$(find "$cache_root/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')" = 11
  python3 /Users/freelife/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py "$cache_root"

  artifact="$smoke_root/workspace/$plugin_name-artifact"
  cp -R "$cache_root/assets/shared/templates/canonical-artifact" "$artifact"
  node "$cache_root/scripts/validate-artifact.mjs" "$artifact" md

  "${smoke_env[@]}" codex plugin remove "$plugin_name@game-design-suite" --json
  test ! -e "$cache_root"
done

"${smoke_env[@]}" codex plugin marketplace remove game-design-suite --json
"${smoke_env[@]}" codex plugin marketplace list --json
test "$(find "$smoke_root/codex-home/plugins/cache/game-design-suite" -mindepth 1 -print -quit)" = ""

registered_root="$smoke_root"
test "$(cd "$registered_root" && pwd -P)" = "$registered_root"
case "$registered_root" in "$canonical_tmp"/game-design-marketplace-*) ;; *) exit 1;; esac
test ! -L "$registered_root"
rm -r "$registered_root"
```

## Observed evidence

- `marketplace add --json` returned `marketplaceName: game-design-suite`, `alreadyAdded: false`, and the canonical repository root.
- Career installed alone at `.../plugins/cache/game-design-suite/game-design-career/0.1.0`; `plugin list --json` contained only Career.
- Studio installed alone at `.../plugins/cache/game-design-suite/game-design-studio/0.1.0`; `plugin list --json` contained only Studio.
- Each installed cache contained exactly 11 `SKILL.md` files, passed the official local plugin validator, and its package-local canonical starter returned `ok: true` with `requestedFormats: ["md"]` from its installed `scripts/validate-artifact.mjs`.
- Each cache path disappeared after its corresponding `plugin remove --json` call.
- Final `marketplace list --json` returned an empty `marketplaces` array.
- Codex emitted a warning that it would not create helper aliases under the temporary directory. This is expected fail-safe behavior and did not change the plugin install/cache/validation result.
- Final result: `MARKETPLACE_SMOKE=PASS`.
