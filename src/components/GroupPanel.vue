<script setup lang="ts">
import { computed, inject } from "vue";
import type { DefiniteNode } from "../store/model";
import { compositeNode } from "../store/composite";
import { graphHistoryKey, rootMapKey } from "./historyKey";
import InspectorPanel from "./InspectorPanel.vue";
import InspectorCheckboxField from "./inspector/InspectorCheckboxField.vue";
import InspectorColorField from "./inspector/InspectorColorField.vue";

const HEADER_COLOR = "#3a3f4b";

const history = inject(graphHistoryKey, null);
const rootMap = inject(rootMapKey, null);

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

function checkpoint() {
  if (history && rootMap) history.pushBefore(rootMap.value);
}

function onTitleUpdate(value: string) {
  const node = props.composite;
  if (!node) return;
  checkpoint();
  node.label = value;
}

function onColorUpdate(value: string) {
  const node = props.composite;
  if (!node) return;
  checkpoint();
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
