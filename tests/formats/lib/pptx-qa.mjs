export function transformQuickLookPptxHtml(source, { slideNumber, attachmentNames }) {
  if (typeof source !== "string" || !source.includes("<head") || !source.includes("<body")) throw new Error("Quick Look PPTX preview is missing an HTML document head or body");
  const slideCount = (source.match(/<div\s+class=["']slide["']/gu) ?? []).length;
  if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > slideCount) throw new Error(`Quick Look PPTX slide number ${slideNumber} is outside 1..${slideCount}`);
  const allowed = new Set(attachmentNames);
  for (const match of source.matchAll(/src=["'](Attachment\d+\.pdf)["']/gu)) {
    if (!allowed.has(match[1])) throw new Error(`Quick Look PPTX uses an undeclared attachment: ${match[1]}`);
  }
  let transformed = source.replaceAll(/Attachment(\d+)\.pdf/gu, "Attachment$1.png");
  transformed = transformed.replace(
    /(\b(?:top|right|bottom|left|width|height|font-size|margin(?:-(?:top|right|bottom|left))?)\s*:\s*)(-?(?:\d+(?:\.\d+)?|\.\d+))(?=\s*[;}])/gu,
    "$1$2px",
  );
  const screenshotCss = `<style id="codex-pptx-qa">
html, body { margin: 0 !important; width: 960px !important; height: 540px !important; overflow: hidden !important; background: #ffffff !important; }
body > div.slide { display: none !important; }
body > div.slide:nth-of-type(${slideNumber}) { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; width: 960px !important; height: 540px !important; box-shadow: none !important; }
</style>`;
  return transformed.replace(/<\/head>/u, `${screenshotCss}</head>`);
}
