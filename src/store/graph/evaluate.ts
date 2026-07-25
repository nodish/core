import type { DefiniteNode, NodeId, NodeMap, Port, PortRef } from "../model";
import { buildNestedMap, isCompositeNode } from "../composite";
import { INPUT_TYPE, OUTPUT_TYPE } from "../nodes/io";
import {
  ANY_TYPE,
  isAnyValue,
  unwrapAny,
  wrapAny,
} from "../types/any";
import { isConnectionOnly } from "./portTypes";

/** Port values keyed by port name. */
export type Values = Record<string, unknown>;

/** Evaluation errors keyed by {@link NodeId}. */
export type NodeErrors = Record<NodeId, string>;

export interface GraphRunResult {
  /** Output port values from the graph's Output node, keyed by port name. */
  values: Values;
  /** First error per node encountered during evaluation. */
  errors: NodeErrors;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Evaluate the graph as a function: supply values for the Input node's output
 * ports (keyed by port name) and receive the Output node's input port values.
 *
 * Uses pull-based recursive evaluation with per-node memoization and cycle detection.
 * Wired {@link ANY_TYPE} values are wrapped/unwrapped at the destination; invalid
 * envelopes assert on the receiving node.
 */
export function runGraph(map: NodeMap, inputs: Values = {}): GraphRunResult {
  const byId: Record<string, DefiniteNode> = {};
  for (const n of map.graph.nodes) byId[n.id] = n;

  const incoming = new Map<string, PortRef[]>();
  for (const c of map.graph.connections) {
    const key = `${c.to.node}:${c.to.port}`;
    const list = incoming.get(key);
    if (list) list.push(c.from);
    else incoming.set(key, [c.from]);
  }

  const cache = new Map<string, Values>();
  const visiting = new Set<string>();
  const errors: NodeErrors = {};

  function recordError(node: DefiniteNode, err: unknown): void {
    if (node.id in errors) return;
    errors[node.id] = errorMessage(err);
  }

  function rawFrom(src: PortRef): unknown {
    const srcNode = byId[src.node];
    const srcPort = srcNode?.outputs[src.port];
    return srcPort ? outputsOf(srcNode)[srcPort.name] : undefined;
  }

  /**
   * Deliver a wired value into `destPort`, wrapping/unwrapping `any` envelopes.
   * Throws on failed assert so the destination node owns the error.
   */
  function deliver(src: PortRef, destPort: Port): unknown {
    const srcNode = byId[src.node];
    const srcPort = srcNode?.outputs[src.port];
    const raw = rawFrom(src);
    const srcType = srcPort?.type;

    if (destPort.type === ANY_TYPE) {
      if (srcType === ANY_TYPE || isAnyValue(raw)) {
        return isAnyValue(raw) ? raw : wrapAny(srcType ?? ANY_TYPE, raw);
      }
      return wrapAny(srcType ?? ANY_TYPE, raw);
    }

    if (srcType === ANY_TYPE || isAnyValue(raw)) {
      const env = unwrapAny(raw);
      if (!env) {
        throw new Error("Expected Any envelope");
      }
      const destDef = map.types[destPort.type];
      if (!destDef?.validate(env.contents)) {
        throw new Error(`Expected ${destDef?.label ?? destPort.type}`);
      }
      return env.contents;
    }

    return raw;
  }

  function resolveInputs(
    node: DefiniteNode,
    options: { useDefaults?: boolean } = {},
  ): Values {
    const useDefaults = options.useDefaults !== false;
    const vals: Values = {};
    for (const port of Object.values(node.inputs)) {
      const srcs = incoming.get(`${node.id}:${port.id}`) ?? [];
      if (port.multi) {
        vals[port.name] = srcs.map((s) => deliver(s, port));
      } else if (srcs.length) {
        vals[port.name] = deliver(srcs[0]!, port);
      } else if (isConnectionOnly(port, map.types[port.type])) {
        vals[port.name] = undefined;
      } else {
        let v = port.value;
        if (v === undefined && useDefaults) {
          v = map.types[port.type]?.defaultValue;
        }
        const typeDef = map.types[port.type];
        if (v !== undefined && typeDef?.coerce) {
          v = typeDef.coerce(v);
        }
        vals[port.name] = v;
      }
    }
    return vals;
  }

  function outputsOf(node: DefiniteNode): Values {
    const cached = cache.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) {
      recordError(node, new Error("Cycle detected"));
      return {};
    }
    visiting.add(node.id);

    let out: Values;
    if (node.typeId === INPUT_TYPE) {
      out = {};
      for (const port of Object.values(node.outputs)) {
        out[port.name] = port.name in inputs ? inputs[port.name] : port.value;
      }
    } else if (isCompositeNode(node)) {
      try {
        const nestedMap = buildNestedMap(map, node);
        const nestedInputs = resolveInputs(node);
        const nested = runGraph(nestedMap, nestedInputs);
        for (const msg of Object.values(nested.errors)) {
          recordError(node, new Error(msg));
          break;
        }
        out = nested.values;
      } catch (err) {
        recordError(node, err);
        out = {};
      }
    } else {
      const def = map.nodeTypes[node.typeId];
      if (def?.execute) {
        try {
          out = def.execute(resolveInputs(node));
        } catch (err) {
          recordError(node, err);
          out = {};
        }
      } else {
        out = {};
      }
    }

    visiting.delete(node.id);
    cache.set(node.id, out);
    return out;
  }

  const output = map.graph.nodes.find((n) => n.typeId === OUTPUT_TYPE);
  let values: Values = {};
  if (output) {
    try {
      values = resolveInputs(output, { useDefaults: false });
    } catch (err) {
      recordError(output, err);
    }
  }
  return { values, errors };
}
