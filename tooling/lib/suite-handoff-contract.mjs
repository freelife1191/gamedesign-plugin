const CONTRACT_KEYS = Object.freeze([
  "schemaVersion", "requestKind", "returnKind", "products", "entrySkills",
  "requestedOutputs", "requestKeys", "returnKeys", "maxHandoffsPerRequest",
]);
const START = "<!-- suite-handoff-contract:start -->";
const END = "<!-- suite-handoff-contract:end -->";
const RETURN_LISTS = Object.freeze(["facts", "inferences", "recommendations", "unknowns"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isObject(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function stringList(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && item.trim().length > 0)
    && new Set(value).size === value.length;
}

// 계약은 문서 안에 산다. 문서를 사람이 고치는 이상, 파서는 sentinel이 정확히 한 쌍이고 그 사이에
// JSON 코드 블록이 하나뿐일 때만 값을 돌려줘야 한다. 두 벌이 있으면 어느 쪽이 계약인지 알 수 없다.
export function parseSuiteHandoffContract(markdown) {
  if (typeof markdown !== "string") throw new Error("handoff contract must be text");
  if (markdown.split(START).length !== 2 || markdown.split(END).length !== 2) {
    throw new Error("handoff contract sentinel must appear exactly once");
  }
  const body = markdown.slice(markdown.indexOf(START) + START.length, markdown.indexOf(END));
  const blocks = [...body.matchAll(/```json\n([\s\S]*?)\n```/gu)];
  if (blocks.length !== 1) throw new Error("handoff contract must hold exactly one JSON block");
  let contract;
  try {
    contract = JSON.parse(blocks[0][1]);
  } catch {
    throw new Error("handoff contract JSON is malformed");
  }
  if (!hasExactKeys(contract, CONTRACT_KEYS)
    || contract.schemaVersion !== 1
    || !stringList(contract.products)
    || !stringList(contract.requestedOutputs)
    || !stringList(contract.requestKeys)
    || !stringList(contract.returnKeys)
    || !isObject(contract.entrySkills)
    || contract.maxHandoffsPerRequest !== 1
    || contract.products.some((product) => typeof contract.entrySkills[product] !== "string")) {
    throw new Error("handoff contract is not well formed");
  }
  return Object.freeze({
    ...contract,
    products: Object.freeze([...contract.products]),
    requestedOutputs: Object.freeze([...contract.requestedOutputs]),
    requestKeys: Object.freeze([...contract.requestKeys]),
    returnKeys: Object.freeze([...contract.returnKeys]),
    entrySkills: Object.freeze({ ...contract.entrySkills }),
  });
}

function sharedEnvelopeErrors(value, contract, keys, kind) {
  const errors = [];
  if (!hasExactKeys(value, keys)) {
    errors.push("envelope keys do not match the contract");
    return errors;
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.kind !== kind) errors.push(`kind must be ${kind}`);
  if (!contract.products.includes(value.ownerProduct)) errors.push("ownerProduct is not a suite product");
  if (!contract.products.includes(value.supplierProduct)) errors.push("supplierProduct is not a suite product");
  if (value.ownerProduct === value.supplierProduct) errors.push("ownerProduct and supplierProduct must differ");
  return errors;
}

export function validateHandoffRequest(value, contract) {
  const errors = sharedEnvelopeErrors(value, contract, contract.requestKeys, contract.requestKind);
  if (errors.length === 0) {
    if (!stringList(value.requestedOutputs)) errors.push("requestedOutputs must be a unique non-empty list");
    else if (value.requestedOutputs.some((output) => !contract.requestedOutputs.includes(output))) {
      errors.push("requestedOutputs holds a value outside the contract enum");
    }
    if (!stringList(value.sourceArtifactIds)) errors.push("sourceArtifactIds must be a unique non-empty list");
    if (value.returnToSkill !== contract.entrySkills[value.ownerProduct]) {
      errors.push("returnToSkill must be the owner product's entry skill");
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateHandoffReturn(value, contract) {
  const errors = sharedEnvelopeErrors(value, contract, contract.returnKeys, contract.returnKind);
  if (errors.length === 0) {
    for (const key of RETURN_LISTS) {
      const list = value[key];
      if (!Array.isArray(list) || list.some((item) => typeof item !== "string" || item.trim().length === 0)) {
        errors.push(`${key} must be a list of non-empty strings`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// 재귀 인계는 봉투 하나만 봐서는 잡히지 않는다. 공급 제품이 답례로 요청을 시작하면 두 제품이
// 서로의 결론을 근거로 삼게 되고, 그때부터는 어느 쪽도 사실을 소유하지 않는다.
export function validateHandoffChain(envelopes, contract) {
  const errors = [];
  if (!Array.isArray(envelopes) || envelopes.length === 0) {
    return { ok: false, errors: ["a handoff chain needs at least one envelope"] };
  }
  const requests = envelopes.filter((envelope) => isObject(envelope) && envelope.kind === contract.requestKind);
  if (requests.length > contract.maxHandoffsPerRequest) {
    errors.push("a request carries one handoff at most");
  }
  for (const envelope of envelopes) {
    const result = isObject(envelope) && envelope.kind === contract.returnKind
      ? validateHandoffReturn(envelope, contract)
      : validateHandoffRequest(envelope, contract);
    errors.push(...result.errors);
  }
  return { ok: errors.length === 0, errors };
}
