# DOCX QA contract

DOCX export is fail-closed. A producer may set `passed` only after validating the OOXML package and all internal relationships, semantically comparing extracted content with the canonical Markdown, and rendering the full document to inspect every page for clipping, overlap, missing glyphs, and broken assets. Any failed check yields `failed`; a check that cannot run yields `unavailable`; unfinished checks remain `pending`.
