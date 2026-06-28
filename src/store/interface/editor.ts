import type { GraphInterface, NodeMap } from "../model";
import type { EditFrame } from "../composite/editContext";
import { currentComposite, resolveEditContext } from "../composite/editContext";
import { applyGraphInterfaceUpdate } from "../composite";

export type InterfaceMutator = (iface: GraphInterface) => void;

// The live interface object being edited (reactive when rooted in props.map).
export function canonicalGraphInterface(
  root: NodeMap,
  stack: EditFrame[],
): GraphInterface {
  if (!stack.length) return root.graphInterface;
  const owner = currentComposite(root, stack);
  if (!owner?.composite) return root.graphInterface;
  return owner.composite.interface;
}

// Apply a mutation to the canonical interface, then reconcile boundary + composite ports.
export function applyInterfaceMutation(
  root: NodeMap,
  stack: EditFrame[],
  mutate: InterfaceMutator,
): string[] {
  const iface = canonicalGraphInterface(root, stack);
  mutate(iface);
  const ctx = resolveEditContext(root, stack);
  return applyGraphInterfaceUpdate(
    ctx.activeMap,
    iface,
    ctx.interfaceOptions ?? {},
  );
}
