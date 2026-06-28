import type {
  DefiniteNode,
  IndefiniteNode,
  Location,
  NodeIO,
  NodeIODefinition,
  PortDirection,
} from "../model";
import { defaultParams, resolveNodePorts } from "./dynamicPorts";

function materialize(io: NodeIODefinition, direction: PortDirection): NodeIO {
  const ports: NodeIO = {};
  for (const def of Object.values(io)) {
    const id = crypto.randomUUID();
    ports[id] = {
      id,
      name: def.name,
      type: def.type,
      direction,
      value: def.userOnly ? def.defaultValue : undefined,
      userOnly: def.userOnly,
      multi: def.multi,
      customProps: def.customProps,
    };
  }
  return ports;
}

/**
 * Create a placed {@link DefiniteNode} from a node type, generating fresh port ids.
 * For dynamic nodes, the initial port set comes from {@link IndefiniteNode.resolvePorts}
 * seeded with the definition's default parameter values.
 */
export function instantiate(
  def: IndefiniteNode,
  location: Location,
): DefiniteNode {
  const { inputs, outputs } = resolveNodePorts(def, defaultParams(def));
  return {
    id: crypto.randomUUID(),
    typeId: def.typeId,
    location,
    inputs: materialize(inputs, "input"),
    outputs: materialize(outputs, "output"),
  };
}
