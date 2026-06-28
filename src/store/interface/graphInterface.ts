import type {
  DefiniteNode,
  GraphInterface,
  GraphPortSpec,
  NodeMap,
} from "../model";
import { clonePlain } from "../utils/clonePlain";
import { expandIO } from "../graph/expandIO";

export const PORT_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateGraphInterface(
  map: NodeMap,
  iface: GraphInterface,
): string[] {
  const errors: string[] = [];
  const checkSide = (
    side: Record<string, GraphPortSpec> | undefined,
    label: string,
  ) => {
    const names = new Set<string>();
    for (const [name, spec] of Object.entries(side ?? {})) {
      if (!PORT_NAME_RE.test(name)) {
        errors.push(`${label}: invalid port name "${name}"`);
      }
      if (names.has(name)) {
        errors.push(`${label}: duplicate port name "${name}"`);
      }
      names.add(name);
      if (!map.types[spec.type]) {
        errors.push(`${label}: unknown type "${spec.type}" on port "${name}"`);
      }
    }
  };
  checkSide(iface.parameters, "parameters");
  checkSide(iface.returns, "returns");
  return errors;
}

export function cloneGraphInterface(iface: GraphInterface): GraphInterface {
  return clonePlain(iface);
}

export function uniquePortName(
  existing: Record<string, GraphPortSpec> | undefined,
  base = "input",
): string {
  const keys = new Set(Object.keys(existing ?? {}));
  if (!keys.has(base)) return base;
  let i = 2;
  while (keys.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function addParameter(
  iface: GraphInterface,
  name?: string,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  const key = name ?? uniquePortName(next.parameters, "input");
  next.parameters = {
    ...next.parameters,
    [key]: { type: "number", defaultValue: 0 },
  };
  return next;
}

export function addReturn(
  iface: GraphInterface,
  name?: string,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  const key = name ?? uniquePortName(next.returns, "output");
  next.returns = {
    ...next.returns,
    [key]: { type: "number" },
  };
  return next;
}

export function removeParameter(
  iface: GraphInterface,
  name: string,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  if (next.parameters) {
    const { [name]: _, ...rest } = next.parameters;
    next.parameters = Object.keys(rest).length ? rest : undefined;
  }
  return next;
}

export function removeReturn(
  iface: GraphInterface,
  name: string,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  if (next.returns) {
    const { [name]: _, ...rest } = next.returns;
    next.returns = Object.keys(rest).length ? rest : undefined;
  }
  return next;
}

export function renameParameter(
  iface: GraphInterface,
  oldName: string,
  newName: string,
): GraphInterface {
  if (oldName === newName) return iface;
  const spec = iface.parameters?.[oldName];
  if (!spec) return iface;
  const next = removeParameter(iface, oldName);
  next.parameters = { ...next.parameters, [newName]: spec };
  return next;
}

export function renameReturn(
  iface: GraphInterface,
  oldName: string,
  newName: string,
): GraphInterface {
  if (oldName === newName) return iface;
  const spec = iface.returns?.[oldName];
  if (!spec) return iface;
  const next = removeReturn(iface, oldName);
  next.returns = { ...next.returns, [newName]: spec };
  return next;
}

export function setParameterSpec(
  iface: GraphInterface,
  name: string,
  spec: GraphPortSpec,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  next.parameters = { ...next.parameters, [name]: spec };
  return next;
}

export function setReturnSpec(
  iface: GraphInterface,
  name: string,
  spec: GraphPortSpec,
): GraphInterface {
  const next = cloneGraphInterface(iface);
  next.returns = { ...next.returns, [name]: spec };
  return next;
}

export interface UpdateGraphInterfaceOptions {
  /** When editing a nested graph, sync ports on the parent composite instance. */
  ownerComposite?: DefiniteNode;
  parentMap?: NodeMap;
}

// Re-export for callers that need to expand interface specs into port defs.
export { expandIO };
