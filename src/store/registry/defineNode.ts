import type {
  GraphPortSpec,
  IndefiniteNode,
  NodeGraph,
  NodeTypeId,
} from "../model";
import { expandIO } from "../graph/expandIO";

/**
 * Port in a node spec — same as {@link GraphPortSpec}; the name comes from the
 * object key so authors do not repeat it.
 */
export type PortSpec = GraphPortSpec;

/** Input or output port templates keyed by port name. */
export type IOSpec = Record<string, PortSpec>;

/**
 * Authoring form of {@link IndefiniteNode.resolvePorts}. Returns ports in
 * {@link IOSpec} shape; normalized when registered via {@link registerNodeTypes}.
 */
export type DynamicPortsSpec = (params: Record<string, unknown>) => {
  inputs?: IOSpec;
  outputs?: IOSpec;
};

/**
 * Authoring format for a node type. Normalized into a full {@link IndefiniteNode}
 * when registered on a {@link NodeMap} (via {@link NodePack} or
 * {@link registerNodeTypes}).
 */
export interface NodeSpec {
  /** Unique node type id (e.g. `"my-pack/add"`). */
  typeId: NodeTypeId;
  displayName: string;
  color?: string;
  description?: string;
  /**
   * Hierarchical menu category, broadest first. See {@link IndefiniteNode.group}.
   */
  group?: string[];
  inputs?: IOSpec;
  outputs?: IOSpec;
  /**
   * Runtime evaluation, keyed by port name. Omit for composite node packs.
   * @returns Output values keyed by port name.
   */
  execute?: (inputs: Record<string, unknown>) => Record<string, unknown>;
  /** Nested subgraph for composite types in a published pack. Not evaluated yet. */
  graph?: NodeGraph;
  /**
   * Dynamic port count driven by user-only inputs. Static `inputs`/`outputs`
   * act as initial defaults when present.
   */
  resolvePorts?: DynamicPortsSpec;
}

/** Node types in authoring form, keyed by {@link NodeTypeId}. */
export type NodeSpecRegistry = Record<NodeTypeId, NodeSpec>;

/** Expand a {@link NodeSpec} into a runtime {@link IndefiniteNode}. */
export function normalizeNode(spec: NodeSpec): IndefiniteNode {
  return {
    typeId: spec.typeId,
    displayName: spec.displayName,
    color: spec.color ?? "#3a3f4b",
    description: spec.description ?? "",
    group: spec.group ?? [],
    inputs: expandIO(spec.inputs),
    outputs: expandIO(spec.outputs),
    execute: spec.execute,
    graph: spec.graph,
    resolvePorts: spec.resolvePorts
      ? (params) => {
          const r = spec.resolvePorts!(params);
          return { inputs: expandIO(r.inputs), outputs: expandIO(r.outputs) };
        }
      : undefined,
  };
}
