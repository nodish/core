<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
  }>(),
  { label: "Color" },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}
</script>

<template>
  <label class="inspector-row">
    <span class="inspector-key">{{ label }}</span>
    <input
      class="inspector-swatch"
      type="color"
      :value="modelValue"
      @input="onInput"
    />
  </label>
</template>
