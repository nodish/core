import type { NodeId, NodeMap } from "../model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../nodes/io";

// IO boundary nodes are graph singletons and must not be removed.
export function canRemoveNode(map: NodeMap, id: NodeId): boolean {
  const node = map.graph.nodes.find((n) => n.id === id);
  if (!node) return false;
  return node.typeId !== INPUT_TYPE && node.typeId !== OUTPUT_TYPE;
}

// Remove a placed node and every connection touching it.
export function removeNode(map: NodeMap, id: NodeId): void {
  if (!canRemoveNode(map, id)) return;
  map.graph.nodes = map.graph.nodes.filter((n) => n.id !== id);
  map.graph.connections = map.graph.connections.filter(
    (c) => c.from.node !== id && c.to.node !== id,
  );
}
