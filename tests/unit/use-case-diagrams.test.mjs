import assert from "node:assert/strict";
import test from "node:test";

import { renderDiagramSvg, validateDiagramSource } from "../../tooling/lib/use-case-diagrams.mjs";

const validFixture = Object.freeze({
  id: "aud-01",
  scope: "audiences",
  title: "게임 기획 입문 학생 학습 경로",
  description: "관찰에서 작은 규칙 실습까지 이어지는 학습 흐름",
  alt: "게임 기획 입문 학생의 학습 경로",
  type: "learning-path",
  eyebrow: "AUD-01 · FOUNDATION",
  conclusion: "교사 또는 멘토 검토 뒤 다음 실습을 정합니다.",
  steps: [
    { label: "관찰 기록", detail: "사실과 추론을 나눕니다." },
    { label: "용어 익히기", detail: "규칙과 목표를 설명합니다." },
    { label: "규칙 실습", detail: "작은 규칙표를 만듭니다." },
  ],
  source_paths: ["guides/use-cases/audience-paths.md"],
  used_by: ["guides/use-cases/audience-paths.md"],
});

test("renderDiagramSvg creates an accessible 1400 by 900 Skillstead source", () => {
  const svg = renderDiagramSvg(validFixture);

  assert.match(svg, /^<svg[^>]+viewBox="0 0 1400 900"[^>]*>\n  <title>[^<]+<\/title>\n  <desc>[^<]+<\/desc>/u);
  assert.doesNotMatch(svg, /<(?:style|foreignObject|script)\b/iu);
  assert.match(svg, /aria-label="읽기 순서 1:/u);
});

test("diagram source rejects an unsupported type and fewer than three steps", () => {
  assert.throws(() => validateDiagramSource({ ...validFixture, type: "chart" }), /type/u);
  assert.throws(() => validateDiagramSource({ ...validFixture, steps: validFixture.steps.slice(0, 2) }), /steps/u);
});

test("renderDiagramSvg XML-escapes source strings and preserves step reading order", () => {
  const svg = renderDiagramSvg({
    ...validFixture,
    title: "관찰 < 규칙 & 피드백",
    steps: validFixture.steps.map((step, index) => ({ ...step, label: `${index + 1} > 다음` })),
  });

  assert.match(svg, /<title>관찰 &lt; 규칙 &amp; 피드백<\/title>/u);
  assert.match(svg, /aria-label="읽기 순서 3: 3 &gt; 다음"/u);
});

test("diagram source rejects card text that cannot fit without truncation", () => {
  const detail = "첫째 둘째 셋째 넷째 다섯째 여섯째 일곱째";

  assert.throws(() => validateDiagramSource({
    ...validFixture,
    steps: [{ ...validFixture.steps[0], detail }, ...validFixture.steps.slice(1)],
  }), /detail.*length|detail.*fit/u);
});
