const id = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
const text = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const sorted = (values, predicate = text, { allowEmpty = false } = {}) => Array.isArray(values) && (allowEmpty || values.length > 0) && values.every(predicate) && values.every((value, index) => index === 0 || compare(values[index - 1], value) < 0);

function cycleKey(nodeIds) {
  return nodeIds.map((_, index) => [...nodeIds.slice(index), ...nodeIds.slice(0, index)].join("\0")).sort(compare)[0];
}

function directedCycles(connections) {
  const next = new Map();
  for (const connection of connections) next.set(connection.fromNodeId, [...(next.get(connection.fromNodeId) ?? []), connection.toNodeId]);
  const found = new Set();
  for (const start of [...next.keys()].sort(compare)) {
    const visit = (node, path) => {
      for (const target of next.get(node) ?? []) {
        if (target === start && path.length >= 2) found.add(cycleKey(path));
        else if (!path.includes(target)) visit(target, [...path, target]);
      }
    };
    visit(start, [start]);
  }
  return found;
}

function hasInputProcessOutputPath(nodes, connections) {
  const nodeKinds = new Map(nodes.map(({ nodeId, kind }) => [nodeId, kind]));
  const inputs = nodes.filter(({ kind }) => kind === "input").map(({ nodeId }) => nodeId);
  if (inputs.length === 0 || !nodes.some(({ kind }) => kind === "process") || !nodes.some(({ kind }) => kind === "output")) return false;
  const next = new Map();
  for (const connection of connections) next.set(connection.fromNodeId, [...(next.get(connection.fromNodeId) ?? []), connection.toNodeId]);
  for (const input of inputs) {
    const queue = [[input, nodeKinds.get(input) === "process"]]; const seen = new Set();
    while (queue.length > 0) {
      const [node, passedProcess] = queue.shift(); const key = `${node}\0${passedProcess}`;
      if (seen.has(key)) continue; seen.add(key);
      if (nodeKinds.get(node) === "output" && passedProcess) return true;
      for (const target of next.get(node) ?? []) queue.push([target, passedProcess || nodeKinds.get(target) === "process"]);
    }
  }
  return false;
}

/** Shared closed validation for persisted and built system maps. */
export function validateReferenceSystemMaps({ maps, inventorySystemIds } = {}) {
  if (!Array.isArray(maps) || maps.length === 0 || !Array.isArray(inventorySystemIds) || !sorted(inventorySystemIds, id)) return false;
  const systems = new Set(inventorySystemIds); const mapIds = new Set(); let previousMapId;
  for (const map of maps) {
    if (!exact(map, ["mapId", "systemId", "nodes", "connections", "loops"]) || !id(map.mapId) || !systems.has(map.systemId) || mapIds.has(map.mapId) || (previousMapId !== undefined && compare(previousMapId, map.mapId) >= 0) || !Array.isArray(map.nodes) || !Array.isArray(map.connections) || !Array.isArray(map.loops)) return false;
    mapIds.add(map.mapId); previousMapId = map.mapId;
    if (!sorted(map.nodes.map(({ nodeId } = {}) => nodeId), id) || !map.nodes.every((node) => exact(node, ["nodeId", "kind", "label"]) && id(node.nodeId) && ["input", "process", "output"].includes(node.kind) && text(node.label))) return false;
    const nodes = new Set(map.nodes.map(({ nodeId }) => nodeId));
    if (!sorted(map.connections.map(({ connectionId } = {}) => connectionId), id) || !map.connections.every((connection) => exact(connection, ["connectionId", "fromNodeId", "toNodeId", "connectedSystemIds"]) && id(connection.connectionId) && connection.fromNodeId !== connection.toNodeId && nodes.has(connection.fromNodeId) && nodes.has(connection.toNodeId) && sorted(connection.connectedSystemIds, id) && connection.connectedSystemIds.every((systemId) => systems.has(systemId)))) return false;
    let previousLoopId;
    for (const loop of map.loops) {
      if (!exact(loop, ["loopId", "kind", "nodeIds"]) || !id(loop.loopId) || !["core", "session", "meta"].includes(loop.kind) || !Array.isArray(loop.nodeIds) || loop.nodeIds.length < 2 || !loop.nodeIds.every(id) || new Set(loop.nodeIds).size !== loop.nodeIds.length || previousLoopId !== undefined && compare(previousLoopId, loop.loopId) >= 0) return false;
      previousLoopId = loop.loopId;
    }
    if (map.loops.some(({ nodeIds }) => nodeIds.some((nodeId) => !nodes.has(nodeId)))) return false;
    const pairs = new Set(map.connections.map(({ fromNodeId, toNodeId }) => `${fromNodeId}\0${toNodeId}`));
    if (map.loops.some(({ nodeIds }) => nodeIds.some((nodeId, index) => !pairs.has(`${nodeId}\0${nodeIds[(index + 1) % nodeIds.length]}`)))) return false;
    const usedNodes = new Set([...map.connections.flatMap(({ fromNodeId, toNodeId }) => [fromNodeId, toNodeId]), ...map.loops.flatMap(({ nodeIds }) => nodeIds)]);
    if ([...nodes].some((nodeId) => !usedNodes.has(nodeId)) || !hasInputProcessOutputPath(map.nodes, map.connections)) return false;
    const declared = new Set(map.loops.map(({ nodeIds }) => cycleKey(nodeIds)));
    if ([...directedCycles(map.connections)].some((cycle) => !declared.has(cycle))) return false;
  }
  return true;
}
