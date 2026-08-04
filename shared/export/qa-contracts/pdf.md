# PDF QA contract

PDF export is fail-closed. A producer may set `passed` only after text extraction preserves the canonical document's semantic content and every page has been rendered and visually inspected for clipping, overlap, missing glyphs, and broken assets. If either check cannot run, use `unavailable`; if either check reports a defect, use `failed`; otherwise retain `pending` until both checks finish.
