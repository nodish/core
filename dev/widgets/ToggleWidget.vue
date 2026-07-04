<script setup lang="ts">
import type { Port, PortTypeDefinition } from "@nodish/core";

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
  <label class="toggle" :title="port.name" @pointerdown.stop>
    <input
      type="checkbox"
      class="toggle-input"
      :checked="port.value === true"
      @change="onChange"
    />
    <span class="toggle-track" aria-hidden="true" />
    <span class="label">{{ port.name }}</span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}
.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-track {
  width: 22px;
  height: 12px;
  border-radius: 6px;
  background: #3a3f4b;
  border: 1px solid rgba(0, 0, 0, 0.4);
  flex: none;
  position: relative;
}
.toggle-input:checked + .toggle-track {
  background: #86efac;
}
.toggle-input:checked + .toggle-track::after {
  content: "";
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}
.toggle-input:not(:checked) + .toggle-track::after {
  content: "";
  position: absolute;
  top: 1px;
  left: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
}
.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
