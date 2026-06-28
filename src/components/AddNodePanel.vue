<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { IndefiniteNode, NodeMap } from "../store/model";
import {
  buildNodeGroupTree,
  sortNodeGroupTree,
  type NodeGroup,
} from "../store/registry/groups";
import { INPUT_TYPE, OUTPUT_TYPE } from "../store/nodes/io";
import { COMPOSITE_TYPE } from "../store/composite";
import InspectorPanel from "./InspectorPanel.vue";
import { NODE_FONT_SIZE, NODE_PADDING_X, ROW_H } from "./layout";

const props = defineProps<{
  map: NodeMap;
  screen: { x: number; y: number };
}>();

const emit = defineEmits<{
  select: [typeId: string];
  addComposite: [];
  close: [];
}>();

const fontSize = `${NODE_FONT_SIZE}px`;
const paddingX = `${NODE_PADDING_X}px`;
const rowHeight = `${ROW_H}px`;

const query = ref("");
const searchEl = ref<HTMLInputElement | null>(null);
onMounted(() => searchEl.value?.focus());

const creatable = (n: IndefiniteNode) =>
  n.typeId !== INPUT_TYPE &&
  n.typeId !== OUTPUT_TYPE &&
  n.typeId !== COMPOSITE_TYPE;

const tree = computed(() =>
  sortNodeGroupTree(buildNodeGroupTree(props.map.nodeTypes, creatable)),
);

const currentPath = ref<string[]>([]);

const currentGroup = computed<NodeGroup>(() => {
  let group = tree.value;
  for (const segment of currentPath.value) {
    const next = group.subgroups.find((g) => g.name === segment);
    if (!next) break;
    group = next;
  }
  return group;
});

const headerTitle = computed(() =>
  currentPath.value.length ? currentPath.value.join(" › ") : "Add Node",
);

const breadcrumbSegments = computed(() => {
  if (!currentPath.value.length) return null;
  return currentPath.value;
});

function pathSegments(n: IndefiniteNode): string[] {
  return n.group ?? [];
}

function enterGroup(name: string) {
  currentPath.value = [...currentPath.value, name];
}
function goUp() {
  currentPath.value = currentPath.value.slice(0, -1);
}

const matches = computed<IndefiniteNode[] | null>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return null;
  return Object.values(props.map.nodeTypes)
    .filter(creatable)
    .filter((n) => n.displayName.toLowerCase().includes(q))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
});

function pick(n: IndefiniteNode) {
  emit("select", n.typeId);
}

const addableNodes = computed(() => {
  if (matches.value) return matches.value;
  return currentGroup.value.nodes;
});

const activeIndex = ref(0);
watch(addableNodes, () => {
  activeIndex.value = 0;
});

function addActive() {
  const nodes = addableNodes.value;
  if (!nodes.length) return;
  pick(nodes[activeIndex.value] ?? nodes[0]);
}

function onSearchKeydown(e: KeyboardEvent) {
  const nodes = addableNodes.value;
  if (!nodes.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % nodes.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + nodes.length) % nodes.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    addActive();
  }
}

function onRowClick(n: IndefiniteNode, index: number) {
  activeIndex.value = index;
  pick(n);
}

function onBackdropDown(e: PointerEvent) {
  e.stopPropagation();
  emit("close");
}
</script>

<template>
  <div class="backdrop" @pointerdown="onBackdropDown" @contextmenu.prevent>
    <div
      class="anchor"
      :style="{ left: screen.x + 'px', top: screen.y + 'px' }"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <InspectorPanel title="Add Node" static-title fill flush>
        <template #title>
          <nav class="crumbs" :title="headerTitle">
            <span class="crumb" :class="{ current: !breadcrumbSegments }">
              Add Node
            </span>
            <template v-if="breadcrumbSegments">
              <template
                v-for="(seg, i) in breadcrumbSegments"
                :key="`${i}-${seg}`"
              >
                <span class="crumb-sep">›</span>
                <span
                  class="crumb"
                  :class="{ current: i === breadcrumbSegments.length - 1 }"
                >
                  {{ seg }}
                </span>
              </template>
            </template>
          </nav>
        </template>

        <template #header-actions>
          <button
            class="inspector-icon-btn"
            type="button"
            title="Add composite"
            @click="emit('addComposite')"
          >
            +
          </button>
        </template>

        <div class="picker-body">
          <input
            ref="searchEl"
            v-model="query"
            class="search"
            type="text"
            placeholder="Search nodes…"
            @keydown="onSearchKeydown"
          />

          <div class="list">
            <template v-if="matches">
              <button
                v-for="(n, i) in matches"
                :key="n.typeId"
                class="row node"
                :class="{ active: i === activeIndex }"
                :title="n.description"
                @click="onRowClick(n, i)"
              >
                <span class="dot" :style="{ background: n.color }" />
                <span class="name">{{ n.displayName }}</span>
                <span class="path">
                  <template
                    v-for="(seg, pi) in pathSegments(n)"
                    :key="`${n.typeId}-${pi}-${seg}`"
                  >
                    <span v-if="pi > 0" class="path-sep">›</span>
                    <span class="path-seg">{{ seg }}</span>
                  </template>
                </span>
              </button>
              <div v-if="!matches.length" class="empty">No matches</div>
            </template>

            <template v-else>
              <button v-if="currentPath.length" class="row up" @click="goUp">
                <span class="icon">↩</span>
                <span class="name">..</span>
              </button>
              <button
                v-for="g in currentGroup.subgroups"
                :key="g.name"
                class="row folder"
                @click="enterGroup(g.name)"
              >
                <span class="name">{{ g.name }}</span>
                <span class="chev">›</span>
              </button>
              <button
                v-for="(n, i) in currentGroup.nodes"
                :key="n.typeId"
                class="row node"
                :class="{ active: i === activeIndex }"
                :title="n.description"
                @click="onRowClick(n, i)"
              >
                <span class="dot" :style="{ background: n.color }" />
                <span class="name">{{ n.displayName }}</span>
              </button>
              <div
                v-if="
                  !currentGroup.subgroups.length && !currentGroup.nodes.length
                "
                class="empty"
              >
                Empty
              </div>
            </template>
          </div>
        </div>
      </InspectorPanel>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
}
.anchor {
  position: absolute;
  width: 200px;
  font-size: v-bind(fontSize);
}
.crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  line-height: 1;
  color: #fff;
}
.crumbs .crumb {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.72;
}
.crumbs .crumb.current {
  opacity: 1;
}
.crumbs .crumb-sep {
  flex: none;
  color: #6b9bd1;
}
.picker-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.search {
  margin: 6px;
  padding: 1px 4px;
  box-sizing: border-box;
  font: inherit;
  color: #eee;
  background: #1c1f25;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
}
.search:focus {
  outline: 1px solid #6b9bd1;
}
.list {
  overflow-y: auto;
  padding-bottom: 4px;
  flex: 1;
  min-height: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: v-bind(rowHeight);
  padding: 0 v-bind(paddingX);
  box-sizing: border-box;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
  text-align: left;
  cursor: pointer;
}
.row:hover {
  background: rgba(255, 255, 255, 0.08);
}
.row.node.active {
  background: rgba(255, 255, 255, 0.12);
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.row.up .icon {
  flex: none;
  width: 10px;
  text-align: center;
  opacity: 0.7;
}
.chev {
  flex: none;
  font-size: inherit;
  line-height: 1;
  color: rgba(255, 255, 255, 0.85);
}
.path {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: 46%;
  overflow: hidden;
  font-size: 10px;
}
.path-seg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.55;
}
.path-sep {
  flex: none;
  color: #6b9bd1;
}
.empty {
  padding: 8px;
  opacity: 0.5;
  text-align: center;
}
</style>
