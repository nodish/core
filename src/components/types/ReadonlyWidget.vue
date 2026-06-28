<script setup lang="ts">
import { computed } from "vue";
import type {
  Port,
  PortTypeDefinition,
  TypeWidgetSpec,
} from "../../store/model";

const props = defineProps<{
  port: Port;
  typeDef?: PortTypeDefinition;
  effectiveWidget?: TypeWidgetSpec;
  displayValue?: unknown;
}>();

const text = computed(() => {
  const v =
    props.displayValue !== undefined ? props.displayValue : props.port.value;
  if (v === undefined || v === null || v === "") return "—";
  if (props.typeDef?.format) return props.typeDef.format(v);
  return String(v);
});
</script>

<template>
  <span class="field readonly" :title="port.name">{{ text }}</span>
</template>

<style scoped>
.field {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 16px;
  line-height: 16px;
  padding: 1px 4px;
  font: inherit;
  border: 1px solid transparent;
  background: #252830;
  color: #b8c0cc;
  border-radius: 3px;
  cursor: default;
  user-select: text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
