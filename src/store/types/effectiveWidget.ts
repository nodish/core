import type { Port, PortTypeDefinition, TypeWidgetSpec } from "../model";

// Merge a port's customProps onto the type's widget spec.
// Recognized port.customProps overrides: min, max, step -> number bounds.
export function effectiveWidget(
  typeDef: PortTypeDefinition | undefined,
  port: Port,
): TypeWidgetSpec | undefined {
  const base = typeDef?.widget;
  const overrides = port.customProps;
  if (!base && !overrides) return undefined;

  if (!base) {
    if (overrides?.min !== undefined || overrides?.max !== undefined) {
      return {
        kind: "number",
        min: typeof overrides.min === "number" ? overrides.min : undefined,
        max: typeof overrides.max === "number" ? overrides.max : undefined,
        step: typeof overrides.step === "number" ? overrides.step : undefined,
      };
    }
    return undefined;
  }

  if (base.kind === "number") {
    return {
      kind: "number",
      min: typeof overrides?.min === "number" ? overrides.min : base.min,
      max: typeof overrides?.max === "number" ? overrides.max : base.max,
      step: typeof overrides?.step === "number" ? overrides.step : base.step,
    };
  }

  return base;
}
