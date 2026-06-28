import type { DefiniteNode, NodeGraph, NodeMap } from "../model";
import { isCompositeNode } from "./index";
import type { EditFrame } from "./editContext";
import { compositeAtDepth, currentComposite } from "./editContext";

export function graphContainsNodeId(
  graph: NodeGraph,
  id: string,
  deep: boolean,
): boolean {
  for (const n of graph.nodes) {
    if (n.id === id) return true;
    if (deep && n.composite?.graph) {
      if (graphContainsNodeId(n.composite.graph, id, true)) return true;
    }
  }
  return false;
}

export function ancestorCompositeIds(stack: EditFrame[]): string[] {
  return stack.map((f) => f.compositeNodeId);
}

function forbiddenCompositeIds(root: NodeMap, stack: EditFrame[]): Set<string> {
  const ids = new Set(ancestorCompositeIds(stack));
  const owner = currentComposite(root, stack);
  if (owner) ids.add(owner.id);
  return ids;
}

export function validateCompositePlacement(
  root: NodeMap,
  stack: EditFrame[],
  targetGraph: NodeGraph,
): string | null {
  for (const id of forbiddenCompositeIds(root, stack)) {
    if (graphContainsNodeId(targetGraph, id, true)) {
      return "A group cannot be placed inside itself";
    }
  }
  return null;
}

export function validateCompositeDrillIn(
  root: NodeMap,
  stack: EditFrame[],
  target: DefiniteNode,
): string | null {
  if (!isCompositeNode(target)) return "Not a group node";

  if (stack.some((f) => f.compositeNodeId === target.id)) {
    return "Already editing this group";
  }

  const forbidden = forbiddenCompositeIds(root, stack);
  forbidden.add(target.id);

  if (target.composite?.graph) {
    for (const id of forbidden) {
      if (graphContainsNodeId(target.composite.graph, id, true)) {
        return "Cannot open a group that contains an ancestor";
      }
    }
  }

  return null;
}

export function wouldCreateCompositeCycle(
  root: NodeMap,
  stack: EditFrame[],
  node: DefiniteNode,
  hostGraph: NodeGraph,
): string | null {
  if (!isCompositeNode(node) || !node.composite) return null;

  const forbidden = forbiddenCompositeIds(root, stack);

  if (forbidden.has(node.id)) {
    return "A group cannot be placed inside itself";
  }

  for (const id of forbidden) {
    if (graphContainsNodeId(hostGraph, id, false)) {
      return "A group cannot be placed inside itself";
    }
  }

  for (let i = 0; i < stack.length; i++) {
    const anc = compositeAtDepth(root, stack, i);
    if (anc?.composite?.graph === node.composite.graph) {
      return "A group cannot share the same interior as an ancestor";
    }
    if (anc && node.composite.graph === anc.composite?.graph) {
      return "A group cannot be placed inside itself";
    }
  }

  if (graphContainsNodeId(node.composite.graph, node.id, true)) {
    return "A group cannot contain itself";
  }

  for (const id of forbidden) {
    if (graphContainsNodeId(node.composite.graph, id, true)) {
      return "A group cannot contain an ancestor";
    }
  }

  const owner = currentComposite(root, stack);
  if (owner?.composite && node.composite.graph === owner.composite.graph) {
    return "A group cannot be placed inside itself";
  }

  return validateCompositePlacement(root, stack, hostGraph);
}
