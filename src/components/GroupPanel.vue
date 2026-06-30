<script setup lang="ts">
import { computed } from "vue";
import type { DefiniteNode } from "../store/model";
import { compositeNode } from "../store/composite";
import InspectorPanel from "./InspectorPanel.vue";
import InspectorCheckboxField from "./inspector/InspectorCheckboxField.vue";
import InspectorColorField from "./inspector/InspectorColorField.vue";

const HEADER_COLOR = "#3a3f4b";

const props = defineProps<{
  composite: DefiniteNode | null;
  ioWidgets: boolean;
}>();

const emit = defineEmits<{
  up: [];
  "update:ioWidgets": [value: boolean];
}>();

const labelPlaceholder = computed(() => compositeNode.displayName);
const title = computed(
  () => props.composite?.label || compositeNode.displayName,
);
const effectiveColor = computed(
  () => props.composite?.color ?? compositeNode.color ?? HEADER_COLOR,
);

function onTitleUpdate(value: string) {
  const node = props.composite;
  if (!node) return;
  node.label = value;
}

function onColorUpdate(value: string) {
  const node = props.composite;
  if (!node) return;
  node.color = value;
}
</script>

<template>
  <InspectorPanel
    v-if="composite"
    :title="title"
    :title-placeholder="labelPlaceholder"
    :header-color="HEADER_COLOR"
    show-up
    @update:title="onTitleUpdate"
    @up="emit('up')"
  >
    <InspectorColorField
      :model-value="effectiveColor"
      @update:model-value="onColorUpdate"
    />
    <InspectorCheckboxField
      label="IO test"
      :model-value="ioWidgets"
      @update:model-value="emit('update:ioWidgets', $event)"
    />
  </InspectorPanel>
</template>
