import type { PortTypeDefinition, PortTypeId, TypeWidgetSpec } from "../model";

/**
 * Authoring format for a data type. {@link defineType} expands this into a full
 * {@link PortTypeDefinition} (default label, color, and widget lifecycle hooks).
 */
export interface TypeSpec {
  /** Unique type id (e.g. `"number"`, `"my-pack/label"`). */
  id: PortTypeId;
  label?: string;
  color?: string;
  validate: (value: unknown) => boolean;
  /**
   * Whether an output of type `from` may connect into ports of this type.
   * Omitted means strict identity.
   */
  accepts?: (from: PortTypeId) => boolean;
  /** Fallback when a port of this type omits its own default. */
  defaultValue?: unknown;
  /** Viewer widget descriptor for ports of this type. */
  widget?: TypeWidgetSpec;
  /** Override default parse behaviour for this type's widget. */
  parse?: (raw: string) => unknown;
  /** Override default format behaviour for this type's widget. */
  format?: (value: unknown) => string;
  /** Override default coerce behaviour for this type's widget. */
  coerce?: (value: unknown) => unknown;
}

/**
 * Turn a {@link TypeSpec} into a complete {@link PortTypeDefinition}.
 */
export function defineType(spec: TypeSpec): PortTypeDefinition {
  const widget = spec.widget;
  const auto = defaultsForWidget(widget);
  return {
    id: spec.id,
    label: spec.label ?? defaultLabel(spec.id),
    color: spec.color ?? "#888",
    validate: spec.validate,
    accepts: spec.accepts,
    defaultValue: spec.defaultValue,
    widget,
    parse: spec.parse ?? auto.parse,
    format: spec.format ?? auto.format,
    coerce: spec.coerce ?? auto.coerce,
  };
}

function defaultLabel(id: PortTypeId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function clampNumber(value: unknown, min?: number, max?: number): number {
  let n = Number(value);
  if (Number.isNaN(n)) n = 0;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

function defaultsForWidget(
  widget: TypeWidgetSpec | undefined,
): Pick<PortTypeDefinition, "parse" | "format" | "coerce"> {
  if (!widget) {
    return {
      parse: (raw) => raw,
      format: (v) => (v === undefined || v === null ? "" : String(v)),
    };
  }
  switch (widget.kind) {
    case "number":
      return {
        parse: (raw) => Number(raw),
        format: (v) => (v === undefined || v === null ? "" : String(v)),
        coerce: (v) => clampNumber(v, widget.min, widget.max),
      };
    case "text":
      return {
        parse: (raw) => raw,
        format: (v) => (v === undefined || v === null ? "" : String(v)),
      };
    case "custom":
      return {
        format: (v) => (v === undefined || v === null ? "" : String(v)),
      };
  }
}
