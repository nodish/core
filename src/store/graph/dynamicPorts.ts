import type {
  DefiniteNode,
  IndefiniteNode,
  NodeIO,
  NodeIODefinition,
  NodeMap,
  Port,
  PortDirection,
} from "../model";
import { pruneConnectionsForNode } from "./pruneConnections";

// The port templates a node should currently have. For a dynamic node this is
// computed from its parameter values; otherwise it's just the static definition.
export function resolveNodePorts(
  def: IndefiniteNode,
  params: Record<string, unknown>,
): { inputs: NodeIODefinition; outputs: NodeIODefinition } {
  if (def.resolvePorts) return def.resolvePorts(params);
  return { inputs: def.inputs, outputs: def.outputs };
}

// Parameters that drive resolvePorts come from a node's user-only inputs.
// From a live instance: the current values.
export function nodeParams(node: DefiniteNode): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const p of Object.values(node.inputs)) {
    if (p.userOnly) params[p.name] = p.value;
  }
  return params;
}

// From a bare definition (before an instance exists): the declared defaults.
export function defaultParams(def: IndefiniteNode): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const d of Object.values(def.inputs)) {
    if (d.userOnly) params[d.name] = d.defaultValue;
  }
  return params;
}

// Build the new port set for one side, reusing existing ports by name so their
// ids (and thus connections) and current values survive a recount. Ports no
// longer present are dropped; new ones are materialized. Order follows `defs`.
export function reconcileSide(
  old: NodeIO,
  defs: NodeIODefinition,
  direction: PortDirection,
): NodeIO {
  const byName: Record<string, Port> = {};
  for (const p of Object.values(old)) byName[p.name] = p;

  const next: NodeIO = {};
  for (const d of Object.values(defs)) {
    const existing = byName[d.name];
    if (existing) {
      // Keep id/value/identity; refresh the type-derived fields.
      existing.type = d.type;
      existing.userOnly = d.userOnly;
      existing.multi = d.multi;
      existing.customProps = d.customProps;
      next[existing.id] = existing;
    } else {
      const id = crypto.randomUUID();
      next[id] = {
        id,
        name: d.name,
        type: d.type,
        direction,
        value: undefined,
        userOnly: d.userOnly,
        multi: d.multi,
        customProps: d.customProps,
      };
    }
  }
  return next;
}

// Recompute a dynamic node's ports from its current parameter values, then prune
// any connections that pointed at ports which no longer exist. No-op for nodes
// without a resolvePorts hook.
export function reconcilePorts(map: NodeMap, node: DefiniteNode): void {
  const def = map.nodeTypes[node.typeId];
  if (!def?.resolvePorts) return;

  const resolved = resolveNodePorts(def, nodeParams(node));
  node.inputs = reconcileSide(node.inputs, resolved.inputs, "input");
  node.outputs = reconcileSide(node.outputs, resolved.outputs, "output");

  pruneConnectionsForNode(map, node);
}
