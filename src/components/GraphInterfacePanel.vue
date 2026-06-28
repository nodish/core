<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  GraphInterface,
  GraphPortSpec,
  Port,
  TypeRegistry,
} from "../store/model";
import { PORT_NAME_RE } from "../store/interface/graphInterface";
import type { InterfaceMutator } from "../store/interface/editor";
import { effectiveWidget } from "../store/types/effectiveWidget";
import PortValueWidget from "./types/PortValueWidget.vue";
import InspectorSection from "./inspector/InspectorSection.vue";

const props = defineProps<{
  graphInterface: GraphInterface;
  mode: "parameters" | "returns";
  revision: number;
  typeIds: string[];
  types: TypeRegistry;
  commitError?: string;
  applyMutation: (mutate: InterfaceMutator) => string[];
}>();

const localError = ref("");
const defaultDrafts = ref<Record<string, unknown>>({});

const displayError = computed(
  () => props.commitError || localError.value || "",
);

const title = computed(() =>
  props.mode === "parameters" ? "Graph inputs" : "Graph outputs",
);

const isParameters = computed(() => props.mode === "parameters");

const entries = computed(() => {
  const side = isParameters.value
    ? props.graphInterface.parameters
    : props.graphInterface.returns;
  return Object.entries(side ?? {}).map(([name, spec]) => ({ name, spec }));
});

function defaultForType(typeId: string): unknown {
  return props.types[typeId]?.defaultValue;
}

function specDefault(_name: string, spec: GraphPortSpec): unknown {
  return spec.defaultValue !== undefined
    ? spec.defaultValue
    : defaultForType(spec.type);
}

function syncDefaultDrafts() {
  if (!isParameters.value) {
    defaultDrafts.value = {};
    return;
  }
  const next: Record<string, unknown> = {};
  for (const { name, spec } of entries.value) {
    next[name] = specDefault(name, spec);
  }
  defaultDrafts.value = next;
}

watch(
  () => props.revision,
  () => {
    localError.value = "";
    syncDefaultDrafts();
  },
);

watch(isParameters, syncDefaultDrafts, { immediate: true });

function run(mutate: InterfaceMutator) {
  localError.value = "";
  try {
    const errors = props.applyMutation(mutate);
    if (errors.length) localError.value = errors[0] ?? "Unknown error";
  } catch (err) {
    localError.value = err instanceof Error ? err.message : String(err);
  }
}

function defaultPort(name: string, spec: GraphPortSpec): Port {
  return {
    id: `iface-default-${name}`,
    name,
    type: spec.type,
    direction: "input",
    value: defaultDrafts.value[name] ?? specDefault(name, spec),
  };
}

function onDefaultDraft(name: string, value: unknown) {
  defaultDrafts.value = { ...defaultDrafts.value, [name]: value };
}

function onDefaultCommit(name: string) {
  const spec = props.graphInterface.parameters?.[name];
  if (!spec) return;
  const value = defaultDrafts.value[name];
  run((iface) => {
    const current = iface.parameters?.[name];
    if (!current) return;
    const typeDef = props.types[current.type];
    const next =
      typeDef?.coerce?.(value) ??
      (typeDef?.validate(value) ? value : specDefault(name, current));
    iface.parameters = {
      ...iface.parameters,
      [name]: { ...current, defaultValue: next },
    };
  });
}

function onAdd() {
  run((iface) => {
    const existing = isParameters.value ? iface.parameters : iface.returns;
    const keys = new Set(Object.keys(existing ?? {}));
    let key = isParameters.value ? "input" : "output";
    if (keys.has(key)) {
      let i = 2;
      while (keys.has(`${key}${i}`)) i++;
      key = `${key}${i}`;
    }
    const type = props.typeIds[0] ?? "number";
    const spec: GraphPortSpec = isParameters.value
      ? { type, defaultValue: defaultForType(type) }
      : { type };
    if (isParameters.value) {
      iface.parameters = { ...iface.parameters, [key]: spec };
    } else {
      iface.returns = { ...iface.returns, [key]: spec };
    }
  });
}

function onRemove(name: string) {
  run((iface) => {
    if (isParameters.value) {
      if (!iface.parameters) return;
      const { [name]: _, ...rest } = iface.parameters;
      iface.parameters = Object.keys(rest).length ? rest : undefined;
    } else {
      if (!iface.returns) return;
      const { [name]: _, ...rest } = iface.returns;
      iface.returns = Object.keys(rest).length ? rest : undefined;
    }
  });
}

function onRename(oldName: string, newName: string) {
  if (!newName || !PORT_NAME_RE.test(newName)) {
    localError.value = `Invalid port name "${newName}"`;
    return;
  }
  if (oldName === newName) return;
  run((iface) => {
    const side = isParameters.value ? iface.parameters : iface.returns;
    const spec = side?.[oldName];
    if (!spec) return;
    if (isParameters.value) {
      const { [oldName]: _, ...rest } = iface.parameters ?? {};
      iface.parameters = { ...rest, [newName]: spec };
    } else {
      const { [oldName]: _, ...rest } = iface.returns ?? {};
      iface.returns = { ...rest, [newName]: spec };
    }
  });
}

function onTypeChange(name: string, type: string) {
  run((iface) => {
    if (isParameters.value) {
      const spec = iface.parameters?.[name];
      if (!spec) return;
      const nextDefault = defaultForType(type);
      defaultDrafts.value = { ...defaultDrafts.value, [name]: nextDefault };
      iface.parameters = {
        ...iface.parameters,
        [name]: { ...spec, type, defaultValue: nextDefault },
      };
    } else {
      const spec = iface.returns?.[name];
      if (!spec) return;
      iface.returns = { ...iface.returns, [name]: { ...spec, type } };
    }
  });
}
</script>

<template>
  <InspectorSection :title="title">
    <template #actions>
      <button
        class="inspector-icon-btn"
        type="button"
        title="Add port"
        @click.stop.prevent="onAdd"
      >
        +
      </button>
    </template>

    <div v-if="entries.length" class="iface-grid iface-head" aria-hidden="true">
      <span>Name</span>
      <span>Type</span>
      <span />
    </div>

    <div v-if="entries.length" class="iface-rows">
      <div v-for="row in entries" :key="row.name" class="iface-entry">
        <div class="iface-grid iface-row">
          <input
            class="iface-field iface-name"
            type="text"
            :value="row.name"
            @change="
              onRename(
                row.name,
                ($event.target as HTMLInputElement).value.trim(),
              )
            "
          />
          <select
            class="iface-field iface-select"
            :value="row.spec.type"
            @change="
              onTypeChange(row.name, ($event.target as HTMLSelectElement).value)
            "
          >
            <option v-for="tid in typeIds" :key="tid" :value="tid">
              {{ tid }}
            </option>
          </select>
          <button
            class="iface-remove"
            type="button"
            title="Remove port"
            @click.stop.prevent="onRemove(row.name)"
          >
            ×
          </button>
        </div>

        <div v-if="isParameters" class="iface-default-row">
          <span class="iface-default-label">Default</span>
          <PortValueWidget
            class="iface-default-widget"
            :port="defaultPort(row.name, row.spec)"
            :type-def="types[row.spec.type]"
            :effective-widget="
              effectiveWidget(
                types[row.spec.type],
                defaultPort(row.name, row.spec),
              )
            "
            mode="editable"
            :placeholder="row.name"
            @update:value="onDefaultDraft(row.name, $event)"
            @commit="onDefaultCommit(row.name)"
          />
        </div>
      </div>
    </div>

    <div v-else class="iface-empty">No ports</div>

    <p v-if="displayError" class="iface-error">{{ displayError }}</p>
  </InspectorSection>
</template>

<style scoped>
.iface-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 16px;
  gap: 3px;
  align-items: center;
}
.iface-head span {
  font-size: 10px;
  opacity: 0.55;
  line-height: 1;
}
.iface-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.iface-entry {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.iface-default-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 4px;
  align-items: center;
}
.iface-default-label {
  font-size: 10px;
  opacity: 0.55;
  line-height: 1;
}
.iface-field {
  box-sizing: border-box;
  width: 100%;
  height: 18px;
  padding: 0 4px;
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  color: #eee;
  background: #1c1f25;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
}
.iface-select {
  padding-right: 2px;
  cursor: pointer;
}
.iface-default-widget {
  min-width: 0;
}
.iface-default-widget :deep(.field) {
  box-sizing: border-box;
  width: 100%;
  height: 18px;
  padding: 0 4px;
  font: inherit;
  font-size: 11px;
  line-height: 18px;
}
.iface-remove {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  justify-self: center;
}
.iface-remove:hover {
  background: rgba(229, 57, 53, 0.25);
  color: #ffb4b4;
}
.iface-empty {
  opacity: 0.45;
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
}
.iface-error {
  font-size: 10px;
  padding: 4px;
  margin: 4px 0 0;
  font-family: monospace;
  color: #ffb4b4;
  background: rgba(229, 57, 53, 0.15);
}
</style>
