function location(source, index) {
  const prefix = source.slice(0, index);
  return { column: index - (prefix.lastIndexOf("\n") + 1) + 1, line: prefix.split("\n").length };
}

function readQuoted(source, index, quote) {
  let value = "";
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") { value += source[cursor + 1] ?? ""; cursor += 1; continue; }
    if (character === quote) return { end: cursor + 1, value };
    if (character === "\n" || character === "\r") return { end: cursor + 1, value, invalid: true };
    value += character;
  }
  return { end: source.length, value, invalid: true };
}

function tokens(source) {
  const result = [];
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (/\s/u.test(character)) { index += 1; continue; }
    if (character === "/" && source[index + 1] === "/") { index = source.indexOf("\n", index + 2); if (index < 0) break; continue; }
    if (character === "/" && source[index + 1] === "*") { const end = source.indexOf("*/", index + 2); index = end < 0 ? source.length : end + 2; continue; }
    if (character === "'" || character === '"') {
      const quoted = readQuoted(source, index, character);
      result.push({ ...quoted, index, type: "string" }); index = quoted.end; continue;
    }
    if (character === "`") {
      const quoted = readQuoted(source, index, "`");
      result.push({ ...quoted, index, type: "template", substitution: quoted.value.includes("${") }); index = quoted.end; continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      let end = index + 1; while (/[A-Za-z0-9_$]/u.test(source[end] ?? "")) end += 1;
      result.push({ index, type: "word", value: source.slice(index, end) }); index = end; continue;
    }
    result.push({ index, type: "punct", value: character }); index += 1;
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
