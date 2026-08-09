const LEVEL_ORDER = Object.freeze({ beginner: 0, standard: 1, advanced: 2 });
const PRODUCT_ORDER = Object.freeze({ studio: 0, career: 1, suite: 2 });

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function orderedEntries(entries) {
  return [...entries].sort((left, right) => (
    (PRODUCT_ORDER[left.product] ?? Number.MAX_SAFE_INTEGER) - (PRODUCT_ORDER[right.product] ?? Number.MAX_SAFE_INTEGER)
    || compareText(left.skill ?? "", right.skill ?? "")
    || (LEVEL_ORDER[left.level] ?? Number.MAX_SAFE_INTEGER) - (LEVEL_ORDER[right.level] ?? Number.MAX_SAFE_INTEGER)
    || compareText(left.id, right.id)
  ));
}

function list(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function textBlock(value) {
  const longestFence = Math.max(0, ...[...value.matchAll(/`+/gu)].map(([fence]) => fence.length));
  const fence = "`".repeat(Math.max(3, longestFence + 1));
  return `${fence}text\n${value}\n${fence}`;
}

export function renderPromptCard(entry) {
  if (!entry || typeof entry !== "object") throw new Error("prompt template entry must be an object");
  const title = `${entry.id} — ${entry.title}`;
  return [
    `## ${title}`,
    "",
    entry.purpose,
    "",
    "### 사용하는 경우",
    entry.when_to_use,
    "",
    "### 사용하지 않는 경우",
    entry.when_not_to_use,
    "",
    "### 준비 입력",
    "#### 필수 입력",
    list(entry.required_inputs),
    "",
    "#### 선택 입력",
    list(entry.optional_inputs),
    "",
    "### 바꿀 자리표시자",
    list(entry.placeholders),
    "",
    "### Codex App 완성 예시",
    textBlock(entry.app_prompt.example),
    "",
    "### Codex App 재사용 템플릿",
    textBlock(entry.app_prompt.template),
    "",
    "### Codex CLI 완성 예시",
    textBlock(entry.cli_prompt.example),
    "",
    "### Codex CLI 재사용 템플릿",
    textBlock(entry.cli_prompt.template),
    "",
    "### 스킬·전문 역할 흐름",
    `- 기본 스킬: ${entry.skill}`,
    `- 스킬 흐름: ${entry.skill_chain.join(" → ")}`,
    `- 전문 역할: ${entry.specialist_roles.join(" → ")}`,
    "",
    "### 중간 산출물",
    list(entry.intermediate_artifacts),
    "",
    "### 예상 결과물",
    "#### 최소 결과물",
    list(entry.minimum_outputs),
    "",
    "#### 선택 결과물",
    list(entry.optional_outputs),
    "",
    "#### 확장 결과물",
    list(entry.extended_outputs),
    "",
    "### 파일 구조",
    list(entry.expected_file_tree),
    "",
    "### 읽는 순서",
    list(entry.read_order),
    "",
    "### 사람 검토",
    "#### 승인 경계",
    entry.human_review_boundary,
    "",
    "#### 보류 조건",
    list(entry.hold_conditions),
    "",
    "#### 안전 경계",
    entry.safety_boundary,
    "",
    "### 실패와 재개",
    textBlock(entry.resume_prompt),
  ].join("\n");
}

export function renderPromptLibrary(catalog) {
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error("prompt catalog must contain an entries array");
  const cards = orderedEntries(catalog.entries).map((entry) => renderPromptCard(entry));
  return [
    "# 재사용 프롬프트 라이브러리",
    "",
    "이 라이브러리는 검증된 카탈로그에서 결정론적으로 생성됩니다. 모르는 정보는 `미정`으로 남기고 승인 경계를 넘지 마세요.",
    "",
    ...cards,
    "",
  ].join("\n");
}

export function replaceManagedSection(markdown, markerId, body) {
  const start = `<!-- PROMPT-TEMPLATES:START ${markerId} -->`;
  const end = `<!-- PROMPT-TEMPLATES:END ${markerId} -->`;
  if (markdown.split(start).length !== 2 || markdown.split(end).length !== 2) {
    throw new Error(`expected exactly one prompt-template marker pair: ${markerId}`);
  }
  const startOffset = markdown.indexOf(start);
  const endOffset = markdown.indexOf(end);
  if (endOffset < startOffset) throw new Error(`prompt-template marker pair must be ordered: ${markerId}`);
  return markdown.slice(0, startOffset + start.length)
    + `\n${body.trim()}\n`
    + markdown.slice(endOffset);
}

export function renderProductPromptProjection(catalog, productId, entries) {
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error("prompt catalog must contain an entries array");
  if (!Array.isArray(entries)) throw new Error("product prompt projection entries must be an array");
  return `${JSON.stringify({ version: 1, product: productId, entries: orderedEntries(entries) }, null, 2)}\n`;
}
