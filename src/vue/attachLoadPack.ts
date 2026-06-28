import {
  registerComponentWidget,
  registerTypeWidget,
} from "../components/types/registry";
import type { NodeMap } from "../store/model";
import type { PackSetupContext } from "../store/registry";
import { installPack } from "../store/packs/installPack";

function createWidgetSetupContext(): PackSetupContext {
  return {
    registerTypeWidget,
    registerComponentWidget,
  };
}

export function attachLoadPack(map: NodeMap): void {
  map.loadPack = (pack) => installPack(map, pack, createWidgetSetupContext());
}
