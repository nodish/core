<script setup lang="ts">
import { computed } from "vue";
import type {
  DefiniteNode,
  GraphInterface,
  IndefiniteNode,
  NodeMap,
} from "../store/model";
import { INPUT_TYPE, OUTPUT_TYPE } from "../store/nodes/io";
import GraphInterfacePanel from "./GraphInterfacePanel.vue";
import InspectorPanel from "./InspectorPanel.vue";
import InspectorColorField from "./inspector/InspectorColorField.vue";
import InspectorError from "./inspector/InspectorError.vue";
import InspectorPositionField from "./inspector/InspectorPositionField.vue";
import InspectorWidthField from "./inspector/InspectorWidthField.vue";
import type { InterfaceMutator } from "../store/interface/editor";
import { NODE_MAX_WIDTH, NODE_MIN_WIDTH, NODE_WIDTH } from "./layout";

const HEADER_COLOR = "#3a3f4b";

const props = defineProps<{
  map: NodeMap;
  nodes: DefiniteNode[];
  def: IndefiniteNode | null;
  error?: string;
  graphInterface: GraphInterface;
  interfaceRevision: number;
  interfaceCommitError?: string;
  applyInterfaceMutation: (mutate: InterfaceMutator) => string[];
}>();

const emit = defineEmits<{
  "update:label": [value: string];
}>();

const multi = computed(() => props.nodes.length > 1);
const node = computed(() => props.nodes[0] ?? null);

const interfaceMode = computed<"parameters" | "returns" | null>(() => {
  if (multi.value || !node.value) return null;
  if (node.value.typeId === INPUT_TYPE) return "parameters";
  if (node.value.typeId === OUTPUT_TYPE) return "returns";
  return null;
});

const typeIds = computed(() =>
  Object.keys(props.map.types).sort((a, b) => a.localeCompare(b)),
);

const labelPlaceholder = computed(
  () => props.def?.displayName ?? node.value?.typeId ?? "",
);
const title = computed(() => {
  if (multi.value) return `${props.nodes.length} nodes`;
  const n = node.value;
  if (!n) return "";
  return n.label || props.def?.displayName || n.typeId;
});
const effectiveColor = computed(() => {
  const n = node.value;
  if (!n) return "#3a3f4b";
  return n.color ?? props.def?.color ?? "#3a3f4b";
});
const effectiveWidth = computed(() => node.value?.width ?? NODE_WIDTH);

const avgX = computed(() => {
  if (!props.nodes.length) return 0;
  const sum = props.nodes.reduce((s, n) => s + n.location.x, 0);
  return Math.round(sum / props.nodes.length);
});
const avgY = computed(() => {
  if (!props.nodes.length) return 0;
  const sum = props.nodes.reduce((s, n) => s + n.location.y, 0);
  return Math.round(sum / props.nodes.length);
});

function onTitleUpdate(value: string) {
  const n = node.value;
  if (!n) return;
  n.label = value;
  emit("update:label", value);
}

function onColorUpdate(value: string) {
  const n = node.value;
  if (!n) return;
  n.color = value;
}

function onWidthUpdate(value: number) {
  const n = node.value;
  if (!n) return;
  n.width = value;
}

function onXUpdate(target: number) {
  const delta = target - avgX.value;
  for (const n of props.nodes) n.location.x += delta;
}

function onYUpdate(target: number) {
  const delta = target - avgY.value;
  for (const n of props.nodes) n.location.y += delta;
}
</script>

<template>
  <InspectorPanel
    v-if="node"
    class="node-panel"
    :title="title"
    :title-placeholder="labelPlaceholder"
    :header-color="HEADER_COLOR"
    :static-title="multi"
    @update:title="onTitleUpdate"
  >
    <InspectorColorField
      v-if="!multi"
      :model-value="effectiveColor"
      @update:model-value="onColorUpdate"
    />

    <InspectorPositionField
      :x="avgX"
      :y="avgY"
      @update:x="onXUpdate"
      @update:y="onYUpdate"
    />

    <InspectorWidthField
      v-if="!multi"
      :model-value="effectiveWidth"
      :min="NODE_MIN_WIDTH"
      :max="NODE_MAX_WIDTH"
      :accent-color="effectiveColor"
      @update:model-value="onWidthUpdate"
    />

    <InspectorError v-if="error && !multi" :message="error" />

    <GraphInterfacePanel
      v-if="interfaceMode"
      :graph-interface="graphInterface"
      :mode="interfaceMode"
      :revision="interfaceRevision"
      :type-ids="typeIds"
      :types="map.types"
      :commit-error="interfaceCommitError"
      :apply-mutation="applyInterfaceMutation"
    />
  </InspectorPanel>
</template>

<style scoped>
.node-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}
.node-panel.stacked-panel {
  position: static;
  top: auto;
  right: auto;
}
</style>
