import { validateDocumentTerminology } from "./manage-game-design-glossary.mjs";

const finding = (code) => Object.freeze({ code });
function englishWarnings(text, locale, glossary) {
  const warnings = []; const us = /\b(?:color|armor|customize|center)\b/iu.test(text); const gb = /\b(?:colour|armour|customise|centre)\b/iu.test(text);
  if ((locale === "en-US" && gb) || (locale === "en-GB" && us) || us && gb) warnings.push(finding("orthography-variant"));
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((match) => match[1]); if (headings.length > 1 && new Set(headings.map((value) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/u.test(value))).size > 1) warnings.push(finding("orthography-variant"));
  const nonTableLines = text.split("\n").filter((line) => !line.trimStart().startsWith("|")); if (nonTableLines.some((line) => /^[A-Z][^.!?]{0,80}$/u.test(line.trim()))) warnings.push(finding("unnecessary-english"));
  return warnings;
}
export function validateGameDesignWritingLanguage(input = {}) {
  if (input.language === "ko" && input.locale === "ko-KR") return Object.freeze({ ...validateDocumentTerminology(input), handoff: "polish-game-design-writing" });
  if (input.language !== "en" || !["en-US", "en-GB"].includes(input.locale)) throw new Error("Writing validation requires ko or a declared en-US/en-GB locale.");
  const terminology = validateDocumentTerminology(input); return Object.freeze({ ...terminology, warnings: Object.freeze([...terminology.warnings, ...englishWarnings(input.text, input.locale, input.effectiveGlossary)]), handoff: "named-human-english-writing-review" });
}
