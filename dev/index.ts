import { defineType, type ExecuteContext, type NodePack } from "@nodish/core";
import BooleanWidget from "./widgets/BooleanWidget.vue";
import ToggleWidget from "./widgets/ToggleWidget.vue";

/** Id passed to {@link TypeWidgetSpec} `kind: "custom"` and `registerComponentWidget`. */
const BOOLEAN_WIDGET_ID = "test/boolean";
const BOOLEAN_TOGGLE_ID = "test/boolean-toggle";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Aborted", "AbortError"),
      );
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Aborted", "AbortError"),
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export const pack: NodePack = {
  id: "test",
  types: {
    number: defineType({
      id: "number",
      label: "Number",
      color: "#7dd3fc",
      validate: (value) => typeof value === "number" && !Number.isNaN(value),
      defaultValue: 0,
      widget: { kind: "number" },
    }),
    boolean: defineType({
      id: "boolean",
      label: "Boolean",
      color: "#86efac",
      validate: (value) => typeof value === "boolean",
      defaultValue: false,
      widgets: {
        default: { kind: "custom", componentId: BOOLEAN_WIDGET_ID },
        toggle: { kind: "custom", componentId: BOOLEAN_TOGGLE_ID },
      },
      defaultWidget: "default",
      coerce: (value) => value === true,
      format: (value) => (value === true ? "true" : "false"),
    }),
    string: defineType({
      id: "string",
      label: "Text",
      color: "#fcd34d",
      validate: (value) => typeof value === "string",
      defaultValue: "",
      widget: { kind: "text" },
    }),
  },
  nodeTypes: {
    "@test/add": {
      typeId: "@test/add",
      displayName: "Add",
      color: "#444",
      description: "Adds two numbers",
      inputs: {
        a: { type: "number", defaultValue: 0 },
        b: { type: "number", defaultValue: 0 },
      },
      outputs: {
        result: { type: "number" },
      },
      execute(inputs) {
        return {
          result: (inputs.a as number) + (inputs.b as number),
        };
      },
    },
    "@test/not": {
      typeId: "@test/not",
      displayName: "Not",
      color: "#3d5a4a",
      description: "Inverts a boolean",
      inputs: {
        value: {
          type: "boolean",
          defaultValue: false,
          widgetId: "toggle",
        },
      },
      outputs: {
        result: { type: "boolean" },
      },
      execute(inputs) {
        return { result: !(inputs.value as boolean) };
      },
    },
    "@test/mux": {
      typeId: "@test/mux",
      displayName: "Mux",
      color: "#4a5568",
      description:
        "Union input (number | boolean) with a number widget; hover socket for types",
      inputs: {
        value: {
          type: "number",
          types: ["number", "boolean"],
          defaultValue: 0,
        },
      },
      outputs: {
        result: { type: "number" },
      },
      execute(inputs) {
        const v = inputs.value;
        if (typeof v === "boolean") return { result: v ? 1 : 0 };
        return { result: Number(v ?? 0) };
      },
    },
    "@test/wire-only": {
      typeId: "@test/wire-only",
      displayName: "Wire Only",
      color: "#5a4a3a",
      description: "Union input with connectionOnly (no inline widget)",
      inputs: {
        value: {
          type: "number",
          types: ["number", "boolean"],
          connectionOnly: true,
        },
      },
      outputs: {
        result: { type: "number" },
      },
      execute(inputs) {
        const v = inputs.value;
        if (typeof v === "boolean") return { result: v ? 1 : 0 };
        return { result: Number(v ?? 0) };
      },
    },
    "@test/box-number": {
      typeId: "@test/box-number",
      displayName: "Box Number",
      color: "#78716c",
      description: "Wraps a number into an any envelope",
      inputs: {
        value: { type: "number", defaultValue: 1 },
      },
      outputs: {
        result: { type: "any" },
      },
      execute(inputs) {
        return {
          result: { type: "number", contents: Number(inputs.value ?? 0) },
        };
      },
    },
    "@test/bad-any": {
      typeId: "@test/bad-any",
      displayName: "Bad Any",
      color: "#a16207",
      description: "Outputs an any envelope with a string (fails number assert)",
      inputs: {},
      outputs: {
        result: { type: "any" },
      },
      execute() {
        return { result: { type: "number", contents: "not-a-number" } };
      },
    },
    "@test/delay": {
      typeId: "@test/delay",
      displayName: "Delay",
      color: "#57534e",
      description:
        "IO node: waits `ms` then passes the number through. Live eval skips this.",
      keywords: ["sleep", "wait", "async", "io"],
      group: ["Async"],
      io: true,
      inputs: {
        value: { type: "number", defaultValue: 0 },
        ms: {
          type: "number",
          defaultValue: 800,
          userOnly: true,
        },
      },
      outputs: {
        result: { type: "number" },
      },
      execute: async (
        inputs: Record<string, unknown>,
        ctx: ExecuteContext,
      ) => {
        await sleep(Math.max(0, Number(inputs.ms) || 0), ctx.signal);
        return { result: Number(inputs.value ?? 0) };
      },
    },
    "@test/slow-add": {
      typeId: "@test/slow-add",
      displayName: "Slow Add",
      color: "#44403c",
      description:
        "Pure async add with a short delay. Live eval runs it (debounce/abort).",
      keywords: ["async", "debounce", "abort"],
      group: ["Async"],
      inputs: {
        a: { type: "number", defaultValue: 1 },
        b: { type: "number", defaultValue: 2 },
      },
      outputs: {
        result: { type: "number" },
      },
      execute: async (
        inputs: Record<string, unknown>,
        ctx: ExecuteContext,
      ) => {
        await sleep(400, ctx.signal);
        return {
          result: Number(inputs.a ?? 0) + Number(inputs.b ?? 0),
        };
      },
    },
    "@test/fake-fetch": {
      typeId: "@test/fake-fetch",
      displayName: "Fake Fetch",
      color: "#3f3f46",
      description:
        "IO node: pretends to hit the network. Live eval skips; Test runs it.",
      keywords: ["fetch", "network", "http", "io"],
      group: ["Async"],
      io: true,
      inputs: {
        url: {
          type: "string",
          defaultValue: "https://example.test/item",
        },
      },
      outputs: {
        body: { type: "string" },
      },
      execute: async (
        inputs: Record<string, unknown>,
        ctx: ExecuteContext,
      ) => {
        await sleep(600, ctx.signal);
        if (ctx.signal.aborted) {
          throw ctx.signal.reason instanceof Error
            ? ctx.signal.reason
            : new DOMException("Aborted", "AbortError");
        }
        return { body: `fetched:${String(inputs.url ?? "")}` };
      },
    },
  },
  setup({ registerComponentWidget }) {
    registerComponentWidget(BOOLEAN_WIDGET_ID, BooleanWidget);
    registerComponentWidget(BOOLEAN_TOGGLE_ID, ToggleWidget);
  },
};
