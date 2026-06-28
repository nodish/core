import type { DefiniteNode, NodeMap } from "../model";
import { buildNestedMap } from "./index";
import type { UpdateGraphInterfaceOptions } from "../interface/graphInterface";

export interface EditFrame {
  compositeNodeId: string;
}

export interface EditContext {
  activeMap: NodeMap;
  interfaceOptions?: UpdateGraphInterfaceOptions;
}

// Walk the edit stack and return the composite node at `depth` (0 = innermost frame).
export function compositeAtDepth(
  root: NodeMap,
  stack: EditFrame[],
  depth: number,
): DefiniteNode | null {
  let parentMap: NodeMap = root;
  for (let i = 0; i <= depth; i++) {
    const frame = stack[i];
    if (!frame) return null;
    const node = parentMap.graph.nodes.find(
      (n) => n.id === frame.compositeNodeId,
    );
    if (!node) return null;
    if (i === depth) return node;
    if (!node.composite) return null;
    parentMap = buildNestedMap(root, node);
  }
  return null;
}

// The composite node for the currently edited nested graph (innermost stack frame).
export function currentComposite(
  root: NodeMap,
  stack: EditFrame[],
): DefiniteNode | null {
  if (!stack.length) return null;
  return compositeAtDepth(root, stack, stack.length - 1);
}

// Resolve the map being edited and optional composite sync options from the stack.
export function resolveEditContext(
  root: NodeMap,
  stack: EditFrame[],
): EditContext {
  if (!stack.length) {
    return { activeMap: root };
  }

  let parentMap: NodeMap = root;
  let composite: DefiniteNode | undefined;

  for (let i = 0; i < stack.length; i++) {
    const frame = stack[i];
    composite = parentMap.graph.nodes.find(
      (n) => n.id === frame.compositeNodeId,
    );
    if (!composite?.composite) {
      return { activeMap: root };
    }
    if (i < stack.length - 1) {
      parentMap = buildNestedMap(root, composite);
    }
  }

  const activeMap = buildNestedMap(root, composite!);

  return {
    activeMap,
    interfaceOptions: {
      ownerComposite: composite,
      parentMap,
    },
  };
}

export function compositeLabel(node: DefiniteNode): string {
  return node.label || "Group";
}

export function breadcrumbPath(root: NodeMap, stack: EditFrame[]): string[] {
  const segments = ["Graph"];
  for (let i = 0; i < stack.length; i++) {
    const node = compositeAtDepth(root, stack, i);
    segments.push(node ? compositeLabel(node) : "Group");
  }
  return segments;
}
