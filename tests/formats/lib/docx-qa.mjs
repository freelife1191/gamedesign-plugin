const PAGE_BREAK = /<p\b[^>]*>\s*<span\b[^>]*>\f<\/span>\s*<\/p>/giu;
const PAGE_FURNITURE_CSS = [
  ".qa-docx-header{position:fixed;top:35px;left:72px;right:72px;z-index:2}",
  ".qa-docx-footer{position:fixed;bottom:35px;left:72px;right:72px;z-index:2}",
].join("");
const PAGE_TOP_SPACER_CSS = ".qa-docx-page-top-spacer{height:55px}";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function replaceExactlyOne(html, pattern, replacement, label) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Quick Look HTML ${label} region count ${matches.length} does not match 1`);
  return html.replace(pattern, replacement);
}

function bindPageFurniture(html, { headerText, footerText }) {
  if (!headerText || !footerText) throw new Error("Quick Look HTML page furniture requires header and footer text");
  const header = new RegExp(`<div(?:\\s[^>]*)?>\\s*(<p\\b[^>]*>\\s*<span\\b[^>]*>${escapeRegex(headerText)}<\\/span>\\s*<\\/p>)\\s*<\\/div>`, "giu");
  const footer = new RegExp(`(<p\\b[^>]*>\\s*<span\\b[^>]*>${escapeRegex(footerText)}<\\/span>\\s*<\\/p>)`, "giu");
  const withHeader = replaceExactlyOne(html, header, '<header class="qa-docx-header">$1</header>', "header");
  return replaceExactlyOne(withHeader, footer, '<footer class="qa-docx-footer">$1</footer>', "footer");
}

export function transformQuickLookHtml(source, pageFurniture) {
  const html = String(source);
  if (!/<\/head>/iu.test(html)) throw new Error("Quick Look HTML is missing a document head");
  const printCss = `<style>@page{size:8.5in 11in;margin:0}body{margin:0}${PAGE_TOP_SPACER_CSS}${pageFurniture ? PAGE_FURNITURE_CSS : ""}</style>`;
  const printable = html
    .replace(/<\/head>/iu, `${printCss}</head>`)
    .replace(PAGE_BREAK, '<div style="break-after:page"></div><div class="qa-docx-page-top-spacer"></div>')
    .replace(/\f/gu, "");
  return pageFurniture ? bindPageFurniture(printable, pageFurniture) : printable;
}
