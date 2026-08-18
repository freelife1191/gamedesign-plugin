import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseSuiteHandoffContract,
  validateHandoffChain,
  validateHandoffRequest,
  validateHandoffReturn,
} from "../../tooling/lib/suite-handoff-contract.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const PRODUCTS = Object.freeze(["game-design-career", "game-design-studio"]);

function packagedContract(product) {
  return path.join(repoRoot, "plugins", product, "skills", product, "references/handoff.md");
}

test("both products ship the same handoff contract bytes", async () => {
  const [career, studio] = await Promise.all(PRODUCTS.map((product) => readFile(packagedContract(product))));
  assert.ok(career.equals(studio), "the two packaged handoff contracts differ");
  const source = await readFile(path.join(repoRoot, "shared/suite-handoff/references/handoff.md"));
  assert.ok(source.equals(career), "the packaged contract is not the shared source");
});

test("the contract lives inside a sentinel block that a parser can find", async () => {
  const contract = await readFile(packagedContract("game-design-studio"), "utf8");
  assert.equal(contract.split("<!-- suite-handoff-contract:start -->").length - 1, 1);
  assert.equal(contract.split("<!-- suite-handoff-contract:end -->").length - 1, 1);
  assert.ok(
    contract.indexOf("<!-- suite-handoff-contract:start -->") < contract.indexOf("<!-- suite-handoff-contract:end -->"),
  );
});

const contractMarkdown = await readFile(
  path.join(repoRoot, "shared/suite-handoff/references/handoff.md"),
  "utf8",
);
const contract = parseSuiteHandoffContract(contractMarkdown);

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-request-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    requestedOutputs: ["system-evidence-summary"],
    sourceArtifactIds: ["combat-spec"],
    returnToSkill: "game-design-career",
    ...overrides,
  };
}

function envelopeReturn(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "suite-handoff-return-v1",
    ownerProduct: "game-design-career",
    supplierProduct: "game-design-studio",
    facts: ["combat spec names three damage types"],
    inferences: [],
    recommendations: [],
    unknowns: ["balance targets are not published"],
    ...overrides,
  };
}

test("a well-formed request and return are accepted", () => {
  assert.deepEqual(validateHandoffRequest(request(), contract), { ok: true, errors: [] });
  assert.deepEqual(validateHandoffReturn(envelopeReturn(), contract), { ok: true, errors: [] });
});

// 스펙 C절 테스트 전략이 나열한 여섯 거부 사유 중 다섯은 여기서 검증한다. 여섯 번째
// ("owner와 supplier 뒤바뀜")은 봉투 하나만으로는 뜻이 없다 — 아래 "mirrors (swaps)" 테스트를 보라
// (Ruling 10). 각 사례는 정확한 오류 메시지까지 확인한다: `errors.length > 0`만 보면 엉뚱한 규칙이
// 우연히 먼저 걸려도 통과해 버린다 — 이름이 가리키는 규칙이 아니라 다른 규칙 때문에 거부됐다는
// 뜻이므로, 그 사례는 자기가 지키려는 것을 지키지 못하는 채로 계속 통과한다.
test("the contract refuses every malformed envelope the spec names", () => {
  const cases = [
    ["returnToSkill does not match the owner", () => validateHandoffRequest(
      request({ returnToSkill: "game-design-studio" }), contract),
      "returnToSkill must be the owner product's entry skill"],
    ["unknown product id", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-suite" }), contract),
      "supplierProduct is not a suite product"],
    ["requestedOutputs outside the enum", () => validateHandoffRequest(
      request({ requestedOutputs: ["salary-benchmark"] }), contract),
      "requestedOutputs holds a value outside the contract enum"],
    ["owner equals supplier", () => validateHandoffRequest(
      request({ supplierProduct: "game-design-career" }), contract),
      "ownerProduct and supplierProduct must differ"],
    // unknowns를 undefined로 두면(스프레드가 키를 그대로 남긴다) 리스트-타입 검사만 걸린다.
    // 이 사례가 이름대로 폐쇄 키 검사를 시험하려면 키 자체를 지워야 한다.
    ["return envelope missing a field", () => {
      const { unknowns, ...withoutUnknowns } = envelopeReturn();
      return validateHandoffReturn(withoutUnknowns, contract);
    }, "envelope keys do not match the contract"],
  ];
  for (const [name, run, expectedMessage] of cases) {
    const result = run();
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.includes(expectedMessage), `${name}: ${result.errors.join("\n")}`);
  }
});

test("a supplier cannot start a second handoff for the same request", () => {
  const first = request();
  const second = request({ ownerProduct: "game-design-studio", supplierProduct: "game-design-career", returnToSkill: "game-design-studio" });
  assert.equal(validateHandoffChain([first, envelopeReturn()], contract).ok, true);
  const chained = validateHandoffChain([first, envelopeReturn(), second], contract);
  assert.equal(chained.ok, false);
  assert.ok(chained.errors.some((message) => /one handoff/u.test(message)), chained.errors.join("\n"));
});

// Ruling 9: 봉투 하나만 봐서는 owner가 누구인지 알 수 없다 — 최종 산출물을 내는 쪽이 owner라는
// 사실은 사슬을 연 요청이 정하고, 반환은 그 요청에 동의해야만 유효하다. 그래서 사슬은 요청
// 하나로 시작해야 하고, 모든 반환은 그 요청의 ownerProduct·supplierProduct와 일치해야 한다.
test("validateHandoffChain relates every return to the request it answers", () => {
  const first = request();
  const cases = [
    ["a return with no preceding request is refused",
      [envelopeReturn()], /must start with a request/u],
    ["a chain of only returns is refused",
      [envelopeReturn(), envelopeReturn(), envelopeReturn()], /must start with a request/u],
    ["a return naming a different owner than its request is refused",
      [first, envelopeReturn({ ownerProduct: "game-design-studio" })], /must agree with its request/u],
    // ownerProduct는 요청과 그대로 맞춘 채 supplierProduct만 바꾼다 — owner 절반만 시험하는 위
    // 사례와 달리 이 사례는 agreement 검사의 supplierProduct 절반이 실제로 켜지는지를 시험한다.
    ["a return agreeing on the owner but naming a different supplier than its request is refused",
      [first, envelopeReturn({ supplierProduct: "game-design-suite" })], /must agree with its request/u],
  ];
  for (const [name, envelopes, pattern] of cases) {
    const result = validateHandoffChain(envelopes, contract);
    assert.equal(result.ok, false, name);
    assert.ok(result.errors.some((message) => pattern.test(message)), `${name}: ${result.errors.join("\n")}`);
  }
});

// Ruling 10: 봉투 하나만 보면 owner·supplier를 일관되게 뒤바꾼 요청은 합법적인 반대 방향 인계와
// 구분할 수 없다 — 어느 제품이 최종 산출물을 내는지는 봉투 자체에 적혀 있지 않기 때문이다. 그래서
// 예전의 "owner and supplier swapped" 단일-봉투 사례는 지웠다: supplierProduct를 기본값에 남겨둔
// 채 ownerProduct만 studio로 바꾸면 owner===supplier가 되어 "owner equals supplier"와 완전히
// 같은 경로로 거부되고, 그 규칙을 지워도 이 테스트는 계속 통과했다(byte-identical duplicate).
// "뒤바뀜"이 뜻을 가지려면 맥락이 있어야 한다: 반환이 자신을 낳은 요청의 owner·supplier와
// 반대라면, 그것은 공급 제품이 관계 자체를 다시 쓴 것이다 — 위 validateHandoffChain 테스트가
// 그 메커니즘을 제공한다. 이 사례를 되돌려 지우지 말 것.
test("a return that mirrors (swaps) its request's owner and supplier is refused", () => {
  const swapped = validateHandoffChain(
    [request(), envelopeReturn({ ownerProduct: "game-design-studio", supplierProduct: "game-design-career" })],
    contract,
  );
  assert.equal(swapped.ok, false);
  assert.ok(swapped.errors.some((message) => /must agree with its request/u.test(message)), swapped.errors.join("\n"));
});

test("an empty or duplicated requestedOutputs list is refused", () => {
  assert.equal(validateHandoffRequest(request({ requestedOutputs: [] }), contract).ok, false);
  assert.equal(validateHandoffRequest(
    request({ requestedOutputs: ["system-evidence-summary", "system-evidence-summary"] }), contract).ok, false);
});

test("an unknown key in either envelope is refused", () => {
  assert.equal(validateHandoffRequest({ ...request(), priority: "high" }, contract).ok, false);
  assert.equal(validateHandoffReturn({ ...envelopeReturn(), approved: true }, contract).ok, false);
});

// Ruling 11: 리스트형 필드 이름을 모듈 안에 따로 하드코딩해 두면 계약이 이름을 바꿔도 검증기가
// 옛 이름을 계속 찾는다 — Ruling 8이 막으려던 "두 벌의 키 셋"이 형태만 바꿔 재발하는 셈이다.
// inferences를 readings로 바꾼 계약을 직접 만들어, 검증기가 새 이름을 따라가는지 확인한다.
test("validateHandoffReturn derives its list-typed fields from the contract, not a hardcoded copy", () => {
  const renamedContract = Object.freeze({
    ...contract,
    returnKeys: Object.freeze(contract.returnKeys.map((key) => (key === "inferences" ? "readings" : key))),
  });
  const { inferences, ...withoutInferences } = envelopeReturn();
  const envelope = { ...withoutInferences, readings: [123, ""] };
  const result = validateHandoffReturn(envelope, renamedContract);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((message) => message === "readings must be a list of non-empty strings"),
    result.errors.join("\n"),
  );
});

// Ruling 12: 계약은 사람이 손으로 고치는 마크다운 안에 산다. 파서가 이 사슬의 신뢰 원점이므로,
// 파서가 이미 거부하는 모양들을 테스트로 고정해 두지 않으면 나중에 누군가 정규식이나 조건 하나를
// 무심코 느슨하게 고쳐도 아무 테스트도 실패하지 않는다.
function baseContractObject() {
  return {
    schemaVersion: 1,
    requestKind: "suite-handoff-request-v1",
    returnKind: "suite-handoff-return-v1",
    products: ["game-design-career", "game-design-studio"],
    entrySkills: { "game-design-career": "game-design-career", "game-design-studio": "game-design-studio" },
    requestedOutputs: ["system-evidence-summary"],
    requestKeys: [
      "schemaVersion", "kind", "ownerProduct", "supplierProduct",
      "requestedOutputs", "sourceArtifactIds", "returnToSkill",
    ],
    returnKeys: [
      "schemaVersion", "kind", "ownerProduct", "supplierProduct",
      "facts", "inferences", "recommendations", "unknowns",
    ],
    maxHandoffsPerRequest: 1,
  };
}

function wrapContract(jsonBody) {
  return `# doc\n\n<!-- suite-handoff-contract:start -->\n\`\`\`json\n${jsonBody}\n\`\`\`\n<!-- suite-handoff-contract:end -->\n`;
}

test("parseSuiteHandoffContract rejects every malformed document shape it claims to reject", () => {
  const good = JSON.stringify(baseContractObject());
  const cases = [
    ["non-string input", () => parseSuiteHandoffContract(42)],
    ["two sentinel pairs", () => parseSuiteHandoffContract(wrapContract(good) + wrapContract(good))],
    ["zero sentinels", () => parseSuiteHandoffContract(`\`\`\`json\n${good}\n\`\`\``)],
    ["start sentinel with no end", () => parseSuiteHandoffContract(
      `<!-- suite-handoff-contract:start -->\n\`\`\`json\n${good}\n\`\`\`\n`)],
    ["end sentinel with no start", () => parseSuiteHandoffContract(
      `\`\`\`json\n${good}\n\`\`\`\n<!-- suite-handoff-contract:end -->\n`)],
    ["end sentinel before start", () => parseSuiteHandoffContract(
      `<!-- suite-handoff-contract:end -->\n\`\`\`json\n${good}\n\`\`\`\n<!-- suite-handoff-contract:start -->\n`)],
    ["two JSON blocks between sentinels", () => parseSuiteHandoffContract(
      wrapContract(`${good}\n\`\`\`\n\`\`\`json\n${good}`))],
    ["malformed JSON", () => parseSuiteHandoffContract(wrapContract("{not json"))],
    ["maxHandoffsPerRequest is not 1", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({ ...baseContractObject(), maxHandoffsPerRequest: 2 })))],
    ["entrySkills omits a declared product", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({
        ...baseContractObject(), entrySkills: { "game-design-career": "game-design-career" },
      })))],
    // 아래 세 사례는 이전에는 조용히 통과했다(Ruling 12) — 계약 파일이 손상되어야만 닿는
    // 자리이지만, 파서가 신뢰 원점이라는 이 모듈의 역할상 닫아 두는 값어치가 있다.
    ["entrySkills has an extra product beyond products", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({
        ...baseContractObject(),
        entrySkills: { ...baseContractObject().entrySkills, "game-design-suite": "game-design-suite" },
      })))],
    ["entrySkills value is an empty string", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({
        ...baseContractObject(),
        entrySkills: { ...baseContractObject().entrySkills, "game-design-career": "" },
      })))],
    ["requestKind is not a string", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({ ...baseContractObject(), requestKind: 7 })))],
    ["returnKind is not a string", () => parseSuiteHandoffContract(
      wrapContract(JSON.stringify({ ...baseContractObject(), returnKind: 7 })))],
  ];
  for (const [name, run] of cases) {
    assert.throws(run, undefined, name);
  }
});

test("parseSuiteHandoffContract accepts a well-formed document built from the same shape", () => {
  const parsed = parseSuiteHandoffContract(wrapContract(JSON.stringify(baseContractObject())));
  assert.deepEqual(parsed.products, baseContractObject().products);
  assert.ok(Object.isFrozen(parsed));
});

// 조회가 unknown으로 닫히는 것은 Task 5가 고정했다. 고정되지 않은 것은 그 다음 문장, 즉 상대 제품이
// 없을 때 스킬이 실제로 무엇을 하라고 적혀 있는가다. 안전이 걸린 쪽은 이쪽이다 — 증거를 지어내지
// 말라는 지시가 사라져도 코드 테스트는 하나도 실패하지 않는다. 영수증 항목과 사례 ID 산문을 같은
// 방식으로 고정해 둔 이상, 이 절반만 비워 두는 것은 앞뒤가 맞지 않는다.
const MISSING_COUNTERPART_RULES = Object.freeze([
  // 빠진 근거는 조용히 넘어가지 않고 blocker로 남는다.
  "blocker",
  // 없는 증거를 만들어 채우지 않는다.
  "지어내지 않는다",
  // 진짜 미설치인 사용자는 설치 경로를 받아야 한다.
  "설치 명령",
  // 설치돼 있지만 비활성인 제품도 목록에서 빠진다. 조회 결과만으로는 미설치와 구분되지 않으므로,
  // 이 갈래를 적지 않으면 에이전트는 이미 가진 제품을 설치하라고 말하고 정작 고칠 방법인 활성화는
  // 끝내 말하지 않는다. 상태 이름과 그 상태의 처방을 함께 고정한다.
  "상대 비활성",
  "활성화",
  // 미설치와 확인 불가는 다른 사실이고 다른 문장을 만든다.
  "확인 불가",
]);

test("the contract tells the skill to leave a blocker and invent nothing when the counterpart is missing", () => {
  const heading = "\n## 상대 제품이 없을 때\n";
  const start = contractMarkdown.indexOf(heading);
  assert.notEqual(start, -1, "the degrade section is missing from the contract");
  // 문서 아무 데나 낱말이 있으면 통과하는 검사로는 이 절을 증명하지 못한다. 이 절은 문서의 마지막
  // 절이므로 표제부터 끝까지가 그 구간이고, 뒤에 절이 더 붙으면 그 표제 앞에서 끊는다.
  const rest = contractMarkdown.slice(start + heading.length);
  const next = rest.indexOf("\n## ");
  const section = next === -1 ? rest : rest.slice(0, next);
  for (const rule of MISSING_COUNTERPART_RULES) {
    assert.ok(section.includes(rule), `the degrade section is missing "${rule}"`);
  }
});
