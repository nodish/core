import type { DefiniteNode, NodeGraph, NodeMap, Port } from "../model";

function checkPortTypes(
  map: NodeMap,
  node: DefiniteNode,
  port: Port,
  side: "input" | "output",
  errors: string[],
): void {
  if (!map.types[port.type]) {
    errors.push(
      `node "${node.label ?? node.typeId}" (${node.id}): unknown ${side} port type "${port.type}" on port "${port.name}"`,
    );
  }
}

function validateNode(
  map: NodeMap,
  node: DefiniteNode,
  errors: string[],
): void {
  if (!map.nodeTypes[node.typeId]) {
    errors.push(
      `node "${node.label ?? node.id}": unknown typeId "${node.typeId}"`,
    );
  }
  for (const port of Object.values(node.inputs)) {
    checkPortTypes(map, node, port, "input", errors);
  }
  for (const port of Object.values(node.outputs)) {
    checkPortTypes(map, node, port, "output", errors);
  }
  if (node.composite?.graph) {
    validateGraphTypes(map, node.composite.graph, errors);
  }
}

// Walk all nodes (including nested composite graphs) and ensure typeIds and
// port types resolve in the current registries.
export function validateGraphTypes(
  map: NodeMap,
  graph: NodeGraph,
  errors: string[] = [],
): string[] {
  for (const node of graph.nodes) {
    validateNode(map, node, errors);
  }
  return errors;
}
