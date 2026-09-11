import type {
  DefiniteNode,
  ExecuteContext,
  NodeId,
  NodeMap,
  Port,
  PortRef,
} from "../model";
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

/** In-flight nodes keyed by {@link NodeId}. Empty when a run has settled. */
export type NodePending = Record<NodeId, true>;

export interface GraphRunResult {
  /** Output port values from the graph's Output node, keyed by port name. */
  values: Values;
  /** First error per node encountered during evaluation. */
  errors: NodeErrors;
  /** Nodes currently executing (async runs only). */
  pending: NodePending;
}

export interface RunGraphAsyncOptions {
  signal?: AbortSignal;
  /**
   * When true, do not call `execute` on nodes with `io: true`.
   * Reuses {@link RunGraphAsyncOptions.priorOutputs} when present.
   */
  skipIo?: boolean;
  /** Last successful outputs by node id (live eval keeps IO results here). */
  priorOutputs?: Record<NodeId, Values>;
  /** Called when a node starts or finishes so the UI can show pending. */
  onProgress?: (result: GraphRunResult) => void;
}

const NEVER_ABORTED = new AbortController().signal;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function abortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new DOMException("Aborted", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError(signal);
}

class PromiseExecuteError extends Error {
  constructor(node: DefiniteNode, name: string) {
    super(
      `Node "${name}" (${node.typeId}) returned a Promise; use runGraphAsync`,
    );
    this.name = "PromiseExecuteError";
  }
}

function thenish<T, R>(
  value: T | PromiseLike<T>,
  fn: (v: T) => R | PromiseLike<R>,
): R | Promise<R> {
  if (isThenable(value)) return Promise.resolve(value).then(fn);
  const result = fn(value as T);
  if (isThenable(result)) return Promise.resolve(result);
  return result as R;
}

function indexGraph(map: NodeMap): {
  byId: Record<string, DefiniteNode>;
  incoming: Map<string, PortRef[]>;
} {
  const byId: Record<string, DefiniteNode> = {};
  for (const n of map.graph.nodes) byId[n.id] = n;

  const incoming = new Map<string, PortRef[]>();
  for (const c of map.graph.connections) {
    const key = `${c.to.node}:${c.to.port}`;
    const list = incoming.get(key);
    if (list) list.push(c.from);
    else incoming.set(key, [c.from]);
  }
  return { byId, incoming };
}

function deliverRaw(
  map: NodeMap,
  byId: Record<string, DefiniteNode>,
  src: PortRef,
  destPort: Port,
  raw: unknown,
): unknown {
  const srcNode = byId[src.node];
  const srcPort = srcNode?.outputs[src.port];
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

type EvalMode = {
  async: boolean;
  signal: AbortSignal;
  skipIo?: boolean;
  priorOutputs?: Record<NodeId, Values>;
  onProgress?: (result: GraphRunResult) => void;
};

function evaluateGraph(
  map: NodeMap,
  inputs: Values,
  mode: EvalMode,
): GraphRunResult | Promise<GraphRunResult> {
  const { byId, incoming } = indexGraph(map);
  const cache = new Map<string, Values>();
  const visiting = new Set<string>();
  const errors: NodeErrors = {};
  const pending: NodePending = {};
  let values: Values = {};

  function recordError(node: DefiniteNode, err: unknown): void {
    if (isAbortError(err)) throw err;
    if (node.id in errors) return;
    errors[node.id] = errorMessage(err);
  }

  function snapshot(): GraphRunResult {
    return { values, errors: { ...errors }, pending: { ...pending } };
  }

  function emitProgress(): void {
    mode.onProgress?.(snapshot());
  }

  function setPending(node: DefiniteNode, on: boolean): void {
    if (on) pending[node.id] = true;
    else delete pending[node.id];
    emitProgress();
  }

  function remember(node: DefiniteNode, out: Values): void {
    if (!mode.priorOutputs || node.id in errors) return;
    mode.priorOutputs[node.id] = out;
  }

  function displayName(node: DefiniteNode): string {
    return node.label || map.nodeTypes[node.typeId]?.displayName || node.typeId;
  }

  function rawFrom(src: PortRef): unknown | Promise<unknown> {
    const srcNode = byId[src.node];
    const srcPort = srcNode?.outputs[src.port];
    if (!srcPort || !srcNode) return undefined;
    return thenish(outputsOf(srcNode), (outs) => outs[srcPort.name]);
  }

  function deliver(
    src: PortRef,
    destPort: Port,
  ): unknown | Promise<unknown> {
    return thenish(rawFrom(src), (raw) =>
      deliverRaw(map, byId, src, destPort, raw),
    );
  }

  function resolveInputs(
    node: DefiniteNode,
    options: { useDefaults?: boolean } = {},
  ): Values | Promise<Values> {
    const useDefaults = options.useDefaults !== false;
    const names: string[] = [];
    const tasks: (unknown | Promise<unknown>)[] = [];
    for (const port of Object.values(node.inputs)) {
      names.push(port.name);
      const srcs = incoming.get(`${node.id}:${port.id}`) ?? [];
      if (port.multi) {
        const parts = srcs.map((s) => deliver(s, port));
        tasks.push(
          parts.some(isThenable)
            ? Promise.all(parts)
            : parts,
        );
      } else if (srcs.length) {
        tasks.push(deliver(srcs[0]!, port));
      } else if (isConnectionOnly(port, map.types[port.type])) {
        tasks.push(undefined);
      } else {
        let v = port.value;
        if (v === undefined && useDefaults) {
          v = map.types[port.type]?.defaultValue;
        }
        const typeDef = map.types[port.type];
        if (v !== undefined && typeDef?.coerce) {
          v = typeDef.coerce(v);
        }
        tasks.push(v);
      }
    }
    const finish = (vals: unknown[]): Values => {
      const out: Values = {};
      for (let i = 0; i < names.length; i++) out[names[i]!] = vals[i];
      return out;
    };
    if (tasks.some(isThenable)) {
      return Promise.all(tasks).then(finish);
    }
    return finish(tasks);
  }

  function finishNode(node: DefiniteNode, out: Values): Values {
    visiting.delete(node.id);
    delete pending[node.id];
    cache.set(node.id, out);
    remember(node, out);
    emitProgress();
    return out;
  }

  function runExecute(
    node: DefiniteNode,
    resolved: Values,
  ): Values | Promise<Values> {
    throwIfAborted(mode.signal);
    const def = map.nodeTypes[node.typeId];
    const ctx: ExecuteContext = { signal: mode.signal, nodeId: node.id };

    if (mode.skipIo && def?.io) {
      return mode.priorOutputs?.[node.id] ?? {};
    }

    if (!def?.execute) return {};

    setPending(node, true);
    try {
      const out = def.execute(resolved, ctx);
      if (isThenable(out)) {
        if (!mode.async) {
          throw new PromiseExecuteError(node, displayName(node));
        }
        return Promise.resolve(out).then(
          (value) => {
            throwIfAborted(mode.signal);
            return value;
          },
          (err) => {
            throwIfAborted(mode.signal);
            throw err;
          },
        );
      }
      return out;
    } catch (err) {
      if (err instanceof PromiseExecuteError || isAbortError(err)) throw err;
      recordError(node, err);
      return {};
    }
  }

  function outputsOf(node: DefiniteNode): Values | Promise<Values> {
    const cached = cache.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) {
      recordError(node, new Error("Cycle detected"));
      return {};
    }
    throwIfAborted(mode.signal);
    visiting.add(node.id);

    const after = (out: Values): Values => finishNode(node, out);

    const fail = (err: unknown): Values => {
      visiting.delete(node.id);
      delete pending[node.id];
      if (isAbortError(err) || err instanceof PromiseExecuteError) throw err;
      recordError(node, err);
      const out: Values = {};
      cache.set(node.id, out);
      emitProgress();
      return out;
    };

    let produced: Values | Promise<Values>;
    if (node.typeId === INPUT_TYPE) {
      const out: Values = {};
      for (const port of Object.values(node.outputs)) {
        out[port.name] = port.name in inputs ? inputs[port.name] : port.value;
      }
      produced = out;
    } else if (isCompositeNode(node)) {
      setPending(node, true);
      produced = thenish(resolveInputs(node), (nestedInputs) => {
        throwIfAborted(mode.signal);
        if (!mode.async) {
          const nested = runGraph(nestedMapFor(node), nestedInputs);
          for (const msg of Object.values(nested.errors)) {
            recordError(node, new Error(msg));
            break;
          }
          return nested.values;
        }
        return runGraphAsync(nestedMapFor(node), nestedInputs, {
          signal: mode.signal,
          skipIo: mode.skipIo,
          onProgress: () => emitProgress(),
        }).then((nested) => {
          throwIfAborted(mode.signal);
          for (const msg of Object.values(nested.errors)) {
            recordError(node, new Error(msg));
            break;
          }
          return nested.values;
        });
      });
    } else {
      produced = thenish(resolveInputs(node), (resolved) =>
        runExecute(node, resolved),
      );
    }

    if (isThenable(produced)) {
      if (!mode.async) {
        return fail(new PromiseExecuteError(node, displayName(node)));
      }
      return Promise.resolve(produced).then(after, fail);
    }
    return after(produced);
  }

  function nestedMapFor(node: DefiniteNode): NodeMap {
    return buildNestedMap(map, node);
  }

  function finishRun(): GraphRunResult | Promise<GraphRunResult> {
    const output = map.graph.nodes.find((n) => n.typeId === OUTPUT_TYPE);
    if (!output) return snapshot();
    try {
      return thenish(
        resolveInputs(output, { useDefaults: false }),
        (resolved) => {
          values = resolved;
          return snapshot();
        },
      );
    } catch (err) {
      if (isAbortError(err) || err instanceof PromiseExecuteError) throw err;
      recordError(output, err);
      return snapshot();
    }
  }

  try {
    const started = finishRun();
    if (isThenable(started)) {
      if (!mode.async) {
        throw new Error("runGraph produced a Promise; use runGraphAsync");
      }
      return Promise.resolve(started).then(
        (result) => {
          throwIfAborted(mode.signal);
          return result;
        },
        (err) => {
          throwIfAborted(mode.signal);
          if (err instanceof PromiseExecuteError) throw err;
          const output = map.graph.nodes.find((n) => n.typeId === OUTPUT_TYPE);
          if (output) recordError(output, err);
          return snapshot();
        },
      );
    }
    return started;
  } catch (err) {
    if (isAbortError(err) || err instanceof PromiseExecuteError) throw err;
    const output = map.graph.nodes.find((n) => n.typeId === OUTPUT_TYPE);
    if (output) recordError(output, err);
    return snapshot();
  }
}

/**
 * Evaluate the graph as a function: supply values for the Input node's output
 * ports (keyed by port name) and receive the Output node's input port values.
 *
 * Uses pull-based recursive evaluation with per-node memoization and cycle detection.
 * Wired {@link ANY_TYPE} values are wrapped/unwrapped at the destination; invalid
 * envelopes assert on the receiving node.
 *
 * If any node returns a thenable, throws so callers use {@link runGraphAsync}.
 */
export function runGraph(map: NodeMap, inputs: Values = {}): GraphRunResult {
  const result = evaluateGraph(map, inputs, {
    async: false,
    signal: NEVER_ABORTED,
  });
  if (isThenable(result)) {
    throw new Error("runGraph produced a Promise; use runGraphAsync");
  }
  return result;
}

/**
 * Async pull-eval. Awaits thenable `execute` results before walking dependents.
 * Abort via {@link RunGraphAsyncOptions.signal}; aborted work is not recorded
 * as a node error.
 */
export function runGraphAsync(
  map: NodeMap,
  inputs: Values = {},
  opts: RunGraphAsyncOptions = {},
): Promise<GraphRunResult> {
  const signal = opts.signal ?? NEVER_ABORTED;
  throwIfAborted(signal);
  return Promise.resolve(
    evaluateGraph(map, inputs, {
      async: true,
      signal,
      skipIo: opts.skipIo,
      priorOutputs: opts.priorOutputs,
      onProgress: opts.onProgress,
    }),
  ).then((result) => {
    throwIfAborted(signal);
    return result;
  });
}
