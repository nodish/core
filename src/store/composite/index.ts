import type { NodeSpec } from "../registry/defineNode";
import { reconcileSide } from "../graph/dynamicPorts";
import { expandIO } from "../graph/expandIO";
import type { UpdateGraphInterfaceOptions } from "../interface/graphInterface";
import type {
  CompositeState,
  DefiniteNode,
  GraphInterface,
  Location,
  NodeMap,
} from "../model";
import { defaultGraphInterface } from "../model";
import { registerNodeTypes } from "../registry";
import {
  applyGraphInterface,
  DEFAULT_BOUNDARY_LAYOUT,
  ensureBoundaryNodes,
  updateGraphInterface,
} from "../nodes/io";
import { clonePlain } from "../utils/clonePlain";
import { pruneConnectionsForNode } from "../graph/pruneConnections";

export const COMPOSITE_TYPE = "composite/group";

export type { UpdateGraphInterfaceOptions };

export const compositeNode: NodeSpec = {
  typeId: COMPOSITE_TYPE,
  displayName: "Group",
  color: "#4a5a6a",
  description: "A nested subgraph with its own inputs and outputs.",
  group: ["Custom nodes"],
};

// Build a NodeMap view for editing a composite's interior.
export function buildNestedMap(
  parent: NodeMap,
  composite: DefiniteNode,
): NodeMap {
  const state = composite.composite;
  if (!state) {
    throw new Error("node has no composite state");
  }
  const map: NodeMap = {
    graph: state.graph,
    graphInterface: state.interface,
    types: parent.types,
    nodeTypes: { ...parent.nodeTypes },
    extensions: parent.extensions,
    loadPack: (pack) => parent.loadPack(pack),
  };
  applyGraphInterface(map, state.interface);
  return map;
}

// Persist nested map edits back onto the composite instance.
export function persistNestedMap(
  parent: NodeMap,
  composite: DefiniteNode,
  nested: NodeMap,
): void {
  composite.composite = {
    graph: clonePlain(nested.graph),
    interface: clonePlain(nested.graphInterface),
  };
  reconcileCompositePorts(parent, composite);
}

// Sync composite external ports with its nested graph interface.
export function reconcileCompositePorts(
  map: NodeMap,
  composite: DefiniteNode,
): void {
  const iface = composite.composite?.interface ?? defaultGraphInterface;
  composite.inputs = reconcileSide(
    composite.inputs,
    expandIO(iface.parameters),
    "input",
  );
  composite.outputs = reconcileSide(
    composite.outputs,
    expandIO(iface.returns),
    "output",
  );
  pruneConnectionsForNode(map, composite);
}

// Apply interface changes and optionally sync a parent composite instance.
export function applyGraphInterfaceUpdate(
  map: NodeMap,
  iface: GraphInterface,
  options: UpdateGraphInterfaceOptions = {},
): string[] {
  const errors = updateGraphInterface(map, iface);
  if (errors.length) return errors;

  const owner = options.ownerComposite;
  if (owner?.composite && options.parentMap) {
    owner.composite.interface = iface;
    reconcileCompositePorts(options.parentMap, owner);
  } else {
    map.graphInterface = iface;
  }

  return [];
}

function materializeCompositePorts(iface: GraphInterface): {
  inputs: DefiniteNode["inputs"];
  outputs: DefiniteNode["outputs"];
} {
  const empty: DefiniteNode["inputs"] = {};
  const inputs = reconcileSide(empty, expandIO(iface.parameters), "input");
  const outputs = reconcileSide(empty, expandIO(iface.returns), "output");
  return { inputs, outputs };
}

function initNestedState(
  parent: NodeMap,
  iface: GraphInterface,
): CompositeState {
  const nested: NodeMap = {
    graph: { nodes: [], connections: [] },
    graphInterface: clonePlain(iface),
    types: parent.types,
    nodeTypes: { ...parent.nodeTypes },
    extensions: parent.extensions,
    loadPack: (pack) => parent.loadPack(pack),
  };
  applyGraphInterface(nested, nested.graphInterface);
  ensureBoundaryNodes(nested, DEFAULT_BOUNDARY_LAYOUT);
  return {
    graph: clonePlain(nested.graph),
    interface: clonePlain(nested.graphInterface),
  };
}

// Create an empty composite on the parent graph.
export function instantiateComposite(
  parent: NodeMap,
  location: Location,
): DefiniteNode {
  if (!parent.nodeTypes[COMPOSITE_TYPE]) {
    registerNodeTypes(parent, { [COMPOSITE_TYPE]: compositeNode });
  }

  const iface = clonePlain(defaultGraphInterface);
  const compositeState = initNestedState(parent, iface);
  const { inputs, outputs } = materializeCompositePorts(iface);

  return {
    id: crypto.randomUUID(),
    typeId: COMPOSITE_TYPE,
    location,
    inputs,
    outputs,
    composite: compositeState,
  };
}

export function isCompositeNode(node: DefiniteNode): boolean {
  return node.typeId === COMPOSITE_TYPE && !!node.composite;
}
