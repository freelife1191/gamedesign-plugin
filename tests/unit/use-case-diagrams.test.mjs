import assert from "node:assert/strict";
import test from "node:test";

import { renderDiagramSvg, validateDiagramSource, validateUseCaseDiagramSvg } from "../../tooling/lib/use-case-diagrams.mjs";

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

test("non-Career decision-flow rejects a third branch instead of rendering overlapping branch boxes", () => {
  const source = {
    ...validFixture,
    id: "aud-three-branch",
    type: "decision-flow",
    steps: Array.from({ length: 5 }, (_, index) => ({ label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    branches: [
      { label: "첫째 경로", detail: "첫째 근거" },
      { label: "둘째 경로", detail: "둘째 근거" },
      { label: "셋째 경로", detail: "셋째 근거" },
    ],
  };

  assert.throws(() => validateDiagramSource(source), /decision-flow.*exactly two branches/u);
});

test("non-Career two-branch decision-flow preserves the established branch coordinates", () => {
  const source = {
    ...validFixture,
    id: "aud-two-branch",
    type: "decision-flow",
    steps: Array.from({ length: 5 }, (_, index) => ({ label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    branches: [
      { label: "첫째 경로", detail: "첫째 근거" },
      { label: "둘째 경로", detail: "둘째 근거" },
    ],
  };
  const svg = renderDiagramSvg(source);

  assert.deepEqual(
    [...svg.matchAll(/<rect x="560" y="(\d+)" width="180"/gu)].map((match) => Number(match[1])),
    [298, 505],
  );
});

test("Studio competency cards expose their exact specialist and output IDs", () => {
  const source = {
    ...validFixture,
    id: "st-c07",
    scope: "game-design-studio-use-case",
    type: "design-pipeline",
    steps: ["입력", "전문 스킬", "Canonical Artifact", "검토", "출력"].map((stage, index) => ({ stage, label: `단계 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: {
      specialist: "design-game-economy-and-liveops",
      outputs: ["economy-balance", "liveops-experiment-event"],
      review: { skill: "review-game-design", condition: "named owner 검토" },
    },
  };
  const svg = renderDiagramSvg(source);
  for (const value of [source.semantic.specialist, ...source.semantic.outputs]) assert.match(svg, new RegExp(value, "u"));
  assert.doesNotMatch(svg, /(?:textLength|lengthAdjust|font-stretch)|…/u);
  assert.doesNotThrow(() => validateUseCaseDiagramSvg(svg, source.id));
});

test("Studio skill flow exposes exact outputs and every conditional next route", () => {
  const routes = [
    "define-game-vision", "design-game-systems", "design-game-content", "design-player-experience", "design-game-economy-and-liveops",
    "plan-game-production", "review-game-design", "visualize-game-design", "export-game-design-documents",
  ];
  const source = {
    ...validFixture,
    id: "st-s09",
    scope: "game-design-studio-skill",
    type: "skill-flow",
    steps: ["trigger", "필수 입력", "skill-owned work", "output", "next route"].map((stage, index) => ({ stage, label: `단계 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: { skill: "orchestrate-game-design-project", required_input: "canonical-artifact + domain route requests", outputs: ["game-design-brief", "canonical-artifact"], next_routes: routes },
  };
  const svg = renderDiagramSvg(source);

  for (const value of [source.semantic.skill, ...source.semantic.outputs, ...routes]) assert.match(svg, new RegExp(value, "u"));
  assert.ok([...svg.matchAll(/<text x="72" y="(\d+)"/gu)].every((match) => Number(match[1]) < 704), "semantic rail stays above the conclusion strip");
});

test("legacy skill-flow retains its established generator contract", () => {
  const source = {
    ...validFixture,
    id: "st-s07",
    scope: "game-design-studio-skill",
    type: "skill-flow",
    steps: ["trigger", "필수 입력", "skill-owned work", "output", "next route"].map((stage, index) => ({ stage, label: `단계 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: {
      skill: "export-game-design-documents",
      required_input: "canonical-artifact + requested formats",
      outputs: ["export-preparation-manifest", "format-jobs"],
      next_routes: [],
      next_condition: "pending format job → downstream renderer QA",
    },
  };
  const svg = renderDiagramSvg(source);

  assert.match(svg, /pending format job → downstream renderer QA/u);
});

test("Studio skill cards wrap whole Latin and hyphenated tokens without splitting them", () => {
  const source = {
    ...validFixture,
    id: "st-s03",
    scope: "game-design-studio-skill",
    type: "skill-flow",
    steps: ["trigger", "필수 입력", "skill-owned work", "output", "next route"].map((stage, index) => ({
      stage,
      label: index === 0 ? "콘텐츠 trigger" : index === 2 ? "asset lifecycle 검토" : `단계 ${index + 1}`,
      detail: index === 0 ? "co-op handoff" : `근거 ${index + 1}`,
    })),
    semantic: {
      skill: "design-game-content",
      required_input: "quest intent + rights boundary",
      outputs: ["narrative-quest-npc"],
      next_routes: ["review-game-design"],
    },
  };
  const svg = renderDiagramSvg(source);

  assert.match(svg, />콘텐츠<\/text>\n\s*<text[^>]*>trigger<\/text>/u);
  assert.match(svg, />co-op<\/text>\n\s*<text[^>]*>handoff<\/text>/u);
  assert.doesNotMatch(svg, />trigge<\/text>\n\s*<text[^>]*>r<\/text>/u);
  assert.doesNotMatch(svg, />hando<\/text>\n\s*<text[^>]*>ff<\/text>/u);
  const titleBottom = Number(svg.match(/<text[^>]*y="(\d+)"[^>]*>검토<\/text>/u)?.[1]);
  const exactTop = Number(svg.match(/<text[^>]*y="(\d+)"[^>]*>design-game-content<\/text>/u)?.[1]);
  assert.ok(exactTop - titleBottom >= 24, `skill ID must clear the wrapped card title: ${titleBottom} -> ${exactTop}`);
});

test("mixed-language validation strings preserve whole Latin tokens in natural tspans", () => {
  const source = {
    ...validFixture,
    id: "st-g03",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: ["제약", "선택지", "판단 기준", "결정", "검증"].map((stage, index) => ({ stage, label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: { specialist: "design-game-systems", outputs: ["system-specification"], validation: "co-op rejoin prototype와 이탈 telemetry" },
    branches: [{ label: "동료 구조", detail: "rejoin" }, { label: "안전 탈출", detail: "telemetry" }],
  };
  const svg = renderDiagramSvg(source);

  assert.match(svg, /co-op rejoin prototype와 이탈/u);
  assert.doesNotMatch(svg, /(?:textLength|lengthAdjust)|…/u);
});

test("product SVGs fail closed for spaced distortion attributes and every typography-role minimum", () => {
  const source = {
    ...validFixture,
    id: "st-g01",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: ["제약", "선택지", "판단 기준", "결정", "검증"].map((stage, index) => ({ stage, label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: { specialist: "design-game-economy-and-liveops", outputs: ["economy-balance"], validation: "telemetry" },
    branches: [{ label: "보호", detail: "guardrail" }, { label: "확장", detail: "rollback" }],
  };
  const svg = renderDiagramSvg(source);
  for (const [mutation, role] of [
    [svg.replace('font-size="42"', 'font-size="13"'), "title"],
    [svg.replace("<text", '<text textLength = "1"'), "textLength"],
    [svg.replace("<text", '<text style="font: 1px serif"'), "typography"],
    [svg.replace("<text", '<text style= "font: 1px serif"'), "typography"],
    [svg.replace("<text", "<text style = 'font-size: 1px'"), "typography"],
    [svg.replace("<text", '<text style\t=\n"font: 1px serif"'), "typography"],
    [svg.replace("<g class=", '<g transform = "scale(0.1)" class='), "ancestor"],
    [svg.replace("<g class=", '<g transform = "skewX(15)" class='), "ancestor"],
    [svg.replace("<g class=", "<g transform= 'skewX(15)' class="), "ancestor"],
    [svg.replace("<text", '<text transform="skewY(15)"'), "glyph-scaling"],
    [svg.replace("<text", "<text transform = 'skewX(15)'"), "glyph-scaling"],
    [svg.replace('<tspan x="88"', '<tspan font-size="13" x="88"'), "title"],
    [svg.replace('<tspan x="88"', "<tspan font-size= '13' x=\"88\""), "title"],
    [svg.replace('<tspan x="88"', '<tspan font-size = "13" x="88"'), "title"],
  ]) assert.throws(() => validateUseCaseDiagramSvg(mutation, source.id), new RegExp(`${source.id}.*${role}.*repair source layout`, "u"));
});

test("branched decision-flow uses a vertical 4-to-5 connector with a twelve-pixel target gap", () => {
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

  assert.match(svg, /<path d="M 1140 442 L 1140 453"[^>]*marker-end="url\(#open-arrow\)"/u);
  assert.doesNotMatch(svg, /<path d="M 1252 362 L 1028 545"/u);
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

test("card roles reject over-wide unbreakable ASCII tokens across every renderer layout", () => {
  const longTokens = [
    "WWWW_WWWW_WWWW",
    "WWWW.WWWW.WWWW",
    "WWWW/WWWW/WWWW",
  ];
  const studioPipeline = {
    ...validFixture,
    id: "st-c01",
    scope: "game-design-studio-use-case",
    type: "design-pipeline",
    steps: ["입력", "전문 스킬", "Canonical Artifact", "검토", "출력"].map((stage, index) => ({ stage, label: `단계 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: {
      specialist: "define-game-vision",
      outputs: ["vision-pillars"],
      review: { skill: "review-game-design", condition: "named owner 검토" },
    },
  };
  const studioDecision = {
    ...validFixture,
    id: "st-g01",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: ["제약", "선택지", "판단 기준", "결정", "검증"].map((stage, index) => ({ stage, label: `판단 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: { specialist: "design-game-systems", outputs: ["system-specification"], validation: "telemetry" },
    branches: [{ label: "보호 경로", detail: "guardrail" }, { label: "확장 경로", detail: "rollback" }],
  };
  const studioSkill = {
    ...validFixture,
    id: "st-s03",
    scope: "game-design-studio-skill",
    type: "skill-flow",
    steps: ["trigger", "필수 입력", "skill-owned work", "output", "next route"].map((stage, index) => ({ stage, label: `단계 ${index + 1}`, detail: `근거 ${index + 1}` })),
    semantic: {
      skill: "design-game-content",
      required_input: "quest intent + rights boundary",
      outputs: ["narrative-quest-npc"],
      next_routes: ["review-game-design"],
    },
  };
  const sources = [
    fixtureFor("learning-path", 3),
    fixtureFor("design-pipeline", 5),
    fixtureFor("decision-flow", 5),
    fixtureFor("skill-flow", 5),
    studioPipeline,
    studioDecision,
    studioSkill,
  ];

  for (const source of sources) {
    for (const field of ["label", "detail"]) {
      for (const longToken of longTokens) {
        const mutated = { ...source, steps: source.steps.map((step, index) => index === 0 ? { ...step, [field]: longToken } : step) };
        const expected = new RegExp(`steps\\[0\\]\\.${field}.*unbreakable ASCII token.*exceeds.*text box.*spaces or hyphens`, "u");
        assert.throws(() => validateDiagramSource(mutated), expected, `${source.scope}/${source.type}/${field}/${longToken} validates`);
        assert.throws(() => renderDiagramSvg(mutated), expected, `${source.scope}/${source.type}/${field}/${longToken} renders`);
      }
    }

    if (source.type === "decision-flow") {
      for (const field of ["label", "detail"]) {
        for (const longToken of longTokens) {
          const mutated = { ...source, branches: source.branches.map((branch, index) => index === 0 ? { ...branch, [field]: longToken } : branch) };
          const expected = new RegExp(`branches\\[0\\]\\.${field}.*unbreakable ASCII token.*exceeds.*text box.*spaces or hyphens`, "u");
          assert.throws(() => validateDiagramSource(mutated), expected, `${source.scope}/${source.type}/branch/${field}/${longToken} validates`);
          assert.throws(() => renderDiagramSvg(mutated), expected, `${source.scope}/${source.type}/branch/${field}/${longToken} renders`);
        }
      }
    }
  }
});

test("pure ASCII punctuation tokens use the same width gate as alphanumeric tokens", () => {
  const underscoreToken = "_".repeat(20);
  const slashToken = "/".repeat(20);
  const source = fixtureFor("learning-path", 3);

  for (const field of ["label", "detail"]) {
    const mutated = { ...source, steps: source.steps.map((step, index) => index === 0 ? { ...step, [field]: underscoreToken } : step) };
    const expected = new RegExp(`steps\\[0\\]\\.${field}.*unbreakable ASCII token.*exceeds.*text box`, "u");
    assert.throws(() => validateDiagramSource(mutated), expected, `${field}/${underscoreToken} validates`);
    assert.throws(() => renderDiagramSvg(mutated), expected, `${field}/${underscoreToken} renders`);
  }

  const slashLabelSource = { ...source, steps: source.steps.map((step, index) => index === 0 ? { ...step, label: slashToken } : step) };
  assert.throws(() => validateDiagramSource(slashLabelSource), /steps\[0\]\.label.*unbreakable ASCII token.*exceeds.*text box/u);
  assert.throws(() => renderDiagramSvg(slashLabelSource), /steps\[0\]\.label.*unbreakable ASCII token.*exceeds.*text box/u);

  const decisionSource = fixtureFor("decision-flow", 5);
  for (const field of ["label", "detail"]) {
    const mutated = { ...decisionSource, branches: decisionSource.branches.map((branch, index) => index === 0 ? { ...branch, [field]: underscoreToken } : branch) };
    const expected = new RegExp(`branches\\[0\\]\\.${field}.*unbreakable ASCII token.*exceeds.*text box`, "u");
    assert.throws(() => validateDiagramSource(mutated), expected, `branch/${field}/${underscoreToken} validates`);
    assert.throws(() => renderDiagramSvg(mutated), expected, `branch/${field}/${underscoreToken} renders`);
  }

  const boundaryToken = ".".repeat(20);
  const boundarySource = {
    ...decisionSource,
    steps: decisionSource.steps.map((step, index) => index === 0 ? { ...step, label: boundaryToken, detail: slashToken } : step),
    branches: decisionSource.branches.map((branch, index) => index === 0 ? { label: slashToken, detail: boundaryToken } : branch),
  };
  assert.doesNotThrow(() => validateDiagramSource(boundarySource));
  assert.doesNotThrow(() => renderDiagramSvg(boundarySource));
});

test("the tightest card accepts a boundary-fit Latin run and wraps only at hyphens", () => {
  const source = {
    ...validFixture,
    id: "st-g01",
    scope: "game-design-studio-use-case",
    type: "decision-flow",
    steps: ["제약", "선택지", "판단 기준", "결정", "검증"].map((stage, index) => ({
      stage,
      label: index === 0 ? "W".repeat(7) : `판단 ${index + 1}`,
      detail: `근거 ${index + 1}`,
    })),
    semantic: { specialist: "design-game-systems", outputs: ["system-specification"], validation: "telemetry" },
    branches: [{ label: "보호 경로", detail: "guardrail" }, { label: "확장 경로", detail: "rollback" }],
  };

  assert.doesNotThrow(() => validateDiagramSource(source));
  const svg = renderDiagramSvg(source);
  assert.match(svg, />WWWWWWW<\/tspan>/u);

  const hyphenSource = fixtureFor("learning-path", 3);
  hyphenSource.steps[0].label = "WWWWWW-WWWWWW";
  assert.doesNotThrow(() => validateDiagramSource(hyphenSource));
  assert.match(renderDiagramSvg(hyphenSource), />WWWWWW-<\/text>\n\s*<text[^>]*>WWWWWW<\/text>/u);
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
    ...(type === "decision-flow" ? {
      branches: [
        { label: "첫째 경로", detail: "첫째 근거" },
        { label: "둘째 경로", detail: "둘째 근거" },
      ],
    } : {}),
  };
}

function cardRects(svg) {
  return [...svg.matchAll(/<g aria-label="[^"]+">\s*<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"[^>]*\/>\s*<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/gu)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]), pillX: Number(match[5]), pillY: Number(match[6]), pillWidth: Number(match[7]), pillHeight: Number(match[8]) }));
}

test("renderDiagramSvg keeps every supported layout's 3 and 5 card samples padded, connected, and free of forbidden elements", () => {
  for (const type of ["learning-path", "design-pipeline", "decision-flow", "skill-flow"]) {
    for (const stepCount of type === "decision-flow" ? [5] : [3, 5]) {
      const svg = renderDiagramSvg(fixtureFor(type, stepCount));
      const cards = cardRects(svg);
      const connectors = [...svg.matchAll(/<path d="M (\d+) (\d+) L (\d+) (\d+)"[^>]*marker-end="url\(#open-arrow\)"/gu)]
        .map((match) => ({ startX: Number(match[1]), startY: Number(match[2]), endX: Number(match[3]), endY: Number(match[4]) }));

      assert.equal(cards.length, stepCount, `${type}/${stepCount} cards`);
      assert.equal(connectors.length, type === "decision-flow" ? 3 : stepCount - 1, `${type}/${stepCount} connectors`);
      for (const card of cards) {
        assert.ok(card.x - 52 >= 24 && 1348 - (card.x + card.width) >= 24, `${type}/${stepCount} horizontal container padding`);
        const minimumVerticalPadding = type === "decision-flow" ? 4 : 24;
        assert.ok(card.y - 274 >= minimumVerticalPadding && 630 - (card.y + card.height) >= minimumVerticalPadding, `${type}/${stepCount} vertical container padding`);
        assert.ok(card.pillX - card.x >= 24 && card.pillY - card.y >= 24, `${type}/${stepCount} internal pill padding`);
        assert.ok(card.width - (card.pillX - card.x) - card.pillWidth >= 24, `${type}/${stepCount} internal right padding`);
        assert.ok(card.height - (card.pillY - card.y) - card.pillHeight >= 24, `${type}/${stepCount} internal bottom padding`);
      }
      if (type !== "decision-flow") {
        for (const [index, connector] of connectors.entries()) {
          assert.equal(connector.startX, cards[index].x + cards[index].width + 12, `${type}/${stepCount} source connector gap`);
          assert.equal(connector.endX, cards[index + 1].x - 12, `${type}/${stepCount} target connector gap`);
          assert.equal(connector.startY, cards[index].y + cards[index].height / 2, `${type}/${stepCount} source connector alignment`);
          assert.equal(connector.endY, cards[index + 1].y + cards[index + 1].height / 2, `${type}/${stepCount} target connector alignment`);
        }
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
