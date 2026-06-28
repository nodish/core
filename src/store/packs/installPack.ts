import type { NodeMap } from "../model";
import {
  type NodePack,
  type PackSetupContext,
  registerNodePack,
} from "../registry";

export type { NodePack, PackSetupContext } from "../registry";

export function installPack(
  map: NodeMap,
  pack: NodePack,
  setupCtx?: PackSetupContext,
): string[] {
  if (map.extensions.includes(pack.id)) {
    return [];
  }

  const errors: string[] = [];
  if (pack.types) {
    for (const id of Object.keys(pack.types)) {
      if (map.types[id]) {
        errors.push(`type "${id}" already registered by another pack`);
      }
    }
  }
  if (pack.nodeTypes) {
    for (const id of Object.keys(pack.nodeTypes)) {
      if (map.nodeTypes[id]) {
        errors.push(`node type "${id}" already registered by another pack`);
      }
    }
  }
  if (errors.length) return errors;

  registerNodePack(map, pack);
  if (setupCtx) {
    pack.setup?.(setupCtx);
  }
  return [];
}
