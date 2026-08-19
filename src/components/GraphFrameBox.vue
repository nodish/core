<script setup lang="ts">
import { computed, inject, nextTick } from "vue";
import type { FrameId, GraphFrame, NodeMap } from "../store/model";
import { descendantNodeIds, FRAME_DEFAULT_COLOR } from "../store/graph/frames";
import { graphHistoryKey, rootMapKey } from "./historyKey";
import {
  HEADER_H,
  NODE_FONT_SIZE,
  NODE_PADDING_X,
  type Rect,
} from "./layout";

const nodeFontSize = `${NODE_FONT_SIZE}px`;
const nodePaddingX = `${NODE_PADDING_X}px`;
const headerHeight = `${HEADER_H}px`;

const history = inject(graphHistoryKey, null);
const rootMap = inject(rootMapKey, null);

const props = withDefaults(
  defineProps<{
    frame: GraphFrame;
    rect: Rect;
    map: NodeMap;
    zoom?: number;
    selected?: boolean;
    selectedFrameIds?: ReadonlySet<string>;
  }>(),
  { zoom: 1, selected: false },
);

const emit = defineEmits<{
  select: [id: string, shiftKey: boolean];
}>();

const color = computed(() => props.frame.color || FRAME_DEFAULT_COLOR);
const fill = computed(() => hexToRgba(color.value, 0.22));
const title = computed(() => props.frame.label || "Frame");

const DRAG_THRESHOLD = 4;

function onBoxPointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  ev.stopPropagation();
  emit("select", props.frame.id, ev.shiftKey);
}

function onHeaderPointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  ev.stopPropagation();

  const startX = ev.clientX;
  const startY = ev.clientY;
  const shiftKey = ev.shiftKey;
  const z = props.zoom;
  let dragging = false;
  let origins: { nodeId: string; x: number; y: number }[] | null = null;

  async function beginDrag() {
    if (history && rootMap) history.begin(rootMap.value);
    if (!shiftKey && !props.selectedFrameIds?.has(props.frame.id)) {
      emit("select", props.frame.id, false);
      await nextTick();
    }
    const graph = props.map.graph;
    const ids = new Set(descendantNodeIds(graph, props.frame.id));
    if (props.selectedFrameIds?.has(props.frame.id)) {
      for (const fid of props.selectedFrameIds) {
        for (const n of descendantNodeIds(graph, fid as FrameId)) ids.add(n);
      }
    }
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    origins = [...ids]
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ nodeId: n.id, x: n.location.x, y: n.location.y }));
  }

  function onMove(e: PointerEvent) {
    if (!dragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      void beginDrag();
      return;
    }
    if (!origins) return;
    const dx = (e.clientX - startX) / z;
    const dy = (e.clientY - startY) / z;
    const byId = new Map(props.map.graph.nodes.map((n) => [n.id, n]));
    for (const { nodeId, x, y } of origins) {
      const node = byId.get(nodeId);
      if (!node) continue;
      node.location.x = x + dx;
      node.location.y = y + dy;
    }
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (dragging) history?.end();
    if (!dragging) emit("select", props.frame.id, shiftKey);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(61, 90, 128, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
</script>

<template>
  <div
    class="frame"
    :class="{ selected }"
    :style="{
      left: rect.x + 'px',
      top: rect.y + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      background: fill,
    }"
    @pointerdown="onBoxPointerDown"
  >
    <div
      class="header"
      :style="{ background: color }"
      @pointerdown="onHeaderPointerDown"
    >
      <span class="title">{{ title }}</span>
    </div>
  </div>
</template>

<style scoped>
.frame {
  position: absolute;
  z-index: 0;
  box-sizing: border-box;
  border-radius: 4px;
  user-select: none;
  font-family: sans-serif;
}
.frame.selected {
  outline: 2px solid #f5a623;
  outline-offset: 0;
}
.header {
  height: v-bind(headerHeight);
  padding: 0 v-bind(nodePaddingX);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border-radius: 4px 4px 0 0;
  cursor: grab;
  font-size: v-bind(nodeFontSize);
  color: #fff;
}
.header:active {
  cursor: grabbing;
}
.title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}
</style>
