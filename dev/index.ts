import { defineType, type NodePack } from "@nodish/core/pack";
export const pack: NodePack = {
  id: "test",
  nodeTypes: {
    "@test/add": {
      typeId: "@test/add",
      displayName: "Add",
      color: "#444",
      description: "adds 2 numbers",
      inputs: {
        a: {
          type: "number",
          defaultValue: 0,
        },
        b: {
          type: "number",
          defaultValue: 0,
        },
      },
      outputs: {
        result: {
          type: "number",
        },
      },
      execute(inputs) {
        return {
          result: (inputs.a as number) + (inputs.b as number),
        };
      },
    },
  },
  types: {
    number: defineType({
      id: "@test/number",
      label: "Number",
      validate: (value) => typeof value === "number",
    }),
  },
};
