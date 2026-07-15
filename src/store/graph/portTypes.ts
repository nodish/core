import type {
  Port,
  PortDefinition,
  PortTypeDefinition,
  PortTypeId,
} from "../model";
import { effectiveWidget } from "../types/effectiveWidget";

/** Accepted types for a port. Falls back to `[port.type]` when `types` is omitted. */
export function portTypes(
  port: Pick<Port | PortDefinition, "type" | "types">,
): PortTypeId[] {
  return port.types ?? [port.type];
}

/** True when the port accepts more than one type. */
export function isUnionPort(
  port: Pick<Port | PortDefinition, "type" | "types">,
): boolean {
  return portTypes(port).length > 1;
}

/**
 * Ports with no inline editor when disconnected: explicit
 * {@link Port.connectionOnly}, or type widget `kind: "none"`.
 * Union ports may show a widget for the primary {@link Port.type} unless
 * marked connection-only.
 */
export function isConnectionOnly(
  port: Pick<Port | PortDefinition, "type" | "types" | "connectionOnly">,
  typeDef?: PortTypeDefinition,
): boolean {
  if (port.connectionOnly) return true;
  if (typeDef && effectiveWidget(typeDef, port as Port)?.kind === "none") {
    return true;
  }
  return false;
}
