# Cutscene Generation Guide

1. Create the style-master prompt, select one result, place it under `assets/generated/`, and record its current SHA-256.
2. Create character, environment, prop, and color-lighting masters using that selected style binding.
3. Create approved major keyframes using the bound master asset IDs and hashes.
4. Create only the connected storyboard shots and visual variants whose blocking, prop, or state differs.
5. Make a contact sheet and review face, costume, prop, lighting, camera-axis, subtitle-safe-area, and return-to-play continuity.
6. Retry only the failed stable asset ID; do not regenerate successful unrelated assets.

For App or CLI requests, paste the matching prompt package entry, its ordered bound references,
requested size, and wave ID. Do not send a template-ready package to an image provider.
