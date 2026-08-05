const PAGE_BREAK = /<p\b[^>]*>\s*<span\b[^>]*>\f<\/span>\s*<\/p>/giu;

export function transformQuickLookHtml(source) {
  const html = String(source);
  if (!/<\/head>/iu.test(html)) throw new Error("Quick Look HTML is missing a document head");
  const printCss = "<style>@page{size:8.5in 11in;margin:0}body{margin:0}</style>";
  return html
    .replace(/<\/head>/iu, `${printCss}</head>`)
    .replace(PAGE_BREAK, '<div style="break-after:page"></div>')
    .replace(/\f/gu, "");
}
