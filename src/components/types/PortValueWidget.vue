<script setup lang="ts">
import type {
  Port,
  PortTypeDefinition,
  TypeWidgetSpec,
} from "../../store/model";
import { resolveTypeWidget } from "./registry";

const props = defineProps<{
  port: Port;
  typeDef?: PortTypeDefinition;
  effectiveWidget?: TypeWidgetSpec;
  mode: "editable" | "readonly";
  displayValue?: unknown;
  placeholder: string;
}>();

const emit = defineEmits<{
  "update:value": [value: unknown];
  commit: [];
}>();

const widget = resolveTypeWidget(
  props.typeDef,
  props.effectiveWidget,
  props.mode,
);
</script>

<template>
  <component
    :is="widget"
    class="field-widget"
    :port="port"
    :type-def="typeDef"
    :effective-widget="effectiveWidget"
    :display-value="displayValue"
    :placeholder="placeholder"
    @update:value="emit('update:value', $event)"
    @commit="emit('commit')"
  />
</template>

<style scoped>
.field-widget {
  flex: 1;
  min-width: 0;
}
</style>
