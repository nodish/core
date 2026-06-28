<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function onChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="inspector-row inspector-check">
    <span class="inspector-key">{{ label }}</span>
    <input type="checkbox" :checked="modelValue" @change="onChange" />
  </label>
</template>

<style scoped>
.inspector-check {
  cursor: pointer;
}
</style>
