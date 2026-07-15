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
  /** Named widget variants for ports of this type. */
  widgets?: Record<string, TypeWidgetSpec>;
  /** Key into {@link widgets}; defaults to `"default"`. */
  defaultWidget?: string;
  /** Legacy single-widget descriptor; normalized to {@link widgets}.default. */
  widget?: TypeWidgetSpec;
  /** Override pack priority when registering this type from a {@link NodePack}. */
  priority?: number;
  /**
   * When true, omit this type from the GraphInterface type picker.
   * Existing interface ports that already use it remain editable.
   */
  hidden?: boolean;
  /** Override default parse behaviour for this type's widget. */
  parse?: (raw: string) => unknown;
  /** Override default format behaviour for this type's widget. */
  format?: (value: unknown) => string;
  /** Override default coerce behaviour for this type's widget. */
  coerce?: (value: unknown) => unknown;
}

function normalizeWidgets(
  spec: TypeSpec,
): Pick<PortTypeDefinition, "widgets" | "defaultWidget" | "widget"> {
  if (spec.widgets) {
    const keys = Object.keys(spec.widgets);
    const defaultWidget =
      spec.defaultWidget ?? (keys.length === 1 ? keys[0]! : "default");
    return {
      widgets: spec.widgets,
      defaultWidget,
      widget: spec.widgets[defaultWidget] ?? spec.widget,
    };
  }
  if (spec.widget) {
    return {
      widgets: { default: spec.widget },
      defaultWidget: "default",
      widget: spec.widget,
    };
  }
  return {};
}

/**
 * Turn a {@link TypeSpec} into a complete {@link PortTypeDefinition}.
 */
export function defineType(spec: TypeSpec): PortTypeDefinition {
  const widgetFields = normalizeWidgets(spec);
  const widget = widgetFields.widget;
  const auto = defaultsForWidget(widget);
  return {
    id: spec.id,
    label: spec.label ?? defaultLabel(spec.id),
    color: spec.color ?? "#888",
    validate: spec.validate,
    accepts: spec.accepts,
    defaultValue: spec.defaultValue,
    priority: spec.priority,
    hidden: spec.hidden,
    ...widgetFields,
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
    case "none":
      return {
        format: (v) => (v === undefined || v === null ? "" : String(v)),
      };
  }
}
