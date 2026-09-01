<script setup lang="ts">
import { computed, inject } from "vue";
import type { Port, PortTypeDefinition, TypeRegistry } from "../store/model";
import { isConnectionOnly, portTypes } from "../store/graph/portTypes";
import { effectiveWidget } from "../store/types/effectiveWidget";
import { graphHistoryKey, rootMapKey } from "./historyKey";
import PortValueWidget from "./types/PortValueWidget.vue";
import { NODE_FONT_SIZE, NODE_PADDING_X, portRowHeight } from "./layout";

const fontSize = `${NODE_FONT_SIZE}px`;
const padX = `${NODE_PADDING_X}px`;

const history = inject(graphHistoryKey, null);
const rootMap = inject(rootMapKey, null);
const props = withDefaults(
  defineProps<{
    port: Port;
    typeDef?: PortTypeDefinition;
    /** Type registry used for hover labels of accepted types. */
    types?: TypeRegistry;
    color: string;
    side: "in" | "out";
    connected?: boolean;
    widgetMode?: "auto" | "editable" | "readonly";
    displayValue?: unknown;
  }>(),
  { widgetMode: "auto", connected: false },
);

const emit = defineEmits<{
  connectStart: [port: Port, ev: PointerEvent];
  valueChange: [port: Port];
}>();

function onSocketDown(ev: PointerEvent) {
  if (ev.button !== 0) return;
  emit("connectStart", props.port, ev);
}

const rowHeightPx = computed(() => portRowHeight(props.port, props.typeDef));

const widget = computed(() => effectiveWidget(props.typeDef, props.port));

const displayName = computed(() => props.port.label || props.port.name);

const placeholder = computed(() => {
  const label = props.typeDef?.label ?? props.port.type;
  return `${displayName.value} (${label})`;
});

const acceptedTypeLabels = computed(() =>
  portTypes(props.port).map(
    (id) => props.types?.[id]?.label ?? props.typeDef?.label ?? id,
  ),
);

const socketTitle = computed(() => {
  const types = acceptedTypeLabels.value.join(", ");
  const lines = [`${displayName.value} - ${types}`];
  const portDoc = props.port.description?.trim();
  if (portDoc) lines.push(portDoc);
  const seen = new Set<string>();
  for (const id of portTypes(props.port)) {
    const typeDoc = props.types?.[id]?.description?.trim();
    if (typeDoc && !seen.has(typeDoc)) {
      seen.add(typeDoc);
      lines.push(typeDoc);
    }
  }
  return lines.join("\n");
});

const showEditable = computed(
  () =>
    !isConnectionOnly(props.port, props.typeDef) &&
    (props.widgetMode === "editable" ||
      (props.side === "in" && !!props.port.userOnly) ||
      (props.widgetMode === "auto" &&
        props.side === "in" &&
        !props.connected &&
        !props.port.multi)),
);

const showReadonly = computed(() => props.widgetMode === "readonly");
const hasSocketIn = computed(() => props.side === "in" && !props.port.userOnly);
const showWidget = computed(() => showEditable.value || showReadonly.value);

const valueMode = computed((): "editable" | "readonly" =>
  showReadonly.value ? "readonly" : "editable",
);

function onValueUpdate(value: unknown) {
  if (history && rootMap) history.begin(rootMap.value);
  props.port.value = value;
  emit("valueChange", props.port);
}

function onCommit() {
  if (props.typeDef?.coerce) {
    props.port.value = props.typeDef.coerce(props.port.value);
    emit("valueChange", props.port);
  }
  history?.end();
}
</script>

<template>
  <div
    class="port"
    :class="[
      side,
      {
        hasWidget: showWidget,
        'no-socket': side === 'in' && !hasSocketIn,
      },
    ]"
    :style="{ height: rowHeightPx + 'px' }"
  >
    <span
      v-if="hasSocketIn"
      class="socket"
      :class="{ multi: port.multi }"
      :style="{ background: color }"
      :title="socketTitle"
      @pointerdown.stop="onSocketDown"
    />

    <PortValueWidget
      v-if="showWidget"
      :key="`${port.id}-${port.type}`"
      :port="port"
      :type-def="typeDef"
      :effective-widget="widget"
      :mode="valueMode"
      :display-value="displayValue"
      :placeholder="placeholder"
      @update:value="onValueUpdate"
      @commit="onCommit"
    />
    <span v-else class="label" :title="socketTitle">{{ displayName }}</span>

    <span
      v-if="side === 'out'"
      class="socket"
      :style="{ background: color }"
      :title="socketTitle"
      @pointerdown.stop="onSocketDown"
    />
  </div>
</template>

<style scoped>
.port {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 100%;
  font-size: v-bind(fontSize);
  font-family: sans-serif;
}
.port.out {
  justify-content: flex-end;
}
.port.out.hasWidget {
  justify-content: flex-start;
}
.port.hasWidget :deep(.field) {
  flex: 1;
  min-width: 0;
}
.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 v-bind(padX);
}
.port.in .label {
  padding-left: 0;
}
.port.out .label {
  padding-right: 0;
}
.socket {
  width: 7.5px;
  height: 7.5px;
  border-radius: 50%;
  flex: none;
  cursor: crosshair;
  z-index: 1;
}
.socket:hover {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.25);
}
.socket.multi {
  border-radius: 0px;
}
.port.in {
  padding-left: 0;
  padding-right: v-bind(padX);
}
.port.in .socket {
  margin-left: -5px;
}
.port.in.no-socket {
  padding-left: 6.5px;
}
.port.out {
  padding-left: v-bind(padX);
  padding-right: 0;
}
.port.out .socket {
  margin-right: -5px;
}
</style>
