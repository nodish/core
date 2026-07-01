import { registerDefaultTypeWidgets } from "../components/types/registerDefaultTypeWidgets";
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
 * Registers built-in `number`/`string` widgets on first call (for packs that
 * use those conventional type ids).
 */
export function createNodeMap(init: CreateNodeMapInit = {}) {
  if (!defaultWidgetsRegistered) {
    registerDefaultTypeWidgets();
    defaultWidgetsRegistered = true;
  }

  const map = createNodeMapBase(init);
  attachLoadPack(map);

  for (const pack of init.packs ?? []) {
    map.loadPack(pack);
  }

  return map;
}
