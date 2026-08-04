# PPTX QA contract

PPTX export is fail-closed and requires `audience`, `purpose`, and a nonempty `slide_outline` before generation. The outline is a separate story plan, not a section-for-slide transcription. A producer may set `passed` only after checking every slide for text and object overflow and rendering every slide for visual inspection of clipping, overlap, missing glyphs, contrast, and broken assets. Any failed check yields `failed`; a check that cannot run yields `unavailable`; unfinished checks remain `pending`.
