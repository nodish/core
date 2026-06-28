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

const displayValue = computed(() => {
  const v = props.port.value;
  if (v !== undefined && v !== null && v !== "") return v;
  return "";
});

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const parsed = props.typeDef?.parse?.(raw) ?? raw;
  emit("update:value", parsed);
}

function onCommit(e: Event) {
  onInput(e);
  emit("commit");
}
</script>

<template>
  <input
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
</style>
