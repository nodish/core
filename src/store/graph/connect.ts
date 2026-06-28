import type {
  Connection,
  NodeId,
  NodeMap,
  PortRef,
  PortTypeId,
} from "../model";

// Can a value of type `from` flow into a port of type `to`? The destination
// type decides (via its `accepts`), defaulting to strict identity.
export function assignable(
  map: NodeMap,
  from: PortTypeId,
  to: PortTypeId,
): boolean {
  const toDef = map.types[to];
  if (!toDef) return from === to;
  if (toDef.accepts) return toDef.accepts(from);
  return from === to;
}

// Every upstream node that can reach `nodeId` via existing output->input wires.
export function ancestorNodeIds(map: NodeMap, nodeId: NodeId): NodeId[] {
  const fedBy = new Map<NodeId, NodeId[]>();
  for (const c of map.graph.connections) {
    const list = fedBy.get(c.to.node) ?? [];
    list.push(c.from.node);
    fedBy.set(c.to.node, list);
  }
  const ancestors = new Set<NodeId>();
  const stack = [...(fedBy.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    for (const parent of fedBy.get(id) ?? []) stack.push(parent);
  }
  return [...ancestors];
}

// Every downstream node reachable from `nodeId` via existing output->input wires.
export function descendantNodeIds(map: NodeMap, nodeId: NodeId): NodeId[] {
  const feeds = new Map<NodeId, NodeId[]>();
  for (const c of map.graph.connections) {
    const list = feeds.get(c.from.node) ?? [];
    list.push(c.to.node);
    feeds.set(c.from.node, list);
  }
  const descendants = new Set<NodeId>();
  const stack = [...(feeds.get(nodeId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    for (const child of feeds.get(id) ?? []) stack.push(child);
  }
  return [...descendants];
}

// True if adding `from` -> `to` would close a loop in the graph.
export function wouldCreateCycle(
  map: NodeMap,
  from: PortRef,
  to: PortRef,
): boolean {
  return descendantNodeIds(map, to.node).includes(from.node);
}

// Whether an output->input connection is allowed (direction, no self-link,
// type-compatible). Both refs must resolve to real ports of the right side.
export function canConnect(map: NodeMap, from: PortRef, to: PortRef): boolean {
  if (from.node === to.node) return false;
  const fromNode = map.graph.nodes.find((n) => n.id === from.node);
  const toNode = map.graph.nodes.find((n) => n.id === to.node);
  const fromPort = fromNode?.outputs[from.port];
  const toPort = toNode?.inputs[to.port];
  if (!fromPort || !toPort) return false;
  if (toPort.userOnly) return false; // user-only inputs reject all wires
  if (wouldCreateCycle(map, from, to)) return false;
  return assignable(map, fromPort.type, toPort.type);
}

// Add an output->input connection. A normal input keeps a single incoming wire
// (any existing one is replaced); a `multi` input accepts unlimited incoming
// wires (collected into an array at eval time). Exact duplicate wires are
// ignored. Returns the connection, or null if the link is invalid.
export function addConnection(
  map: NodeMap,
  from: PortRef,
  to: PortRef,
): Connection | null {
  if (!canConnect(map, from, to)) return null;

  // Ignore an identical wire (same source into the same input).
  const duplicate = map.graph.connections.find(
    (c) =>
      c.from.node === from.node &&
      c.from.port === from.port &&
      c.to.node === to.node &&
      c.to.port === to.port,
  );
  if (duplicate) return duplicate;

  const toNode = map.graph.nodes.find((n) => n.id === to.node);
  const toPort = toNode?.inputs[to.port];
  if (!toPort?.multi) {
    // Single input: drop whatever was already wired into it.
    map.graph.connections = map.graph.connections.filter(
      (c) => !(c.to.node === to.node && c.to.port === to.port),
    );
  }

  const connection: Connection = { id: crypto.randomUUID(), from, to };
  map.graph.connections.push(connection);
  return connection;
}

export function removeConnection(map: NodeMap, id: string): void {
  map.graph.connections = map.graph.connections.filter((c) => c.id !== id);
}
