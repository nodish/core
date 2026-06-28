import type { NodePack } from "../registry";
import { defaultNodes } from "../nodes";
import { defaultTypes } from "../types";

export const CORE_PACK_ID = "@local/core";

export const corePack: NodePack = {
  id: CORE_PACK_ID,
  types: defaultTypes,
  nodeTypes: defaultNodes,
};
