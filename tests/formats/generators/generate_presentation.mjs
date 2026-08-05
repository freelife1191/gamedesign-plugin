import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const [presentationPath, outputPath, qaDir] = process.argv.slice(2);
const spec = JSON.parse(await fs.readFile(presentationPath, "utf8"));
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const INK = "#0F172A", MUTED = "#475569", PANEL = "#EDEDED", ACCENT = "#3D8DFF", PALE = "#D0EDFA";

function box(slide, name, left, top, width, height, fill = "none", line = "none", radius = "rect") {
  return slide.shapes.add({ geometry: radius, name, position: { left, top, width, height }, fill, line: { style: "solid", fill: line, width: line === "none" ? 0 : 1 } });
}
function label(slide, name, value, left, top, width, height, fontSize, options = {}) {
  const shape = box(slide, name, left, top, width, height, options.fill ?? "none", options.line ?? "none", options.radius ?? "rect");
  shape.text = value;
  shape.text.style = { fontSize, typeface: "D2Coding", color: options.color ?? INK, bold: options.bold ?? false, alignment: options.alignment ?? "left", verticalAlignment: options.verticalAlignment ?? "top", autoFit: "shrinkText", insets: options.insets ?? { top: 4, right: 4, bottom: 4, left: 4 } };
  return shape;
}
function header(slide, title, number) {
  label(slide, `title-${number}`, title, 42, 34, 1150, 78, 38, { bold: true });
  label(slide, `number-${number}`, String(number), 1180, 665, 58, 24, 14, { color: MUTED, alignment: "right" });
}

for (let index = 0; index < spec.slides.length; index += 1) {
  const item = spec.slides[index];
  const slide = deck.slides.add();
  slide.background.fill = "#FFFFFF";
  const n = index + 1;
  if (item.layout === "cover") {
    label(slide, "cover-kicker", "GAME DESIGN · EVIDENCE BRIEF", 54, 54, 660, 28, 16, { color: ACCENT, bold: true });
    label(slide, "cover-title", item.title, 54, 180, 760, 200, 58, { bold: true });
    label(slide, "cover-subtitle", item.subtitle, 58, 430, 700, 56, 24, { color: MUTED });
    box(slide, "cover-panel", 870, 54, 330, 560, PALE, "#B8BCC4", "roundRect");
    label(slide, "cover-mark", item.coverMetric, 900, 218, 270, 150, item.coverMetric.length > 3 ? 72 : 110, { color: ACCENT, bold: true, alignment: "center", verticalAlignment: "middle" });
    label(slide, "cover-caption", item.coverCaption, 900, 382, 270, 52, 21, { alignment: "center", color: MUTED });
  } else if (item.layout === "half") {
    header(slide, item.title, n);
    label(slide, "half-body", item.body, 52, 220, 550, 300, 25);
    box(slide, "half-visual", 660, 145, 578, 480, "#EAF5FB", "#B8BCC4", "roundRect");
    label(slide, "half-signal", item.title.includes("역할") ? "2" : "5,000", 716, 244, 460, 130, 74, { bold: true, color: ACCENT, alignment: "center", verticalAlignment: "middle" });
    label(slide, "half-caption", item.title.includes("역할") ? "역할 후보" : "목표 보유량", 716, 400, 460, 60, 24, { alignment: "center" });
  } else if (item.layout === "diagram") {
    header(slide, item.title, n);
    for (let i = 0; i < 2; i += 1) box(slide, `connector-${i + 1}`, 330 + i * 330, 332, 110, 4, ACCENT);
    item.nodes.forEach((node, i) => label(slide, `node-${i + 1}`, node, 70 + i * 330, 250, 260, 170, 24, { fill: i === 1 ? PALE : PANEL, line: "#B8BCC4", radius: "roundRect", bold: true, alignment: "center", verticalAlignment: "middle" }));
    label(slide, "diagram-footer", item.footer, 72, 500, 1110, 72, 20, { color: MUTED });
  } else if (item.layout === "table") {
    header(slide, item.title, n);
    const rows = item.rows;
    const top = 150, rowHeight = Math.min(74, 470 / rows.length);
    const widths = rows[0].length === 3 ? [180, 350, 656] : [390, 796];
    rows.forEach((row, ri) => {
      let left = 52;
      row.forEach((cell, ci) => {
        label(slide, `cell-${ri}-${ci}`, cell, left, top + ri * rowHeight, widths[ci], rowHeight, ri === 0 ? 20 : 18, { fill: ri === 0 ? PALE : "#FFFFFF", line: "#94A3B8", bold: ri === 0, verticalAlignment: "middle", insets: { top: 10, right: 12, bottom: 10, left: 12 } });
        left += widths[ci];
      });
    });
  } else if (item.layout === "stats") {
    header(slide, item.title, n);
    item.stats.forEach(([stat, caption], i) => {
      const left = 52 + i * 412;
      box(slide, `stat-panel-${i}`, left, 250, 374, 310, PANEL, "none", "roundRect");
      label(slide, `stat-${i}`, stat, left + 30, 320, 314, 100, 58, { bold: true });
      label(slide, `stat-caption-${i}`, caption, left + 30, 440, 314, 58, 21);
    });
  } else {
    header(slide, item.title, n);
    item.steps.forEach((step, i) => {
      label(slide, `step-num-${i}`, String(i + 1), 60, 170 + i * 130, 68, 68, 31, { fill: PALE, radius: "roundRect", bold: true, alignment: "center", verticalAlignment: "middle" });
      label(slide, `step-${i}`, step, 156, 170 + i * 130, 1000, 72, 24, { bold: true, verticalAlignment: "middle" });
    });
    if (item.footer) label(slide, "result-status", item.footer, 156, 574, 1000, 48, 18, { color: MUTED });
  }
  slide.speakerNotes.textFrame.setText(`[Sources]\n${item.sources.map((source) => `- ${source}`).join("\n")}`);
  slide.speakerNotes.setVisible(true);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(qaDir, { recursive: true });
for (const [index, slide] of deck.slides.items.entries()) {
  const png = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(qaDir, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
}
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(outputPath);
