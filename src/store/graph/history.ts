import type { GraphDocument, NodeMap } from "../model";
import { applyDocument } from "./document";
import { clonePlain } from "../utils/clonePlain";

const DEFAULT_LIMIT = 50;

/** Serializable graph+interface snapshot used by undo/redo (no extensions). */
export type HistorySnapshot = {
  graph: GraphDocument["graph"];
  interface: GraphDocument["interface"];
};

export type GraphHistory = {
  /** Record current state before a discrete edit. No-op while coalescing. */
  pushBefore(map: NodeMap): void;
  /** Start a continuous gesture (one snapshot). Further pushes no-op until {@link end}. */
  begin(map: NodeMap): void;
  /** End a continuous gesture. */
  end(): void;
  undo(map: NodeMap): boolean;
  redo(map: NodeMap): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
};

function snapshot(map: NodeMap): HistorySnapshot {
  return {
    graph: clonePlain(map.graph),
    interface: clonePlain(map.graphInterface),
  };
}

function restore(map: NodeMap, snap: HistorySnapshot): void {
  applyDocument(map, {
    graph: snap.graph,
    interface: snap.interface,
  });
}

/**
 * In-memory undo/redo stack of full graph documents.
 * Call {@link GraphHistory.pushBefore} (or {@link GraphHistory.begin}) on the
 * **root** map before mutating.
 */
export function createGraphHistory(limit = DEFAULT_LIMIT): GraphHistory {
  const undoStack: HistorySnapshot[] = [];
  const redoStack: HistorySnapshot[] = [];
  let coalescing = false;

  function pushSnapshot(map: NodeMap): void {
    undoStack.push(snapshot(map));
    while (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
  }

  return {
    pushBefore(map) {
      if (coalescing) return;
      pushSnapshot(map);
    },
    begin(map) {
      if (coalescing) return;
      pushSnapshot(map);
      coalescing = true;
    },
    end() {
      coalescing = false;
    },
    undo(map) {
      const prev = undoStack.pop();
      if (!prev) return false;
      redoStack.push(snapshot(map));
      restore(map, prev);
      coalescing = false;
      return true;
    },
    redo(map) {
      const next = redoStack.pop();
      if (!next) return false;
      undoStack.push(snapshot(map));
      restore(map, next);
      coalescing = false;
      return true;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      coalescing = false;
    },
  };
}
