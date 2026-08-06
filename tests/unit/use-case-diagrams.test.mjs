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

test("Studio diagram sources fail closed without their typed five-stage semantic contract", () => {
  const studioSource = {
    ...validFixture,
    id: "st-g01",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: Array.from({ length: 5 }, (_, index) => ({
      stage: ["제약", "선택지", "판단 기준", "결정", "검증"][index],
      label: `판단 ${index + 1}`,
      detail: `근거 ${index + 1}`,
    })),
    semantic: {
      specialist: "design-game-economy-and-liveops",
      outputs: ["economy-balance"],
      validation: "telemetry",
    },
    branches: [
      { label: "보호", detail: "guardrail" },
      { label: "확장", detail: "rollback" },
    ],
  };

  assert.doesNotThrow(() => validateDiagramSource(studioSource));
  assert.throws(() => validateDiagramSource({ ...studioSource, steps: studioSource.steps.slice(0, 4) }), /five stages/u);
  assert.throws(() => validateDiagramSource({ ...studioSource, branches: [studioSource.branches[0]] }), /two branches/u);
  assert.throws(() => validateDiagramSource({ ...studioSource, semantic: { ...studioSource.semantic, outputs: [] } }), /semantic.*outputs/u);
});

test("decision-flow renders two labelled branches that reconverge before its criterion stage", () => {
  const source = {
    ...validFixture,
    id: "st-g01",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: ["제약", "선택지", "판단 기준", "결정", "검증"].map((stage, index) => ({ stage, label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: { specialist: "design-game-economy-and-liveops", outputs: ["economy-balance"], validation: "telemetry" },
    branches: [{ label: "보호 경로", detail: "guardrail" }, { label: "확장 경로", detail: "rollback" }],
  };
  const svg = renderDiagramSvg(source);

  assert.match(svg, /aria-label="선택지 1: 보호 경로"/u);
  assert.match(svg, /aria-label="선택지 2: 확장 경로"/u);
  assert.match(svg, /class="decision-branch"/u);
  assert.match(svg, /재결합: 판단 기준/u);
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

test("renderDiagramSvg preserves every multi-code-unit character at the card length limits", () => {
  const label = "🧩".repeat(20);
  const detail = "🧠".repeat(22);
  const svg = renderDiagramSvg({
    ...validFixture,
    steps: [{ label, detail }, ...validFixture.steps.slice(1)],
  });
  const firstCard = /<g aria-label="읽기 순서 1:[\s\S]*?<\/g>/u.exec(svg)?.[0];
  const text = [...firstCard.matchAll(/<text\b[^>]*>([^<]*)<\/text>/gu)].map((match) => match[1]);

  assert.equal(text.slice(1, 3).join(""), label);
  assert.equal(text.slice(3, 5).join(""), detail);
});

function fixtureFor(type, stepCount) {
  return {
    ...validFixture,
    type,
    steps: Array.from({ length: stepCount }, (_, index) => ({
      label: `단계 ${index + 1}`,
      detail: `검토 ${index + 1}`,
    })),
  };
}

function cardRects(svg) {
  return [...svg.matchAll(/<g aria-label="[^"]+">\s*<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"[^>]*\/>\s*<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/gu)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]), pillX: Number(match[5]), pillY: Number(match[6]), pillWidth: Number(match[7]), pillHeight: Number(match[8]) }));
}

test("renderDiagramSvg keeps every supported layout's 3 and 5 card samples padded, connected, and free of forbidden elements", () => {
  for (const type of ["learning-path", "design-pipeline", "decision-flow", "skill-flow"]) {
    for (const stepCount of [3, 5]) {
      const svg = renderDiagramSvg(fixtureFor(type, stepCount));
      const cards = cardRects(svg);
      const connectors = [...svg.matchAll(/<path d="M (\d+) (\d+) L (\d+) (\d+)"[^>]*marker-end="url\(#open-arrow\)"/gu)]
        .map((match) => ({ startX: Number(match[1]), startY: Number(match[2]), endX: Number(match[3]), endY: Number(match[4]) }));

      assert.equal(cards.length, stepCount, `${type}/${stepCount} cards`);
      assert.equal(connectors.length, stepCount - 1, `${type}/${stepCount} connectors`);
      for (const card of cards) {
        assert.ok(card.x - 52 >= 24 && 1348 - (card.x + card.width) >= 24, `${type}/${stepCount} horizontal container padding`);
        assert.ok(card.y - 274 >= 24 && 630 - (card.y + card.height) >= 24, `${type}/${stepCount} vertical container padding`);
        assert.ok(card.pillX - card.x >= 24 && card.pillY - card.y >= 24, `${type}/${stepCount} internal pill padding`);
        assert.ok(card.width - (card.pillX - card.x) - card.pillWidth >= 24, `${type}/${stepCount} internal right padding`);
        assert.ok(card.height - (card.pillY - card.y) - card.pillHeight >= 24, `${type}/${stepCount} internal bottom padding`);
      }
      for (const [index, connector] of connectors.entries()) {
        assert.equal(connector.startX, cards[index].x + cards[index].width + 12, `${type}/${stepCount} source connector gap`);
        assert.equal(connector.endX, cards[index + 1].x - 12, `${type}/${stepCount} target connector gap`);
        assert.equal(connector.startY, cards[index].y + cards[index].height / 2, `${type}/${stepCount} source connector alignment`);
        assert.equal(connector.endY, cards[index + 1].y + cards[index + 1].height / 2, `${type}/${stepCount} target connector alignment`);
      }
      assert.doesNotMatch(svg, /<(?:foreignObject|image|script|style)\b|@font-face|font-family=|data:image/iu, `${type}/${stepCount} forbidden SVG content`);
    }
  }
});

test("renderDiagramSvg XML-escapes every rendered accessibility and visible text field", () => {
  const source = {
    ...validFixture,
    title: "제목 < & > \" '",
    description: "설명 < & > \" '",
    alt: "대체 < & > \" '",
    eyebrow: "눈썹 < & > \" '",
    conclusion: "결론 < & > \" '",
    steps: validFixture.steps.map((step, index) => ({
      label: `라벨${index}<>&`,
      detail: `상세${index}<>&`,
    })),
  };
  const svg = renderDiagramSvg(source);

  for (const field of [source.title, source.description, source.alt, source.eyebrow, source.conclusion, ...source.steps.flatMap((step) => [step.label, step.detail])]) {
    assert.doesNotMatch(svg, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), `raw XML text: ${field}`);
  }
  for (const escaped of ["&lt;", "&amp;", "&gt;", "&quot;", "&apos;"]) assert.match(svg, new RegExp(escaped, "u"));
});
