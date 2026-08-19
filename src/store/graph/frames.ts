import type {
  FrameId,
  GraphFrame,
  NodeGraph,
  NodeId,
  NodeMap,
} from "../model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../nodes/io";

export const FRAME_DEFAULT_COLOR = "#3d5a80";

function isFrameable(graph: NodeGraph, nodeId: NodeId): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  return node.typeId !== INPUT_TYPE && node.typeId !== OUTPUT_TYPE;
}

export function ensureFrames(graph: NodeGraph): GraphFrame[] {
  if (!graph.frames) graph.frames = [];
  return graph.frames;
}

export function frameById(
  graph: NodeGraph,
  id: FrameId,
): GraphFrame | undefined {
  return graph.frames?.find((f) => f.id === id);
}

export function childFrames(graph: NodeGraph, parentId: FrameId): GraphFrame[] {
  return (graph.frames ?? []).filter((f) => f.parentId === parentId);
}

export function parentFrameOfNode(
  graph: NodeGraph,
  nodeId: NodeId,
): GraphFrame | undefined {
  return graph.frames?.find((f) => f.nodeIds.includes(nodeId));
}

/** Ancestor frame ids of `frameId` (not including itself). */
export function frameAncestors(graph: NodeGraph, frameId: FrameId): Set<FrameId> {
  const seen = new Set<FrameId>();
  let cur = frameById(graph, frameId)?.parentId;
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = frameById(graph, cur)?.parentId;
  }
  return seen;
}

export function isFrameDescendant(
  graph: NodeGraph,
  ancestorId: FrameId,
  maybeChild: FrameId,
): boolean {
  return frameAncestors(graph, maybeChild).has(ancestorId);
}

export function descendantFrameIds(
  graph: NodeGraph,
  frameId: FrameId,
): FrameId[] {
  const out: FrameId[] = [];
  const stack = childFrames(graph, frameId).map((f) => f.id);
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of childFrames(graph, id)) stack.push(c.id);
  }
  return out;
}

export function descendantNodeIds(
  graph: NodeGraph,
  frameId: FrameId,
): NodeId[] {
  const ids = new Set<NodeId>();
  for (const fid of [frameId, ...descendantFrameIds(graph, frameId)]) {
    const f = frameById(graph, fid);
    if (!f) continue;
    for (const n of f.nodeIds) ids.add(n);
  }
  return [...ids];
}

export function frameDepth(graph: NodeGraph, frameId: FrameId): number {
  return frameAncestors(graph, frameId).size;
}

/** Parent frames first so nested frames paint on top. */
export function framesBackToFront(graph: NodeGraph): GraphFrame[] {
  return [...(graph.frames ?? [])].sort(
    (a, b) => frameDepth(graph, a.id) - frameDepth(graph, b.id),
  );
}

function removeNodeFromAllFrames(graph: NodeGraph, nodeId: NodeId): void {
  for (const f of graph.frames ?? []) {
    f.nodeIds = f.nodeIds.filter((id) => id !== nodeId);
  }
}

/** Drop frames that have no member nodes and no child frames. */
export function pruneEmptyFrames(graph: NodeGraph): void {
  let frames = ensureFrames(graph);
  let changed = true;
  while (changed) {
    changed = false;
    const hasChild = new Set<FrameId>();
    for (const f of frames) {
      if (f.parentId) hasChild.add(f.parentId);
    }
    const next = frames.filter(
      (f) => f.nodeIds.length > 0 || hasChild.has(f.id),
    );
    if (next.length !== frames.length) changed = true;
    const alive = new Set(next.map((f) => f.id));
    for (const f of next) {
      if (f.parentId && !alive.has(f.parentId)) f.parentId = undefined;
    }
    frames = next;
  }
  graph.frames = frames;
}

export function dissolveFrame(map: NodeMap, frameId: FrameId): void {
  const graph = map.graph;
  const frames = ensureFrames(graph);
  const frame = frames.find((f) => f.id === frameId);
  if (!frame) return;
  const parent = frame.parentId
    ? frameById(graph, frame.parentId)
    : undefined;
  for (const nodeId of frame.nodeIds) {
    if (parent && !parent.nodeIds.includes(nodeId)) parent.nodeIds.push(nodeId);
  }
  for (const child of childFrames(graph, frameId)) {
    child.parentId = frame.parentId;
  }
  graph.frames = frames.filter((f) => f.id !== frameId);
  pruneEmptyFrames(graph);
}

export function pruneFrameMembership(
  map: NodeMap,
  removedNodeIds: NodeId[],
): void {
  if (!removedNodeIds.length || !map.graph.frames?.length) return;
  const drop = new Set(removedNodeIds);
  for (const f of map.graph.frames) {
    f.nodeIds = f.nodeIds.filter((id) => !drop.has(id));
  }
  pruneEmptyFrames(map.graph);
}

/**
 * Reparent selected nodes to their shared parent frame's parent (or none).
 * No-op when nodes do not share a single parent frame.
 */
export function unframeNodes(map: NodeMap, nodeIds: NodeId[]): void {
  const graph = map.graph;
  const unique = [...new Set(nodeIds)];
  if (!unique.length) return;
  const parents = unique.map((id) => parentFrameOfNode(graph, id));
  const first = parents[0];
  if (!first || parents.some((p) => p?.id !== first.id)) return;
  const grand = first.parentId ? frameById(graph, first.parentId) : undefined;
  for (const nodeId of unique) {
    first.nodeIds = first.nodeIds.filter((id) => id !== nodeId);
    if (grand && !grand.nodeIds.includes(nodeId)) grand.nodeIds.push(nodeId);
  }
  pruneEmptyFrames(graph);
}

export function sharedParentFrameId(
  graph: NodeGraph,
  nodeIds: NodeId[],
): FrameId | undefined {
  if (!nodeIds.length) return undefined;
  const parents = nodeIds.map((id) => parentFrameOfNode(graph, id)?.id);
  const first = parents[0];
  if (!first || parents.some((p) => p !== first)) return undefined;
  return first;
}

/**
 * Wrap selected nodes and/or frames in a new frame. Selected frames that sit
 * inside another selected frame are skipped (the outer one already contains
 * them). Nodes already covered by a selected frame are skipped the same way.
 */
export function wrapSelection(
  map: NodeMap,
  nodeIds: NodeId[],
  frameIds: FrameId[],
): GraphFrame | null {
  const graph = map.graph;
  const selectedFrames = new Set(
    frameIds.filter((id) => frameById(graph, id)),
  );
  const topFrames = [...selectedFrames].filter(
    (id) =>
      ![...selectedFrames].some(
        (other) => other !== id && isFrameDescendant(graph, other, id),
      ),
  );
  const covered = new Set<NodeId>();
  for (const fid of topFrames) {
    for (const n of descendantNodeIds(graph, fid)) covered.add(n);
  }
  const live = new Set(graph.nodes.map((n) => n.id));
  const topNodes = [...new Set(nodeIds)].filter(
    (id) => live.has(id) && !covered.has(id) && isFrameable(graph, id),
  );
  if (!topNodes.length && !topFrames.length) return null;

  const parentHints: Array<FrameId | undefined> = [
    ...topNodes.map((id) => parentFrameOfNode(graph, id)?.id),
    ...topFrames.map((id) => frameById(graph, id)?.parentId),
  ];
  const first = parentHints[0];
  const common =
    parentHints.every((p) => p === first) ? first : undefined;

  const frame: GraphFrame = {
    id: crypto.randomUUID(),
    parentId: common,
    nodeIds: [],
    color: FRAME_DEFAULT_COLOR,
  };

  const frames = ensureFrames(graph);
  for (const nodeId of topNodes) removeNodeFromAllFrames(graph, nodeId);
  frame.nodeIds = topNodes;
  for (const fid of topFrames) {
    const f = frameById(graph, fid);
    if (f) f.parentId = frame.id;
  }
  frames.push(frame);
  return frame;
}

/** Drop dangling ids, duplicate membership, and parent cycles after load. */
export function sanitizeFrames(graph: NodeGraph): void {
  if (!graph.frames) return;
  if (!Array.isArray(graph.frames)) {
    graph.frames = [];
    return;
  }
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const seenFrame = new Set<FrameId>();
  const claimed = new Set<NodeId>();
  const next: GraphFrame[] = [];
  for (const raw of graph.frames) {
    if (!raw || typeof raw !== "object") continue;
    if (typeof raw.id !== "string" || seenFrame.has(raw.id)) continue;
    seenFrame.add(raw.id);
    const cleanNodes = Array.isArray(raw.nodeIds)
      ? raw.nodeIds.filter(
          (id): id is NodeId =>
            typeof id === "string" &&
            nodeIds.has(id) &&
            !claimed.has(id) &&
            isFrameable(graph, id),
        )
      : [];
    for (const id of cleanNodes) claimed.add(id);
    next.push({
      id: raw.id,
      label: typeof raw.label === "string" ? raw.label : undefined,
      color: typeof raw.color === "string" ? raw.color : undefined,
      parentId: typeof raw.parentId === "string" ? raw.parentId : undefined,
      nodeIds: cleanNodes,
    });
  }
  const alive = new Set(next.map((f) => f.id));
  for (const f of next) {
    if (f.parentId && (f.parentId === f.id || !alive.has(f.parentId))) {
      f.parentId = undefined;
    }
  }
  for (const f of next) {
    const walk = new Set<FrameId>([f.id]);
    let cur = f.parentId;
    let prev = f;
    while (cur) {
      if (walk.has(cur)) {
        prev.parentId = undefined;
        break;
      }
      walk.add(cur);
      const found = next.find((x) => x.id === cur);
      if (!found) break;
      prev = found;
      cur = found.parentId;
    }
  }
  graph.frames = next;
  pruneEmptyFrames(graph);
}
