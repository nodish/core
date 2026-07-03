<script setup lang="ts">
import { computed } from "vue";
import type {
  Port,
  PortTypeDefinition,
  TypeWidgetSpec,
} from "../../store/model";
import { effectiveWidget } from "../../store/types/effectiveWidget";
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

const widgetSpec = computed(() =>
  effectiveWidget(props.typeDef, props.port),
);

const widget = computed(() =>
  resolveTypeWidget(
    props.typeDef,
    widgetSpec.value,
    props.mode,
    props.port,
  ),
);

const widgetKey = computed(() => {
  const w = widgetSpec.value;
  const portType = props.port.type;
  if (props.mode === "readonly") return `readonly:${portType}`;
  if (w?.kind === "custom") return `${portType}:custom:${w.componentId}`;
  return `${portType}:${w?.kind ?? "text"}`;
});
</script>

<template>
  <component
    :is="widget"
    :key="widgetKey"
    class="field-widget"
    :port="port"
    :type-def="typeDef"
    :effective-widget="widgetSpec"
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
