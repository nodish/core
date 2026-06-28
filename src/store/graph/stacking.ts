import type { NodeId, NodeMap } from "../model";

// Node stacking order ("height"). Higher z paints on top.
//
// `z` is kept as compact 1..N integers: selecting a node bumps it to top
// (maxZ + 1) and normalizeStackingOrder re-packs everything back down to 1..N.
// That keeps the numbers small and stops them from growing without bound.

// Highest z currently in use, or 0 when there are no nodes.
export function topZ(map: NodeMap): number {
  let max = 0;
  for (const n of map.graph.nodes) max = Math.max(max, n.z ?? 0);
  return max;
}

// Re-pack z values to 1..N preserving relative order, so repeated bring-to-front
// can't grow them without bound. Stable for ties (keeps array order).
export function normalizeStackingOrder(map: NodeMap): void {
  const sorted = map.graph.nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (a.n.z ?? 0) - (b.n.z ?? 0) || a.i - b.i);
  sorted.forEach((entry, rank) => {
    entry.n.z = rank + 1;
  });
}

// Ensure every node has a z. Nodes missing one get a random slot so the initial
// paint order is arbitrary but stable, then everything is packed to 1..N.
export function ensureStackingOrder(map: NodeMap): void {
  if (map.graph.nodes.length === 0) return;
  let assigned = false;
  for (const n of map.graph.nodes) {
    if (n.z === undefined) {
      n.z = Math.random();
      assigned = true;
    }
  }
  if (assigned) normalizeStackingOrder(map);
}

// Raise one node above all others. No-op if it is already on top.
export function bringToFront(map: NodeMap, id: NodeId): void {
  const node = map.graph.nodes.find((n) => n.id === id);
  if (!node) return;
  const max = topZ(map);
  if ((node.z ?? 0) >= max) return;
  node.z = max + 1;
}
