<script setup lang="ts">
import { createNodeMap, NodeViewer } from "@nodish/core";
import { reactive } from "vue";
import { pack, packHigh, packLow } from ".";

const map = reactive(createNodeMap({}));
map.loadPack(pack);
map.loadPack(packLow);
map.loadPack(packHigh);
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
