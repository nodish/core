import type {
  GraphDocument,
  GraphInterface,
  NodeGraph,
  NodeMap,
  TypeRegistry,
} from "../model";
import { defaultGraphInterface } from "../model";
import { clonePlain } from "../utils/clonePlain";
import { applyGraphInterface, ensureBoundaryNodes } from "../nodes/io";
import type { NodePack } from "../registry";
import { registerNodeTypes, registerTypes } from "../registry";
import type { NodeSpecRegistry } from "../registry/defineNode";

/** Options for the vue entry `createNodeMap()`. */
export interface CreateNodeMapInit {
  /** Initial graph contents. Defaults to empty nodes and connections. */
  graph?: NodeGraph;
  /** Pre-loaded pack ids (usually leave empty and use {@link NodeMap.loadPack}). */
  extensions?: string[];
  /** Graph boundary ports; defaults to `a`/`b` in, `result` out. */
  graphInterface?: GraphInterface;
  /** Register the built-in `@local/core` pack. Default: `true`. */
  defaultPack?: boolean;
  /** Extra types to merge into the registry at creation time. */
  types?: TypeRegistry;
  /** Extra node types to merge into the registry at creation time (authoring form). */
  nodeTypes?: NodeSpecRegistry;
  /** Packs to load immediately after creation (via {@link NodeMap.loadPack}). */
  packs?: NodePack[];
}

// Create an in-memory workspace shell. Pack loading and widget setup are
// attached by the vue entry's createNodeMap().
export function createNodeMapBase(init: CreateNodeMapInit = {}): NodeMap {
  const map: NodeMap = {
    graph: init.graph ?? { nodes: [], connections: [] },
    types: {},
    nodeTypes: {},
    extensions: init.extensions ? [...init.extensions] : [],
    graphInterface: clonePlain(init.graphInterface ?? defaultGraphInterface),
    loadPack: () => [],
  };

  if (init.types) registerTypes(map, init.types);
  if (init.nodeTypes) registerNodeTypes(map, init.nodeTypes);

  applyGraphInterface(map, map.graphInterface);
  ensureBoundaryNodes(map);

  return map;
}

export type { GraphDocument };
