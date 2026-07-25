import { defineType } from "../registry/defineType";
import type { PortTypeDefinition } from "../model";

/** Reserved built-in type id for the envelope type. */
export const ANY_TYPE = "any";

/** Runtime shape of values on {@link ANY_TYPE} ports. */
export type AnyValue = {
  type: string;
  contents: unknown;
};

export function isAnyValue(v: unknown): v is AnyValue {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as AnyValue).type === "string" &&
    "contents" in (v as object)
  );
}

export function wrapAny(type: string, contents: unknown): AnyValue {
  return { type, contents };
}

/** Returns the envelope if `v` is an {@link AnyValue}, otherwise `null`. */
export function unwrapAny(v: unknown): AnyValue | null {
  return isAnyValue(v) ? v : null;
}

/** Built-in {@link PortTypeDefinition} for {@link ANY_TYPE}. */
export const anyTypeDef: PortTypeDefinition = defineType({
  id: ANY_TYPE,
  label: "Any",
  color: "#a8a29e",
  validate: isAnyValue,
  accepts: () => true,
  widget: { kind: "none" },
  defaultValue: { type: ANY_TYPE, contents: undefined },
});
