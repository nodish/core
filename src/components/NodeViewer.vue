<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  toRef,
  watch,
} from "vue";
import type {
  DefiniteNode,
  FrameId,
  IndefiniteNode,
  NodeMap,
  Port,
  PortRef,
} from "../store/model";
import { runGraph, type GraphRunResult } from "../store/graph/evaluate";
import {
  addConnection,
  removeConnection,
  ancestorNodeIds,
  descendantNodeIds,
} from "../store/graph/connect";
import {
  nodeAcceptsDrop,
  pickAutoConnectPort,
} from "../store/graph/autoConnect";
import { removeNode, canRemoveNode } from "../store/graph/removeNode";
import {
  dissolveFrame,
  framesBackToFront,
  unframeNodes,
  wrapSelection,
} from "../store/graph/frames";
import {
  buildClipboard,
  pasteClipboard,
  type ClipboardPayload,
} from "../store/graph/duplicateSelection";
import { createGraphHistory } from "../store/graph/history";
import {
  bringToFront,
  ensureStackingOrder,
  normalizeStackingOrder,
} from "../store/graph/stacking";
import { instantiate } from "../store/graph/instance";
import {
  type EditFrame,
  currentComposite,
  resolveEditContext,
} from "../store/composite/editContext";
import {
  COMPOSITE_TYPE,
  instantiateComposite,
  isCompositeNode,
} from "../store/composite";
import {
  applyInterfaceMutation,
  canonicalGraphInterface,
} from "../store/interface/editor";
import type { InterfaceMutator } from "../store/interface/editor";
import {
  validateCompositeDrillIn,
  wouldCreateCompositeCycle,
} from "../store/composite/guards";
import { graphHistoryKey, rootMapKey } from "./historyKey";
import GraphNode from "./GraphNode.vue";
import GraphFrameBox from "./GraphFrameBox.vue";
import WireLayer from "./WireLayer.vue";
import NodePanel from "./NodePanel.vue";
import FramePanel from "./FramePanel.vue";
import GroupPanel from "./GroupPanel.vue";
import AddNodePanel from "./AddNodePanel.vue";
import {
  type Point,
  ROW_H,
  frameRect,
  nodeHeight,
  nodeWidth,
  portPosition,
  portRowHeight,
  sampleWire,
  segmentsIntersect,
  wirePath,
} from "./layout";

const BOX_THRESHOLD = 4;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.001;
// Extra horizontal clearance around each port's hit band. Vertical range uses
// half of each port's row height so tall widgets remain easy to connect to.
const HIT_MARGIN_X = ROW_H;

function portTypeLookup(port: Port) {
  return activeMap.value.types[port.type];
}

const props = withDefaults(
  defineProps<{
    map: NodeMap;
    // When true: Input node outputs get editable fields; Output node inputs
    // show live computed results. Off by default.
    ioWidgets?: boolean;
    /** When false, do not evaluate on change. Call `runGraph` yourself. */
    autoEval?: boolean;
  }>(),
  { ioWidgets: false, autoEval: true },
);

const history = createGraphHistory();
const rootMapRef = toRef(props, "map");
provide(graphHistoryKey, history);
provide(rootMapKey, rootMapRef);

// ---- Drill-in edit stack ------------------------------------------------
const editStack = ref<EditFrame[]>([]);
const editContext = computed(() =>
  resolveEditContext(props.map, editStack.value),
);
const activeMap = computed(() => editContext.value.activeMap);

const activeGraphInterface = computed(() =>
  canonicalGraphInterface(props.map, editStack.value),
);

const interfaceRevision = ref(0);
const interfaceCommitError = ref("");

const drilledComposite = computed(() =>
  currentComposite(props.map, editStack.value),
);

const nestedIoWidgets = ref(false);
const effectiveIoWidgets = computed(() =>
  editStack.value.length ? nestedIoWidgets.value : props.ioWidgets,
);

function popUpOneLevel() {
  if (!editStack.value.length) return;
  editStack.value = editStack.value.slice(0, -1);
  clearSelection();
  closeMenu();
}

function applyInterfaceMutationFromViewer(mutate: InterfaceMutator): string[] {
  interfaceCommitError.value = "";
  try {
    history.pushBefore(props.map);
    const errors = applyInterfaceMutation(props.map, editStack.value, mutate);
    if (errors.length) {
      interfaceCommitError.value = errors[0] ?? "Unknown error";
      return errors;
    }
    interfaceRevision.value++;
    return [];
  } catch (err) {
    interfaceCommitError.value =
      err instanceof Error ? err.message : String(err);
    return [interfaceCommitError.value];
  }
}

function onDrillIn(id: string) {
  const node = activeMap.value.graph.nodes.find((n) => n.id === id);
  if (!node || !isCompositeNode(node)) return;
  const err = validateCompositeDrillIn(props.map, editStack.value, node);
  if (err) {
    console.warn(`[Group] ${err}`);
    return;
  }
  editStack.value.push({ compositeNodeId: id });
  clearSelection();
  closeMenu();
}

const EMPTY_RUN: GraphRunResult = { values: {}, errors: {} };

const graphEval = computed(() =>
  props.autoEval ? runGraph(activeMap.value) : EMPTY_RUN,
);
const ioResults = computed(() =>
  effectiveIoWidgets.value ? graphEval.value.values : undefined,
);
const nodeErrors = computed(() => graphEval.value.errors);

// Log when a node's error message appears or changes (not on every pan/drag).
const lastLoggedErrors = ref<Record<string, string>>({});
watch(nodeErrors, (errs) => {
  for (const [id, msg] of Object.entries(errs)) {
    if (lastLoggedErrors.value[id] === msg) continue;
    const node = activeMap.value.graph.nodes.find((n) => n.id === id);
    const def = node ? activeMap.value.nodeTypes[node.typeId] : undefined;
    const name = node?.label || def?.displayName || node?.typeId || id;
    console.error(`[${name}] ${msg}`);
    lastLoggedErrors.value[id] = msg;
  }
  for (const id of Object.keys(lastLoggedErrors.value)) {
    if (!(id in errs)) delete lastLoggedErrors.value[id];
  }
});

const viewerEl = ref<HTMLElement | null>(null);
const panX = ref(0);
const panY = ref(0);
const zoom = ref(1);
const isPanning = ref(false);
const worldCursor = ref<Point>({ x: 0, y: 0 });
const clipboard = ref<ClipboardPayload | null>(null);

// ---- Selection ---------------------------------------------------------
const selectedIds = ref<string[]>([]);
const selectedFrameIds = ref<FrameId[]>([]);

const selectedSet = computed(() => new Set(selectedIds.value));
const selectedFrameSet = computed(() => new Set(selectedFrameIds.value));
const selectedNodes = computed(() =>
  activeMap.value.graph.nodes.filter((n) => selectedSet.value.has(n.id)),
);
const selectedFrames = computed(() =>
  (activeMap.value.graph.frames ?? []).filter((f) =>
    selectedFrameSet.value.has(f.id),
  ),
);
const selectionCount = computed(
  () => selectedIds.value.length + selectedFrameIds.value.length,
);
const primarySelected = computed(() => selectedNodes.value[0] ?? null);
const primaryDef = computed(() =>
  primarySelected.value
    ? (activeMap.value.nodeTypes[primarySelected.value.typeId] ?? null)
    : null,
);

const visibleFrames = computed(() => {
  const graph = activeMap.value.graph;
  const lookup = portTypeLookup;
  const cache = new Map<string, ReturnType<typeof frameRect>>();
  return framesBackToFront(graph).flatMap((frame) => {
    const rect = frameRect(graph, frame, lookup, cache);
    return rect ? [{ frame, rect }] : [];
  });
});

function selectOnly(id: string) {
  selectedFrameIds.value = [];
  selectedIds.value = [id];
  bringToFront(activeMap.value, id);
}

function toggleInSelection(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  } else {
    selectedIds.value = [...selectedIds.value, id];
    bringToFront(activeMap.value, id);
  }
}

function onSelect(id: string, shiftKey: boolean) {
  if (shiftKey) {
    toggleInSelection(id);
    return;
  }
  if (selectedSet.value.has(id) && selectionCount.value > 1) {
    bringToFront(activeMap.value, id);
    return;
  }
  selectOnly(id);
}

function toggleFrameInSelection(id: FrameId) {
  const idx = selectedFrameIds.value.indexOf(id);
  if (idx >= 0) {
    selectedFrameIds.value = selectedFrameIds.value.filter((x) => x !== id);
  } else {
    selectedFrameIds.value = [...selectedFrameIds.value, id];
  }
}

function onSelectFrame(id: FrameId, shiftKey: boolean) {
  if (shiftKey) {
    toggleFrameInSelection(id);
    return;
  }
  if (selectedFrameSet.value.has(id) && selectionCount.value > 1) return;
  selectedIds.value = [];
  selectedFrameIds.value = [id];
}

function clearSelection() {
  selectedIds.value = [];
  selectedFrameIds.value = [];
}

function nodesInBox(a: Point, b: Point): string[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return activeMap.value.graph.nodes
    .filter((n) => {
      const w = nodeWidth(n);
      const h = nodeHeight(n, portTypeLookup);
      return (
        n.location.x < maxX &&
        n.location.x + w > minX &&
        n.location.y < maxY &&
        n.location.y + h > minY
      );
    })
    .map((n) => n.id);
}

function framesInBox(a: Point, b: Point): FrameId[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const cache = new Map<string, ReturnType<typeof frameRect>>();
  const graph = activeMap.value.graph;
  return (graph.frames ?? [])
    .filter((f) => {
      const r = frameRect(graph, f, portTypeLookup, cache);
      if (!r) return false;
      return (
        r.x >= minX &&
        r.y >= minY &&
        r.x + r.width <= maxX &&
        r.y + r.height <= maxY
      );
    })
    .map((f) => f.id);
}

function wrapCurrentSelection() {
  if (!selectionCount.value) return;
  history.pushBefore(props.map);
  const created = wrapSelection(
    activeMap.value,
    selectedIds.value,
    selectedFrameIds.value,
  );
  if (!created) return;
  selectedIds.value = [];
  selectedFrameIds.value = [created.id];
}

function unframeCurrentSelection() {
  if (!selectedIds.value.length) return;
  history.pushBefore(props.map);
  unframeNodes(activeMap.value, selectedIds.value);
}

function dissolveSelectedFrames() {
  if (!selectedFrameIds.value.length) return;
  history.pushBefore(props.map);
  for (const id of [...selectedFrameIds.value]) {
    dissolveFrame(activeMap.value, id);
  }
  selectedFrameIds.value = [];
}

// ---- Marquee (box) selection -------------------------------------------
const boxSelect = ref<{ start: Point; cur: Point } | null>(null);
const marqueeStyle = computed(() => {
  const b = boxSelect.value;
  if (!b) return null;
  const x = Math.min(b.start.x, b.cur.x);
  const y = Math.min(b.start.y, b.cur.y);
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${Math.abs(b.cur.x - b.start.x)}px`,
    height: `${Math.abs(b.cur.y - b.start.y)}px`,
  };
});

let leftPress: {
  clientX: number;
  clientY: number;
  world: Point;
} | null = null;
let leftBoxActive = false;

function onLeftMove(ev: PointerEvent) {
  if (!leftPress) return;
  if (!leftBoxActive) {
    const dx = ev.clientX - leftPress.clientX;
    const dy = ev.clientY - leftPress.clientY;
    if (Math.hypot(dx, dy) < BOX_THRESHOLD) return;
    leftBoxActive = true;
  }
  boxSelect.value = {
    start: leftPress.world,
    cur: toWorld(ev.clientX, ev.clientY),
  };
}

function endLeftPress() {
  window.removeEventListener("pointermove", onLeftMove);
  window.removeEventListener("pointerup", endLeftPress);
  if (leftBoxActive && boxSelect.value) {
    selectedIds.value = nodesInBox(boxSelect.value.start, boxSelect.value.cur);
    selectedFrameIds.value = framesInBox(
      boxSelect.value.start,
      boxSelect.value.cur,
    );
  } else if (leftPress) {
    clearSelection();
    closeMenu();
  }
  boxSelect.value = null;
  leftPress = null;
  leftBoxActive = false;
}

const viewportStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}));

// Screen (client) coordinates -> world coordinates inside the viewport.
function toWorld(clientX: number, clientY: number): Point {
  const rect = viewerEl.value?.getBoundingClientRect();
  const left = rect?.left ?? 0;
  const top = rect?.top ?? 0;
  return {
    x: (clientX - left - panX.value) / zoom.value,
    y: (clientY - top - panY.value) / zoom.value,
  };
}

// Client coordinates -> position relative to the viewer (for overlay placement).
function toScreen(clientX: number, clientY: number): Point {
  const rect = viewerEl.value?.getBoundingClientRect();
  return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
}

// ---- Connecting / create-node menu -------------------------------------
type Pending = { ref: PortRef; dir: Port["direction"]; pos: Point };
const pending = ref<Pending | null>(null);
const pendingCursor = ref<Point | null>(null);
// Nodes that must not be snap targets for this drag (would create a cycle).
const pendingBlockedNodes = ref<Set<string> | null>(null);
const menu = ref<{ screen: Point; world: Point } | null>(null);
let lastConnectClient = { x: 0, y: 0 };

function pendingFromPort(): Port | null {
  const p = pending.value;
  if (!p) return null;
  const node = activeMap.value.graph.nodes.find((n) => n.id === p.ref.node);
  return p.dir === "output"
    ? (node?.outputs[p.ref.port] ?? null)
    : (node?.inputs[p.ref.port] ?? null);
}

const menuCompatible = computed(() => {
  const fromPort = pendingFromPort();
  if (!fromPort) return undefined;
  const map = activeMap.value;
  return (n: IndefiniteNode) => nodeAcceptsDrop(map, n, fromPort);
});

function connectPendingToNode(node: DefiniteNode) {
  const p = pending.value;
  if (!p) return;
  const target = pickAutoConnectPort(activeMap.value, node, p.ref, p.dir);
  if (!target) return;
  const from = p.dir === "output" ? p.ref : target;
  const to = p.dir === "output" ? target : p.ref;
  addConnection(activeMap.value, from, to);
}

function clearPending() {
  pending.value = null;
  pendingCursor.value = null;
  pendingBlockedNodes.value = null;
}

function closeMenu() {
  menu.value = null;
  clearPending();
}

function onCreateNode(typeId: string) {
  if (typeId === COMPOSITE_TYPE) {
    onAddComposite();
    return;
  }
  const def = activeMap.value.nodeTypes[typeId];
  if (def) {
    history.pushBefore(props.map);
    const at = menu.value?.world ?? { x: 0, y: 0 };
    const node = instantiate(def, { x: at.x, y: at.y });
    activeMap.value.graph.nodes.push(node);
    ensureStackingOrder(activeMap.value);
    connectPendingToNode(node);
    onSelect(node.id, false);
  }
  closeMenu();
}

function onAddComposite() {
  const at = menu.value?.world ?? { x: 0, y: 0 };
  const hostGraph = activeMap.value.graph;
  const node = instantiateComposite(props.map, { x: at.x, y: at.y });
  const cycleErr = wouldCreateCompositeCycle(
    props.map,
    editStack.value,
    node,
    hostGraph,
  );
  if (cycleErr) {
    console.warn(`[Group] ${cycleErr}`);
    closeMenu();
    return;
  }
  history.pushBefore(props.map);
  hostGraph.nodes.push(node);
  ensureStackingOrder(activeMap.value);
  connectPendingToNode(node);
  onSelect(node.id, false);
  closeMenu();
}

// While dragging, snap the tip to a matching port if one is in range.
const pendingSnapped = computed((): Point | null => {
  const p = pending.value;
  const cur = pendingCursor.value;
  if (!p || !cur) return null;
  const wantDir = p.dir === "output" ? "input" : "output";
  const hit = nearestPort(cur, wantDir, p.ref.node, pendingBlockedNodes.value);
  if (!hit) return null;
  const node = activeMap.value.graph.nodes.find((n) => n.id === hit.node);
  return node ? portPosition(node, hit.port, portTypeLookup) : null;
});

const pendingPath = computed(() => {
  const p = pending.value;
  const cur = pendingCursor.value;
  if (!p || !cur) return null;
  const tip = pendingSnapped.value ?? cur;
  return p.dir === "output" ? wirePath(p.pos, tip) : wirePath(tip, p.pos);
});

function onConnectStart(ref: PortRef, port: Port, ev: PointerEvent) {
  const node = activeMap.value.graph.nodes.find((n) => n.id === ref.node);
  const pos = node ? portPosition(node, ref.port, portTypeLookup) : null;
  if (!pos) return;
  lastConnectClient = { x: ev.clientX, y: ev.clientY };
  pending.value = { ref, dir: port.direction, pos };
  pendingCursor.value = toWorld(ev.clientX, ev.clientY);
  pendingBlockedNodes.value = new Set(
    port.direction === "output"
      ? ancestorNodeIds(activeMap.value, ref.node)
      : descendantNodeIds(activeMap.value, ref.node),
  );
  window.addEventListener("pointermove", onConnectMove);
  window.addEventListener("pointerup", finishConnect);
}

function onConnectMove(ev: PointerEvent) {
  lastConnectClient = { x: ev.clientX, y: ev.clientY };
  pendingCursor.value = toWorld(ev.clientX, ev.clientY);
}

// Nearest socket of the wanted direction whose hit zone contains the cursor,
// excluding the source node so a wire can't dead-end on its own node. The hit
// zone spans the port row vertically (pos.y ± half row height) so dropping
// on its field/label connects too. Ties (e.g. overlapping nodes) resolve to
// the closest socket.
function nearestPort(
  world: Point,
  wantDir: Port["direction"],
  excludeNode: string,
  blockedNodes?: Set<string> | null,
): PortRef | null {
  let best: PortRef | null = null;
  let bestDist = Infinity;
  for (const node of activeMap.value.graph.nodes) {
    if (node.id === excludeNode) continue;
    if (blockedNodes?.has(node.id)) continue;
    const left = node.location.x - HIT_MARGIN_X;
    const right = node.location.x + nodeWidth(node) + HIT_MARGIN_X;
    if (world.x < left || world.x > right) continue;
    const ports = wantDir === "input" ? node.inputs : node.outputs;
    for (const port of Object.values(ports)) {
      if (port.userOnly) continue; // user-only inputs have no socket to hit
      const typeDef = portTypeLookup(port);
      const pos = portPosition(node, port.id, portTypeLookup);
      if (!pos) continue;
      const half = portRowHeight(port, typeDef) / 2;
      if (world.y < pos.y - half || world.y > pos.y + half) continue;
      const dist = Math.hypot(pos.x - world.x, pos.y - world.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { node: node.id, port: port.id };
      }
    }
  }
  return best;
}

function finishConnect() {
  window.removeEventListener("pointermove", onConnectMove);
  window.removeEventListener("pointerup", finishConnect);
  const p = pending.value;
  const cur = pendingCursor.value;
  if (p && cur) {
    const wantDir = p.dir === "output" ? "input" : "output";
    const target = nearestPort(
      cur,
      wantDir,
      p.ref.node,
      pendingBlockedNodes.value,
    );
    if (target) {
      const from = p.dir === "output" ? p.ref : target;
      const to = p.dir === "output" ? target : p.ref;
      history.pushBefore(props.map);
      addConnection(activeMap.value, from, to);
      clearPending();
      return;
    }
    menu.value = {
      screen: toScreen(lastConnectClient.x, lastConnectClient.y),
      world: cur,
    };
    return;
  }
  clearPending();
}

// ---- Right button: slice (drag) or create-node menu (click) ------------
// A right *drag* cuts wires; a right *click* in empty space opens the menu.
const SLICE_THRESHOLD = 4; // px of movement before a press counts as a slice
const slicePoints = ref<Point[]>([]);
let rightPress: {
  clientX: number;
  clientY: number;
  world: Point;
  screen: Point;
  onBackground: boolean;
} | null = null;
let rightMoved = false;
let sliceHistoryStarted = false;

const slicePath = computed(() => {
  const pts = slicePoints.value;
  if (pts.length < 2) return null;
  return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
});

function startRightPress(ev: PointerEvent) {
  ev.preventDefault();
  const target = ev.target as HTMLElement | null;
  rightPress = {
    clientX: ev.clientX,
    clientY: ev.clientY,
    world: toWorld(ev.clientX, ev.clientY),
    screen: toScreen(ev.clientX, ev.clientY),
    onBackground: !target?.closest(".node") && !target?.closest(".config-bar"),
  };
  rightMoved = false;
  sliceHistoryStarted = false;
  slicePoints.value = [rightPress.world];
  window.addEventListener("pointermove", onSliceMove);
  window.addEventListener("pointerup", endSlice);
}

function onSliceMove(ev: PointerEvent) {
  if (!rightPress) return;
  if (!rightMoved) {
    const dx = ev.clientX - rightPress.clientX;
    const dy = ev.clientY - rightPress.clientY;
    if (Math.hypot(dx, dy) < SLICE_THRESHOLD) return; // still a click, not a cut
    rightMoved = true;
  }
  const cur = toWorld(ev.clientX, ev.clientY);
  const pts = slicePoints.value;
  const prev = pts[pts.length - 1];
  pts.push(cur);
  if (prev) sliceSegment(prev, cur);
}

// Remove any connection whose sampled wire crosses the latest slice segment.
function sliceSegment(p1: Point, p2: Point) {
  for (const c of [...activeMap.value.graph.connections]) {
    const fromNode = activeMap.value.graph.nodes.find(
      (n) => n.id === c.from.node,
    );
    const toNode = activeMap.value.graph.nodes.find((n) => n.id === c.to.node);
    if (!fromNode || !toNode) continue;
    const a = portPosition(fromNode, c.from.port, portTypeLookup);
    const b = portPosition(toNode, c.to.port, portTypeLookup);
    if (!a || !b) continue;
    const poly = sampleWire(a, b);
    for (let i = 0; i < poly.length - 1; i++) {
      if (segmentsIntersect(p1, p2, poly[i], poly[i + 1])) {
        if (!sliceHistoryStarted) {
          history.begin(props.map);
          sliceHistoryStarted = true;
        }
        removeConnection(activeMap.value, c.id);
        break;
      }
    }
  }
}

function endSlice() {
  window.removeEventListener("pointermove", onSliceMove);
  window.removeEventListener("pointerup", endSlice);
  if (sliceHistoryStarted) history.end();
  sliceHistoryStarted = false;
  const press = rightPress;
  const moved = rightMoved;
  slicePoints.value = [];
  rightPress = null;
  rightMoved = false;
  // A plain right-click on empty space opens the create-node menu there.
  if (!moved && press && press.onBackground) {
    menu.value = { screen: press.screen, world: press.world };
  }
}

// ---- Pan / zoom / recenter ---------------------------------------------
function recenter() {
  panX.value = 0;
  panY.value = 0;
  zoom.value = 1;
}

function resetView() {
  editStack.value = [];
  clearSelection();
  closeMenu();
  interfaceRevision.value++;
}

defineExpose({ resetView });

function isEditingField(e: KeyboardEvent): boolean {
  const el = e.target;
  return el instanceof HTMLElement && !!el.closest("input, textarea, select");
}

function pruneEditStack() {
  let nodes = props.map.graph.nodes;
  const next: EditFrame[] = [];
  for (const frame of editStack.value) {
    const node = nodes.find((n) => n.id === frame.compositeNodeId);
    if (!node?.composite) break;
    next.push(frame);
    nodes = node.composite.graph.nodes;
  }
  if (next.length !== editStack.value.length) {
    editStack.value = next;
  }
}

function afterHistoryRestore() {
  interfaceRevision.value++;
  pruneEditStack();
  const alive = new Set(activeMap.value.graph.nodes.map((n) => n.id));
  selectedIds.value = selectedIds.value.filter((id) => alive.has(id));
  const aliveFrames = new Set(
    (activeMap.value.graph.frames ?? []).map((f) => f.id),
  );
  selectedFrameIds.value = selectedFrameIds.value.filter((id) =>
    aliveFrames.has(id),
  );
  ensureStackingOrder(activeMap.value);
  closeMenu();
}

function onViewerPointerMove(e: PointerEvent) {
  worldCursor.value = toWorld(e.clientX, e.clientY);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (menu.value) closeMenu();
    else if (editStack.value.length) popUpOneLevel();
    else if (selectionCount.value) clearSelection();
    else recenter();
    return;
  }

  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === "z" && !e.shiftKey) {
    if (isEditingField(e)) return;
    if (history.undo(props.map)) afterHistoryRestore();
    e.preventDefault();
    return;
  }
  if ((mod && e.key === "z" && e.shiftKey) || (mod && e.key === "y")) {
    if (isEditingField(e)) return;
    if (history.redo(props.map)) afterHistoryRestore();
    e.preventDefault();
    return;
  }
  if (mod && e.key === "j") {
    if (isEditingField(e)) return;
    wrapCurrentSelection();
    e.preventDefault();
    return;
  }
  if (mod && e.key === "c") {
    if (isEditingField(e)) return;
    const payload = buildClipboard(
      activeMap.value,
      { nodeIds: selectedIds.value, frameIds: selectedFrameIds.value },
      worldCursor.value,
    );
    if (payload) clipboard.value = payload;
    e.preventDefault();
    return;
  }
  if (mod && e.key === "v") {
    if (isEditingField(e)) return;
    if (!clipboard.value) return;
    history.pushBefore(props.map);
    const pasted = pasteClipboard(
      activeMap.value,
      clipboard.value,
      worldCursor.value,
    );
    ensureStackingOrder(activeMap.value);
    for (const id of pasted.nodeIds) bringToFront(activeMap.value, id);
    selectedIds.value = pasted.nodeIds;
    selectedFrameIds.value = pasted.frameIds;
    e.preventDefault();
    return;
  }

  if (e.key !== "Delete" && e.key !== "Backspace") return;
  if (isEditingField(e)) return;
  const removable = selectedIds.value.filter((id) =>
    canRemoveNode(activeMap.value, id),
  );
  if (!removable.length && !selectedFrameIds.value.length) return;
  history.pushBefore(props.map);
  for (const id of removable) removeNode(activeMap.value, id);
  for (const id of [...selectedFrameIds.value]) {
    dissolveFrame(activeMap.value, id);
  }
  clearSelection();
  e.preventDefault();
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const el = viewerEl.value;
  if (!el) return;

  if (e.ctrlKey || e.metaKey) {
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - panX.value) / zoom.value;
    const wy = (my - panY.value) / zoom.value;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom.value * (1 - e.deltaY * ZOOM_SENSITIVITY)),
    );
    panX.value = mx - wx * nextZoom;
    panY.value = my - wy * nextZoom;
    zoom.value = nextZoom;
    return;
  }

  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
  panX.value -= e.deltaX * unit;
  panY.value -= e.deltaY * unit;
}

function startPan(e: PointerEvent) {
  const startX = e.clientX;
  const startY = e.clientY;
  const originPanX = panX.value;
  const originPanY = panY.value;
  isPanning.value = true;

  function move(ev: PointerEvent) {
    panX.value = originPanX + (ev.clientX - startX);
    panY.value = originPanY + (ev.clientY - startY);
  }
  function up() {
    isPanning.value = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function onCanvasPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation();
  leftPress = {
    clientX: e.clientX,
    clientY: e.clientY,
    world: toWorld(e.clientX, e.clientY),
  };
  leftBoxActive = false;
  window.addEventListener("pointermove", onLeftMove);
  window.addEventListener("pointerup", endLeftPress);
}

function onPointerDown(e: PointerEvent) {
  if (e.button === 1) {
    e.preventDefault();
    startPan(e);
  } else if (e.button === 2) {
    startRightPress(e);
  }
}

// Re-pack stacking values to a compact 1..N range every couple of minutes so
// repeated bring-to-front can't grow them without bound.
const NORMALIZE_INTERVAL_MS = 2 * 60 * 1000;
let normalizeTimer: number | undefined;

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  ensureStackingOrder(activeMap.value);
  normalizeTimer = window.setInterval(
    () => normalizeStackingOrder(activeMap.value),
    NORMALIZE_INTERVAL_MS,
  );
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  if (normalizeTimer !== undefined) window.clearInterval(normalizeTimer);
});
</script>

<template>
  <div
    ref="viewerEl"
    class="viewer"
    :class="{ panning: isPanning }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onViewerPointerMove"
    @contextmenu.prevent
  >
    <div class="top-right-stack" @pointerdown.stop>
      <GroupPanel
        v-if="editStack.length"
        :composite="drilledComposite"
        :io-widgets="nestedIoWidgets"
        @up="popUpOneLevel"
        @update:io-widgets="nestedIoWidgets = $event"
      />

      <FramePanel
        v-if="selectedFrames.length && !primarySelected"
        :frames="selectedFrames"
        @dissolve="dissolveSelectedFrames"
      />

      <NodePanel
        v-if="primarySelected"
        class="stacked-panel"
        :map="activeMap"
        :nodes="selectedNodes"
        :def="primaryDef"
        :graph-interface="activeGraphInterface"
        :interface-revision="interfaceRevision"
        :interface-commit-error="interfaceCommitError"
        :apply-interface-mutation="applyInterfaceMutationFromViewer"
        :error="
          selectedNodes.length === 1
            ? nodeErrors[primarySelected.id]
            : undefined
        "
        @frame="wrapCurrentSelection"
        @unframe="unframeCurrentSelection"
      />
    </div>

    <div class="viewport" :style="viewportStyle">
      <div class="canvas-bg" @pointerdown="onCanvasPointerDown" />
      <GraphFrameBox
        v-for="item in visibleFrames"
        :key="item.frame.id"
        :frame="item.frame"
        :rect="item.rect"
        :map="activeMap"
        :zoom="zoom"
        :selected="selectedFrameSet.has(item.frame.id)"
        :selected-frame-ids="selectedFrameSet"
        @select="onSelectFrame"
      />
      <WireLayer
        :map="activeMap"
        :pending-path="pendingPath"
        :slice-path="slicePath"
      />
      <div v-if="marqueeStyle" class="marquee" :style="marqueeStyle" />
      <GraphNode
        v-for="node in activeMap.graph.nodes"
        :key="node.id"
        :node="node"
        :map="activeMap"
        :zoom="zoom"
        :io-widgets="effectiveIoWidgets"
        :io-results="ioResults"
        :selected="selectedIds.includes(node.id)"
        :selected-ids="selectedSet"
        :error="nodeErrors[node.id]"
        @connect-start="onConnectStart"
        @select="onSelect"
        @drill-in="onDrillIn"
      />
    </div>

    <AddNodePanel
      v-if="menu"
      :map="activeMap"
      :screen="menu.screen"
      :compatible="menuCompatible"
      @select="onCreateNode"
      @add-composite="onAddComposite"
      @close="closeMenu"
    />
  </div>
</template>

<style scoped>
.viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1e1e22;
}
.viewer.panning {
  cursor: grabbing;
}
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}
.canvas-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.marquee {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(245, 166, 35, 0.9);
  background: rgba(245, 166, 35, 0.12);
  pointer-events: none;
  z-index: 5;
}
.top-right-stack {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
</style>
