<script setup lang="ts">
import {
  createNodeMap,
  instantiate,
  OUTPUT_TYPE,
  NodeViewer,
} from "@nodish/core";
import type { DefiniteNode } from "@nodish/core";
import { reactive, ref } from "vue";
import { pack } from ".";

const map = reactive(
  createNodeMap({
    packs: [pack],
    graphInterface: {
      returns: {
        delayed: { type: "number" },
        delayedCopy: { type: "number" },
        sum: { type: "number" },
        fetched: { type: "string" },
      },
    },
  }),
);

function place(typeId: string, x: number, y: number): DefiniteNode | undefined {
  const def = map.nodeTypes[typeId];
  if (!def) return;
  const node = instantiate(def, { x, y });
  map.graph.nodes.push(node);
  return node;
}

function portId(node: DefiniteNode, side: "in" | "out", name: string): string {
  const bag = side === "out" ? node.outputs : node.inputs;
  const port = Object.values(bag).find((p) => p.name === name);
  if (!port) throw new Error(`missing port ${name} on ${node.typeId}`);
  return port.id;
}

function wire(
  fromNode: DefiniteNode,
  fromName: string,
  toNode: DefiniteNode,
  toName: string,
): void {
  map.graph.connections.push({
    id: crypto.randomUUID(),
    from: { node: fromNode.id, port: portId(fromNode, "out", fromName) },
    to: { node: toNode.id, port: portId(toNode, "in", toName) },
  });
}

const delay = place("@test/delay", 80, 80);
const slowAdd = place("@test/slow-add", 80, 280);
const fakeFetch = place("@test/fake-fetch", 360, 80);
const output = map.graph.nodes.find((n) => n.typeId === OUTPUT_TYPE);
if (delay && output) {
  wire(delay, "result", output, "delayed");
  wire(delay, "result", output, "delayedCopy");
}
if (slowAdd && output) wire(slowAdd, "result", output, "sum");
if (fakeFetch && output) wire(fakeFetch, "body", output, "fetched");

const viewer = ref<{ run: () => Promise<void> } | null>(null);
</script>

<template>
  <div class="app">
    <button class="test-btn" type="button" title="Run including IO nodes" @click="viewer?.run()">
      Test
    </button>
    <NodeViewer ref="viewer" :map="map" io-widgets />
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
.app {
  position: relative;
  height: 100%;
}
.test-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  background: #2a2d34;
  color: #eee;
  font: 12px/1.2 sans-serif;
  cursor: pointer;
}
.test-btn:hover {
  background: #3a3f4b;
}
</style>
