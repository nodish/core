import type { GraphPortSpec, NodeIODefinition, PortDefinition } from "../model";

// Expand a name-keyed port spec record into a NodeIODefinition (adds `name`).
export function expandIO(
  spec: Record<string, GraphPortSpec> | undefined,
): NodeIODefinition {
  const io: NodeIODefinition = {};
  for (const [name, port] of Object.entries(spec ?? {})) {
    io[name] = { name, ...port } satisfies PortDefinition;
  }
  return io;
}
