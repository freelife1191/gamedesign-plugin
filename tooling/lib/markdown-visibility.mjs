import {
  collectMarkdownHeadings,
  scanVisibleMarkdown,
} from "./user-guides.mjs";

// This is the single cross-validator boundary for Markdown visibility and headings.
// user-guides owns the implementation and preserves its public exports; consumers
// import this neutral adapter instead of maintaining a second parser.
export {
  collectMarkdownHeadings,
  scanVisibleMarkdown,
};
