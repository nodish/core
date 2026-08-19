import type {
  Connection,
  DefiniteNode,
  FrameId,
  GraphFrame,
  NodeGraph,
  NodeId,
  NodeIO,
  NodeLocation,
  NodeMap,
  PortId,
} from "../model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../nodes/io";
import { clonePlain } from "../utils/clonePlain";
import { descendantFrameIds, descendantNodeIds, ensureFrames } from "./frames";

export type ClipboardPayload = {
  /** Deep clone at copy time (original ids preserved). */
  nodes: DefiniteNode[];
  /** Wires where both endpoints are in the copied node set. */
  connections: Connection[];
  offsets: Record<NodeId, { x: number; y: number }>;
  /** Frames included in the copy (original ids). */
  frames?: GraphFrame[];
};

export type PasteResult = {
  nodeIds: NodeId[];
  frameIds: FrameId[];
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

function remapGraphFrames(
  frames: GraphFrame[] | undefined,
  nodeIdMap: Map<NodeId, NodeId>,
): GraphFrame[] {
  if (!frames?.length) return [];
  const frameIdMap = new Map<FrameId, FrameId>();
  for (const f of frames) frameIdMap.set(f.id, crypto.randomUUID());
  return frames.map((f) => ({
    id: frameIdMap.get(f.id)!,
    label: f.label,
    color: f.color,
    parentId: f.parentId ? frameIdMap.get(f.parentId) : undefined,
    nodeIds: f.nodeIds
      .map((id) => nodeIdMap.get(id))
      .filter((id): id is NodeId => !!id),
  }));
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
  const frames = remapGraphFrames(graph.frames, nodeIdMap);
  return { nodes, connections, frames: frames.length ? frames : undefined };
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
 * Snapshot selected nodes/frames and internal wires for in-memory paste.
 * Selected frames include their descendant nodes and frames. Boundary IO
 * nodes are excluded. Frame membership is kept only for frames in the copy.
 */
export function buildClipboard(
  map: NodeMap,
  selection: { nodeIds: NodeId[]; frameIds?: FrameId[] },
  anchor: NodeLocation,
): ClipboardPayload | null {
  const graph = map.graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodeIdSet = new Set(selection.nodeIds);
  const frameIdSet = new Set(selection.frameIds ?? []);

  for (const fid of [...frameIdSet]) {
    if (!graph.frames?.some((f) => f.id === fid)) {
      frameIdSet.delete(fid);
      continue;
    }
    for (const n of descendantNodeIds(graph, fid)) nodeIdSet.add(n);
    for (const f of descendantFrameIds(graph, fid)) frameIdSet.add(f);
  }

  const copyable = [...nodeIdSet]
    .map((id) => byId.get(id))
    .filter((n): n is DefiniteNode => !!n && isCopyable(n));
  if (!copyable.length) return null;

  const copiedIds = new Set(copyable.map((n) => n.id));
  const internal = graph.connections.filter(
    (c) => copiedIds.has(c.from.node) && copiedIds.has(c.to.node),
  );

  const offsets: Record<NodeId, { x: number; y: number }> = {};
  const cloned = copyable.map((node) => {
    offsets[node.id] = {
      x: node.location.x - anchor.x,
      y: node.location.y - anchor.y,
    };
    return clonePlain(node);
  });

  const frames = (graph.frames ?? [])
    .filter((f) => frameIdSet.has(f.id))
    .map((f) => ({
      ...clonePlain(f),
      parentId:
        f.parentId && frameIdSet.has(f.parentId) ? f.parentId : undefined,
      nodeIds: f.nodeIds.filter((id) => copiedIds.has(id)),
    }));

  return {
    nodes: cloned,
    connections: clonePlain(internal),
    offsets,
    frames: frames.length ? frames : undefined,
  };
}

/**
 * Paste a clipboard payload into `map` at `anchor`.
 */
export function pasteClipboard(
  map: NodeMap,
  payload: ClipboardPayload,
  anchor: NodeLocation,
): PasteResult {
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

  const newFrames = remapGraphFrames(payload.frames, nodeIdMap);
  if (newFrames.length) ensureFrames(map.graph).push(...newFrames);

  return {
    nodeIds: newNodes.map((n) => n.id),
    frameIds: newFrames.map((f) => f.id),
  };
}
