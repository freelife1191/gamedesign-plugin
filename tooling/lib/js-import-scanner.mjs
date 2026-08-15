function location(source, index) {
  const prefix = source.slice(0, index);
  return { column: index - (prefix.lastIndexOf("\n") + 1) + 1, line: prefix.split("\n").length };
}

function readQuoted(source, index, quote, end = source.length) {
  let value = "";
  for (let cursor = index + 1; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") { value += source[cursor + 1] ?? ""; cursor += 1; continue; }
    if (character === quote) return { end: cursor + 1, value };
    if (character === "\n" || character === "\r") return { end: cursor + 1, value, invalid: true };
    value += character;
  }
  return { end, value, invalid: true };
}

const CONTROL_CONDITIONS = new Set(["catch", "for", "if", "switch", "while", "with"]);
const EXPRESSION_START_WORDS = new Set(["case", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"]);

function syntaxContext() {
  return { braces: [], memberAccess: false, parentheses: [], previousWord: "", regexAllowed: true, statementPending: false };
}

function noteWord(context, word) {
  context.previousWord = context.memberAccess ? "" : word;
  context.regexAllowed = !context.memberAccess && EXPRESSION_START_WORDS.has(word);
  context.memberAccess = false;
  if (["do", "else", "finally", "try"].includes(word)) context.statementPending = true;
}

function noteLiteral(context) {
  context.memberAccess = false;
  context.previousWord = "";
  context.regexAllowed = false;
  context.statementPending = false;
}

function notePunctuation(context, value) {
  if (value === "(") {
    context.parentheses.push({ control: CONTROL_CONDITIONS.has(context.previousWord) });
    context.memberAccess = false;
    context.previousWord = "";
    context.regexAllowed = true;
    return;
  }
  if (value === ")") {
    const parenthesis = context.parentheses.pop();
    context.memberAccess = false;
    context.previousWord = "";
    context.regexAllowed = Boolean(parenthesis?.control);
    context.statementPending = Boolean(parenthesis?.control);
    return;
  }
  if (value === "{") {
    context.braces.push({ statement: context.statementPending });
    context.memberAccess = false;
    context.previousWord = "";
    context.regexAllowed = true;
    context.statementPending = false;
    return;
  }
  if (value === "}") {
    const brace = context.braces.pop();
    context.memberAccess = false;
    context.previousWord = "";
    context.regexAllowed = Boolean(brace?.statement);
    context.statementPending = Boolean(brace?.statement);
    return;
  }
  context.memberAccess = value === ".";
  context.previousWord = "";
  context.statementPending = false;
  context.regexAllowed = value === ";" || /[\[,:;!?=+*%&|^~<>/]/u.test(value);
}

function skipRegex(source, index, end) {
  let inClass = false;
  for (let cursor = index + 1; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") { cursor += 1; continue; }
    if (character === "[") { inClass = true; continue; }
    if (character === "]") { inClass = false; continue; }
    if (character === "/" && !inClass) {
      cursor += 1;
      while (/[A-Za-z]/u.test(source[cursor] ?? "")) cursor += 1;
      return cursor;
    }
    if (character === "\n" || character === "\r") return cursor;
  }
  return end;
}

function skipTemplate(source, index, end) {
  for (let cursor = index + 1; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") { cursor += 1; continue; }
    if (character === "`") return cursor + 1;
    if (character === "$" && source[cursor + 1] === "{") {
      cursor = findTemplateExpressionEnd(source, cursor + 2, end);
    }
  }
  return end;
}

function findTemplateExpressionEnd(source, start, end) {
  let depth = 1;
  const context = syntaxContext();
  for (let cursor = start; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (character === "'" || character === '"') { cursor = readQuoted(source, cursor, character, end).end - 1; noteLiteral(context); continue; }
    if (character === "`") { cursor = skipTemplate(source, cursor, end) - 1; noteLiteral(context); continue; }
    if (character === "/" && source[cursor + 1] === "/") { const newline = source.indexOf("\n", cursor + 2); cursor = (newline < 0 || newline >= end ? end : newline) - 1; continue; }
    if (character === "/" && source[cursor + 1] === "*") { const close = source.indexOf("*/", cursor + 2); cursor = (close < 0 || close >= end ? end : close + 2) - 1; continue; }
    if (character === "/" && context.regexAllowed) { cursor = skipRegex(source, cursor, end) - 1; noteLiteral(context); continue; }
    if (/[A-Za-z_$]/u.test(character)) {
      let wordEnd = cursor + 1; while (/[A-Za-z0-9_$]/u.test(source[wordEnd] ?? "")) wordEnd += 1;
      noteWord(context, source.slice(cursor, wordEnd)); cursor = wordEnd - 1; continue;
    }
    if (character === "{") depth += 1;
    notePunctuation(context, character);
    if (character === "}" && --depth === 0) return cursor;
  }
  return end;
}

function readTemplate(source, index, end, result) {
  let substitution = false;
  let value = "";
  let cursor = index + 1;
  for (; cursor < end; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") { value += source[cursor + 1] ?? ""; cursor += 1; continue; }
    if (character === "`") return { end: cursor + 1, substitution, value };
    if (character === "$" && source[cursor + 1] === "{") {
      substitution = true;
      const expressionStart = cursor + 2;
      const expressionEnd = findTemplateExpressionEnd(source, expressionStart, end);
      tokens(source, expressionStart, expressionEnd, result);
      cursor = expressionEnd;
      continue;
    }
    value += character;
  }
  return { end, substitution, value, invalid: true };
}

function tokens(source, start = 0, end = source.length, result = [], context = syntaxContext()) {
  for (let index = start; index < end;) {
    const character = source[index];
    if (/\s/u.test(character)) { index += 1; continue; }
    if (character === "/" && source[index + 1] === "/") { const newline = source.indexOf("\n", index + 2); index = newline < 0 || newline >= end ? end : newline; continue; }
    if (character === "/" && source[index + 1] === "*") { const close = source.indexOf("*/", index + 2); index = close < 0 || close >= end ? end : close + 2; continue; }
    if (character === "/" && context.regexAllowed) { index = skipRegex(source, index, end); noteLiteral(context); continue; }
    if (character === "'" || character === '"') {
      const quoted = readQuoted(source, index, character, end);
      result.push({ ...quoted, index, type: "string" }); index = quoted.end; noteLiteral(context); continue;
    }
    if (character === "`") {
      const template = readTemplate(source, index, end, result);
      result.push({ ...template, index, type: "template" }); index = template.end; noteLiteral(context); continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      let tokenEnd = index + 1; while (/[A-Za-z0-9_$]/u.test(source[tokenEnd] ?? "")) tokenEnd += 1;
      const value = source.slice(index, tokenEnd);
      result.push({ index, type: "word", value }); index = tokenEnd; noteWord(context, value); continue;
    }
    result.push({ index, type: "punct", value: character }); index += 1; notePunctuation(context, character);
  }
  return result;
}

function literal(token) { return token && (token.type === "string" || token.type === "template" && !token.substitution) && !token.invalid; }

export function scanJavaScriptImports(source) {
  if (typeof source !== "string") throw new TypeError("source must be a string");
  const scanned = tokens(source);
  const specifiers = [];
  const errors = [];
  const add = (token, kind) => specifiers.push({ kind, location: location(source, token.index), specifier: token.value });
  for (let index = 0; index < scanned.length; index += 1) {
    const token = scanned[index];
    if (token.type !== "word" || !["import", "export"].includes(token.value)) continue;
    const next = scanned[index + 1];
    if (token.value === "import" && next?.value === "(") {
      const candidate = scanned[index + 2];
      if (literal(candidate)) add(candidate, "dynamic");
      else errors.push({ code: "dynamic-import-nonliteral", location: location(source, candidate?.index ?? next.index) });
      continue;
    }
    if (token.value === "import" && literal(next)) { add(next, "static"); continue; }
    for (let cursor = index + 1; cursor < scanned.length && scanned[cursor].value !== ";"; cursor += 1) {
      if (scanned[cursor].type === "word" && scanned[cursor].value === "from" && literal(scanned[cursor + 1])) {
        add(scanned[cursor + 1], token.value === "export" ? "export" : "static");
        index = cursor + 1;
        break;
      }
      if (scanned[cursor].type === "word" && ["import", "export"].includes(scanned[cursor].value)) break;
    }
  }
  return { errors, specifiers };
}
