<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    divided?: boolean;
  }>(),
  { divided: true },
);
</script>

<template>
  <div class="inspector-section" :class="{ divided }">
    <div class="inspector-section-header">
      <span class="inspector-section-title">{{ title }}</span>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.inspector-section {
  user-select: text;
}
.inspector-section.divided {
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.inspector-section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.inspector-section-title {
  flex: 1;
  opacity: 0.85;
  font-size: 11px;
  line-height: 1;
}
</style>
