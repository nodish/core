<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  "update:x": [value: number];
  "update:y": [value: number];
}>();

function num(e: Event): number {
  return Number((e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="inspector-row pair">
    <label>
      <span class="inspector-key">X</span>
      <input
        class="inspector-field"
        type="number"
        :value="x"
        @input="emit('update:x', num($event))"
      />
    </label>
    <label>
      <span class="inspector-key">Y</span>
      <input
        class="inspector-field"
        type="number"
        :value="y"
        @input="emit('update:y', num($event))"
      />
    </label>
  </div>
</template>
