import type { Port, PortDefinition, PortTypeId } from "../model";

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

/** Union ports are connection-only — no inline value editor when disconnected. */
export function isConnectionOnly(
  port: Pick<Port | PortDefinition, "type" | "types">,
): boolean {
  return isUnionPort(port);
}
