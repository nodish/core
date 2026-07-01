<script setup lang="ts">
import { createNodeMap, NodeViewer } from "@nodish/core";
import { reactive } from "vue";
import { pack } from ".";

const map = reactive(createNodeMap({}));
map.loadPack(pack);
</script>

<template>
  <NodeViewer :map="map" io-widgets />
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
</style>
