import type { Port, PortTypeDefinition, TypeWidgetSpec } from "../model";

function numOverride(
  overrides: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const v = overrides?.[key];
  return typeof v === "number" ? v : undefined;
}

function alignedTypeDef(
  typeDef: PortTypeDefinition | undefined,
  port: Port,
): PortTypeDefinition | undefined {
  if (!typeDef || typeDef.id !== port.type) return undefined;
  return typeDef;
}

function resolveWidgetSpec(
  typeDef: PortTypeDefinition,
  port: Port,
): TypeWidgetSpec | undefined {
  const widgetId = port.widgetId ?? typeDef.defaultWidget ?? "default";
  const fromMap = typeDef.widgets?.[widgetId];
  if (fromMap) return fromMap;
  if (typeDef.widgets?.default) return typeDef.widgets.default;
  return typeDef.widget;
}

// Merge a port's customProps onto the type's widget spec.
// Recognized port.customProps overrides: min, max, step, rows, rowHeight.
export function effectiveWidget(
  typeDef: PortTypeDefinition | undefined,
  port: Port,
): TypeWidgetSpec | undefined {
  const aligned = alignedTypeDef(typeDef, port);
  const base = aligned ? resolveWidgetSpec(aligned, port) : undefined;
  const overrides = port.customProps;
  if (!base && !overrides) return undefined;

  if (!base) {
    if (
      overrides?.min !== undefined ||
      overrides?.max !== undefined ||
      numOverride(overrides, "rowHeight") !== undefined
    ) {
      return {
        kind: "number",
        min: numOverride(overrides, "min"),
        max: numOverride(overrides, "max"),
        step: numOverride(overrides, "step"),
        rowHeight: numOverride(overrides, "rowHeight"),
      };
    }
    if (
      numOverride(overrides, "rows") !== undefined ||
      numOverride(overrides, "rowHeight") !== undefined
    ) {
      return {
        kind: "text",
        rows: numOverride(overrides, "rows"),
        rowHeight: numOverride(overrides, "rowHeight"),
      };
    }
    return undefined;
  }

  if (base.kind === "number") {
    return {
      kind: "number",
      min: numOverride(overrides, "min") ?? base.min,
      max: numOverride(overrides, "max") ?? base.max,
      step: numOverride(overrides, "step") ?? base.step,
      rowHeight: numOverride(overrides, "rowHeight") ?? base.rowHeight,
    };
  }

  if (base.kind === "text") {
    return {
      kind: "text",
      rows: numOverride(overrides, "rows") ?? base.rows,
      rowHeight: numOverride(overrides, "rowHeight") ?? base.rowHeight,
    };
  }

  return {
    kind: "custom",
    componentId: base.componentId,
    rowHeight: numOverride(overrides, "rowHeight") ?? base.rowHeight,
  };
}

/** Height in px implied by a widget spec (before port.customProps.rowHeight override). */
export function widgetRowHeight(
  widget: TypeWidgetSpec | undefined,
  defaultRowH: number,
): number {
  if (!widget) return defaultRowH;
  if (widget.rowHeight !== undefined) return widget.rowHeight;
  if (widget.kind === "text") {
    const rows = widget.rows ?? 1;
    return rows * defaultRowH;
  }
  return defaultRowH;
}
