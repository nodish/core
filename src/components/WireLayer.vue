<script setup lang="ts">
import { computed } from "vue";
import type { DefiniteNode, NodeMap } from "../store/model";
import {
  portPosition,
  type PortTypeLookup,
  wirePath,
} from "./layout";

const props = defineProps<{
  map: NodeMap;
  // Live "rubber-band" wire while dragging a new connection.
  pendingPath?: string | null;
  // Slice trail while right-drag cutting connections.
  slicePath?: string | null;
}>();

const portTypeLookup: PortTypeLookup = (port) => props.map.types[port.type];

const nodesById = computed(() => {
  const m: Record<string, DefiniteNode> = {};
  for (const n of props.map.graph.nodes) m[n.id] = n;
  return m;
});

const wires = computed(() =>
  props.map.graph.connections
    .map((c) => {
      const fromNode = nodesById.value[c.from.node];
      const toNode = nodesById.value[c.to.node];
      if (!fromNode || !toNode) return null;
      const a = portPosition(fromNode, c.from.port, portTypeLookup);
      const b = portPosition(toNode, c.to.port, portTypeLookup);
      if (!a || !b) return null;
      return { id: c.id, d: wirePath(a, b) };
    })
    .filter((w): w is { id: string; d: string } => w !== null),
);
</script>

<template>
  <svg class="wires">
    <path v-for="w in wires" :key="w.id" :d="w.d" />
    <path v-if="pendingPath" class="pending" :d="pendingPath" />
    <path v-if="slicePath" class="slice" :d="slicePath" />
  </svg>
</template>

<style scoped>
.wires {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 0; /* always behind nodes (which use z-index from stacking) */
}
.wires path {
  fill: none;
  stroke: #aaa;
  stroke-width: 2;
}
.wires path.pending {
  stroke: #ddd;
  stroke-dasharray: 5 4;
}
.wires path.slice {
  stroke: #e5484d;
  stroke-width: 1.5;
}
</style>
