import { defineType, type NodePack } from "@nodish/core/pack";
import BooleanWidget from "./widgets/BooleanWidget.vue";

/** Id passed to {@link TypeWidgetSpec} `kind: "custom"` and `registerComponentWidget`. */
const BOOLEAN_WIDGET_ID = "test/boolean";

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
      widget: { kind: "custom", componentId: BOOLEAN_WIDGET_ID },
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
        value: { type: "boolean", defaultValue: false },
      },
      outputs: {
        result: { type: "boolean" },
      },
      execute(inputs) {
        return { result: !Boolean(inputs.value) };
      },
    },
    "@test/greater-than": {
      typeId: "@test/greater-than",
      displayName: "Greater than",
      color: "#3d4a5a",
      description: "True when a > b",
      inputs: {
        a: { type: "number", defaultValue: 0 },
        b: { type: "number", defaultValue: 0 },
      },
      outputs: {
        result: { type: "boolean" },
      },
      execute(inputs) {
        return {
          result: Number(inputs.a ?? 0) > Number(inputs.b ?? 0),
        };
      },
    },
  },
  setup({ registerComponentWidget }) {
    registerComponentWidget(BOOLEAN_WIDGET_ID, BooleanWidget);
  },
};
