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

const widget =
  props.effectiveWidget?.kind === "number"
    ? props.effectiveWidget
    : { kind: "number" as const };

const displayValue = computed(() => {
  const v = props.port.value;
  if (v !== undefined && v !== null && v !== "") return v;
  return "";
});

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const parsed = props.typeDef?.parse?.(raw) ?? Number(raw);
  emit("update:value", parsed);
}

function onCommit(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  let value: unknown = props.typeDef?.parse?.(raw) ?? Number(raw);
  if (props.typeDef?.coerce) value = props.typeDef.coerce(value);
  else if (widget.kind === "number") {
    const min = widget.min;
    const max = widget.max;
    let n = Number(value);
    if (Number.isNaN(n)) n = 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    value = n;
  }
  emit("update:value", value);
  emit("commit");
}
</script>

<template>
  <input
    class="field"
    type="number"
    :value="displayValue"
    :placeholder="placeholder"
    :title="port.name"
    :min="widget.kind === 'number' ? widget.min : undefined"
    :max="widget.kind === 'number' ? widget.max : undefined"
    :step="widget.kind === 'number' ? widget.step : undefined"
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
  color-scheme: dark;
}
.field::placeholder {
  color: rgba(238, 238, 238, 0.45);
}
</style>
