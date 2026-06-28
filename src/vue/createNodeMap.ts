import { registerDefaultTypeWidgets } from "../components/types/registerDefaultTypeWidgets";
import { corePack } from "../store/packs/core";
import {
  createNodeMapBase,
  type CreateNodeMapInit,
} from "../store/graph/createNodeMap";
import type { GraphDocument } from "../store/model";
import { attachLoadPack } from "./attachLoadPack";

export type { CreateNodeMapInit, GraphDocument };

let defaultWidgetsRegistered = false;

/**
 * Create an in-memory graph workspace with registries, boundary nodes, and
 * {@link NodeMap.loadPack} wired for widget setup.
 *
 * Loads the built-in core pack by default unless `defaultPack: false`.
 * Registers built-in number/string widgets on first call.
 */
export function createNodeMap(init: CreateNodeMapInit = {}) {
  if (!defaultWidgetsRegistered) {
    registerDefaultTypeWidgets();
    defaultWidgetsRegistered = true;
  }

  const map = createNodeMapBase(init);
  attachLoadPack(map);

  if (init.defaultPack !== false) {
    map.loadPack(corePack);
  }
  for (const pack of init.packs ?? []) {
    map.loadPack(pack);
  }

  return map;
}
