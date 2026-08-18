import type {
  DefiniteNode,
  IndefiniteNode,
  NodeMap,
  Port,
  PortDefinition,
  PortRef,
} from "../model";
import { portAccepts } from "./connect";
import { portTypes } from "./portTypes";

type PortLike = Pick<Port | PortDefinition, "type" | "types" | "userOnly"> & {
  autoConnect?: Port["autoConnect"];
};

function asInput(port: PortLike): Port {
  return port as Port;
}

/** Whether `output`-like `from` may wire into `input`-like `to`. */
function canFlow(map: NodeMap, from: PortLike, to: PortLike): boolean {
  if (to.userOnly) return false;
  return portTypes(from).some((t) => portAccepts(map, t, asInput(to)));
}

/**
 * True if `def` has an opposite-side, non-userOnly port compatible with
 * `fromPort` (the dragged socket).
 */
export function nodeAcceptsDrop(
  map: NodeMap,
  def: IndefiniteNode,
  fromPort: Port,
): boolean {
  if (fromPort.direction === "output") {
    return Object.values(def.inputs).some((p) => canFlow(map, fromPort, p));
  }
  return Object.values(def.outputs).some((p) => canFlow(map, p, fromPort));
}

function autoConnectScore(fromType: string, port: PortLike): number {
  const hint = port.autoConnect;
  let score = (hint?.priority ?? 0) * 1_000_000;
  if (hint?.types?.includes(fromType)) score += 1000;
  if (port.type === fromType) score += 100;
  if (port.types?.includes(fromType)) score += 10;
  return score;
}

/**
 * Best opposite-side port on `node` for a drop-to-add from `fromRef`.
 * Ties keep declaration order.
 */
export function pickAutoConnectPort(
  map: NodeMap,
  node: DefiniteNode,
  fromRef: PortRef,
  fromDir: Port["direction"],
): PortRef | null {
  const fromNode = map.graph.nodes.find((n) => n.id === fromRef.node);
  const fromPort =
    fromDir === "output"
      ? fromNode?.outputs[fromRef.port]
      : fromNode?.inputs[fromRef.port];
  if (!fromPort) return null;

  const candidates =
    fromDir === "output"
      ? Object.values(node.inputs)
      : Object.values(node.outputs);

  let best: Port | null = null;
  let bestScore = -Infinity;
  for (const port of candidates) {
    const ok =
      fromDir === "output"
        ? canFlow(map, fromPort, port)
        : canFlow(map, port, fromPort);
    if (!ok) continue;
    const score = autoConnectScore(fromPort.type, port);
    if (score > bestScore) {
      bestScore = score;
      best = port;
    }
  }
  return best ? { node: node.id, port: best.id } : null;
}
