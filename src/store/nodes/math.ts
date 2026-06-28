import type { NodeSpec } from "../registry/defineNode";

export const addNode: NodeSpec = {
  typeId: "math/add",
  displayName: "Add",
  color: "#4a7a4a",
  description: "Add two numbers",
  group: ["math", "basic operations"],
  inputs: {
    a: { type: "number", defaultValue: 0 },
    b: { type: "number", defaultValue: 0 },
  },
  outputs: {
    sum: { type: "number" },
  },
  execute: (inputs) => {
    const a = Number(inputs.a ?? 0);
    const b = Number(inputs.b ?? 0);
    return { sum: a + b };
  },
};

export const multiplyNode: NodeSpec = {
  typeId: "math/multiply",
  displayName: "Multiply",
  color: "#4a7a4a",
  description: "Multiply two numbers",
  group: ["math", "basic operations"],
  inputs: {
    a: { type: "number", defaultValue: 0 },
    b: { type: "number", defaultValue: 0 },
  },
  outputs: {
    product: { type: "number" },
  },
  execute: (inputs) => {
    const a = Number(inputs.a ?? 0);
    const b = Number(inputs.b ?? 0);
    return { product: a * b };
  },
};

export const divideNode: NodeSpec = {
  typeId: "math/divide",
  displayName: "Divide",
  color: "#4a7a4a",
  description: "Divide two numbers",
  group: ["math", "basic operations"],
  inputs: {
    a: { type: "number", defaultValue: 0 },
    b: { type: "number", defaultValue: 1 },
  },
  outputs: {
    quotient: { type: "number" },
  },
  execute: (inputs) => {
    const a = Number(inputs.a ?? 0);
    const b = Number(inputs.b ?? 1);
    if (b === 0) throw new Error("Division by zero");
    return { quotient: a / b };
  },
};
