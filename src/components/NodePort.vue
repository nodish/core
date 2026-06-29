<script setup lang="ts">
import { computed } from "vue";
import type { Port, PortTypeDefinition } from "../store/model";
import { effectiveWidget } from "../store/types/effectiveWidget";
import PortValueWidget from "./types/PortValueWidget.vue";
import { NODE_FONT_SIZE, portRowHeight } from "./layout";

const fontSize = `${NODE_FONT_SIZE}px`;

const props = withDefaults(
  defineProps<{
    port: Port;
    typeDef?: PortTypeDefinition;
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

const rowHeightPx = computed(() =>
  portRowHeight(props.port, props.typeDef),
);

const widget = computed(() => effectiveWidget(props.typeDef, props.port));

const placeholder = computed(() => {
  const label = props.typeDef?.label ?? props.port.type;
  return `${props.port.name} (${label})`;
});

const showEditable = computed(
  () =>
    props.widgetMode === "editable" ||
    (props.side === "in" && !!props.port.userOnly) ||
    (props.widgetMode === "auto" &&
      props.side === "in" &&
      !props.connected &&
      !props.port.multi),
);

const showReadonly = computed(() => props.widgetMode === "readonly");
const hasSocketIn = computed(() => props.side === "in" && !props.port.userOnly);
const showWidget = computed(() => showEditable.value || showReadonly.value);

const valueMode = computed((): "editable" | "readonly" =>
  showReadonly.value ? "readonly" : "editable",
);

function onValueUpdate(value: unknown) {
  props.port.value = value;
  emit("valueChange", props.port);
}

function onCommit() {
  if (props.typeDef?.coerce) {
    props.port.value = props.typeDef.coerce(props.port.value);
    emit("valueChange", props.port);
  }
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
      :title="port.multi ? `${port.name} (accepts many)` : port.name"
      @pointerdown.stop="onSocketDown"
    />

    <PortValueWidget
      v-if="showWidget"
      :port="port"
      :type-def="typeDef"
      :effective-widget="widget"
      :mode="valueMode"
      :display-value="displayValue"
      :placeholder="placeholder"
      @update:value="onValueUpdate"
      @commit="onCommit"
    />
    <span v-else class="label">{{ port.name }}</span>

    <span
      v-if="side === 'out'"
      class="socket"
      :style="{ background: color }"
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
.port.in .socket {
  margin-left: -5px;
}
.port.in.no-socket {
  padding-left: 6.5px;
}
.port.out .socket {
  margin-right: -5px;
}
</style>
