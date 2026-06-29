import type { NodePack } from "./registry";

export type NodeId = string;
export type PortId = string;
export type ConnectionId = string;
export type NodeTypeId = string;

export type Location = {
  x: number;
  y: number;
};

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/** Key into the {@link TypeRegistry} (e.g. `"number"`). */
export type PortTypeId = string;
export type PortType = PortTypeId;

/**
 * Serializable widget descriptor for port value editing and display. Lives on the
 * type definition; the Vue viewer resolves it to a concrete component.
 */
export type TypeWidgetSpec =
  | {
      kind: "number";
      min?: number;
      max?: number;
      step?: number;
      /** Port row height in px; defaults to one line (20px). */
      rowHeight?: number;
    }
  | {
      kind: "text";
      /** Multiline row count; height is `rows × 20px` unless `rowHeight` is set. */
      rows?: number;
      /** Port row height in px; overrides `rows`. */
      rowHeight?: number;
    }
  | {
      kind: "custom";
      /** Id passed to `registerComponentWidget` in a pack's `setup` hook. */
      componentId: string;
      /** Port row height in px; defaults to one line (20px). */
      rowHeight?: number;
    };

/**
 * A registered data type. Carries validation, connection compatibility, and
 * optional value lifecycle hooks. Registered at startup — only {@link PortTypeId}
 * keys on ports are serialized in documents.
 */
export interface PortTypeDefinition {
  id: PortTypeId;
  label: string;
  color: string;
  validate: (value: unknown) => boolean;
  /**
   * Whether an output of type `from` may connect into an input of this type.
   * Decided by the destination type. Omitted means strict identity (`from === id`).
   */
  accepts?: (from: PortTypeId) => boolean;
  /** Fallback when a port of this type omits its own default. */
  defaultValue?: unknown;
  /** Display/edit descriptor for the viewer (no functions). */
  widget?: TypeWidgetSpec;
  /** Parse a raw string (e.g. from an input field) into a value. */
  parse?: (raw: string) => unknown;
  /** Format a value for display in the viewer. */
  format?: (value: unknown) => string;
  /** Normalize or clamp a value after edit or connection. */
  coerce?: (value: unknown) => unknown;
}

/** Library of available data types, keyed by id. */
export type TypeRegistry = Record<PortTypeId, PortTypeDefinition>;

export type PortDirection = "input" | "output";

/**
 * Port template declared by a node type ({@link IndefiniteNode}). Has no id and
 * no live value — only describes ports that instances will receive.
 */
export type PortDefinition = {
  /** Stable, human-authored key; referenced inside `execute()`. */
  name: string;
  type: PortType;
  /** Used by an input when nothing is connected to it. */
  defaultValue?: unknown;
  description?: string;
  /**
   * Input-only. Never accepts a connection — no socket, always shows its widget.
   * Also feeds parameters into {@link IndefiniteNode.resolvePorts}.
   */
  userOnly?: boolean;
  /**
   * Input-only. Accepts any number of incoming connections; `execute()` receives
   * values as an unordered array of `type`.
   */
  multi?: boolean;
  /**
   * Widget-specific configuration merged on top of the type's widget spec.
   * Recognized keys: `options`, `min`, `max`, `step`, `rows`, `rowHeight`.
   */
  customProps?: Record<string, unknown>;
};

/**
 * Materialized port on a placed node ({@link DefiniteNode}). Has a unique id so
 * connections and the DOM can reference it directly.
 */
export type Port = {
  id: PortId;
  /** Matches the {@link PortDefinition.name} it came from. */
  name: string;
  type: PortType;
  direction: PortDirection;
  /** Input: value when disconnected. Output: optional cache of last computed value. */
  value?: unknown;
  userOnly?: boolean;
  multi?: boolean;
  customProps?: Record<string, unknown>;
};

/** Port templates on a definition, keyed by name (authoring-friendly). */
export type NodeIODefinition = Record<string, PortDefinition>;

/** Materialized ports on an instance, keyed by id (connection/DOM-friendly). */
export type NodeIO = Record<PortId, Port>;

/** Reference to one port on one node. */
export type PortRef = {
  node: NodeId;
  port: PortId;
};

// ---------------------------------------------------------------------------
// Node type / definition (IndefiniteNode)
// ---------------------------------------------------------------------------

/**
 * Node type template that {@link DefiniteNode} instances are created from. Lives
 * in the runtime registry only (never in a saved graph). Authors ship types via
 * {@link NodePack}.
 *
 * - **Primitive:** implements {@link IndefiniteNode.execute}.
 * - **Composite:** supplies a nested {@link IndefiniteNode.graph} instead of `execute`.
 */
export interface IndefiniteNode {
  /** Unique node type id (e.g. `"my-pack/add"`). */
  typeId: NodeTypeId;
  displayName: string;
  color: string;
  description: string;
  /**
   * Hierarchical menu category, broadest first, e.g. `["Math", "Basic Operations"]`.
   * Empty or omitted places the node at the menu root.
   */
  group?: string[];
  inputs: NodeIODefinition;
  outputs: NodeIODefinition;
  /**
   * Runtime evaluation, keyed by port name (not id). Omit for composite types.
   * @returns Output values keyed by port name.
   */
  execute?: (inputs: Record<string, unknown>) => Record<string, unknown>;
  /** Nested subgraph for composite types (registry-only, not evaluated standalone). */
  graph?: NodeGraph;
  /**
   * Dynamic port count driven by user-only inputs. When present, static
   * `inputs`/`outputs` are initial defaults; reconciliation re-materializes
   * ports by name so existing ids and connections survive a recount.
   */
  resolvePorts?: (params: Record<string, unknown>) => {
    inputs: NodeIODefinition;
    outputs: NodeIODefinition;
  };
}

// ---------------------------------------------------------------------------
// Node instance (DefiniteNode)
// ---------------------------------------------------------------------------

/**
 * A node placed on the workspace. Serializable data only — behaviour lives on
 * the {@link IndefiniteNode} referenced by {@link DefiniteNode.typeId}.
 */
export interface DefiniteNode {
  id: NodeId;
  /** {@link IndefiniteNode} this instance was created from. */
  typeId: NodeTypeId;
  location: Location;
  inputs: NodeIO;
  outputs: NodeIO;
  label?: string;
  color?: string;
  /** Node width in px. Falls back to layout default when undefined. */
  width?: number;
  /**
   * Stacking order — higher paints on top. Stored for save/load. Undefined until
   * first assigned.
   */
  z?: number;
  /** Nested graph for composite/group instances. Serializable with the node. */
  composite?: CompositeState;
}

/** Serializable nested graph owned by a composite instance. */
export interface CompositeState {
  graph: NodeGraph;
  interface: GraphInterface;
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/**
 * Directed wire from an output port to an input port. Stored centrally on the
 * graph so either endpoint can be looked up uniformly.
 */
export interface Connection {
  id: ConnectionId;
  /** Must reference an output port. */
  from: PortRef;
  /** Must reference an input port. */
  to: PortRef;
}

// ---------------------------------------------------------------------------
// Graph + registry
// ---------------------------------------------------------------------------

/** Serializable port template for boundary definitions (object key = port name). */
export type GraphPortSpec = Omit<PortDefinition, "name">;

/**
 * External signature of a graph. Parameters become the Input node's output ports;
 * returns become the Output node's input ports.
 */
export interface GraphInterface {
  /** Graph inputs (function parameters). Key = port name. */
  parameters?: Record<string, GraphPortSpec>;
  /** Graph outputs (return values). Key = port name. */
  returns?: Record<string, GraphPortSpec>;
}

export const defaultGraphInterface: GraphInterface = {
  parameters: {
    a: { type: "number", defaultValue: 0 },
    b: { type: "number", defaultValue: 0 },
  },
  returns: {
    result: { type: "number" },
  },
};

/**
 * Placed nodes and connections. Every graph must contain exactly one Input node
 * and one Output node.
 */
export interface NodeGraph {
  nodes: DefiniteNode[];
  connections: Connection[];
}

/**
 * Serializable graph snapshot. Contains no `execute()` implementations or type
 * definitions — custom nodes are resolved at runtime from loaded {@link NodePack}s.
 */
export interface GraphDocument {
  graph: NodeGraph;
  interface: GraphInterface;
  /** Pack ids required to interpret this document. See {@link NodeMap.extensions}. */
  extensions?: string[];
}

/** Library of available node types, keyed by {@link NodeTypeId}. */
export type NodeRegistry = Record<NodeTypeId, IndefiniteNode>;

/** In-memory workspace: serializable graph plus runtime type and node registries. */
export interface NodeMap {
  graph: NodeGraph;
  types: TypeRegistry;
  nodeTypes: NodeRegistry;
  /** Ids of packs loaded via {@link NodeMap.loadPack}. */
  extensions: string[];
  graphInterface: GraphInterface;
  /**
   * Register types, nodes, and optional widget setup from a pack.
   * @returns Registration errors (empty array on success).
   */
  loadPack(pack: NodePack): string[];
}
