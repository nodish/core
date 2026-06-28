<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <p class="inspector-error">{{ message }}</p>
</template>

<style scoped>
.inspector-error {
  font-size: 10px;
  padding: 4px;
  margin: 0;
  font-family: monospace;
  color: #ffb4b4;
  background: rgba(229, 57, 53, 0.15);
}
</style>
