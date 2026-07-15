import type {
  Connection,
  DefiniteNode,
  NodeGraph,
  NodeId,
  NodeIO,
  NodeLocation,
  NodeMap,
  PortId,
} from "../model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../nodes/io";
import { clonePlain } from "../utils/clonePlain";

export type ClipboardPayload = {
  /** Deep clone at copy time (original ids preserved). */
  nodes: DefiniteNode[];
  /** Wires where both endpoints are in the copied node set. */
  connections: Connection[];
  offsets: Record<NodeId, { x: number; y: number }>;
};

function isCopyable(node: DefiniteNode): boolean {
  return node.typeId !== INPUT_TYPE && node.typeId !== OUTPUT_TYPE;
}

function portKey(nodeId: NodeId, portId: PortId): string {
  return `${nodeId}:${portId}`;
}

function remapPorts(
  io: NodeIO,
  oldNodeId: NodeId,
  portIdMap: Map<string, PortId>,
): NodeIO {
  const next: NodeIO = {};
  for (const [oldPortId, port] of Object.entries(io)) {
    const newPortId = crypto.randomUUID();
    portIdMap.set(portKey(oldNodeId, oldPortId), newPortId);
    next[newPortId] = { ...port, id: newPortId };
  }
  return next;
}

function remapNestedGraph(
  graph: NodeGraph,
  nodeIdMap: Map<NodeId, NodeId>,
  portIdMap: Map<string, PortId>,
): NodeGraph {
  const nodes = graph.nodes.map((n) =>
    remapNodeTree(n, nodeIdMap, portIdMap, null),
  );
  const connections = graph.connections.map((c) =>
    remapConnection(c, nodeIdMap, portIdMap),
  );
  return { nodes, connections };
}

function remapConnection(
  c: Connection,
  nodeIdMap: Map<NodeId, NodeId>,
  portIdMap: Map<string, PortId>,
): Connection {
  return {
    id: crypto.randomUUID(),
    from: {
      node: nodeIdMap.get(c.from.node)!,
      port: portIdMap.get(portKey(c.from.node, c.from.port))!,
    },
    to: {
      node: nodeIdMap.get(c.to.node)!,
      port: portIdMap.get(portKey(c.to.node, c.to.port))!,
    },
  };
}

function remapNodeTree(
  node: DefiniteNode,
  nodeIdMap: Map<NodeId, NodeId>,
  portIdMap: Map<string, PortId>,
  location: NodeLocation | null,
): DefiniteNode {
  const oldId = node.id;
  const newId = crypto.randomUUID();
  nodeIdMap.set(oldId, newId);

  const cloned = clonePlain(node);
  const remapped: DefiniteNode = {
    ...cloned,
    id: newId,
    location: location ?? cloned.location,
    inputs: remapPorts(cloned.inputs, oldId, portIdMap),
    outputs: remapPorts(cloned.outputs, oldId, portIdMap),
    z: undefined,
  };

  if (cloned.composite) {
    remapped.composite = {
      interface: clonePlain(cloned.composite.interface),
      graph: remapNestedGraph(cloned.composite.graph, nodeIdMap, portIdMap),
    };
  }

  return remapped;
}

/**
 * Snapshot selected nodes and internal wires for in-memory paste.
 * Boundary IO nodes are excluded.
 */
export function buildClipboard(
  nodes: DefiniteNode[],
  connections: Connection[],
  anchor: NodeLocation,
): ClipboardPayload | null {
  const copyable = nodes.filter(isCopyable);
  if (!copyable.length) return null;

  const idSet = new Set(copyable.map((n) => n.id));
  const internal = connections.filter(
    (c) => idSet.has(c.from.node) && idSet.has(c.to.node),
  );

  const offsets: Record<NodeId, { x: number; y: number }> = {};
  const cloned = copyable.map((node) => {
    offsets[node.id] = {
      x: node.location.x - anchor.x,
      y: node.location.y - anchor.y,
    };
    return clonePlain(node);
  });

  return {
    nodes: cloned,
    connections: clonePlain(internal),
    offsets,
  };
}

/**
 * Paste a clipboard payload into `map` at `anchor`, returning new top-level node ids.
 */
export function pasteClipboard(
  map: NodeMap,
  payload: ClipboardPayload,
  anchor: NodeLocation,
): NodeId[] {
  const nodeIdMap = new Map<NodeId, NodeId>();
  const portIdMap = new Map<string, PortId>();

  const newNodes = payload.nodes.map((node) => {
    const offset = payload.offsets[node.id] ?? { x: 0, y: 0 };
    return remapNodeTree(node, nodeIdMap, portIdMap, {
      x: anchor.x + offset.x,
      y: anchor.y + offset.y,
    });
  });

  const newConnections = payload.connections.map((c) =>
    remapConnection(c, nodeIdMap, portIdMap),
  );

  map.graph.nodes.push(...newNodes);
  map.graph.connections.push(...newConnections);

  return newNodes.map((n) => n.id);
}
