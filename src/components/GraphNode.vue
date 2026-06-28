<script setup lang="ts">
import { computed, nextTick } from "vue";
import type { DefiniteNode, NodeMap, Port, PortRef } from "../store/model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../store/nodes/io";
import type { Values } from "../store/graph/evaluate";
import { reconcilePorts } from "../store/graph/dynamicPorts";
import { isCompositeNode } from "../store/composite";
import NodePort from "./NodePort.vue";
import {
  HEADER_H,
  NODE_FONT_SIZE,
  NODE_PADDING_X,
  nodeHeight,
  nodeWidth,
} from "./layout";

const nodeFontSize = `${NODE_FONT_SIZE}px`;
const nodePaddingX = `${NODE_PADDING_X}px`;

const props = withDefaults(
  defineProps<{
    node: DefiniteNode;
    map: NodeMap;
    zoom?: number;
    ioWidgets?: boolean;
    ioResults?: Values;
    selected?: boolean;
    selectedIds?: ReadonlySet<string>;
    error?: string;
  }>(),
  { ioWidgets: false, zoom: 1, selected: false },
);

const emit = defineEmits<{
  connectStart: [ref: PortRef, port: Port, ev: PointerEvent];
  select: [id: string, shiftKey: boolean];
  drillIn: [id: string];
}>();

function onConnectStart(port: Port, ev: PointerEvent) {
  emit("connectStart", { node: props.node.id, port: port.id }, port, ev);
}

// Editing a user-only input may change how many ports this node has.
function onValueChange(port: Port) {
  if (port.userOnly) reconcilePorts(props.map, props.node);
}

function onHeaderDblClick(ev: MouseEvent) {
  ev.stopPropagation();
  if (isCompositeNode(props.node)) {
    emit("drillIn", props.node.id);
  }
}

// Left-click anywhere on the node selects it. Stop propagation so the viewer's
// background handler doesn't immediately deselect. Other buttons bubble through
// (so panning/slicing that begins over a node still works).
function onNodePointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  ev.stopPropagation();
  emit("select", props.node.id, ev.shiftKey);
}

const def = computed(() => props.map.nodeTypes[props.node.typeId]);
const title = computed(
  () => props.node.label || def.value?.displayName || props.node.typeId,
);
const headerColor = computed(
  () => props.node.color ?? def.value?.color ?? "#3a3f4b",
);
const width = computed(() => nodeWidth(props.node));

const inputs = computed(() => Object.values(props.node.inputs));
const outputs = computed(() => Object.values(props.node.outputs));

// Output column only needs extra width when IO widgets sit on output ports.
const outputColumnWide = computed(
  () => props.ioWidgets && props.node.typeId === INPUT_TYPE,
);

const connectedInputs = computed(() => {
  const ids = new Set<string>();
  for (const c of props.map.graph.connections) {
    if (c.to.node === props.node.id) ids.add(c.to.port);
  }
  return ids;
});

function portColor(type: string): string {
  return props.map.types[type]?.color ?? "#888";
}

function typeDefFor(port: Port) {
  return props.map.types[port.type];
}

type WidgetMode = "auto" | "editable" | "readonly";

function widgetMode(side: "in" | "out"): WidgetMode {
  if (!props.ioWidgets) return "auto";
  if (props.node.typeId === INPUT_TYPE && side === "out") return "editable";
  if (props.node.typeId === OUTPUT_TYPE && side === "in") return "readonly";
  return "auto";
}

const DRAG_THRESHOLD = 4;

function onHeaderPointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  ev.stopPropagation();

  const startX = ev.clientX;
  const startY = ev.clientY;
  const shiftKey = ev.shiftKey;
  const z = props.zoom;
  let dragging = false;
  let origins: { node: DefiniteNode; x: number; y: number }[] | null = null;

  async function beginDrag() {
    if (!shiftKey && !props.selectedIds?.has(props.node.id)) {
      emit("select", props.node.id, false);
      await nextTick();
    }
    const ids = props.selectedIds ?? new Set([props.node.id]);
    const dragNodes =
      ids.size > 1 && ids.has(props.node.id)
        ? props.map.graph.nodes.filter((n) => ids.has(n.id))
        : [props.node];
    origins = dragNodes.map((n) => ({
      node: n,
      x: n.location.x,
      y: n.location.y,
    }));
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
    for (const { node, x, y } of origins) {
      node.location.x = x + dx;
      node.location.y = y + dy;
    }
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!dragging) {
      emit("select", props.node.id, shiftKey);
    }
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
</script>

<template>
  <div
    class="node"
    :class="{ selected, errored: !!error }"
    :style="{
      left: node.location.x + 'px',
      top: node.location.y + 'px',
      width: width + 'px',
      height: nodeHeight(node) + 'px',
      zIndex: node.z ?? 0,
    }"
    @pointerdown="onNodePointerDown"
  >
    <div v-if="error" class="error-ring" :title="error" />

    <div
      class="header"
      :style="{ background: headerColor, height: HEADER_H + 'px' }"
      @pointerdown="onHeaderPointerDown"
      @dblclick="onHeaderDblClick"
    >
      <span class="title">{{ title }}</span>
      <div class="grip" title="Drag">
        <span v-for="i in 6" :key="i" class="dot" />
      </div>
    </div>

    <div class="body">
      <div v-if="inputs.length" class="col input">
        <NodePort
          v-for="port in inputs"
          :key="port.id"
          :port="port"
          :type-def="typeDefFor(port)"
          :color="portColor(port.type)"
          side="in"
          :connected="connectedInputs.has(port.id)"
          :widget-mode="widgetMode('in')"
          :display-value="ioResults?.[port.name]"
          @connect-start="onConnectStart"
          @value-change="onValueChange"
        />
      </div>
      <div
        v-if="outputs.length"
        class="col output"
        :class="{ wide: outputColumnWide }"
      >
        <NodePort
          v-for="port in outputs"
          :key="port.id"
          :port="port"
          :type-def="typeDefFor(port)"
          :color="portColor(port.type)"
          side="out"
          :widget-mode="widgetMode('out')"
          @connect-start="onConnectStart"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.node {
  position: absolute;
  border-radius: 4px;
  background: #2a2d34;
  color: #eee;
  font-family: sans-serif;
  font-size: v-bind(nodeFontSize);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  user-select: none;
  isolation: isolate;
}
.node.selected {
  outline: 2px solid #f5a623;
  outline-offset: 0px;
}
.node.errored .error-ring {
  position: absolute;
  inset: -4px;
  border: 4px solid #e5393555;
  border-radius: 6px;
  pointer-events: none;
  z-index: 0;
}
.node.errored > .header,
.node.errored > .body {
  position: relative;
  z-index: 1;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 0 2px 0 v-bind(nodePaddingX);
  box-sizing: border-box;
  border-radius: 4px 4px 0 0;
  cursor: grab;
}
.header:active {
  cursor: grabbing;
}
.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}
.grip {
  display: grid;
  grid-template-columns: repeat(3, 3px);
  grid-template-rows: repeat(2, 3px);
  gap: 1px;
  padding: 1px 3px;
  flex: none;
  pointer-events: none;
}
.dot {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
}
.body {
  display: flex;
  gap: 6px;
}
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.body > .col:only-child {
  flex: 1 1 0;
}
.body > .col.output:only-child {
  padding-left: v-bind(nodePaddingX);
}
.body > .col.input:only-child {
  padding-right: v-bind(nodePaddingX);
}
.input {
  flex: 1 1 0;
}
.output {
  flex: 0 0 auto;
}
.output.wide {
  flex: 1 1 0;
}
</style>
