<script setup lang="ts">
import { computed } from "vue";
import type {
  Port,
  PortTypeDefinition,
  TypeWidgetSpec,
} from "../../store/model";

const props = defineProps<{
  port: Port;
  typeDef?: PortTypeDefinition;
  effectiveWidget?: TypeWidgetSpec;
  placeholder: string;
}>();

const emit = defineEmits<{
  "update:value": [value: unknown];
  commit: [];
}>();

const displayValue = computed((): string => {
  const v = props.port.value;
  if (v !== undefined && v !== null && v !== "") return String(v);
  return "";
});

const multiline = computed(
  () =>
    props.effectiveWidget?.kind === "text" &&
    (props.effectiveWidget.rows ?? 1) > 1,
);

const textareaRows = computed(() =>
  props.effectiveWidget?.kind === "text"
    ? (props.effectiveWidget.rows ?? 1)
    : 1,
);

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
  const parsed = props.typeDef?.parse?.(raw) ?? raw;
  emit("update:value", parsed);
}

function onCommit(e: Event) {
  onInput(e);
  emit("commit");
}
</script>

<template>
  <textarea
    v-if="multiline"
    class="field multiline"
    :value="displayValue"
    :placeholder="placeholder"
    :title="port.name"
    :rows="textareaRows"
    @input="onInput"
    @change="onCommit"
    @pointerdown.stop
  />
  <input
    v-else
    class="field"
    type="text"
    :value="displayValue"
    :placeholder="placeholder"
    :title="port.name"
    @input="onInput"
    @change="onCommit"
    @pointerdown.stop
  />
</template>

<style scoped>
.field {
  width: 100%;
  box-sizing: border-box;
  min-height: 16px;
  line-height: 16px;
  padding: 1px 4px;
  font: inherit;
  color: #eee;
  background: #1c1f25;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
}
.field.multiline {
  height: 100%;
  min-height: 0;
  resize: none;
  line-height: 1.3;
}
</style>
