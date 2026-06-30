<script setup lang="ts">
import type { Port, PortTypeDefinition } from "@nodish/core/pack";

defineProps<{
  port: Port;
  typeDef?: PortTypeDefinition;
  placeholder: string;
}>();

const emit = defineEmits<{
  "update:value": [value: unknown];
  commit: [];
}>();

function onChange(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked;
  emit("update:value", checked);
  emit("commit");
}
</script>

<template>
  <label class="bool" :title="port.name" @pointerdown.stop>
    <input
      type="checkbox"
      :checked="port.value === true"
      @change="onChange"
    />
    <span class="label">{{ port.name }}</span>
  </label>
</template>

<style scoped>
.bool {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}
.bool input {
  flex: none;
  margin: 0;
  accent-color: #86efac;
}
.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
