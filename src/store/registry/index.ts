import type { Component } from "vue";
import type {
  GraphDocument,
  NodeMap,
  PortTypeDefinition,
  TypeRegistry,
  TypeWidgetSpec,
} from "../model";
import { type NodeSpecRegistry, normalizeNode } from "./defineNode";

/**
 * A publishable bundle of custom types and/or node types (npm package contents).
 * Load onto a {@link NodeMap} with {@link NodeMap.loadPack}.
 */
export interface NodePack {
  /** Unique pack id (e.g. `"@my-org/my-pack"`). Recorded in {@link GraphDocument.extensions}. */
  id: string;
  /** Default priority for all types and nodes in this pack (default 0). */
  priority?: number;
  /** Custom {@link PortTypeDefinition}s to register. */
  types?: TypeRegistry;
  /** Custom node definitions to register (authoring form). */
  nodeTypes?: NodeSpecRegistry;
  /**
   * Optional hook to register Vue widgets after types and nodes are merged.
   * Runs once per pack load.
   */
  setup?: (ctx: PackSetupContext) => void;
}

/** Context passed to {@link NodePack.setup} for widget registration. */
export interface PackSetupContext {
  /**
   * Bind a Vue component to all editable ports of a type id (default widget slot).
   */
  registerTypeWidget: {
    (typeId: string, component: Component): void;
    (typeId: string, widgetId: string, component: Component): void;
  };
  /**
   * Bind a Vue component to a custom widget id
   * ({@link TypeWidgetSpec} `kind: "custom"`).
   */
  registerComponentWidget: (componentId: string, component: Component) => void;
}

export function registerTypes(map: NodeMap, types: TypeRegistry): void {
  Object.assign(map.types, types);
}

/** Merge node specs into the runtime registry, expanding ports and defaults. */
export function registerNodeTypes(
  map: NodeMap,
  nodeTypes: NodeSpecRegistry,
): void {
  for (const [id, spec] of Object.entries(nodeTypes)) {
    map.nodeTypes[id] = normalizeNode(spec);
  }
}

// Record a pack id after its types and nodes have been registered.
export function registerNodePack(map: NodeMap, pack: NodePack): void {
  if (!map.extensions.includes(pack.id)) {
    map.extensions.push(pack.id);
  }
}

export function unregisterNodePack(map: NodeMap, packId: string): void {
  map.extensions = map.extensions.filter((id) => id !== packId);
  // Types/nodeTypes from a pack are not removed automatically — packs are
  // expected to use unique typeIds. A full reload is the safe uninstall path.
}

export type { NodeSpecRegistry } from "./defineNode";
