import { defineType, type NodePack } from "@nodish/core";
import BooleanWidget from "./widgets/BooleanWidget.vue";
import ToggleWidget from "./widgets/ToggleWidget.vue";

/** Id passed to {@link TypeWidgetSpec} `kind: "custom"` and `registerComponentWidget`. */
const BOOLEAN_WIDGET_ID = "test/boolean";
const BOOLEAN_TOGGLE_ID = "test/boolean-toggle";

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
  },
  setup({ registerComponentWidget }) {
    registerComponentWidget(BOOLEAN_WIDGET_ID, BooleanWidget);
    registerComponentWidget(BOOLEAN_TOGGLE_ID, ToggleWidget);
  },
};
