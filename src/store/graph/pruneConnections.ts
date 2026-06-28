import type { DefiniteNode, NodeMap } from "../model";

// Drop connections that reference ports no longer present on `node`.
export function pruneConnectionsForNode(
  map: NodeMap,
  node: DefiniteNode,
): void {
  map.graph.connections = map.graph.connections.filter((c) => {
    if (c.from.node === node.id && !node.outputs[c.from.port]) return false;
    if (c.to.node === node.id && !node.inputs[c.to.port]) return false;
    return true;
  });
}
