<script setup lang="ts">
defineProps<{
  modelValue: number;
  min: number;
  max: number;
  accentColor: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

function onInput(e: Event) {
  emit("update:modelValue", Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <label class="inspector-row">
    <span class="inspector-key">Width</span>
    <input
      class="inspector-slider"
      type="range"
      :min="min"
      :max="max"
      step="1"
      :value="modelValue"
      :style="{ accentColor }"
      @input="onInput"
    />
    <span class="inspector-slider-value">{{ modelValue }}</span>
  </label>
</template>

<style scoped>
.inspector-slider {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.inspector-slider-value {
  flex: none;
  width: 26px;
  text-align: right;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
</style>
