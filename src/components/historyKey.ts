import type { InjectionKey, Ref } from "vue";
import type { NodeMap } from "../store/model";
import type { GraphHistory } from "../store/graph/history";

/** Injected undo/redo controller (root map checkpoints). */
export const graphHistoryKey: InjectionKey<GraphHistory> = Symbol("graphHistory");

/**
 * Root {@link NodeMap} for history checkpoints. Nested `activeMap` aliases
 * mutate data inside this document.
 */
export const rootMapKey: InjectionKey<Ref<NodeMap>> = Symbol("rootMap");
