import type { NodeMap, PortTypeDefinition } from "../model";
import { normalizeNode, type NodeSpec } from "../registry/defineNode";
import {
  type NodePack,
  type PackSetupContext,
  registerNodePack,
} from "../registry";

export type { NodePack, PackSetupContext } from "../registry";

function entryPriority(pack: NodePack, specPriority?: number): number {
  return specPriority ?? pack.priority ?? 0;
}

function existingTypePriority(map: NodeMap, typeId: string): number {
  return map.registrationMeta.types[typeId]?.priority ?? 0;
}

function existingTypePack(map: NodeMap, typeId: string): string {
  return map.registrationMeta.types[typeId]?.packId ?? "unknown";
}

function existingNodePriority(map: NodeMap, typeId: string): number {
  return map.registrationMeta.nodeTypes[typeId]?.priority ?? 0;
}

function existingNodePack(map: NodeMap, typeId: string): string {
  return map.registrationMeta.nodeTypes[typeId]?.packId ?? "unknown";
}

function tryRegisterType(
  map: NodeMap,
  packId: string,
  priority: number,
  typeId: string,
  def: PortTypeDefinition,
): string | null {
  if (!map.types[typeId]) {
    map.types[typeId] = def;
    map.registrationMeta.types[typeId] = { packId, priority };
    return null;
  }

  const currentPriority = existingTypePriority(map, typeId);
  if (priority > currentPriority) {
    map.types[typeId] = def;
    map.registrationMeta.types[typeId] = { packId, priority };
    return null;
  }
  if (priority < currentPriority) return null;

  return `type "${typeId}" already registered by pack "${existingTypePack(map, typeId)}" with priority ${currentPriority}`;
}

function tryRegisterNodeType(
  map: NodeMap,
  packId: string,
  priority: number,
  typeId: string,
  spec: NodeSpec,
): string | null {
  if (!map.nodeTypes[typeId]) {
    map.nodeTypes[typeId] = normalizeNode(spec);
    map.registrationMeta.nodeTypes[typeId] = { packId, priority };
    return null;
  }

  const currentPriority = existingNodePriority(map, typeId);
  if (priority > currentPriority) {
    map.nodeTypes[typeId] = normalizeNode(spec);
    map.registrationMeta.nodeTypes[typeId] = { packId, priority };
    return null;
  }
  if (priority < currentPriority) return null;

  return `node type "${typeId}" already registered by pack "${existingNodePack(map, typeId)}" with priority ${currentPriority}`;
}

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
    for (const [id, def] of Object.entries(pack.types)) {
      const err = tryRegisterType(
        map,
        pack.id,
        entryPriority(pack, def.priority),
        id,
        def,
      );
      if (err) errors.push(err);
    }
  }

  if (pack.nodeTypes) {
    for (const [id, spec] of Object.entries(pack.nodeTypes)) {
      const err = tryRegisterNodeType(
        map,
        pack.id,
        entryPriority(pack, spec.priority),
        id,
        spec,
      );
      if (err) errors.push(err);
    }
  }

  if (errors.length) return errors;

  registerNodePack(map, pack);
  if (setupCtx) {
    pack.setup?.(setupCtx);
  }
  return [];
}
