import type { NodeMap, PortTypeDefinition } from "../model";
import { normalizeNode, type NodeSpec } from "../registry/defineNode";
import { ANY_TYPE } from "../types/any";

/** Node type id for the auto Assert companion of a port type. */
export function assertNodeTypeId(typeId: string): string {
  return `assert/${typeId}`;
}

/**
 * Build an Assert node for `typeDef`: accepts that type or {@link ANY_TYPE},
 * validates with `typeDef.validate`, and outputs the narrowed type.
 */
export function makeAssertNode(typeDef: PortTypeDefinition): NodeSpec {
  const label = typeDef.label || typeDef.id;
  return {
    typeId: assertNodeTypeId(typeDef.id),
    displayName: `Assert ${label}`,
    color: typeDef.color,
    description: `Pass through when the value is a valid ${label}; otherwise error.`,
    group: ["Logic", "Assert"],
    inputs: {
      value: {
        type: typeDef.id,
        types: [typeDef.id, ANY_TYPE],
        connectionOnly: true,
      },
    },
    outputs: {
      result: { type: typeDef.id },
    },
    execute(inputs) {
      const value = inputs.value;
      if (!typeDef.validate(value)) {
        throw new Error(`Expected ${label}`);
      }
      return { result: value };
    },
  };
}

/**
 * Ensure every registered port type (except {@link ANY_TYPE}) has an Assert
 * companion node. Safe to call repeatedly after packs load.
 */
export function syncAssertNodes(map: NodeMap): void {
  for (const typeDef of Object.values(map.types)) {
    if (typeDef.id === ANY_TYPE) continue;
    const id = assertNodeTypeId(typeDef.id);
    // Always refresh so validate/label track the current type definition.
    map.nodeTypes[id] = normalizeNode(makeAssertNode(typeDef));
  }
}
