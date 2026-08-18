const CONTRACT_KEYS = Object.freeze([
  "schemaVersion", "requestKind", "returnKind", "products", "entrySkills",
  "requestedOutputs", "requestKeys", "returnKeys", "maxHandoffsPerRequest",
]);
const START = "<!-- suite-handoff-contract:start -->";
const END = "<!-- suite-handoff-contract:end -->";
// 모든 봉투 종류가 공유하는 스칼라 필드. returnKeys에서 이 네 개를 뺀 나머지가 리스트형
// 필드다 — 계약 문서가 필드 이름을 바꾸면(예: inferences → readings) 이 뺄셈도 따라간다.
// 별도의 리스트형 필드 이름 사본을 두면 Ruling 8이 막으려던 바로 그 이원화가 재발한다.
const SHARED_SCALAR_KEYS = Object.freeze(["schemaVersion", "kind", "ownerProduct", "supplierProduct"]);

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
    || typeof contract.requestKind !== "string" || contract.requestKind.trim().length === 0
    || typeof contract.returnKind !== "string" || contract.returnKind.trim().length === 0
    || !stringList(contract.products)
    || !stringList(contract.requestedOutputs)
    || !stringList(contract.requestKeys)
    || !stringList(contract.returnKeys)
    || !isObject(contract.entrySkills)
    || contract.maxHandoffsPerRequest !== 1
    || !hasExactKeys(contract.entrySkills, contract.products)
    || contract.products.some((product) => (
      typeof contract.entrySkills[product] !== "string" || contract.entrySkills[product].trim().length === 0
    ))) {
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
    const listKeys = contract.returnKeys.filter((key) => !SHARED_SCALAR_KEYS.includes(key));
    for (const key of listKeys) {
      const list = value[key];
      if (!Array.isArray(list) || list.some((item) => typeof item !== "string" || item.trim().length === 0)) {
        errors.push(`${key} must be a list of non-empty strings`);
      }
    }
    // 리스트가 전부 비어 있어도 개별 필드 검사는 모두 통과한다. 그런 봉투는 형식상 유효하지만
    // 아무 답도 하지 않는다 — owner 쪽에서는 "검증 통과"가 "증거 도착"으로 읽히므로, 찾은 것이
    // 없다는 사실 자체를 unknowns에 적게 만들고 침묵한 반환은 여기서 거절한다.
    if (errors.length === 0 && listKeys.every((key) => value[key].length === 0)) {
      errors.push("a return must carry at least one entry; say so in unknowns when nothing was found");
    }
  }
  return { ok: errors.length === 0, errors };
}

// 재귀 인계는 봉투 하나만 봐서는 잡히지 않는다. 공급 제품이 답례로 요청을 시작하면 두 제품이
// 서로의 결론을 근거로 삼게 되고, 그때부터는 어느 쪽도 사실을 소유하지 않는다.
//
// 봉투 하나만 봐서는 owner가 누구인지도 알 수 없다 — 최종 산출물을 내는 쪽이 owner라는 사실은
// 사슬을 연 요청이 정하고, 반환은 그 요청에 동의해야만 유효하다(Ruling 9). 그래서 사슬은 요청
// 하나로 시작해야 하고, 모든 반환은 그 요청의 ownerProduct·supplierProduct와 일치해야 한다.
// 이 이상의 순서 규칙은 스펙에 없으므로 만들지 않는다.
export function validateHandoffChain(envelopes, contract) {
  const errors = [];
  if (!Array.isArray(envelopes) || envelopes.length === 0) {
    return { ok: false, errors: ["a handoff chain needs at least one envelope"] };
  }
  const requests = envelopes.filter((envelope) => isObject(envelope) && envelope.kind === contract.requestKind);
  if (requests.length > contract.maxHandoffsPerRequest) {
    errors.push("a request carries one handoff at most");
  }
  // 인계 한 번은 요청 하나와 반환 하나다. 요청 수만 세면 [요청, 반환, 반환]이 통과하고, 서로
  // 모순되는 반환 둘 중 무엇을 근거로 삼았는지 아무도 말할 수 없게 된다. 반환에도 같은 상한.
  const returns = envelopes.filter((envelope) => isObject(envelope) && envelope.kind === contract.returnKind);
  if (returns.length > contract.maxHandoffsPerRequest) {
    errors.push("a request is answered by one return at most");
  }
  const openingRequest = isObject(envelopes[0]) && envelopes[0].kind === contract.requestKind
    ? envelopes[0]
    : undefined;
  if (!openingRequest) {
    errors.push("a handoff chain must start with a request");
  }
  for (const envelope of envelopes) {
    const isReturn = isObject(envelope) && envelope.kind === contract.returnKind;
    const result = isReturn ? validateHandoffReturn(envelope, contract) : validateHandoffRequest(envelope, contract);
    errors.push(...result.errors);
    if (isReturn && openingRequest
      && (envelope.ownerProduct !== openingRequest.ownerProduct || envelope.supplierProduct !== openingRequest.supplierProduct)) {
      errors.push("a return must agree with its request on ownerProduct and supplierProduct");
    }
  }
  return { ok: errors.length === 0, errors };
}
