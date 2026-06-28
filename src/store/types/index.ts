import type { TypeRegistry } from "../model";
import { defineType } from "../registry/defineType";

export const numberType = defineType({
  id: "number",
  label: "Number",
  color: "#7dd3fc",
  validate: (v) => typeof v === "number" && !Number.isNaN(v),
  defaultValue: 0,
  widget: { kind: "number" },
});

export const stringType = defineType({
  id: "string",
  label: "String",
  color: "#c4b5fd",
  validate: (v) => typeof v === "string",
  defaultValue: "",
  widget: { kind: "text" },
});

export const defaultTypes: TypeRegistry = {
  [numberType.id]: numberType,
  [stringType.id]: stringType,
};
