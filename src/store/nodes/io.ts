import { reconcileSide } from "../graph/dynamicPorts";
import { expandIO } from "../graph/expandIO";
import { pruneConnectionsForNode } from "../graph/pruneConnections";
import { instantiate } from "../graph/instance";
import type { NodeSpec } from "../registry/defineNode";
import { normalizeNode } from "../registry/defineNode";
import { validateGraphInterface } from "../interface/graphInterface";
import type {
  DefiniteNode,
  GraphInterface,
  NodeLocation,
  NodeMap,
} from "../model";
import { registerNodeTypes } from "../registry";

/** {@link IndefiniteNode.typeId} for the graph Input (Group Input) boundary node. */
export const INPUT_TYPE = "io/input";
/** {@link IndefiniteNode.typeId} for the graph Output (Group Output) boundary node. */
export const OUTPUT_TYPE = "io/output";

export const DEFAULT_BOUNDARY_LAYOUT = {
  input: { x: 40, y: 120 },
  output: { x: 480, y: 130 },
} satisfies Record<"input" | "output", NodeLocation>;

// Re-export for callers that import boundary types from this module.
export type { GraphInterface } from "../model";
export { defaultGraphInterface as defaultInterface } from "../model";

// Procedurally build the boundary nodes (Blender's Group Input / Group Output)
// from an interface, instead of hard-coding their ports.
export function createIONodes(iface: GraphInterface = {}): {
  input: NodeSpec;
  output: NodeSpec;
} {
  return {
    input: {
      typeId: INPUT_TYPE,
      displayName: "Input",
      color: "#7a5a3a",
      description: "Graph inputs (function parameters).",
      group: ["graph"],
      outputs: iface.parameters,
    },
    output: {
      typeId: OUTPUT_TYPE,
      displayName: "Output",
      color: "#7a3a5a",
      description: "Graph outputs (function return values).",
      group: ["graph"],
      inputs: iface.returns,
    },
  };
}

// Register Input/Output node types derived from the graph interface.
export function applyGraphInterface(map: NodeMap, iface: GraphInterface): void {
  map.graphInterface = iface;
  const io = createIONodes(iface);
  registerNodeTypes(map, {
    [io.input.typeId]: io.input,
    [io.output.typeId]: io.output,
  });
}

/**
 * Return the single Input and Output nodes on the graph.
 * @throws When the graph does not contain exactly one of each.
 */
export function boundaryNodes(map: NodeMap): {
  input: DefiniteNode;
  output: DefiniteNode;
} {
  const inputs = map.graph.nodes.filter((n) => n.typeId === INPUT_TYPE);
  const outputs = map.graph.nodes.filter((n) => n.typeId === OUTPUT_TYPE);
  if (inputs.length !== 1 || outputs.length !== 1) {
    throw new Error(
      `graph must have exactly one Input and one Output node (found ${inputs.length} input, ${outputs.length} output)`,
    );
  }
  return { input: inputs[0], output: outputs[0] };
}

// Ensure exactly one Input and one Output exist on the canvas.
export function ensureBoundaryNodes(
  map: NodeMap,
  layout = DEFAULT_BOUNDARY_LAYOUT,
): { input: DefiniteNode; output: DefiniteNode } {
  const inputs = map.graph.nodes.filter((n) => n.typeId === INPUT_TYPE);
  const outputs = map.graph.nodes.filter((n) => n.typeId === OUTPUT_TYPE);
  if (inputs.length > 1 || outputs.length > 1) {
    throw new Error(
      `graph must have exactly one Input and one Output node (found ${inputs.length} input, ${outputs.length} output)`,
    );
  }

  let input = inputs[0];
  let output = outputs[0];
  const io = createIONodes(map.graphInterface);
  if (!input) {
    input = instantiate(normalizeNode(io.input), layout.input);
    map.graph.nodes.push(input);
  }
  if (!output) {
    output = instantiate(normalizeNode(io.output), layout.output);
    map.graph.nodes.push(output);
  }
  return { input, output };
}

// Update the graph interface, re-register IO types, and reconcile boundary ports.
export function updateGraphInterface(
  map: NodeMap,
  iface: GraphInterface,
): string[] {
  const errors = validateGraphInterface(map, iface);
  if (errors.length) return errors;

  applyGraphInterface(map, iface);

  const { input, output } = boundaryNodes(map);

  input.outputs = reconcileSide(
    input.outputs,
    expandIO(iface.parameters),
    "output",
  );
  for (const port of Object.values(input.outputs)) {
    const spec = iface.parameters?.[port.name];
    if (!spec) continue;
    const typeDef = map.types[spec.type];
    if (spec.defaultValue !== undefined) {
      port.value = spec.defaultValue;
    } else if (typeDef && !typeDef.validate(port.value)) {
      port.value = typeDef.defaultValue;
    }
  }
  output.inputs = reconcileSide(
    output.inputs,
    expandIO(iface.returns),
    "input",
  );

  pruneConnectionsForNode(map, input);
  pruneConnectionsForNode(map, output);

  return [];
}

export function validateBoundary(map: NodeMap): string[] {
  const errors: string[] = [];
  const inputCount = map.graph.nodes.filter(
    (n) => n.typeId === INPUT_TYPE,
  ).length;
  const outputCount = map.graph.nodes.filter(
    (n) => n.typeId === OUTPUT_TYPE,
  ).length;
  if (inputCount === 0) errors.push("graph has no Input node");
  else if (inputCount > 1) errors.push("graph has multiple Input nodes");
  if (outputCount === 0) errors.push("graph has no Output node");
  else if (outputCount > 1) errors.push("graph has multiple Output nodes");
  return errors;
}
