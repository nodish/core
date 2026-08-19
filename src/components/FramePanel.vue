<script setup lang="ts">
import { computed, inject } from "vue";
import type { GraphFrame } from "../store/model";
import { FRAME_DEFAULT_COLOR } from "../store/graph/frames";
import { graphHistoryKey, rootMapKey } from "./historyKey";
import InspectorPanel from "./InspectorPanel.vue";
import InspectorColorField from "./inspector/InspectorColorField.vue";

const HEADER_COLOR = "#3a3f4b";

const history = inject(graphHistoryKey, null);
const rootMap = inject(rootMapKey, null);

const props = defineProps<{
  frames: GraphFrame[];
}>();

const emit = defineEmits<{
  dissolve: [];
}>();

const multi = computed(() => props.frames.length > 1);
const frame = computed(() => props.frames[0] ?? null);

const title = computed(() => {
  if (multi.value) return `${props.frames.length} frames`;
  return frame.value?.label || "Frame";
});

const effectiveColor = computed(
  () => frame.value?.color || FRAME_DEFAULT_COLOR,
);

function checkpoint() {
  if (history && rootMap) history.pushBefore(rootMap.value);
}

function onTitleUpdate(value: string) {
  const f = frame.value;
  if (!f || multi.value) return;
  checkpoint();
  f.label = value;
}

function onColorUpdate(value: string) {
  const f = frame.value;
  if (!f || multi.value) return;
  checkpoint();
  f.color = value;
}
</script>

<template>
  <InspectorPanel
    v-if="frame"
    class="frame-panel stacked-panel"
    :title="title"
    title-placeholder="Frame"
    :header-color="HEADER_COLOR"
    :static-title="multi"
    @update:title="onTitleUpdate"
  >
    <template #header-actions>
      <button
        class="inspector-icon-btn"
        type="button"
        title="Dissolve frame"
        @click="emit('dissolve')"
      >
        ×
      </button>
    </template>

    <InspectorColorField
      v-if="!multi"
      :model-value="effectiveColor"
      @update:model-value="onColorUpdate"
    />
  </InspectorPanel>
</template>

<style scoped>
.frame-panel.stacked-panel {
  position: static;
}
</style>
