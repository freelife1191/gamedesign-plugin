import { createHash } from "node:crypto";

const adapters = Object.freeze({
  architecture: { nodes: "components", edges: "connections", containers: "boundaries" },
  workflow: { nodes: "nodes", edges: "edges", containers: "lanes" },
  sequence: { nodes: "participants", edges: "messages", containers: "segments" },
  dataflow: { nodes: "nodes", edges: "flows", containers: "stages" },
  lifecycle: { nodes: "states", edges: "transitions", containers: "lanes" },
});

const sourceKeys = ["from", "source", "sourceId", "fromId", "origin"];
const targetKeys = ["to", "target", "targetId", "toId", "destination"];
const containerKeys = ["lane", "laneId", "stage", "stageId", "boundary", "boundaryId", "segment", "segmentId"];

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

function arrayField(spec, field) {
  const value = spec?.[field];
  return Array.isArray(value) ? value : [];
}

function nodeId(node, index) {
  const id = node?.id ?? node?.key ?? node?.name;
  return id === undefined || id === null ? `@${index}` : String(id);
}

function endpoint(edge, keys) {
  for (const key of keys) {
    if (edge?.[key] !== undefined && edge?.[key] !== null) {
      const value = edge[key];
      if (value !== null && typeof value === "object") return String(value.id ?? value.key ?? value.name ?? "");
      return String(value);
    }
  }
  return undefined;
}

function graphFor(nodes, edges) {
  const ids = nodes.map(nodeId);
  const indexById = new Map(ids.map((id, index) => [id, index]));
  const outgoing = ids.map(() => []);
  const incoming = ids.map(() => []);

  for (const edge of edges) {
    const source = indexById.get(endpoint(edge, sourceKeys));
    const target = indexById.get(endpoint(edge, targetKeys));
    if (source === undefined || target === undefined) continue;
    outgoing[source].push(target);
    incoming[target].push(source);
  }
  return { incoming, outgoing };
}

function degreeSequence(graph) {
  return graph.outgoing.map((outgoing, index) => ({ in: graph.incoming[index].length, out: outgoing.length }))
    .sort((left, right) => left.in - right.in || left.out - right.out);
}

function stronglyConnectedComponents(graph) {
  const indexes = Array(graph.outgoing.length).fill(-1);
  const lowLinks = Array(graph.outgoing.length).fill(0);
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

    for (const neighbor of graph.outgoing[node]) {
      if (indexes[neighbor] === -1) {
        visit(neighbor);
        lowLinks[node] = Math.min(lowLinks[node], lowLinks[neighbor]);
      } else if (onStack.has(neighbor)) {
        lowLinks[node] = Math.min(lowLinks[node], indexes[neighbor]);
      }
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

  for (let node = 0; node < graph.outgoing.length; node += 1) {
    if (indexes[node] === -1) visit(node);
  }
  return components;
}

function condensedGraph(graph) {
  const components = stronglyConnectedComponents(graph);
  const componentByNode = Array(graph.outgoing.length);
  for (const [componentIndex, component] of components.entries()) {
    for (const node of component) componentByNode[node] = componentIndex;
  }
  const outgoing = components.map(() => new Set());
  for (const [node, targets] of graph.outgoing.entries()) {
    for (const target of targets) {
      const sourceComponent = componentByNode[node];
      const targetComponent = componentByNode[target];
      if (sourceComponent !== targetComponent) outgoing[sourceComponent].add(targetComponent);
    }
  }
  return { components, componentByNode, outgoing: outgoing.map((targets) => [...targets]) };
}

function countDirectedCycles(graph) {
  const condensed = condensedGraph(graph);
  return condensed.components.filter((component) => {
    if (component.length > 1) return true;
    const node = component[0];
    return graph.outgoing[node].includes(node);
  }).length;
}

function condensedLongestPath(graph) {
  const condensed = condensedGraph(graph);
  const memo = Array(condensed.components.length);
  function longestFrom(component) {
    if (memo[component] !== undefined) return memo[component];
    const descendants = condensed.outgoing[component].map(longestFrom);
    memo[component] = 1 + (descendants.length === 0 ? 0 : Math.max(...descendants));
    return memo[component];
  }
  return condensed.components.length === 0 ? 0 : Math.max(...condensed.components.map((_, index) => longestFrom(index)));
}

function distribution(items, field) {
  const counts = new Map();
  for (const item of items) {
    const value = item?.[field];
    const key = value === undefined || value === null ? "unspecified" : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([value, count]) => ({ value, count }));
}

function coordinate(node, axis) {
  const layouts = [node, node?.position, node?.layout, node?.geometry];
  const aliases = axis === "x" ? ["x", "column", "col"] : ["y", "row"];
  for (const layout of layouts) {
    for (const key of aliases) {
      if (Number.isFinite(layout?.[key])) return Number(layout[key]);
    }
  }
  return undefined;
}

function quantize(values) {
  const sorted = [...new Set(values.filter((value) => value !== undefined))].sort((left, right) => left - right);
  const ranks = new Map(sorted.map((value, index) => [value, index]));
  return values.map((value) => value === undefined ? -1 : ranks.get(value));
}

function containerMembership(node) {
  for (const key of containerKeys) {
    if (node?.[key] !== undefined && node?.[key] !== null) return String(node[key]);
  }
  return "unassigned";
}

function relativeLayoutPattern(nodes) {
  const xs = nodes.map((node) => coordinate(node, "x"));
  const ys = nodes.map((node) => coordinate(node, "y"));
  const containerCounts = new Map();
  for (const node of nodes) {
    const membership = containerMembership(node);
    containerCounts.set(membership, (containerCounts.get(membership) ?? 0) + 1);
  }
  const quantizedX = quantize(xs);
  const quantizedY = quantize(ys);
  return nodes.map((node, index) => ({
    column: quantizedX[index],
    row: quantizedY[index],
    container_size: containerCounts.get(containerMembership(node)),
  })).sort((left, right) => left.column - right.column || left.row - right.row || left.container_size - right.container_size);
}

function topologyProfile(nodes, graph) {
  let labels = graph.outgoing.map((outgoing, index) => `${graph.incoming[index].length}:${outgoing.length}:${nodes[index]?.type ?? "unspecified"}:${nodes[index]?.variant ?? "unspecified"}`);
  for (let round = 0; round < nodes.length; round += 1) {
    const next = labels.map((label, index) => sha256(canonicalJson({
      label,
      incoming: graph.incoming[index].map((node) => labels[node]).sort(),
      outgoing: graph.outgoing[index].map((node) => labels[node]).sort(),
    })));
    if (next.every((label, index) => label === labels[index])) break;
    labels = next;
  }
  return labels.sort();
}

export function structuralSignature({ type, spec }) {
  const adapter = adapters[type];
  if (!adapter) throw new Error(`unsupported Archify diagram type: ${type}`);
  const nodes = arrayField(spec, adapter.nodes);
  const edges = arrayField(spec, adapter.edges);
  const graph = graphFor(nodes, edges);
  const degree = degreeSequence(graph);
  return sha256(canonicalJson({
    type,
    node_count: nodes.length,
    edge_count: edges.length,
    container_count: arrayField(spec, adapter.containers).length,
    degree,
    branch_count: degree.filter((item) => item.out > 1).length,
    merge_count: degree.filter((item) => item.in > 1).length,
    cycle_count: countDirectedCycles(graph),
    main_path_length: Array.isArray(spec?.mainPath) ? spec.mainPath.length : condensedLongestPath(graph),
    kind_distribution: distribution(nodes, "type"),
    variant_distribution: distribution(nodes, "variant"),
    relationship_distribution: distribution(edges, "variant"),
    relative_layout: relativeLayoutPattern(nodes),
    topology: topologyProfile(nodes, graph),
  }));
}

function hasNonemptyReason(entry) {
  return typeof entry.shared_process_reason === "string" && entry.shared_process_reason.trim().length > 0;
}

function hasCompleteException(entry) {
  return typeof entry.shared_process_with === "string" && entry.shared_process_with.trim().length > 0 && hasNonemptyReason(entry);
}

function hasNoException(entry) {
  return entry.shared_process_with === null && entry.shared_process_reason === null;
}

function classifyDuplicate(first, second, signature) {
  if (hasNoException(first) && hasNoException(second)) {
    return { ids: [first.id, second.id].sort(), signature };
  }
  if (!hasCompleteException(first) || !hasCompleteException(second)) {
    throw new Error(`duplicate structural signature ${signature} for ${first.id} and ${second.id} requires shared_process_reason`);
  }
  if (first.shared_process_with !== second.id || second.shared_process_with !== first.id) {
    throw new Error(`duplicate structural signature ${signature} for ${first.id} and ${second.id} requires a symmetric shared-process exception`);
  }
  return undefined;
}

function specFor(specsById, id) {
  return specsById instanceof Map ? specsById.get(id) : specsById?.[id];
}

export function findStructuralDuplicates({ catalog, specsById }) {
  const groups = new Map();
  for (const entry of catalog?.entries ?? []) {
    if (entry?.decision !== "selected") continue;
    const spec = specFor(specsById, entry.id);
    if (spec === undefined) continue;
    const signature = structuralSignature({ type: entry.diagram_type, spec });
    groups.set(signature, [...(groups.get(signature) ?? []), entry]);
  }

  const unapproved = [];
  for (const [signature, entries] of groups) {
    for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
        const first = entries[firstIndex];
        const second = entries[secondIndex];
        const finding = classifyDuplicate(first, second, signature);
        if (finding !== undefined) unapproved.push(finding);
      }
    }
  }
  return unapproved;
}
