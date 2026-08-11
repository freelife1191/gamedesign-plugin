import { createHash } from "node:crypto";

const adapters = Object.freeze({
  architecture: { nodes: "components", edges: "connections", containers: "boundaries" },
  workflow: { nodes: "nodes", edges: "edges", containers: "lanes" },
  sequence: { nodes: "participants", edges: "messages", containers: "segments" },
  dataflow: { nodes: "nodes", edges: "flows", containers: "stages" },
  lifecycle: { nodes: "states", edges: "transitions", containers: "lanes" },
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function arrayField(spec, field, type) {
  if (!Array.isArray(spec?.[field])) throw new Error(`${type} spec.${field} must be an array`);
  return spec[field];
}

function optionalArrayField(spec, field) {
  if (spec?.[field] === undefined) return [];
  if (!Array.isArray(spec[field])) throw new Error(`spec.${field} must be an array when present`);
  return spec[field];
}

function stringId(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function normalizedRank(values) {
  const unique = [...new Set(values)].sort((left, right) => left - right);
  const ranks = new Map(unique.map((value, index) => [value, index]));
  return values.map((value) => ranks.get(value));
}

function requireNumber(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return Number(value);
}

function edgeAttributes(type, edge, index, yRanks) {
  const attributes = {
    variant: edge.variant ?? "default",
    role: edge.role ?? "unspecified",
  };
  if (type === "sequence") attributes.y = yRanks[index];
  if (type === "dataflow") attributes.classification = edge.classification ?? "unspecified";
  return attributes;
}

function nodeLayouts(type, spec, nodes) {
  if (type === "architecture") {
    const positions = nodes.map((node, index) => {
      if (Array.isArray(node.pos)) {
        if (node.pos.length !== 2) throw new Error(`architecture components[${index}].pos must contain two coordinates`);
        return node.pos.map((value, coordinate) => requireNumber(value, `architecture components[${index}].pos[${coordinate}]`));
      }
      if (Number.isInteger(node.col) && Number.isInteger(node.row)) return [node.col, node.row];
      return [-1, -1];
    });
    const xs = normalizedRank(positions.map(([x]) => x));
    const ys = normalizedRank(positions.map(([, y]) => y));
    return positions.map((_, index) => ({ column: xs[index], row: ys[index] }));
  }
  if (type === "workflow" || type === "lifecycle") {
    const lanes = arrayField(spec, "lanes", type);
    const laneIndexes = new Map();
    for (const [index, lane] of lanes.entries()) laneIndexes.set(stringId(lane?.id, `${type} lanes[${index}].id`), index);
    return nodes.map((node, index) => {
      const lane = laneIndexes.get(stringId(node?.lane, `${type} nodes[${index}].lane`));
      if (lane === undefined) throw new Error(`${type} nodes[${index}].lane is unresolved`);
      if (!Number.isInteger(node.col)) throw new Error(`${type} nodes[${index}].col must be an integer`);
      return { lane, column: node.col };
    });
  }
  if (type === "sequence") return nodes.map((_, index) => ({ participant: index }));
  return nodes.map((node, index) => {
    if (!Number.isInteger(node.stage) || !Number.isInteger(node.row)) {
      throw new Error(`dataflow nodes[${index}] must have integer stage and row`);
    }
    return { stage: node.stage, row: node.row };
  });
}

function buildGraph(type, spec) {
  const adapter = adapters[type];
  if (!adapter) throw new Error(`unsupported Archify diagram type: ${type}`);
  const nodes = arrayField(spec, adapter.nodes, type);
  const edges = type === "architecture"
    ? optionalArrayField(spec, adapter.edges)
    : arrayField(spec, adapter.edges, type);
  if (nodes.length > 12) throw new Error(`${type} supports at most 12 primary nodes for structural canonicalization`);

  const nodeIndex = new Map();
  for (const [index, node] of nodes.entries()) {
    const id = stringId(node?.id, `${type} nodes[${index}].id`);
    if (nodeIndex.has(id)) throw new Error(`${type} has duplicate node id: ${id}`);
    stringId(node?.type, `${type} nodes[${index}].type`);
    nodeIndex.set(id, index);
  }
  const layouts = nodeLayouts(type, spec, nodes);
  const yRanks = type === "sequence"
    ? normalizedRank(edges.map((edge, index) => requireNumber(edge?.y, `sequence messages[${index}].y`)))
    : [];
  const normalizedEdges = edges.map((edge, index) => {
    const fromId = stringId(edge?.from, `${type} ${adapter.edges}[${index}].from`);
    const toId = stringId(edge?.to, `${type} ${adapter.edges}[${index}].to`);
    const from = nodeIndex.get(fromId);
    const to = nodeIndex.get(toId);
    if (from === undefined || to === undefined) throw new Error(`${type} ${adapter.edges}[${index}] has an unresolved endpoint`);
    return { from, to, attributes: edgeAttributes(type, edge, index, yRanks) };
  });
  const relationships = Array.from({ length: nodes.length }, () => Array.from({ length: nodes.length }, () => []));
  for (const edge of normalizedEdges) relationships[edge.from][edge.to].push(canonicalJson(edge.attributes));
  for (const rows of relationships) for (const relationship of rows) relationship.sort();
  return { adapter, edges: normalizedEdges, layouts, nodeIndex, nodes, relationships };
}

function containersFor(type, spec, graph) {
  const { nodeIndex, nodes } = graph;
  if (type === "architecture") {
    return optionalArrayField(spec, "boundaries").map((boundary, index) => {
      if (!Array.isArray(boundary?.wraps)) throw new Error(`architecture boundaries[${index}].wraps must be an array`);
      const members = boundary.wraps.map((id, memberIndex) => {
        const node = nodeIndex.get(stringId(id, `architecture boundaries[${index}].wraps[${memberIndex}]`));
        if (node === undefined) throw new Error(`architecture boundaries[${index}] wraps an unresolved component`);
        return node;
      });
      return { kind: String(boundary.kind ?? "unspecified"), members: [...new Set(members)].sort((left, right) => left - right) };
    });
  }
  if (type === "workflow") {
    const lanes = arrayField(spec, "lanes", type);
    return lanes.map((lane, laneIndex) => ({
      kind: "lane",
      variant: lane.variant ?? "normal",
      members: nodes.flatMap((node, index) => node.lane === lane.id ? [index] : []),
      order: laneIndex,
    }));
  }
  if (type === "lifecycle") {
    const lanes = arrayField(spec, "lanes", type);
    return lanes.map((lane, laneIndex) => ({
      kind: "lane",
      members: nodes.flatMap((node, index) => node.lane === lane.id ? [index] : []),
      order: laneIndex,
    }));
  }
  if (type === "sequence") {
    return optionalArrayField(spec, "segments").map((segment, index) => ({
      kind: "segment",
      from: requireNumber(segment?.from, `sequence segments[${index}].from`),
      to: requireNumber(segment?.to, `sequence segments[${index}].to`),
    }));
  }
  return arrayField(spec, "stages", type).map((_, stage) => ({
    kind: "stage",
    members: nodes.flatMap((node, index) => node.stage === stage ? [index] : []),
    order: stage,
  }));
}

function initialColors(graph) {
  const keys = graph.nodes.map((_, index) => nodeRecord(graph, index));
  return assignColors(keys);
}

function nodeRecord(graph, index) {
  return canonicalJson({
    layout: graph.layouts[index],
    type: graph.nodes[index].type ?? "unspecified",
  });
}

function assignColors(keys) {
  const values = [...new Set(keys)].sort();
  const colors = new Map(values.map((value, index) => [value, `c${index}`]));
  return keys.map((key) => colors.get(key));
}

function refine(graph, initial) {
  let colors = initial;
  for (let round = 0; round < graph.nodes.length; round += 1) {
    const keys = graph.nodes.map((node, index) => canonicalJson({
      color: colors[index],
      incoming: graph.edges.filter((edge) => edge.to === index)
        .map((edge) => ({ attributes: edge.attributes, color: colors[edge.from] })).sort(compareCanonical),
      node: nodeRecord(graph, index),
      outgoing: graph.edges.filter((edge) => edge.from === index)
        .map((edge) => ({ attributes: edge.attributes, color: colors[edge.to] })).sort(compareCanonical),
    }));
    const next = assignColors(keys);
    if (next.every((color, index) => color === colors[index])) return colors;
    colors = next;
  }
  return colors;
}

function compareCanonical(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}

function canonicalEncoding(graph, containers) {
  const stateMemo = new Map();

  function search(colors, individualization) {
    const refined = refine(graph, colors);
    const stateKey = partitionStateKey(graph, containers, refined);
    const knownStates = stateMemo.get(stateKey) ?? [];
    for (const known of knownStates) {
      if (isColorPreservingAutomorphism(graph, containers, refined, known.colors)) return known.encoding;
    }
    const classes = new Map();
    for (const [index, color] of refined.entries()) classes.set(color, [...(classes.get(color) ?? []), index]);
    const ambiguous = [...classes.entries()].filter(([, members]) => members.length > 1).sort(([left], [right]) => left.localeCompare(right));
    let encoding;
    if (ambiguous.length === 0) {
      encoding = encodeDiscrete(graph, containers, refined);
    } else {
      const [, members] = ambiguous[0];
      for (const member of members) {
        const next = [...refined];
        next[member] = `individual-${individualization}`;
        const candidate = search(next, individualization + 1);
        if (encoding === undefined || candidate < encoding) encoding = candidate;
      }
    }
    stateMemo.set(stateKey, [...knownStates, { colors: refined, encoding }]);
    return encoding;
  }
  return search(initialColors(graph), 0);
}

function partitionStateKey(graph, containers, colors) {
  return canonicalJson({
    containers: containers.map((container) => ({
      ...container,
      members: container.members?.map((member) => colors[member]).sort(),
    })).sort(compareCanonical),
    edges: graph.edges.map((edge) => ({
      attributes: edge.attributes,
      from: colors[edge.from],
      to: colors[edge.to],
    })).sort(compareCanonical),
    nodes: graph.nodes.map((_, index) => ({ color: colors[index], node: nodeRecord(graph, index) })).sort(compareCanonical),
  });
}

function isColorPreservingAutomorphism(graph, containers, sourceColors, targetColors) {
  const candidates = graph.nodes.map((_, source) => graph.nodes.flatMap((__, target) => (
    sourceColors[source] === targetColors[target] && nodeRecord(graph, source) === nodeRecord(graph, target) ? [target] : []
  )));
  if (candidates.some((options) => options.length === 0)) return false;
  const order = [...graph.nodes.keys()].sort((left, right) => candidates[left].length - candidates[right].length || left - right);
  const mapped = new Map();
  const used = new Set();

  function preservesMappedRelationships(source, target) {
    if (graph.relationships[source][source].join("\u0000") !== graph.relationships[target][target].join("\u0000")) return false;
    for (const [mappedSource, mappedTarget] of mapped) {
      if (graph.relationships[source][mappedSource].join("\u0000") !== graph.relationships[target][mappedTarget].join("\u0000")) return false;
      if (graph.relationships[mappedSource][source].join("\u0000") !== graph.relationships[mappedTarget][target].join("\u0000")) return false;
    }
    return true;
  }

  function preservesContainers() {
    const mappedContainers = containers.map((container) => ({
      ...container,
      members: container.members?.map((member) => mapped.get(member)).sort((left, right) => left - right),
    })).sort(compareCanonical);
    const expected = containers.map((container) => ({
      ...container,
      members: container.members?.slice().sort((left, right) => left - right),
    })).sort(compareCanonical);
    return canonicalJson(mappedContainers) === canonicalJson(expected);
  }

  function visit(index) {
    if (index === order.length) return preservesContainers();
    const source = order[index];
    for (const target of candidates[source]) {
      if (used.has(target) || !preservesMappedRelationships(source, target)) continue;
      mapped.set(source, target);
      used.add(target);
      if (visit(index + 1)) return true;
      used.delete(target);
      mapped.delete(source);
    }
    return false;
  }
  return visit(0);
}

function encodeDiscrete(graph, containers, colors) {
  const order = [...colors.keys()].sort((left, right) => colors[left].localeCompare(colors[right]));
  const canonicalIndex = new Map(order.map((node, index) => [node, index]));
  return canonicalJson({
    containers: containers.map((container) => ({
      ...container,
      members: container.members?.map((member) => canonicalIndex.get(member)).sort((left, right) => left - right),
    })).sort(compareCanonical),
    edges: graph.edges.map((edge) => ({
      attributes: edge.attributes,
      from: canonicalIndex.get(edge.from),
      to: canonicalIndex.get(edge.to),
    })).sort(compareCanonical),
    nodes: order.map((node) => ({ layout: graph.layouts[node], type: graph.nodes[node].type ?? "unspecified" })),
  });
}

function stronglyConnectedComponents(graph) {
  const outgoing = graph.nodes.map((_, index) => graph.edges.filter((edge) => edge.from === index).map((edge) => edge.to));
  const indexes = Array(outgoing.length).fill(-1);
  const lowLinks = Array(outgoing.length).fill(0);
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;
  function visit(node) {
    indexes[node] = nextIndex;
    lowLinks[node] = nextIndex;
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const target of outgoing[node]) {
      if (indexes[target] === -1) {
        visit(target);
        lowLinks[node] = Math.min(lowLinks[node], lowLinks[target]);
      } else if (onStack.has(target)) lowLinks[node] = Math.min(lowLinks[node], indexes[target]);
    }
    if (lowLinks[node] !== indexes[node]) return;
    const component = [];
    while (true) {
      const member = stack.pop();
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    components.push(component);
  }
  for (let node = 0; node < outgoing.length; node += 1) if (indexes[node] === -1) visit(node);
  return { components, outgoing };
}

function condensedMetrics(graph) {
  const { components, outgoing } = stronglyConnectedComponents(graph);
  const componentByNode = Array(graph.nodes.length);
  for (const [component, members] of components.entries()) for (const member of members) componentByNode[member] = component;
  const dag = components.map(() => new Set());
  for (const [source, targets] of outgoing.entries()) {
    for (const target of targets) if (componentByNode[source] !== componentByNode[target]) dag[componentByNode[source]].add(componentByNode[target]);
  }
  const memo = Array(components.length);
  function longest(component) {
    if (memo[component] !== undefined) return memo[component];
    const descendants = [...dag[component]].map(longest);
    memo[component] = 1 + (descendants.length === 0 ? 0 : Math.max(...descendants));
    return memo[component];
  }
  const cycleCount = components.filter((members) => members.length > 1 || outgoing[members[0]].includes(members[0])).length;
  return { cycleCount, longestPath: components.length === 0 ? 0 : Math.max(...components.map((_, index) => longest(index))) };
}

export function structuralSignature({ type, spec }) {
  const graph = buildGraph(type, spec);
  const containers = containersFor(type, spec, graph);
  const metrics = condensedMetrics(graph);
  const mainPathLength = Array.isArray(spec?.mainPath) ? spec.mainPath.length : metrics.longestPath;
  return sha256(canonicalJson({
    cycle_count: metrics.cycleCount,
    graph: canonicalEncoding(graph, containers),
    main_path_length: mainPathLength,
    type,
  }));
}

function hasNoException(entry) {
  return entry.shared_process_with === null && entry.shared_process_reason === null;
}

function hasCompleteException(entry) {
  return typeof entry.shared_process_with === "string" && entry.shared_process_with.trim().length > 0
    && typeof entry.shared_process_reason === "string" && entry.shared_process_reason.trim().length > 0;
}

function specFor(specsById, id) {
  return specsById instanceof Map ? specsById.get(id) : specsById?.[id];
}

function validateExceptions(entriesById, signatures) {
  for (const entry of entriesById.values()) {
    if (hasNoException(entry)) continue;
    if (!hasCompleteException(entry)) throw new Error(`entry ${entry.id} requires shared_process_reason`);
    const target = entriesById.get(entry.shared_process_with);
    if (target === undefined || target.decision !== "selected") throw new Error(`entry ${entry.id} shared_process_with target does not exist`);
    if (!hasCompleteException(target) || target.shared_process_with !== entry.id) {
      throw new Error(`entry ${entry.id} requires a symmetric shared-process exception`);
    }
    const signature = signatures.get(entry.id);
    const targetSignature = signatures.get(target.id);
    if (signature === undefined && targetSignature === undefined) continue;
    if (signature === undefined || targetSignature === undefined) throw new Error(`entry ${entry.id} shared-process pair must both have materialized specs`);
    if (signature !== targetSignature) throw new Error(`entry ${entry.id} and ${target.id} must have the same structural signature`);
  }
}

export function findStructuralDuplicates({ catalog, specsById }) {
  const entries = (catalog?.entries ?? []).filter((entry) => entry?.decision === "selected");
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const signatures = new Map();
  for (const entry of entries) {
    const spec = specFor(specsById, entry.id);
    if (spec !== undefined) signatures.set(entry.id, structuralSignature({ type: entry.diagram_type, spec }));
  }
  validateExceptions(entriesById, signatures);
  const groups = new Map();
  for (const entry of entries) {
    const signature = signatures.get(entry.id);
    if (signature !== undefined) groups.set(signature, [...(groups.get(signature) ?? []), entry]);
  }
  const findings = [];
  for (const [signature, group] of groups) {
    for (let first = 0; first < group.length; first += 1) {
      for (let second = first + 1; second < group.length; second += 1) {
        const [left, right] = [group[first], group[second]];
        if (hasNoException(left) && hasNoException(right)) findings.push({ ids: [left.id, right.id].sort(), signature });
        else if (!hasCompleteException(left) || !hasCompleteException(right)) throw new Error(`duplicate structural signature ${signature} requires shared_process_reason`);
        else if (left.shared_process_with !== right.id || right.shared_process_with !== left.id) {
          throw new Error(`duplicate structural signature ${signature} requires a symmetric shared-process exception`);
        }
      }
    }
  }
  return findings;
}
