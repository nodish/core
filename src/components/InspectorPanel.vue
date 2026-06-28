<script setup lang="ts">
import { HEADER_H, NODE_FONT_SIZE, NODE_PADDING_X } from "./layout";

const DEFAULT_HEADER_COLOR = "#3a3f4b";

withDefaults(
  defineProps<{
    title: string;
    titlePlaceholder?: string;
    headerColor?: string;
    showUp?: boolean;
    staticTitle?: boolean;
    /** Remove body padding (e.g. scrollable lists). */
    flush?: boolean;
    /** Constrain height and let the body scroll internally. */
    fill?: boolean;
  }>(),
  {
    titlePlaceholder: "",
    headerColor: DEFAULT_HEADER_COLOR,
    showUp: false,
    staticTitle: false,
    flush: false,
    fill: false,
  },
);

const emit = defineEmits<{
  "update:title": [value: string];
  up: [];
}>();

const nodeFontSize = `${NODE_FONT_SIZE}px`;
const nodePaddingX = `${NODE_PADDING_X}px`;
const headerHeight = `${HEADER_H}px`;

function onTitleInput(e: Event) {
  emit("update:title", (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="inspector-panel" :class="{ fill }">
    <div class="inspector-header" :style="{ background: headerColor }">
      <slot name="title">
        <span v-if="staticTitle" class="inspector-title static">{{
          title
        }}</span>
        <input
          v-else
          class="inspector-title"
          type="text"
          :value="title"
          :placeholder="titlePlaceholder"
          :title="title"
          @input="onTitleInput"
        />
      </slot>
      <div class="inspector-header-actions">
        <slot name="header-actions" />
        <button
          v-if="showUp"
          class="inspector-icon-btn"
          type="button"
          title="Go up"
          @click="emit('up')"
        >
          ↩
        </button>
      </div>
    </div>

    <div class="inspector-body" :class="{ flush }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.inspector-panel {
  width: 200px;
  background: #2a2d34;
  color: #eee;
  font-family: sans-serif;
  font-size: v-bind(nodeFontSize);
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  user-select: none;
  overflow: hidden;
}
.inspector-header {
  display: flex;
  align-items: center;
  gap: 2px;
  height: v-bind(headerHeight);
  padding: 0 2px 0 v-bind(nodePaddingX);
  box-sizing: border-box;
}
.inspector-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}
.inspector-panel.fill {
  max-height: 320px;
  display: flex;
  flex-direction: column;
}
.inspector-title {
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  line-height: 1;
  color: #fff;
  background: transparent;
  border: none;
  outline: none;
}
.inspector-title.static {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inspector-title::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
.inspector-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px v-bind(nodePaddingX);
}
.inspector-panel.fill .inspector-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.inspector-body.flush {
  padding: 0;
  gap: 0;
}
</style>

<!-- Shared field styles for child components -->
<style>
.inspector-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.inspector-key {
  flex: none;
  width: 42px;
  opacity: 0.7;
}
.inspector-field {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 18px;
  padding: 1px 4px;
  font-size: inherit;
  font-family: inherit;
  line-height: 1;
  color: #eee;
  background: #1c1f25;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
}
.inspector-swatch {
  flex: 1;
  min-width: 0;
  height: 18px;
  padding: 0;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  background: #1c1f25;
  color-scheme: dark;
}
.inspector-swatch::-webkit-color-swatch-wrapper {
  padding: 1px 2px;
  background: #1c1f25;
}
.inspector-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
.inspector-swatch::-moz-color-swatch {
  border: none;
  border-radius: 2px;
}
.inspector-row.pair {
  gap: 8px;
}
.inspector-row.pair > label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.inspector-row.pair .inspector-key {
  width: auto;
}
.inspector-icon-btn {
  flex: none;
  width: 16px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.inspector-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
</style>
